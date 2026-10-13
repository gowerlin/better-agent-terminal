#!/usr/bin/env node

/**
 * T0520 — environment for the opt-in pre.7 installed-build acceptance (e2e/pre7-acceptance.spec.ts).
 * Windows host only; Docker runs inside WSL, the ssh under test is Windows' built-in OpenSSH.
 * Modelled on t0514-env.mjs (T0514) and t0515-wizard-env.mjs (T0515), which are left unchanged;
 * everything here is `bat-t0520-*` and labelled `bat.t0520=1`.
 *
 *   node e2e/real-remote/t0520-env.mjs up                  # key, 2 images, 2 containers, connection.json
 *   node e2e/real-remote/t0520-env.mjs status
 *   node e2e/real-remote/t0520-env.mjs apply-ssh-config    # append the temporary block to ~/.ssh/config
 *   node e2e/real-remote/t0520-env.mjs restore-ssh-config  # put ~/.ssh/config back (hash-checked)
 *   node e2e/real-remote/t0520-env.mjs down [--rmi]        # restore-ssh-config + remove containers / state
 *
 * Containers (WSL Docker; no network / volume is created):
 *   bat-t0520-srv   the stock pre.7 headless bat-server from the installed BAT's
 *                   resources/bat-server-baseline linux-x64 tarball (no overlay), 0.0.0.0:9876 inside,
 *                   published as 127.0.0.1:<--server-port> (default 29520). /work and /home/bat carry
 *                   the e2e/fixtures/t0520-skill-fixtures.json files (V1 target, V6 remote scans).
 *   bat-t0520-sshd  sshd + systemd, account `bat`, published as 127.0.0.1:<--ssh-port> (default
 *                   22520). Nothing BAT-specific preinstalled: the SSH wizard installs the bundle (V2 / V3).
 *
 * Alias (marked block in the real ~/.ssh/config — Windows OpenSSH ignores USERPROFILE / HOME, same
 * reasoning as T0510 / T0515): `bat-t0520-direct` → 127.0.0.1:<ssh port>, User bat, pinned to this
 * run's key and a known_hosts file in the state directory. The real known_hosts / keys are never
 * read or written. `apply-ssh-config` copies the original aside (SHA-256 recorded);
 * `restore-ssh-config` puts it back and checks the hash, or — if the file was edited meanwhile —
 * cuts out only the marked block.
 *
 * Never touched: the user's BAT (9876), the user's WSL bat-server (9877, ~/.local/bat-server in
 * Ubuntu-24.04 itself), any container / image not named bat-t0520-* with label bat.t0520=1.
 *
 * Manual restore if the tooling was interrupted:
 *   Copy-Item "$env:TEMP\bat-t0520\ssh-config-backup\config" "$env:USERPROFILE\.ssh\config" -Force
 *   (or delete the lines between `# >>> bat-t0520 temporary (remove) >>>` and `# <<< bat-t0520 temporary <<<`)
 */

import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decodeTokenFile, normalizeFingerprint, parseFingerprintField } from '../../scripts/smoke-remote-headless.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))

export const LABEL = 'bat.t0520=1'
export const SERVER = 'bat-t0520-srv'
export const SERVER_IMAGE = 'bat-t0520-srv:local'
export const SSHD = 'bat-t0520-sshd'
export const SSHD_IMAGE = 'bat-t0520-sshd:local'
export const SSH_USER = 'bat'
export const ALIAS = 'bat-t0520-direct'
export const ROOT_DIR = path.join(os.tmpdir(), 'bat-t0520')
export const STATE_DIR = path.join(ROOT_DIR, 'env')
export const CONFIG_PATH = path.join(STATE_DIR, 'connection.json')
export const BACKUP_DIR = path.join(ROOT_DIR, 'ssh-config-backup')
const BACKUP_STATE = path.join(BACKUP_DIR, 'state.json')
export const USER_SSH_CONFIG = path.join(os.homedir(), '.ssh', 'config')
export const WINDOWS_SSH = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe'
const WINDOWS_SSH_KEYGEN = 'C:\\Windows\\System32\\OpenSSH\\ssh-keygen.exe'
const FIXTURES = path.resolve(here, '..', 'fixtures', 't0520-skill-fixtures.json')
/** Client-side (Windows) path of the docker-linux mount. Deliberately nonexistent on Windows. */
export const CLIENT_WORK = 'C:\\bat-t0520-virt\\work'
export const SERVER_WORK = '/work'
const SERVER_DATA_DIR = '/home/bat/.local/share/bat-server'
const BLOCK_BEGIN = '# >>> bat-t0520 temporary (remove) >>>'
const BLOCK_END = '# <<< bat-t0520 temporary <<<'
const NAME_RX = /^[A-Za-z0-9._-]+$/
const DEFAULT_DISTRO = 'Ubuntu-24.04'
const DEFAULT_SERVER_PORT = 29520
const DEFAULT_SSH_PORT = 22520
const DEFAULT_BASELINE_DIR = 'C:\\Program Files\\BetterAgentTerminal\\resources\\bat-server-baseline'
const USER_PORTS = new Set([9876, 9877])

