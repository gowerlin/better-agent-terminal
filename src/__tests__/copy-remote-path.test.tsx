/**
 * T0438 / BUG-105: a remote-profile window gets an extra "Copy Remote Path" entry (file tree,
 * Sidebar workspace menu, Markdown preview, file preview modal) that copies the server form via
 * `remote:resolve-client-paths` (purpose `workspace-entry`). The original "copy path" keeps
 * copying the client form, and a local window shows no extra entry.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { FileTree } from '../components/FileTree'
import { Sidebar } from '../components/Sidebar'
import { MarkdownPreviewPanel } from '../components/MarkdownPreviewPanel'
import { FilePreviewModal } from '../components/PathLinker'
import { resetRemoteWindowCache, isRemoteWindow } from '../hooks/useIsRemoteWindow'
import { copyRemotePath, resolveRemotePath, type ResolvedClientPath } from '../lib/client-paths'
import type { Workspace } from '../types'

/** Same permissive stand-in as attachment-remote-paths.test.tsx. */
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

const UNC_ROOT = '\\\\wsl.localhost\\Ubuntu\\home\\u\\repo'

/** WSL-like `workspace-entry` rules for the mock: distro UNC → /home, drives → /mnt, server form unchanged. */
function wslWorkspaceEntry(paths: string[]): ResolvedClientPath[] {
  return paths.map(input => {
    if (input.startsWith('\\\\wsl.localhost\\Ubuntu\\')) {
      return { input, serverPath: '/' + input.slice('\\\\wsl.localhost\\Ubuntu\\'.length).replace(/\\/g, '/'), reachable: true }
    }
    const m = /^([A-Za-z]):\\(.*)$/.exec(input)
    if (m) return { input, serverPath: `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`, reachable: true }
    return { input, serverPath: input, reachable: true }
  })
}

const writeText = vi.fn(async (_text: string) => undefined)
const resolveClientPaths = vi.fn(async (paths: string[], _purpose: string) => wslWorkspaceEntry(paths))
const COPY_REMOTE = 'Copy Remote Path'

function installApi(kind: 'remote' | 'local') {
  const profileId = kind === 'remote' ? 'wsl-1' : 'default'
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    app: { getWindowProfile: vi.fn(async () => profileId) },
    profile: { listLocal: vi.fn(async () => ({ profiles: [{ id: profileId, name: kind, type: kind }], activeProfileIds: [profileId] })) },
    remote: { resolveClientPaths },
    debug: { log: vi.fn(), isDebugMode: false },
    fs: {
      readdir: vi.fn(async () => [{ name: 'a.ts', path: `${UNC_ROOT}\\a.ts`, isDirectory: false }]),
      readFile: vi.fn(async () => ({ content: '# hi' })),
    },
  })
}

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  writeText.mockClear()
  resolveClientPaths.mockClear()
  resolveClientPaths.mockImplementation(async (paths: string[]) => wslWorkspaceEntry(paths))
  resetRemoteWindowCache()
})

afterEach(() => {
  cleanup()
})

/** Lets the window-kind detection settle. */
async function settle() {
  await act(async () => { await isRemoteWindow() })
}

