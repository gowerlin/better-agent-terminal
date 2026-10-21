// @vitest-environment node
/**
 * PLAN-047 M1 / T0584: attaching the `bat` MCP server to claude / codex launches
 * (electron/bat-mcp-launch.ts) and the assembly points that use it.
 *
 *   - buildBatMcpLaunchArgs: claude `--mcp-config=<file>` (file = command / args, no token, no env),
 *     codex `-c mcp_servers.bat.*` per shell family (T0586: + `env_vars` names), off in Settings, custom args that already
 *     attach MCP, RemoteServer not listening, shim missing, other agents
 *   - `agent:bat-mcp-launch-args` handler; headless host (bundle node / helpers missing)
 *   - createAgentPromptCommandBuilder (helper dispatch): placed after the base command, before the
 *     custom args and the prompt; off ⇒ the command is the pre-T0584 one, byte for byte
 *   - raw command mode and the renderer launch sites (source guards)
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
  batMcpAgentKind,
  buildBatMcpLaunchArgs,
  claudeMcpConfigContent,
  createBatMcpLaunchArgs,
  isBatMcpEnabled,
  registerBatMcpHandlers,
  tomlString,
  userArgsAttachBatMcp,
  type BatMcpHost,
} from '../bat-mcp-launch'
import { createHeadlessBatMcpHost } from '../remote/headless-entry'
import { createAgentPromptCommandBuilder, type AgentCommandSettings } from '../terminal-command-handlers'
import { agentRegistry } from '../agent-runtime/agent-registry'
import type { HostDeps, SharedHandler } from '../handlers/types'

const ROOT = path.resolve(__dirname, '..', '..')
const TOKEN = 'batcap.SECRET-CAPABILITY-TOKEN'

let dir: string
let helperDir: string
let dataDir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0584-launch-'))
  helperDir = path.join(dir, 'Program Files', 'BAT', 'scripts')
  // T0684: the space makes `--mcp-config=<file>` need quotes on every host, as the Windows temp
  // path (`\`, `:`) always does; a Linux /tmp path is all safe characters and would go unquoted
  dataDir = path.join(dir, 'App Data', 'userData')
  fs.mkdirSync(helperDir, { recursive: true })
  fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '// shim\n')
  process.env.BAT_REMOTE_TOKEN_T0584_PROBE = TOKEN
})

afterEach(() => {
  delete process.env.BAT_REMOTE_TOKEN_T0584_PROBE
  fs.rmSync(dir, { recursive: true, force: true })
})

function host(overrides: Partial<BatMcpHost> = {}, settings: Record<string, unknown> | null = {}): BatMcpHost {
  return {
    dataDir: () => dataDir,
    helperDir: () => helperDir,
    nodeCommand: () => 'node',
    endpointReady: () => true,
    readSettings: () => settings,
    claudeSettingsFiles: () => [], // T0600: never this machine's own claude settings
    ...overrides,
  }
}

const configFile = () => path.join(dataDir, 'bat-mcp', 'claude.json')
const shim = () => path.join(helperDir, 'bat-mcp.mjs')

describe('buildBatMcpLaunchArgs', () => {
  it('claude: --mcp-config=<userData>/bat-mcp/claude.json, the file holds command / args only', () => {
    const r = buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli', shellFamily: 'pwsh' })
    // T0590: no bat-hook.mjs in this helper dir → MCP only (hooks: blocked-hooks-launch.test.ts)
    // T0641: no session name sent → `no-name`
    expect(r).toEqual({ injected: true, kind: 'claude', args: `'--mcp-config=${configFile()}'`, mcp: true, hooks: false, hooksReason: `bat-hook.mjs not found in ${helperDir}`, nameReason: 'no-name' })
    const content = fs.readFileSync(configFile(), 'utf8')
    expect(JSON.parse(content)).toEqual({ mcpServers: { bat: { type: 'stdio', command: 'node', args: [shim()] } } })
    expect(content).not.toContain(TOKEN)
    expect(content).not.toMatch(/env|token|BAT_REMOTE/i)
    // claude-cli-worktree too; the file is rewritten only when it changes
    const mtime = fs.statSync(configFile()).mtimeMs
    expect(buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli-worktree', shellFamily: 'posix' })).toMatchObject({ injected: true, kind: 'claude' })
    expect(fs.statSync(configFile()).mtimeMs).toBe(mtime)
    expect(fs.readdirSync(path.join(dataDir, 'bat-mcp'))).toEqual(['claude.json'])
  })

  it('claude: the =form never takes the next word (variadic --mcp-config)', () => {
    const r = buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli', shellFamily: 'posix' })
    expect(r.injected && r.args).toMatch(/^'--mcp-config=[^ ]/)
    expect(r.injected && r.args).not.toMatch(/--mcp-config /)
  })

  it('codex: -c command / args / env_vars / tool_timeout_sec, TOML literal strings, quoted per shell', () => {
    const base = `mcp_servers.bat.args=['${shim()}']`
    // T0586 / BUG-148: names only
    const envVars = "mcp_servers.bat.env_vars=['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_TERMINAL_ID', 'BAT_USER_DATA', 'BAT_SERVER_CERT_PATH', 'BAT_HELPER_LOG_DIR', 'BAT_RUNTIME', 'APPDATA', 'XDG_CONFIG_HOME']"
    expect(buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'pwsh' })).toEqual({
      injected: true,
      kind: 'codex',
      args: `-c 'mcp_servers.bat.command=''node''' -c '${base.replace(/'/g, "''")}' -c '${envVars.replace(/'/g, "''")}' -c mcp_servers.bat.tool_timeout_sec=60`,
      mcp: true,
      hooks: false, // T0590: claude only
    })
    expect(buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'posix' })).toMatchObject({
      args: `-c 'mcp_servers.bat.command='\\''node'\\''' -c '${base.replace(/'/g, "'\\''")}' -c '${envVars.replace(/'/g, "'\\''")}' -c mcp_servers.bat.tool_timeout_sec=60`,
    })
    expect(buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'cmd' })).toMatchObject({
      args: `-c "mcp_servers.bat.command='node'" -c "${base}" -c "${envVars}" -c mcp_servers.bat.tool_timeout_sec=60`,
    })
    // codex never writes the claude file
    expect(fs.existsSync(configFile())).toBe(false)
  })

  it('headless-style absolute node', () => {
    const r = buildBatMcpLaunchArgs(host({ nodeCommand: () => '/home/u/.local/share/bat-server/bin/node' }), { agentId: 'codex-cli', shellFamily: 'posix' })
    expect(r.injected && r.args).toContain("mcp_servers.bat.command='\\''/home/u/.local/share/bat-server/bin/node'\\''")
  })

  it('off in Settings → nothing (and no file)', () => {
    expect(buildBatMcpLaunchArgs(host({}, { batMcpEnabled: false }), { agentId: 'claude-cli', shellFamily: 'pwsh' }))
      .toEqual({ injected: false, kind: 'claude', reason: 'turned off in Settings', nameReason: 'no-name' })
    expect(fs.existsSync(configFile())).toBe(false)
    expect(isBatMcpEnabled(null)).toBe(true)
    expect(isBatMcpEnabled({})).toBe(true)
    expect(isBatMcpEnabled({ batMcpEnabled: 'false' })).toBe(true)
    expect(isBatMcpEnabled({ batMcpEnabled: false })).toBe(false)
  })

  it('custom args that already attach MCP → not injected', () => {
    for (const extraArgs of ['--mcp-config my.json', '--model opus --mcp-config=my.json', '--mcp-config']) {
      expect(buildBatMcpLaunchArgs(host(), { agentId: 'claude-cli', shellFamily: 'posix', extraArgs }))
        .toMatchObject({ injected: false, reason: 'custom args already pass --mcp-config' })
    }
    expect(userArgsAttachBatMcp('claude', '--strict-mcp-config')).toBeNull()
    expect(userArgsAttachBatMcp('claude', '--mcp-configx')).toBeNull()
    expect(buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'posix', extraArgs: '-c mcp_servers.bat.command=foo' }))
      .toMatchObject({ injected: false, reason: 'custom args already define mcp_servers.bat' })
    // another server name is not ours
    expect(buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'posix', extraArgs: '-c mcp_servers.other.command=x' }))
      .toMatchObject({ injected: true })
  })

  it('RemoteServer not listening / shim missing / no helper dir → not injected', () => {
    expect(buildBatMcpLaunchArgs(host({ endpointReady: () => false }), { agentId: 'claude-cli', shellFamily: 'posix' }))
      .toMatchObject({ injected: false, reason: expect.stringContaining('RemoteServer not listening') })
    fs.rmSync(shim())
    expect(buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'posix' }))
      .toMatchObject({ injected: false, reason: expect.stringContaining('bat-mcp.mjs not found') })
    expect(buildBatMcpLaunchArgs(host({ helperDir: () => undefined }), { agentId: 'codex-cli', shellFamily: 'posix' }))
      .toMatchObject({ injected: false })
  })

  it('other agents are never touched', () => {
    for (const agentId of ['gemini-cli', 'claude-code', 'codex-agent', 'none', 'my-custom-cli']) {
      expect(batMcpAgentKind(agentId)).toBeNull()
      expect(buildBatMcpLaunchArgs(host(), { agentId, shellFamily: 'posix' })).toMatchObject({ injected: false })
    }
  })

  it('tomlString: literal unless the value holds a quote', () => {
    expect(tomlString('C:\\Program Files\\x.mjs')).toBe("'C:\\Program Files\\x.mjs'")
    expect(tomlString("/home/o'neil/x")).toBe('"/home/o\'neil/x"')
    expect(tomlString('a"b\\c\'')).toBe('"a\\"b\\\\c\'"')
    expect(claudeMcpConfigContent({ command: 'node', args: ['x'] }).endsWith('\n')).toBe(true)
  })
})

describe('agent:bat-mcp-launch-args handler', () => {
  it('returns the args string, "" when not injected; logs each decision', async () => {
    const handlers = new Map<string, SharedHandler>()
    const logs: string[] = []
    registerBatMcpHandlers((channel, handler) => { handlers.set(channel, handler) }, host({ logger: { log: m => logs.push(m), warn: m => logs.push(m) } }))
    const call = (...args: unknown[]) => handlers.get(BAT_MCP_LAUNCH_ARGS_CHANNEL)!({ windowId: 'w' }, ...args)
    expect(await call('claude-cli', 'pwsh', '')).toBe(`'--mcp-config=${configFile()}'`)
    expect(await call('codex-cli', 'bogus-family', '--yolo')).toMatch(/^-c 'mcp_servers\.bat\.command=/)
    expect(await call('claude-cli', 'pwsh', '--mcp-config x.json')).toBe('')
    expect(await call(42)).toBe('')
    expect(await call('gemini-cli', 'posix')).toBe('')
    expect(logs).toEqual([
      expect.stringMatching(/^\[bat-mcp\] tab agent=claude-cli → injected: '--mcp-config=/),
      expect.stringMatching(/^\[bat-mcp\] tab agent=codex-cli → injected: -c /),
      // T0590: + whether the hooks went in
      // T0641: + whether the session name went in
      `[bat-mcp] tab agent=claude-cli → not injected (custom args already pass --mcp-config); hooks=no (bat-hook.mjs not found in ${helperDir}); name=no (no-name)`,
    ])
    expect(logs.join('\n')).not.toContain(TOKEN)
  })
})

describe('headless host (T0584)', () => {
  function hostDeps(settings: Record<string, unknown> = {}): HostDeps {
    return { emit: () => {}, dataDir, homeDir: dir, getSettings: () => settings }
  }

  it('the bundle node and <installRoot>/scripts; config under <dataDir>/bat-mcp', () => {
    const installRoot = path.join(dir, 'bundle')
    const scripts = path.join(installRoot, 'scripts')
    fs.mkdirSync(path.join(installRoot, 'bin'), { recursive: true })
    fs.mkdirSync(scripts, { recursive: true })
    for (const name of ['bat-terminal.mjs', 'bat-notify.mjs', 'bat-mcp.mjs']) fs.writeFileSync(path.join(scripts, name), '')
    fs.writeFileSync(path.join(installRoot, 'bin', 'node'), '')
    const h = createHeadlessBatMcpHost(installRoot, hostDeps())
    expect(buildBatMcpLaunchArgs(h, { agentId: 'claude-cli', shellFamily: 'posix' })).toMatchObject({ injected: true })
    expect(JSON.parse(fs.readFileSync(configFile(), 'utf8')).mcpServers.bat).toEqual({
      type: 'stdio', command: path.join(installRoot, 'bin', 'node'), args: [path.join(scripts, 'bat-mcp.mjs')],
    })
    // Settings off on the server
    expect(buildBatMcpLaunchArgs(createHeadlessBatMcpHost(installRoot, hostDeps({ batMcpEnabled: false })), { agentId: 'codex-cli', shellFamily: 'posix' }))
      .toMatchObject({ injected: false, reason: 'turned off in Settings' })
    // no bundle node → `node`
    fs.rmSync(path.join(installRoot, 'bin', 'node'))
    expect(buildBatMcpLaunchArgs(createHeadlessBatMcpHost(installRoot, hostDeps()), { agentId: 'codex-cli', shellFamily: 'posix' }))
      .toMatchObject({ injected: true, args: expect.stringContaining("command='\\''node'\\''") })
    // a bundle without the helpers (pre-T0433 / JS-only deploy) has no endpoint in its tabs
    fs.rmSync(path.join(scripts, 'bat-notify.mjs'))
    expect(buildBatMcpLaunchArgs(createHeadlessBatMcpHost(installRoot, hostDeps()), { agentId: 'codex-cli', shellFamily: 'posix' }))
      .toMatchObject({ injected: false })
  })
})

describe('helper dispatch (createAgentPromptCommandBuilder)', () => {
  const CLAUDE_BASE = "& 'C:\\BAT\\claude.exe'"
  function builder(settings: AgentCommandSettings | null, withMcp: BatMcpHost | null) {
    return createAgentPromptCommandBuilder({
      readSettings: () => settings,
      resolveWorkspaceAgentSettings: async () => null,
      ensureElevationApplied: async () => {},
      buildLaunchCommand: (agentId, extraArgs) => agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs),
      resolveClaudeBaseCommand: async () => CLAUDE_BASE,
      ...(withMcp ? { batMcpLaunchArgs: createBatMcpLaunchArgs(withMcp, 'dispatch') } : {}),
      logger: { warn: vi.fn() },
    })
  }
  const settings: AgentCommandSettings = { agentCustomArgs: { 'claude-cli': '--dangerously-skip-permissions', 'codex-cli': '--yolo' } }

  it('claude: base, --mcp-config=…, custom args, prompt', async () => {
    const r = await builder(settings, host())({ skill: 'ct-exec', workorder: 'T0584', agent: 'claude-cli', shellFamily: 'pwsh' })
    expect(r?.command).toBe(`${CLAUDE_BASE} '--mcp-config=${configFile()}' --dangerously-skip-permissions '/ct-exec T0584'`)
  })

  it('codex: -c overrides before the custom args', async () => {
    const r = await builder(settings, host())({ skill: 'ct-exec', workorder: 'T0584', agent: 'codex-cli', shellFamily: 'posix' })
    expect(r?.command).toMatch(/^codex -c 'mcp_servers\.bat\.command=.* -c 'mcp_servers\.bat\.env_vars=\[.*\]' -c mcp_servers\.bat\.tool_timeout_sec=60 -c check_for_update_on_startup=false --yolo '\$ct-exec T0584'$/)
  })

  it('off in Settings / no dep → the pre-T0584 command, byte for byte', async () => {
    for (const agent of ['claude-cli', 'codex-cli', 'gemini-cli']) {
      const opts = { prompt: 'hi there', agent, shellFamily: 'pwsh' as const }
      const without = await builder(settings, null)(opts)
      const off = await builder({ ...settings, ...{ batMcpEnabled: false } } as AgentCommandSettings, host({}, { batMcpEnabled: false }))(opts)
      expect(off?.command, agent).toBe(without?.command)
    }
    const plain = await builder(settings, null)({ prompt: 'hi', agent: 'claude-cli', shellFamily: 'posix' })
    expect(plain?.command).toBe(`${CLAUDE_BASE} --dangerously-skip-permissions hi`)
  })

  it('custom args with --mcp-config → not injected', async () => {
    const r = await builder({ agentCustomArgs: { 'claude-cli': '--mcp-config mine.json' } }, host())({ prompt: 'hi', agent: 'claude-cli', shellFamily: 'posix' })
    expect(r?.command).toBe(`${CLAUDE_BASE} --mcp-config mine.json hi`)
  })
})

describe('source guards', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

  it('raw command mode (terminal:create-with-command) never injects', () => {
    const source = read('electron/terminal-command-handlers.ts')
    // the only use is inside createAgentPromptCommandBuilder
    expect(source.match(/batMcpLaunchArgs\?\.\(/g)).toHaveLength(1)
    const builderStart = source.indexOf('export function createAgentPromptCommandBuilder')
    expect(source.indexOf('deps.batMcpLaunchArgs?.(')).toBeGreaterThan(builderStart)
  })

  it('main.ts and headless wire the dispatch builder and the handler', () => {
    const main = read('electron/main.ts')
    expect(main).toMatch(/batMcpLaunchArgs: request => createBatMcpLaunchArgs\(batMcpHost, 'dispatch'\)\(request\)/)
    expect(main).toMatch(/registerBatMcpHandlers\(registerHandler, batMcpHost\)/)
    expect(main).toMatch(/dataDir: \(\) => app\.getPath\('userData'\)/) // lazy (BUG-119 rule)
    const headless = read('electron/remote/headless-entry.ts')
    expect(headless).toMatch(/batMcpLaunchArgs, \/\/ T0584/)
    expect(headless).toMatch(/createHeadlessBatMcpModule\(\{ installRoot: opts\.installRoot, getPtyManager: \(\) => ptyManager \}\)/)
  })

  it('every renderer launch of a terminal-driven agent goes through withBatMcpLaunchArgs', () => {
    const view = read('src/components/WorkspaceView.tsx')
    const launches = view.match(/buildLaunchCommand\(/g) ?? []
    const wrapped = view.match(/buildLaunchCommand\([^\n]*\)(?:\.then\(\(cmd: string \| null\) =>|\s*\n\s*\.then\(cmd =>)\s*\n?\s*cmd \? withBatMcpLaunchArgs\(/g) ?? []
    expect(launches.length).toBe(4)
    expect(wrapped.length).toBe(4)
    expect(view).toMatch(/const cmdParts = \[await withBatMcpLaunchArgs\(quoteCommandPath\(cliPath/)
  })
})
