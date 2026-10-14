// T0524 / BUG-130: Ctrl+V in a terminal tab with an image on the clipboard sends the claude
// CLI's image-paste key (Windows Alt+V `\x1bv`, macOS / Linux Ctrl+V `\x16`) so the CLI reads
// the clipboard itself; a text clipboard still pastes the text.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The
// terminal runs a node script that puts stdin in raw mode and prints every chunk it receives as
// hex — the same bytes a CLI in that PTY would read. The system clipboard is saved before the
// test and restored afterwards (text / HTML / image).

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, run, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0524')
const WS = 'e2e-t0524-ws'
const TERM = 'e2e-t0524-term'

const ECHO_SCRIPT = `
process.stdin.setRawMode(true)
process.stdin.resume()
console.log('T0524_ECHO_READY')
process.stdin.on('data', (d) => { console.log('T0524_HEX:' + d.toString('hex') + ':END') })
`

interface SavedClipboard { text: string; html: string; image: string }

async function saveClipboard(app: ElectronApplication): Promise<SavedClipboard> {
  return app.evaluate(({ clipboard }) => {
    const image = clipboard.readImage()
    return { text: clipboard.readText(), html: clipboard.readHTML(), image: image.isEmpty() ? '' : image.toDataURL() }
  })
}

async function restoreClipboard(app: ElectronApplication, saved: SavedClipboard): Promise<void> {
  await app.evaluate(({ clipboard, nativeImage }, s) => {
    clipboard.clear()
    const data: { text?: string; html?: string; image?: Electron.NativeImage } = {}
    if (s.text) data.text = s.text
    if (s.html) data.html = s.html
    if (s.image) data.image = nativeImage.createFromDataURL(s.image)
    if (Object.keys(data).length > 0) clipboard.write(data)
  }, saved)
}

async function putImage(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(({ clipboard, nativeImage }) => {
    const w = 24
    const h = 16
    const bgra = Buffer.alloc(w * h * 4)
    for (let i = 0; i < w * h; i++) bgra.set([0x30, 0x60, 0xe0, 0xff], i * 4)
    clipboard.clear()
    clipboard.writeImage(nativeImage.createFromBitmap(bgra, { width: w, height: h }))
    return clipboard.availableFormats()
  })
}

async function putText(app: ElectronApplication, text: string): Promise<string[]> {
  return app.evaluate(({ clipboard }, t) => {
    clipboard.clear()
    clipboard.writeText(t)
    return clipboard.availableFormats()
  }, text)
}

// What most Windows screenshot tools do: a .NET / Win32 bitmap set by another process.
const DOTNET_SET_IMAGE = [
  'Add-Type -AssemblyName System.Windows.Forms, System.Drawing',
  '$b = New-Object System.Drawing.Bitmap 2560, 1440',
  '$g = [System.Drawing.Graphics]::FromImage($b)',
  '$g.Clear([System.Drawing.Color]::CornflowerBlue)',
  '[System.Windows.Forms.Clipboard]::SetImage($b)',
].join('; ')
// claude CLI 2.1.296's own Windows check after Alt+V (checkImage in the CLI bundle).
const CLI_CHECK_IMAGE = 'Add-Type -AssemblyName System.Windows.Forms; if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) { exit 1 }'

async function powershellSta(command: string): Promise<string> {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Sta', '-Command', command], 20_000)
    .then(() => 'exit 0', (err: { code?: number }) => `exit ${err?.code ?? '?'}`)
}

/** Renderer-side Async Clipboard view (the pre-T0524 Windows detection), for the report. */
async function asyncClipboardView(win: Page): Promise<string> {
  return win.evaluate(async () => {
    const focus = document.hasFocus()
    try {
      const items = await navigator.clipboard.read()
      return `hasFocus=${focus} read() types=${JSON.stringify(items.map(i => i.types))}`
    } catch (err) {
      return `hasFocus=${focus} read() threw ${(err as Error)?.name}: ${(err as Error)?.message}`
    }
  })
}

/** Keeps the instance's debug log for the report (userData is removed on close). */
function keepDebugLogs(inst: IsolatedInstance): void {
  const logsDir = path.join(inst.userData, 'Logs')
  for (const f of fs.existsSync(logsDir) ? fs.readdirSync(logsDir) : []) {
    if (f.startsWith('debug-')) fs.copyFileSync(path.join(logsDir, f), test.info().outputPath(f))
  }
}

const hexChunks =(buf: string): string[] => [...buf.matchAll(/T0524_HEX:([0-9a-f]*):END/g)].map(m => m[1])

async function pressAndCollect(win: Page, key: string): Promise<string[]> {
  const before = hexChunks(await win.evaluate(() => (window as AnyApi).__t0524 as string)).length
  await win.locator('.terminal-panel .xterm').first().click()
  await win.keyboard.press(key)
  await expect.poll(async () => hexChunks(await win.evaluate(() => (window as AnyApi).__t0524 as string)).length, { timeout: 8_000 })
    .toBeGreaterThan(before)
  // Let a split chunk land too.
  await new Promise(r => setTimeout(r, 400))
  return hexChunks(await win.evaluate(() => (window as AnyApi).__t0524 as string)).slice(before)
}

