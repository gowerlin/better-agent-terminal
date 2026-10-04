/**
 * PLAN-036 P2-H (T0405): `worktree:*` / `git:*` / `git-scaffold:*` / `github:*`,
 * registered by both Electron main and the headless bat-server (see ./types.ts).
 * Moved from `electron/main.ts`; handler bodies are unchanged except:
 *   - host couplings became deps:
 *       `readPersistedSettingsSync()?.githubCliPath` → `deps.getGithubCliPath()`
 *       the module-level gh resolve cache            → per-registration cache below
 *       (main.ts also reset it in `settings:save` when githubCliPath changed — the
 *       cache is keyed by that path, so the reset was redundant and is gone)
 *   - the `execSync('git …')` string calls are `execFileSync(git, [...])` with the
 *     same options (child_process rule: no shell, array args)
 *   - `github:check-cli` decides login with the exit code of `gh auth status`
 *     instead of `gh auth token` (D133: never pull the token into this process),
 *     see `checkGhAuth`.
 *   - `git-scaffold:*` stays in `electron/git/git-ipc.ts`, registered from here.
 *
 * Host differences:
 *   - git executable: Electron spawns plain `git` (PATH lookup, unchanged);
 *     headless passes `getGitBinary` — `resolveGitBinary()` also scans
 *     ~/.local/bin and /usr/local/bin, which a systemd user service PATH lacks.
 *     gh: `resolveGhBinary` already scans those on both hosts.
 *   - githubCliPath: Electron reads userData settings.json, headless the
 *     bat-server dataDir settings.json.
 *   - child env (T0423): headless passes `isScrubbedEnvKey`
 *     (`isHeadlessScrubbedEnvKey`, the rule headless PTYs and the remote-tools
 *     probe use), so the git / gh children of this module get the server env
 *     minus `BAT_*`. Electron passes none and its children inherit
 *     `process.env` as before (no `env` option at all).
 *     T0429: `git-scaffold:*` (simple-git, git-ipc.ts) gets the same scrubbed env,
 *     minus the keys simple-git refuses; `worktree:*` spawns in worktree-manager.ts,
 *     whose env headless sets with `worktreeManager.setEnvProvider`.
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import {
  execFileSync as nodeExecFileSync,
  spawn as nodeSpawn,
  type ExecFileSyncOptionsWithStringEncoding,
  type SpawnOptions,
} from 'child_process'
import { resolveGhBinary, type GhResolveResult } from '../gh-resolver'
import { registerGitScaffoldHandlers } from '../git/git-ipc'
import { worktreeManager } from '../worktree-manager'
import { buildProbeEnv } from './remote-tools'
import type { HandlerRegistrar } from './types'

/** `gh auth status` makes a network round trip (token check); past this the answer is unknown. */
export const GH_AUTH_STATUS_TIMEOUT_MS = 10_000

/** gh 2.40.0 brought multiple accounts per host together with `gh auth status --active`. */
const GH_ACTIVE_FLAG_MIN_VERSION: readonly [number, number, number] = [2, 40, 0]

const GH_HOST_RE = /^[a-zA-Z0-9._-]+$/

export type GhAuthState = 'authenticated' | 'unauthenticated' | 'unknown'

/** The `ChildProcess` surface `checkGhAuth` uses. */
export interface GhAuthChild {
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
  kill(signal?: NodeJS.Signals | number): boolean
}

export type GhAuthSpawn = (file: string, args: string[], options: SpawnOptions) => GhAuthChild

export type GitExecFileSync = (file: string, args: string[], options: ExecFileSyncOptionsWithStringEncoding) => string

export interface GitHandlerDeps {
  /** `githubCliPath` from the host's settings.json (trimmed or not; empty ⇒ auto-resolve). */
  getGithubCliPath(): string | undefined
  /** git executable. Default `git` (Electron, PATH lookup); headless passes its resolved path. */
  getGitBinary?: () => string
  /**
   * Inherited env keys the git / gh children must not see. Headless:
   * `isHeadlessScrubbedEnvKey`. Omitted (Electron) ⇒ no `env` option, children
   * inherit `process.env` unchanged.
   */
  isScrubbedEnvKey?: (key: string) => boolean
  /** Test seams. */
  execFileSync?: GitExecFileSync
  spawn?: GhAuthSpawn
  resolveGh?: typeof resolveGhBinary
  ghAuthTimeoutMs?: number
  /** Default `process.env`: `GH_HOST` for the login check, and the base of the scrubbed child env. */
  getEnv?: () => NodeJS.ProcessEnv
}

