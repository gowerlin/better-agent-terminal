// @vitest-environment node
/**
 * PLAN-055 B1 / T0766: the interrupted agent tabs (electron/interrupted-agents.ts) — snapshot,
 * store, the dispatch resume — the builder's `resume` option (terminal-command-handlers.ts), and
 * the interrupted session ids in `claude-sessions.json` (ClaudeSessionPersistence).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('interrupted-agents must not import electron')
})

import {
  InterruptedAgentsStore,
  buildInterruptedAgentSnapshot,
  resumeInterruptedDispatchAgent,
  type InterruptedAgent,
  type InterruptedAgentSource,
  type ResumeCommandRequest,
} from '../interrupted-agents'
import { createBatMcpLaunchArgs, type BatMcpHost } from '../bat-mcp-launch'
import {
  CLAUDE_SESSION_STORE_FILE,
  ClaudeSessionNameRecords,
  ClaudeSessionPersistence,
  readClaudeSessionStore,
  writeClaudeSessionStore,
  type ClaudeSessionPtySource,
} from '../claude-session-name-record'
import { createAgentPromptCommandBuilder, type AgentCommandSettings } from '../terminal-command-handlers'
import { agentRegistry } from '../agent-runtime/agent-registry'

const S1 = '11111111-2222-4333-8444-555555555555'
const S2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function source(extra: Partial<InterruptedAgentSource> & { terminalId: string }): InterruptedAgentSource {
  return { cwd: '/w', startedAt: null, sessionId: null, blockedDetection: 'none', ...extra }
}

describe('buildInterruptedAgentSnapshot', () => {
  it('lists agent tabs only: an agent preset, an agentStarted or a session id; plain shells are left out', () => {
    const snapshot = buildInterruptedAgentSnapshot([
      source({ terminalId: 'claude', agentPreset: 'claude-cli', sessionId: S1, startedAt: 5, blockedDetection: 'hook', workspaceId: 'ws', shell: 'pwsh.exe' }),
      source({ terminalId: 'shell' }),
      source({ terminalId: 'none-preset', agentPreset: 'none' }),
      source({ terminalId: 'typed-claude', sessionId: S2, startedAt: 1, blockedDetection: 'hook' }),
      source({ terminalId: 'codex-osc', startedAt: 2, blockedDetection: 'osc' }),
      source({ terminalId: 'codex-preset', agentPreset: 'codex-cli' }),
      source({ terminalId: 'started-unknown', startedAt: 3 }),
    ], { nameOf: id => (id === 'claude' ? 'ws · abc123' : null), now: 42 })
    expect(snapshot.map(a => [a.terminalId, a.agent, a.claudeSessionId])).toEqual([
      ['claude', 'claude-cli', S1],
      ['typed-claude', 'claude-cli', S2],
      ['codex-osc', 'codex-cli', null],
      ['codex-preset', 'codex-cli', null],
      ['started-unknown', 'unknown', null],
    ])
    expect(snapshot[0]).toEqual({
      terminalId: 'claude', workspaceId: 'ws', agent: 'claude-cli', claudeSessionId: S1, claudeSessionName: 'ws · abc123',
      launchedBy: 'tab', cwd: '/w', shell: 'pwsh.exe', at: 42,
    })
  })

  it('a work order or a Tower id → dispatch; a role is kept; a malformed session id is dropped', () => {
    const [worker, tower] = buildInterruptedAgentSnapshot([
      source({ terminalId: 'w', agentPreset: 'claude-cli', workorder: 'T0766', towerTerminalId: 't', sessionId: 'not-a-uuid' }),
      source({ terminalId: 't', agentPreset: 'claude-cli', role: 'tower' }),
    ], { nameOf: () => null, now: 1 })
    expect(worker).toMatchObject({ launchedBy: 'dispatch', workorder: 'T0766', towerTerminalId: 't', claudeSessionId: null })
    expect(tower).toMatchObject({ launchedBy: 'tab', role: 'tower' })
  })
})

function agent(extra: Partial<InterruptedAgent> & { terminalId: string }): InterruptedAgent {
  return { agent: 'claude-cli', claudeSessionId: null, claudeSessionName: null, launchedBy: 'tab', cwd: '/w', at: 1, ...extra }
}

describe('InterruptedAgentsStore', () => {
  it('record / list / remove, with a change event each time; session ids for claude-sessions.json', () => {
    const logs: string[] = []
    const store = new InterruptedAgentsStore({ log: m => logs.push(m) })
    const events: string[] = []
    store.onChange(reason => events.push(reason))
    store.record([agent({ terminalId: 'a', claudeSessionId: S1 }), agent({ terminalId: 'b', agent: 'codex-cli' })])
    expect(store.list().map(a => a.terminalId)).toEqual(['a', 'b'])
    expect(store.interruptedSessions()).toEqual([{ terminalId: 'a', sessionId: S1, at: 1 }])
    expect(store.remove('a', 'resumed')).toBe(true)
    expect(store.remove('a', 'resumed')).toBe(false)
    expect(events).toEqual(['recovery', 'update'])
    // logs never hold a full session id
    expect(logs.join('\n')).toContain('session=11111111')
    expect(logs.join('\n')).not.toContain(S1)
  })

  it('a second recovery before the user acted keeps the session id the first one captured', () => {
    const store = new InterruptedAgentsStore()
    store.record([agent({ terminalId: 'a', claudeSessionId: S1, claudeSessionName: 'n' })])
    store.record([agent({ terminalId: 'a', claudeSessionId: null, at: 2 })])
    expect(store.get('a')).toMatchObject({ claudeSessionId: S1, claudeSessionName: 'n', at: 2 })
    // a new session id wins
    store.record([agent({ terminalId: 'a', claudeSessionId: S2 })])
    expect(store.get('a')?.claudeSessionId).toBe(S2)
  })

  it('list / get return copies; a throwing listener does not break the store', () => {
    const store = new InterruptedAgentsStore()
    store.onChange(() => { throw new Error('x') })
    store.record([agent({ terminalId: 'a' })])
    store.list()[0].cwd = 'changed'
    expect(store.get('a')?.cwd).toBe('/w')
  })
})

describe('resumeInterruptedDispatchAgent', () => {
  function deps(store: InterruptedAgentsStore, overrides: Partial<Parameters<typeof resumeInterruptedDispatchAgent>[0]> = {}) {
    const writes: Array<[string, string]> = []
    const requests: ResumeCommandRequest[] = []
    return {
      writes,
      requests,
      deps: {
        store,
        isRunning: () => true,
        buildCommand: async (request: ResumeCommandRequest) => {
          requests.push(request)
          return { command: `claude --resume=${request.resume.sessionId}`, resume: { mode: 'session' as const } }
        },
        writeCommand: (id: string, command: string) => { writes.push([id, command]) },
        logger: { log: () => {} },
        ...overrides,
      },
    }
  }

  it('builds with the entry (agent, workspace, work order, shell, session id, launch name), writes it with \\r, removes the entry', async () => {
    const store = new InterruptedAgentsStore()
    store.record([agent({ terminalId: 'w', launchedBy: 'dispatch', workorder: 'T0766', workspaceId: 'ws', shell: 'bash', claudeSessionId: S1, claudeSessionName: 'ws · Worker · T0766' })])
    const { deps: d, writes, requests } = deps(store)
    expect(await resumeInterruptedDispatchAgent(d, 'w')).toEqual({ ok: true, mode: 'session' })
    expect(requests).toEqual([{ agent: 'claude-cli', workspaceId: 'ws', workorder: 'T0766', terminalId: 'w', shell: 'bash', resume: { sessionId: S1, sessionName: 'ws · Worker · T0766' } }])
    expect(writes).toEqual([['w', `claude --resume=${S1}\r`]])
    expect(store.has('w')).toBe(false)
  })

  it('refuses: unknown id, an unknown agent, a PTY no longer running, a failed build — nothing written, entry kept', async () => {
    const store = new InterruptedAgentsStore()
    store.record([agent({ terminalId: 'c', agent: 'unknown' }), agent({ terminalId: 'w', launchedBy: 'dispatch' })])
    const { deps: d, writes } = deps(store)
    expect(await resumeInterruptedDispatchAgent(d, 'nope')).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await resumeInterruptedDispatchAgent(d, 42)).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await resumeInterruptedDispatchAgent(d, 'c')).toMatchObject({ ok: false, code: 'NOT_RESUMABLE' })
    expect(await resumeInterruptedDispatchAgent({ ...d, isRunning: () => false }, 'w')).toMatchObject({ ok: false, code: 'NOT_RUNNING' })
    expect(await resumeInterruptedDispatchAgent({ ...d, buildCommand: async () => null }, 'w')).toMatchObject({ ok: false, code: 'BUILD_FAILED' })
    expect(writes).toEqual([])
    expect(store.has('w')).toBe(true)
  })
})

describe('claude-resume-args (T0766)', () => {
  it('its session id grammar is the hook handler\'s (terminal-blocked-state)', async () => {
    const { CLAUDE_RESUME_SESSION_ID_PATTERN } = await import('../../src/lib/claude-resume-args')
    const { CLAUDE_SESSION_ID_PATTERN } = await import('../terminal-blocked-state')
    expect(CLAUDE_RESUME_SESSION_ID_PATTERN.source).toBe(CLAUDE_SESSION_ID_PATTERN.source)
    expect(CLAUDE_RESUME_SESSION_ID_PATTERN.flags).toBe(CLAUDE_SESSION_ID_PATTERN.flags)
  })
})

describe('channels (T0766): renderer IPC only, never a helper / remote channel', () => {
  it('ipcMain.handle in main.ts; not in PROXIED_CHANNELS, not registered through registerHandler, not a helper role', async () => {
    const { PROXIED_CHANNELS } = await import('../remote/protocol')
    const { HELPER_CHANNEL_ROLES } = await import('../remote/helper-capability')
    const main = fs.readFileSync(path.join(__dirname, '../main.ts'), 'utf8')
    for (const channel of ['terminal:resume-interrupted-agent', 'terminal:dismiss-interrupted-agent', 'terminal-server:query-interrupted-agents']) {
      expect(main, channel).toContain(`ipcMain.handle('${channel}'`)
      expect(PROXIED_CHANNELS.has(channel), channel).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(HELPER_CHANNEL_ROLES, channel), channel).toBe(false)
      expect(main, channel).not.toContain(`registerHandler('${channel}'`)
    }
  })
})

describe('createAgentPromptCommandBuilder: resume (T0766)', () => {
  let dir: string
  let helperDir: string
  let dataDir: string
  const BASE = "& 'C:\\BAT\\claude.exe'"

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0766-build-'))
    helperDir = path.join(dir, 'scripts')
    dataDir = path.join(dir, 'data')
    fs.mkdirSync(helperDir, { recursive: true })
    fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '')
    fs.writeFileSync(path.join(helperDir, 'bat-hook.mjs'), '')
  })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  function builder(args = '--dangerously-skip-permissions') {
    const names: Array<[string, string | null]> = []
    const host: BatMcpHost = {
      dataDir: () => dataDir,
      helperDir: () => helperDir,
      nodeCommand: () => 'node',
      endpointReady: () => true,
      readSettings: () => ({}),
      claudeSettingsFiles: () => [],
      recordClaudeSessionName: (id, record) => { names.push([id, record.name]) },
    }
    const build = createAgentPromptCommandBuilder({
      readSettings: () => ({ agentCustomArgs: { 'claude-cli': args } }) as AgentCommandSettings,
      resolveWorkspaceAgentSettings: async () => null,
      ensureElevationApplied: async () => {},
      buildLaunchCommand: (agentId, extraArgs) => agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs),
      resolveClaudeBaseCommand: async () => BASE,
      batMcpLaunchArgs: createBatMcpLaunchArgs(host, 'dispatch'),
      claudeNameSupport: async () => ({ inject: true, runtime: 'embedded' }),
      logger: { warn: vi.fn() },
    })
    return { build, names }
  }

  it('`--resume=<id>` after BAT MCP / hooks / --name=, before the custom args; no prompt; the launch name kept', async () => {
    const { build, names } = builder()
    const r = await build({ agent: 'claude-cli', workorder: 'T0766', shellFamily: 'pwsh', terminalId: 'w', resume: { sessionId: S1, sessionName: 'ws · Worker · T0766' } })
    // The temp data dir is quoted only when it needs it: Windows paths (`C:\…`) are, Linux `/tmp/…` paths are not (CI ubuntu).
    expect(r?.command).toMatch(new RegExp(`^& 'C:\\\\BAT\\\\claude\\.exe' ('--mcp-config=[^']+'|--mcp-config=\\S+) ('--settings=[^']+'|--settings=\\S+) '--name=ws · Worker · T0766' --resume=${S1} --dangerously-skip-permissions$`))
    expect(r?.command).not.toContain('--fork-session')
    expect(r?.command).not.toContain('/ct-exec')
    expect(r).toMatchObject({ agentId: 'claude-cli', prompt: '', resume: { mode: 'session', arg: `--resume=${S1}` } })
    expect(names).toEqual([['w', 'ws · Worker · T0766']])
  })

  it('no recorded name → the Worker name from the work order; unknown session id → --resume (claude picker)', async () => {
    const { build } = builder()
    const r = await build({ agent: 'claude-cli', workorder: 'T0766', shellFamily: 'posix', terminalId: 'w', resume: { sessionId: null } })
    expect(r?.command).toMatch(/ '--name=BAT · Worker · T0766' --resume --dangerously-skip-permissions$/)
    expect(r?.resume).toEqual({ mode: 'picker', arg: '--resume' })
  })

  it('custom args that choose the session (-c / --resume / --session-id …) → nothing added (user-args)', async () => {
    for (const args of ['-c', '--continue', '--resume x', '--resume=x', '-r', '--session-id 1', '--from-pr 3', '--teleport', '-cr']) {
      const { build } = builder(args)
      const r = await build({ agent: 'claude-cli', shellFamily: 'posix', terminalId: 'w', resume: { sessionId: S1 } })
      expect(r?.resume, args).toEqual({ mode: 'none', arg: null, reason: 'user-args' })
      expect(r?.command, args).not.toContain(`--resume=${S1}`)
      expect(r?.command.endsWith(` ${args}`), args).toBe(true)
    }
  })

  it('claude-cli / codex-cli only (T0767): a resume build of another agent is refused', async () => {
    const { build } = builder()
    expect(await build({ agent: 'gemini-cli', shellFamily: 'posix', terminalId: 'g', resume: { sessionId: null } })).toBeNull()
  })

  it('without `resume` the dispatch command is unchanged (prompt last, no --resume)', async () => {
    const { build } = builder()
    const r = await build({ skill: 'ct-exec', workorder: 'T0766', agent: 'claude-cli', shellFamily: 'posix', terminalId: 'w' })
    expect(r?.command).toMatch(/ --dangerously-skip-permissions '\/ct-exec T0766'$/)
    expect(r?.command).not.toContain('--resume')
    expect(r?.resume).toBeUndefined()
  })
})

describe('claude-sessions.json: interrupted session ids (T0766)', () => {
  let dir: string
  let file: string
  let running: Map<string, string | null>
  let interrupted: Array<{ terminalId: string; sessionId: string; at: number }>
  const pm: ClaudeSessionPtySource = {
    listTerminalIds: () => [...running.keys()],
    getClaudeSessionId: id => running.get(id) ?? null,
    restoreClaudeSessionId: () => true,
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0766-store-'))
    file = path.join(dir, CLAUDE_SESSION_STORE_FILE)
    running = new Map()
    interrupted = []
  })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  function persistence() {
    const log = { log: vi.fn(), warn: vi.fn() }
    const p = new ClaudeSessionPersistence({ records: new ClaudeSessionNameRecords(), getPtyManager: () => pm, log, getInterrupted: () => interrupted })
    return { p, log }
  }

  it('after a recovery (tracker cleared) the session id stays in the file as an interrupted entry until it leaves the list', () => {
    const { p } = persistence()
    p.load(file)
    running.set('a', S1)
    p.persist()
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ version: 1, sessions: [{ terminalId: 'a', name: null, sessionId: S1 }] })
    // the recovery: snapshot → list; clearAll → the running PTY has no session id any more
    interrupted = [{ terminalId: 'a', sessionId: S1, at: 7 }]
    running.set('a', null)
    p.persist()
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ version: 1, sessions: [], interrupted: [{ terminalId: 'a', sessionId: S1, at: 7 }] })
    // resumed / dismissed / closed / new session-start → gone
    interrupted = []
    p.persist()
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ version: 1, sessions: [] })
  })

  it('a previous process\'s interrupted entries are not restored on load (D211 P-5) and are dropped from the file', () => {
    writeClaudeSessionStore(file, [{ terminalId: 'b', name: 'n', sessionId: S2 }], [{ terminalId: 'a', sessionId: S1, at: 7 }])
    expect(readClaudeSessionStore(file)).toMatchObject({ status: 'ok', interrupted: 1, sessions: [{ terminalId: 'b' }] })
    const { p, log } = persistence()
    p.load(file)
    expect(log.log.mock.calls.flat().join('\n')).toContain('1 interrupted entry of the previous process not restored')
    const written = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(written.interrupted).toBeUndefined()
    expect(written.sessions).toEqual([{ terminalId: 'b', name: 'n', sessionId: S2 }]) // still pending
  })

  it('invalid interrupted entries are not written; without any, the file is the pre-T0766 format', () => {
    interrupted = [{ terminalId: 'bad id!', sessionId: S1, at: 1 }, { terminalId: 'a', sessionId: 'nope', at: 1 }]
    const { p } = persistence()
    p.load(file)
    running.set('a', S1)
    p.persist()
    expect(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')))).toEqual(['version', 'sessions'])
  })
})
