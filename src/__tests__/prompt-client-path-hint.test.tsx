/**
 * T0440 / BUG-105 (T0421 strategy C): client-form paths typed into a Claude prompt of a remote
 * window get a non-blocking notice; the prompt itself is always sent unchanged.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { settingsStore } from '../stores/settings-store'
import { isRemoteWindow, resetRemoteWindowCache } from '../hooks/useIsRemoteWindow'
import { findClientPathsInPrompt, pairPathSuggestions, resolvePromptPathSuggestions } from '../lib/prompt-client-paths'
import type { ResolvedClientPath } from '../lib/client-paths'

describe('findClientPathsInPrompt', () => {
  test.each([
    ['look at C:\\Users\\u\\a.txt please', ['C:\\Users\\u\\a.txt']],
    ['lower-case drive d:\\data\\b.csv', ['d:\\data\\b.csv']],
    ['@C:\\Users\\u\\a.txt', ['C:\\Users\\u\\a.txt']],
    ['open \\\\wsl.localhost\\Ubuntu\\home\\u\\x.ts now', ['\\\\wsl.localhost\\Ubuntu\\home\\u\\x.ts']],
    ['open \\\\wsl$\\Ubuntu\\home\\u\\x.ts', ['\\\\wsl$\\Ubuntu\\home\\u\\x.ts']],
    ['upper \\\\WSL.LOCALHOST\\Ubuntu\\a', ['\\\\WSL.LOCALHOST\\Ubuntu\\a']],
    ['quoted "C:\\Program Files\\x y\\z.txt" keeps spaces', ['C:\\Program Files\\x y\\z.txt']],
    ["single 'C:\\a b\\c.txt'", ['C:\\a b\\c.txt']],
    ['end of sentence C:\\a.txt.', ['C:\\a.txt']],
    ['(see C:\\a\\b.txt), then', ['C:\\a\\b.txt']],
    ['中文 C:\\資料\\報告.docx，請看', ['C:\\資料\\報告.docx']],
    ['drive root C:\\ only', ['C:\\']],
    ['two C:\\a and \\\\wsl$\\D\\b then C:\\a again', ['C:\\a', '\\\\wsl$\\D\\b']],
    ['line one\nC:\\x\\y.md\nline three', ['C:\\x\\y.md']],
  ])('%s', (text, expected) => {
    expect(findClientPathsInPrompt(text)).toEqual(expected)
  })

  test.each([
    ['empty', ''],
    ['fenced code', 'run this:\n```\ncopy C:\\a.txt C:\\b.txt\n```\nthanks'],
    ['fenced code with language', '```powershell\nGet-Item \\\\wsl$\\Ubuntu\\x\n```'],
    ['tilde fence', '~~~\nC:\\a\n~~~'],
    ['unterminated fence', 'see\n```\nC:\\a\\b.txt'],
    ['inline code', 'the file `C:\\Users\\u\\a.txt` is fine'],
    ['double-backtick inline code', 'use ``dir C:\\x`` here'],
    ['https URL', 'see https://example.com/C:\\x and http://h/\\\\wsl$\\x'],
    ['file URL', 'open file:///C:\\Users\\u\\a.txt'],
    ['drive letter continuing a word', 'abc:\\foo and foo\\C:\\bar and x/C:\\y'],
    ['regex character class', 'match ^[A-Za-z]:\\\\ or \\d:\\\\ here'],
    ['forward-slash form', 'C:/Users/u/a.txt'],
    ['server paths', '/home/u/a.txt and /mnt/c/Users/u'],
    ['other UNC shares', '\\\\fileserver\\share\\doc.pdf'],
    ['a drive letter without backslash', 'Note: see A: section'],
  ])('no hint: %s', (_name, text) => {
    expect(findClientPathsInPrompt(text)).toEqual([])
  })

  test('paths outside code still count when code is present', () => {
    expect(findClientPathsInPrompt('`C:\\in\\code` but C:\\out\\side.txt is not')).toEqual(['C:\\out\\side.txt'])
  })
})

describe('pairPathSuggestions', () => {
  test('reachable answers that differ from the input become suggestions; anything else gives none', () => {
    const paths = ['C:\\a', 'C:\\b', 'C:\\c', 'C:\\d']
    expect(pairPathSuggestions(paths, [
      { input: 'C:\\a', serverPath: '/mnt/c/a', reachable: true },
      { input: 'C:\\b', serverPath: null, reachable: false, reason: 'ssh-local-file' },
      { input: 'C:\\other', serverPath: '/x', reachable: true },
      { input: 'C:\\d', serverPath: 'C:\\d', reachable: true }, // Identity: nothing to suggest
    ])).toEqual([
      { path: 'C:\\a', serverPath: '/mnt/c/a' },
      { path: 'C:\\b', serverPath: null },
      { path: 'C:\\c', serverPath: null },
      { path: 'C:\\d', serverPath: null },
    ])
    expect(pairPathSuggestions(['C:\\a'], null)).toEqual([{ path: 'C:\\a', serverPath: null }])
  })
})

// ─── Claude panel ─────────────────────────────────────────────────────────────

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

/** WSL-like rules: drives → /mnt, everything else unreachable. */
function wslLike(paths: string[]): ResolvedClientPath[] {
  return paths.map(input => {
    const m = /^([A-Za-z]):\\(.*)$/.exec(input)
    return m
      ? { input, serverPath: `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`, reachable: true }
      : { input, serverPath: null, reachable: false, reason: 'outside-wsl-distro' as const }
  })
}

