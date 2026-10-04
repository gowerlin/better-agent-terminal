/**
 * Phase 3 Tα1 — simple-git IPC handlers (T0155).
 *
 * Scaffold-level Git backend for the new Git Graph panel. Uses simple-git
 * (MIT, per T0152 licensing review) and coexists with the legacy `git:*`
 * child_process handlers in electron/handlers/git.ts. Naming is prefixed with
 * `git-scaffold:` so the two stacks do not clash.
 *
 * T0405 (PLAN-036): registered through `registerGitHandlers` (handlers/git.ts)
 * on both Electron main and headless bat-server, with the host's `register`.
 * 🔴 No `electron` import here (headless-electron-free guard).
 *
 * Future work orders (Tα2–Tα5) extend these channels — do not inline extra
 * logic here that belongs to graph / indexing / operations phases.
 */

import simpleGit, { type SimpleGit, type SimpleGitOptions } from 'simple-git'
import { logger } from '../logger'
import type { HandlerRegistrar } from '../handlers/types'

export interface GitScaffoldHealth {
  ok: boolean
  isRepo: boolean
  gitRoot: string | null
  error?: string
}

export interface GitScaffoldRepoInfo {
  ok: boolean
  head: string | null
  branch: string | null
  detached: boolean
  remotes: Array<{ name: string; url: string }>
  gitRoot: string | null
  error?: string
}

export interface GitScaffoldCommit {
  hash: string
  abbrevHash: string
  parents: string[]
  authorName: string
  authorEmail: string
  date: string
  subject: string
}

export interface GitScaffoldListCommitsResult {
  ok: boolean
  commits: GitScaffoldCommit[]
  error?: string
}

const GIT_OPTS: Partial<SimpleGitOptions> = {
  binary: 'git',
  maxConcurrentProcesses: 6,
  timeout: { block: 10000 },
}

export interface GitScaffoldDeps {
  /** git executable. Default `git` (Electron); headless passes its resolved path (T0405). */
  getGitBinary?: () => string
  /**
   * T0429: env for the git children, read per call. Headless passes the server env
   * minus `BAT_*`; the keys simple-git refuses are dropped here
   * (`stripSimpleGitUnsafeEnv`). Omitted or undefined (Electron) ⇒ `.env()` is never
   * called and git inherits `process.env` unchanged.
   */
  getEnv?: () => NodeJS.ProcessEnv | undefined
}

/**
 * T0429: env keys simple-git's `blockUnsafeOperationsPlugin` rejects when they
 * appear in an env given through `.env()` (`Use of "EDITOR" is not permitted without
 * enabling allowUnsafeEditor`). Mirrors the `y` map of
 * `@simple-git/argv-parser` 1.1.1 `dist/index.cjs` (simple-git 3.36.0), matched like
 * its `parseEnv`: key lowercased and trimmed. Dropping `git_config_count` also
 * disarms its `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` config check (git ignores
 * those keys without the count). 🔴 Do not turn on the `unsafe` options instead.
 */
export const SIMPLE_GIT_UNSAFE_ENV_KEYS: ReadonlySet<string> = new Set([
  'editor',
  'git_askpass',
  'git_config_global',
  'git_config_system',
  'git_config_count',
  'git_config',
  'git_editor',
  'git_exec_path',
  'git_external_diff',
  'git_pager',
  'git_proxy_command',
  'git_template_dir',
  'git_sequence_editor',
  'git_ssh',
  'git_ssh_command',
  'pager',
  'prefix',
  'ssh_askpass',
])

/** `env` without the keys simple-git refuses (and without undefined values). */
export function stripSimpleGitUnsafeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || SIMPLE_GIT_UNSAFE_ENV_KEYS.has(key.toLowerCase().trim())) continue
    out[key] = value
  }
  return out
}

function makeGit(cwd: string, binary = 'git', env?: NodeJS.ProcessEnv): SimpleGit {
  const git = createGit(cwd, binary)
  return env ? git.env(stripSimpleGitUnsafeEnv(env)) : git
}

