// T0663 — v0.7.1-pre.2 installed-build acceptance: BUG-157 pin → Save keeps the new fingerprint,
// BUG-160 no pin for SSH profiles, BUG-158 / 161 zh-TW strings, BUG-163 wizard button / input styles.
// OPT-IN: skipped unless BAT_E2E_V071PRE2=1 and BAT_E2E_EXECUTABLE points at the installed build.
// Windows only.
//
//   node e2e/real-remote/t0663-env.mjs up          (optional: SSH target for the auth-failed message)
//   $env:BAT_E2E_V071PRE2='1'
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   npx playwright test e2e/v071-pre2-acceptance.spec.ts
//   node e2e/real-remote/t0663-env.mjs down --rmi
//
// Every launch is an isolated instance (fixtures/electron-isolation: own --runtime / userData,
// RemoteServer on a free port). Three instances, none of them the user's BAT (9876) or the WSL
// bat-server (9877):
//   target    only its RemoteServer is used: the "real" server whose fingerprint V1 pins
//   subject   V1 / V2 (edit-connection dialog), V3 profiles strings, V4 "+" menu / thumbnail menu / ×
//   wizard    V3 / V4 / V5 on the WSL / SSH / Docker wizards
//
// Nothing is installed anywhere. In the wizard instance every main-process handler under `wsl:`,
// `wsl-systemd:`, `docker:`, `ssh:`, `server-bundle:` (plus `remote:detect-arch` / `remote:detect-tools`)
// is replaced by a guard: listed channels get a canned answer (WSL distros, SSH aliases, Docker status
// and containers), a few read-only ones go through to the real handler (`docker:status` for the
// natural "no Docker daemon" error, `ssh:probe-auth` for the auth-failed message), and everything else
// throws `T0663 guard` without running — the guard's call log is part of the evidence. The WSL wizard
// therefore never reaches the user's distro. The SSH auth-failed check uses t0663-env.mjs's container
// (`bat-t0663-sshd`, no key accepted) through alias `bat-t0663-nokey`, appended to the real
// ~/.ssh/config as a marked block for that one test and restored hash-checked right after.
//
// No Claude token is spent: no Claude panel or claude-cli tab is opened, and every `claude:*` handler
// that could reach the CLI / API is answered by a recorder (T0514 / T0520's approach).
// Each check writes a verdict to <evidence>/results.json; screenshots go to the same directory
// (default %TEMP%\bat-t0663\evidence, outside Playwright's outputDir which every run empties).

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import {
  E2E_EXECUTABLE,
  REPO_ROOT,
  closeIsolated,
  freePort,
  launchIsolated,
  readPid,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_V071PRE2 === '1'
const ROOT = path.join(os.tmpdir(), 'bat-t0663')
const EVIDENCE_DIR = process.env.BAT_E2E_V071PRE2_EVIDENCE_DIR || path.join(ROOT, 'evidence')
const RESULTS = path.join(EVIDENCE_DIR, 'results.json')
const ENV_SCRIPT = path.join(REPO_ROOT, 'e2e', 'real-remote', 't0663-env.mjs')
const SSH_CONNECTION = path.join(ROOT, 'ssh-env', 'connection.json')
const EXPECTED_VERSION = '0.7.1-pre.2'

test.skip(!ENABLED, 'opt-in: set BAT_E2E_V071PRE2=1 (T0663)')
test.skip(process.platform !== 'win32', 'Windows host only')
test.skip(ENABLED && !E2E_EXECUTABLE, 'set BAT_E2E_EXECUTABLE to the installed BetterAgentTerminal.exe under test')

const log = testLogger('t0663')

const ZH = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', 'zh-TW.json'), 'utf8'))
function pick(dict: AnyApi, key: string): string {
  const v = key.split('.').reduce((o: AnyApi, k) => o?.[k], dict)
  if (typeof v !== 'string') throw new Error(`locale key ${key} missing`)
  return v
}
const zh = (key: string) => pick(ZH, key)

/** English strings BUG-158 / 161 listed; none may show in the zh-TW UI. */
const BUG158_ENGLISH = [
  'Pin expected fingerprint', 'Create new', 'Use existing', 'Add WSL Profile', 'Add SSH Profile', 'Add Docker Profile',
  'This profile has no targetOS', 'Select targetOS', 'Choose a WSL2 distro', 'BAT only supports WSL2', 'systemd is not enabled',
  'Choose Docker container mode', 'Pinned fingerprint (read-only)', 'Set as Supervisor', 'suggested',
]
/** BUG-163: step descriptions T0658 replaced (zh-TW wording and internal jargon). */
const STALE_STEP_TEXT = ['選擇主機、帳號、port、金鑰與安裝路徑', 'BAT_AUTH_OK', 'probe', 'ssh+tar', 'plist', 'bind mounts', 'healthy', 'TOFU', '託管', '串流']

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

/** Records one check (`V<n>.<part>`); a FAIL is also a soft assertion failure. */
function record(key: string, pass: boolean | 'needs-human', evidence: string[]): void {
  const verdict: Verdict = pass === 'needs-human' ? 'NEEDS-HUMAN' : pass ? 'PASS' : 'FAIL'
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const all = readResults()
  all[key] = { verdict, evidence, at: new Date().toISOString() }
  fs.writeFileSync(RESULTS, JSON.stringify(all, null, 2))
  log(`${key}: ${verdict} — ${evidence.join(' | ').replace(/\s+/g, ' ').slice(0, 1500)}`)
  expect.soft(verdict, `${key}: ${evidence.join(' | ').slice(0, 600)}`).not.toBe('FAIL')
}

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file })
  log(`screenshot ${file}`)
  return file
}

function envScript(command: string, timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [ENV_SCRIPT, command], { timeout, windowsHide: true }, (err, stdout, stderr) => {
      const out = `${stdout}${stderr}`.trim()
      if (err) reject(new Error(`${command} failed: ${out}`))
      else resolve(out)
    })
  })
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Closes an instance and records what the fixture left behind. */
async function closeAndCheck(inst: IsolatedInstance | undefined, tag: string): Promise<void> {
  if (!inst) return
  const pid = readPid(inst.userData)
  await closeIsolated(inst, log)
  const gone = !fs.existsSync(inst.userData)
  const serverAlive = pid !== null && isAlive(pid)
  record(`CLEANUP.${tag}`, gone && !serverAlive, [`userData ${inst.userData} removed: ${gone}`, `Terminal Server pid ${pid ?? 'none'} alive: ${serverAlive}`])
}

// ── main-process stubs (test-side only, no product change) ───────────────────

interface GuardConfig {
  /** channel → canned answer; `{ __throw: msg }` rejects. */
  stubs: Record<string, unknown>
  /** channels that go through to the real handler (logged). */
  real: string[]
}

/**
 * Replaces every remote-setup handler with the guard (see the header). Can be called again to switch
 * scenario; the original handlers are kept from the first call.
 */
