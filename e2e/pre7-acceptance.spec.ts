// T0520 — pre.7 installed-build acceptance: BUG-123 remote status light, BUG-124 SSH forwarding
// refused message, BUG-125 / 126 commands / skills descriptions. OPT-IN: skipped unless
// BAT_E2E_PRE7=1, BAT_E2E_EXECUTABLE points at the installed build and the environment from
// `node e2e/real-remote/t0520-env.mjs up` exists. Windows only (WSL Docker + Windows OpenSSH).
//
//   node e2e/real-remote/t0520-env.mjs up
//   $env:BAT_E2E_PRE7='1'
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   npx playwright test e2e/pre7-acceptance.spec.ts
//   node e2e/real-remote/t0520-env.mjs down
//
// Every launch is an isolated instance (fixtures/electron-isolation: own --runtime / userData,
// RemoteServer on a free port). Targets are the env script's containers only:
//   bat-t0520-srv   stock pre.7 headless bat-server (installed baseline tarball, no overlay); its
//                   `profile:list` is the empty stub that triggered BUG-123. /work and /home/bat hold
//                   the e2e/fixtures/t0520-skill-fixtures.json files.
//   bat-t0520-sshd  clean sshd target for the SSH wizard (alias bat-t0520-direct, marked block in the
//                   real ~/.ssh/config, restored hash-checked in afterAll).
//
// UI lane (one instance, serial):
//   V4 / V5 local   claude:scan-skills / scan-star-commands on a temp fixture project, and the Claude
//                   panel's `/` and `*` menus (the real ~/.claude is only read)
//   V6 remote       the same from a docker-linux remote window → the pre.7 bundle's code in the container
//   V1              profiles dialog: connected 🟢, idle release ⚪ without reopening the dialog,
//                   closed port 🔴 + reason, SSH never opened ⚪
// Wizard lane (one instance per test):
//   V2 zh-TW / en   sshd `AllowTcpForwarding no` → fetch-fingerprint fails with forwardingDenied, then
//                   Cancel → rolled-back, remote empty
//   V3              forwarding allowed → the wizard completes, bundle / listener / fingerprint checked,
//                   no tunnel-status query on the success path, the profile connects
//
// No Claude token is spent: in the UI-lane instance every `claude:*` handler that could spawn the CLI
// or call the API is replaced by a recorder before any Claude panel mounts (T0514's approach); only
// read-only scans and archives stay real. Each check writes a verdict to <evidence>/results.json.

import { test, expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import WebSocket from 'ws'
import {
  E2E_EXECUTABLE,
  REPO_ROOT,
  closeIsolated,
  freePort,
  launchIsolated,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_PRE7 === '1'
const ROOT = path.join(os.tmpdir(), 'bat-t0520')
const CONNECTION = path.join(ROOT, 'env', 'connection.json')
const EVIDENCE_DIR = process.env.BAT_E2E_PRE7_EVIDENCE_DIR || path.join(ROOT, 'evidence')
const RESULTS = path.join(EVIDENCE_DIR, 'results.json')
const ENV_SCRIPT = path.join(REPO_ROOT, 'e2e', 'real-remote', 't0520-env.mjs')
const FIXTURES_FILE = path.join(REPO_ROOT, 'e2e', 'fixtures', 't0520-skill-fixtures.json')
const WINDOWS_OPENSSH_DIR = 'C:\\Windows\\System32\\OpenSSH'
const EXPECTED_VERSION = '0.6.0-pre.7'
const WIZARD_TIMEOUT_MS = 300_000
const SERVER_PORT = 9876
const IDLE_GRACE_MS = 15_000
const SSH_STEP_IDS = ['configure-ssh-host', 'verify-ssh-auth', 'install-server-bundle', 'start-server', 'fetch-fingerprint', 'connect-test', 'write-profile', 'done']

interface Connection {
  distro: string
  baseline: { dir: string; file: string; version: string; sha256: string }
  server: { container: string; hostname: string; host: string; port: number; token: string; fingerprint: string; bundleVersion: string; clientWork: string; serverWork: string }
  ssh: { container: string; sshPort: number; sshUser: string; alias: string }
}

interface Fixtures {
  project: Record<string, string>
  home: Record<string, string>
  expect: { commands: Record<string, string>; skills: Record<string, string>; homeStar: Record<string, string> }
}

function loadConnection(): Connection | null {
  try {
    return JSON.parse(fs.readFileSync(CONNECTION, 'utf8')) as Connection
  } catch {
    return null
  }
}

const conn = loadConnection()
const FX = JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf8')) as Fixtures
test.skip(!ENABLED, 'opt-in: set BAT_E2E_PRE7=1 (T0520)')
test.skip(process.platform !== 'win32', 'Windows host only (WSL Docker + Windows OpenSSH)')
test.skip(ENABLED && !E2E_EXECUTABLE, 'set BAT_E2E_EXECUTABLE to the installed BetterAgentTerminal.exe under test')
test.skip(ENABLED && !conn, `no ${CONNECTION} — run \`node e2e/real-remote/t0520-env.mjs up\` first`)

const log = testLogger('t0520')

const LOCALES: Record<string, AnyApi> = Object.fromEntries(['en', 'zh-TW', 'zh-CN'].map(lang =>
  [lang, JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${lang}.json`), 'utf8'))]))
const anyLang = (pick: (l: AnyApi) => string) => Object.values(LOCALES).map(pick)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const oneOf = (values: string[]) => new RegExp(`^(${[...new Set(values)].map(escape).join('|')})$`)
const COMPLETE = anyLang(l => l.wizard.progress.complete)
const ADD_MORE = oneOf(anyLang(l => l.profiles.addMore))

// ── verdicts ─────────────────────────────────────────────────────────────────

type Verdict = 'PASS' | 'FAIL' | 'NEEDS-HUMAN'
interface Result { verdict: Verdict; evidence: string[]; at: string }

function readResults(): Record<string, Result> {
  try {
    return JSON.parse(fs.readFileSync(RESULTS, 'utf8')) as Record<string, Result>
  } catch {
    return {}
  }
}

/** Records one check (`V<n>` or `V<n>.<part>`); returns whether it did not fail. */
function record(key: string, pass: boolean | 'needs-human', evidence: string[]): boolean {
  const verdict: Verdict = pass === 'needs-human' ? 'NEEDS-HUMAN' : pass ? 'PASS' : 'FAIL'
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const all = readResults()
  all[key] = { verdict, evidence, at: new Date().toISOString() }
  fs.writeFileSync(RESULTS, JSON.stringify(all, null, 2))
  log(`${key}: ${verdict} — ${evidence.join(' | ').replace(/\s+/g, ' ').slice(0, 1500)}`)
  return verdict !== 'FAIL'
}

// ── helpers ──────────────────────────────────────────────────────────────────

function envScript(command: string, timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [ENV_SCRIPT, command], { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = `${stdout}${stderr}`.trim()
      if (err) reject(new Error(`${command} failed: ${out}`))
      else resolve(out)
    })
  })
}

function dockerExec(container: string, script: string, user?: string): Promise<string> {
  if (!container.startsWith('bat-t0520-')) throw new Error(`not a T0520 container: ${container}`)
  const args = ['-d', conn!.distro, '--exec', 'docker', 'exec', ...(user ? ['-u', user] : []), container, 'sh', '-c', script]
  return run('wsl.exe', args, 60_000).catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file })
  log(`screenshot ${file}`)
  return file
}

function writeTree(dir: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, ...rel.split('/'))
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.from(content, 'utf8'))
  }
}

/** Settles a renderer promise as { ok, value } / { ok: false, error } without throwing across evaluate. */
async function settle<T = AnyApi>(page: Page, fn: string, args: unknown[]): Promise<{ ok: boolean; value?: T; error?: string }> {
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

/** One invoke over a fresh bat-server connection (TLS not verified: test-owned server). */
async function wsInvoke(port: number, token: string, channel: string, args: unknown[]): Promise<{ type: string; result?: unknown; error?: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://127.0.0.1:${port}`, { rejectUnauthorized: false })
    const timer = setTimeout(() => { ws.terminate(); reject(new Error(`wsInvoke ${channel} timed out`)) }, 15_000)
    const done = (v: { type: string; result?: unknown; error?: string }) => { clearTimeout(timer); ws.close(); resolve(v) }
    ws.on('error', (err) => { clearTimeout(timer); reject(err) })
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', id: 't0520-auth', token, args: ['t0520-probe'] })))
    ws.on('message', (raw) => {
      let frame: { type?: string; id?: string; result?: unknown; error?: string }
      try { frame = JSON.parse(String(raw)) } catch { return }
      if (frame.id === 't0520-auth' || frame.type === 'auth-result') {
        if (frame.type !== 'auth-result' || frame.error || frame.result === false) {
          done({ type: 'auth-failed', error: frame.error ?? JSON.stringify(frame) })
          return
        }
        ws.send(JSON.stringify({ type: 'invoke', id: 't0520-invoke', channel, args }))
        return
      }
      if (frame.id === 't0520-invoke') done({ type: frame.type ?? '?', result: frame.result, error: frame.error })
    })
  })
}

function pageForWindowId(inst: IsolatedInstance, windowId: string): Page | undefined {
  const needle = `windowId=${encodeURIComponent(windowId)}`
  return inst.app.windows().find(p => p.url().includes(needle))
}

async function openProfileWindow(inst: IsolatedInstance, profileId: string, tag: string): Promise<{ page: Page; windowId: string }> {
  const opened = await inst.win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profileId)
  log(`${tag}: openNewInstance(${profileId}) → ${JSON.stringify(opened)}`)
  expect(opened.error, `${tag}: openNewInstance`).toBeUndefined()
  const windowId = opened.windowIds[0] as string
  let page: Page | undefined
  await expect.poll(() => (page = pageForWindowId(inst, windowId)) !== undefined, { timeout: 30_000, message: `${tag}: window` }).toBe(true)
  await page!.waitForLoadState('domcontentloaded')
  await expect.poll(async () => (await page!.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())).connected,
    { timeout: 60_000, message: `${tag}: connected` }).toBe(true)
  return { page: page!, windowId }
}

