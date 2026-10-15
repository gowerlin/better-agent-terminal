// T0515 — pre.6 installed-build acceptance, setup-wizard lane: SSH wizard BUG-120 / 121 / 088 / 093 /
// 098 / 100, cancel + rollback BUG-099 / 111, and the alias without User through ProxyJump (W10).
// OPT-IN: skipped unless BAT_E2E_PRE6_WIZARD=1, BAT_E2E_EXECUTABLE points at an installed build and
// the environment from `node e2e/real-remote/t0515-wizard-env.mjs up` exists. Windows only; the ssh
// under test is Windows' built-in OpenSSH (PATH-prepended for the isolated instance).
//
//   node e2e/real-remote/t0515-wizard-env.mjs up        # fresh containers every run
//   $env:BAT_E2E_PRE6_WIZARD='1'
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   npx playwright test e2e/pre6-wizard-acceptance.spec.ts
//   node e2e/real-remote/t0515-wizard-env.mjs docker-check   # W9 image-level lane (no wizard, see the env script)
//   node e2e/real-remote/t0515-wizard-env.mjs down
//
// A pre-T0547 installed build uploads its own resources\bat-server-baseline (no
// BAT_SERVER_BUNDLE_BASE_URL); from D146 / T0547 on the installer has none and the wizard downloads
// the server-bundle-v<version> release (T0548: beforeAll logs which). The env script's docker-check
// lane finds its tarball via e2e/real-remote/baseline-source.mjs.
// T0517: BAT_E2E_SOURCE_BUILD=1 without BAT_E2E_EXECUTABLE runs the source build instead (`npx vite
// build` first; the bundle comes from dist-baseline / the release download like any dev run).
// beforeAll appends the env script's marked block to the REAL ~/.ssh/config (Windows OpenSSH
// ignores USERPROFILE / HOME; original copied aside + SHA-256), afterAll restores it (hash-checked).
//
// Tests (serial, one worker — playwright.config.ts):
//   W1-W6  stock wizard on bat-t0515-jump (alias bat-t0515-direct): bundle layout, ExecStart and
//          listener, no `~` in the unit, pinned fingerprint = the container's (not 9876 / the
//          isolated instance's own), no direct-mode prompt + the profile connects through the
//          tunnel, then ssh.stopServer / ssh.uninstallBundle called directly
//   W6/W7  sshd stops forwarding (AllowTcpForwarding no) → fetch-fingerprint fails after
//          start-server → Cancel → the failed step and every completed step roll back; the failure
//          names the refused forwarding (BUG-124, fixed in T0517 — builds before it FAIL this check)
//   W7/W8  a "user-owned" listener holds port 9876 → start-server itself fails (verify only counts
//          the service's own socket) → Cancel → start-server rolled back (unit gone), bundle gone,
//          and the user's listener / directory / linger untouched
//   W10    alias without User + ProxyJump (→ bat-t0515-target as the Windows login) completes,
//          SshDetails display (T0506), relaunch → reconnects and a remote shell answers
//   W9     Docker (BUG-097): the wizard drives the Windows `docker` CLI, which has no engine on the
//          T0515 host → NEEDS-HUMAN; the image-level lane (env script `docker-check`) and the
//          installed main bundle's `-p <host>:<port>:9876` constant are checked instead (W9.image)
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
import { describeBaselineSource, resolveBaselineSource } from './real-remote/baseline-source.mjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_PRE6_WIZARD === '1'
const SOURCE_BUILD = process.env.BAT_E2E_SOURCE_BUILD === '1'
const ENV_SCRIPT = path.join(REPO_ROOT, 'e2e', 'real-remote', 't0515-wizard-env.mjs')
const CONNECTION = path.join(os.tmpdir(), 'bat-t0515', 'ssh-env', 'connection.json')
const EVIDENCE_DIR = process.env.BAT_E2E_PRE6_EVIDENCE_DIR || path.join(os.tmpdir(), 'bat-t0515', 'evidence')
const RESULTS = path.join(EVIDENCE_DIR, 'results.json')
const WINDOWS_OPENSSH_DIR = 'C:\\Windows\\System32\\OpenSSH'
const WIZARD_TIMEOUT_MS = 300_000
const SERVER_PORT = 9876
// The SSH flow's steps, in order (src/components/setup-wizard/ssh-flow.ts).
const SSH_STEP_IDS = ['configure-ssh-host', 'verify-ssh-auth', 'install-server-bundle', 'start-server', 'fetch-fingerprint', 'connect-test', 'write-profile', 'done']

