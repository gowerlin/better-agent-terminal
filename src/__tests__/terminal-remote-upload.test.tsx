/**
 * PLAN-038 U4 (T0835): terminal tabs of a remote window upload what the host cannot read.
 *   - Drop: a file the host cannot read (SSH, Docker outside the mounts, another WSL distro) is
 *     uploaded (session key = the tab's PTY id) and its host path typed, quoted, no Enter; a
 *     reachable path is typed exactly as before (no upload); a failed upload → the T0437 toast.
 *   - Ctrl+V image: SSH / Docker windows upload the clipboard PNG and type its host path, no CLI
 *     paste key; local, WSL and legacy remote windows keep the key (T0524).
 * The renderer driver is the real `uploadToRemoteHost` (T0833) over a fake `electronAPI.upload`.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import type { ResolvedClientPath } from '../lib/client-paths'
import type { RemoteUploadFinishResult, RemoteUploadSourceDescriptor } from '../lib/remote-upload'
import { rememberTerminalShell } from '../lib/terminal-drop'
import { imagePasteModeFor, resetTerminalImagePasteModeCache, terminalImagePasteMode, uploadClipboardImage } from '../lib/terminal-paste'

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
  return { deepStub, xtermPaste: vi.fn<(text: string) => void>(), keyHandlers: [] as KeyHandler[] }
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
const sshLike = (paths: string[]): ResolvedClientPath[] =>
  paths.map(input => ({ input, serverPath: null, reachable: false, reason: 'ssh-local-file' as const }))
/** WSL-like: drives → /mnt, everything else (UNC) another distro. */
const wslLike = (paths: string[]): ResolvedClientPath[] => paths.map(input => {
  const m = /^([A-Za-z]):\\(.*)$/.exec(input)
  return m
    ? { input, serverPath: `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`, reachable: true }
    : { input, serverPath: null, reachable: false, reason: 'outside-wsl-distro' as const }
})

const HOST_DIR = '/home/u/.local/share/bat-server/uploads'

/** A fake main-side driver (`window.electronAPI.upload`, T0833) that "uploads" instantly. */
function fakeUpload() {
  const names = new Map<string, string>()
  const sizes = new Map<string, number>()
  const pending = new Map<string, (r: RemoteUploadFinishResult) => void>()
  let holdBegin = false
  let failWith: string | null = null
  const finishResult = (transferId: string): RemoteUploadFinishResult => failWith
    ? { ok: false, code: failWith as never, message: 'host said no' }
    : { ok: true, serverPath: `${HOST_DIR}/${sessionKeys[0]}/0123456789abcdef/${names.get(transferId)}`, size: sizes.get(transferId) ?? 0 }
  const sessionKeys: string[] = []
  const api = {
    prepare: vi.fn(async (sessionKey: string, sources: RemoteUploadSourceDescriptor[]) => {
      sessionKeys.unshift(sessionKey)
      return {
        ok: true,
        batchId: 'batch-1',
        items: sources.map((s, i) => {
          const transferId = `tr-${i}`
          const name = s.kind === 'file' ? s.name : s.kind === 'clipboard-image' ? 'clipboard-20261104-120000.png' : 'x'
          const size = s.kind === 'file' ? s.size : 4
          names.set(transferId, name)
          sizes.set(transferId, size)
          return { ok: true, transferId, kind: s.kind, name, size }
        }),
      }
    }),
    begin: vi.fn((transferId: string) => holdBegin
      ? new Promise(resolve => { pending.set(transferId, resolve as (r: RemoteUploadFinishResult) => void) })
      : Promise.resolve({ ok: true, chunkBytes: 262144 })),
    chunk: vi.fn(async (_id: string, offset: number, data: Uint8Array) => ({ ok: true, received: offset + data.byteLength })),
    finish: vi.fn(async (transferId: string) => finishResult(transferId)),
    run: vi.fn((transferId: string) => holdBegin
      ? new Promise(resolve => { pending.set(transferId, resolve as (r: RemoteUploadFinishResult) => void) })
      : Promise.resolve(finishResult(transferId))),
    abort: vi.fn(async (_id: string) => {
      for (const [id, resolve] of pending) {
        pending.delete(id)
        resolve({ ok: false, code: 'CANCELLED', message: 'aborted' })
      }
      return { ok: true, aborted: 1 }
    }),
    onProgress: vi.fn(() => () => {}),
  }
  return {
    api,
    sessionKeys,
    hold: () => { holdBegin = true },
    failWith: (code: string) => { failWith = code },
  }
}

