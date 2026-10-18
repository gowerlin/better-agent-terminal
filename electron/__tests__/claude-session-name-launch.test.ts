// @vitest-environment node
/**
 * PLAN-050 / T0641 (C-2 / C-3): the claude session name in the launch decision
 * (electron/bat-mcp-launch.ts) and its two callers.
 *   - `--name=<name>` (quoted per shell, = form) after the MCP / hooks args, claude only
 *   - independent of Settings `batMcpEnabled` and the endpoint (D167: no switch)
 *   - not injected: custom args name the session (`user-args`), no name (`no-name`), the version
 *     check says no / is absent (`claude-too-old` / `version-unknown`); codex / others untouched
 *   - the decision is recorded per terminal (`not-claude-cli` for the others); logs `name=`
 *   - `agent:bat-mcp-launch-args`: 5th argument, cleaned; the version check asked only when a name
 *     could go in
 *   - helper dispatch: `<ws> · Worker · <T####>` from the landing workspace, `BAT` without one
 *   - source guards: Electron main / headless wiring, the renderer's claude-cli launch
 *   - `ClaudeSessionNameRecords`: overwrite, bound
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('bat-mcp-launch must not import electron')
})

import {
  BAT_MCP_LAUNCH_ARGS_CHANNEL,
  buildBatMcpLaunchArgs,
  createBatMcpLaunchArgs,
  needsClaudeNameSupport,
  registerBatMcpHandlers,
  userArgsSetClaudeName,
  withBatMcpArgs,
  type BatMcpHost,
  type BatMcpLaunchRequest,
} from '../bat-mcp-launch'
import { ClaudeSessionNameRecords, type ClaudeSessionNameRecord } from '../claude-session-name-record'
import type { ClaudeNameSupport } from '../claude-version-check'
import { createAgentPromptCommandBuilder, type AgentCommandSettings, type AgentPromptCommandDeps } from '../terminal-command-handlers'
import { agentRegistry } from '../agent-runtime/agent-registry'
import { createHeadlessBatMcpHost } from '../remote/headless-entry'
import type { HostDeps, SharedHandler } from '../handlers/types'

const ROOT = path.resolve(__dirname, '..', '..')
const EMBEDDED: ClaudeNameSupport = { inject: true, runtime: 'embedded' }
const NAME = '測試工作區 · Worker · T0641'

let dir: string
let helperDir: string
let dataDir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0641-launch-'))
  helperDir = path.join(dir, 'scripts')
  dataDir = path.join(dir, 'userData')
  fs.mkdirSync(helperDir, { recursive: true })
  fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '')
  fs.writeFileSync(path.join(helperDir, 'bat-hook.mjs'), '')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function host(overrides: Partial<BatMcpHost> = {}, settings: Record<string, unknown> | null = {}): BatMcpHost {
  return {
    dataDir: () => dataDir,
    helperDir: () => helperDir,
    nodeCommand: () => 'node',
    endpointReady: () => true,
    readSettings: () => settings,
    claudeSettingsFiles: () => [],
    ...overrides,
  }
}

const mcpFile = () => path.join(dataDir, 'bat-mcp', 'claude.json')
const settingsFile = () => path.join(dataDir, 'bat-mcp', 'claude-settings.json')
const named = (extra: Partial<BatMcpLaunchRequest> = {}): BatMcpLaunchRequest => ({
  agentId: 'claude-cli', shellFamily: 'pwsh', sessionName: NAME, claudeNameSupport: EMBEDDED, ...extra,
})

describe('buildBatMcpLaunchArgs: the session name', () => {
  it('--name= last, quoted per shell family; claude-cli-worktree too', () => {
    const r = buildBatMcpLaunchArgs(host(), named())
    expect(r).toEqual({
      injected: true,
      kind: 'claude',
      args: `'--mcp-config=${mcpFile()}' '--settings=${settingsFile()}' '--name=${NAME}'`,
      mcp: true,
      hooks: true,
      name: NAME,
    })
    expect(buildBatMcpLaunchArgs(host(), named({ shellFamily: 'posix', sessionName: "o'neil · 1a2b3c" }))).toMatchObject({ args: expect.stringMatching(/ '--name=o'\\''neil · 1a2b3c'$/) })
    expect(buildBatMcpLaunchArgs(host(), named({ shellFamily: 'pwsh', sessionName: "o'neil · 1a2b3c" }))).toMatchObject({ args: expect.stringMatching(/ '--name=o''neil · 1a2b3c'$/) })
    expect(buildBatMcpLaunchArgs(host(), named({ shellFamily: 'cmd' }))).toMatchObject({ args: expect.stringMatching(new RegExp(` "--name=${NAME}"$`)) })
    expect(buildBatMcpLaunchArgs(host(), named({ agentId: 'claude-cli-worktree' }))).toMatchObject({ name: NAME })
    // a safe word needs no quotes
    expect(buildBatMcpLaunchArgs(host(), named({ sessionName: 'ws' }))).toMatchObject({ args: expect.stringMatching(/ --name=ws$/) })
    // the base command, then BAT's args (the caller appends the custom args)
    expect(withBatMcpArgs("& 'C:\\claude.exe'", buildBatMcpLaunchArgs(host(), named()))).toMatch(/^& 'C:\\claude\.exe' '--mcp-config=.* '--name=測試工作區 · Worker · T0641'$/)
  })

  it('not tied to Settings batMcpEnabled or the endpoint (D167)', () => {
    expect(buildBatMcpLaunchArgs(host({}, { batMcpEnabled: false }), named())).toEqual({
      injected: true, kind: 'claude', args: `'--name=${NAME}'`, mcp: false, hooks: false,
      mcpReason: 'turned off in Settings', hooksReason: 'turned off in Settings', name: NAME,
    })
    expect(fs.existsSync(mcpFile())).toBe(false)
    expect(buildBatMcpLaunchArgs(host({ endpointReady: () => false }), named())).toMatchObject({
      injected: true, args: `'--name=${NAME}'`, mcp: false, hooks: false, name: NAME,
    })
    expect(buildBatMcpLaunchArgs(host({ helperDir: () => undefined }), named())).toMatchObject({ injected: true, args: `'--name=${NAME}'` })
  })

  it('user args that name the session → user-args (the MCP / hooks parts unchanged)', () => {
    for (const extraArgs of ['--name mine', '--name=mine', '--model opus -n mine', '-n', '-cn mine', '-nmine', '--bg -cn x --model opus']) {
      expect(userArgsSetClaudeName(extraArgs), extraArgs).toBe(true)
      const r = buildBatMcpLaunchArgs(host(), named({ extraArgs }))
      expect(r, extraArgs).toMatchObject({ injected: true, mcp: true, hooks: true, nameReason: 'user-args' })
      expect(r.injected && r.args, extraArgs).not.toContain('--name')
    }
    for (const extraArgs of ['', '--named x', '--no-chrome', '--model opus', '-c', '-p', '--dangerously-skip-permissions', 'x-n', '--settings-n']) {
      expect(userArgsSetClaudeName(extraArgs), extraArgs).toBe(false)
    }
    expect(userArgsSetClaudeName(undefined)).toBe(false)
  })

  it('no name → no-name; the version check says no / is absent → its reason / version-unknown', () => {
    expect(buildBatMcpLaunchArgs(host(), named({ sessionName: undefined }))).toMatchObject({ nameReason: 'no-name' })
    expect(buildBatMcpLaunchArgs(host(), named({ sessionName: ' \u0000 ' }))).toMatchObject({ nameReason: 'no-name' })
    expect(buildBatMcpLaunchArgs(host(), named({ claudeNameSupport: undefined }))).toMatchObject({ nameReason: 'version-unknown' })
    expect(buildBatMcpLaunchArgs(host(), named({ claudeNameSupport: { inject: false, reason: 'claude-too-old', version: '2.1.70' } }))).toMatchObject({ nameReason: 'claude-too-old' })
    const unknown = buildBatMcpLaunchArgs(host({}, { batMcpEnabled: false }), named({ claudeNameSupport: { inject: false, reason: 'version-unknown' } }))
    expect(unknown).toEqual({ injected: false, kind: 'claude', reason: 'turned off in Settings', nameReason: 'version-unknown' })
    expect(buildBatMcpLaunchArgs(host(), named({ claudeNameSupport: { inject: true, runtime: 'system', version: '2.1.302' } }))).toMatchObject({ name: NAME })
  })

  it('the name is cleaned again; codex / other agents never get one', () => {
    expect(buildBatMcpLaunchArgs(host(), named({ sessionName: '/ws\n · 1a2b3c' }))).toMatchObject({ name: 'ws · 1a2b3c' })
    const codex = buildBatMcpLaunchArgs(host(), named({ agentId: 'codex-cli' }))
    expect(codex.injected && codex.args).not.toContain('--name')
    expect(codex).not.toHaveProperty('name')
    expect(codex).not.toHaveProperty('nameReason')
    expect(buildBatMcpLaunchArgs(host(), named({ agentId: 'gemini-cli' }))).toEqual({ injected: false, reason: 'not a claude / codex tab' })
  })

  it('needsClaudeNameSupport: claude, a name, not the user\'s', () => {
    expect(needsClaudeNameSupport({ agentId: 'claude-cli', sessionName: NAME })).toBe(true)
    expect(needsClaudeNameSupport({ agentId: 'claude-cli-worktree', sessionName: NAME })).toBe(true)
    expect(needsClaudeNameSupport({ agentId: 'claude-cli', sessionName: NAME, extraArgs: '-n x' })).toBe(false)
    expect(needsClaudeNameSupport({ agentId: 'claude-cli' })).toBe(false)
    expect(needsClaudeNameSupport({ agentId: 'codex-cli', sessionName: NAME })).toBe(false)
  })
})

describe('recording and logs', () => {
  it('createBatMcpLaunchArgs records the decision of a named terminal; logs name=yes / name=no (<reason>)', () => {
    const records: Array<[string, ClaudeSessionNameRecord]> = []
    const logs: string[] = []
    const launch = createBatMcpLaunchArgs(host({
      recordClaudeSessionName: (id, record) => { records.push([id, record]) },
      logger: { log: m => logs.push(m), warn: m => logs.push(m) },
    }), 'tab')
    launch(named({ terminalId: 't1' }))
    launch(named({ terminalId: 't2', extraArgs: '--name mine' }))
    launch(named({ terminalId: 't3', claudeNameSupport: { inject: false, reason: 'claude-too-old' } }))
    launch(named({ terminalId: 't4', agentId: 'codex-cli' }))
    launch(named({ terminalId: 't5', agentId: 'gemini-cli' }))
    launch(named()) // no terminal id: nothing recorded
    expect(records.map(([id, r]) => [id, r.name, r.reason])).toEqual([
      ['t1', NAME, undefined],
      ['t2', null, 'user-args'],
      ['t3', null, 'claude-too-old'],
      ['t4', null, 'not-claude-cli'],
      ['t5', null, 'not-claude-cli'],
    ])
    expect(records.every(([, r]) => typeof r.at === 'number')).toBe(true)
    expect(records[0][1]).not.toHaveProperty('reason')
    expect(logs[0]).toMatch(/^\[bat-mcp\] tab agent=claude-cli terminal=t1 → injected: .* '--name=測試工作區 · Worker · T0641'; hooks=yes; name=yes$/)
    expect(logs[1]).toMatch(/; hooks=yes; name=no \(user-args\)$/)
    expect(logs[2]).toMatch(/; name=no \(claude-too-old\)$/)
    expect(logs[3]).not.toContain('name=')
  })

  it('a failing recorder only warns', () => {
    const warns: string[] = []
    const launch = createBatMcpLaunchArgs(host({
      recordClaudeSessionName: () => { throw new Error('boom') },
      logger: { log: () => {}, warn: m => warns.push(m) },
    }), 'tab')
    expect(launch(named({ terminalId: 't1' }))).toMatchObject({ name: NAME })
    expect(warns).toEqual(['[bat-mcp] recording the session name of t1 failed: boom'])
  })
})

describe('agent:bat-mcp-launch-args (5th argument)', () => {
  function handler(overrides: Partial<BatMcpHost> = {}) {
    const handlers = new Map<string, SharedHandler>()
    registerBatMcpHandlers((channel, h) => { handlers.set(channel, h) }, host(overrides))
    return (...args: unknown[]) => handlers.get(BAT_MCP_LAUNCH_ARGS_CHANNEL)!({ windowId: 'w' }, ...args) as Promise<string>
  }

  it('the name goes in when the host says so; the check is asked only when a name could go in', async () => {
    const support = vi.fn(async (): Promise<ClaudeNameSupport> => EMBEDDED)
    const records: Array<[string, ClaudeSessionNameRecord]> = []
    const call = handler({ claudeNameSupport: support, recordClaudeSessionName: (id, r) => { records.push([id, r]) } })
    expect(await call('claude-cli', 'pwsh', '', 'tab-1', 'ws · tab1ab')).toBe(`'--mcp-config=${mcpFile()}' '--settings=${settingsFile()}' '--name=ws · tab1ab'`)
    expect(support).toHaveBeenCalledTimes(1)
    await call('claude-cli', 'pwsh', '--name mine', 'tab-2', 'ws · tab2ab')
    await call('claude-cli', 'pwsh', '', 'tab-3') // a renderer before T0641
    await call('codex-cli', 'pwsh', '', 'tab-4', 'ws · tab4ab')
    await call('claude-cli', 'pwsh', '', 'tab-5', 42)
    expect(support).toHaveBeenCalledTimes(1)
    expect(records.map(([id, r]) => [id, r.reason ?? r.name])).toEqual([
      ['tab-1', 'ws · tab1ab'], ['tab-2', 'user-args'], ['tab-3', 'no-name'], ['tab-4', 'not-claude-cli'], ['tab-5', 'no-name'],
    ])
    // cleaned on arrival
    expect(await call('claude-cli', 'posix', '', 'tab-6', '/evil"\n · x')).toMatch(/ '--name=evil'\\'' · x'$/)
  })

  it('no check on the host / a too old claude / a check that throws → no --name', async () => {
    expect(await handler()('claude-cli', 'pwsh', '', 't', 'ws · aaaaaa')).not.toContain('--name')
    expect(await handler({ claudeNameSupport: async () => ({ inject: false, reason: 'claude-too-old', version: '2.1.0' }) })('claude-cli', 'pwsh', '', 't', 'ws · aaaaaa')).not.toContain('--name')
    const warns: string[] = []
    const out = await handler({ claudeNameSupport: async () => { throw new Error('x') }, logger: { log: () => {}, warn: m => warns.push(m) } })('claude-cli', 'pwsh', '', 't', 'ws · aaaaaa')
    expect(out).not.toContain('--name')
    expect(warns).toEqual(['[bat-mcp] claude version check failed: x'])
    // Settings off: the name alone
    expect(await handler({ readSettings: () => ({ batMcpEnabled: false }), claudeNameSupport: async () => EMBEDDED })('claude-cli', 'cmd', '', 't', 'ws · aaaaaa')).toBe('"--name=ws · aaaaaa"')
  })

  it('headless host: the check and the recorder are wired', () => {
    const hostDeps: HostDeps = { emit: () => {}, dataDir, homeDir: dir, getSettings: () => ({}) }
    const h = createHeadlessBatMcpHost(path.join(dir, 'bundle'), hostDeps)
    expect(typeof h.claudeNameSupport).toBe('function')
    expect(typeof h.recordClaudeSessionName).toBe('function')
  })
})

describe('helper dispatch (createAgentPromptCommandBuilder)', () => {
  const CLAUDE_BASE = "& 'C:\\BAT\\claude.exe'"
  function builder(opts: { args?: string; support?: AgentPromptCommandDeps['claudeNameSupport']; batMcp?: boolean } = {}) {
    const records: Array<[string, ClaudeSessionNameRecord]> = []
    const support = vi.fn(opts.support ?? (async (): Promise<ClaudeNameSupport> => EMBEDDED))
    const build = createAgentPromptCommandBuilder({
      readSettings: () => ({ agentCustomArgs: { 'claude-cli': opts.args ?? '--dangerously-skip-permissions', 'codex-cli': '' } }) as AgentCommandSettings,
      resolveWorkspaceAgentSettings: async () => null,
      ensureElevationApplied: async () => {},
      buildLaunchCommand: (agentId, extraArgs) => agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs),
      resolveClaudeBaseCommand: async () => CLAUDE_BASE,
      ...(opts.batMcp === false ? {} : {
        batMcpLaunchArgs: createBatMcpLaunchArgs(host({ recordClaudeSessionName: (id, r) => { records.push([id, r]) } }), 'dispatch'),
      }),
      claudeNameSupport: support,
      logger: { warn: vi.fn() },
    })
    return { build, records, support }
  }

  it('a claude Worker: <landing ws> · Worker · <T####>, before the custom args and the prompt', async () => {
    const { build, records } = builder()
    const r = await build({ skill: 'ct-exec', workorder: 'T0641', agent: 'claude-cli', shellFamily: 'pwsh', terminalId: 'w1', workspaceName: 'better-agent-terminal' })
    expect(r?.command).toBe(`${CLAUDE_BASE} '--mcp-config=${mcpFile()}' '--settings=${settingsFile()}' '--name=better-agent-terminal · Worker · T0641' --dangerously-skip-permissions '/ct-exec T0641'`)
    expect(records.map(([id, rec]) => [id, rec.name])).toEqual([['w1', 'better-agent-terminal · Worker · T0641']])
  })

  it('no workspace name (headless, active workspace) → BAT; a prompt dispatch → <ws> · <short id>', async () => {
    const { build } = builder()
    expect((await build({ skill: 'ct-done', workorder: 'CT-T021', agent: 'claude-cli', shellFamily: 'posix', terminalId: 'w2' }))?.command)
      .toContain(" '--name=BAT · Worker · CT-T021' ")
    expect((await build({ prompt: 'hello', agent: 'claude-cli', shellFamily: 'posix', terminalId: 'ABCDEF-1234', workspaceName: 'ws' }))?.command)
      .toContain(" '--name=ws · abcdef' ")
  })

  it('user --name / too old claude → none; codex never asks the check', async () => {
    const user = builder({ args: '-n mine' })
    const r = await user.build({ skill: 'ct-exec', workorder: 'T0641', agent: 'claude-cli', shellFamily: 'pwsh', terminalId: 'w3', workspaceName: 'ws' })
    expect(r?.command).not.toContain('--name=')
    expect(r?.command).toContain(' -n mine ')
    expect(user.support).not.toHaveBeenCalled()
    expect(user.records[0][1]).toMatchObject({ name: null, reason: 'user-args' })
    const old = builder({ support: async () => ({ inject: false, reason: 'claude-too-old', version: '2.1.0' }) })
    expect((await old.build({ skill: 'ct-exec', workorder: 'T0641', agent: 'claude-cli', shellFamily: 'pwsh', terminalId: 'w4', workspaceName: 'ws' }))?.command).not.toContain('--name')
    expect(old.records[0][1]).toMatchObject({ name: null, reason: 'claude-too-old' })
    const codex = builder()
    expect((await codex.build({ skill: 'ct-exec', workorder: 'T0641', agent: 'codex-cli', shellFamily: 'pwsh', terminalId: 'w5', workspaceName: 'ws' }))?.command).not.toContain('--name')
    expect(codex.support).not.toHaveBeenCalled()
    expect(codex.records[0][1]).toMatchObject({ name: null, reason: 'not-claude-cli' })
    // a host without the launch decision (no batMcpLaunchArgs) never probes
    const none = builder({ batMcp: false })
    await none.build({ skill: 'ct-exec', workorder: 'T0641', agent: 'claude-cli', shellFamily: 'pwsh', terminalId: 'w6', workspaceName: 'ws' })
    expect(none.support).not.toHaveBeenCalled()
  })
})

describe('source guards (T0641)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

  it('Electron main and headless wire the version check and the record into both launch paths', () => {
    const main = read('electron/main.ts')
    expect(main).toMatch(/const claudeNameSupport = createClaudeNameSupportCheck\(\{\n  resolveRuntime: \(\) => resolveClaudeRuntime\(getRuntimeSettingsSnapshot\(\)\),/)
    expect(main).toMatch(/claudeNameSupport, \/\/ T0641/)
    // T0642: + the persisted store
    expect(main).toMatch(/recordClaudeSessionName: \(terminalId, record\) => \{\n    claudeSessionNameRecords\.set\(terminalId, record\)\n    claudeSessionPersistence\.persist\(\) \/\/ T0642/)
    const headless = read('electron/remote/headless-entry.ts')
    expect(headless).toMatch(/claudeNameSupport: headlessClaudeNameSupport/)
    expect(headless).toMatch(/recordClaudeSessionName: \(terminalId, record\) => claudeSessionNameRecords\.set\(terminalId, record\)/)
    const handlers = read('electron/terminal-command-handlers.ts')
    expect(handlers).toMatch(/\.\.\.\(landing\.workspaceName \? \{ workspaceName: landing\.workspaceName \} : \{\}\), \/\/ T0641/)
  })

  it('the renderer\'s claude-cli launch passes `<ws> · <short id>` (alias first) to withBatMcpLaunchArgs', () => {
    const view = read('src/components/WorkspaceView.tsx')
    expect(view).toMatch(/sessionWorkspaceNameRef\.current = workspace\.alias \|\| workspace\.name/)
    // T0644: a tab opened as Tower (`launchRole: 'tower'`) is `<ws> · Tower`; every other tab keeps `<ws> · <short id>`
    expect(view).toMatch(/: claudeSessionName\(\{ role: 'tab', workspaceName: sessionWorkspaceNameRef\.current, terminalId \}\)\) \?\? undefined/)
    expect(view).toMatch(/withBatMcpLaunchArgs\(quoteCommandPath\(cliPath, detectShellFamily\(shell \?\? ''\)\), presetId, shell, customArgs, terminalId, sessionName\)/)
    expect(read('electron/preload.ts')).toMatch(/ipcRenderer\.invoke\('agent:bat-mcp-launch-args', agentId, shellFamily, extraArgs, terminalId, sessionName\)/)
  })
})

describe('ClaudeSessionNameRecords', () => {
  it('a relaunch overwrites; the oldest go past the limit', () => {
    const records = new ClaudeSessionNameRecords(3)
    records.set('a', { name: 'A', at: 1 })
    records.set('b', { name: null, reason: 'user-args', at: 2 })
    records.set('a', { name: 'A2', at: 3 })
    records.set('c', { name: 'C', at: 4 })
    records.set('d', { name: 'D', at: 5 })
    expect(records.size).toBe(3)
    expect(records.get('b')).toBeUndefined()
    expect(records.get('a')).toEqual({ name: 'A2', at: 3 })
    records.delete('a')
    expect(records.get('a')).toBeUndefined()
  })
})
