// @vitest-environment node
/**
 * T0432 (PLAN-036 P3 / K, T0420 方案 A'): per-PTY helper capability registry and the
 * default-deny authorization (channel whitelist × role × target binding).
 * Wire-level behaviour (RemoteServer auth / invoke) is in headless-helper-capability.test.ts.
 */
import { describe, expect, it } from 'vitest'
import {
  HELPER_CAPABILITY_TOKEN_PREFIX,
  HELPER_CHANNEL_ROLES,
  HELPER_CLIENT_RESERVED_PTYS,
  HELPER_TOWER_CREATE_INTERVAL_MS,
  HELPER_TOWER_MAX_LIVE_CHILDREN,
  HelperCapabilityRegistry,
  HelperTowerSpawnQuota,
  authorizeHelperInvoke,
  isCapabilityTokenShaped,
  safeTokenEqual,
  type HelperCapability,
} from '../helper-capability'

const TOWER: HelperCapability = { terminalId: 'tower-1', role: 'tower' }
const WORKER: HelperCapability = { terminalId: 'worker-1', towerId: 'tower-1', role: 'worker' }
const alive = new Set(['tower-1', 'worker-1', 'other-1'])
const knownAgents = new Set(['claude-code', 'codex-cli', 'my-custom-cli'])
const ctx = { isTerminalAlive: (id: string) => alive.has(id), isKnownAgent: (agent: string) => knownAgents.has(agent) }

/** Channels of every domain a helper must never reach (T0432 memory_overrides #1). */
const FORBIDDEN_FOR_ALL = [
  'pty:create',
  'pty:kill',
  'pty:restart',
  'pty:resize',
  'pty:get-buffer',
  'pty:get-cwd',
  'terminal:create-with-command',
  'fs:readdir',
  'fs:readFile',
  'fs:writeFile',
  'image:read-as-data-url',
  'workspace:sync-roots',
  'claude:start-session',
  'claude:send-message',
  'git:status',
  'git-scaffold:init',
  'worktree:create',
  'github:check-cli',
  'profile:list',
  'profile:save',
  'settings:get-shell-path',
  'settings:save',
  'remote-tools:detect',
  'no-such-channel',
]

function reason(decision: ReturnType<typeof authorizeHelperInvoke>): string | null {
  return decision.ok ? null : decision.reason
}

describe('HelperCapabilityRegistry (T0432)', () => {
  it('issues a prefixed 32-byte random token; verify returns the bound capability (tower / worker)', () => {
    const registry = new HelperCapabilityRegistry()
    const towerToken = registry.issue('tower-1')
    const workerToken = registry.issue('worker-1', { towerId: 'tower-1' })
    expect(towerToken.startsWith(HELPER_CAPABILITY_TOKEN_PREFIX)).toBe(true)
    expect(Buffer.from(towerToken.slice(HELPER_CAPABILITY_TOKEN_PREFIX.length), 'base64url')).toHaveLength(32)
    expect(towerToken).not.toBe(workerToken)
    expect(registry.verify(towerToken)?.capability).toEqual(TOWER)
    expect(registry.verify(workerToken)?.capability).toEqual(WORKER)
    expect(registry.size).toBe(2)
  })

  it('rejects unknown, empty, non-string and same-length forged tokens', () => {
    const registry = new HelperCapabilityRegistry()
    const token = registry.issue('tower-1')
    const forged = (token[0] === 'A' ? 'B' : 'A') + token.slice(1)
    for (const candidate of [forged, '', undefined, null, 42, {}, token.slice(1), `${token}x`]) {
      expect(registry.verify(candidate)).toBeNull()
    }
  })

  it('stores only a digest: the token itself is nowhere in the registry state', () => {
    const registry = new HelperCapabilityRegistry()
    const token = registry.issue('tower-1')
    const state = JSON.stringify([...(registry as unknown as { entries: Map<string, unknown> }).entries])
    expect(state).not.toContain(token)
  })

  it('revokeTerminal revokes that PTY only; lookup by key then fails', () => {
    const registry = new HelperCapabilityRegistry()
    const tower = registry.issue('tower-1')
    const worker = registry.issue('worker-1', { towerId: 'tower-1' })
    const key = registry.verify(worker)!.key
    expect(registry.revokeTerminal('worker-1')).toBe(1)
    expect(registry.lookup(key)).toBeNull()
    expect(registry.verify(worker)).toBeNull()
    expect(registry.verify(tower)).not.toBeNull()
    expect(registry.revokeTerminal('worker-1')).toBe(0)
  })

  it('re-issuing for the same PTY revokes the previous token (one live token per PTY)', () => {
    const registry = new HelperCapabilityRegistry()
    const first = registry.issue('tower-1')
    const second = registry.issue('tower-1')
    expect(registry.verify(first)).toBeNull()
    expect(registry.verify(second)?.capability).toEqual(TOWER)
    expect(registry.size).toBe(1)
  })

  it('clear revokes everything', () => {
    const registry = new HelperCapabilityRegistry()
    const token = registry.issue('tower-1')
    registry.clear()
    expect(registry.size).toBe(0)
    expect(registry.verify(token)).toBeNull()
  })

  it('refuses to bind to ids outside the terminal id whitelist', () => {
    const registry = new HelperCapabilityRegistry()
    expect(() => registry.issue('')).toThrow(/invalid terminal id/)
    expect(() => registry.issue('a b')).toThrow(/invalid terminal id/)
    expect(() => registry.issue('ok-1', { towerId: '../x' })).toThrow(/invalid tower id/)
  })

  it('verify returns a copy: mutating it does not change the stored capability', () => {
    const registry = new HelperCapabilityRegistry()
    const token = registry.issue('worker-1', { towerId: 'tower-1' })
    const verified = registry.verify(token)!
    verified.capability.towerId = 'other-1'
    expect(registry.lookup(verified.key)?.towerId).toBe('tower-1')
  })
})

