// @vitest-environment node
/**
 * T0431 (PLAN-036 P3 / K): `buildAgentPromptCommand` moved from electron/main.ts to
 * the electron-free `createAgentPromptCommandBuilder` (electron/terminal-command-handlers.ts)
 * so headless can build the same command. Electron output must not change:
 *   - a matrix compared against the pre-T0431 main.ts body (`legacyBuildAgentPromptCommand`
 *     below, copied verbatim; only the module globals became the same deps)
 *   - golden strings pinning the exact Electron commands
 *   - headless deps: `<dataDir>/settings.json` only, no workspace default agent
 */
import { describe, expect, it, vi } from 'vitest'
import { agentRegistry } from '../agent-runtime/agent-registry'
import { readHeadlessTerminalSettings } from '../remote/headless-entry'
import {
  createAgentPromptCommandBuilder,
  type AgentCommandSettings,
  type AgentPromptCommandDeps,
  type AgentPromptCommandOptions,
  type BuiltAgentCommand,
} from '../terminal-command-handlers'
import { quoteArgForShell, type ShellFamily } from '../../src/utils/shell-quote'

const CLAUDE_BASE = '"C:\\Program Files\\BAT\\claude.exe"'

// ── pre-T0431 electron/main.ts, verbatim apart from globals → deps ──
function legacyToTerminalDrivenAgentId(agentId: string): string {
  if (agentId === 'claude-code-worktree') return 'claude-cli-worktree'
  if (agentId === 'claude-code' || agentId === 'claude-code-v2') return 'claude-cli'
  if (agentId === 'codex-agent' || agentId === 'codex-agent-worktree') return 'codex-cli'
  return agentId
}
function legacyIsCodexAgentId(agentId: string): boolean {
  return agentId === 'codex-cli' || agentId === 'codex-agent' || agentId === 'codex-agent-worktree'
}
const LEGACY_WORKORDER_ID_PATTERN = /^(?:[A-Z]{2,4}-)?T\d+$/
function legacyBuildControlTowerSkillPrompt(agentId: string, skill: string, workorder: string): string | null {
  if (!/^(ct-exec|ct-done)$/.test(skill) || !LEGACY_WORKORDER_ID_PATTERN.test(workorder)) return null
  const prefix = legacyIsCodexAgentId(agentId) ? '$' : '/'
  return `${prefix}${skill} ${workorder}`
}
function legacyNormalizeControlTowerPromptForAgent(agentId: string, prompt: string): { prompt: string; normalized: boolean } {
  if (!legacyIsCodexAgentId(agentId) || !prompt.startsWith('/ct-')) {
    return { prompt, normalized: false }
  }
  return { prompt: `$${prompt.slice(1)}`, normalized: true }
}
async function legacyBuildAgentPromptCommand(deps: Required<AgentPromptCommandDeps>, opts: AgentPromptCommandOptions): Promise<BuiltAgentCommand | null> {
  const settings = deps.readSettings()
  const workspaceAgent = opts.agent && opts.agent !== 'default'
    ? null
    : await deps.resolveWorkspaceDefaultAgent(opts.workspaceId)
  const requestedAgent = opts.agent && opts.agent !== 'default'
    ? opts.agent
    : (workspaceAgent || settings?.defaultAgent || 'claude-code')
  const agentId = legacyToTerminalDrivenAgentId(requestedAgent)
  const extraArgs = settings?.agentCustomArgs?.[agentId] || settings?.agentCustomArgs?.[requestedAgent] || ''

  await deps.ensureElevationApplied()
  let baseCommand = deps.buildLaunchCommand(agentId, extraArgs)

  if (!baseCommand && (agentId === 'claude-cli' || agentId === 'claude-cli-worktree')) {
    baseCommand = await deps.resolveClaudeBaseCommand(opts.shellFamily)
  }

  if (!baseCommand) {
    deps.logger.warn(`[agent-command] cannot build launch command for agent=${requestedAgent} resolved=${agentId}`)
    return null
  }

  const prompt = opts.skill && opts.workorder
    ? legacyBuildControlTowerSkillPrompt(agentId, opts.skill, opts.workorder)
    : opts.prompt
  if (!prompt) {
    deps.logger.warn(`[agent-command] invalid prompt payload for agent=${requestedAgent} resolved=${agentId} skill=${opts.skill ?? 'n/a'} workorder=${opts.workorder ?? 'n/a'}`)
    return null
  }

  const normalized = legacyNormalizeControlTowerPromptForAgent(agentId, prompt)
  const commandWithArgs = extraArgs.trim() ? `${baseCommand} ${extraArgs.trim()}` : baseCommand
  return {
    command: `${commandWithArgs} ${quoteArgForShell(normalized.prompt, opts.shellFamily ?? 'posix')}`,
    agentId,
    prompt: normalized.prompt,
    prefixNormalized: normalized.normalized,
  }
}
// ── end of the pre-T0431 copy ──

function electronLikeDeps(settings: AgentCommandSettings | null, workspaceAgents: Record<string, string> = {}): Required<AgentPromptCommandDeps> {
  return {
    readSettings: () => settings,
    resolveWorkspaceDefaultAgent: async (workspaceId) => (workspaceId && workspaceAgents[workspaceId]) || null,
    ensureElevationApplied: async () => {},
    buildLaunchCommand: (agentId, extraArgs) => agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs),
    resolveClaudeBaseCommand: async () => CLAUDE_BASE,
    logger: { warn: vi.fn() },
  }
}

