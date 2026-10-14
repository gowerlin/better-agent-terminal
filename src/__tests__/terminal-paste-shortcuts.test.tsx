/**
 * T0522 / BUG-128: macOS Command+V in a terminal. A Finder copy is typed as shell-quoted
 * paths (same as a file drop, T0439); a text clipboard pastes once; Ctrl+V on macOS does the
 * same; Windows / Linux shortcuts are unchanged (incl. Windows image → Alt+V `\x1bv`).
 * Main-side reader: electron/__tests__/clipboard-file-paths.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import type { ResolvedClientPath } from '../lib/client-paths'
import { buildTerminalDropText } from '../lib/terminal-drop'
import { isMacCommandPaste, readMacTerminalClipboard } from '../lib/terminal-paste'

type KeyHandler = (event: KeyboardEvent) => boolean

const { deepStub, xtermPaste, keyHandlers } = vi.hoisted(() => {
  const deepStub = (): unknown => new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === Symbol.toPrimitive) return () => 0
      return deepStub()
    },
    apply: () => deepStub(),
    construct: () => deepStub() as object,
  })
  return { deepStub, xtermPaste: vi.fn<(text: string) => void>(), keyHandlers: [] as Array<(event: KeyboardEvent) => boolean> }
})

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    constructor() {
      const stub = deepStub() as Record<string | symbol, unknown>
      return new Proxy({}, {
        get(_target, prop) {
          if (prop === 'paste') return xtermPaste
          if (prop === 'getSelection') return () => ''
          if (prop === 'attachCustomKeyEventHandler') return (h: KeyHandler) => { keyHandlers.push(h) }
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

/** Same permissive stand-in as terminal-drop-file-path.test.tsx, plus a top-level `platform`. */
function permissiveApi(platform: string, overrides: Record<string, Record<string, unknown>>): unknown {
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
  const namespaces: Record<string, unknown> = { platform }
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

const identity = (paths: string[]): ResolvedClientPath[] => paths.map(input => ({ input, serverPath: input, reachable: true }))

const readFilePaths = vi.fn<() => Promise<string[]>>()
const readText = vi.fn<() => Promise<string>>()
const clipboardRead = vi.fn<() => Promise<Array<{ types: string[] }>>>()
const resolveClientPaths = vi.fn(async (paths: string[], _purpose: string) => identity(paths))
const getShellPath = vi.fn(async (_type: string) => '/bin/zsh')
const ptyWrite = vi.fn(async (_id: string, _data: string) => true)

function setNavigatorPlatform(value: string) {
  Object.defineProperty(navigator, 'platform', { value, configurable: true })
}

function setup(platform: 'darwin' | 'win32' | 'linux') {
  setNavigatorPlatform(platform === 'darwin' ? 'MacIntel' : platform === 'win32' ? 'Win32' : 'Linux x86_64')
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi(platform, {
    clipboard: { readFilePaths },
    remote: { resolveClientPaths },
    settings: { getShellPath },
    pty: { write: ptyWrite, create: vi.fn(async () => ({ ok: true, created: true })), getBuffer: vi.fn(async () => null) },
    debug: { log: vi.fn(), isDebugMode: false },
  })
}

async function renderTerminal(id: string) {
  const { TerminalPanel } = await import('../components/TerminalPanel')
  const view = render(<TerminalPanel terminalId={id} isActive={true} />)
  await waitFor(() => expect(keyHandlers.length).toBeGreaterThan(0))
  return { ...view, handler: keyHandlers[keyHandlers.length - 1] }
}

function keydown(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', { cancelable: true, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init })
}

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return [] } })
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText, read: clipboardRead, writeText: vi.fn(async () => {}) },
    configurable: true,
  })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  keyHandlers.length = 0
  for (const fn of [xtermPaste, ptyWrite, getShellPath]) fn.mockClear()
  readFilePaths.mockReset()
  readText.mockReset()
  clipboardRead.mockReset()
  resolveClientPaths.mockReset()
  resolveClientPaths.mockImplementation(async (paths: string[]) => identity(paths))
})