async function installGuard(app: ElectronApplication, cfg: GuardConfig): Promise<string[]> {
  return app.evaluate(({ ipcMain }, cfg) => {
    const g = globalThis as AnyApi
    g.__t0663 ??= { orig: new Map<string, (...a: unknown[]) => unknown>(), calls: [] as unknown[] }
    const handlers = (ipcMain as AnyApi)._invokeHandlers as Map<string, (...a: unknown[]) => unknown>
    const prefixes = ['wsl:', 'wsl-systemd:', 'docker:', 'ssh:', 'server-bundle:']
    const extra = ['remote:detect-arch', 'remote:detect-tools', 'remote:test-connection']
    for (const channel of [...handlers.keys()]) {
      if ((prefixes.some(p => channel.startsWith(p)) || extra.includes(channel)) && !g.__t0663.orig.has(channel)) {
        g.__t0663.orig.set(channel, handlers.get(channel))
      }
    }
    for (const channel of g.__t0663.orig.keys() as Iterable<string>) {
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, async (event, ...args) => {
        const at = Date.now()
        if (Object.prototype.hasOwnProperty.call(cfg.stubs, channel)) {
          g.__t0663.calls.push({ channel, mode: 'stub', at })
          const v = cfg.stubs[channel] as AnyApi
          if (v && typeof v === 'object' && typeof v.__throw === 'string') throw new Error(v.__throw)
          return v
        }
        if (cfg.real.includes(channel)) {
          g.__t0663.calls.push({ channel, mode: 'real', args: channel === 'remote:test-connection' ? [args[0], args[1], '<token>', args[3]] : args, at })
          return g.__t0663.orig.get(channel)(event, ...args)
        }
        g.__t0663.calls.push({ channel, mode: 'blocked', at })
        throw new Error(`T0663 guard: ${channel} blocked`)
      })
    }
    return [...g.__t0663.orig.keys()]
  }, cfg)
}

async function guardCalls(app: ElectronApplication): Promise<Array<{ channel: string; mode: string; args?: unknown[]; at: number }>> {
  return app.evaluate(() => (globalThis as AnyApi).__t0663?.calls ?? [])
}

/** claude:* handlers that could reach the CLI / API answer from a recorder (read-only scans stay real). */
async function stubClaude(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(({ ipcMain }) => {
    const g = globalThis as AnyApi
    g.__t0663claude = [] as unknown[]
    const handlers = (ipcMain as AnyApi)._invokeHandlers as Map<string, unknown>
    const real = ['claude:scan-skills', 'claude:list-sessions', 'claude:scan-star-commands', 'claude:archive-messages', 'claude:load-archived', 'claude:clear-archive']
    const defaults: Record<string, unknown> = {
      'claude:start-session': true, 'claude:resume-session': true, 'claude:send-message': true,
      'claude:get-supported-models': [], 'claude:get-supported-commands': [], 'claude:get-supported-agents': [],
      'claude:auth-status': { loggedIn: true, email: 't0663-stub@example.invalid', authMethod: 'stub', subscriptionType: 'stub' }, 'claude:get-statusline-extras': {},
    }
    const stubbed: string[] = []
    for (const channel of [...handlers.keys()]) {
      if (!channel.startsWith('claude:') || real.includes(channel)) continue
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, async () => { g.__t0663claude.push(channel); return defaults[channel] ?? null })
      stubbed.push(channel)
    }
    return stubbed
  })
}

const DETECT_TOOLS_STUB = { ok: false, error: 'T0663 stub: remote tools not probed' }

// ── UI helpers ───────────────────────────────────────────────────────────────

async function openProfiles(win: Page): Promise<Locator> {
  const dialog = win.locator('.settings-panel.profile-panel')
  if (!(await dialog.isVisible().catch(() => false))) {
    await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
  }
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  return dialog
}

/**
 * Reloads the window. With live PTYs the Recovery prompt comes up (Terminal Server still has them);
 * "recover" keeps them, as a user would after a reload.
 */
async function reloadAndRecover(win: Page): Promise<boolean> {
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  const recover = win.locator('.recovery-prompt-dialog .btn-primary')
  const shown = await recover.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)
  if (shown) {
    await recover.click()
    await expect(win.locator('.recovery-prompt-overlay')).toHaveCount(0, { timeout: 10_000 })
  }
  return shown
}

function card(win: Page, profileId: string): Locator {
  return win.locator(`[data-testid="profile-card"][data-profile-id="${profileId}"]`)
}

function editModal(win: Page): Locator {
  return win.locator('.settings-panel', { has: win.locator('h2', { hasText: zh('profiles.editConnection') }) })
}

async function openEdit(win: Page, profileId: string): Promise<Locator> {
  await openProfiles(win)
  await card(win, profileId).locator(`button[title="${zh('profiles.editConnection')}"]`).click()
  const modal = editModal(win)
  await expect(modal).toBeVisible({ timeout: 10_000 })
  return modal
}

async function cancelEdit(win: Page): Promise<void> {
  const modal = editModal(win)
  await modal.getByRole('button', { name: zh('common.cancel'), exact: true }).click()
  await expect(modal).toHaveCount(0, { timeout: 10_000 })
}

function readProfileFromDisk(userData: string, id: string): AnyApi {
  const index = JSON.parse(fs.readFileSync(path.join(userData, 'profiles', 'index.json'), 'utf8'))
  return (index.profiles as AnyApi[]).find(p => p.id === id) ?? null
}

async function profileFromIpc(win: Page, id: string): Promise<AnyApi> {
  return win.evaluate(async (pid) => (window as AnyApi).electronAPI.profile.get(pid), id)
}

/** Visible text plus every title / aria-label / placeholder inside `root`. */
async function uiStrings(root: Locator): Promise<{ text: string; attrs: string[] }> {
  return root.evaluate((el) => {
    const attrs: string[] = []
    for (const node of [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[]) {
      for (const a of ['title', 'aria-label', 'placeholder']) {
        const v = node.getAttribute(a)
        if (v) attrs.push(v)
      }
    }
    return { text: (el as HTMLElement).innerText, attrs }
  })
}

function englishHits(s: { text: string; attrs: string[] }, extra: string[] = []): string[] {
  const words = [...BUG158_ENGLISH, ...extra]
  const hits = words.filter(w => s.text.includes(w) || s.attrs.some(a => a.includes(w)))
  // Single-word tooltips BUG-158 named (Open / Edit / Delete) only count as a whole attribute.
  for (const w of ['Open', 'Edit', 'Delete']) if (s.attrs.includes(w)) hits.push(`title="${w}"`)
  return hits
}

/** Every visible modal × (`.settings-close` / `.close-btn` / `.dialog-close-btn`) and its aria-label. */
async function closeButtonLabels(win: Page): Promise<Array<{ heading: string; cls: string; ariaLabel: string | null }>> {
  return win.locator('.settings-close:visible, .close-btn:visible, .dialog-close-btn:visible').evaluateAll(els => els.map(e => ({
    heading: (e.parentElement?.querySelector('h2, h3') as HTMLElement | null)?.innerText ?? '',
    cls: e.className,
    ariaLabel: e.getAttribute('aria-label'),
  })))
}

// ── version evidence ─────────────────────────────────────────────────────────

test.beforeAll(async () => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  fs.rmSync(RESULTS, { force: true })
  const fileVersion = (await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(Get-Item '${E2E_EXECUTABLE.replace(/'/g, "''")}').VersionInfo.FileVersion`], 20_000).catch(() => '?')).trim()
  record('ENV.file-version', fileVersion === EXPECTED_VERSION, [`executable ${E2E_EXECUTABLE} FileVersion ${fileVersion} (expected ${EXPECTED_VERSION})`])
})

async function checkAppVersion(inst: IsolatedInstance, tag: string): Promise<void> {
  const v = await inst.app.evaluate(({ app }) => app.getVersion())
  record(`ENV.app-version.${tag}`, v === EXPECTED_VERSION, [`runtime ${inst.runtimeId}: app.getVersion() = ${v}`])
}

// ── subject lane: V1 / V2 / V3 profiles strings / V4 menus ───────────────────

