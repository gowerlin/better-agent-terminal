#!/usr/bin/env node

/**
 * T0663 — optional environment for e2e/v071-pre2-acceptance.spec.ts: one SSH target that refuses
 * every key, so the SSH wizard's verify-auth step fails with `permission-denied` (BUG-158's message).
 * Windows host only; modelled on t0515-wizard-env.mjs (T0515), which is left unchanged.
 *
 *   node e2e/real-remote/t0663-env.mjs up                  # key, image, container, connection.json
 *   node e2e/real-remote/t0663-env.mjs status
 *   node e2e/real-remote/t0663-env.mjs apply-ssh-config    # append the temporary block to ~/.ssh/config
 *   node e2e/real-remote/t0663-env.mjs restore-ssh-config  # put ~/.ssh/config back (hash-checked)
 *   node e2e/real-remote/t0663-env.mjs down [--rmi]        # restore-ssh-config + remove container / state
 *
 * Topology (WSL Docker, everything named `bat-t0663-*` and labelled `bat.t0663=1`):
 *   bat-t0663-sshd   plain sshd (t0663-sshd.Dockerfile), published on 127.0.0.1:<--ssh-port>
 *                    (default 22663); account `bat` with an empty authorized_keys
 *
 * Alias (marked block in the real ~/.ssh/config — Windows OpenSSH ignores USERPROFILE / HOME, so an
 * isolated config is impossible; same reasoning as T0510 / T0515):
 *   bat-t0663-nokey  HostName 127.0.0.1 + Port + User bat, pinned to this run's key (never authorized)
 *                    and a known_hosts file in the state directory, IdentitiesOnly yes — the real
 *                    known_hosts / keys / ssh-agent keys are never read, offered or written.
 * `apply-ssh-config` copies the original aside (SHA-256 recorded); `restore-ssh-config` puts it back
 * and checks the hash, or — if the file was edited meanwhile — cuts out only the marked block.
 *
 * Manual restore if the tooling was interrupted:
 *   Copy-Item "$env:TEMP\bat-t0663\ssh-config-backup\config" "$env:USERPROFILE\.ssh\config" -Force
 *   (or delete the lines between `# >>> bat-t0663 temporary (remove) >>>` and `# <<< bat-t0663 temporary <<<`)
 */

import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const LABEL = 'bat.t0663=1'
export const IMAGE = 'bat-t0663-sshd:local'
export const CONTAINER = 'bat-t0663-sshd'
export const ALIAS = 'bat-t0663-nokey'
export const SSH_USER = 'bat'
export const ROOT_DIR = path.join(os.tmpdir(), 'bat-t0663')
export const STATE_DIR = path.join(ROOT_DIR, 'ssh-env')
export const CONFIG_PATH = path.join(STATE_DIR, 'connection.json')
export const BACKUP_DIR = path.join(ROOT_DIR, 'ssh-config-backup')
const BACKUP_STATE = path.join(BACKUP_DIR, 'state.json')
export const USER_SSH_CONFIG = path.join(os.homedir(), '.ssh', 'config')
export const WINDOWS_SSH = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe'
const WINDOWS_SSH_KEYGEN = 'C:\\Windows\\System32\\OpenSSH\\ssh-keygen.exe'
const BLOCK_BEGIN = '# >>> bat-t0663 temporary (remove) >>>'
const BLOCK_END = '# <<< bat-t0663 temporary <<<'
const NAME_RX = /^[A-Za-z0-9._-]+$/
const DEFAULT_DISTRO = 'Ubuntu-24.04'
const DEFAULT_SSH_PORT = 22663

function log(message) {
  console.log(`[t0663-env] ${message}`)
}

