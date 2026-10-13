// T0510 — v0.6.0-pre.5 acceptance on the installed build, unattended. OPT-IN: every test is
// skipped unless BAT_E2E_PRE5_ACCEPTANCE=1. Point BAT_E2E_EXECUTABLE at the installed exe to
// test the packaged build (unset: the source build, `npx vite build` first):
//
//   $env:BAT_E2E_PRE5_ACCEPTANCE='1'
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   npx playwright test e2e/pre5-acceptance.spec.ts
//
// A1  Custom CLI Agents persist (T0496): added through Settings, still listed after a restart,
//     <userData>/custom-clis.json written.
// A3x BUG-119 on an isolated runtime (T0480): a legacy `better-agent-terminal-runtime-<id>`
//     holding Local State / snippets.json / message-archives / settings.json is renamed on the
//     first start; a log level picked in Settings survives a restart and is applied by the
//     bootstrap logger. (The default-instance path — copy Local State, merge snippets, move
//     archives, keep the legacy directory — only runs without a runtime id, i.e. on the real
//     %APPDATA% directories, so A4 covers it read-only.)
// A4  BUG-119 on the real user directories, READ ONLY (Windows): the migration marker and log
//     lines, Local State identical in both directories, the legacy directory untouched.
// A5  BUG-114 dispatch: ≥ 20 raw-command dispatches (≥ 5 concurrent pairs) through the helper
//     of the build under test against the isolated instance's RemoteServer, while another PTY
//     floods `pty:output` broadcasts. Every helper exits 0 with `responseType: invoke-result`,
//     and each terminal shows up in the instance (server log + renderer + workspace entry).
//
// Nothing here starts a Claude session. The helper log goes to a temp directory
// (BAT_HELPER_LOG_DIR / BAT_USER_DATA), never to the user's bat-scripts.log, and the helper
// only ever talks to the isolated instance's port.

import { test, expect, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  E2E_EXECUTABLE,
  REPO_ROOT,
  closeIsolated,
  launchIsolated,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_PRE5_ACCEPTANCE === '1'
const EVIDENCE_DIR = process.env.BAT_E2E_PRE5_EVIDENCE_DIR || path.join(os.tmpdir(), 'bat-t0510', 'evidence')
const HELPER_DIR = E2E_EXECUTABLE
  ? path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'scripts')
  : path.join(REPO_ROOT, 'scripts')

test.skip(!ENABLED, 'opt-in: set BAT_E2E_PRE5_ACCEPTANCE=1 (T0510)')

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function readLogs(userData: string, prefix: string): string {
  const dir = path.join(userData, 'Logs')
  try {
    return fs.readdirSync(dir).filter(f => f.startsWith(prefix)).sort()
      .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  } catch {
    return ''
  }
}

async function shot(page: Page, name: string, log: (m: string) => void): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file })
  log(`screenshot ${file}`)
}

async function openSettings(win: Page, tab: 'general' | 'advanced'): Promise<void> {
  // Sidebar footer: [profiles] [settings].
  await win.locator('.sidebar-footer-buttons .settings-btn').nth(1).click()
  await expect(win.locator('.settings-panel')).toBeVisible({ timeout: 15_000 })
  const index = tab === 'general' ? 0 : 3
  await win.locator('.settings-tabs [role="tab"]').nth(index).click()
}

async function closeSettings(win: Page): Promise<void> {
  await win.locator('.settings-panel .settings-header .close-btn').click()
  await expect(win.locator('.settings-panel')).toHaveCount(0)
}

// ── A1 ───────────────────────────────────────────────────────────────────────

