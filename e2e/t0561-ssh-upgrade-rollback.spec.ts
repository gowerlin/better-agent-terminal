// T0561 — SSH setup-wizard upgrade on the installed build (T0554 / BUG-141 and T0552 / BUG-139, SSH path).
// OPT-IN: skipped unless BAT_E2E_T0561=1, BAT_E2E_EXECUTABLE points at an installed build and the
// environment from `node e2e/real-remote/t0515-wizard-env.mjs up` exists. Windows only; the ssh under
// test is Windows' built-in OpenSSH (PATH-prepended for the isolated instance), the target is the
// T0515 jump container (alias bat-t0515-direct, account `bat`, systemd user service).
//
//   node e2e/real-remote/t0515-wizard-env.mjs up        # fresh containers every run
//   $env:BAT_E2E_T0561='1'
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   npx playwright test e2e/t0561-ssh-upgrade-rollback.spec.ts
//   node e2e/real-remote/t0515-wizard-env.mjs down
//
// beforeAll appends the env script's marked block to the REAL ~/.ssh/config (original copied aside +
// SHA-256), afterAll restores it (hash-checked). One isolated runtime for all three tests (closed with
// keepUserData between them), so S2 sees the profile S0 wrote and the bundle cache S0 filled.
//
// Tests (serial):
//   S0  stock SSH wizard on the clean target → server active, 9876 held by the service's own pid.
//       Identity recorded: install-tree inode, a marker planted in the tree, unit sha256, MainPID,
//       server-cert.json / server-token.json sha256.
//   S1  the isolated main process answers `ssh:verify-tunnel-open` with a failure (the first main-
//       process call after install-server-bundle + start-server: fetch-fingerprint's tunnel), the
//       wizard upgrades the running server and fails there, the user cancels. While failed: new tree
//       in place (marker absent), `<root>.bat-old` and `<unit>.bat-prev` present. After cancel: marker
//       back, inode = S0, unit sha256 = S0, no `.bat-new` / `.bat-old` / `.bat-prev`, service active
//       with a new MainPID running from the restored tree, cert / token unchanged, profiles unchanged
//       (compared without updatedAt, T0560).
//   S2  canaries planted in the old tree, wizard to completion: canaries gone, no `.bat-new` /
//       `.bat-old` / `.bat-prev` (finalize), active + 9876 LISTEN by MainPID, cert / token unchanged,
//       S0's profile updated (same id, no new profile, T0552).
// All three runs install the same version (the installed build downloads its own server bundle); the
// marker / inode / canaries do not depend on a version change.
// Every check writes a verdict to <evidence>/results.json; each test fails if one of its own failed.

