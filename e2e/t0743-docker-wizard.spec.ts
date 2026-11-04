// T0743 / T0854 — the desktop Docker setup wizard against a Docker engine that lives inside WSL.
// OPT-IN: skipped unless BAT_E2E_T0743_DOCKER=1 (Windows host, WSL distro with docker, Go on PATH,
// network for the base image and the server bundle download done by the test itself).
//
//   npx vite build
//   $env:BAT_E2E_T0743_DOCKER='1'
//   npx playwright test e2e/t0743-docker-wizard.spec.ts
//
// Optional: BAT_E2E_T0743_DISTRO (default Ubuntu-24.04), BAT_E2E_T0743_OLD_BUNDLE (a
// bat-server-linux-x64-v<older>.tar.gz for E4; default 0.7.3-pre.3 from the user's bundle cache or
// downloaded), BAT_E2E_T0743_EVIDENCE_DIR.
//
// The wizard runs `docker` from the main process PATH. The isolated instance (source build,
// fixtures/electron-isolation) gets a test-only `docker.exe` first on ITS PATH
// (e2e/real-remote/t0743-docker-shim.go, built into a temp dir): it forwards to
// `wsl.exe -d <distro> --exec docker`, hides every container / volume the test did not create, refuses
// any command naming one, renames BAT's bundle install job to this test's prefix and translates the
// Windows bind-mount path to /mnt/<drive>/…. No docker context, daemon setting or TCP listener is
// touched; the user's own containers are inspected read-only before and after every scenario and must
// not change.
//
// The isolated instance gets BAT_SERVER_BUNDLE_BASE_URL pointing at a closed local port, so its
// distributor cannot download: the first "Create new" goes through "Import local tarball…" (offline,
// T0547) with the tarball this test downloaded beforehand; later runs hit the imported cache.
//
// Names: everything the test creates starts with `bat-e2e-t0743-`, except what the product names
// itself — "Create new" with the wizard's empty profile name creates `bat-server-profile` (then `-2`,
// `-3`) and the volumes `bat-server-<container>-bundle|-data` (PLAN-052 (c′)). beforeAll refuses to
// run when any of those already exists; the scenarios and afterAll remove them.
//
//   E1 (c′) / T0849 / BUG-156  "Create new" on the default base image, server bundle imported offline:
//                         docker run on the base image with the bundle volume, no --token anywhere,
//                         -p 127.0.0.1:<picked port>:9876 only, healthy, loopback only, fingerprint =
//                         the profile's pin, the token read from server-token.json
//   E2 T0851 / T0850      a second "Create new" (`-2`), then "Use existing" picks the SECOND entry of
//                         the container list (`bat-server-profile`), takes its bind mount, same bundle
//                         version → nothing installed; the Docker profile count does not change
//   E3 T0853 upgrade      the bundle volume of `bat-server-profile` is put back to an older bundle; the
//                         re-run asks, upgrades and restarts: version = this BAT's, same container,
//                         token, fingerprint and data volume content; profile count unchanged
//   E4 T0852 / T0853      a musl base image (alpine) is refused by the compat probe before any
//                         container or volume exists
//   D2 BUG-156 / T0851    "Use existing": a container publishing the RemoteServer port and one
//                         publishing nothing are listed but disabled, with the reason; untouched
//   D3 BUG-111            "Use existing" on a RUNNING user container (with a data volume, no bat-server)
//                         → the token cannot be read → Cancel: same container id, still running, not
//                         restarted, files and volume intact
//   D4 BUG-111            same on a STOPPED user container → the wizard starts it → Cancel: the wizard
//                         stops only what it started; container, files and volume intact
//   D5 BUG-097 / T0427    "Use existing" on a pre-fix container (bat-server without --bind-interface):
//                         legacy-image warning, unreachable through the published port, left as it was

import { test, expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
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
import { defaultUserDataBundleDirs } from './real-remote/baseline-source.mjs'
import { downloadServerBundle } from '../electron/remote/server-bundle-download'
import { buildDockerBundleInstallScript } from '../electron/docker-bundle-volume'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_T0743_DOCKER === '1'
const DISTRO = process.env.BAT_E2E_T0743_DISTRO || 'Ubuntu-24.04'
const PREFIX = 'bat-e2e-t0743-'
const LABEL = 'bat.t0743=1'
const IMAGE = `${PREFIX}server:local` // docker/Dockerfile + the bundle: D3–D5 only
const BASE_IMAGE = 'buildpack-deps:bookworm-scm' // DEFAULT_DOCKER_BASE_IMAGE, steps/docker/base-image.ts
const MUSL_IMAGE = 'alpine:3.20'
const NEW = 'bat-server-profile' // `bat-server-${slug('')}`, pick-container.ts
const NEW2 = `${NEW}-2`
const NEW3 = `${NEW}-3`
const PRODUCT_CONTAINERS = [NEW, NEW2, NEW3]
const bundleVolume = (c: string) => `bat-server-${c}-bundle` // batVolumeNames
const dataVolume = (c: string) => `bat-server-${c}-data`
const PRODUCT_VOLUMES = PRODUCT_CONTAINERS.flatMap(c => [bundleVolume(c), dataVolume(c)])
const ALLOW = `^(${PREFIX}[a-z0-9-]+|${NEW}(-[0-9]+)?)$`
const JOB_PREFIX = `${PREFIX}job-`
const STAMP = Date.now()
const WORK = path.join(os.tmpdir(), `${PREFIX}wizard-${STAMP}`)
const EVIDENCE_DIR = process.env.BAT_E2E_T0743_EVIDENCE_DIR || path.join(os.tmpdir(), `${PREFIX}evidence`)
const SHIM_LOG = path.join(WORK, 'docker-shim.log')
const MOUNT_DIR = path.join(WORK, `${PREFIX}mount`)
const BUNDLE_DIR = path.join(WORK, 'bundles')
const DOCKER_STEP_IDS = ['detect-env', 'pick-container', 'configure-mounts', 'install-server-bundle', 'start-server', 'fetch-fingerprint', 'connect-test', 'write-profile', 'done']
const WIZARD_TIMEOUT_MS = 420_000
const APP_VERSION = (JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string }).version
  .replace(/\.local\..*$/, '') // stripSnapshotSuffix
