/**
 * PLAN-065 W3 / T0859 (D286): start the Terminal Server from the PTY holder outside the install directory.
 *
 * T0858 ships `<resources>/pty-holder/` (the pinned Node `node.exe` renamed `bat-pty-holder.exe`, the packaged
 * `terminal-server.js`, the win32 files of `@lydell/node-pty`, Node's LICENSE, `holder-manifest.json`) and the NSIS
 * installer copies it to `<holder root>/<key>/`. An NSIS upgrade ends every process under `$INSTDIR`
 * (`Path.StartsWith('$INSTDIR')`, or the image name without PowerShell, T0856 Q1); a Terminal Server running
 * `<holder root>/<key>/bat-pty-holder.exe` matches neither.
 *
 * Rules (🔴, docs/agent-guide/terminal-server-recovery.md「從 PTY holder 啟動」):
 *   - only a win32 packaged app installed by NSIS (the T0823 marker `resources/installer-quit-request.supported`,
 *     which zip builds lack) uses a holder; every other case — macOS / Linux, `npm run dev`, zip, holder missing,
 *     any check failing — forks exactly as before T0859 (terminalServerForkOptions);
 *   - the expected holder is the packaged `resources/pty-holder/holder-manifest.json` (install directory, where
 *     BAT itself runs from): the copy's manifest must be byte-identical, and every file it lists is re-hashed
 *     (size + SHA-256; the installer only compares the manifest), no unlisted file, key = directory name;
 *   - holder root and install directory must not be string prefixes of each other, ignoring case
 *     (holderRootConflictsWithInstallDir — the NSIS `StartsWith` trap);
 *   - the holder process: `execPath` = holder exe, `cwd` = holder directory (never the main process's cwd, which
 *     would keep the install directory from being removed), no `ELECTRON_RUN_AS_NODE`. Electron's `fork` always adds
 *     `ELECTRON_RUN_AS_NODE=1` (T0859 measured, also with another `execPath`), so the holder is started with
 *     `spawn` + an `ipc` stdio slot — the same channel `fork` opens.
 *
 * The holder rules (root name, key, prefix check, manifest fields) are the ones of scripts/pty-holder.cjs (T0858,
 * build / installer side); scripts/__tests__/pty-holder.test.mjs checks both files give the same answers.
 * Pure: no electron import, file access only through PtyHolderFsDeps (tests replace it).
 */
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import type { ForkOptions, SpawnOptions, StdioOptions } from 'child_process'

/** Holder root directory name (D2): per-user `%LOCALAPPDATA%\BAT-PtyHolder`, per-machine `%ProgramFiles%\BAT-PtyHolder`. */
export const PTY_HOLDER_ROOT_DIR_NAME = 'BAT-PtyHolder'
/** `<resources>/<this>/` in the package: the expected holder (its manifest is the source of the expected key). */
export const PTY_HOLDER_RESOURCES_DIR = 'pty-holder'
export const PTY_HOLDER_MANIFEST_FILE = 'holder-manifest.json'
export const PTY_HOLDER_EXE_NAME = 'bat-pty-holder.exe'
export const PTY_HOLDER_ENTRY = 'terminal-server.js'
export const PTY_HOLDER_MANIFEST_SCHEMA = 1
/** `<nodeVersion>-<12 hex>`, also the directory name under the holder root. */
export const PTY_HOLDER_KEY_RE = /^\d+\.\d+\.\d+-[0-9a-f]{12}$/
/**
 * T0823's marker, written by build/installer.nsh `customInstall` (BAT_INSTALLER_QUIT_MARKER) right before it copies
 * the holder. Present = installed by an NSIS installer that copies holders; zip builds and `build:dir` lack it.
 */
export const NSIS_INSTALL_MARKER = 'installer-quit-request.supported'

export type PtyHolderScope = 'per-user' | 'per-machine'

export interface PtyHolderFile {
  path: string
  size: number
  sha256: string
}