import { test, expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
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

const ENABLED = process.env.BAT_E2E_T0561 === '1'
const ENV_SCRIPT = path.join(REPO_ROOT, 'e2e', 'real-remote', 't0515-wizard-env.mjs')
const CONNECTION = path.join(os.tmpdir(), 'bat-t0515', 'ssh-env', 'connection.json')
const EVIDENCE_DIR = process.env.BAT_E2E_T0561_EVIDENCE_DIR || path.join(os.tmpdir(), 'bat-t0561', 'evidence')
const RESULTS = path.join(EVIDENCE_DIR, 'results.json')
const WINDOWS_OPENSSH_DIR = 'C:\\Windows\\System32\\OpenSSH'
const WIZARD_TIMEOUT_MS = 300_000
const SERVER_PORT = 9876
const SSH_STEP_IDS = ['configure-ssh-host', 'verify-ssh-auth', 'install-server-bundle', 'start-server', 'fetch-fingerprint', 'connect-test', 'write-profile', 'done']
const USER = 'bat'
const ROOT = `/home/${USER}/.local/bat-server`
const UNIT = `/home/${USER}/.config/systemd/user/bat-server.service`
const DATA = `/home/${USER}/.local/share/bat-server`
const MARKER = '.t0561-previous-install'
const CANARIES = ['.t0561-canary', 'node_modules/t0561-stale-canary']
const INJECTED = 'T0561 injected failure after start-server (ssh:verify-tunnel-open)'

interface Connection {
  distro: string
  aliases: { direct: string; noUserProxyJump: string }
  containers: { jump: { name: string; ip: string }; target: { name: string; ip: string } }
}

function loadConnection(): Connection | null {
  try {
    return JSON.parse(fs.readFileSync(CONNECTION, 'utf8')) as Connection
  } catch {
    return null
  }
}

const conn = loadConnection()
test.skip(!ENABLED, 'opt-in: set BAT_E2E_T0561=1 (T0561)')
test.skip(process.platform !== 'win32', 'Windows host only (Windows OpenSSH + WSL Docker)')
test.skip(ENABLED && !E2E_EXECUTABLE, 'set BAT_E2E_EXECUTABLE to the installed BetterAgentTerminal.exe under test')
test.skip(ENABLED && !conn, `no ${CONNECTION} — run \`node e2e/real-remote/t0515-wizard-env.mjs up\` first`)

const log = testLogger('t0561')

const LOCALES = ['en', 'zh-TW', 'zh-CN'].map(lang =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${lang}.json`), 'utf8')) as AnyApi)
const any = (pick: (l: AnyApi) => string) => LOCALES.map(pick)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const oneOf = (values: string[]) => new RegExp(`^(${[...new Set(values)].map(escape).join('|')})$`)
const COMPLETE = any(l => l.wizard.progress.complete)
const ADD_MORE = oneOf(any(l => l.profiles.addMore))

// ── verdicts ─────────────────────────────────────────────────────────────────

type Verdict = 'PASS' | 'FAIL' | 'INFO'
interface Result { verdict: Verdict; evidence: string[]; at: string }

function readResults(): Record<string, Result> {
  try {
    return JSON.parse(fs.readFileSync(RESULTS, 'utf8')) as Record<string, Result>
  } catch {
    return {}
  }
}

function record(key: string, pass: boolean | 'info', evidence: string[]): boolean {
  const verdict: Verdict = pass === 'info' ? 'INFO' : pass ? 'PASS' : 'FAIL'
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const all = readResults()
  all[key] = { verdict, evidence, at: new Date().toISOString() }
  fs.writeFileSync(RESULTS, JSON.stringify(all, null, 2))
  log(`${key}: ${verdict} — ${evidence.join(' | ').replace(/\s+/g, ' ').slice(0, 1500)}`)
  return verdict !== 'FAIL'
}

// ── environment helpers ──────────────────────────────────────────────────────

function envScript(command: string, timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [ENV_SCRIPT, command], { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = `${stdout}${stderr}`.trim()
      if (err) reject(new Error(`${command} failed: ${out}`))
      else resolve(out)
    })
  })
}

/** Runs a script in the jump container as root; never throws (failures come back as text). */
function jumpExec(script: string): Promise<string> {
  const args = ['-d', conn!.distro, '--exec', 'docker', 'exec', conn!.containers.jump.name, 'sh', '-c', script]
  return run('wsl.exe', args, 60_000).catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

const userSystemctl = `su - ${USER} -c "XDG_RUNTIME_DIR=/run/user/$(id -u ${USER}) systemctl --user`

function section(evidence: string, name: string): string {
  const parts = evidence.split(/^## /m)
  const hit = parts.find(p => p.startsWith(`${name}\n`) || p.startsWith(`${name}\r\n`))
  return hit ? hit.slice(name.length).replace(/^[^\n]*\n/, '').trim() : ''
}

/**
 * What a cancel must bring back and an upgrade must replace: marker / inode of the install tree,
 * unit hash, `.bat-new` / `.bat-old` / `.bat-prev` siblings, cert / token hashes (never their
 * content), service state, MainPID and the binary it runs, the 9876 listeners, canaries.
 */
function identity(): Promise<string> {
  return jumpExec([
    `echo "## marker"; test -e ${ROOT}/${MARKER} && echo present || echo absent`,
    `echo "## inode"; stat -c %i ${ROOT} 2>&1`,
    `echo "## unitsha"; sha256sum ${UNIT} 2>&1 | cut -d' ' -f1`,
    `echo "## execstart"; grep '^ExecStart=' ${UNIT} 2>&1`,
    `echo "## siblings"; ls -d ${ROOT}.bat-new ${ROOT}.bat-old ${UNIT}.bat-prev 2>/dev/null; true`,
    `echo "## certsha"; sha256sum ${DATA}/server-cert.json 2>&1 | cut -d' ' -f1`,
    `echo "## tokensha"; sha256sum ${DATA}/server-token.json 2>&1 | cut -d' ' -f1`,
    `echo "## active"; ${userSystemctl} is-active bat-server" 2>&1`,
    `PID=$(${userSystemctl} show -p MainPID --value bat-server" 2>/dev/null)`,
    'echo "## mainpid"; echo "$PID"',
    'echo "## procexe"; readlink /proc/$PID/exe 2>&1',
    `echo "## listen"; ss -tlnpH 2>&1 | grep ':${SERVER_PORT} '; true`,
    `echo "## canary"; for c in ${CANARIES.join(' ')}; do test -e ${ROOT}/$c && echo "present $c"; done; true`,
    `echo "## version"; sed -n 's/.*"version": *"\\([^"]*\\)".*/\\1/p' ${ROOT}/package.json 2>&1 | head -1`,
  ].join('; '))
}

/** The 9876 listener belongs to the service's own pid (verify only counts that socket). */
function ownListener(id: string): boolean {
  const pid = section(id, 'mainpid')
  return /^\d+$/.test(pid) && pid !== '0' && section(id, 'listen').split('\n')
    .some(l => new RegExp(`127\\.0\\.0\\.1:${SERVER_PORT}\\s`).test(l) && l.includes(`pid=${pid},`))
}

/** The running binary sits in the current install root (not a renamed / deleted tree). */
function runsFromRoot(id: string): boolean {
  const exe = section(id, 'procexe')
  return exe.startsWith(`${ROOT}/`) && !exe.includes('(deleted)')
}

const brief = (id: string) => [
  `marker ${section(id, 'marker')}`, `inode ${section(id, 'inode')}`, `unit ${section(id, 'unitsha').slice(0, 16)}…`,
  `siblings ${section(id, 'siblings').replace(/\s+/g, ' ') || 'none'}`, `active ${section(id, 'active')}`,
  `MainPID ${section(id, 'mainpid')} exe ${section(id, 'procexe')}`, `cert ${section(id, 'certsha').slice(0, 16)}…`,
  `token ${section(id, 'tokensha').slice(0, 16)}…`, `version ${section(id, 'version')}`,
].join('; ')

// ── UI helpers ───────────────────────────────────────────────────────────────

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file }).catch(err => log(`screenshot ${name} failed: ${(err as Error).message}`))
}

