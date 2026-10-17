/**
 * PLAN-047 W1 / T0583 (D150 / D152): worktree-isolated dispatch.
 *
 * `bat-terminal.mjs … --skill ct-exec --workorder T#### --isolation worktree` runs the Worker in
 * its own git worktree, outside the repo, so the main checkout does not move until the merge work
 * order fast-forwards it (CT-T016 merges; BAT does not):
 *
 *   main checkout  = `git rev-parse --show-toplevel` of the dispatch cwd
 *   location       = <parent of the main checkout>/.bat-worktrees/<main checkout dir name>/<T####>
 *   branch         = ct/<T####>
 *   base           = the main checkout's HEAD when the worktree is created
 *
 * A worktree already registered at the location on `ct/<T####>` (Renew / dispatch again) is reused;
 * a `ct/<T####>` branch without a worktree gets one; anything else at the location is a failure.
 * `--close-worker … --worktree remove|archive` removes it once the tab is closed (`git worktree
 * remove`, never `--force`: uncommitted changes keep it), keeping the branch (`archive` renames it
 * to `ct-archive/<T####>`).
 *
 * PLAN-047 W1-2 / T0585: `status` answers `worktree:terminal-status` (electron/worktree-status-handlers.ts)
 * — ahead / behind, dirty files, changed files, files outside the work order's `affects_files`
 * and the conflicts `merge-tree` predicts — reading git only (the merge stays the Tower's, D150).
 *
 * Unrelated to `WorktreeManager` (electron/worktree-manager.ts: Agent panel / `claude-cli-worktree`,
 * `.bat-worktrees` inside the repo), which is unchanged.
 *
 * Every git call is `execFile` with an args array and a timeout; Windows adds
 * `-c core.longpaths=true` (T0583: without it `worktree add` fails with `Filename too long` past 260
 * characters — after creating the branch — and `status` / `worktree remove` see the long files as
 * deleted, so a clean worktree looks dirty).
 *
 * 🔴 No `electron` import here (shared with headless bat-server).
 */
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { normalizeWorkorderId } from './close-worker'

/** `--isolation` values (trimmed, any case). */
export const CT_ISOLATION_MODES = ['worktree'] as const
export type CtIsolationMode = typeof CT_ISOLATION_MODES[number]

/** `--close-worker --worktree` values (trimmed, any case); absent = `keep`. */
export const CT_WORKTREE_CLOSE_MODES = ['keep', 'remove', 'archive'] as const
export type CtWorktreeCloseMode = typeof CT_WORKTREE_CLOSE_MODES[number]

/** `{ ok: false, code }` of a dispatch whose worktree could not be prepared (helper exit 7). */
export const WORKTREE_FAILED = 'WORKTREE_FAILED' as const

export const CT_WORKTREE_DIR = '.bat-worktrees'
export const CT_WORKTREE_BRANCH_PREFIX = 'ct/'
export const CT_WORKTREE_ARCHIVE_PREFIX = 'ct-archive/'

/** git queries (rev-parse, worktree list, status, branch). */
export const CT_GIT_QUERY_TIMEOUT_MS = 5_000
/** `git worktree add` (checks out the whole tree). */
export const CT_GIT_CREATE_TIMEOUT_MS = 30_000
/** `git worktree remove` (deletes the tree, ignored `node_modules` included). */
export const CT_GIT_REMOVE_TIMEOUT_MS = 300_000

/** Work order ids that may become a path segment / ref name (after `normalizeWorkorderId`). */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/

/** What BAT records about a Worker's worktree (PtyInstance, saved tab, `terminal:created-externally`). */
export interface CtWorktreeRecord {
  /** Absolute worktree path. */
  path: string
  /** `ct/<T####>`. */
  branch: string
  /** Full SHA the branch started from (see `prepareCtWorktree` for a reused one). */
  base: string
  /** Absolute path of the main checkout (`CT_HOME`). */
  mainCheckout: string
  /** Normalized work order id. */
  workorder: string
}

export type CtWorktreePrepareResult =
  | { ok: true; record: CtWorktreeRecord; reused: boolean; createdBranch: boolean; cwd: string }
  | { ok: false; error: string }

export type CtWorktreeCleanupStatus = 'removed' | 'archived' | 'kept-dirty' | 'missing' | 'invalid' | 'failed'

export interface CtWorktreeCleanupResult {
  status: CtWorktreeCleanupStatus
  /** Set when `archive` renamed the branch. */
  archivedBranch?: string
  detail?: string
}

