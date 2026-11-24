// @vitest-environment node
/**
 * T0436 / BUG-108: Claude / Codex panel image attachments are read on the client.
 *
 * - repro: the old route (`clipboard:saveImage` → os.tmpdir() → `image:read-as-data-url`) is
 *   denied by Electron's workspace allowlist even on a local window, as is any picture
 *   outside the workspace
 * - `electron/image-attachments.ts`: clipboard → data URL, dialog picks → files + image data URLs
 * - the two new channels are local-only and take no path from the renderer: plain
 *   ipcMain.handle inside registerLocalHandlers, not proxied, not in the handler registry
 *   (so neither a remote-profile window nor a RemoteServer client reaches them)
 * - the panels no longer read attachments through `image:read-as-data-url`
 * Renderer side: src/__tests__/image-attachment-client-read.test.tsx.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { registerFsHandlers } from '../handlers/fs'
import type { SharedHandler } from '../handlers/types'
import { CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES, CLIPBOARD_IMAGE_TYPE, clipboardImageToDataUrl, hasClipboardImage, readClipboardPng, readSelectedAttachments } from '../image-attachments'
import { HELPER_CHANNEL_ROLES } from '../remote/helper-capability'
import { MAX_IMAGE_SIZE, createPathAllowlist } from '../path-guard'
import { ALWAYS_LOCAL_CHANNELS } from '../remote/headless-channel-status'
import { PATH_ARG_SCHEMA } from '../remote/path-aware-channels'
import { PROXIED_CHANNELS } from '../remote/protocol'

const NEW_CHANNELS = ['dialog:select-attachments', 'clipboard:read-image-data-url', 'clipboard:has-image']
const ELECTRON_DIR = path.resolve(__dirname, '..')
const SRC_DIR = path.resolve(ELECTRON_DIR, '..', 'src')
const read = (...p: string[]) => fs.readFileSync(path.join(...p), 'utf8')

let tmp: string
let workspace: string
let clipboardTemp: string

beforeAll(() => {
  tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0436-')))
  workspace = path.join(tmp, 'workspace')
  fs.mkdirSync(workspace)
  fs.writeFileSync(path.join(tmp, 'pic.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  fs.writeFileSync(path.join(tmp, 'pic.JPG'), Buffer.from('jpeg'))
  fs.writeFileSync(path.join(tmp, 'notes.md'), '# notes\n')
  // Same location and name pattern clipboard:saveImage writes (os.tmpdir()/bat-clipboard-*.png).
  clipboardTemp = path.join(os.tmpdir(), `bat-clipboard-t0436-${process.pid}.png`)
  fs.writeFileSync(clipboardTemp, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
})

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.rmSync(clipboardTemp, { force: true })
})

describe('repro (BUG-108): attachments through image:read-as-data-url are denied on a local window', () => {
  function electronImageRead() {
    const allowlist = createPathAllowlist()
    allowlist.rebuild([workspace]) // the window registry's workspace roots
    const handlers = new Map<string, SharedHandler>()
    registerFsHandlers((channel, handler) => { handlers.set(channel, handler) }, { emit: () => {}, pathGuard: allowlist })
    return (p: string) => Promise.resolve(handlers.get('image:read-as-data-url')!({ windowId: 'w1' }, p))
  }

  it('a pasted image saved to os.tmpdir() → Path access denied', async () => {
    await expect(electronImageRead()(clipboardTemp)).rejects.toThrow('Path access denied')
  })

  it('a dropped / picked image outside the workspace → Path access denied', async () => {
    await expect(electronImageRead()(path.join(tmp, 'pic.png'))).rejects.toThrow('Path access denied')
  })
})

describe('electron/image-attachments', () => {
  it('clipboardImageToDataUrl: PNG data URL; null for an empty clipboard', () => {
    const png = Buffer.from([1, 2, 3])
    expect(clipboardImageToDataUrl({ isEmpty: () => false, toPNG: () => png })).toBe(`data:image/png;base64,${png.toString('base64')}`)
    expect(clipboardImageToDataUrl({ isEmpty: () => true, toPNG: () => png })).toBeNull()
  })

  it('clipboardImageToDataUrl: refuses images over MAX_IMAGE_SIZE', () => {
    const big = { length: MAX_IMAGE_SIZE + 1, toString: () => '' } as unknown as Buffer
    expect(() => clipboardImageToDataUrl({ isEmpty: () => false, toPNG: () => big })).toThrow(/Image too large/)
  })

  // T0784 (Electron 44+): the clipboard image comes from clipboard.read() → ClipboardItem → Blob.
  const clipboardWith = (items: Array<Record<string, Blob>>) => {
    const fakeItems = items.map(payloads => ({
      types: Object.keys(payloads),
      getType: vi.fn(async (type: string) => {
        if (!(type in payloads)) throw new DOMException(`type ${type} not found`, 'NotFoundError')
        return payloads[type]
      }),
    }))
    return { read: vi.fn(async () => fakeItems), items: fakeItems }
  }

  it('readClipboardPng: PNG bytes of the first item carrying image/png', async () => {
    expect(CLIPBOARD_IMAGE_TYPE).toBe('image/png')
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const clipboard = clipboardWith([
      { 'text/plain': new Blob(['caption']) },
      { 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }), 'text/plain': new Blob(['x']) },
    ])
    const got = await readClipboardPng(clipboard)
    expect(got).toEqual(png)
    expect(Buffer.isBuffer(got)).toBe(true)
    expect(clipboard.items[1].getType).toHaveBeenCalledWith('image/png')
  })

  it('readClipboardPng: null for text-only, empty, zero-byte and vanished images', async () => {
    await expect(readClipboardPng(clipboardWith([{ 'text/plain': new Blob(['hi']) }]))).resolves.toBeNull()
    await expect(readClipboardPng(clipboardWith([]))).resolves.toBeNull()
    await expect(readClipboardPng(clipboardWith([{}]))).resolves.toBeNull()
    await expect(readClipboardPng(clipboardWith([{ 'image/png': new Blob([]) }]))).resolves.toBeNull()
    const vanished = { types: ['image/png'], getType: vi.fn(async () => { throw new Error('gone') }) }
    await expect(readClipboardPng({ read: async () => [vanished] })).resolves.toBeNull()
  })

  it('readClipboardPng: other image types are not read (same as readImage before T0784)', async () => {
    const clipboard = clipboardWith([{ 'image/jpeg': new Blob(['jpeg']) }])
    await expect(readClipboardPng(clipboard)).resolves.toBeNull()
    expect(clipboard.items[0].getType).not.toHaveBeenCalled()
  })

  // T0893 / BUG-216: a fake Blob whose bytes are never materialised — arrayBuffer() is a spy.
  const sizedItem = (size: number) => {
    const arrayBuffer = vi.fn(async () => new Uint8Array(Math.min(size, 16)).buffer)
    const blob = { size, type: CLIPBOARD_IMAGE_TYPE, arrayBuffer } as unknown as Blob
    const item = { types: [CLIPBOARD_IMAGE_TYPE], getType: vi.fn(async () => blob) }
    return { clipboard: { read: vi.fn(async () => [item]) }, item, arrayBuffer }
  }

  it('T0893: early-refusal threshold is 2 × MAX_IMAGE_SIZE (10–20 MiB still re-encoded and compared as before)', () => {
    expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024)
    expect(CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES).toBe(2 * MAX_IMAGE_SIZE)
  })

  it('T0893: readClipboardPng refuses a PNG over refuseAboveBytes without reading its bytes (same error text)', async () => {
    const big = 48_563_050
    const { clipboard, arrayBuffer } = sizedItem(big)
    await expect(readClipboardPng(clipboard, { refuseAboveBytes: CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES }))
      .rejects.toThrow(`Image too large (${big} > ${MAX_IMAGE_SIZE} bytes)`)
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('T0893: at / under the threshold, and without the option, the bytes are read as before', async () => {
    for (const size of [CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES, MAX_IMAGE_SIZE + 1, 10]) {
      const { clipboard, arrayBuffer } = sizedItem(size)
      await expect(readClipboardPng(clipboard, { refuseAboveBytes: CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES })).resolves.toBeInstanceOf(Buffer)
      expect(arrayBuffer).toHaveBeenCalledTimes(1)
    }
    // upload-client / clipboard:saveImage pass no option: no early refusal, whatever the size.
    const { clipboard, arrayBuffer } = sizedItem(60 * 1024 * 1024)
    await expect(readClipboardPng(clipboard)).resolves.toBeInstanceOf(Buffer)
    expect(arrayBuffer).toHaveBeenCalledTimes(1)
  })

  it('T0893: an early refusal still rejects only for a real image (text-only / vanished → null)', async () => {
    const opts = { refuseAboveBytes: CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES }
    await expect(readClipboardPng(clipboardWith([{ 'text/plain': new Blob(['hi']) }]), opts)).resolves.toBeNull()
    const vanished = { types: ['image/png'], getType: vi.fn(async () => { throw new Error('gone') }) }
    await expect(readClipboardPng({ read: async () => [vanished] }, opts)).resolves.toBeNull()
  })

  it('T0893: hasClipboardImage answers from MIME types only — getType (the image bytes) is never called', async () => {
    const withImage = clipboardWith([{ 'text/plain': new Blob(['x']) }, { 'image/png': new Blob(['png']) }])
    await expect(hasClipboardImage(withImage)).resolves.toBe(true)
    for (const item of withImage.items) expect(item.getType).not.toHaveBeenCalled()
    const { clipboard, item, arrayBuffer } = sizedItem(50_913_361)
    await expect(hasClipboardImage(clipboard)).resolves.toBe(true)
    expect(item.getType).not.toHaveBeenCalled()
    expect(arrayBuffer).not.toHaveBeenCalled()
    await expect(hasClipboardImage(clipboardWith([{ 'text/plain': new Blob(['hi']) }]))).resolves.toBe(false)
    await expect(hasClipboardImage(clipboardWith([]))).resolves.toBe(false)
    // Same type readClipboardPng reads: other image types do not count.
    await expect(hasClipboardImage(clipboardWith([{ 'image/jpeg': new Blob(['j']) }]))).resolves.toBe(false)
  })

  it('T0893: a read() failure propagates (the renderer falls back to navigator.clipboard.read())', async () => {
    await expect(hasClipboardImage({ read: async () => { throw new Error('clipboard busy') } })).rejects.toThrow('clipboard busy')
  })

  it('readSelectedAttachments: images read locally (outside any workspace), files by path, unreadable skipped', async () => {
    const result = await readSelectedAttachments([
      path.join(tmp, 'pic.png'),
      path.join(tmp, 'notes.md'),
      path.join(tmp, 'pic.JPG'),
      path.join(tmp, 'missing.png'),
    ])
    expect(result.files).toEqual([path.join(tmp, 'notes.md')])
    expect(result.images).toEqual([
      { path: path.join(tmp, 'pic.png'), dataUrl: `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')}` },
      { path: path.join(tmp, 'pic.JPG'), dataUrl: `data:image/jpeg;base64,${Buffer.from('jpeg').toString('base64')}` },
    ])
  })
})

describe('local-only channels (no proxy, no handler registry, no renderer path)', () => {
  const mainSource = read(ELECTRON_DIR, 'main.ts')
  const preloadSource = read(ELECTRON_DIR, 'preload.ts')

  function registerLocalHandlersBody(): string {
    const start = mainSource.indexOf('function registerLocalHandlers()')
    expect(start).toBeGreaterThan(-1)
    const end = mainSource.indexOf('\n}\n', start)
    return mainSource.slice(start, end)
  }

  it('not proxied: absent from PROXIED_CHANNELS / ALWAYS_LOCAL_CHANNELS / path tables', () => {
    for (const channel of NEW_CHANNELS) {
      expect(PROXIED_CHANNELS.has(channel), channel).toBe(false)
      expect(ALWAYS_LOCAL_CHANNELS.has(channel), channel).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(PATH_ARG_SCHEMA, channel), channel).toBe(false)
    }
  })

  it('registered with ipcMain.handle inside registerLocalHandlers, taking no renderer arguments', () => {
    const body = registerLocalHandlersBody()
    expect(body).toMatch(/ipcMain\.handle\('dialog:select-attachments', async \(event\) =>/)
    expect(body).toMatch(/ipcMain\.handle\('clipboard:read-image-data-url', \(\) =>/)
    expect(body).toMatch(/ipcMain\.handle\('clipboard:has-image', \(\) => hasClipboardImage\(clipboard\)\)/)
  })

  it('T0893: read-image-data-url refuses early at CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES; saveImage / upload-client keep no option', () => {
    const body = registerLocalHandlersBody()
    expect(body).toContain("ipcMain.handle('clipboard:read-image-data-url', () => readClipboardImage({ refuseAboveBytes: CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES }).then(clipboardImageToDataUrl))")
    expect(body).toMatch(/const image = await readClipboardImage\(\)\r?\n/)
    expect(mainSource).toContain('readClipboardPng: () => readClipboardPng(clipboard),')
  })

  it('T0893: clipboard:has-image is not a helper channel', () => {
    expect(Object.prototype.hasOwnProperty.call(HELPER_CHANNEL_ROLES, 'clipboard:has-image')).toBe(false)
  })

  it('T0784: main uses the Electron 44+ clipboard API (no readImage / writeImage / read(format))', () => {
    const body = registerLocalHandlersBody()
    expect(mainSource).not.toMatch(/clipboard\.(readImage|writeImage|readHTML|readBuffer|availableFormats)\(/)
    expect(mainSource).not.toMatch(/clipboard\.read\(['"`]/)
    expect(body).toContain('const png = await readClipboardPng(clipboard, options)')
    expect(body).toContain("await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' }) })])")
  })

  it('never put in the handler registry (unreachable from a RemoteServer client)', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full) }
        else if (entry.name.endsWith('.ts')) files.push(full)
      }
    }
    walk(ELECTRON_DIR)
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      for (const channel of NEW_CHANNELS) {
        expect(source, `${file}: ${channel}`).not.toMatch(new RegExp(`(?<![\\w.])(registerHandler|register)\\(\\s*['"\`]${channel}['"\`]`))
      }
    }
  })

  it('preload invokes them without arguments', () => {
    expect(preloadSource).toContain("ipcRenderer.invoke('dialog:select-attachments') as")
    expect(preloadSource).toContain("ipcRenderer.invoke('clipboard:read-image-data-url') as")
    expect(preloadSource).toContain("ipcRenderer.invoke('clipboard:has-image') as Promise<boolean>")
  })

  it('Claude / Codex panels no longer read attachments by path', () => {
    for (const panel of ['ClaudeAgentPanel.tsx', 'CodexAgentPanel.tsx']) {
      const source = read(SRC_DIR, 'components', panel)
      expect(source, panel).not.toContain('image.readAsDataUrl')
      expect(source, panel).not.toContain('clipboard.saveImage')
      expect(source, panel).not.toContain('dialog.selectFiles')
    }
  })
})