/** `[major, minor, patch]` from `gh --version` output (`gh version 2.102.0 (2026-09-30)`), or null. */
export function parseGhVersion(output: string): [number, number, number] | null {
  const m = /gh version (\d+)\.(\d+)\.(\d+)/.exec(output)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

function versionAtLeast(v: readonly [number, number, number], min: readonly [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (v[i] !== min[i]) return v[i] > min[i]
  }
  return true
}

/**
 * Args for the login check. Same scope as the old `gh auth token`: one account —
 * the active one — on the host the panel's `gh … --repo owner/repo` commands talk
 * to (`GH_HOST`, else github.com). Without `--active`, `gh auth status` exits 1
 * when ANY account on the host has a problem; gh older than 2.40 has no
 * `--active`, but also only one account per host, so plain status is the same check.
 * An unreadable version is treated as a current gh.
 */
export function ghAuthStatusArgs(versionOutput: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const host = env.GH_HOST?.trim()
  const args = ['auth', 'status', '--hostname', host && GH_HOST_RE.test(host) ? host : 'github.com']
  const version = parseGhVersion(versionOutput)
  if (!version || versionAtLeast(version, GH_ACTIVE_FLAG_MIN_VERSION)) args.push('--active')
  return args
}

/**
 * One `gh auth status` run → login state, from the exit code alone: stdout /
 * stderr are never read (stdio ignored), so neither the masked token line nor
 * account names reach this process. exit 0 → authenticated, other exit code →
 * unauthenticated, spawn error / signal / timeout → unknown.
 */
export function checkGhAuth(
  ghPath: string,
  args: string[],
  opts: { spawn?: GhAuthSpawn; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<GhAuthState> {
  const spawn = opts.spawn ?? (nodeSpawn as unknown as GhAuthSpawn)
  const timeoutMs = opts.timeoutMs ?? GH_AUTH_STATUS_TIMEOUT_MS
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let settled = false
    const finish = (state: GhAuthState) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(state)
    }
    let child: GhAuthChild
    try {
      child = spawn(ghPath, args, { stdio: 'ignore', windowsHide: true, ...(opts.env ? { env: opts.env } : {}) })
    } catch {
      finish('unknown')
      return
    }
    timer = setTimeout(() => {
      try { child.kill() } catch { /* already gone */ }
      finish('unknown')
    }, timeoutMs)
    child.on('error', () => finish('unknown'))
    child.on('exit', code => finish(code === null ? 'unknown' : code === 0 ? 'authenticated' : 'unauthenticated'))
  })
}

