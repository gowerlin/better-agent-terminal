/**
 * T0439 / BUG-105: files dropped on a terminal are typed as shell-quoted paths, resolved
 * through `remote:resolve-client-paths` ('local-file', T0437) — host form in a remote window,
 * unreachable ones dropped with a toast — and never followed by `\r`.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import type { ResolvedClientPath } from '../lib/client-paths'
import {
  buildTerminalDropInsertion,
  buildTerminalDropText,
  rememberTerminalShell,
  terminalShellFamily,
} from '../lib/terminal-drop'
import { createPtyWithReplay } from '../lib/pty-replay'

/** Any property is a callable that returns another such proxy — enough for TerminalPanel's xterm wiring. */
const { deepStub, xtermPaste } = vi.hoisted(() => {
  const deepStub = (): unknown => new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === Symbol.toPrimitive) return () => 0
      return deepStub()
    },
    apply: () => deepStub(),
    construct: () => deepStub() as object,
  })
  return { deepStub, xtermPaste: vi.fn<(text: string) => void>() }
})

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    constructor() {
      const stub = deepStub() as Record<string | symbol, unknown>
      return new Proxy({}, {
        get(_target, prop) {
          if (prop === 'paste') return xtermPaste
          return stub[prop]
        },
        set: () => true,
      })
    }
  },
}))
const stubClass = () => class { constructor() { return deepStub() as object } }
vi.mock('@xterm/addon-fit', () => ({ FitAddon: stubClass() }))
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: stubClass() }))
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: stubClass() }))
vi.mock('@xterm/addon-canvas', () => ({ CanvasAddon: stubClass() }))
vi.mock('../utils/terminal-decoration-manager', () => ({ TerminalDecorationManager: stubClass() }))

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
const identity = (paths: string[]): ResolvedClientPath[] => paths.map(input => ({ input, serverPath: input, reachable: true }))
const sshLike = (paths: string[]): ResolvedClientPath[] =>
  paths.map(input => ({ input, serverPath: null, reachable: false, reason: 'ssh-local-file' as const }))

const getPathForFile = vi.fn<(file: File) => string>()
const resolveClientPaths = vi.fn(async (paths: string[], _purpose: string) => identity(paths))
const getShellPath = vi.fn(async (_type: string) => 'C:\\Program Files\\PowerShell\\7\\pwsh.exe')
const ptyWrite = vi.fn(async (_id: string, _data: string) => true)
const ptyCreate = vi.fn(async () => ({ ok: true, created: true }))

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return [] } })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  getPathForFile.mockReset()
  xtermPaste.mockClear()
  ptyWrite.mockClear()
  resolveClientPaths.mockReset()
  resolveClientPaths.mockImplementation(async (paths: string[]) => identity(paths))
  getShellPath.mockClear()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    shell: { getPathForFile },
    remote: { resolveClientPaths },
    settings: { getShellPath },
    pty: { write: ptyWrite, create: ptyCreate, getBuffer: vi.fn(async () => null) },
    debug: { log: vi.fn(), isDebugMode: false },
  })
})

afterEach(() => {
  cleanup()
})

describe('buildTerminalDropText — quoting per shell family (quoteArgForShell)', () => {
  const paths = ['C:\\Users\\u\\My Docs\\a.txt', "/mnt/c/it's here/b.txt", '/home/u/repo/c.ts']

  test('pwsh: single quotes, doubled inner quote', () => {
    expect(buildTerminalDropText(paths, 'pwsh')).toBe(
      "'C:\\Users\\u\\My Docs\\a.txt' '/mnt/c/it''s here/b.txt' /home/u/repo/c.ts",
    )
  })

  test('posix (bash): single quotes, inner quote as \'\\\'\'', () => {
    expect(buildTerminalDropText(paths, 'posix')).toBe(
      "'C:\\Users\\u\\My Docs\\a.txt' '/mnt/c/it'\\''s here/b.txt' /home/u/repo/c.ts",
    )
  })

  test('cmd: double quotes', () => {
    expect(buildTerminalDropText(paths, 'cmd')).toBe(
      "\"C:\\Users\\u\\My Docs\\a.txt\" \"/mnt/c/it's here/b.txt\" /home/u/repo/c.ts",
    )
  })

  test('never ends with a newline', () => {
    for (const shell of ['pwsh', 'posix', 'cmd'] as const) {
      expect(buildTerminalDropText(paths, shell)).not.toMatch(/[\r\n]/)
    }
  })
})

describe('buildTerminalDropInsertion — resolved through remote:resolve-client-paths', () => {
  test('local window (Identity): local paths unchanged', async () => {
    const result = await buildTerminalDropInsertion(['C:\\x y\\a.txt'], 'pwsh')
    expect(resolveClientPaths).toHaveBeenCalledWith(['C:\\x y\\a.txt'], 'local-file')
    expect(result).toEqual({ text: "'C:\\x y\\a.txt'", rejected: [] })
  })

  test('remote reachable: host form, quoted for the remote shell', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => wslLike(paths))
    const result = await buildTerminalDropInsertion(['C:\\Program Files\\x y\\z.txt', 'D:\\code\\a.ts'], 'posix')
    expect(result).toEqual({ text: "'/mnt/c/Program Files/x y/z.txt' /mnt/d/code/a.ts", rejected: [] })
  })

  test('remote partly unreachable: only reachable paths inserted, the rest reported', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => wslLike(paths))
    const result = await buildTerminalDropInsertion(['C:\\a.txt', '\\\\server\\share\\b.txt'], 'posix')
    expect(result).toEqual({ text: '/mnt/c/a.txt', rejected: ['\\\\server\\share\\b.txt'] })
  })

  test('IPC failure: nothing inserted (fail-closed)', async () => {
    resolveClientPaths.mockRejectedValue(new Error('boom'))
    const result = await buildTerminalDropInsertion(['C:\\a.txt'], 'pwsh')
    expect(result).toEqual({ text: '', rejected: ['C:\\a.txt'] })
  })
})

