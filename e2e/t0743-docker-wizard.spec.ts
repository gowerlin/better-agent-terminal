// T0743 — the desktop Docker setup wizard against a Docker engine that lives inside WSL.
// OPT-IN: skipped unless BAT_E2E_T0743_DOCKER=1 (Windows host, WSL distro with docker, Go on PATH).
//
//   npx vite build
//   $env:BAT_E2E_T0743_DOCKER='1'
//   $env:BAT_E2E_BASELINE_DIR='<dir with bat-server-linux-x64-v<ver>.tar.gz + manifest.json or .sha256>'
//   npx playwright test e2e/t0743-docker-wizard.spec.ts
//
// The wizard runs `docker` from the main process PATH. pre6-wizard-acceptance W8 / W9 could not run
// it because the Windows docker CLI has no engine on this host. Here the isolated instance (source
// build, fixtures/electron-isolation) gets a test-only `docker.exe` first on ITS PATH
// (e2e/real-remote/t0743-docker-shim.go, built into a temp dir): it forwards to
// `wsl.exe -d <distro> --exec docker`, hides every container the test did not create from `ps`,
// refuses any command naming one, maps the wizard's `bat-server:latest` to this test's image
// (`bat-e2e-t0743-server:local`, docker/Dockerfile + the bundle tarball) and translates the
// Windows bind-mount path to /mnt/<drive>/…. No docker context, daemon setting, TCP listener or
// ~/.ssh/config is touched; the user's own containers are inspected read-only before and after
// every scenario and must not change.
//
// Names: everything created here starts with `bat-e2e-t0743-`, except what the product names
// itself — "Create new" with the wizard's empty profile name creates `bat-server-profile` and the
// volume `bat-server-bat-server-profile-data` (docker-flow.ts / start-server.ts). beforeAll refuses
// to run when any of those already exists; afterAll removes them.
//
//   D1 BUG-097 / BUG-156  "Create new" completes: `docker run -p 127.0.0.1:<P>:9876`, P is not this
//                         BAT's RemoteServer port; PortBindings 127.0.0.1 only; HEALTHCHECK (TLS
//                         probe) healthy; bat-server binds all container interfaces; the published
//                         port answers on loopback (TLS fingerprint = the profile's pin), not on
//                         the WSL non-loopback address
//   D2 BUG-156            "Use existing": a container publishing the RemoteServer port is refused
//                         (docker-port-in-use), one publishing nothing is refused
//                         (docker-port-unpublished); Cancel leaves both exactly as they were
//   D3 BUG-111            "Use existing" on a RUNNING user container (with a data volume) → a later
//                         step fails → Cancel: same container id, still running, not restarted,
//                         files and volume intact
//   D4 BUG-111            "Use existing" on a STOPPED user container → the wizard starts it → a later
//                         step fails → Cancel: the wizard stops only what it started; container,
//                         files and volume intact (not removed)
//   D5 BUG-097 / T0427    "Use existing" on a pre-fix container (bat-server without --bind-interface):
//                         legacy-image warning, the server is unreachable through the published
//                         port, Cancel leaves the container as it was

