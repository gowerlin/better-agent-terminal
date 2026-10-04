// @vitest-environment node
/**
 * T0429: `git-scaffold:*` (simple-git) child env.
 *
 * simple-git's `blockUnsafeOperationsPlugin` checks any env given through `.env()`
 * and throws on keys such as EDITOR / PAGER — a server started from a shell often
 * has them. Headless therefore hands simple-git the scrubbed env minus those keys;
 * Electron never calls `.env()`.
 *
 * simple-git is wrapped (pass-through) to record what `.env()` receives; the git
 * itself is the real one, run against a `mkdtemp` repo.
 */
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { parseEnv } from '@simple-git/argv-parser'
import realSimpleGit from 'simple-git'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerGitScaffoldHandlers, SIMPLE_GIT_UNSAFE_ENV_KEYS, stripSimpleGitUnsafeEnv } from '../git/git-ipc'
import type { HandlerRegistrar } from '../handlers/types'

const { envCalls } = vi.hoisted(() => ({ envCalls: [] as unknown[] }))

vi.mock('simple-git', async importOriginal => {
  const real = await importOriginal<typeof import('simple-git')>()
  const wrapped = ((...args: Parameters<typeof real.default>) => {
    const git = real.default(...args)
    const env = git.env.bind(git) as (...a: unknown[]) => typeof git
    git.env = ((...a: unknown[]) => {
      envCalls.push(a[0])
      return env(...a)
    }) as typeof git.env
    return git
  }) as typeof real.default
  return { ...real, default: wrapped, simpleGit: wrapped }
})

/** Every key simple-git 3.36.0 refuses in an env, as a server shell might export it. */
const UNSAFE_SERVER_ENV: Record<string, string> = {
  EDITOR: 'vim',
  PAGER: 'less',
  GIT_EDITOR: 'vim',
  GIT_PAGER: 'less',
  GIT_SEQUENCE_EDITOR: 'vim',
  GIT_ASKPASS: '/usr/bin/true',
  SSH_ASKPASS: '/usr/bin/true',
  GIT_SSH: 'ssh',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
  GIT_PROXY_COMMAND: 'proxy',
  GIT_EXTERNAL_DIFF: 'diff',
  GIT_TEMPLATE_DIR: '/nonexistent-t0429',
  GIT_EXEC_PATH: '/nonexistent-t0429',
  GIT_CONFIG: '/nonexistent-t0429',
  GIT_CONFIG_GLOBAL: '/nonexistent-t0429',
  GIT_CONFIG_SYSTEM: '/nonexistent-t0429',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'core.pager',
  GIT_CONFIG_VALUE_0: 'less',
  PREFIX: '/usr/local',
}

type Handler = (ctx: unknown, ...args: unknown[]) => unknown

function register(deps: Parameters<typeof registerGitScaffoldHandlers>[1]) {
  const handlers = new Map<string, Handler>()
  const reg: HandlerRegistrar = (channel, handler) => { handlers.set(channel, handler as Handler) }
  registerGitScaffoldHandlers(reg, deps)
  return (channel: string, ...args: unknown[]) => handlers.get(channel)!({}, ...args)
}

let repo: string

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0429-scaffold-'))
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.name=t0429', '-c', 'user.email=t0429@localhost', '-c', 'commit.gpgsign=false', ...args], {
    encoding: 'utf-8', timeout: 10_000, windowsHide: true,
  })
  execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q', repo], { timeout: 10_000, windowsHide: true })
  git('commit', '-q', '--no-verify', '--allow-empty', '-m', 't0429 first')
  git('commit', '-q', '--no-verify', '--allow-empty', '-m', 't0429 second')
})

afterAll(() => {
  if (repo) fs.rmSync(repo, { recursive: true, force: true, maxRetries: 3 })
})

beforeEach(() => {
  envCalls.length = 0
})

describe('SIMPLE_GIT_UNSAFE_ENV_KEYS / stripSimpleGitUnsafeEnv (T0429)', () => {
  it('every listed key is one the installed simple-git refuses', () => {
    for (const key of SIMPLE_GIT_UNSAFE_ENV_KEYS) {
      expect(parseEnv({ [key.toUpperCase()]: 'x' }).vulnerabilities.length, key).toBeGreaterThan(0)
    }
  })

  it('a stripped server env passes the simple-git check; PATH / HOME / GIT_DIR / BAT_* are left alone', () => {
    const env = { ...UNSAFE_SERVER_ENV, Editor: 'nano', PATH: '/usr/bin', HOME: '/home/u', GIT_DIR: '.git', BAT_X: '1', UNDEF: undefined }
    expect(parseEnv(env as Record<string, string>).vulnerabilities.length).toBeGreaterThan(0)
    const stripped = stripSimpleGitUnsafeEnv(env)
    expect(parseEnv(stripped).vulnerabilities).toEqual([])
    expect(stripped).toEqual({
      PATH: '/usr/bin', HOME: '/home/u', GIT_DIR: '.git', BAT_X: '1',
      GIT_CONFIG_KEY_0: 'core.pager', GIT_CONFIG_VALUE_0: 'less', // inert without GIT_CONFIG_COUNT
    })
  })

  it('the trap is real: an unstripped env with EDITOR makes simple-git throw', async () => {
    await expect(realSimpleGit(repo).env({ ...process.env, EDITOR: 'vim' }).raw(['log', '-1'])).rejects.toThrow(/EDITOR.*not permitted/)
  })
})

describe('git-scaffold:* child env (T0429)', () => {
  it('headless: Git Graph channels work against a server env carrying EDITOR / PAGER / GIT_SSH_COMMAND …', async () => {
    let reads = 0
    const invoke = register({
      getEnv: () => {
        reads++
        return { ...process.env, ...UNSAFE_SERVER_ENV }
      },
    })
    expect(await invoke('git-scaffold:healthCheck', repo)).toMatchObject({ ok: true, isRepo: true })
    expect(await invoke('git-scaffold:getRepoInfo', repo)).toMatchObject({ ok: true, branch: 'main', detached: false })
    const commits = await invoke('git-scaffold:listCommits', repo, { limit: 10 }) as { ok: boolean; commits: Array<{ subject: string }> }
    expect(commits).toMatchObject({ ok: true })
    expect(commits.commits.map(c => c.subject)).toEqual(['t0429 second', 't0429 first'])

    expect(reads).toBe(3) // read per call, not frozen at registration
    expect(envCalls).toHaveLength(3)
    for (const env of envCalls as Array<Record<string, string>>) {
      expect(Object.keys(env).filter(k => SIMPLE_GIT_UNSAFE_ENV_KEYS.has(k.toLowerCase()))).toEqual([])
      expect(Object.keys(env).some(k => k.toUpperCase() === 'PATH')).toBe(true)
    }
  })

  it('Electron (no getEnv) never calls .env(): git inherits process.env', async () => {
    const invoke = register({})
    expect(await invoke('git-scaffold:healthCheck', repo)).toMatchObject({ ok: true, isRepo: true })
    expect(await invoke('git-scaffold:listCommits', repo, { limit: 1 })).toMatchObject({ ok: true })
    expect(envCalls).toEqual([])
  })

  it('getEnv returning undefined behaves like Electron', async () => {
    const invoke = register({ getEnv: () => undefined })
    expect(await invoke('git-scaffold:getRepoInfo', repo)).toMatchObject({ ok: true, branch: 'main' })
    expect(envCalls).toEqual([])
  })
})
