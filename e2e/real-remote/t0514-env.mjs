#!/usr/bin/env node

/**
 * T0514 — environment for the opt-in pre.6 UI / remote-routing acceptance
 * (e2e/pre6-ui-remote-acceptance.spec.ts). Windows host only.
 *
 *   node e2e/real-remote/t0514-env.mjs up       # build + start, write connection.json
 *   node e2e/real-remote/t0514-env.mjs status
 *   node e2e/real-remote/t0514-env.mjs down     # remove the container + state dir (--rmi: image too)
 *
 * One container in WSL's Docker, `bat-t0514-srv`: the stock pre.6 headless bat-server from the
 * linux-x64 baseline tarball shipped with the installed BAT (resources/bat-server-baseline/),
 * no source overlay — the server half of the pre.6 build under test. It listens on 0.0.0.0:9876
 * inside the container, published to Windows as 127.0.0.1:<port> only. See
 * t0514-server.Dockerfile for the remote-only markers under /work.
 *
 * Everything this script creates is marked: container `bat-t0514-srv`, image
 * `bat-t0514-srv:local`, label `bat.t0514=1`. No network / volume is created. `down` only
 * removes a container carrying that label. The user's WSL bat-server (port 9877) is never
 * read or contacted; no other container / image is touched.
 *
 * State (build context, connection.json) lives in `%TEMP%\bat-t0514`.
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decodeTokenFile, normalizeFingerprint, parseFingerprintField } from '../../scripts/smoke-remote-headless.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))

export const CONTAINER = 'bat-t0514-srv'
export const IMAGE = 'bat-t0514-srv:local'
export const LABEL = 'bat.t0514=1'
export const CONTAINER_HOSTNAME = 'bat-t0514-srv'
export const CONTAINER_SERVER_PORT = 9876
export const STATE_DIR = path.join(os.tmpdir(), 'bat-t0514')
export const CONFIG_PATH = path.join(STATE_DIR, 'connection.json')
/** Client-side (Windows) path of the docker-linux mount. Deliberately nonexistent on Windows. */
export const CLIENT_WORK = 'C:\\bat-t0514-virt\\work'
export const SERVER_WORK = '/work'
const NAME_RX = /^[A-Za-z0-9._-]+$/
const DEFAULT_DISTRO = 'Ubuntu-24.04'
const DEFAULT_PORT = 29514
const DEFAULT_BASELINE_DIR = 'C:\\Program Files\\BetterAgentTerminal\\resources\\bat-server-baseline'
const DATA_DIR = '/home/bat/.local/share/bat-server'
const SEED_SESSION_ID = '5140d514-0514-4514-8514-000000005140'

