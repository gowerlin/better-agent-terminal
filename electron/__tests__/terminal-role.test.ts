// @vitest-environment node
/**
 * T0562 / D147: `terminal:set-role` (electron/terminal-role.ts), registered for both hosts by
 * `registerTerminalHandlers` (electron/handlers/terminal.ts).
 *
 * - `{ terminalId, role: 'tower', agent? }` for a running PTY → `{ ok: true }` + one
 *   `terminal:role-changed` with the PTY's agent preset and the normalized `--agent` hint (names
 *   from the registry); an unknown hint is dropped, `none` / `default` are no agent
 * - INVALID_ARGS (role / terminal id / agent type) and NOT_FOUND (no such PTY, no PtyManager): no event
 * - PtyManager.getAgentPreset returns what the PTY was created with
 */
import { describe, expect, it, vi } from 'vitest'
import { registerTerminalHandlers } from '../handlers/terminal'
import { normalizeTerminalRole, setTerminalRole, type SetRolePtyManager, type SetTerminalRoleDeps } from '../terminal-role'
import { PtyManager } from '../pty-manager'

const REGISTRY: Record<string, string> = { 'claude-cli': 'Claude CLI', 'codex-cli': 'Codex CLI', 'my-cli': 'My CLI', none: 'Terminal' }

function setup(ptys: Record<string, string | undefined> | null) {
  const emitted: Array<[string, unknown]> = []
  const manager: SetRolePtyManager | null = ptys
    ? { isAlive: id => Object.prototype.hasOwnProperty.call(ptys, id), getAgentPreset: id => ptys[id] }
    : null
  const deps: SetTerminalRoleDeps = {
    getPtyManager: () => manager,
    emit: (channel, payload) => { emitted.push([channel, payload]); return 2 },
    logger: { log: vi.fn() },
    isKnownAgent: id => Object.prototype.hasOwnProperty.call(REGISTRY, id),
    agentName: id => REGISTRY[id],
    mirrorToBatScripts: vi.fn(),
  }
  return { deps, emitted }
}