afterEach(() => {
  cleanup()
})

describe('isMacCommandPaste', () => {
  const base = { key: 'v', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false }
  test('plain Command+V on macOS only', () => {
    expect(isMacCommandPaste(base, 'darwin')).toBe(true)
    expect(isMacCommandPaste({ ...base, key: 'V' }, 'darwin')).toBe(true)
    expect(isMacCommandPaste(base, 'win32')).toBe(false)
    expect(isMacCommandPaste(base, 'linux')).toBe(false)
    expect(isMacCommandPaste(base, undefined)).toBe(false)
  })
  test('other modifiers / keys are left alone', () => {
    expect(isMacCommandPaste({ ...base, shiftKey: true }, 'darwin')).toBe(false)
    expect(isMacCommandPaste({ ...base, altKey: true }, 'darwin')).toBe(false)
    expect(isMacCommandPaste({ ...base, ctrlKey: true }, 'darwin')).toBe(false)
    expect(isMacCommandPaste({ ...base, metaKey: false, ctrlKey: true }, 'darwin')).toBe(false)
    expect(isMacCommandPaste({ ...base, key: 'c' }, 'darwin')).toBe(false)
  })
})

describe('readMacTerminalClipboard', () => {
  test('file items → paths, text not read', async () => {
    const readers = { readFilePaths: vi.fn(async () => ['/a b']), readText: vi.fn(async () => 'a b') }
    await expect(readMacTerminalClipboard(readers)).resolves.toEqual({ kind: 'paths', paths: ['/a b'] })
    expect(readers.readText).not.toHaveBeenCalled()
  })
  test('no file items → text', async () => {
    const readers = { readFilePaths: vi.fn(async () => []), readText: vi.fn(async () => 'hello') }
    await expect(readMacTerminalClipboard(readers)).resolves.toEqual({ kind: 'text', text: 'hello' })
  })
  test('path read failure degrades to text', async () => {
    const log = vi.fn()
    const readers = { readFilePaths: vi.fn(async () => { throw new Error('ipc down') }), readText: vi.fn(async () => 'hello') }
    await expect(readMacTerminalClipboard(readers, log)).resolves.toEqual({ kind: 'text', text: 'hello' })
    expect(log).toHaveBeenCalled()
  })
})

describe('Finder paths → shell-quoted text (posix shells on macOS)', () => {
  test('spaces, single quotes, CJK, multiple files', () => {
    expect(buildTerminalDropText([
      '/Users/gary/Desktop/My Report.pdf',
      "/Users/gary/it's here",
      '/Users/gary/文件/截圖 1.png',
      '/Users/gary/plain.txt',
    ], 'posix')).toBe(
      "'/Users/gary/Desktop/My Report.pdf' '/Users/gary/it'\\''s here' '/Users/gary/文件/截圖 1.png' /Users/gary/plain.txt",
    )
  })
})

