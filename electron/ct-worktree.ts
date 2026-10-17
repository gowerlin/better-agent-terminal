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
  /** Test seam: runs git; rejects with `{ stderr?, message }` on a non-zero exit / timeout. */
  runGit?: (args: string[], opts: { cwd: string; timeoutMs: number }) => Promise<GitRunResult>
  existsSync?: (p: string) => boolean
  now?: () => Date
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
        if (error) reject(Object.assign(error, { stderr }))
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
