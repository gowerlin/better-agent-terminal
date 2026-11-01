/**
 * PLAN-047 M1b-2 / T0621 (D158, contract C-5): whether the codex a helper dispatch launches writes
 * OSC 7501 (`>= 0.163.0`, src/lib/codex-terminal-state.ts). Then the dispatched Worker is recorded
 * `blockedDetection: osc` at launch, so `agentStarted` reads `false` until its first OSC 7501 and
 * `--wait-started` can answer `unconfirmed`; otherwise it stays `none` (`started: unknown`, never
 * `unconfirmed`) until a sequence is actually seen.
 *
 * Dispatch only (`createAgentPromptCommandBuilder`); tabs the user opens are never probed. Runs on
 * the host that runs the PTY (Electron main / headless bat-server).
 *
 * The binary: the launch command's first word. `codex` = the first PATH directory holding a codex
 * (what the tab's shell runs, assuming its PATH is this process's); on Windows a `codex.exe` there is
 * probed as it is. T0758 / BUG-189: when that directory holds only an npm shim (`codex.cmd` / `.ps1` /
 * `.bat`, which cannot run without a shell), the shim is read, not run: it must start
 * `<dir>\…\@openai\codex\bin\codex.js`, and the native `codex.exe` that codex.js would spawn is found
 * the way codex.js finds it (`@openai/codex-win32-<arch>/vendor/<triple>/bin/codex.exe` by Node module
 * resolution from the package, then `<package>/vendor/…`); that `codex.exe` is probed. Anything else
 * (another launcher, no native binary) stays unknown. An absolute path (a custom CLI) is probed as it
 * is (Windows: an `.exe`, or an npm shim resolved the same way); anything else is unknown.
 *
 * `codex --version` through `execFile` (array args, no shell), timeout 5 s. Cached by path + mtime
 * (an in-place upgrade is probed again; for an npm shim the path is the native `codex.exe`); only a
 * parsed version is cached, a failure is probed again next time. One log line per check:
 * `[codex-version] path=<…> version=<x.y.z|unknown> (cached|probed)`, plus ` via=<shim>` for an npm shim.
 *
 * T0651 / BUG-159: the same probe (`createCodexVersionReader`) answers whether the codex a tab
 * launches knows `--no-daemon` (`>= 0.156.0`, `createCodexNoDaemonSupportCheck`), asked by
 * `agent:bat-mcp-launch-args` (electron/bat-mcp-launch.ts) only for a codex tab without BAT MCP.
 *
 * 🔴 No `electron` import (headless uses it).
 */
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as pathModule from 'path'
import { codexVersionWritesOsc } from '../src/lib/codex-terminal-state'

export const CODEX_VERSION_TIMEOUT_MS = 5_000

export type ExecFileLike = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean; encoding: 'utf8' },
  callback: (error: Error | null, stdout: string, stderr: string) => void,
) => unknown

export interface CodexOscVersionDeps {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  /** True for an existing regular file. */
  isFile?(p: string): boolean
  /** The file's mtime (ms), or null. */
  mtimeMs?(p: string): number | null
  /** T0758: a small text file's contents (an npm shim), or null. */
  readFile?(p: string): string | null
  /** T0758: the canonical path (pnpm links the package), or `p` itself. */
  realpath?(p: string): string
  /** T0758: `process.arch`; picks the native package of an npm shim first (the other arch is tried next). */
  arch?: string
  execFile?: ExecFileLike
  logger?: { log(message: string): void }
}

function pathValue(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  if (platform !== 'win32') return env.PATH ?? ''
  const key = Object.keys(env).find(k => k.toLowerCase() === 'path')
  return key ? env[key] ?? '' : ''
}

const WINDOWS_CODEX_NAMES = ['codex.exe', 'codex.cmd', 'codex.bat', 'codex.ps1', 'codex.com']

/** npm shims, in the order they are read (all shims of one install point at the same codex.js). */
const WINDOWS_SHIM_NAMES = ['codex.cmd', 'codex.ps1', 'codex.bat']

