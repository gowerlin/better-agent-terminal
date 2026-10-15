// T0539 (BUG-137) — ⏻ on a tab whose PTY is gone: `pty:restart` answers false, so a new PTY is
// created with the same id from the tab's data; failures are reported, not swallowed.

import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CreatePtyOptions } from '../../types'
import { onPtyCreateRefused, registerPtyReplaySink, resetPtyReplayRegistry, restartOrCreatePty } from '../pty-replay'

const OPTS: CreatePtyOptions = {
  id: 't1',
  cwd: '/w',
  type: 'terminal',
  agentPreset: 'codex-cli',
  shell: '/bin/zsh',
  customEnv: { WS_VAR: 'ws' },
  workspaceId: 'ws-1',
}

function makeApi(restart: () => Promise<boolean>, create: () => Promise<unknown> = async () => ({ ok: true, created: true })) {
  return { restart: vi.fn(restart), create: vi.fn(create) } as unknown as {
    restart: ReturnType<typeof vi.fn> & ((id: string, cwd: string, shell?: string) => Promise<boolean>)
    create: ReturnType<typeof vi.fn> & ((options: CreatePtyOptions) => Promise<boolean>)
  }
}

afterEach(() => resetPtyReplayRegistry())

describe('restartOrCreatePty', () => {
  it('live PTY: pty:restart answers true → nothing else is called (restart behaviour unchanged)', async () => {
    const api = makeApi(async () => true)
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'restart', spawned: true })
    expect(api.restart).toHaveBeenCalledWith('t1', '/w', '/bin/zsh')
    expect(api.create).not.toHaveBeenCalled()
  })

  it('PTY gone: pty:restart answers false → pty:create with the same id and the tab data', async () => {
    const api = makeApi(async () => false)
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'create', spawned: true })
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(api.create).toHaveBeenCalledWith(OPTS)
  })

  it('host without a PtyManager (restart → undefined) also falls back to create', async () => {
    const api = makeApi(async () => undefined as unknown as boolean)
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'create', spawned: true })
  })

  it('create finds the PTY already running → ok, not spawned (no launch command), replay requested', async () => {
    const api = makeApi(async () => false, async () => ({ ok: true, created: false }))
    const sink = vi.fn()
    registerPtyReplaySink('t1', sink)
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: true, via: 'create', spawned: false })
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('create fails → reported with a reason', async () => {
    const api = makeApi(async () => false, async () => ({ ok: false, created: false }))
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: false, via: 'create', reason: 'pty:create failed', limited: false })
  })

  it('create throws → reported (not swallowed)', async () => {
    const api = makeApi(async () => false, async () => { throw new Error('Remote not connected') })
    const outcome = await restartOrCreatePty(OPTS, api)
    expect(outcome.ok).toBe(false)
  })

  it('PTY limit → limited (the T0424 refusal listeners write their own notice)', async () => {
    const api = makeApi(async () => false, async () => ({ ok: false, created: false, code: 'PTY_LIMIT_REACHED', limit: 4 }))
    const refused = vi.fn()
    onPtyCreateRefused(refused)
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: false, via: 'create', reason: 'PTY_LIMIT_REACHED', limited: true })
    expect(refused).toHaveBeenCalledTimes(1)
  })

  it('pty:restart throws → reported, no create', async () => {
    const api = makeApi(async () => { throw new Error('Remote invoke timeout: pty:restart') })
    expect(await restartOrCreatePty(OPTS, api)).toEqual({ ok: false, via: 'restart', reason: 'Remote invoke timeout: pty:restart', limited: false })
    expect(api.create).not.toHaveBeenCalled()
  })
})

describe('WorkspaceView ⏻ (source guard)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'WorkspaceView.tsx'), 'utf8')
  const handleRestart = src.slice(src.indexOf('const handleRestart = useCallback'), src.indexOf('const handleSwitchApiVersion'))

  it('restarts through restartOrCreatePty with the tab data, not a bare pty.restart', () => {
    expect(handleRestart).toContain('restartOrCreatePty({')
    expect(handleRestart).not.toContain('pty.restart(')
    expect(handleRestart).toMatch(/customEnv: mergeEnvVars\(settingsStore\.getSettings\(\)\.globalEnvVars, workspace\.envVars\)/)
    expect(handleRestart).toContain('workspaceId: workspace.id')
    expect(handleRestart).toContain('agentPreset: terminal.agentPreset')
  })

  it('a failure prints a notice in the tab; the agent launch command needs a spawned shell', () => {
    expect(handleRestart).toMatch(/if \(!outcome\.ok\) \{[\s\S]*showPtyNotice\(id, t\('terminal\.restartFailedNotice'/)
    expect(handleRestart).toContain('if (outcome.spawned && terminal.agentPreset')
  })
})
