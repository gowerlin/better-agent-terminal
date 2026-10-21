/**
 * T0548 — where the real-remote e2e tooling finds a server bundle tarball.
 *
 * D146 / T0547: installers no longer ship resources/bat-server-baseline, so the env scripts
 * (t0514 / t0515 / t0520) and the pre5 / pre6 / pre7 specs can no longer assume the installed
 * BAT has one. Lookup order (first hit wins):
 *
 *   1. explicit   --baseline-dir / BAT_E2E_PRE5_SSH_BUNDLE_DIR / BAT_E2E_BASELINE_DIR
 *                 (a directory with manifest.json, or with bat-server-<arch>-v<ver>.tar.gz +
 *                 .sha256). An explicit directory that has neither is an error, never skipped.
 *   2. dist-baseline   <repo>/dist-baseline/ — what `npm run fetch:baseline` writes
 *   3. userdata-cache  <appData>/BetterAgentTerminal/bat-server-bundles/ — tarballs with a
 *                      .sha256 sidecar (wizard download / import, T0547)
 *   4. installed       resources/bat-server-baseline of a pre-T0547 install
 *
 * Nothing found → an Error whose message says to run `npm run fetch:baseline`.
 *
 * Only reads files; never downloads, never hashes (callers that need the actual SHA-256 hash
 * the returned tarball themselves, as t0520-env.mjs does).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const BASELINE_ARCH = 'linux-x64'
export const BASELINE_ARCHS = ['linux-x64', 'linux-arm64', 'darwin-arm64']
/** Generic override for every real-remote env script / spec. */
export const BASELINE_DIR_ENV = 'BAT_E2E_BASELINE_DIR'

const FILENAME_RE = /^bat-server-(linux-x64|linux-arm64|darwin-arm64)-v(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)\.tar\.gz$/
const SHA256_RE = /^[a-f0-9]{64}$/
const FETCH_HINT = 'run `npm run fetch:baseline` (writes dist-baseline/), or pass --baseline-dir <dir> / set '
  + `${BASELINE_DIR_ENV} to a directory with manifest.json + the tarball (or a tarball + its .sha256)`

/** `<appData>/BetterAgentTerminal/bat-server-bundles` (BUG-119 single userData directory). */
export function defaultUserDataBundleDirs({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  let appData
  if (platform === 'win32') appData = env.APPDATA || path.join(home, 'AppData', 'Roaming')
  else if (platform === 'darwin') appData = path.join(home, 'Library', 'Application Support')
  else appData = env.XDG_CONFIG_HOME || path.join(home, '.config')
  return [path.join(appData, 'BetterAgentTerminal', 'bat-server-bundles')]
}

/**
 * resources/bat-server-baseline of a pre-T0547 Windows install: next to BAT_E2E_EXECUTABLE when
 * given, then the per-machine and per-user (NSIS perMachine: false) default locations.
 */
export function defaultInstalledBaselineDirs({ env = process.env, platform = process.platform, executable = env.BAT_E2E_EXECUTABLE } = {}) {
  // T0684 (D178): path rules follow the injected platform (on Windows `path === path.win32`)
  const p = platform === 'win32' ? path.win32 : path
  const dirs = []
  if (executable) dirs.push(p.join(p.dirname(executable), 'resources', 'bat-server-baseline'))
  if (platform === 'win32') {
    dirs.push(p.join(env.ProgramFiles || 'C:\\Program Files', 'BetterAgentTerminal', 'resources', 'bat-server-baseline'))
    if (env.LOCALAPPDATA) dirs.push(p.join(env.LOCALAPPDATA, 'Programs', 'BetterAgentTerminal', 'resources', 'bat-server-baseline'))
  }
  return [...new Set(dirs)]
}

/** sha256sum line `<hex>  <name>` (or bare `<hex>`); the name, when present, must match. */
function readSidecar(file, expectedName) {
  let text
  try {
    if (statSync(file).size > 4096) return null
    text = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length !== 1) return null
  const m = /^([A-Fa-f0-9]{64})(?:\s+\*?(.+))?$/.exec(lines[0])
  if (!m) return null
  if (m[2] !== undefined && path.basename(m[2].trim()) !== expectedName) return null
  return m[1].toLowerCase()
}

function fileSize(file) {
  try {
    const st = statSync(file)
    return st.isFile() ? st.size : -1
  } catch {
    return -1
  }
}

/** A directory with manifest.json listing `arch`, and that tarball present. */
function fromManifestDir(dir, arch) {
  const manifestPath = path.join(dir, 'manifest.json')
  if (!existsSync(manifestPath)) return { miss: 'no manifest.json' }
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    return { miss: `manifest.json unreadable (${err.message})` }
  }
  const entry = manifest?.tarballs?.[arch]
  if (!entry?.filename || !SHA256_RE.test(String(entry.sha256 ?? ''))) return { miss: `manifest.json has no valid ${arch} entry` }
  const tarball = path.join(dir, entry.filename)
  const size = fileSize(tarball)
  if (size < 0) return { miss: `${entry.filename} listed but missing` }
  return {
    hit: { dir, tarball, filename: entry.filename, version: String(manifest.version), sha256: entry.sha256, size, manifestPath, manifest },
  }
}