export interface PtyHolderManifest {
  schema: number
  key: string
  nodeVersion: string
  arch: string
  exe: string
  entry: string
  files: PtyHolderFile[]
}

/** A holder that passed every check: what the Terminal Server is started from. */
export interface ValidPtyHolder {
  key: string
  scope: PtyHolderScope
  /** `<holder root>/<key>` */
  dir: string
  exePath: string
  entryPath: string
}

export type PtyHolderSkipReason =
  | 'not-win32'
  | 'not-packaged'
  | 'not-nsis-install'
  | 'no-packaged-manifest'
  | 'packaged-manifest-invalid'
  | 'arch-mismatch'
  | 'no-holder-root'
  | 'not-installed'
  | 'holder-invalid'

export type PtyHolderDecision =
  | { use: true; holder: ValidPtyHolder; elapsedMs: number }
  | {
    use: false
    reason: PtyHolderSkipReason
    /** The expected key, once the packaged manifest was read. */
    key?: string
    /** First problems found (holder-invalid / packaged-manifest-invalid / no-holder-root), at most 3. */
    details?: string[]
    elapsedMs: number
  }

export interface PtyHolderInput {
  platform: NodeJS.Platform
  isPackaged: boolean
  /** `process.execPath`: the install directory is its directory. */
  execPath: string
  /** `process.resourcesPath` */
  resourcesPath: string
  /** `process.arch` */
  arch: string
  env: NodeJS.ProcessEnv
}

/** File access of resolvePtyHolder (tests replace it). */
export interface PtyHolderFsDeps {
  /** null when the file cannot be read (missing or otherwise). */
  readFile: (file: string) => Promise<Buffer | null>
  /** `'file'` / `'dir'` / null (missing or unreadable). */
  kind: (p: string) => Promise<'file' | 'dir' | 'other' | null>
  size: (file: string) => Promise<number | null>
  sha256: (file: string) => Promise<string | null>
  /** Files under `dir`, relative, `/`-separated, sorted; directories are walked, not listed. */
  listFiles: (dir: string) => Promise<string[]>
  now: () => number
}

/**
 * Holder key = `<nodeVersion>-<first 12 hex of SHA-256 over the sorted "path\tsize\tsha256\n" lines>`
 * (scripts/pty-holder.cjs holderKey, same bytes).
 */
export function holderKey(nodeVersion: string, files: readonly PtyHolderFile[]): string {
  const lines = [...files]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((f) => `${f.path}\t${f.size}\t${f.sha256}\n`)
    .join('')
  return `${nodeVersion}-${crypto.createHash('sha256').update(lines).digest('hex').slice(0, 12)}`
}

