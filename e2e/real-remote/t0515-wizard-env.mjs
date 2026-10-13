#!/usr/bin/env node

/**
 * T0515 — environment for the opt-in pre.6 setup-wizard acceptance (e2e/pre6-wizard-acceptance.spec.ts).
 * Windows host only; the ssh under test is Windows' built-in OpenSSH. Modelled on
 * t0510-ssh-alias-env.mjs (T0510), which is left unchanged; everything here is `bat-t0515-*`.
 *
 *   node e2e/real-remote/t0515-wizard-env.mjs up                  # key, image, network, 2 containers, connection.json
 *   node e2e/real-remote/t0515-wizard-env.mjs status
 *   node e2e/real-remote/t0515-wizard-env.mjs apply-ssh-config    # append the temporary block to ~/.ssh/config
 *   node e2e/real-remote/t0515-wizard-env.mjs restore-ssh-config  # put ~/.ssh/config back (hash-checked)
 *   node e2e/real-remote/t0515-wizard-env.mjs docker-check        # W9 image-level lane (see below), prints JSON
 *   node e2e/real-remote/t0515-wizard-env.mjs down [--rmi]        # restore-ssh-config + remove containers / network / volumes / state
 *
 * Topology (WSL Docker, everything named `bat-t0515-*` and labelled `bat.t0515=1`):
 *   bat-t0515-jump    sshd + systemd, network bat-t0515-net, published on 127.0.0.1:<--ssh-port>
 *                     (default 22515); account `bat`
 *   bat-t0515-target  sshd + systemd, network bat-t0515-net only — Windows can neither route to it
 *                     nor resolve its name. Accounts `bat` and one named like the user `ssh -G`
 *                     resolves for an alias without `User` (the Windows login), for W10
 *
 * Aliases (marked block in the real ~/.ssh/config, same reasoning as T0510: Windows OpenSSH
 * ignores USERPROFILE / HOME, so an isolated config is impossible):
 *   bat-t0515-direct     HostName 127.0.0.1 + Port + User bat           → jump
 *   bat-t0515-nouser-pj  HostName bat-t0515-target + ProxyJump, no User → target as the Windows login
 * Every alias is pinned to this run's key and a known_hosts file in the state directory; the
 * real known_hosts / keys are never read or written. `apply-ssh-config` copies the original
 * aside (SHA-256 recorded); `restore-ssh-config` puts it back and checks the hash, or — if the
 * file was edited meanwhile — cuts out only the marked block.
 *
 * docker-check (W9, BUG-097, image level only): the pre.6 desktop Docker wizard drives the
 * Windows `docker` CLI, which has no engine on this host (Docker Desktop is not running; the
 * engine lives inside WSL). This lane therefore checks what the fix put into the image and the
 * `docker run` arguments, without the wizard: it builds docker/Dockerfile with the pre.6 bundle
 * (`bat-t0515-docker-server:local`), runs `bat-t0515-dockersrv` with the exact arguments
 * electron/docker-lifecycle.ts uses (`-p 127.0.0.1:<port>:9876`, data volume, `--port 9876
 * --token`), waits for HEALTHCHECK, reads `docker port` / the in-container listener, does a TLS
 * handshake from Windows, then removes the container and its volume.
 *
 * Manual restore if the tooling was interrupted:
 *   Copy-Item "$env:TEMP\bat-t0515\ssh-config-backup\config" "$env:USERPROFILE\.ssh\config" -Force
 *   (or delete the lines between `# >>> bat-t0515 temporary (remove) >>>` and `# <<< bat-t0515 temporary <<<`)
 */

import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')

