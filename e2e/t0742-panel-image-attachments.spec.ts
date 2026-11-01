// T0742 / BUG-108: Claude panel image attachments are read on the client (T0436), so an image outside
// every workspace — os.tmpdir() included — attaches. Before T0436 every attachment went through the
// proxied `image:read-as-data-url` (`git show 6c26edcc^:src/components/ClaudeAgentPanel.tsx`
// `addImageByPath`), which the path guard allows only inside a workspace: those images were refused
// with `Path access denied`.
//
// One scenario in a local window, no message sent:
//   1. a PNG in os.tmpdir() (outside the workspace) is dropped on the panel — a real file through
//      `setInputFiles`, dropped with a synthetic DragEvent carrying that File;
//   2. "+" (add image) with main's file dialog stubbed to return a PNG outside the workspace and
//      outside os.tmpdir() (`dialog:select-attachments` reads it in main, the renderer passes no path).
//   Both thumbnails appear with the files' own bytes, and no `Path access denied` is logged. At the
//   end the pre-T0436 route is asked for the same two files and refuses both — the old code's result.
//
// No model: the panel tab only starts the embedded claude CLI, which can reach nothing but
// fixtures/fake-anthropic-api.ts (fake key, a refusing proxy, a temp HOME, inherited CLAUDE* /
// ANTHROPIC_* dropped, recorders on main `fetch` / `webRequest`); the test asserts 0 requests.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only
// (embedded claude.exe), like the other Claude panel specs.

import { test, expect, type Page, type Locator } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi, type BlockingProxy, type FakeAnthropicApi } from './fixtures/fake-anthropic-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0742-attach')
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i
// 1×1 PNGs, one red and one blue, so the two thumbnails are told apart by their bytes.
const PNG_RED = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
const PNG_BLUE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg=='

async function withoutInheritedClaudeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try {
    return await fn()
  } finally {
    Object.assign(process.env, saved)
  }
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

async function installNetRecorders(inst: IsolatedInstance): Promise<void> {
  await inst.app.evaluate(({ session }) => {
    const g = globalThis as AnyApi
    g.__t0742 = { fetch: [] as string[], web: [] as string[] }
    const original = g.fetch
    g.fetch = (input: AnyApi, init?: AnyApi) => {
      try { g.__t0742.fetch.push(typeof input === 'string' ? input : String(input?.url ?? input)) } catch { /* ignore */ }
      return original(input, init)
    }
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (!/^(file|devtools|chrome|chrome-extension|data|blob):/i.test(details.url)) g.__t0742.web.push(details.url)
      callback({})
    })
  })
}

const activeView = (win: Page): Locator => win.locator('.workspace-container.active')
const activePanel = (win: Page): Locator => win.locator('.workspace-container.active .terminal-wrapper.active .claude-agent-panel')

/** Drops the real file at `filePath` on `target`: an <input type=file> gets it via setInputFiles, its File goes into a DragEvent. */
async function dropRealFile(win: Page, target: string, filePath: string): Promise<void> {
  await win.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 't0742-drop-input'
    input.style.display = 'none'
    document.body.appendChild(input)
  })
  await win.setInputFiles('#t0742-drop-input', filePath)
  await win.evaluate((selector) => {
    const input = document.getElementById('t0742-drop-input') as HTMLInputElement
    const el = document.querySelector(selector)
    if (!el || !input.files?.length) throw new Error(`drop target ${selector} or file missing`)
    const dt = new DataTransfer()
    dt.items.add(input.files[0])
    for (const type of ['dragenter', 'dragover', 'drop']) {
      el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }))
    }
    input.remove()
  }, target)
}

