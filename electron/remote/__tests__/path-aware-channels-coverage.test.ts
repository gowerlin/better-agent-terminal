/**
 * T0416 (BUG-105): every proxied channel needs an explicit path classification.
 *
 * PLAN-036 brought claude:* / github:* / git-scaffold:* / worktree:* online on
 * headless without registering their path arguments, so a remote window sent
 * client-form paths (`\\wsl.localhost\<distro>\…`, `C:\…`) straight to the
 * Linux server. This guard makes "forgot to classify" a red test:
 *   - each PROXIED_CHANNELS entry is in PATH_ARG_SCHEMA xor PATH_FREE_CHANNELS
 *   - path-returning results are either rewritten (PATH_RETURNING_CHANNELS) or
 *     deliberately kept in server form (SERVER_PATH_RESULT_CHANNELS)
 * T0406: the same for PROXIED_EVENTS (PATH_EVENT_CHANNELS xor PATH_FREE_EVENTS),
 * and `workspace:sync-roots` (path-aware, converted once by RemoteClient.invoke).
 */
import { describe, expect, it } from 'vitest'
import { PROXIED_CHANNELS, PROXIED_EVENTS } from '../protocol'
import {
  PATH_ARG_SCHEMA,
  PATH_AWARE_CHANNELS,
  PATH_EVENT_CHANNELS,
  PATH_FREE_CHANNELS,
  PATH_FREE_EVENTS,
  PATH_RETURNING_CHANNELS,
  REMOTE_ORIGIN_EVENTS,
  SERVER_PATH_RESULT_CHANNELS,
  normalizePathsInResult,
  translateInvokeArgs,
  translateRemoteEventArgs,
} from '../path-aware-channels'
import { IdentityTranslator, WslPathTranslator } from '../path-translator'

const wsl = new WslPathTranslator('Ubuntu-24.04')
const local = new IdentityTranslator()

const UNC_HOME = '\\\\wsl.localhost\\Ubuntu-24.04\\home\\x'
const SERVER_HOME = '/home/x'
const WIN_DIR = 'C:\\Users\\x'
const SERVER_WIN_DIR = '/mnt/c/Users/x'

describe('T0416 guard: every proxied channel has a path classification', () => {
  it('each PROXIED_CHANNELS entry is path-aware or path-free (exactly one)', () => {
    const unclassified: string[] = []
    const both: string[] = []
    for (const channel of Array.from(PROXIED_CHANNELS)) {
      const aware = channel in PATH_ARG_SCHEMA
      const free = PATH_FREE_CHANNELS.has(channel)
      if (!aware && !free) unclassified.push(channel)
      if (aware && free) both.push(channel)
    }
    expect(unclassified, 'add to PATH_ARG_SCHEMA (with schema) or PATH_FREE_CHANNELS (with reason)').toEqual([])
    expect(both).toEqual([])
  })

  it('no stale classification for a channel that is not proxied', () => {
    const stale = [
      ...Object.keys(PATH_ARG_SCHEMA),
      ...Array.from(PATH_FREE_CHANNELS.keys()),
      ...Array.from(PATH_RETURNING_CHANNELS),
      ...Array.from(SERVER_PATH_RESULT_CHANNELS.keys()),
    ].filter((channel) => !PROXIED_CHANNELS.has(channel))
    expect(stale).toEqual([])
  })

  it('every path-free / server-path entry carries a reason', () => {
    for (const [channel, reason] of Array.from(PATH_FREE_CHANNELS).concat(Array.from(SERVER_PATH_RESULT_CHANNELS))) {
      expect(reason.trim(), channel).not.toBe('')
    }
  })

  it('PATH_AWARE_CHANNELS is exactly the schema table', () => {
    expect(Array.from(PATH_AWARE_CHANNELS).sort()).toEqual(Object.keys(PATH_ARG_SCHEMA).sort())
  })

  it('a result is either rewritten or kept server-side, never both', () => {
    const both = Array.from(PATH_RETURNING_CHANNELS).filter((channel) => SERVER_PATH_RESULT_CHANNELS.has(channel))
    expect(both).toEqual([])
  })

  it('claude:get-cli-path stays in server form (typed into the remote terminal)', () => {
    expect(PATH_RETURNING_CHANNELS.has('claude:get-cli-path')).toBe(false)
    expect(SERVER_PATH_RESULT_CHANNELS.has('claude:get-cli-path')).toBe(true)
    const cli = '/home/x/.local/bat-server/node_modules/@anthropic-ai/claude-code/bin/claude'
    expect(normalizePathsInResult('claude:get-cli-path', cli, wsl)).toBe(cli)
  })
})