async function openProfiles(win: Page): Promise<void> {
  if (await win.locator('.profile-card').count() > 0) return
  await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
  await expect(win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
}

function card(win: Page, profileId: string): Locator {
  return win.locator(`[data-testid="profile-card"][data-profile-id="${profileId}"]`)
}

function light(win: Page, profileId: string): Locator {
  return card(win, profileId).locator('[data-testid="profile-card-status"]')
}

/** Seeds one workspace with an integrated Claude tab at `cwd`, reloads, waits for the panel. */
async function openClaudePanel(page: Page, ws: string, term: string, cwd: string, label: string): Promise<void> {
  const seed = {
    workspaces: [{ id: ws, name: `T0520-${label}`, folderPath: cwd, createdAt: Date.now() }],
    activeWorkspaceId: ws,
    activeGroup: null,
    terminals: [{ id: term, workspaceId: ws, type: 'terminal', agentPreset: 'claude-code', title: `T0520 Claude (${label})`, cwd }],
    activeTerminalId: term,
  }
  expect(await page.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('.claude-agent-panel')).toBeVisible({ timeout: 45_000 })
}

/** Types `input` into the Claude panel and returns the open menu's rows (never sends anything). */
async function menuRows(page: Page, input: string, wanted: string[]): Promise<Array<{ name: string; desc: string }>> {
  const star = input.startsWith('*')
  const textarea = page.locator('.claude-agent-panel textarea').first()
  const menu = page.locator(star ? '.claude-slash-menu.claude-star-menu' : '.claude-slash-menu:not(.claude-star-menu)')
  const read = async () => menu.locator('.claude-slash-item').evaluateAll(els => els.map(e => ({
    name: (e.querySelector('.claude-slash-name') as HTMLElement | null)?.innerText?.trim() ?? '',
    desc: (e.querySelector('.claude-slash-desc') as HTMLElement | null)?.innerText?.trim() ?? '',
  })))
  let rows: Array<{ name: string; desc: string }> = []
  for (let attempt = 0; attempt < 20; attempt++) {
    await textarea.click()
    await textarea.fill('')
    await textarea.pressSequentially(input, { delay: 20 })
    await menu.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => { /* scans may still be loading */ })
    rows = await read().catch(() => [])
    if (wanted.every(w => rows.some(r => r.name === w))) return rows
    await page.waitForTimeout(500)
  }
  return rows
}

async function clearInput(page: Page): Promise<void> {
  await page.locator('.claude-agent-panel textarea').first().fill('')
}