/**
 * Tarballs with a matching .sha256 sidecar. Several versions → `preferVersion` if present,
 * else the most recently modified one.
 */
function fromSidecarDir(dir, arch, preferVersion) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return { miss: 'directory missing' }
  }
  const found = []
  for (const name of names) {
    const m = FILENAME_RE.exec(name)
    if (!m || m[1] !== arch) continue
    const tarball = path.join(dir, name)
    const size = fileSize(tarball)
    if (size <= 0) continue
    const sha256 = readSidecar(`${tarball}.sha256`, name)
    if (!sha256) continue
    found.push({ dir, tarball, filename: name, version: m[2], sha256, size, manifestPath: null, manifest: null, mtimeMs: statSync(tarball).mtimeMs })
  }
  if (found.length === 0) return { miss: `no ${arch} tarball with a .sha256 sidecar` }
  const preferred = preferVersion ? found.find(f => f.version === preferVersion) : undefined
  const pick = preferred ?? found.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
  const { mtimeMs: _mtime, ...hit } = pick
  return { hit }
}

function fromDir(dir, arch, preferVersion) {
  const byManifest = fromManifestDir(dir, arch)
  if (byManifest.hit) return byManifest
  const bySidecar = fromSidecarDir(dir, arch, preferVersion)
  if (bySidecar.hit) return bySidecar
  return { miss: `${byManifest.miss}; ${bySidecar.miss}` }
}

/** `0.6.1-pre.3-local.261016014531` / `0.6.1-pre.3.local.…` → `0.6.1-pre.3` (snapshot-version.ts). */
export function baseVersion(version) {
  return typeof version === 'string' ? version.replace(/[-.]local\.\d+$/, '') : version
}

/** Version in <repoRoot>/package.json, snapshot suffix removed; undefined when unreadable. */
export function repoBaseVersion(repoRoot) {
  try {
    return baseVersion(JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version)
  } catch {
    return undefined
  }
}

/**
 * @param {object} opts
 * @param {string} [opts.explicitDir]   --baseline-dir or a spec-specific env value
 * @param {string} [opts.explicitLabel] how the explicit dir was given, for messages
 * @param {string} opts.repoRoot
 * @param {string} [opts.arch]          default linux-x64
 * @param {string} [opts.preferVersion] for the userData cache (default: repo package.json version)
 * @param {string[]} [opts.userDataDirs] default defaultUserDataBundleDirs()
 * @param {string[]} [opts.installedDirs] default defaultInstalledBaselineDirs()
 * @param {Record<string,string|undefined>} [opts.env]
 * @returns {{ kind: 'explicit'|'dist-baseline'|'userdata-cache'|'installed', dir: string, tarball: string,
 *   filename: string, version: string, sha256: string, size: number, manifestPath: string|null,
 *   manifest: object|null, tried: string[] }}
 */