test('A1 custom CLI added in Settings survives a restart and lands in custom-clis.json', async () => {
  test.setTimeout(180_000)
  const log = testLogger('t0510-a1')
  const name = `T0510 Echo ${Date.now() % 100000}`
  const command = 'echo'
  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0510-a1', log)
    const { win, userData, runtimeId } = inst
    const file = path.join(userData, 'custom-clis.json')
    expect(fs.existsSync(file)).toBe(false)

    await openSettings(win, 'general')
    const group = win.locator('.settings-group', { hasText: 'Custom CLI Agents' })
    await group.getByRole('button', { name: '+ Add Custom CLI' }).click()
    await group.getByPlaceholder('Name').fill(name)
    await group.getByPlaceholder('Command (e.g. aider, cursor, cline)').fill(command)
    await group.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(group.getByText(name, { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => fs.existsSync(file), { timeout: 10_000, message: 'custom-clis.json written' }).toBe(true)
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
    log(`custom-clis.json after Add: ${JSON.stringify(saved)}`)
    await shot(win, 'a1-after-add', log)
    await closeSettings(win)

    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    expect(JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')))).toContain(name)

    relaunched = await launchIsolated('t0510-a1', log, { runtimeId })
    const listed = await relaunched.win.evaluate(async () => (window as AnyApi).electronAPI.agent.listCustomClis())
    log(`listCustomClis() after restart: ${JSON.stringify(listed)}`)
    expect(listed).toContainEqual(expect.objectContaining({ name, command }))
    await openSettings(relaunched.win, 'general')
    const groupAfter = relaunched.win.locator('.settings-group', { hasText: 'Custom CLI Agents' })
    await expect(groupAfter.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })
    await shot(relaunched.win, 'a1-after-restart', log)
  } finally {
    await closeIsolated(inst, log)
    await closeIsolated(relaunched, log)
  }
})

// ── A3x ──────────────────────────────────────────────────────────────────────

function legacyRuntimeDir(runtimeId: string): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  return path.join(appData, `better-agent-terminal-runtime-${runtimeId}`)
}