describe('setTerminalRole (T0562)', () => {
  it('a running PTY → ok, terminal:role-changed with the PTY agent and the normalized hint', () => {
    const { deps, emitted } = setup({ tower: 'claude-cli' })
    expect(setTerminalRole({ terminalId: 'tower', role: 'tower', agent: 'codex' }, deps)).toEqual({ ok: true, terminalId: 'tower', role: 'tower' })
    expect(emitted).toEqual([['terminal:role-changed', {
      id: 'tower', role: 'tower', ptyAgent: 'claude-cli', ptyAgentName: 'Claude CLI', agent: 'codex-cli', agentName: 'Codex CLI',
    }]])
    expect(deps.mirrorToBatScripts).toHaveBeenCalledWith('set-role', expect.objectContaining({ result: 'OK', terminalId: 'tower', ptyAgent: 'claude-cli', agent: 'codex-cli' }))
  })

  it('role / terminal id are trimmed; role is case-insensitive', () => {
    const { deps, emitted } = setup({ tower: undefined })
    expect(setTerminalRole({ terminalId: ' tower ', role: ' Tower ' }, deps)).toEqual({ ok: true, terminalId: 'tower', role: 'tower' })
    expect(emitted).toEqual([['terminal:role-changed', { id: 'tower', role: 'tower' }]])
  })

  it('a custom CLI PTY carries its registry name; agent preset none is no agent', () => {
    const { deps, emitted } = setup({ a: 'my-cli', b: 'none' })
    setTerminalRole({ terminalId: 'a', role: 'tower' }, deps)
    setTerminalRole({ terminalId: 'b', role: 'tower', agent: 'none' }, deps)
    expect(emitted.map(([, p]) => p)).toEqual([
      { id: 'a', role: 'tower', ptyAgent: 'my-cli', ptyAgentName: 'My CLI' },
      { id: 'b', role: 'tower' },
    ])
  })

  it('an unknown or `default` --agent hint is dropped, not refused', () => {
    const { deps, emitted } = setup({ t: undefined })
    expect(setTerminalRole({ terminalId: 't', role: 'tower', agent: 'no-such-agent' }, deps)).toMatchObject({ ok: true })
    expect(setTerminalRole({ terminalId: 't', role: 'tower', agent: 'default' }, deps)).toMatchObject({ ok: true })
    expect(setTerminalRole({ terminalId: 't', role: 'tower', agent: '' }, deps)).toMatchObject({ ok: true })
    expect(emitted.map(([, p]) => p)).toEqual([{ id: 't', role: 'tower' }, { id: 't', role: 'tower' }, { id: 't', role: 'tower' }])
    expect(deps.mirrorToBatScripts).toHaveBeenCalledWith('set-role', expect.objectContaining({ ignoredAgent: 'no-such-agent' }))
  })

  it.each([
    ['no object', undefined],
    ['an array', [{ terminalId: 't', role: 'tower' }]],
    ['another role', { terminalId: 't', role: 'worker' }],
    ['no role', { terminalId: 't' }],
    ['no terminal id', { role: 'tower' }],
    ['an empty terminal id', { terminalId: '  ', role: 'tower' }],
    ['a terminal id with spaces inside', { terminalId: 'a b', role: 'tower' }],
    ['a non-string terminal id', { terminalId: 42, role: 'tower' }],
    ['a non-string agent', { terminalId: 't', role: 'tower', agent: ['claude'] }],
  ])('%s → INVALID_ARGS, no event', (_label, args) => {
    const { deps, emitted } = setup({ t: undefined })
    expect(setTerminalRole(args, deps)).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(emitted).toEqual([])
  })

  it('no such PTY / no PtyManager → NOT_FOUND, no event', () => {
    const a = setup({ other: undefined })
    expect(setTerminalRole({ terminalId: 't', role: 'tower' }, a.deps)).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(a.emitted).toEqual([])
    const b = setup(null)
    expect(setTerminalRole({ terminalId: 't', role: 'tower' }, b.deps)).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(b.emitted).toEqual([])
  })

  it('a PtyManager without getAgentPreset (older test doubles) still works', () => {
    const { deps, emitted } = setup(null)
    deps.getPtyManager = () => ({ isAlive: () => true })
    expect(setTerminalRole({ terminalId: 't', role: 'tower', agent: 'claude' }, deps)).toMatchObject({ ok: true })
    expect(emitted[0][1]).toEqual({ id: 't', role: 'tower', agent: 'claude-cli', agentName: 'Claude CLI' })
  })

  it('normalizeTerminalRole', () => {
    expect(normalizeTerminalRole('tower')).toBe('tower')
    expect(normalizeTerminalRole(' TOWER ')).toBe('tower')
    expect(normalizeTerminalRole('worker')).toBeNull()
    expect(normalizeTerminalRole(1)).toBeNull()
  })
})

describe('registerTerminalHandlers registers terminal:set-role (T0562)', () => {
  it('Electron and headless share it: the host emit carries the event', async () => {
    const handlers = new Map<string, (ctx: unknown, ...args: unknown[]) => unknown>()
    const emit = vi.fn(() => 1)
    registerTerminalHandlers((channel, handler) => { handlers.set(channel, handler as never) }, {
      getPtyManager: () => ({ isAlive: (id: string) => id === 'tower', getAgentPreset: () => 'claude-cli' }) as never,
      emit,
      readSettings: () => null,
      buildAgentPromptCommand: async () => null,
    })
    const handler = handlers.get('terminal:set-role')
    expect(handler).toBeDefined()
    expect(await handler!({ windowId: null }, { terminalId: 'tower', role: 'tower' })).toEqual({ ok: true, terminalId: 'tower', role: 'tower' })
    expect(emit).toHaveBeenCalledWith('terminal:role-changed', expect.objectContaining({ id: 'tower', role: 'tower', ptyAgent: 'claude-cli' }))
    expect(await handler!({ windowId: null }, { terminalId: 'nope', role: 'tower' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    // close-worker stays absent without a scheduler (unchanged)
    expect(handlers.has('terminal:close-worker')).toBe(false)
  })
})

describe('PtyManager.getAgentPreset (T0562)', () => {
  it('returns the agentPreset the instance was created with; unknown id → undefined', () => {
    const manager = Object.create(PtyManager.prototype) as PtyManager
    ;(manager as unknown as { instances: Map<string, unknown> }).instances = new Map([
      ['a', { agentPreset: 'claude-cli' }],
      ['b', {}],
    ])
    expect(manager.getAgentPreset('a')).toBe('claude-cli')
    expect(manager.getAgentPreset('b')).toBeUndefined()
    expect(manager.getAgentPreset('zz')).toBeUndefined()
  })
})