/** codex.js's own table (`PLATFORM_PACKAGE_BY_TARGET`, @openai/codex 0.166.0 bin/codex.js), Windows rows. */
const WINDOWS_CODEX_TARGETS: Record<string, { triple: string; pkg: string }> = {
  x64: { triple: 'x86_64-pc-windows-msvc', pkg: 'codex-win32-x64' },
  arm64: { triple: 'aarch64-pc-windows-msvc', pkg: 'codex-win32-arm64' },
}

/** The quoted `.js` an npm / pnpm cmd-shim or ps1 shim starts, relative to the shim's directory. */
const SHIM_ENTRY_RE = /"(?:%~dp0%?|%dp0%|\$basedir)[\\/]*([^"\r\n%$]*?\.js)"/i

/** An npm shim is a few hundred bytes; anything larger is not read. */
const SHIM_MAX_BYTES = 64 * 1024

type ShimDeps = Required<Pick<CodexOscVersionDeps, 'isFile'>> & Pick<CodexOscVersionDeps, 'readFile' | 'realpath' | 'arch'>

/**
 * T0758 / BUG-189: the native `codex.exe` the npm shim `shim` (Windows, `codex.cmd` / `.ps1` / `.bat`)
 * ends up running, found without running the shim; or why not. Only a shim that starts
 * `…\@openai\codex\bin\codex.js` is followed (the npm package's launcher); the binary is found the way
 * that launcher finds it: `require.resolve('@openai/codex-win32-<arch>/package.json')` from the package
 * (each ancestor's `node_modules`), its `vendor/<triple>/bin/codex.exe`, else `<package>/vendor/…`.
 */
export function resolveNpmCodexShim(shim: string, deps: ShimDeps): { path: string } | { reason: string } {
  const w = pathModule.win32
  const text = deps.readFile?.(shim) ?? null
  if (text === null) return { reason: 'cannot read the shim' }
  const rel = SHIM_ENTRY_RE.exec(text)?.[1]
  if (!rel) return { reason: 'not an npm shim' }
  const entry = w.resolve(w.dirname(shim), rel)
  if (entry.split(/[\\/]+/).slice(-4).join('/').toLowerCase() !== '@openai/codex/bin/codex.js') return { reason: 'npm shim of another package' }
  if (!deps.isFile(entry)) return { reason: 'npm shim target missing' }
  let pkgRoot = w.dirname(w.dirname(entry))
  try { pkgRoot = deps.realpath?.(pkgRoot) ?? pkgRoot } catch { /* keep the lexical path */ }
  const preferred = WINDOWS_CODEX_TARGETS[deps.arch ?? ''] ?? WINDOWS_CODEX_TARGETS.x64
  const targets = [preferred, ...Object.values(WINDOWS_CODEX_TARGETS).filter(t => t !== preferred)]
  for (const target of targets) {
    // Node's lookup from <pkgRoot>\bin\codex.js: <dir>\node_modules for each ancestor not itself named node_modules
    for (let dir = w.join(pkgRoot, 'bin'); ; dir = w.dirname(dir)) {
      if (w.basename(dir).toLowerCase() !== 'node_modules') {
        const pkgDir = w.join(dir, 'node_modules', '@openai', target.pkg)
        if (deps.isFile(w.join(pkgDir, 'package.json'))) {
          const exe = w.join(pkgDir, 'vendor', target.triple, 'bin', 'codex.exe')
          return deps.isFile(exe) ? { path: exe } : { reason: `npm shim: ${exe} missing` }
        }
      }
      if (w.dirname(dir) === dir) break
    }
    const vendored = w.join(pkgRoot, 'vendor', target.triple, 'bin', 'codex.exe')
    if (deps.isFile(vendored)) return { path: vendored }
  }
  return { reason: 'npm shim: native codex.exe not found' }
}

