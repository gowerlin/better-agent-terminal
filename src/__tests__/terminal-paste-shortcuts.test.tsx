/**
 * T0522 / BUG-128: macOS Command+V in a terminal. A Finder copy is typed as shell-quoted
 * paths (same as a file drop, T0439); a text clipboard pastes once; Ctrl+V on macOS does the
 * same. Main-side reader: electron/__tests__/clipboard-file-paths.test.ts.
 *
 * T0524 / BUG-130: an image on the clipboard sends the claude CLI's image-paste key (Windows
 * Alt+V `\x1bv`, macOS / Linux Ctrl+V `\x16`) for Ctrl+V on every platform and for macOS
 * Command+V; copied files still win over the image; failures are logged and degrade.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import type { ResolvedClientPath } from '../lib/client-paths'
import { buildTerminalDropText } from '../lib/terminal-drop'
import { imagePasteKey, isMacCommandPaste, readTerminalClipboard } from '../lib/terminal-paste'

type KeyHandler = (event: KeyboardEvent) => boolean

const { deepStub, xtermPaste, keyHandlers, selection } = vi.hoisted(() => {
  const deepStub = (): unknown => new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === Symbol.toPrimitive) return () => 0
      return deepStub()
    },
    apply: () => deepStub(),
    construct: () => deepStub() as object,
  })
  return {
    deepStub,
    xtermPaste: vi.fn<(text: string) => void>(),
    keyHandlers: [] as Array<(event: KeyboardEvent) => boolean>,
    selection: { text: '' },
  }
})

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    constructor() {
      const stub = deepStub() as Record<string | symbol, unknown>
      return new Proxy({}, {
        get(_target, prop) {
          if (prop === 'paste') return xtermPaste
          if (prop === 'getSelection') return () => selection.text
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
const readImageDataUrl = vi.fn<() => Promise<string | null>>()
const clipboardRead = vi.fn<() => Promise<Array<{ types: string[] }>>>()
const debugLog = vi.fn()
const writeText = vi.fn(async (_text: string) => {})
const resolveClientPaths = vi.fn(async (paths: string[], _purpose: string) => identity(paths))
const getShellPath = vi.fn(async (_type: string) => '/bin/zsh')
const ptyWrite = vi.fn(async (_id: string, _data: string) => true)

function setNavigatorPlatform(value: string) {
  Object.defineProperty(navigator, 'platform', { value, configurable: true })
}

function setup(platform: 'darwin' | 'win32' | 'linux') {
  setNavigatorPlatform(platform === 'darwin' ? 'MacIntel' : platform === 'win32' ? 'Win32' : 'Linux x86_64')
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi(platform, {
    clipboard: { readFilePaths, readImageDataUrl },
    remote: { resolveClientPaths },
    settings: { getShellPath },
    pty: { write: ptyWrite, create: vi.fn(async () => ({ ok: true, created: true })), getBuffer: vi.fn(async () => null) },
    debug: { log: debugLog, isDebugMode: false },
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
    value: { readText, read: clipboardRead, writeText },
    configurable: true,
  })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  keyHandlers.length = 0
  selection.text = ''
  for (const fn of [xtermPaste, ptyWrite, getShellPath, debugLog, writeText]) fn.mockClear()
  readFilePaths.mockReset()
  readFilePaths.mockResolvedValue([])
  readText.mockReset()
  readImageDataUrl.mockReset()
  readImageDataUrl.mockResolvedValue(null)
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

describe('readTerminalClipboard', () => {
  test('file items → paths; image / text not read (a Finder copy of an image file carries its icon too)', async () => {
    const readers = { readFilePaths: vi.fn(async () => ['/a b']), hasImage: vi.fn(async () => true), readText: vi.fn(async () => 'a b') }
    await expect(readTerminalClipboard(readers)).resolves.toEqual({ kind: 'paths', paths: ['/a b'] })
    expect(readers.hasImage).not.toHaveBeenCalled()
    expect(readers.readText).not.toHaveBeenCalled()
  })
  test('no file items, image → image; text not read', async () => {
    const readers = { readFilePaths: vi.fn(async () => []), hasImage: vi.fn(async () => true), readText: vi.fn(async () => '') }
    await expect(readTerminalClipboard(readers)).resolves.toEqual({ kind: 'image' })
    expect(readers.readText).not.toHaveBeenCalled()
  })
  test('no file items, no image → text', async () => {
    const readers = { readFilePaths: vi.fn(async () => []), hasImage: vi.fn(async () => false), readText: vi.fn(async () => 'hello') }
    await expect(readTerminalClipboard(readers)).resolves.toEqual({ kind: 'text', text: 'hello' })
  })
  test('path read failure is logged and still checks for an image', async () => {
    const log = vi.fn()
    const readers = { readFilePaths: vi.fn(async () => { throw new Error('ipc down') }), hasImage: vi.fn(async () => true), readText: vi.fn(async () => 'hello') }
    await expect(readTerminalClipboard(readers, log)).resolves.toEqual({ kind: 'image' })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('read-file-paths failed'), expect.any(Error))
  })
  test('image check failure is logged and degrades to text', async () => {
    const log = vi.fn()
    const readers = { readFilePaths: vi.fn(async () => []), hasImage: vi.fn(async () => { throw new Error('denied') }), readText: vi.fn(async () => 'hello') }
    await expect(readTerminalClipboard(readers, log)).resolves.toEqual({ kind: 'text', text: 'hello' })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('image check failed'), expect.any(Error))
  })
})

describe('imagePasteKey', () => {
  test('claude CLI chat:imagePaste — Alt+V on Windows, Ctrl+V elsewhere', () => {
    expect(imagePasteKey('win32')).toBe('\x1bv')
    expect(imagePasteKey('darwin')).toBe('\x16')
    expect(imagePasteKey('linux')).toBe('\x16')
  })
})

describe('Finder paths → shell-quoted text (posix shells on macOS)', () => {
  test('spaces, single quotes, CJK, multiple files', () => {
    expect(buildTerminalDropText([
      '/Users/tester/Desktop/My Report.pdf',
      "/Users/tester/it's here",
      '/Users/tester/文件/截圖 1.png',
      '/Users/tester/plain.txt',
    ], 'posix')).toBe(
      "'/Users/tester/Desktop/My Report.pdf' '/Users/tester/it'\\''s here' '/Users/tester/文件/截圖 1.png' /Users/tester/plain.txt",
    )
  })
})

describe('TerminalPanel paste shortcuts', () => {
  test('macOS Command+V with Finder items types quoted paths (bracketed paste), no Enter', async () => {
    setup('darwin')
    readFilePaths.mockResolvedValue(['/Users/tester/My Report.pdf', '/Users/tester/b.txt'])
    const { handler } = await renderTerminal('t0522-mac-files')

    const ev = keydown({ key: 'v', metaKey: true })
    let handled: boolean | undefined
    act(() => { handled = handler(ev) })

    expect(handled).toBe(false)
    expect(ev.defaultPrevented).toBe(true)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith("'/Users/tester/My Report.pdf' /Users/tester/b.txt"))
    expect(resolveClientPaths).toHaveBeenCalledWith(['/Users/tester/My Report.pdf', '/Users/tester/b.txt'], 'local-file')
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
    readFilePaths.mockResolvedValue(['/Users/tester/文件/a b.txt'])
    const { handler } = await renderTerminal('t0522-mac-ctrl')

    const ev = keydown({ key: 'v', ctrlKey: true })
    act(() => { handler(ev) })

    expect(ev.defaultPrevented).toBe(true)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith("'/Users/tester/文件/a b.txt'"))
    expect(readText).not.toHaveBeenCalled()
  })

  test('Windows Ctrl+V: image → Alt+V (\\x1bv), decided by main (Async Clipboard not used)', async () => {
    setup('win32')
    readImageDataUrl.mockResolvedValue('data:image/png;base64,AAAA')
    const { handler } = await renderTerminal('t0522-win-image')

    act(() => { handler(keydown({ key: 'v', ctrlKey: true })) })

    await waitFor(() => expect(ptyWrite).toHaveBeenCalledWith('t0522-win-image', '\x1bv'))
    expect(xtermPaste).not.toHaveBeenCalled()
    expect(clipboardRead).not.toHaveBeenCalled()
    expect(readText).not.toHaveBeenCalled()
  })

  test('Windows Ctrl+V: text pastes as before; Command (meta)+V is not intercepted', async () => {
    setup('win32')
    readText.mockResolvedValue('C:\\work')
    const { handler } = await renderTerminal('t0522-win-text')

    act(() => { handler(keydown({ key: 'v', ctrlKey: true })) })
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('C:\\work'))
    expect(ptyWrite).not.toHaveBeenCalled()

    readFilePaths.mockClear()
    const meta = keydown({ key: 'v', metaKey: true })
    expect(handler(meta)).toBe(true)
    expect(meta.defaultPrevented).toBe(false)
    expect(readFilePaths).not.toHaveBeenCalled()
  })

  test('Linux Ctrl+V: no image → text', async () => {
    setup('linux')
    readText.mockResolvedValue('ls -la')
    const { handler } = await renderTerminal('t0522-linux')

    act(() => { handler(keydown({ key: 'v', ctrlKey: true })) })

    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('ls -la'))
    expect(ptyWrite).not.toHaveBeenCalled()
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

// T0524: platform × clipboard content × shortcut. Windows / Linux main returns [] for file
// paths (macOS-only reader), but the renderer decision is the same everywhere.
describe('T0524 paste matrix', () => {
  const PLATFORMS = ['win32', 'darwin', 'linux'] as const
  type Platform = (typeof PLATFORMS)[number]
  const KEY: Record<Platform, string> = { win32: '\x1bv', darwin: '\x16', linux: '\x16' }
  const shortcutsFor = (platform: Platform) => [
    { name: 'Ctrl+V', init: { key: 'v', ctrlKey: true } },
    ...(platform === 'darwin' ? [{ name: 'Command+V', init: { key: 'v', metaKey: true } }] : []),
  ]
  const cases = PLATFORMS.flatMap(platform => shortcutsFor(platform).map(shortcut => ({ platform, shortcut })))
  let seq = 0

  async function press(platform: Platform, init: Partial<KeyboardEventInit> & { key: string }) {
    setup(platform)
    const { handler } = await renderTerminal(`t0524-${platform}-${seq++}`)
    const ev = keydown(init)
    let handled: boolean | undefined
    act(() => { handled = handler(ev) })
    expect(handled).toBe(false)
    expect(ev.defaultPrevented).toBe(true)
  }

  test.each(cases)('$platform $shortcut.name: image → CLI image-paste key, nothing pasted', async ({ platform, shortcut }) => {
    readImageDataUrl.mockResolvedValue('data:image/png;base64,AAAA')
    await press(platform, shortcut.init)
    await waitFor(() => expect(ptyWrite).toHaveBeenCalledWith(expect.any(String), KEY[platform]))
    expect(ptyWrite).toHaveBeenCalledTimes(1)
    expect(xtermPaste).not.toHaveBeenCalled()
    expect(readText).not.toHaveBeenCalled()
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining(`[terminal-paste] ${shortcut.name} → image`))
  })

  test.each(cases)('$platform $shortcut.name: copied files → quoted paths, no key, no Enter', async ({ platform, shortcut }) => {
    readFilePaths.mockResolvedValue(['/tmp/a b.txt'])
    await press(platform, shortcut.init)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith("'/tmp/a b.txt'"))
    expect(ptyWrite).not.toHaveBeenCalled()
    expect(readImageDataUrl).not.toHaveBeenCalled()
  })

  test.each(cases)('$platform $shortcut.name: copied image file (+ its icon as an image) → path, not the key', async ({ platform, shortcut }) => {
    readFilePaths.mockResolvedValue(['/tmp/pic.png'])
    readImageDataUrl.mockResolvedValue('data:image/png;base64,ICON')
    await press(platform, shortcut.init)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('/tmp/pic.png'))
    expect(ptyWrite).not.toHaveBeenCalled()
    expect(readImageDataUrl).not.toHaveBeenCalled()
  })

  test.each(cases)('$platform $shortcut.name: text → pasted once, no key', async ({ platform, shortcut }) => {
    readText.mockResolvedValue('echo hi')
    await press(platform, shortcut.init)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('echo hi'))
    expect(xtermPaste).toHaveBeenCalledTimes(1)
    expect(ptyWrite).not.toHaveBeenCalled()
  })

  test.each(cases)('$platform $shortcut.name: main image read fails → Async Clipboard fallback still finds the image (logged)', async ({ platform, shortcut }) => {
    readImageDataUrl.mockRejectedValue(new Error('Image too large'))
    clipboardRead.mockResolvedValue([{ types: ['image/png'] }])
    await press(platform, shortcut.init)
    await waitFor(() => expect(ptyWrite).toHaveBeenCalledWith(expect.any(String), KEY[platform]))
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('read-image-data-url failed'), expect.any(Error))
    expect(xtermPaste).not.toHaveBeenCalled()
  })

  test.each(cases)('$platform $shortcut.name: every image check fails → text paste, failure logged', async ({ platform, shortcut }) => {
    readImageDataUrl.mockRejectedValue(new Error('ipc down'))
    clipboardRead.mockRejectedValue(new Error('NotAllowedError'))
    readText.mockResolvedValue('fallback text')
    await press(platform, shortcut.init)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('fallback text'))
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('image check failed'), expect.any(Error))
    expect(ptyWrite).not.toHaveBeenCalled()
  })

  test.each(cases)('$platform $shortcut.name: text read fails → nothing typed, failure logged', async ({ platform, shortcut }) => {
    readText.mockRejectedValue(new Error('Document is not focused'))
    await press(platform, shortcut.init)
    await waitFor(() => expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('paste failed'), expect.any(Error)))
    expect(xtermPaste).not.toHaveBeenCalled()
    expect(ptyWrite).not.toHaveBeenCalled()
  })
})

describe('T0524: copy and the other paste entry points', () => {
  test.each(['win32', 'darwin', 'linux'] as const)('%s Ctrl+C: selection → copied; none → passes through (SIGINT); Ctrl+Shift+C copies', async (platform) => {
    setup(platform)
    const { handler } = await renderTerminal(`t0524-ctrl-c-${platform}`)
    expect(handler(keydown({ key: 'c', ctrlKey: true }))).toBe(true)
    expect(writeText).not.toHaveBeenCalled()

    selection.text = 'picked'
    expect(handler(keydown({ key: 'c', ctrlKey: true }))).toBe(false)
    expect(writeText).toHaveBeenCalledWith('picked')
    expect(handler(keydown({ key: 'C', ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(writeText).toHaveBeenCalledTimes(2)
  })

  test.each(['win32', 'darwin', 'linux'] as const)('%s Ctrl+Shift+V pastes text even with an image on the clipboard', async (platform) => {
    setup(platform)
    readImageDataUrl.mockResolvedValue('data:image/png;base64,AAAA')
    readText.mockResolvedValue('plain')
    const { handler } = await renderTerminal(`t0524-shift-v-${platform}`)
    act(() => { handler(keydown({ key: 'V', ctrlKey: true, shiftKey: true })) })
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('plain'))
    expect(ptyWrite).not.toHaveBeenCalled()
    expect(readImageDataUrl).not.toHaveBeenCalled()
  })

  test.each([['win32', '\x1bv'], ['darwin', '\x16'], ['linux', '\x16']] as const)('%s context-menu Paste follows the same decision (image → key, text → text)', async (platform, key) => {
    setup(platform)
    readImageDataUrl.mockResolvedValue('data:image/png;base64,AAAA')
    const { container } = await renderTerminal(`t0524-menu-${platform}`)
    const panel = container.querySelector('.terminal-panel')!
    const openMenu = () => act(() => { panel.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 })) })
    const clickPaste = async () => {
      const item = await waitFor(() => {
        const found = Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu .context-menu-item')).find(b => b.textContent?.includes('貼上'))
        expect(found).toBeTruthy()
        return found!
      })
      await act(async () => { item.click() })
    }

    openMenu()
    await clickPaste()
    await waitFor(() => expect(ptyWrite).toHaveBeenCalledWith(expect.any(String), key))

    readImageDataUrl.mockResolvedValue(null)
    readText.mockResolvedValue('menu text')
    openMenu()
    await clickPaste()
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('menu text'))
    expect(ptyWrite).toHaveBeenCalledTimes(1)
  })
})
