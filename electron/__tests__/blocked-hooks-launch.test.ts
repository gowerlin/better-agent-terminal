// @vitest-environment node
/**
 * PLAN-047 M1b-1 / T0590: the claude `blocked` hooks BAT injects with the `bat` MCP server
 * (electron/bat-mcp-launch.ts).
 *
 *   - `--settings=<dataDir>/bat-mcp/claude-settings.json` (= form), the file holds `hooks` only,
 *     no token / env / disableAllHooks / permissions / model; rewritten only when it changes
 *   - hook commands: bare node + single-quoted script path (`/` on Windows), one per event; a
 *     quote in the path / a Windows node path needing quotes → not injected
 *   - not injected: Settings off, custom `--settings`, `bat-hook.mjs` missing, endpoint not
 *     listening, codex / other agents; custom `--mcp-config` skips only the MCP part
 *   - `blockedDetection` recorded for a named terminal (`hook` / `none`), from the handler's 4th
 *     argument and from the dispatch builder; logs say whether the hooks went in
 *   - headless host: bundle node, `<installRoot>/scripts/bat-hook.mjs`, records on its PtyManager
 *   - the hook command really runs in bash and PowerShell when present (quoting)
 *   - T0600: `SessionStart` (async, no matcher) → session-start; claude's own settings turning hooks
 *     off (`disableAllHooks` managed / user, `allowManagedHooksOnly` managed) → injected but `none`
 */
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('bat-mcp-launch must not import electron')
})

import {
  BAT_CLAUDE_HOOKS,
  BAT_MCP_LAUNCH_ARGS_CHANNEL,
  batHookCommand,
  blockedDetectionOf,
  buildBatMcpLaunchArgs,
  claudeHookSettingsContent,
  claudeHooksDisabledBy,
  createBatMcpLaunchArgs,
  defaultClaudeSettingsFiles,
  registerBatMcpHandlers,
  userArgsPassClaudeSettings,
  type BatMcpHost,
} from '../bat-mcp-launch'
import { createHeadlessBatMcpHost } from '../remote/headless-entry'
import { createAgentPromptCommandBuilder, type AgentCommandSettings } from '../terminal-command-handlers'
import { agentRegistry } from '../agent-runtime/agent-registry'
import { HOOK_REPORT_EVENTS } from '../terminal-blocked-state'
import type { HostDeps, SharedHandler } from '../handlers/types'
import type { PtyManager } from '../pty-manager'

const ROOT = path.resolve(__dirname, '..', '..')
const TOKEN = 'batcap.SECRET-CAPABILITY-TOKEN'

let dir: string
let helperDir: string
let dataDir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0590-launch-'))
  helperDir = path.join(dir, 'Program Files', 'BAT', 'scripts')
  dataDir = path.join(dir, 'userData')
  fs.mkdirSync(helperDir, { recursive: true })
  fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '// shim\n')
  fs.writeFileSync(path.join(helperDir, 'bat-hook.mjs'), '// hook\n')
  process.env.BAT_REMOTE_TOKEN_T0590_PROBE = TOKEN
})

afterEach(() => {
  delete process.env.BAT_REMOTE_TOKEN_T0590_PROBE
  fs.rmSync(dir, { recursive: true, force: true })
})

function host(overrides: Partial<BatMcpHost> = {}, settings: Record<string, unknown> | null = {}): BatMcpHost {
  return {
    dataDir: () => dataDir,
    helperDir: () => helperDir,
    nodeCommand: () => 'node',
    endpointReady: () => true,
    readSettings: () => settings,
    platform: 'win32',
    claudeSettingsFiles: () => [], // T0600: never this machine's own claude settings
    ...overrides,
  }
}

const mcpFile = () => path.join(dataDir, 'bat-mcp', 'claude.json')
const settingsFile = () => path.join(dataDir, 'bat-mcp', 'claude-settings.json')
const hookScript = () => path.join(helperDir, 'bat-hook.mjs')
const fwd = (p: string) => p.replace(/\\/g, '/')

