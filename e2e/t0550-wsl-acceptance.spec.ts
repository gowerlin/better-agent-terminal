// T0550 — WSL real-machine acceptance on an installed build (0.6.1-pre.4): the stock WSL wizard
// upgrades the user's Ubuntu-24.04 bat-server (bundle downloaded from the server-bundle-v<version>
// release, D146), then PLAN-036 remote features (smoke S1-S13 + a remote window: terminal I/O,
// output replay after a reconnect, git / fs reads, remote Tower dispatch → Worker report) and
// PLAN-037 tool detection. OPT-IN and destructive for the distro's ~/.local/bat-server: skipped
// unless BAT_E2E_T0550=1 and BAT_E2E_EXECUTABLE points at the installed build. Windows only.
//
//   # back up first: cp -a ~/.local/bat-server ~/.local/bat-server.bak-<old>-t0550 (+ the unit)
//   $env:BAT_E2E_T0550='1'
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   npx playwright test e2e/t0550-wsl-acceptance.spec.ts
//
// Ground rules: the user's BAT (9876) and its profile are never touched. The wizard picks the WSL
// server port on the Windows side and skips ports in use, so with the old server still listening
// it would move the server to a new port and leave the user's profile pointing at the old one;
// the test stops the old service first (after recording the port the picker would choose), so the
// upgraded server keeps the old port — certificate and token stay in the data dir. No model is
// started: the remote Tower dispatch uses `--agent gemini-cli`, which is not installed in the
// distro (the Worker tab only prints "command not found"); tool install buttons are not pressed.
// A4 (offline import) never re-installs: the import IPC is called directly (the wizard's
// "Import local tarball…" button would retry the install, i.e. re-run the whole upgrade).
//
// Every check writes a verdict to <evidence>/results.json.

