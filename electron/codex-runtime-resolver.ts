// BUG-083 / T0373 — pick the newest Codex CLI among the binaries installed on this machine.
//
// A newer Codex (official installer, Desktop App, PATH) may write `~/.codex/config.toml` values an
// older binary cannot parse (T0366 H3), so BAT runs whichever candidate reports the highest
// `codex-cli X.Y.Z`. Candidates whose version cannot be read are skipped; if none can be read the
// bundled binary is used. `BAT_CODEX_BIN` is handled by the caller and never compared.

import { execFile } from 'child_process'
import { promises as fs, statSync, accessSync, readdirSync, constants as fsConstants } from 'fs'
import os from 'os'
import * as pathModule from 'path'
import type { BundledCodexLayout } from './codex-bundled-path'

export type CodexCandidateSource = 'path' | 'installer' | 'desktop-app' | 'embedded'

export interface CodexCandidate {
  path: string
  source: CodexCandidateSource
  version?: string
  /** Helper dirs to prepend to the child PATH; non-empty only for `embedded` (T0369). */
  pathDirs: string[]
}

// ── pure helpers ──────────────────────────────────────────────────────────────

const VERSION_RE = /codex-cli\s+v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/i
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** Parse `codex-cli X.Y.Z[-suffix]` out of `codex --version` output. */
export function parseCodexVersion(stdout: string): string | undefined {
  return VERSION_RE.exec(stdout)?.[1]
}

function comparePrerelease(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (i >= pa.length) return -1
    if (i >= pb.length) return 1
    const na = /^\d+$/.test(pa[i]) ? Number(pa[i]) : undefined
    const nb = /^\d+$/.test(pb[i]) ? Number(pb[i]) : undefined
    if (na !== undefined && nb !== undefined) {
      if (na !== nb) return na < nb ? -1 : 1
    } else if (na !== undefined) {
      return -1 // numeric identifiers sort before alphanumeric ones
    } else if (nb !== undefined) {
      return 1
    } else if (pa[i] !== pb[i]) {
      return pa[i] < pb[i] ? -1 : 1
    }
  }
  return 0
}

/**
 * Semver comparison (negative / 0 / positive). A pre-release sorts below its release
 * (`0.160.0-alpha.1` < `0.160.0`). Unparsable strings sort below every valid version.
 */
