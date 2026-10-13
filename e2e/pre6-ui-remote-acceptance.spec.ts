// T0514 — pre.6 installed-build acceptance, UI / remote-routing lane. OPT-IN: skipped unless
// BAT_E2E_PRE6_UI=1 and the environment from `node e2e/real-remote/t0514-env.mjs up` exists
// (Windows host only). Meant for the installed build:
//
//   $env:BAT_E2E_PRE6_UI='1'
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   npx playwright test e2e/pre6-ui-remote-acceptance.spec.ts
//
// One isolated instance (fixtures/electron-isolation: own --runtime / userData / ports) with:
//   - its main (local) window, workspaces Alpha (a temp git repo, an integrated Claude tab) and
//     Beta (a plain terminal);
//   - a docker-linux remote profile → container bat-t0514-srv (stock pre.6 bat-server from the
//     installed BAT's baseline tarball), mount C:\bat-t0514-virt\work <-> /work. The client path
//     does not exist on Windows, so a call that runs locally cannot produce the container's markers.
//
// No Claude token is spent: before any window opens an Agent panel, every `claude:*` ipcMain
// handler that could spawn the CLI or talk to the API is replaced in the isolated main process by
// a recorder (start / resume / send / models / account / auth …). Only read-only scans stay real
// (`claude:scan-skills`, `claude:list-sessions`, `claude:scan-star-commands`, archives). The
// panel's `/snippet` prompt is therefore captured at `claude:send-message` and never sent.
//
//   U1 BUG-113  local workspace detach → the window shows the workspace, not "Workspace not found"
//   U6 BUG-106  worktree create / remove on an isolated repo; worktree:merge is gone everywhere
//   U7 BUG-107  webUtils path for a File; synthetic drop of real-path Files on the Claude panel
//   U8 BUG-108  image attachments outside the workspace (drop + dialog), local and remote window
//   U9 BUG-109  `/snippet` prompt: snippet content inline, no snippets.json / macOS path
//   U5 BUG-096  remote window connect carries the pin; reuse, mismatch, legacy and wrong-pin refusals
//   U4 BUG-105  claude:* cwd, github:*, git-scaffold:*, worktree:create translated to /work
//   U2 BUG-112  a workspace detached from the remote window routes to the container
//   U3 BUG-110  container stopped → proxied calls refused (REMOTE_NOT_CONNECTED), nothing local

import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import {
  E2E_EXECUTABLE,
  closeIsolated,
  launchIsolated,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0514')

const ENABLED = process.env.BAT_E2E_PRE6_UI === '1'
const STATE_DIR = path.join(os.tmpdir(), 'bat-t0514')
const CONFIG_PATH = process.env.BAT_E2E_PRE6_UI_CONFIG || path.join(STATE_DIR, 'connection.json')
const EVIDENCE_DIR = process.env.BAT_E2E_PRE6_EVIDENCE_DIR || path.join(STATE_DIR, 'evidence')

interface EnvConfig {
  distro: string
  container: string
  hostname: string
  host: string
  port: number
  token: string
  fingerprint: string
  bundleVersion: string
  baseline: { file: string; version: string; sha256: string }
  clientWork: string
  serverWork: string
  seedSessionId: string
}

function loadConfig(): EnvConfig | null {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as EnvConfig
  } catch {
    return null
  }
}

/** claude:* channels left real: read-only scans that never spawn the CLI or call the API. */
const REAL_CLAUDE_CHANNELS = [
  'claude:scan-skills', 'claude:list-sessions', 'claude:scan-star-commands',
  'claude:archive-messages', 'claude:load-archived', 'claude:clear-archive',
]
const NOT_FOUND_RX = /Workspace not found|找不到工作[区區]/
// A 2x2 PNG (red / green / blue / white).
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=='

function docker(cfg: EnvConfig, args: string[], timeout = 60_000): string {
  return execFileSync('wsl.exe', ['-d', cfg.distro, '--exec', 'docker', ...args], { encoding: 'utf8', timeout, windowsHide: true })
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 20_000, windowsHide: true })
}

function readMainLog(inst: IsolatedInstance): string {
  const dir = path.join(inst.userData, 'Logs')
  try {
    return fs.readdirSync(dir).filter(f => f.startsWith('debug-') && f.endsWith('.log'))
      .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  } catch {
    return ''
  }
}

function logLines(inst: IsolatedInstance, rx: RegExp): string[] {
  return readMainLog(inst).split(/\r?\n/).filter(l => rx.test(l))
}

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file })
  return file
}

async function bodyText(page: Page): Promise<string> {
  return (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim()
}

/** One invoke over a fresh RemoteServer / bat-server connection (TLS not verified: test-owned servers). */
async function wsInvoke(port: number, token: string, channel: string, args: unknown[]): Promise<{ type: string; result?: unknown; error?: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://127.0.0.1:${port}`, { rejectUnauthorized: false })
    const timer = setTimeout(() => { ws.terminate(); reject(new Error(`wsInvoke ${channel} timed out`)) }, 15_000)
    const done = (v: { type: string; result?: unknown; error?: string }) => { clearTimeout(timer); ws.close(); resolve(v) }
    ws.on('error', (err) => { clearTimeout(timer); reject(err) })
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', id: 't0514-auth', token, args: ['t0514-probe'] })))
    ws.on('message', (raw) => {
      let frame: { type?: string; id?: string; result?: unknown; error?: string }
      try { frame = JSON.parse(String(raw)) } catch { return }
      if (frame.id === 't0514-auth' || frame.type === 'auth-result') {
        if (frame.type !== 'auth-result' || frame.error || frame.result === false) {
          done({ type: 'auth-failed', error: frame.error ?? JSON.stringify(frame) })
          return
        }
        ws.send(JSON.stringify({ type: 'invoke', id: 't0514-invoke', channel, args }))
        return
      }
      if (frame.id === 't0514-invoke') done({ type: frame.type ?? '?', result: frame.result, error: frame.error })
    })
  })
}

async function openNewInstance(owner: IsolatedInstance, profileId: string): Promise<{ alreadyOpen?: boolean; windowIds?: string[]; error?: string }> {
  return owner.win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profileId)
}