describe('safeTokenEqual (T0432)', () => {
  it('equal strings → true; any difference, length mismatch, empty or non-string → false', () => {
    expect(safeTokenEqual('abc123', 'abc123')).toBe(true)
    expect(safeTokenEqual('abc124', 'abc123')).toBe(false)
    expect(safeTokenEqual('abc12', 'abc123')).toBe(false)
    expect(safeTokenEqual('abc1234', 'abc123')).toBe(false)
    expect(safeTokenEqual('', '')).toBe(false)
    expect(safeTokenEqual(undefined, 'abc')).toBe(false)
    expect(safeTokenEqual(123, '123')).toBe(false)
    expect(safeTokenEqual('é', 'é')).toBe(false)
  })
})

describe('authorizeHelperInvoke — whitelist (T0432)', () => {
  it('the whitelist is exactly the 4 helper channels', () => {
    expect(HELPER_CHANNEL_ROLES).toEqual({
      'terminal:create-agent-command': ['tower'],
      'terminal:notify': ['worker'],
      'pty:write': ['worker'],
      'terminal:keypress': ['worker'],
    })
  })

  it.each(FORBIDDEN_FOR_ALL)('%s is denied to both roles', channel => {
    expect(reason(authorizeHelperInvoke(TOWER, channel, [{ id: 'new-1' }], ctx))).toBe('channel-not-allowed')
    expect(reason(authorizeHelperInvoke(WORKER, channel, [{ id: 'new-1' }], ctx))).toBe('channel-not-allowed')
  })

  it('tower: notify / pty:write / keypress are denied (a tower writes no PTY)', () => {
    expect(reason(authorizeHelperInvoke(TOWER, 'pty:write', ['tower-1', 'x'], ctx))).toBe('role-not-allowed')
    expect(reason(authorizeHelperInvoke(TOWER, 'pty:write', ['worker-1', 'x'], ctx))).toBe('role-not-allowed')
    expect(reason(authorizeHelperInvoke(TOWER, 'terminal:notify', [{ targetId: 'tower-1', message: 'm' }], ctx))).toBe('role-not-allowed')
    expect(reason(authorizeHelperInvoke(TOWER, 'terminal:keypress', [{ targetId: 'tower-1', key: 'Enter' }], ctx))).toBe('role-not-allowed')
  })

  it('worker: create-agent-command is denied', () => {
    expect(reason(authorizeHelperInvoke(WORKER, 'terminal:create-agent-command', [{ id: 'new-1', prompt: 'p' }], ctx))).toBe('role-not-allowed')
  })
})

