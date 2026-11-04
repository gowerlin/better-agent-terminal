#!/usr/bin/env node
// T0854 (PLAN-052 W5, D283): Docker (c′) acceptance against a real Docker engine, without the
// Electron UI. Calls the main-process docker functions directly (electron/docker-bundle-volume.ts,
// electron/docker-lifecycle.ts) the way the setup wizard's install-server-bundle / start-server steps
// do, then checks the result with plain `docker` reads:
//
//   A  create   pull the base image → not baked in → compat probe → BAT volumes → install bundle
//               <from> → probe the bundled node → bundle version → createBatContainer → healthy →
//               container shape (127.0.0.1 only, no --token, root, --init, label) → token
//               (server-token.json) → cert fingerprint = TLS handshake fingerprint → data dir 0700
//   B  upgrade  install <to> (previous kept) → restart → healthy → version <to>; container id,
//               token, fingerprint and a marker file in the data volume unchanged → discard previous
//   C  rollback install <from> (previous kept) → restart → restore → restart → version <to>, data
//               unchanged; an install aborted after ~1 s leaves the bundle as it was (no .bat-new)
//   D  musl     the compat probe refuses a musl image before anything is created
//   Z  cleanup  container and both volumes removed (removeBatVolume), images pulled here removed
//
// Run (needs tsx, a devDependency, because the main-process modules are TypeScript):
//
//   npx tsx scripts/docker-acceptance.mjs --from <version|tarball> --to <version|tarball> \
//     [--image buildpack-deps:bookworm-scm] [--musl-image alpine:3.20] [--prefix bat-acc-] \
//     [--cache-dir <dir>] [--evidence <file.json>] [--keep-images]
//
// A version is downloaded from the `server-bundle-v<version>` release with the distributor's download
// layer (electron/remote/server-bundle-download.ts: manifest + SHA-256, honours
// BAT_SERVER_BUNDLE_BASE_URL and GITHUB_TOKEN); a path is used as it is. <from> and <to> must differ.
// `.github/workflows/docker-acceptance.yml` runs this on ubuntu-24.04 (workflow_dispatch only).
// Locally on Windows with Docker inside WSL, put the T0743 shim first on PATH
// (e2e/real-remote/t0743-docker-shim.go, T0743_SHIM_ALLOW='^bat-acc-[a-z0-9-]+$',
// T0743_SHIM_JOB_PREFIX=bat-acc-job-); every resource this script creates starts with the prefix
// (volumes: bat-server-<prefix>c1-bundle / -data).
//
// Never prints or writes the server token (only its length and a SHA-256 prefix for comparison).
// Exit code: 0 = no FAIL (WARN allowed), 1 = a FAIL, 2 = usage / preflight error.

import { execFile } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARBALL_RE = /^bat-server-(linux-x64|linux-arm64)-v(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)\.tar\.gz$/
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/

export const DEFAULTS = Object.freeze({
  image: 'buildpack-deps:bookworm-scm', // DEFAULT_DOCKER_BASE_IMAGE, src/components/setup-wizard/steps/docker/base-image.ts
  muslImage: 'alpine:3.20',
  prefix: 'bat-acc-',
})

/** Parses argv; returns `{ error }` on a usage error. Pure (exported for tests). */
export function parseArgs(argv) {
  const opts = { ...DEFAULTS, from: '', to: '', cacheDir: '', evidence: '', keepImages: false }
  const valued = { '--from': 'from', '--to': 'to', '--image': 'image', '--musl-image': 'muslImage', '--prefix': 'prefix', '--cache-dir': 'cacheDir', '--evidence': 'evidence' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--keep-images') { opts.keepImages = true; continue }
    if (a === '--help' || a === '-h') return { help: true }
    const key = valued[a]
    if (!key) return { error: `unknown option ${a}` }
    const v = argv[i + 1]
    if (v === undefined || v.startsWith('--')) return { error: `${a} needs a value` }
    opts[key] = v
    i++
  }
  if (!opts.from || !opts.to) return { error: '--from and --to are required' }
  if (opts.from === opts.to) return { error: '--from and --to must differ (B checks that the version changes)' }
  if (!/^[a-z0-9][a-z0-9-]{0,30}-$/.test(opts.prefix)) return { error: '--prefix must be lower-case letters / digits / dashes ending in "-"' }
  return { opts }
}

