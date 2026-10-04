// @vitest-environment node
/**
 * T0431 (PLAN-036 P3 / K): electron/handlers/terminal.ts — the shared
 * `terminal:create-*` / `notify` / `keypress` module, with fake host deps.
 *   - events go through the host emit; Electron emit = windows (counted) + broadcastHub
 *   - `terminal:created-externally` only for creations not invoked by a local window
 *   - keypress answers `no-client` when the host counts no remote receiver (headless)
 *   - a client-supplied shell is validated when the host asks for it (headless)
 */
import { describe, expect, it, vi } from 'vitest'
import { createTerminalWindowEmit, registerTerminalHandlers, type TerminalHandlerDeps } from '../handlers/terminal'
import type { HandlerContext, SharedHandler } from '../handlers/types'

vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

interface Emitted { channel: string; payload: unknown }

function setup(overrides: Partial<TerminalHandlerDeps> = {}) {
  const handlers = new Map<string, SharedHandler>()
  const emitted: Emitted[] = []
  const created: Array<{ id: string; cwd: string; shell?: string; customEnv?: Record<string, string>; workspaceId?: string }> = []
  const writes: Array<[string, string]> = []
  const deps: TerminalHandlerDeps = {
    getPtyManager: () => ({
      isAlive: () => false,
      create: (opts) => { created.push(opts); return true },
      write: (id, data) => { writes.push([id, data]) },
    }),
    emit: (channel, payload) => { emitted.push({ channel, payload }); return 2 },
    readSettings: () => null,
    buildAgentPromptCommand: async (opts) => ({
      command: `agent ${opts.prompt ?? `/${opts.skill} ${opts.workorder}`}`,
      agentId: 'claude-cli',
      prompt: opts.prompt ?? '',
      prefixNormalized: false,
    }),
    existsSync: () => false,
    ...overrides,
  }
  registerTerminalHandlers((channel, handler) => { handlers.set(channel, handler) }, deps)
  const invoke = (channel: string, ctx: HandlerContext, ...args: unknown[]) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`not registered: ${channel}`)
    return Promise.resolve(handler(ctx, ...args))
  }
  return { handlers, emitted, created, writes, invoke }
}

const REMOTE: HandlerContext = { windowId: null, connectionId: 'conn-1' }
const LOCAL_WINDOW: HandlerContext = { windowId: 'win-1' }