/** Recorders in an isolated main process (test-side only, no product change). */
async function installRecorders(inst: IsolatedInstance, opts: { stubClaude: boolean }): Promise<AnyApi> {
  return inst.app.evaluate(({ ipcMain, dialog }, { stubClaude }) => {
    const g = globalThis as AnyApi
    g.__t0520 = { calls: [] as unknown[], messageBoxes: [] as unknown[], tunnelStatus: [] as unknown[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dialog as any).showMessageBox = async (...a: any[]) => {
      const o = a.length > 1 ? a[1] : a[0]
      g.__t0520.messageBoxes.push({ title: o?.title ?? '', message: o?.message ?? '', detail: o?.detail ?? '' })
      return { response: 0, checkboxChecked: false }
    }
    const handlers = (ipcMain as AnyApi)._invokeHandlers as Map<string, (...a: unknown[]) => unknown>
    if (!handlers || typeof handlers.get !== 'function') return { error: 'ipcMain._invokeHandlers unavailable' }
    const stubbed: string[] = []
    if (stubClaude) {
      // Read-only scans and archives stay real; everything else under claude:* is answered here.
      const real = ['claude:scan-skills', 'claude:list-sessions', 'claude:scan-star-commands', 'claude:archive-messages', 'claude:load-archived', 'claude:clear-archive']
      const defaults: Record<string, unknown> = {
        'claude:start-session': true, 'claude:resume-session': true, 'claude:send-message': true,
        'claude:get-supported-models': [], 'claude:get-supported-commands': [], 'claude:get-supported-agents': [],
        'claude:auth-status': { loggedIn: true, email: 't0520-stub@example.invalid', authMethod: 'stub', subscriptionType: 'stub' }, 'claude:get-statusline-extras': {},
      }
      for (const channel of [...handlers.keys()]) {
        if (!channel.startsWith('claude:') || real.includes(channel)) continue
        ipcMain.removeHandler(channel)
        ipcMain.handle(channel, async (_event, ...args) => { g.__t0520.calls.push({ channel, args, at: Date.now() }); return defaults[channel] ?? null })
        stubbed.push(channel)
      }
    }
    // Pass-through: every ssh:verify-tunnel-status query (T0517) and its answer.
    const original = handlers.get('ssh:verify-tunnel-status')
    if (original) {
      ipcMain.removeHandler('ssh:verify-tunnel-status')
      ipcMain.handle('ssh:verify-tunnel-status', async (event, ...args) => {
        const result = await original(event, ...args)
        g.__t0520.tunnelStatus.push({ args, result, at: Date.now() })
        return result
      })
    }
    return { stubbed, tunnelStatusWrapped: Boolean(original) }
  }, opts)
}

async function tunnelStatusCalls(inst: IsolatedInstance): Promise<Array<{ args: unknown[]; result: { forwardingDenied: boolean; detail?: string } }>> {
  return inst.app.evaluate(() => (globalThis as AnyApi).__t0520.tunnelStatus)
}

function keepInstanceLog(inst: IsolatedInstance, tag: string): void {
  const dir = path.join(inst.userData, 'Logs')
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (f.startsWith('debug-')) fs.copyFileSync(path.join(dir, f), path.join(EVIDENCE_DIR, `instance-${tag}-${f}`))
  }
}

/** `description:` of a local SKILL.md's frontmatter (read-only; null when absent). */
function frontmatterDescription(file: string): string | null {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    if (lines[0]?.trim() !== '---') return null
    for (let i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
      const m = lines[i].match(/^description:\s*"?(.+?)"?\s*$/)
      if (m) return m[1]
    }
    return null
  } catch {
    return null
  }
}

/** Compares scan results with the fixture expectations; returns [allOk, evidence lines]. */
function compareScan(results: Array<{ name: string; description: string; scope?: string }>, expected: Record<string, string>, scope?: string): [boolean, string[]] {
  const lines: string[] = []
  let ok = true
  for (const [name, want] of Object.entries(expected)) {
    const hit = results.find(r => r.name === name)
    const good = hit !== undefined && hit.description === want && (scope === undefined || hit.scope === scope)
    ok &&= good
    lines.push(`${good ? '✓' : '✗'} ${name}: ${hit ? JSON.stringify(hit.description) : '(missing)'}${hit?.scope ? ` [${hit.scope}]` : ''} — expected ${JSON.stringify(want)}`)
  }
  return [ok, lines]
}

function compareMenu(rows: Array<{ name: string; desc: string }>, expected: Record<string, string>, sigil: '/' | '*'): [boolean, string[]] {
  const lines: string[] = []
  let ok = true
  for (const [name, want] of Object.entries(expected)) {
    const hit = rows.find(r => r.name === `${sigil}${name}`)
    const good = hit !== undefined && hit.desc === want && hit.desc !== '---'
    ok &&= good
    lines.push(`${good ? '✓' : '✗'} ${sigil}${name}: ${hit ? JSON.stringify(hit.desc) : '(not in menu)'} — expected ${JSON.stringify(want)}`)
  }
  return [ok, lines]
}

// ── whole run: version evidence ──────────────────────────────────────────────

test.beforeAll(async () => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const fileVersion = (await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(Get-Item '${E2E_EXECUTABLE.replace(/'/g, "''")}').VersionInfo.FileVersion`], 20_000).catch(() => '?')).trim()
  const manifestPath = path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'bat-server-baseline', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { version?: string; tarballs?: Record<string, { filename: string; sha256: string }> }
  record('ENV.version', fileVersion === EXPECTED_VERSION && manifest.version === EXPECTED_VERSION
    && conn!.baseline.version === EXPECTED_VERSION && conn!.server.bundleVersion === EXPECTED_VERSION, [
    `executable ${E2E_EXECUTABLE} FileVersion ${fileVersion}`,
    `baseline ${manifestPath} version ${manifest.version}; linux-x64 ${manifest.tarballs?.['linux-x64']?.filename} sha256 ${manifest.tarballs?.['linux-x64']?.sha256}`,
    `container ${conn!.server.container} bundle package.json version ${conn!.server.bundleVersion} (built from ${path.basename(conn!.baseline.file)}, sha256 verified by the env script)`,
  ])
})

// ── UI lane: V4 / V5 local, V6 remote, V1 status light ───────────────────────