async function openProfiles(win: Page): Promise<void> {
  if (await win.locator('.profile-card').count() > 0) return
  await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
  await expect(win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
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

type Outcome = { result: 'complete' | 'failed' | 'timeout'; text: string; prompts: string[] }

/** Runs the open wizard until it completes or a step fails; the only prompt answered is the alias. */
async function driveWizard(win: Page, alias: string): Promise<Outcome> {
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
      // The alias list also shows the user's own ~/.ssh/config hosts: keep only this run's names.
      const userAliases = (await prompt.getByRole('button').allInnerTexts().catch(() => [] as string[]))
        .map(t => t.trim()).filter(t => /^[A-Za-z0-9._-]+$/.test(t) && !t.startsWith('bat-t0515-'))
        .sort((a, b) => b.length - a.length)
      let promptText = (await prompt.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
      for (const a of userAliases) promptText = promptText.split(a).join('<user alias>')
      if (promptText && !prompts.includes(promptText)) prompts.push(promptText)
      const button: Locator = prompt.getByRole('button', { name: alias, exact: true })
      if (await button.count() > 0) {
        await button.click()
        await expect(button).toHaveCount(0, { timeout: 15_000 })
      }
    }
    await win.waitForTimeout(500)
  }
  return { result: 'timeout', text: await shell.innerText().catch(() => ''), prompts }
}

async function stepStatuses(win: Page): Promise<Record<string, string>> {
  const rows = await win.locator('.bat-wizard-shell .bat-stepper-step').evaluateAll(els => els.map(e =>
    [...e.classList].find(c => c.startsWith('bat-stepper-status-'))?.slice('bat-stepper-status-'.length) ?? '?'))
  return Object.fromEntries(SSH_STEP_IDS.map((id, i) => [id, rows[i] ?? 'missing']))
}

function captureWizardLog(win: Page): string[] {
  const lines: string[] = []
  win.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    if (text.includes('[ssh-wizard]') || /rollback|restore/i.test(text)) lines.push(`${msg.type()}: ${text}`)
  })
  return lines
}