export function registerGitHandlers(register: HandlerRegistrar, deps: GitHandlerDeps): void {
  const baseExecFileSync: GitExecFileSync = deps.execFileSync ?? nodeExecFileSync
  const resolveGh = deps.resolveGh ?? resolveGhBinary
  const git = () => deps.getGitBinary?.() ?? 'git'
  const getEnv = deps.getEnv ?? (() => process.env)
  /** Scrubbed env for one child, or undefined (Electron: inherit `process.env`). */
  const childEnv = (): NodeJS.ProcessEnv | undefined =>
    deps.isScrubbedEnvKey ? buildProbeEnv(getEnv(), deps.isScrubbedEnvKey) : undefined
  const execFileSync: GitExecFileSync = (file, args, options) => {
    const env = childEnv()
    return baseExecFileSync(file, args, env ? { ...options, env } : options)
  }

  // Standalone worktree operations (for claude-cli preset, not tied to SDK session)
  register('worktree:create', async (_ctx, sessionId: string, cwd: string) => {
    try {
      const info = await worktreeManager.createWorktree(sessionId, cwd)
      return { success: true, ...info }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  register('worktree:remove', async (_ctx, sessionId: string, deleteBranch: boolean) => {
    try {
      await worktreeManager.removeWorktree(sessionId, deleteBranch)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  register('worktree:status', async (_ctx, sessionId: string) => {
    return worktreeManager.getWorktreeStatus(sessionId)
  })
  register('worktree:rehydrate', (_ctx, sessionId: string, cwd: string, worktreePath: string, branchName: string) => {
    worktreeManager.rehydrate(sessionId, cwd, worktreePath, branchName)
    return { success: true }
  })

  // Git — legacy child_process handlers (retained for existing GitPanel)
  // Phase 3 Tα1 scaffold (T0155) — simple-git backed channels live under `git-scaffold:*`
  registerGitScaffoldHandlers(register, { getGitBinary: deps.getGitBinary, getEnv: childEnv })

  register('git:get-github-url', async (_ctx, folderPath: string) => {
    try {
      const remote = execFileSync(git(), ['remote', 'get-url', 'origin'], { cwd: folderPath, encoding: 'utf-8', timeout: 3000, windowsHide: true }).trim()
      const sshMatch = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/)
      if (sshMatch) return `https://github.com/${sshMatch[1]}`
      const httpsMatch = remote.match(/^https?:\/\/github\.com\/(.+?)(?:\.git)?$/)
      if (httpsMatch) return `https://github.com/${httpsMatch[1]}`
      return null
    } catch { return null }
  })
  register('git:branch', async (_ctx, cwd: string) => {
    try {
      return execFileSync(git(), ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }).trim() || null
    } catch { return null }
  })
  register('git:log', async (_ctx, cwd: string, count: number = 50) => {
    try {
      const safeCount = Math.max(1, Math.min(Math.floor(Number(count)) || 50, 500))
      const raw = execFileSync(git(), ['log', `--pretty=format:%H||%an||%ai||%s`, '-n', String(safeCount)], { cwd, encoding: 'utf-8', timeout: 5000, windowsHide: true }).trim()
      if (!raw) return []
      return raw.split('\n').map(line => {
        const parts = line.split('||')
        return { hash: parts[0], author: parts[1], date: parts[2], message: parts.slice(3).join('||') }
      })
    } catch { return [] }
  })
  register('git:diff', async (_ctx, cwd: string, commitHash?: string, filePath?: string) => {
    try {
      const args = commitHash && commitHash !== 'working'
        ? ['diff', `${commitHash}~1..${commitHash}`]
        : ['diff', 'HEAD']
      if (filePath) args.push('--', filePath)
      return execFileSync(git(), args, { cwd, encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 * 5, windowsHide: true })
    } catch { return '' }
  })
  register('git:diff-files', async (_ctx, cwd: string, commitHash?: string) => {
    try {
      const args = commitHash && commitHash !== 'working'
        ? ['diff', '--name-status', `${commitHash}~1..${commitHash}`]
        : ['diff', '--name-status', 'HEAD']
      const raw = execFileSync(git(), args, { cwd, encoding: 'utf-8', timeout: 5000, windowsHide: true })
      if (!raw.trim()) return []
      return raw.trim().split('\n').map(line => {
        const tab = line.indexOf('\t')
        return { status: tab > 0 ? line.substring(0, tab).trim() : line.charAt(0), file: tab > 0 ? line.substring(tab + 1) : line.substring(2) }
      })
    } catch { return [] }
  })
  register('git:getRoot', async (_ctx, cwd: string) => {
    try {
      return execFileSync(git(), ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf-8', timeout: 5000, windowsHide: true }).trim()
    } catch { return null }
  })
  register('git:status', async (_ctx, cwd: string) => {
    try {
      const raw = execFileSync(git(), ['status', '--porcelain', '-uall'], { cwd, encoding: 'utf-8', timeout: 5000, windowsHide: true })
      if (!raw.trim()) return []
      return raw.split('\n').filter(line => line.trim()).map(line => ({ status: line.substring(0, 2).trim(), file: line.substring(3) }))
    } catch { return [] }
  })

  // GitHub CLI (gh)
  let cachedGhResolveResult: GhResolveResult | null = null
  let cachedGhCustomPath: string | undefined
  const resolveConfiguredGh = async (): Promise<GhResolveResult> => {
    const customPath = deps.getGithubCliPath()?.trim() || undefined
    if (cachedGhResolveResult && cachedGhCustomPath === customPath) {
      return cachedGhResolveResult
    }
    const resolved = await resolveGh({ customPath })
    cachedGhResolveResult = resolved
    cachedGhCustomPath = customPath
    return resolved
  }

  const resolveGhForRequest = async (customPath?: string): Promise<GhResolveResult> => {
    if (typeof customPath === 'string') {
      return resolveGh({ customPath: customPath.trim() || undefined })
    }
    return resolveConfiguredGh()
  }

  register('github:check-cli', async (_ctx, customPath?: string) => {
    const resolved = await resolveGhForRequest(customPath)
    if (!resolved.found || !resolved.path) {
      return {
        installed: false,
        authenticated: false,
        attemptedPaths: resolved.attemptedPaths,
        error: resolved.error,
      }
    }

    let versionOutput: string
    try {
      versionOutput = execFileSync(resolved.path, ['--version'], { encoding: 'utf-8', timeout: 5000, windowsHide: true })
    } catch (e) {
      return {
        installed: false,
        authenticated: false,
        path: resolved.path,
        source: resolved.source,
        attemptedPaths: resolved.attemptedPaths,
        error: e instanceof Error ? e.message : String(e),
      }
    }

    // D133: exit code of `gh auth status` only — `gh auth token` would print the token into this process.
    const timeoutMs = deps.ghAuthTimeoutMs ?? GH_AUTH_STATUS_TIMEOUT_MS
    const authState = await checkGhAuth(
      resolved.path,
      ghAuthStatusArgs(String(versionOutput ?? ''), getEnv()),
      { spawn: deps.spawn, timeoutMs, env: childEnv() },
    )
    return {
      installed: true,
      authenticated: authState === 'authenticated',
      authState,
      path: resolved.path,
      source: resolved.source,
      attemptedPaths: resolved.attemptedPaths,
      ...(authState === 'unknown' ? { error: `gh auth status gave no answer (timeout ${timeoutMs}ms, signal or spawn error)` } : {}),
    }
  })
  // Helper: extract "owner/repo" from the git origin remote URL for the given cwd.
  // This ensures gh CLI always operates against the user's own fork/remote rather than
  // any upstream remote that gh might auto-detect.
  const getGithubRepoFromOrigin = (cwd: string): string | null => {
    try {
      const remote = execFileSync(git(), ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf-8', timeout: 3000, windowsHide: true }).trim()
      const sshMatch = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/)
      if (sshMatch) return sshMatch[1]
      const httpsMatch = remote.match(/^https?:\/\/github\.com\/(.+?)(?:\.git)?$/)
      if (httpsMatch) return httpsMatch[1]
      return null
    } catch { return null }
  }
  register('github:pr-list', async (_ctx, cwd: string) => {
    try {
      const resolved = await resolveConfiguredGh()
      if (!resolved.found || !resolved.path) return { error: resolved.error || 'GitHub CLI not found', attemptedPaths: resolved.attemptedPaths }
      const repo = getGithubRepoFromOrigin(cwd)
      const repoArgs = repo ? ['--repo', repo] : []
      const raw = execFileSync(resolved.path, ['pr', 'list', ...repoArgs, '--json', 'number,title,state,author,createdAt,updatedAt,labels,headRefName,isDraft', '--limit', '50'], { cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 5 * 1024 * 1024, windowsHide: true })
      return JSON.parse(raw)
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  register('github:issue-list', async (_ctx, cwd: string) => {
    try {
      const resolved = await resolveConfiguredGh()
      if (!resolved.found || !resolved.path) return { error: resolved.error || 'GitHub CLI not found', attemptedPaths: resolved.attemptedPaths }
      const repo = getGithubRepoFromOrigin(cwd)
      const repoArgs = repo ? ['--repo', repo] : []
      const raw = execFileSync(resolved.path, ['issue', 'list', ...repoArgs, '--json', 'number,title,state,author,createdAt,updatedAt,labels', '--limit', '50'], { cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 5 * 1024 * 1024, windowsHide: true })
      return JSON.parse(raw)
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  register('github:pr-view', async (_ctx, cwd: string, number: number) => {
    try {
      const resolved = await resolveConfiguredGh()
      if (!resolved.found || !resolved.path) return { error: resolved.error || 'GitHub CLI not found', attemptedPaths: resolved.attemptedPaths }
      const repo = getGithubRepoFromOrigin(cwd)
      const repoArgs = repo ? ['--repo', repo] : []
      const raw = execFileSync(resolved.path, ['pr', 'view', String(number), ...repoArgs, '--json', 'number,title,state,author,body,comments,reviews,createdAt,headRefName,baseRefName,additions,deletions,files'], { cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 5 * 1024 * 1024, windowsHide: true })
      return JSON.parse(raw)
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  register('github:issue-view', async (_ctx, cwd: string, number: number) => {
    try {
      const resolved = await resolveConfiguredGh()
      if (!resolved.found || !resolved.path) return { error: resolved.error || 'GitHub CLI not found', attemptedPaths: resolved.attemptedPaths }
      const repo = getGithubRepoFromOrigin(cwd)
      const repoArgs = repo ? ['--repo', repo] : []
      const raw = execFileSync(resolved.path, ['issue', 'view', String(number), ...repoArgs, '--json', 'number,title,state,author,body,comments,createdAt,labels'], { cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 5 * 1024 * 1024, windowsHide: true })
      return JSON.parse(raw)
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  register('github:pr-comment', async (_ctx, cwd: string, number: number, body: string) => {
    try {
      const resolved = await resolveConfiguredGh()
      if (!resolved.found || !resolved.path) return { error: resolved.error || 'GitHub CLI not found' }
      const repo = getGithubRepoFromOrigin(cwd)
      const repoArgs = repo ? ['--repo', repo] : []
      execFileSync(resolved.path, ['pr', 'comment', String(number), ...repoArgs, '--body', body], { cwd, encoding: 'utf-8', timeout: 15000, windowsHide: true })
      return { success: true }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  register('github:issue-comment', async (_ctx, cwd: string, number: number, body: string) => {
    try {
      const resolved = await resolveConfiguredGh()
      if (!resolved.found || !resolved.path) return { error: resolved.error || 'GitHub CLI not found' }
      const repo = getGithubRepoFromOrigin(cwd)
      const repoArgs = repo ? ['--repo', repo] : []
      execFileSync(resolved.path, ['issue', 'comment', String(number), ...repoArgs, '--body', body], { cwd, encoding: 'utf-8', timeout: 15000, windowsHide: true })
      return { success: true }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
}