test.describe('T0663 subject lane (V1 / V2 / V3 / V4)', () => {
  test.describe.configure({ mode: 'serial' })

  const stamp = Date.now()
  const FAKE_OLD = 'AA:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE'
  const FAKE_CLOSED = 'BB:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF'
  let target: IsolatedInstance | undefined
  let subject: IsolatedInstance | undefined
  let server: { port: number; token: string; fingerprint: string }
  let closedPort = 0
  const ids: Record<string, string> = {}

  test.beforeAll(async () => {
    test.setTimeout(180_000)
    target = await launchIsolated('t0663-target', log)
    await checkAppVersion(target, 'target')
    const conn = await target.win.evaluate(async () => (window as AnyApi).electronAPI.tunnel.getConnection())
    const status = await target.win.evaluate(async () => (window as AnyApi).electronAPI.remote.serverStatus())
    if (!conn || 'error' in conn) throw new Error(`target tunnel.getConnection: ${JSON.stringify(conn)}`)
    expect(status.running).toBe(true)
    expect(status.port).toBe(target.remotePort)
    server = { port: target.remotePort, token: conn.token, fingerprint: conn.fingerprint }
    log(`target RemoteServer 127.0.0.1:${server.port} fingerprint ${server.fingerprint} (status.fingerprint ${status.fingerprint})`)
    expect(server.fingerprint).toBe(status.fingerprint)

    subject = await launchIsolated('t0663-subject', log)
    await checkAppVersion(subject, 'subject')
    log(`subject claude:* recorder: ${(await stubClaude(subject.app)).length} channels`)
    const guarded = await installGuard(subject.app, { stubs: { 'remote:detect-tools': DETECT_TOOLS_STUB }, real: ['remote:test-connection'] })
    log(`subject guard on ${guarded.length} channels; only remote:test-connection is real`)

    closedPort = await freePort()
    const made = await subject.win.evaluate(async ({ server, closedPort, FAKE_OLD, FAKE_CLOSED }) => {
      const api = (window as AnyApi).electronAPI
      const make = async (name: string, opts: Record<string, unknown>, update?: Record<string, unknown>) => {
        const created = await api.profile.create(name, { type: 'remote', ...opts })
        if (update) await api.profile.update(created.id, update)
        return created.id as string
      }
      const target = { remoteHost: '127.0.0.1', remotePort: server.port, remoteToken: server.token }
      // wsl-linux without wslDistro: the WSL keep-alive skips it, no wsl.exe is spawned for it.
      return {
        wsl: await make('T0663 WSL → target', { ...target, remoteFingerprint: FAKE_OLD }, { targetOS: 'wsl-linux' }),
        closed: await make('T0663 WSL → closed port', { remoteHost: '127.0.0.1', remotePort: closedPort, remoteToken: 'tok-closed', remoteFingerprint: FAKE_CLOSED }, { targetOS: 'wsl-linux' }),
        docker: await make('T0663 Docker → target', { ...target, remoteFingerprint: FAKE_OLD }, { targetOS: 'docker-linux' }),
        sshLinux: await make('T0663 SSH linux', { remoteHost: 'localhost', remotePort: server.port, remoteToken: 'tok-ssh', remoteFingerprint: 'SS:HH:01' },
          { targetOS: 'ssh-linux', sshHost: 'bat-t0663-never-connected', sshUser: '', useSshTunnel: true }),
        sshDarwin: await make('T0663 SSH darwin', { remoteHost: 'localhost', remotePort: server.port, remoteToken: 'tok-ssh', remoteFingerprint: 'SS:HH:02' },
          { targetOS: 'ssh-darwin', sshHost: 'bat-t0663-never-connected', sshUser: '', useSshTunnel: true }),
        legacy: await make('T0663 legacy (no targetOS)', { remoteHost: '127.0.0.1', remotePort: closedPort, remoteToken: 'tok-legacy', remoteFingerprint: 'LE:GA:CY' }),
      }
    }, { server, closedPort, FAKE_OLD, FAKE_CLOSED })
    Object.assign(ids, made)
    log(`profiles ${JSON.stringify(ids)} (closed port ${closedPort})`)

    // One workspace with a plain shell tab for the thumbnail bar (V4 b / c); no agent is started.
    const seed = {
      workspaces: [{ id: `e2e-t0663-ws-${stamp}`, name: 'T0663', folderPath: os.tmpdir(), createdAt: Date.now() }],
      activeWorkspaceId: `e2e-t0663-ws-${stamp}`,
      activeGroup: null,
      terminals: [{ id: `e2e-t0663-term-${stamp}`, workspaceId: `e2e-t0663-ws-${stamp}`, type: 'terminal', title: 'T0663 shell', cwd: os.tmpdir() }],
      activeTerminalId: `e2e-t0663-term-${stamp}`,
    }
    expect(await subject.win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    log(`seed reload: recovery prompt answered ${await reloadAndRecover(subject.win)}`)
    await expect(subject.win.locator('.workspace-container.active .thumbnail').first()).toBeVisible({ timeout: 30_000 })
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    if (subject) {
      const calls = await guardCalls(subject.app).catch(() => [])
      fs.writeFileSync(path.join(EVIDENCE_DIR, 'subject-guard-calls.json'), JSON.stringify(calls, null, 2))
      const claudeCalls = await subject.app.evaluate(() => (globalThis as AnyApi).__t0663claude ?? []).catch(() => [])
      log(`subject claude:* calls answered by the recorder: ${JSON.stringify(claudeCalls)}`)
    }
    await closeAndCheck(subject, 'subject')
    await closeAndCheck(target, 'target')
  })

  test('V1 (BUG-157): pin → field shows the server fingerprint → Save keeps it; closed port shows an error', async () => {
    test.setTimeout(180_000)
    const { win, userData } = subject!

    // (a) pin → the field changes at once
    const modal = await openEdit(win, ids.wsl)
    const field = modal.locator('input[readonly]')
    const before = await field.inputValue()
    const pinBtn = modal.getByRole('button', { name: zh('profiles.fingerprint.pin'), exact: true })
    await pinBtn.click()
    await expect.poll(() => field.inputValue(), { timeout: 20_000 }).toBe(server.fingerprint).catch(() => { /* recorded below */ })
    const afterPin = await field.inputValue()
    const ipcAfterPin = (await profileFromIpc(win, ids.wsl))?.remoteFingerprint
    await shot(win, 'v1a-after-pin')
    const pinCalls = (await guardCalls(subject!.app)).filter(c => c.channel === 'remote:test-connection')
    record('V1.a-pin-updates-field', before === FAKE_OLD && afterPin === server.fingerprint && ipcAfterPin === server.fingerprint, [
      `field before ${before}`, `field after pin ${afterPin}`, `target fingerprint ${server.fingerprint}`,
      `profile:get after pin ${ipcAfterPin}`, `remote:test-connection calls ${JSON.stringify(pinCalls.map(c => c.args))}`])

    // (b) Save → reopen → reload: still the new value (IPC + profiles/index.json)
    await modal.getByRole('button', { name: zh('common.save'), exact: true }).click()
    await expect(editModal(win)).toHaveCount(0, { timeout: 10_000 })
    const ipcAfterSave = (await profileFromIpc(win, ids.wsl))?.remoteFingerprint
    const diskAfterSave = readProfileFromDisk(userData, ids.wsl)?.remoteFingerprint
    const reopened = await (await openEdit(win, ids.wsl)).locator('input[readonly]').inputValue()
    await cancelEdit(win)
    const recovered = await reloadAndRecover(win)
    const afterReload = await (await openEdit(win, ids.wsl)).locator('input[readonly]').inputValue()
    await shot(win, 'v1b-after-save-reload')
    await cancelEdit(win)
    const diskAfterReload = readProfileFromDisk(userData, ids.wsl)?.remoteFingerprint
    record('V1.b-save-keeps-new-value', [ipcAfterSave, diskAfterSave, reopened, afterReload, diskAfterReload].every(v => v === server.fingerprint), [
      `after Save: profile:get ${ipcAfterSave}; ${path.join(userData, 'profiles', 'index.json')} ${diskAfterSave}`,
      `dialog reopened ${reopened}`, `after window reload (Recovery prompt answered: ${recovered}), dialog ${afterReload}; disk ${diskAfterReload}`])

    // (c) the saved profile connects (saved host / port / token / fingerprint) and the card probes it
    const saved = readProfileFromDisk(userData, ids.wsl)
    const ok = await win.evaluate(async (p) => (window as AnyApi).electronAPI.remote.testConnection(p.remoteHost, p.remotePort, p.remoteToken, p.remoteFingerprint), saved)
    const old = await win.evaluate(async ({ p, fp }) => (window as AnyApi).electronAPI.remote.testConnection(p.remoteHost, p.remotePort, p.remoteToken, fp), { p: saved, fp: FAKE_OLD })
    await openProfiles(win)
    const light = card(win, ids.wsl).locator('[data-testid="profile-card-status"]')
    await expect.poll(async () => light.getAttribute('title'), { timeout: 30_000 }).toMatch(/伺服器可連線|已連線/).catch(() => { /* recorded below */ })
    const lightState = { status: await light.getAttribute('data-status'), title: await light.getAttribute('title') }
    await shot(win, 'v1c-card-reachable')
    record('V1.c-profile-connects', ok.ok === true && ok.fingerprint === server.fingerprint && old.ok === false && /伺服器可連線|已連線/.test(lightState.title ?? ''), [
      `testConnection(saved profile) → ${JSON.stringify({ ok: ok.ok, fingerprint: ok.fingerprint, errorCode: ok.errorCode })}`,
      `contrast, old fingerprint → ${JSON.stringify({ ok: old.ok, errorCode: old.errorCode, error: old.error })}`,
      `card light ${JSON.stringify(lightState)}`])

    // (d) closed port: red error, field and profile unchanged (also after Save)
    const m2 = await openEdit(win, ids.closed)
    const f2 = m2.locator('input[readonly]')
    await m2.getByRole('button', { name: zh('profiles.fingerprint.pin'), exact: true }).click()
    const alert = m2.locator('[role="alert"]')
    await expect(alert).toBeVisible({ timeout: 20_000 }).catch(() => { /* recorded below */ })
    const alertText = await alert.innerText().catch(() => '')
    const alertColor = await alert.evaluate(e => getComputedStyle(e).color).catch(() => '')
    const f2After = await f2.inputValue()
    const ipcClosed = (await profileFromIpc(win, ids.closed))?.remoteFingerprint
    await shot(win, 'v1d-closed-port-error')
    await m2.getByRole('button', { name: zh('common.save'), exact: true }).click()
    await expect(editModal(win)).toHaveCount(0, { timeout: 10_000 })
    const diskClosed = readProfileFromDisk(userData, ids.closed)?.remoteFingerprint
    const red = /rgb\(229, 83, 75\)/.test(alertColor)
    record('V1.d-closed-port-error', alertText.startsWith(zh('profiles.statusReason.probeFailed').split('{{')[0]) && red
      && f2After === FAKE_CLOSED && ipcClosed === FAKE_CLOSED && diskClosed === FAKE_CLOSED, [
      `pin against 127.0.0.1:${closedPort} (closed): alert ${JSON.stringify(alertText)} color ${alertColor}`,
      `field after failed pin ${f2After}; profile:get ${ipcClosed}; after Save disk ${diskClosed} (expected ${FAKE_CLOSED})`])
  })

  test('V2 (BUG-160): pin disabled with the wizard hint for SSH profiles; WSL / Docker unchanged', async () => {
    test.setTimeout(120_000)
    const { win, app } = subject!
    const lines: string[] = []
    let ok = true
    for (const id of [ids.sshLinux, ids.sshDarwin]) {
      const modal = await openEdit(win, id)
      const btn = modal.getByRole('button', { name: zh('profiles.fingerprint.pin'), exact: true })
      const disabled = await btn.isDisabled()
      const title = await btn.getAttribute('title')
      const hint = await modal.getByText(zh('profiles.fingerprint.pinSshDisabled'), { exact: true }).count()
      const callsBefore = (await guardCalls(app)).filter(c => c.channel === 'remote:test-connection').length
      await btn.click({ force: true, timeout: 2_000 }).catch(() => { /* disabled */ })
      await win.waitForTimeout(1_000)
      const callsAfter = (await guardCalls(app)).filter(c => c.channel === 'remote:test-connection').length
      const field = await modal.locator('input[readonly]').inputValue()
      const targetOS = (await profileFromIpc(win, id))?.targetOS
      await shot(win, `v2-${targetOS}-pin-disabled`)
      await cancelEdit(win)
      const good = disabled && title === zh('profiles.fingerprint.pinSshDisabled') && hint === 1 && callsAfter === callsBefore && field.startsWith('SS:HH')
      ok &&= good
      lines.push(`${good ? '✓' : '✗'} ${targetOS}: disabled=${disabled} title=${JSON.stringify(title)} hint shown=${hint} test-connection calls ${callsBefore}→${callsAfter} after a forced click; field ${field}`)
    }
    for (const id of [ids.wsl, ids.docker]) {
      const modal = await openEdit(win, id)
      const btn = modal.getByRole('button', { name: zh('profiles.fingerprint.pin'), exact: true })
      const enabled = await btn.isEnabled()
      const title = await btn.getAttribute('title')
      const hint = await modal.getByText(zh('profiles.fingerprint.pinSshDisabled'), { exact: true }).count()
      const targetOS = (await profileFromIpc(win, id))?.targetOS
      if (targetOS === 'docker-linux') await shot(win, 'v2-docker-linux-pin-enabled')
      await cancelEdit(win)
      const good = enabled && title === zh('profiles.fingerprint.pinTitle') && hint === 0
      ok &&= good
      lines.push(`${good ? '✓' : '✗'} ${targetOS}: enabled=${enabled} title=${JSON.stringify(title)} hint shown=${hint}`)
    }
    record('V2.ssh-pin-disabled', ok, lines)
  })

  test('V3 (BUG-158) profiles dialog strings + V4 d × aria-label (subject)', async () => {
    test.setTimeout(120_000)
    const { win } = subject!
    const dialog = await openProfiles(win)
    await expect(dialog.locator('h2').first()).toHaveText(zh('profiles.title'))

    // card tooltips (↗ / ✎ / ✕)
    const c = card(win, ids.wsl)
    const tips = {
      switch: await c.locator('[data-testid="profile-card-switch"]').getAttribute('title'),
      rename: await c.locator('[data-testid="profile-card-edit"]').getAttribute('title'),
      delete: await c.locator('[data-testid="profile-card-delete"]').getAttribute('title'),
    }
    record('V3.card-tooltips', tips.switch === zh('profiles.switchProfile') && tips.rename === zh('profiles.rename') && tips.delete === zh('profiles.deleteProfile'),
      [`↗ ${JSON.stringify(tips.switch)} / ✎ ${JSON.stringify(tips.rename)} / ✕ ${JSON.stringify(tips.delete)}`])

    // legacy targetOS banner (profile without targetOS)
    const legacy = card(win, ids.legacy)
    if (await legacy.locator('.profile-card-body').count() === 0) await legacy.locator('.profile-card-toggle').click()
    const banner = legacy.locator('[data-testid="legacy-remote-targetos-prompt"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    const bannerText = await banner.innerText()
    const placeholder = await banner.locator('option[value=""]').innerText()
    await banner.scrollIntoViewIfNeeded()
    await shot(win, 'v3-legacy-banner')
    record('V3.legacy-banner', bannerText.includes(zh('profiles.legacyTargetOsPrompt')) && placeholder === zh('profiles.selectTargetOs') && !bannerText.includes('This profile has no targetOS'),
      [`banner ${JSON.stringify(bannerText)}`, `select placeholder ${JSON.stringify(placeholder)}`])
    const toggleTitles = await dialog.locator('.profile-card-toggle').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('title')))])

    // edit-connection strings
    const modal = await openEdit(win, ids.wsl)
    const pinText = await modal.getByRole('button', { name: zh('profiles.fingerprint.pin'), exact: true }).innerText()
    const fieldPh = await modal.locator('input[readonly]').getAttribute('placeholder')
    const urlPh = await modal.locator('input').first().getAttribute('placeholder')
    const editStrings = await uiStrings(modal)
    const dialogStrings = await uiStrings(dialog)
    const closeLabels = await closeButtonLabels(win)
    await shot(win, 'v3-edit-connection-zh-TW')
    await cancelEdit(win)
    const hits = [...new Set([...englishHits(editStrings), ...englishHits(dialogStrings)])]
    record('V3.edit-connection-and-dialog', pinText === zh('profiles.fingerprint.pin') && fieldPh === zh('profiles.fingerprint.pinnedPlaceholder')
      && urlPh === zh('profiles.connectionUrlPlaceholder') && hits.length === 0, [
      `pin button ${JSON.stringify(pinText)}`, `fingerprint placeholder ${JSON.stringify(fieldPh)}`, `URL placeholder ${JSON.stringify(urlPh)}`,
      `BUG-158 English strings in the profiles dialog + edit dialog: ${hits.length === 0 ? 'none' : hits.join(', ')}`,
      `not in BUG-158's list, still English: card expand toggle title/aria-label ${JSON.stringify(toggleTitles)}`])

    // × aria-label: profiles dialog + edit dialog (wizards in the wizard lane), Settings
    await openProfiles(win)
    await openEdit(win, ids.wsl)
    const both = await closeButtonLabels(win)
    await cancelEdit(win)
    await win.locator('.settings-panel.profile-panel .settings-close').click()
    await expect(win.locator('.settings-panel.profile-panel')).toHaveCount(0, { timeout: 10_000 })
    await win.locator('.sidebar-footer-buttons .settings-btn').nth(1).click()
    await expect(win.locator('.settings-panel').first()).toBeVisible({ timeout: 10_000 })
    const settings = await closeButtonLabels(win)
    await win.keyboard.press('Escape')
    await expect(win.locator('.settings-panel')).toHaveCount(0, { timeout: 10_000 })
    const all = [...closeLabels, ...both, ...settings]
    record('V4.d-close-aria-label.subject', both.length >= 2 && settings.length >= 1 && all.every(x => x.ariaLabel === zh('common.close')),
      all.map(x => `× .${x.cls} in "${x.heading}": aria-label=${JSON.stringify(x.ariaLabel)}`))
  })

  test('V4 b / c (BUG-161): "+" menu suggested tag, thumbnail context menu', async () => {
    test.setTimeout(60_000)
    const { win } = subject!
    const view = win.locator('.workspace-container.active')
    await view.locator('.thumbnail-add-btn').click()
    const tags = win.locator('.thumbnail-add-menu-suggested')
    await expect(tags.first()).toBeVisible({ timeout: 10_000 })
    const tagTexts = await tags.allInnerTexts()
    const rows = await win.locator('.thumbnail-add-menu-item').allInnerTexts()
    await shot(win, 'v4b-add-menu-suggested')
    await view.locator('.thumbnail-add-btn').click()
    record('V4.b-suggested', tagTexts.length > 0 && tagTexts.every(t => t.trim() === zh('profiles.addMenuSuggested')), [
      `suggested tags ${JSON.stringify(tagTexts)}`, `menu rows ${JSON.stringify(rows.map(r => r.replace(/\s+/g, ' ').trim()))}`])

    await view.locator('.thumbnail').first().click({ button: 'right' })
    const menu = win.locator('.context-menu')
    await expect(menu).toBeVisible({ timeout: 10_000 })
    const items = await menu.locator('.context-menu-item').allInnerTexts()
    await shot(win, 'v4c-thumbnail-context-menu')
    await win.keyboard.press('Escape')
    await win.mouse.click(5, 5)
    const set = items.find(i => i.includes(zh('workspace.setSupervisor')))
    record('V4.c-set-supervisor', set !== undefined && !items.some(i => /Supervisor/.test(i)), [`context menu ${JSON.stringify(items)}`])
  })
})