interface ProfileRow {
  id: string; name: string; type?: string; targetOS?: string; sshHost?: string; sshUser?: string; sshPort?: number
  remotePort?: number; remoteToken?: string; remoteFingerprint?: string; updatedAt?: number
}

async function profiles(win: Page): Promise<ProfileRow[]> {
  return (await win.evaluate(async () => (window as AnyApi).electronAPI.profile.list())).profiles as ProfileRow[]
}

const redact = (p: ProfileRow) => ({ ...p, remoteToken: p.remoteToken ? '<set>' : p.remoteToken })
// T0560: the renderer's autosave bumps the local profile's updatedAt; everything else must stay.
const comparable = (p: ProfileRow) => ({ ...redact(p), updatedAt: undefined })
const summary = (ps: ProfileRow[]) => JSON.stringify(ps.map(p => ({ id: p.id, name: p.name, targetOS: p.targetOS, sshHost: p.sshHost, remotePort: p.remotePort, fp: String(p.remoteFingerprint ?? '').slice(0, 11) })))

function isolatedSshEnv(): Record<string, string> {
  return { Path: `${WINDOWS_OPENSSH_DIR};${process.env.PATH ?? process.env.Path ?? ''}` }
}

// ── shared state ─────────────────────────────────────────────────────────────

let configApplied = false
let runtimeId: string | undefined
let runtimeUserData: string | undefined
let s0: { id: string; profile?: ProfileRow } | undefined

async function launch(tag: string): Promise<IsolatedInstance> {
  const inst = await launchIsolated(tag, log, { env: isolatedSshEnv(), ...(runtimeId ? { runtimeId } : {}) })
  runtimeId = inst.runtimeId
  runtimeUserData = inst.userData
  return inst
}

