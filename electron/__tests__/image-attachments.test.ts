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
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerFsHandlers } from '../handlers/fs'
import type { SharedHandler } from '../handlers/types'
import { clipboardImageToDataUrl, readSelectedAttachments } from '../image-attachments'
import { MAX_IMAGE_SIZE, createPathAllowlist } from '../path-guard'
import { ALWAYS_LOCAL_CHANNELS } from '../remote/headless-channel-status'
import { PATH_ARG_SCHEMA } from '../remote/path-aware-channels'
import { PROXIED_CHANNELS } from '../remote/protocol'

const NEW_CHANNELS = ['dialog:select-attachments', 'clipboard:read-image-data-url']
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