function log(message) {
  console.log(`[t0520-env] ${message}`)
}

function run(file, args, { timeout = 60_000 } = {}) {
  return execFileSync(file, args, { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

function wsl(distro, args, opts) {
  if (!NAME_RX.test(distro)) throw new Error(`invalid WSL distro ${distro}`)
  return run('wsl.exe', ['-d', distro, '--exec', ...args], opts)
}

export function docker(distro, args, opts) {
  return wsl(distro, ['docker', ...args], opts)
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function parseArgs(argv) {
  const opts = { command: argv[0] ?? 'help', distro: DEFAULT_DISTRO, serverPort: DEFAULT_SERVER_PORT, sshPort: DEFAULT_SSH_PORT, baselineDir: DEFAULT_BASELINE_DIR, rmi: false }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--distro') opts.distro = argv[++i]
    else if (arg === '--server-port') opts.serverPort = Number(argv[++i])
    else if (arg === '--ssh-port') opts.sshPort = Number(argv[++i])
    else if (arg === '--baseline-dir') opts.baselineDir = argv[++i]
    else if (arg === '--rmi') opts.rmi = true
    else throw new Error(`unknown option ${arg}`)
  }
  if (!NAME_RX.test(opts.distro)) throw new Error(`invalid --distro ${opts.distro}`)
  for (const [name, port] of [['--server-port', opts.serverPort], ['--ssh-port', opts.sshPort]]) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || USER_PORTS.has(port)) throw new Error(`invalid ${name} ${port}`)
  }
  if (opts.serverPort === opts.sshPort) throw new Error('--server-port and --ssh-port must differ')
  return opts
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

async function waitFor(what, fn, timeoutMs = 60_000, intervalMs = 1000) {
  const end = Date.now() + timeoutMs
  let last
  while (Date.now() < end) {
    try {
      const v = await fn()
      if (v) return v
    } catch (err) {
      last = err
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`timed out waiting for ${what}${last ? `: ${last.message}` : ''}`)
}

/** `name status` of containers carrying our label (never anything else). */
function ownContainers(distro) {
  return docker(distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}} {{.Status}}']).split(/\r?\n/).filter(Boolean)
}

/** Removes one container by name, only when it carries our label. */
function removeOwnContainer(distro, name) {
  if (!name.startsWith('bat-t0520-')) throw new Error(`refusing to remove ${name}: not a bat-t0520- container`)
  const labelled = docker(distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim()
  if (labelled) {
    docker(distro, ['rm', '-f', name])
    log(`removed container ${name}`)
  } else if (docker(distro, ['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim()) {
    throw new Error(`a container named ${name} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
  }
}

function removeOwn(distro) {
  for (const name of [SERVER, SSHD]) removeOwnContainer(distro, name)
}

function ensureKeys() {
  const key = path.join(STATE_DIR, 'id_ed25519')
  if (!existsSync(key)) run(WINDOWS_SSH_KEYGEN, ['-q', '-t', 'ed25519', '-N', '', '-C', 'bat-t0520', '-f', key])
  return { key, pub: readFileSync(`${key}.pub`, 'utf8').trim() }
}

const fwd = (p) => p.replace(/\\/g, '/')

/** The block appended to ~/.ssh/config (also written to the state dir for `ssh -F` probes). */
export function sshConfigBlock({ keyPath, knownHosts, sshPort }) {
  return [
    BLOCK_BEGIN,
    '# Added by e2e/real-remote/t0520-env.mjs (T0520); undo: node e2e/real-remote/t0520-env.mjs restore-ssh-config',
    `Host ${ALIAS}`,
    '  HostName 127.0.0.1',
    `  Port ${sshPort}`,
    `  User ${SSH_USER}`,
    `  IdentityFile ${fwd(keyPath)}`,
    '  IdentitiesOnly yes',
    `  UserKnownHostsFile ${fwd(knownHosts)}`,
    '  StrictHostKeyChecking accept-new',
    BLOCK_END,
    '',
  ].join('\r\n')
}

function sshProbe(configFile, alias, command) {
  return new Promise((resolve) => {
    execFile(WINDOWS_SSH, ['-F', configFile, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '--', alias, command],
      { timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout).trim(), stderr: String(stderr).trim() }))
  })
}

function loadFixtures() {
  return JSON.parse(readFileSync(FIXTURES, 'utf8'))
}

/** Writes `files` ({ relative path: content }) under `dir`, byte for byte (CRLF kept). */
export function writeFixtureTree(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    if (rel.includes('..') || path.isAbsolute(rel)) throw new Error(`bad fixture path ${rel}`)
    const file = path.join(dir, ...rel.split('/'))
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(content, 'utf8'))
  }
}

function baselineTarball(dir) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  const file = manifest?.tarballs?.['linux-x64']?.filename
  if (!file || !existsSync(path.join(dir, file))) throw new Error(`no linux-x64 tarball listed in ${dir}\\manifest.json`)
  const tarball = path.join(dir, file)
  const actual = createHash('sha256').update(readFileSync(tarball)).digest('hex')
  return { tarball, file, version: manifest.version, sha256: manifest.tarballs['linux-x64'].sha256, sha256Actual: actual }
}

async function waitSystemd(distro, name) {
  await waitFor(`${name}: systemd + sshd up`, () => {
    const state = docker(distro, ['exec', name, 'sh', '-c', 'systemctl is-system-running 2>/dev/null; systemctl is-active ssh 2>/dev/null; true'])
    return /^(running|degraded)\s+active/m.test(state.trim())
  }, 90_000)
}

async function upServer(opts, base) {
  const ctx = path.join(STATE_DIR, 'server-context')
  rmSync(ctx, { recursive: true, force: true })
  mkdirSync(ctx, { recursive: true })
  copyFileSync(path.join(here, 't0520-server.Dockerfile'), path.join(ctx, 'Dockerfile'))
  copyFileSync(base.tarball, path.join(ctx, 'bat-server.tar.gz'))
  const fixtures = loadFixtures()
  writeFixtureTree(path.join(ctx, 'fixture-work'), fixtures.project)
  writeFixtureTree(path.join(ctx, 'fixture-home'), fixtures.home)
  const ctxPosix = wsl(opts.distro, ['wslpath', '-a', ctx]).trim()
  log(`docker build ${SERVER_IMAGE} from ${base.file} (manifest version ${base.version}, sha256 ${base.sha256.slice(0, 16)}…)`)
  docker(opts.distro, ['build', '-q', '--label', LABEL, '-t', SERVER_IMAGE, ctxPosix], { timeout: 900_000 })
  rmSync(ctx, { recursive: true, force: true })

  const id = docker(opts.distro, [
    'run', '-d', '--name', SERVER, '--label', LABEL, '--hostname', SERVER,
    '-p', `127.0.0.1:${opts.serverPort}:9876`, SERVER_IMAGE,
  ]).trim()
  log(`container ${SERVER} ${id.slice(0, 12)} → 127.0.0.1:${opts.serverPort}`)
  await waitFor('bat-server certificate + token', () =>
    docker(opts.distro, ['exec', SERVER, 'sh', '-c', `test -s ${SERVER_DATA_DIR}/server-cert.json && test -s ${SERVER_DATA_DIR}/server-token.json && echo ready`]).includes('ready'))
  const fingerprint = normalizeFingerprint(parseFingerprintField(docker(opts.distro, ['exec', SERVER, 'grep', '-o', '-E', '"fingerprint"[[:space:]]*:[[:space:]]*"[0-9A-Fa-f:]+"', `${SERVER_DATA_DIR}/server-cert.json`])))
  const token = decodeTokenFile(docker(opts.distro, ['exec', SERVER, 'cat', `${SERVER_DATA_DIR}/server-token.json`]))
  await waitFor(`127.0.0.1:${opts.serverPort} accepting connections from Windows`, () => new Promise((resolve) => {
    const s = net.connect(opts.serverPort, '127.0.0.1', () => { s.destroy(); resolve(true) })
    s.once('error', () => resolve(false))
  }))
  const bundleVersion = docker(opts.distro, ['exec', SERVER, 'sh', '-c', 'cat /home/bat/.local/bat-server/package.json']).match(/"version"\s*:\s*"([^"]+)"/)?.[1] ?? 'unknown'
  return { container: SERVER, hostname: SERVER, host: '127.0.0.1', port: opts.serverPort, token, fingerprint, bundleVersion }
}

async function upSshd(opts) {
  const { key, pub } = ensureKeys()
  const knownHosts = path.join(STATE_DIR, 'known_hosts')
  rmSync(knownHosts, { force: true })
  const ctx = path.join(STATE_DIR, 'sshd-context')
  rmSync(ctx, { recursive: true, force: true })
  mkdirSync(ctx, { recursive: true })
  copyFileSync(path.join(here, 't0520-sshd.Dockerfile'), path.join(ctx, 'Dockerfile'))
  writeFileSync(path.join(ctx, 'authorized_keys'), `${pub}\n`)
  const ctxPosix = wsl(opts.distro, ['wslpath', '-a', ctx]).trim()
  log(`docker build ${SSHD_IMAGE}`)
  docker(opts.distro, ['build', '-q', '--label', LABEL, '-t', SSHD_IMAGE, ctxPosix], { timeout: 900_000 })
  rmSync(ctx, { recursive: true, force: true })
  docker(opts.distro, ['run', '-d', '--label', LABEL, '--privileged', '--cgroupns=private', '--tmpfs', '/run', '--tmpfs', '/run/lock',
    '--name', SSHD, '--hostname', SSHD, '-p', `127.0.0.1:${opts.sshPort}:22`, SSHD_IMAGE])
  await waitSystemd(opts.distro, SSHD)
  const probeConfig = path.join(STATE_DIR, 'ssh_config.probe')
  writeFileSync(probeConfig, sshConfigBlock({ keyPath: key, knownHosts, sshPort: opts.sshPort }))
  const r = await waitFor(`ssh ${ALIAS}`, async () => {
    const p = await sshProbe(probeConfig, ALIAS, 'echo "$(id -un)@$(uname -n)"')
    if (!p.ok) throw new Error(p.stderr.split(/\r?\n/).pop())
    return p
  }, 30_000, 2_000)
  log(`probe ${ALIAS} (Windows OpenSSH, -F probe copy): ${r.stdout}`)
  if (r.stdout !== `${SSH_USER}@${SSHD}`) throw new Error(`unexpected probe answer ${r.stdout}`)
  return { container: SSHD, sshPort: opts.sshPort, sshUser: SSH_USER, alias: ALIAS, keyPath: key, knownHosts, probe: r.stdout }
}

async function up(opts) {
  if (process.platform !== 'win32') throw new Error('Windows host only (WSL Docker + Windows OpenSSH)')
  if (!existsSync(WINDOWS_SSH)) throw new Error(`Windows OpenSSH client not found at ${WINDOWS_SSH}`)
  if (existsSync(BACKUP_STATE)) throw new Error(`~/.ssh/config still has the temporary block (${BACKUP_STATE}) — run restore-ssh-config first`)
  log(`docker engine in ${opts.distro}: ${docker(opts.distro, ['version', '--format', '{{.Server.Version}}']).trim()}`)
  removeOwn(opts.distro)
  for (const port of [opts.serverPort, opts.sshPort]) await waitFor(`127.0.0.1:${port} to be free`, () => portFree(port), 15_000)
  mkdirSync(STATE_DIR, { recursive: true })
  const base = baselineTarball(opts.baselineDir)
  if (base.sha256Actual !== base.sha256) throw new Error(`baseline ${base.file}: sha256 ${base.sha256Actual} ≠ manifest ${base.sha256}`)
  const server = await upServer(opts, base)
  log(`bat-server ${server.bundleVersion} at 127.0.0.1:${server.port} fp=${server.fingerprint.slice(0, 23)}…`)
  const ssh = await upSshd(opts)
  const config = {
    createdBy: 'T0520 t0520-env.mjs',
    distro: opts.distro,
    baseline: { dir: opts.baselineDir, file: base.tarball, version: base.version, sha256: base.sha256, sha256Verified: true },
    server: { ...server, clientWork: CLIENT_WORK, serverWork: SERVER_WORK },
    ssh: { ...ssh, sshExe: WINDOWS_SSH },
    windowsUser: os.userInfo().username,
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  log(`wrote ${CONFIG_PATH}`)
  log("run: $env:BAT_E2E_PRE7='1'; $env:BAT_E2E_EXECUTABLE='C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe'; npx playwright test e2e/pre7-acceptance.spec.ts")
}

function loadConnection() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`${CONFIG_PATH} missing — run \`up\` first`)
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
}

/** Appends the marked block to ~/.ssh/config after copying the original aside. */
export function applySshConfig() {
  const conn = loadConnection()
  if (existsSync(BACKUP_STATE)) throw new Error(`a previous temporary block was not restored (${BACKUP_STATE}) — run restore-ssh-config first`)
  mkdirSync(BACKUP_DIR, { recursive: true })
  const existed = existsSync(USER_SSH_CONFIG)
  const original = existed ? readFileSync(USER_SSH_CONFIG) : Buffer.alloc(0)
  const before = existed ? sha256(USER_SSH_CONFIG) : null
  if (existed) copyFileSync(USER_SSH_CONFIG, path.join(BACKUP_DIR, 'config'))
  const sep = original.length > 0 && !original.toString('utf8').endsWith('\n') ? '\r\n' : ''
  const block = sshConfigBlock({ keyPath: conn.ssh.keyPath, knownHosts: conn.ssh.knownHosts, sshPort: conn.ssh.sshPort })
  const state = { existed, sha256Before: before, appendedAt: new Date().toISOString(), sha256After: null }
  writeFileSync(BACKUP_STATE, JSON.stringify(state, null, 2))
  if (!existed) mkdirSync(path.dirname(USER_SSH_CONFIG), { recursive: true })
  writeFileSync(USER_SSH_CONFIG, Buffer.concat([original, Buffer.from(sep + block, 'utf8')]))
  state.sha256After = sha256(USER_SSH_CONFIG)
  writeFileSync(BACKUP_STATE, JSON.stringify(state, null, 2))
  log(`~/.ssh/config: ${existed ? `backed up (sha256 ${before})` : 'did not exist'} → block appended (sha256 ${state.sha256After}); backup ${BACKUP_DIR}`)
  return state
}

/** Puts ~/.ssh/config back; verifies the hash against the backup. Safe to call when nothing was applied. */
export function restoreSshConfig() {
  if (!existsSync(BACKUP_STATE)) {
    log('~/.ssh/config: no temporary block recorded — nothing to restore')
    return { restored: false }
  }
  const state = JSON.parse(readFileSync(BACKUP_STATE, 'utf8'))
  const current = existsSync(USER_SSH_CONFIG) ? sha256(USER_SSH_CONFIG) : null
  let how
  let edited = false
  if (current === state.sha256After || current === null) {
    if (state.existed) copyFileSync(path.join(BACKUP_DIR, 'config'), USER_SSH_CONFIG)
    else rmSync(USER_SSH_CONFIG, { force: true })
    how = state.existed ? 'backup copied back' : 'file removed (it did not exist before)'
  } else {
    // Edited while the block was in place (another tool or the user): cut out only our block.
    edited = true
    const text = readFileSync(USER_SSH_CONFIG, 'utf8')
    const start = text.indexOf(BLOCK_BEGIN)
    const end = text.indexOf(BLOCK_END)
    if (start < 0 || end < start) throw new Error('~/.ssh/config changed and the temporary block markers are gone — restore by hand')
    let tail = end + BLOCK_END.length
    while (text[tail] === '\r' || text[tail] === '\n') tail++
    writeFileSync(USER_SSH_CONFIG, text.slice(0, start) + text.slice(tail))
    how = 'file was edited meanwhile — only the marked block was removed'
  }
  const after = existsSync(USER_SSH_CONFIG) ? sha256(USER_SSH_CONFIG) : null
  const matches = after === state.sha256Before
  log(`~/.ssh/config restored (${how}): sha256 before=${state.sha256Before} after-restore=${after} match=${matches}`)
  if (!matches && !edited) {
    throw new Error(`restored ~/.ssh/config hash ${after} does not match the backup ${state.sha256Before}`)
  }
  rmSync(BACKUP_DIR, { recursive: true, force: true })
  return { restored: true, how, sha256Before: state.sha256Before, sha256After: state.sha256After, sha256Restored: after, matches }
}

function status(opts) {
  const own = ownContainers(opts.distro)
  log(`containers (${LABEL}): ${own.length ? own.join('; ') : 'none'}`)
  log(`state ${STATE_DIR}: ${existsSync(STATE_DIR) ? 'present' : 'absent'}; ~/.ssh/config temporary block: ${existsSync(BACKUP_STATE) ? 'APPLIED (run restore-ssh-config)' : 'not applied'}`)
}

function down(opts) {
  restoreSshConfig()
  removeOwn(opts.distro)
  const images = [SERVER_IMAGE, SSHD_IMAGE]
  if (opts.rmi) {
    for (const image of images) {
      if (docker(opts.distro, ['images', '-q', '--filter', `label=${LABEL}`, '--filter', `reference=${image}`]).trim()) {
        docker(opts.distro, ['rmi', image])
        log(`removed image ${image}`)
      }
    }
  } else {
    log(`images kept for reruns (--rmi removes them): ${docker(opts.distro, ['images', '--filter', `label=${LABEL}`, '--format', '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}']).trim().replace(/\r?\n/g, '; ') || 'none'}`)
  }
  rmSync(STATE_DIR, { recursive: true, force: true })
  log(`state dir ${STATE_DIR} removed: ${!existsSync(STATE_DIR)}; ${ROOT_DIR} now holds: ${existsSync(ROOT_DIR) ? readdirSync(ROOT_DIR).join(', ') || '(empty)' : '(absent)'}`)
  log(`containers left with ${LABEL}: ${docker(opts.distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}}']).trim() || 'none'}`)
  log(`networks left with ${LABEL}: ${docker(opts.distro, ['network', 'ls', '--filter', `label=${LABEL}`, '--format', '{{.Name}}']).trim() || 'none'}`)
  log(`volumes left with ${LABEL}: ${docker(opts.distro, ['volume', 'ls', '--filter', `label=${LABEL}`, '--format', '{{.Name}}']).trim() || 'none'}`)
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.command === 'up') await up(opts)
  else if (opts.command === 'down') down(opts)
  else if (opts.command === 'status') status(opts)
  else if (opts.command === 'apply-ssh-config') applySshConfig()
  else if (opts.command === 'restore-ssh-config') restoreSshConfig()
  else {
    console.log('Usage: node e2e/real-remote/t0520-env.mjs <up|status|apply-ssh-config|restore-ssh-config|down> [--distro Ubuntu-24.04] [--server-port 29520] [--ssh-port 22520] [--baseline-dir <dir>] [--rmi]')
    return opts.command === 'help' ? 0 : 1
  }
  return 0
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code }, (err) => {
    console.error(`[t0520-env] ERROR ${err instanceof Error ? err.message : String(err)}`)
    if (err?.stderr) console.error(String(err.stderr).trim())
    process.exitCode = 1
  })
}