test.describe('T0520 UI lane (V4 / V5 / V6 / V1)', () => {
  test.describe.configure({ mode: 'serial' })

  const stamp = Date.now()
  const fixtureDir = path.join(os.tmpdir(), `bat-t0520-fixture-${stamp}`)
  const WS_LOCAL = `e2e-t0520-ws-local-${stamp}`
  const WS_REMOTE = `e2e-t0520-ws-remote-${stamp}`
  const TERM_LOCAL = `e2e-t0520-claude-local-${stamp}`
  const TERM_REMOTE = `e2e-t0520-claude-remote-${stamp}`
  let inst: IsolatedInstance | undefined

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    writeTree(fixtureDir, FX.project)
    inst = await launchIsolated('t0520-ui', log)
    log(`UI instance app.getVersion() = ${await inst.app.evaluate(({ app }) => app.getVersion())}`)
    const rec = await installRecorders(inst, { stubClaude: true })
    log(`recorders: ${JSON.stringify(rec)}`)
    expect(rec.error).toBeUndefined()
    expect(rec.stubbed).toEqual(expect.arrayContaining(['claude:start-session', 'claude:send-message', 'claude:resume-session']))
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    if (inst) {
      const calls = await inst.app.evaluate(() => ((globalThis as AnyApi).__t0520?.calls as Array<{ channel: string }> ?? []).map(c => c.channel)).catch(() => [])
      log(`claude:* calls answered by the recorder (never reached the CLI / API): ${JSON.stringify(calls)}`)
      keepInstanceLog(inst, 'ui')
      await closeIsolated(inst, log)
    }
    for (let i = 0; i < 5; i++) {
      try { fs.rmSync(fixtureDir, { recursive: true, force: true }); break } catch { await new Promise(r => setTimeout(r, 500)) }
    }
    log(`fixture ${fixtureDir} removed: ${!fs.existsSync(fixtureDir)}`)
  })

  test('V4 / V5 local: scan-skills, scan-star-commands and the Claude panel menus', async () => {
    test.setTimeout(180_000)
    const { win } = inst!
    await expect(win.locator('.sidebar-footer-buttons .settings-btn').first()).toBeVisible({ timeout: 30_000 })
    const scan = await settle<Array<{ name: string; description: string; scope: 'project' | 'global' }>>(win, 'claude.scanSkills', [fixtureDir])
    expect(scan.ok, scan.error).toBe(true)
    const results = scan.value ?? []
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'v4-v5-local-scan-skills.json'), JSON.stringify(results.filter(r => r.name.startsWith('t0520-')), null, 2))
    const dashes = results.filter(r => r.description.trim() === '---')
    const [cmdOk, cmdLines] = compareScan(results, FX.expect.commands, 'project')
    const [skillOk, skillLines] = compareScan(results, FX.expect.skills, 'project')
    log(`local scan-skills: ${results.length} entries (${results.filter(r => r.scope === 'global').length} global from the real ~/.claude, read-only); "---" descriptions anywhere: ${dashes.map(d => d.name).join(', ') || 'none'}`)

    const star = await settle<Array<{ name: string; description: string; prefix: string }>>(win, 'claude.scanStarCommands', [])
    const help = (star.value ?? []).find(s => s.name === 'help' && s.prefix === 'ct')
    const userHelp = path.join(os.homedir(), '.claude', 'skills', 'ct-help', 'SKILL.md')
    const userHelpDesc = fs.existsSync(userHelp) ? frontmatterDescription(userHelp) : null
    log(`local scan-star-commands: ${JSON.stringify((star.value ?? []).map(s => `${s.prefix}-${s.name}`))}; user ct-help ${fs.existsSync(userHelp) ? `exists (frontmatter description ${userHelpDesc === null ? 'absent' : 'present'})` : 'absent'}`)

    await openClaudePanel(win, WS_LOCAL, TERM_LOCAL, fixtureDir, 'local')
    const wanted = [...Object.keys(FX.expect.commands), ...Object.keys(FX.expect.skills)]
    const slashRows = await menuRows(win, '/t0520', wanted.map(n => `/${n}`))
    await shot(win, 'v4-v5-local-slash-menu')
    const [menuCmdOk, menuCmdLines] = compareMenu(slashRows, FX.expect.commands, '/')
    const [menuSkillOk, menuSkillLines] = compareMenu(slashRows, FX.expect.skills, '/')
    const starRows = await menuRows(win, '*help', ['*help'])
    await shot(win, 'v5-local-star-menu')
    await clearInput(win)
    const helpRow = starRows.find(r => r.name === '*help')

    record('V4.local', cmdOk && menuCmdOk && dashes.length === 0 && slashRows.every(r => r.desc !== '---'), [
      `claude:scan-skills(${fixtureDir}):`, ...cmdLines, `Claude panel "/" menu:`, ...menuCmdLines,
      `"---" descriptions: scan ${dashes.length}, menu ${slashRows.filter(r => r.desc === '---').length}`])
    record('V5.local', skillOk && menuSkillOk, [`claude:scan-skills(${fixtureDir}):`, ...skillLines, `Claude panel "/" menu:`, ...menuSkillLines])
    // The user's ~/.claude is only read; when ct-help is there it is the subject, otherwise the
    // remote lane's fixture ct-help (V6) covers the fallback.
    record('V5.star-local', userHelpDesc !== null || fs.existsSync(userHelp)
      ? help !== undefined && help.description !== '' && help.description !== '---' && (userHelpDesc === null || help.description === userHelpDesc) && helpRow?.desc === help.description
      : 'needs-human', [
      `user ~/.claude/skills/ct-help/SKILL.md: ${fs.existsSync(userHelp) ? 'present (read only)' : 'absent — fallback covered by V6 remote fixture'}`,
      `scan-star-commands ct help: ${JSON.stringify(help?.description ?? null)}`,
      `frontmatter description: ${JSON.stringify(userHelpDesc)}`,
      `Claude panel "*" menu row: ${JSON.stringify(helpRow ?? null)}`,
    ])
  })

  test('V6 remote window + V1 profiles dialog status lights (headless bat-server, empty profile:list)', async () => {
    test.setTimeout(300_000)
    const c = conn!.server
    const owner = inst!
    const { app, win } = owner

    // The BUG-123 trigger: the headless server's profile:list stub.
    const stub = await wsInvoke(c.port, c.token, 'profile:list', [])
    log(`V1: ${c.container} (pre.7 headless) profile:list → ${JSON.stringify(stub)}`)

    const closedPort = await freePort()
    const ids = await win.evaluate(async ({ c, closedPort }) => {
      const api = (window as AnyApi).electronAPI
      const make = async (name: string, opts: Record<string, unknown>, update: Record<string, unknown>) => {
        const created = await api.profile.create(name, { type: 'remote', remoteHost: '127.0.0.1', ...opts })
        await api.profile.update(created.id, update)
        return created.id as string
      }
      const own = { remotePort: c.port, remoteToken: c.token, remoteFingerprint: c.fingerprint }
      const docker = { targetOS: 'docker-linux', dockerContainer: c.container, dockerMounts: [{ host: c.clientWork, container: c.serverWork }] }
      return {
        connected: await make('T0520 headless (window)', own, docker),
        idle: await make('T0520 headless (no window)', own, docker),
        // no wslDistro: the WSL keep-alive skips it, no wsl.exe is spawned for it
        unreachable: await make('T0520 WSL (port closed)', { remotePort: closedPort, remoteToken: 'x', remoteFingerprint: 'AA:BB' }, { targetOS: 'wsl-linux' }),
        ssh: await make('T0520 SSH (never opened)', { remotePort: 9, remoteToken: 'x', remoteFingerprint: 'CC:DD' }, { targetOS: 'ssh-linux', sshHost: 'bat-t0520-never-opened', sshUser: '' }),
      }
    }, { c, closedPort })
    log(`V1: profiles ${JSON.stringify(ids)} (closed port ${closedPort})`)

    const { page: remote, windowId } = await openProfileWindow(owner, ids.connected, 'V1/V6')
    const status = await remote.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())
    log(`V6: remote window ${windowId} clientStatus=${JSON.stringify(status)}`)

    // ── V6: the same scans from the remote window run the container's pre.7 bundle ──
    const rScan = await settle<Array<{ name: string; description: string; scope: string }>>(remote, 'claude.scanSkills', [c.clientWork])
    const rResults = rScan.value ?? []
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'v6-remote-scan-skills.json'), JSON.stringify(rResults, null, 2))
    const [rCmdOk, rCmdLines] = compareScan(rResults, FX.expect.commands, 'project')
    const [rSkillOk, rSkillLines] = compareScan(rResults, FX.expect.skills, 'project')
    const rStar = await settle<Array<{ name: string; description: string; prefix: string }>>(remote, 'claude.scanStarCommands', [])
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'v6-remote-scan-star-commands.json'), JSON.stringify(rStar.value ?? rStar.error, null, 2))
    const [rStarOk, rStarLines] = compareScan(rStar.value ?? [], FX.expect.homeStar)
    const localContrast = await settle<Array<{ name: string }>>(win, 'claude.scanSkills', [c.clientWork])
    const windowsHasPath = fs.existsSync('C:\\bat-t0520-virt')
    const containerFiles = (await dockerExec(c.container, 'cd /work && find .claude -type f | sort; ls /home/bat/.claude/skills')).trim()
    log(`V6: container fixture files:\n${containerFiles}`)

    await openClaudePanel(remote, WS_REMOTE, TERM_REMOTE, c.clientWork, 'remote')
    await expect.poll(async () => (await remote.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())).connected, { timeout: 30_000 }).toBe(true)
    const wanted = [...Object.keys(FX.expect.commands), ...Object.keys(FX.expect.skills)]
    const rSlash = await menuRows(remote, '/t0520', wanted.map(n => `/${n}`))
    await shot(remote, 'v6-remote-slash-menu')
    const [rMenuCmdOk, rMenuCmdLines] = compareMenu(rSlash, FX.expect.commands, '/')
    const [rMenuSkillOk, rMenuSkillLines] = compareMenu(rSlash, FX.expect.skills, '/')
    const rStarRows = await menuRows(remote, '*', Object.keys(FX.expect.homeStar).map(n => `*${n}`))
    await shot(remote, 'v6-remote-star-menu')
    await clearInput(remote)
    const [rMenuStarOk, rMenuStarLines] = compareMenu(rStarRows, FX.expect.homeStar, '*')
    const v6Common = [`bundle in ${c.container}: ${c.bundleVersion}`, `C:\\bat-t0520-virt exists on Windows: ${windowsHasPath}`,
      `contrast — local window scanSkills(${c.clientWork}) t0520 entries: ${(localContrast.value ?? []).filter(r => r.name.startsWith('t0520-')).length}`]
    const remoteRouted = !windowsHasPath && (localContrast.value ?? []).every(r => !r.name.startsWith('t0520-'))
    record('V6.V4-remote', rScan.ok && rCmdOk && rMenuCmdOk && remoteRouted && rResults.every(r => r.description.trim() !== '---'), [
      ...v6Common, `scan-skills(${c.clientWork}) via remote:`, ...rCmdLines, 'remote Claude panel "/" menu:', ...rMenuCmdLines])
    record('V6.V5-remote', rScan.ok && rSkillOk && rStarOk && rMenuSkillOk && rMenuStarOk && remoteRouted, [
      ...v6Common, `scan-skills(${c.clientWork}) via remote:`, ...rSkillLines,
      'scan-star-commands via remote (container /home/bat/.claude/skills, ct-help without description):', ...rStarLines,
      'remote Claude panel "/" menu:', ...rMenuSkillLines, 'remote Claude panel "*" menu:', ...rMenuStarLines])

    // ── V1: profiles dialog in the main window ──
    await win.bringToFront()
    await openProfiles(win)
    await expect(card(win, ids.connected)).toBeVisible({ timeout: 15_000 })
    await expect(light(win, ids.connected)).toHaveAttribute('data-status', 'connected', { timeout: 20_000 }).catch(() => { /* recorded below */ })
    await expect(light(win, ids.unreachable)).toHaveAttribute('data-status', 'disconnected', { timeout: 20_000 }).catch(() => { /* recorded below */ })
    await expect(light(win, ids.idle)).toHaveAttribute('data-status', 'idle', { timeout: 20_000 }).catch(() => { /* recorded below */ })
    const snap = async (id: string) => ({ status: await light(win, id).getAttribute('data-status'), title: await light(win, id).getAttribute('title'), cls: await light(win, id).getAttribute('class') })
    const s = { connected: await snap(ids.connected), idle: await snap(ids.idle), unreachable: await snap(ids.unreachable), ssh: await snap(ids.ssh) }
    log(`V1: lights ${JSON.stringify(s)}`)
    await win.locator('.profile-list').scrollIntoViewIfNeeded().catch(() => { /* layout */ })
    await shot(win, 'v1-dialog-window-open')
    await light(win, ids.unreachable).hover()
    await shot(win, 'v1-unreachable-tooltip')
    const stubEmpty = stub.type === 'invoke-result' && JSON.stringify(stub.result) === JSON.stringify({ profiles: [], activeProfileIds: [] })
    record('V1.a-connected', stubEmpty && s.connected.status === 'connected' && /已連線|已连接|Connected/.test(s.connected.title ?? ''), [
      `headless profile:list → ${JSON.stringify(stub.result ?? stub.error)}`, `window ${windowId} open + connected; card ${JSON.stringify(s.connected)}`])
    record('V1.c-unreachable', s.unreachable.status === 'disconnected' && /^(連線失敗|连接失败|Connection failed)/.test(s.unreachable.title ?? '') && /ECONNREFUSED|\(/.test(s.unreachable.title ?? ''), [
      `wsl-linux profile → 127.0.0.1:${closedPort} (closed); card ${JSON.stringify(s.unreachable)}`])
    record('V1.d-ssh-idle', s.ssh.status === 'idle', [`ssh-linux profile never opened; card ${JSON.stringify(s.ssh)}`])
    record('V1.idle-reachable', s.idle.status === 'idle' && /伺服器可連線|服务器可连接|server reachable/.test(s.idle.title ?? ''), [
      `second profile → the same headless server, no window (probed through profile:list stub); card ${JSON.stringify(s.idle)}`])

    // (b) close the connected profile's window; the dialog stays open and is never reopened.
    await app.evaluate(({ BrowserWindow }, id) => {
      const w = BrowserWindow.getAllWindows().find(b => b.webContents.getURL().includes(`windowId=${encodeURIComponent(id)}`))
      w?.close()
    }, windowId)
    const closedAt = Date.now()
    const seen: Array<{ ms: number; status: string | null }> = []
    let last: string | null = 'connected'
    while (Date.now() - closedAt < IDLE_GRACE_MS + 25_000) {
      const st = await light(win, ids.connected).getAttribute('data-status').catch(() => null)
      if (st !== last) { seen.push({ ms: Date.now() - closedAt, status: st }); last = st }
      if (st === 'idle') break
      await win.waitForTimeout(250)
    }
    const after = await snap(ids.connected)
    log(`V1(b): transitions after closing the window ${JSON.stringify(seen)}; final ${JSON.stringify(after)}`)
    await shot(win, 'v1-dialog-after-idle-release')
    const toIdle = seen.find(x => x.status === 'idle')
    record('V1.b-idle-after-release', after.status === 'idle' && toIdle !== undefined && toIdle.ms >= IDLE_GRACE_MS - 1_000
      && seen.every(x => x.status !== 'disconnected'), [
      `window closed, dialog left open; transitions ${JSON.stringify(seen)} (IDLE_GRACE_MS ${IDLE_GRACE_MS})`, `final card ${JSON.stringify(after)}`])
    record('V1.wsl-real', 'needs-human', ['the real WSL Ubuntu-24.04 profile of the user\'s BAT is never touched: open its window in pre.7, then the profiles dialog → that card should be 🟢'])
  })
})