/**
 * The binary `baseCommand` (e.g. `codex -c features.daemon_auto_start=false`) runs, or why not known.
 * `via`: the npm shim it was found through (T0758).
 */
export function resolveDispatchCodexBinary(
  baseCommand: string,
  deps: Required<Pick<CodexOscVersionDeps, 'platform' | 'env' | 'isFile'>> & Pick<CodexOscVersionDeps, 'readFile' | 'realpath' | 'arch'>,
): { path: string; via?: string } | { reason: string } {
  const word = baseCommand.trim().split(/\s+/)[0] ?? ''
  const p = deps.platform === 'win32' ? pathModule.win32 : pathModule.posix
  const throughShim = (shim: string): { path: string; via: string } | { reason: string } => {
    const native = resolveNpmCodexShim(shim, deps)
    return 'path' in native ? { path: native.path, via: shim } : native
  }
  if (word !== 'codex') {
    if (!word || !p.isAbsolute(word)) return { reason: `launch command ${word ? `'${word}'` : '(empty)'} is not codex on PATH` }
    if (!deps.isFile(word)) return { reason: 'custom CLI not found' }
    if (deps.platform === 'win32' && !/\.exe$/i.test(word)) {
      if (!/\.(cmd|ps1|bat)$/i.test(word)) return { reason: 'custom CLI is not an .exe' }
      const native = throughShim(word)
      return 'path' in native ? native : { reason: `custom CLI ${word} (${native.reason})` }
    }
    return { path: word }
  }
  const delimiter = deps.platform === 'win32' ? ';' : ':'
  for (const raw of pathValue(deps.env, deps.platform).split(delimiter)) {
    const dir = raw.trim().replace(/^"(.*)"$/, '$1')
    if (!dir) continue
    if (deps.platform === 'win32') {
      const present = WINDOWS_CODEX_NAMES.filter(name => deps.isFile(p.join(dir, name)))
      if (present.length === 0) continue
      if (present.includes('codex.exe')) return { path: p.join(dir, 'codex.exe') }
      const shims = WINDOWS_SHIM_NAMES.filter(name => present.includes(name))
      let reason = 'needs a shell'
      for (const name of shims) {
        const native = throughShim(p.join(dir, name))
        if ('path' in native) return native
        reason = native.reason
      }
      return { reason: `first codex on PATH is ${p.join(dir, shims[0] ?? present[0])} (${reason})` }
    }
    const candidate = p.join(dir, 'codex')
    if (deps.isFile(candidate)) return { path: candidate }
  }
  return { reason: 'codex not on PATH' }
}

const VERSION_RE = /codex-cli\s+v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/i

/**
 * `(baseCommand) => Promise<version | null>`: the `x.y.z[-pre]` of the codex `baseCommand` launches,
 * null when not known. One `[codex-version]` line per call. Never throws, never rejects.
 */