import { test, expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import {
  REPO_ROOT,
  closeIsolated,
  freePort,
  launchIsolated,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'
import { describeBaselineSource, resolveBaselineSource } from './real-remote/baseline-source.mjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_T0743_DOCKER === '1'
const DISTRO = process.env.BAT_E2E_T0743_DISTRO || 'Ubuntu-24.04'
const PREFIX = 'bat-e2e-t0743-'
const LABEL = 'bat.t0743=1'
const IMAGE = `${PREFIX}server:local`
const WIZARD_IMAGE = 'bat-server:latest' // DEFAULT_IMAGE, src/components/setup-wizard/docker-flow.ts
const NEW_CONTAINER = 'bat-server-profile' // `bat-server-${slug('')}`, pick-container.ts
const NEW_VOLUME = `bat-server-${NEW_CONTAINER}-data` // start-server.ts dataVolume
const ALLOW = `^(${PREFIX}[a-z0-9-]+|${NEW_CONTAINER})$`
const STAMP = Date.now()
const WORK = path.join(os.tmpdir(), `${PREFIX}wizard-${STAMP}`)
const EVIDENCE_DIR = process.env.BAT_E2E_T0743_EVIDENCE_DIR || path.join(os.tmpdir(), `${PREFIX}evidence`)
const SHIM_LOG = path.join(WORK, 'docker-shim.log')
const MOUNT_DIR = path.join(WORK, `${PREFIX}mount`)
const DOCKER_STEP_IDS = ['detect-env', 'pick-container', 'configure-mounts', 'install-server-bundle', 'start-server', 'fetch-fingerprint', 'connect-test', 'write-profile', 'done']
const WIZARD_TIMEOUT_MS = 240_000

test.skip(!ENABLED, 'opt-in: set BAT_E2E_T0743_DOCKER=1 (T0743)')
test.skip(process.platform !== 'win32', 'Windows host only (Docker inside WSL)')

const log = testLogger('t0743')

const LOCALES = ['en', 'zh-TW', 'zh-CN'].map(lang =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${lang}.json`), 'utf8')) as AnyApi)
const any = (pick: (l: AnyApi) => string) => LOCALES.map(pick)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const oneOf = (values: string[]) => new RegExp(`^\\s*(${[...new Set(values)].map(escape).join('|')})\\s*$`)
const COMPLETE = any(l => l.wizard.progress.complete)
const ADD_MORE = oneOf(any(l => l.profiles.addMore))
// The menu item is "<icon> <label>" (profiles/AddProfileMenu.tsx).
const ADD_DOCKER = new RegExp(`(${[...new Set(any(l => l.profiles.addDockerProfile))].map(escape).join('|')})`)
const CREATE_NEW = any(l => l.wizard.docker.pickContainer.new.label)
const USE_EXISTING = any(l => l.wizard.docker.pickContainer.existing.label)

// ── WSL docker (test side, never through the shim) ──────────────────────────

function docker(args: string[], timeout = 60_000): string {
  return execFileSync('wsl.exe', ['-d', DISTRO, '--exec', 'docker', ...args], { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

function dockerOk(args: string[], timeout = 60_000): { ok: boolean; out: string } {
  try {
    return { ok: true, out: docker(args, timeout).trim() }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() || String(e.message) }
  }
}

function wslSh(script: string, timeout = 30_000): string {
  return execFileSync('wsl.exe', ['-d', DISTRO, '--exec', 'sh', '-c', script], { encoding: 'utf8', timeout, windowsHide: true }).trim()
}

function containerExists(name: string): boolean {
  return docker(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim() !== ''
}

function volumeExists(name: string): boolean {
  return docker(['volume', 'ls', '--filter', `name=^${name}$`, '--format', '{{.Name}}']).trim() !== ''
}

/** Id, state and start time of every container this test did not create (read-only). */
function userContainers(): string {
  const rows = docker(['ps', '-a', '--no-trunc', '--format', '{{.ID}} {{.Names}}']).split(/\r?\n/).filter(Boolean)
    .filter(r => !new RegExp(ALLOW).test(r.split(' ')[1] ?? ''))
  return rows.map(r => {
    const id = r.split(' ')[0]
    return `${r} ${docker(['inspect', '-f', '{{.State.Status}} {{.State.StartedAt}} {{.RestartCount}}', id]).trim()}`
  }).sort().join('\n')
}

function inspectState(name: string): { id: string; status: string; running: boolean; startedAt: string } {
  const [id, status, running, startedAt] = docker(['inspect', '-f', '{{.Id}} {{.State.Status}} {{.State.Running}} {{.State.StartedAt}}', name]).trim().split(' ')
  return { id, status, running: running === 'true', startedAt }
}

/** Removes a container / volume only when it is one of this test's names (and, for prefixed names, carries the label). */
function removeOwnContainer(name: string): string {
  if (!new RegExp(ALLOW).test(name) || !containerExists(name)) return `${name}: absent`
  const label = docker(['inspect', '-f', '{{index .Config.Labels "bat.t0743"}}', name]).trim()
  if (label !== '1' && name !== NEW_CONTAINER) return `${name}: exists WITHOUT label ${LABEL} — not ours, left alone`
  return `${name}: ${dockerOk(['rm', '-f', name]).ok ? 'removed' : 'remove FAILED'}`
}

function removeOwnVolume(name: string): string {
  if (!(name.startsWith(PREFIX) || name === NEW_VOLUME) || !volumeExists(name)) return `volume ${name}: absent`
  return `volume ${name}: ${dockerOk(['volume', 'rm', name]).ok ? 'removed' : 'remove FAILED'}`
}

function tlsFingerprint(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: '127.0.0.1', port, rejectUnauthorized: false, timeout: 10_000 }, () => {
      const fp = socket.getPeerCertificate().fingerprint256 ?? ''
      socket.end()
      resolve(fp)
    })
    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')) })
    socket.on('error', reject)
  })
}

async function portFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

// ── shim log ────────────────────────────────────────────────────────────────

interface ShimEntry { at: string; args: string[]; forwarded?: string[]; refused?: string; exit: number; psHidden?: number }

function shimEntries(): ShimEntry[] {
  try {
    return fs.readFileSync(SHIM_LOG, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l) as ShimEntry)
  } catch {
    return []
  }
}

// ── UI ──────────────────────────────────────────────────────────────────────

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`) }).catch(() => { /* window gone */ })
}

