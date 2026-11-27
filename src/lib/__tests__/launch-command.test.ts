// BUG-231 / T0951 — renderer side of the launch hold: `sendLaunchCommand` / `releaseLaunchHold`
// (src/lib/launch-command.ts), the flag on `restartOrCreatePty`, and the WorkspaceView wiring.
// The hold itself (PtyManager.holdInputForLaunch, the handlers) is electron/__tests__/launch-input-hold.test.ts.

import * as fs from 'fs'
import * as path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CreatePtyOptions } from '../../types'
import { LAUNCH_COMMAND_DELAY_MS, releaseLaunchHold, sendLaunchCommand, writeLaunchCommandNow } from '../launch-command'
import { resetPtyReplayRegistry, restartOrCreatePty } from '../pty-replay'

const ID = 't1'
const CMD = "claude --name=ws\r"

afterEach(() => {
  vi.useRealTimers()
  resetPtyReplayRegistry()
})

describe('sendLaunchCommand', () => {
  it('writes the command through pty:launch-command after LAUNCH_COMMAND_DELAY_MS (500 ms, as before)', async () => {
    vi.useFakeTimers()
    const api = { write: vi.fn(async () => undefined), launchCommand: vi.fn(async () => ({ ok: true })) }
    sendLaunchCommand(ID, CMD, api)
    expect(LAUNCH_COMMAND_DELAY_MS).toBe(500)
    await vi.advanceTimersByTimeAsync(499)
    expect(api.launchCommand).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.launchCommand).toHaveBeenCalledWith(ID, CMD)
    expect(api.write).not.toHaveBeenCalled()
  })

  it('a host before T0951 (`No handler`) → the plain pty:write of before', async () => {
    const api = {
      write: vi.fn(async () => undefined),
      launchCommand: vi.fn(async () => { throw new Error('No handler for channel: pty:launch-command') }),
    }
    await writeLaunchCommandNow(ID, CMD, api)
    expect(api.write).toHaveBeenCalledWith(ID, CMD)
  })

  it('no launchCommand in the API → pty:write', async () => {
    const api = { write: vi.fn(async () => undefined) }
    await writeLaunchCommandNow(ID, CMD, api)
    expect(api.write).toHaveBeenCalledWith(ID, CMD)
  })

  it('a failing write is swallowed (fire and forget, as the setTimeout of before)', async () => {
    vi.useFakeTimers()
    const api = { write: vi.fn(async () => { throw new Error('gone') }), launchCommand: vi.fn(async () => { throw new Error('No handler') }) }
    sendLaunchCommand(ID, CMD, api)
    await vi.advanceTimersByTimeAsync(LAUNCH_COMMAND_DELAY_MS)
    expect(api.write).toHaveBeenCalledTimes(1)
  })
})

describe('releaseLaunchHold', () => {
  it('sends `null` (no command: the held input as it is); never types anything', async () => {
    const api = { write: vi.fn(async () => undefined), launchCommand: vi.fn(async () => ({ ok: true })) }
    releaseLaunchHold(ID, api)
    expect(api.launchCommand).toHaveBeenCalledWith(ID, null)
    expect(api.write).not.toHaveBeenCalled()
  })

  it('a host before T0951 held nothing: a rejection is ignored, no write', async () => {
    const api = { write: vi.fn(async () => undefined), launchCommand: vi.fn(async () => { throw new Error('No handler') }) }
    releaseLaunchHold(ID, api)
    await Promise.resolve()
    expect(api.write).not.toHaveBeenCalled()
    releaseLaunchHold(ID, { write: api.write })
    expect(api.write).not.toHaveBeenCalled()
  })
})

describe('restartOrCreatePty: the flag goes with pty:restart', () => {
  const OPTS: CreatePtyOptions = { id: ID, cwd: '/w', type: 'terminal', agentPreset: 'codex-cli', shell: '/bin/bash' }

  it('with `holdInputUntilLaunch` → 4th argument `{ holdInputUntilLaunch: true }`', async () => {
    const api = { restart: vi.fn(async () => true), create: vi.fn() }
    await restartOrCreatePty({ ...OPTS, holdInputUntilLaunch: true }, api)
    expect(api.restart).toHaveBeenCalledWith(ID, '/w', '/bin/bash', { holdInputUntilLaunch: true })
  })

  it('without it → exactly the three arguments of before', async () => {
    const api = { restart: vi.fn(async () => true), create: vi.fn() }
    await restartOrCreatePty(OPTS, api)
    expect(api.restart.mock.calls[0]).toEqual([ID, '/w', '/bin/bash'])
  })

  it('restart answers false → pty:create carries the flag in its options', async () => {
    const api = { restart: vi.fn(async () => false), create: vi.fn(async () => ({ ok: true, created: true })) }
    const outcome = await restartOrCreatePty({ ...OPTS, holdInputUntilLaunch: true }, api)
    expect(outcome).toEqual({ ok: true, via: 'create', spawned: true })
    expect(api.create).toHaveBeenCalledWith({ ...OPTS, holdInputUntilLaunch: true })
  })
})

describe('WorkspaceView wiring (source guard)', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../components/WorkspaceView.tsx'), 'utf8')

  it('no launch command is written by a bare setTimeout + pty.write any more', () => {
    expect(source).not.toMatch(/setTimeout\(\(\) => \{\s*window\.electronAPI\.pty\.write\(/)
    expect(source).not.toMatch(/\}, 500\)/)
  })

  it('every launch write goes through sendLaunchCommand, every create / restart before it asks for the hold', () => {
    // the 11 `setTimeout(() => pty.write(…), 500)` of before: restore (3), default agent (3),
    // claude-cli (1), codex resume (1), add agent (2), ⏻ (1)
    expect(source.match(/sendLaunchCommand\(/g)?.length).toBe(11)
    // restore, default agent, claude-cli, codex resume, add agent, ⏻
    expect(source.match(/holdInputUntilLaunch: true/g)?.length).toBe(6)
  })

  it('the login terminal (typed, not submitted) and plain shell tabs do not ask for the hold', () => {
    const login = source.slice(source.indexOf('handleOpenLoginTerminal = '), source.indexOf('CLAUDE_OPEN_LOGIN_TERMINAL_EVENT, handleOpenLoginTerminal)'))
    expect(login).not.toContain('holdInputUntilLaunch')
    const plain = source.slice(source.indexOf("if (!agentPreset || agentPreset === 'none') {"), source.indexOf('// Auto-run agent command for non-Claude'))
    expect(plain).toContain('createPtyWithReplay(createOpts, restorePtyApi)')
    expect(plain).not.toContain('holdInputUntilLaunch')
  })
})