export interface GitRunResult {
  stdout: string
  stderr: string
}

export interface CtWorktreeDeps {
  /** git executable (headless: `createHeadlessGitBinaryResolver`). Default `git`. */
  gitBinary?: () => string
  /** env of the git children (headless: server env minus `BAT_*`). Default: inherited. */
  env?: () => NodeJS.ProcessEnv | undefined
  platform?: NodeJS.Platform
  /**
   * Test seam: runs git; rejects with `{ stdout?, stderr?, code?, message }` on a non-zero exit /
   * timeout (`code` = the exit code).
   */
  runGit?: (args: string[], opts: { cwd: string; timeoutMs: number }) => Promise<GitRunResult>
  existsSync?: (p: string) => boolean
  now?: () => Date
  /** T0585: `status` time limit (default `CT_WORKTREE_STATUS_TIMEOUT_MS`; tests). */
  statusTimeoutMs?: number
}

export function normalizeIsolationMode(raw: unknown): CtIsolationMode | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  return (CT_ISOLATION_MODES as readonly string[]).includes(value) ? value as CtIsolationMode : null
}

export function normalizeWorktreeCloseMode(raw: unknown): CtWorktreeCloseMode | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  return (CT_WORKTREE_CLOSE_MODES as readonly string[]).includes(value) ? value as CtWorktreeCloseMode : null
}

/** The `--workorder` grammar (`normalizeWorkorderId`) and a safe path segment, or null. */
export function ctWorktreeWorkorder(raw: unknown): string | null {
  const id = normalizeWorkorderId(raw)
  return id && SAFE_SEGMENT.test(id) ? id : null
}

export function ctWorktreeBranch(workorder: string): string {
  return `${CT_WORKTREE_BRANCH_PREFIX}${workorder}`
}

/** `<parent of mainCheckout>/.bat-worktrees/<basename(mainCheckout)>/<workorder>`. */
export function ctWorktreeLocation(mainCheckout: string, workorder: string, platform: NodeJS.Platform = process.platform): string {
  const p = platform === 'win32' ? path.win32 : path.posix
  const main = p.resolve(mainCheckout)
  return p.join(p.dirname(main), CT_WORKTREE_DIR, p.basename(main), workorder)
}

/** The env BAT adds to an isolated Worker (not from the caller's `customEnv`). */
export function ctWorktreeEnv(record: CtWorktreeRecord): Record<string, string> {
  return {
    CT_HOME: record.mainCheckout,
    CT_WORKTREE: record.path,
    CT_WORKTREE_BRANCH: record.branch,
    CT_WORKTREE_BASE: record.base,
  }
}

/** Keys of `ctWorktreeEnv` — a caller-supplied value is dropped (BAT's or none). */
export const CT_WORKTREE_ENV_KEYS: readonly string[] = ['CT_HOME', 'CT_WORKTREE', 'CT_WORKTREE_BRANCH', 'CT_WORKTREE_BASE']

function samePath(a: string, b: string, platform: NodeJS.Platform): boolean {
  const p = platform === 'win32' ? path.win32 : path.posix
  const na = p.resolve(a)
  const nb = p.resolve(b)
  return platform === 'win32' || platform === 'darwin' ? na.toLowerCase() === nb.toLowerCase() : na === nb
}

/**
 * A record as saved / sent (unknown input) → a record that follows the location and branch rules
 * of this module, or null. Cleanup acts only on such a record.
 */
export function parseCtWorktreeRecord(raw: unknown, platform: NodeJS.Platform = process.platform): CtWorktreeRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const workorder = ctWorktreeWorkorder(r.workorder)
  if (!workorder) return null
  if (typeof r.path !== 'string' || typeof r.branch !== 'string' || typeof r.base !== 'string' || typeof r.mainCheckout !== 'string') return null
  const p = platform === 'win32' ? path.win32 : path.posix
  if (!p.isAbsolute(r.path) || !p.isAbsolute(r.mainCheckout)) return null
  if (r.branch !== ctWorktreeBranch(workorder)) return null
  if (!/^[0-9a-f]{7,64}$/i.test(r.base)) return null
  if (!samePath(r.path, ctWorktreeLocation(r.mainCheckout, workorder, platform), platform)) return null
  return { path: r.path, branch: r.branch, base: r.base, mainCheckout: r.mainCheckout, workorder }
}

interface PorcelainWorktree {
  path: string
  head?: string
  branch?: string
  detached?: boolean
  prunable?: boolean
}