// ── wizard lane: V3 / V4 / V5 ────────────────────────────────────────────────

const WSL_TWO = { distros: [{ name: 'Ubuntu-24.04', version: 2, state: 'Running' }, { name: 'Debian', version: 2, state: 'Stopped' }], default: 'Ubuntu-24.04' }
const WSL_ONE_V1 = { distros: [{ name: 'T0663-Legacy', version: 1, state: 'Stopped' }], default: 'T0663-Legacy' }
const WSL_ONE_V2 = { distros: [{ name: 'T0663-Stub', version: 2, state: 'Running' }], default: 'T0663-Stub' }
const SSH_HOSTS = ['dev-server', 'build-box']
const DOCKER_OK = { available: true, version: '28.3.2' }
/** Stubs that every wizard scenario starts from; scenarios override some. */
const BASE_STUBS: Record<string, unknown> = {
  'wsl:list': WSL_TWO,
  'ssh:list-hosts': SSH_HOSTS,
  'docker:status': DOCKER_OK,
  'docker:list-containers': [],
  'remote:detect-tools': DETECT_TOOLS_STUB,
}

type WizardKind = 'wsl' | 'docker' | 'ssh'
const WIZARD_TITLE: Record<WizardKind, string> = { wsl: 'profiles.addWslProfile', docker: 'profiles.addDockerProfile', ssh: 'profiles.addSshProfile' }