interface Connection {
  distro: string
  sshPort: number
  sshUser: string
  noUser: string
  windowsUser: string
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
test.skip(!ENABLED, 'opt-in: set BAT_E2E_PRE6_WIZARD=1 (T0515)')
test.skip(process.platform !== 'win32', 'Windows host only (Windows OpenSSH + WSL Docker)')
test.skip(ENABLED && !E2E_EXECUTABLE && !SOURCE_BUILD, 'set BAT_E2E_EXECUTABLE to the installed BetterAgentTerminal.exe under test (or BAT_E2E_SOURCE_BUILD=1)')
test.skip(ENABLED && !conn, `no ${CONNECTION} — run \`node e2e/real-remote/t0515-wizard-env.mjs up\` first`)

const log = testLogger('t0515')

// Localised labels (the isolated instance follows the OS language).
const LOCALES = ['en', 'zh-TW', 'zh-CN'].map(lang =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${lang}.json`), 'utf8')) as AnyApi)
const any = (pick: (l: AnyApi) => string) => LOCALES.map(pick)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const oneOf = (values: string[]) => new RegExp(`^(${[...new Set(values)].map(escape).join('|')})$`)
const COMPLETE = any(l => l.wizard.progress.complete)
const ADD_MORE = oneOf(any(l => l.profiles.addMore))
const HINT_USER_AND_PORT = any(l => l.profiles.sshDetails.userAndPortFromConfig)
const FORWARDING_DENIED_TITLES = any(l => l.wizard.ssh.error.forwardingDenied.title)

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

/** Records one check; `key` is `W<n>` or `W<n>.<part>`. Returns whether it passed. */
function record(key: string, pass: boolean | 'needs-human', evidence: string[]): boolean {
  const verdict: Verdict = pass === 'needs-human' ? 'NEEDS-HUMAN' : pass ? 'PASS' : 'FAIL'
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const all = readResults()
  all[key] = { verdict, evidence, at: new Date().toISOString() }
  fs.writeFileSync(RESULTS, JSON.stringify(all, null, 2))
  log(`${key}: ${verdict} — ${evidence.join(' | ').replace(/\s+/g, ' ').slice(0, 1200)}`)
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

function dockerExec(container: string, script: string, user?: string, detach = false): Promise<string> {
  const args = ['-d', conn!.distro, '--exec', 'docker', 'exec', ...(detach ? ['-d'] : []), ...(user ? ['-u', user] : []), container, 'sh', '-c', script]
  return run('wsl.exe', args, 60_000).catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

const userSystemctl = (user: string) => `su - ${user} -c "XDG_RUNTIME_DIR=/run/user/$(id -u ${user}) systemctl --user`

async function serviceState(container: string, user: string): Promise<string> {
  return (await dockerExec(container, `${userSystemctl(user)} is-active bat-server" 2>&1; true`)).trim()
}

/** Remote install evidence: layout, the whole unit, service state, listeners (who holds the port). */
async function installEvidence(container: string, user: string): Promise<string> {
  const home = `/home/${user}`
  return dockerExec(container, [
    `echo "## ls ${home}/.local/bat-server"; ls -A ${home}/.local/bat-server 2>&1`,
    `echo "## test -x bin/bat-server"; test -x ${home}/.local/bat-server/bin/bat-server && echo executable || echo missing`,
    `echo "## unit"; cat ${home}/.config/systemd/user/bat-server.service 2>&1`,
    `echo "## is-active"; ${userSystemctl(user)} is-active bat-server" 2>&1`,
    `echo "## MainPID"; ${userSystemctl(user)} show -p MainPID --value bat-server" 2>&1`,
    'echo "## listening"; ss -tlnpH 2>&1',
    `echo "## linger"; ls /var/lib/systemd/linger 2>&1`,
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

/** Only the `fingerprint` field of a local server-cert.json (read-only; the key is never logged). */
function localCertFingerprint(file: string): string {
  try {
    return String((JSON.parse(fs.readFileSync(file, 'utf8')) as { fingerprint?: string }).fingerprint ?? '')
  } catch (err) {
    return `unreadable (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`
  }
}

const normFp = (fp: string | undefined | null) => String(fp ?? '').toUpperCase()

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

type Outcome = { result: 'complete' | 'failed' | 'timeout'; text: string; prompts: string[] }

/**
 * Runs the open wizard until it completes or a step fails, answering prompts with `onPrompt`
 * (idempotent per prompt). Every distinct prompt text is kept (W5: which choices were offered).
 */
async function driveWizard(win: Page, onPrompt: (prompt: Locator) => Promise<void>): Promise<Outcome> {
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
        .sort((a, b) => b.length - a.length) // longest first, so a prefix never splits a longer name
      let promptText = (await prompt.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
      for (const a of userAliases) promptText = promptText.split(a).join('<user alias>')
      if (promptText && !prompts.includes(promptText)) prompts.push(promptText)
      await onPrompt(prompt)
    }
    await win.waitForTimeout(500)
  }
  return { result: 'timeout', text: await shell.innerText().catch(() => ''), prompts }
}

const pickAlias = (alias: string) => async (prompt: Locator) => {
  const button = prompt.getByRole('button', { name: alias, exact: true })
  if (await button.count() > 0) {
    log(`wizard: pick alias ${alias}`)
    await button.click()
    await expect(button).toHaveCount(0, { timeout: 15_000 })
  }
}

/** Status of each SSH step from the stepper classes (`bat-stepper-status-<status>`), keyed by step id. */
async function stepStatuses(win: Page): Promise<Record<string, string>> {
  const rows = await win.locator('.bat-wizard-shell .bat-stepper-step').evaluateAll(els => els.map(e => {
    const status = [...e.classList].find(c => c.startsWith('bat-stepper-status-'))?.slice('bat-stepper-status-'.length) ?? '?'
    const label = (e.querySelector('.bat-stepper-label') as HTMLElement | null)?.innerText?.trim() ?? ''
    return { status, label }
  }))
  // One stepper per shell; if a second (compact) one is rendered, the first full set wins.
  const first = rows.slice(0, SSH_STEP_IDS.length)
  return Object.fromEntries(SSH_STEP_IDS.map((id, i) => [id, first[i] ? `${first[i].status} (${first[i].label})` : 'missing']))
}

const statusOf = (s: Record<string, string>, id: string) => (s[id] ?? '').split(' ')[0]

async function clickCancel(win: Page): Promise<void> {
  await win.locator('.bat-stepper-failed-actions [data-action-kind="cancel"]').first().click()
}

interface ProfileRow {
  id: string; name: string; targetOS?: string; sshHost?: string; sshUser?: string; sshPort?: number
  remotePort?: number; remoteFingerprint?: string; useSshTunnel?: boolean; serverHome?: string; sshTunnelMode?: string
}

async function profiles(win: Page): Promise<ProfileRow[]> {
  return (await win.evaluate(async () => (window as AnyApi).electronAPI.profile.list())).profiles as ProfileRow[]
}

const redactProfile = ({ remoteFingerprint, ...rest }: ProfileRow & Record<string, unknown>) =>
  ({ ...rest, remoteToken: rest.remoteToken ? '<set>' : rest.remoteToken, remoteFingerprint })

async function sshTarget(win: Page, profileName: string): Promise<string> {
  await openProfiles(win)
  const card = win.locator('.profile-card', { hasText: profileName })
  if (await card.locator('[data-testid="ssh-target"]').count() === 0) await card.locator('.profile-card-toggle').click()
  const target = card.locator('[data-testid="ssh-target"]')
  await expect(target).toBeVisible({ timeout: 10_000 })
  await card.scrollIntoViewIfNeeded()
  return (await target.innerText()).trim()
}

function isolatedSshEnv(): Record<string, string> {
  return { Path: `${WINDOWS_OPENSSH_DIR};${process.env.PATH ?? process.env.Path ?? ''}` }
}

/** `[ssh-wizard]` lines the wizard logs to the renderer console. */
function captureWizardLog(win: Page): string[] {
  const lines: string[] = []
  win.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    if (text.includes('[ssh-wizard]') || /rollback/i.test(text)) lines.push(`${msg.type()}: ${text}`)
  })
  return lines
}

async function sshProcesses(needle: string): Promise<string[]> {
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Where-Object { $_.CommandLine -like '*${needle}*' } | ForEach-Object { "$($_.ProcessId) $($_.ExecutablePath) :: $($_.CommandLine)" }`,
  ], 20_000).catch(() => '')
  return out.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}

/** Opens the profile's window, waits for the connection and runs a marker command in a remote shell. */
async function connectAndRunShell(inst: IsolatedInstance, profileId: string, tag: string): Promise<{ page: Page; output: string; ms: number }> {
  const opened = await inst.win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profileId)
  expect(opened.error, `${tag}: openNewInstance`).toBeUndefined()
  const windowId = opened.windowIds[0]
  let page: Page | undefined
  await expect.poll(() => (page = inst.app.windows().find(p => p.url().includes(`windowId=${encodeURIComponent(windowId)}`))) !== undefined,
    { timeout: 30_000, message: `${tag}: window` }).toBe(true)
  await page!.waitForLoadState('domcontentloaded')
  const t0 = Date.now()
  await expect.poll(async () => (await page!.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())).connected,
    { timeout: 60_000, message: `${tag}: connected` }).toBe(true)
  const ms = Date.now() - t0
  const ptyId = `t0515-${tag}-${Date.now()}`
  await page!.evaluate((id) => {
    const w = window as AnyApi
    w.__t0515 = w.__t0515 ?? {}
    w.__t0515[id] = ''
    w.electronAPI.pty.onOutput((pid: string, data: string) => { if (pid === id) w.__t0515[id] += data })
  }, ptyId)
  await page!.evaluate(async (id) => (window as AnyApi).electronAPI.pty.create({ id, cwd: '/tmp', type: 'terminal' }), ptyId)
  await page!.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'echo "T0515-$(id -un)@$(uname -n)-$((20+5))"\n'), ptyId)
  await expect.poll(() => page!.evaluate((id) => (window as AnyApi).__t0515[id] as string, ptyId), { timeout: 30_000, message: `${tag}: remote shell` }).toMatch(/T0515-\S+-25/)
  const output = ((await page!.evaluate((id) => (window as AnyApi).__t0515[id] as string, ptyId)).match(/T0515-\S+-25/g) ?? []).at(-1) ?? ''
  await page!.evaluate(async (id) => (window as AnyApi).electronAPI.pty.kill(id), ptyId).catch(() => { /* gone */ })
  return { page: page!, output, ms }
}

// ── lifecycle ────────────────────────────────────────────────────────────────

let configApplied = false

test.beforeAll(async () => {
  test.setTimeout(120_000)
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  if (E2E_EXECUTABLE) {
    log(`executable under test: ${E2E_EXECUTABLE}`)
    const version = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `(Get-Item '${E2E_EXECUTABLE.replace(/'/g, "''")}').VersionInfo.FileVersion`], 20_000).catch(() => '?')
    log(`FileVersion ${version.trim()}`)
    const baseline = path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'bat-server-baseline', 'manifest.json')
    if (fs.existsSync(baseline)) {
      log(`bundle source (installed baseline, pre-T0547 build): ${baseline} → version ${(() => { try { return (JSON.parse(fs.readFileSync(baseline, 'utf8')) as { version?: string }).version } catch { return 'unreadable' } })()}`)
    } else {
      // D146 / T0547: no baseline in the installer; the isolated instance's cache is empty, so
      // the wizard downloads server-bundle-v<version> (or BAT_SERVER_BUNDLE_BASE_URL when set).
      log(`bundle source: no installed baseline (D146) → release download${process.env.BAT_SERVER_BUNDLE_BASE_URL ? ` from ${process.env.BAT_SERVER_BUNDLE_BASE_URL}` : ''}`)
    }
    try {
      log(`local bundle for the docker-check lane: ${describeBaselineSource(resolveBaselineSource({ repoRoot: REPO_ROOT }))}`)
    } catch (err) {
      log(`local bundle for the docker-check lane: ${(err as Error).message}`)
    }
  } else {
    log(`source build under test: ${REPO_ROOT} (dist-electron)`)
  }
  log(await envScript('apply-ssh-config'))
  configApplied = true
  for (const alias of Object.values(conn!.aliases)) {
    const g = await run(path.join(WINDOWS_OPENSSH_DIR, 'ssh.exe'), ['-G', alias], 15_000)
    log(`ssh -G ${alias}: ${g.split(/\r?\n/).filter(l => /^(user|hostname|port|proxyjump) /.test(l)).join(', ')}`)
  }
})