const OLD_VERSION = '0.7.3-pre.3'

test.skip(!ENABLED, 'opt-in: set BAT_E2E_T0743_DOCKER=1 (T0743)')
test.skip(process.platform !== 'win32', 'Windows host only (Docker inside WSL)')

const log = testLogger('t0743')

const LOCALES = ['en', 'zh-TW', 'zh-CN'].map(lang =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${lang}.json`), 'utf8')) as AnyApi)
const any = (pick: (l: AnyApi) => string) => [...new Set(LOCALES.map(pick))]
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const oneOf = (values: string[]) => new RegExp(`^\\s*(${[...new Set(values)].map(escape).join('|')})\\s*$`)
const COMPLETE = any(l => l.wizard.progress.complete)
const ADD_MORE = oneOf(any(l => l.profiles.addMore))
// The menu item is "<icon> <label>" (profiles/AddProfileMenu.tsx).
const ADD_DOCKER = new RegExp(`(${any(l => l.profiles.addDockerProfile).map(escape).join('|')})`)
const CREATE_NEW = any(l => l.wizard.docker.pickContainer.new.label)
const USE_EXISTING = any(l => l.wizard.docker.pickContainer.existing.label)
const USE_MOUNTS = any(l => l.wizard.docker.configureMounts.fromContainer.use)
const UPGRADE = any(l => l.wizard.docker.upgrade.confirm)
const UPGRADE_TITLE = any(l => (l.wizard.docker.upgrade.title as string).split('{{')[0])
const SUBMIT_TEXT = any(l => l.wizard.action.submitText)

// ── WSL docker (test side, never through the shim) ──────────────────────────

function docker(args: string[], timeout = 60_000, input?: Buffer): string {
  return execFileSync('wsl.exe', ['-d', DISTRO, '--exec', 'docker', ...args], {
    encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024,
    ...(input ? { input } : { stdio: ['ignore', 'pipe', 'pipe'] as const }),
  })
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

function imagePresent(image: string): boolean {
  return dockerOk(['image', 'inspect', '--format', '{{.Id}}', image]).ok
}

/** Id, state and start time of every container this test did not create (read-only). */
function userContainers(): string {
  const rows = docker(['ps', '-a', '--no-trunc', '--format', '{{.ID}} {{.Names}}']).split(/\r?\n/).filter(Boolean)
    .filter(r => !new RegExp(ALLOW).test(r.split(' ')[1] ?? '') && !(r.split(' ')[1] ?? '').startsWith(JOB_PREFIX))
  return rows.map(r => {
    const id = r.split(' ')[0]
    return `${r} ${docker(['inspect', '-f', '{{.State.Status}} {{.State.StartedAt}} {{.RestartCount}}', id]).trim()}`
  }).sort().join('\n')
}

function inspectState(name: string): { id: string; status: string; running: boolean; startedAt: string } {
  const [id, status, running, startedAt] = docker(['inspect', '-f', '{{.Id}} {{.State.Status}} {{.State.Running}} {{.State.StartedAt}}', name]).trim().split(' ')
  return { id, status, running: running === 'true', startedAt }
}

/** Removes a container only when it is one of this test's names (prefixed names must carry the label). */
function removeOwnContainer(name: string): string {
  if (!new RegExp(ALLOW).test(name) || !containerExists(name)) return `${name}: absent`
  const label = docker(['inspect', '-f', '{{index .Config.Labels "bat.t0743"}}', name]).trim()
  if (label !== '1' && !PRODUCT_CONTAINERS.includes(name)) return `${name}: exists WITHOUT label ${LABEL} — not ours, left alone`
  return `${name}: ${dockerOk(['rm', '-f', name]).ok ? 'removed' : 'remove FAILED'}`
}

function removeOwnVolume(name: string): string {
  if (!(name.startsWith(PREFIX) || PRODUCT_VOLUMES.includes(name)) || !volumeExists(name)) return `volume ${name}: absent`
  return `volume ${name}: ${dockerOk(['volume', 'rm', name]).ok ? 'removed' : 'remove FAILED'}`
}

function removeProductResources(): string {
  return [...PRODUCT_CONTAINERS.map(removeOwnContainer), ...PRODUCT_VOLUMES.map(removeOwnVolume)].filter(s => !s.endsWith('absent')).join('; ') || 'nothing left'
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

/** Server bundle version in a bundle volume (read-only job on the base image). */
function volumeBundleVersion(container: string): string {
  return wslSh(`docker run --rm --network none -v ${bundleVolume(container)}:/opt/bat:ro --entrypoint /bin/sh ${BASE_IMAGE} -c 'grep -o "\\"version\\": *\\"[^\\"]*\\"" /opt/bat/server/package.json | head -n1 | cut -d\\" -f4'`, 60_000)
}

function tokenDigest(container: string): string {
  return createHash('sha256').update(docker(['exec', container, 'cat', '/var/lib/bat-server/server-token.json'])).digest('hex').slice(0, 16)
}

async function waitHealthy(container: string, timeoutMs = 90_000): Promise<string> {
  const end = Date.now() + timeoutMs
  let health = ''
  while (Date.now() < end) {
    health = docker(['inspect', '-f', '{{.State.Health.Status}}', container]).trim()
    if (health === 'healthy' || health === 'unhealthy') return health
    await new Promise(r => setTimeout(r, 1000))
  }
  return `timeout (${health})`
}

/** A tarball + .sha256 for `version`: the user's bundle cache if it has one, else a download into BUNDLE_DIR. */
async function bundleFor(version: string): Promise<string> {
  const name = `bat-server-linux-x64-v${version}.tar.gz`
  for (const dir of defaultUserDataBundleDirs()) {
    if (fs.existsSync(path.join(dir, name)) && fs.existsSync(path.join(dir, `${name}.sha256`))) {
      fs.mkdirSync(BUNDLE_DIR, { recursive: true })
      fs.copyFileSync(path.join(dir, name), path.join(BUNDLE_DIR, name))
      fs.copyFileSync(path.join(dir, `${name}.sha256`), path.join(BUNDLE_DIR, `${name}.sha256`))
      return path.join(BUNDLE_DIR, name)
    }
  }
  const result = await downloadServerBundle({ arch: 'linux-x64', version, cacheDir: BUNDLE_DIR })
  if (!result.ok) throw new Error(`server bundle ${version}: ${result.errorCode}: ${result.error}`)
  return result.tarballPath
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

type Outcome = { result: 'complete' | 'failed' | 'timeout'; text: string; picked: string[]; imported: boolean }

interface DriveOptions {
  /** Choice labels in priority order; the first enabled one present in a prompt is clicked. */
  choices: string[]
  /** Text for the base image prompt (empty = submit the pre-filled value). */
  baseImage?: string
  /** Click "Import local tarball…" once when the install step fails with it. */
  importOnce?: boolean
}

async function driveWizard(win: Page, opts: DriveOptions): Promise<Outcome> {
  const shell = win.locator('.bat-wizard-shell')
  const prompt = win.locator('#bat-wizard-active-prompt')
  const end = Date.now() + WIZARD_TIMEOUT_MS
  const picked: string[] = []
  let imported = false
  while (Date.now() < end) {
    const text = await shell.innerText().catch(() => '')
    if (COMPLETE.some(c => text.includes(c))) return { result: 'complete', text, picked, imported }
    if (await win.locator('.bat-stepper-failed-actions').count() > 0) {
      const importButton = win.locator('.bat-stepper-failed-actions [data-action-kind="import-server-bundle"]')
      if (opts.importOnce && !imported && await importButton.count() > 0) {
        log('wizard: install failed (download blocked) → "Import local tarball…"')
        imported = true
        await importButton.first().click()
        await win.waitForTimeout(1000)
        continue
      }
      return { result: 'failed', text: await win.locator('.bat-wizard-detail').innerText().catch(() => text), picked, imported }
    }
    if (await prompt.isVisible().catch(() => false)) {
      const input = prompt.locator('input.bat-wizard-text-input')
      if (await input.count() > 0) {
        if (opts.baseImage) await input.fill(opts.baseImage)
        log(`wizard: base image "${await input.inputValue()}"`)
        picked.push(`text:${await input.inputValue()}`)
        await prompt.getByRole('button', { name: oneOf(SUBMIT_TEXT) }).click()
      } else {
        for (const label of opts.choices) {
          const button: Locator = prompt.getByRole('button', { name: label, exact: true })
          if (await button.count() > 0 && await button.first().isEnabled()) {
            log(`wizard: pick "${label}"`)
            picked.push(label)
            await button.first().click()
            break
          }
        }
      }
    }
    await win.waitForTimeout(500)
  }
  return { result: 'timeout', text: await shell.innerText().catch(() => ''), picked, imported }
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

async function dockerProfiles(win: Page): Promise<AnyApi[]> {
  const profiles = (await win.evaluate(async () => (window as AnyApi).electronAPI.profile.list())).profiles as AnyApi[]
  return profiles.filter(p => p.targetOS === 'docker-linux')
}

// ── lifecycle ───────────────────────────────────────────────────────────────

let inst: IsolatedInstance | undefined
let keepAlive: ChildProcess | undefined
let bootBefore = ''
let userBefore = ''
let wizardLog: string[] = []
let currentTarball = ''
let oldTarball = ''
const imagesPulledHere: string[] = []
const created = new Set<string>()
const createdVolumes = new Set<string>()

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  test.setTimeout(1_500_000)
  fs.mkdirSync(path.join(WORK, 'shim-bin'), { recursive: true })
  fs.mkdirSync(MOUNT_DIR, { recursive: true })
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  // WSL stops an idle distro (and dockerd with it, restarting every unless-stopped container, the
  // user's included) when no wsl.exe process runs; a sleeping wsl.exe keeps it up for the run, the
  // same way BAT keeps a WSL profile's distro (T0830). No setting changes.
  keepAlive = spawn('wsl.exe', ['-d', DISTRO, '--exec', 'sleep', 'infinity'], { stdio: 'ignore', windowsHide: true })
  bootBefore = wslSh('pidof dockerd')
  log(`docker engine in ${DISTRO}: ${docker(['version', '--format', '{{.Server.Version}}']).trim()}; app version ${APP_VERSION}; dockerd pid ${bootBefore.replace(/\s*\n\s*/g, ' / ')}`)

  // Names the product picks itself must not exist (BUG-111: never adopt a user's container).
  for (const name of PRODUCT_CONTAINERS) expect(containerExists(name), `${name} already exists on the engine — not ours, refusing to run`).toBe(false)
  for (const name of PRODUCT_VOLUMES) expect(volumeExists(name), `volume ${name} already exists — not ours, refusing to run`).toBe(false)
  const leftovers = docker(['ps', '-a', '--filter', `name=${PREFIX}`, '--format', '{{.Names}}']).trim()
  expect(leftovers, `leftover ${PREFIX}* containers from an earlier run`).toBe('')
  for (const image of [BASE_IMAGE, MUSL_IMAGE]) if (!imagePresent(image)) imagesPulledHere.push(image)

  userBefore = userContainers()
  log(`user containers (read-only sentinel):\n${userBefore || '(none)'}`)

  // The shim, built into this run's temp dir.
  const shim = path.join(WORK, 'shim-bin', 'docker.exe')
  execFileSync('go', ['build', '-o', shim, path.join(REPO_ROOT, 'e2e', 'real-remote', 't0743-docker-shim.go')], { encoding: 'utf8', timeout: 300_000, windowsHide: true })
  log(`docker shim built: ${shim}`)

  // Bundles: this BAT's version (imported offline in E1) and an older one (E3).
  currentTarball = await bundleFor(APP_VERSION)
  oldTarball = process.env.BAT_E2E_T0743_OLD_BUNDLE || await bundleFor(OLD_VERSION)
  log(`server bundles: current ${path.basename(currentTarball)}; old ${path.basename(oldTarball)}`)

  // D3–D5: an image with the server baked in (docker/Dockerfile + the bundle).
  const ctx = path.join(WORK, 'docker-context')
  fs.mkdirSync(path.join(ctx, 'dist-server'), { recursive: true })
  fs.copyFileSync(path.join(REPO_ROOT, 'docker', 'Dockerfile'), path.join(ctx, 'Dockerfile'))
  fs.copyFileSync(currentTarball, path.join(ctx, 'dist-server', path.basename(currentTarball)))
  const ctxPosix = execFileSync('wsl.exe', ['-d', DISTRO, '--exec', 'wslpath', '-a', ctx], { encoding: 'utf8', windowsHide: true }).trim()
  if (docker(['images', '-q', IMAGE]).trim()) {
    const label = docker(['inspect', '-f', '{{index .Config.Labels "bat.t0743"}}', IMAGE]).trim()
    expect(label, `${IMAGE} exists without label ${LABEL} — not ours`).toBe('1')
  }
  docker(['build', '-q', '--label', LABEL, '-t', IMAGE, ctxPosix], 900_000)
  fs.rmSync(ctx, { recursive: true, force: true })
  log(`image ${IMAGE} built`)

  inst = await launchIsolated('t0743-docker', log, {
    env: {
      Path: `${path.dirname(shim)};${process.env.PATH ?? process.env.Path ?? ''}`,
      T0743_SHIM_DISTRO: DISTRO,
      T0743_SHIM_ALLOW: ALLOW,
      T0743_SHIM_LOG: SHIM_LOG,
      T0743_SHIM_LABEL: LABEL,
      T0743_SHIM_JOB_PREFIX: JOB_PREFIX,
      // Offline: the distributor cannot download (connection refused), so E1 imports the tarball.
      BAT_SERVER_BUNDLE_BASE_URL: 'http://127.0.0.1:9/t0743-offline',
    },
  })
  // configure-mounts opens a folder picker; "Import local tarball…" opens a file picker.
  await inst.app.evaluate(({ dialog }, { dir, tarball }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dialog as any).showOpenDialog = async (...args: any[]) => {
      const options = args.find(a => a && Array.isArray(a.properties)) ?? {}
      return { canceled: false, filePaths: [options.properties?.includes('openDirectory') ? dir : tarball] }
    }
  }, { dir: MOUNT_DIR, tarball: currentTarball })
  wizardLog = captureWizardLog(inst.win)
  const status = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.docker.status())
  log(`docker:status through the shim → ${JSON.stringify(status)}; RemoteServer port ${inst.remotePort}`)
  expect(status.available).toBe(true)
})

test.afterAll(async () => {
  test.setTimeout(240_000)
  if (inst) {
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'wizard-log.txt'), wizardLog.join('\n'))
    const logs = path.join(inst.userData, 'Logs')
    for (const f of fs.existsSync(logs) ? fs.readdirSync(logs) : []) {
      if (f.startsWith('debug-')) fs.copyFileSync(path.join(logs, f), path.join(EVIDENCE_DIR, `instance-${f}`))
    }
  }
  await closeIsolated(inst, log)
  const bootAfter = wslSh('pidof dockerd')
  log(`dockerd restarted during the run (pid changed): ${bootAfter !== bootBefore} (${bootAfter.replace(/\s*\n\s*/g, ' / ')})`)
  keepAlive?.kill()
  const cleanup = [
    ...[...created].map(removeOwnContainer),
    removeProductResources(),
    ...[...createdVolumes].map(removeOwnVolume),
  ]
  if (docker(['images', '-q', IMAGE]).trim()) cleanup.push(`image ${IMAGE}: ${dockerOk(['rmi', IMAGE]).ok ? 'removed' : 'remove FAILED'}`)
  for (const image of imagesPulledHere) if (imagePresent(image)) cleanup.push(`image ${image}: ${dockerOk(['rmi', image]).ok ? 'removed' : 'remove FAILED'}`)
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

test('E1 ((c′) / T0849 / BUG-156) Create new on the base image, bundle imported offline, no --token, 127.0.0.1 only', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 180_000)
  const { win, remotePort } = inst!
  const callsBefore = shimEntries().length
  await openDockerWizard(win)
  const outcome = await driveWizard(win, { choices: CREATE_NEW, importOnce: true })
  const statuses = await stepStatuses(win)
  log(`E1: wizard ${outcome.result}; picked ${JSON.stringify(outcome.picked)}; imported ${outcome.imported}; steps ${JSON.stringify(statuses)}`)
  await shot(win, 'e1-create-new')
  expect(outcome.result, `E1 wizard: ${outcome.text.slice(0, 600)}`).toBe('complete')
  expect(outcome.imported, 'E1: the bundle came from "Import local tarball…"').toBe(true)
  expect(outcome.picked).toContain(`text:${BASE_IMAGE}`)

  const calls = shimEntries().slice(callsBefore)
  const run = calls.find(e => e.args[0] === 'run' && e.args.includes('-d'))
  expect(run, 'E1: docker run -d through the shim').toBeTruthy()
  log(`E1: wizard docker run (as BAT sent it): docker ${run!.args.join(' ').slice(0, 600)}`)
  const pIdx = run!.args.indexOf('-p')
  const m = /^127\.0\.0\.1:(\d+):9876$/.exec(run!.args[pIdx + 1])
  expect(m, `E1: -p ${run!.args[pIdx + 1]}`).not.toBeNull()
  expect(run!.args.filter(a => a === '-p')).toHaveLength(1)
  const port = Number(m![1])
  expect(port, 'E1: published port must not be the RemoteServer port').not.toBe(remotePort)
  expect(run!.args).toContain(`${bundleVolume(NEW)}:/opt/bat`)
  expect(run!.args).toContain(`${dataVolume(NEW)}:/var/lib/bat-server`)
  expect(run!.args).toContain(BASE_IMAGE)
  // T0849 / D283: no token on any command line; read from server-token.json after healthy.
  const tokenArgs = calls.filter(e => (e.forwarded ?? e.args).some(a => /--token/.test(a)))
  const tokenRead = calls.filter(e => e.args[0] === 'exec' && e.args.includes('/var/lib/bat-server/server-token.json'))
  const jobs = calls.filter(e => e.args[0] === 'run' && e.args.includes('--rm'))
  const pulls = calls.filter(e => e.args[0] === 'pull').map(e => `${e.args[1]}→${e.exit}`)
  log(`E1: pulls ${pulls.join(', ')}; one-shot jobs ${jobs.length} (${jobs.map(e => `${e.forwarded?.includes('-i') ? 'install' : 'probe/version'}→${e.exit}`).join(', ')}); token reads ${tokenRead.map(e => `exit ${e.exit}`).join(', ')}; args with --token ${tokenArgs.length}`)
  expect(tokenArgs).toEqual([])
  expect(tokenRead.some(e => e.exit === 0)).toBe(true)

  const profile = (await dockerProfiles(win)).find(p => p.dockerContainer === NEW)
  log(`E1: profile ${JSON.stringify(profile && { targetOS: profile.targetOS, remoteHost: profile.remoteHost, remotePort: profile.remotePort, dockerMounts: (profile.dockerMounts ?? []).length, remoteToken: profile.remoteToken ? `set (${String(profile.remoteToken).length})` : 'missing', remoteFingerprint: String(profile.remoteFingerprint ?? '').slice(0, 23) })}`)
  expect(profile?.remotePort).toBe(port)
  expect(String(profile?.remoteToken ?? '').length).toBeGreaterThan(20)

  const shape = JSON.parse(docker(['inspect', NEW]))[0]
  const bindings = shape.HostConfig.PortBindings
  const health = await waitHealthy(NEW)
  const listen = docker(['exec', NEW, 'sh', '-c', 'awk \'NR>1 && $4=="0A" {print $2}\' /proc/net/tcp /proc/net/tcp6']).trim().split(/\s+/)
  const wslIp = wslSh('hostname -I').split(/\s+/)[0]
  const fromWslIp = wslSh(`timeout 5 bash -c 'exec 3<>/dev/tcp/${wslIp}/${port}' 2>/dev/null && echo open || echo refused`)
  const fromLoopback = wslSh(`timeout 5 bash -c 'exec 3<>/dev/tcp/127.0.0.1/${port}' 2>/dev/null && echo open || echo refused`)
  const fp = await tlsFingerprint(port)
  const labels = docker(['volume', 'inspect', '--format', '{{json .Labels}}', bundleVolume(NEW)]).trim()
  const version = volumeBundleVersion(NEW)
  log(`E1: Image ${shape.Config.Image}; User ${shape.Config.User}; Entrypoint ${JSON.stringify(shape.Config.Entrypoint)}; Cmd ${JSON.stringify(shape.Config.Cmd)}; Init ${shape.HostConfig.Init}; PortBindings ${JSON.stringify(bindings)}; health ${health}`)
  log(`E1: bundle volume labels ${labels}; version ${version}; in-container listeners ${JSON.stringify(listen)}; from WSL ${wslIp}:${port} → ${fromWslIp}; 127.0.0.1 → ${fromLoopback}; TLS fp = profile pin: ${fp.toUpperCase() === String(profile?.remoteFingerprint ?? '').toUpperCase()}`)
  expect(shape.Config.Image).toBe(BASE_IMAGE)
  expect(shape.Config.User).toBe('0:0')
  expect(shape.Config.Entrypoint).toEqual(['/opt/bat/server/bin/bat-server'])
  expect(shape.Config.Cmd).toEqual(['--bind-interface', 'all', '--port', '9876', '--data-dir', '/var/lib/bat-server'])
  expect((shape.Config.Env as string[]).some(e => /token/i.test(e))).toBe(false)
  expect(shape.HostConfig.Init).toBe(true)
  expect(shape.Config.Labels['bat.server']).toBe('1')
  expect(Object.keys(bindings)).toEqual(['9876/tcp'])
  expect(bindings['9876/tcp']).toEqual([{ HostIp: '127.0.0.1', HostPort: String(port) }])
  expect(health).toBe('healthy')
  expect(listen).toContain('00000000:2694') // 0.0.0.0:9876 inside the container
  expect(fromWslIp).toBe('refused')
  expect(fromLoopback).toBe('open')
  expect(fp.toUpperCase()).toBe(String(profile?.remoteFingerprint ?? '').toUpperCase())
  expect(labels).toContain('"bat.server":"1"')
  expect(version).toBe(APP_VERSION)
  await closeWizard(win)
  expectUserUntouched('E1')
  log('E1: PASS')
})

test('E2 (T0851 / T0850) second container; Use existing picks the second entry; re-run keeps the profile count', async () => {
  test.setTimeout(2 * WIZARD_TIMEOUT_MS + 120_000)
  const { win } = inst!
  await openDockerWizard(win)
  const second = await driveWizard(win, { choices: CREATE_NEW })
  log(`E2: second Create new ${second.result}; steps ${JSON.stringify(await stepStatuses(win))}`)
  expect(second.result, `E2 second create: ${second.text.slice(0, 600)}`).toBe('complete')
  expect(second.imported).toBe(false) // the imported bundle is in the cache now
  expect(containerExists(NEW2)).toBe(true)
  await closeWizard(win)
  const countBefore = (await dockerProfiles(win)).length
  const before = inspectState(NEW)
  const tokenBefore = tokenDigest(NEW)

  await openDockerWizard(win)
  // Mode prompt → Use existing; container prompt → read the order, then pick NEW (expected second).
  const prompt = win.locator('#bat-wizard-active-prompt')
  await expect(prompt).toBeVisible({ timeout: 60_000 })
  await prompt.getByRole('button', { name: oneOf(USE_EXISTING) }).click()
  await expect(prompt.getByRole('button', { name: NEW, exact: true })).toBeVisible({ timeout: 60_000 })
  const order = (await prompt.locator('button.bat-wizard-choice').allInnerTexts()).map(t => t.trim())
  const descriptions = await prompt.locator('.bat-wizard-choice-item .bat-wizard-prompt-description').allInnerTexts()
  log(`E2: container list order ${JSON.stringify(order)}; descriptions ${JSON.stringify(descriptions)}`)
  await shot(win, 'e2-container-list')
  expect(order.slice(0, 2)).toEqual([NEW2, NEW])
  const rerun = await driveWizard(win, { choices: [NEW, ...USE_MOUNTS] })
  const statuses = await stepStatuses(win)
  log(`E2: re-run on ${NEW} ${rerun.result}; picked ${JSON.stringify(rerun.picked)}; steps ${JSON.stringify(statuses)}`)
  await shot(win, 'e2-rerun')
  expect(rerun.result, `E2 re-run: ${rerun.text.slice(0, 600)}`).toBe('complete')
  expect(rerun.picked).toEqual([NEW, ...USE_MOUNTS.filter(l => rerun.picked.includes(l))])
  expect(rerun.picked.some(p => USE_MOUNTS.includes(p)), 'E2: the container\'s bind mount was offered').toBe(true)
  const after = inspectState(NEW)
  const countAfter = (await dockerProfiles(win)).length
  log(`E2: Docker profiles ${countBefore} → ${countAfter}; ${NEW} id same ${after.id === before.id}, startedAt same ${after.startedAt === before.startedAt}; token same ${tokenDigest(NEW) === tokenBefore}`)
  expect(countAfter).toBe(countBefore)
  expect(after.id).toBe(before.id)
  expect(after.startedAt).toBe(before.startedAt) // same version → no restart
  expect(tokenDigest(NEW)).toBe(tokenBefore)
  await closeWizard(win)
  expectUserUntouched('E2')
  log('E2: PASS')
})

test('E3 (T0853 Q-3) re-run on an older bundle: asks, upgrades, restarts; container, token, fingerprint and data unchanged', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 240_000)
  const { win } = inst!
  // Put the older bundle into NEW's volume (the product's own install script, test side), restart.
  const script = buildDockerBundleInstallScript({ keepPrevious: false })
  docker(['run', '--rm', '-i', '--network', 'none', '--user', '0:0', '-v', `${bundleVolume(NEW)}:/opt/bat`, '--entrypoint', '/bin/sh', BASE_IMAGE, '-c', script, 'sh'], 300_000, fs.readFileSync(oldTarball))
  docker(['restart', NEW])
  expect(await waitHealthy(NEW)).toBe('healthy')
  const oldVersion = volumeBundleVersion(NEW)
  docker(['exec', NEW, 'sh', '-c', 'echo t0743-e3-keep > /var/lib/bat-server/t0743-marker'])
  const before = inspectState(NEW)
  const tokenBefore = tokenDigest(NEW)
  const profileBefore = (await dockerProfiles(win)).find(p => p.dockerContainer === NEW)
  const countBefore = (await dockerProfiles(win)).length
  log(`E3: ${NEW} now on bundle ${oldVersion} (this BAT ${APP_VERSION}); startedAt ${before.startedAt}`)
  expect(oldVersion).not.toBe(APP_VERSION)

  await openDockerWizard(win)
  const outcome = await driveWizard(win, { choices: [...USE_EXISTING, NEW, ...USE_MOUNTS, ...UPGRADE] })
  const statuses = await stepStatuses(win)
  log(`E3: wizard ${outcome.result}; picked ${JSON.stringify(outcome.picked)}; steps ${JSON.stringify(statuses)}`)
  await shot(win, 'e3-upgrade')
  expect(outcome.result, `E3 wizard: ${outcome.text.slice(0, 600)}`).toBe('complete')
  expect(outcome.picked.some(p => UPGRADE.includes(p)), 'E3: the upgrade was asked and confirmed').toBe(true)
  const after = inspectState(NEW)
  const version = volumeBundleVersion(NEW)
  const marker = docker(['exec', NEW, 'cat', '/var/lib/bat-server/t0743-marker']).trim()
  const listing = wslSh(`docker run --rm --network none -v ${bundleVolume(NEW)}:/opt/bat:ro --entrypoint /bin/sh ${BASE_IMAGE} -c 'ls -A /opt/bat'`, 60_000)
  const profileAfter = (await dockerProfiles(win)).find(p => p.dockerContainer === NEW)
  const countAfter = (await dockerProfiles(win)).length
  const restarts = shimEntries().filter(e => e.args[0] === 'restart' && e.args.includes(NEW)).map(e => `restart→${e.exit}`)
  log(`E3: version ${oldVersion} → ${version}; ${restarts.join(', ')}; id same ${after.id === before.id}; startedAt ${before.startedAt} → ${after.startedAt}; token same ${tokenDigest(NEW) === tokenBefore}; marker ${marker}; /opt/bat: ${listing.replace(/\s+/g, ' ')}`)
  log(`E3: Docker profiles ${countBefore} → ${countAfter}; fingerprint same ${profileAfter?.remoteFingerprint === profileBefore?.remoteFingerprint}`)
  expect(version).toBe(APP_VERSION)
  expect(restarts).toContain('restart→0')
  expect(after.id).toBe(before.id)
  expect(after.startedAt).not.toBe(before.startedAt)
  expect(tokenDigest(NEW)).toBe(tokenBefore)
  expect(marker).toBe('t0743-e3-keep')
  expect(listing.split(/\s+/).filter(Boolean)).toEqual(['server']) // finalize discarded .bat-old
  expect(countAfter).toBe(countBefore)
  expect(profileAfter?.remoteFingerprint).toBe(profileBefore?.remoteFingerprint)
  expect(await waitHealthy(NEW)).toBe('healthy')
  await closeWizard(win)
  expectUserUntouched('E3')
  log('E3: PASS')
})

test('E4 (T0852 / T0853) a musl base image is refused before anything is created', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 120_000)
  const { win } = inst!
  const callsBefore = shimEntries().length
  await openDockerWizard(win)
  const outcome = await driveWizard(win, { choices: CREATE_NEW, baseImage: MUSL_IMAGE })
  const statuses = await stepStatuses(win)
  log(`E4: wizard ${outcome.result}; picked ${JSON.stringify(outcome.picked)}; steps ${JSON.stringify(statuses)}; detail ${outcome.text.replace(/\s+/g, ' ').slice(0, 300)}`)
  await shot(win, 'e4-musl')
  const muslTitles = any(l => l.wizard.docker.error.compatMusl.title)
  expect(outcome.result).toBe('failed')
  expect(statuses['install-server-bundle']).toBe('failed')
  expect(muslTitles.some(t => outcome.text.includes(t)), 'E4: musl error shown').toBe(true)
  const calls = shimEntries().slice(callsBefore)
  const createdAnything = calls.filter(e => (e.args[0] === 'run' && e.args.includes('-d')) || (e.args[0] === 'volume' && e.args[1] === 'create'))
  log(`E4: run -d / volume create calls: ${createdAnything.length}; ${NEW3} exists ${containerExists(NEW3)}; volumes ${volumeExists(bundleVolume(NEW3))} / ${volumeExists(dataVolume(NEW3))}`)
  expect(createdAnything).toEqual([])
  expect(containerExists(NEW3)).toBe(false)
  expect(volumeExists(bundleVolume(NEW3)) || volumeExists(dataVolume(NEW3))).toBe(false)
  await cancelAndWaitRollback(win, 'install-server-bundle')
  await closeWizard(win)
  log(`E cleanup: ${removeProductResources()}`)
  expectUserUntouched('E4')
  log('E4: PASS')
})

test('D2 (BUG-156 / T0851) Use existing: RemoteServer port / unpublished containers are listed disabled, untouched', async () => {
  test.setTimeout(WIZARD_TIMEOUT_MS + 120_000)
  const { win, remotePort } = inst!
  const cases = [
    { name: `${PREFIX}user-port`, publish: ['-p', `127.0.0.1:${remotePort}:9876`], reason: any(l => (l.wizard.docker.pickContainer.container.disabled.portInUse as string).split('{{')[0]) },
    { name: `${PREFIX}user-nopub`, publish: [] as string[], reason: any(l => (l.wizard.docker.pickContainer.container.disabled.unpublished as string).split('{{')[0]) },
  ]
  const before: Record<string, ReturnType<typeof inspectState>> = {}
  for (const c of cases) {
    created.add(c.name)
    docker(['create', '--name', c.name, '--label', LABEL, ...c.publish, IMAGE])
    before[c.name] = inspectState(c.name)
  }
  await openDockerWizard(win)
  const prompt = win.locator('#bat-wizard-active-prompt')
  await expect(prompt).toBeVisible({ timeout: 60_000 })
  await prompt.getByRole('button', { name: oneOf(USE_EXISTING) }).click()
  await expect(prompt.getByRole('button', { name: cases[0].name, exact: true })).toBeVisible({ timeout: 60_000 })
  await shot(win, 'd2-disabled')
  for (const c of cases) {
    const button = prompt.getByRole('button', { name: c.name, exact: true })
    const disabled = await button.isDisabled()
    const describedBy = await button.getAttribute('aria-describedby') ?? ''
    const reasonText = describedBy ? await win.locator(`[id="${describedBy.split(' ').pop()}"]`).innerText().catch(() => '') : ''
    log(`D2 ${c.name}: disabled ${disabled}; reason "${reasonText}"`)
    expect(disabled).toBe(true)
    expect(c.reason.some(r => reasonText.includes(r.trim()))).toBe(true)
  }
  await closeWizard(win)
  for (const c of cases) {
    expect(inspectState(c.name)).toEqual(before[c.name])
    const touched = shimEntries().filter(e => ['start', 'stop', 'rm', 'restart', 'run'].includes(e.args[0]) && e.args.includes(c.name))
    expect(touched.map(e => e.args.join(' ')), `D2 ${c.name}: start/stop/rm through the shim`).toEqual([])
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
  const outcome = await driveWizard(win, { choices: [...USE_EXISTING, name] })
  const statuses = await stepStatuses(win)
  log(`${tag}: wizard ${outcome.result}; picked ${JSON.stringify(outcome.picked)}; steps ${JSON.stringify(statuses)}; detail ${outcome.text.replace(/\s+/g, ' ').slice(0, 400)}`)
  await shot(win, `${tag.toLowerCase()}-failed`)
  expect(outcome.result).toBe('failed')
  // T0849: the token is read in start-server once the container runs; nothing serves it here.
  expect(statuses['start-server']).toBe('failed')
  const tokenTitles = any(l => l.wizard.docker.error.tokenUnavailable.title)
  expect(tokenTitles.some(t => outcome.text.includes(t)), `${tag}: token-unavailable error`).toBe(true)
  const during = inspectState(name)
  log(`${tag}: before Cancel container ${during.status} startedAt ${during.startedAt}`)
  expect(during.running).toBe(true)

  const rolled = await cancelAndWaitRollback(win, 'start-server')
  await expect.poll(() => inspectState(name).status, { timeout: 30_000 }).toBe(before.status).catch(() => { /* asserted below */ })
  const after = inspectState(name)
  const calls = shimEntries().slice(callsBefore).filter(e => e.args.includes(name)).map(e => `${e.args[0]}→${e.exit}`)
  const files = stopFirst
    ? docker(['cp', `${name}:/root/keep-root.txt`, '-']) + docker(['cp', `${name}:/data/keep.txt`, '-'])
    : docker(['exec', name, 'sh', '-c', 'cat /root/keep-root.txt /data/keep.txt'])
  log(`${tag}: after Cancel steps ${JSON.stringify(rolled)}`)
  log(`${tag}: container ${after.status} (id same ${after.id === before.id}, startedAt ${after.startedAt}); volume exists ${volumeExists(volume)}; files keep-root ${files.includes(`${tag}-keep-root`)} keep-volume ${files.includes(`${tag}-keep-volume`)}`)
  log(`${tag}: shim calls naming ${name}: ${calls.join(', ')}`)
  expect(rolled['start-server']).toBe('rolled-back')
  expect(after.id).toBe(before.id)
  expect(after.status).toBe(before.status)
  if (!stopFirst) expect(after.startedAt).toBe(before.startedAt) // never restarted
  expect(files).toContain(`${tag}-keep-root`)
  expect(files).toContain(`${tag}-keep-volume`)
  expect(volumeExists(volume)).toBe(true)
  expect(calls.some(c => c.startsWith('rm→') || c.startsWith('restart→'))).toBe(false)
  if (!stopFirst) expect(calls.some(c => c.startsWith('stop→'))).toBe(false) // `docker start` on a running container is a no-op (startedAt checked above)
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
  const outcome = await driveWizard(win, { choices: [...USE_EXISTING, name] })
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
