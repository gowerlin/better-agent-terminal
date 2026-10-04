// @vitest-environment node
/**
 * T0405 (PLAN-036 P2-H): electron/handlers/git.ts — shared git / github / worktree
 * module. Focus: `github:check-cli` decides login from the exit code of
 * `gh auth status` and never runs `gh auth token` (D133).
 */
import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import type { GhResolveResult } from '../gh-resolver'
import {
  GH_AUTH_STATUS_TIMEOUT_MS,
  checkGhAuth,
  ghAuthStatusArgs,
  parseGhVersion,
  registerGitHandlers,
  type GhAuthChild,
  type GhAuthSpawn,
  type GitExecFileSync,
  type GitHandlerDeps,
} from '../handlers/git'
import type { SharedHandler } from '../handlers/types'

const GH = '/usr/bin/gh'
const FOUND: GhResolveResult = { found: true, path: GH, source: 'path', attemptedPaths: ['/usr/local/bin/gh', GH] }

class FakeChild extends EventEmitter implements GhAuthChild {
  killed = false
  kill(): boolean {
    this.killed = true
    return true
  }
}

interface SpawnCall { file: string; args: string[]; options: unknown; child: FakeChild }

/** spawn fake: `exit` = exit code to emit, 'hang' = never exits, 'error' = spawn error event. */
function fakeSpawn(outcome: number | null | 'hang' | 'error'): { spawn: GhAuthSpawn; calls: SpawnCall[] } {
  const calls: SpawnCall[] = []
  const spawn: GhAuthSpawn = (file, args, options) => {
    const child = new FakeChild()
    calls.push({ file, args, options, child })
    if (outcome === 'error') queueMicrotask(() => child.emit('error', new Error('spawn EACCES')))
    else if (outcome !== 'hang') queueMicrotask(() => child.emit('exit', outcome, outcome === null ? 'SIGKILL' : null))
    return child
  }
  return { spawn, calls }
}

function setup(overrides: Partial<GitHandlerDeps> & { version?: string; versionThrows?: boolean } = {}) {
  const handlers = new Map<string, SharedHandler>()
  const execCalls: Array<{ file: string; args: string[] }> = []
  const execFileSync: GitExecFileSync = (file, args) => {
    execCalls.push({ file, args })
    if (file === GH && args[0] === '--version') {
      if (overrides.versionThrows) throw new Error('spawn gh ENOENT')
      return overrides.version ?? 'gh version 2.102.0 (2026-09-30)\nhttps://github.com/cli/cli/releases/tag/v2.102.0\n'
    }
    throw new Error(`unexpected execFileSync ${file} ${args.join(' ')}`)
  }
  const { version: _v, versionThrows: _t, ...deps } = overrides
  registerGitHandlers((channel, handler) => { handlers.set(channel, handler) }, {
    getGithubCliPath: () => undefined,
    execFileSync,
    resolveGh: async () => FOUND,
    getEnv: () => ({}),
    ...deps,
  })
  const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)!({ clientId: 'test' } as never, ...args)
  return { handlers, execCalls, invoke }
}

