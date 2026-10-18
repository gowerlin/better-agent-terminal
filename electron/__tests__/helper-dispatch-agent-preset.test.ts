// @vitest-environment node
/**
 * BUG-155 / T0639: a Worker PTY a helper dispatches in agent mode (`terminal:create-agent-command`,
 * `--skill` / `--workorder` / `--prompt`) records the resolved agent as its `agentPreset` — the
 * value a BAT tab of the same agent is created with. Before T0639 only the tab title got it.
 *
 * - `terminal:whoami` `agent` (T0582 contract field `agent?`): claude-cli / codex-cli
 * - claude-cli Worker: `claudeCliUpdateGuardEnv` applies — embedded runtime `DISABLE_UPDATES=1`,
 *   system runtime none (BUG-059 / T0372 unchanged)
 * - codex-cli Worker: no env key beyond what a raw-command PTY gets
 * - raw command mode (`terminal:create-with-command`) records no preset, whatever its payload says
 * - `restart` keeps it (`PtyManager.restart` re-uses `instance.agentPreset`; the Terminal Server
 *   recovery rebuild is covered by pty-manager-helper-env.test.ts)
 *
 * Real PtyManager against the fake node-pty seeding of pty-manager-helper-env.test.ts.
 */
import { createRequire } from 'module'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-command-handlers / pty-manager must not import electron')
})

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { configureRuntimeRouter as ConfigureRuntimeRouter } from '../claude-runtime-router'
import type { HandlerContext } from '../remote/handler-registry'
import { HelperCapabilityRegistry } from '../remote/helper-capability'
import { registerTerminalCommandHandlers, type BuiltAgentCommand } from '../terminal-command-handlers'
import { registerTerminalQueryHandlers } from '../terminal-query-handlers'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: { env: Record<string, string> }) => new FakePty())
const CWD = os.tmpdir()
let PtyManager: typeof PtyManagerType
let configureRuntimeRouter: typeof ConfigureRuntimeRouter

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  ;({ configureRuntimeRouter } = await import('../claude-runtime-router'))
})

type Handler = (ctx: HandlerContext, ...args: unknown[]) => Promise<unknown> | unknown

let dataDir: string
let savedDisableUpdates: string | undefined
const managers: PtyManagerType[] = []

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0639-pty-'))
  // the guard must come from the preset, never from the env this test runs in
  savedDisableUpdates = process.env.DISABLE_UPDATES
  delete process.env.DISABLE_UPDATES
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  configureRuntimeRouter({})
  fs.rmSync(dataDir, { recursive: true, force: true })
  if (savedDisableUpdates === undefined) delete process.env.DISABLE_UPDATES
  else process.env.DISABLE_UPDATES = savedDisableUpdates
  vi.restoreAllMocks()
})

/** `claudeRuntime.mode` in the runtime router's settings.json (no file = default `embedded`). */
function useClaudeRuntime(mode: 'embedded' | 'system') {
  fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ claudeRuntime: { mode } }))
  configureRuntimeRouter({ getDataDir: () => dataDir })
}

const AGENT_COMMANDS: Record<string, BuiltAgentCommand> = {
  'claude-cli': { command: 'claude "/ct-exec T0639"', agentId: 'claude-cli', prompt: '/ct-exec T0639', prefixNormalized: false },
  'codex-cli': { command: 'codex "$ct-exec T0639"', agentId: 'codex-cli', prompt: '$ct-exec T0639', prefixNormalized: false },
}

function setup() {
  const registry = new HelperCapabilityRegistry()
  const manager = new PtyManager({
    emit: vi.fn(),
    dataDir,
    helperEnv: (id, customEnv) => {
      registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined })
      return {}
    },
    onPtyExit: id => { registry.revokeTerminal(id) },
  })
  managers.push(manager)
  const handlers = new Map<string, Handler>()
  const registerHandler = (channel: string, handler: Handler) => { handlers.set(channel, handler) }
  registerTerminalCommandHandlers({
    registerHandler,
    getPtyManager: () => manager,
    getAllWindows: () => [],
    readPersistedSettingsSync: () => null,
    buildAgentPromptCommand: async opts => AGENT_COMMANDS[opts.agent ?? 'claude-cli'] ?? null,
    isKnownAgent: agentId => agentId in AGENT_COMMANDS,
    pickWhitelistedEnv: env => ({ ...(env ?? {}) }),
    mirrorToBatScripts: () => undefined,
    logger: { log: () => undefined, warn: () => undefined },
    // the dispatch command is not typed into the fake PTY
    setTimeout: () => 0,
  })
  const queries = registerTerminalQueryHandlers({
    registerHandler,
    getPtyManager: () => manager,
    isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
    knownSecrets: () => [],
    logger: { log: () => undefined },
    mirrorToBatScripts: () => undefined,
  })
  const helper: HandlerContext = { windowId: null, connectionId: 'helper-tower' }
  const call = (channel: string, ...args: unknown[]) => handlers.get(channel)!(helper, ...args)
  const whoami = (terminalId: string) => handlers.get('terminal:whoami')!({ windowId: null, connectionId: 'client' }, { terminalId }) as Record<string, unknown>
  const envOf = (terminalId: string): Record<string, string> => {
    const index = ptySpawn.mock.calls.findIndex(([, , opts]) => opts.env.BAT_TERMINAL_ID === terminalId)
    expect(index).toBeGreaterThanOrEqual(0)
    return ptySpawn.mock.calls[index][2].env
  }
  return { manager, call, whoami, envOf, queries }
}

