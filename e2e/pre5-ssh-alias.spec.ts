// T0510 A6 — SSH wizard with ~/.ssh/config aliases (T0505 §7 items 1-3, 5, 6; T0506), against
// real sshd containers, on the installed build or a source build. OPT-IN: skipped unless
// BAT_E2E_PRE5_SSH=1 and the environment from `node e2e/real-remote/t0510-ssh-alias-env.mjs up`
// exists. Windows only; the ssh under test is Windows' built-in OpenSSH (PATH-prepended for the
// isolated instance).
//
//   node e2e/real-remote/t0510-ssh-alias-env.mjs up        # fresh containers every run
//   $env:BAT_E2E_PRE5_SSH='1'
//   # installed build (optional; without it the source build in dist-electron runs, `npx vite build` first)
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   npx playwright test e2e/pre5-ssh-alias.spec.ts
//   node e2e/real-remote/t0510-ssh-alias-env.mjs down
//
// Server bundle (T0511): a source build has no bat-server-baseline next to its electron binary,
// so the wizard would download the release tarball for every isolated instance. For a source
// build the spec serves a local bundle directory (manifest.json + tarballs) over HTTP and points
// the instance at it with BAT_SERVER_BUNDLE_BASE_URL. Directory: BAT_E2E_PRE5_SSH_BUNDLE_DIR, else
// the installed BAT's resources\bat-server-baseline. The installed build uses its own baseline.
//
// Windows OpenSSH ignores USERPROFILE / HOME for `~`, so the aliases go into the REAL
// ~/.ssh/config: beforeAll runs `apply-ssh-config` (original copied aside, SHA-256 recorded,
// one marked block appended), afterAll runs `restore-ssh-config` (hash-checked). See the env
// script header for the block and the manual restore command.
//
// A6-0  stock install on a clean target (alias without Port): the wizard must finish, the bundle
//       sits at ~/.local/bat-server/bin (no staging/, BUG-120) and the service's process listens
//       on 127.0.0.1:9876 (BUG-121).
// A6-1  alias with HostName + User + IdentityFile, no Port            → bat-t0510-jump
// A6-2  same with a custom Port                                         → bat-t0510-jump
//       (T0511: the target first gets a pre-fix `~/.local/bat-server/staging/`; the wizard
//       must remove it)
// A6-3  alias through ProxyJump (the target has no route from Windows)  → bat-t0510-target
// A6-4  alias without User (Windows login ≠ `bat`): verify-ssh-auth fails with
//       permission-denied, the mapped "Edit SSH settings" action (T0511) jumps back, a typed
//       bat@127.0.0.1:<port> succeeds
// A6-5  restart the instance; every profile above reconnects (the typed one is item 6) through
//       C:\Windows\System32\OpenSSH\ssh.exe, and a remote shell reports the expected host
//
// pre.5 cannot finish A6-0 (T0510 report; BUG-120 / BUG-121, fixed in T0511): the uploaded
// tarball kept its `staging/` top directory, and the systemd unit passed BAT_REMOTE_PORT while
// bat-server reads --port / BAT_SERVER_PORT. To check the alias handling on such a build anyway,
// set BAT_E2E_PRE5_SSH_WORKAROUND=1: A6-1..4 then prepare each target first (symlinks
// ~/.local/bat-server/<entry> → staging/<entry>, a unit drop-in with BAT_SERVER_PORT=9876). It is
// off by default since T0511, and the T0511 staging / mapped-action checks are skipped with it.