/** `git worktree list --porcelain` → entries. */
export function parseWorktreePorcelain(stdout: string): PorcelainWorktree[] {
  const entries: PorcelainWorktree[] = []
  let current: PorcelainWorktree | null = null
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length) }
      entries.push(current)
    } else if (!current) {
      continue
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5)
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace(/^refs\/heads\//, '')
    } else if (line === 'detached') {
      current.detached = true
    } else if (line === 'prunable' || line.startsWith('prunable ')) {
      current.prunable = true
    }
  }
  return entries
}

function gitError(error: unknown): string {
  const e = error as { stderr?: unknown; message?: unknown; code?: unknown; killed?: unknown } | null
  if (e?.code === 'ENOENT') return 'git not found'
  if (e?.killed) return 'git timed out'
  const text = typeof e?.stderr === 'string' && e.stderr.trim() ? e.stderr : typeof e?.message === 'string' ? e.message : String(error)
  // one line: the last fatal / error line git printed, else the first line
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return lines.reverse().find(l => /^(fatal|error):/i.test(l)) ?? lines[lines.length - 1] ?? 'git failed'
}

// ── T0585: read-only worktree status (`worktree:terminal-status`) ──

/** One `status` call, all git included (→ `{ ok: false, code: 'TIMEOUT' }`). */
export const CT_WORKTREE_STATUS_TIMEOUT_MS = 10_000
/** `dirty` lists at most this many paths (`dirtyCount` = all). */
export const CT_STATUS_DIRTY_MAX = 100
/** `changedFiles` / `outOfScopeFiles` list at most this many paths (`changedCount` / `outOfScopeCount` = all). */
export const CT_STATUS_CHANGED_MAX = 500
/** Cached computations (head / mainHead pairs) kept; the oldest is dropped first. */
export const CT_STATUS_CACHE_MAX = 64
/** Work orders live here, in the main checkout; never out of scope. */
export const CT_WORKORDERS_DIR = '_ct-workorders'

export interface CtWorktreeStatus {
  isolated: true
  workorder: string
  path: string
  branch: string
  base: string
  mainCheckout: string
  /** `ct/<T####>` now. */
  head: string
  /** The main checkout's `HEAD` now. */
  mainHead: string
  /** Commits on `head` that `mainHead` lacks / on `mainHead` that `head` lacks. */
  ahead: number
  behind: number
  /** Uncommitted / untracked paths in the worktree (≤ `CT_STATUS_DIRTY_MAX`); null = not read. */
  dirty: string[] | null
  dirtyCount: number | null
  worktreeMissing?: true
  dirtyError?: string
  /** `git diff --name-only --no-renames <mainHead>...<head>` (≤ `CT_STATUS_CHANGED_MAX`). */
  changedFiles: string[]
  changedCount: number
  /** Changed files outside the work order's `affects_files`; null = no work order / no field. */
  outOfScopeFiles: string[] | null
  outOfScopeCount?: number
  /** The work order file `affects_files` came from (relative to the main checkout). */
  workorderFile?: string
  touchesCtWorkorders: boolean
  /** Files `merge-tree` predicts to conflict; null = could not tell (`conflictsError`). */
  conflicts: string[] | null
  conflictsError?: string
  /** When ahead / behind / changedFiles / conflicts were computed (epoch ms). */
  computedAt: number
  /** Those came from the cache (same head, mainHead and worktree). */
  cached: boolean
}

export type CtWorktreeStatusErrorCode = 'INVALID' | 'GIT_FAILED' | 'TIMEOUT'

export type CtWorktreeStatusResult =
  | ({ ok: true } & CtWorktreeStatus)
  | { ok: false; code: CtWorktreeStatusErrorCode; error: string }

/**
 * Removes a YAML quoted scalar's quotes (and what follows the closing quote); a plain scalar loses
 * a ` #` comment.
 */
function unquoteYamlScalar(raw: string): string {
  const s = raw.trim()
  if (s.startsWith('"')) {
    let out = ''
    for (let i = 1; i < s.length; i++) {
      const c = s[i]
      if (c === '\\' && i + 1 < s.length) {
        const n = s[++i]
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n
      } else if (c === '"') {
        return out
      } else {
        out += c
      }
    }
    return out
  }
  if (s.startsWith("'")) {
    let out = ''
    for (let i = 1; i < s.length; i++) {
      if (s[i] === "'") {
        if (s[i + 1] === "'") { out += "'"; i++; continue }
        return out
      }
      out += s[i]
    }
    return out
  }
  return s.replace(/\s+#.*$/, '').trim()
}

/** Items of a YAML flow sequence body (`a, "b, c", 'd'`), quotes kept for `unquoteYamlScalar`. */
function splitFlowSequence(body: string): string[] {
  const items: string[] = []
  let current = ''
  let quote: string | null = null
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quote) {
      current += c
      if (c === '\\' && quote === '"' && i + 1 < body.length) current += body[++i]
      else if (c === quote) quote = null
    } else if (c === '"' || c === "'") {
      quote = c
      current += c
    } else if (c === ',') {
      items.push(current)
      current = ''
    } else {
      current += c
    }
  }
  items.push(current)
  return items.map(s => s.trim()).filter(Boolean)
}