const getPathForFile = vi.fn<(file: File) => string>()
const resolveClientPaths = vi.fn(async (paths: string[], _purpose: string) => identity(paths))
const readFilePaths = vi.fn<() => Promise<string[]>>()
const readImageDataUrl = vi.fn<() => Promise<string | null>>()
const readText = vi.fn<() => Promise<string>>()
const ptyWrite = vi.fn(async (_id: string, _data: string) => true)
const getWindowProfile = vi.fn<() => Promise<string | null>>()
const listLocal = vi.fn<() => Promise<{ profiles: Array<{ id: string; type: string; targetOS?: string }>; activeProfileIds: string[] }>>()
let upload = fakeUpload()

type Window = 'local' | 'ssh' | 'docker' | 'wsl' | 'legacy'
function bindWindow(kind: Window) {
  getWindowProfile.mockResolvedValue(kind === 'local' ? null : 'p1')
  const targetOS = kind === 'ssh' ? 'ssh-linux' : kind === 'docker' ? 'docker-linux' : kind === 'wsl' ? 'wsl-linux' : undefined
  listLocal.mockResolvedValue({ profiles: [{ id: 'p1', type: 'remote', ...(targetOS ? { targetOS } : {}) }], activeProfileIds: ['p1'] })
}

function setup(platform: 'win32' | 'linux' = 'win32') {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi(platform, {
    shell: { getPathForFile },
    clipboard: { readFilePaths, readImageDataUrl },
    remote: { resolveClientPaths },
    settings: { getShellPath: vi.fn(async () => '/bin/bash') },
    app: { getWindowProfile },
    profile: { listLocal },
    upload: upload.api,
    pty: { write: ptyWrite, create: vi.fn(async () => ({ ok: true, created: true })), getBuffer: vi.fn(async () => null) },
    debug: { log: vi.fn(), isDebugMode: false },
  })
}

async function renderTerminal(id: string) {
  rememberTerminalShell(id, '/bin/bash')
  const { TerminalPanel } = await import('../components/TerminalPanel')
  const view = render(<TerminalPanel terminalId={id} isActive />)
  await waitFor(() => expect(keyHandlers.length).toBeGreaterThan(0))
  const panel = view.container.querySelector('.terminal-panel') as HTMLElement
  return { ...view, panel, handler: keyHandlers[keyHandlers.length - 1] }
}

async function drop(panel: HTMLElement, paths: string[]) {
  const files = paths.map(p => new File(['hello'], p.split(/[\\/]/).pop()!, { type: 'text/plain' }))
  getPathForFile.mockImplementation((f: File) => paths[files.indexOf(f)] ?? '')
  const dataTransfer = { types: ['Files'], files, dropEffect: 'none' }
  fireEvent.dragOver(panel, { dataTransfer })
  await act(async () => { fireEvent.drop(panel, { dataTransfer }) })
}

function ctrlV(handler: KeyHandler) {
  act(() => { handler(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true })) })
}

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return [] } })
  Object.defineProperty(navigator, 'clipboard', { value: { readText, read: vi.fn(async () => []), writeText: vi.fn() }, configurable: true })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  keyHandlers.length = 0
  xtermPaste.mockClear()
  ptyWrite.mockClear()
  getPathForFile.mockReset()
  resolveClientPaths.mockReset()
  resolveClientPaths.mockImplementation(async (paths: string[]) => identity(paths))
  readFilePaths.mockReset()
  readFilePaths.mockResolvedValue([])
  readImageDataUrl.mockReset()
  readImageDataUrl.mockResolvedValue(null)
  readText.mockReset()
  readText.mockResolvedValue('')
  getWindowProfile.mockReset()
  listLocal.mockReset()
  resetTerminalImagePasteModeCache()
  upload = fakeUpload()
  bindWindow('local')
  setup()
})

afterEach(() => {
  cleanup()
})

