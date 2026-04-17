/**
 * Phase 3 Tα1 — simple-git IPC handlers (T0155).
 *
 * Scaffold-level Git backend for the new Git Graph panel. Uses simple-git
 * (MIT, per T0152 licensing review) and coexists with the legacy `git:*`
 * child_process handlers registered in main.ts. Naming is prefixed with
 * `git-scaffold:` so the two stacks do not clash.
 *
 * Future work orders (Tα2–Tα5) extend these channels — do not inline extra
 * logic here that belongs to graph / indexing / operations phases.
 */

import simpleGit, { type SimpleGit, type SimpleGitOptions } from 'simple-git'
import { logger } from '../logger'
import { registerHandler } from '../remote/handler-registry'

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

function makeGit(cwd: string): SimpleGit {
  return simpleGit(cwd, GIT_OPTS)
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

async function resolveRepoRoot(cwd: string): Promise<{ isRepo: boolean; root: string | null; git: SimpleGit }> {
  const git = makeGit(cwd)
  const isRepo = await git.checkIsRepo().catch(() => false)
  if (!isRepo) return { isRepo: false, root: null, git }
  const root = (await git.revparse(['--show-toplevel']).catch(() => '')).trim() || null
  return { isRepo: true, root, git }
}

export function registerGitScaffoldHandlers(): void {
  registerHandler('git-scaffold:healthCheck', async (_ctx, cwd: string) => {
    try {
      const { isRepo, root } = await resolveRepoRoot(cwd)
      const result: GitScaffoldHealth = { ok: true, isRepo, gitRoot: root }
      return result
    } catch (err) {
      const message = errMessage(err)
      logger.error(`[git-scaffold] healthCheck failed for ${cwd}: ${message}`)
      const result: GitScaffoldHealth = { ok: false, isRepo: false, gitRoot: null, error: message }
      return result
    }
  })

  registerHandler('git-scaffold:getRepoInfo', async (_ctx, cwd: string) => {
    try {
      const { isRepo, root, git } = await resolveRepoRoot(cwd)
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

  registerHandler('git-scaffold:listCommits', async (_ctx, cwd: string, options?: { limit?: number; offset?: number }) => {
    const limit = Math.max(1, Math.min(Math.floor(Number(options?.limit)) || 100, 2000))
    const offset = Math.max(0, Math.floor(Number(options?.offset)) || 0)
    try {
      const { isRepo, git } = await resolveRepoRoot(cwd)
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
