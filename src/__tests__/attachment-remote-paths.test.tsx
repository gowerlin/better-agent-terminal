/**
 * T0437 / BUG-105: Claude / Codex panel file attachments are resolved through
 * `remote:resolve-client-paths` (purpose `local-file`) before sending: reachable ones go out as
 * `@<server path>`, unreachable ones are dropped with a toast ("not on the remote host"). The
 * reachability rules themselves: electron/remote/__tests__/resolve-client-paths.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { CodexAgentPanel } from '../components/CodexAgentPanel'
import { attachmentDisplayNames, resolveAttachmentPaths, splitResolvedPaths, type ResolvedClientPath } from '../lib/client-paths'

/** Same permissive stand-in as drag-drop-get-path-for-file.test.tsx. */
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

/** WSL-like rules for the mock: drives → /mnt, everything else unreachable. */
function wslLike(paths: string[]): ResolvedClientPath[] {
  return paths.map(input => {
    const m = /^([A-Za-z]):\\(.*)$/.exec(input)
    return m
      ? { input, serverPath: `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`, reachable: true }
      : { input, serverPath: null, reachable: false, reason: 'outside-wsl-distro' as const }
  })
}

const getPathForFile = vi.fn<(file: File) => string>()
const sendMessage = vi.fn(async (_sid: string, _prompt: string, _images?: string[]) => undefined)
const resolveClientPaths = vi.fn(async (paths: string[], _purpose: string) => wslLike(paths))

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  getPathForFile.mockReset()
  sendMessage.mockClear()
  resolveClientPaths.mockClear()
  resolveClientPaths.mockImplementation(async (paths: string[]) => wslLike(paths))
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    shell: { getPathForFile },
    remote: { resolveClientPaths },
    debug: { log: vi.fn(), isDebugMode: false },
    claude: { getStatuslineExtras: vi.fn(async () => ({})), sendMessage },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function dropFiles(container: HTMLElement, paths: string[]) {
  const files = paths.map(p => new File(['x'], p.split(/[\\/]/).pop()!, { type: 'text/plain' }))
  getPathForFile.mockImplementation((f: File) => paths[files.indexOf(f)] ?? '')
  const panel = container.querySelector('.claude-agent-panel')!
  await act(async () => {
    fireEvent.drop(panel, { dataTransfer: { files, types: ['Files'], getData: () => '' } })
  })
  await waitFor(() => expect(container.querySelectorAll('.claude-attachment-file')).toHaveLength(paths.length))
}

async function send(container: HTMLElement, text: string) {
  const input = container.querySelector('textarea.claude-input') as HTMLTextAreaElement
  await act(async () => {
    input.value = text
    fireEvent.input(input)
  })
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

describe.each([
  ['ClaudeAgentPanel', (sid: string) => <ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} isRemoteConnected={true} />],
  ['CodexAgentPanel', (sid: string) => <CodexAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} isRemoteConnected={true} />],
] as const)('%s attachments in a remote window', (name, renderPanel) => {
  test('reachable attachments are sent as @<server path>', async () => {
    const { container } = render(renderPanel(`t0437-ok-${name}`))
    await dropFiles(container, ['C:\\Users\\u\\a.txt', 'D:\\data\\b.csv'])
    await send(container, 'look')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(resolveClientPaths).toHaveBeenCalledWith(['C:\\Users\\u\\a.txt', 'D:\\data\\b.csv'], 'local-file')
    expect(sendMessage.mock.calls[0][1]).toBe('@/mnt/c/Users/u/a.txt\n@/mnt/d/data/b.csv\n\nlook')
    expect(container.querySelector('.ct-toast')).toBeNull()
  })

  test('an unreachable attachment is dropped with a toast; the rest is sent', async () => {
    const { container } = render(renderPanel(`t0437-mixed-${name}`))
    await dropFiles(container, ['C:\\Users\\u\\a.txt', '\\\\fileserver\\share\\doc.pdf'])
    await send(container, 'look')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    const prompt = sendMessage.mock.calls[0][1]
    expect(prompt).toBe('@/mnt/c/Users/u/a.txt\n\nlook')
    expect(prompt).not.toContain('fileserver')
    const toast = await waitFor(() => {
      const el = container.querySelector('.ct-toast')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(toast).toHaveTextContent('Not on the remote host, not attached: doc.pdf')
    expect(container.querySelectorAll('.claude-attachment-file')).toHaveLength(0)
  })

  test('only unreachable attachments and no text: nothing is sent, the chips are removed', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) =>
      paths.map(input => ({ input, serverPath: null, reachable: false, reason: 'ssh-local-file' as const })))
    const { container } = render(renderPanel(`t0437-none-${name}`))
    await dropFiles(container, ['C:\\Users\\u\\a.txt'])
    await send(container, '')

    await waitFor(() => expect(container.querySelector('.ct-toast')).not.toBeNull())
    expect(sendMessage).not.toHaveBeenCalled()
    expect(container.querySelectorAll('.claude-attachment-file')).toHaveLength(0)
  })
})

test('a local window (Identity answer) sends the attachment path unchanged', async () => {
  resolveClientPaths.mockImplementation(async (paths: string[]) => paths.map(input => ({ input, serverPath: input, reachable: true })))
  const { container } = render(<ClaudeAgentPanel sessionId="t0437-local" cwd="C:\\repo" isActive={true} />)
  await dropFiles(container, ['C:\\Users\\u\\a.txt'])
  await send(container, 'hi')

  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
  expect(sendMessage.mock.calls[0][1]).toBe('@C:\\Users\\u\\a.txt\n\nhi')
})

describe('client-paths helpers', () => {
  test('splitResolvedPaths pairs answers with inputs and fails closed', () => {
    const paths = ['C:\\a', 'C:\\b', 'C:\\c']
    expect(splitResolvedPaths(paths, [
      { input: 'C:\\a', serverPath: '/mnt/c/a', reachable: true },
      { input: 'C:\\b', serverPath: null, reachable: false, reason: 'outside-wsl-distro' },
      { input: 'C:\\other', serverPath: '/x', reachable: true }, // mismatched answer → rejected
    ])).toEqual({ serverPaths: ['/mnt/c/a'], rejected: ['C:\\b', 'C:\\c'] })
    expect(splitResolvedPaths(paths, undefined)).toEqual({ serverPaths: [], rejected: paths })
  })

  test('resolveAttachmentPaths: no call for no paths; an IPC failure rejects all', async () => {
    expect(await resolveAttachmentPaths([])).toEqual({ serverPaths: [], rejected: [] })
    expect(resolveClientPaths).not.toHaveBeenCalled()
    resolveClientPaths.mockRejectedValueOnce(new Error('boom'))
    expect(await resolveAttachmentPaths(['C:\\a'])).toEqual({ serverPaths: [], rejected: ['C:\\a'] })
  })

  test('attachmentDisplayNames uses file names of either separator', () => {
    expect(attachmentDisplayNames(['C:\\x\\a.txt', '/home/u/b.md', '\\\\srv\\s\\c.pdf'])).toBe('a.txt, b.md, c.pdf')
  })
})