/**
 * The `affects_files` items of a work order's YAML frontmatter (block or flow list, quotes
 * removed). null = no frontmatter or no `affects_files` key (or a null value).
 */
export function parseWorkorderAffectsFiles(markdown: string): string[] | null {
  const lines = markdown.replace(/^﻿/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return null
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---' || lines[i].trim() === '...') { end = i; break }
  }
  if (end < 0) return null
  const fm = lines.slice(1, end)
  const at = fm.findIndex(l => /^affects_files\s*:/.test(l))
  if (at < 0) return null
  const rest = fm[at].replace(/^affects_files\s*:/, '').trim()
  if (rest && !rest.startsWith('#')) {
    if (/^(null|~)$/i.test(rest)) return null
    if (!rest.startsWith('[')) return [unquoteYamlScalar(rest)].filter(Boolean)
    // flow sequence, possibly over several lines
    let body = rest
    for (let i = at + 1; !body.includes(']') && i < fm.length; i++) body += ` ${fm[i].trim()}`
    const close = body.lastIndexOf(']')
    return splitFlowSequence(body.slice(1, close < 0 ? undefined : close)).map(unquoteYamlScalar).filter(Boolean)
  }
  const items: string[] = []
  for (let i = at + 1; i < fm.length; i++) {
    const line = fm[i]
    if (!line.trim() || /^\s*#/.test(line)) continue
    const item = /^\s*-\s+(.*)$/.exec(line) ?? /^\s*-$/.exec(line)
    if (item) {
      items.push(item[1] ?? '')
    } else if (/^\s/.test(line) && items.length > 0) {
      items[items.length - 1] += ` ${line.trim()}` // a plain scalar folded onto the next line
    } else {
      break // the next key
    }
  }
  // `affects_files:` with no item is a YAML null
  return items.length > 0 ? items.map(unquoteYamlScalar).filter(Boolean) : null
}

/**
 * The path patterns of one `affects_files` item: notes in full-width / half-width brackets and
 * quotes / backticks removed, then the first whitespace-separated token; a token listing several
 * paths with `、` / `，` / `,` / `；` / `;` gives each. Backslashes become `/`, a leading `./` or
 * `/` is dropped. e.g. `"electron/main.ts、electron/remote/headless-entry.ts（接線）"` → both files.
 */
export function affectsFilePatterns(item: string): string[] {
  const text = item
    .replace(/（[^）]*(?:）|$)/g, ' ')
    .replace(/\([^)]*(?:\)|$)/g, ' ')
    .replace(/[`"'「」『』]/g, '')
    .replace(/\s*([、，,；;])\s*/g, '$1') // `a（note）、b` keeps b in the first token
    .trim()
  const first = text.split(/\s+/)[0] ?? ''
  return first
    .split(/[、，,；;]/)
    .map(p => p.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '').replace(/^\/+/, '').trim())
    .filter(p => p && p !== '.')
}

function globToRegExp(pattern: string, caseInsensitive: boolean): RegExp {
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 2 } else { re += '.*'; i += 1 }
      } else {
        re += '[^/]*'
      }
    } else if (c === '?') {
      re += '[^/]'
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${re}$`, caseInsensitive ? 'i' : '')
}

/**
 * Whether repo path `file` (forward slashes) matches an `affects_files` pattern: `**` any
 * characters (`/` included, `**` then `/` = zero or more directories), `*` / `?` within one segment;
 * a pattern without wildcards is that file or a directory containing it.
 */
export function matchesAffectsPattern(file: string, pattern: string, caseInsensitive = false): boolean {
  if (/[*?]/.test(pattern)) return globToRegExp(pattern, caseInsensitive).test(file)
  const norm = (s: string) => caseInsensitive ? s.toLowerCase() : s
  const f = norm(file)
  const p = norm(pattern.replace(/\/+$/, ''))
  return f === p || f.startsWith(`${p}/`)
}

/** Whether `file` is a Control Tower record (`_ct-workorders/**`). */
export function isCtWorkordersPath(file: string, caseInsensitive = false): boolean {
  return matchesAffectsPattern(file, CT_WORKORDERS_DIR, caseInsensitive)
}

/**
 * `files` outside the `affects_files` items (`_ct-workorders/**` never is); null items (no work
 * order / no field) → null.
 */
export function outOfScopeFiles(files: readonly string[], items: readonly string[] | null, caseInsensitive = false): string[] | null {
  if (items === null) return null
  const patterns = items.flatMap(affectsFilePatterns)
  return files.filter(f =>
    !isCtWorkordersPath(f, caseInsensitive) && !patterns.some(p => matchesAffectsPattern(f, p, caseInsensitive)))
}

/** `git status --porcelain=v1 -z` → paths (a rename / copy gives its new path). */
export function parsePorcelainZ(stdout: string): string[] {
  const tokens = stdout.split('\0')
  const paths: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.length < 4) continue
    paths.push(t.slice(3))
    if (/[RC]/.test(t.slice(0, 2))) i++ // the original path follows
  }
  return paths
}