describe('registerTerminalHandlers (T0431)', () => {
  it('registers exactly the four terminal channels', () => {
    expect([...setup().handlers.keys()].sort()).toEqual([
      'terminal:create-agent-command',
      'terminal:create-with-command',
      'terminal:keypress',
      'terminal:notify',
    ])
  })

  it('create-agent-command → PTY + command + created-externally through emit (remote invoker)', async () => {
    vi.useFakeTimers()
    try {
      const t = setup()
      const result = await t.invoke('terminal:create-agent-command', REMOTE, {
        id: 'w1', cwd: '/home/x/repo', skill: 'ct-exec', workorder: 'T0431',
        customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-1' }, workspaceId: 'ws-1',
      })
      expect(result).toBe(true)
      expect(t.created).toEqual([expect.objectContaining({
        id: 'w1', cwd: '/home/x/repo', customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-1' }, workspaceId: 'ws-1',
      })])
      expect(t.emitted).toEqual([{
        channel: 'terminal:created-externally',
        payload: { id: 'w1', cwd: '/home/x/repo', command: 'agent /ct-exec T0431', workspaceId: 'ws-1' },
      }])
      vi.advanceTimersByTime(500)
      expect(t.writes).toEqual([['w1', 'agent /ct-exec T0431\r']])
    } finally {
      vi.useRealTimers()
    }
  })

  it('no created-externally when a local window created the terminal (pre-T0431 rule)', async () => {
    const t = setup()
    expect(await t.invoke('terminal:create-with-command', LOCAL_WINDOW, { id: 'w2', cwd: '/x', command: 'ls' })).toBe(true)
    expect(t.emitted).toEqual([])
  })

  it('validateShell rejects a relative / missing client shell before creating anything', async () => {
    const t = setup({ validateShell: true })
    expect(await t.invoke('terminal:create-with-command', REMOTE, { id: 'w3', cwd: '/x', command: 'ls', shell: 'bash' })).toBe(false)
    expect(await t.invoke('terminal:create-agent-command', REMOTE, { id: 'w4', cwd: '/x', prompt: 'p', shell: '/no/such/shell' })).toBe(false)
    expect(t.created).toEqual([])
    expect(t.emitted).toEqual([])
  })

  it('without validateShell the explicit shell is passed through (Electron, unchanged)', async () => {
    const t = setup()
    await t.invoke('terminal:create-with-command', REMOTE, { id: 'w5', cwd: '/x', command: 'ls', shell: 'bash' })
    expect(t.created[0].shell).toBe('bash')
  })

  it('notify → terminal:notified through emit', async () => {
    const t = setup()
    expect(await t.invoke('terminal:notify', REMOTE, { targetId: 'tower-1', message: 'T0431 完成', source: 'T0431' })).toBe(true)
    expect(t.emitted).toEqual([{ channel: 'terminal:notified', payload: { targetId: 'tower-1', message: 'T0431 完成', source: 'T0431' } }])
    expect(await t.invoke('terminal:notify', REMOTE, { targetId: 'tower-1' })).toBe(false)
    expect(t.emitted).toHaveLength(1)
  })

  it('keypress (Electron: no receiver count) → event + broadcastWindows from emit', async () => {
    const t = setup()
    expect(await t.invoke('terminal:keypress', REMOTE, { targetId: 'tower-1', key: 'Enter', source: 'T0431', traceId: 'tr' }))
      .toEqual({ ok: true, broadcastWindows: 2 })
    expect(t.emitted).toEqual([{
      channel: 'terminal:keypress',
      payload: { targetId: 'tower-1', key: 'Enter', code: 'Enter', keyCode: 13, source: 'T0431', reason: undefined, traceId: 'tr' },
    }])
    expect(await t.invoke('terminal:keypress', REMOTE, { targetId: 'tower-1', key: 'a' })).toEqual({ ok: false, reason: 'invalid-payload' })
  })

  it('keypress (headless) → no-client when nobody else is connected, no event sent', async () => {
    const countRemoteReceivers = vi.fn(() => 0)
    const t = setup({ countRemoteReceivers, emit: (channel, payload) => { t.emitted.push({ channel, payload }); return 0 } })
    expect(await t.invoke('terminal:keypress', REMOTE, { targetId: 'tower-1', keyCode: 13 })).toEqual({ ok: false, reason: 'no-client' })
    expect(countRemoteReceivers).toHaveBeenCalledWith(REMOTE)
    expect(t.emitted).toEqual([])
  })

  it('keypress (headless) with a receiver → ok + broadcastClients', async () => {
    const t = setup({ countRemoteReceivers: () => 1, emit: (channel, payload) => { t.emitted.push({ channel, payload }); return 0 } })
    expect(await t.invoke('terminal:keypress', REMOTE, { targetId: 'tower-1', code: 'Enter' }))
      .toEqual({ ok: true, broadcastWindows: 0, broadcastClients: 1 })
    expect(t.emitted.map(e => e.channel)).toEqual(['terminal:keypress'])
  })
})

describe('createTerminalWindowEmit (Electron host)', () => {
  it('sends to every window, counts the ones that took it, then broadcasts once', () => {
    const sent: string[] = []
    const broadcast = vi.fn()
    const emit = createTerminalWindowEmit(() => [
      { webContents: { send: (channel) => { sent.push(`a:${channel}`) } } },
      { webContents: { send: () => { throw new Error('closing') } } },
      { webContents: { send: (channel) => { sent.push(`c:${channel}`) } } },
    ], broadcast)
    expect(emit('terminal:notified', { targetId: 't' })).toBe(2)
    expect(sent).toEqual(['a:terminal:notified', 'c:terminal:notified'])
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(broadcast).toHaveBeenCalledWith('terminal:notified', { targetId: 't' })
  })
})