describe('terminalShellFamily', () => {
  test('uses the shell the terminal was created with (createPtyWithReplay)', async () => {
    await createPtyWithReplay({ id: 'term-bash', cwd: '/', type: 'terminal', shell: '/usr/bin/bash' })
    expect(await terminalShellFamily('term-bash')).toBe('posix')
    rememberTerminalShell('term-cmd', 'C:\\Windows\\System32\\cmd.exe')
    expect(await terminalShellFamily('term-cmd')).toBe('cmd')
    expect(getShellPath).not.toHaveBeenCalled()
  })

  test('unknown terminal: falls back to the configured shell', async () => {
    expect(await terminalShellFamily('term-unknown')).toBe('pwsh')
    expect(getShellPath).toHaveBeenCalled()
  })
})

describe('TerminalPanel drop', () => {
  async function renderPanel(terminalId: string) {
    const { TerminalPanel } = await import('../components/TerminalPanel')
    const view = render(<TerminalPanel terminalId={terminalId} isActive />)
    return view.container.querySelector('.terminal-panel') as HTMLElement
  }

  async function drop(panel: HTMLElement, paths: string[]) {
    const files = paths.map(p => new File(['x'], p.split(/[\\/]/).pop()!, { type: 'text/plain' }))
    getPathForFile.mockImplementation((f: File) => paths[files.indexOf(f)] ?? '')
    const dataTransfer = { types: ['Files'], files, dropEffect: 'none' }
    const over = fireEvent.dragOver(panel, { dataTransfer })
    await act(async () => {
      fireEvent.drop(panel, { dataTransfer })
    })
    return { overNotCancelled: over }
  }

  test('local pwsh terminal: quoted local paths pasted, space-separated, no \\r', async () => {
    rememberTerminalShell('t-local', 'C:\\Program Files\\PowerShell\\7\\pwsh.exe')
    const panel = await renderPanel('t-local')
    const { overNotCancelled } = await drop(panel, ['C:\\Users\\u\\My Docs\\a.txt', 'C:\\b.txt'])
    expect(overNotCancelled).toBe(false) // dragover cancelled → drop allowed
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledTimes(1))
    expect(xtermPaste).toHaveBeenCalledWith("'C:\\Users\\u\\My Docs\\a.txt' 'C:\\b.txt'")
    expect(xtermPaste.mock.calls[0][0]).not.toMatch(/[\r\n]/)
    expect(ptyWrite).not.toHaveBeenCalledWith('t-local', expect.stringContaining('\r'))
  })

  test('remote bash terminal: host-form paths; unreachable ones toast and are not inserted', async () => {
    rememberTerminalShell('t-wsl', '/bin/bash')
    resolveClientPaths.mockImplementation(async (paths: string[]) => wslLike(paths))
    const panel = await renderPanel('t-wsl')
    await drop(panel, ['C:\\x y\\a.txt', '\\\\server\\share\\b.txt'])
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith("'/mnt/c/x y/a.txt'"))
    await waitFor(() => expect(panel.textContent).toContain('Not on the remote host, not attached: b.txt'))
  })

  test('remote all unreachable (SSH): nothing inserted, toast shown', async () => {
    rememberTerminalShell('t-ssh', '/bin/bash')
    resolveClientPaths.mockImplementation(async (paths: string[]) => sshLike(paths))
    const panel = await renderPanel('t-ssh')
    await drop(panel, ['C:\\Users\\u\\a.txt'])
    await waitFor(() => expect(panel.textContent).toContain('Not on the remote host, not attached: a.txt'))
    expect(xtermPaste).not.toHaveBeenCalled()
    expect(ptyWrite).not.toHaveBeenCalled()
  })

  test('cmd terminal: double-quoted path', async () => {
    rememberTerminalShell('t-cmd', 'C:\\Windows\\System32\\cmd.exe')
    const panel = await renderPanel('t-cmd')
    await drop(panel, ['C:\\x y\\a.txt'])
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('"C:\\x y\\a.txt"'))
  })

  test('non-file drag (text) is left alone', async () => {
    const panel = await renderPanel('t-text')
    const dataTransfer = { types: ['text/plain'], files: [] }
    const over = fireEvent.dragOver(panel, { dataTransfer })
    expect(over).toBe(true) // not cancelled
    await act(async () => {
      fireEvent.drop(panel, { dataTransfer })
    })
    expect(resolveClientPaths).not.toHaveBeenCalled()
    expect(xtermPaste).not.toHaveBeenCalled()
  })
})