function createGit(cwd: string, binary: string): SimpleGit {
  if (binary === 'git') return simpleGit(cwd, GIT_OPTS)
  try {
    return simpleGit(cwd, { ...GIT_OPTS, binary })
  } catch {
    // simple-git rejects binary paths with characters outside its allow-list; PATH lookup instead.
    return simpleGit(cwd, GIT_OPTS)
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

async function resolveRepoRoot(cwd: string, binary?: string, env?: NodeJS.ProcessEnv): Promise<{ isRepo: boolean; root: string | null; git: SimpleGit }> {
  const git = makeGit(cwd, binary, env)
  const isRepo = await git.checkIsRepo().catch(() => false)
  if (!isRepo) return { isRepo: false, root: null, git }
  const root = (await git.revparse(['--show-toplevel']).catch(() => '')).trim() || null
  return { isRepo: true, root, git }
}

export function registerGitScaffoldHandlers(register: HandlerRegistrar, deps: GitScaffoldDeps = {}): void {
  const gitBinary = () => deps.getGitBinary?.() ?? 'git'
  const repoRoot = (cwd: string) => resolveRepoRoot(cwd, gitBinary(), deps.getEnv?.())

  register('git-scaffold:healthCheck', async (_ctx, cwd: string) => {
    try {
      const { isRepo, root } = await repoRoot(cwd)
      const result: GitScaffoldHealth = { ok: true, isRepo, gitRoot: root }
      return result
    } catch (err) {
      const message = errMessage(err)
      logger.error(`[git-scaffold] healthCheck failed for ${cwd}: ${message}`)
      const result: GitScaffoldHealth = { ok: false, isRepo: false, gitRoot: null, error: message }
      return result
    }
  })

  register('git-scaffold:getRepoInfo', async (_ctx, cwd: string) => {
    try {
      const { isRepo, root, git } = await repoRoot(cwd)
      if (!isRepo) {
        const result: GitScaffoldRepoInfo = {
          ok: false,
          head: null,
          branch: null,
          detached: false,
          remotes: [],
          gitRoot: null,
          error: 'Not a git repository',
        }
        return result
      }
      const [head, branches, remotes] = await Promise.all([
        git.revparse(['HEAD']).then(s => s.trim() || null).catch(() => null),
        git.branch().catch(() => null),
        git.getRemotes(true).catch(() => []),
      ])
      const current = branches?.current || null
      const detached = !current || current === 'HEAD'
      const result: GitScaffoldRepoInfo = {
        ok: true,
        head,
        branch: detached ? null : current,
        detached,
        remotes: (remotes ?? [])
          .filter(r => r && r.name)
          .map(r => ({ name: r.name, url: (r.refs?.fetch || r.refs?.push || '').toString() })),
        gitRoot: root,
      }
      return result
    } catch (err) {
      const message = errMessage(err)
      logger.error(`[git-scaffold] getRepoInfo failed for ${cwd}: ${message}`)
      const result: GitScaffoldRepoInfo = {
        ok: false,
        head: null,
        branch: null,
        detached: false,
        remotes: [],
        gitRoot: null,
        error: message,
      }
      return result
    }
  })

  register('git-scaffold:listCommits', async (_ctx, cwd: string, options?: { limit?: number; offset?: number }) => {
    // limit cap 於 T0156 自 2000 提升到 10000,以支援 Git Graph panel 單次載入 10k
    // commits 的初始策略。Tα3 後若需更大範圍,會改為真正的增量分頁。
    const limit = Math.max(1, Math.min(Math.floor(Number(options?.limit)) || 100, 10000))
    const offset = Math.max(0, Math.floor(Number(options?.offset)) || 0)
    try {
      const { isRepo, git } = await repoRoot(cwd)
      if (!isRepo) {
        const result: GitScaffoldListCommitsResult = { ok: false, commits: [], error: 'Not a git repository' }
        return result
      }
      // simple-git's log() doesn't expose skip directly; use raw to keep it cheap & predictable.
      const raw = await git.raw([
        'log',
        `--max-count=${limit}`,
        `--skip=${offset}`,
        '--pretty=format:%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s',
      ])
      if (!raw.trim()) {
        const result: GitScaffoldListCommitsResult = { ok: true, commits: [] }
        return result
      }
      const commits: GitScaffoldCommit[] = raw
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => {
          const [hash, abbrev, parents, name, email, date, subject] = line.split('\x1f')
          return {
            hash: hash ?? '',
            abbrevHash: abbrev ?? '',
            parents: parents ? parents.split(' ').filter(Boolean) : [],
            authorName: name ?? '',
            authorEmail: email ?? '',
            date: date ?? '',
            subject: subject ?? '',
          }
        })
      const result: GitScaffoldListCommitsResult = { ok: true, commits }
      return result
    } catch (err) {
      const message = errMessage(err)
      logger.error(`[git-scaffold] listCommits failed for ${cwd}: ${message}`)
      const result: GitScaffoldListCommitsResult = { ok: false, commits: [], error: message }
      return result
    }
  })
}
