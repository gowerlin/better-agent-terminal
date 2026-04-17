/**
 * Phase 3 Tα1 — renderer-side wrapper over the simple-git IPC scaffold (T0155).
 *
 * Pairs with `electron/git/git-ipc.ts`. Keeps the preload surface typed and
 * provides a single import point for the upcoming Tα2–Tα5 panels.
 */

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

export interface GitScaffoldListCommitsOptions {
  limit?: number
  offset?: number
}

export interface GitScaffoldListCommitsResult {
  ok: boolean
  commits: GitScaffoldCommit[]
  error?: string
}

function api() {
  // Surface a clear error if the renderer runs without the preload bridge (e.g. browser-only bench).
  const scaffold = typeof window !== 'undefined' ? window.electronAPI?.gitScaffold : undefined
  if (!scaffold) throw new Error('gitScaffold IPC bridge is not available in this context')
  return scaffold
}

export async function healthCheck(cwd: string): Promise<GitScaffoldHealth> {
  return api().healthCheck(cwd)
}

export async function getRepoInfo(cwd: string): Promise<GitScaffoldRepoInfo> {
  return api().getRepoInfo(cwd)
}

export async function listCommits(
  cwd: string,
  options?: GitScaffoldListCommitsOptions,
): Promise<GitScaffoldListCommitsResult> {
  return api().listCommits(cwd, options)
}