test('A3x legacy runtime layout is renamed on first start; a Settings log level survives a restart', async () => {
  test.skip(process.platform !== 'win32', 'Windows appData layout')
  test.setTimeout(180_000)
  const log = testLogger('t0510-a3')
  const archive = 't0510-session.jsonl'
  const archiveLine = JSON.stringify({ t0510: 'archive', role: 'user', text: 'seeded' })
  let seeded: string | undefined
  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0510-a3', log, {
      beforeLaunch: (runtimeId) => {
        const dir = legacyRuntimeDir(runtimeId)
        seeded = dir
        fs.mkdirSync(path.join(dir, 'message-archives'), { recursive: true })
        // A Chromium-shaped Local State without os_crypt: Chromium adds its own keys.
        fs.writeFileSync(path.join(dir, 'Local State'), JSON.stringify({ t0510: { seeded: runtimeId } }))
        // 'log' (default 'debug') still lets the [LOG] migration report through.
        fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ logLevel: 'log' }))
        fs.writeFileSync(path.join(dir, 'snippets.json'), JSON.stringify({
          snippets: [{ id: 5, title: 't0510-seeded-snippet', content: 'echo t0510', format: 'plaintext', action: 'terminal', isFavorite: false, createdAt: 1, updatedAt: 1 }],
          nextId: 6,
        }))
        fs.writeFileSync(path.join(dir, 'message-archives', archive), archiveLine + '\n')
        log(`seeded legacy runtime dir ${dir}: Local State, settings.json(logLevel=log), snippets.json, message-archives/${archive}`)
      },
    })
    const { win, userData, runtimeId } = inst
    expect(fs.existsSync(legacyRuntimeDir(runtimeId))).toBe(false)
    const marker = JSON.parse(fs.readFileSync(path.join(userData, '.userdata-migration.json'), 'utf8'))
    log(`marker: ${JSON.stringify(marker)}`)
    expect(marker).toMatchObject({ v: 1, from: legacyRuntimeDir(runtimeId), items: { 'runtime-dir': 'renamed' } })
    const migrationLines = readLogs(userData, 'debug-').split(/\r?\n/).filter(l => l.includes('[userdata-migration]'))
    for (const l of migrationLines) log(`log: ${l}`)
    expect(migrationLines.some(l => l.includes('runtime-dir: renamed'))).toBe(true)

    const localState = JSON.parse(fs.readFileSync(path.join(userData, 'Local State'), 'utf8'))
    expect(localState.t0510?.seeded).toBe(runtimeId)
    expect(fs.readFileSync(path.join(userData, 'message-archives', archive), 'utf8').trim()).toBe(archiveLine)
    const snippets = await win.evaluate(async () => (window as AnyApi).electronAPI.snippet.getAll())
    expect(snippets.map((s: { id: number; title: string }) => [s.id, s.title])).toContainEqual([5, 't0510-seeded-snippet'])
    const before = await win.evaluate(async () => (window as AnyApi).electronAPI.settings.getLoggingInfo())
    log(`logging info after migration: ${JSON.stringify(before)}`)
    expect(before.logLevel).toBe('log')

    // Settings → Advanced → Debug Logging level: log → error, through the UI.
    await openSettings(win, 'advanced')
    const level = win.locator('.settings-section select:has(option[value="warn"]):has(option[value="log"])')
    await expect(level).toHaveValue('log')
    await level.selectOption('error')
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).logLevel,
      { timeout: 10_000, message: 'settings.json logLevel' }).toBe('error')
    await shot(win, 'a3-loglevel-error', log)
    await closeSettings(win)

    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    const logsBefore = new Set(fs.readdirSync(path.join(userData, 'Logs')))

    relaunched = await launchIsolated('t0510-a3', log, { runtimeId })
    const after = await relaunched.win.evaluate(async () => (window as AnyApi).electronAPI.settings.getLoggingInfo())
    log(`logging info after restart: ${JSON.stringify(after)}`)
    expect(after.logLevel).toBe('error')
    await openSettings(relaunched.win, 'advanced')
    await expect(relaunched.win.locator('.settings-section select:has(option[value="warn"]):has(option[value="log"])')).toHaveValue('error')
    await shot(relaunched.win, 'a3-loglevel-after-restart', log)
    // The bootstrap logger (T0485) already applies the level: the first start (level 'log')
    // wrote [LOG] lines; after the restart nothing below error reaches disk (the file is
    // only created on the first write, so it may not exist at all).
    const newLogs = fs.readdirSync(path.join(userData, 'Logs')).filter(f => f.startsWith('debug-') && !logsBefore.has(f))
    const lines = newLogs.flatMap(f => fs.readFileSync(path.join(userData, 'Logs', f), 'utf8').split(/\r?\n/).filter(Boolean))
    const belowError = lines.filter(l => /\] \[(LOG|INFO|DEBUG|WARN)\]/.test(l))
    log(`restart: currentLogFilePath=${after.currentLogFilePath} exists=${fs.existsSync(after.currentLogFilePath)}; new log file(s) ${JSON.stringify(newLogs)}: ${lines.length} line(s), ${belowError.length} below error`)
    expect(belowError).toEqual([])
  } finally {
    await closeIsolated(inst, log)
    await closeIsolated(relaunched, log)
    if (seeded && fs.existsSync(seeded) && path.basename(seeded).startsWith('better-agent-terminal-runtime-e2e-')) {
      fs.rmSync(seeded, { recursive: true, force: true })
    }
  }
})

// ── A4 (read only) ───────────────────────────────────────────────────────────

interface Entry { rel: string; mtimeMs: number; size: number; dir: boolean }

function walk(root: string, rel = ''): Entry[] {
  const out: Entry[] = []
  for (const name of fs.readdirSync(path.join(root, rel))) {
    const r = rel ? path.join(rel, name) : name
    const st = fs.statSync(path.join(root, r))
    out.push({ rel: r, mtimeMs: st.mtimeMs, size: st.size, dir: st.isDirectory() })
    if (st.isDirectory()) out.push(...walk(root, r))
  }
  return out
}