/** `AB:CD:…` upper case, whatever the input separator / case. Pure. */
export function normalizeFingerprint(value) {
  const hex = String(value ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase()
  return hex.length === 64 ? hex.match(/../g).join(':') : ''
}

function short(value, n = 12) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, n)
}

function docker(args, timeout = 60_000) {
  return new Promise((resolve) => {
    execFile('docker', args, { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout ?? '').trim(), stderr: String(stderr ?? '').trim(), code: error ? (typeof error.code === 'number' ? error.code : 1) : 0 })
    })
  })
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

function tlsFingerprint(port) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: '127.0.0.1', port, rejectUnauthorized: false, timeout: 10_000 }, () => {
      const fp = socket.getPeerCertificate()?.fingerprint256 ?? ''
      socket.end()
      resolve(fp)
    })
    socket.on('timeout', () => { socket.destroy(); resolve('') })
    socket.on('error', () => resolve(''))
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'))
    return 0
  }
  if (parsed.error) {
    console.error(`docker-acceptance: ${parsed.error}`)
    return 2
  }
  const opts = parsed.opts
  const mod = (p) => import(pathToFileURL(path.join(REPO_ROOT, p)).href)
  const vol = await mod('electron/docker-bundle-volume.ts')
  const life = await mod('electron/docker-lifecycle.ts')
  const dl = await mod('electron/remote/server-bundle-download.ts')

  const results = []
  const evidence = { startedAt: new Date().toISOString(), options: { ...opts }, results, environment: {} }
  const record = (id, status, detail) => {
    results.push({ id, status, detail })
    console.log(`${status.padEnd(4)} ${id}  ${detail}`)
    return status === 'PASS' || status === 'WARN'
  }
  const check = (id, ok, detail) => record(id, ok ? 'PASS' : 'FAIL', detail)

  const container = `${opts.prefix}c1`
  const volumes = vol.batVolumeNames(container)
  const pulledHere = []
  let fatal = false

  // ── preflight ───────────────────────────────────────────────────────────
  const version = await docker(['version', '--format', '{{.Server.Version}}'])
  if (!version.ok) {
    console.error(`docker-acceptance: no Docker engine: ${version.stderr}`)
    return 2
  }
  evidence.environment.dockerServer = version.stdout
  const leftovers = await docker(['ps', '-a', '--filter', `name=${opts.prefix}`, '--format', '{{.Names}}'])
  const leftoverVolumes = await docker(['volume', 'ls', '--filter', `name=${opts.prefix}`, '--format', '{{.Name}}'])
  if (!leftovers.ok || !leftoverVolumes.ok) {
    console.error(`docker-acceptance: cannot list containers / volumes: ${[leftovers.stderr, leftoverVolumes.stderr].filter(Boolean).join(' ')}`)
    return 2
  }
  if (leftovers.stdout || leftoverVolumes.stdout) {
    console.error(`docker-acceptance: leftover ${opts.prefix}* containers / volumes from an earlier run: ${[leftovers.stdout, leftoverVolumes.stdout].filter(Boolean).join(' ')}`)
    return 2
  }
  for (const image of [opts.image, opts.muslImage]) {
    const present = await docker(['image', 'inspect', '--format', '{{.Id}}', image])
    if (!present.ok) pulledHere.push(image)
  }

  const arch = await vol.dockerServerArch()
  if (!check('S1 daemon architecture', arch.ok, arch.ok ? `${arch.arch} (docker ${version.stdout})` : `${arch.errorCode}: ${arch.error}`)) return finish(evidence, opts, 1)

  // ── bundles ─────────────────────────────────────────────────────────────
  const cacheDir = opts.cacheDir || fs.mkdtempSync(path.join(os.tmpdir(), 'bat-docker-acceptance-'))
  async function resolveBundle(spec, label) {
    if (!VERSION_RE.test(spec) || fs.existsSync(spec)) {
      const tarball = path.resolve(spec)
      const m = TARBALL_RE.exec(path.basename(tarball))
      if (!fs.existsSync(tarball) || !m) return { ok: false, detail: `${label}: ${spec} is neither a version nor a bat-server-<arch>-v<version>.tar.gz file` }
      if (m[1] !== arch.arch) return { ok: false, detail: `${label}: ${path.basename(tarball)} is not for ${arch.arch}` }
      return { ok: true, tarball, version: m[2], detail: `${label}: ${path.basename(tarball)} (local file)` }
    }
    const result = await dl.downloadServerBundle({ arch: arch.arch, version: spec, cacheDir })
    if (!result.ok) return { ok: false, detail: `${label}: download ${spec}: ${result.errorCode}: ${result.error}` }
    return { ok: true, tarball: result.tarballPath, version: spec, detail: `${label}: server-bundle-v${spec} ${result.fromCache ? '(cache)' : 'downloaded'}, sha256 ${result.sha256.slice(0, 12)}…, ${result.sizeBytes} B` }
  }
  const from = await resolveBundle(opts.from, 'from')
  const to = await resolveBundle(opts.to, 'to')
  if (!check('S2 bundles', from.ok && to.ok && from.version !== to.version, `${from.detail}; ${to.detail}`)) return finish(evidence, opts, 1)

  const readVersion = async () => {
    const r = await vol.readBundleVersionInVolume({ image: opts.image, bundleVolume: volumes.bundle })
    return r.ok ? r.version : `(error ${r.error})`
  }
  const waitHealthy = async (timeoutMs = 90_000) => {
    const end = Date.now() + timeoutMs
    let last = ''
    while (Date.now() < end) {
      const h = await life.getContainerHealth(container)
      last = h.ok ? h.health : `error ${h.error}`
      if (h.ok && h.health === 'healthy') return 'healthy'
      if (h.ok && h.health === 'unhealthy') return 'unhealthy'
      await sleep(1000)
    }
    return `timeout (${last})`
  }
  const bundleDirListing = async () => (await docker(['run', '--rm', '--network', 'none', '-v', `${volumes.bundle}:/opt/bat:ro`, '--entrypoint', '/bin/sh', opts.image, '-c', 'ls -A /opt/bat'])).stdout.split(/\s+/).filter(Boolean).sort().join(' ')
  const containerId = async () => (await docker(['inspect', '--format', '{{.Id}}', container])).stdout
  const marker = `acceptance-${randomBytes(6).toString('hex')}`
  const readMarker = async () => (await docker(['exec', container, 'cat', `${vol.BAT_CONTAINER_DATA_DIR}/acceptance-marker`])).stdout
  let port = 0
  let baseline = { token: '', fingerprint: '', id: '' }

  const scenarios = async () => {
    // ── A create ──────────────────────────────────────────────────────────
    const pull = await vol.pullImage(opts.image)
    fatal = !check('A1 pull base image', pull.ok, pull.ok ? `${opts.image}: ${pull.status}` : `${pull.errorCode}: ${pull.error}`)
    if (fatal) return
    const baked = await vol.inspectImageBakedBundle(opts.image)
    check('A2 base image has no baked-in server', baked.ok && baked.baked === false, baked.ok ? `baked ${baked.baked} (${baked.reason})` : baked.error)
    const probe = await vol.probeBundleCompat({ image: opts.image })
    fatal = !check('A3 compat probe (before install)', probe.ok, probe.ok ? `${probe.libc} ${probe.glibcVersion ?? ''}` : `${probe.errorCode}: ${probe.error}`)
    if (fatal) return
    const vb = await vol.createBatVolume(volumes.bundle, 'bundle')
    const vd = await vol.createBatVolume(volumes.data, 'data')
    fatal = !check('A4 BAT volumes', vb.ok && vd.ok && vb.created && vd.created, `${volumes.bundle} ${vb.ok ? `created ${vb.created}` : vb.error}; ${volumes.data} ${vd.ok ? `created ${vd.created}` : vd.error}`)
    if (fatal) return
    const labels = await docker(['volume', 'inspect', '--format', '{{json .Labels}}', volumes.bundle])
    check('A4b volume labels', /"bat\.server":"1"/.test(labels.stdout) && /"bat\.server\.volume":"bundle"/.test(labels.stdout), labels.stdout)
    const install1 = await vol.installBundleIntoVolume({ image: opts.image, bundleVolume: volumes.bundle, dataVolume: volumes.data, tarballPath: from.tarball, keepPrevious: true })
    fatal = !check('A5 install <from> into the bundle volume', install1.ok && install1.previous === 'none', install1.ok ? `previous ${install1.previous}` : `${install1.errorCode}: ${install1.error}`)
    if (fatal) return
    const probe2 = await vol.probeBundleCompat({ image: opts.image, bundleVolume: volumes.bundle })
    check('A6 compat probe (bundled node runs)', probe2.ok && probe2.nodeChecked === true, probe2.ok ? `nodeChecked ${probe2.nodeChecked}` : `${probe2.errorCode}: ${probe2.error}`)
    const v1 = await readVersion()
    check('A7 bundle version', v1 === from.version, `${v1} (expected ${from.version})`)

    port = await freePort()
    const created = await vol.createBatContainer(container, { image: opts.image, port, bundleVolume: volumes.bundle, dataVolume: volumes.data, restartPolicy: 'unless-stopped' })
    fatal = !check('A8 createBatContainer', created.ok, created.ok ? `${container} on 127.0.0.1:${port}` : created.error)
    if (fatal) return
    const h1 = await waitHealthy()
    fatal = !check('A9 healthy', h1 === 'healthy', h1)
    if (fatal) {
      const logs = await docker(['logs', '--tail', '40', container])
      evidence.containerLogs = `${logs.stdout}\n${logs.stderr}`.slice(-4000)
      return
    }
    const shape = JSON.parse((await docker(['inspect', container])).stdout || '[{}]')[0] ?? {}
    const cmd = [...(shape.Config?.Entrypoint ?? []), ...(shape.Config?.Cmd ?? [])]
    const bindings = shape.HostConfig?.PortBindings ?? {}
    const env = shape.Config?.Env ?? []
    const shapeOk = shape.Config?.User === vol.BAT_CONTAINER_USER
      && (shape.Config?.Entrypoint ?? [])[0] === vol.BAT_BUNDLE_SERVER_BIN
      && !cmd.some((a) => /token/i.test(a)) && !env.some((e) => /token/i.test(e))
      && JSON.stringify(bindings) === JSON.stringify({ '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: String(port) }] })
      && shape.HostConfig?.Init === true && shape.Config?.Labels?.['bat.server'] === '1'
      && shape.Config?.Image === opts.image
    check('A10 container shape', shapeOk, `User ${shape.Config?.User}; Entrypoint ${JSON.stringify(shape.Config?.Entrypoint)}; Cmd ${JSON.stringify(shape.Config?.Cmd)}; PortBindings ${JSON.stringify(bindings)}; Init ${shape.HostConfig?.Init}; label bat.server=${shape.Config?.Labels?.['bat.server']}; token in Cmd/Env ${cmd.some((a) => /token/i.test(a)) || env.some((e) => /token/i.test(e))}`)
    const token = await life.readServerToken(container)
    fatal = !check('A11 server token (no --token)', token.ok && token.source === 'file', token.ok ? `source ${token.source}, length ${token.token.length}, sha256 ${short(token.token)}…` : `${token.errorCode}: ${token.error}`)
    if (fatal) return
    const certFp = await vol.readServerCertFingerprint(container)
    const handshake = normalizeFingerprint(await tlsFingerprint(port))
    check('A12 cert fingerprint = TLS handshake fingerprint', certFp.ok && normalizeFingerprint(certFp.fingerprint) === handshake && handshake !== '', `server-cert.json ${certFp.ok ? normalizeFingerprint(certFp.fingerprint).slice(0, 23) : certFp.error}…; handshake ${handshake.slice(0, 23)}…`)
    const perms = await docker(['exec', container, 'stat', '-c', '%a %U %n', vol.BAT_CONTAINER_DATA_DIR, `${vol.BAT_CONTAINER_DATA_DIR}/server-token.json`, `${vol.BAT_CONTAINER_DATA_DIR}/server-cert.json`])
    check('A13 data dir 0700, token / cert 0600, root', /^700 root /m.test(perms.stdout) && (perms.stdout.match(/^600 root /gm) ?? []).length === 2, perms.stdout.replace(/\n/g, '; '))
    await docker(['exec', container, 'sh', '-c', `echo ${marker} > ${vol.BAT_CONTAINER_DATA_DIR}/acceptance-marker`])
    baseline = { token: short(token.token, 64), fingerprint: handshake, id: await containerId() }

    const sameData = async () => {
      const t = await life.readServerToken(container)
      const fp = normalizeFingerprint(await tlsFingerprint(port))
      const id = await containerId()
      const m = await readMarker()
      return { ok: t.ok && short(t.token, 64) === baseline.token && fp === baseline.fingerprint && id === baseline.id && m === marker, detail: `token same ${t.ok && short(t.token, 64) === baseline.token}, fingerprint same ${fp === baseline.fingerprint}, container id same ${id === baseline.id}, marker kept ${m === marker}` }
    }

    // ── B upgrade ─────────────────────────────────────────────────────────
    const install2 = await vol.installBundleIntoVolume({ image: opts.image, bundleVolume: volumes.bundle, tarballPath: to.tarball, keepPrevious: true })
    check('B1 install <to> (previous kept)', install2.ok && install2.previous === 'kept', install2.ok ? `previous ${install2.previous}` : `${install2.errorCode}: ${install2.error}`)
    const r1 = await life.restartContainer(container)
    const h2 = r1.ok ? await waitHealthy() : `restart failed: ${r1.error}`
    check('B2 restart → healthy', h2 === 'healthy', h2)
    const v2 = await readVersion()
    check('B3 version after upgrade', v2 === to.version, `${v2} (expected ${to.version})`)
    const same2 = await sameData()
    check('B4 container / token / fingerprint / data unchanged', same2.ok, same2.detail)
    const discard = await vol.discardPreviousBundleInVolume({ image: opts.image, bundleVolume: volumes.bundle })
    const listing2 = await bundleDirListing()
    check('B5 discard previous', discard.ok && listing2 === 'server', `${discard.ok ? 'ok' : discard.error}; /opt/bat: ${listing2}`)

    // ── C rollback ────────────────────────────────────────────────────────
    const install3 = await vol.installBundleIntoVolume({ image: opts.image, bundleVolume: volumes.bundle, tarballPath: from.tarball, keepPrevious: true })
    const r2 = await life.restartContainer(container)
    const h3 = r2.ok ? await waitHealthy() : `restart failed: ${r2.error}`
    check('C1 install <from> again + restart', install3.ok && install3.previous === 'kept' && h3 === 'healthy' && (await readVersion()) === from.version, `${install3.ok ? `previous ${install3.previous}` : install3.error}; ${h3}`)
    const restore = await vol.restoreBundleInVolume({ image: opts.image, bundleVolume: volumes.bundle })
    const r3 = await life.restartContainer(container)
    const h4 = r3.ok ? await waitHealthy() : `restart failed: ${r3.error}`
    const v4 = await readVersion()
    check('C2 restore → restart → previous bundle back', restore.ok && restore.outcome === 'restored' && h4 === 'healthy' && v4 === to.version, `${restore.ok ? restore.outcome : restore.error}; ${h4}; version ${v4}`)
    const same4 = await sameData()
    check('C3 data unchanged after rollback', same4.ok, same4.detail)
    const restoreAgain = await vol.restoreBundleInVolume({ image: opts.image, bundleVolume: volumes.bundle })
    check('C4 restore with nothing kept', restoreAgain.ok && restoreAgain.outcome === 'missing', restoreAgain.ok ? restoreAgain.outcome : restoreAgain.error)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1000)
    const aborted = await vol.installBundleIntoVolume({ image: opts.image, bundleVolume: volumes.bundle, tarballPath: from.tarball, keepPrevious: true, signal: controller.signal })
    clearTimeout(timer)
    if (!aborted.ok && aborted.previous === 'kept') await vol.restoreBundleInVolume({ image: opts.image, bundleVolume: volumes.bundle })
    if (aborted.ok && aborted.previous === 'kept') await vol.restoreBundleInVolume({ image: opts.image, bundleVolume: volumes.bundle })
    const listing5 = await bundleDirListing()
    const v5 = await readVersion()
    const jobs = await docker(['ps', '-a', '--filter', 'name=bat-bundle-job-', '--filter', `name=${opts.prefix}job-`, '--format', '{{.Names}}'])
    if (aborted.ok) {
      record('C5 aborted install leaves the bundle as it was', 'WARN', `the install finished before the abort (1 s); restored; /opt/bat: ${listing5}; version ${v5}`)
    } else {
      check('C5 aborted install leaves the bundle as it was', aborted.errorCode === 'docker-install-aborted' && listing5 === 'server' && v5 === to.version && !jobs.stdout, `${aborted.errorCode}; /opt/bat: ${listing5}; version ${v5}; leftover jobs: ${jobs.stdout || 'none'}`)
    }

    // ── D musl ────────────────────────────────────────────────────────────
    const muslPull = await vol.pullImage(opts.muslImage)
    const musl = muslPull.ok ? await vol.probeBundleCompat({ image: opts.muslImage }) : null
    check('D1 musl image refused by the probe', !!musl && !musl.ok && musl.errorCode === 'docker-compat-musl', muslPull.ok ? (musl.ok ? `unexpected ok (${musl.libc})` : musl.errorCode) : `pull ${muslPull.errorCode}: ${muslPull.error}`)
  }
  try {
    await scenarios()
  } finally {
    // ── Z cleanup ─────────────────────────────────────────────────────────
    const rm = await docker(['rm', '-f', container])
    const rb = await vol.removeBatVolume(volumes.bundle)
    const rd = await vol.removeBatVolume(volumes.data)
    const images = []
    if (!opts.keepImages) {
      for (const image of pulledHere) {
        const rmi = await docker(['rmi', image])
        images.push(`${image} ${rmi.ok ? 'removed' : `NOT removed (${rmi.stderr.split(/\r?\n/)[0]})`}`)
      }
    }
    const left = await docker(['ps', '-a', '--filter', `name=${opts.prefix}`, '--format', '{{.Names}}'])
    const leftVol = await docker(['volume', 'ls', '--filter', `name=${opts.prefix}`, '--format', '{{.Name}}'])
    check('Z1 cleanup', left.ok && leftVol.ok && !left.stdout && !leftVol.stdout && rb.ok && rd.ok, `container ${rm.ok ? 'removed' : 'absent'}; ${volumes.bundle} ${rb.ok ? `removed ${rb.removed}` : rb.error}; ${volumes.data} ${rd.ok ? `removed ${rd.removed}` : rd.error}; images ${images.join(', ') || 'kept (--keep-images) or none pulled'}; leftovers: ${left.ok && leftVol.ok ? ([left.stdout, leftVol.stdout].filter(Boolean).join(' ') || 'none') : `cannot list (${[left.stderr, leftVol.stderr].filter(Boolean).join(' ')})`}`)
    if (!opts.cacheDir) fs.rmSync(cacheDir, { recursive: true, force: true })
  }
  return finish(evidence, opts, results.some((r) => r.status === 'FAIL') ? 1 : 0)
}

function finish(evidence, opts, code) {
  evidence.finishedAt = new Date().toISOString()
  evidence.exitCode = code
  const counts = evidence.results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  console.log(`\ndocker-acceptance: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')} → exit ${code}`)
  if (opts.evidence) {
    fs.mkdirSync(path.dirname(path.resolve(opts.evidence)), { recursive: true })
    fs.writeFileSync(opts.evidence, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  return code
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code }, (error) => {
    console.error(`docker-acceptance: ${error?.stack ?? error}`)
    process.exitCode = 1
  })
}
