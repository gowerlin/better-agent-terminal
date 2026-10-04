/**
 * T0435 / BUG-107: Electron 32+ removed the DOM `File.path` augmentation, so drag & drop
 * must resolve paths through `window.electronAPI.shell.getPathForFile` (preload →
 * `webUtils.getPathForFile`). Covers the Claude / Codex panel attachment drop, the Sidebar
 * folder drop, and the Windows-path file name split. The preload delegation itself is
 * covered by `electron/__tests__/preload-get-path-for-file.test.ts`.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { CodexAgentPanel } from '../components/CodexAgentPanel'
import { Sidebar } from '../components/Sidebar'
import { workspaceStore } from '../stores/workspace-store'

/**
 * Permissive `window.electronAPI` stand-in: every leaf is a function. `on*` subscriptions
 * return an unsubscribe no-op; everything else resolves `undefined` (components guard these
 * mount-time calls). `then` stays undefined so namespaces are never mistaken for thenables.
 */
function permissiveApi(overrides: Record<string, Record<string, unknown>>): unknown {
  const leaf = (name: string) => vi.fn((..._args: unknown[]) => (name.startsWith('on') ? () => {} : Promise.resolve(undefined)))
  const namespace = (ns: string) => {
    const cache: Record<string, unknown> = { ...(overrides[ns] ?? {}) }
    return new Proxy(cache, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined
        if (!(prop in target)) target[prop] = leaf(prop)
        return target[prop]
      },
    })
  }
  const namespaces: Record<string, unknown> = {}
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

const getPathForFile = vi.fn<(file: File) => string>()
const readAsDataUrl = vi.fn(async (_p: string) => 'data:image/png;base64,AAAA')

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  // jsdom lacks scrollIntoView; the panels call it while rendering messages.
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  getPathForFile.mockReset()
  readAsDataUrl.mockClear()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    shell: { getPathForFile },
    image: { readAsDataUrl },
    debug: { log: vi.fn(), isDebugMode: false },
    // The statusline stores this result unguarded; resolve an empty object, not undefined.
    claude: { getStatuslineExtras: vi.fn(async () => ({})) },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function drop(target: Element, files: File[]) {
  fireEvent.drop(target, { dataTransfer: { files, types: ['Files'], getData: () => '' } })
}

describe.each([
  ['ClaudeAgentPanel', (sid: string) => <ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} />],
  ['CodexAgentPanel', (sid: string) => <CodexAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} />],
] as const)('%s drop', (_name, renderPanel) => {
  test('attaches the path from getPathForFile and names it from a Windows path', async () => {
    getPathForFile.mockReturnValue('C:\\Users\\u\\Docs\\report.txt')
    const { container } = render(renderPanel(`t0435-file-${_name}`))
    const panel = container.querySelector('.claude-agent-panel')!
    const file = new File(['x'], 'report.txt', { type: 'text/plain' })

    await act(async () => { drop(panel, [file]) })

    expect(getPathForFile).toHaveBeenCalledWith(file)
    const chip = await waitFor(() => {
      const el = container.querySelector('.claude-attachment-file')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(chip).toHaveAttribute('title', 'C:\\Users\\u\\Docs\\report.txt')
    expect(chip.querySelector('.claude-attachment-file-name')).toHaveTextContent(/^report\.txt$/)
  })

  test('image drop reads the resolved path; empty path is skipped', async () => {
    getPathForFile.mockImplementation((f: File) => (f.name === 'shot.png' ? 'C:\\pics\\shot.png' : ''))
    const { container } = render(renderPanel(`t0435-img-${_name}`))
    const panel = container.querySelector('.claude-agent-panel')!

    await act(async () => {
      drop(panel, [
        new File(['x'], 'shot.png', { type: 'image/png' }),
        new File(['y'], 'virtual.txt', { type: 'text/plain' }),
      ])
    })

    await waitFor(() => expect(readAsDataUrl).toHaveBeenCalledWith('C:\\pics\\shot.png'))
    expect(container.querySelector('.claude-attachment-file')).toBeNull()
  })
})

describe('Sidebar external folder drop', () => {
  function renderSidebar() {
    const noop = () => {}
    return render(
      <Sidebar
        width={240}
        workspaces={[]}
        activeWorkspaceId={null}
        windowId="w1"
        groups={[]}
        activeGroup={null}
        archivedWorkspaces={[]}
        onSetActiveGroup={noop}
        onSetWorkspaceGroup={noop}
        onSelectWorkspace={noop}
        onAddWorkspace={noop}
        onRemoveWorkspace={noop}
        onRenameWorkspace={noop}
        onReorderWorkspaces={noop}
        onArchiveWorkspace={noop}
        onUnarchiveWorkspace={noop}
        onOpenEnvVars={noop}
        onDetachWorkspace={noop}
        onOpenProfiles={noop}
        onOpenSettings={noop}
        onCollapse={noop}
      />,
    )
  }

  test('adds a workspace using the path from getPathForFile', () => {
    const add = vi.spyOn(workspaceStore, 'addWorkspace').mockImplementation(() => ({}) as never)
    const save = vi.spyOn(workspaceStore, 'save').mockResolvedValue()
    getPathForFile.mockReturnValue('D:\\code\\my-project')
    const { container } = renderSidebar()
    const folder = new File([], 'my-project')

    drop(container.querySelector('.workspace-list')!, [folder])

    expect(getPathForFile).toHaveBeenCalledWith(folder)
    expect(add).toHaveBeenCalledWith('my-project', 'D:\\code\\my-project')
    expect(save).toHaveBeenCalled()
  })

  test('skips files without a disk path', () => {
    const add = vi.spyOn(workspaceStore, 'addWorkspace').mockImplementation(() => ({}) as never)
    vi.spyOn(workspaceStore, 'save').mockResolvedValue()
    getPathForFile.mockReturnValue('')
    const { container } = renderSidebar()

    drop(container.querySelector('.workspace-list')!, [new File([], 'x')])

    expect(add).not.toHaveBeenCalled()
  })
})