export function resolveBaselineSource(opts) {
  const env = opts.env ?? process.env
  const arch = opts.arch ?? BASELINE_ARCH
  const preferVersion = opts.preferVersion ?? repoBaseVersion(opts.repoRoot)
  const explicitDir = opts.explicitDir || env[BASELINE_DIR_ENV] || ''
  const explicitLabel = opts.explicitDir ? (opts.explicitLabel ?? 'explicit directory') : BASELINE_DIR_ENV

  if (explicitDir) {
    const r = fromDir(explicitDir, arch, preferVersion)
    if (r.hit) return { kind: 'explicit', ...r.hit, tried: [`explicit ${explicitDir}`] }
    throw new Error(`${explicitLabel} ${explicitDir}: ${r.miss} (needs manifest.json listing ${arch}, or bat-server-${arch}-v<version>.tar.gz + .sha256)`)
  }

  const tried = []
  const candidates = [
    ['dist-baseline', [path.join(opts.repoRoot, 'dist-baseline')], dir => fromManifestDir(dir, arch)],
    ['userdata-cache', opts.userDataDirs ?? defaultUserDataBundleDirs({ env }), dir => fromSidecarDir(dir, arch, preferVersion)],
    ['installed', opts.installedDirs ?? defaultInstalledBaselineDirs({ env }), dir => fromManifestDir(dir, arch)],
  ]
  for (const [kind, dirs, lookup] of candidates) {
    for (const dir of dirs) {
      const r = lookup(dir)
      if (r.hit) return { kind, ...r.hit, tried: [...tried, `${kind} ${dir}`] }
      tried.push(`${kind} ${dir}: ${r.miss}`)
    }
  }
  throw new Error(`no ${arch} server bundle tarball found; ${FETCH_HINT}.\nTried:\n  ${tried.join('\n  ')}`)
}

/** One line for logs: `dist-baseline D:\…\bat-server-linux-x64-v0.6.1.tar.gz (v0.6.1, sha256 1234abcd…)`. */
export function describeBaselineSource(source) {
  return `${source.kind} ${source.tarball} (v${source.version}, sha256 ${source.sha256.slice(0, 16)}…)`
}

/**
 * What a local HTTP mirror (BAT_SERVER_BUNDLE_BASE_URL) has to serve for `source`: the source's
 * own manifest when it has one, else a manifest synthesised from the tarball + sidecar. The
 * download module's manifest schema requires all three targets; targets the source does not
 * have get a placeholder entry whose file is not served (404), so only `source`'s arch works.
 *
 * @returns {{ manifest: object, files: Map<string, string> }} files: served name → absolute path
 */
export function bundleMirrorContent(source, { now = new Date() } = {}) {
  const files = new Map()
  if (source.manifest) {
    for (const entry of Object.values(source.manifest.tarballs ?? {})) {
      if (entry?.filename) files.set(entry.filename, path.join(source.dir, entry.filename))
    }
    return { manifest: source.manifest, files }
  }
  const archOfSource = FILENAME_RE.exec(source.filename)?.[1] ?? BASELINE_ARCH
  const tarballs = {}
  for (const arch of BASELINE_ARCHS) {
    tarballs[arch] = arch === archOfSource
      ? { filename: source.filename, sha256: source.sha256, size: source.size }
      : { filename: `bat-server-${arch}-v${source.version}.tar.gz`, sha256: '0'.repeat(64), size: 1 }
  }
  files.set(source.filename, source.tarball)
  return { manifest: { schemaVersion: '1', version: source.version, buildDate: now.toISOString(), tarballs }, files }
}