export const LABEL = 'bat.t0515=1'
export const IMAGE = 'bat-t0515-sshd:local'
export const DOCKER_SERVER_IMAGE = 'bat-t0515-docker-server:local'
export const NETWORK = 'bat-t0515-net'
export const JUMP = 'bat-t0515-jump'
export const TARGET = 'bat-t0515-target'
export const DOCKER_SERVER = 'bat-t0515-dockersrv'
export const DOCKER_SERVER_VOLUME = 'bat-t0515-dockersrv-data'
export const SSH_USER = 'bat'
export const ROOT_DIR = path.join(os.tmpdir(), 'bat-t0515')
export const STATE_DIR = path.join(ROOT_DIR, 'ssh-env')
export const CONFIG_PATH = path.join(STATE_DIR, 'connection.json')
export const BACKUP_DIR = path.join(ROOT_DIR, 'ssh-config-backup')
const BACKUP_STATE = path.join(BACKUP_DIR, 'state.json')
export const USER_SSH_CONFIG = path.join(os.homedir(), '.ssh', 'config')
export const WINDOWS_SSH = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe'
const WINDOWS_SSH_KEYGEN = 'C:\\Windows\\System32\\OpenSSH\\ssh-keygen.exe'
const INSTALLED_BASELINE = 'C:\\Program Files\\BetterAgentTerminal\\resources\\bat-server-baseline'
const BLOCK_BEGIN = '# >>> bat-t0515 temporary (remove) >>>'
const BLOCK_END = '# <<< bat-t0515 temporary <<<'
const NAME_RX = /^[A-Za-z0-9._-]+$/
const DEFAULT_DISTRO = 'Ubuntu-24.04'
const DEFAULT_SSH_PORT = 22515

export const ALIASES = {
  direct: 'bat-t0515-direct', // HostName + Port + User + IdentityFile (→ jump)
  noUserProxyJump: 'bat-t0515-nouser-pj', // no User, ProxyJump bat-t0515-direct (→ target)
}

function log(message) {
  console.log(`[t0515-env] ${message}`)
}

function run(file, args, { timeout = 60_000, input } = {}) {
  return execFileSync(file, args, {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  })
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
  const opts = { command: argv[0] ?? 'help', distro: DEFAULT_DISTRO, sshPort: DEFAULT_SSH_PORT, rmi: false }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--distro') opts.distro = argv[++i]
    else if (arg === '--ssh-port') opts.sshPort = Number(argv[++i])
    else if (arg === '--rmi') opts.rmi = true
    else throw new Error(`unknown option ${arg}`)
  }
  if (!NAME_RX.test(opts.distro)) throw new Error(`invalid --distro ${opts.distro}`)
  if (!Number.isInteger(opts.sshPort) || opts.sshPort < 1024 || opts.sshPort > 65535) throw new Error(`invalid --ssh-port ${opts.sshPort}`)
  return opts
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