test.skip(process.platform !== 'win32', 'embedded claude.exe: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('Claude panel: a dropped tmpdir image and a dialog-picked image outside the workspace both attach', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0742-attach-'))
  const home = path.join(tmp, 'home')
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  const dropPng = path.join(tmp, 't0742-drop.png') // inside os.tmpdir(), outside the workspace
  fs.writeFileSync(dropPng, Buffer.from(PNG_RED, 'base64'))
  // Outside os.tmpdir() and outside the workspace (as the Claude panel specs place their workspace).
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0742-'))
  const folder = path.join(root, 'ws')
  const outside = path.join(root, 'outside')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(outside, { recursive: true })
  const dialogPng = path.join(outside, 't0742-dialog.png')
  fs.writeFileSync(dialogPng, Buffer.from(PNG_BLUE, 'base64'))
  let fake: FakeAnthropicApi | undefined
  let proxy: BlockingProxy | undefined
  let inst: IsolatedInstance | undefined
  try {
    fake = await startFakeAnthropicApi({})
    proxy = await startBlockingProxy()
    const env = {
      ANTHROPIC_BASE_URL: fake.baseUrl,
      ANTHROPIC_API_KEY: 't0742-fake-key',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      USERPROFILE: home,
      HOME: home,
      HTTPS_PROXY: proxy.url,
      HTTP_PROXY: proxy.url,
      NO_PROXY: '127.0.0.1,localhost',
    }
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0742-attach', log, { env }))
    await installNetRecorders(inst)
    const { app, win, userData } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: 'e2e-t0742-attach-ws', name: 'e2e-t0742-attach', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: 'e2e-t0742-attach-ws',
      activeGroup: null,
      terminals: [{ id: 'e2e-t0742-attach-shell', workspaceId: 'e2e-t0742-attach-ws', type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: 'e2e-t0742-attach-shell',
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const recovery = win.locator('.recovery-prompt-dialog')
    if (await recovery.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)) {
      await recovery.locator('.recovery-prompt-actions .btn-primary').click()
      log('answered the Recovery prompt after the reload (keep)')
    }
    await expect(activeView(win).locator('.thumbnail-add-btn')).toBeVisible({ timeout: 30_000 })
    log(`workspace ${folder}; drop image ${dropPng}; dialog image ${dialogPng}`)

    // A Claude Agent tab from the thumbnail "+" menu.
    await activeView(win).locator('.thumbnail-add-btn').click()
    const item = win.locator('.thumbnail-add-menu-item:not(.disabled)', { hasText: 'Claude Agent', hasNotText: 'Worktree' }).first()
    await expect(item).toBeVisible({ timeout: 10_000 })
    await item.click()
    const panel = activePanel(win)
    await expect(panel).toBeVisible({ timeout: 45_000 })
    await expect(panel.locator('textarea.claude-input')).toBeVisible({ timeout: 30_000 })

    // 1. drop the tmpdir PNG
    await dropRealFile(win, '.workspace-container.active .terminal-wrapper.active .claude-agent-panel', dropPng)
    const thumbs = panel.locator('.claude-attachment-thumb')
    await expect(thumbs).toHaveCount(1, { timeout: 15_000 })
    expect(await thumbs.nth(0).getAttribute('src')).toBe(`data:image/png;base64,${PNG_RED}`)
    log('1: the dropped tmpdir PNG shows as a thumbnail with its own bytes')

    // 2. "+" with the file dialog stubbed (main side) to pick the PNG outside the workspace and tmpdir
    await app.evaluate(({ dialog }, picked) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [picked] })
    }, dialogPng)
    await panel.locator('.claude-add-image-btn').click()
    await expect(thumbs).toHaveCount(2, { timeout: 15_000 })
    expect(await thumbs.nth(1).getAttribute('src')).toBe(`data:image/png;base64,${PNG_BLUE}`)
    log('2: the dialog-picked PNG (outside the workspace and os.tmpdir()) shows as a second thumbnail')
    await win.screenshot({ path: test.info().outputPath('panel-attachments.png') })

    const denied = readDebugLogs(userData).split('\n').filter(l => /Path access denied/.test(l))
    expect(denied, 'no path-guard refusal while attaching').toEqual([])

    // The pre-T0436 route (proxied image:read-as-data-url, path guard) refuses both files.
    const oldRoute = await win.evaluate(async (paths) => Promise.all(paths.map(async p => {
      try { await (window as AnyApi).electronAPI.image.readAsDataUrl(p); return 'read' } catch (e) { return String((e as Error)?.message ?? e) }
    })), [dropPng, dialogPng])
    log(`pre-T0436 route image:read-as-data-url → ${JSON.stringify(oldRoute)}`)
    for (const r of oldRoute) expect(r).toContain('Path access denied')

    await win.waitForTimeout(2_000)
    const net = await app.evaluate(() => (globalThis as AnyApi).__t0742) as { fetch: string[]; web: string[] }
    const offMachine = [...net.fetch, ...net.web].filter(u => !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(u))
    log(`model requests ${fake.requests.length}; proxy attempts ${JSON.stringify(proxy.attempts)}; off-machine main fetch / webRequest ${JSON.stringify(offMachine)}`)
    expect(fake.requests).toEqual([])
    expect(proxy.attempts).toEqual([])
    expect(offMachine).toEqual([])
  } finally {
    await closeIsolated(inst, log)
    await fake?.close()
    await proxy?.close()
    fs.rmSync(tmp, { recursive: true, force: true })
    fs.rmSync(root, { recursive: true, force: true })
  }
})