describe('claude hooks injection', () => {
  it('--mcp-config= then --settings=; the settings file holds hooks only (no token, no other key)', () => {
    const r = buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli', shellFamily: 'pwsh' })
    expect(r).toEqual({ injected: true, kind: 'claude', args: `'--mcp-config=${mcpFile()}' '--settings=${settingsFile()}'`, mcp: true, hooks: true })
    expect(blockedDetectionOf(r)).toBe('hook')
    const content = fs.readFileSync(settingsFile(), 'utf8')
    const parsed = JSON.parse(content) as { hooks: Record<string, Array<{ matcher?: string; hooks: Array<Record<string, unknown>> }>> }
    expect(Object.keys(parsed)).toEqual(['hooks'])
    expect(Object.keys(parsed.hooks)).toEqual(['PermissionRequest', 'PreToolUse', 'Notification', 'PostToolUse', 'ElicitationResult', 'UserPromptSubmit', 'Stop', 'SessionStart'])
    const cmd = (event: string) => `node '${fwd(hookScript())}' ${event}`
    expect(parsed.hooks).toEqual({
      PermissionRequest: [{ hooks: [{ type: 'command', command: cmd('permission-request'), timeout: 5 }] }],
      PreToolUse: [{ matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: cmd('ask-user-question'), timeout: 5 }] }],
      Notification: [
        { matcher: 'elicitation_dialog|elicitation_url_dialog', hooks: [{ type: 'command', command: cmd('elicitation'), timeout: 5 }] },
        // T0620: sent after every elicitation answer, also a cancelled / timed-out request (async)
        { matcher: 'elicitation_response', hooks: [{ type: 'command', command: cmd('elicitation-done'), timeout: 5, async: true }] },
      ],
      // T0594: the answered question clears (async, AskUserQuestion only)
      PostToolUse: [{ matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: cmd('ask-user-question-done'), timeout: 5, async: true }] }],
      // T0620: the user answered the elicitation (every server, async)
      ElicitationResult: [{ hooks: [{ type: 'command', command: cmd('elicitation-done'), timeout: 5, async: true }] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: cmd('user-prompt-submit'), timeout: 5, async: true }] }],
      Stop: [{ hooks: [{ type: 'command', command: cmd('stop'), timeout: 5, async: true }] }],
      // T0600: the launch confirmation, every source, never waited for
      SessionStart: [{ hooks: [{ type: 'command', command: cmd('session-start'), timeout: 5, async: true }] }],
    })
    expect(content).not.toContain(TOKEN)
    expect(content).not.toMatch(/disableAllHooks|allowManagedHooksOnly|permissions|model|env|BAT_REMOTE|token/i)
    // no all-tool PostToolUse (a node start per tool call), no PermissionDenied (auto-mode classifier
    // denials only, T0594), no idle / permission notifications
    expect(parsed.hooks.PostToolUse.every(e => e.matcher === 'AskUserQuestion')).toBe(true)
    expect(content).not.toMatch(/PermissionDenied|PostToolUseFailure|PostToolBatch|idle_prompt|permission_prompt/)
    // T0620: no `elicitation_complete` (a URL elicitation the server confirmed: the dialog may still be open)
    expect(content).not.toMatch(/elicitation_complete/)
    // rewritten only when it changes
    const mtime = fs.statSync(settingsFile()).mtimeMs
    buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli-worktree', shellFamily: 'posix' })
    expect(fs.statSync(settingsFile()).mtimeMs).toBe(mtime)
    expect(fs.readdirSync(path.join(dataDir, 'bat-mcp')).sort()).toEqual(['claude-settings.json', 'claude.json'])
  })

  it('= form for every shell family (never takes the next word)', () => {
    for (const shellFamily of ['pwsh', 'posix', 'cmd'] as const) {
      const r = buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli', shellFamily })
      expect(r.injected && r.args, shellFamily).toMatch(/--settings=[^ '"]/)
      expect(r.injected && r.args, shellFamily).not.toMatch(/--settings /)
    }
  })

  it('custom --settings → no hooks (MCP still); custom --mcp-config → hooks only', () => {
    for (const extraArgs of ['--settings my.json', '--settings={"x":1}', '--model opus --settings']) {
      const r = buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli', shellFamily: 'posix', extraArgs })
      expect(r, extraArgs).toMatchObject({ injected: true, mcp: true, hooks: false, hooksReason: 'custom args already pass --settings' })
      expect(blockedDetectionOf(r)).toBe('none')
    }
    expect(userArgsPassClaudeSettings('--settingsx')).toBeNull()
    expect(userArgsPassClaudeSettings('--setting-sources user')).toBeNull()
    const r = buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli', shellFamily: 'posix', extraArgs: '--mcp-config mine.json' })
    expect(r).toEqual({ injected: true, kind: 'claude', args: `'--settings=${settingsFile()}'`, mcp: false, hooks: true, mcpReason: 'custom args already pass --mcp-config' })
    expect(blockedDetectionOf(r)).toBe('hook')
  })

  it('not injected: Settings off, endpoint down, bat-hook.mjs missing (MCP stays), codex / others', () => {
    expect(buildBatMcpLaunchArgs(host({}, { batMcpEnabled: false }), { agentId: 'claude-cli', shellFamily: 'posix' }))
      .toEqual({ injected: false, kind: 'claude', reason: 'turned off in Settings' })
    expect(fs.existsSync(settingsFile())).toBe(false)
    expect(buildBatMcpLaunchArgs(host({ endpointReady: () => false }), { agentId: 'claude-cli', shellFamily: 'posix' }))
      .toMatchObject({ injected: false, hooksReason: expect.stringContaining('RemoteServer not listening') })
    fs.rmSync(hookScript())
    const noHook = buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli', shellFamily: 'posix' })
    expect(noHook).toMatchObject({ injected: true, mcp: true, hooks: false, hooksReason: `bat-hook.mjs not found in ${helperDir}` })
    expect(blockedDetectionOf(noHook)).toBe('none')
    fs.writeFileSync(hookScript(), '')
    const codex = buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'posix' })
    expect(codex).toMatchObject({ injected: true, kind: 'codex', hooks: false })
    expect(codex.injected && codex.args).not.toContain('--settings')
    expect(blockedDetectionOf(codex)).toBe('none')
    expect(blockedDetectionOf(buildBatMcpLaunchArgs(host(), { agentId: 'gemini-cli', shellFamily: 'posix' }))).toBe('none')
  })

  it('hook command: bare node, single-quoted script; POSIX keeps backslash-free paths; unrepresentable → none', () => {
    expect(batHookCommand('node', 'C:\\Program Files\\BAT\\resources\\scripts\\bat-hook.mjs', 'stop', 'win32'))
      .toBe("node 'C:/Program Files/BAT/resources/scripts/bat-hook.mjs' stop")
    expect(batHookCommand('/home/u/.local/share/bat-server/bin/node', '/home/u/.local/share/bat-server/scripts/bat-hook.mjs', 'stop', 'linux'))
      .toBe("/home/u/.local/share/bat-server/bin/node '/home/u/.local/share/bat-server/scripts/bat-hook.mjs' stop")
    expect(batHookCommand('/opt/my node/node', '/x/bat-hook.mjs', 'stop', 'linux')).toBe("'/opt/my node/node' '/x/bat-hook.mjs' stop")
    expect(batHookCommand('C:\\Program Files\\nodejs\\node.exe', 'C:\\x\\bat-hook.mjs', 'stop', 'win32')).toBeNull()
    expect(batHookCommand('node', "/home/o'neil/bat-hook.mjs", 'stop', 'linux')).toBeNull()
    expect(claudeHookSettingsContent('node', "/home/o'neil/bat-hook.mjs", 'linux')).toBeNull()
    const quoted = path.join(dir, "o'neil", 'scripts')
    fs.mkdirSync(quoted, { recursive: true })
    for (const name of ['bat-mcp.mjs', 'bat-hook.mjs']) fs.writeFileSync(path.join(quoted, name), '')
    expect(buildBatMcpLaunchArgs(host({ helperDir: () => quoted }), { agentId: 'claude-cli', shellFamily: 'posix' }))
      .toMatchObject({ injected: true, mcp: true, hooks: false, hooksReason: expect.stringContaining('bash and PowerShell') })
    expect(BAT_CLAUDE_HOOKS.map(h => h.event)).toEqual(['permission-request', 'ask-user-question', 'elicitation', 'ask-user-question-done', 'elicitation-done', 'elicitation-done', 'user-prompt-submit', 'stop', 'session-start'])
    // every hook BAT injects is an event bat-hook.mjs and terminal:report-hook accept
    expect(BAT_CLAUDE_HOOKS.every(h => (HOOK_REPORT_EVENTS as readonly string[]).includes(h.event))).toBe(true)
  })

  it('the command runs as written in bash and PowerShell (when installed): argv reaches node intact', () => {
    // a probe script in a directory with a space, standing in for bat-hook.mjs
    const probeDir = path.join(dir, 'Program Files', 'probe dir')
    fs.mkdirSync(probeDir, { recursive: true })
    const probe = path.join(probeDir, 'probe.mjs')
    fs.writeFileSync(probe, 'process.stderr.write(JSON.stringify(process.argv.slice(2)))\n')
    const command = batHookCommand('node', probe, 'ask-user-question')!
    const shells: Array<[string, string[]]> = [['bash', ['-c', command]], ['pwsh', ['-NoProfile', '-NonInteractive', '-Command', command]]]
    let ran = 0
    for (const [shell, args] of shells) {
      const r = spawnSync(shell, args, { encoding: 'utf8', timeout: 20_000, windowsHide: true })
      if (r.error) continue // shell not installed here
      ran++
      expect(r.status, `${shell}: ${r.stderr}`).toBe(0)
      expect(JSON.parse(r.stderr), shell).toEqual(['ask-user-question'])
      expect(r.stdout, shell).toBe('')
    }
    expect(ran).toBeGreaterThan(0)
  })
})