const SETTINGS_MATRIX: Array<[string, AgentCommandSettings | null]> = [
  ['no settings file', null],
  ['defaultAgent codex + custom args', {
    defaultAgent: 'codex-cli',
    agentCustomArgs: { 'claude-cli': '--dangerously-skip-permissions', 'codex-cli': '  --yolo  ' },
  }],
  ['custom args keyed by requested agent', { agentCustomArgs: { 'claude-code': '--model opus' } }],
]

const OPTS_MATRIX: AgentPromptCommandOptions[] = [
  { skill: 'ct-exec', workorder: 'T0431' },
  { skill: 'ct-done', workorder: 'CP-T0113', agent: 'codex-cli' },
  { skill: 'ct-exec', workorder: 'T0431', agent: 'claude-code-worktree', shellFamily: 'pwsh' },
  { skill: 'bogus', workorder: 'T0431' },
  { skill: 'ct-exec', workorder: 'not-an-id' },
  { prompt: '/ct-exec T0431', agent: 'codex-agent', shellFamily: 'cmd' },
  { prompt: "say 'hi' & exit", agent: 'claude-cli', shellFamily: 'posix' },
  { prompt: 'plain', agent: 'default', workspaceId: 'ws-codex' },
  { prompt: 'plain', workspaceId: 'ws-unknown', shellFamily: 'pwsh' },
  { prompt: 'plain', agent: 'no-such-agent' },
  {},
]

describe('createAgentPromptCommandBuilder — Electron output unchanged (T0431)', () => {
  for (const [label, settings] of SETTINGS_MATRIX) {
    it(`matches the pre-T0431 main.ts implementation: ${label}`, async () => {
      const deps = electronLikeDeps(settings, { 'ws-codex': 'codex-agent' })
      const build = createAgentPromptCommandBuilder(deps)
      for (const opts of OPTS_MATRIX) {
        expect(await build(opts), JSON.stringify(opts)).toEqual(await legacyBuildAgentPromptCommand(deps, opts))
      }
    })
  }

  it.each([
    [{ skill: 'ct-exec', workorder: 'T0431' }, `${CLAUDE_BASE} --dangerously-skip-permissions '/ct-exec T0431'`, false],
    [{ skill: 'ct-exec', workorder: 'T0431', shellFamily: 'pwsh' as ShellFamily }, `${CLAUDE_BASE} --dangerously-skip-permissions '/ct-exec T0431'`, false],
    [{ prompt: '/ct-done T0431', agent: 'codex-cli', shellFamily: 'cmd' as ShellFamily }, 'codex --yolo "$ct-done T0431"', true],
    [{ prompt: 'x', workspaceId: 'ws-codex' }, 'codex --yolo x', false],
  ])('golden Electron command %#', async (opts, command, prefixNormalized) => {
    const build = createAgentPromptCommandBuilder(electronLikeDeps({
      agentCustomArgs: { 'claude-cli': '--dangerously-skip-permissions', 'codex-cli': '--yolo' },
    }, { 'ws-codex': 'codex-agent' }))
    const built = await build(opts)
    expect(built?.command).toBe(command)
    expect(built?.prefixNormalized).toBe(prefixNormalized)
  })

  it('awaits elevation before building the launch command', async () => {
    const order: string[] = []
    const build = createAgentPromptCommandBuilder({
      ...electronLikeDeps(null),
      ensureElevationApplied: async () => { order.push('elevation') },
      buildLaunchCommand: () => { order.push('launch'); return null },
    })
    await build({ skill: 'ct-exec', workorder: 'T1' })
    expect(order).toEqual(['elevation', 'launch'])
  })

  it('defaults: real agentRegistry launch command (codex-cli → codex)', async () => {
    const build = createAgentPromptCommandBuilder({
      readSettings: () => null,
      resolveWorkspaceDefaultAgent: async () => null,
      ensureElevationApplied: async () => {},
      logger: { warn: () => {} },
    })
    expect((await build({ prompt: 'p', agent: 'codex-cli' }))?.command).toBe('codex p')
  })
})

describe('headless agent command inputs (T0431)', () => {
  it('reads defaultAgent / agentCustomArgs from the headless settings shape', async () => {
    const build = createAgentPromptCommandBuilder({
      readSettings: () => readHeadlessTerminalSettings({
        defaultAgent: 'claude-code',
        agentCustomArgs: { 'claude-cli': '--dangerously-skip-permissions', broken: 42 },
        shell: 'auto',
      }),
      resolveWorkspaceDefaultAgent: async () => null,
      ensureElevationApplied: async () => {},
      resolveClaudeBaseCommand: async () => '/opt/bat/node_modules/@anthropic-ai/claude-code/bin/claude',
      logger: { warn: () => {} },
    })
    const built = await build({ skill: 'ct-exec', workorder: 'T0431', workspaceId: 'client-ws' })
    expect(built?.command).toBe("/opt/bat/node_modules/@anthropic-ai/claude-code/bin/claude --dangerously-skip-permissions '/ct-exec T0431'")
  })

  it('readHeadlessTerminalSettings drops values of the wrong type', () => {
    expect(readHeadlessTerminalSettings({
      shell: 42,
      customShellPath: '/bin/zsh',
      defaultAgent: ['x'],
      agentCustomArgs: { a: '--x', b: 1 },
    })).toEqual({ customShellPath: '/bin/zsh', agentCustomArgs: { a: '--x' } })
    expect(readHeadlessTerminalSettings({ agentCustomArgs: ['--x'] })).toEqual({})
  })
})