/**
 * One fixture per PATH_ARG_SCHEMA channel: `build(p)` places path `p` at every
 * path position (non-path args stay fixed), so the expected output is
 * `build(toServer(p))`.
 */
const ARG_FIXTURES: Record<string, (p: string) => unknown[]> = {
  'fs:readdir': (p) => [p],
  'fs:readFile': (p) => [p, 'utf8'],
  'fs:stat': (p) => [p],
  'fs:search': (p) => [p, 'query'],
  'fs:watch': (p) => [p],
  'fs:unwatch': (p) => [p],
  'fs:reset-watch': (p) => [[p, p]],
  'git:branch': (p) => [p],
  'git:log': (p) => [p, 50],
  'git:diff': (p) => [p, 'abc123', 'src/a.ts'],
  'git:diff-files': (p) => [p, 'abc123'],
  'git:status': (p) => [p],
  'git:get-github-url': (p) => [p],
  'git:getRoot': (p) => [p],
  'image:read-as-data-url': (p) => [p],
  'pty:create': (p) => [{ id: 't1', cwd: p, type: 'terminal', shell: 'bash' }],
  'pty:restart': (p) => ['t1', p, 'bash'],
  'claude:start-session': (p) => ['s1', {
    cwd: p, worktreePath: p, worktreeBranch: 'wt-1', prompt: 'hi', model: 'claude-opus-5-5', useWorktree: true,
  }],
  'claude:resume-session': (p) => ['s1', 'sdk-1', p, 'claude-opus-5-5', 'v1', true, p, 'wt-1', 'claude-code'],
  'claude:list-sessions': (p) => [p, 'codex-agent'],
  'claude:scan-skills': (p) => [p],
  'worktree:create': (p) => ['s1', p],
  'worktree:rehydrate': (p) => ['s1', p, p, 'wt-1'],
  'github:pr-list': (p) => [p],
  'github:issue-list': (p) => [p],
  'github:pr-view': (p) => [p, 7],
  'github:issue-view': (p) => [p, 7],
  'github:pr-comment': (p) => [p, 7, 'see C:\\notes.txt'],
  'github:issue-comment': (p) => [p, 7, 'see C:\\notes.txt'],
  'git-scaffold:healthCheck': (p) => [p],
  'git-scaffold:getRepoInfo': (p) => [p],
  'git-scaffold:listCommits': (p) => [p, { limit: 100, offset: 0 }],
  'terminal:create-with-command': (p) => [{ id: 't1', cwd: p, command: 'ls', shell: 'bash', customEnv: { HOME: 'C:\\keep' } }],
  'terminal:create-agent-command': (p) => [{ id: 't1', cwd: p, agent: 'claude', prompt: 'C:\\keep', workspaceId: 'w1' }],
  'workspace:sync-roots': (p) => [[p, p]],
}

describe('T0416 request translation (WSL translator)', () => {
  it('every PATH_ARG_SCHEMA channel has a fixture', () => {
    expect(Object.keys(ARG_FIXTURES).sort()).toEqual(Object.keys(PATH_ARG_SCHEMA).sort())
  })

  const cases: Array<[string, string, string]> = [
    ['\\\\wsl.localhost UNC', UNC_HOME, SERVER_HOME],
    ['Windows drive', WIN_DIR, SERVER_WIN_DIR],
  ]
  for (const channel of Object.keys(ARG_FIXTURES)) {
    for (const [label, clientPath, serverPath] of cases) {
      it(`${channel}: ${label} -> ${serverPath}`, () => {
        const build = ARG_FIXTURES[channel]
        expect(translateInvokeArgs(channel, build(clientPath), wsl)).toEqual(build(serverPath))
      })
    }

    it(`${channel}: server-form path passes through unchanged`, () => {
      const build = ARG_FIXTURES[channel]
      expect(translateInvokeArgs(channel, build(SERVER_HOME), wsl)).toEqual(build(SERVER_HOME))
    })

    it(`${channel}: local window (identity) is unchanged`, () => {
      const build = ARG_FIXTURES[channel]
      expect(translateInvokeArgs(channel, build(WIN_DIR), local)).toEqual(build(WIN_DIR))
    })
  }

  it('claude:start-session without worktreePath only rewrites cwd', () => {
    const out = translateInvokeArgs('claude:start-session', ['s1', { cwd: UNC_HOME, model: 'm' }], wsl)
    expect(out).toEqual(['s1', { cwd: SERVER_HOME, model: 'm' }])
  })

  it('claude:resume-session leaves undefined optional args alone', () => {
    const out = translateInvokeArgs('claude:resume-session', ['s1', 'sdk-1', WIN_DIR], wsl)
    expect(out).toEqual(['s1', 'sdk-1', SERVER_WIN_DIR])
  })

  it('object-fields schema ignores a non-object payload', () => {
    expect(translateInvokeArgs('terminal:create-with-command', [WIN_DIR], wsl)).toEqual([WIN_DIR])
    expect(translateInvokeArgs('claude:start-session', ['s1', null], wsl)).toEqual(['s1', null])
  })

  it('path-free channels are never rewritten', () => {
    for (const channel of Array.from(PATH_FREE_CHANNELS.keys())) {
      expect(translateInvokeArgs(channel, [WIN_DIR, UNC_HOME], wsl), channel).toEqual([WIN_DIR, UNC_HOME])
    }
  })
})