test.afterAll(async () => {
  if (configApplied) log(await envScript('restore-ssh-config'))
  configApplied = false
})

// ── tests ────────────────────────────────────────────────────────────────────

test('W1-W6 stock SSH wizard on a clean target, then ssh.stopServer / ssh.uninstallBundle', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 240_000)
  const alias = conn!.aliases.direct
  const jump = conn!.containers.jump.name
  const left = (await dockerExec(jump, 'ls -A /home/bat/.local/bat-server /home/bat/.config/systemd/user 2>/dev/null | head -3; true')).trim()
  expect(left, `${jump} still has a bat-server from an earlier run — run the env script's up again`).toBe('')

  const ok: boolean[] = []
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0515-w1', log, { env: isolatedSshEnv() })
    const { win } = inst
    const wizardLog = captureWizardLog(win)
    const before = new Set((await profiles(win)).map(p => p.id))
    await openSshWizard(win)
    const started = Date.now()
    const outcome = await driveWizard(win, pickAlias(alias))
    log(`W1: wizard ${outcome.result} in ${Date.now() - started} ms; prompts ${JSON.stringify(outcome.prompts)}`)
    await shot(win, 'w1-wizard-' + outcome.result)
    if (outcome.result !== 'complete') log(`W1 wizard text: ${outcome.text.replace(/\s+/g, ' ').slice(0, 800)}`)
    const evidence = await installEvidence(jump, 'bat')
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'w1-install-evidence.txt'), evidence)
    const complete = outcome.result === 'complete'

    // W1 (BUG-120): bundle at <installPath>/bin, no staging/.
    const listing = section(evidence, 'ls ').split(/\s+/)
    ok.push(record('W1', complete && listing.includes('bin') && !listing.includes('staging') && section(evidence, 'test -x') === 'executable',
      [`wizard ${outcome.result}`, `ls ~/.local/bat-server → ${listing.join(' ')}`, `bin/bat-server ${section(evidence, 'test -x')}`]))

    // W2 (BUG-121): ExecStart args, the service's own pid listens on 127.0.0.1:9876, verify passed.
    const unit = section(evidence, 'unit')
    const execStart = unit.split(/\r?\n/).find(l => l.startsWith('ExecStart=')) ?? ''
    const mainPid = section(evidence, 'MainPID')
    const listening = section(evidence, 'listening')
    const ownListen = listening.split(/\r?\n/).filter(l => new RegExp(`127\\.0\\.0\\.1:${SERVER_PORT}\\s`).test(l) && l.includes(`pid=${mainPid},`))
    const verifyLine = wizardLog.find(l => l.includes('✓ verification')) ?? ''
    ok.push(record('W2', complete
      && execStart === `ExecStart=/home/bat/.local/bat-server/bin/bat-server --port ${SERVER_PORT} --bind-interface localhost`
      && ownListen.length > 0 && !/0\.0\.0\.0:9876|\*:9876|\[::\]:9876/.test(listening) && verifyLine !== '',
    [execStart, `MainPID ${mainPid}`, `listen: ${ownListen.join(' / ') || listening}`, verifyLine]))

    // W3 (BUG-088): no literal `~` anywhere in the unit, service active.
    const active = section(evidence, 'is-active')
    ok.push(record('W3', complete && unit.length > 0 && !unit.includes('~') && active === 'active',
      [`unit has '~': ${unit.includes('~')}`, `is-active ${active}`, `unit:\n${unit}`]))

    const created = complete ? (await profiles(win)).filter(p => !before.has(p.id)) : []
    log(`W1: new profile(s) ${JSON.stringify(created.map(p => redactProfile(p as AnyApi)))}`)
    const profile = created[0]

    // W4 (BUG-093): pinned fingerprint = the container's bat-server, not 9876 / this instance.
    const containerFp = await remoteFingerprint(jump, 'bat')
    const userBatFp = localCertFingerprint(path.join(process.env.APPDATA ?? '', 'BetterAgentTerminal', 'server-cert.json'))
    const isolatedFp = localCertFingerprint(path.join(inst.userData, 'server-cert.json'))
    const tunnelLine = wizardLog.find(l => l.includes('SSH tunnel ready')) ?? ''
    const matchLine = wizardLog.find(l => l.includes('TLS fingerprint matches')) ?? ''
    const pinned = normFp(profile?.remoteFingerprint)
    ok.push(record('W4', Boolean(profile) && pinned !== '' && pinned === normFp(containerFp)
      && pinned !== normFp(userBatFp) && pinned !== normFp(isolatedFp) && /SSH tunnel ready: 127\.0\.0\.1:\d+ → /.test(tunnelLine) && !tunnelLine.includes('127.0.0.1:9876 '),
    [`profile ${pinned}`, `container server-cert.json ${containerFp}`, `user BAT (9876) server-cert.json ${userBatFp}`, `isolated instance ${isolatedFp}`, tunnelLine, matchLine]))

    // W5 (BUG-098): no direct-mode choice anywhere, tunnel profile, and it connects.
    const promptsWithoutAlias = outcome.prompts.map(p => p.split(alias).join('<alias>'))
    const offeredDirect = promptsWithoutAlias.some(p => /direct|直連|直接連線|直接连接|直连/i.test(p))
    let connected = ''
    let sshTunnelProc: string[] = []
    if (profile) {
      try {
        const res = await connectAndRunShell(inst, profile.id, 'w5')
        connected = `connected in ${res.ms} ms, remote shell ${res.output}`
        sshTunnelProc = (await sshProcesses(`-- ${alias}`)).filter(p => / -L /.test(p) || / -L\d/.test(p) || p.includes('-L '))
        await shot(res.page, 'w5-profile-connected')
        await res.page.close()
      } catch (err) {
        connected = `connect failed: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`
      }
    }
    ok.push(record('W5', Boolean(profile) && !offeredDirect && profile!.useSshTunnel === true
      && connected.includes(`T0515-bat@${jump}-25`),
    [`prompts: ${JSON.stringify(promptsWithoutAlias)}`, `direct offered: ${offeredDirect}`, `useSshTunnel ${profile?.useSshTunnel}`, connected, `ssh -L: ${sshTunnelProc.join(' | ') || '(not found)'}`]))

    if (complete) await closeWizard(win)

    // W6 (BUG-100), direct call: ssh.stopServer / ssh.uninstallBundle from the renderer.
    const serverHome = profile?.serverHome || '/home/bat'
    const stop = await win.evaluate(async (req) => (window as AnyApi).electronAPI.ssh.stopServer(req),
      { sshHost: alias, sshUser: '', targetOS: 'ssh-linux', serverHome })
    const uninstall = await win.evaluate(async (req) => (window as AnyApi).electronAPI.ssh.uninstallBundle(req),
      { sshHost: alias, sshUser: '', installPath: '~/.local/bat-server' })
    const afterStop = await dockerExec(jump, [
      `echo "state=$(${userSystemctl('bat')} is-active bat-server" 2>&1)"`,
      'echo "unit=$(ls /home/bat/.config/systemd/user/bat-server.service 2>&1)"',
      'echo "bundle=$(ls -A /home/bat/.local/bat-server 2>&1 | head -2)"',
      `echo "listen9876=$(ss -tlnH | grep -c ':${SERVER_PORT} ')"`,
    ].join('; '))
    log(`W6 direct: stopServer ${JSON.stringify(stop)} uninstallBundle ${JSON.stringify(uninstall)}; remote: ${afterStop.replace(/\s+/g, ' ')}`)
    ok.push(record('W6.direct', stop?.ok === true && uninstall?.ok === true
      && !/state=active/.test(afterStop) && /unit=.*No such file/.test(afterStop) && /bundle=.*No such file/.test(afterStop) && /listen9876=0/.test(afterStop),
    [`stopServer ${JSON.stringify(stop)}`, `uninstallBundle ${JSON.stringify(uninstall)}`, afterStop.trim()]))
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'w1-wizard-log.txt'), wizardLog.join('\n'))
  } finally {
    await closeIsolated(inst, log)
  }
  expect(ok.every(Boolean), 'W1-W6 checks (see results.json)').toBe(true)
})

