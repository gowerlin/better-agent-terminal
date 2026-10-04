// @vitest-environment node
/**
 * T0398 (BUG-102): all three PtyManager spawn paths take their locale env from
 * resolvePtyLocaleEnv instead of a hard-coded `LANG` / `LC_ALL=en_US.UTF-8`.
 *
 * - Terminal Server path: env of the `pty:create` request (fake fork IPC channel).
 * - node-pty path: env passed to `pty.spawn`. pty-manager loads `@lydell/node-pty` with a
 *   plain `require`, which vi.mock does not intercept, so a fake is seeded into the
 *   require cache before pty-manager is imported.
 * - child_process fallback: env passed to `spawn` after the fake node-pty throws once.
 */
import { EventEmitter } from 'events'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

const SENTINEL = { LANG: 'T0398.SENTINEL' }
const { resolvePtyLocaleEnv, childSpawn } = vi.hoisted(() => ({
  resolvePtyLocaleEnv: vi.fn((): Record<string, string> => ({ LANG: 'T0398.SENTINEL' })),
  childSpawn: vi.fn(),
}))

vi.mock('../pty-locale-env', () => ({ resolvePtyLocaleEnv }))
vi.mock('child_process', async (importOriginal) => ({
  ...await importOriginal<typeof import('child_process')>(),
  spawn: childSpawn,
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}

class FakeServer extends EventEmitter {
  connected = true
  sent: Array<{ type: string; env?: Record<string, string> }> = []
  send = (msg: { type: string }) => { this.sent.push(msg); return true }
}

const ptySpawn = vi.fn((..._args: unknown[]) => new FakePty())
const CWD = os.tmpdir()
const CUSTOM_ENV = { FOO: 'bar', LC_CTYPE: 'zh_TW.UTF-8' }
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

let manager: PtyManagerType
const savedLcAll = process.env.LC_ALL

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  // Only a hard-coded injection could then put LC_ALL into the PTY env.
  delete process.env.LC_ALL
  resolvePtyLocaleEnv.mockClear()
  manager = new PtyManager({ emit: vi.fn(), dataDir: CWD, dropInheritedEnv: key => key === 'T0398_DROPPED' })
})

afterEach(() => {
  manager.beginShutdown()
  manager.dispose()
  if (savedLcAll === undefined) delete process.env.LC_ALL
  else process.env.LC_ALL = savedLcAll
  delete process.env.T0398_DROPPED
  vi.restoreAllMocks()
})

function expectHelperEnv(env: Record<string, string> | undefined, calls = 1) {
  expect(resolvePtyLocaleEnv).toHaveBeenCalledTimes(calls)
  const [input] = resolvePtyLocaleEnv.mock.calls.at(-1) as unknown as [{
    platform: NodeJS.Platform; inheritedEnv: NodeJS.ProcessEnv; customEnv: Record<string, string>
  }]
  expect(input.platform).toBe(process.platform)
  expect(input.customEnv).toEqual(CUSTOM_ENV)
  // the helper sees the env after the host's drop filter (T0390)
  expect(input.inheritedEnv).not.toHaveProperty('T0398_DROPPED')
  expect(input.inheritedEnv.PATH ?? input.inheritedEnv.Path).toBeDefined()

  expect(env).toMatchObject({ ...CUSTOM_ENV, ...SENTINEL, PYTHONIOENCODING: 'utf-8', TERM: 'xterm-256color' })
  expect(env).not.toHaveProperty('LC_ALL')
}

describe('PtyManager locale env (T0398)', () => {
  it('Terminal Server path: pty:create env comes from resolvePtyLocaleEnv', () => {
    process.env.T0398_DROPPED = '1'
    const server = new FakeServer()
    manager.setServerProcess(server as unknown as ChildProcess)

    expect(manager.create({ id: 'srv', cwd: CWD, type: 'terminal', shell: 'test-shell', customEnv: CUSTOM_ENV })).toBe(true)

    const createMsg = server.sent.find(m => m.type === 'pty:create')
    expectHelperEnv(createMsg?.env)
  })

  // The two direct paths share module state (a node-pty spawn failure disables node-pty
  // for the rest of the process), so node-pty runs first and the fallback second.
  it('node-pty path: pty.spawn env comes from resolvePtyLocaleEnv', () => {
    process.env.T0398_DROPPED = '1'
    expect(manager.create({ id: 'direct', cwd: CWD, type: 'terminal', shell: 'test-shell', customEnv: CUSTOM_ENV })).toBe(true)

    expect(ptySpawn).toHaveBeenCalledTimes(1)
    const opts = ptySpawn.mock.calls[0][2] as { env: Record<string, string> }
    expectHelperEnv(opts.env)
  })

  it('child_process fallback: spawn env comes from resolvePtyLocaleEnv', () => {
    process.env.T0398_DROPPED = '1'
    ptySpawn.mockImplementationOnce(() => { throw new Error('node-pty unavailable') })
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(), pid: undefined,
    })
    childSpawn.mockReturnValueOnce(child)

    expect(manager.create({ id: 'fallback', cwd: CWD, type: 'terminal', shell: 'test-shell', customEnv: CUSTOM_ENV })).toBe(true)

    expect(childSpawn).toHaveBeenCalledTimes(1)
    const opts = childSpawn.mock.calls[0][2] as { env: Record<string, string> }
    // once for the failed node-pty attempt, once for the fallback env
    expectHelperEnv(opts.env, 2)
  })
})