import { test, expect, type Locator, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
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

const ENABLED = process.env.BAT_E2E_PRE5_SSH === '1'
const ENV_SCRIPT = path.join(REPO_ROOT, 'e2e', 'real-remote', 't0510-ssh-alias-env.mjs')
const CONNECTION = path.join(os.tmpdir(), 'bat-t0510', 'ssh-env', 'connection.json')
const EVIDENCE_DIR = process.env.BAT_E2E_PRE5_EVIDENCE_DIR || path.join(os.tmpdir(), 'bat-t0510', 'evidence')
const WINDOWS_OPENSSH_DIR = 'C:\\Windows\\System32\\OpenSSH'
const WIZARD_TIMEOUT_MS = 240_000

interface Connection {
  distro: string
  sshPort: number
  sshUser: string
  windowsUser: string
  aliases: { direct: string; port: string; jumphost: string; viaJump: string; noUser: string }
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
test.skip(!ENABLED, 'opt-in: set BAT_E2E_PRE5_SSH=1 (T0510)')
test.skip(process.platform !== 'win32', 'Windows host only (Windows OpenSSH + WSL Docker)')
test.skip(ENABLED && !conn, `no ${CONNECTION} — run \`node e2e/real-remote/t0510-ssh-alias-env.mjs up\` first`)

const log = testLogger('t0510-a6')

// Localised labels (the isolated instance follows the OS language).
const LOCALES = ['en', 'zh-TW', 'zh-CN'].map(lang =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${lang}.json`), 'utf8')) as AnyApi)
const any = (pick: (l: AnyApi) => string) => LOCALES.map(pick)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const oneOf = (values: string[]) => new RegExp(`^(${[...new Set(values)].map(escape).join('|')})$`)
const COMPLETE = any(l => l.wizard.progress.complete)
const ADD_MORE = oneOf(any(l => l.profiles.addMore))
// The ssh-permission-denied mapper entry labels it 'Edit SSH settings'; the generic failure
// actions call the same jump 'Edit config'. Either one is the way back to configure-ssh-host.
const EDIT_SSH = oneOf([...any(l => l.wizard.action.editSshSettings), ...any(l => l.wizard.action.editConfig)])
// T0511: with the fix only the mapper's own label is acceptable.
const EDIT_SSH_MAPPED = oneOf(any(l => l.wizard.action.editSshSettings))
const PERMISSION_DENIED_TITLE = any(l => l.wizard.ssh.error.permissionDenied.title)
const SHOW_DETAILS = oneOf(any(l => l.wizard.action.showDetails))
const MANUAL_HOST = oneOf(any(l => l.wizard.ssh.manualHost.option))
const SUBMIT = oneOf(any(l => l.wizard.action.submitText))
const HINT_USER_AND_PORT = any(l => l.profiles.sshDetails.userAndPortFromConfig)
const HINT_USER = any(l => l.profiles.sshDetails.userFromConfig)

// ── environment helpers ──────────────────────────────────────────────────────

function envScript(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [ENV_SCRIPT, command], { timeout: 60_000, windowsHide: true }, (err, stdout, stderr) => {
      const out = `${stdout}${stderr}`.trim()
      if (err) reject(new Error(`${command} failed: ${out}`))
      else resolve(out)
    })
  })
}

function dockerExec(container: string, script: string, user?: string): Promise<string> {
  const args = ['-d', conn!.distro, '--exec', 'docker', 'exec', ...(user ? ['-u', user] : []), container, 'sh', '-c', script]
  return run('wsl.exe', args, 60_000).catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

const USER_SYSTEMCTL = 'su - bat -c "XDG_RUNTIME_DIR=/run/user/$(id -u bat) systemctl --user'

async function serviceState(container: string): Promise<string> {
  return (await dockerExec(container, `${USER_SYSTEMCTL} is-active bat-server" 2>&1; true`)).trim()
}

/** Test-side preparation for the two pre.5 defects A6-0 documents (see the header). */
async function prepareTarget(container: string): Promise<void> {
  const out = await dockerExec(container, [
    'mkdir -p ~/.local/bat-server && cd ~/.local/bat-server',
    'for e in bin electron node_modules scripts package.json README.md; do [ -e "$e" ] || [ -L "$e" ] || ln -s "staging/$e" "$e"; done',
    'mkdir -p ~/.config/systemd/user/bat-server.service.d',
    'printf "[Service]\\nEnvironment=BAT_SERVER_PORT=9876\\n" > ~/.config/systemd/user/bat-server.service.d/t0510-port.conf',
    'ls -1 ~/.local/bat-server | tr "\\n" " "',
  ].join(' && '), 'bat')
  log(`WORKAROUND on ${container} (test-side, not a product change): ~/.local/bat-server → ${out.trim()}; drop-in BAT_SERVER_PORT=9876`)
}

// A6-0 records its verdict here (evidence only since T0511).
const STOCK_RESULT = path.join(EVIDENCE_DIR, 'a6-0-stock-result.json')
/** Opt-in since T0511 (see the header): only for builds with BUG-120 / BUG-121. */
function workaroundWanted(): boolean {
  return process.env.BAT_E2E_PRE5_SSH_WORKAROUND === '1'
}

/** T0511 (A2): an install left by a pre-fix wizard keeps the bundle under staging/. */
async function seedLegacyStaging(container: string): Promise<void> {
  const out = await dockerExec(container, [
    'mkdir -p ~/.local/bat-server/staging/bin',
    'printf "#!/bin/sh\\nexit 1\\n" > ~/.local/bat-server/staging/bin/bat-server',
    'chmod +x ~/.local/bat-server/staging/bin/bat-server',
    'ls -A ~/.local/bat-server | tr "\\n" " "',
  ].join(' && '), 'bat')
  log(`seeded a pre-fix staging/ on ${container}: ~/.local/bat-server → ${out.trim()}`)
}

/** BUG-120 / BUG-121 evidence: bundle layout, unit, and who listens on 9876. */
async function installEvidence(container: string): Promise<string> {
  return dockerExec(container, [
    'echo "## ls ~/.local/bat-server"; ls -A /home/bat/.local/bat-server',
    'echo "## ExecStart"; grep ^ExecStart /home/bat/.config/systemd/user/bat-server.service',
    `echo "## status"; ${USER_SYSTEMCTL} status bat-server --no-pager -l" 2>&1 | head -12`,
    'echo "## listening"; ss -tlnp | tail -n +2',
    `echo "## journal"; journalctl --no-pager -q _UID=$(id -u bat) 2>/dev/null | grep "listening on" | tail -2`,
  ].join('; '))
}

// ── server bundle for source builds (T0511, see the header) ─────────────────────

const BUNDLE_DIR = E2E_EXECUTABLE
  ? ''
  : process.env.BAT_E2E_PRE5_SSH_BUNDLE_DIR || 'C:\\Program Files\\BetterAgentTerminal\\resources\\bat-server-baseline'
let bundleServer: http.Server | undefined
let bundleBaseUrl = ''

/** Serves manifest.json and the tarballs it lists from BUNDLE_DIR on 127.0.0.1. */
async function startBundleServer(): Promise<void> {
  if (!BUNDLE_DIR) return
  const manifestPath = path.join(BUNDLE_DIR, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    log(`bundle server: no ${manifestPath}; the instance downloads the release bundle instead`)
    return
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { version?: string; tarballs: Record<string, { filename: string }> }
  const served = new Set(['manifest.json', ...Object.values(manifest.tarballs).map(t => t.filename)])
  bundleServer = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\/+/, ''))
    const file = path.join(BUNDLE_DIR, name)
    if (req.method !== 'GET' || !served.has(name) || !fs.existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'Content-Length': fs.statSync(file).size, 'Content-Type': 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise<void>(resolve => bundleServer!.listen(0, '127.0.0.1', resolve))
  bundleBaseUrl = `http://127.0.0.1:${(bundleServer.address() as AddressInfo).port}`
  log(`bundle server: ${BUNDLE_DIR} (version ${manifest.version}) at ${bundleBaseUrl}`)
}

async function stopBundleServer(): Promise<void> {
  if (!bundleServer) return
  await new Promise<void>(resolve => bundleServer!.close(() => resolve()))
  bundleServer = undefined
  bundleBaseUrl = ''
}

// ── UI helpers ───────────────────────────────────────────────────────────────

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file })
  log(`screenshot ${file}`)
  return file
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
  // The SSH wizard overlay sits on top of the profiles panel: its close button is the last one.
  await win.locator('.settings-panel .settings-close').last().click()
  await expect(win.locator('.bat-wizard-shell')).toHaveCount(0, { timeout: 30_000 })
}