describe('T0416 result translation (WSL translator)', () => {
  it('git-scaffold healthCheck / getRepoInfo rewrite gitRoot to client form', () => {
    for (const channel of ['git-scaffold:healthCheck', 'git-scaffold:getRepoInfo']) {
      expect(normalizePathsInResult(channel, { ok: true, isRepo: true, gitRoot: '/home/x/repo' }, wsl))
        .toEqual({ ok: true, isRepo: true, gitRoot: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\x\\repo' })
      expect(normalizePathsInResult(channel, { ok: true, gitRoot: SERVER_WIN_DIR }, wsl))
        .toEqual({ ok: true, gitRoot: WIN_DIR })
      expect(normalizePathsInResult(channel, { ok: true, isRepo: false, gitRoot: null }, wsl))
        .toEqual({ ok: true, isRepo: false, gitRoot: null })
      expect(normalizePathsInResult(channel, { ok: true, gitRoot: '/home/x/repo' }, local))
        .toEqual({ ok: true, gitRoot: '/home/x/repo' })
    }
  })

  it('every PATH_RETURNING channel rewrites a representative result', () => {
    const samples: Record<string, unknown> = {
      'fs:readdir': [{ name: 'a', path: '/home/x/a' }],
      'fs:search': [{ name: 'a', path: '/home/x/a' }],
      'git:getRoot': '/home/x',
      'pty:get-cwd': '/home/x',
      'git-scaffold:healthCheck': { gitRoot: '/home/x' },
      'git-scaffold:getRepoInfo': { gitRoot: '/home/x' },
    }
    expect(Object.keys(samples).sort()).toEqual(Array.from(PATH_RETURNING_CHANNELS).sort())
    for (const [channel, sample] of Object.entries(samples)) {
      expect(normalizePathsInResult(channel, sample, wsl), channel).not.toEqual(sample)
    }
  })

  it('SERVER_PATH_RESULT channels keep server paths verbatim', () => {
    const results: Record<string, unknown> = {
      'claude:get-cli-path': '/home/x/bin/claude',
      'claude:detectRuntime': { embedded: { path: '/home/x/bin/claude' }, system: { path: '/usr/bin/claude' } },
      'github:check-cli': { installed: true, path: '/usr/bin/gh' },
      'settings:get-shell-path': '/bin/bash',
      'remote-tools:detect': { tools: [{ id: 'claude', path: '/home/x/.local/bin/claude' }] },
      'claude:get-session-meta': { cwd: '/home/x/repo', model: 'm' },
      'claude:get-worktree-status': { diff: '', worktreePath: '/home/x/repo/.worktrees/a', branchName: 'a', sourceBranch: 'main' },
      'worktree:create': { success: true, worktreePath: '/home/x/repo/.worktrees/a', gitRoot: '/home/x/repo' },
      'worktree:status': { diff: '', worktreePath: '/home/x/repo/.worktrees/a', branchName: 'a', sourceBranch: 'main' },
    }
    expect(Object.keys(results).sort()).toEqual(Array.from(SERVER_PATH_RESULT_CHANNELS.keys()).sort())
    for (const [channel, result] of Object.entries(results)) {
      expect(normalizePathsInResult(channel, result, wsl), channel).toBe(result)
    }
  })
})

describe('T0406 guard: every proxied event has a path classification', () => {
  it('each PROXIED_EVENTS entry is path-translated or path-free (exactly one)', () => {
    const unclassified: string[] = []
    const both: string[] = []
    for (const event of Array.from(PROXIED_EVENTS)) {
      const translated = PATH_EVENT_CHANNELS.has(event)
      const free = PATH_FREE_EVENTS.has(event)
      if (!translated && !free) unclassified.push(event)
      if (translated && free) both.push(event)
    }
    expect(unclassified, 'add to PATH_EVENT_CHANNELS or PATH_FREE_EVENTS (with reason)').toEqual([])
    expect(both).toEqual([])
  })

  it('no stale classification for an event that is not proxied', () => {
    const stale = Array.from(PATH_EVENT_CHANNELS.keys()).concat(Array.from(PATH_FREE_EVENTS.keys()))
      .filter((event) => !PROXIED_EVENTS.has(event))
    expect(stale).toEqual([])
  })

  it('every event entry carries a reason', () => {
    for (const [event, reason] of Array.from(PATH_EVENT_CHANNELS).concat(Array.from(PATH_FREE_EVENTS))) {
      expect(reason.trim(), event).not.toBe('')
    }
  })

  it('fs:changed comes back in client form; claude:worktree-info stays server form', () => {
    expect(translateRemoteEventArgs('fs:changed', [SERVER_HOME], wsl)).toEqual([UNC_HOME])
    expect(translateRemoteEventArgs('fs:changed', [SERVER_WIN_DIR], wsl)).toEqual([WIN_DIR])
    expect(translateRemoteEventArgs('fs:changed', [SERVER_HOME], local)).toEqual([SERVER_HOME])
    const info = ['s1', { worktreePath: '/home/x/repo/.worktrees/a', gitRoot: '/home/x/repo' }]
    expect(translateRemoteEventArgs('claude:worktree-info', info, wsl)).toBe(info)
  })

  it('T0431: terminal:created-externally cwd comes back in client form, stamped remote', () => {
    const payload = { id: 't1', cwd: SERVER_HOME, command: 'claude x', workspaceId: 'ws-1' }
    expect(translateRemoteEventArgs('terminal:created-externally', [payload], wsl))
      .toEqual([{ id: 't1', cwd: UNC_HOME, command: 'claude x', workspaceId: 'ws-1', remote: true }])
    expect(translateRemoteEventArgs('terminal:created-externally', [{ ...payload, cwd: SERVER_WIN_DIR }], wsl))
      .toEqual([{ ...payload, cwd: WIN_DIR, remote: true }])
    // local profile translator: path untouched, still stamped (it arrived through RemoteClient)
    expect(translateRemoteEventArgs('terminal:created-externally', [payload], local)).toEqual([{ ...payload, remote: true }])
    expect(payload.cwd).toBe(SERVER_HOME) // input not mutated
  })

  it('T0431: terminal:keypress is proxied and path-free; remote-origin events are path events', () => {
    expect(PROXIED_EVENTS.has('terminal:created-externally')).toBe(true)
    expect(PROXIED_EVENTS.has('terminal:keypress')).toBe(true)
    expect(PATH_FREE_EVENTS.has('terminal:keypress')).toBe(true)
    // the remote stamp is applied inside translateRemoteEventArgs' path-event branch only
    for (const event of Array.from(REMOTE_ORIGIN_EVENTS)) expect(PATH_EVENT_CHANNELS.has(event), event).toBe(true)
  })

  it('every path-free event is delivered untouched', () => {
    for (const event of Array.from(PATH_FREE_EVENTS.keys())) {
      const args = ['id-1', SERVER_HOME, { path: SERVER_HOME }]
      expect(translateRemoteEventArgs(event, args, wsl), event).toBe(args)
    }
  })
})

describe('T0406 workspace:sync-roots request', () => {
  it('is path-aware: client-form roots reach the server converted exactly once', () => {
    expect(PROXIED_CHANNELS.has('workspace:sync-roots')).toBe(true)
    expect(PATH_ARG_SCHEMA['workspace:sync-roots']).toBe('array-of-strings')
    expect(translateInvokeArgs('workspace:sync-roots', [[UNC_HOME, WIN_DIR]], wsl)).toEqual([[SERVER_HOME, SERVER_WIN_DIR]])
    // a server-form root (already converted) passes through unchanged
    expect(translateInvokeArgs('workspace:sync-roots', [[SERVER_HOME]], wsl)).toEqual([[SERVER_HOME]])
    expect(translateInvokeArgs('workspace:sync-roots', [[UNC_HOME]], local)).toEqual([[UNC_HOME]])
  })
})