/** Holder root of an install scope (scripts/pty-holder.cjs holderRootFor; installer: `$LOCALAPPDATA` / `$PROGRAMFILES64`). */
export function holderRootFor(scope: PtyHolderScope, env: NodeJS.ProcessEnv): string {
  if (scope === 'per-machine') return path.win32.join(env.ProgramW6432 || env.ProgramFiles || 'C:\\Program Files', PTY_HOLDER_ROOT_DIR_NAME)
  if (!env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is not set')
  return path.win32.join(env.LOCALAPPDATA, PTY_HOLDER_ROOT_DIR_NAME)
}

/**
 * True when the holder root and the install directory overlap as plain string prefixes, either way, ignoring case
 * (NSIS ends processes whose path `StartsWith('$INSTDIR')`, no trailing `\`). Same rule as the installer
 * (scripts/pty-holder.cjs holderRootConflictsWithInstallDir): a conflicting root is never used.
 */
export function holderRootConflictsWithInstallDir(holderRoot: string, installDir: string): boolean {
  const root = String(holderRoot).toLowerCase()
  const inst = String(installDir).toLowerCase()
  if (!root || !inst) return true
  return root.startsWith(inst) || inst.startsWith(root)
}

function underDir(child: string, dir: string | undefined): boolean {
  if (!dir) return false
  const c = path.win32.resolve(child).toLowerCase()
  const d = path.win32.resolve(dir).toLowerCase().replace(/\\+$/, '')
  return c === d || c.startsWith(d + '\\')
}

/**
 * Which root to look at first. The installer picks the root by `$installMode`, which BAT cannot read without the
 * registry; an install directory under Program Files is per-machine, anything else most likely per-user. The other
 * scope is still tried (custom install directories): every candidate is verified against the packaged manifest,
 * so the order only decides which of two identical copies is used.
 */
export function holderScopeOrder(installDir: string, env: NodeJS.ProcessEnv): PtyHolderScope[] {
  const programFiles = [env.ProgramW6432, env.ProgramFiles, env['ProgramFiles(x86)']]
  return programFiles.some((dir) => underDir(installDir, dir)) ? ['per-machine', 'per-user'] : ['per-user', 'per-machine']
}

/** Problems of a parsed manifest on its own (format, key matches its files, the files the holder needs). */
export function manifestProblems(manifest: unknown): string[] {
  const m = manifest as Partial<PtyHolderManifest> | null
  if (!m || typeof m !== 'object') return ['manifest is not an object']
  const problems: string[] = []
  if (m.schema !== PTY_HOLDER_MANIFEST_SCHEMA) problems.push(`manifest schema ${String(m.schema)}, expected ${PTY_HOLDER_MANIFEST_SCHEMA}`)
  if (m.exe !== PTY_HOLDER_EXE_NAME) problems.push(`manifest exe ${String(m.exe)}, expected ${PTY_HOLDER_EXE_NAME}`)
  if (m.entry !== PTY_HOLDER_ENTRY) problems.push(`manifest entry ${String(m.entry)}, expected ${PTY_HOLDER_ENTRY}`)
  if (typeof m.nodeVersion !== 'string') problems.push('manifest nodeVersion is not a string')
  if (!Array.isArray(m.files)) {
    problems.push('manifest files is not an array')
    return problems
  }
  for (const f of m.files) {
    if (!f || typeof f.path !== 'string' || !f.path || f.path.includes('\\') || f.path.split('/').some((part) => part === '' || part === '.' || part === '..')
      || typeof f.size !== 'number' || typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256)) {
      problems.push(`manifest file entry ${JSON.stringify(f)} is malformed`)
    }
  }
  if (problems.length) return problems
  if (typeof m.key !== 'string' || !PTY_HOLDER_KEY_RE.test(m.key)) problems.push(`manifest key ${JSON.stringify(m.key)} is not <nodeVersion>-<12 hex>`)
  else if (m.key !== holderKey(m.nodeVersion as string, m.files)) problems.push(`manifest key ${m.key} does not match its files`)
  const listed = new Set(m.files.map((f) => f.path))
  for (const required of [PTY_HOLDER_EXE_NAME, PTY_HOLDER_ENTRY]) {
    if (!listed.has(required)) problems.push(`manifest does not list ${required}`)
  }
  for (const f of m.files) {
    if (/(^|\/)betteragentterminal\.exe$/i.test(f.path)) problems.push(`${f.path}: a holder never ships BetterAgentTerminal.exe`)
  }
  return problems
}

/**
 * What is wrong with `<holder root>/<key>` compared with the packaged manifest (empty = usable): the manifest copy
 * must be byte-identical; every listed file present with the listed size and SHA-256 (re-hashed here); no unlisted
 * file (a planted DLL next to the exe would be loaded).
 */