/** NUL-separated paths (diff `-z`), empty entries and duplicates dropped, order kept. */
function nulList(stdout: string): string[] {
  return [...new Set(stdout.split('\0').filter(Boolean))]
}

interface StatusCacheEntry {
  computedAt: number
  ahead: number
  behind: number
  changed: string[]
  conflicts: string[] | null
  conflictsError?: string
}

export class CtWorktreeService {
  private readonly platform: NodeJS.Platform
  private readonly existsSync: (p: string) => boolean
  private readonly now: () => Date

  constructor(private readonly deps: CtWorktreeDeps = {}) {
    this.platform = deps.platform ?? process.platform
    this.existsSync = deps.existsSync ?? fs.existsSync
    this.now = deps.now ?? (() => new Date())
  }

  private git(args: string[], cwd: string, timeoutMs: number): Promise<GitRunResult> {
    const fullArgs = this.platform === 'win32' ? ['-c', 'core.longpaths=true', ...args] : args
    if (this.deps.runGit) return this.deps.runGit(fullArgs, { cwd, timeoutMs })
    const env = this.deps.env?.()
    return new Promise((resolve, reject) => {
      execFile(this.deps.gitBinary?.() ?? 'git', fullArgs, {
        cwd,
        timeout: timeoutMs,
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        env: { ...(env ?? process.env), GIT_TERMINAL_PROMPT: '0' },
      }, (error, stdout, stderr) => {
        // T0585: `stdout` too — `merge-tree --write-tree` exits 1 on conflicts and lists them there
        if (error) reject(Object.assign(error, { stdout, stderr }))
        else resolve({ stdout, stderr })
      })
    })
  }

  private async listWorktrees(mainCheckout: string): Promise<PorcelainWorktree[]> {
    const { stdout } = await this.git(['worktree', 'list', '--porcelain'], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)
    return parseWorktreePorcelain(stdout)
  }

