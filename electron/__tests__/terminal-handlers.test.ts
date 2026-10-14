// @vitest-environment node
/**
 * T0431 (PLAN-036 P3 / K): electron/handlers/terminal.ts — the shared
 * `terminal:create-*` / `notify` / `keypress` module, with fake host deps.
 *   - events go through the host emit; Electron emit = windows (counted) + broadcastHub
 *   - `terminal:created-externally` only for creations not invoked by a local window
 *   - keypress answers `no-client` when the host counts no remote receiver (headless)
 *   - a client-supplied shell is validated when the host asks for it (headless)
 *   - T0523 / BUG-129: a helper-dispatched terminal lands in its --notify-id Tower terminal's
 *     workspace (registry), and `--agent default` resolves against that workspace
 */
import { describe, expect, it, vi } from 'vitest'
import { createTerminalWindowEmit, registerTerminalHandlers, type TerminalHandlerDeps } from '../handlers/terminal'
import type { HandlerContext, SharedHandler } from '../handlers/types'
import { resolveDispatchWorkspaceFromEntries } from '../dispatch-workspace'

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
        payload: { id: 'w1', cwd: '/home/x/repo', command: 'agent /ct-exec T0431', workspaceId: 'ws-1', towerTerminalId: 'tower-1' },
      }])
      vi.advanceTimersByTime(500)
      expect(t.writes).toEqual([['w1', 'agent /ct-exec T0431\r']])
    } finally {
      vi.useRealTimers()
    }
  })

  describe('dispatch workspace follows the --notify-id Tower terminal (T0523 / BUG-129)', () => {
    // Registry: tower-b is a tab of workspace B; workspace A exists too.
    const ENTRIES = [{
      workspaces: [{ id: 'ws-a', name: '土銀' }, { id: 'ws-b', name: 'SCB', alias: 'SCB專案資料' }],
      terminals: [{ id: 'tower-a', workspaceId: 'ws-a' }, { id: 'tower-b', workspaceId: 'ws-b' }],
    }]
    const WORKSPACE_AGENTS: Record<string, string> = { 'ws-a': 'claude-code', 'ws-b': 'codex-cli' }

    function dispatchSetup() {
      const agentWorkspaces: Array<string | undefined> = []
      const t = setup({
        resolveDispatchWorkspace: async (request) => resolveDispatchWorkspaceFromEntries(ENTRIES, request),
        buildAgentPromptCommand: async (opts) => {
          agentWorkspaces.push(opts.workspaceId)
          const agentId = (opts.agent && opts.agent !== 'default') ? opts.agent : (opts.workspaceId && WORKSPACE_AGENTS[opts.workspaceId]) || 'claude-code'
          return { command: `${agentId} go`, agentId, prompt: 'go', prefixNormalized: false, agentSource: opts.workspaceId && WORKSPACE_AGENTS[opts.workspaceId] ? 'workspace' : 'builtin' }
        },
      })
      return { ...t, agentWorkspaces }
    }
    const dispatch = (customEnv: Record<string, string>, extra: Record<string, unknown> = {}) => ({
      id: 'worker-1', cwd: '/scb', skill: 'ct-exec', workorder: 'T0001', agent: 'default', customEnv, ...extra,
    })

    it('tower in B, --workspace A → lands in B and --agent default uses B\'s default agent', async () => {
      const t = dispatchSetup()
      expect(await t.invoke('terminal:create-agent-command', REMOTE, dispatch({ BAT_TOWER_TERMINAL_ID: 'tower-b' }, { workspaceId: 'ws-a' }))).toBe(true)
      expect(t.agentWorkspaces).toEqual(['ws-b'])
      expect(t.created).toEqual([expect.objectContaining({ id: 'worker-1', workspaceId: 'ws-b' })])
      expect(t.emitted).toEqual([{
        channel: 'terminal:created-externally',
        payload: { id: 'worker-1', cwd: '/scb', command: 'codex-cli go', workspaceId: 'ws-b', towerTerminalId: 'tower-b', workspaceResolved: true },
      }])
    })

    it('tower and --workspace agree → unchanged', async () => {
      const t = dispatchSetup()
      await t.invoke('terminal:create-agent-command', REMOTE, dispatch({ BAT_TOWER_TERMINAL_ID: 'tower-a' }, { workspaceId: 'ws-a' }))
      expect(t.agentWorkspaces).toEqual(['ws-a'])
      expect(t.created[0].workspaceId).toBe('ws-a')
    })

    it('tower unknown to BAT (external shell / old helper) → --workspace as given', async () => {
      const t = dispatchSetup()
      await t.invoke('terminal:create-agent-command', REMOTE, dispatch({ BAT_TOWER_TERMINAL_ID: 'not-a-bat-tab' }, { workspaceId: 'ws-a' }))
      expect(t.agentWorkspaces).toEqual(['ws-a'])
      // ws-a is in the registry: a window without it skips the event (multi-window, T0523)
      expect(t.emitted[0].payload).toEqual({ id: 'worker-1', cwd: '/scb', command: 'claude-code go', workspaceId: 'ws-a', towerTerminalId: 'not-a-bat-tab', workspaceResolved: true })
    })

    it('--workspace unknown to the registry → passed on unmarked (renderer falls back to active, T0361)', async () => {
      const t = dispatchSetup()
      await t.invoke('terminal:create-agent-command', REMOTE, dispatch({}, { workspaceId: 'ws-gone' }))
      expect(t.emitted[0].payload).toEqual({ id: 'worker-1', cwd: '/scb', command: 'claude-code go', workspaceId: 'ws-gone' })
    })

    it('no --notify-id and no --workspace → active workspace (T0137, unchanged)', async () => {
      const t = dispatchSetup()
      await t.invoke('terminal:create-agent-command', REMOTE, dispatch({}))
      expect(t.agentWorkspaces).toEqual([undefined])
      expect(t.created[0].workspaceId).toBeUndefined()
      expect(t.emitted[0].payload).toEqual({ id: 'worker-1', cwd: '/scb', command: 'claude-code go', workspaceId: undefined })
    })

    it('reportLanding → { ok, workspace, agent } (bat-terminal.mjs prints it)', async () => {
      const t = dispatchSetup()
      const result = await t.invoke('terminal:create-agent-command', REMOTE, dispatch({ BAT_TOWER_TERMINAL_ID: 'tower-b' }, { workspaceId: 'ws-a', reportLanding: true }))
      expect(result).toEqual({
        ok: true,
        terminalId: 'worker-1',
        workspace: { id: 'ws-b', name: 'SCB專案資料', source: 'tower-terminal', requestedId: 'ws-a', mismatch: true },
        agent: { requested: 'default', id: 'codex-cli', source: 'workspace' },
      })
    })

    it('create-with-command (raw command mode) follows the tower too', async () => {
      const t = dispatchSetup()
      const result = await t.invoke('terminal:create-with-command', REMOTE, {
        id: 'raw-1', cwd: '/scb', command: 'ls', customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-b' }, workspaceId: 'ws-a', reportLanding: true,
      })
      expect(t.created[0].workspaceId).toBe('ws-b')
      expect(result).toEqual({ ok: true, terminalId: 'raw-1', workspace: { id: 'ws-b', name: 'SCB專案資料', source: 'tower-terminal', requestedId: 'ws-a', mismatch: true } })
    })

    it('a terminal a local window creates keeps the window\'s workspace (resolver not consulted)', async () => {
      const resolveDispatchWorkspace = vi.fn()
      const t = setup({ resolveDispatchWorkspace })
      await t.invoke('terminal:create-with-command', LOCAL_WINDOW, { id: 'w9', cwd: '/x', command: 'ls', customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-b' }, workspaceId: 'ws-a' })
      expect(resolveDispatchWorkspace).not.toHaveBeenCalled()
      expect(t.created[0].workspaceId).toBe('ws-a')
    })

    it('a failing resolver falls back to --workspace as given', async () => {
      const t = setup({ resolveDispatchWorkspace: async () => { throw new Error('registry unreadable') } })
      await t.invoke('terminal:create-agent-command', REMOTE, dispatch({ BAT_TOWER_TERMINAL_ID: 'tower-b' }, { workspaceId: 'ws-a' }))
      expect(t.created[0].workspaceId).toBe('ws-a')
    })
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
