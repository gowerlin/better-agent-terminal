// @vitest-environment node
/**
 * T0405 (PLAN-036 P2-H): worktree:* / git:* / git-scaffold:* / github:* online on headless.
 *
 * Wire-level through the T0388 harness (in-process headless + wss client) against a
 * real `mkdtemp` repo built with the real git — the user's repos are never touched.
 * git is resolved by the headless resolver (`resolveGitBinary`, PATH first). gh is a
 * fake (path + `--version` + spawn) so the test does not depend on the machine's gh
 * install or login, and never runs gh at all.
 * T0429: `execFile` (worktree-manager) and simple-git `.env()` are wrapped
 * pass-through to record the env the worktree / git-scaffold git children get.
 */
import { execFileSync } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { GitResolveResult } from '../../gh-resolver'
import type { GhAuthSpawn, GitExecFileSync } from '../../handlers/git'
import { createHeadlessGitBinaryResolver } from '../headless-entry'
import { HEADLESS_UNSUPPORTED } from '../headless-channel-status'
import { PROXIED_CHANNELS } from '../protocol'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'
import { SIMPLE_GIT_UNSAFE_ENV_KEYS } from '../../git/git-ipc'

const { worktreeGitEnvs, scaffoldEnvs } = vi.hoisted(() => ({
  worktreeGitEnvs: [] as Array<NodeJS.ProcessEnv | undefined>,
  scaffoldEnvs: [] as unknown[],
}))

vi.mock('child_process', async importOriginal => {
  const real = await importOriginal<typeof import('child_process')>()
  const { promisify } = await import('util')
  const realCustom = (real.execFile as unknown as Record<symbol, (...a: unknown[]) => unknown>)[promisify.custom]
  const execFile = ((...a: unknown[]) => (real.execFile as (...b: unknown[]) => unknown)(...a)) as unknown as Record<symbol, unknown>
  execFile[promisify.custom] = (file: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
    worktreeGitEnvs.push(options?.env)
    return realCustom(file, args, options)
  }
  return { ...real, default: { ...real, execFile }, execFile }
})

vi.mock('simple-git', async importOriginal => {
  const real = await importOriginal<typeof import('simple-git')>()
  const wrapped = ((...args: Parameters<typeof real.default>) => {
    const git = real.default(...args)
    const env = git.env.bind(git) as (...a: unknown[]) => typeof git
    git.env = ((...a: unknown[]) => {
      scaffoldEnvs.push(a[0])
      return env(...a)
    }) as typeof git.env
    return git
  }) as typeof real.default
  return { ...real, default: wrapped, simpleGit: wrapped }
})

const FAKE_GH = path.join(os.tmpdir(), 'bat-t0405-fake', 'gh')
const SESSION = 't0405-harness-session'

const ghSpawnCalls: string[][] = []
const ghSpawnEnvs: Array<NodeJS.ProcessEnv | undefined> = []
const ghSpawn: GhAuthSpawn = (_file, args, options) => {
  ghSpawnCalls.push(args)
  ghSpawnEnvs.push(options.env)
  const child = Object.assign(new EventEmitter(), { kill: () => true })
  queueMicrotask(() => child.emit('exit', 1, null)) // gh installed, not logged in
  return child
}
/** T0423: env each git / gh child of `git:*` / `github:*` was given. */
const childEnvs: Array<{ file: string; env: NodeJS.ProcessEnv | undefined }> = []
const execWithFakeGh: GitExecFileSync = (file, args, options) => {
  childEnvs.push({ file, env: options.env })
  if (file === FAKE_GH) return 'gh version 2.102.0 (2026-09-30)\n'
  return execFileSync(file, args, options)
}

let repo: string
let harness: HeadlessHarness

function git(...args: string[]): string {
  return execFileSync('git', ['-C', repo, '-c', 'user.name=t0405', '-c', 'user.email=t0405@localhost', '-c', 'commit.gpgsign=false', ...args], {
    encoding: 'utf-8', timeout: 10_000, windowsHide: true,
  })
}

const samePath = (a: unknown, b: string) =>
  typeof a === 'string' && path.resolve(fs.realpathSync.native(a)).toLowerCase() === path.resolve(fs.realpathSync.native(b)).toLowerCase()