test('Ctrl+V: image → CLI image-paste key in the PTY, text → text', async () => {
  test.setTimeout(150_000)
  let inst: IsolatedInstance | undefined
  let saved: SavedClipboard | undefined
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 't0524-'))
  const script = path.join(folder, 'echo-stdin.js')
  fs.writeFileSync(script, ECHO_SCRIPT)
  try {
    inst = await launchIsolated('t0524-paste', log)
    const { app, win } = inst
    saved = await saveClipboard(app)
    log(`clipboard saved: text=${saved.text.length} chars html=${saved.html.length} chars image=${saved.image ? 'yes' : 'no'}`)

    await expect.poll(async () => win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()).then(v => v !== null), { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0524 paste', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TERM, workspaceId: WS, type: 'terminal', title: 'T0524 terminal' }],
      activeTerminalId: TERM,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await win.evaluate((id) => {
      const w = window as AnyApi
      w.__t0524 = ''
      w.electronAPI.pty.onOutput((pid: string, data: string) => { if (pid === id) w.__t0524 += data })
    }, TERM)
    await expect(win.locator('.terminal-panel .xterm').first()).toBeVisible({ timeout: 30_000 })

    // Start the hex echo once the shell is up (resend until it answers).
    const scriptArg = script.replace(/\\/g, '/')
    await expect.poll(async () => {
      const out = await win.evaluate(() => (window as AnyApi).__t0524 as string)
      if (out.includes('T0524_ECHO_READY')) return true
      await win.evaluate(([id, s]) => (window as AnyApi).electronAPI.pty.write(id, `node "${s}"\r`), [TERM, scriptArg])
      return false
    }, { timeout: 45_000, intervals: [3_000] }).toBe(true).catch(async (err) => {
      const out = await win.evaluate(() => (window as AnyApi).__t0524 as string)
      log(`hex echo did not start; PTY output tail: ${JSON.stringify(out.slice(-600))}`)
      keepDebugLogs(inst!)
      throw err
    })
    log(`platform=${process.platform}; hex echo running in the terminal PTY`)

    const expectedKey = process.platform === 'win32' ? '1b76' : '16'

    // 1. Image on the clipboard.
    const imageFormats = await putImage(app)
    log(`image clipboard formats (main availableFormats): ${JSON.stringify(imageFormats)}`)
    log(`image clipboard, renderer Async Clipboard: ${await asyncClipboardView(win)}`)
    const imageChunks = await pressAndCollect(win, 'Control+v')
    log(`Ctrl+V with image → PTY bytes ${JSON.stringify(imageChunks)} (expected ${expectedKey})`)
    await win.screenshot({ path: test.info().outputPath('ctrl-v-image.png') })

    // 1b. Windows: a large bitmap written by another process (.NET Clipboard.SetImage).
    let externalChunks: string[] | null = null
    if (process.platform === 'win32') {
      log(`.NET Clipboard.SetImage 2560x1440: ${await powershellSta(DOTNET_SET_IMAGE)}`)
      log(`external image formats (main availableFormats): ${JSON.stringify(await app.evaluate(({ clipboard }) => clipboard.availableFormats()))}`)
      log(`external image, renderer Async Clipboard: ${await asyncClipboardView(win)}`)
      log(`claude CLI checkImage (ContainsImage) on it: ${await powershellSta(CLI_CHECK_IMAGE)}`)
      externalChunks = await pressAndCollect(win, 'Control+v')
      log(`Ctrl+V with external image → PTY bytes ${JSON.stringify(externalChunks)} (expected ${expectedKey})`)
    }

    // 2. Text on the clipboard.
    const text = 'T0524 text paste'
    const textFormats = await putText(app, text)
    log(`text clipboard formats: ${JSON.stringify(textFormats)}`)
    const textChunks = await pressAndCollect(win, 'Control+v')
    const textHex = Buffer.from(text).toString('hex')
    log(`Ctrl+V with text → PTY bytes ${JSON.stringify(textChunks)} (expected ${textHex})`)
    await win.screenshot({ path: test.info().outputPath('ctrl-v-text.png') })

    keepDebugLogs(inst)

    expect(imageChunks.join('')).toBe(expectedKey)
    if (externalChunks) expect(externalChunks.join('')).toBe(expectedKey)
    expect(textChunks.join('')).toBe(textHex)
  } finally {
    if (inst && saved) {
      await restoreClipboard(inst.app, saved).then(
        () => log('clipboard restored'),
        (err) => log(`clipboard restore FAILED: ${err instanceof Error ? err.message : String(err)}`),
      )
    }
    if (inst) await inst.win.evaluate((id) => (window as AnyApi).electronAPI.pty.kill(id), TERM).catch(() => { /* gone */ })
    await closeIsolated(inst, log)
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