function pageForWindowId(owner: IsolatedInstance, windowId: string): Page | undefined {
  const needle = `windowId=${encodeURIComponent(windowId)}`
  return owner.app.windows().find(p => p.url().includes(needle))
}

async function clientStatus(page: Page): Promise<{ connected: boolean; info: { host: string; port: number; fingerprint: string } | null }> {
  return page.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())
}

/** PTY output and remote:invoke-refused as this window's renderer receives them. */
async function installCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as AnyApi
    if (w.__t0514) return
    w.__t0514 = { out: {} as Record<string, string>, refused: [] as unknown[] }
    w.electronAPI.pty.onOutput((id: string, data: string) => { w.__t0514.out[id] = (w.__t0514.out[id] ?? '') + data })
    w.electronAPI.remote.onInvokeRefused((info: unknown) => { w.__t0514.refused.push(info) })
  })
}

async function outputOf(page: Page, id: string): Promise<string> {
  // eslint-disable-next-line no-control-regex
  return page.evaluate((pid) => String((window as AnyApi).__t0514?.out?.[pid] ?? '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, ''), id)
}

/** Runs `command` in PTY `id` until `expected` shows up in its output (the PTY may still be starting). */
async function ptyAnswers(page: Page, id: string, command: string, expected: string, timeout = 30_000): Promise<string> {
  const end = Date.now() + timeout
  let out = ''
  while (Date.now() < end) {
    await page.evaluate(({ pid, cmd }) => (window as AnyApi).electronAPI.pty.write(pid, `${cmd}\r`), { pid: id, cmd: command })
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 500))
      out = await outputOf(page, id)
      if (out.includes(expected)) return out
    }
  }
  return out
}