describe('blockedDetection recording', () => {
  it('the handler records the 4th argument (a valid terminal id) for claude / codex, nothing for other agents; logs say hooks=', () => {
    const recorded: Array<[string, string]> = []
    const logs: string[] = []
    const handlers = new Map<string, SharedHandler>()
    registerBatMcpHandlers((channel, handler) => { handlers.set(channel, handler) }, host({
      recordBlockedDetection: (id, d) => { recorded.push([id, d]) },
      logger: { log: m => logs.push(m), warn: m => logs.push(m) },
    }))
    const call = (...args: unknown[]) => handlers.get(BAT_MCP_LAUNCH_ARGS_CHANNEL)!({ windowId: 'w' }, ...args)
    expect(call('claude-cli', 'pwsh', '', 'tab-1')).toBe(`'--mcp-config=${mcpFile()}' '--settings=${settingsFile()}'`)
    call('claude-cli', 'pwsh', '--settings x.json', 'tab-2')
    call('codex-cli', 'posix', '', 'tab-3')
    call('gemini-cli', 'posix', '', 'tab-4')
    call('claude-cli', 'posix', '', 'bad id with spaces')
    call('claude-cli', 'posix', '') // a renderer before T0590
    expect(recorded).toEqual([['tab-1', 'hook'], ['tab-2', 'none'], ['tab-3', 'none']])
    expect(logs[0]).toBe(`[bat-mcp] tab agent=claude-cli terminal=tab-1 → injected: '--mcp-config=${mcpFile()}' '--settings=${settingsFile()}'; hooks=yes`)
    expect(logs[1]).toBe(`[bat-mcp] tab agent=claude-cli terminal=tab-2 → injected: '--mcp-config=${mcpFile()}'; hooks=no (custom args already pass --settings)`)
    expect(logs[2]).toMatch(/^\[bat-mcp\] tab agent=codex-cli terminal=tab-3 → injected: -c /)
    expect(logs[2]).not.toContain('hooks=')
    expect(logs.join('\n')).not.toContain(TOKEN)
    // Settings off: recorded as none
    const off: Array<[string, string]> = []
    createBatMcpLaunchArgs(host({ recordBlockedDetection: (id, d) => { off.push([id, d]) } }, { batMcpEnabled: false }), 'tab')({ agentId: 'claude-cli', shellFamily: 'posix', terminalId: 't' })
    expect(off).toEqual([['t', 'none']])
  })

  it('helper dispatch: --settings= before the custom args; the new terminal’s decision is recorded', async () => {
    const recorded: Array<[string, string]> = []
    const CLAUDE_BASE = "& 'C:\\BAT\\claude.exe'"
    const build = createAgentPromptCommandBuilder({
      readSettings: () => ({ agentCustomArgs: { 'claude-cli': '--dangerously-skip-permissions' } }) as AgentCommandSettings,
      resolveWorkspaceAgentSettings: async () => null,
      ensureElevationApplied: async () => {},
      buildLaunchCommand: (agentId, extraArgs) => agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs),
      resolveClaudeBaseCommand: async () => CLAUDE_BASE,
      batMcpLaunchArgs: createBatMcpLaunchArgs(host({ recordBlockedDetection: (id, d) => { recorded.push([id, d]) } }), 'dispatch'),
      logger: { warn: vi.fn() },
    })
    const r = await build({ skill: 'ct-exec', workorder: 'T0590', agent: 'claude-cli', shellFamily: 'pwsh', terminalId: 'new-worker' })
    expect(r?.command).toBe(`${CLAUDE_BASE} '--mcp-config=${mcpFile()}' '--settings=${settingsFile()}' --dangerously-skip-permissions '/ct-exec T0590'`)
    expect(recorded).toEqual([['new-worker', 'hook']])
  })

  it('headless host: bundle node, <installRoot>/scripts/bat-hook.mjs, records on its PtyManager', () => {
    const installRoot = path.join(dir, 'bundle')
    const scripts = path.join(installRoot, 'scripts')
    fs.mkdirSync(path.join(installRoot, 'bin'), { recursive: true })
    fs.mkdirSync(scripts, { recursive: true })
    for (const name of ['bat-terminal.mjs', 'bat-notify.mjs', 'bat-mcp.mjs', 'bat-hook.mjs']) fs.writeFileSync(path.join(scripts, name), '')
    fs.writeFileSync(path.join(installRoot, 'bin', 'node'), '')
    const hostDeps: HostDeps = { emit: () => {}, dataDir, homeDir: dir, getSettings: () => ({}) }
    const recorded: Array<[string, string]> = []
    const pm = { setBlockedDetection: (id: string, d: string) => { recorded.push([id, d]) } } as unknown as PtyManager
    const h = { ...createHeadlessBatMcpHost(installRoot, hostDeps, fs.existsSync, () => pm), platform: 'linux' as const }
    const r = createBatMcpLaunchArgs(h, 'tab')({ agentId: 'claude-cli', shellFamily: 'posix', terminalId: 'remote-tab' })
    expect(r).toMatchObject({ injected: true, mcp: true, hooks: true })
    const parsed = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } }
    // (this machine's temp path stands in for the server's; on Linux it is backslash-free and unquoted)
    expect(parsed.hooks.Stop[0].hooks[0].command).toBe(batHookCommand(path.join(installRoot, 'bin', 'node'), path.join(scripts, 'bat-hook.mjs'), 'stop', 'linux'))
    expect(parsed.hooks.Stop[0].hooks[0].command).toContain(path.join(installRoot, 'bin', 'node'))
    expect(recorded).toEqual([['remote-tab', 'hook']])
    // a bundle before T0590 (no bat-hook.mjs): MCP only, none
    fs.rmSync(path.join(scripts, 'bat-hook.mjs'))
    expect(createBatMcpLaunchArgs(h, 'tab')({ agentId: 'claude-cli', shellFamily: 'posix', terminalId: 'remote-tab' })).toMatchObject({ injected: true, hooks: false })
    expect(recorded.at(-1)).toEqual(['remote-tab', 'none'])
  })
})