// ── Wizard lane: V2 (zh-TW / en), V3 ─────────────────────────────────────────

const userSystemctl = (user: string) => `su - ${user} -c "XDG_RUNTIME_DIR=/run/user/$(id -u ${user}) systemctl --user`

async function installEvidence(container: string, user: string): Promise<string> {
  const home = `/home/${user}`
  return dockerExec(container, [
    `echo "## ls ${home}/.local/bat-server"; ls -A ${home}/.local/bat-server 2>&1`,
    `echo "## test -x bin/bat-server"; test -x ${home}/.local/bat-server/bin/bat-server && echo executable || echo missing`,
    `echo "## unit"; cat ${home}/.config/systemd/user/bat-server.service 2>&1`,
    `echo "## is-active"; ${userSystemctl(user)} is-active bat-server" 2>&1`,
    `echo "## MainPID"; ${userSystemctl(user)} show -p MainPID --value bat-server" 2>&1`,
    'echo "## listening"; ss -tlnpH 2>&1',
    `echo "## version"; cat ${home}/.local/bat-server/package.json 2>/dev/null | grep -m1 '"version"'`,
  ].join('; '))
}

function section(evidence: string, name: string): string {
  const parts = evidence.split(/^## /m)
  const hit = parts.find(p => p.startsWith(name))
  return hit ? hit.slice(name.length).replace(/^[^\n]*\n/, '').trim() : ''
}

async function remoteFingerprint(container: string, user: string): Promise<string> {
  // Only the fingerprint field (the file also holds the private key).
  return (await dockerExec(container,
    `sed -n 's/^.*"fingerprint"[[:space:]]*:[[:space:]]*"\\([0-9A-Fa-f:]*\\)".*$/\\1/p' /home/${user}/.local/share/bat-server/server-cert.json 2>&1`)).trim()
}

const normFp = (fp: string | undefined | null) => String(fp ?? '').toUpperCase()

async function remoteCleanState(container: string): Promise<string> {
  return dockerExec(container, [
    `echo "state=$(${userSystemctl('bat')} is-active bat-server" 2>&1)"`,
    'echo "unit=$(ls /home/bat/.config/systemd/user/bat-server.service 2>&1)"',
    'echo "bundle=$(ls -A /home/bat/.local/bat-server 2>&1 | head -2)"',
    `echo "listen9876=$(ss -tlnH | grep -c ':${SERVER_PORT} ')"`,
  ].join('; '))
}

async function setLanguage(win: Page, lang: 'en' | 'zh-TW'): Promise<string> {
  await win.evaluate(async (lang) => {
    const api = (window as AnyApi).electronAPI
    const raw = await api.settings.load()
    const s = raw ? JSON.parse(raw) : {}
    s.language = lang
    await api.settings.save(JSON.stringify(s))
  }, lang)
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await expect(win.locator('.sidebar-footer-buttons .settings-btn').first()).toBeVisible({ timeout: 30_000 })
  await openProfiles(win)
  const addMore = (await win.getByRole('button', { name: ADD_MORE }).innerText()).trim()
  return addMore
}

async function openSshWizard(win: Page): Promise<void> {
  await openProfiles(win)
  await win.getByRole('button', { name: ADD_MORE }).click()
  await win.locator('.thumbnail-add-menu-item', { hasText: 'SSH' }).click()
  await expect(win.locator('.bat-wizard-shell')).toBeVisible({ timeout: 15_000 })
}

async function closeWizard(win: Page): Promise<void> {
  await win.locator('.settings-panel .settings-close').last().click()
  await expect(win.locator('.bat-wizard-shell')).toHaveCount(0, { timeout: 30_000 })
}

type Outcome = { result: 'complete' | 'failed' | 'timeout'; text: string }

async function driveWizard(win: Page, alias: string): Promise<Outcome> {
  const shell = win.locator('.bat-wizard-shell')
  const prompt = win.locator('#bat-wizard-active-prompt')
  const end = Date.now() + WIZARD_TIMEOUT_MS
  while (Date.now() < end) {
    const text = await shell.innerText().catch(() => '')
    if (COMPLETE.some(c => text.includes(c))) return { result: 'complete', text }
    if (await win.locator('.bat-stepper-failed-actions').count() > 0) {
      return { result: 'failed', text: await win.locator('.bat-wizard-detail').innerText().catch(() => text) }
    }
    if (await prompt.isVisible().catch(() => false)) {
      const button = prompt.getByRole('button', { name: alias, exact: true })
      if (await button.count() > 0) {
        log(`wizard: pick alias ${alias}`)
        await button.click()
        await expect(button).toHaveCount(0, { timeout: 15_000 })
      }
    }
    await win.waitForTimeout(500)
  }
  return { result: 'timeout', text: await shell.innerText().catch(() => '') }
}

async function stepStatuses(win: Page): Promise<Record<string, string>> {
  const rows = await win.locator('.bat-wizard-shell .bat-stepper-step').evaluateAll(els => els.map(e => {
    const status = [...e.classList].find(c => c.startsWith('bat-stepper-status-'))?.slice('bat-stepper-status-'.length) ?? '?'
    const label = (e.querySelector('.bat-stepper-label') as HTMLElement | null)?.innerText?.trim() ?? ''
    return { status, label }
  }))
  const first = rows.slice(0, SSH_STEP_IDS.length)
  return Object.fromEntries(SSH_STEP_IDS.map((id, i) => [id, first[i] ? `${first[i].status} (${first[i].label})` : 'missing']))
}

const statusOf = (s: Record<string, string>, id: string) => (s[id] ?? '').split(' ')[0]

function captureWizardLog(win: Page): string[] {
  const lines: string[] = []
  win.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    if (text.includes('[ssh-wizard]') || /rollback/i.test(text)) lines.push(`${msg.type()}: ${text}`)
  })
  return lines
}