describe('imagePasteModeFor / terminalImagePasteMode', () => {
  test('SSH and Docker remote profiles upload; local, WSL, legacy remote keep the key', () => {
    expect(imagePasteModeFor({ type: 'remote', targetOS: 'ssh-linux' })).toBe('upload')
    expect(imagePasteModeFor({ type: 'remote', targetOS: 'ssh-darwin' })).toBe('upload')
    expect(imagePasteModeFor({ type: 'remote', targetOS: 'docker-linux' })).toBe('upload')
    expect(imagePasteModeFor({ type: 'remote', targetOS: 'wsl-linux' })).toBe('key')
    expect(imagePasteModeFor({ type: 'remote' })).toBe('key')
    expect(imagePasteModeFor({ type: 'local', targetOS: 'local' })).toBe('key')
    expect(imagePasteModeFor(undefined)).toBe('key')
  })

  test('uploadClipboardImage: an ok result without a host path, or a throwing seam, is a TRANSPORT failure', async () => {
    const noPath = await uploadClipboardImage('pty-x', {
      upload: async () => ({ ok: true, cancelled: false, items: [{ ok: true, name: 'c.png', serverPath: '', size: 1 }] }),
    })
    expect(noPath.item).toMatchObject({ ok: false, code: 'TRANSPORT' })
    const throwing = await uploadClipboardImage('pty-x', { upload: async () => { throw new Error('boom') } })
    expect(throwing).toMatchObject({ cancelled: false, item: { ok: false, code: 'TRANSPORT', message: 'boom' } })
  })

  test('lookup failure → key and not cached; success is cached', async () => {
    getWindowProfile.mockRejectedValueOnce(new Error('ipc down'))
    expect(await terminalImagePasteMode()).toBe('key')
    bindWindow('ssh')
    expect(await terminalImagePasteMode()).toBe('upload')
    bindWindow('wsl')
    expect(await terminalImagePasteMode()).toBe('upload') // cached for this window
    expect(listLocal).toHaveBeenCalledTimes(1)
  })
})

describe('TerminalPanel drop in a remote window', () => {
  test('SSH: the file is uploaded (session key = PTY id) and its host path typed, quoted, no Enter', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => sshLike(paths))
    const { panel } = await renderTerminal('pty-ssh-1')
    await drop(panel, ['C:\\Users\\u\\My Doc.txt'])
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledTimes(1))
    expect(upload.api.prepare).toHaveBeenCalledWith('pty-ssh-1', [{ kind: 'file', name: 'My Doc.txt', size: 5 }])
    expect(xtermPaste).toHaveBeenCalledWith(`'${HOST_DIR}/pty-ssh-1/0123456789abcdef/My Doc.txt'`)
    expect(xtermPaste.mock.calls[0][0]).not.toMatch(/[\r\n]/)
    expect(ptyWrite).not.toHaveBeenCalled()
    expect(panel.querySelector('.terminal-upload-status')).toBeNull() // overlay gone afterwards
  })

  test('WSL: reachable paths typed as before without upload; another distro uploaded, drop order kept', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => wslLike(paths))
    const { panel } = await renderTerminal('pty-wsl-1')
    await drop(panel, ['C:\\x y\\a.txt', '\\\\wsl.localhost\\Other\\b.txt'])
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledTimes(1))
    expect(upload.api.prepare).toHaveBeenCalledWith('pty-wsl-1', [{ kind: 'file', name: 'b.txt', size: 5 }])
    expect(xtermPaste).toHaveBeenCalledWith(`'/mnt/c/x y/a.txt' ${HOST_DIR}/pty-wsl-1/0123456789abcdef/b.txt`)
  })

  test('WSL all reachable: no upload at all, same text as T0439', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => wslLike(paths))
    const { panel } = await renderTerminal('pty-wsl-2')
    await drop(panel, ['C:\\x y\\a.txt'])
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith("'/mnt/c/x y/a.txt'"))
    expect(upload.api.prepare).not.toHaveBeenCalled()
  })

  test('local window: no upload, local path typed as before', async () => {
    const { panel } = await renderTerminal('pty-local-1')
    await drop(panel, ['/home/me/a b.txt'])
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith("'/home/me/a b.txt'"))
    expect(upload.api.prepare).not.toHaveBeenCalled()
  })

  test('upload fails: T0437 toast with the reason, nothing typed', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => sshLike(paths))
    upload.failWith('QUOTA')
    const { panel } = await renderTerminal('pty-ssh-2')
    await drop(panel, ['C:\\Users\\u\\a.txt'])
    // T0843: the reason first, the file named once, no T0437 sentence (an upload was tried).
    await waitFor(() => expect(panel.textContent).toContain('Not attached (the upload space for this session on the remote host is full): a.txt'))
    expect(panel.textContent).not.toContain('Not on the remote host')
    expect(xtermPaste).not.toHaveBeenCalled()
  })

  test('main answers undefined (old preload / stub): refused with a toast, no exception', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => sshLike(paths))
    upload.api.prepare.mockResolvedValue(undefined as never)
    const { panel } = await renderTerminal('pty-ssh-3')
    await drop(panel, ['C:\\Users\\u\\a.txt'])
    // T0843: uploadable reason + TRANSPORT → the reason first, the file once, verbatim.
    await waitFor(() => expect(panel.textContent).toContain('Not attached (the connection to the remote host failed): a.txt'))
    expect(panel.textContent).not.toContain('Not on the remote host')
    expect(xtermPaste).not.toHaveBeenCalled()
  })

  test('progress overlay + Cancel: upload aborted, nothing typed, cancel notice', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => sshLike(paths))
    upload.hold()
    const { panel, getByRole } = await renderTerminal('pty-ssh-4')
    await drop(panel, ['C:\\Users\\u\\a.txt'])
    await waitFor(() => expect(panel.querySelector('.terminal-upload-status')?.textContent).toContain('Uploading to the remote host… 0%'))
    await act(async () => { fireEvent.click(getByRole('button', { name: 'Cancel the upload (nothing is typed)' })) })
    await waitFor(() => expect(panel.textContent).toContain('Upload cancelled. Nothing was typed.'))
    expect(upload.api.abort).toHaveBeenCalled()
    expect(xtermPaste).not.toHaveBeenCalled()
    expect(panel.querySelector('.terminal-upload-status')).toBeNull()
  })

  test('a second drop while uploading is refused with a notice (the first one goes on)', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => sshLike(paths))
    upload.hold()
    const { panel } = await renderTerminal('pty-ssh-5')
    await drop(panel, ['C:\\Users\\u\\a.txt'])
    await waitFor(() => expect(panel.querySelector('.terminal-upload-status')).not.toBeNull())
    await drop(panel, ['C:\\Users\\u\\b.txt'])
    await waitFor(() => expect(panel.textContent).toContain('still running in this terminal'))
    expect(upload.api.prepare).toHaveBeenCalledTimes(1)
  })
})