async function freePort() {
  for (;;) {
    const port = await new Promise((resolve, reject) => {
      const srv = net.createServer()
      srv.once('error', reject)
      srv.listen(0, '127.0.0.1', () => {
        const p = srv.address().port
        srv.close(() => resolve(p))
      })
    })
    if (port >= 1024 && port !== 9876 && port !== 9877) return port
  }
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
  const labelled = docker(distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim()
  if (labelled) {
    docker(distro, ['rm', '-f', name])
    log(`removed container ${name}`)
  } else if (docker(distro, ['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim()) {
    throw new Error(`a container named ${name} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
  }
}

function removeOwnVolume(distro, name) {
  const vols = docker(distro, ['volume', 'ls', '--filter', `name=^${name}$`, '--format', '{{.Name}} {{.Labels}}']).split(/\r?\n/).filter(Boolean)
  for (const line of vols) {
    if (!line.includes('bat.t0515=1')) throw new Error(`volume ${name} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
    docker(distro, ['volume', 'rm', name])
    log(`removed volume ${name}`)
  }
}

function removeOwn(distro) {
  for (const name of [JUMP, TARGET, DOCKER_SERVER]) removeOwnContainer(distro, name)
  removeOwnVolume(distro, DOCKER_SERVER_VOLUME)
  const nets = docker(distro, ['network', 'ls', '--filter', `name=^${NETWORK}$`, '--format', '{{.ID}} {{.Labels}}']).split(/\r?\n/).filter(Boolean)
  for (const line of nets) {
    if (!line.includes('bat.t0515=1')) throw new Error(`network ${NETWORK} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
    docker(distro, ['network', 'rm', NETWORK])
    log(`removed network ${NETWORK}`)
  }
}

function ensureKeys() {
  const key = path.join(STATE_DIR, 'id_ed25519')
  if (!existsSync(key)) run(WINDOWS_SSH_KEYGEN, ['-q', '-t', 'ed25519', '-N', '', '-C', 'bat-t0515', '-f', key])
  return { key, pub: readFileSync(`${key}.pub`, 'utf8').trim() }
}

const fwd = (p) => p.replace(/\\/g, '/')

/** The block appended to ~/.ssh/config (also written to the state dir for `ssh -F` probes). */
export function sshConfigBlock({ keyPath, knownHosts, sshPort }) {
  const pin = [
    `  IdentityFile ${fwd(keyPath)}`,
    '  IdentitiesOnly yes',
    `  UserKnownHostsFile ${fwd(knownHosts)}`,
    '  StrictHostKeyChecking accept-new',
  ]
  return [
    BLOCK_BEGIN,
    '# Added by e2e/real-remote/t0515-wizard-env.mjs (T0515); undo: node e2e/real-remote/t0515-wizard-env.mjs restore-ssh-config',
    `Host ${ALIASES.direct}`, '  HostName 127.0.0.1', `  Port ${sshPort}`, `  User ${SSH_USER}`, ...pin,
    `Host ${ALIASES.noUserProxyJump}`, `  HostName ${TARGET}`, `  ProxyJump ${ALIASES.direct}`, ...pin,
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

/** The user Windows OpenSSH sends for an alias without `User` (from `ssh -G`). */
function resolvedUser(configFile, alias) {
  const out = run(WINDOWS_SSH, ['-F', configFile, '-G', alias], { timeout: 15_000 })
  const line = out.split(/\r?\n/).find(l => l.startsWith('user '))
  return line ? line.slice('user '.length).trim() : ''
}

async function waitSystemd(distro, name) {
  await waitFor(`${name}: systemd + sshd up`, () => {
    const state = docker(distro, ['exec', name, 'sh', '-c', 'systemctl is-system-running 2>/dev/null; systemctl is-active ssh 2>/dev/null; true'])
    return /^(running|degraded)\s+active/m.test(state.trim())
  }, 90_000)
}

async function up(opts) {
  if (process.platform !== 'win32') throw new Error('Windows host only (WSL Docker + Windows OpenSSH)')
  if (!existsSync(WINDOWS_SSH)) throw new Error(`Windows OpenSSH client not found at ${WINDOWS_SSH}`)
  log(`docker engine in ${opts.distro}: ${docker(opts.distro, ['version', '--format', '{{.Server.Version}}']).trim()}`)
  removeOwn(opts.distro)
  await waitFor(`127.0.0.1:${opts.sshPort} to be free`, () => portFree(opts.sshPort), 15_000)

  mkdirSync(STATE_DIR, { recursive: true })
  const { key, pub } = ensureKeys()
  const knownHosts = path.join(STATE_DIR, 'known_hosts')
  rmSync(knownHosts, { force: true })
  const ctx = path.join(STATE_DIR, 'context')
  rmSync(ctx, { recursive: true, force: true })
  mkdirSync(ctx, { recursive: true })
  copyFileSync(path.join(here, 't0515-sshd.Dockerfile'), path.join(ctx, 'Dockerfile'))
  writeFileSync(path.join(ctx, 'authorized_keys'), `${pub}\n`)
  const ctxPosix = wsl(opts.distro, ['wslpath', '-a', ctx]).trim()
  log(`docker build ${IMAGE} (context ${ctxPosix})`)
  docker(opts.distro, ['build', '-q', '--label', LABEL, '-t', IMAGE, ctxPosix], { timeout: 900_000 })

  docker(opts.distro, ['network', 'create', '--label', LABEL, NETWORK])
  const systemdRun = ['run', '-d', '--label', LABEL, '--privileged', '--cgroupns=private', '--tmpfs', '/run', '--tmpfs', '/run/lock', '--network', NETWORK]
  docker(opts.distro, [...systemdRun, '--name', TARGET, '--hostname', TARGET, IMAGE])
  docker(opts.distro, [...systemdRun, '--name', JUMP, '--hostname', JUMP, '-p', `127.0.0.1:${opts.sshPort}:22`, IMAGE])
  await waitSystemd(opts.distro, TARGET)
  await waitSystemd(opts.distro, JUMP)
  const targetIp = docker(opts.distro, ['inspect', '-f', `{{(index .NetworkSettings.Networks "${NETWORK}").IPAddress}}`, TARGET]).trim()
  const jumpIp = docker(opts.distro, ['inspect', '-f', `{{(index .NetworkSettings.Networks "${NETWORK}").IPAddress}}`, JUMP]).trim()
  log(`containers up: ${JUMP} (${jumpIp}, 127.0.0.1:${opts.sshPort}) / ${TARGET} (${targetIp}, private network only)`)

  const probeConfig = path.join(STATE_DIR, 'ssh_config.probe')
  writeFileSync(probeConfig, sshConfigBlock({ keyPath: key, knownHosts, sshPort: opts.sshPort }))

  // W10: the account for the alias without `User` is whatever Windows OpenSSH sends.
  const noUser = resolvedUser(probeConfig, ALIASES.noUserProxyJump)
  if (!NAME_RX.test(noUser) || noUser.startsWith('-') || noUser === SSH_USER) throw new Error(`unexpected user for ${ALIASES.noUserProxyJump}: ${JSON.stringify(noUser)}`)
  // Debian's useradd refuses upper-case names without --badname; the name is whitelisted above.
  docker(opts.distro, ['exec', TARGET, 'sh', '-c', [
    `useradd -m -s /bin/bash --badname '${noUser}'`,
    `install -d -m 0700 -o '${noUser}' -g '${noUser}' '/home/${noUser}/.ssh'`,
    `install -m 0600 -o '${noUser}' -g '${noUser}' /etc/bat-t0515-authorized_keys '/home/${noUser}/.ssh/authorized_keys'`,
    `id '${noUser}'`,
  ].join(' && ')])
  log(`${TARGET}: added account "${noUser}" (the user ssh -G resolves for ${ALIASES.noUserProxyJump})`)

  const probes = {}
  for (const [name, alias] of Object.entries(ALIASES)) {
    const r = await sshProbe(probeConfig, alias, 'echo "$(id -un)@$(uname -n)"')
    probes[name] = r.ok ? r.stdout : `FAILED: ${r.stderr.split(/\r?\n/).pop()}`
    log(`probe ${alias} (Windows OpenSSH, -F probe copy): ${probes[name]}`)
  }
  if (probes.direct !== `${SSH_USER}@${JUMP}` || probes.noUserProxyJump !== `${noUser}@${TARGET}`) {
    throw new Error(`alias probes failed: ${JSON.stringify(probes)}`)
  }

  const config = {
    createdBy: 'T0515 t0515-wizard-env.mjs',
    distro: opts.distro,
    sshExe: WINDOWS_SSH,
    sshPort: opts.sshPort,
    sshUser: SSH_USER,
    noUser,
    keyPath: key,
    knownHosts,
    aliases: ALIASES,
    containers: { jump: { name: JUMP, ip: jumpIp }, target: { name: TARGET, ip: targetIp } },
    windowsUser: os.userInfo().username,
    probes,
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  log(`wrote ${CONFIG_PATH}`)
  log('run: $env:BAT_E2E_PRE6_WIZARD=1; $env:BAT_E2E_EXECUTABLE=\'C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe\'; npx playwright test e2e/pre6-wizard-acceptance.spec.ts')
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
  const block = sshConfigBlock({ keyPath: conn.keyPath, knownHosts: conn.knownHosts, sshPort: conn.sshPort })
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

/** TLS handshake from Windows; returns the peer certificate's SHA-256 fingerprint. */
function tlsFingerprint(port) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: '127.0.0.1', port, rejectUnauthorized: false, timeout: 5_000 }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      resolve(cert?.fingerprint256 ?? '')
    })
    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')) })
    socket.on('error', reject)
  })
}

/** W9 image-level lane (see the header). Prints one JSON object. */
async function dockerCheck(opts) {
  const out = { lane: 'docker-image', distro: opts.distro }
  const baselineManifest = JSON.parse(readFileSync(path.join(INSTALLED_BASELINE, 'manifest.json'), 'utf8'))
  const tarball = readdirSync(INSTALLED_BASELINE).find(f => /^bat-server-linux-x64-.*\.tar\.gz$/.test(f))
  if (!tarball) throw new Error(`no linux-x64 tarball in ${INSTALLED_BASELINE}`)
  out.bundle = { source: path.join(INSTALLED_BASELINE, tarball), manifestVersion: baselineManifest.version }

  const ctx = path.join(ROOT_DIR, 'docker-context')
  rmSync(ctx, { recursive: true, force: true })
  mkdirSync(path.join(ctx, 'dist-server'), { recursive: true })
  copyFileSync(path.join(repoRoot, 'docker', 'Dockerfile'), path.join(ctx, 'Dockerfile'))
  copyFileSync(path.join(INSTALLED_BASELINE, tarball), path.join(ctx, 'dist-server', tarball))
  const ctxPosix = wsl(opts.distro, ['wslpath', '-a', ctx]).trim()
  log(`docker build ${DOCKER_SERVER_IMAGE} from docker/Dockerfile + ${tarball}`)
  docker(opts.distro, ['build', '-q', '--label', LABEL, '-t', DOCKER_SERVER_IMAGE, ctxPosix], { timeout: 900_000 })
  rmSync(ctx, { recursive: true, force: true })
  out.healthcheck = docker(opts.distro, ['inspect', '-f', '{{json .Config.Healthcheck}}', DOCKER_SERVER_IMAGE]).trim()
  out.entrypoint = docker(opts.distro, ['inspect', '-f', '{{json .Config.Entrypoint}}', DOCKER_SERVER_IMAGE]).trim()

  removeOwnContainer(opts.distro, DOCKER_SERVER)
  removeOwnVolume(opts.distro, DOCKER_SERVER_VOLUME)
  docker(opts.distro, ['volume', 'create', '--label', LABEL, DOCKER_SERVER_VOLUME])
  const port = await freePort()
  const token = createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 32)
  // The arguments of electron/docker-lifecycle.ts startContainer({ createIfMissing }) + our label.
  const runArgs = ['run', '-d', '--label', LABEL, '--name', DOCKER_SERVER, '--restart', 'unless-stopped',
    '-p', `127.0.0.1:${port}:9876`, '-v', `${DOCKER_SERVER_VOLUME}:/root/.local/share/bat-server`,
    DOCKER_SERVER_IMAGE, '--port', '9876', '--token', token]
  out.runArgs = runArgs.join(' ').replace(token, '<token>')
  try {
    docker(opts.distro, runArgs)
    const started = Date.now()
    out.health = await waitFor('container health', () => {
      const h = docker(opts.distro, ['inspect', '-f', '{{.State.Health.Status}}', DOCKER_SERVER]).trim()
      if (h === 'unhealthy') throw new Error('unhealthy')
      return h === 'healthy' ? h : ''
    }, 90_000, 2_000).catch(err => `NOT healthy: ${err.message}`)
    out.healthAfterMs = Date.now() - started
    out.healthLog = docker(opts.distro, ['inspect', '-f', '{{range .State.Health.Log}}{{.ExitCode}} {{end}}', DOCKER_SERVER]).trim()
    out.dockerPort = docker(opts.distro, ['port', DOCKER_SERVER]).trim()
    out.hostConfigPortBindings = docker(opts.distro, ['inspect', '-f', '{{json .HostConfig.PortBindings}}', DOCKER_SERVER]).trim()
    // bat-server is node; /proc/net/tcp shows the bind address (0100007F = 127.0.0.1, 00000000 = all).
    out.containerListen = docker(opts.distro, ['exec', DOCKER_SERVER, 'sh', '-c',
      'awk \'NR>1 && $4=="0A" {print $2}\' /proc/net/tcp /proc/net/tcp6']).trim().split(/\s+/)
    const fpFile = docker(opts.distro, ['exec', DOCKER_SERVER, 'sh', '-c',
      'sed -n \'s/^.*"fingerprint"[[:space:]]*:[[:space:]]*"\\([0-9A-Fa-f:]*\\)".*$/\\1/p\' /root/.local/share/bat-server/server-cert.json']).trim()
    out.certFingerprint = fpFile
    out.tlsFromWindows = await tlsFingerprint(port).then(fp => ({ ok: true, fingerprint: fp, matchesCert: fp.toUpperCase() === fpFile.toUpperCase() }), err => ({ ok: false, error: err.message }))
    // A non-loopback WSL address must not reach the published port.
    const wslIp = wsl(opts.distro, ['sh', '-c', 'hostname -I']).trim().split(/\s+/)[0]
    out.wslIp = wslIp
    out.fromWslIp = wsl(opts.distro, ['sh', '-c', `timeout 5 bash -c 'exec 3<>/dev/tcp/${wslIp}/${port}' && echo open || echo refused`]).trim()
    out.fromWslLoopback = wsl(opts.distro, ['sh', '-c', `timeout 5 bash -c 'exec 3<>/dev/tcp/127.0.0.1/${port}' && echo open || echo refused`]).trim()
  } finally {
    removeOwnContainer(opts.distro, DOCKER_SERVER)
    removeOwnVolume(opts.distro, DOCKER_SERVER_VOLUME)
  }
  console.log(`T0515_DOCKER_CHECK ${JSON.stringify(out)}`)
}

function status(opts) {
  const own = ownContainers(opts.distro)
  log(`containers (${LABEL}): ${own.length ? own.join('; ') : 'none'}`)
  log(`state ${STATE_DIR}: ${existsSync(STATE_DIR) ? 'present' : 'absent'}; ~/.ssh/config temporary block: ${existsSync(BACKUP_STATE) ? 'APPLIED (run restore-ssh-config)' : 'not applied'}`)
}

function down(opts) {
  restoreSshConfig()
  removeOwn(opts.distro)
  const images = [IMAGE, DOCKER_SERVER_IMAGE]
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
  log(`state dir ${STATE_DIR} removed: ${!existsSync(STATE_DIR)}`)
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
  else if (opts.command === 'docker-check') await dockerCheck(opts)
  else {
    console.log('Usage: node e2e/real-remote/t0515-wizard-env.mjs <up|status|apply-ssh-config|restore-ssh-config|docker-check|down> [--distro Ubuntu-24.04] [--ssh-port 22515] [--rmi]')
    return opts.command === 'help' ? 0 : 1
  }
  return 0
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code }, (err) => {
    console.error(`[t0515-env] ERROR ${err instanceof Error ? err.message : String(err)}`)
    if (err?.stderr) console.error(String(err.stderr).trim())
    process.exitCode = 1
  })
}