describe('authorizeHelperInvoke — worker target binding (T0432)', () => {
  it('notify / pty:write / keypress to the bound tower → allowed', () => {
    expect(authorizeHelperInvoke(WORKER, 'terminal:notify', [{ targetId: 'tower-1', message: 'T0432 完成' }], ctx)).toEqual({ ok: true })
    expect(authorizeHelperInvoke(WORKER, 'pty:write', ['tower-1', 'T0432 完成'], ctx)).toEqual({ ok: true })
    expect(authorizeHelperInvoke(WORKER, 'terminal:keypress', [{ targetId: 'tower-1', key: 'Enter' }], ctx)).toEqual({ ok: true })
  })

  it.each([
    ['another PTY', 'other-1'],
    ['itself', 'worker-1'],
    ['missing target', undefined],
  ])('notify / pty:write / keypress to %s → target-not-bound', (_label, target) => {
    expect(reason(authorizeHelperInvoke(WORKER, 'terminal:notify', [{ targetId: target, message: 'm' }], ctx))).toBe('target-not-bound')
    expect(reason(authorizeHelperInvoke(WORKER, 'pty:write', [target, 'x'], ctx))).toBe('target-not-bound')
    expect(reason(authorizeHelperInvoke(WORKER, 'terminal:keypress', [{ targetId: target, key: 'Enter' }], ctx))).toBe('target-not-bound')
  })

  it('non-object payloads → invalid-payload', () => {
    expect(reason(authorizeHelperInvoke(WORKER, 'terminal:notify', ['tower-1'], ctx))).toBe('invalid-payload')
    expect(reason(authorizeHelperInvoke(WORKER, 'terminal:keypress', [], ctx))).toBe('invalid-payload')
    expect(reason(authorizeHelperInvoke(WORKER, 'pty:write', ['tower-1'], ctx))).toBe('invalid-payload')
    expect(reason(authorizeHelperInvoke(WORKER, 'pty:write', ['tower-1', { data: 'x' }], ctx))).toBe('invalid-payload')
  })
})

describe('authorizeHelperInvoke — tower create-agent-command (T0432)', () => {
  const create = (opts: unknown, c = ctx) => authorizeHelperInvoke(TOWER, 'terminal:create-agent-command', [opts], c)

  it('a new terminal reporting back to this tower (bat-terminal payload) → allowed', () => {
    expect(create({
      id: 'new-1',
      cwd: '/tmp',
      agent: 'claude-code',
      skill: 'ct-exec',
      workorder: 'T0432',
      workspaceId: 'ws-1',
      customEnv: { MSYS_NO_PATHCONV: '1', BAT_TOWER_TERMINAL_ID: 'tower-1', CT_MODE: 'yolo', CT_INTERACTIVE: '0' },
    })).toEqual({ ok: true })
    expect(create({ id: 'new-2', cwd: '/tmp', prompt: 'hi' })).toEqual({ ok: true })
  })

  it('an existing terminal id (would type the command into it) → terminal-exists', () => {
    expect(reason(create({ id: 'other-1', prompt: 'p' }))).toBe('terminal-exists')
    expect(reason(create({ id: 'worker-1', prompt: 'p' }))).toBe('terminal-exists')
    expect(reason(create({ id: 'tower-1', prompt: 'p' }))).toBe('target-not-bound')
  })

  it('without a liveness check → denied (fail closed)', () => {
    expect(reason(create({ id: 'new-1', prompt: 'p' }, {}))).toBe('terminal-liveness-unknown')
  })

  it('T0450 (T0445 #7): agent must be a registry id; default / omitted is the host default', () => {
    expect(create({ id: 'new-1', prompt: 'p', agent: 'codex-cli' })).toEqual({ ok: true })
    expect(create({ id: 'new-1', prompt: 'p', agent: 'my-custom-cli' })).toEqual({ ok: true })
    expect(create({ id: 'new-1', prompt: 'p', agent: 'default' })).toEqual({ ok: true })
    expect(create({ id: 'new-1', prompt: 'p', agent: '' })).toEqual({ ok: true })
    expect(create({ id: 'new-1', prompt: 'p', agent: null })).toEqual({ ok: true })
    expect(reason(create({ id: 'new-1', prompt: 'p', agent: 'evil-cli' }))).toBe('agent-not-allowed')
    expect(reason(create({ id: 'new-1', prompt: 'p', agent: 'constructor' }))).toBe('agent-not-allowed')
    expect(reason(create({ id: 'new-1', prompt: 'p', agent: ['claude-code'] }))).toBe('invalid-agent')
    expect(reason(create({ id: 'new-1', prompt: 'p', agent: 1 }))).toBe('invalid-agent')
  })

  it('T0450: without a registry lookup an explicit agent is denied (fail closed)', () => {
    const noRegistry = { isTerminalAlive: ctx.isTerminalAlive }
    expect(reason(create({ id: 'new-1', prompt: 'p', agent: 'claude-code' }, noRegistry))).toBe('agent-registry-unknown')
    expect(create({ id: 'new-1', prompt: 'p' }, noRegistry)).toEqual({ ok: true })
  })

  it('a worker bound to another tower → tower-not-bound', () => {
    expect(reason(create({ id: 'new-1', prompt: 'p', customEnv: { BAT_TOWER_TERMINAL_ID: 'other-1' } }))).toBe('tower-not-bound')
  })

  it('customEnv keys outside the helper set, or non-string values → denied', () => {
    expect(reason(create({ id: 'new-1', prompt: 'p', customEnv: { LD_PRELOAD: '/x.so' } }))).toBe('custom-env-not-allowed')
    expect(reason(create({ id: 'new-1', prompt: 'p', customEnv: { BAT_REMOTE_TOKEN: 'x' } }))).toBe('custom-env-not-allowed')
    expect(reason(create({ id: 'new-1', prompt: 'p', customEnv: { CT_MODE: 1 } }))).toBe('invalid-custom-env')
    expect(reason(create({ id: 'new-1', prompt: 'p', customEnv: ['x'] }))).toBe('invalid-custom-env')
  })

  it('a client-chosen shell → shell-not-allowed', () => {
    expect(reason(create({ id: 'new-1', prompt: 'p', shell: '/bin/bash' }))).toBe('shell-not-allowed')
  })

  it('invalid ids / payloads → denied', () => {
    expect(reason(create({ id: '../x', prompt: 'p' }))).toBe('invalid-terminal-id')
    expect(reason(create({ prompt: 'p' }))).toBe('invalid-terminal-id')
    expect(reason(create(null))).toBe('invalid-payload')
    expect(reason(create('new-1'))).toBe('invalid-payload')
  })
})