async function profiles(win: Page): Promise<Array<{ id: string; name: string; remoteFingerprint?: string; useSshTunnel?: boolean; sshHost?: string }>> {
  return (await win.evaluate(async () => (window as AnyApi).electronAPI.profile.list())).profiles
}

function isolatedSshEnv(): Record<string, string> {
  return { Path: `${WINDOWS_OPENSSH_DIR};${process.env.PATH ?? process.env.Path ?? ''}` }
}

test.describe('T0520 wizard lane (V2 / V3)', () => {
  test.describe.configure({ mode: 'serial' })
  let configApplied = false

  test.beforeAll(async () => {
    test.setTimeout(60_000)
    log(await envScript('apply-ssh-config'))
    configApplied = true
    const g = await run(path.join(WINDOWS_OPENSSH_DIR, 'ssh.exe'), ['-G', conn!.ssh.alias], 15_000)
    log(`ssh -G ${conn!.ssh.alias}: ${g.split(/\r?\n/).filter(l => /^(user|hostname|port) /.test(l)).join(', ')}`)
  })

  test.afterAll(async () => {
    if (configApplied) log(await envScript('restore-ssh-config'))
    configApplied = false
  })

  for (const lang of ['zh-TW', 'en'] as const) {
    test(`V2 (${lang}) sshd AllowTcpForwarding no → forwardingDenied message, Cancel rolls back`, async () => {
      test.setTimeout(WIZARD_TIMEOUT_MS + 180_000)
      const sshd = conn!.ssh.container
      const alias = conn!.ssh.alias
      const noForward = '/etc/ssh/sshd_config.d/00-t0520-noforward.conf'
      log(`V2 ${lang}: ${(await dockerExec(sshd, `printf 'AllowTcpForwarding no\\n' > ${noForward} && systemctl reload ssh && sleep 1 && sshd -T | grep -i allowtcpforwarding`)).trim()}`)
      const leftovers = (await dockerExec(sshd, 'ls -A /home/bat/.local/bat-server /home/bat/.config/systemd/user/bat-server.service 2>/dev/null | head -3; true')).trim()
      const ok: boolean[] = []
      let inst: IsolatedInstance | undefined
      try {
        inst = await launchIsolated(`t0520-v2-${lang.toLowerCase()}`, log, { env: isolatedSshEnv() })
        const { win } = inst
        await installRecorders(inst, { stubClaude: false })
        const wizardLog = captureWizardLog(win)
        const addMore = await setLanguage(win, lang)
        log(`V2 ${lang}: UI language check — "add more" button reads ${JSON.stringify(addMore)} (locale ${lang}: ${JSON.stringify(LOCALES[lang].profiles.addMore)})`)
        const before = new Set((await profiles(win)).map(p => p.id))
        await openSshWizard(win)
        const outcome = await driveWizard(win, alias)
        const failedStatuses = await stepStatuses(win)
        const detail = outcome.text.replace(/\s+/g, ' ')
        log(`V2 ${lang}: wizard ${outcome.result}; steps ${JSON.stringify(failedStatuses)}`)
        fs.writeFileSync(path.join(EVIDENCE_DIR, `v2-${lang}-failure-detail.txt`), outcome.text)
        await shot(win, `v2-${lang}-failed`)
        const beforeCancel = await installEvidence(sshd, 'bat')
        const failedAtVerify = outcome.result === 'failed' && statusOf(failedStatuses, 'fetch-fingerprint') === 'failed'
          && statusOf(failedStatuses, 'start-server') === 'completed'
        const wasInstalled = section(beforeCancel, 'is-active') === 'active' && section(beforeCancel, 'ls ').split(/\s+/).includes('bin')
        const tunnel = await tunnelStatusCalls(inst)

        const L = LOCALES[lang]
        const other = LOCALES[lang === 'en' ? 'zh-TW' : 'en']
        const title = L.wizard.ssh.error.forwardingDenied.title as string
        const oldTitle = L.wizard.shared.error.fingerprintHandshakeFailed.title as string
        const oldBody = L.wizard.shared.error.fingerprintHandshakeFailed.body as string
        const sshLine = /channel \d+: open failed: administratively prohibited[^.]*/.exec(detail)?.[0] ?? ''
        ok.push(record(`V2.${lang}.message`, failedAtVerify && detail.includes(title) && !detail.includes(other.wizard.ssh.error.forwardingDenied.title)
          && detail.includes('AllowTcpForwarding') && sshLine !== '' && !detail.includes(oldTitle) && !detail.includes(oldBody)
          && addMore === L.profiles.addMore && tunnel.some(t => t.result?.forwardingDenied === true), [
          `UI language ${lang} ("add more" = ${JSON.stringify(addMore)})`,
          `failed step: fetch-fingerprint=${statusOf(failedStatuses, 'fetch-fingerprint')}, start-server=${statusOf(failedStatuses, 'start-server')}`,
          `title ${JSON.stringify(title)} shown: ${detail.includes(title)}; ssh line: ${JSON.stringify(sshLine)}`,
          `old "${oldTitle}" / "${oldBody}" shown: ${detail.includes(oldTitle) || detail.includes(oldBody)}`,
          `ssh:verify-tunnel-status calls: ${JSON.stringify(tunnel.map(t => t.result))}`,
          `detail: ${detail.slice(0, 900)}`]))

        let rolled: Record<string, string> = {}
        let afterCancel = ''
        if (outcome.result === 'failed') {
          await win.locator('.bat-stepper-failed-actions [data-action-kind="cancel"]').first().click()
          const cleaned = async () => (await dockerExec(sshd, 'ls -A /home/bat/.local/bat-server /home/bat/.config/systemd/user/bat-server.service 2>/dev/null | head -3; true')).trim() === ''
          await expect.poll(cleaned, { timeout: 90_000, intervals: [2_000] }).toBe(true).catch(() => log(`V2 ${lang}: remote not cleaned within 90 s`))
          await expect.poll(async () => statusOf(await stepStatuses(win), 'install-server-bundle'), { timeout: 30_000 }).toBe('rolled-back').catch(() => { /* recorded below */ })
          rolled = await stepStatuses(win)
          await shot(win, `v2-${lang}-after-cancel`)
          afterCancel = await remoteCleanState(sshd)
          log(`V2 ${lang} after cancel: steps ${JSON.stringify(rolled)}; remote ${afterCancel.replace(/\s+/g, ' ')}`)
        }
        const rollbackWarnings = wizardLog.filter(l => /Failed to stop bat-server|Rollback failed|is not a function|uninstall.*fail/i.test(l))
        const created = (await profiles(win)).filter(p => !before.has(p.id))
        fs.writeFileSync(path.join(EVIDENCE_DIR, `v2-${lang}-wizard-log.txt`), wizardLog.join('\n'))
        ok.push(record(`V2.${lang}.rollback`, failedAtVerify && wasInstalled && leftovers === ''
          && ['fetch-fingerprint', 'start-server', 'install-server-bundle'].every(id => statusOf(rolled, id) === 'rolled-back')
          && !/state=active/.test(afterCancel) && /unit=.*No such file/.test(afterCancel) && /bundle=.*No such file/.test(afterCancel)
          && /listen9876=0/.test(afterCancel) && rollbackWarnings.length === 0 && created.length === 0, [
          `target clean before the wizard: ${leftovers === '' ? 'yes' : leftovers}`,
          `before cancel: is-active ${section(beforeCancel, 'is-active')}, ls ${section(beforeCancel, 'ls ').replace(/\s+/g, ' ')}`,
          `after cancel: ${JSON.stringify(rolled)}`, afterCancel.trim(), `rollback warnings: ${JSON.stringify(rollbackWarnings)}`, `profiles created: ${created.length}`]))
        await closeWizard(win).catch(() => { /* already closed */ })
        keepInstanceLog(inst, `v2-${lang}`)
      } finally {
        log(`V2 ${lang}: ${(await dockerExec(sshd, `rm -f ${noForward} && systemctl reload ssh && sleep 1 && sshd -T | grep -i allowtcpforwarding`)).trim()} (restored)`)
        await closeIsolated(inst, log)
      }
      expect(ok.every(Boolean), `V2 ${lang} checks (see results.json)`).toBe(true)
    })
  }

  test('V3 forwarding allowed again → the wizard completes; success path makes no tunnel-status query', async () => {
    test.setTimeout(WIZARD_TIMEOUT_MS + 240_000)
    const sshd = conn!.ssh.container
    const alias = conn!.ssh.alias
    const fwdState = (await dockerExec(sshd, 'ls /etc/ssh/sshd_config.d/; sshd -T | grep -i allowtcpforwarding')).trim()
    const leftovers = (await dockerExec(sshd, 'ls -A /home/bat/.local/bat-server /home/bat/.config/systemd/user/bat-server.service 2>/dev/null | head -3; true')).trim()
    log(`V3: sshd ${fwdState.replace(/\s+/g, ' ')}; leftovers ${JSON.stringify(leftovers)}`)
    const ok: boolean[] = []
    let inst: IsolatedInstance | undefined
    try {
      inst = await launchIsolated('t0520-v3', log, { env: isolatedSshEnv() })
      const { win } = inst
      await installRecorders(inst, { stubClaude: false })
      const wizardLog = captureWizardLog(win)
      const before = new Set((await profiles(win)).map(p => p.id))
      await openSshWizard(win)
      const started = Date.now()
      const outcome = await driveWizard(win, alias)
      log(`V3: wizard ${outcome.result} in ${Date.now() - started} ms`)
      await shot(win, `v3-wizard-${outcome.result}`)
      if (outcome.result !== 'complete') log(`V3 wizard text: ${outcome.text.replace(/\s+/g, ' ').slice(0, 900)}`)
      const evidence = await installEvidence(sshd, 'bat')
      fs.writeFileSync(path.join(EVIDENCE_DIR, 'v3-install-evidence.txt'), evidence)
      fs.writeFileSync(path.join(EVIDENCE_DIR, 'v3-wizard-log.txt'), wizardLog.join('\n'))
      const complete = outcome.result === 'complete'
      if (complete) await closeWizard(win)
      const tunnel = await tunnelStatusCalls(inst)
      const created = complete ? (await profiles(win)).filter(p => !before.has(p.id)) : []
      const profile = created[0]
      const listing = section(evidence, 'ls ').split(/\s+/)
      const unit = section(evidence, 'unit')
      const execStart = unit.split(/\r?\n/).find(l => l.startsWith('ExecStart=')) ?? ''
      const mainPid = section(evidence, 'MainPID')
      const listening = section(evidence, 'listening')
      const ownListen = listening.split(/\r?\n/).filter(l => new RegExp(`127\\.0\\.0\\.1:${SERVER_PORT}\\s`).test(l) && l.includes(`pid=${mainPid},`))
      const containerFp = await remoteFingerprint(sshd, 'bat')
      const matchLine = wizardLog.find(l => l.includes('TLS fingerprint matches')) ?? ''
      ok.push(record('V3.wizard', complete && leftovers === '' && /allowtcpforwarding yes/i.test(fwdState)
        && listing.includes('bin') && !listing.includes('staging') && section(evidence, 'test -x') === 'executable'
        && execStart === `ExecStart=/home/bat/.local/bat-server/bin/bat-server --port ${SERVER_PORT} --bind-interface localhost`
        && ownListen.length > 0 && !/0\.0\.0\.0:9876|\*:9876|\[::\]:9876/.test(listening) && section(evidence, 'is-active') === 'active'
        && Boolean(profile) && normFp(profile!.remoteFingerprint) === normFp(containerFp) && normFp(containerFp) !== ''
        && tunnel.length === 0, [
        `sshd: ${fwdState.replace(/\s+/g, ' ')}`, `wizard ${outcome.result}`, `ls ~/.local/bat-server → ${listing.join(' ')}; bin/bat-server ${section(evidence, 'test -x')}; bundle ${section(evidence, 'version')}`,
        execStart, `MainPID ${mainPid}; listen ${ownListen.join(' / ') || listening}`, `is-active ${section(evidence, 'is-active')}`,
        `profile fingerprint ${normFp(profile?.remoteFingerprint)} / container server-cert.json ${containerFp}`, matchLine,
        `ssh:verify-tunnel-status calls on the success path: ${tunnel.length}`]))

      // The new profile connects through the tunnel and a remote shell answers.
      let connected = ''
      if (profile) {
        try {
          const { page } = await openProfileWindow(inst, profile.id, 'V3')
          const ptyId = `t0520-v3-${Date.now()}`
          await page.evaluate((id) => {
            const w = window as AnyApi
            w.__t0520 = w.__t0520 ?? {}
            w.__t0520[id] = ''
            w.electronAPI.pty.onOutput((pid: string, data: string) => { if (pid === id) w.__t0520[id] += data })
          }, ptyId)
          await page.evaluate(async (id) => (window as AnyApi).electronAPI.pty.create({ id, cwd: '/tmp', type: 'terminal' }), ptyId)
          await page.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'echo "T0520-$(id -un)@$(uname -n)-$((20+5))"\n'), ptyId)
          await expect.poll(() => page.evaluate((id) => (window as AnyApi).__t0520[id] as string, ptyId), { timeout: 30_000 }).toMatch(/T0520-\S+-25/)
          connected = ((await page.evaluate((id) => (window as AnyApi).__t0520[id] as string, ptyId)).match(/T0520-\S+-25/g) ?? []).at(-1) ?? ''
          await shot(page, 'v3-profile-connected')
          await page.evaluate(async (id) => (window as AnyApi).electronAPI.pty.kill(id), ptyId).catch(() => { /* gone */ })
          await page.close()
        } catch (err) {
          connected = `connect failed: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`
        }
      }
      ok.push(record('V3.connect', connected === `T0520-bat@${sshd}-25` && profile?.useSshTunnel === true,
        [`profile useSshTunnel ${profile?.useSshTunnel}`, `remote shell ${connected}`]))

      // Leave the target as it was: stop / uninstall through the product's own API.
      const stop = await win.evaluate(async (req) => (window as AnyApi).electronAPI.ssh.stopServer(req), { sshHost: alias, sshUser: '', targetOS: 'ssh-linux', serverHome: '/home/bat' })
      const uninstall = await win.evaluate(async (req) => (window as AnyApi).electronAPI.ssh.uninstallBundle(req), { sshHost: alias, sshUser: '', installPath: '~/.local/bat-server' })
      log(`V3 cleanup: stopServer ${JSON.stringify(stop)} uninstallBundle ${JSON.stringify(uninstall)}; remote ${(await remoteCleanState(sshd)).replace(/\s+/g, ' ')}`)
      keepInstanceLog(inst, 'v3')
    } finally {
      await closeIsolated(inst, log)
    }
    expect(ok.every(Boolean), 'V3 checks (see results.json)').toBe(true)
  })
})