test('W6/W7 failure after start-server (verify tunnel refused) → Cancel rolls back every step', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 180_000)
  const alias = conn!.aliases.direct
  const jump = conn!.containers.jump.name
  // sshd_config.d: the first value wins, so 00- overrides t0515.conf's `AllowTcpForwarding yes`.
  const noForward = '/etc/ssh/sshd_config.d/00-t0515-noforward.conf'
  log(`W7a: ${(await dockerExec(jump, `printf 'AllowTcpForwarding no\\n' > ${noForward} && systemctl reload ssh && sleep 1 && sshd -T | grep -i allowtcpforwarding`)).trim()}`)
  const ok: boolean[] = []
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0515-w7a', log, { env: isolatedSshEnv() })
    const { win } = inst
    const wizardLog = captureWizardLog(win)
    const before = new Set((await profiles(win)).map(p => p.id))
    await openSshWizard(win)
    const outcome = await driveWizard(win, pickAlias(alias))
    const failedStatuses = await stepStatuses(win)
    log(`W7a: wizard ${outcome.result}; steps ${JSON.stringify(failedStatuses)}; detail ${outcome.text.replace(/\s+/g, ' ').slice(0, 500)}`)
    await shot(win, 'w7a-failed')
    const beforeCancel = await installEvidence(jump, 'bat')
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'w7a-before-cancel.txt'), beforeCancel)
    const failedAtVerify = outcome.result === 'failed' && statusOf(failedStatuses, 'fetch-fingerprint') === 'failed'
      && statusOf(failedStatuses, 'start-server') === 'completed'
    const wasInstalled = section(beforeCancel, 'is-active') === 'active' && section(beforeCancel, 'ls ').split(/\s+/).includes('bin')

    let afterCancel = ''
    let rolled: Record<string, string> = {}
    if (outcome.result === 'failed') {
      await clickCancel(win)
      const cleaned = async () => (await dockerExec(jump, 'ls -A /home/bat/.local/bat-server /home/bat/.config/systemd/user/bat-server.service 2>/dev/null | head -3; true')).trim() === ''
      await expect.poll(cleaned, { timeout: 90_000, intervals: [2_000] }).toBe(true).catch(() => log('W7a: remote not cleaned within 90 s'))
      await expect.poll(async () => statusOf(await stepStatuses(win), 'install-server-bundle'), { timeout: 30_000 }).toBe('rolled-back').catch(() => { /* recorded below */ })
      rolled = await stepStatuses(win)
      await shot(win, 'w7a-after-cancel')
      afterCancel = await dockerExec(jump, [
        `echo "state=$(${userSystemctl('bat')} is-active bat-server" 2>&1)"`,
        'echo "unit=$(ls /home/bat/.config/systemd/user/bat-server.service 2>&1)"',
        'echo "bundle=$(ls -A /home/bat/.local/bat-server 2>&1 | head -2)"',
        `echo "listen9876=$(ss -tlnH | grep -c ':${SERVER_PORT} ')"`,
        'echo "linger=$(ls /var/lib/systemd/linger)"',
      ].join('; '))
      log(`W7a after cancel: steps ${JSON.stringify(rolled)}; remote ${afterCancel.replace(/\s+/g, ' ')}`)
    }
    const rollbackWarnings = wizardLog.filter(l => /Failed to stop bat-server|Rollback failed|is not a function|uninstall.*fail/i.test(l))
    const created = (await profiles(win)).filter(p => !before.has(p.id))
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'w7a-wizard-log.txt'), wizardLog.join('\n'))

    ok.push(record('W7.after-start-server', failedAtVerify && wasInstalled
      && statusOf(rolled, 'fetch-fingerprint') === 'rolled-back'
      && statusOf(rolled, 'start-server') === 'rolled-back' && statusOf(rolled, 'install-server-bundle') === 'rolled-back',
    [`failed step: ${JSON.stringify(failedStatuses)}`, `before cancel: is-active ${section(beforeCancel, 'is-active')}, ls ${section(beforeCancel, 'ls ').replace(/\s+/g, ' ')}`, `after cancel: ${JSON.stringify(rolled)}`]))
    // BUG-124 (T0517): the failure names the refused forwarding, not "no TLS certificate".
    const detailText = outcome.text.replace(/\s+/g, ' ')
    ok.push(record('BUG-124.message', failedAtVerify && FORWARDING_DENIED_TITLES.some(t => detailText.includes(t))
      && detailText.includes('AllowTcpForwarding') && /administratively prohibited/.test(detailText),
    [`failure detail: ${detailText.slice(0, 900)}`]))
    ok.push(record('W6.rollback', failedAtVerify && wasInstalled && !/state=active/.test(afterCancel)
      && /unit=.*No such file/.test(afterCancel) && /bundle=.*No such file/.test(afterCancel) && /listen9876=0/.test(afterCancel)
      && rollbackWarnings.length === 0 && created.length === 0,
    [afterCancel.trim(), `rollback warnings: ${JSON.stringify(rollbackWarnings)}`, `profiles created: ${created.length}`]))
    await closeWizard(win).catch(() => { /* already closed */ })
  } finally {
    log(`W7a: ${(await dockerExec(jump, `rm -f ${noForward} && systemctl reload ssh && sleep 1 && sshd -T | grep -i allowtcpforwarding`)).trim()} (restored)`)
    await closeIsolated(inst, log)
  }
  expect(ok.every(Boolean), 'W6 / W7 checks (see results.json)').toBe(true)
})