beforeAll(async () => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0405-repo-'))
  execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q', repo], { timeout: 10_000, windowsHide: true })
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'one\n')
  git('add', 'tracked.txt')
  git('commit', '-q', '--no-verify', '-m', 't0405 first')
  git('commit', '-q', '--no-verify', '--allow-empty', '-m', 't0405 second')
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'one\ntwo\n')
  fs.writeFileSync(path.join(repo, 'untracked.txt'), 'x\n')

  harness = await startHeadlessHarness({
    git: {
      resolveGh: async () => ({ found: true, path: FAKE_GH, source: 'path', attemptedPaths: [FAKE_GH] }),
      execFileSync: execWithFakeGh,
      spawn: ghSpawn,
      // T0423: the server env the children inherit: the real one (git needs PATH etc.)
      // with BAT_* keys planted, and without GH_HOST so the login check targets github.com.
      // T0429: plus keys simple-git refuses in an env (a server started from a shell).
      getEnv: () => {
        const { GH_HOST: _ghHost, ...env } = process.env
        return {
          ...env, BAT_REMOTE_TOKEN: 't0423-secret', BAT_TOWER_TERMINAL_ID: 't0423-tower', bat_t0423_lower: 'x',
          EDITOR: 'vim', PAGER: 'less', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes', GIT_ASKPASS: '/usr/bin/true',
        }
      },
    },
    timeoutMs: 20_000,
  })
}, 60_000)

afterAll(async () => {
  await harness?.dispose()
  if (repo) fs.rmSync(repo, { recursive: true, force: true, maxRetries: 3 })
})

const T0405_CHANNELS = [
  'worktree:create', 'worktree:remove', 'worktree:status', 'worktree:rehydrate',
  'github:check-cli', 'github:pr-list', 'github:issue-list', 'github:pr-view', 'github:issue-view',
  'github:pr-comment', 'github:issue-comment',
  'git:branch', 'git:log', 'git:diff', 'git:diff-files', 'git:status', 'git:get-github-url', 'git:getRoot',
  'git-scaffold:healthCheck', 'git-scaffold:getRepoInfo', 'git-scaffold:listCommits',
]

describe('git / github / worktree on headless (T0405)', () => {
  it('all 21 channels are proxied and no longer listed unsupported', () => {
    for (const channel of T0405_CHANNELS) {
      expect(PROXIED_CHANNELS.has(channel), channel).toBe(true)
      expect(HEADLESS_UNSUPPORTED[channel], channel).toBeUndefined()
    }
  })

  it('git:getRoot / git:branch / git:log / git:status answer from the temp repo', async () => {
    expect(samePath(await harness.invoke('git:getRoot', repo), repo)).toBe(true)
    expect(await harness.invoke('git:branch', repo)).toBe('main')
    const log = await harness.invoke('git:log', repo, 10) as Array<{ message: string; author: string }>
    expect(log.map(c => c.message)).toEqual(['t0405 second', 't0405 first'])
    expect(log[0].author).toBe('t0405')
    expect(await harness.invoke('git:status', repo)).toEqual([
      { status: 'M', file: 'tracked.txt' },
      { status: '??', file: 'untracked.txt' },
    ])
    expect(await harness.invoke('git:diff-files', repo, 'working')).toEqual([{ status: 'M', file: 'tracked.txt' }])
    expect(await harness.invoke('git:diff', repo, 'working', 'tracked.txt')).toMatch(/\+two/)
    expect(await harness.invoke('git:get-github-url', repo)).toBeNull() // no origin
  })

  it('a directory that is not a repo gives the empty answers, not an error', async () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0405-plain-'))
    try {
      expect(await harness.invoke('git:getRoot', plain)).toBeNull()
      expect(await harness.invoke('git:log', plain)).toEqual([])
      expect(await harness.invoke('git-scaffold:healthCheck', plain)).toMatchObject({ ok: true, isRepo: false, gitRoot: null })
    } finally {
      fs.rmSync(plain, { recursive: true, force: true })
    }
  })

  it('git-scaffold:healthCheck / getRepoInfo / listCommits (simple-git) answer from the temp repo', async () => {
    const health = await harness.invoke('git-scaffold:healthCheck', repo) as { ok: boolean; isRepo: boolean; gitRoot: string }
    expect(health).toMatchObject({ ok: true, isRepo: true })
    expect(samePath(health.gitRoot, repo)).toBe(true)
    expect(await harness.invoke('git-scaffold:getRepoInfo', repo)).toMatchObject({ ok: true, branch: 'main', detached: false, remotes: [] })
    const commits = await harness.invoke('git-scaffold:listCommits', repo, { limit: 10 }) as { ok: boolean; commits: Array<{ subject: string }> }
    expect(commits.ok).toBe(true)
    expect(commits.commits.map(c => c.subject)).toEqual(['t0405 second', 't0405 first'])
  })

  it('worktree:create → worktree:status → worktree:remove inside the temp repo', async () => {
    const created = await harness.invoke('worktree:create', SESSION, repo) as { success: boolean; worktreePath: string; branchName: string }
    expect(created).toMatchObject({ success: true, branchName: `bat/worktree-${SESSION.slice(0, 8)}` })
    expect(samePath(path.dirname(path.dirname(created.worktreePath)), repo)).toBe(true)
    expect(git('worktree', 'list')).toContain('.bat-worktrees')

    const status = await harness.invoke('worktree:status', SESSION) as { branchName: string; sourceBranch: string }
    expect(status).toMatchObject({ branchName: created.branchName, sourceBranch: 'main' })
    expect(await harness.invoke('worktree:status', 'no-such-session')).toBeNull()

    expect(await harness.invoke('worktree:remove', SESSION, true)).toEqual({ success: true })
    expect(fs.existsSync(created.worktreePath)).toBe(false)
    expect(git('branch', '--list', created.branchName).trim()).toBe('')
  })

  it('github:check-cli answers installed + not logged in, from `gh auth status` (no token)', async () => {
    ghSpawnCalls.length = 0
    expect(await harness.invoke('github:check-cli')).toEqual({
      installed: true, authenticated: false, authState: 'unauthenticated',
      path: FAKE_GH, source: 'path', attemptedPaths: [FAKE_GH],
    })
    expect(ghSpawnCalls).toEqual([['auth', 'status', '--hostname', 'github.com', '--active']])
  })

  it('T0423: git / gh children get the server env minus BAT_* (isHeadlessScrubbedEnvKey)', async () => {
    childEnvs.length = 0
    ghSpawnEnvs.length = 0
    expect(await harness.invoke('git:branch', repo)).toBe('main') // real git still works with the scrubbed env
    await harness.invoke('github:check-cli')
    await harness.invoke('github:pr-list', repo)
    const files = childEnvs.map(c => c.file)
    expect(files).toContain(FAKE_GH)
    expect(files.some(f => f !== FAKE_GH)).toBe(true)
    expect(ghSpawnEnvs).toHaveLength(1)
    for (const env of [...childEnvs.map(c => c.env), ...ghSpawnEnvs]) {
      expect(env).toBeDefined()
      expect(Object.keys(env!).filter(k => k.toUpperCase().startsWith('BAT_'))).toEqual([])
      expect(Object.keys(env!).some(k => k.toUpperCase() === 'PATH')).toBe(true)
    }
  })
})