function log(message) {
  console.log(`[t0514-env] ${message}`)
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

function parseArgs(argv) {
  const opts = { command: argv[0] ?? 'help', distro: DEFAULT_DISTRO, port: DEFAULT_PORT, baselineDir: DEFAULT_BASELINE_DIR, rmi: false }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--distro') opts.distro = argv[++i]
    else if (arg === '--port') opts.port = Number(argv[++i])
    else if (arg === '--baseline-dir') opts.baselineDir = argv[++i]
    else if (arg === '--rmi') opts.rmi = true
    else throw new Error(`unknown option ${arg}`)
  }
  if (!NAME_RX.test(opts.distro)) throw new Error(`invalid --distro ${opts.distro}`)
  if (!Number.isInteger(opts.port) || opts.port < 1024 || opts.port > 65535 || opts.port === 9876 || opts.port === 9877) throw new Error(`invalid --port ${opts.port}`)
  return opts
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

function ownContainers(distro) {
  const out = docker(distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--filter', `name=^/${CONTAINER}$`, '--format', '{{.ID}} {{.Names}} {{.Status}}'])
  return out.split(/\r?\n/).filter(Boolean)
}

function nameTaken(distro) {
  return docker(distro, ['ps', '-a', '--filter', `name=^/${CONTAINER}$`, '--format', '{{.ID}}']).trim().length > 0
}

function baselineTarball(dir) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  const file = manifest?.tarballs?.['linux-x64']?.filename
  if (!file || !existsSync(path.join(dir, file))) throw new Error(`no linux-x64 tarball listed in ${dir}\\manifest.json`)
  return { tarball: path.join(dir, file), version: manifest.version, sha256: manifest.tarballs['linux-x64'].sha256 }
}

function buildContext(tarball) {
  const ctx = path.join(STATE_DIR, 'context')
  rmSync(ctx, { recursive: true, force: true })
  mkdirSync(ctx, { recursive: true })
  copyFileSync(path.join(here, 't0514-server.Dockerfile'), path.join(ctx, 'Dockerfile'))
  copyFileSync(tarball, path.join(ctx, 'bat-server.tar.gz'))
  // Fake gh: answers `gh pr list` / `gh issue list` with the directory it was started in.
  writeFileSync(path.join(ctx, 'gh'), [
    '#!/bin/sh',
    'echo "$(date +%s) pwd=$PWD args=$*" >> /tmp/t0514-gh.log',
    'case "$1 $2" in',
    '  "--version "*|"--version") echo "gh version 2.0.0-t0514 (fake)"; exit 0 ;;',
    '  "auth status") exit 1 ;;',
    'esac',
    'printf \'[{"number":514,"title":"T0514-GH pwd=%s","state":"OPEN","author":{"login":"t0514"},"createdAt":"","updatedAt":"","labels":[],"headRefName":"t0514","isDraft":false}]\\n\' "$PWD"',
    '',
  ].join('\n'))
  const now = new Date().toISOString()
  writeFileSync(path.join(ctx, 'seed-session.jsonl'), [
    { type: 'user', uuid: '5140d514-0000-4000-8000-000000000001', parentUuid: null, sessionId: SEED_SESSION_ID, cwd: SERVER_WORK, timestamp: now, message: { role: 'user', content: 'T0514-REMOTE-SESSION seeded prompt' } },
    { type: 'assistant', uuid: '5140d514-0000-4000-8000-000000000002', parentUuid: '5140d514-0000-4000-8000-000000000001', sessionId: SEED_SESSION_ID, cwd: SERVER_WORK, timestamp: now, message: { role: 'assistant', content: [{ type: 'text', text: 'seeded reply' }] } },
  ].map(l => JSON.stringify(l)).join('\n') + '\n')
  return ctx
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

async function up(opts) {
  if (process.platform !== 'win32') throw new Error('Windows host only (WSL + Docker in WSL)')
  log(`docker engine in ${opts.distro}: ${docker(opts.distro, ['version', '--format', '{{.Server.Version}}']).trim()}`)
  const own = ownContainers(opts.distro)
  if (own.length > 0) {
    log(`removing previous ${CONTAINER} (${own.join('; ')})`)
    docker(opts.distro, ['rm', '-f', CONTAINER])
  } else if (nameTaken(opts.distro)) {
    throw new Error(`a container named ${CONTAINER} exists WITHOUT label ${LABEL} — not ours, refusing to touch it`)
  }
  await waitFor(`127.0.0.1:${opts.port} to be free (pass --port <free port>)`, () => portFree(opts.port), 15_000)

  mkdirSync(STATE_DIR, { recursive: true })
  const base = baselineTarball(opts.baselineDir)
  const ctx = buildContext(base.tarball)
  const ctxPosix = wsl(opts.distro, ['wslpath', '-a', ctx]).trim()
  log(`docker build ${IMAGE} from ${path.basename(base.tarball)} (manifest version ${base.version}, sha256 ${base.sha256.slice(0, 16)}…)`)
  docker(opts.distro, ['build', '-q', '--label', LABEL, '-t', IMAGE, ctxPosix], { timeout: 900_000 })

  const id = docker(opts.distro, [
    'run', '-d', '--name', CONTAINER, '--label', LABEL, '--hostname', CONTAINER_HOSTNAME,
    '-p', `127.0.0.1:${opts.port}:${CONTAINER_SERVER_PORT}`, IMAGE,
  ]).trim()
  log(`container ${CONTAINER} ${id.slice(0, 12)} → 127.0.0.1:${opts.port}`)

  await waitFor('bat-server certificate + token', () =>
    docker(opts.distro, ['exec', CONTAINER, 'sh', '-c', `test -s ${DATA_DIR}/server-cert.json && test -s ${DATA_DIR}/server-token.json && echo ready`]).includes('ready'))
  const fingerprint = normalizeFingerprint(parseFingerprintField(docker(opts.distro, ['exec', CONTAINER, 'grep', '-o', '-E', '"fingerprint"[[:space:]]*:[[:space:]]*"[0-9A-Fa-f:]+"', `${DATA_DIR}/server-cert.json`])))
  const token = decodeTokenFile(docker(opts.distro, ['exec', CONTAINER, 'cat', `${DATA_DIR}/server-token.json`]))
  await waitFor(`127.0.0.1:${opts.port} accepting connections from Windows`, () => new Promise((resolve) => {
    const s = net.connect(opts.port, '127.0.0.1', () => { s.destroy(); resolve(true) })
    s.once('error', () => resolve(false))
  }))
  const bundleVersion = docker(opts.distro, ['exec', CONTAINER, 'sh', '-c', 'cat /home/bat/.local/bat-server/package.json']).match(/"version"\s*:\s*"([^"]+)"/)?.[1] ?? 'unknown'

  const config = {
    createdBy: 'T0514 t0514-env.mjs',
    distro: opts.distro,
    container: CONTAINER,
    hostname: CONTAINER_HOSTNAME,
    host: '127.0.0.1',
    port: opts.port,
    token,
    fingerprint,
    bundleVersion,
    baseline: { file: base.tarball, version: base.version, sha256: base.sha256 },
    clientWork: CLIENT_WORK,
    serverWork: SERVER_WORK,
    seedSessionId: SEED_SESSION_ID,
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  log(`bat-server ${bundleVersion} at 127.0.0.1:${opts.port} fp=${fingerprint.slice(0, 23)}…`)
  log(`wrote ${CONFIG_PATH}`)
  log("run: $env:BAT_E2E_PRE6_UI='1'; $env:BAT_E2E_EXECUTABLE='C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe'; npx playwright test e2e/pre6-ui-remote-acceptance.spec.ts")
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
  // Keep evidence (screenshots / logs) when the spec wrote it under the state dir.
  if (existsSync(STATE_DIR)) {
    for (const entry of readdirSync(STATE_DIR)) {
      if (entry !== 'evidence') rmSync(path.join(STATE_DIR, entry), { recursive: true, force: true })
    }
  }
  log(`state dir ${STATE_DIR}: ${existsSync(STATE_DIR) ? `kept only ${readdirSync(STATE_DIR).join(', ') || '(empty)'}` : 'absent'}`)
  const left = docker(opts.distro, ['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}}']).trim()
  log(`containers left with ${LABEL}: ${left || 'none'}`)
  const nets = docker(opts.distro, ['network', 'ls', '--filter', `label=${LABEL}`, '--format', '{{.Name}}']).trim()
  const vols = docker(opts.distro, ['volume', 'ls', '--filter', `label=${LABEL}`, '--format', '{{.Name}}']).trim()
  log(`networks with ${LABEL}: ${nets || 'none'}; volumes with ${LABEL}: ${vols || 'none'}`)
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.command === 'up') await up(opts)
  else if (opts.command === 'down') down(opts)
  else if (opts.command === 'status') status(opts)
  else {
    console.log('Usage: node e2e/real-remote/t0514-env.mjs <up|status|down> [--distro Ubuntu-24.04] [--port 29514] [--baseline-dir <dir>] [--rmi]')
    return opts.command === 'help' ? 0 : 1
  }
  return 0
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code }, (err) => {
    console.error(`[t0514-env] ERROR ${err instanceof Error ? err.message : String(err)}`)
    if (err?.stderr) console.error(String(err.stderr).trim())
    process.exitCode = 1
  })
}