describe('claude settings that turn the hooks off (T0600)', () => {
  const write = (name: string, value: unknown) => {
    const file = path.join(dir, name)
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
    return file
  }

  it('claudeHooksDisabledBy: first file setting disableAllHooks decides (managed first); allowManagedHooksOnly in the managed file only; unreadable = unset', () => {
    const managed = (v: unknown) => ({ file: write('managed.json', v), managed: true })
    const user = (v: unknown) => ({ file: write('user.json', v), managed: false })
    const missing = { file: path.join(dir, 'missing.json'), managed: true }
    expect(claudeHooksDisabledBy([missing, user({ disableAllHooks: true })])).toBe(`disableAllHooks in ${path.join(dir, 'user.json')}`)
    expect(claudeHooksDisabledBy([managed({ disableAllHooks: false }), user({ disableAllHooks: true })])).toBeNull()
    expect(claudeHooksDisabledBy([managed({ model: 'x' }), user({ disableAllHooks: false })])).toBeNull()
    expect(claudeHooksDisabledBy([managed({ allowManagedHooksOnly: true }), user({})])).toBe(`allowManagedHooksOnly in ${path.join(dir, 'managed.json')}`)
    expect(claudeHooksDisabledBy([user({ allowManagedHooksOnly: true })])).toBeNull()
    expect(claudeHooksDisabledBy([managed('not json'), user('[true]')])).toBeNull()
    expect(claudeHooksDisabledBy([])).toBeNull()
  })

  it('defaultClaudeSettingsFiles: managed file per platform, then CLAUDE_CONFIG_DIR or ~/.claude', () => {
    expect(defaultClaudeSettingsFiles({}, 'win32', 'C:\\Users\\u')).toEqual([
      { file: 'C:\\Program Files\\ClaudeCode\\managed-settings.json', managed: true },
      { file: 'C:\\Users\\u\\.claude\\settings.json', managed: false },
    ])
    expect(defaultClaudeSettingsFiles({ CLAUDE_CONFIG_DIR: '/cfg/claude' }, 'linux', '/home/u')).toEqual([
      { file: '/etc/claude-code/managed-settings.json', managed: true },
      { file: '/cfg/claude/settings.json', managed: false },
    ])
    expect(defaultClaudeSettingsFiles({}, 'darwin', '/Users/u')[0].file).toBe('/Library/Application Support/ClaudeCode/managed-settings.json')
  })

  it('turned off → the args still go in (a report would still prove they run), recorded none, logged; on → hook', () => {
    const userFile = write('settings.json', { disableAllHooks: true })
    const recorded: Array<[string, string]> = []
    const logs: string[] = []
    const launch = createBatMcpLaunchArgs(host({
      claudeSettingsFiles: () => [{ file: userFile, managed: false }],
      recordBlockedDetection: (id, d) => { recorded.push([id, d]) },
      logger: { log: m => logs.push(m), warn: m => logs.push(m) },
    }), 'dispatch')
    const r = launch({ agentId: 'claude-cli', shellFamily: 'posix', terminalId: 'w1' })
    expect(r).toMatchObject({ injected: true, mcp: true, hooks: true, hooksDisabled: `disableAllHooks in ${userFile}` })
    expect(r.injected && r.args).toContain('--settings=')
    expect(blockedDetectionOf(r)).toBe('none')
    expect(recorded).toEqual([['w1', 'none']])
    expect(logs[0]).toMatch(/; hooks=yes \(turned off: disableAllHooks in .*settings\.json\)$/)
    // the claude settings file BAT writes never says anything about it
    expect(fs.readFileSync(settingsFile(), 'utf8')).not.toMatch(/disableAllHooks|allowManagedHooksOnly/)
    fs.writeFileSync(userFile, JSON.stringify({ disableAllHooks: false }))
    expect(launch({ agentId: 'claude-cli', shellFamily: 'posix', terminalId: 'w2' })).not.toHaveProperty('hooksDisabled')
    expect(recorded.at(-1)).toEqual(['w2', 'hook'])
    // codex is never checked (no hooks), custom --settings neither
    expect(launch({ agentId: 'codex-cli', shellFamily: 'posix', terminalId: 'c1' })).not.toHaveProperty('hooksDisabled')
  })

  it('headless host reads the server user’s home (HostDeps.homeDir)', () => {
    const installRoot = path.join(dir, 'bundle-t0600')
    const hostDeps: HostDeps = { emit: () => {}, dataDir, homeDir: path.join(dir, 'home'), getSettings: () => ({}) }
    const h = createHeadlessBatMcpHost(installRoot, hostDeps, fs.existsSync, () => null)
    vi.stubEnv('CLAUDE_CONFIG_DIR', '')
    try {
      expect(h.claudeSettingsFiles?.().find(f => !f.managed)?.file).toBe(path.join(dir, 'home', '.claude', 'settings.json'))
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('source guards (T0590)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

  it('main.ts and headless record blockedDetection and register terminal:report-hook', () => {
    const main = read('electron/main.ts')
    expect(main).toMatch(/recordBlockedDetection: \(terminalId, detection\) => ptyManager\?\.setBlockedDetection\(terminalId, detection\)/)
    expect(main).toMatch(/registerReportHookHandler\(\{\s*registerHandler,\s*getPtyManager: \(\) => ptyManager,/)
    const headless = read('electron/remote/headless-entry.ts')
    expect(headless).toMatch(/recordBlockedDetection: \(terminalId, detection\) => getPtyManager\?\.\(\)\?\.setBlockedDetection\(terminalId, detection\)/)
    expect(headless).toMatch(/registerReportHookHandler\(\{\s*registerHandler: register,\s*getPtyManager: opts\.getPtyManager,/)
    expect(headless).toMatch(/createBatMcpLaunchArgs\(createHeadlessBatMcpHost\(opts\.batMcpInstallRoot, host, fs\.existsSync, opts\.getPtyManager\), 'dispatch'\)/)
    const handlers = read('electron/terminal-command-handlers.ts')
    expect(handlers).toMatch(/terminalId: opts\.id, \/\/ T0590/)
  })

  it('every renderer launch passes the tab id to withBatMcpLaunchArgs', () => {
    const view = read('src/components/WorkspaceView.tsx')
    const calls = view.match(/withBatMcpLaunchArgs\([^\n]*\)/g) ?? []
    expect(calls).toHaveLength(5)
    for (const call of calls) expect(call, call).toMatch(/, (terminal\.id|agentTerminal\.id|terminalId|id)\)/)
  })
})