type Outcome = { result: 'complete'; text: string } | { result: 'failed'; text: string } | { result: 'timeout'; text: string }

/**
 * Runs the open wizard until it completes or a step fails. `onPrompt` answers whatever prompt
 * is showing (it is called again while a prompt stays up, so it must be idempotent per prompt).
 */
async function driveWizard(win: Page, onPrompt: (prompt: Locator) => Promise<void>): Promise<Outcome> {
  const shell = win.locator('.bat-wizard-shell')
  const prompt = win.locator('#bat-wizard-active-prompt')
  const end = Date.now() + WIZARD_TIMEOUT_MS
  while (Date.now() < end) {
    const text = await shell.innerText().catch(() => '')
    if (COMPLETE.some(c => text.includes(c))) return { result: 'complete', text }
    if (await win.locator('.bat-stepper-failed-actions').count() > 0) {
      return { result: 'failed', text: await win.locator('.bat-wizard-detail').innerText().catch(() => text) }
    }
    if (await prompt.isVisible().catch(() => false)) await onPrompt(prompt)
    await win.waitForTimeout(500)
  }
  return { result: 'timeout', text: await shell.innerText().catch(() => '') }
}

const pickAlias = (alias: string) => async (prompt: Locator) => {
  const button = prompt.getByRole('button', { name: alias, exact: true })
  if (await button.count() > 0) {
    log(`wizard: pick alias ${alias}`)
    await button.click()
    await expect(button).toHaveCount(0, { timeout: 15_000 })
  }
}