async function openDockerWizard(win: Page): Promise<void> {
  if (await win.locator('.profile-card').count() === 0) {
    await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
    await expect(win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
  }
  await win.getByRole('button', { name: ADD_MORE }).click()
  await win.locator('.thumbnail-add-menu-item', { hasText: ADD_DOCKER }).click()
  await expect(win.locator('.bat-wizard-shell')).toBeVisible({ timeout: 15_000 })
}

async function closeWizard(win: Page): Promise<void> {
  await win.locator('.settings-panel .settings-close').last().click()
  await expect(win.locator('.bat-wizard-shell')).toHaveCount(0, { timeout: 30_000 })
}

type Outcome = { result: 'complete' | 'failed' | 'timeout'; text: string }

async function driveWizard(win: Page, choice: string[]): Promise<Outcome> {
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
      for (const label of choice) {
        const button: Locator = prompt.getByRole('button', { name: label, exact: true })
        if (await button.count() > 0) {
          log(`wizard: pick "${label}"`)
          await button.first().click()
          break
        }
      }
    }
    await win.waitForTimeout(500)
  }
  return { result: 'timeout', text: await shell.innerText().catch(() => '') }
}

async function stepStatuses(win: Page): Promise<Record<string, string>> {
  const rows = await win.locator('.bat-wizard-shell .bat-stepper-step').evaluateAll(els => els.map(e =>
    [...e.classList].find(c => c.startsWith('bat-stepper-status-'))?.slice('bat-stepper-status-'.length) ?? '?'))
  return Object.fromEntries(DOCKER_STEP_IDS.map((id, i) => [id, rows[i] ?? 'missing']))
}

async function cancelAndWaitRollback(win: Page, step: string): Promise<Record<string, string>> {
  await win.locator('.bat-stepper-failed-actions [data-action-kind="cancel"]').first().click()
  await expect.poll(async () => (await stepStatuses(win))[step], { timeout: 60_000 }).toBe('rolled-back').catch(() => { /* recorded by the caller */ })
  return stepStatuses(win)
}

function captureWizardLog(win: Page): string[] {
  const lines: string[] = []
  win.on('console', (msg: ConsoleMessage) => {
    const text = msg.text()
    if (text.includes('[docker-wizard]') || /rollback/i.test(text)) lines.push(`${msg.type()}: ${text}`)
  })
  return lines
}

// ── lifecycle ───────────────────────────────────────────────────────────────