test('W7/W8 start-server fails (port held by a user process) → Cancel rolls the failed step back, user resources untouched', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 180_000)
  const alias = conn!.aliases.direct
  const jump = conn!.containers.jump.name
  const ownedDir = '/home/bat/bat-t0515-user-owned'
  // The "user's own" resources: a directory with content and a listener on the server port.
  log(`W8 seed: ${(await dockerExec(jump, `mkdir -p ${ownedDir} && echo keep-me > ${ownedDir}/keep.txt && ls -l ${ownedDir}`, 'bat')).trim().replace(/\s+/g, ' ')}`)
  await dockerExec(jump, `exec nc -lk 127.0.0.1 ${SERVER_PORT}`, 'bat', true)
  await expect.poll(async () => (await dockerExec(jump, `ss -tlnpH | grep ':${SERVER_PORT} '; true`)).includes('"nc"'), { timeout: 15_000 }).toBe(true)
  const ncBefore = (await dockerExec(jump, 'pgrep -u bat -x nc')).trim()
  const lingerBefore = (await dockerExec(jump, 'ls /var/lib/systemd/linger')).trim()
  log(`W8 seed: nc pid ${ncBefore} listening on 127.0.0.1:${SERVER_PORT}; linger ${lingerBefore}`)

  const ok: boolean[] = []
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0515-w7b', log, { env: isolatedSshEnv() })
    const { win } = inst
    const wizardLog = captureWizardLog(win)
    await openSshWizard(win)
    const outcome = await driveWizard(win, pickAlias(alias))
    const failedStatuses = await stepStatuses(win)
    log(`W7b: wizard ${outcome.result}; steps ${JSON.stringify(failedStatuses)}; detail ${outcome.text.replace(/\s+/g, ' ').slice(0, 600)}`)
    await shot(win, 'w7b-failed')
    const beforeCancel = await installEvidence(jump, 'bat')
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'w7b-before-cancel.txt'), beforeCancel)
    const failedAtStart = outcome.result === 'failed' && statusOf(failedStatuses, 'start-server') === 'failed'
    const unitBefore = section(beforeCancel, 'unit')
    const unitWritten = unitBefore.includes('ExecStart=')

    let rolled: Record<string, string> = {}
    let afterCancel = ''
    if (outcome.result === 'failed') {
      await clickCancel(win)
      const cleaned = async () => (await dockerExec(jump, 'ls -A /home/bat/.local/bat-server /home/bat/.config/systemd/user/bat-server.service 2>/dev/null | head -3; true')).trim() === ''
      await expect.poll(cleaned, { timeout: 90_000, intervals: [2_000] }).toBe(true).catch(() => log('W7b: remote not cleaned within 90 s'))
      await expect.poll(async () => statusOf(await stepStatuses(win), 'install-server-bundle'), { timeout: 30_000 }).toBe('rolled-back').catch(() => { /* recorded below */ })
      rolled = await stepStatuses(win)
      await shot(win, 'w7b-after-cancel')
      afterCancel = await dockerExec(jump, [
        `echo "state=$(${userSystemctl('bat')} is-active bat-server" 2>&1)"`,
        'echo "unit=$(ls /home/bat/.config/systemd/user/bat-server.service 2>&1)"',
        'echo "bundle=$(ls -A /home/bat/.local/bat-server 2>&1 | head -2)"',
        `echo "nc=$(pgrep -u bat -x nc)"`,
        `echo "listener=$(ss -tlnpH | grep ':${SERVER_PORT} ')"`,
        `echo "owned=$(cat ${ownedDir}/keep.txt 2>&1)"`,
        'echo "linger=$(ls /var/lib/systemd/linger)"',
      ].join('; '))
      log(`W7b after cancel: steps ${JSON.stringify(rolled)}; remote ${afterCancel.replace(/\s+/g, ' ')}`)
    }
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'w7b-wizard-log.txt'), wizardLog.join('\n'))
    const rollbackWarnings = wizardLog.filter(l => /Failed to stop bat-server|Rollback failed|is not a function/i.test(l))

    ok.push(record('W7.failed-step', failedAtStart && unitWritten
      && statusOf(rolled, 'start-server') === 'rolled-back' && statusOf(rolled, 'install-server-bundle') === 'rolled-back'
      && !/state=active/.test(afterCancel) && /unit=.*No such file/.test(afterCancel) && /bundle=.*No such file/.test(afterCancel)
      && rollbackWarnings.length === 0,
    [`failed: ${JSON.stringify(failedStatuses)}`, `unit before cancel: ${unitBefore.split(/\r?\n/).find(l => l.startsWith('ExecStart=')) ?? '(none)'}; is-active ${section(beforeCancel, 'is-active')}`,
      `after cancel: ${JSON.stringify(rolled)}`, afterCancel.trim(), `rollback warnings: ${JSON.stringify(rollbackWarnings)}`]))
    ok.push(record('W8.ssh', failedAtStart && new RegExp(`nc=${ncBefore}\\b`).test(afterCancel) && /listener=.*"nc"/.test(afterCancel)
      && /owned=keep-me/.test(afterCancel) && afterCancel.includes(`linger=${lingerBefore}`),
    [`nc before ${ncBefore}`, afterCancel.trim()]))
    await closeWizard(win).catch(() => { /* already closed */ })
  } finally {
    log(`W8 cleanup: ${(await dockerExec(jump, `pkill -u bat -x nc; rm -rf ${ownedDir}; echo done`)).trim()}`)
    await closeIsolated(inst, log)
  }
  expect(ok.every(Boolean), 'W7 / W8 checks (see results.json)').toBe(true)
})