async function openWizard(win: Page, kind: WizardKind): Promise<Locator> {
  const dialog = await openProfiles(win)
  await dialog.getByRole('button', { name: zh('profiles.addMore') }).click()
  await win.locator('.thumbnail-add-menu-item', { hasText: zh(WIZARD_TITLE[kind]) }).click()
  const shell = win.locator('.bat-wizard-shell')
  await expect(shell).toBeVisible({ timeout: 15_000 })
  return shell
}

async function wizardTitle(win: Page): Promise<string> {
  return win.locator('.settings-panel', { has: win.locator('.bat-wizard-shell') }).locator('.settings-header h2').innerText()
}

async function closeWizard(win: Page): Promise<void> {
  await win.locator('.settings-panel', { has: win.locator('.bat-wizard-shell') }).locator('.settings-close').click()
  await expect(win.locator('.bat-wizard-shell')).toHaveCount(0, { timeout: 30_000 })
}

async function mappedError(shell: Locator): Promise<{ title: string; body: string }> {
  const box = shell.locator('.bat-wizard-mapped-error').first()
  await expect(box).toBeVisible({ timeout: 45_000 })
  return {
    title: (await box.locator('.bat-wizard-mapped-error-title').innerText()).trim(),
    body: (await box.locator('.bat-wizard-mapped-error-body').innerText().catch(() => '')).trim(),
  }
}

interface Style { cls: string; bg: string; color: string; border: string; radius: string; padding: string; outline: string; boxShadow: string; rect: { x: number; y: number; width: number; height: number } }

