#!/usr/bin/env node

/**
 * T0510 — environment for the opt-in SSH alias acceptance (e2e/pre5-ssh-alias.spec.ts).
 * Windows host only; the ssh under test is Windows' built-in OpenSSH.
 *
 *   node e2e/real-remote/t0510-ssh-alias-env.mjs up                  # keys, image, network, 2 containers, connection.json
 *   node e2e/real-remote/t0510-ssh-alias-env.mjs status
 *   node e2e/real-remote/t0510-ssh-alias-env.mjs apply-ssh-config    # append the temporary block to ~/.ssh/config
 *   node e2e/real-remote/t0510-ssh-alias-env.mjs restore-ssh-config  # put ~/.ssh/config back (hash-checked)
 *   node e2e/real-remote/t0510-ssh-alias-env.mjs down [--rmi]        # restore-ssh-config + remove containers / network / state
 *
 * Topology (WSL Docker, everything named `bat-t0510-*` and labelled `bat.t0510=1`):
 *   bat-t0510-jump    sshd + systemd, network bat-t0510-net, published on 127.0.0.1:22 and
 *                     127.0.0.1:<--ssh-port> (default 22510)
 *   bat-t0510-target  sshd + systemd, network bat-t0510-net only — Windows can neither route to
 *                     it nor resolve its name, so an alias reaching it must have used ProxyJump
 *
 * Why the real ~/.ssh/config: Windows' OpenSSH resolves `~` from the account profile, not from
 * USERPROFILE / HOME (probed in T0510: `ssh -G` ignores both), so an isolated config is not
 * possible for it. `apply-ssh-config` therefore copies the original file aside (SHA-256 recorded),
 * appends one marked block — aliases prefixed `bat-t0510-`, every one pinned to this run's key and
 * a known_hosts file in the state directory, plus a `Match originalhost 127.0.0.1 user bat` block
 * for the typed `bat@127.0.0.1:<port>` fallback — and `restore-ssh-config` puts the original back
 * and checks the hash. If the file changed in between (someone edited it), only the marked block
 * is cut out instead. The real known_hosts / keys are never read or written.
 *
 * Manual restore if the tooling was interrupted:
 *   Copy-Item "$env:TEMP\bat-t0510\ssh-config-backup\config" "$env:USERPROFILE\.ssh\config" -Force
 *   (or delete the lines between `# >>> bat-t0510 temporary (remove) >>>` and `# <<< bat-t0510 temporary <<<`)
 */

import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const LABEL = 'bat.t0510=1'
export const IMAGE = 'bat-t0510-sshd:local'
export const NETWORK = 'bat-t0510-net'
export const JUMP = 'bat-t0510-jump'
export const TARGET = 'bat-t0510-target'
export const SSH_USER = 'bat'
export const ROOT_DIR = path.join(os.tmpdir(), 'bat-t0510')
export const STATE_DIR = path.join(ROOT_DIR, 'ssh-env')
export const CONFIG_PATH = path.join(STATE_DIR, 'connection.json')
export const BACKUP_DIR = path.join(ROOT_DIR, 'ssh-config-backup')
const BACKUP_STATE = path.join(BACKUP_DIR, 'state.json')
export const USER_SSH_CONFIG = path.join(os.homedir(), '.ssh', 'config')
export const WINDOWS_SSH = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe'
const WINDOWS_SSH_KEYGEN = 'C:\\Windows\\System32\\OpenSSH\\ssh-keygen.exe'
const BLOCK_BEGIN = '# >>> bat-t0510 temporary (remove) >>>'
const BLOCK_END = '# <<< bat-t0510 temporary <<<'
const NAME_RX = /^[A-Za-z0-9._-]+$/
const DEFAULT_DISTRO = 'Ubuntu-24.04'
const DEFAULT_SSH_PORT = 22510

export const ALIASES = {
  direct: 'bat-t0510-direct', // HostName + User + IdentityFile, no Port (→ jump on :22)
  port: 'bat-t0510-port', // + custom Port (→ jump on :<port>)
  jumphost: 'bat-t0510-jumphost', // the ProxyJump hop itself
  viaJump: 'bat-t0510-viajump', // ProxyJump → target
  noUser: 'bat-t0510-nouser', // no User: ssh uses the Windows login name, which the containers refuse
}