interface ProfileRow { id: string; name: string; targetOS?: string; sshHost?: string; sshUser?: string; sshPort?: number; remotePort?: number; remoteFingerprint?: string }

async function profiles(win: Page): Promise<ProfileRow[]> {
  return (await win.evaluate(async () => (window as AnyApi).electronAPI.profile.list())).profiles as ProfileRow[]
}

async function sshTarget(win: Page, profileName: string): Promise<string> {
  await openProfiles(win)
  const card = win.locator('.profile-card', { hasText: profileName })
  if (await card.locator('[data-testid="ssh-target"]').count() === 0) await card.locator('.profile-card-toggle').click()
  const target = card.locator('[data-testid="ssh-target"]')
  await expect(target).toBeVisible({ timeout: 10_000 })
  await card.scrollIntoViewIfNeeded()
  return (await target.innerText()).trim()
}

/** Runs a wizard for `alias` to completion and returns the profile it wrote. */
async function wizardForAlias(win: Page, alias: string, container: string, tag: string): Promise<ProfileRow> {
  if (workaroundWanted()) await prepareTarget(container)
  const before = new Set((await profiles(win)).map(p => p.id))
  await openSshWizard(win)
  const started = Date.now()
  const outcome = await driveWizard(win, pickAlias(alias))
  log(`${tag}: wizard ${outcome.result} in ${Date.now() - started} ms`)
  await shot(win, `a6-${tag}-wizard-${outcome.result}`)
  if (outcome.result !== 'complete') log(`${tag}: ${outcome.text.replace(/\s+/g, ' ').slice(0, 600)}`)
  expect(outcome.result).toBe('complete')
  await closeWizard(win)
  const created = (await profiles(win)).filter(p => !before.has(p.id))
  log(`${tag}: new profile ${JSON.stringify(created.map(({ remoteFingerprint, ...rest }) => ({ ...rest, fingerprint: Boolean(remoteFingerprint) })))}`)
  expect(created).toHaveLength(1)
  log(`${tag}: ${container} bat-server after the wizard closed: ${await serviceState(container)}`)
  return created[0]
}

function isolatedSshEnv(): Record<string, string> {
  return {
    Path: `${WINDOWS_OPENSSH_DIR};${process.env.PATH ?? process.env.Path ?? ''}`,
    ...(bundleBaseUrl ? { BAT_SERVER_BUNDLE_BASE_URL: bundleBaseUrl } : {}),
  }
}