async function styleOf(loc: Locator): Promise<Style> {
  return loc.evaluate((el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      cls: el.className, bg: cs.backgroundColor, color: cs.color,
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`, radius: cs.borderTopLeftRadius, padding: cs.padding,
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    }
  })
}

const NATIVE_BG = new Set(['rgb(255, 255, 255)', 'rgb(239, 239, 239)', 'rgb(240, 240, 240)', 'rgba(0, 0, 0, 0)'])

/** Focus by keyboard (Tab) so :focus-visible applies; false when Tab never reaches the element. */
async function tabTo(page: Page, loc: Locator): Promise<boolean> {
  await page.locator('.bat-wizard-shell').click({ position: { x: 2, y: 2 } }).catch(() => { /* outside */ })
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    if (await loc.evaluate(el => el === document.activeElement)) return true
  }
  return false
}

/** BUG-163 checks on a wizard's choice buttons; returns [ok, evidence]. */
async function checkChoiceButtons(page: Page, shell: Locator, kind: WizardKind): Promise<[boolean, string[]]> {
  const buttons = shell.locator('#bat-wizard-active-prompt button.bat-wizard-choice')
  const n = await buttons.count()
  const styles: Style[] = []
  for (let i = 0; i < n; i++) styles.push(await styleOf(buttons.nth(i)))
  const lines: string[] = [`${kind}: ${n} choice buttons`]
  let ok = n >= 2
  for (const [i, s] of styles.entries()) {
    const good = /\bprofile-action-btn\b/.test(s.cls) && /\bbat-wizard-choice\b/.test(s.cls) && !NATIVE_BG.has(s.bg) && / solid /.test(s.border) && parseFloat(s.border) > 0
    ok &&= good
    lines.push(`${good ? '✓' : '✗'} button ${i}: class "${s.cls}" bg ${s.bg} color ${s.color} border ${s.border} radius ${s.radius} padding ${s.padding}`)
  }
  // spacing between neighbours (same row → horizontal gap, otherwise vertical)
  const gaps: number[] = []
  for (let i = 1; i < styles.length; i++) {
    const a = styles[i - 1].rect
    const b = styles[i].rect
    gaps.push(Math.abs(a.y - b.y) < 4 ? b.x - (a.x + a.width) : b.y - (a.y + a.height))
  }
  const containerGap = await shell.locator('#bat-wizard-active-prompt .bat-wizard-actions').first().evaluate(e => getComputedStyle(e).gap)
  ok &&= gaps.every(g => g >= 4)
  lines.push(`${gaps.every(g => g >= 4) ? '✓' : '✗'} gaps between buttons ${JSON.stringify(gaps.map(g => Math.round(g)))} px (.bat-wizard-actions gap ${containerGap})`)
  // hover
  const first = buttons.first()
  await page.mouse.move(1, 1)
  const idle = await styleOf(first)
  await first.hover()
  await page.waitForTimeout(250)
  const hovered = await styleOf(first)
  await page.mouse.move(1, 1)
  const hoverChanged = hovered.bg !== idle.bg || hovered.border !== idle.border
  ok &&= hoverChanged
  lines.push(`${hoverChanged ? '✓' : '✗'} hover: bg ${idle.bg} → ${hovered.bg}`)
  // keyboard focus
  const reached = await tabTo(page, first)
  const focused = await styleOf(first)
  const focusVisible = await first.evaluate(el => el.matches(':focus-visible'))
  const focusChanged = reached && (focused.outline !== idle.outline || focused.boxShadow !== idle.boxShadow || focused.border !== idle.border)
  ok &&= focusChanged
  lines.push(`${focusChanged ? '✓' : '✗'} keyboard focus (Tab reached: ${reached}, :focus-visible ${focusVisible}): outline ${idle.outline} → ${focused.outline}; box-shadow ${idle.boxShadow} → ${focused.boxShadow}`)
  await first.evaluate(el => (el as HTMLElement).blur())
  return [ok, lines]
}

function staleHits(text: string): string[] {
  return STALE_STEP_TEXT.filter(s => text.includes(s))
}

test.describe('T0663 wizard lane (V3 / V4 / V5)', () => {
  test.describe.configure({ mode: 'serial' })

  let wiz: IsolatedInstance | undefined
  const sshConn = fs.existsSync(SSH_CONNECTION) ? JSON.parse(fs.readFileSync(SSH_CONNECTION, 'utf8')) as { alias: string; container: string; sshPort: number } : null

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    wiz = await launchIsolated('t0663-wizard', log)
    await checkAppVersion(wiz, 'wizard')
    log(`wizard claude:* recorder: ${(await stubClaude(wiz.app)).length} channels`)
    const guarded = await installGuard(wiz.app, { stubs: BASE_STUBS, real: [] })
    log(`wizard guard on ${guarded.length} channels: ${guarded.join(', ')}`)
    await expect(wiz.win.locator('.sidebar-footer-buttons .settings-btn').first()).toBeVisible({ timeout: 30_000 })
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    if (wiz) {
      const calls = await guardCalls(wiz.app).catch(() => [])
      fs.writeFileSync(path.join(EVIDENCE_DIR, 'wizard-guard-calls.json'), JSON.stringify(calls, null, 2))
      const blocked = calls.filter(c => c.mode === 'blocked')
      const real = calls.filter(c => c.mode === 'real')
      record('SAFETY.wizard-no-write', blocked.length === 0, [
        `guard calls: ${calls.length} (stub ${calls.filter(c => c.mode === 'stub').length}, real ${real.length}, blocked ${blocked.length})`,
        `real (read-only) calls: ${JSON.stringify([...new Set(real.map(c => c.channel))])}`,
        `blocked calls (would have run a write / unlisted channel): ${blocked.length === 0 ? 'none' : JSON.stringify(blocked.map(c => c.channel))}`])
    }
    await closeAndCheck(wiz, 'wizard')
  })

  test('V4 a: natural "no Docker daemon" error (real docker:status on this host)', async () => {
    test.setTimeout(120_000)
    const { app, win } = wiz!
    const stubs = { ...BASE_STUBS }
    delete stubs['docker:status']
    await installGuard(app, { stubs, real: ['docker:status'] })
    const shell = await openWizard(win, 'docker')
    const err = await mappedError(shell)
    const stepRows = await shell.locator('.bat-stepper-failed, [data-status="failed"]').allInnerTexts().catch(() => [])
    await shot(win, 'v4a-docker-daemon-down')
    const closeLabel = await closeButtonLabels(win)
    await closeWizard(win)
    await installGuard(app, { stubs: BASE_STUBS, real: [] })
    record('V4.a-docker-daemon-down', err.title === zh('wizard.docker.error.daemonUnavailable.title') && err.body === zh('wizard.docker.error.daemonUnavailable.body'), [
      `mapped error title ${JSON.stringify(err.title)} body ${JSON.stringify(err.body)}`, `failed step rows ${JSON.stringify(stepRows)}`,
      `× ${JSON.stringify(closeLabel)}`])
  })

  test('Docker wizard: title, mode buttons + descriptions, button styles, "Use existing" with no containers', async () => {
    test.setTimeout(120_000)
    const { win } = wiz!
    const shell = await openWizard(win, 'docker')
    const title = await wizardTitle(win)
    const prompt = shell.locator('#bat-wizard-active-prompt')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    await win.waitForTimeout(500)
    const labels = await prompt.locator('button.bat-wizard-choice').allInnerTexts()
    const descs = await prompt.locator('.bat-wizard-choice-item .bat-wizard-prompt-description').evaluateAll(els => els.map(e => ({ text: (e as HTMLElement).innerText, visible: (e as HTMLElement).offsetHeight > 0, id: e.id })))
    const describedBy = await prompt.locator('button.bat-wizard-choice').evaluateAll(els => els.map(e => e.getAttribute('aria-describedby')))
    const promptTitle = await prompt.locator('.bat-wizard-prompt-title').innerText()
    const shellText = await shell.innerText()
    await shot(win, 'v5-wizard-docker')
    const [styleOk, styleLines] = await checkChoiceButtons(win, shell, 'docker')
    const closeLabel = await closeButtonLabels(win)

    record('V3.docker-wizard-title-and-modes', title === zh('profiles.addDockerProfile') && promptTitle === zh('wizard.docker.pickContainer.title')
      && labels.join('|') === [zh('wizard.docker.pickContainer.new.label'), zh('wizard.docker.pickContainer.existing.label')].join('|')
      && englishHits({ text: shellText, attrs: [] }).length === 0, [
      `modal title ${JSON.stringify(title)}`, `prompt ${JSON.stringify(promptTitle)}`, `buttons ${JSON.stringify(labels)}`,
      `BUG-158 English strings in the wizard: ${englishHits({ text: shellText, attrs: [] }).join(', ') || 'none'}`])
    record('V4.e-docker-option-descriptions', descs.length === 2 && descs.every(d => d.visible)
      && descs[0].text === zh('wizard.docker.pickContainer.new.description') && descs[1].text === zh('wizard.docker.pickContainer.existing.description')
      && describedBy.every((d, i) => d === descs[i]?.id), [
      `descriptions ${JSON.stringify(descs)}`, `buttons aria-describedby ${JSON.stringify(describedBy)}`])
    record('V5.docker-buttons', styleOk, styleLines)
    const stale = staleHits(shellText)
    record('V5.docker-step-text', stale.length === 0 && shellText.includes(zh('wizard.docker.step.pickContainer.description')) && shellText.includes(zh('wizard.docker.step.configureMounts.label')), [
      `stale step text: ${stale.join(', ') || 'none'}`, `current descriptions present: pickContainer ${shellText.includes(zh('wizard.docker.step.pickContainer.description'))}, configureMounts label ${shellText.includes(zh('wizard.docker.step.configureMounts.label'))}`])

    // "Use existing" with no containers → docker-no-containers (stubbed list, nothing is created)
    await prompt.getByRole('button', { name: zh('wizard.docker.pickContainer.existing.label'), exact: true }).click()
    const err = await mappedError(shell)
    await shot(win, 'v4a-docker-no-containers')
    await closeWizard(win)
    record('V4.a-docker-no-containers', err.title === zh('wizard.docker.error.noContainers.title') && err.body === zh('wizard.docker.error.noContainers.body'), [
      `mapped error title ${JSON.stringify(err.title)} body ${JSON.stringify(err.body)}`, `× ${JSON.stringify(closeLabel)}`])
  })

  test('WSL wizard: title, distro menu, button styles', async () => {
    test.setTimeout(120_000)
    const { win } = wiz!
    const shell = await openWizard(win, 'wsl')
    const title = await wizardTitle(win)
    const prompt = shell.locator('#bat-wizard-active-prompt')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    await win.waitForTimeout(500)
    const promptTitle = await prompt.locator('.bat-wizard-prompt-title').innerText()
    const promptDesc = await prompt.locator(':scope > .bat-wizard-prompt-description').innerText()
    const labels = await prompt.locator('button.bat-wizard-choice').allInnerTexts()
    const descs = await prompt.locator('.bat-wizard-choice-item .bat-wizard-prompt-description').allInnerTexts()
    const shellText = await shell.innerText()
    await shot(win, 'v5-wizard-wsl')
    const [styleOk, styleLines] = await checkChoiceButtons(win, shell, 'wsl')
    const closeLabel = await closeButtonLabels(win)
    await closeWizard(win)
    const wantDescs = WSL_TWO.distros.map(d => zh('wizard.wsl.pickDistro.optionDescription')
      .replace('{{state}}', zh(`wizard.wsl.pickDistro.state.${d.state}`)).replace('{{version}}', String(d.version)))
    record('V3.wsl-wizard-title-and-distro-menu', title === zh('profiles.addWslProfile') && promptTitle === zh('wizard.wsl.pickDistro.title')
      && promptDesc === zh('wizard.wsl.pickDistro.description') && labels.join('|') === 'Ubuntu-24.04|Debian' && descs.join('|') === wantDescs.join('|')
      && englishHits({ text: shellText, attrs: [] }).length === 0, [
      `modal title ${JSON.stringify(title)}`, `prompt ${JSON.stringify(promptTitle)} / ${JSON.stringify(promptDesc)}`,
      `options ${JSON.stringify(labels)} descriptions ${JSON.stringify(descs)} (expected ${JSON.stringify(wantDescs)})`,
      `BUG-158 English strings in the wizard: ${englishHits({ text: shellText, attrs: [] }).join(', ') || 'none'}`, `× ${JSON.stringify(closeLabel)}`])
    record('V5.wsl-buttons', styleOk, styleLines)
    const stale = staleHits(shellText)
    record('V5.wsl-step-text', stale.length === 0 && shellText.includes(zh('wizard.wsl.step.pickDistro.description')) && shellText.includes(zh('wizard.wsl.step.writeSystemdUnit.label')), [
      `stale step text: ${stale.join(', ') || 'none'}`, `current pickDistro description present ${shellText.includes(zh('wizard.wsl.step.pickDistro.description'))}, writeSystemdUnit label ${shellText.includes(zh('wizard.wsl.step.writeSystemdUnit.label'))}`])
  })

  test('WSL wizard: WSL1-only warning + requires-WSL2 error (stubbed list)', async () => {
    test.setTimeout(120_000)
    const { app, win } = wiz!
    await installGuard(app, { stubs: { ...BASE_STUBS, 'wsl:list': WSL_ONE_V1 }, real: [] })
    const shell = await openWizard(win, 'wsl')
    const err = await mappedError(shell)
    const warnings = await shell.locator('.bat-wizard-warnings p').allInnerTexts()
    await shot(win, 'v3-wsl1-warning')
    await closeWizard(win)
    await installGuard(app, { stubs: BASE_STUBS, real: [] })
    record('V3.wsl1-warning', warnings.includes(zh('wizard.wsl.warning.wsl1Only')), [`warnings ${JSON.stringify(warnings)}`])
    record('V4.a-wsl-requires-wsl2', err.title === zh('wizard.wsl.error.requiresWsl2.title') && err.body === zh('wizard.wsl.error.requiresWsl2.body'),
      [`mapped error title ${JSON.stringify(err.title)} body ${JSON.stringify(err.body)}`])
  })

  test('WSL wizard: systemd-disabled warning, stopped before any install (stubbed)', async () => {
    test.setTimeout(120_000)
    const { app, win } = wiz!
    // One WSL2 distro is picked automatically; systemd off → warning; resolve-home answers '' so the
    // install step stops at wsl-home-unresolved before any download / install channel.
    await installGuard(app, { stubs: { ...BASE_STUBS, 'wsl:list': WSL_ONE_V2, 'wsl:systemd-enabled': false, 'wsl:resolve-home': '' }, real: [] })
    const shell = await openWizard(win, 'wsl')
    const err = await mappedError(shell)
    const warnings = await shell.locator('.bat-wizard-warnings p').allInnerTexts()
    await shot(win, 'v3-wsl-systemd-warning')
    await closeWizard(win)
    await installGuard(app, { stubs: BASE_STUBS, real: [] })
    record('V3.wsl-systemd-warning', warnings.includes(zh('wizard.wsl.warning.systemdDisabled')), [`warnings ${JSON.stringify(warnings)}`])
    record('V4.a-wsl-home-unresolved', err.title === zh('wizard.wsl.error.homeUnresolved.title') && err.body === zh('wizard.wsl.error.homeUnresolved.body'),
      [`mapped error title ${JSON.stringify(err.title)} body ${JSON.stringify(err.body)}`])
  })

  test('SSH wizard: title, host buttons, manual-host input styles, step text', async () => {
    test.setTimeout(120_000)
    const { win } = wiz!
    const shell = await openWizard(win, 'ssh')
    const title = await wizardTitle(win)
    const prompt = shell.locator('#bat-wizard-active-prompt')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    await win.waitForTimeout(500)
    const labels = await prompt.locator('button.bat-wizard-choice').allInnerTexts()
    const shellText = await shell.innerText()
    await shot(win, 'v5-wizard-ssh')
    const [styleOk, styleLines] = await checkChoiceButtons(win, shell, 'ssh')

    await prompt.getByRole('button', { name: zh('wizard.ssh.manualHost.option'), exact: true }).click()
    const input = shell.locator('#bat-wizard-active-prompt input.bat-wizard-text-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await win.waitForTimeout(300)
    const submit = shell.locator('#bat-wizard-active-prompt button.profile-action-btn.primary')
    const inputIdle = await input.evaluate((el) => { const cs = getComputedStyle(el); return { cls: el.className, bg: cs.backgroundColor, border: cs.borderTopColor, color: cs.color } })
    await input.evaluate(el => (el as HTMLElement).blur())
    const blurred = await input.evaluate((el) => getComputedStyle(el).borderTopColor)
    await input.focus()
    const focused = await input.evaluate((el) => getComputedStyle(el).borderTopColor)
    const submitStyle = await styleOf(submit)
    await shot(win, 'v5-wizard-ssh-manual-host')
    const inputOk = /\bprofile-name-input\b/.test(inputIdle.cls) && !NATIVE_BG.has(inputIdle.bg) && blurred !== focused
      && /\bprofile-action-btn\b/.test(submitStyle.cls) && /\bprimary\b/.test(submitStyle.cls) && !NATIVE_BG.has(submitStyle.bg)
    await shell.locator('#bat-wizard-active-prompt').getByRole('button', { name: zh('wizard.action.cancelText'), exact: true }).click().catch(() => { /* step may already be gone */ })
    const closeLabel = await closeButtonLabels(win)
    await closeWizard(win)

    record('V3.ssh-wizard-title', title === zh('profiles.addSshProfile') && englishHits({ text: shellText, attrs: [] }).length === 0,
      [`modal title ${JSON.stringify(title)}`, `host buttons ${JSON.stringify(labels)}`, `BUG-158 English strings in the wizard: ${englishHits({ text: shellText, attrs: [] }).join(', ') || 'none'}`, `× ${JSON.stringify(closeLabel)}`])
    record('V5.ssh-buttons', styleOk, styleLines)
    record('V5.ssh-text-input', inputOk, [
      `input class "${inputIdle.cls}" bg ${inputIdle.bg} color ${inputIdle.color}; border ${blurred} → focused ${focused}`,
      `submit class "${submitStyle.cls}" bg ${submitStyle.bg} border ${submitStyle.border}`])
    const stale = staleHits(shellText)
    record('V5.ssh-step-text', stale.length === 0 && shellText.includes(zh('wizard.ssh.step.configureHost.description')) && shellText.includes(zh('wizard.ssh.step.verifyAuth.description')), [
      `stale step text: ${stale.join(', ') || 'none'}`,
      `configureHost description present ${shellText.includes(zh('wizard.ssh.step.configureHost.description'))}; verifyAuth description present ${shellText.includes(zh('wizard.ssh.step.verifyAuth.description'))}`])
  })

  test('V3 / V4 a: SSH auth-failed message from a real refused login (bat-t0663-sshd)', async () => {
    test.setTimeout(180_000)
    const { app, win } = wiz!
    const body = zh('wizard.ssh.error.permissionDenied.body')
    const copyOk = body.includes('ssh-agent') && !/密碼|password/i.test(body)
    if (!sshConn) {
      record('V3.ssh-auth-failed', 'needs-human', [
        `no ${SSH_CONNECTION} (run node e2e/real-remote/t0663-env.mjs up) — string check only:`,
        `zh-TW wizard.ssh.error.permissionDenied.body ${JSON.stringify(body)}: mentions ssh-agent and no 密碼 / password: ${copyOk}`])
      return
    }
    let restored = ''
    try {
      await envScript('apply-ssh-config')
      await installGuard(app, { stubs: { ...BASE_STUBS, 'ssh:list-hosts': [sshConn.alias] }, real: ['ssh:probe-auth'] })
      const shell = await openWizard(win, 'ssh')
      const prompt = shell.locator('#bat-wizard-active-prompt')
      await expect(prompt).toBeVisible({ timeout: 30_000 })
      await prompt.getByRole('button', { name: sshConn.alias, exact: true }).click()
      const err = await mappedError(shell)
      await shot(win, 'v3-ssh-auth-failed')
      await closeWizard(win)
      const probe = (await guardCalls(app)).filter(c => c.channel === 'ssh:probe-auth')
      record('V3.ssh-auth-failed', err.title === zh('wizard.ssh.error.permissionDenied.title') && err.body === body && copyOk, [
        `alias ${sshConn.alias} → ${sshConn.container} (127.0.0.1:${sshConn.sshPort}, no key accepted); real ssh:probe-auth calls ${probe.length}`,
        `mapped error title ${JSON.stringify(err.title)}`, `body ${JSON.stringify(err.body)}`, `mentions ssh-agent, no 密碼 / password: ${copyOk}`])
    } finally {
      restored = await envScript('restore-ssh-config').catch(e => `restore FAILED: ${String(e)}`)
      await installGuard(app, { stubs: BASE_STUBS, real: [] })
      record('CLEANUP.ssh-config', /match=true/.test(restored), [restored.split(/\r?\n/).pop() ?? restored])
    }
  })

  test('V4 a: error codes not triggered here', async () => {
    const triggered = ['docker-daemon-down (natural)', 'docker-no-containers', 'wsl-requires-wsl2', 'wsl-home-unresolved', 'permission-denied (real ssh)']
    const notTriggered = [
      'wizard-precondition-missing', 'wizard-profile-save-failed', 'connect-test-failed', 'server-bundle-install-failed', 'server-bundle-distribute-failed',
      'docker-container-names-exhausted', 'docker-mounts-none', 'docker-mounts-invalid', 'docker-inspect-failed', 'docker-container-not-owned',
      'docker-start-failed', 'docker-health-unavailable', 'docker-container-unhealthy', 'docker-health-timeout', 'wsl-unit-snapshot-failed',
      'wsl-unit-write-failed', 'wsl-service-start-failed', 'no-ssh', 'host-key', 'connect-timeout', 'ssh-remote-path-invalid',
      'unit-write-failed / enable-failed / start-failed / verify-failed (ssh start-server)', 'ssh-tunnel-failed', 'fingerprint-mismatch (wizard)',
    ]
    record('V4.a-untriggered-codes', 'needs-human', [
      `triggered on the installed build: ${triggered.join(', ')}`,
      `not triggered (they need a real install / container / host failure, which this acceptance must not cause; T0660 covers them with unit tests): ${notTriggered.join(', ')}`])
  })

  test('V5: installed renderer bundle carries the new step texts, none of the old ones', async () => {
    const { app } = wiz!
    const needlesOld = ['選擇主機、帳號、port、金鑰與安裝路徑', '執行 BAT_AUTH_OK probe', '將 BAT 伺服器套件串流進 WSL']
    const needlesNew = [zh('wizard.ssh.step.configureHost.description'), zh('wizard.ssh.step.verifyAuth.description'), zh('wizard.wsl.step.installBundle.description')]
    const found = await app.evaluate(({ app: electronApp }, { needlesOld, needlesNew }) => {
      const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
      const p = process.getBuiltinModule('node:path') as typeof import('node:path')
      const dir = p.join(electronApp.getAppPath(), 'dist', 'assets')
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
      const text = files.map(f => fs.readFileSync(p.join(dir, f), 'utf8')).join('\n')
      return { dir, files: files.length, old: needlesOld.filter(n => text.includes(n)), fresh: needlesNew.filter(n => text.includes(n)) }
    }, { needlesOld, needlesNew })
    record('V5.bundle-step-text', found.files > 0 && found.old.length === 0 && found.fresh.length === needlesNew.length, [
      `${found.dir}: ${found.files} js files`, `old texts found: ${found.old.join(', ') || 'none'}`, `new texts found: ${found.fresh.length}/${needlesNew.length}`])
  })
})