function log(message) {
  console.log(`[t0510-env] ${message}`)
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

async function waitFor(what, fn, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs
  let last
  while (Date.now() < end) {
    try {
      const v = await fn()
      if (v) return v
    } catch (err) {
      last = err
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`timed out waiting for ${what}${last ? `: ${last.message}` : ''}`)
}

/** `name status` of containers carrying our label (never anything else). */
function ownContainers(distro) {
  return docker(distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}} {{.Status}}']).split(/\r?\n/).filter(Boolean)
}

function removeOwn(distro) {
  for (const name of [JUMP, TARGET]) {
    const labelled = docker(distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim()
    if (labelled) {
      docker(distro, ['rm', '-f', name])
      log(`removed container ${name}`)
    } else if (docker(distro, ['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}']).trim()) {
      throw new Error(`a container named ${name} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
    }
  }
  const nets = docker(distro, ['network', 'ls', '--filter', `name=^${NETWORK}$`, '--format', '{{.ID}} {{.Labels}}']).split(/\r?\n/).filter(Boolean)
  for (const line of nets) {
    if (!line.includes('bat.t0510=1')) throw new Error(`network ${NETWORK} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
    docker(distro, ['network', 'rm', NETWORK])
    log(`removed network ${NETWORK}`)
  }
}

function ensureKeys() {
  const key = path.join(STATE_DIR, 'id_ed25519')
  if (!existsSync(key)) run(WINDOWS_SSH_KEYGEN, ['-q', '-t', 'ed25519', '-N', '', '-C', 'bat-t0510', '-f', key])
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
    '# Added by e2e/real-remote/t0510-ssh-alias-env.mjs (T0510); undo: node e2e/real-remote/t0510-ssh-alias-env.mjs restore-ssh-config',
    `Host ${ALIASES.direct}`, '  HostName 127.0.0.1', `  User ${SSH_USER}`, ...pin,
    `Host ${ALIASES.port}`, '  HostName 127.0.0.1', `  Port ${sshPort}`, `  User ${SSH_USER}`, ...pin,
    `Host ${ALIASES.jumphost}`, '  HostName 127.0.0.1', `  Port ${sshPort}`, `  User ${SSH_USER}`, ...pin,
    `Host ${ALIASES.viaJump}`, `  HostName ${TARGET}`, `  User ${SSH_USER}`, `  ProxyJump ${ALIASES.jumphost}`, ...pin,
    `Host ${ALIASES.noUser}`, '  HostName 127.0.0.1', `  Port ${sshPort}`, ...pin,
    '# the typed `bat@127.0.0.1:<port>` fallback: this run\'s key + known_hosts, nothing else',
    `Match originalhost 127.0.0.1 user ${SSH_USER}`, ...pin,
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
  for (const port of [22, opts.sshPort]) {
    await waitFor(`127.0.0.1:${port} to be free`, () => portFree(port), 15_000)
  }

  mkdirSync(STATE_DIR, { recursive: true })
  const { key, pub } = ensureKeys()
  const knownHosts = path.join(STATE_DIR, 'known_hosts')
  rmSync(knownHosts, { force: true })
  const ctx = path.join(STATE_DIR, 'context')
  rmSync(ctx, { recursive: true, force: true })
  mkdirSync(ctx, { recursive: true })
  copyFileSync(path.join(here, 't0510-sshd.Dockerfile'), path.join(ctx, 'Dockerfile'))
  writeFileSync(path.join(ctx, 'authorized_keys'), `${pub}\n`)
  const ctxPosix = wsl(opts.distro, ['wslpath', '-a', ctx]).trim()
  log(`docker build ${IMAGE} (context ${ctxPosix})`)
  docker(opts.distro, ['build', '-q', '--label', LABEL, '-t', IMAGE, ctxPosix], { timeout: 900_000 })

  docker(opts.distro, ['network', 'create', '--label', LABEL, NETWORK])
  const systemdRun = ['run', '-d', '--label', LABEL, '--privileged', '--cgroupns=private', '--tmpfs', '/run', '--tmpfs', '/run/lock', '--network', NETWORK]
  docker(opts.distro, [...systemdRun, '--name', TARGET, '--hostname', TARGET, IMAGE])
  docker(opts.distro, [...systemdRun, '--name', JUMP, '--hostname', JUMP, '-p', '127.0.0.1:22:22', '-p', `127.0.0.1:${opts.sshPort}:22`, IMAGE])
  await waitSystemd(opts.distro, TARGET)
  await waitSystemd(opts.distro, JUMP)
  const targetIp = docker(opts.distro, ['inspect', '-f', `{{(index .NetworkSettings.Networks "${NETWORK}").IPAddress}}`, TARGET]).trim()
  const jumpIp = docker(opts.distro, ['inspect', '-f', `{{(index .NetworkSettings.Networks "${NETWORK}").IPAddress}}`, JUMP]).trim()
  log(`containers up: ${JUMP} (${jumpIp}, 127.0.0.1:22 + 127.0.0.1:${opts.sshPort}) / ${TARGET} (${targetIp}, private network only)`)

  // Probe every alias with an isolated -F copy of the block before the real config is touched.
  const probeConfig = path.join(STATE_DIR, 'ssh_config.probe')
  writeFileSync(probeConfig, sshConfigBlock({ keyPath: key, knownHosts, sshPort: opts.sshPort }))
  const probes = {}
  for (const [name, alias] of Object.entries(ALIASES)) {
    const r = await sshProbe(probeConfig, alias, 'echo "$(id -un)@$(uname -n)"')
    probes[name] = r.ok ? r.stdout : `FAILED: ${r.stderr.split(/\r?\n/).pop()}`
    log(`probe ${alias} (Windows OpenSSH, -F probe copy): ${probes[name]}`)
  }
  if (probes.direct !== `${SSH_USER}@${JUMP}` || probes.port !== `${SSH_USER}@${JUMP}` || probes.viaJump !== `${SSH_USER}@${TARGET}`) {
    throw new Error(`alias probes failed: ${JSON.stringify(probes)}`)
  }
  if (!probes.noUser.startsWith('FAILED') || !/Permission denied/i.test(probes.noUser)) {
    throw new Error(`${ALIASES.noUser} was expected to be refused (Permission denied): ${probes.noUser}`)
  }

  const config = {
    createdBy: 'T0510 t0510-ssh-alias-env.mjs',
    distro: opts.distro,
    sshExe: WINDOWS_SSH,
    sshPort: opts.sshPort,
    sshUser: SSH_USER,
    keyPath: key,
    knownHosts,
    aliases: ALIASES,
    containers: { jump: { name: JUMP, ip: jumpIp }, target: { name: TARGET, ip: targetIp } },
    windowsUser: os.userInfo().username,
    probes,
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  log(`wrote ${CONFIG_PATH}`)
  log('run: $env:BAT_E2E_PRE5_SSH=1; $env:BAT_E2E_EXECUTABLE=\'C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe\'; npx playwright test e2e/pre5-ssh-alias.spec.ts')
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
  if (current === state.sha256After || current === null) {
    if (state.existed) copyFileSync(path.join(BACKUP_DIR, 'config'), USER_SSH_CONFIG)
    else rmSync(USER_SSH_CONFIG, { force: true })
    how = state.existed ? 'backup copied back' : 'file removed (it did not exist before)'
  } else {
    // Edited while the block was in place: cut out only our block, keep the edits.
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
  if (!matches && how !== 'file was edited meanwhile — only the marked block was removed') {
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
  if (opts.rmi) {
    if (docker(opts.distro, ['images', '-q', '--filter', `label=${LABEL}`, '--filter', `reference=${IMAGE}`]).trim()) {
      docker(opts.distro, ['rmi', IMAGE])
      log(`removed image ${IMAGE}`)
    }
  } else {
    log(`image ${IMAGE} kept for reruns (--rmi removes it)`)
  }
  rmSync(STATE_DIR, { recursive: true, force: true })
  log(`state dir ${STATE_DIR} removed: ${!existsSync(STATE_DIR)}`)
  log(`containers left with ${LABEL}: ${docker(opts.distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}}']).trim() || 'none'}`)
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.command === 'up') await up(opts)
  else if (opts.command === 'down') down(opts)
  else if (opts.command === 'status') status(opts)
  else if (opts.command === 'apply-ssh-config') applySshConfig()
  else if (opts.command === 'restore-ssh-config') restoreSshConfig()
  else {
    console.log('Usage: node e2e/real-remote/t0510-ssh-alias-env.mjs <up|status|apply-ssh-config|restore-ssh-config|down> [--distro Ubuntu-24.04] [--ssh-port 22510] [--rmi]')
    return opts.command === 'help' ? 0 : 1
  }
  return 0
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code }, (err) => {
    console.error(`[t0510-env] ERROR ${err instanceof Error ? err.message : String(err)}`)
    if (err?.stderr) console.error(String(err.stderr).trim())
    process.exitCode = 1
  })
}