describe('authorizeHelperInvoke — prototype keys / non-string channels (T0447, T0445 #2)', () => {
  // `HELPER_CHANNEL_ROLES[channel]` used to resolve these to Object.prototype members
  // (truthy, no `includes`) → TypeError → unhandled rejection in the headless server.
  const PROTO_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', '__defineGetter__']

  it.each(PROTO_KEYS)('%s → channel-not-allowed for both roles, without throwing', channel => {
    for (const cap of [TOWER, WORKER]) {
      expect(() => authorizeHelperInvoke(cap, channel, [], ctx)).not.toThrow()
      expect(reason(authorizeHelperInvoke(cap, channel, ['tower-1'], ctx))).toBe('channel-not-allowed')
    }
  })

  it.each([
    ['number', 123],
    ['object', {}],
    ['array', ['pty:write']],
    ['null', null],
    ['undefined', undefined],
    ['boolean', true],
  ])('a %s channel → channel-not-allowed, without throwing', (_label, channel) => {
    for (const cap of [TOWER, WORKER]) {
      expect(reason(authorizeHelperInvoke(cap, channel as unknown as string, ['tower-1'], ctx))).toBe('channel-not-allowed')
    }
  })

  it('non-array args → invalid-args, without throwing', () => {
    for (const args of [{ 0: 'tower-1', length: 2 }, 'tower-1', null, 42]) {
      expect(reason(authorizeHelperInvoke(WORKER, 'pty:write', args as unknown as unknown[], ctx))).toBe('invalid-args')
    }
  })
})