export async function holderDirProblems(dir: string, expected: PtyHolderManifest, expectedBytes: Buffer, deps: PtyHolderFsDeps): Promise<string[]> {
  if ((await deps.kind(dir)) !== 'dir') return ['not installed']
  const copy = await deps.readFile(path.join(dir, PTY_HOLDER_MANIFEST_FILE))
  if (!copy) return [`${PTY_HOLDER_MANIFEST_FILE}: missing`]
  if (!copy.equals(expectedBytes)) return [`${PTY_HOLDER_MANIFEST_FILE}: differs from the packaged one`]
  const problems: string[] = []
  const checks = await Promise.all(expected.files.map(async (f) => {
    const full = path.join(dir, ...f.path.split('/'))
    const size = await deps.size(full)
    if (size === null) return `missing: ${f.path}`
    if (size !== f.size) return `${f.path}: size ${size}, manifest ${f.size}`
    const sha = await deps.sha256(full)
    if (sha === null) return `${f.path}: cannot be read`
    return sha === f.sha256 ? null : `${f.path}: SHA-256 differs from the manifest`
  }))
  for (const c of checks) if (c) problems.push(c)
  const listed = new Set(expected.files.map((f) => f.path))
  for (const rel of await deps.listFiles(dir)) {
    if (rel !== PTY_HOLDER_MANIFEST_FILE && !listed.has(rel)) problems.push(`not in the manifest: ${rel}`)
  }
  return problems
}

/**
 * Decides whether the Terminal Server starts from a holder (see the module comment). Never throws: anything
 * unexpected is a `use: false` decision, and the caller forks as before T0859.
 */
export async function resolvePtyHolder(input: PtyHolderInput, deps: PtyHolderFsDeps = defaultPtyHolderFsDeps): Promise<PtyHolderDecision> {
  const started = deps.now()
  const skip = (reason: PtyHolderSkipReason, extra: { key?: string; details?: string[] } = {}): PtyHolderDecision => ({
    use: false,
    reason,
    ...(extra.key ? { key: extra.key } : {}),
    ...(extra.details && extra.details.length ? { details: extra.details.slice(0, 3) } : {}),
    elapsedMs: Math.max(0, Math.round(deps.now() - started)),
  })
  // 🔴 these two return before any file access: macOS / Linux / dev mode are not touched at all
  if (input.platform !== 'win32') return skip('not-win32')
  if (!input.isPackaged) return skip('not-packaged')
  try {
    if ((await deps.kind(path.join(input.resourcesPath, NSIS_INSTALL_MARKER))) !== 'file') return skip('not-nsis-install')
    const expectedBytes = await deps.readFile(path.join(input.resourcesPath, PTY_HOLDER_RESOURCES_DIR, PTY_HOLDER_MANIFEST_FILE))
    if (!expectedBytes) return skip('no-packaged-manifest')
    let expected: PtyHolderManifest
    try {
      expected = JSON.parse(expectedBytes.toString('utf8')) as PtyHolderManifest
    } catch {
      return skip('packaged-manifest-invalid', { details: ['not JSON'] })
    }
    const own = manifestProblems(expected)
    if (own.length) return skip('packaged-manifest-invalid', { details: own })
    const key = expected.key
    if (expected.arch !== input.arch) return skip('arch-mismatch', { key, details: [`manifest ${expected.arch}, process ${input.arch}`] })

    const installDir = path.win32.dirname(input.execPath)
    const rootNotes: string[] = []
    const invalid: string[] = []
    let sawRoot = false
    for (const scope of holderScopeOrder(installDir, input.env)) {
      let root: string
      try {
        root = holderRootFor(scope, input.env)
      } catch (err) {
        rootNotes.push(`${scope}: ${(err as Error).message}`)
        continue
      }
      if (holderRootConflictsWithInstallDir(root, installDir)) {
        rootNotes.push(`${scope}: holder root and install directory are prefixes of each other`)
        continue
      }
      sawRoot = true
      const dir = path.win32.join(root, key)
      const problems = await holderDirProblems(dir, expected, expectedBytes, deps)
      if (problems.length === 0) {
        return {
          use: true,
          holder: { key, scope, dir, exePath: path.win32.join(dir, PTY_HOLDER_EXE_NAME), entryPath: path.win32.join(dir, PTY_HOLDER_ENTRY) },
          elapsedMs: Math.max(0, Math.round(deps.now() - started)),
        }
      }
      if (!(problems.length === 1 && problems[0] === 'not installed')) invalid.push(...problems.map((p) => `${scope}: ${p}`))
    }
    if (!sawRoot) return skip('no-holder-root', { key, details: rootNotes })
    return invalid.length ? skip('holder-invalid', { key, details: invalid }) : skip('not-installed', { key })
  } catch (err) {
    return skip('holder-invalid', { details: [`unexpected: ${(err as Error).message}`] })
  }
}