function run(file, args, { timeout = 60_000 } = {}) {
  return execFileSync(file, args, { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

function wsl(distro, args, opts) {
  if (!NAME_RX.test(distro)) throw new Error(`invalid WSL distro ${distro}`)
  return run('wsl.exe', ['-d', distro, '--exec', ...args], opts)
}

function docker(distro, args, opts) {
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
  if (!Number.isInteger(opts.sshPort) || opts.sshPort < 1024 || opts.sshPort > 65535 || opts.sshPort === 9876 || opts.sshPort === 9877) {
    throw new Error(`invalid --ssh-port ${opts.sshPort}`)
  }
  return opts
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

/** Resolves with the first bytes the port sends (the SSH banner), or '' on failure. */
function banner(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const timer = setTimeout(() => { socket.destroy(); resolve('') }, 3_000)
    socket.once('data', (chunk) => { clearTimeout(timer); socket.destroy(); resolve(String(chunk).trim()) })
    socket.once('error', () => { clearTimeout(timer); resolve('') })
  })
}

async function waitFor(what, fn, timeoutMs = 60_000, intervalMs = 1000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await fn()) return
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`timed out waiting for ${what}`)
}

/** Removes our container, only when it carries our label. */
function removeOwnContainer(distro) {
  const labelled = docker(distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--filter', `name=^/${CONTAINER}$`, '--format', '{{.ID}}']).trim()
  if (labelled) {
    docker(distro, ['rm', '-f', CONTAINER])
    log(`removed container ${CONTAINER}`)
  } else if (docker(distro, ['ps', '-a', '--filter', `name=^/${CONTAINER}$`, '--format', '{{.ID}}']).trim()) {
    throw new Error(`a container named ${CONTAINER} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
  }
}

const fwd = (p) => p.replace(/\\/g, '/')

/** The block appended to ~/.ssh/config (also written to the state dir for `ssh -F` probes). */
export function sshConfigBlock({ keyPath, knownHosts, sshPort }) {
  return [
    BLOCK_BEGIN,
    '# Added by e2e/real-remote/t0663-env.mjs (T0663); undo: node e2e/real-remote/t0663-env.mjs restore-ssh-config',
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

function sshProbe(configFile) {
  return new Promise((resolve) => {
    execFile(WINDOWS_SSH, ['-F', configFile, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '--', ALIAS, 'true'],
      { timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout).trim(), stderr: String(stderr).trim() }))
  })
}

async function up(opts) {
  if (process.platform !== 'win32') throw new Error('Windows host only (WSL Docker + Windows OpenSSH)')
  if (!existsSync(WINDOWS_SSH)) throw new Error(`Windows OpenSSH client not found at ${WINDOWS_SSH}`)
  log(`docker engine in ${opts.distro}: ${docker(opts.distro, ['version', '--format', '{{.Server.Version}}']).trim()}`)
  removeOwnContainer(opts.distro)
  await waitFor(`127.0.0.1:${opts.sshPort} to be free`, () => portFree(opts.sshPort), 15_000)

  mkdirSync(STATE_DIR, { recursive: true })
  const key = path.join(STATE_DIR, 'id_ed25519')
  if (!existsSync(key)) run(WINDOWS_SSH_KEYGEN, ['-q', '-t', 'ed25519', '-N', '', '-C', 'bat-t0663-never-authorized', '-f', key])
  const knownHosts = path.join(STATE_DIR, 'known_hosts')
  rmSync(knownHosts, { force: true })
  const ctx = path.join(STATE_DIR, 'context')
  rmSync(ctx, { recursive: true, force: true })
  mkdirSync(ctx, { recursive: true })
  copyFileSync(path.join(here, 't0663-sshd.Dockerfile'), path.join(ctx, 'Dockerfile'))
  const ctxPosix = wsl(opts.distro, ['wslpath', '-a', ctx]).trim()
  log(`docker build ${IMAGE} (context ${ctxPosix})`)
  docker(opts.distro, ['build', '-q', '--label', LABEL, '-t', IMAGE, ctxPosix], { timeout: 900_000 })
  rmSync(ctx, { recursive: true, force: true })

  docker(opts.distro, ['run', '-d', '--label', LABEL, '--name', CONTAINER, '--hostname', CONTAINER, '-p', `127.0.0.1:${opts.sshPort}:22`, IMAGE])
  let seen = ''
  await waitFor(`${CONTAINER}: sshd banner on 127.0.0.1:${opts.sshPort}`, async () => (seen = await banner(opts.sshPort)).startsWith('SSH-2.0'), 60_000)
  log(`${CONTAINER} up: banner ${seen}`)

  const probeConfig = path.join(STATE_DIR, 'ssh_config.probe')
  writeFileSync(probeConfig, sshConfigBlock({ keyPath: key, knownHosts, sshPort: opts.sshPort }))
  const probe = await sshProbe(probeConfig)
  log(`probe ${ALIAS} (Windows OpenSSH, -F probe copy): ok=${probe.ok} stderr=${JSON.stringify(probe.stderr.split(/\r?\n/).pop())}`)
  if (probe.ok || !/Permission denied/i.test(probe.stderr)) throw new Error(`expected the probe to be refused: ${JSON.stringify(probe)}`)

  const config = {
    createdBy: 'T0663 t0663-env.mjs',
    distro: opts.distro,
    sshPort: opts.sshPort,
    sshUser: SSH_USER,
    keyPath: key,
    knownHosts,
    alias: ALIAS,
    container: CONTAINER,
    probe: probe.stderr.split(/\r?\n/).pop(),
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  log(`wrote ${CONFIG_PATH}`)
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
  if (!matches && !edited) throw new Error(`restored ~/.ssh/config hash ${after} does not match the backup ${state.sha256Before}`)
  rmSync(BACKUP_DIR, { recursive: true, force: true })
  return { restored: true, how, sha256Before: state.sha256Before, sha256Restored: after, matches }
}

function status(opts) {
  log(`containers with ${LABEL}: ${docker(opts.distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}} {{.Status}}']).trim() || 'none'}`)
  log(`images with ${LABEL}: ${docker(opts.distro, ['images', '--filter', `label=${LABEL}`, '--format', '{{.Repository}}:{{.Tag}} {{.ID}}']).trim() || 'none'}`)
  log(`connection.json: ${existsSync(CONFIG_PATH) ? CONFIG_PATH : 'none'}`)
  log(`~/.ssh/config temporary block: ${existsSync(BACKUP_STATE) ? 'APPLIED (run restore-ssh-config)' : 'not applied'}`)
}

function down(opts) {
  restoreSshConfig()
  removeOwnContainer(opts.distro)
  if (opts.rmi && docker(opts.distro, ['images', '-q', '--filter', `label=${LABEL}`, '--filter', `reference=${IMAGE}`]).trim()) {
    docker(opts.distro, ['rmi', IMAGE])
    log(`removed image ${IMAGE}`)
  }
  rmSync(STATE_DIR, { recursive: true, force: true })
  log(`state dir ${STATE_DIR} removed: ${!existsSync(STATE_DIR)}`)
  log(`containers left with ${LABEL}: ${docker(opts.distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}}']).trim() || 'none'}`)
  log(`images left with ${LABEL}: ${docker(opts.distro, ['images', '--filter', `label=${LABEL}`, '--format', '{{.Repository}}:{{.Tag}}']).trim() || 'none'}`)
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.command === 'up') await up(opts)
  else if (opts.command === 'down') down(opts)
  else if (opts.command === 'status') status(opts)
  else if (opts.command === 'apply-ssh-config') applySshConfig()
  else if (opts.command === 'restore-ssh-config') restoreSshConfig()
  else {
    console.log('Usage: node e2e/real-remote/t0663-env.mjs <up|status|apply-ssh-config|restore-ssh-config|down> [--distro Ubuntu-24.04] [--ssh-port 22663] [--rmi]')
    return opts.command === 'help' ? 0 : 1
  }
  return 0
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code }, (err) => {
    console.error(`[t0663-env] ERROR ${err instanceof Error ? err.message : String(err)}`)
    if (err?.stderr) console.error(String(err.stderr).trim())
    process.exitCode = 1
  })
}
