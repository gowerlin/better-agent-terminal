// @vitest-environment node
/**
 * PLAN-055 B2 / T0767 (D211 P-4 a): an interrupted codex tab resumes with `codex resume` — codex's
 * own picker, filtered by the cwd. Main side: the dispatch builder's `resume` for codex-cli (BAT MCP
 * `-c` and the dispatch's update-check `-c` as for a dispatch, then `resume`, then the custom args;
 * no prompt, never `--last`) and `resumeInterruptedDispatchAgent` for a codex entry.
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
  isResumableInterruptedAgent,
  resumeInterruptedDispatchAgent,
  type InterruptedAgent,
  type ResumeCommandRequest,
} from '../interrupted-agents'
import { createBatMcpLaunchArgs, type BatMcpHost } from '../bat-mcp-launch'
import { CODEX_DISPATCH_NO_UPDATE_CHECK, createAgentPromptCommandBuilder, type AgentCommandSettings } from '../terminal-command-handlers'
import { agentRegistry } from '../agent-runtime/agent-registry'

function agent(extra: Partial<InterruptedAgent> & { terminalId: string }): InterruptedAgent {
  return { agent: 'codex-cli', claudeSessionId: null, claudeSessionName: null, launchedBy: 'tab', cwd: '/w', at: 1, ...extra }
}

describe('isResumableInterruptedAgent (T0767)', () => {
  it('claude-cli / claude-cli-worktree / codex-cli; not unknown or other agents', () => {
    expect(['claude-cli', 'claude-cli-worktree', 'codex-cli'].map(isResumableInterruptedAgent)).toEqual([true, true, true])
    expect(['unknown', 'gemini-cli', 'codex-agent', 'none'].map(isResumableInterruptedAgent)).toEqual([false, false, false, false])
  })
})

describe('resumeInterruptedDispatchAgent: codex (T0767)', () => {
  it('builds a codex resume (no session id), writes it with \\r, removes the entry; mode picker', async () => {
    const store = new InterruptedAgentsStore()
    store.record([agent({ terminalId: 'w', launchedBy: 'dispatch', workorder: 'T0767', workspaceId: 'ws', shell: 'pwsh' })])
    const writes: Array<[string, string]> = []
    const requests: ResumeCommandRequest[] = []
    const result = await resumeInterruptedDispatchAgent({
      store,
      isRunning: () => true,
      buildCommand: async (request) => {
        requests.push(request)
        return { command: 'codex -c x resume', resume: { mode: 'picker' } }
      },
      writeCommand: (id, command) => { writes.push([id, command]) },
      logger: { log: () => {} },
    }, 'w')
    expect(result).toEqual({ ok: true, mode: 'picker' })
    expect(requests).toEqual([{ agent: 'codex-cli', workspaceId: 'ws', workorder: 'T0767', terminalId: 'w', shell: 'pwsh', resume: { sessionId: null } }])
    expect(writes).toEqual([['w', 'codex -c x resume\r']])
    expect(store.has('w')).toBe(false)
  })

  it('a builder that reports no decision → codex\'s (picker), never claude\'s', async () => {
    const store = new InterruptedAgentsStore()
    store.record([agent({ terminalId: 'w', launchedBy: 'dispatch' })])
    const result = await resumeInterruptedDispatchAgent({
      store,
      isRunning: () => true,
      buildCommand: async () => ({ command: 'codex resume' }),
      writeCommand: () => {},
      logger: { log: () => {} },
    }, 'w')
    expect(result).toEqual({ ok: true, mode: 'picker' })
  })
})

describe('createAgentPromptCommandBuilder: codex resume (T0767)', () => {
  let dir: string
  let helperDir: string
  let dataDir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0767-build-'))
    helperDir = path.join(dir, 'scripts')
    dataDir = path.join(dir, 'data')
    fs.mkdirSync(helperDir, { recursive: true })
    fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '')
    fs.writeFileSync(path.join(helperDir, 'bat-hook.mjs'), '')
  })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  function builder(args: string, settings: Record<string, unknown> = {}) {
    const recorded: Array<[string, string]> = []
    const host: BatMcpHost = {
      dataDir: () => dataDir,
      helperDir: () => helperDir,
      nodeCommand: () => 'node',
      endpointReady: () => true,
      readSettings: () => settings,
      claudeSettingsFiles: () => [],
    }
    const build = createAgentPromptCommandBuilder({
      readSettings: () => ({ agentCustomArgs: { 'codex-cli': args } }) as AgentCommandSettings,
      resolveWorkspaceAgentSettings: async () => null,
      ensureElevationApplied: async () => {},
      buildLaunchCommand: (agentId, extraArgs) => agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs),
      batMcpLaunchArgs: createBatMcpLaunchArgs(host, 'dispatch'),
      codexWritesOsc: async () => true,
      recordBlockedDetection: (id, detection) => { recorded.push([id, detection]) },
      logger: { warn: vi.fn() },
    })
    return { build, recorded }
  }

  it('`resume` after BAT MCP `-c` and the update-check `-c`, before the custom args; no prompt, no --last, no session id', async () => {
    const { build, recorded } = builder('--model e2e')
    const dispatch = await build({ skill: 'ct-exec', workorder: 'T0767', agent: 'codex-cli', shellFamily: 'posix', terminalId: 'w' })
    const r = await build({ agent: 'codex-cli', workorder: 'T0767', shellFamily: 'posix', terminalId: 'w', resume: { sessionId: null } })
    expect(r).toMatchObject({ agentId: 'codex-cli', prompt: '', resume: { mode: 'picker', arg: 'resume' } })
    // the dispatch command without its prompt, `resume` inserted before the custom args
    const prompt = dispatch!.command.slice(dispatch!.command.lastIndexOf(" '$"))
    const withoutPrompt = dispatch!.command.slice(0, -prompt.length)
    expect(withoutPrompt.endsWith(' --model e2e')).toBe(true)
    expect(r?.command).toBe(`${withoutPrompt.slice(0, -' --model e2e'.length)} resume --model e2e`)
    expect(r?.command).toMatch(/^codex -c 'mcp_servers\.bat\.command=/)
    expect(r?.command).toContain(` -c ${CODEX_DISPATCH_NO_UPDATE_CHECK} resume --model e2e`)
    expect(r?.command).not.toContain('--last')
    expect(r?.command).not.toContain('ct-exec')
    expect(r?.command.split(' ').filter(p => p === 'resume')).toHaveLength(1)
    // the resumed codex is `osc` from the launch, as a dispatched one
    expect(recorded).toEqual([['w', 'osc'], ['w', 'osc']])
  })

  it('custom args that already run `resume` / `fork` → nothing added (user-args), theirs kept', async () => {
    for (const args of ['resume --all', 'resume', 'fork', '--model m resume --include-non-interactive']) {
      const { build } = builder(args)
      const r = await build({ agent: 'codex-cli', shellFamily: 'posix', terminalId: 'w', resume: { sessionId: null } })
      expect(r?.resume, args).toEqual({ mode: 'none', arg: null, reason: 'user-args' })
      expect(r?.command.endsWith(` -c ${CODEX_DISPATCH_NO_UPDATE_CHECK} ${args}`), args).toBe(true)
    }
  })

  it('BAT MCP off: no `-c mcp_servers.bat.*` and, as for any dispatch, no --no-daemon', async () => {
    const { build } = builder('', { batMcpEnabled: false })
    const r = await build({ agent: 'codex-cli', shellFamily: 'posix', terminalId: 'w', resume: { sessionId: null } })
    expect(r?.command).toBe(`codex -c ${CODEX_DISPATCH_NO_UPDATE_CHECK} resume`)
  })

  it('a session id handed in is ignored for codex (no guessed id, never --resume=)', async () => {
    const { build } = builder('')
    const r = await build({ agent: 'codex-cli', shellFamily: 'pwsh', terminalId: 'w', resume: { sessionId: '11111111-2222-4333-8444-555555555555' } })
    expect(r?.command.endsWith(' resume')).toBe(true)
    expect(r?.command).not.toContain('11111111')
    expect(r?.command).not.toContain('--resume')
  })

  it('without `resume` the codex dispatch is unchanged (prompt last, no `resume`)', async () => {
    const { build } = builder('--model e2e')
    const r = await build({ skill: 'ct-exec', workorder: 'T0767', agent: 'codex-cli', shellFamily: 'posix', terminalId: 'w' })
    expect(r?.command).toMatch(/ --model e2e '\$(ct:)?ct-exec T0767'$/)
    expect(r?.command.split(' ')).not.toContain('resume')
    expect(r?.resume).toBeUndefined()
  })
})
