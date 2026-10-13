#!/usr/bin/env node

/**
 * T0467 — environment for the opt-in real-remote PLAN-039 acceptance
 * (e2e/plan039-real-remote.spec.ts). Windows host only.
 *
 *   node e2e/real-remote/plan039-real-remote-env.mjs up       # build + start, write connection.json
 *   node e2e/real-remote/plan039-real-remote-env.mjs status
 *   node e2e/real-remote/plan039-real-remote-env.mjs down     # remove the container + state dir
 *
 * Topology:
 *   profile W (wsl-linux) → the bat-server already running in WSL (`localhost:<port>`).
 *                           Only READ: port / token / fingerprint via smoke-remote-headless's
 *                           resolveWslTarget. Never redeployed, restarted or reconfigured.
 *   profile S (ssh-linux) → container `bat-t0467-sshd` in WSL's Docker: sshd (key login, user
 *                           `bat`) + its own headless bat-server on the container's localhost,
 *                           built from a dist-baseline linux-x64 bundle with the current
 *                           source's headless JS + helpers (dev-deploy-headless staging).
 *
 * Everything this script creates is marked: container name `bat-t0467-sshd`, image
 * `bat-t0467-sshd:local`, label `bat.t0467=1`. `down` only removes a container that carries
 * that label; no network / volume is created. The image is kept for reruns (`--rmi` removes it).
 *
 * State (keys, isolated HOME for ssh, build context, connection.json) lives in
 * `%TEMP%\bat-t0467` — a path without spaces (BAT's validateSshIdentifier rejects them).
 * The user's ~/.ssh is never read or written.
 */

import { execFile, execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decodeTokenFile, normalizeFingerprint, parseFingerprintField, resolveWslTarget } from '../../scripts/smoke-remote-headless.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '..', '..')

export const CONTAINER = 'bat-t0467-sshd'
export const IMAGE = 'bat-t0467-sshd:local'
export const LABEL = 'bat.t0467=1'
export const CONTAINER_HOSTNAME = 'bat-t0467-s'
export const SSH_USER = 'bat'
export const CONTAINER_SERVER_PORT = 9876
export const STATE_DIR = path.join(os.tmpdir(), 'bat-t0467')
export const CONFIG_PATH = path.join(STATE_DIR, 'connection.json')
const NAME_RX = /^[A-Za-z0-9._-]+$/
const DEFAULT_DISTRO = 'Ubuntu-24.04'
const DEFAULT_SSH_PORT = 22467
const WSL_SERVER_PORT = 9877
const GIT_USR_BIN = 'C:\\Program Files\\Git\\usr\\bin'
const STAGING = path.join(projectRoot, 'dist-server', 'dev-deploy-headless')

function log(message) {
  console.log(`[t0467-env] ${message}`)
}

function run(file, args, { timeout = 60_000, input, inherit = false } = {}) {
  return execFileSync(file, args, {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  })
}

function wsl(distro, args, opts) {
  if (!NAME_RX.test(distro)) throw new Error(`invalid WSL distro ${distro}`)
  return run('wsl.exe', ['-d', distro, '--exec', ...args], opts)
}