const WORKER_ENV = { MSYS_NO_PATHCONV: '1', BAT_TOWER_TERMINAL_ID: 'tower-1', CT_MODE: 'yolo', CT_INTERACTIVE: '0' }
const dispatch = (id: string, agent: string) => ({ id, cwd: CWD, agent, skill: 'ct-exec', workorder: 'T0639', customEnv: WORKER_ENV })

describe('helper agent-mode dispatch records agentPreset (BUG-155 / T0639)', () => {
  it('claude-cli Worker: whoami.agent = claude-cli; embedded runtime → DISABLE_UPDATES=1', async () => {
    const h = setup()
    useClaudeRuntime('embedded')
    expect(await h.call('terminal:create-agent-command', dispatch('w-claude', 'claude-cli'))).toBe(true)
    expect(h.manager.getAgentPreset('w-claude')).toBe('claude-cli')
    expect(h.whoami('w-claude')).toMatchObject({ ok: true, terminalId: 'w-claude', role: 'worker', agent: 'claude-cli' })
    expect(h.envOf('w-claude')).toMatchObject({ ...WORKER_ENV, DISABLE_AUTOUPDATER: '1', DISABLE_UPDATES: '1' })
    h.queries.dispose()
  })

  it('claude-cli Worker, system runtime: no DISABLE_UPDATES (BUG-059: system is never guarded)', async () => {
    const h = setup()
    useClaudeRuntime('system')
    expect(await h.call('terminal:create-agent-command', dispatch('w-claude-sys', 'claude-cli'))).toBe(true)
    expect(h.whoami('w-claude-sys')).toMatchObject({ agent: 'claude-cli' })
    const env = h.envOf('w-claude-sys')
    expect(env.DISABLE_AUTOUPDATER).toBe('1')
    expect(env).not.toHaveProperty('DISABLE_UPDATES')
    h.queries.dispose()
  })

  it('codex-cli Worker: whoami.agent = codex-cli; the env has no key a raw-command PTY lacks', async () => {
    const h = setup()
    useClaudeRuntime('embedded')
    expect(await h.call('terminal:create-agent-command', dispatch('w-codex', 'codex-cli'))).toBe(true)
    expect(await h.call('terminal:create-with-command', { id: 'w-raw', cwd: CWD, command: 'codex', customEnv: WORKER_ENV })).toBe(true)
    expect(h.manager.getAgentPreset('w-codex')).toBe('codex-cli')
    expect(h.whoami('w-codex')).toMatchObject({ ok: true, role: 'worker', agent: 'codex-cli' })
    const codexEnv = h.envOf('w-codex')
    expect(codexEnv).not.toHaveProperty('DISABLE_UPDATES')
    expect(Object.keys(codexEnv).sort()).toEqual(Object.keys(h.envOf('w-raw')).sort())
    h.queries.dispose()
  })

  it('raw command mode records no preset, even when its payload names an agent', async () => {
    const h = setup()
    useClaudeRuntime('embedded')
    const raw = { id: 'w-raw', cwd: CWD, command: 'claude', customEnv: WORKER_ENV, agent: 'claude-cli', agentPreset: 'claude-cli' }
    expect(await h.call('terminal:create-with-command', raw)).toBe(true)
    expect(h.manager.getAgentPreset('w-raw')).toBeUndefined()
    expect(h.whoami('w-raw')).not.toHaveProperty('agent')
    expect(h.envOf('w-raw')).not.toHaveProperty('DISABLE_UPDATES')
    h.queries.dispose()
  })

  it('restart keeps the preset and the claude-cli update guard', async () => {
    const h = setup()
    useClaudeRuntime('embedded')
    expect(await h.call('terminal:create-agent-command', dispatch('w-restart', 'claude-cli'))).toBe(true)
    const first = h.envOf('w-restart')
    expect(h.manager.restart('w-restart', CWD)).toBe(true)
    expect(h.manager.getAgentPreset('w-restart')).toBe('claude-cli')
    expect(h.whoami('w-restart')).toMatchObject({ agent: 'claude-cli' })
    const restarted = ptySpawn.mock.calls[ptySpawn.mock.calls.length - 1][2].env
    expect(restarted.DISABLE_UPDATES).toBe('1')
    expect(restarted).toEqual(first)
    h.queries.dispose()
  })
})