test('A4 real %APPDATA% after the pre.5 upgrade (read only)', async () => {
  test.skip(process.platform !== 'win32', 'Windows only')
  const log = testLogger('t0510-a4')
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  const target = path.join(appData, 'BetterAgentTerminal')
  const legacy = path.join(appData, 'better-agent-terminal')
  test.skip(!fs.existsSync(path.join(target, '.userdata-migration.json')), 'no migration marker — this machine never ran a T0480 build')

  const marker = JSON.parse(fs.readFileSync(path.join(target, '.userdata-migration.json'), 'utf8'))
  const migratedAt = Date.parse(marker.at)
  log(`marker ${JSON.stringify(marker)}`)
  expect(marker.from).toBe(legacy)

  // The first log written by the upgraded build carries the migration report.
  const logsDir = path.join(target, 'Logs')
  const firstLogs = fs.readdirSync(logsDir).filter(f => f.startsWith('debug-')).sort()
  const withReport = firstLogs.find(f => fs.readFileSync(path.join(logsDir, f), 'utf8').includes('[userdata-migration] marker: written'))
  expect(withReport, 'a log with the migration report').toBeTruthy()
  const reportLines = fs.readFileSync(path.join(logsDir, withReport!), 'utf8').split(/\r?\n/).filter(l => l.includes('[userdata-migration]'))
  for (const l of reportLines) log(`${withReport}: ${l}`)
  expect(reportLines.some(l => l.includes('Local State: copied'))).toBe(true)

  // server-token.json: RemoteServer re-persists the token on every start (DPAPI ciphertext is
  // not deterministic), so neither its hash nor its mtime can show the token is unchanged.
  // What decides it is the safeStorage key in Local State: identical bytes in both directories
  // means the upgraded build decrypts the token the old build wrote.
  for (const name of ['server-token.json', 'server-cert.json', 'Local State']) {
    for (const dir of [target, legacy]) {
      const file = path.join(dir, name)
      if (!fs.existsSync(file)) { log(`${file}: absent`); continue }
      log(`${file}: sha256=${sha256(file)} mtime=${iso(fs.statSync(file).mtimeMs)}`)
    }
  }
  expect(sha256(path.join(target, 'Local State'))).toBe(sha256(path.join(legacy, 'Local State')))
  const token = JSON.parse(fs.readFileSync(path.join(target, 'server-token.json'), 'utf8'))
  expect(token).toMatchObject({ v: 1, encrypted: true })
  // The certificate (what remote clients pin) predates the upgrade.
  expect(fs.statSync(path.join(target, 'server-cert.json')).mtimeMs).toBeLessThan(migratedAt)

  // Legacy directory: nothing newer than the migration (only message-archives may move out).
  const legacyEntries = walk(legacy)
  for (const e of legacyEntries.filter(x => !x.rel.includes(path.sep) || x.rel.startsWith('message-archives'))) {
    log(`legacy ${e.dir ? 'dir ' : 'file'} ${e.rel} mtime=${iso(e.mtimeMs)}${e.dir ? '' : ` size=${e.size}`}`)
  }
  const newer = legacyEntries.filter(e => e.mtimeMs >= migratedAt && !e.rel.startsWith('message-archives'))
  log(`legacy entries: ${legacyEntries.length}, newer than the marker: ${newer.length}`)
  expect(newer).toEqual([])
})

// ── A5 ───────────────────────────────────────────────────────────────────────

interface HelperRun { label: string; code: number | null; stdout: string; stderr: string; terminalId?: string; ms: number }

function runHelper(env: NodeJS.ProcessEnv, label: string, cwd: string): Promise<HelperRun> {
  const started = Date.now()
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(HELPER_DIR, 'bat-terminal.mjs'), 'echo', label], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      // A non-zero exit puts the exit code on err.code; spawn errors put a string there.
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      const m = /Terminal created: (\S+)/.exec(String(stdout))
      resolve({ label, code, stdout: String(stdout), stderr: String(stderr), terminalId: m?.[1], ms: Date.now() - started })
    })
  })
}

