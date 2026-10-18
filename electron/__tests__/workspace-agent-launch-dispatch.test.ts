// @vitest-environment node
/**
 * PLAN-040 / T0529 (D142): helper `--agent` dispatch (`terminal:create-agent-command`) uses the
 * landing workspace's effective agent and launch args — the same values the UI buttons use —
 * while the raw command mode (`terminal:create-with-command`) runs the command as given.
 *
 * Wired like electron/main.ts: real `createAgentPromptCommandBuilder`, the landing from
 * `resolveDispatchWorkspaceFromEntries` and the workspace fields from
 * `findWorkspaceAgentSettings`, both over the same fake window-registry entries.
 */
import { describe, expect, it } from 'vitest'
import {
  createAgentPromptCommandBuilder,
  registerTerminalCommandHandlers,
  type AgentCommandSettings,
} from '../terminal-command-handlers'
import {
  findWorkspaceAgentSettings,
  resolveDispatchWorkspaceFromEntries,
  type DispatchRegistryEntry,
} from '../dispatch-workspace'

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

const TOWER_A = 'tower-a'
const TOWER_B = 'tower-b'

function registry(workspaceA: Record<string, unknown>): DispatchRegistryEntry[] {
  return [{
    workspaces: [
      { id: 'ws-a', name: 'A', folderPath: '/repo/a', ...workspaceA },
      { id: 'ws-b', name: 'B', folderPath: '/repo/b' },
    ],
    terminals: [
      { id: TOWER_A, workspaceId: 'ws-a' },
      { id: TOWER_B, workspaceId: 'ws-b' },
    ],
  }]
}

function setup(entries: DispatchRegistryEntry[], settings: AgentCommandSettings | null) {
  const handlers = new Map<string, Handler>()
  const written: string[] = []
  const logs: string[] = []
  registerTerminalCommandHandlers({
    registerHandler: (channel, handler) => { handlers.set(channel, handler) },
    getPtyManager: () => ({
      isAlive: () => false,
      create: () => true,
      write: (_id: string, data: string) => { written.push(data) },
    }),
    getAllWindows: () => [],
    readPersistedSettingsSync: () => ({ shell: 'bash' }),
    buildAgentPromptCommand: createAgentPromptCommandBuilder({
      readSettings: () => settings,
      resolveWorkspaceAgentSettings: async (workspaceId) => findWorkspaceAgentSettings(entries, workspaceId),
      ensureElevationApplied: async () => {},
      resolveClaudeBaseCommand: async () => 'claude',
      logger: { warn: () => {} },
    }),
    resolveDispatchWorkspace: async (request) => resolveDispatchWorkspaceFromEntries(entries, request),
    pickWhitelistedEnv: () => ({}),
    mirrorToBatScripts: () => undefined,
    logger: { log: (...args: unknown[]) => { logs.push(args.join(' ')) }, warn: () => {} },
    setTimeout: (callback: () => void) => { callback(); return 0 },
  })
  const invoke = (channel: string, opts: Record<string, unknown>) => handlers.get(channel)!({ windowId: null }, opts)
  return { invoke, written, logs }
}

const GLOBAL: AgentCommandSettings = {
  defaultAgent: 'claude-code',
  agentCustomArgs: { 'claude-cli': '--dangerously-skip-permissions', 'codex-cli': '--yolo' },
}

const dispatch = (tower: string, agent?: string) => ({
  id: `w-${Math.random().toString(36).slice(2)}`,
  cwd: tower === TOWER_A ? '/repo/a' : '/repo/b',
  shell: '/bin/bash',
  skill: 'ct-exec',
  workorder: 'T0529',
  workspaceId: 'stale-ws',
  customEnv: { BAT_TOWER_TERMINAL_ID: tower },
  ...(agent ? { agent } : {}),
})

describe('helper --agent dispatch uses the landing workspace (T0529)', () => {
  it('--agent default: workspace agent + workspace args; another workspace follows Settings', async () => {
    const { invoke, written } = setup(registry({ defaultAgent: 'codex-cli', agentCustomArgs: { 'codex-cli': '--model gpt-5 -c x=1' } }), GLOBAL)

    await invoke('terminal:create-agent-command', dispatch(TOWER_A, 'default'))
    await invoke('terminal:create-agent-command', dispatch(TOWER_B, 'default'))

    expect(written).toEqual([
      // T0621 (C-6): a dispatched codex gets the update-check override before the custom args
      "codex -c check_for_update_on_startup=false --model gpt-5 -c x=1 '$ct-exec T0529'\r",
      "claude --dangerously-skip-permissions '/ct-exec T0529'\r",
    ])
  })

  it('--agent <id> also takes the landing workspace args (UI buttons do the same)', async () => {
    const { invoke, written } = setup(registry({ agentCustomArgs: { 'codex-cli': '--model o3' } }), GLOBAL)

    await invoke('terminal:create-agent-command', dispatch(TOWER_A, 'codex-cli'))
    await invoke('terminal:create-agent-command', dispatch(TOWER_A, 'codex')) // T0527 alias
    await invoke('terminal:create-agent-command', dispatch(TOWER_B, 'codex-cli'))

    expect(written).toEqual([
      "codex -c check_for_update_on_startup=false --model o3 '$ct-exec T0529'\r",
      "codex -c check_for_update_on_startup=false --model o3 '$ct-exec T0529'\r",
      "codex -c check_for_update_on_startup=false --yolo '$ct-exec T0529'\r",
    ])
  })

  it('an empty workspace override drops the global args', async () => {
    const { invoke, written, logs } = setup(registry({ agentCustomArgs: { 'claude-cli': '' } }), GLOBAL)
    await invoke('terminal:create-agent-command', dispatch(TOWER_A))
    expect(written).toEqual(["claude '/ct-exec T0529'\r"])
    expect(logs.some(l => l.includes('argsSource=workspace'))).toBe(true)
  })

  it('raw command mode (create-with-command) adds no args', async () => {
    const { invoke, written } = setup(registry({ agentCustomArgs: { 'codex-cli': '--model o3' } }), GLOBAL)
    await invoke('terminal:create-with-command', {
      id: 'raw-1',
      cwd: '/repo/a',
      shell: '/bin/bash',
      command: 'codex "$ct-exec T0529"',
      customEnv: { BAT_TOWER_TERMINAL_ID: TOWER_A },
    })
    expect(written).toEqual(['codex "$ct-exec T0529"\r'])
  })
})

describe('findWorkspaceAgentSettings (T0529)', () => {
  it('returns the raw fields of the workspace, null when unknown', () => {
    const entries = registry({ defaultAgent: 'codex-cli', agentCustomArgs: { 'codex-cli': '' } })
    expect(findWorkspaceAgentSettings(entries, 'ws-a')).toEqual({ defaultAgent: 'codex-cli', agentCustomArgs: { 'codex-cli': '' } })
    expect(findWorkspaceAgentSettings(entries, 'ws-b')).toEqual({ defaultAgent: undefined, agentCustomArgs: undefined })
    expect(findWorkspaceAgentSettings(entries, 'nope')).toBeNull()
    expect(findWorkspaceAgentSettings(entries, undefined)).toBeNull()
    expect(findWorkspaceAgentSettings([{ workspaces: 'bad' as unknown as unknown[] }], 'ws-a')).toBeNull()
  })
})