test.describe.serial('T0561 SSH wizard upgrade / cancel restore', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    const version = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `(Get-Item '${E2E_EXECUTABLE.replace(/'/g, "''")}').VersionInfo.FileVersion`], 20_000).catch(() => '?')
    log(`executable under test: ${E2E_EXECUTABLE} FileVersion ${version.trim()}`)
    log(await envScript('apply-ssh-config'))
    configApplied = true
  })

  test.afterAll(async () => {
    if (configApplied) log(await envScript('restore-ssh-config'))
    configApplied = false
    // A failed test may have closed the instance with keepUserData; never leave it behind.
    if (runtimeUserData && runtimeId && path.basename(runtimeUserData).endsWith(`-runtime-${runtimeId}`) && fs.existsSync(runtimeUserData)) {
      fs.rmSync(runtimeUserData, { recursive: true, force: true })
      log(`removed isolated userData ${runtimeUserData}: ${!fs.existsSync(runtimeUserData)}`)
    }
  })

  test('S0 first install on a clean target', async () => {
    test.setTimeout(WIZARD_TIMEOUT_MS + 180_000)
    const alias = conn!.aliases.direct
    const left = (await jumpExec(`ls -A ${ROOT} ${ROOT}.bat-old ${UNIT} 2>/dev/null | head -3; true`)).trim()
    expect(left, 'the jump container still has a bat-server from an earlier run — run the env script\'s up again').toBe('')
    const ok: boolean[] = []
    const inst = await launch('t0561')
    let keep = true
    try {
      const { win } = inst
      const wizardLog = captureWizardLog(win)
      const before = new Set((await profiles(win)).map(p => p.id))
      await openSshWizard(win)
      const started = Date.now()
      const outcome = await driveWizard(win, alias)
      await shot(win, `S0-wizard-${outcome.result}`)
      log(`S0: wizard ${outcome.result} in ${Math.round((Date.now() - started) / 1000)} s; prompts ${JSON.stringify(outcome.prompts)}`)
      fs.writeFileSync(path.join(EVIDENCE_DIR, 's0-wizard-log.txt'), wizardLog.join('\n'))
      const complete = outcome.result === 'complete'
      if (!complete) log(`S0 wizard text: ${outcome.text.replace(/\s+/g, ' ').slice(0, 1200)}`)
      // The finalize of a first install has nothing to drop; wait for the stepper to settle anyway.
      const id = await identity()
      const created = complete ? (await profiles(win)).filter(p => !before.has(p.id)) : []
      ok.push(record('S0.installed', complete && section(id, 'active') === 'active' && ownListener(id) && runsFromRoot(id)
        && section(id, 'execstart') === `ExecStart=${ROOT}/bin/bat-server --port ${SERVER_PORT} --bind-interface localhost`
        && !section(id, 'siblings') && /^[0-9a-f]{64}$/.test(section(id, 'certsha')) && /^[0-9a-f]{64}$/.test(section(id, 'tokensha'))
        && created.length === 1, [
        `wizard ${outcome.result}`, brief(id), section(id, 'execstart'), `listen ${section(id, 'listen').replace(/\s+/g, ' ')}`,
        `profiles created ${created.length}: ${summary(created)}`]))
      // Plant the marker and record the identity S1 must bring back.
      const plant = await jumpExec(`touch ${ROOT}/${MARKER} && chown ${USER}:${USER} ${ROOT}/${MARKER} && echo planted`)
      const idAfterPlant = await identity()
      fs.writeFileSync(path.join(EVIDENCE_DIR, 's0-identity.txt'), idAfterPlant)
      s0 = { id: idAfterPlant, profile: created[0] }
      ok.push(record('S0.identity', plant.trim() === 'planted' && section(idAfterPlant, 'marker') === 'present', [
        `marker ${plant.trim()}`, brief(idAfterPlant)]))
      if (complete) await closeWizard(win).catch(() => { /* already closed */ })
    } catch (err) {
      keep = false
      throw err
    } finally {
      await closeIsolated(inst, log, { keepUserData: keep })
    }
    expect(ok.every(Boolean), 'S0 checks (see results.json)').toBe(true)
  })

  test('S1 upgrade fails after start-server → Cancel restores the previous tree, unit and running service', async () => {
    test.setTimeout(WIZARD_TIMEOUT_MS + 300_000)
    expect(s0, 'S0 identity').toBeDefined()
    const alias = conn!.aliases.direct
    const before = await identity()
    expect(section(before, 'active'), 'S1 needs the S0 server active').toBe('active')
    expect(section(before, 'marker'), 'S1 needs the S0 marker').toBe('present')
    const ok: boolean[] = []
    const inst = await launch('t0561')
    let keep = true
    try {
      const { win, app } = inst
      const wizardLog = captureWizardLog(win)
      // Fail the first main-process call after install-server-bundle + start-server: fetch-fingerprint
      // opens its verify tunnel through `ssh:verify-tunnel-open` (ensureSshVerifyEndpoint). Nothing
      // else in this instance is changed.
      await app.evaluate(({ ipcMain }, message) => {
        ipcMain.removeHandler('ssh:verify-tunnel-open')
        ipcMain.handle('ssh:verify-tunnel-open', async () => ({ ok: false, errorCode: 'ssh-tunnel-failed', error: message }))
      }, INJECTED)
      const profilesBefore = await profiles(win)
      await openSshWizard(win)
      const outcome = await driveWizard(win, alias)
      const failedSteps = await stepStatuses(win)
      await shot(win, 'S1-failed')
      const mid = await identity()
      fs.writeFileSync(path.join(EVIDENCE_DIR, 's1-identity-mid.txt'), mid)
      const detail = outcome.text.replace(/\s+/g, ' ')
      const siblingsMid = section(mid, 'siblings')
      ok.push(record('S1.failed-after-install', outcome.result === 'failed'
        && failedSteps['fetch-fingerprint'] === 'failed' && failedSteps['start-server'] === 'completed' && failedSteps['install-server-bundle'] === 'completed'
        && detail.includes(INJECTED) && section(mid, 'marker') === 'absent'
        && siblingsMid.includes(`${ROOT}.bat-old`) && siblingsMid.includes(`${UNIT}.bat-prev`) && !siblingsMid.includes(`${ROOT}.bat-new`)
        && section(mid, 'active') === 'active' && section(mid, 'mainpid') !== section(before, 'mainpid') && runsFromRoot(mid), [
        `wizard ${outcome.result}; steps ${JSON.stringify(failedSteps)}`, `detail: ${detail.slice(0, 400)}`,
        `while failed (new bundle restarted by start-server): ${brief(mid)}`]))

      if (outcome.result === 'failed') {
        await win.locator('.bat-stepper-failed-actions [data-action-kind="cancel"]').first().click()
        await expect.poll(async () => {
          const now = await identity()
          return section(now, 'marker') === 'present' && !section(now, 'siblings')
        }, { timeout: 180_000, intervals: [2000], message: 'previous install restored' }).toBe(true).catch(() => log('S1: previous install not restored within 180 s'))
        let after = ''
        await expect.poll(async () => {
          after = await identity()
          return section(after, 'active') === 'active' && ownListener(after)
        }, { timeout: 60_000, intervals: [2000], message: 'previous server running again' }).toBe(true).catch(() => log('S1: previous server not running within 60 s'))
        after = await identity()
        fs.writeFileSync(path.join(EVIDENCE_DIR, 's1-identity-after.txt'), after)
        const stepsAfter = await stepStatuses(win)
        await shot(win, 'S1-cancelled')
        fs.writeFileSync(path.join(EVIDENCE_DIR, 's1-wizard-log.txt'), wizardLog.join('\n'))
        const profilesAfter = await profiles(win)
        const ref = s0!.id
        ok.push(record('S1.tree-restored', section(after, 'marker') === 'present' && section(after, 'inode') === section(ref, 'inode')
          && !section(after, 'siblings') && section(after, 'canary') === '', [
          `marker ${section(after, 'marker')}; inode S0 ${section(ref, 'inode')} → failed ${section(mid, 'inode')} → after cancel ${section(after, 'inode')}`,
          `.bat-new / .bat-old / .bat-prev left: ${section(after, 'siblings').replace(/\s+/g, ' ') || 'none'}`,
          `steps after cancel: ${JSON.stringify(stepsAfter)}`]))
        ok.push(record('S1.unit-restored', section(after, 'unitsha') === section(ref, 'unitsha') && !section(after, 'siblings').includes('.bat-prev'), [
          `unit sha256 S0 ${section(ref, 'unitsha')} → failed ${section(mid, 'unitsha')} → after ${section(after, 'unitsha')}`,
          section(after, 'execstart')]))
        ok.push(record('S1.service-running', section(after, 'active') === 'active' && ownListener(after) && runsFromRoot(after)
          && section(after, 'mainpid') !== section(mid, 'mainpid') && section(after, 'mainpid') !== section(ref, 'mainpid'), [
          `MainPID S0 ${section(ref, 'mainpid')} → failed (new bundle) ${section(mid, 'mainpid')} → restored ${section(after, 'mainpid')}`,
          `exe ${section(after, 'procexe')} (tree with the S0 marker, inode ${section(after, 'inode')})`,
          `listen ${section(after, 'listen').replace(/\s+/g, ' ')}`]))
        ok.push(record('S1.identity-kept', section(after, 'certsha') === section(ref, 'certsha') && section(after, 'tokensha') === section(ref, 'tokensha'), [
          `server-cert.json ${section(ref, 'certsha').slice(0, 16)}… → ${section(after, 'certsha').slice(0, 16)}…`,
          `server-token.json ${section(ref, 'tokensha').slice(0, 16)}… → ${section(after, 'tokensha').slice(0, 16)}…`]))
        const bumped = profilesAfter.filter(p => profilesBefore.some(b => b.id === p.id && b.updatedAt !== p.updatedAt))
        ok.push(record('S1.profiles-untouched', JSON.stringify(profilesAfter.map(comparable)) === JSON.stringify(profilesBefore.map(comparable))
          && profilesAfter.some(p => p.id === s0!.profile?.id), [
          `before ${profilesBefore.length} / after ${profilesAfter.length}: ${summary(profilesAfter)}`,
          `updatedAt changed (ignored): ${bumped.map(p => `${p.name} ${profilesBefore.find(b => b.id === p.id)?.updatedAt} → ${p.updatedAt}`).join(', ') || 'none'}`]))
        const warnings = wizardLog.filter(l => /Failed to|Rollback failed|No previous BAT server bundle|is not a function/i.test(l))
        ok.push(record('S1.rollback-log', warnings.length === 0, [
          `warnings: ${JSON.stringify(warnings)}`, ...wizardLog.filter(l => /Restored|restore/i.test(l)).slice(-6)]))
      }
      await closeWizard(win).catch(() => { /* already closed */ })
    } catch (err) {
      keep = false
      throw err
    } finally {
      await closeIsolated(inst, log, { keepUserData: keep })
    }
    expect(ok.every(Boolean), 'S1 checks (see results.json)').toBe(true)
  })

  test('S2 normal upgrade: clean overwrite, finalize drops .bat-old / .bat-prev, profile updated', async () => {
    test.setTimeout(WIZARD_TIMEOUT_MS + 240_000)
    expect(s0, 'S0 identity').toBeDefined()
    const alias = conn!.aliases.direct
    const plant = (await jumpExec([
      `echo t0561 > ${ROOT}/${CANARIES[0]}`,
      `mkdir -p ${ROOT}/${CANARIES[1]}`,
      `echo '{"name":"t0561-stale-canary","version":"0.0.0"}' > ${ROOT}/${CANARIES[1]}/package.json`,
      `chown -R ${USER}:${USER} ${ROOT}/${CANARIES[0]} ${ROOT}/node_modules/t0561-stale-canary`,
      `for c in ${CANARIES.join(' ')}; do test -e ${ROOT}/$c && echo "planted $c" || echo "missing $c"; done`,
    ].join('; '))).trim()
    const before = await identity()
    fs.writeFileSync(path.join(EVIDENCE_DIR, 's2-identity-before.txt'), before)
    log(`S2 before: ${brief(before)}; canaries ${plant.replace(/\s+/g, ' ')}`)
    const ok: boolean[] = []
    const inst = await launch('t0561')
    try {
      const { win } = inst
      const wizardLog = captureWizardLog(win)
      const profilesBefore = await profiles(win)
      await openSshWizard(win)
      const started = Date.now()
      const outcome = await driveWizard(win, alias)
      const steps = await stepStatuses(win)
      await shot(win, `S2-wizard-${outcome.result}`)
      log(`S2: wizard ${outcome.result} in ${Math.round((Date.now() - started) / 1000)} s; steps ${JSON.stringify(steps)}; prompts ${JSON.stringify(outcome.prompts)}`)
      if (outcome.result !== 'complete') log(`S2 wizard text: ${outcome.text.replace(/\s+/g, ' ').slice(0, 1200)}`)
      // finalize runs after the last step; give it time to drop the backups.
      let after = ''
      await expect.poll(async () => {
        after = await identity()
        return !section(after, 'siblings')
      }, { timeout: 90_000, intervals: [2000], message: 'finalize removed .bat-old / .bat-prev' }).toBe(true).catch(() => log('S2: siblings still present after 90 s'))
      after = await identity()
      fs.writeFileSync(path.join(EVIDENCE_DIR, 's2-identity-after.txt'), after)
      fs.writeFileSync(path.join(EVIDENCE_DIR, 's2-wizard-log.txt'), wizardLog.join('\n'))
      const complete = outcome.result === 'complete'
      const planted = CANARIES.every(c => plant.split('\n').includes(`planted ${c}`))
      ok.push(record('S2.clean-install', complete && planted && section(after, 'canary') === '' && section(after, 'marker') === 'absent'
        && section(after, 'inode') !== section(before, 'inode'), [
        planted ? `canaries planted in the old tree: ${CANARIES.join(', ')}` : `canary planting failed: ${plant.replace(/\n/g, ' / ')}`,
        `canaries left: ${section(after, 'canary') || 'none'}; S0 marker ${section(after, 'marker')}; inode ${section(before, 'inode')} → ${section(after, 'inode')}`]))
      const finalizeLines = wizardLog.filter(l => /Removed the previous BAT server bundle|unit backup|\.bat-old/i.test(l))
      ok.push(record('S2.finalize', complete && !section(after, 'siblings'), [
        `.bat-new / .bat-old / .bat-prev left: ${section(after, 'siblings').replace(/\s+/g, ' ') || 'none'}`, ...finalizeLines.slice(-4)]))
      ok.push(record('S2.server', complete && section(after, 'active') === 'active' && ownListener(after) && runsFromRoot(after)
        && section(after, 'mainpid') !== section(before, 'mainpid')
        && section(after, 'execstart') === `ExecStart=${ROOT}/bin/bat-server --port ${SERVER_PORT} --bind-interface localhost`, [
        brief(after), `listen ${section(after, 'listen').replace(/\s+/g, ' ')}`, section(after, 'execstart')]))
      ok.push(record('S2.identity-kept', section(after, 'certsha') === section(s0!.id, 'certsha') && section(after, 'tokensha') === section(s0!.id, 'tokensha'), [
        `server-cert.json ${section(s0!.id, 'certsha').slice(0, 16)}… → ${section(after, 'certsha').slice(0, 16)}…`,
        `server-token.json ${section(s0!.id, 'tokensha').slice(0, 16)}… → ${section(after, 'tokensha').slice(0, 16)}…`]))
      const profilesAfter = await profiles(win)
      const original = profilesAfter.find(p => p.id === s0!.profile?.id)
      const added = profilesAfter.filter(p => !profilesBefore.some(b => b.id === p.id))
      const updateLine = wizardLog.find(l => l.includes('Updated the existing remote profile')) ?? ''
      ok.push(record('S2.profile-updated', complete && Boolean(original) && added.length === 0 && profilesAfter.length === profilesBefore.length
        && original!.name === s0!.profile?.name && updateLine !== '', [
        `before ${summary(profilesBefore)}`, `after ${summary(profilesAfter)}`, `added ${added.length}`, updateLine || '(no "Updated the existing remote profile" line)']))
      if (complete) await closeWizard(win).catch(() => { /* already closed */ })
    } finally {
      // Remove leftover canaries (only if the upgrade did not) so a rerun starts from the env script's up.
      await jumpExec(CANARIES.map(c => `rm -rf ${ROOT}/${c}`).join('; '))
      await closeIsolated(inst, log)
      runtimeUserData = undefined
    }
    expect(ok.every(Boolean), 'S2 checks (see results.json)').toBe(true)
  })
})