interface HelperRecord { script: string; event: string; pid: number; result?: string; responseType?: string; ignoredFrames?: number; terminalId?: string }

test('A5 ≥ 20 helper dispatches (5+ concurrent pairs) under pty:output load: none lost', async () => {
  test.setTimeout(300_000)
  const log = testLogger('t0510-a5')
  const SINGLES = 10
  const PAIRS = 6
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0510-a5-'))
  const helperLogDir = path.join(tmp, 'helper-logs')
  const wsFolder = path.join(tmp, 'ws')
  fs.mkdirSync(wsFolder, { recursive: true })
  let inst: IsolatedInstance | undefined
  try {
    expect(fs.existsSync(path.join(HELPER_DIR, 'bat-terminal.mjs'))).toBe(true)
    inst = await launchIsolated('t0510-a5', log)
    const { app, win, userData, remotePort } = inst

    // One workspace, so externally created terminals have somewhere to land.
    const WS = 'e2e-t0510-a5-ws'
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = { workspaces: [{ id: WS, name: 'T0510-A5', folderPath: wsFolder, createdAt: Date.now() }], activeWorkspaceId: WS, activeGroup: null, terminals: [], activeTerminalId: null }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-item', { hasText: 'T0510-A5' })).toBeVisible({ timeout: 30_000 })

    // The isolated instance's own token (safeStorage-encrypted in its userData) and certificate.
    await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
    const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
    const token: string = record.encrypted
      ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
      : record.data
    expect(token.length).toBeGreaterThan(16)
    const status = await win.evaluate(async () => (window as AnyApi).electronAPI.remote.serverStatus())
    log(`isolated RemoteServer: running=${status.running} port=${status.port} (expected ${remotePort})`)
    expect(status.port).toBe(remotePort)

    // Flood: a PTY printing continuously, so every helper connection sees pty:output broadcasts.
    const NOISE = `e2e-t0510-a5-noise-${Date.now()}`
    await win.evaluate((id) => {
      const w = window as AnyApi
      w.__t0510 = { bytes: 0 }
      w.electronAPI.pty.onOutput((pid: string, data: string) => { if (pid === id) w.__t0510.bytes += data.length })
    }, NOISE)
    expect(await win.evaluate(({ id, cwd }) => (window as AnyApi).electronAPI.pty.create({ id, cwd, type: 'terminal', shell: 'powershell.exe' }), { id: NOISE, cwd: wsFolder })).toBeTruthy()
    await win.evaluate(({ id, cmd }) => (window as AnyApi).electronAPI.pty.write(id, cmd), {
      id: NOISE,
      cmd: "$i=0; while ($true) { $i++; 1..40 | ForEach-Object { 't0510-noise ' + $i + ' ' + ('x' * 120) }; Start-Sleep -Milliseconds 15 }\r",
    })
    await expect.poll(() => win.evaluate(() => (window as AnyApi).__t0510.bytes), { timeout: 20_000 }).toBeGreaterThan(50_000)

    const env: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
    Object.assign(env, {
      BAT_REMOTE_PORT: String(remotePort),
      BAT_REMOTE_TOKEN: token,
      BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'),
      BAT_HELPER_LOG_DIR: helperLogDir,
      BAT_USER_DATA: tmp,
    })

    const runs: HelperRun[] = []
    let n = 0
    for (let i = 0; i < SINGLES; i++) runs.push(await runHelper(env, `t0510-a5-${++n}`, wsFolder))
    for (let i = 0; i < PAIRS; i++) {
      const pair = await Promise.all([runHelper(env, `t0510-a5-${++n}`, wsFolder), runHelper(env, `t0510-a5-${++n}`, wsFolder)])
      runs.push(...pair)
    }
    const noiseBytes = await win.evaluate(() => (window as AnyApi).__t0510.bytes)
    log(`dispatched ${runs.length} (${SINGLES} single + ${PAIRS} pairs); noise PTY output so far ${noiseBytes} chars`)
    for (const r of runs) log(`${r.label}: exit=${r.code} id=${r.terminalId ?? '-'} ${r.ms} ms${r.code === 0 ? '' : ` stderr=${r.stderr.trim()}`}`)
    expect(runs.length).toBeGreaterThanOrEqual(20)
    expect(runs.filter(r => r.code !== 0)).toEqual([])
    const ids = runs.map(r => r.terminalId!)
    expect(new Set(ids).size).toBe(runs.length)

    // Helper side (temp log): one terminal-created ok + invoke-result per dispatch.
    const helperLog = path.join(helperLogDir, 'bat-scripts.log')
    const records = fs.readFileSync(helperLog, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l) as HelperRecord)
    const created = records.filter(r => r.script === 'bat-terminal' && r.event === 'terminal-created')
    const ignored = created.reduce((sum, r) => sum + (r.ignoredFrames ?? 0), 0)
    log(`helper log ${helperLog}: terminal-created ${created.length}, results ${JSON.stringify([...new Set(created.map(r => r.result))])}, responseTypes ${JSON.stringify([...new Set(created.map(r => r.responseType))])}, broadcast frames ignored while waiting ${ignored}`)
    expect(created.length).toBe(runs.length)
    expect(created.every(r => r.result === 'ok' && r.responseType === 'invoke-result')).toBe(true)
    expect(created.map(r => r.terminalId).sort()).toEqual([...ids].sort())

    // Instance side: the RemoteServer mirror, the renderer, and the saved workspace entry.
    const serverCreated = () => readLogs(userData, 'bat-scripts').split(/\r?\n/)
      .filter(l => l.includes('"script":"remote-server","event":"terminal-created"'))
    await expect.poll(() => ids.filter(id => serverCreated().some(l => l.includes(`"terminalId":"${id}"`))).length,
      { timeout: 20_000, message: 'remote-server terminal-created per dispatch' }).toBe(ids.length)
    const mirrorLines = serverCreated()
    log(`instance bat-scripts.log remote-server terminal-created: ${mirrorLines.length}; first: ${mirrorLines[0]}`)
    expect(mirrorLines.every(l => l.includes('"result":true'))).toBe(true)
    await expect.poll(() => ids.filter(id => readLogs(userData, 'debug-').includes(`External terminal added: id=${id}`)).length,
      { timeout: 20_000, message: 'renderer [T0130] External terminal added per dispatch' }).toBe(ids.length)
    await expect.poll(async () => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      const entry = raw ? JSON.parse(raw) as { terminals: { id: string; workspaceId: string }[] } : null
      return ids.filter(id => entry?.terminals.some(t => t.id === id && t.workspaceId === WS)).length
    }, { timeout: 30_000, message: 'workspace entry holds every dispatched terminal' }).toBe(ids.length)
    await shot(win, 'a5-after-dispatch', log)
    log(`0 lost: ${ids.length}/${ids.length} terminals in server log, renderer and workspace entry`)
  } finally {
    // Keep the helper and instance logs as evidence before the temp / runtime dirs go.
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    const helperLog = path.join(helperLogDir, 'bat-scripts.log')
    if (fs.existsSync(helperLog)) fs.copyFileSync(helperLog, path.join(EVIDENCE_DIR, 'a5-helper-bat-scripts.log'))
    if (inst) {
      const instLog = path.join(inst.userData, 'Logs', 'bat-scripts.log')
      if (fs.existsSync(instLog)) fs.copyFileSync(instLog, path.join(EVIDENCE_DIR, 'a5-instance-bat-scripts.log'))
    }
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