let inst: IsolatedInstance | undefined
let userBefore = ''
let wizardLog: string[] = []
const created = new Set<string>()
const createdVolumes = new Set<string>()

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  test.setTimeout(900_000)
  fs.mkdirSync(path.join(WORK, 'shim-bin'), { recursive: true })
  fs.mkdirSync(MOUNT_DIR, { recursive: true })
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  log(`docker engine in ${DISTRO}: ${docker(['version', '--format', '{{.Server.Version}}']).trim()}`)

  // Names the product picks itself must not exist (BUG-111: never adopt a user's container).
  for (const name of [NEW_CONTAINER, `${NEW_CONTAINER}-2`]) expect(containerExists(name), `${name} already exists on the engine — not ours, refusing to run`).toBe(false)
  expect(volumeExists(NEW_VOLUME), `volume ${NEW_VOLUME} already exists — not ours, refusing to run`).toBe(false)
  const leftovers = docker(['ps', '-a', '--filter', `name=${PREFIX}`, '--format', '{{.Names}}']).trim()
  expect(leftovers, `leftover ${PREFIX}* containers from an earlier run`).toBe('')

  userBefore = userContainers()
  log(`user containers (read-only sentinel):\n${userBefore || '(none)'}`)

  // The shim, built into this run's temp dir.
  const shim = path.join(WORK, 'shim-bin', 'docker.exe')
  execFileSync('go', ['build', '-o', shim, path.join(REPO_ROOT, 'e2e', 'real-remote', 't0743-docker-shim.go')], { encoding: 'utf8', timeout: 300_000, windowsHide: true })
  log(`docker shim built: ${shim}`)

  // The image the wizard's `bat-server:latest` is mapped to: docker/Dockerfile + the bundle.
  const source = resolveBaselineSource({ repoRoot: REPO_ROOT })
  log(`server bundle: ${describeBaselineSource(source)}`)
  const ctx = path.join(WORK, 'docker-context')
  fs.mkdirSync(path.join(ctx, 'dist-server'), { recursive: true })
  fs.copyFileSync(path.join(REPO_ROOT, 'docker', 'Dockerfile'), path.join(ctx, 'Dockerfile'))
  fs.copyFileSync(source.tarball, path.join(ctx, 'dist-server', source.filename))
  const ctxPosix = execFileSync('wsl.exe', ['-d', DISTRO, '--exec', 'wslpath', '-a', ctx], { encoding: 'utf8', windowsHide: true }).trim()
  const imageTaken = docker(['images', '-q', IMAGE]).trim()
  if (imageTaken) {
    const label = docker(['inspect', '-f', '{{index .Config.Labels "bat.t0743"}}', IMAGE]).trim()
    expect(label, `${IMAGE} exists without label ${LABEL} — not ours`).toBe('1')
  }
  docker(['build', '-q', '--label', LABEL, '-t', IMAGE, ctxPosix], 900_000)
  fs.rmSync(ctx, { recursive: true, force: true })
  log(`image ${IMAGE}: healthcheck ${docker(['inspect', '-f', '{{json .Config.Healthcheck}}', IMAGE]).trim().slice(0, 120)}…; entrypoint ${docker(['inspect', '-f', '{{json .Config.Entrypoint}}', IMAGE]).trim()}`)

  inst = await launchIsolated('t0743-docker', log, {
    env: {
      Path: `${path.dirname(shim)};${process.env.PATH ?? process.env.Path ?? ''}`,
      T0743_SHIM_DISTRO: DISTRO,
      T0743_SHIM_ALLOW: ALLOW,
      T0743_SHIM_LOG: SHIM_LOG,
      T0743_SHIM_IMAGE_MAP: `${WIZARD_IMAGE}=${IMAGE}`,
      T0743_SHIM_LABEL: LABEL,
    },
  })
  // configure-mounts opens a folder picker: answer it with this run's temp folder.
  await inst.app.evaluate(({ dialog }, dir) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [dir] })
  }, MOUNT_DIR)
  wizardLog = captureWizardLog(inst.win)
  const status = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.docker.status())
  log(`docker:status through the shim → ${JSON.stringify(status)}; RemoteServer port ${inst.remotePort}`)
  expect(status.available).toBe(true)
})

test.afterAll(async () => {
  test.setTimeout(180_000)
  if (inst) {
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'wizard-log.txt'), wizardLog.join('\n'))
    const logs = path.join(inst.userData, 'Logs')
    for (const f of fs.existsSync(logs) ? fs.readdirSync(logs) : []) {
      if (f.startsWith('debug-')) fs.copyFileSync(path.join(logs, f), path.join(EVIDENCE_DIR, `instance-${f}`))
    }
  }
  await closeIsolated(inst, log)
  const cleanup = [
    ...[...created, NEW_CONTAINER].map(removeOwnContainer),
    ...[...createdVolumes, NEW_VOLUME].map(removeOwnVolume),
  ]
  const img = docker(['images', '-q', IMAGE]).trim()
  if (img) cleanup.push(`image ${IMAGE}: ${dockerOk(['rmi', IMAGE]).ok ? 'removed' : 'remove FAILED'}`)
  log(`cleanup: ${cleanup.join('; ')}`)
  if (fs.existsSync(SHIM_LOG)) fs.copyFileSync(SHIM_LOG, path.join(EVIDENCE_DIR, 'docker-shim.log'))
  const refused = shimEntries().filter(e => e.refused)
  log(`shim calls ${shimEntries().length}; refused by the guard ${refused.length}${refused.length ? `: ${refused.map(e => e.refused).join(' | ')}` : ''}`)
  const userAfter = userContainers()
  log(`user containers unchanged after the run: ${userAfter === userBefore}`)
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(WORK, { recursive: true, force: true }); break } catch { await new Promise(r => setTimeout(r, 500)) }
  }
  log(`temp ${WORK} removed: ${!fs.existsSync(WORK)}`)
})

