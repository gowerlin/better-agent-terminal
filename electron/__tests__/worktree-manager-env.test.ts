// @vitest-environment node
/**
 * T0429: WorktreeManager git child env.
 *
 * `execFile` is wrapped (pass-through) to record the options of every git child;
 * the git itself is the real one, run against a `mkdtemp` repo.
 */
import * as childProcess from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorktreeManager } from '../worktree-manager'

const { gitCalls } = vi.hoisted(() => ({ gitCalls: [] as Array<{ args: string[]; options: Record<string, unknown> }> }))

vi.mock('child_process', async importOriginal => {
  const real = await importOriginal<typeof import('child_process')>()
  const { promisify } = await import('util')
  const realCustom = (real.execFile as unknown as Record<symbol, (...a: unknown[]) => unknown>)[promisify.custom]
  const execFile = ((...a: unknown[]) => (real.execFile as (...b: unknown[]) => unknown)(...a)) as unknown as Record<symbol, unknown>
  execFile[promisify.custom] = (file: string, args: string[], options: Record<string, unknown>) => {
    gitCalls.push({ args, options })
    return realCustom(file, args, options)
  }
  return { ...real, default: { ...real, execFile }, execFile }
})

let repo: string

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0429-worktree-'))
  childProcess.execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q', repo], { timeout: 10_000, windowsHide: true })
  childProcess.execFileSync('git', ['-C', repo, '-c', 'user.name=t0429', '-c', 'user.email=t0429@localhost', '-c', 'commit.gpgsign=false',
    'commit', '-q', '--no-verify', '--allow-empty', '-m', 't0429'], { timeout: 10_000, windowsHide: true })
})

afterAll(() => {
  if (repo) fs.rmSync(repo, { recursive: true, force: true, maxRetries: 3 })
})

beforeEach(() => {
  gitCalls.length = 0
})

/** create → status → remove; every git child of the lifecycle is recorded. */
async function lifecycle(manager: WorktreeManager, sessionId: string) {
  const info = await manager.createWorktree(sessionId, repo)
  expect(fs.existsSync(info.worktreePath)).toBe(true)
  expect(await manager.getWorktreeStatus(sessionId)).toMatchObject({ branchName: info.branchName, sourceBranch: 'main' })
  await manager.removeWorktree(sessionId, true)
  expect(fs.existsSync(info.worktreePath)).toBe(false)
}

describe('WorktreeManager git child env (T0429)', () => {
  it('Electron (no env provider): no `env` option, git inherits process.env', async () => {
    await lifecycle(new WorktreeManager(), 't0429-electron-session')
    expect(gitCalls.length).toBeGreaterThanOrEqual(6)
    for (const call of gitCalls) expect(call.options, call.args.join(' ')).not.toHaveProperty('env')
  })

  it('setEnvProvider: every git child gets the provided env, read per spawn', async () => {
    const manager = new WorktreeManager()
    const { BAT_REMOTE_TOKEN: _t, ...withoutBat } = process.env
    let reads = 0
    manager.setEnvProvider(() => {
      reads++
      return { ...withoutBat, T0429_MARK: String(reads) }
    })
    await lifecycle(manager, 't0429-headless-session')
    expect(gitCalls.length).toBeGreaterThanOrEqual(6)
    expect(reads).toBe(gitCalls.length)
    gitCalls.forEach((call, i) => {
      const env = call.options.env as NodeJS.ProcessEnv
      expect(env?.T0429_MARK, call.args.join(' ')).toBe(String(i + 1))
      expect(call.options).toMatchObject({ windowsHide: true })
    })
  })

  it('a provider returning undefined behaves like Electron', async () => {
    const manager = new WorktreeManager()
    manager.setEnvProvider(() => undefined)
    expect(await manager.getGitRoot(repo)).toBeTruthy()
    expect(gitCalls).toHaveLength(1)
    expect(gitCalls[0].options).not.toHaveProperty('env')
  })
})