async function sshProcesses(needle: string): Promise<string[]> {
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Where-Object { $_.CommandLine -like '*${needle}*' } | ForEach-Object { "$($_.ProcessId) $($_.ExecutablePath) :: $($_.CommandLine)" }`,
  ], 20_000).catch(() => '')
  return out.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}

// The temporary ~/.ssh/config block lives exactly as long as this file's tests (per worker).
let configApplied = false

test.beforeAll(async () => {
  test.setTimeout(120_000)
  await startBundleServer()
  log(await envScript('apply-ssh-config'))
  configApplied = true
  // Windows OpenSSH reads the real file: `ssh -G` resolves every alias as written.
  for (const alias of Object.values(conn!.aliases)) {
    const g = await run(path.join(WINDOWS_OPENSSH_DIR, 'ssh.exe'), ['-G', alias], 15_000)
    log(`ssh -G ${alias}: ${g.split(/\r?\n/).filter(l => /^(user|hostname|port|proxyjump) /.test(l)).join(', ')}`)
  }
})

test.afterAll(async () => {
  if (configApplied) log(await envScript('restore-ssh-config'))
  configApplied = false
  await stopBundleServer()
})

// ── tests ────────────────────────────────────────────────────────────────────

test('A6-0 stock wizard install on a clean target starts bat-server', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 120_000)
  const { direct } = conn!.aliases
  const jump = conn!.containers.jump.name
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  fs.rmSync(STOCK_RESULT, { force: true })
  // Clean targets: nothing from an earlier run (re-run `up` otherwise).
  for (const c of [jump, conn!.containers.target.name]) {
    const left = (await dockerExec(c, 'ls -A /home/bat/.local/bat-server /home/bat/.local/share/bat-server /home/bat/.config/systemd/user 2>/dev/null | head -3; true')).trim()
    expect(left, `${c} still has a bat-server from an earlier run — run the env script's up again`).toBe('')
  }
  let inst: IsolatedInstance | undefined
  let complete = false
  let evidence = ''
  try {
    inst = await launchIsolated('t0510-a6-0', log, { env: isolatedSshEnv() })
    const { win } = inst
    await openSshWizard(win)
    const started = Date.now()
    const outcome = await driveWizard(win, pickAlias(direct))
    complete = outcome.result === 'complete'
    log(`A6-0: wizard ${outcome.result} in ${Date.now() - started} ms`)
    await shot(win, `a6-0-stock-${outcome.result}`)
    if (!complete) log(`A6-0 failed step: ${outcome.text.replace(/\s+/g, ' ').slice(0, 500)}`)
    evidence = await installEvidence(jump)
    for (const line of evidence.split(/\r?\n/)) log(`A6-0 ${jump}: ${line}`)
    await closeWizard(win)
    if (!complete) {
      // T0505 §7 item 4, second half: cancelling the failed wizard rolls back (T0426), asynchronously.
      const rolledBack = async () => (await dockerExec(jump, 'ls -A /home/bat/.local/bat-server /home/bat/.config/systemd/user/bat-server.service 2>/dev/null | head -3; true')).trim() === ''
      await expect.poll(rolledBack, { timeout: 60_000, intervals: [2_000] }).toBe(true).catch(() => log('A6-0: rollback not finished within 60 s'))
      const after = await dockerExec(jump, 'echo "bundle: $(ls -A /home/bat/.local/bat-server 2>&1 | head -3)"; echo "unit: $(ls /home/bat/.config/systemd/user/bat-server.service 2>&1)"; echo "linger: $(ls /var/lib/systemd/linger)"')
      log(`A6-0 after closing the wizard (rollback): ${after.replace(/\s+/g, ' ')}`)
    }
  } finally {
    fs.writeFileSync(STOCK_RESULT, JSON.stringify({ complete, at: new Date().toISOString() }))
    await closeIsolated(inst, log)
  }
  expect(complete, 'the stock SSH wizard install must finish (see the A6-0 evidence above)').toBe(true)
  // BUG-120: bundle at ~/.local/bat-server/bin, no staging/ level.
  const listing = evidence.split('## ExecStart')[0]
  expect(listing).toMatch(/^bin$/m)
  expect(listing).not.toMatch(/^staging$/m)
  // BUG-121: --port / --bind-interface on ExecStart, and the server listens on 127.0.0.1:9876.
  expect(evidence).toMatch(/^ExecStart=\/home\/bat\/\.local\/bat-server\/bin\/bat-server --port 9876 --bind-interface localhost$/m)
  expect(evidence).toMatch(/LISTEN\s+\S+\s+\S+\s+127\.0\.0\.1:9876\s/)
  expect(evidence).not.toMatch(/:54321\s/)
})