/** Every scenario ends with the user's containers exactly as they were and no guard refusal. */
function expectUserUntouched(tag: string): void {
  const now = userContainers()
  log(`${tag}: user containers unchanged: ${now === userBefore}`)
  expect(now, `${tag}: user containers changed`).toBe(userBefore)
  const refused = shimEntries().filter(e => e.refused)
  expect(refused.map(e => e.refused), `${tag}: shim guard refused a command`).toEqual([])
}

// ── tests ───────────────────────────────────────────────────────────────────

test('D1 (BUG-097 / BUG-156) Create new: docker run publishes 127.0.0.1:<picked port>, healthy, loopback only', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 180_000)
  const { win, remotePort } = inst!
  await openDockerWizard(win)
  created.add(NEW_CONTAINER)
  const outcome = await driveWizard(win, CREATE_NEW)
  const statuses = await stepStatuses(win)
  log(`D1: wizard ${outcome.result}; steps ${JSON.stringify(statuses)}`)
  await shot(win, 'd1-create-new')
  expect(outcome.result, `D1 wizard: ${outcome.text.slice(0, 600)}`).toBe('complete')

  const run = shimEntries().find(e => e.args[0] === 'run')
  expect(run, 'D1: docker run through the shim').toBeTruthy()
  log(`D1: wizard docker run (as BAT sent it): docker ${run!.args.join(' ')}`)
  log(`D1: forwarded to WSL: docker ${run!.forwarded!.join(' ')}`)
  const pIdx = run!.args.indexOf('-p')
  const publish = run!.args[pIdx + 1]
  const m = /^127\.0\.0\.1:(\d+):9876$/.exec(publish)
  expect(m, `D1: -p ${publish}`).not.toBeNull()
  const port = Number(m![1])
  expect(port, 'D1: published port must not be the RemoteServer port').not.toBe(remotePort)

  const profiles = (await win.evaluate(async () => (window as AnyApi).electronAPI.profile.list())).profiles as AnyApi[]
  const profile = profiles.find(p => p.targetOS === 'docker-linux' && p.dockerContainer === NEW_CONTAINER)
  log(`D1: profile ${JSON.stringify(profile && { name: profile.name, targetOS: profile.targetOS, remoteHost: profile.remoteHost, remotePort: profile.remotePort, dockerContainer: profile.dockerContainer, dockerMounts: (profile.dockerMounts ?? []).length, remoteFingerprint: String(profile.remoteFingerprint ?? '').slice(0, 23) })}`)
  expect(profile?.remotePort).toBe(port)

  const bindings = JSON.parse(docker(['inspect', '-f', '{{json .HostConfig.PortBindings}}', NEW_CONTAINER]))
  const actual = docker(['port', NEW_CONTAINER]).trim()
  const health = docker(['inspect', '-f', '{{.State.Health.Status}}', NEW_CONTAINER]).trim()
  const healthLog = docker(['inspect', '-f', '{{range .State.Health.Log}}{{.ExitCode}} {{end}}', NEW_CONTAINER]).trim()
  const healthcheck = docker(['inspect', '-f', '{{json .Config.Healthcheck.Test}}', NEW_CONTAINER]).trim()
  const command = docker(['inspect', '-f', '{{json .Config.Entrypoint}} {{json .Config.Cmd}}', NEW_CONTAINER]).trim()
  const listen = docker(['exec', NEW_CONTAINER, 'sh', '-c', 'awk \'NR>1 && $4=="0A" {print $2}\' /proc/net/tcp /proc/net/tcp6']).trim().split(/\s+/)
  const wslIp = wslSh('hostname -I').split(/\s+/)[0]
  const fromWslIp = wslSh(`timeout 5 bash -c 'exec 3<>/dev/tcp/${wslIp}/${port}' 2>/dev/null && echo open || echo refused`)
  const fromLoopback = wslSh(`timeout 5 bash -c 'exec 3<>/dev/tcp/127.0.0.1/${port}' 2>/dev/null && echo open || echo refused`)
  const fp = await tlsFingerprint(port)
  log(`D1: PortBindings ${JSON.stringify(bindings)}; docker port → ${actual}`)
  log(`D1: health ${health} (probe exit codes: ${healthLog}); HEALTHCHECK ${healthcheck.slice(0, 160)}…`)
  log(`D1: entrypoint/cmd ${command.replace(/--token","[^"]+"/, '--token","<token>"')}; in-container listeners ${JSON.stringify(listen)}`)
  log(`D1: from WSL ${wslIp}:${port} → ${fromWslIp}; from WSL 127.0.0.1:${port} → ${fromLoopback}; from Windows TLS 127.0.0.1:${port} fp ${fp.slice(0, 23)}… = profile pin: ${fp.toUpperCase() === String(profile?.remoteFingerprint ?? '').toUpperCase()}`)

  const list = bindings['9876/tcp'] as Array<{ HostIp: string; HostPort: string }>
  expect(Object.keys(bindings)).toEqual(['9876/tcp'])
  expect(list).toEqual([{ HostIp: '127.0.0.1', HostPort: String(port) }])
  expect(actual).toBe(`9876/tcp -> 127.0.0.1:${port}`)
  expect(health).toBe('healthy')
  expect(healthLog.split(/\s+/).filter(Boolean).every(c => c === '0')).toBe(true)
  expect(healthcheck).toContain('tls')
  expect(command).toContain('--bind-interface')
  expect(listen).toContain('00000000:2694') // 0.0.0.0:9876 inside the container
  expect(fromWslIp).toBe('refused')
  expect(fromLoopback).toBe('open')
  expect(fp.toUpperCase()).toBe(String(profile?.remoteFingerprint ?? '').toUpperCase())
  expect(volumeExists(NEW_VOLUME)).toBe(true)
  createdVolumes.add(NEW_VOLUME)

  await closeWizard(win)
  log(`D1 cleanup: ${removeOwnContainer(NEW_CONTAINER)}; ${removeOwnVolume(NEW_VOLUME)}`)
  expectUserUntouched('D1')
  log('D1: PASS')
})