test('W10 alias without User through ProxyJump: wizard completes, SshDetails, reconnect after relaunch', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 240_000)
  const alias = conn!.aliases.noUserProxyJump
  const target = conn!.containers.target.name
  const user = conn!.noUser
  const ok: boolean[] = []
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0515-w10', log, { env: isolatedSshEnv() })
    const runtimeId = inst.runtimeId
    const wizardLog = captureWizardLog(inst.win)
    const before = new Set((await profiles(inst.win)).map(p => p.id))
    await openSshWizard(inst.win)
    const started = Date.now()
    const outcome = await driveWizard(inst.win, pickAlias(alias))
    log(`W10: wizard ${outcome.result} in ${Date.now() - started} ms`)
    await shot(inst.win, `w10-wizard-${outcome.result}`)
    if (outcome.result !== 'complete') log(`W10: ${outcome.text.replace(/\s+/g, ' ').slice(0, 800)}`)
    const evidence = await installEvidence(target, user)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'w10-install-evidence.txt'), evidence)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'w10-wizard-log.txt'), wizardLog.join('\n'))
    const complete = outcome.result === 'complete'
    if (complete) await closeWizard(inst.win)
    const created = (await profiles(inst.win)).filter(p => !before.has(p.id))
    log(`W10: new profile(s) ${JSON.stringify(created.map(p => redactProfile(p as AnyApi)))}`)
    const profile = created[0]
    const shown = profile ? await sshTarget(inst.win, profile.name).catch(err => `ERR ${String(err)}`) : ''
    await shot(inst.win, 'w10-sshdetails')
    const containerFp = await remoteFingerprint(target, user)
    const accepted = (await dockerExec(target, 'journalctl -u ssh --no-pager | grep "Accepted publickey"')).trim().split(/\r?\n/).filter(Boolean)
    const execStart = section(evidence, 'unit').split(/\r?\n/).find(l => l.startsWith('ExecStart=')) ?? ''
    ok.push(record('W10.wizard', complete && profile?.sshHost === alias && profile?.sshUser === '' && (profile?.sshPort ?? null) === null
      && execStart === `ExecStart=/home/${user}/.local/bat-server/bin/bat-server --port ${SERVER_PORT} --bind-interface localhost`
      && section(evidence, 'is-active') === 'active' && normFp(profile?.remoteFingerprint) === normFp(containerFp)
      && accepted.length > 0 && accepted.every(l => l.includes(`for ${user} from ${conn!.containers.jump.ip} `))
      && HINT_USER_AND_PORT.some(h => shown === `${alias} (${h})`),
    [`wizard ${outcome.result}`, `profile sshHost=${profile?.sshHost} sshUser=${JSON.stringify(profile?.sshUser)} sshPort=${profile?.sshPort ?? null}`,
      execStart, `is-active ${section(evidence, 'is-active')}`, `fingerprint profile ${normFp(profile?.remoteFingerprint)} / container ${containerFp}`,
      `SshDetails "${shown}"`, `target sshd: ${accepted.length} accepted, last: ${accepted.at(-1)}`, `linger ${section(evidence, 'linger').replace(/\s+/g, ' ')}`]))

    // Relaunch the same runtime: the profile reconnects through Windows OpenSSH and ProxyJump.
    let reconnect = ''
    let procs: string[] = []
    if (profile) {
      await closeIsolated(inst, log, { keepUserData: true })
      inst = undefined
      inst = await launchIsolated('t0515-w10', log, { env: isolatedSshEnv(), runtimeId })
      try {
        const res = await connectAndRunShell(inst, profile.id, 'w10')
        procs = await sshProcesses(`-- ${alias}`)
        reconnect = `connected in ${res.ms} ms, remote shell ${res.output}`
        await shot(res.page, 'w10-reconnected')
      } catch (err) {
        reconnect = `reconnect failed: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`
      }
    }
    ok.push(record('W10.reconnect', reconnect.includes(`T0515-${user}@${target}-25`) && procs.length > 0
      && procs.every(p => p.toLowerCase().includes('\\windows\\system32\\openssh\\ssh.exe')),
    [reconnect, `ssh: ${procs.join(' | ') || '(none found)'}`]))
  } finally {
    await closeIsolated(inst, log)
  }
  expect(ok.every(Boolean), 'W10 checks (see results.json)').toBe(true)
})