describe('worktree:* / git-scaffold:* child env on headless (T0429)', () => {
  const batKeys = (env: object) => Object.keys(env).filter(k => k.toUpperCase().startsWith('BAT_'))

  it('git-scaffold:* (Git Graph) works with EDITOR / PAGER in the server env; simple-git gets it scrubbed', async () => {
    scaffoldEnvs.length = 0
    expect(await harness.invoke('git-scaffold:healthCheck', repo)).toMatchObject({ ok: true, isRepo: true })
    expect(await harness.invoke('git-scaffold:getRepoInfo', repo)).toMatchObject({ ok: true, branch: 'main' })
    expect(await harness.invoke('git-scaffold:listCommits', repo, { limit: 1 })).toMatchObject({ ok: true })
    expect(scaffoldEnvs).toHaveLength(3)
    for (const env of scaffoldEnvs as Array<Record<string, string>>) {
      expect(batKeys(env)).toEqual([])
      expect(Object.keys(env).filter(k => SIMPLE_GIT_UNSAFE_ENV_KEYS.has(k.toLowerCase()))).toEqual([])
      expect(Object.keys(env).some(k => k.toUpperCase() === 'PATH')).toBe(true)
    }
  })

  it('worktree:* git children get the server env minus BAT_* (EDITOR etc. kept: plain execFile)', async () => {
    worktreeGitEnvs.length = 0
    const session = 't0429-harness-session'
    const created = await harness.invoke('worktree:create', session, repo) as { success: boolean }
    expect(created).toMatchObject({ success: true })
    expect(await harness.invoke('worktree:remove', session, true)).toEqual({ success: true })
    expect(worktreeGitEnvs.length).toBeGreaterThanOrEqual(5)
    for (const env of worktreeGitEnvs) {
      expect(env).toBeDefined()
      expect(batKeys(env!)).toEqual([])
      expect(env!.EDITOR).toBe('vim')
      expect(Object.keys(env!).some(k => k.toUpperCase() === 'PATH')).toBe(true)
    }
  })
})

describe('createHeadlessGitBinaryResolver', () => {
  it('caches a hit, retries a miss and falls back to plain git', () => {
    const answers: GitResolveResult[] = [
      { found: false, attemptedPaths: ['/usr/bin/git'] },
      { found: true, path: '/home/u/.local/bin/git', source: 'common-location', attemptedPaths: [] },
    ]
    let calls = 0
    const resolve = createHeadlessGitBinaryResolver(() => answers[Math.min(calls++, answers.length - 1)])
    expect(resolve()).toBe('git')
    expect(resolve()).toBe('/home/u/.local/bin/git')
    expect(resolve()).toBe('/home/u/.local/bin/git')
    expect(calls).toBe(2)
  })
})