const sendMessage = vi.fn(async (_sid: string, _prompt: string, _images?: string[]) => undefined)
const resolveClientPaths = vi.fn(async (paths: string[], _purpose: string) => wslLike(paths))
let windowProfileId: string | null = 'p-wsl'

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  sendMessage.mockClear()
  resolveClientPaths.mockClear()
  resolveClientPaths.mockImplementation(async (paths: string[]) => wslLike(paths))
  windowProfileId = 'p-wsl'
  resetRemoteWindowCache()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    remote: { resolveClientPaths },
    app: { getWindowProfile: vi.fn(async () => windowProfileId) },
    profile: {
      listLocal: vi.fn(async () => ({
        profiles: [{ id: 'p-wsl', type: 'remote' }, { id: 'p-local', type: 'local' }],
        activeProfileIds: [],
      })),
    },
    debug: { log: vi.fn(), isDebugMode: false },
    claude: { getStatuslineExtras: vi.fn(async () => ({})), sendMessage },
  })
  settingsStore.setPromptClientPathHint(true)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function renderPanel(sid: string) {
  const view = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} isRemoteConnected={true} />)
  await act(async () => { await isRemoteWindow() })
  return view
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

const hint = (container: HTMLElement) => container.querySelector('.claude-path-hint') as HTMLElement | null

describe('ClaudeAgentPanel prompt path hint', () => {
  test('remote window: the prompt is sent unchanged and a notice shows the host form', async () => {
    const { container } = await renderPanel('t0440-remote')
    const text = 'read C:\\Users\\u\\a.txt and \\\\wsl.localhost\\Other\\b.md'
    await send(container, text)

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage.mock.calls[0][1]).toBe(text)
    const el = await waitFor(() => {
      expect(hint(container)).not.toBeNull()
      return hint(container)!
    })
    expect(resolveClientPaths).toHaveBeenCalledWith(['C:\\Users\\u\\a.txt', '\\\\wsl.localhost\\Other\\b.md'], 'local-file')
    expect(el).toHaveTextContent('Sent as typed.')
    expect(el).toHaveTextContent('C:\\Users\\u\\a.txt — on the remote host: /mnt/c/Users/u/a.txt')
    expect(el).toHaveTextContent('\\\\wsl.localhost\\Other\\b.md')
    expect(el).not.toHaveTextContent('b.md — on the remote host')
  })

  test('"Don\'t show again" turns the setting off; later prompts get no notice', async () => {
    const { container, getByText } = await renderPanel('t0440-disable')
    await send(container, 'C:\\a.txt')
    await waitFor(() => expect(hint(container)).not.toBeNull())

    await act(async () => { fireEvent.click(getByText("Don't show again")) })
    expect(hint(container)).toBeNull()
    expect(settingsStore.getSettings().promptClientPathHint).toBe(false)

    resolveClientPaths.mockClear()
    await send(container, 'C:\\b.txt')
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2))
    expect(sendMessage.mock.calls[1][1]).toBe('C:\\b.txt')
    expect(resolveClientPaths).not.toHaveBeenCalled()
    expect(hint(container)).toBeNull()
  })

  test('the close button dismisses the notice; the next prompt without paths shows none', async () => {
    const { container } = await renderPanel('t0440-dismiss')
    await send(container, 'C:\\a.txt')
    await waitFor(() => expect(hint(container)).not.toBeNull())
    await act(async () => { fireEvent.click(container.querySelector('.claude-path-hint-close')!) })
    expect(hint(container)).toBeNull()
    expect(settingsStore.getSettings().promptClientPathHint).toBe(true)

    await send(container, 'C:\\b.txt')
    await waitFor(() => expect(hint(container)).not.toBeNull())
    await send(container, 'no paths here')
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3))
    expect(hint(container)).toBeNull()
  })

  test('paths only inside code: no notice, no lookup', async () => {
    const { container } = await renderPanel('t0440-code')
    const text = 'try `dir C:\\x` and\n```\ncopy C:\\a C:\\b\n```'
    await send(container, text)
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage.mock.calls[0][1]).toBe(text)
    expect(resolveClientPaths).not.toHaveBeenCalled()
    expect(hint(container)).toBeNull()
  })

  test('a lookup failure still shows the notice, without suggestions', async () => {
    resolveClientPaths.mockRejectedValueOnce(new Error('boom'))
    const { container } = await renderPanel('t0440-ipc-fail')
    await send(container, 'C:\\a.txt')
    await waitFor(() => expect(hint(container)).not.toBeNull())
    expect(hint(container)).toHaveTextContent('C:\\a.txt')
    expect(hint(container)).not.toHaveTextContent('on the remote host:')
  })

  test.each([
    ['a local profile window', 'p-local'],
    ['an unbound window', null],
  ])('%s: no notice, no lookup', async (_name, profileId) => {
    windowProfileId = profileId
    const { container } = await renderPanel(`t0440-local-${String(profileId)}`)
    await send(container, 'C:\\Users\\u\\a.txt')
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage.mock.calls[0][1]).toBe('C:\\Users\\u\\a.txt')
    expect(resolveClientPaths).not.toHaveBeenCalled()
    expect(hint(container)).toBeNull()
  })
})

test('resolvePromptPathSuggestions asks for local-file answers', async () => {
  expect(await resolvePromptPathSuggestions(['C:\\a'])).toEqual([{ path: 'C:\\a', serverPath: '/mnt/c/a' }])
  expect(resolveClientPaths).toHaveBeenCalledWith(['C:\\a'], 'local-file')
})