describe('TerminalPanel paste shortcuts', () => {
  test('macOS Command+V with Finder items types quoted paths (bracketed paste), no Enter', async () => {
    setup('darwin')
    readFilePaths.mockResolvedValue(['/Users/gary/My Report.pdf', '/Users/gary/b.txt'])
    const { handler } = await renderTerminal('t0522-mac-files')

    const ev = keydown({ key: 'v', metaKey: true })
    let handled: boolean | undefined
    act(() => { handled = handler(ev) })

    expect(handled).toBe(false)
    expect(ev.defaultPrevented).toBe(true)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith("'/Users/gary/My Report.pdf' /Users/gary/b.txt"))
    expect(resolveClientPaths).toHaveBeenCalledWith(['/Users/gary/My Report.pdf', '/Users/gary/b.txt'], 'local-file')
    expect(readText).not.toHaveBeenCalled()
    expect(ptyWrite).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('\r'))
  })

  test('macOS Command+V with text pastes it once; a native paste that follows is swallowed', async () => {
    setup('darwin')
    readFilePaths.mockResolvedValue([])
    readText.mockResolvedValue('hello from LINE')
    const { handler, container } = await renderTerminal('t0522-mac-text')

    const ev = keydown({ key: 'v', metaKey: true })
    act(() => { handler(ev) })
    expect(ev.defaultPrevented).toBe(true)

    const nativePaste = new Event('paste', { bubbles: true, cancelable: true })
    const xtermListener = vi.fn()
    const panel = container.querySelector('.terminal-panel')!
    const inner = document.createElement('textarea')
    panel.appendChild(inner)
    inner.addEventListener('paste', xtermListener)
    inner.dispatchEvent(nativePaste)
    expect(nativePaste.defaultPrevented).toBe(true)
    expect(xtermListener).not.toHaveBeenCalled()

    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('hello from LINE'))
    expect(xtermPaste).toHaveBeenCalledTimes(1)
  })

  test('macOS: a paste event without a preceding Command+V is left to xterm', async () => {
    setup('darwin')
    const { container } = await renderTerminal('t0522-mac-native')
    const panel = container.querySelector('.terminal-panel')!
    const inner = document.createElement('textarea')
    panel.appendChild(inner)
    const xtermListener = vi.fn()
    inner.addEventListener('paste', xtermListener)
    const ev = new Event('paste', { bubbles: true, cancelable: true })
    inner.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
    expect(xtermListener).toHaveBeenCalledTimes(1)
  })

  test('macOS Ctrl+V gives the same result as Command+V', async () => {
    setup('darwin')
    readFilePaths.mockResolvedValue(['/Users/gary/文件/a b.txt'])
    const { handler } = await renderTerminal('t0522-mac-ctrl')

    const ev = keydown({ key: 'v', ctrlKey: true })
    act(() => { handler(ev) })

    expect(ev.defaultPrevented).toBe(true)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith("'/Users/gary/文件/a b.txt'"))
    expect(readText).not.toHaveBeenCalled()
  })

  test('Windows Ctrl+V: image → Alt+V (\\x1bv); file paths never queried', async () => {
    setup('win32')
    clipboardRead.mockResolvedValue([{ types: ['image/png'] }])
    const { handler } = await renderTerminal('t0522-win-image')

    act(() => { handler(keydown({ key: 'v', ctrlKey: true })) })

    await waitFor(() => expect(ptyWrite).toHaveBeenCalledWith('t0522-win-image', '\x1bv'))
    expect(xtermPaste).not.toHaveBeenCalled()
    expect(readFilePaths).not.toHaveBeenCalled()
  })

  test('Windows Ctrl+V: text pastes as before; Command (meta)+V is not intercepted', async () => {
    setup('win32')
    clipboardRead.mockResolvedValue([{ types: ['text/plain'] }])
    readText.mockResolvedValue('C:\\work')
    const { handler } = await renderTerminal('t0522-win-text')

    act(() => { handler(keydown({ key: 'v', ctrlKey: true })) })
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('C:\\work'))

    const meta = keydown({ key: 'v', metaKey: true })
    expect(handler(meta)).toBe(true)
    expect(meta.defaultPrevented).toBe(false)
    expect(readFilePaths).not.toHaveBeenCalled()
  })

  test('Linux Ctrl+V reads text directly; file paths never queried', async () => {
    setup('linux')
    readText.mockResolvedValue('ls -la')
    const { handler } = await renderTerminal('t0522-linux')

    act(() => { handler(keydown({ key: 'v', ctrlKey: true })) })

    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('ls -la'))
    expect(readFilePaths).not.toHaveBeenCalled()
    expect(clipboardRead).not.toHaveBeenCalled()
  })

  test('Ctrl+Shift+V still pastes text on every platform', async () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      cleanup()
      keyHandlers.length = 0
      xtermPaste.mockClear()
      readFilePaths.mockClear()
      setup(platform)
      readText.mockResolvedValue(`text-${platform}`)
      const { handler } = await renderTerminal(`t0522-shift-${platform}`)
      act(() => { handler(keydown({ key: 'V', ctrlKey: true, shiftKey: true })) })
      await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith(`text-${platform}`))
      expect(readFilePaths).not.toHaveBeenCalled()
    }
  })
})