test('A6-1..5 aliases (no Port / Port / ProxyJump / no User → typed) then reconnect after a restart', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS * 6)
  const created: Record<string, { profile: ProfileRow; container: string; sshNeedle: string }> = {}
  const failures: string[] = []
  let inst: IsolatedInstance | undefined
  const attempt = async (name: string, body: () => Promise<void>) => {
    await test.step(name, async () => {
      try {
        await body()
        log(`${name}: PASS`)
      } catch (err) {
        const msg = err instanceof Error ? err.message.split('\n').slice(0, 6).join(' ') : String(err)
        failures.push(`${name}: ${msg}`)
        log(`${name}: FAIL ${msg}`)
        // Leave no wizard open for the next step.
        if (inst && await inst.win.locator('.bat-wizard-shell').count() > 0) await closeWizard(inst.win).catch(() => { /* ignore */ })
      }
    })
  }
  log(`workaround for the A6-0 defects: ${workaroundWanted() ? 'ON' : 'off'}`)
  inst = await launchIsolated('t0510-a6', log, { env: isolatedSshEnv() })
  const runtimeId = inst.runtimeId
  try {
    await attempt('A6-1 alias: HostName + User + IdentityFile, no Port', async () => {
      const alias = conn!.aliases.direct
      const container = conn!.containers.jump.name
      const profile = await wizardForAlias(inst!.win, alias, container, '1-direct')
      expect(profile).toMatchObject({ targetOS: 'ssh-linux', sshHost: alias, sshUser: '' })
      expect(profile.sshPort ?? null).toBeNull()
      const shown = await sshTarget(inst!.win, profile.name)
      log(`A6-1 SshDetails Host: "${shown}"`)
      await shot(inst!.win, 'a6-1-sshdetails')
      expect(HINT_USER_AND_PORT.some(h => shown === `${alias} (${h})`)).toBe(true)
      created.direct = { profile, container, sshNeedle: `-- ${alias}` }
      log(`A6-1 linger (T0505 §7 item 4): ${(await dockerExec(container, 'loginctl show-user bat -p Linger; ls /var/lib/systemd/linger')).replace(/\s+/g, ' ')}`)
    })

    await attempt('A6-2 alias: custom Port', async () => {
      const alias = conn!.aliases.port
      const container = conn!.containers.jump.name
      if (!workaroundWanted()) await seedLegacyStaging(container)
      const profile = await wizardForAlias(inst!.win, alias, container, '2-port')
      if (!workaroundWanted()) {
        const listing = await dockerExec(container, 'ls -A ~/.local/bat-server | tr "\\n" " "', 'bat')
        log(`A6-2 (T0511 A2): ~/.local/bat-server after the wizard → ${listing.trim()}`)
        expect(listing.split(/\s+/)).not.toContain('staging')
        expect(listing.split(/\s+/)).toContain('bin')
      }
      expect(profile).toMatchObject({ targetOS: 'ssh-linux', sshHost: alias, sshUser: '' })
      expect(profile.sshPort ?? null).toBeNull()
      const shown = await sshTarget(inst!.win, profile.name)
      log(`A6-2 SshDetails Host: "${shown}"`)
      await shot(inst!.win, 'a6-2-sshdetails')
      expect(HINT_USER_AND_PORT.some(h => shown === `${alias} (${h})`)).toBe(true)
      created.port = { profile, container, sshNeedle: `-- ${alias}` }
    })

    await attempt('A6-3 alias: ProxyJump to a target Windows cannot route to', async () => {
      const alias = conn!.aliases.viaJump
      const container = conn!.containers.target.name
      const profile = await wizardForAlias(inst!.win, alias, container, '3-proxyjump')
      expect(profile).toMatchObject({ targetOS: 'ssh-linux', sshHost: alias, sshUser: '' })
      const shown = await sshTarget(inst!.win, profile.name)
      log(`A6-3 SshDetails Host: "${shown}"`)
      await shot(inst!.win, 'a6-3-sshdetails')
      expect(HINT_USER_AND_PORT.some(h => shown === `${alias} (${h})`)).toBe(true)
      // Every login on the target came from the jump container's address.
      const accepted = (await dockerExec(container, 'journalctl -u ssh --no-pager | grep "Accepted publickey"')).trim().split(/\r?\n/).filter(Boolean)
      log(`A6-3 target sshd: ${accepted.length} accepted login(s); last: ${accepted.at(-1)}`)
      expect(accepted.length).toBeGreaterThan(0)
      expect(accepted.every(l => l.includes(`from ${conn!.containers.jump.ip} `))).toBe(true)
      created.viaJump = { profile, container, sshNeedle: `-- ${alias}` }
    })

    await attempt('A6-4 alias without User → permission-denied → edit → typed user@host:port', async () => {
      const { win } = inst!
      const alias = conn!.aliases.noUser
      const container = conn!.containers.jump.name
      const typed = `${conn!.sshUser}@127.0.0.1:${conn!.sshPort}`
      log(`A6-4: Windows login "${conn!.windowsUser}" ≠ remote account "${conn!.sshUser}"`)
      if (workaroundWanted()) await prepareTarget(container)
      const before = new Set((await profiles(win)).map(p => p.id))
      await openSshWizard(win)
      const first = await driveWizard(win, pickAlias(alias))
      const failedText = first.text.replace(/\s+/g, ' ')
      log(`A6-4: first outcome ${first.result}: ${failedText.slice(0, 400)}`)
      await shot(win, 'a6-4-permission-denied')
      expect(first.result).toBe('failed')
      if (workaroundWanted()) {
        expect(failedText).toMatch(/permission-denied/)
      } else {
        // T0511 (C): the ssh-permission-denied entry renders (detail hidden by default); the raw
        // probe error sits behind "Show details".
        expect(PERMISSION_DENIED_TITLE.some(t => failedText.includes(t))).toBe(true)
        await win.locator('.bat-wizard-mapped-error').getByRole('button', { name: SHOW_DETAILS }).click()
        await expect(win.locator('.bat-wizard-mapped-error-raw')).toContainText('permission-denied', { timeout: 10_000 })
      }

      const actionTexts = await win.locator('.bat-stepper-failed-actions button').allInnerTexts()
      log(`A6-4: failed-step actions: ${JSON.stringify(actionTexts)}; mapped error shown: ${await win.locator('.bat-wizard-mapped-error').count() > 0}`)
      // T0511 (C): the ssh-permission-denied entry's own actions, not the generic set.
      if (!workaroundWanted()) {
        expect(actionTexts.some(t => EDIT_SSH_MAPPED.test(t.trim()))).toBe(true)
        expect(await win.locator('.bat-stepper-failed-actions [data-action-kind]').evaluateAll(
          els => els.map(e => e.getAttribute('data-action-kind')))).toEqual(['edit-config', 'retry', 'cancel'])
      }
      const edit = win.locator('.bat-stepper-failed-actions').getByRole('button', { name: workaroundWanted() ? EDIT_SSH : EDIT_SSH_MAPPED })
      await edit.first().click()
      const second = await driveWizard(win, async (prompt) => {
        const manual = prompt.getByRole('button', { name: MANUAL_HOST })
        if (await manual.count() > 0) {
          log('wizard: choose "Enter host manually…"')
          await manual.click()
          return
        }
        const input = prompt.locator('input')
        if (await input.count() > 0) {
          log(`wizard: type ${typed}`)
          await input.fill(typed)
          await prompt.getByRole('button', { name: SUBMIT }).click()
          await expect(input).toHaveCount(0, { timeout: 15_000 })
        }
      })
      log(`A6-4: after edit → ${second.result}`)
      await shot(win, `a6-4-typed-${second.result}`)
      if (second.result !== 'complete') log(`A6-4: ${second.text.replace(/\s+/g, ' ').slice(0, 600)}`)
      expect(second.result).toBe('complete')
      await closeWizard(win)
      const fresh = (await profiles(win)).filter(p => !before.has(p.id))
      log(`A6-4: new profile ${JSON.stringify(fresh.map(({ remoteFingerprint, ...rest }) => ({ ...rest, fingerprint: Boolean(remoteFingerprint) })))}`)
      expect(fresh).toHaveLength(1)
      expect(fresh[0]).toMatchObject({ targetOS: 'ssh-linux', sshHost: '127.0.0.1', sshUser: conn!.sshUser, sshPort: conn!.sshPort })
      const shown = await sshTarget(win, fresh[0].name)
      log(`A6-4 SshDetails Host: "${shown}"`)
      await shot(win, 'a6-4-sshdetails')
      expect(shown).toBe(typed)
      created.typed = { profile: fresh[0], container, sshNeedle: `-- ${conn!.sshUser}@127.0.0.1` }
    })

    await attempt('A6-5 restart: every profile reconnects through Windows OpenSSH', async () => {
      const keys = Object.keys(created)
      expect(keys.length, 'profiles from A6-1..4').toBeGreaterThan(0)
      await closeIsolated(inst, log, { keepUserData: true })
      inst = undefined
      inst = await launchIsolated('t0510-a6', log, { env: isolatedSshEnv(), runtimeId })
      const owner = inst
      const results: string[] = []
      for (const key of keys) {
        const { profile, container, sshNeedle } = created[key]
        const opened = await owner.win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profile.id)
        expect(opened.error, `${key}: openNewInstance`).toBeUndefined()
        const windowId = opened.windowIds[0]
        let page: Page | undefined
        await expect.poll(() => (page = owner.app.windows().find(p => p.url().includes(`windowId=${encodeURIComponent(windowId)}`))) !== undefined,
          { timeout: 30_000, message: `${key}: window` }).toBe(true)
        await page!.waitForLoadState('domcontentloaded')
        const t0 = Date.now()
        await expect.poll(async () => (await page!.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())).connected,
          { timeout: 60_000, message: `${key}: connected` }).toBe(true)
        // A remote shell proves which machine the tunnel reached.
        const ptyId = `t0510-a6-${key}-${Date.now()}`
        await page!.evaluate((id) => {
          const w = window as AnyApi
          w.__t0510 = w.__t0510 ?? {}
          w.__t0510[id] = ''
          w.electronAPI.pty.onOutput((pid: string, data: string) => { if (pid === id) w.__t0510[id] += data })
        }, ptyId)
        await page!.evaluate(async (id) => (window as AnyApi).electronAPI.pty.create({ id, cwd: '/tmp', type: 'terminal' }), ptyId)
        await page!.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'echo "T0510-$(id -un)@$(uname -n)-$((20+5))"\n'), ptyId)
        const marker = `T0510-${conn!.sshUser}@${container}-25`
        await expect.poll(() => page!.evaluate((id) => (window as AnyApi).__t0510[id] as string, ptyId), { timeout: 30_000, message: `${key}: remote shell` }).toContain(marker)
        const procs = await sshProcesses(sshNeedle)
        log(`A6-5 ${key}: connected in ${Date.now() - t0} ms, remote shell "${marker}"; ssh: ${procs.join(' | ') || '(none found)'}`)
        await shot(page!, `a6-5-${key}-connected`)
        expect(procs.length).toBeGreaterThan(0)
        expect(procs.every(p => p.toLowerCase().includes('\\windows\\system32\\openssh\\ssh.exe'))).toBe(true)
        await page!.evaluate(async (id) => (window as AnyApi).electronAPI.pty.kill(id), ptyId).catch(() => { /* gone */ })
        results.push(`${key}=${marker}`)
      }
      log(`A6-5: ${results.join(', ')}`)
      // The tunnels' ssh sessions come and go; the user services keep running (linger).
      for (const c of new Set(keys.map(k => created[k].container))) log(`A6-5 ${c}: bat-server ${await serviceState(c)}`)
    })
  } finally {
    await closeIsolated(inst, log)
  }
  expect(failures).toEqual([])
})