describe('registerGitHandlers', () => {
  it('registers the 22 worktree / git / git-scaffold / github channels', () => {
    const { handlers } = setup({ spawn: fakeSpawn(0).spawn })
    expect([...handlers.keys()].sort()).toEqual([
      'git-scaffold:getRepoInfo', 'git-scaffold:healthCheck', 'git-scaffold:listCommits',
      'git:branch', 'git:diff', 'git:diff-files', 'git:get-github-url', 'git:getRoot', 'git:log', 'git:status',
      'github:check-cli', 'github:issue-comment', 'github:issue-list', 'github:issue-view',
      'github:pr-comment', 'github:pr-list', 'github:pr-view',
      'worktree:create', 'worktree:merge', 'worktree:rehydrate', 'worktree:remove', 'worktree:status',
    ])
  })

  it('git channels spawn the host git binary with array args (no shell)', async () => {
    const calls: Array<{ file: string; args: string[] }> = []
    const { invoke } = setup({
      getGitBinary: () => '/home/u/.local/bin/git',
      execFileSync: (file, args) => { calls.push({ file, args }); return 'main\n' },
    })
    expect(await invoke('git:branch', '/repo')).toBe('main')
    await invoke('git:getRoot', '/repo')
    await invoke('git:status', '/repo')
    await invoke('git:get-github-url', '/repo')
    expect(calls).toEqual([
      { file: '/home/u/.local/bin/git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] },
      { file: '/home/u/.local/bin/git', args: ['rev-parse', '--show-toplevel'] },
      { file: '/home/u/.local/bin/git', args: ['status', '--porcelain', '-uall'] },
      { file: '/home/u/.local/bin/git', args: ['remote', 'get-url', 'origin'] },
    ])
  })

  it('without getGitBinary (Electron) git is spawned as plain `git`', async () => {
    const calls: string[] = []
    const { invoke } = setup({ execFileSync: (file) => { calls.push(file); return '' } })
    await invoke('git:log', '/repo', 3)
    expect(calls).toEqual(['git'])
  })
})

describe('github:check-cli (D133: gh auth status exit code, never gh auth token)', () => {
  it('exit 0 → authenticated; spawn args are `auth status --hostname github.com --active`, output discarded', async () => {
    const { spawn, calls } = fakeSpawn(0)
    const { invoke, execCalls } = setup({ spawn })
    const result = await invoke('github:check-cli')
    expect(result).toEqual({
      installed: true, authenticated: true, authState: 'authenticated',
      path: GH, source: 'path', attemptedPaths: FOUND.attemptedPaths,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe(GH)
    expect(calls[0].args).toEqual(['auth', 'status', '--hostname', 'github.com', '--active'])
    expect(calls[0].options).toMatchObject({ stdio: 'ignore', windowsHide: true })
    expect(execCalls).toEqual([{ file: GH, args: ['--version'] }])
  })

  it('never runs `gh auth token` (any spawn / execFileSync)', async () => {
    for (const outcome of [0, 1, 'hang', 'error'] as const) {
      const { spawn, calls } = fakeSpawn(outcome)
      const { invoke, execCalls } = setup({ spawn, ghAuthTimeoutMs: 20 })
      await invoke('github:check-cli')
      for (const args of [...calls.map(c => c.args), ...execCalls.map(c => c.args)]) {
        expect(args).not.toContain('token')
        expect(args).not.toContain('--show-token')
      }
    }
  })

  it('exit 1 → installed, not authenticated (no error)', async () => {
    const { invoke } = setup({ spawn: fakeSpawn(1).spawn })
    const result = await invoke('github:check-cli') as Record<string, unknown>
    expect(result).toMatchObject({ installed: true, authenticated: false, authState: 'unauthenticated', path: GH })
    expect(result.error).toBeUndefined()
  })

  it('timeout → unknown: child killed, authenticated false, error names the timeout', async () => {
    const { spawn, calls } = fakeSpawn('hang')
    const { invoke } = setup({ spawn, ghAuthTimeoutMs: 20 })
    const result = await invoke('github:check-cli') as Record<string, unknown>
    expect(result).toMatchObject({ installed: true, authenticated: false, authState: 'unknown', path: GH })
    expect(String(result.error)).toMatch(/timeout 20ms/)
    expect(calls[0].child.killed).toBe(true)
  })

  it('spawn error or a signal → unknown', async () => {
    for (const outcome of ['error', null] as const) {
      const { invoke } = setup({ spawn: fakeSpawn(outcome).spawn })
      expect(await invoke('github:check-cli')).toMatchObject({ installed: true, authenticated: false, authState: 'unknown' })
    }
  })

  it('gh not found / --version failing → not installed, auth never checked', async () => {
    const { spawn, calls } = fakeSpawn(0)
    const notFound = setup({ spawn, resolveGh: async () => ({ found: false, attemptedPaths: ['/usr/bin/gh'], error: 'GitHub CLI executable was not found.' }) })
    expect(await notFound.invoke('github:check-cli')).toEqual({
      installed: false, authenticated: false, attemptedPaths: ['/usr/bin/gh'], error: 'GitHub CLI executable was not found.',
    })
    const broken = setup({ spawn, versionThrows: true })
    expect(await broken.invoke('github:check-cli')).toMatchObject({ installed: false, authenticated: false, path: GH, error: 'spawn gh ENOENT' })
    expect(calls).toEqual([])
  })

  it('custom path argument is resolved per request; the configured path is cached', async () => {
    const resolveGh = vi.fn(async () => FOUND)
    const { invoke } = setup({ spawn: fakeSpawn(0).spawn, resolveGh, getGithubCliPath: () => ' /opt/gh ' })
    await invoke('github:check-cli', '/custom/gh')
    await invoke('github:check-cli')
    await invoke('github:check-cli')
    expect(resolveGh.mock.calls).toEqual([[{ customPath: '/custom/gh' }], [{ customPath: '/opt/gh' }]])
  })

  it('default timeout is set', () => {
    expect(GH_AUTH_STATUS_TIMEOUT_MS).toBeGreaterThan(0)
  })
})

describe('ghAuthStatusArgs', () => {
  it('uses --active from gh 2.40.0 (multi-account), plain status before', () => {
    expect(ghAuthStatusArgs('gh version 2.40.0 (2023-12-07)', {})).toContain('--active')
    expect(ghAuthStatusArgs('gh version 2.39.2 (2023-11-14)', {})).not.toContain('--active')
    expect(ghAuthStatusArgs('gh version 1.14.0', {})).not.toContain('--active')
    expect(ghAuthStatusArgs('something else', {})).toContain('--active')
  })

  it('checks GH_HOST when set to a plain hostname, else github.com', () => {
    expect(ghAuthStatusArgs('gh version 2.102.0', { GH_HOST: 'ghe.example.com' }).slice(2, 4)).toEqual(['--hostname', 'ghe.example.com'])
    expect(ghAuthStatusArgs('gh version 2.102.0', { GH_HOST: 'evil host; rm' }).slice(2, 4)).toEqual(['--hostname', 'github.com'])
    expect(ghAuthStatusArgs('gh version 2.102.0', {}).slice(2, 4)).toEqual(['--hostname', 'github.com'])
  })

  it('parseGhVersion', () => {
    expect(parseGhVersion('gh version 2.102.0 (2026-09-30)')).toEqual([2, 102, 0])
    expect(parseGhVersion('')).toBeNull()
  })
})

describe('checkGhAuth', () => {
  it('a throwing spawn is unknown', async () => {
    const spawn: GhAuthSpawn = () => { throw new Error('EPERM') }
    await expect(checkGhAuth(GH, ['auth', 'status'], { spawn })).resolves.toBe('unknown')
  })

  it('settles once (exit after timeout is ignored)', async () => {
    const { spawn, calls } = fakeSpawn('hang')
    const state = await checkGhAuth(GH, ['auth', 'status'], { spawn, timeoutMs: 10 })
    calls[0].child.emit('exit', 0, null)
    expect(state).toBe('unknown')
  })
})