/** Settles a renderer promise as { ok, value } / { ok: false, error } without throwing across evaluate. */
async function settle<T = unknown>(page: Page, fn: string, args: unknown[]): Promise<{ ok: boolean; value?: T; error?: string }> {
  return page.evaluate(async ({ fn, args }) => {
    const api = (window as AnyApi).electronAPI
    const target = fn.split('.').reduce((o: AnyApi, k: string) => o?.[k], api)
    try {
      return { ok: true, value: await target(...args) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }, { fn, args })
}

async function stubCalls(inst: IsolatedInstance, channel: string): Promise<Array<{ args: unknown[]; url: string }>> {
  return inst.app.evaluate((_e, ch) => ((globalThis as AnyApi).__t0514.calls as Array<{ channel: string; args: unknown[]; url: string }>)
    .filter(c => c.channel === ch).map(c => ({ args: c.args, url: c.url })), channel)
}

test.describe('T0514 — pre.6 installed build: UI / remote routing (opt-in)', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(180_000)

  const cfg = loadConfig()
  let inst: IsolatedInstance | undefined
  const stamp = Date.now()
  const repoDir = path.join(os.tmpdir(), `bat-t0514-repo-${stamp}`)
  const betaDir = path.join(os.tmpdir(), `bat-t0514-beta-${stamp}`)
  const outsideDir = path.join(os.tmpdir(), `bat-t0514-outside-${stamp}`)
  const pngPath = path.join(outsideDir, 't0514-outside.png')
  const txtPath = path.join(outsideDir, 't0514-outside-note.txt')
  const WS_ALPHA = `e2e-t0514-ws-alpha-${stamp}`
  const WS_BETA = `e2e-t0514-ws-beta-${stamp}`
  const WS_REMOTE = `e2e-t0514-ws-remote-${stamp}`
  const TERM_CLAUDE_LOCAL = `e2e-t0514-claude-local-${stamp}`
  const TERM_BETA = `e2e-t0514-term-beta-${stamp}`
  const TERM_REMOTE = `e2e-t0514-term-remote-${stamp}`
  const TERM_CLAUDE_REMOTE = `e2e-t0514-claude-remote-${stamp}`
  const SNIPPET_TITLE = `T0514 snippet ${stamp}`
  const SNIPPET_BODY = `echo t0514-snippet-body-${stamp}`
  let profileId = ''
  let remotePage: Page
  let remoteDetached: Page | undefined
  const remotePtys: string[] = []

  const ready = () => ENABLED && cfg !== null && process.platform === 'win32'

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    if (!ready()) return
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    fs.mkdirSync(repoDir, { recursive: true })
    fs.mkdirSync(betaDir, { recursive: true })
    fs.mkdirSync(outsideDir, { recursive: true })
    fs.writeFileSync(pngPath, Buffer.from(PNG_BASE64, 'base64'))
    fs.writeFileSync(txtPath, 'T0514 outside note\n')
    git(repoDir, ['init', '-q', '-b', 'main'])
    git(repoDir, ['config', 'user.email', 't0514@example.invalid'])
    git(repoDir, ['config', 'user.name', 'T0514'])
    fs.writeFileSync(path.join(repoDir, 'README.md'), 'T0514 local repo\n')
    git(repoDir, ['add', '-A'])
    git(repoDir, ['commit', '-q', '-m', 'T0514-LOCAL-MARKER commit'])

    inst = await launchIsolated('t0514', log)
    log(`executable under test: ${E2E_EXECUTABLE || '(source build)'}; app version ${await inst.app.evaluate(({ app }) => app.getVersion())}`)
    log(`remote target: ${cfg!.container} bat-server ${cfg!.bundleVersion} at ${cfg!.host}:${cfg!.port} (baseline ${path.basename(cfg!.baseline.file)} sha256 ${cfg!.baseline.sha256.slice(0, 16)}…)`)

    // Recorders installed in the isolated main process (test-side only; no product change).
    const stubbed = await inst.app.evaluate(({ ipcMain, dialog }, { real, png, txt }) => {
      const g = globalThis as AnyApi
      g.__t0514 = { calls: [] as unknown[], messageBoxes: [] as unknown[], openDialogs: 0 }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dialog as any).showMessageBox = async (...a: any[]) => {
        const o = a.length > 1 ? a[1] : a[0]
        g.__t0514.messageBoxes.push({ title: o?.title ?? '', message: o?.message ?? '', detail: o?.detail ?? '' })
        return { response: 0, checkboxChecked: false }
      }
      // dialog:select-attachments → the two files outside every workspace.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dialog as any).showOpenDialog = async () => { g.__t0514.openDialogs++; return { canceled: false, filePaths: [png, txt] } }
      const handlers = (ipcMain as AnyApi)._invokeHandlers as Map<string, (...a: unknown[]) => unknown>
      if (!handlers || typeof handlers.get !== 'function') return { error: 'ipcMain._invokeHandlers unavailable' }
      const record = (channel: string, event: AnyApi, args: unknown[]) => {
        let url = ''
        try { url = event?.sender?.getURL?.() ?? '' } catch { /* gone */ }
        g.__t0514.calls.push({ channel, args, url, at: Date.now() })
      }
      const defaults: Record<string, unknown> = {
        'claude:start-session': true, 'claude:resume-session': true, 'claude:send-message': true,
        'claude:get-supported-models': [], 'claude:get-supported-commands': [], 'claude:get-supported-agents': [],
        'claude:auth-status': { loggedIn: true, email: 't0514-stub@example.invalid', authMethod: 'stub', subscriptionType: 'stub' }, 'claude:get-statusline-extras': {},
      }
      const stubbedChannels: string[] = []
      for (const channel of [...handlers.keys()]) {
        if (!channel.startsWith('claude:') || real.includes(channel)) continue
        ipcMain.removeHandler(channel)
        ipcMain.handle(channel, async (event, ...args) => { record(channel, event, args); return defaults[channel] ?? null })
        stubbedChannels.push(channel)
      }
      // Pass-through recorders: what the renderer really sends, then the real handler.
      const wrapped: string[] = []
      for (const channel of ['remote:connect', 'image:read-as-data-url', 'pty:create']) {
        const original = handlers.get(channel)
        if (!original) continue
        ipcMain.removeHandler(channel)
        ipcMain.handle(channel, async (event, ...args) => { record(channel, event, args); return original(event, ...args) })
        wrapped.push(channel)
      }
      return { stubbedChannels, wrapped, hasMerge: handlers.has('worktree:merge') }
    }, { real: REAL_CLAUDE_CHANNELS, png: pngPath, txt: txtPath })
    log(`main-process recorders: ${JSON.stringify(stubbed)}`)
    expect((stubbed as AnyApi).error).toBeUndefined()
    expect((stubbed as AnyApi).stubbedChannels).toEqual(expect.arrayContaining(['claude:start-session', 'claude:send-message', 'claude:resume-session', 'claude:get-supported-models']))
    expect((stubbed as AnyApi).wrapped).toEqual(['remote:connect', 'image:read-as-data-url', 'pty:create'])
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    if (!inst) return
    const boxes = await inst.app.evaluate(() => (globalThis as AnyApi).__t0514?.messageBoxes).catch(() => [])
    log(`native message boxes during the run (stubbed): ${JSON.stringify(boxes)}`)
    const spawned = await inst.app.evaluate(() => ((globalThis as AnyApi).__t0514?.calls as Array<{ channel: string }> ?? [])
      .filter(c => c.channel.startsWith('claude:')).map(c => c.channel)).catch(() => [])
    log(`claude:* calls answered by the recorder (never reached the CLI / API): ${JSON.stringify(spawned)}`)
    const notAFunction = logLines(inst, /is not a function/)
    log(`main log lines with "is not a function": ${notAFunction.length}${notAFunction.length ? ` — ${notAFunction.slice(0, 3).join(' | ')}` : ''}`)
    for (const f of fs.existsSync(path.join(inst.userData, 'Logs')) ? fs.readdirSync(path.join(inst.userData, 'Logs')) : []) {
      if (f.startsWith('debug-')) fs.copyFileSync(path.join(inst.userData, 'Logs', f), path.join(EVIDENCE_DIR, `instance-${f}`))
    }
    await closeIsolated(inst, log)
    for (const dir of [repoDir, betaDir, outsideDir]) {
      for (let i = 0; i < 5; i++) {
        try { fs.rmSync(dir, { recursive: true, force: true }); break } catch { await new Promise(r => setTimeout(r, 500)) }
      }
      log(`temp ${dir} removed: ${!fs.existsSync(dir)}`)
    }
  })

  test.beforeEach(() => {
    test.skip(!ENABLED, 'opt-in: set BAT_E2E_PRE6_UI=1 after `node e2e/real-remote/t0514-env.mjs up`')
    test.skip(process.platform !== 'win32', 'Windows host only')
    test.skip(cfg === null, `no ${CONFIG_PATH} — run \`node e2e/real-remote/t0514-env.mjs up\` first`)
  })

  test('U1 (BUG-113) local workspace detach shows the workspace, not "Workspace not found"', async () => {
    const { app, win } = inst!
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_ALPHA, name: 'T0514-Alpha', folderPath: repoDir, createdAt: Date.now() },
        { id: WS_BETA, name: 'T0514-Beta', folderPath: betaDir, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_ALPHA,
      activeGroup: null,
      terminals: [
        { id: TERM_CLAUDE_LOCAL, workspaceId: WS_ALPHA, type: 'terminal', agentPreset: 'claude-code', title: 'T0514 Claude (local)', cwd: repoDir },
        { id: TERM_BETA, workspaceId: WS_BETA, type: 'terminal', title: 'T0514 Beta terminal', cwd: betaDir },
      ],
      activeTerminalId: TERM_CLAUDE_LOCAL,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await installCapture(win)
    const sidebarBeta = win.locator('.workspace-item', { hasText: 'T0514-Beta' })
    await expect(sidebarBeta).toBeVisible({ timeout: 30_000 })

    const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_BETA)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    expect(detached.url()).toContain(`detached=${WS_BETA}`)
    const view = detached.locator('.workspace-container.active')
    await expect(view).toBeVisible({ timeout: 30_000 })
    await installCapture(detached)
    const text = await bodyText(detached)
    log(`U1: detached window url=${detached.url().replace(/^.*\?/, '?')} view=${await view.count()} text=${JSON.stringify(text.slice(0, 160))}`)
    expect(NOT_FOUND_RX.test(text)).toBe(false)
    const out = await ptyAnswers(detached, TERM_BETA, 'echo T0514_U1_MARK""ER_OK', 'T0514_U1_MARKER_OK')
    expect(out).toContain('T0514_U1_MARKER_OK')
    log(`U1: detached Beta terminal ran a command (T0514_U1_MARKER_OK); screenshot ${await shot(detached, 'u1-local-detached')}`)

    const closed = detached.waitForEvent('close', { timeout: 15_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.reattach(id), WS_BETA)).toBe(true)
    await closed
    await expect(sidebarBeta).toBeVisible({ timeout: 10_000 })
    log('U1: reattach closed the detached window; Beta is back in the main sidebar — PASS')
  })

  test('U6 (BUG-106) worktree create / remove on an isolated repo; worktree:merge is gone', async () => {
    const { app, win, userData } = inst!
    const sessionId = `t0514-wt-local-${stamp}`
    const created = await settle<{ success: boolean; worktreePath?: string; branchName?: string; error?: string }>(win, 'worktree.create', [sessionId, repoDir])
    log(`U6: worktree.create(${sessionId}, ${repoDir}) → ${JSON.stringify(created)}`)
    expect(created.ok).toBe(true)
    expect(created.value?.success).toBe(true)
    const wtPath = created.value!.worktreePath!
    expect(fs.existsSync(wtPath)).toBe(true)
    log(`U6: git worktree list:\n${git(repoDir, ['worktree', 'list']).trim()}`)

    // The renderer API, the ipcMain binding and both servers' handler registries no longer have it.
    const preloadMerge = await win.evaluate(() => typeof (window as AnyApi).electronAPI.worktree.merge)
    const ipcHasMerge = await app.evaluate(({ ipcMain }) => ((ipcMain as AnyApi)._invokeHandlers as Map<string, unknown>).has('worktree:merge'))
    const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
    const localToken: string = record.encrypted
      ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
      : record.data
    const localMerge = await wsInvoke(inst!.remotePort, localToken, 'worktree:merge', [sessionId])
    const remoteMerge = await wsInvoke(cfg!.port, cfg!.token, 'worktree:merge', [sessionId])
    log(`U6: typeof electronAPI.worktree.merge = ${preloadMerge}; ipcMain handler 'worktree:merge' registered = ${ipcHasMerge}`)
    log(`U6: isolated RemoteServer (port ${inst!.remotePort}) worktree:merge → ${JSON.stringify(localMerge)}`)
    log(`U6: container bat-server (pre.6) worktree:merge → ${JSON.stringify(remoteMerge)}`)
    expect(preloadMerge).toBe('undefined')
    expect(ipcHasMerge).toBe(false)
    for (const r of [localMerge, remoteMerge]) {
      expect(r.type).toBe('invoke-error')
      expect(r.error).toMatch(/No handler for channel: worktree:merge/)
      expect(r.error).not.toMatch(/is not a function/)
    }

    const removed = await settle<{ success: boolean; error?: string }>(win, 'worktree.remove', [sessionId, true])
    log(`U6: worktree.remove(${sessionId}, true) → ${JSON.stringify(removed)}; dir exists after: ${fs.existsSync(wtPath)}`)
    expect(removed.value?.success).toBe(true)
    expect(fs.existsSync(wtPath)).toBe(false)
    expect(logLines(inst!, /is not a function/)).toEqual([])
    log('U6: PASS')
  })

  /** Drops real-path Files (picked through an <input type=file>) on the active Claude panel of `page`. */
  async function dropOnClaudePanel(page: Page, files: string[]): Promise<{ paths: string[]; types: string[] }> {
    await page.evaluate(() => {
      document.getElementById('t0514-file-input')?.remove()
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.id = 't0514-file-input'
      input.style.display = 'none'
      document.body.appendChild(input)
    })
    await page.setInputFiles('#t0514-file-input', files)
    return page.evaluate(() => {
      const input = document.getElementById('t0514-file-input') as HTMLInputElement
      const api = (window as AnyApi).electronAPI
      const list = Array.from(input.files ?? [])
      const paths = list.map(f => api.shell.getPathForFile(f) as string)
      const dt = new DataTransfer()
      for (const f of list) dt.items.add(f)
      const panel = document.querySelector('.main-panel.active .claude-agent-panel, .claude-agent-panel') as HTMLElement
      panel.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
      panel.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      return { paths, types: list.map(f => f.type) }
    })
  }

  async function attachmentState(page: Page): Promise<{ files: string[]; images: string[] }> {
    return page.evaluate(() => ({
      files: Array.from(document.querySelectorAll('.claude-attachment-file')).map(e => (e as HTMLElement).title),
      images: Array.from(document.querySelectorAll('img.claude-attachment-thumb')).map(e => (e as HTMLImageElement).src),
    }))
  }

  async function clearAttachments(page: Page): Promise<void> {
    for (let i = 0; i < 10; i++) {
      const btn = page.locator('.claude-attachment-remove').first()
      if (await btn.count() === 0) return
      await btn.click()
    }
  }

  async function imageReadsSince(n: number): Promise<number> {
    return (await stubCalls(inst!, 'image:read-as-data-url')).length - n
  }

  test('U7 (BUG-107) / U8 (BUG-108) local window: real paths from Files; outside-workspace images attach', async () => {
    const { win } = inst!
    await expect(win.locator('.claude-agent-panel')).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => (await stubCalls(inst!, 'claude:start-session')).length, { timeout: 30_000 }).toBeGreaterThan(0)
    log(`U7/U8: local Claude panel mounted; claude:start-session answered by the recorder: ${JSON.stringify((await stubCalls(inst!, 'claude:start-session'))[0].args).slice(0, 200)}`)
    const imgReads = (await stubCalls(inst!, 'image:read-as-data-url')).length

    const dropped = await dropOnClaudePanel(win, [pngPath, txtPath])
    log(`U7: webUtils.getPathForFile (preload shell.getPathForFile) → ${JSON.stringify(dropped)}`)
    expect(dropped.paths).toEqual([pngPath, txtPath])
    await expect.poll(async () => (await attachmentState(win)).images.length, { timeout: 10_000 }).toBe(1)
    await expect.poll(async () => (await attachmentState(win)).files, { timeout: 10_000 }).toEqual([txtPath])
    const afterDrop = await attachmentState(win)
    log(`U7/U8: after synthetic drop — file chips ${JSON.stringify(afterDrop.files)}; image thumbs ${afterDrop.images.map(s => s.slice(0, 40) + '…').join(', ')}`)
    expect(afterDrop.images[0]).toBe(`data:image/png;base64,${PNG_BASE64}`)
    log(`U7/U8: screenshot ${await shot(win, 'u7-u8-local-drop')}`)
    await clearAttachments(win)

    const selected = await settle<{ files: string[]; images: Array<{ path: string; dataUrl: string }> }>(win, 'dialog.selectAttachments', [])
    log(`U8: dialog.selectAttachments (stubbed picker → ${pngPath}, ${txtPath}) → files ${JSON.stringify(selected.value?.files)} images ${JSON.stringify(selected.value?.images.map(i => ({ path: i.path, dataUrl: i.dataUrl.slice(0, 40) + '…' })))}`)
    expect(selected.ok).toBe(true)
    expect(selected.value?.images).toEqual([{ path: pngPath, dataUrl: `data:image/png;base64,${PNG_BASE64}` }])
    expect(selected.value?.files).toEqual([txtPath])
    // The proxied, path-guarded preview channel is not on the attachment path.
    expect(await imageReadsSince(imgReads)).toBe(0)
    const guarded = await settle(win, 'image.readAsDataUrl', [pngPath])
    log(`U8: for contrast, image:read-as-data-url (preview channel, path guard) on the same outside path → ${JSON.stringify({ ok: guarded.ok, error: guarded.error?.slice(0, 120) })}`)
    log('U7 / U8 local: PASS')
  })

  async function sendSnippetCommand(page: Page, label: string): Promise<string> {
    const before = (await stubCalls(inst!, 'claude:send-message')).length
    const textarea = page.locator('.claude-agent-panel textarea').first()
    await textarea.click()
    await textarea.fill(`/snippet ${SNIPPET_TITLE}`)
    await textarea.press('Enter')
    let calls = await stubCalls(inst!, 'claude:send-message')
    for (let i = 0; i < 20 && calls.length <= before; i++) {
      await new Promise(r => setTimeout(r, 250))
      calls = await stubCalls(inst!, 'claude:send-message')
    }
    if (calls.length <= before) {
      // The slash menu may have taken the first Enter; send once more.
      await textarea.press('Enter')
      await expect.poll(async () => (await stubCalls(inst!, 'claude:send-message')).length, { timeout: 10_000 }).toBeGreaterThan(before)
      calls = await stubCalls(inst!, 'claude:send-message')
    }
    const call = calls[calls.length - 1]
    const prompt = String(call.args[1] ?? '')
    fs.writeFileSync(path.join(EVIDENCE_DIR, `u9-snippet-prompt-${label}.txt`), prompt)
    log(`U9 ${label}: claude:send-message captured (not sent) from ${call.url.replace(/^.*\?/, '?')}, ${prompt.length} chars: ${JSON.stringify(prompt.slice(0, 400))}`)
    return prompt
  }

  function expectSnippetPrompt(prompt: string): void {
    expect(prompt).toContain(SNIPPET_TITLE)
    expect(prompt).toContain(SNIPPET_BODY)
    for (const forbidden of ['~/Library', 'Application Support', 'snippets.json', 'AppData', 'better-agent-terminal']) {
      expect(prompt, `prompt mentions ${forbidden}`).not.toContain(forbidden)
    }
  }

  test('U9 (BUG-109) local window: /snippet prompt carries the snippet, no file path', async () => {
    const { win } = inst!
    const created = await settle(win, 'snippet.create', [{ title: SNIPPET_TITLE, content: SNIPPET_BODY, format: 'plaintext' }])
    log(`U9: snippet.create → ${JSON.stringify(created).slice(0, 200)}`)
    expect(created.ok).toBe(true)
    const prompt = await sendSnippetCommand(win, 'local')
    expectSnippetPrompt(prompt)
    log(`U9 local: PASS; screenshot ${await shot(win, 'u9-local-snippet')}`)
  })

  test('U5 (BUG-096) remote window connects pinned; renderer reconnects never replace the verified client', async () => {
    const c = cfg!
    const owner = inst!
    profileId = await owner.win.evaluate(async ({ c }) => {
      const api = (window as AnyApi).electronAPI
      const created = await api.profile.create('T0514 remote (docker)', { type: 'remote', remoteHost: c.host, remotePort: c.port, remoteToken: c.token, remoteFingerprint: c.fingerprint })
      await api.profile.update(created.id, { targetOS: 'docker-linux', dockerContainer: c.container, dockerMounts: [{ host: c.clientWork, container: c.serverWork }] })
      return created.id as string
    }, { c })
    log(`U5: profile ${profileId}: docker-linux ${c.host}:${c.port}, mount ${c.clientWork} <-> ${c.serverWork}, pinned fp ${c.fingerprint.slice(0, 23)}…`)

    const opened = await openNewInstance(owner, profileId)
    log(`U5: openNewInstance(${profileId}) → ${JSON.stringify(opened)}`)
    expect(opened.error).toBeUndefined()
    const windowId = opened.windowIds![0]
    let page: Page | undefined
    await expect.poll(() => (page = pageForWindowId(owner, windowId)) !== undefined, { timeout: 30_000 }).toBe(true)
    remotePage = page!
    await remotePage.waitForLoadState('domcontentloaded')
    await expect.poll(async () => (await clientStatus(remotePage)).connected, { timeout: 45_000 }).toBe(true)
    await installCapture(remotePage)
    const status = await clientStatus(remotePage)
    log(`U5: remote window ${windowId} clientStatus=${JSON.stringify(status)}`)
    expect(status.info?.fingerprint).toBe(c.fingerprint)

    // What the renderer's initProfile sent, and what main did with it.
    await expect.poll(async () => (await stubCalls(owner, 'remote:connect')).length, { timeout: 15_000 }).toBeGreaterThan(0)
    const connects = await stubCalls(owner, 'remote:connect')
    for (const call of connects) log(`U5: renderer remote:connect args host=${call.args[0]} port=${call.args[1]} token=${call.args[2] ? '<set>' : '<empty>'} label=${call.args[3]} fingerprint=${String(call.args[4] ?? '<none>')} from ${call.url.replace(/^.*\?/, '?')}`)
    expect(connects.some(call => call.args[4] === c.fingerprint)).toBe(true)
    const reuse = logLines(owner, new RegExp(`\\[remote:connect\\] reusing verified client for profile ${profileId}`))
    log(`U5: main log: ${reuse.join(' | ') || '(no reuse line)'}`)
    expect(reuse.length).toBeGreaterThan(0)

    // Explicit renderer reconnects from the remote window.
    const mismatch = await settle(remotePage, 'remote.connect', [c.host, c.port, c.token, 'T0514 probe', 'AA:'.repeat(31) + 'AA'])
    const noFp = await settle(remotePage, 'remote.connect', [c.host, c.port, c.token, 'T0514 probe'])
    const after = await clientStatus(remotePage)
    log(`U5: connect with a wrong fingerprint → ${JSON.stringify(mismatch.value ?? mismatch.error)}`)
    log(`U5: connect without a fingerprint → ${JSON.stringify(noFp.value ?? noFp.error)}`)
    log(`U5: clientStatus afterwards=${JSON.stringify(after)}`)
    expect((mismatch.value as AnyApi)?.errorCode).toBe('fingerprint-mismatch')
    expect((noFp.value as AnyApi)?.connected).toBe(true)
    expect((noFp.value as AnyApi)?.fingerprint).toBe(c.fingerprint)
    expect(after.connected).toBe(true)
    expect(after.info?.fingerprint).toBe(c.fingerprint)
    log(`U5: main log refusals: ${logLines(owner, /\[remote:connect\] refused for profile/).join(' | ')}`)

    // Legacy profile without a pin and a profile pinned to the wrong certificate: no window connects.
    const legacyId = await owner.win.evaluate(async ({ c }) => {
      const api = (window as AnyApi).electronAPI
      const created = await api.profile.create('T0514 legacy (no pin)', { type: 'remote', remoteHost: c.host, remotePort: c.port, remoteToken: c.token })
      return created.id as string
    }, { c })
    const wrongPinId = await owner.win.evaluate(async ({ c }) => {
      const api = (window as AnyApi).electronAPI
      const created = await api.profile.create('T0514 wrong pin', { type: 'remote', remoteHost: c.host, remotePort: c.port, remoteToken: c.token, remoteFingerprint: 'BB:'.repeat(31) + 'BB' })
      return created.id as string
    }, { c })
    for (const [label, id] of [['legacy (no pin)', legacyId], ['wrong pin', wrongPinId]] as const) {
      const r = await openNewInstance(owner, id)
      await new Promise(res => setTimeout(res, 1_500))
      const windowUp = (r.windowIds ?? []).some(wid => pageForWindowId(owner, wid) !== undefined)
      log(`U5: openNewInstance(${label} ${id}) → ${JSON.stringify(r)}; window opened: ${windowUp}`)
      expect(windowUp).toBe(false)
    }
    const boxes = await owner.app.evaluate(() => (globalThis as AnyApi).__t0514.messageBoxes as Array<{ title: string; message: string; detail: string }>)
    log(`U5: failure dialogs: ${JSON.stringify(boxes.map(b => ({ message: b.message, detail: b.detail.slice(0, 160) })))}`)
    log(`U5: main log: ${logLines(owner, new RegExp(`${legacyId}.*missing remoteFingerprint|${wrongPinId}.*(remote connect failed|refused)`)).join(' | ')}`)
    expect(logLines(owner, new RegExp(`${legacyId} is missing remoteFingerprint — refusing to connect`)).length).toBeGreaterThan(0)
    expect(logLines(owner, new RegExp(`remote connect failed for profile ${wrongPinId}`)).length).toBeGreaterThan(0)
    log('U5: PASS')
  })

  test('U4 (BUG-105) remote window: claude:* cwd, github:*, git-scaffold:*, worktree:create run on /work', async () => {
    const c = cfg!
    const page = remotePage
    const seed = {
      workspaces: [{ id: WS_REMOTE, name: 'T0514-Remote', folderPath: c.clientWork, createdAt: Date.now() }],
      activeWorkspaceId: WS_REMOTE,
      activeGroup: null,
      terminals: [
        { id: TERM_REMOTE, workspaceId: WS_REMOTE, type: 'terminal', title: 'T0514 remote terminal', cwd: c.clientWork },
        { id: TERM_CLAUDE_REMOTE, workspaceId: WS_REMOTE, type: 'terminal', agentPreset: 'claude-code', title: 'T0514 Claude (remote)', cwd: c.clientWork },
      ],
      activeTerminalId: TERM_REMOTE,
    }
    expect(await page.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect.poll(async () => (await clientStatus(page)).connected, { timeout: 30_000 }).toBe(true)
    await installCapture(page)
    remotePtys.push(TERM_REMOTE)
    // pty:get-cwd is a PATH_RETURNING channel: the server's /work comes back in client form.
    await expect.poll(() => page.evaluate(async (id) => (window as AnyApi).electronAPI.pty.getCwd(id), TERM_REMOTE), { timeout: 30_000 }).toBe(c.clientWork)
    const ptyArgs = (await stubCalls(inst!, 'pty:create')).filter(call => (call.args[0] as AnyApi)?.id === TERM_REMOTE)
    log(`U4: pty:create from the renderer (client form) cwd=${JSON.stringify((ptyArgs[0]?.args[0] as AnyApi)?.cwd)}; pty:get-cwd round trip → ${c.clientWork} (shell pwd below shows the server side)`)
    const term = await ptyAnswers(page, TERM_REMOTE, 'echo "T0514-U4-$(uname -n)-$(pwd)-$((500+14))"', `T0514-U4-${c.hostname}-${c.serverWork}-514`)
    expect(term).toContain(`T0514-U4-${c.hostname}-${c.serverWork}-514`)
    log(`U4: remote terminal answered T0514-U4-${c.hostname}-${c.serverWork}-514`)

    const w = c.clientWork
    const calls: Record<string, { ok: boolean; value?: AnyApi; error?: string }> = {
      'claude.scanSkills': await settle(page, 'claude.scanSkills', [w]),
      'claude.listSessions': await settle(page, 'claude.listSessions', [w]),
      'github.listPRs': await settle(page, 'github.listPRs', [w]),
      'github.listIssues': await settle(page, 'github.listIssues', [w]),
      'gitScaffold.healthCheck': await settle(page, 'gitScaffold.healthCheck', [w]),
      'gitScaffold.getRepoInfo': await settle(page, 'gitScaffold.getRepoInfo', [w]),
      'gitScaffold.listCommits': await settle(page, 'gitScaffold.listCommits', [w, { limit: 5 }]),
      'git.getLog': await settle(page, 'git.getLog', [w, 5]),
      'fs.readdir': await settle(page, 'fs.readdir', [w]),
    }
    for (const [k, v] of Object.entries(calls)) log(`U4: ${k}(${w}) → ${JSON.stringify(v).slice(0, 400)}`)
    expect(calls['claude.scanSkills'].value).toEqual(expect.arrayContaining([expect.objectContaining({ name: 't0514-remote-skill', scope: 'project' })]))
    expect(calls['github.listPRs'].value?.[0]?.title).toBe(`T0514-GH pwd=${c.serverWork}`)
    expect(calls['github.listIssues'].value?.[0]?.title).toBe(`T0514-GH pwd=${c.serverWork}`)
    expect(calls['gitScaffold.healthCheck'].value).toMatchObject({ ok: true, isRepo: true, gitRoot: c.clientWork })
    expect(calls['gitScaffold.getRepoInfo'].value?.gitRoot).toBe(c.clientWork)
    expect(calls['gitScaffold.getRepoInfo'].value?.remotes?.[0]?.url).toBe('https://github.com/bat-t0514/fake-repo.git')
    expect(calls['gitScaffold.listCommits'].value?.commits?.[0]?.subject).toBe('T0514-REMOTE-MARKER commit')
    expect(calls['git.getLog'].value?.[0]?.message).toContain('T0514-REMOTE-MARKER')
    expect((calls['fs.readdir'].value as Array<{ name: string }>).map(e => e.name)).toContain('t0514-remote-marker.txt')
    const sessions = (calls['claude.listSessions'].value ?? []) as Array<{ sdkSessionId: string }>
    log(`U4: claude:list-sessions found the container-only seeded session ${c.seedSessionId}: ${sessions.some(s => s.sdkSessionId === c.seedSessionId)}`)
    log(`U4: git-scaffold gitRoot came back as ${JSON.stringify(calls['gitScaffold.healthCheck'].value?.gitRoot)} / ${JSON.stringify(calls['gitScaffold.getRepoInfo'].value?.gitRoot)}`)
    log(`U4: container fake gh log:\n${docker(c, ['exec', c.container, 'cat', '/tmp/t0514-gh.log']).trim()}`)

    // worktree:create(sessionId, cwd) — the cwd is the second argument.
    const sessionId = `t0514-wt-remote-${stamp}`
    const wt = await settle(page, 'worktree.create', [sessionId, w])
    log(`U4: worktree.create(${sessionId}, ${w}) → ${JSON.stringify(wt)}`)
    expect(wt.value?.success).toBe(true)
    const listed = docker(c, ['exec', c.container, 'git', '-C', c.serverWork, 'worktree', 'list']).trim()
    log(`U4: container git worktree list:\n${listed}`)
    expect(listed).toContain(`${c.serverWork}/.bat-worktrees/`)
    const wtRemoved = await settle(page, 'worktree.remove', [sessionId, true])
    log(`U4: worktree.remove → ${JSON.stringify(wtRemoved)}; container list after:\n${docker(c, ['exec', c.container, 'git', '-C', c.serverWork, 'worktree', 'list']).trim()}`)
    expect(fs.existsSync('C:\\bat-t0514-virt')).toBe(false)

    // Contrast: the same client path in the local window has nothing behind it.
    const localSkills = await settle(inst!.win, 'claude.scanSkills', [w])
    const localLog = await settle(inst!.win, 'git.getLog', [w, 5])
    log(`U4: contrast — local window claude.scanSkills(${w}) → ${JSON.stringify(localSkills).slice(0, 200)}; git.getLog → ${JSON.stringify(localLog).slice(0, 200)}`)
    expect(((localSkills.value ?? []) as Array<{ name: string }>).some(s => s.name === 't0514-remote-skill')).toBe(false)
    log(`U4: screenshot ${await shot(page, 'u4-remote-window')}`)
    log('U4: PASS (claude:start-session cwd: not exercised end to end — recorder only, see report)')
  })

  test('U8 / U7 / U9 remote window: attachments are read on the client; /snippet prompt has no path', async () => {
    const c = cfg!
    const page = remotePage
    // Switch the remote window to its Claude tab.
    await page.locator('.terminal-thumbnail, .thumbnail-item, [data-terminal-id]', { hasText: 'T0514 Claude (remote)' }).first().click({ timeout: 5_000 }).catch(() => { /* fall back below */ })
    if (!(await page.locator('.claude-agent-panel').isVisible().catch(() => false))) {
      await page.getByText('T0514 Claude (remote)').first().click()
    }
    await expect(page.locator('.claude-agent-panel')).toBeVisible({ timeout: 30_000 })
    const remoteStarts = (await stubCalls(inst!, 'claude:start-session')).filter(call => call.args[0] === TERM_CLAUDE_REMOTE)
    log(`U8: remote Claude panel mounted; claude:start-session (recorder, client form) cwd=${JSON.stringify((remoteStarts[0]?.args[1] as AnyApi)?.cwd)}`)
    const imgReads = (await stubCalls(inst!, 'image:read-as-data-url')).length

    const dropped = await dropOnClaudePanel(page, [pngPath, txtPath])
    log(`U7 remote: getPathForFile → ${JSON.stringify(dropped.paths)}`)
    expect(dropped.paths).toEqual([pngPath, txtPath])
    await expect.poll(async () => (await attachmentState(page)).images.length, { timeout: 10_000 }).toBe(1)
    const st = await attachmentState(page)
    log(`U8 remote: after drop — image thumb ${st.images[0]?.slice(0, 40)}…; file chips ${JSON.stringify(st.files)}`)
    expect(st.images[0]).toBe(`data:image/png;base64,${PNG_BASE64}`)
    const selected = await settle<{ files: string[]; images: Array<{ path: string; dataUrl: string }> }>(page, 'dialog.selectAttachments', [])
    log(`U8 remote: dialog.selectAttachments → images ${JSON.stringify(selected.value?.images.map(i => ({ path: i.path, dataUrl: i.dataUrl.slice(0, 40) + '…' })))}`)
    expect(selected.value?.images).toEqual([{ path: pngPath, dataUrl: `data:image/png;base64,${PNG_BASE64}` }])
    expect(await imageReadsSince(imgReads)).toBe(0)
    // The file only exists on Windows: the proxied preview channel (server side) cannot read it.
    const viaServer = await settle(page, 'image.readAsDataUrl', [pngPath])
    const onServer = docker(c, ['exec', c.container, 'sh', '-c', `ls -la /tmp/bat-t0514-outside-${stamp} 2>&1 || true`]).trim()
    log(`U8 remote: contrast — image:read-as-data-url (proxied to the container) → ${JSON.stringify({ ok: viaServer.ok, error: viaServer.error?.slice(0, 160) })}; container has the dir? ${JSON.stringify(onServer.slice(0, 120))}`)
    expect(viaServer.ok).toBe(false)
    log(`U8 remote: screenshot ${await shot(page, 'u8-remote-attachments')}`)
    await clearAttachments(page)

    const prompt = await sendSnippetCommand(page, 'remote')
    expectSnippetPrompt(prompt)
    log('U7 / U8 / U9 remote: PASS')
  })

  test('U2 (BUG-112) a workspace detached from the remote window still routes to the container', async () => {
    const c = cfg!
    const owner = inst!
    const detachedPromise = owner.app.waitForEvent('window', { timeout: 30_000 })
    expect(await remotePage.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_REMOTE)).toBe(true)
    const detached = await detachedPromise
    remoteDetached = detached
    await detached.waitForLoadState('domcontentloaded')
    expect(detached.url()).toContain(`detached=${WS_REMOTE}`)
    await expect(detached.locator('.workspace-container.active')).toBeVisible({ timeout: 30_000 })
    await installCapture(detached)
    const text = await bodyText(detached)
    expect(NOT_FOUND_RX.test(text)).toBe(false)
    await expect.poll(async () => (await clientStatus(detached)).connected, { timeout: 30_000 }).toBe(true)
    log(`U2: detached remote workspace window clientStatus=${JSON.stringify(await clientStatus(detached))}`)

    const ptyId = `e2e-t0514-u2-${stamp}`
    const created = await settle(detached, 'pty.create', [{ id: ptyId, cwd: c.clientWork, type: 'terminal' }])
    log(`U2: pty.create({ cwd: ${c.clientWork} }) from the detached window → ${JSON.stringify(created)}`)
    expect(created.ok).toBe(true)
    remotePtys.push(ptyId)
    const out = await ptyAnswers(detached, ptyId, 'echo "T0514-U2-$(uname -n)-$(pwd)-$((200+12))"', `T0514-U2-${c.hostname}-${c.serverWork}-212`)
    expect(out).toContain(`T0514-U2-${c.hostname}-${c.serverWork}-212`)
    const readdir = await settle(detached, 'fs.readdir', [c.clientWork])
    const localCwd = await settle(owner.win, 'pty.getCwd', [ptyId])
    log(`U2: detached PTY answered T0514-U2-${c.hostname}-${c.serverWork}-212; fs.readdir(${c.clientWork}) → ${JSON.stringify((readdir.value as Array<{ name: string }> | undefined)?.map(e => e.name))}; local window pty.getCwd(${ptyId}) → ${JSON.stringify(localCwd.value)}`)
    expect((readdir.value as Array<{ name: string }>).map(e => e.name)).toContain('t0514-remote-marker.txt')
    expect(localCwd.value ?? null).toBeNull()
    log(`U2: screenshot ${await shot(detached, 'u2-remote-detached')}; PASS`)
  })

  test('U3 (BUG-110) container stopped → remote and detached windows refuse proxied calls, nothing runs locally', async () => {
    const c = cfg!
    const owner = inst!
    const pages: Array<[string, Page]> = [['remote window', remotePage]]
    if (remoteDetached && !remoteDetached.isClosed()) pages.push(['detached remote window', remoteDetached])
    log(`U3: docker stop ${c.container} → ${docker(c, ['stop', '-t', '2', c.container]).trim()}`)
    for (const [label, page] of pages) {
      await expect.poll(async () => (await clientStatus(page)).connected, { timeout: 45_000, message: `${label} still reports connected` }).toBe(false)
    }
    log(`U3: both windows report connected=false; main log: ${logLines(owner, /remote:client-status-changed|\[RemoteClient\].*(disconnect|reconnect|closed)/i).slice(-3).join(' | ')}`)

    for (const [label, page] of pages) {
      const ptyId = `e2e-t0514-u3-${label.startsWith('detached') ? 'det' : 'win'}-${stamp}`
      const results: Record<string, { ok: boolean; error?: string; value?: unknown }> = {
        'pty.create': await settle(page, 'pty.create', [{ id: ptyId, cwd: c.clientWork, type: 'terminal' }]),
        'fs.readdir': await settle(page, 'fs.readdir', [c.clientWork]),
        'git.getLog': await settle(page, 'git.getLog', [c.clientWork, 5]),
        'claude.scanSkills': await settle(page, 'claude.scanSkills', [c.clientWork]),
        'gitScaffold.healthCheck': await settle(page, 'gitScaffold.healthCheck', [c.clientWork]),
      }
      for (const [k, v] of Object.entries(results)) {
        log(`U3: ${label} ${k} → ${JSON.stringify({ ok: v.ok, error: v.error?.slice(0, 220), value: v.value })}`)
        expect(v.ok, `${label} ${k} must be refused`).toBe(false)
        expect(v.error).toContain('REMOTE_NOT_CONNECTED')
      }
      const localCwd = await settle(owner.win, 'pty.getCwd', [ptyId])
      log(`U3: ${label}: local window pty.getCwd(${ptyId}) → ${JSON.stringify(localCwd.value)} (no local PTY)`)
      expect(localCwd.value ?? null).toBeNull()
      const refused = await page.evaluate(() => (window as AnyApi).__t0514?.refused ?? [])
      log(`U3: ${label} received remote:invoke-refused ×${refused.length}: ${JSON.stringify(refused.slice(0, 3))}`)
      expect(refused.length).toBeGreaterThan(0)
      log(`U3: ${label} screenshot ${await shot(page, `u3-${label.replace(/\s+/g, '-')}`)}`)
    }
    log('U3: PASS')
  })
})