export function compareCodexVersions(a: string, b: string): number {
  const ma = SEMVER_RE.exec(a.trim())
  const mb = SEMVER_RE.exec(b.trim())
  if (!ma || !mb) return (ma ? 1 : 0) - (mb ? 1 : 0)
  for (let i = 1; i <= 3; i++) {
    const diff = Number(ma[i]) - Number(mb[i])
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  const pa = ma[4]
  const pb = mb[4]
  if (pa === undefined && pb === undefined) return 0
  if (pa === undefined) return 1
  if (pb === undefined) return -1
  return comparePrerelease(pa, pb)
}

// On a version tie: the bundled binary was validated against the SDK it ships with.
const SOURCE_RANK: Record<CodexCandidateSource, number> = {
  embedded: 0,
  installer: 1,
  'desktop-app': 2,
  path: 3,
}

/**
 * Newest candidate by version; ties prefer embedded > installer > desktop-app > path, then the
 * earlier candidate. Candidates without a version are ignored. When no candidate has a version,
 * returns the embedded one if present, otherwise the first candidate.
 */
export function pickNewestCodex<T extends CodexCandidate>(candidates: T[]): T | undefined {
  let best: T | undefined
  for (const candidate of candidates) {
    if (!candidate.version) continue
    if (!best) {
      best = candidate
      continue
    }
    const cmp = compareCodexVersions(candidate.version, best.version!)
    if (cmp > 0 || (cmp === 0 && SOURCE_RANK[candidate.source] < SOURCE_RANK[best.source])) {
      best = candidate
    }
  }
  if (best) return best
  return candidates.find(c => c.source === 'embedded') ?? candidates[0]
}

// ── candidate discovery ───────────────────────────────────────────────────────

export interface CodexCandidateEnv {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  homedir: string
  /** True for an existing, runnable file. */
  isExecutableFile: (p: string) => boolean
  /** Sub-directory names of `dir`; empty when it does not exist. */
  listDirs: (dir: string) => string[]
}

function getPathValue(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  if (platform !== 'win32') return env.PATH ?? ''
  // Windows env keys are case-insensitive; a copied env may carry `Path` or `PATH`.
  const key = Object.keys(env).find(k => k.toLowerCase() === 'path')
  return key ? env[key] ?? '' : ''
}

/**
 * `codex` executables on PATH, in PATH order. Same rules as the former `findCodexOnPath()`:
 * npm shims (`.cmd` / `.bat` / `.ps1`, and anything under `node_modules/.bin`) cannot be spawned
 * directly, so on Windows only `codex.exe` is accepted. Scans PATH itself instead of shelling
 * out to `where` / `command -v`.
 */
export function findCodexOnPathDirs(deps: CodexCandidateEnv): string[] {
  const exe = deps.platform === 'win32' ? 'codex.exe' : 'codex'
  const delimiter = deps.platform === 'win32' ? ';' : ':'
  const found: string[] = []
  for (const rawDir of getPathValue(deps.env, deps.platform).split(delimiter)) {
    const dir = rawDir.trim().replace(/^"(.*)"$/, '$1')
    if (!dir) continue
    if (/[\\/]node_modules[\\/]\.bin[\\/]?$/i.test(dir)) continue
    const candidate = (deps.platform === 'win32' ? pathModule.win32 : pathModule.posix).join(dir, exe)
    if (deps.isExecutableFile(candidate)) found.push(candidate)
  }
  return found
}

function getLocalAppData(deps: CodexCandidateEnv): string {
  const value = deps.env.LOCALAPPDATA?.trim()
  return value || pathModule.win32.join(deps.homedir, 'AppData', 'Local')
}

/**
 * Every candidate binary, deduplicated by path (case-insensitive on Windows). Order: embedded,
 * official installer, Desktop App, PATH — so a PATH entry that is the installer's own `bin` dir
 * keeps the more specific `installer` label. Installer / Desktop App locations are Windows-only.
 */
export function collectCodexCandidates(embedded: BundledCodexLayout | undefined, deps: CodexCandidateEnv): CodexCandidate[] {
  const out: CodexCandidate[] = []
  const seen = new Set<string>()
  const add = (path: string, source: CodexCandidateSource, pathDirs: string[] = []) => {
    const key = deps.platform === 'win32' ? pathModule.win32.normalize(path).toLowerCase() : pathModule.posix.normalize(path)
    if (seen.has(key)) return
    seen.add(key)
    out.push({ path, source, pathDirs })
  }

  if (embedded) add(embedded.binary, 'embedded', embedded.pathDirs)

  if (deps.platform === 'win32') {
    const localAppData = getLocalAppData(deps)
    const installer = pathModule.win32.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')
    if (deps.isExecutableFile(installer)) add(installer, 'installer')

    // The Desktop App keeps one `<hash>` directory per bundled CLI build.
    const desktopRoot = pathModule.win32.join(localAppData, 'OpenAI', 'Codex', 'bin')
    for (const name of [...deps.listDirs(desktopRoot)].sort()) {
      const exe = pathModule.win32.join(desktopRoot, name, 'codex.exe')
      if (deps.isExecutableFile(exe)) add(exe, 'desktop-app')
    }
  }

  for (const onPath of findCodexOnPathDirs(deps)) add(onPath, 'path')
  return out
}

function defaultCandidateEnv(): CodexCandidateEnv {
  return {
    platform: process.platform,
    env: process.env,
    homedir: os.homedir(),
    isExecutableFile: (p: string) => {
      try {
        if (!statSync(p).isFile()) return false
        if (process.platform !== 'win32') accessSync(p, fsConstants.X_OK)
        return true
      } catch {
        return false
      }
    },
    listDirs: (dir: string) => {
      try {
        return readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
      } catch {
        return []
      }
    },
  }
}

// ── version probe ─────────────────────────────────────────────────────────────

const VERSION_TIMEOUT_MS = 5000

// Keyed by path + mtime: an in-place upgrade (installer / `codex update`) changes the mtime and is
// re-probed without restarting BAT, while unchanged binaries are probed once per process.
const versionCache = new Map<string, Promise<string | undefined>>()

function runVersion(bin: string): Promise<string | undefined> {
  return new Promise(resolve => {
    try {
      execFile(bin, ['--version'], { timeout: VERSION_TIMEOUT_MS, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
        if (err) {
          resolve(undefined)
          return
        }
        resolve(parseCodexVersion(`${stdout}\n${stderr}`))
      })
    } catch {
      // spawn can throw synchronously (e.g. EFTYPE on Windows for a non-executable file).
      resolve(undefined)
    }
  })
}

/** `codex --version` of `bin`, or `undefined` when it cannot be run or parsed. Never throws. */
export async function probeCodexVersion(bin: string): Promise<string | undefined> {
  let mtime: number
  try {
    mtime = (await fs.stat(bin)).mtimeMs
  } catch {
    return undefined
  }
  const key = `${bin}\0${mtime}`
  let pending = versionCache.get(key)
  if (!pending) {
    pending = runVersion(bin)
    versionCache.set(key, pending)
  }
  return pending
}

export interface CodexRuntimeResolution {
  selected?: CodexCandidate
  candidates: CodexCandidate[]
}

/** Collect every candidate, read their versions in parallel, and pick the newest. */
export async function resolveCodexRuntime(
  embedded: BundledCodexLayout | undefined,
  deps: CodexCandidateEnv = defaultCandidateEnv(),
): Promise<CodexRuntimeResolution> {
  const found = collectCodexCandidates(embedded, deps)
  const candidates = await Promise.all(found.map(async c => ({ ...c, version: await probeCodexVersion(c.path) })))
  return { selected: pickNewestCodex(candidates), candidates }
}