import { test, expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {
  E2E_EXECUTABLE,
  REPO_ROOT,
  closeIsolated,
  launchIsolated,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_T0550 === '1'
const DISTRO = process.env.BAT_E2E_T0550_DISTRO || 'Ubuntu-24.04'
const EXPECTED_VERSION = process.env.BAT_E2E_T0550_VERSION || '0.6.1-pre.4'
const STATE_DIR = path.join(os.tmpdir(), 'bat-t0550')
const EVIDENCE_DIR = process.env.BAT_E2E_T0550_EVIDENCE_DIR || path.join(STATE_DIR, 'evidence')
const IMPORT_DIR = path.join(STATE_DIR, 'import')
const RESULTS = path.join(EVIDENCE_DIR, 'results.json')
const RELEASE_BASE = 'https://github.com/gowerlin/better-agent-terminal/releases/download'
const WIZARD_TIMEOUT_MS = 600_000
const INSTALL_ROOT = '$HOME/.local/bat-server'
const UNIT = '$HOME/.config/systemd/user/bat-server.service'
const UNC = (linuxPath: string) => `\\\\wsl.localhost\\${DISTRO}${linuxPath.replace(/\//g, '\\')}`

test.skip(!ENABLED, 'opt-in: set BAT_E2E_T0550=1 (T0550, upgrades the WSL bat-server)')
test.skip(process.platform !== 'win32', 'Windows host only (WSL)')
// T0552 (BUG-138 / BUG-139): BAT_E2E_T0550_UPGRADE_RUNNING=1 runs the wizard with the old server
// still running (no stop first), after seeding this instance with a profile for the distro and
// the old port; A2.upgrade-running / A3.clean-install then require: same port, that profile
// updated and no new one, and an install root without the files the bundle no longer ships.
// A3.clean-install plants canaries in the old tree before the wizard (T0560): an upgrade between
// two slimmed bundles keeps the same size, so `du` is evidence only, the canaries decide.
// Works with the source build (`npx vite build`; BAT_E2E_EXECUTABLE optional). Run A1-A3 only:
//   npx playwright test e2e/t0550-wsl-acceptance.spec.ts -g "A1-A3"
const UPGRADE_RUNNING = process.env.BAT_E2E_T0550_UPGRADE_RUNNING === '1'
const STALE_PACKAGES = ['@anthropic-ai/claude-agent-sdk-linux-x64', '@img', 'better-sqlite3', 'sharp']
const CANARIES = ['.t0560-canary', 'node_modules/t0560-stale-canary']
// T0554 (BUG-141): BAT_E2E_T0554_CANCEL_AFTER_INSTALL=1 adds "T0554 cancel": the wizard upgrades the
// running server, a step after the install fails (fetch-fingerprint, injected into this isolated
// instance's main process) and the user cancels; the previous install tree, unit and running
// service must come back. Same source-build setup as UPGRADE_RUNNING. Run it alone:
//   npx playwright test e2e/t0550-wsl-acceptance.spec.ts -g "T0554"
const CANCEL_AFTER_INSTALL = process.env.BAT_E2E_T0554_CANCEL_AFTER_INSTALL === '1'
const PREVIOUS_MARKER = '.t0554-previous-install'

test.skip(ENABLED && !E2E_EXECUTABLE && !UPGRADE_RUNNING && !CANCEL_AFTER_INSTALL, 'set BAT_E2E_EXECUTABLE to the installed BetterAgentTerminal.exe under test')

const log = testLogger('t0550')

const LOCALES = ['en', 'zh-TW', 'zh-CN'].map(lang =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${lang}.json`), 'utf8')) as AnyApi)
const any = (pick: (l: AnyApi) => string) => LOCALES.map(pick)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const oneOf = (values: string[]) => new RegExp(`^(${[...new Set(values)].map(escape).join('|')})$`)
const COMPLETE = any(l => l.wizard.progress.complete)
const ADD_MORE = oneOf(any(l => l.profiles.addMore))
const ADD_WSL = any(l => l.profiles.addWslProfile)

// ── verdicts ─────────────────────────────────────────────────────────────────

type Verdict = 'PASS' | 'FAIL' | 'NEEDS-HUMAN' | 'INFO'
interface Result { verdict: Verdict; evidence: string[]; at: string }

function readResults(): Record<string, Result> {
  try {
    return JSON.parse(fs.readFileSync(RESULTS, 'utf8')) as Record<string, Result>
  } catch {
    return {}
  }
}

function record(key: string, pass: boolean | 'needs-human' | 'info', evidence: string[]): boolean {
  const verdict: Verdict = pass === 'needs-human' ? 'NEEDS-HUMAN' : pass === 'info' ? 'INFO' : pass ? 'PASS' : 'FAIL'
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const all = readResults()
  all[key] = { verdict, evidence, at: new Date().toISOString() }
  fs.writeFileSync(RESULTS, JSON.stringify(all, null, 2))
  log(`${key}: ${verdict} — ${evidence.join(' | ').replace(/\s+/g, ' ').slice(0, 1500)}`)
  return verdict !== 'FAIL'
}

// ── environment helpers ──────────────────────────────────────────────────────

/**
 * Runs a script in the distro's login shell; never throws (failures come back as text).
 * `--exec`, not `--`: the latter hands the joined arguments to the default shell again.
 */
async function wsl(script: string, timeout = 60_000): Promise<string> {
  return run('wsl.exe', ['-d', DISTRO, '--exec', 'bash', '-lc', script], timeout)
    .catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

function section(evidence: string, name: string): string {
  const parts = evidence.split(/^## /m)
  const hit = parts.find(p => p.startsWith(name))
  return hit ? hit.slice(name.length).replace(/^[^\n]*\n/, '').trim() : ''
}

/** Version, service, unit port, listeners, cert fingerprint (only that field). */
async function serverState(): Promise<string> {
  return wsl([
    `echo "## version"; sed -n 's/.*"version": *"\\([^"]*\\)".*/\\1/p' ${INSTALL_ROOT}/package.json 2>&1`,
    // README.md has no trailing newline: echo one so the next marker starts its own line.
    `echo "## readme"; cat ${INSTALL_ROOT}/README.md 2>&1; echo`,
    'echo "## is-active"; systemctl --user is-active bat-server 2>&1',
    'echo "## MainPID"; systemctl --user show -p MainPID --value bat-server 2>&1',
    `echo "## unit-port"; sed -n 's/^Environment="BAT_SERVER_PORT=\\([0-9]*\\)"$/\\1/p' ${UNIT} 2>&1`,
    `echo "## unit"; cat ${UNIT} 2>&1`,
    'echo "## listening"; ss -tlnpH 2>&1',
    `echo "## fingerprint"; sed -n 's/^.*"fingerprint"[[:space:]]*:[[:space:]]*"\\([0-9A-Fa-f:]*\\)".*$/\\1/p' $HOME/.local/share/bat-server/server-cert.json 2>&1`,
  ].join('; '))
}

function windowsPortFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    fs.createReadStream(file).on('error', reject).on('data', d => hash.update(d)).on('end', () => resolve(hash.digest('hex')))
  })
}

function latestLog(userData: string): string {
  const dir = path.join(userData, 'Logs')
  try {
    const files = fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort()
    return files.length ? fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8') : ''
  } catch {
    return ''
  }
}

function runNode(args: string[], timeout: number): Promise<{ code: number; out: string }> {
  return new Promise(resolve => {
    const env = { ...process.env }
    for (const k of Object.keys(env)) if (k.startsWith('BAT_') || k.startsWith('CT_')) delete env[k]
    execFile(process.execPath, args, { cwd: REPO_ROOT, timeout, windowsHide: true, env, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof (err as AnyApi).code === 'number' ? (err as AnyApi).code : 1) : 0, out: `${stdout}${stderr}` })
    })
  })
}

// ── UI helpers ───────────────────────────────────────────────────────────────

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file }).catch(err => log(`screenshot ${name} failed: ${(err as Error).message}`))
  log(`screenshot ${file}`)
  return file
}

async function openProfiles(win: Page): Promise<void> {
  if (await win.locator('.profile-card').count() > 0) return
  await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
  await expect(win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
}

async function openWslWizard(win: Page): Promise<void> {
  await openProfiles(win)
  await win.getByRole('button', { name: ADD_MORE }).click()
  await win.locator('.thumbnail-add-menu-item').filter({ hasText: new RegExp(ADD_WSL.map(escape).join('|')) }).first().click()
  await expect(win.locator('.bat-wizard-shell')).toBeVisible({ timeout: 15_000 })
}

async function closeWizard(win: Page): Promise<void> {
  await win.locator('.settings-panel .settings-close').last().click()
  await expect(win.locator('.bat-wizard-shell')).toHaveCount(0, { timeout: 30_000 })
}

type Outcome = { result: 'complete' | 'failed' | 'timeout'; text: string; prompts: string[] }

async function driveWizard(win: Page): Promise<Outcome> {
  const shell = win.locator('.bat-wizard-shell')
  const prompt = win.locator('#bat-wizard-active-prompt')
  const prompts: string[] = []
  const end = Date.now() + WIZARD_TIMEOUT_MS
  while (Date.now() < end) {
    const text = await shell.innerText().catch(() => '')
    if (COMPLETE.some(c => text.includes(c))) return { result: 'complete', text, prompts }
    if (await win.locator('.bat-stepper-failed-actions').count() > 0) {
      return { result: 'failed', text: await win.locator('.bat-wizard-detail').innerText().catch(() => text), prompts }
    }
    if (await prompt.isVisible().catch(() => false)) {
      const promptText = (await prompt.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
      if (promptText && !prompts.includes(promptText)) prompts.push(promptText)
      // Only one prompt is expected (distro choice when several WSL2 distros exist).
      const pick: Locator = prompt.getByRole('button', { name: DISTRO, exact: true })
      if (await pick.count() > 0) await pick.click()
    }
    await win.waitForTimeout(500)
  }
  return { result: 'timeout', text: await shell.innerText().catch(() => ''), prompts }
}

async function stepStatuses(win: Page): Promise<string[]> {
  return win.locator('.bat-wizard-shell .bat-stepper-step').evaluateAll(els => els.map(e => {
    const status = [...e.classList].find(c => c.startsWith('bat-stepper-status-'))?.slice('bat-stepper-status-'.length) ?? '?'
    const label = (e.querySelector('.bat-stepper-label') as HTMLElement | null)?.innerText?.trim() ?? ''
    return `${status}:${label}`
  }))
}

function captureConsole(win: Page, needle: RegExp): string[] {
  const lines: string[] = []
  win.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    if (needle.test(text)) lines.push(`${msg.type()}: ${text}`)
  })
  return lines
}

interface ProfileRow { id: string; name: string; targetOS?: string; wslDistro?: string; remoteHost?: string; remotePort?: number; remoteToken?: string; remoteFingerprint?: string; updatedAt?: number }

async function profiles(win: Page): Promise<ProfileRow[]> {
  return (await win.evaluate(async () => (window as AnyApi).electronAPI.profile.list())).profiles as ProfileRow[]
}

const redact = (p: ProfileRow) => ({ ...p, remoteToken: p.remoteToken ? '<set>' : p.remoteToken })
// T0560: the renderer's 30 s autosave (`workspace:save` → profileManager.save()) bumps the local
// profile's updatedAt; every other field must stay as it was.
const comparable = (p: ProfileRow) => ({ ...redact(p), updatedAt: undefined })

/** PTY output / created-externally / notified events as this renderer receives them. */
async function installCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as AnyApi
    if (w.__t0550) return
    w.__t0550 = { out: {} as Record<string, string>, created: [] as unknown[], notified: [] as unknown[] }
    w.electronAPI.pty.onOutput((id: string, data: string) => { w.__t0550.out[id] = (w.__t0550.out[id] ?? '') + data })
    w.electronAPI.pty.onCreatedExternally((info: unknown) => { w.__t0550.created.push(info) })
    w.electronAPI.pty.onTerminalNotified((info: unknown) => { w.__t0550.notified.push(info) })
  })
}

const outputOf = (page: Page, id: string) => page.evaluate((pid) => ((window as AnyApi).__t0550.out[pid] ?? '') as string, id)

async function createPty(page: Page, opts: { id: string; cwd: string; workspaceId?: string }): Promise<unknown> {
  return page.evaluate(async (o) => (window as AnyApi).electronAPI.pty.create({ ...o, type: 'terminal' }), opts)
}

async function ptyWrite(page: Page, id: string, data: string): Promise<void> {
  await page.evaluate(async ([pid, d]) => (window as AnyApi).electronAPI.pty.write(pid, d), [id, data] as const)
}

async function waitOutput(page: Page, id: string, rx: RegExp, timeout = 30_000): Promise<string> {
  await expect.poll(() => outputOf(page, id), { timeout, message: `output of ${id} matching ${rx}` }).toMatch(rx)
  return (await outputOf(page, id)).match(rx)?.[0] ?? ''
}

async function settle<T = unknown>(page: Page, fn: string, args: unknown[]): Promise<{ ok: boolean; value?: T; error?: string }> {
  return page.evaluate(async ([f, a]) => {
    const parts = (f as string).split('.')
    let target: AnyApi = (window as AnyApi).electronAPI
    for (const p of parts.slice(0, -1)) target = target[p]
    try {
      return { ok: true, value: await target[parts[parts.length - 1]](...(a as unknown[])) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }, [fn, args] as const) as Promise<{ ok: boolean; value?: T; error?: string }>
}

// ── shared state ─────────────────────────────────────────────────────────────

let inst: IsolatedInstance | undefined
let remotePage: Page | undefined
let wslProfile: ProfileRow | undefined
let upgraded = false

test.describe.serial('T0550 WSL acceptance', () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    const version = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `(Get-Item '${E2E_EXECUTABLE.replace(/'/g, "''")}').VersionInfo.FileVersion`], 20_000).catch(() => '?')
    log(`executable under test: ${E2E_EXECUTABLE} FileVersion ${version.trim()}`)
    log(`installed baseline present: ${fs.existsSync(path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'bat-server-baseline'))}`)
  })

  test.afterAll(async () => {
    await closeIsolated(inst, log)
    inst = undefined
  })

  test('T0554 cancel after the install restores the previous server (unit, tree, running service)', async () => {
    test.skip(!CANCEL_AFTER_INSTALL, 'opt-in: BAT_E2E_T0554_CANCEL_AFTER_INSTALL=1')
    test.setTimeout(WIZARD_TIMEOUT_MS + 300_000)
    const before = await serverState()
    fs.writeFileSync(path.join(EVIDENCE_DIR, 't0554-server-state-before.txt'), before)
    const oldPort = Number(section(before, 'unit-port'))
    const oldFingerprint = section(before, 'fingerprint').toUpperCase()
    expect(section(before, 'is-active'), 'T0554 cancel needs the old server active').toBe('active')
    const backup = await wsl('ls -d $HOME/.local/bat-server.bak-* $HOME/.config/systemd/user/bat-server.service.bak-* 2>&1')
    expect(backup, 'back up ~/.local/bat-server and the unit before running T0554').toContain('.bak-')
    // Identity of what the cancel must bring back: a marker inside the tree (a fresh extract has
    // none), the directory inode (renames keep it) and the unit file hash.
    const identity = async () => wsl([
      `echo "## marker"; test -e ${INSTALL_ROOT}/${PREVIOUS_MARKER} && echo present || echo absent`,
      `echo "## inode"; stat -c %i ${INSTALL_ROOT} 2>&1`,
      `echo "## unit-sha"; sha256sum ${UNIT} 2>&1 | cut -d' ' -f1`,
      `echo "## siblings"; ls -d ${INSTALL_ROOT}.bat-new ${INSTALL_ROOT}.bat-old 2>/dev/null; true`,
    ].join('; '))
    await wsl(`touch ${INSTALL_ROOT}/${PREVIOUS_MARKER}`)
    const idBefore = await identity()
    log(`T0554 before: version ${section(before, 'version')} port ${oldPort} MainPID ${section(before, 'MainPID')} ${idBefore.replace(/\s+/g, ' ')}`)

    const cancelInst = await launchIsolated('t0554-cancel', log)
    try {
      const win = cancelInst.win
      const wizardLog = captureConsole(win, /\[wsl-wizard\]|rollback|Restored|restore/i)
      // Fail the first step after the install + unit rewrite; nothing else is changed.
      await cancelInst.app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('wsl:fetch-fingerprint')
        ipcMain.handle('wsl:fetch-fingerprint', async () => ({ ok: false, errorCode: 'fingerprint-unreachable', error: 'T0554 injected failure after the install' }))
      })
      const profilesBefore = await profiles(win)
      const profilesBeforeAt = Date.now()
      await openWslWizard(win)
      const outcome = await driveWizard(win)
      const stepsAtFailure = await stepStatuses(win)
      await shot(win, 'T0554-failed')
      const mid = await serverState()
      const idMid = await identity()
      fs.writeFileSync(path.join(EVIDENCE_DIR, 't0554-server-state-mid.txt'), `${mid}\n${idMid}`)
      // Marker gone + .bat-old present = the install step swapped in the new bundle and kept the old one.
      record('T0554.failed-after-install', outcome.result === 'failed'
        && section(idMid, 'marker') === 'absent' && section(idMid, 'siblings').includes('.bat-old'), [
        `wizard ${outcome.result}; steps ${stepsAtFailure.join(', ')}`,
        `while failed: version ${section(mid, 'version')} is-active ${section(mid, 'is-active')} MainPID ${section(mid, 'MainPID')} (new bundle running)`,
        `marker ${section(idMid, 'marker')}; .bat-old kept: ${section(idMid, 'siblings') || 'none'}`])

      await win.locator('.bat-stepper-failed-actions [data-action-kind="cancel"]').first().click()
      // Rollback: unit restored, previous tree swapped back, service started again.
      await expect.poll(async () => {
        const now = await identity()
        return section(now, 'marker') === 'present' && !section(now, 'siblings')
      }, { timeout: 180_000, intervals: [2000], message: 'previous install restored' }).toBe(true)
      let after = ''
      await expect.poll(async () => {
        after = await serverState()
        const pid = section(after, 'MainPID')
        return section(after, 'is-active') === 'active' && section(after, 'listening').split('\n').some(l => l.includes(`:${oldPort} `) && l.includes(`pid=${pid},`))
      }, { timeout: 60_000, intervals: [2000], message: 'previous server running on its port again' }).toBe(true)
      const idAfter = await identity()
      fs.writeFileSync(path.join(EVIDENCE_DIR, 't0554-server-state-after.txt'), `${after}\n${idAfter}`)
      const stepsAfter = await stepStatuses(win)
      fs.writeFileSync(path.join(EVIDENCE_DIR, 't0554-wizard-console.txt'), wizardLog.join('\n'))
      fs.writeFileSync(path.join(EVIDENCE_DIR, 't0554-debug-log.txt'), latestLog(cancelInst.userData))
      await shot(win, 'T0554-cancelled')
      // Span at least one autosave so the comparison proves updatedAt is left out (T0560).
      const sinceBefore = Date.now() - profilesBeforeAt
      if (sinceBefore < 35_000) await win.waitForTimeout(35_000 - sinceBefore)
      const profilesAfter = await profiles(win)
      const profilesSpan = Math.round((Date.now() - profilesBeforeAt) / 1000)
      const newPort = Number(section(after, 'unit-port'))
      const newFingerprint = section(after, 'fingerprint').toUpperCase()
      record('T0554.restored', section(idAfter, 'marker') === 'present' && section(idAfter, 'inode') === section(idBefore, 'inode')
        && section(idAfter, 'unit-sha') === section(idBefore, 'unit-sha') && !section(idAfter, 'siblings')
        && section(after, 'version') === section(before, 'version') && newPort === oldPort && newFingerprint === oldFingerprint, [
        `install tree: marker ${section(idAfter, 'marker')}; inode ${section(idBefore, 'inode')} → ${section(idAfter, 'inode')}; .bat-new / .bat-old left: ${section(idAfter, 'siblings') || 'none'}`,
        `unit sha256 ${section(idBefore, 'unit-sha').slice(0, 16)}… → ${section(idAfter, 'unit-sha').slice(0, 16)}…`,
        `version ${section(before, 'version')} → ${section(after, 'version')}; port ${oldPort} → ${newPort}; fingerprint ${oldFingerprint.slice(0, 11)}… → ${newFingerprint.slice(0, 11)}…`,
        `steps after cancel: ${stepsAfter.join(', ')}`])
      record('T0554.service-running', section(after, 'is-active') === 'active' && section(after, 'MainPID') !== section(mid, 'MainPID'), [
        `is-active ${section(after, 'is-active')}; MainPID ${section(before, 'MainPID')} (before) → ${section(mid, 'MainPID')} (new bundle) → ${section(after, 'MainPID')} (restored)`,
        `listening ${section(after, 'listening').split('\n').filter(l => l.includes(`:${oldPort} `)).join(' / ')}`])
      const bumped = profilesAfter.filter(p => profilesBefore.some(b => b.id === p.id && b.updatedAt !== p.updatedAt))
      record('T0554.profiles-untouched', JSON.stringify(profilesAfter.map(comparable)) === JSON.stringify(profilesBefore.map(comparable)), [
        `profiles before ${profilesBefore.length}, after ${profilesAfter.length}; ${profilesSpan} s apart`,
        `compared without updatedAt (autosave): ${JSON.stringify(profilesAfter.map(p => ({ id: p.id, name: p.name, targetOS: p.targetOS, wslDistro: p.wslDistro, remotePort: p.remotePort })))}`,
        `updatedAt changed (ignored): ${bumped.map(p => `${p.name} ${profilesBefore.find(b => b.id === p.id)?.updatedAt} → ${p.updatedAt}`).join(', ') || 'none'}`])
      record('T0554.rollback-log', 'info', wizardLog.slice(-12))
    } finally {
      await closeIsolated(cancelInst, log)
      await wsl(`rm -f ${INSTALL_ROOT}/${PREVIOUS_MARKER}`)
    }
  })

  test('A1-A3 stock WSL wizard upgrades the server (release download, sidecar, helpers)', async () => {
    test.skip(CANCEL_AFTER_INSTALL && !UPGRADE_RUNNING && !E2E_EXECUTABLE, 'T0554 cancel run only')
    test.setTimeout(WIZARD_TIMEOUT_MS + 300_000)
    const before = await serverState()
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'server-state-before.txt'), before)
    const oldPort = Number(section(before, 'unit-port'))
    const oldFingerprint = section(before, 'fingerprint').toUpperCase()
    log(`before: version ${section(before, 'version')} active ${section(before, 'is-active')} port ${oldPort} fingerprint ${oldFingerprint.slice(0, 11)}…`)
    const backup = await wsl('ls -d $HOME/.local/bat-server.bak-* $HOME/.config/systemd/user/bat-server.service.bak-* 2>&1')
    expect(backup, 'back up ~/.local/bat-server and the unit before running T0550').toContain('.bak-')

    inst = await launchIsolated('t0550-a', log)
    const win = inst.win
    const wizardLog = captureConsole(win, /\[wsl-wizard\]|rollback/i)

    // A0: what the port picker answers while the old server still holds its port.
    const probe = await win.evaluate(async () => (window as AnyApi).electronAPI.wsl.pickServerPort())
    record('A0.port-while-running', 'info', [
      `old server listening on ${oldPort}; wsl.pickServerPort() with it running → ${JSON.stringify(probe)}`,
      probe?.ok && probe.port !== oldPort
        ? `re-running the wizard over a running server moves it to ${probe.port}; a profile saved with ${oldPort} goes stale`
        : 'picker keeps the old port'])

    let seededProfileId: string | undefined
    const duBefore = (await wsl(`du -sm ${INSTALL_ROOT} | cut -f1`)).trim()
    let canaryPlant = ''
    const removeCanaries = () => wsl(CANARIES.map(c => `rm -rf ${INSTALL_ROOT}/${c}`).join('; '))
    if (UPGRADE_RUNNING) {
      // T0560 (BUG-139): files only the old tree has; a clean install leaves none of them.
      canaryPlant = (await wsl([
        `echo t0560 > ${INSTALL_ROOT}/${CANARIES[0]}`,
        `mkdir -p ${INSTALL_ROOT}/${CANARIES[1]}`,
        `echo '{"name":"t0560-stale-canary","version":"0.0.0"}' > ${INSTALL_ROOT}/${CANARIES[1]}/package.json`,
        `for c in ${CANARIES.join(' ')}; do test -e ${INSTALL_ROOT}/$c && echo "planted $c" || echo "missing $c"; done`,
      ].join('; '))).trim()
      log(`T0560 canaries: ${canaryPlant.replace(/\s+/g, ' ')}`)
      // T0552: keep the old server running; this instance gets the profile a user would have.
      expect(section(before, 'is-active'), 'T0552 upgrade-running needs the old server active').toBe('active')
      seededProfileId = await win.evaluate(async ([distro, port, fp]) => {
        const api = (window as AnyApi).electronAPI.profile
        const created = await api.create(`T0552 seed ${distro}`, { type: 'remote', remoteHost: 'localhost', remotePort: port, remoteToken: 'seed-token', remoteFingerprint: fp })
        await api.update(created.id, { targetOS: 'wsl-linux', wslDistro: distro, remoteHost: 'localhost', remotePort: port })
        return created.id as string
      }, [DISTRO, oldPort, oldFingerprint] as const)
      log(`T0552: old server left running on ${oldPort}; seeded profile ${seededProfileId}; install root ${duBefore} MiB`)
    } else {
      // Free the old port so the upgraded server keeps it (the user's profile points at it).
      const stop = await wsl('systemctl --user stop bat-server; sleep 1; systemctl --user is-active bat-server; true')
      let freed = false
      for (let i = 0; i < 20 && !(freed = await windowsPortFree(oldPort)); i++) await new Promise(r => setTimeout(r, 500))
      log(`stopped old service: ${stop.trim()}; Windows 127.0.0.1:${oldPort} free: ${freed}`)
      expect(freed, `port ${oldPort} still busy after stopping the old service`).toBe(true)
    }

    await openWslWizard(win)
    const t0 = Date.now()
    const outcome = await driveWizard(win)
    const steps = await stepStatuses(win)
    await shot(win, `A-wizard-${outcome.result}`)
    log(`wizard ${outcome.result} after ${Math.round((Date.now() - t0) / 1000)} s; steps ${steps.join(', ')}; prompts ${JSON.stringify(outcome.prompts)}`)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'wizard-console.txt'), wizardLog.join('\n'))
    if (outcome.result !== 'complete') {
      record('A2', false, [`wizard ${outcome.result}: ${outcome.text.slice(0, 1500)}`, ...wizardLog.slice(-20)])
      fs.writeFileSync(path.join(EVIDENCE_DIR, 'debug-log-a.txt'), latestLog(inst.userData))
      if (UPGRADE_RUNNING) await removeCanaries()
      throw new Error(`wizard ${outcome.result}`)
    }

    // A1: the bundle came from the release download, the cache holds tarball + sidecar.
    const mainLog = latestLog(inst.userData)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'debug-log-a.txt'), mainLog)
    const bundleLines = mainLog.split(/\r?\n/).filter(l => /\[server-bundle(-distributor)?\]/.test(l))
    const cacheDir = path.join(inst.userData, 'bat-server-bundles')
    const cached = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : []
    const tarName = `bat-server-linux-x64-v${EXPECTED_VERSION}.tar.gz`
    const tarPath = path.join(cacheDir, tarName)
    const sidecar = fs.existsSync(`${tarPath}.sha256`) ? fs.readFileSync(`${tarPath}.sha256`, 'utf8').trim() : ''
    const actualSha = fs.existsSync(tarPath) ? await sha256File(tarPath) : ''
    const releaseSha = await fetch(`${RELEASE_BASE}/server-bundle-v${EXPECTED_VERSION}/${tarName}.sha256`)
      .then(r => r.ok ? r.text() : `HTTP ${r.status}`).catch(e => `fetch failed: ${(e as Error).message}`)
    const urlSeen = bundleLines.some(l => l.includes(`/releases/download/server-bundle-v${EXPECTED_VERSION}/`))
    const sourceDownload = wizardLog.some(l => l.includes('Downloaded server bundle from release'))
    // T0552 upgrade-running: the bundle source (cache / baseline / download) is not under test.
    const a1 = urlSeen && sourceDownload && cached.includes(tarName) && cached.includes(`${tarName}.sha256`)
      && sidecar.startsWith(actualSha) && releaseSha.trim().startsWith(actualSha) && actualSha.length === 64
    record('A1', UPGRADE_RUNNING ? 'info' : a1, [
      `log: ${bundleLines.map(l => l.replace(/^.*?\[server-bundle/, '[server-bundle')).join(' / ')}`,
      `wizard: ${wizardLog.filter(l => /server bundle/i.test(l)).slice(-3).join(' / ')}`,
      `cache ${cacheDir}: ${JSON.stringify(cached)}`,
      `sha256(tarball)=${actualSha}; sidecar="${sidecar}"; release .sha256="${releaseSha.trim()}"`])
    fs.mkdirSync(IMPORT_DIR, { recursive: true })
    for (const f of [tarName, `${tarName}.sha256`]) if (fs.existsSync(path.join(cacheDir, f))) fs.copyFileSync(path.join(cacheDir, f), path.join(IMPORT_DIR, f))

    // A2: profile written, server upgraded, active, listening on the unit's port.
    const all = await profiles(win)
    wslProfile = all.find(p => p.targetOS === 'wsl-linux' && p.wslDistro === DISTRO)
    const after = await serverState()
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'server-state-after.txt'), after)
    const newPort = Number(section(after, 'unit-port'))
    const pid = section(after, 'MainPID')
    const listening = section(after, 'listening').split('\n').filter(l => new RegExp(`:${newPort}\\b`).test(l))
    const newFingerprint = section(after, 'fingerprint').toUpperCase()
    upgraded = section(after, 'version') === EXPECTED_VERSION && section(after, 'is-active') === 'active'
    record('A2.server', upgraded && listening.some(l => l.includes(`pid=${pid},`)) && newPort === wslProfile?.remotePort, [
      `version ${section(after, 'version')} (expected ${EXPECTED_VERSION}); is-active ${section(after, 'is-active')}; MainPID ${pid}`,
      `unit port ${newPort} (before ${oldPort}); listening ${JSON.stringify(listening)}`,
      `profile ${JSON.stringify(wslProfile ? redact(wslProfile) : null)}`])
    record('A2.identity-kept', newPort === oldPort && newFingerprint === oldFingerprint && normFp(wslProfile?.remoteFingerprint) === oldFingerprint, [
      `port ${oldPort} → ${newPort}; certificate fingerprint ${oldFingerprint.slice(0, 11)}… → ${newFingerprint.slice(0, 11)}…; wizard pinned ${normFp(wslProfile?.remoteFingerprint).slice(0, 11)}…`,
      'same port + certificate + token file ⇒ an existing profile for this distro keeps working'])
    if (UPGRADE_RUNNING) {
      // T0552 (BUG-138): the running old server did not push the wizard to another port, and the
      // seeded profile was updated instead of a second one being created.
      const distroProfiles = all.filter(p => p.targetOS === 'wsl-linux' && p.wslDistro === DISTRO)
      const seeded = distroProfiles.find(p => p.id === seededProfileId)
      const picks = latestLog(inst.userData).split(/\r?\n/).filter(l => l.includes('pick-server-port')).map(l => l.replace(/^.*?\[wizard\]/, '[wizard]'))
      record('A2.upgrade-running', newPort === oldPort && distroProfiles.length === 1 && !!seeded
        && seeded.remotePort === oldPort && seeded.remoteToken !== 'seed-token' && normFp(seeded.remoteFingerprint) === oldFingerprint, [
        `old server active before the wizard; unit port ${oldPort} → ${newPort}`,
        `profiles for ${DISTRO}: ${JSON.stringify(distroProfiles.map(redact))} (seeded ${seededProfileId}; token replaced: ${seeded?.remoteToken !== 'seed-token'})`,
        ...picks])
    }

    // A2: the profile opens and a remote shell answers.
    expect(wslProfile, 'wizard did not write a wsl-linux profile').toBeDefined()
    const opened = await win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), wslProfile!.id)
    const windowId = opened?.windowIds?.[0]
    await expect.poll(() => (remotePage = inst!.app.windows().find(p => p.url().includes(`windowId=${encodeURIComponent(windowId)}`))) !== undefined,
      { timeout: 30_000, message: 'remote window' }).toBe(true)
    await remotePage!.waitForLoadState('domcontentloaded')
    await expect.poll(async () => (await remotePage!.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())).connected,
      { timeout: 60_000, message: 'remote window connected' }).toBe(true)
    await installCapture(remotePage!)
    const shellId = `t0550-a2-${Date.now()}`
    await createPty(remotePage!, { id: shellId, cwd: '/tmp' })
    await ptyWrite(remotePage!, shellId, 'echo "T0550-$(id -un)@$(uname -n)-$((20+5))"\n')
    const marker = await waitOutput(remotePage!, shellId, /T0550-\S+-25/)
    await settle(remotePage!, 'pty.kill', [shellId])
    await remotePage!.waitForTimeout(1500)
    await shot(remotePage!, 'A2-remote-window')
    record('A2.profile-opens', marker.length > 0, [`openNewInstance → ${JSON.stringify(opened)}; remote shell → ${marker}`])

    // A3: helper scripts + bundled node (PLAN-036 K prerequisite); leftovers of the old bundle.
    const helpers = await wsl([
      `for f in scripts/bat-terminal.mjs scripts/bat-notify.mjs scripts/_bat-cert.mjs scripts/_bat-logger.mjs bin/node bin/bat-server; do test -e ${INSTALL_ROOT}/$f && echo "ok $f" || echo "missing $f"; done`,
      `echo "node $(${INSTALL_ROOT}/bin/node -v 2>&1)"`,
      `echo "node_modules: $(ls ${INSTALL_ROOT}/node_modules ${INSTALL_ROOT}/node_modules/@anthropic-ai 2>&1 | tr '\\n' ' ')"`,
      `echo "scripts: $(ls -A ${INSTALL_ROOT}/scripts | tr '\\n' ' ')"`,
    ].join('; '))
    record('A3', !/missing/.test(helpers) && /node v24\./.test(helpers), helpers.split('\n'))
    record('A3.leftovers', 'info', [
      'wsl:install-bundle replaces the install root cleanly (T0552): extracts to <root>.bat-new, swaps it in, removes the old tree',
      ...helpers.split('\n').filter(l => /^(node_modules|scripts):/.test(l))])
    if (UPGRADE_RUNNING) {
      // T0552 (BUG-139): the install root holds only the new bundle; the data dir is untouched.
      const clean = await wsl([
        `echo "## du"; du -sm ${INSTALL_ROOT} | cut -f1`,
        `echo "## canary"; for c in ${CANARIES.join(' ')}; do test -e ${INSTALL_ROOT}/$c && echo "present $c"; done; true`,
        `echo "## stale"; for p in ${STALE_PACKAGES.join(' ')}; do test -e ${INSTALL_ROOT}/node_modules/$p && echo "present $p"; done; true`,
        `echo "## siblings"; ls -d ${INSTALL_ROOT}.bat-new ${INSTALL_ROOT}.bat-old 2>/dev/null; true`,
        'echo "## data"; ls -A $HOME/.local/share/bat-server',
      ].join('; '))
      const duAfter = section(clean, 'du')
      const data = section(clean, 'data')
      const planted = CANARIES.every(c => canaryPlant.split('\n').includes(`planted ${c}`))
      record('A3.clean-install', planted && !section(clean, 'canary') && !section(clean, 'stale') && !section(clean, 'siblings')
        && data.includes('server-cert.json') && data.includes('server-token.json'), [
        planted ? `canaries planted in the old tree: ${CANARIES.join(', ')}` : `canary planting failed: ${canaryPlant.replace(/\n/g, ' / ') || '(no output)'}`,
        `canaries left after the upgrade: ${section(clean, 'canary') || 'none'}`,
        `stale packages present: ${section(clean, 'stale') || 'none'} (checked ${STALE_PACKAGES.join(', ')})`,
        `.bat-new / .bat-old left: ${section(clean, 'siblings') || 'none'}`,
        `data dir: ${data.replace(/\n/g, ' ')}`,
        `install root ${duBefore} MiB → ${duAfter} MiB (info only)`])
      if (section(clean, 'canary')) await removeCanaries()
    }
  })

  test('B4 smoke:remote:headless S1-S13 against the upgraded server', async () => {
    test.setTimeout(420_000)
    test.skip(!upgraded, 'server not upgraded')
    const smoke = await runNode(['scripts/smoke-remote-headless.mjs', '--target', `wsl:${DISTRO}`], 400_000)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'smoke-after.txt'), smoke.out)
    const lines = smoke.out.split(/\r?\n/)
    for (let i = 1; i <= 13; i++) {
      const line = lines.find(l => new RegExp(`^(PASS|FAIL|SKIP|WARN) S${i} `).test(l)) ?? `missing S${i}`
      record(`B4.S${i}`, line.startsWith('PASS') || line.startsWith('WARN'), [line])
    }
    record('B4', smoke.code === 0, [`exit ${smoke.code}`, lines.find(l => l.includes('RESULT')) ?? '', lines.find(l => l.includes('cleanup')) ?? ''])
  })

  test('B5 remote window: terminal, replay after reconnect, git / fs, Tower dispatch → Worker report', async () => {
    test.setTimeout(300_000)
    test.skip(!remotePage || !wslProfile, 'no remote window from the wizard test')
    const page = remotePage!
    const stamp = Date.now()

    // B5.1 terminal I/O, resize.
    const t1 = `t0550-b1-${stamp}`
    await createPty(page, { id: t1, cwd: '/tmp' })
    await settle(page, 'pty.resize', [t1, 100, 30])
    await ptyWrite(page, t1, 'echo "B51-$(stty size | tr \' \' x)-$(cat ~/.local/bat-server/package.json | tr -d \'\\n \' | sed \'s/.*version":"\\([^"]*\\)".*/\\1/\')-OK"\n')
    const b51 = await waitOutput(page, t1, /B51-\S+-OK/)
    record('B5.1', /B51-30x100-.*-OK/.test(b51), [`pty create / write / resize → ${b51}`])

    // B5.2 output printed while the window is disconnected comes back through pty:get-buffer.
    const t2 = `t0550-b2-${stamp}`
    await createPty(page, { id: t2, cwd: '/tmp' })
    await ptyWrite(page, t2, 'echo B52-PID-$$; (sleep 6; echo "B52-REPLAY-$((6*7))") &\n')
    const pidLine = await waitOutput(page, t2, /B52-PID-\d+/)
    await page.evaluate(async () => (window as AnyApi).electronAPI.remote.disconnect())
    const disconnectedAt = Date.now()
    const statusTrail: string[] = []
    for (let i = 0; i < 18; i++) {
      const s = await page.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())
      statusTrail.push(s.connected ? 'C' : 'd')
      await page.waitForTimeout(500)
    }
    // Live output while disconnected is informational (a renderer-side reconnect may pick it up).
    const sawLive = (await outputOf(page, t2)).includes('B52-REPLAY-42')
    const reconnect = await page.evaluate(async (p) => (window as AnyApi).electronAPI.remote.connect(p.remoteHost, p.remotePort, p.remoteToken, 't0550-reconnect', p.remoteFingerprint), wslProfile!)
    await expect.poll(async () => (await page.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())).connected,
      { timeout: 30_000, message: 'reconnected' }).toBe(true)
    // pty:get-buffer → { data, total } (PtyReplayBuffer), null when the PTY is gone.
    const replay = await page.evaluate(async (id) => (window as AnyApi).electronAPI.pty.getBuffer(id), t2) as { data?: string; total?: number } | null
    const buffer = String(replay?.data ?? '')
    await ptyWrite(page, t2, 'echo B52-PID-AFTER-$$\n')
    const pidAfter = await waitOutput(page, t2, /B52-PID-AFTER-\d+/)
    record('B5.2', statusTrail[0] === 'd' && buffer.includes('B52-REPLAY-42') && pidAfter.replace('-AFTER', '') === pidLine, [
      `remote.disconnect(); clientStatus every 0.5 s: ${statusTrail.join('')} (${Math.round((Date.now() - disconnectedAt) / 1000)} s); marker (printed 6 s after the write) seen live: ${sawLive}`,
      `remote.connect → ${JSON.stringify(reconnect)}; pty:get-buffer has B52-REPLAY-42: ${buffer.includes('B52-REPLAY-42')} (data ${buffer.length} chars, total ${replay?.total})`,
      `same shell after reconnect: ${pidLine} / ${pidAfter}`])

    // B5.3 git channels on a temp repo (created through the remote shell).
    await ptyWrite(page, t1, 'd=$(mktemp -d /tmp/bat-t0550-git.XXXXXX) && cd "$d" && git init -q -b t0550 && echo hi > f.txt && git add f.txt && git -c user.email=t0550@example.invalid -c user.name=t0550 commit -qm "t0550 commit" && echo dirty > g.txt && echo "B53-DIR=$d"\n')
    const dirLine = await waitOutput(page, t1, /B53-DIR=\/tmp\/bat-t0550-git\.[A-Za-z0-9]+/)
    const repo = dirLine.slice('B53-DIR='.length)
    const gitResults: Record<string, unknown> = {}
    for (const [label, cwd] of [['linux', repo], ['unc', UNC(repo)]] as const) {
      gitResults[label] = {
        root: await settle(page, 'git.getRoot', [cwd]),
        branch: await settle(page, 'git.getBranch', [cwd]),
        log: await settle(page, 'git.getLog', [cwd, 5]),
        status: await settle(page, 'git.getStatus', [cwd]),
      }
    }
    const g = JSON.stringify(gitResults)
    record('B5.3', /t0550 commit/.test(g) && /"value":"t0550"/.test(g) && /g\.txt/.test(g), [g.slice(0, 1400)])

    // B5.4 fs: denied before the workspace root is synced, readable after.
    const fsBefore = await settle(page, 'fs.readFile', [UNC(`${repo}/f.txt`)])
    const original = await page.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()) as string | null
    const data = JSON.parse(original ?? '{}') as { workspaces?: AnyApi[]; activeWorkspaceId?: string | null; terminals?: unknown[] }
    const wsId = `t0550-ws-${stamp}`
    // The workspace plus a Tower tab (B5.5) go into the registry; after a reload the window's own
    // UI opens the workspace, syncs its root and spawns the Tower tab's PTY (t0523 seeding).
    const tower = `t0550-tower-${stamp}`
    data.workspaces = [...(data.workspaces ?? []), { id: wsId, name: 'T0550 remote', folderPath: UNC(repo), createdAt: Date.now() }]
    data.activeWorkspaceId = wsId
    data.terminals = [...(data.terminals ?? []), { id: tower, workspaceId: wsId, type: 'terminal', title: 'T0550 Tower', cwd: UNC(repo) }]
    ;(data as AnyApi).activeTerminalId = tower
    await page.evaluate(async (d) => (window as AnyApi).electronAPI.workspace.save(d), JSON.stringify(data))
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await installCapture(page)
    await expect(page.locator('.workspace-item', { hasText: 'T0550 remote' })).toBeVisible({ timeout: 30_000 })
    let fsAfter: AnyApi
    await expect.poll(async () => {
      fsAfter = await settle(page, 'fs.readFile', [UNC(`${repo}/f.txt`)])
      return String(fsAfter?.value?.content ?? '')
    }, { timeout: 20_000, message: 'fs:readFile after sync-roots' }).toContain('hi')
    const dir = await settle(page, 'fs.readdir', [UNC(repo)])
    const outside = await settle(page, 'fs.readFile', [UNC('/etc/hostname')])
    record('B5.4', String((fsBefore.value as AnyApi)?.content ?? '') === '' && /f\.txt/.test(JSON.stringify(dir)) && !String((outside.value as AnyApi)?.content ?? ''), [
      `before sync: ${JSON.stringify(fsBefore).slice(0, 200)}`,
      `after workspace save (folderPath ${UNC(repo)}): readFile ${JSON.stringify(fsAfter).slice(0, 200)}; readdir ${JSON.stringify(dir).slice(0, 300)}`,
      `/etc/hostname: ${JSON.stringify(outside).slice(0, 200)}`])

    // B5.5 remote Tower dispatch lands in the Tower's workspace; the Worker reports back.
    // The Tower tab's PTY is spawned by the window (WorkspaceView) after the reload above.
    await expect.poll(async () => (await page.evaluate(async (id) => (window as AnyApi).electronAPI.pty.getBuffer(id), tower)) !== null,
      { timeout: 30_000, message: 'Tower tab PTY spawned by the remote window' }).toBe(true)
    await ptyWrite(page, tower, 'echo "B55-ENV $BAT_WORKSPACE_ID $BAT_TERMINAL_ID"\n')
    // Values only: the echoed command line itself also starts with B55-ENV.
    const envLine = await waitOutput(page, tower, /B55-ENV [^$\s"]+ [^$\s"]+/)
    await ptyWrite(page, tower, '"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --agent gemini-cli --prompt "t0550 probe (gemini is not installed)" --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" --cwd "$PWD"; echo "B55-EXIT=$?"\n')
    const exitLine = await waitOutput(page, tower, /B55-EXIT=\d+/, 45_000)
    const towerOut = await outputOf(page, tower)
    let created: AnyApi
    await expect.poll(async () => {
      created = (await page.evaluate(() => (window as AnyApi).__t0550.created as AnyApi[])).find(c => c.towerTerminalId === tower || c.workspaceId === wsId)
      return !!created
    }, { timeout: 20_000, message: 'terminal:created-externally' }).toBe(true)
    let saved: AnyApi
    await expect.poll(async () => {
      const s = JSON.parse((await page.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()) as string) ?? '{}')
      saved = (s.terminals ?? []).find((t: AnyApi) => t.id === created.id)
      return saved?.workspaceId ?? null
    }, { timeout: 30_000, message: 'worker tab saved in the Tower workspace' }).toBe(wsId)
    await page.waitForTimeout(3000)
    await shot(page, 'B5-dispatch')
    const worker = created.id as string
    await ptyWrite(page, worker, '\n"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --source "T0550" --target "$BAT_TOWER_TERMINAL_ID" "T0550 worker report"; echo "B55-NOTIFY=$?"\n')
    let notified: AnyApi
    await expect.poll(async () => {
      notified = (await page.evaluate(() => (window as AnyApi).__t0550.notified as AnyApi[])).find(n => n.targetId === tower)
      return !!notified
    }, { timeout: 30_000, message: 'terminal:notified' }).toBe(true)
    const workerOut = await outputOf(page, worker)
    record('B5.5', exitLine === 'B55-EXIT=0' && created.workspaceId === wsId && saved?.workspaceId === wsId && notified?.source === 'T0550', [
      `Tower tab env: ${envLine}`,
      `bat-terminal ${exitLine}; ${(towerOut.match(/✓ Terminal created[^\n]*|workspace:[^\n]*|agent:[^\n]*/g) ?? []).join(' / ')}`,
      `created-externally ${JSON.stringify(created)}; saved terminal ${JSON.stringify(saved && { id: saved.id, workspaceId: saved.workspaceId, towerTerminalId: saved.towerTerminalId })}`,
      `notified ${JSON.stringify(notified)}; worker ${(workerOut.match(/B55-NOTIFY=\d+|command not found[^\n]*/g) ?? []).join(' / ')}`])

    // Cleanup: PTYs, the temp repo, the test workspace.
    for (const id of [t1, t2, tower, worker]) await settle(page, 'pty.kill', [id])
    await wsl(`case "${repo}" in /tmp/bat-t0550-git.*) rm -rf "${repo}";; esac`)
    const restored = JSON.parse(original ?? '{}')
    await page.evaluate(async (d) => (window as AnyApi).electronAPI.workspace.save(d), JSON.stringify({ ...restored, workspaces: restored.workspaces ?? [], terminals: restored.terminals ?? [] }))
  })

  test('C6 PLAN-037 tool detection matches the distro', async () => {
    test.setTimeout(180_000)
    test.skip(!inst || !wslProfile, 'no profile from the wizard test')
    const actual = await wsl([
      'for t in claude codex git gh node python3 uv rg; do printf "%s=" "$t"; (command -v $t >/dev/null && $t --version 2>&1 | head -1) || echo missing; done',
      'printf "gh-auth="; gh auth status >/dev/null 2>&1 && echo yes || echo no',
      'printf "claude-credentials="; test -f $HOME/.claude/.credentials.json && echo yes || echo no',
      'printf "codex-auth="; test -f $HOME/.codex/auth.json && echo yes || echo no',
    ].join('; '))
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'c6-wsl-actual.txt'), actual)
    const fromMain = await settle(inst!.win, 'remoteTools.detect', [wslProfile!.id])
    const fromRemote = remotePage ? await settle(remotePage, 'remoteTools.detectHere', []) : { ok: false, error: 'no remote window' }
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'c6-detect.json'), JSON.stringify({ fromMain, fromRemote }, null, 2))
    const report = ((fromMain.value as AnyApi)?.report ?? (fromRemote.value as AnyApi)?.report) as AnyApi
    const tools: AnyApi[] = report?.tools ?? []
    const want = Object.fromEntries(actual.split('\n').map(l => l.trim().split('=')).filter(p => p.length >= 2).map(([k, ...v]) => [k, v.join('=')]))
    const rows: string[] = []
    let ok = tools.length > 0
    for (const id of ['claude', 'codex', 'git', 'gh', 'node']) {
      const t = tools.find(x => x.id === id)
      const expectedMissing = (want[id] ?? '').trim() === 'missing'
      const versionHit = t?.version ? (want[id] ?? '').includes(String(t.version)) : false
      const match = expectedMissing ? t?.status === 'missing' : (t?.status === 'ok' && versionHit)
      if (!match) ok = false
      rows.push(`${id}: detected ${t?.status ?? '?'}@${t?.version ?? '-'} path=${t?.path ?? '-'} serverVisible=${t?.serverVisible} | distro "${want[id] ?? '?'}" → ${match ? 'match' : 'MISMATCH'}`)
    }
    record('C6.versions', ok, rows)
    // Login: gh against `gh auth status`; claude / codex against their credential files (the probe
    // only checks existence, never reads them).
    const tool = (id: string) => tools.find(x => x.id === id) ?? {}
    const ghOk = (want['gh-auth'] === 'yes') === (tool('gh').login === 'loggedIn')
    const claudeOk = (want['claude-credentials'] === 'yes') === (tool('claude').credentialFilePresent === true)
    const codexOk = (want['codex-auth'] === 'yes') === (tool('codex').credentialFilePresent === true)
    record('C6.login', ghOk && claudeOk && codexOk, [
      `distro: gh-auth=${want['gh-auth']} claude-credentials=${want['claude-credentials']} codex-auth=${want['codex-auth']}`,
      ...['claude', 'codex', 'gh'].map(id => `${id}: login=${tool(id).login} credentialFilePresent=${tool(id).credentialFilePresent}`),
      `env: ${JSON.stringify(report?.env ?? null)}`])
    record('C6.both-paths', fromMain.ok && fromRemote.ok && (fromMain.value as AnyApi)?.ok === true && (fromRemote.value as AnyApi)?.ok === true, [
      `remoteTools.detect(profile) ok=${(fromMain.value as AnyApi)?.ok}; remoteTools.detectHere() ok=${(fromRemote.value as AnyApi)?.ok}${fromRemote.error ? ` (${fromRemote.error})` : ''}`])

    // The profile card's tools entry (UI); install buttons are never pressed.
    await openProfiles(inst!.win)
    const card = inst!.win.locator('.profile-card').filter({ hasText: wslProfile!.name })
    if (await card.locator('[data-testid="remote-tools-entry-profile"]').count() === 0) await card.locator('.profile-card-toggle').click().catch(() => { /* no toggle */ })
    const entry = card.locator('[data-testid="remote-tools-entry-profile"]')
    const entryText = await entry.innerText({ timeout: 10_000 }).catch(() => '(entry not visible)')
    await card.scrollIntoViewIfNeeded().catch(() => { /* ignore */ })
    await shot(inst!.win, 'C6-profile-card')
    record('C6.ui', 'info', [`profile card tools entry: ${entryText.replace(/\s+/g, ' ').slice(0, 400)}`])
  })

  test('A4 offline: download failure offers the import action; import fills the cache', async () => {
    test.setTimeout(300_000)
    const tarName = `bat-server-linux-x64-v${EXPECTED_VERSION}.tar.gz`
    test.skip(!fs.existsSync(path.join(IMPORT_DIR, tarName)), 'no tarball from A1 to import')
    // Close the first instance first (one isolated BAT at a time keeps the distro pins simple).
    await closeIsolated(inst, log)
    inst = undefined
    remotePage = undefined
    const off = await launchIsolated('t0550-a4', log, { env: { BAT_SERVER_BUNDLE_BASE_URL: 'http://127.0.0.1:9/' } })
    try {
      const win = off.win
      await openWslWizard(win)
      const outcome = await driveWizard(win)
      const steps = await stepStatuses(win)
      const actions = await win.locator('.bat-stepper-failed-actions [data-action-kind]').evaluateAll(els => els.map(e => `${e.getAttribute('data-action-kind')}:${(e as HTMLElement).innerText.trim()}`))
      await shot(win, 'A4-download-failed')
      const before = await serverState()
      record('A4.offer', outcome.result === 'failed' && actions.some(a => a.startsWith('import-server-bundle')) && section(before, 'is-active') === 'active', [
        `wizard ${outcome.result}; steps ${steps.join(', ')}`, `actions ${JSON.stringify(actions)}`, `detail ${outcome.text.replace(/\s+/g, ' ').slice(0, 700)}`,
        `WSL server untouched: ${section(before, 'version')} ${section(before, 'is-active')} MainPID ${section(before, 'MainPID')}`])
      await closeWizard(win)

      const tarball = path.join(IMPORT_DIR, tarName)
      await off.app.evaluate(({ dialog }, file) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
      }, tarball)
      const imported = await settle(win, 'remote.serverBundle.importLocal', [{ arch: 'linux-x64', version: EXPECTED_VERSION }])
      const cacheDir = path.join(off.userData, 'bat-server-bundles')
      const cached = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : []
      const distributed = await settle(win, 'remote.serverBundle.distribute', [{ draftProfile: { targetOS: 'wsl-linux', wslDistro: DISTRO }, version: EXPECTED_VERSION }])
      const offLog = latestLog(off.userData).split(/\r?\n/).filter(l => /\[server-bundle(-distributor|-import)?\]|import/i.test(l)).slice(-8)
      record('A4.import', (imported.value as AnyApi)?.ok === true && cached.includes(`${tarName}.sha256`) && (distributed.value as AnyApi)?.source === 'cache', [
        `importLocal → ${JSON.stringify(imported).slice(0, 400)}`, `cache ${JSON.stringify(cached)}`,
        `distribute (base URL unreachable) → ${JSON.stringify(distributed).slice(0, 300)}`, `log ${offLog.join(' / ').slice(0, 800)}`])
      const after = await serverState()
      record('A4.untouched', section(after, 'MainPID') === section(before, 'MainPID') && section(after, 'version') === EXPECTED_VERSION, [
        `MainPID ${section(before, 'MainPID')} → ${section(after, 'MainPID')}; version ${section(after, 'version')}`])
    } finally {
      await closeIsolated(off, log)
    }
  })
})

function normFp(fp: string | undefined | null): string {
  return String(fp ?? '').toUpperCase()
}