/**
 * The holder key of a `holderDir` a server reported in `server:hello-ok` (its last path segment), for logs:
 * anything that is not a key reads `unrecognised` (the main process never logs the reported path itself).
 */
export function holderKeyOfDir(holderDir: string): string {
  const last = String(holderDir).split(/[\\/]+/).filter(Boolean).pop() ?? ''
  return PTY_HOLDER_KEY_RE.test(last) ? last : 'unrecognised'
}

/** One `[pty-holder]` line: key, scope, result and time; never the env or a token (no path besides the key). */
export function ptyHolderLogLine(decision: PtyHolderDecision): string {
  if (decision.use) {
    return `[pty-holder] Terminal Server from holder ${decision.holder.key} (${decision.holder.scope}), verified in ${decision.elapsedMs} ms`
  }
  const key = decision.key ? ` ${decision.key}` : ''
  const details = decision.details?.length ? `: ${decision.details.join('; ')}` : ''
  return `[pty-holder] not used (${decision.reason})${key} after ${decision.elapsedMs} ms${details} — forking the Terminal Server as before`
}

/**
 * 🔴 The fork options when no holder is used: exactly what forkTerminalServer passed before T0859 (no execPath, no
 * cwd, no execArgv; `env` as given). macOS / Linux / dev / zip / any failed check use this.
 */
export function terminalServerForkOptions(stdio: StdioOptions, env: NodeJS.ProcessEnv): ForkOptions {
  return { detached: true, stdio, env }
}

/** How the Terminal Server is spawned from a holder (`child_process.spawn(command, args, options)`). */
export interface HolderSpawnSpec {
  command: string
  args: string[]
  options: SpawnOptions
}

/**
 * The holder start: `bat-pty-holder.exe <dir>\terminal-server.js`, cwd = holder directory, the same env without
 * `ELECTRON_RUN_AS_NODE`, the same stdio (it carries the `ipc` slot), detached and hidden like the fork.
 * node-pty is resolved from `<dir>\node_modules` (the script's directory), never from the install directory.
 */
export function holderSpawnSpec(holder: ValidPtyHolder, stdio: StdioOptions, env: NodeJS.ProcessEnv): HolderSpawnSpec {
  const { ELECTRON_RUN_AS_NODE: _runAsNode, ...holderEnv } = env
  return {
    command: holder.exePath,
    args: [holder.entryPath],
    options: { detached: true, stdio, env: holderEnv, cwd: holder.dir, windowsHide: true },
  }
}

// ── default file access ───────────────────────────────────────────────────────────────────────────

function sha256Stream(file: string): Promise<string | null> {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(file)
    stream.on('error', () => resolve(null))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function walkFiles(dir: string, base = dir): Promise<string[]> {
  const out: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walkFiles(full, base))
    else out.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return out.sort()
}

export const defaultPtyHolderFsDeps: PtyHolderFsDeps = {
  readFile: async (file) => {
    try { return await fs.promises.readFile(file) } catch { return null }
  },
  kind: async (p) => {
    try {
      const st = await fs.promises.stat(p)
      return st.isFile() ? 'file' : st.isDirectory() ? 'dir' : 'other'
    } catch {
      return null
    }
  },
  size: async (file) => {
    try {
      const st = await fs.promises.stat(file)
      return st.isFile() ? st.size : null
    } catch {
      return null
    }
  },
  sha256: sha256Stream,
  listFiles: (dir) => walkFiles(dir),
  now: () => performance.now(),
}
