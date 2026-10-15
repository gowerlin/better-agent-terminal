// T0539: `sourceTerminalId` in the dispatch logs (`[remote][terminal] … source=` and the
// bat-scripts.log `ipc-invoke` / `terminal-created` events) is the dispatching Tower — the
// `BAT_TOWER_TERMINAL_ID` bat-terminal.mjs sends for `--notify-id`. Before T0539 it read
// `customEnv.BAT_TERMINAL_ID`, which the helper never sends, so it was always empty.
// Diagnostics only: the Worker PTY gets exactly the customEnv the helper sent.

import { describe, expect, it } from 'vitest'

import { registerTerminalCommandHandlers } from '../terminal-command-handlers'

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

function setup() {
  const handlers = new Map<string, Handler>()
  const mirrored: Array<{ event: string; payload: Record<string, unknown> }> = []
  const logs: string[] = []
  const created: Array<Record<string, unknown>> = []
  registerTerminalCommandHandlers({
    registerHandler(channel, handler) {
      handlers.set(channel, handler)
    },
    getPtyManager() {
      return {
        isAlive: () => false,
        create: (opts: Record<string, unknown>) => { created.push(opts); return true },
        write: () => undefined,
      }
    },
    getAllWindows: () => [],
    readPersistedSettingsSync: () => null,
    buildAgentPromptCommand: async () => ({ command: 'claude "/ct-exec T0539"', agentId: 'claude-cli', prompt: '/ct-exec T0539', prefixNormalized: false }),
    pickWhitelistedEnv: (env) => ({ ...(env ?? {}) }),
    mirrorToBatScripts: (event, payload) => { mirrored.push({ event, payload }) },
    logger: { log: (...a: unknown[]) => { logs.push(a.join(' ')) }, warn: () => undefined },
    setTimeout: (callback: () => void) => { callback(); return 0 },
  })
  return { handlers, mirrored, logs, created }
}

const WORKER_ENV = { MSYS_NO_PATHCONV: '1', BAT_TOWER_TERMINAL_ID: 'tower-1', CT_MODE: 'yolo', CT_INTERACTIVE: '0' }

describe('dispatch log sourceTerminalId (T0539)', () => {
  it.each([
    ['terminal:create-agent-command', { id: 'w-1', cwd: 'D:\repo', skill: 'ct-exec', workorder: 'T0539', customEnv: WORKER_ENV }],
    ['terminal:create-with-command', { id: 'w-1', cwd: 'D:\repo', command: 'claude "/ct-exec T0539"', customEnv: WORKER_ENV }],
  ])('%s logs the Tower from --notify-id; the Worker env is what the helper sent', async (channel, opts) => {
    const { handlers, mirrored, logs, created } = setup()
    await handlers.get(channel)!({ windowId: null }, opts)

    const events = mirrored.filter(m => m.event === 'ipc-invoke' || m.event === 'terminal-created')
    expect(events.map(m => m.event)).toEqual(['ipc-invoke', 'terminal-created'])
    for (const m of events) expect(m.payload.sourceTerminalId).toBe('tower-1')
    expect(logs.some(l => l.includes('channel=terminal:create-with-command id=w-1') && l.includes('source=tower-1'))).toBe(true)

    expect(created).toHaveLength(1)
    expect(created[0].customEnv).toEqual(WORKER_ENV)
  })

  it('no --notify-id → no source (n/a), nothing added to the env', async () => {
    const { handlers, mirrored, logs, created } = setup()
    await handlers.get('terminal:create-with-command')!({ windowId: null }, { id: 'w-2', cwd: 'D:\repo', command: 'echo', customEnv: { MSYS_NO_PATHCONV: '1' } })
    expect(mirrored.find(m => m.event === 'ipc-invoke')?.payload.sourceTerminalId).toBeUndefined()
    expect(logs.some(l => l.includes('id=w-2') && l.includes('source=n/a'))).toBe(true)
    expect(created[0].customEnv).toEqual({ MSYS_NO_PATHCONV: '1' })
  })

  it('bat-terminal.mjs sends the Tower as BAT_TOWER_TERMINAL_ID and never adds its own BAT_TERMINAL_ID to customEnv', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const helper = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'bat-terminal.mjs'), 'utf8')
    expect(helper).toContain('BAT_TOWER_TERMINAL_ID: notifyId')
    expect(helper).not.toMatch(/customEnv[^\n]*BAT_TERMINAL_ID:/)
  })
})