describe('HelperCapabilityRegistry revoked digests (T0449, T0445 #5)', () => {
  it('isCapabilityTokenShaped: prefix only; a base64url / hex server token never matches', () => {
    expect(isCapabilityTokenShaped(new HelperCapabilityRegistry().issue('tower-1'))).toBe(true)
    expect(isCapabilityTokenShaped(`${HELPER_CAPABILITY_TOKEN_PREFIX}anything`)).toBe(true)
    for (const candidate of ['a'.repeat(43), 'ab'.repeat(16), '', undefined, null, 42, {}, ['batcap.x']]) {
      expect(isCapabilityTokenShaped(candidate)).toBe(false)
    }
  })

  it('remembers revoked tokens (revokeTerminal / re-issue / clear); live and unknown tokens are not "revoked"', () => {
    const registry = new HelperCapabilityRegistry()
    const worker = registry.issue('worker-1', { towerId: 'tower-1' })
    const first = registry.issue('tower-1')
    const second = registry.issue('tower-1') // re-issue revokes `first`
    expect(registry.isRecentlyRevoked(first)).toBe(true)
    expect(registry.isRecentlyRevoked(second)).toBe(false)
    expect(registry.isRecentlyRevoked(worker)).toBe(false)
    registry.revokeTerminal('worker-1')
    expect(registry.isRecentlyRevoked(worker)).toBe(true)
    registry.clear()
    expect(registry.isRecentlyRevoked(second)).toBe(true)
    for (const candidate of [`${HELPER_CAPABILITY_TOKEN_PREFIX}never-issued`, '', undefined, null, 42]) {
      expect(registry.isRecentlyRevoked(candidate)).toBe(false)
    }
    // Revoked is not live.
    expect(registry.verify(first)).toBeNull()
  })

  it('forgets revoked digests after the TTL', () => {
    let now = 1_000
    const registry = new HelperCapabilityRegistry({ now: () => now, revokedTtlMs: 100 })
    const token = registry.issue('tower-1')
    registry.revokeTerminal('tower-1')
    now += 99
    expect(registry.isRecentlyRevoked(token)).toBe(true)
    now += 1
    expect(registry.isRecentlyRevoked(token)).toBe(false)
  })

  it('is bounded: the oldest revoked digest is evicted beyond the capacity', () => {
    const registry = new HelperCapabilityRegistry({ revokedCapacity: 3 })
    const tokens = ['t-0', 't-1', 't-2', 't-3'].map(id => registry.issue(id))
    for (const id of ['t-0', 't-1', 't-2', 't-3']) registry.revokeTerminal(id)
    expect(tokens.map(t => registry.isRecentlyRevoked(t))).toEqual([false, true, true, true])
    expect((registry as unknown as { revoked: Map<string, number> }).revoked.size).toBe(3)
  })

  it('stores only digests of revoked tokens too', () => {
    const registry = new HelperCapabilityRegistry()
    const token = registry.issue('tower-1')
    registry.revokeTerminal('tower-1')
    const state = JSON.stringify([...(registry as unknown as { revoked: Map<string, number> }).revoked])
    expect(state).not.toContain(token)
    expect(state).not.toContain(token.slice(HELPER_CAPABILITY_TOKEN_PREFIX.length))
  })
})

describe('authorizeHelperInvoke — worker pty:write content (T0450, T0445 #6)', () => {
  const write = (data: unknown) => authorizeHelperInvoke(WORKER, 'pty:write', ['tower-1', data], ctx)

  it('printable text (incl. CJK / emoji / spaces) → allowed', () => {
    expect(write('T0450 完成')).toEqual({ ok: true })
    expect(write('T0450 部分完成 — see report ✓ 🚀')).toEqual({ ok: true })
    expect(write('')).toEqual({ ok: true })
  })

  it('submit / interrupt / escape sequences → control-character-not-allowed', () => {
    for (const data of [
      'T0450 完成\r',
      'T0450 完成\n',
      'line1\r\nline2',
      '\x03\x03rm -rf ~\r',
      '\x1b[200~paste\x1b[201~',
      '\x1b',
      'a\tb',
      '\x00',
      '\x04',
      'x\x7f',
      'x\u009b31m',
    ]) {
      expect(reason(write(data)), JSON.stringify(data)).toBe('control-character-not-allowed')
    }
  })
})