test('D2 (BUG-156) Use existing: RemoteServer port / unpublished port refused, containers untouched', async () => {
  test.setTimeout(2 * WIZARD_TIMEOUT_MS + 120_000)
  const { win, remotePort } = inst!
  const cases = [
    { name: `${PREFIX}user-port`, publish: ['-p', `127.0.0.1:${remotePort}:9876`], expect: /this BAT's own remote server is listening on/ },
    { name: `${PREFIX}user-nopub`, publish: [] as string[], expect: /does not publish the BAT server port/ },
  ]
  for (const c of cases) {
    created.add(c.name)
    docker(['create', '--name', c.name, '--label', LABEL, ...c.publish, IMAGE])
    const before = inspectState(c.name)
    log(`D2 ${c.name}: created (${before.status}), PortBindings ${docker(['inspect', '-f', '{{json .HostConfig.PortBindings}}', c.name]).trim()}`)
    await openDockerWizard(win)
    const outcome = await driveWizard(win, USE_EXISTING)
    const statuses = await stepStatuses(win)
    log(`D2 ${c.name}: wizard ${outcome.result}; steps ${JSON.stringify(statuses)}; detail ${outcome.text.replace(/\s+/g, ' ').slice(0, 400)}`)
    await shot(win, `d2-${c.name}`)
    expect(outcome.result).toBe('failed')
    expect(statuses['start-server']).toBe('failed')
    expect(outcome.text).toMatch(c.expect)
    const rolled = await cancelAndWaitRollback(win, 'start-server')
    const after = inspectState(c.name)
    log(`D2 ${c.name}: after Cancel steps ${JSON.stringify(rolled)}; container ${after.status} id same ${after.id === before.id} startedAt ${after.startedAt}`)
    expect(after).toEqual(before)
    const touched = shimEntries().filter(e => ['start', 'stop', 'rm', 'restart', 'run'].includes(e.args[0]) && e.args.includes(c.name))
    expect(touched.map(e => e.args.join(' ')), `D2 ${c.name}: start/stop/rm through the shim`).toEqual([])
    await closeWizard(win)
    log(`D2 cleanup: ${removeOwnContainer(c.name)}`)
  }
  expectUserUntouched('D2')
  log('D2: PASS')
})

async function existingContainerScenario(tag: string, name: string, volume: string, stopFirst: boolean): Promise<void> {
  const { win } = inst!
  let hostPort = await freePort()
  while (hostPort === inst!.remotePort || !(await portFree(hostPort))) hostPort = await freePort()
  created.add(name)
  createdVolumes.add(volume)
  docker(['volume', 'create', '--label', LABEL, volume])
  docker(['run', '-d', '--name', name, '--label', LABEL, '--no-healthcheck', '--entrypoint', 'sleep',
    '-p', `127.0.0.1:${hostPort}:9876`, '-v', `${volume}:/data`, IMAGE, 'infinity'])
  docker(['exec', name, 'sh', '-c', `echo ${tag}-keep-volume > /data/keep.txt && echo ${tag}-keep-root > /root/keep-root.txt`])
  if (stopFirst) docker(['stop', '-t', '1', name])
  const before = inspectState(name)
  log(`${tag}: user container ${name} ${before.status} (startedAt ${before.startedAt}), volume ${volume}, -p 127.0.0.1:${hostPort}:9876, no bat-server inside (sleep)`)

  const callsBefore = shimEntries().length
  await openDockerWizard(win)
  const outcome = await driveWizard(win, USE_EXISTING)
  const statuses = await stepStatuses(win)
  log(`${tag}: wizard ${outcome.result}; steps ${JSON.stringify(statuses)}; detail ${outcome.text.replace(/\s+/g, ' ').slice(0, 400)}`)
  await shot(win, `${tag.toLowerCase()}-failed`)
  expect(outcome.result).toBe('failed')
  expect(statuses['start-server']).toBe('completed') // stepper class for WizardStepStatus.Succeeded
  const during = inspectState(name)
  log(`${tag}: before Cancel container ${during.status} startedAt ${during.startedAt}`)
  expect(during.running).toBe(true)

  const failedStep = Object.entries(statuses).find(([, s]) => s === 'failed')?.[0] ?? 'start-server'
  const rolled = await cancelAndWaitRollback(win, 'start-server')
  await expect.poll(() => inspectState(name).status, { timeout: 30_000 }).toBe(before.status).catch(() => { /* asserted below */ })
  const after = inspectState(name)
  const calls = shimEntries().slice(callsBefore).filter(e => e.args.includes(name)).map(e => `${e.args[0]}→${e.exit}`)
  const files = stopFirst
    ? docker(['cp', `${name}:/root/keep-root.txt`, '-']) + docker(['cp', `${name}:/data/keep.txt`, '-'])
    : docker(['exec', name, 'sh', '-c', 'cat /root/keep-root.txt /data/keep.txt'])
  log(`${tag}: failed at ${failedStep}; after Cancel steps ${JSON.stringify(rolled)}`)
  log(`${tag}: container ${after.status} (id same ${after.id === before.id}, startedAt ${after.startedAt}); volume exists ${volumeExists(volume)}; files keep-root ${files.includes(`${tag}-keep-root`)} keep-volume ${files.includes(`${tag}-keep-volume`)}`)
  log(`${tag}: shim calls naming ${name}: ${calls.join(', ')}`)
  log(`${tag}: wizard log: ${wizardLog.filter(l => l.includes(name)).slice(-4).join(' | ')}`)
  expect(rolled['start-server']).toBe('rolled-back')
  expect(after.id).toBe(before.id)
  expect(after.status).toBe(before.status)
  if (!stopFirst) expect(after.startedAt).toBe(before.startedAt) // never restarted
  expect(files).toContain(`${tag}-keep-root`)
  expect(files).toContain(`${tag}-keep-volume`)
  expect(volumeExists(volume)).toBe(true)
  expect(calls.some(c => c.startsWith('rm→'))).toBe(false)
  if (!stopFirst) expect(calls.some(c => c.startsWith('stop→'))).toBe(false)
  else expect(calls.filter(c => c.startsWith('start→') || c.startsWith('stop→'))).toEqual(['start→0', 'stop→0'])
  await closeWizard(win)
  log(`${tag} cleanup: ${removeOwnContainer(name)}; ${removeOwnVolume(volume)}`)
}

test('D3 (BUG-111) Use existing on a running user container: Cancel leaves it running, data intact', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 120_000)
  await existingContainerScenario('D3', `${PREFIX}user-running`, `${PREFIX}user-running-data`, false)
  expectUserUntouched('D3')
  log('D3: PASS')
})