test('W9 Docker (BUG-097) image-level lane; the Docker wizard itself needs a Windows docker engine', async () => {
  test.setTimeout(900_000)
  // The Docker wizard runs the Windows `docker` CLI; record where it points.
  const ctx = await run('docker', ['context', 'ls', '--format', '{{.Name}} {{.Current}} {{.DockerEndpoint}}'], 20_000).catch((err: AnyApi) => `ERR ${String(err?.message ?? err)}`)
  const engine = await run('docker', ['version', '--format', '{{.Server.Version}}'], 20_000).then(v => `server ${v.trim()}`, (err: AnyApi) => `no engine: ${String(err?.stderr ?? err?.message ?? err).split('\n').find(l => l.trim()) ?? ''}`)
  log(`W9: Windows docker contexts: ${ctx.replace(/\s+/g, ' ').trim()}; ${engine}`)

  // The installed main bundle's `docker run` publish host (electron/docker-lifecycle.ts DOCKER_PUBLISH_HOST).
  let publishHost = 'unchecked'
  try {
    const BS = String.fromCharCode(92)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asar = require(path.join(REPO_ROOT, 'node_modules', '@electron', 'asar')) as AnyApi
    const archive = path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'app.asar')
    for (const f of (asar.listPackage(archive) as string[]).filter(f => f.includes('dist-electron') && f.endsWith('.js'))) {
      const src = asar.extractFile(archive, f.split(BS).join('/').replace(/^\/+/, '')).toString('utf8') as string
      const m = /"unless-stopped","-p",`\$\{(\w+)\}:\$\{\w+\}:9876`/.exec(src)
      if (!m) continue
      const value = new RegExp(`[,;\\s]${m[1]}="([^"]*)"`).exec(src)
      publishHost = `${f.split(BS).join('/')}: -p \`\${${m[1]}}:<port>:9876\`, ${m[1]}="${value?.[1] ?? '?'}"`
    }
  } catch (err) {
    publishHost = `unchecked (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`
  }
  log(`W9: installed bundle publish host: ${publishHost}`)

  const out = await envScript('docker-check', 900_000)
  const line = out.split(/\r?\n/).find(l => l.startsWith('T0515_DOCKER_CHECK ')) ?? ''
  const r = JSON.parse(line.slice('T0515_DOCKER_CHECK '.length) || '{}') as AnyApi
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'w9-docker-check.json'), JSON.stringify(r, null, 2))
  const imagePass = r.health === 'healthy'
    && /^9876\/tcp -> 127\.0\.0\.1:\d+$/.test(r.dockerPort ?? '')
    && /"HostIp":"127\.0\.0\.1"/.test(r.hostConfigPortBindings ?? '')
    && Array.isArray(r.containerListen) && r.containerListen.includes('00000000:2694')
    && r.tlsFromWindows?.ok === true && r.tlsFromWindows?.matchesCert === true
    && r.fromWslIp === 'refused' && r.fromWslLoopback === 'open'
    && /"--bind-interface","all"/.test(r.entrypoint ?? '') && /tls/.test(r.healthcheck ?? '')
    && /="127\.0\.0\.1"$/.test(publishHost)
  const imageOk = record('W9.image', imagePass, [
    `bundle ${r.bundle?.source} (${r.bundle?.manifestVersion})`, `installed main bundle ${publishHost}`, `docker ${r.runArgs}`,
    `health ${r.health} after ${r.healthAfterMs} ms (log exit codes ${r.healthLog})`, `docker port ${r.dockerPort}`, `PortBindings ${r.hostConfigPortBindings}`,
    `in-container LISTEN ${JSON.stringify(r.containerListen)} (2694 = 9876, 00000000 = all interfaces)`,
    `TLS from Windows ${JSON.stringify(r.tlsFromWindows)}`, `from WSL eth0 ${r.wslIp}: ${r.fromWslIp}; from WSL loopback: ${r.fromWslLoopback}`,
    `ENTRYPOINT ${r.entrypoint}`])
  const wizardBlocked = /no engine/.test(engine)
  record('W9', wizardBlocked ? 'needs-human' : imagePass, [
    wizardBlocked ? `Docker wizard not run: Windows docker CLI has no engine (${engine}; contexts ${ctx.replace(/\s+/g, ' ').trim()}); the engine on this host lives inside WSL` : `Windows docker engine present (${engine}) — the wizard lane was still not automated`,
    `image-level lane: ${imageOk ? 'PASS' : 'FAIL'} (W9.image)`])
  record('W8.docker', 'needs-human', ['Docker wizard rollback (pick-container / start-server existing-mode ownership) not run: same blocker as W9; the SSH-side ownership check is W8.ssh'])
  expect(imagePass, 'W9 image-level checks (see results.json)').toBe(true)
})