export function createCodexVersionReader(deps: CodexOscVersionDeps = {}): (baseCommand: string) => Promise<string | null> {
  const platform = deps.platform ?? process.platform
  const env = deps.env ?? process.env
  const isFile = deps.isFile ?? ((p: string) => {
    try { return fs.statSync(p).isFile() } catch { return false }
  })
  const mtimeMs = deps.mtimeMs ?? ((p: string) => {
    try { return fs.statSync(p).mtimeMs } catch { return null }
  })
  const readFile = deps.readFile ?? ((p: string) => {
    try { return fs.statSync(p).size <= SHIM_MAX_BYTES ? fs.readFileSync(p, 'utf8') : null } catch { return null }
  })
  const realpath = deps.realpath ?? ((p: string) => {
    try { return fs.realpathSync(p) } catch { return p }
  })
  const arch = deps.arch ?? process.arch
  const run: ExecFileLike = deps.execFile ?? (execFile as unknown as ExecFileLike)
  const cache = new Map<string, string>()
  const log = (message: string) => deps.logger?.log(message)

  const probe = (bin: string): Promise<string | null> => new Promise(resolve => {
    try {
      run(bin, ['--version'], { timeout: CODEX_VERSION_TIMEOUT_MS, windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error) return resolve(null)
        resolve(VERSION_RE.exec(`${stdout ?? ''}\n${stderr ?? ''}`)?.[1] ?? null)
      })
    } catch {
      resolve(null) // a synchronous spawn failure (EFTYPE, EINVAL)
    }
  })

  return async (baseCommand: string): Promise<string | null> => {
    try {
      const resolved = resolveDispatchCodexBinary(baseCommand, { platform, env, isFile, readFile, realpath, arch })
      if ('reason' in resolved) {
        log(`[codex-version] path=- version=unknown (${resolved.reason})`)
        return null
      }
      const mtime = mtimeMs(resolved.path)
      const key = `${resolved.path}\0${mtime ?? '-'}`
      let version = mtime !== null ? cache.get(key) ?? null : null
      const how = version !== null ? 'cached' : 'probed'
      if (version === null) {
        version = await probe(resolved.path)
        if (version !== null && mtime !== null) cache.set(key, version)
      }
      log(`[codex-version] path=${resolved.path} version=${version ?? 'unknown'} (${how})${'via' in resolved && resolved.via ? ` via=${resolved.via}` : ''}`)
      return version
    } catch (error) {
      log(`[codex-version] path=- version=unknown (${error instanceof Error ? error.message : String(error)})`)
      return null
    }
  }
}

/**
 * `(baseCommand) => Promise<boolean>`: true when the codex it launches writes OSC 7501. Never
 * throws, never rejects.
 */
export function createCodexOscVersionCheck(deps: CodexOscVersionDeps = {}): (baseCommand: string) => Promise<boolean> {
  const readVersion = createCodexVersionReader(deps)
  return async (baseCommand: string): Promise<boolean> => {
    const version = await readVersion(baseCommand)
    return version !== null && codexVersionWritesOsc(`codex-cli ${version}`) === true
  }
}

/**
 * T0651: codex `rust-v0.156.0` added `--no-daemon` ("Run without the shared background server, even
 * if it is already running"; release notes: "bypass it with `--no-daemon`. (#45854, #46088)";
 * `codex-rs/tui/src/cli.rs` has no `no_daemon` at `rust-v0.155.1`). An older codex exits 2 on it
 * (T0375: 0.133).
 */
export const CODEX_NO_DAEMON_MIN_VERSION = '0.156.0'

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** `version` (`x.y.z[-pre]`) >= `min` (`x.y.z`); a pre-release of `min` itself does not count. */
export function codexVersionAtLeast(version: string, min: string): boolean {
  const m = SEMVER_RE.exec(version.trim())
  const r = SEMVER_RE.exec(min)
  if (!m || !r) return false
  for (let i = 1; i <= 3; i++) {
    const [a, b] = [Number(m[i]), Number(r[i])]
    if (a !== b) return a > b
  }
  return m[4] === undefined
}

export type CodexNoDaemonSupport =
  | { inject: true; version: string }
  | { inject: false; reason: 'codex-too-old' | 'version-unknown'; version?: string }

/**
 * T0651: `() => Promise<CodexNoDaemonSupport>` for the codex a codex-cli tab launches (`codex` on
 * PATH; T0758: on Windows an npm shim is followed to its native codex.exe; no codex, a shim that
 * cannot be followed, or no readable version → `version-unknown`).
 * Never throws, never rejects.
 */
export function createCodexNoDaemonSupportCheck(deps: CodexOscVersionDeps = {}): () => Promise<CodexNoDaemonSupport> {
  const readVersion = createCodexVersionReader(deps)
  return async (): Promise<CodexNoDaemonSupport> => {
    const version = await readVersion('codex')
    if (version === null) return { inject: false, reason: 'version-unknown' }
    return codexVersionAtLeast(version, CODEX_NO_DAEMON_MIN_VERSION)
      ? { inject: true, version }
      : { inject: false, reason: 'codex-too-old', version }
  }
}