function renderSidebar(workspaces: Workspace[]) {
  const noop = () => {}
  return render(
    <Sidebar
      width={240}
      workspaces={workspaces}
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

const workspace: Workspace = { id: 'ws1', name: 'repo', folderPath: UNC_ROOT, createdAt: 0 }

describe('remote window', () => {
  beforeEach(() => installApi('remote'))

  test('file tree: "Copy Remote Path" copies the server form; "Copy Absolute Path" stays client form', async () => {
    const { container } = render(<FileTree rootPath={UNC_ROOT} />)
    await settle()
    const node = await waitFor(() => {
      const el = container.querySelector('.file-tree-name')
      expect(el).not.toBeNull()
      return el!
    })

    fireEvent.contextMenu(node)
    await act(async () => { fireEvent.click(screen.getByText(COPY_REMOTE)) })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('/home/u/repo/a.ts'))
    expect(resolveClientPaths).toHaveBeenCalledWith([`${UNC_ROOT}\\a.ts`], 'workspace-entry')

    writeText.mockClear()
    fireEvent.contextMenu(node)
    fireEvent.click(screen.getByText('Copy Absolute Path'))
    expect(writeText).toHaveBeenCalledWith(`${UNC_ROOT}\\a.ts`)
  })

  test('sidebar workspace menu: "Copy Remote Path" copies the server form; "Copy Path" stays client form', async () => {
    renderSidebar([workspace])
    await settle()

    fireEvent.contextMenu(document.querySelector('.workspace-item')!)
    await act(async () => { fireEvent.click(screen.getByText(COPY_REMOTE)) })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('/home/u/repo'))

    writeText.mockClear()
    fireEvent.contextMenu(document.querySelector('.workspace-item')!)
    fireEvent.click(screen.getByText('Copy Path'))
    expect(writeText).toHaveBeenCalledWith(UNC_ROOT)
  })

  test('markdown preview: extra button copies the server form', async () => {
    render(<MarkdownPreviewPanel filePath={`${UNC_ROOT}\\README.md`} onClose={() => {}} />)
    await settle()

    await act(async () => { fireEvent.click(screen.getByTitle(COPY_REMOTE)) })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('/home/u/repo/README.md'))

    writeText.mockClear()
    fireEvent.click(screen.getByTitle('Copy Path'))
    expect(writeText).toHaveBeenCalledWith(`${UNC_ROOT}\\README.md`)
  })

  test('file preview modal: copies the server form for client-form and server-form paths alike', async () => {
    const { rerender } = render(<FilePreviewModal filePath="C:\Users\u\notes.txt" onClose={() => {}} />)
    await settle()

    await act(async () => { fireEvent.click(screen.getByTitle(COPY_REMOTE)) })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('/mnt/c/Users/u/notes.txt'))

    writeText.mockClear()
    rerender(<FilePreviewModal filePath="/home/u/repo/out.log" onClose={() => {}} />)
    await act(async () => { fireEvent.click(screen.getByTitle(COPY_REMOTE)) })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('/home/u/repo/out.log'))
  })

  test('unresolvable path → nothing is copied', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) =>
      paths.map(input => ({ input, serverPath: null, reachable: false, reason: 'no-translator' as const })))
    expect(await copyRemotePath(`${UNC_ROOT}\\a.ts`)).toBe(false)
    expect(writeText).not.toHaveBeenCalled()

    resolveClientPaths.mockRejectedValueOnce(new Error('boom'))
    expect(await resolveRemotePath(`${UNC_ROOT}\\a.ts`)).toBeNull()
  })
})

describe('local window', () => {
  beforeEach(() => installApi('local'))

  test('no "Copy Remote Path" anywhere; copy path unchanged', async () => {
    const { container, unmount } = render(<FileTree rootPath="C:\repo" />)
    await settle()
    const node = await waitFor(() => {
      const el = container.querySelector('.file-tree-name')
      expect(el).not.toBeNull()
      return el!
    })
    fireEvent.contextMenu(node)
    expect(screen.getByText('Copy Absolute Path')).toBeInTheDocument()
    expect(screen.queryByText(COPY_REMOTE)).toBeNull()
    unmount()

    renderSidebar([{ ...workspace, folderPath: 'C:\\repo' }])
    await settle()
    fireEvent.contextMenu(document.querySelector('.workspace-item')!)
    expect(screen.getByText('Copy Path')).toBeInTheDocument()
    expect(screen.queryByText(COPY_REMOTE)).toBeNull()
    cleanup()

    render(<MarkdownPreviewPanel filePath="C:\repo\README.md" onClose={() => {}} />)
    await settle()
    expect(screen.queryByTitle(COPY_REMOTE)).toBeNull()
    cleanup()

    render(<FilePreviewModal filePath="C:\repo\a.ts" onClose={() => {}} />)
    await settle()
    expect(screen.queryByTitle(COPY_REMOTE)).toBeNull()
    expect(resolveClientPaths).not.toHaveBeenCalled()
  })

  test('detection failure → treated as local', async () => {
    ;(window.electronAPI.app.getWindowProfile as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('no registry'))
    expect(await isRemoteWindow()).toBe(false)
  })
})