describe('TerminalPanel Ctrl+V image', () => {
  beforeEach(() => {
    readImageDataUrl.mockResolvedValue('data:image/png;base64,AAAA')
  })

  test.each(['ssh', 'docker'] as const)('%s window: clipboard image uploaded, host path typed, no paste key', async kind => {
    bindWindow(kind)
    const { handler } = await renderTerminal(`pty-img-${kind}`)
    ctrlV(handler)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledTimes(1))
    expect(upload.api.prepare).toHaveBeenCalledWith(`pty-img-${kind}`, [{ kind: 'clipboard-image' }])
    expect(upload.api.run).toHaveBeenCalledWith('tr-0')
    expect(xtermPaste).toHaveBeenCalledWith(`${HOST_DIR}/pty-img-${kind}/0123456789abcdef/clipboard-20261104-120000.png`)
    expect(ptyWrite).not.toHaveBeenCalledWith(expect.any(String), '\x1bv')
    expect(ptyWrite).not.toHaveBeenCalledWith(expect.any(String), '\x16')
  })

  test.each([
    ['local', 'win32', '\x1bv'],
    ['wsl', 'win32', '\x1bv'],
    ['legacy', 'win32', '\x1bv'],
    ['wsl', 'linux', '\x16'],
  ] as const)('%s window (%s client): the CLI paste key as before, no upload', async (kind, platform, key) => {
    bindWindow(kind)
    setup(platform)
    const { handler } = await renderTerminal(`pty-key-${kind}-${platform}`)
    ctrlV(handler)
    await waitFor(() => expect(ptyWrite).toHaveBeenCalledWith(`pty-key-${kind}-${platform}`, key))
    expect(upload.api.prepare).not.toHaveBeenCalled()
    expect(xtermPaste).not.toHaveBeenCalled()
  })

  test('SSH window, upload fails: toast with the reason; no key, nothing typed', async () => {
    bindWindow('ssh')
    upload.failWith('SERVER_TOO_OLD')
    const { handler, panel } = await renderTerminal('pty-img-fail')
    ctrlV(handler)
    await waitFor(() => expect(panel.textContent).toContain('The clipboard image was not pasted'))
    expect(panel.textContent).toContain('too old to accept uploads')
    expect(xtermPaste).not.toHaveBeenCalled()
    expect(ptyWrite).not.toHaveBeenCalled()
  })

  test('SSH window: text paste unchanged (no upload)', async () => {
    bindWindow('ssh')
    readImageDataUrl.mockResolvedValue(null)
    readText.mockResolvedValue('echo hi')
    const { handler } = await renderTerminal('pty-ssh-text')
    ctrlV(handler)
    await waitFor(() => expect(xtermPaste).toHaveBeenCalledWith('echo hi'))
    expect(upload.api.prepare).not.toHaveBeenCalled()
  })
})