test('D4 (BUG-111) Use existing on a stopped user container: Cancel stops only what it started, nothing removed', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 120_000)
  await existingContainerScenario('D4', `${PREFIX}user-stopped`, `${PREFIX}user-stopped-data`, true)
  expectUserUntouched('D4')
  log('D4: PASS')
})

// T0427 (BUG-097 follow-up), legacy-image half: a container whose entrypoint runs bat-server without
// `--bind-interface` (the pre-fix image) is reported, never changed. The other half (a container
// published on every host interface) is not run here: it would have to publish on 0.0.0.0.
test('D5 (BUG-097 / T0427) Use existing on a pre-fix container: legacy-image warning, unreachable, left as it was', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 120_000)
  const { win } = inst!
  const name = `${PREFIX}user-legacy`
  let hostPort = await freePort()
  while (hostPort === inst!.remotePort || !(await portFree(hostPort))) hostPort = await freePort()
  created.add(name)
  // The pre-T0418 entrypoint: bat-server with its default bind (container loopback).
  docker(['create', '--name', name, '--label', LABEL, '--entrypoint', '/opt/bat-server/bin/bat-server',
    '-p', `127.0.0.1:${hostPort}:9876`, IMAGE, '--port', '9876'])
  const before = inspectState(name)
  log(`D5: user container ${name} ${before.status}, entrypoint ${docker(['inspect', '-f', '{{json .Config.Entrypoint}} {{json .Config.Cmd}}', name]).trim()}, -p 127.0.0.1:${hostPort}:9876`)

  const callsBefore = shimEntries().length
  await openDockerWizard(win)
  const outcome = await driveWizard(win, USE_EXISTING)
  const statuses = await stepStatuses(win)
  const shellText = (await win.locator('.bat-wizard-shell').innerText().catch(() => '')).replace(/\s+/g, ' ')
  log(`D5: wizard ${outcome.result}; steps ${JSON.stringify(statuses)}; detail ${outcome.text.replace(/\s+/g, ' ').slice(0, 300)}`)
  await shot(win, 'd5-legacy')
  const warnings = any(l => (l.wizard.docker.warning.containerLegacyImage as string).replace('{{name}}', name).slice(0, 40))
  const warned = warnings.some(w => shellText.includes(w))
  const insideListen = docker(['exec', name, 'sh', '-c', 'awk \'NR>1 && $4=="0A" {print $2}\' /proc/net/tcp /proc/net/tcp6']).trim().split(/\s+/)
  log(`D5: legacy-image warning shown: ${warned}; in-container listeners ${JSON.stringify(insideListen)} (0100007F:2694 = 127.0.0.1:9876)`)
  expect(outcome.result).toBe('failed')
  expect(statuses['start-server']).toBe('completed')
  expect(statuses['fetch-fingerprint']).toBe('failed')
  expect(warned).toBe(true)
  expect(insideListen).toContain('0100007F:2694')

  const rolled = await cancelAndWaitRollback(win, 'start-server')
  await expect.poll(() => inspectState(name).running, { timeout: 30_000 }).toBe(false).catch(() => { /* asserted below */ })
  const after = inspectState(name)
  const calls = shimEntries().slice(callsBefore).filter(e => e.args.includes(name)).map(e => `${e.args[0]}→${e.exit}`)
  log(`D5: after Cancel steps ${JSON.stringify(rolled)}`)
  log(`D5: container ${before.status} → ${after.status} (running ${before.running} → ${after.running}), id same ${after.id === before.id}; shim calls ${calls.join(', ')}`)
  expect(after.id).toBe(before.id)
  // Never started before → the wizard started it and stops it again. Docker cannot return a
  // container to `created`, so a stopped container (`exited`) is the original state.
  expect(after.running).toBe(false)
  expect(calls.filter(c => c.startsWith('start→') || c.startsWith('stop→'))).toEqual(['start→0', 'stop→0'])
  expect(calls.some(c => c.startsWith('rm→') || c.startsWith('run→'))).toBe(false)
  await closeWizard(win)
  log(`D5 cleanup: ${removeOwnContainer(name)}`)
  expectUserUntouched('D5')
  log('D5: PASS')
})