  private async branchExists(mainCheckout: string, branch: string): Promise<boolean> {
    try {
      await this.git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)
      return true
    } catch {
      return false
    }
  }

  /** Fork point of `branch` from `head` (the base of a branch BAT did not just create). */
  private async mergeBase(mainCheckout: string, head: string, branch: string): Promise<string> {
    try {
      const { stdout } = await this.git(['merge-base', head, `refs/heads/${branch}`], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)
      return stdout.trim() || head
    } catch {
      return head
    }
  }

  /**
   * Creates (or reuses) the worktree of `workorder` for a dispatch from `cwd`. `cwd` of the result
   * is the same sub-directory inside the worktree when the dispatch cwd was below the repo root
   * (the worktree root when that directory does not exist there).
   *
   * `base`: a new branch → the main checkout's HEAD; an existing `ct/<T####>` branch (reused
   * worktree, or a worktree added on the branch) → `git merge-base HEAD ct/<T####>`, its fork
   * point from the main checkout's current HEAD.
   */
  async prepare(opts: { cwd: string; workorder: unknown }): Promise<CtWorktreePrepareResult> {
    const workorder = ctWorktreeWorkorder(opts.workorder)
    if (!workorder) return { ok: false, error: `invalid work order id '${String(opts.workorder)}'` }
    if (typeof opts.cwd !== 'string' || !opts.cwd || !this.existsSync(opts.cwd)) {
      return { ok: false, error: `cwd ${String(opts.cwd)} does not exist` }
    }
    const p = this.platform === 'win32' ? path.win32 : path.posix

    let mainCheckout: string
    let prefix: string
    try {
      const { stdout } = await this.git(['rev-parse', '--show-toplevel', '--show-prefix'], opts.cwd, CT_GIT_QUERY_TIMEOUT_MS)
      const [top = '', sub = ''] = stdout.split(/\r?\n/)
      if (!top.trim()) return { ok: false, error: `cwd ${opts.cwd} is not inside a git work tree` }
      mainCheckout = p.resolve(top.trim())
      prefix = sub.trim()
    } catch (error) {
      return { ok: false, error: `cwd ${opts.cwd} is not a git repository (${gitError(error)})` }
    }

    let head: string
    try {
      head = (await this.git(['rev-parse', '--verify', 'HEAD^{commit}'], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)).stdout.trim()
    } catch (error) {
      return { ok: false, error: `the main checkout ${mainCheckout} has no commit yet (${gitError(error)})` }
    }
    if (!head) return { ok: false, error: `cannot read HEAD of ${mainCheckout}` }

    const location = ctWorktreeLocation(mainCheckout, workorder, this.platform)
    const branch = ctWorktreeBranch(workorder)
    const subCwd = (root: string): string => {
      if (!prefix) return root
      const candidate = p.join(root, ...prefix.split('/').filter(Boolean))
      return this.existsSync(candidate) ? candidate : root
    }

    try {
      let worktrees = await this.listWorktrees(mainCheckout)
      let atLocation = worktrees.find(w => samePath(w.path, location, this.platform))
      if (atLocation?.prunable) {
        // registered, but its directory is gone: drop the stale registration and create it again
        await this.git(['worktree', 'prune'], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)
        worktrees = await this.listWorktrees(mainCheckout)
        atLocation = worktrees.find(w => samePath(w.path, location, this.platform))
      }
      if (atLocation) {
        if (atLocation.branch !== branch) {
          return { ok: false, error: `${location} is already a worktree of ${atLocation.branch ? `branch ${atLocation.branch}` : 'a detached HEAD'}, not ${branch}` }
        }
        const base = await this.mergeBase(mainCheckout, head, branch)
        return { ok: true, record: { path: location, branch, base, mainCheckout, workorder }, reused: true, createdBranch: false, cwd: subCwd(location) }
      }
      if (this.existsSync(location)) {
        return { ok: false, error: `${location} already exists and is not a worktree of ${branch}` }
      }
      const elsewhere = worktrees.find(w => w.branch === branch)
      if (elsewhere) {
        return { ok: false, error: `branch ${branch} is already checked out at ${elsewhere.path}` }
      }
      if (await this.branchExists(mainCheckout, branch)) {
        await this.git(['worktree', 'add', location, branch], mainCheckout, CT_GIT_CREATE_TIMEOUT_MS)
        const base = await this.mergeBase(mainCheckout, head, branch)
        return { ok: true, record: { path: location, branch, base, mainCheckout, workorder }, reused: false, createdBranch: false, cwd: subCwd(location) }
      }
      await this.git(['worktree', 'add', '-b', branch, location, head], mainCheckout, CT_GIT_CREATE_TIMEOUT_MS)
      return { ok: true, record: { path: location, branch, base: head, mainCheckout, workorder }, reused: false, createdBranch: true, cwd: subCwd(location) }
    } catch (error) {
      return { ok: false, error: `git worktree at ${location} failed: ${gitError(error)}` }
    }
  }

  /**
   * `--close-worker --worktree remove|archive`, after the tab closed. Only a record that follows the
   * location / branch rules and is registered in its main checkout on that branch is touched.
   */
  async cleanup(raw: unknown, mode: Exclude<CtWorktreeCloseMode, 'keep'>): Promise<CtWorktreeCleanupResult> {
    const record = parseCtWorktreeRecord(raw, this.platform)
    if (!record) return { status: 'invalid', detail: 'not a worktree BAT created for a work order' }
    const { mainCheckout, path: location, branch } = record
    if (!this.existsSync(mainCheckout)) return { status: 'failed', detail: `main checkout ${mainCheckout} does not exist` }
    try {
      const worktrees = await this.listWorktrees(mainCheckout)
      const entry = worktrees.find(w => samePath(w.path, location, this.platform))
      if (entry && entry.branch !== branch) {
        return { status: 'invalid', detail: `${location} is a worktree of ${entry.branch ?? 'a detached HEAD'}, not ${branch}` }
      }
      if (entry && !entry.prunable) {
        const { stdout } = await this.git(['status', '--porcelain'], location, CT_GIT_QUERY_TIMEOUT_MS)
        if (stdout.trim()) return { status: 'kept-dirty', detail: 'uncommitted changes' }
        await this.git(['worktree', 'remove', location], mainCheckout, CT_GIT_REMOVE_TIMEOUT_MS)
      } else if (entry?.prunable) {
        await this.git(['worktree', 'prune'], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)
      }
      const removedStatus: CtWorktreeCleanupStatus = entry ? 'removed' : 'missing'
      if (mode === 'remove') return { status: removedStatus }
      if (!(await this.branchExists(mainCheckout, branch))) {
        return { status: removedStatus, detail: `branch ${branch} not found, nothing to archive` }
      }
      const archivedBranch = await this.freeArchiveName(mainCheckout, record.workorder)
      await this.git(['branch', '-m', branch, archivedBranch], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)
      return { status: 'archived', archivedBranch, ...(entry ? {} : { detail: 'worktree was already gone' }) }
    } catch (error) {
      return { status: 'failed', detail: gitError(error) }
    }
  }

  /**
   * T0585 `worktree:terminal-status`: read-only signals of an isolated Worker's worktree for the
   * Tower's merge decision. Reads git only: `rev-parse`, `rev-list`, `diff`, `status` with
   * `--no-optional-locks` (no index refresh written), and `merge-tree --write-tree`, which writes
   * objects into the object database but no ref, index or work tree. ahead / behind / changedFiles /
   * conflicts are cached per (worktree, head, mainHead); `dirty` and the work order's
   * `affects_files` are read on every call. The whole call is limited to `statusTimeoutMs`.
   */
  async status(raw: unknown): Promise<CtWorktreeStatusResult> {
    const record = parseCtWorktreeRecord(raw, this.platform)
    if (!record) return { ok: false, code: 'INVALID', error: 'not a worktree BAT created for a work order' }
    const limit = this.deps.statusTimeoutMs ?? CT_WORKTREE_STATUS_TIMEOUT_MS
    let timer: ReturnType<typeof setTimeout> | null = null
    const timeout = new Promise<CtWorktreeStatusResult>(resolve => {
      timer = setTimeout(() => resolve({ ok: false, code: 'TIMEOUT', error: `worktree status took longer than ${limit} ms` }), limit)
    })
    try {
      return await Promise.race([this.computeStatus(record), timeout])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private readonly statusCache = new Map<string, StatusCacheEntry>()

  private async computeStatus(record: CtWorktreeRecord): Promise<CtWorktreeStatusResult> {
    const { mainCheckout, path: location, branch } = record
    if (!this.existsSync(mainCheckout)) return { ok: false, code: 'GIT_FAILED', error: `main checkout ${mainCheckout} does not exist` }
    const ci = this.platform === 'win32' || this.platform === 'darwin'
    let head: string
    let mainHead: string
    try {
      head = (await this.git(['rev-parse', '--verify', `refs/heads/${branch}^{commit}`], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)).stdout.trim()
    } catch (error) {
      return { ok: false, code: 'GIT_FAILED', error: `branch ${branch} not found in ${mainCheckout} (${gitError(error)})` }
    }
    try {
      mainHead = (await this.git(['rev-parse', '--verify', 'HEAD^{commit}'], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)).stdout.trim()
    } catch (error) {
      return { ok: false, code: 'GIT_FAILED', error: `cannot read HEAD of ${mainCheckout} (${gitError(error)})` }
    }

    // dirty: every call (the Worker may be editing right now)
    let dirty: string[] | null = null
    let dirtyCount: number | null = null
    let worktreeMissing = false
    let dirtyError: string | undefined
    if (!this.existsSync(location)) {
      worktreeMissing = true
    } else {
      try {
        const { stdout } = await this.git(['--no-optional-locks', 'status', '--porcelain=v1', '-z'], location, CT_GIT_QUERY_TIMEOUT_MS)
        const all = parsePorcelainZ(stdout)
        dirty = all.slice(0, CT_STATUS_DIRTY_MAX)
        dirtyCount = all.length
      } catch (error) {
        dirtyError = gitError(error)
      }
    }

    const key = [mainCheckout, location, head, mainHead].join('\0')
    let entry = this.statusCache.get(key)
    const cached = !!entry
    if (!entry) {
      try {
        const counts = (await this.git(['rev-list', '--left-right', '--count', `${mainHead}...${head}`], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)).stdout.trim().split(/\s+/)
        const behind = Number(counts[0])
        const ahead = Number(counts[1])
        if (!Number.isInteger(behind) || !Number.isInteger(ahead)) throw new Error(`unexpected rev-list output '${counts.join(' ')}'`)
        const changed = nulList((await this.git(['diff', '--name-only', '--no-renames', '-z', `${mainHead}...${head}`], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)).stdout)
        let conflicts: string[] | null = []
        let conflictsError: string | undefined
        // A fast-forward either way cannot conflict; merge-tree only when both sides moved.
        if (ahead > 0 && behind > 0) {
          try {
            await this.git(['merge-tree', '--write-tree', '--name-only', '--no-messages', '-z', mainHead, head], mainCheckout, CT_GIT_QUERY_TIMEOUT_MS)
          } catch (error) {
            const e = error as { code?: unknown; stdout?: unknown }
            if (e?.code === 1 && typeof e.stdout === 'string') {
              conflicts = nulList(e.stdout).slice(1) // the first entry is the result tree
            } else {
              conflicts = null
              conflictsError = gitError(error)
            }
          }
        }
        entry = { computedAt: Date.now(), ahead, behind, changed, conflicts, ...(conflictsError ? { conflictsError } : {}) }
      } catch (error) {
        return { ok: false, code: 'GIT_FAILED', error: gitError(error) }
      }
      this.statusCache.set(key, entry)
      while (this.statusCache.size > CT_STATUS_CACHE_MAX) {
        const oldest = this.statusCache.keys().next().value
        if (oldest === undefined) break
        this.statusCache.delete(oldest)
      }
    }

    // affects_files: every call (cheap; the Tower may edit the work order)
    const scope = this.readAffectsFiles(mainCheckout, record.workorder)
    const outOfScope = outOfScopeFiles(entry.changed, scope ? scope.items : null, ci)
    return {
      ok: true,
      isolated: true,
      workorder: record.workorder,
      path: location,
      branch,
      base: record.base,
      mainCheckout,
      head,
      mainHead,
      ahead: entry.ahead,
      behind: entry.behind,
      dirty,
      dirtyCount,
      ...(worktreeMissing ? { worktreeMissing: true as const } : {}),
      ...(dirtyError ? { dirtyError } : {}),
      changedFiles: entry.changed.slice(0, CT_STATUS_CHANGED_MAX),
      changedCount: entry.changed.length,
      outOfScopeFiles: outOfScope ? outOfScope.slice(0, CT_STATUS_CHANGED_MAX) : null,
      ...(outOfScope ? { outOfScopeCount: outOfScope.length } : {}),
      ...(scope ? { workorderFile: scope.file } : {}),
      touchesCtWorkorders: entry.changed.some(f => isCtWorkordersPath(f, ci)),
      conflicts: entry.conflicts,
      ...(entry.conflictsError ? { conflictsError: entry.conflictsError } : {}),
      computedAt: entry.computedAt,
      cached,
    }
  }

  /**
   * `affects_files` of `<mainCheckout>/_ct-workorders/<workorder>-*.md` (the first by name); null
   * when there is no such file or it has no `affects_files`.
   */
  private readAffectsFiles(mainCheckout: string, workorder: string): { file: string; items: string[] } | null {
    try {
      const dir = path.join(mainCheckout, CT_WORKORDERS_DIR)
      const prefix = `${workorder}-`.toLowerCase()
      const name = fs.readdirSync(dir)
        .filter(n => n.toLowerCase().startsWith(prefix) && n.toLowerCase().endsWith('.md'))
        .sort()[0]
      if (!name) return null
      const items = parseWorkorderAffectsFiles(fs.readFileSync(path.join(dir, name), 'utf8'))
      return items ? { file: `${CT_WORKORDERS_DIR}/${name}`, items } : null
    } catch {
      return null
    }
  }

  private async freeArchiveName(mainCheckout: string, workorder: string): Promise<string> {
    const plain = `${CT_WORKTREE_ARCHIVE_PREFIX}${workorder}`
    if (!(await this.branchExists(mainCheckout, plain))) return plain
    const d = this.now()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    for (let n = 0; n < 100; n++) {
      const name = `${plain}-${stamp}${n ? `-${n}` : ''}`
      if (!(await this.branchExists(mainCheckout, name))) return name
    }
    throw new Error(`no free archive branch name for ${workorder}`)
  }
}