describe('HelperTowerSpawnQuota (T0450, T0445 #7)', () => {
  function setup(opts: { max?: number; count?: number } = {}) {
    let now = 1_000_000
    const running = new Set<string>()
    const quota = new HelperTowerSpawnQuota({ now: () => now })
    const spawnCtx = {
      isTerminalAlive: (id: string) => running.has(id),
      getPtyCapacity: () => ({ count: (opts.count ?? 0) + running.size, max: opts.max ?? 0 }),
    }
    /** Reserve, then "create" the PTY and settle, as RemoteServer does around the handler. */
    const spawn = (tower: string, child: string) => {
      const r = quota.reserve(tower, child, spawnCtx)
      if (!r.ok) return r.reason
      running.add(child)
      r.settle()
      return 'ok'
    }
    return { quota, running, spawnCtx, spawn, tick: (ms: number) => { now += ms } }
  }

  it('limits: 8 live children per tower, 1 s between creations, 8 slots kept for clients', () => {
    expect(HELPER_TOWER_MAX_LIVE_CHILDREN).toBe(8)
    expect(HELPER_TOWER_CREATE_INTERVAL_MS).toBe(1000)
    expect(HELPER_CLIENT_RESERVED_PTYS).toBe(8)
  })

  it('the 9th live child of a tower is refused; a child exiting frees a slot', () => {
    const { spawn, tick, running, quota, spawnCtx } = setup()
    for (let i = 0; i < 8; i++) {
      expect(spawn('tower-1', `c-${i}`)).toBe('ok')
      tick(1000)
    }
    expect(spawn('tower-1', 'c-8')).toBe('too-many-children')
    expect(quota.liveChildren('tower-1', spawnCtx.isTerminalAlive)).toBe(8)
    // Another tower has its own quota.
    expect(spawn('tower-2', 'd-0')).toBe('ok')
    running.delete('c-3')
    tick(1000)
    expect(spawn('tower-1', 'c-8')).toBe('ok')
  })

  it('a second creation within 1 s is refused (also while the first is still in flight)', () => {
    const { quota, spawnCtx, spawn, tick } = setup()
    expect(quota.reserve('tower-1', 'c-0', spawnCtx).ok).toBe(true)
    expect(spawn('tower-1', 'c-1')).toBe('create-rate-limited')
    tick(999)
    expect(spawn('tower-1', 'c-1')).toBe('create-rate-limited')
    tick(1)
    expect(spawn('tower-1', 'c-1')).toBe('ok')
  })

  it('in-flight creations count toward the live children', () => {
    const { quota, spawnCtx, tick } = setup()
    for (let i = 0; i < 8; i++) {
      expect(quota.reserve('tower-1', `c-${i}`, spawnCtx).ok).toBe(true)
      tick(1000)
    }
    expect(quota.reserve('tower-1', 'c-8', spawnCtx)).toEqual({ ok: false, reason: 'too-many-children' })
  })

  it('a failed creation (no PTY after settle) does not keep a slot', () => {
    const { quota, spawnCtx, tick } = setup()
    const r = quota.reserve('tower-1', 'c-0', spawnCtx)
    if (!r.ok) throw new Error('expected ok')
    r.settle()
    expect(quota.liveChildren('tower-1', spawnCtx.isTerminalAlive)).toBe(0)
    tick(1000)
    expect(quota.reserve('tower-1', 'c-1', spawnCtx).ok).toBe(true)
  })

  it('client reserve: with a PTY cap, helpers stop 8 slots short of it (in-flight included)', () => {
    // cap 20, 11 PTYs running → helpers may bring it to 12 (= 20 - 8), no further.
    const { spawn, tick } = setup({ max: 20, count: 11 })
    expect(spawn('tower-1', 'c-0')).toBe('ok')
    tick(1000)
    expect(spawn('tower-2', 'd-0')).toBe('pty-quota-reserved')
    // An in-flight reservation counts before its PTY exists.
    const fresh = setup({ max: 20, count: 11 })
    expect(fresh.quota.reserve('tower-1', 'c-0', fresh.spawnCtx).ok).toBe(true)
    expect(fresh.quota.reserve('tower-2', 'd-0', fresh.spawnCtx)).toEqual({ ok: false, reason: 'pty-quota-reserved' })
  })

  it('a cap at or below the reserve leaves helpers no slot; max 0 (unlimited) keeps no reserve', () => {
    expect(setup({ max: 8 }).spawn('tower-1', 'c-0')).toBe('pty-quota-reserved')
    expect(setup({ max: 0, count: 500 }).spawn('tower-1', 'c-0')).toBe('ok')
  })

  it('without the PTY capacity → denied (fail closed)', () => {
    const quota = new HelperTowerSpawnQuota()
    expect(quota.reserve('tower-1', 'c-0', { isTerminalAlive: () => false })).toEqual({ ok: false, reason: 'pty-capacity-unknown' })
    expect(quota.reserve('tower-1', 'c-0', { isTerminalAlive: () => false, getPtyCapacity: () => null }))
      .toEqual({ ok: false, reason: 'pty-capacity-unknown' })
  })

  it('forgets towers with no running child once the interval passed (bounded memory)', () => {
    const { spawn, tick, running, quota } = setup()
    expect(spawn('tower-1', 'c-0')).toBe('ok')
    running.delete('c-0')
    tick(1000)
    expect(spawn('tower-2', 'd-0')).toBe('ok')
    const towers = (quota as unknown as { towers: Map<string, unknown> }).towers
    expect([...towers.keys()]).toEqual(['tower-2'])
  })
})