function docker(distro, args, opts) {
  return wsl(distro, ['docker', ...args], opts)
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

/** Container ids named CONTAINER that carry our label (never anything else). */
function ownContainers(distro) {
  const out = docker(distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--filter', `name=^/${CONTAINER}$`, '--format', '{{.ID}} {{.Names}} {{.Status}}'])
  return out.split(/\r?\n/).filter(Boolean)
}

function nameTaken(distro) {
  const out = docker(distro, ['ps', '-a', '--filter', `name=^/${CONTAINER}$`, '--format', '{{.ID}}'])
  return out.trim().length > 0
}

function newestBaselineTarball() {
  const dir = path.join(projectRoot, 'dist-baseline')
  const files = existsSync(dir) ? readdirSync(dir).filter(f => /^bat-server-linux-x64-v.+\.tar\.gz$/.test(f)) : []
  if (files.length === 0) throw new Error('no dist-baseline/bat-server-linux-x64-v*.tar.gz — run `npm run fetch:baseline` first')
  files.sort((a, b) => statSync(path.join(dir, b)).mtimeMs - statSync(path.join(dir, a)).mtimeMs)
  return path.join(dir, files[0])
}

function stageHeadlessJs() {
  // dev-deploy-headless builds its staging in every mode; a dry run against an empty
  // dir target writes nothing anywhere except dist-server/dev-deploy-headless.
  const fakeRoot = path.join(STATE_DIR, 'dev-deploy-root')
  mkdirSync(path.join(fakeRoot, 'electron', 'remote'), { recursive: true })
  run(process.execPath, [path.join(projectRoot, 'scripts', 'dev-deploy-headless.mjs'), '--target', `dir:${fakeRoot}`], { timeout: 180_000 })
  const js = readdirSync(STAGING).filter(f => f.endsWith('.js'))
  const helpers = readdirSync(path.join(STAGING, 'scripts'))
  if (js.length === 0 || !helpers.includes('bat-notify.mjs')) throw new Error(`unexpected staging in ${STAGING}`)
  return { js, helpers }
}

function buildContext(tarball) {
  const ctx = path.join(STATE_DIR, 'context')
  rmSync(ctx, { recursive: true, force: true })
  mkdirSync(path.join(ctx, 'overlay', 'remote'), { recursive: true })
  mkdirSync(path.join(ctx, 'overlay', 'scripts'), { recursive: true })
  copyFileSync(path.join(here, 'Dockerfile'), path.join(ctx, 'Dockerfile'))
  // core.autocrlf may have checked the script out with CRLF; the container needs LF.
  writeFileSync(path.join(ctx, 'entrypoint.sh'), readFileSync(path.join(here, 'entrypoint.sh'), 'utf8').replace(/\r\n/g, '\n'))
  copyFileSync(tarball, path.join(ctx, 'bat-server.tar.gz'))
  const { js, helpers } = stageHeadlessJs()
  for (const f of js) copyFileSync(path.join(STAGING, f), path.join(ctx, 'overlay', 'remote', f))
  cpSync(path.join(STAGING, 'scripts'), path.join(ctx, 'overlay', 'scripts'), { recursive: true })
  log(`build context ${ctx}: ${path.basename(tarball)} + ${js.length} headless JS + ${helpers.length} helpers`)
  return ctx
}

function ensureKeys() {
  const sshDir = path.join(STATE_DIR, 'ssh')
  const key = path.join(sshDir, 'id_ed25519')
  if (!existsSync(key)) {
    mkdirSync(sshDir, { recursive: true })
    run('ssh-keygen.exe', ['-q', '-t', 'ed25519', '-N', '', '-C', 'bat-t0467', '-f', key])
  }
  return { key, pub: readFileSync(`${key}.pub`, 'utf8').trim() }
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

function sshProbe(key, port, home) {
  return new Promise((resolve) => {
    execFile(path.join(GIT_USR_BIN, 'ssh.exe'), [
      '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new',
      '-p', String(port), '-i', key, '--', `${SSH_USER}@127.0.0.1`, 'uname -n; cat /etc/bat-t0467-marker',
    ], { timeout: 20_000, windowsHide: true, env: { ...process.env, HOME: home } }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

async function up(opts) {
  if (process.platform !== 'win32') throw new Error('Windows host only (WSL + Docker in WSL)')
  if (!existsSync(path.join(GIT_USR_BIN, 'ssh.exe'))) throw new Error(`Git for Windows ssh not found at ${GIT_USR_BIN}\\ssh.exe (needed so known_hosts goes to the isolated HOME)`)
  const dockerVersion = docker(opts.distro, ['version', '--format', '{{.Server.Version}}']).trim()
  log(`docker engine in ${opts.distro}: ${dockerVersion}`)

  const own = ownContainers(opts.distro)
  if (own.length > 0) {
    log(`removing previous ${CONTAINER} (${own.join('; ')})`)
    docker(opts.distro, ['rm', '-f', CONTAINER])
  } else if (nameTaken(opts.distro)) {
    throw new Error(`a container named ${CONTAINER} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
  }
  // A just-removed container's port forward is released with a delay (WSL mirrored networking).
  await waitFor(`127.0.0.1:${opts.sshPort} to be free (pass --ssh-port <free port> if it stays in use)`, () => portFree(opts.sshPort), 15_000)

  mkdirSync(STATE_DIR, { recursive: true })
  const home = path.join(STATE_DIR, 'home')
  rmSync(home, { recursive: true, force: true })
  mkdirSync(home, { recursive: true })
  const { key, pub } = ensureKeys()

  const ctx = buildContext(newestBaselineTarball())
  const ctxPosix = wsl(opts.distro, ['wslpath', '-a', ctx]).trim()
  log(`docker build ${IMAGE} (context ${ctxPosix})`)
  docker(opts.distro, ['build', '-q', '--label', LABEL, '-t', IMAGE, ctxPosix], { timeout: 600_000 })

  const id = docker(opts.distro, [
    'run', '-d', '--name', CONTAINER, '--label', LABEL, '--hostname', CONTAINER_HOSTNAME,
    '-p', `127.0.0.1:${opts.sshPort}:22`,
    '-e', `T0467_AUTHORIZED_KEY=${pub}`, '-e', `T0467_SERVER_PORT=${CONTAINER_SERVER_PORT}`,
    IMAGE,
  ]).trim()
  log(`container ${CONTAINER} ${id.slice(0, 12)} → 127.0.0.1:${opts.sshPort} (sshd)`)

  const dataDir = '/home/bat/.local/share/bat-server'
  await waitFor('container bat-server certificate + token', () => {
    const out = docker(opts.distro, ['exec', CONTAINER, 'sh', '-c', `test -s ${dataDir}/server-cert.json && test -s ${dataDir}/server-token.json && echo ready`])
    return out.includes('ready')
  })
  const fingerprint = parseFingerprintField(docker(opts.distro, ['exec', CONTAINER, 'grep', '-o', '-E', '"fingerprint"[[:space:]]*:[[:space:]]*"[0-9A-Fa-f:]+"', `${dataDir}/server-cert.json`]))
  const token = decodeTokenFile(docker(opts.distro, ['exec', CONTAINER, 'cat', `${dataDir}/server-token.json`]))
  await waitFor(`container bat-server listening on ${CONTAINER_SERVER_PORT}`, () =>
    docker(opts.distro, ['exec', CONTAINER, 'sh', '-c', `cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | grep -i ':${CONTAINER_SERVER_PORT.toString(16).toUpperCase().padStart(4, '0')} ' | grep ' 0A ' || true`]).trim().length > 0)

  const probe = await waitFor('ssh login into the container', async () => {
    const r = await sshProbe(key, opts.sshPort, home)
    return r.ok && r.stdout.includes(CONTAINER_HOSTNAME) ? r : null
  }, 30_000)
  log(`ssh probe (Git ssh, HOME=${home}): ${probe.stdout.trim().replace(/\r?\n/g, ' | ')}`)

  // W: the user's WSL server — read-only (systemctl show / grep cert / cat token).
  const w = await resolveWslTarget({ distro: opts.distro, host: 'localhost', port: WSL_SERVER_PORT })
  const wslHostname = wsl(opts.distro, ['uname', '-n']).trim()
  if (wslHostname === CONTAINER_HOSTNAME) throw new Error('WSL and container hostnames collide')

  const config = {
    createdBy: 'T0467 plan039-real-remote-env.mjs',
    distro: opts.distro,
    sshBinDir: GIT_USR_BIN,
    sshHome: home,
    w: { host: 'localhost', port: WSL_SERVER_PORT, token: w.token, fingerprint: normalizeFingerprint(w.fingerprint), hostname: wslHostname },
    s: {
      sshHost: '127.0.0.1', sshPort: opts.sshPort, sshUser: SSH_USER, sshKeyPath: key,
      serverPort: CONTAINER_SERVER_PORT, token, fingerprint: normalizeFingerprint(fingerprint), hostname: CONTAINER_HOSTNAME,
      container: CONTAINER,
    },
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  log(`W: localhost:${WSL_SERVER_PORT} (${wslHostname}) fp=${config.w.fingerprint.slice(0, 16)}… [${w.notes.join('; ')}]`)
  log(`S: ssh ${SSH_USER}@127.0.0.1:${opts.sshPort} → localhost:${CONTAINER_SERVER_PORT} (${CONTAINER_HOSTNAME}) fp=${config.s.fingerprint.slice(0, 16)}…`)
  log(`wrote ${CONFIG_PATH}`)
  log('run: $env:BAT_E2E_REAL_REMOTE=1; npx playwright test e2e/plan039-real-remote.spec.ts')
}

function status(opts) {
  const own = ownContainers(opts.distro)
  log(`containers (${LABEL}, ${CONTAINER}): ${own.length ? own.join('; ') : 'none'}`)
  log(`state dir ${STATE_DIR}: ${existsSync(STATE_DIR) ? 'present' : 'absent'}; connection.json ${existsSync(CONFIG_PATH) ? 'present' : 'absent'}`)
}

function down(opts) {
  const own = ownContainers(opts.distro)
  if (own.length > 0) {
    docker(opts.distro, ['rm', '-f', CONTAINER])
    log(`removed ${CONTAINER} (${own.join('; ')})`)
  } else if (nameTaken(opts.distro)) {
    log(`a container named ${CONTAINER} exists without label ${LABEL} — not ours, left alone`)
  } else {
    log(`no ${CONTAINER} container`)
  }
  if (opts.rmi) {
    const img = docker(opts.distro, ['images', '-q', '--filter', `label=${LABEL}`, '--filter', `reference=${IMAGE}`]).trim()
    if (img) {
      docker(opts.distro, ['rmi', IMAGE])
      log(`removed image ${IMAGE}`)
    }
  }
  rmSync(STATE_DIR, { recursive: true, force: true })
  log(`state dir ${STATE_DIR} removed: ${!existsSync(STATE_DIR)}`)
  const left = docker(opts.distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}}']).trim()
  log(`containers left with ${LABEL}: ${left || 'none'}`)
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.command === 'up') await up(opts)
  else if (opts.command === 'down') down(opts)
  else if (opts.command === 'status') status(opts)
  else {
    console.log('Usage: node e2e/real-remote/plan039-real-remote-env.mjs <up|status|down> [--distro Ubuntu-24.04] [--ssh-port 22467] [--rmi]')
    return opts.command === 'help' ? 0 : 1
  }
  return 0
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code }, (err) => {
    console.error(`[t0467-env] ERROR ${err instanceof Error ? err.message : String(err)}`)
    if (err?.stderr) console.error(String(err.stderr).trim())
    process.exitCode = 1
  })
}
