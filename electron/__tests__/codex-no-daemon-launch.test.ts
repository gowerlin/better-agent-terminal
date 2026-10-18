// @vitest-environment node
/**
 * T0651 / BUG-159: a codex tab that gets no BAT MCP args gets `--no-daemon` (codex >= 0.156.0), so
 * it does not run on codex's shared app-server daemon, whose shell commands / MCP servers carry
 * another tab's `BAT_*` (T0648).
 *
 *   - createCodexNoDaemonSupportCheck / codexVersionAtLeast: version gate, unknown → no
 *   - buildBatMcpLaunchArgs: MCP injected → unchanged (the non-features `-c` keep codex embedded);
 *     no MCP + supported → `--no-daemon`; too old / unknown / not checked / custom args → none
 *   - agent:bat-mcp-launch-args: asks the check only for a codex tab without MCP; position before a
 *     `resume` subcommand in the custom args (with and without the elevated flag)
 *   - helper dispatch: command line unchanged, the check never asked
 *   - source guards
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
  CODEX_NO_DAEMON_ARG,
  buildBatMcpLaunchArgs,
  codexMcpOverrides,
  createBatMcpLaunchArgs,
  needsCodexNoDaemonSupport,
  registerBatMcpHandlers,
  type BatMcpHost,
} from '../bat-mcp-launch'
import {
  CODEX_NO_DAEMON_MIN_VERSION,
  codexVersionAtLeast,
  createCodexNoDaemonSupportCheck,
  type CodexNoDaemonSupport,
  type ExecFileLike,
} from '../codex-osc-version'
import { agentRegistry, codexArgsRuleOutNoDaemon, CODEX_DISABLE_DAEMON_ARGS } from '../agent-runtime/agent-registry'
import { createAgentPromptCommandBuilder, type AgentCommandSettings } from '../terminal-command-handlers'
import type { SharedHandler } from '../handlers/types'

const ROOT = path.resolve(__dirname, '..', '..')
const SUPPORTED: CodexNoDaemonSupport = { inject: true, version: '0.163.0' }

let dir: string
let helperDir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0651-no-daemon-'))
  helperDir = path.join(dir, 'scripts')
  fs.mkdirSync(helperDir, { recursive: true })
  fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '// shim\n')
})

afterEach(() => {
  agentRegistry.setElevated(false)
  fs.rmSync(dir, { recursive: true, force: true })
})

function host(overrides: Partial<BatMcpHost> = {}, settings: Record<string, unknown> | null = {}): BatMcpHost {
  return {
    dataDir: () => path.join(dir, 'userData'),
    helperDir: () => helperDir,
    nodeCommand: () => 'node',
    endpointReady: () => true,
    readSettings: () => settings,
    claudeSettingsFiles: () => [],
    ...overrides,
  }
}

const OFF = { batMcpEnabled: false }

describe('createCodexNoDaemonSupportCheck', () => {
  function check(stdout: string | null, opts: { platform?: NodeJS.Platform; files?: string[]; pathValue?: string } = {}) {
    const calls: string[] = []
    const lines: string[] = []
    const execFile: ExecFileLike = (file, _args, _options, callback) => {
      calls.push(file)
      if (stdout === null) callback(new Error('timed out'), '', '')
      else callback(null, stdout, '')
      return undefined
    }
    const files = opts.files ?? ['/usr/bin/codex']
    const run = createCodexNoDaemonSupportCheck({
      platform: opts.platform ?? 'linux',
      env: { PATH: opts.pathValue ?? '/usr/bin' },
      isFile: p => files.includes(p),
      mtimeMs: () => 1,
      execFile,
      logger: { log: m => lines.push(m) },
    })
    return { run, calls, lines }
  }

  it('the gate is 0.156.0 (codex rust-v0.156.0 added --no-daemon)', () => {
    expect(CODEX_NO_DAEMON_MIN_VERSION).toBe('0.156.0')
    expect(codexVersionAtLeast('0.156.0', '0.156.0')).toBe(true)
    expect(codexVersionAtLeast('0.163.0', '0.156.0')).toBe(true)
    expect(codexVersionAtLeast('1.0.0', '0.156.0')).toBe(true)
    expect(codexVersionAtLeast('0.155.1', '0.156.0')).toBe(false)
    expect(codexVersionAtLeast('0.133.0', '0.156.0')).toBe(false)
    expect(codexVersionAtLeast('0.156.0-alpha.3', '0.156.0')).toBe(false) // a pre-release of the gate
    expect(codexVersionAtLeast('0.157.0-alpha.1', '0.156.0')).toBe(true)
    expect(codexVersionAtLeast('garbage', '0.156.0')).toBe(false)
  })

  it('>= 0.156.0 → inject; older → codex-too-old; cached by path + mtime', async () => {
    const ok = check('codex-cli 0.163.0\n')
    expect(await ok.run()).toEqual({ inject: true, version: '0.163.0' })
    expect(await ok.run()).toEqual({ inject: true, version: '0.163.0' })
    expect(ok.calls).toEqual(['/usr/bin/codex'])
    expect(ok.lines).toEqual([
      '[codex-version] path=/usr/bin/codex version=0.163.0 (probed)',
      '[codex-version] path=/usr/bin/codex version=0.163.0 (cached)',
    ])
    expect(await check('codex-cli 0.155.1').run()).toEqual({ inject: false, reason: 'codex-too-old', version: '0.155.1' })
  })

  it('no readable version → version-unknown (never injected)', async () => {
    expect(await check(null).run()).toEqual({ inject: false, reason: 'version-unknown' })
    expect(await check('something else').run()).toEqual({ inject: false, reason: 'version-unknown' })
    const none = check('codex-cli 0.163.0', { files: [] })
    expect(await none.run()).toEqual({ inject: false, reason: 'version-unknown' })
    expect(none.calls).toEqual([])
    // Windows: an npm shim first on PATH cannot run without a shell
    const shim = check('codex-cli 0.163.0', { platform: 'win32', files: ['C:\\npm\\codex.cmd', 'C:\\Codex\\codex.exe'], pathValue: 'C:\\npm;C:\\Codex' })
    expect(await shim.run()).toEqual({ inject: false, reason: 'version-unknown' })
    expect(shim.calls).toEqual([])
    const exe = check('codex-cli 0.163.0', { platform: 'win32', files: ['C:\\Codex\\codex.exe', 'C:\\npm\\codex.cmd'], pathValue: 'C:\\Codex;C:\\npm' })
    expect(await exe.run()).toEqual({ inject: true, version: '0.163.0' })
  })
})

describe('buildBatMcpLaunchArgs (codex)', () => {
  it('MCP injected → the args do not change and hold only non-features -c (embedded), no --no-daemon', () => {
    const plain = buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'posix' })
    const checked = buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'posix', codexNoDaemon: SUPPORTED })
    expect(checked).toEqual(plain)
    expect(checked).toMatchObject({ injected: true, mcp: true })
    expect(checked.injected && checked.args).not.toContain(CODEX_NO_DAEMON_ARG)
    expect(checked).not.toHaveProperty('noDaemon')
    // the invariant BAT relies on (codex `config_exclusion`): every override is outside `features.*`
    const values = codexMcpOverrides({ command: 'node', args: ['x'] })
    expect(values.length).toBeGreaterThan(0)
    for (const value of values) {
      expect(value).toMatch(/^mcp_servers\.bat\./)
      expect(value).not.toMatch(/^features\./)
    }
    expect((checked.injected ? checked.args : '').match(/-c /g)).toHaveLength(values.length)
  })

  it('no MCP + supported → --no-daemon, the only arg', () => {
    expect(buildBatMcpLaunchArgs(host({}, OFF), { agentId: 'codex-cli', shellFamily: 'pwsh', codexNoDaemon: SUPPORTED }))
      .toEqual({ injected: true, kind: 'codex', args: '--no-daemon', mcp: false, hooks: false, mcpReason: 'turned off in Settings', noDaemon: true })
    expect(buildBatMcpLaunchArgs(host({ endpointReady: () => false }), { agentId: 'codex-cli', shellFamily: 'cmd', codexNoDaemon: SUPPORTED }))
      .toEqual({ injected: true, kind: 'codex', args: '--no-daemon', mcp: false, hooks: false, mcpReason: expect.stringContaining('RemoteServer not listening'), noDaemon: true })
    fs.rmSync(path.join(helperDir, 'bat-mcp.mjs'))
    expect(buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily: 'posix', codexNoDaemon: SUPPORTED }))
      .toMatchObject({ injected: true, args: '--no-daemon', mcpReason: expect.stringContaining('bat-mcp.mjs not found'), noDaemon: true })
    expect(buildBatMcpLaunchArgs(host({ helperDir: () => undefined }), { agentId: 'codex-cli', shellFamily: 'posix', codexNoDaemon: SUPPORTED }))
      .toMatchObject({ injected: true, args: '--no-daemon' })
  })

  it('too old / unknown / not checked → not injected, the reason recorded', () => {
    const cases: Array<[CodexNoDaemonSupport | undefined, string]> = [
      [{ inject: false, reason: 'codex-too-old', version: '0.150.0' }, 'codex-too-old'],
      [{ inject: false, reason: 'version-unknown' }, 'version-unknown'],
      [undefined, 'not-checked'],
    ]
    for (const [codexNoDaemon, reason] of cases) {
      expect(buildBatMcpLaunchArgs(host({}, OFF), { agentId: 'codex-cli', shellFamily: 'posix', codexNoDaemon }))
        .toEqual({ injected: false, kind: 'codex', reason: 'turned off in Settings', noDaemonReason: reason })
      expect(buildBatMcpLaunchArgs(host({ endpointReady: () => false }), { agentId: 'codex-cli', shellFamily: 'posix', codexNoDaemon }))
        .toMatchObject({ injected: false, noDaemonReason: reason })
    }
  })

  it('custom args with --no-daemon / daemon_auto_start / --remote → user-args', () => {
    for (const extraArgs of ['--no-daemon', '--yolo --no-daemon', '-c features.daemon_auto_start=false', '--disable daemon_auto_start', '--remote ws://127.0.0.1:4500', '--remote=unix://', 'resume --last --remote ws://h:1']) {
      expect(codexArgsRuleOutNoDaemon(extraArgs), extraArgs).toBe(true)
      expect(buildBatMcpLaunchArgs(host({}, OFF), { agentId: 'codex-cli', shellFamily: 'posix', extraArgs, codexNoDaemon: SUPPORTED }), extraArgs)
        .toMatchObject({ injected: false, noDaemonReason: 'user-args' })
    }
    for (const extraArgs of [undefined, '', '--yolo', 'resume --last', '--remote-auth-token-env TOKEN']) {
      expect(codexArgsRuleOutNoDaemon(extraArgs), String(extraArgs)).toBe(false)
    }
  })

  it('claude and other agents never get --no-daemon', () => {
    for (const agentId of ['claude-cli', 'claude-cli-worktree', 'gemini-cli', 'codex-agent']) {
      const r = buildBatMcpLaunchArgs(host({}, OFF), { agentId, shellFamily: 'posix', codexNoDaemon: SUPPORTED })
      expect(r.injected && r.args, agentId).not.toBe(CODEX_NO_DAEMON_ARG)
      expect(r, agentId).not.toHaveProperty('noDaemon')
      expect(r, agentId).not.toHaveProperty('noDaemonReason')
    }
  })

  it('needsCodexNoDaemonSupport: codex, no MCP, custom args leave it to BAT', () => {
    expect(needsCodexNoDaemonSupport(host(), { agentId: 'codex-cli', shellFamily: 'posix' })).toBe(false)
    expect(needsCodexNoDaemonSupport(host({}, OFF), { agentId: 'codex-cli', shellFamily: 'posix' })).toBe(true)
    expect(needsCodexNoDaemonSupport(host({ endpointReady: () => false }), { agentId: 'codex-cli', shellFamily: 'posix' })).toBe(true)
    expect(needsCodexNoDaemonSupport(host({}, OFF), { agentId: 'codex-cli', shellFamily: 'posix', extraArgs: '--no-daemon' })).toBe(false)
    expect(needsCodexNoDaemonSupport(host({}, OFF), { agentId: 'claude-cli', shellFamily: 'posix' })).toBe(false)
  })
})

describe('agent:bat-mcp-launch-args handler (codex tab)', () => {
  function handler(h: BatMcpHost) {
    const handlers = new Map<string, SharedHandler>()
    registerBatMcpHandlers((channel, fn) => { handlers.set(channel, fn) }, h)
    return (...args: unknown[]) => handlers.get(BAT_MCP_LAUNCH_ARGS_CHANNEL)!({ windowId: 'w' }, ...args)
  }

  it('MCP on: the check is never asked, the args are the pre-T0651 ones', async () => {
    const support = vi.fn(async () => SUPPORTED)
    const args = await handler(host({ codexNoDaemonSupport: support }))('codex-cli', 'posix', '--yolo')
    expect(args).toMatch(/^-c 'mcp_servers\.bat\.command=/)
    expect(args).not.toContain(CODEX_NO_DAEMON_ARG)
    expect(support).not.toHaveBeenCalled()
  })

  it('MCP off + supported → --no-daemon before a resume subcommand (with and without the elevated flag)', async () => {
    const support = vi.fn(async () => SUPPORTED)
    const lines: string[] = []
    const call = handler(host({ codexNoDaemonSupport: support, logger: { log: m => lines.push(m), warn: m => lines.push(m) } }, OFF))
    const extra = 'resume --last'
    // what WorkspaceView does: base, then the host args, then the custom args
    const compose = async () => {
      const base = agentRegistry.buildLaunchCommand('codex-cli', undefined, extra)!
      const args = await call('codex-cli', 'pwsh', extra, 'tab-1')
      return `${args ? `${base} ${args}` : base} ${extra}`
    }
    expect(await compose()).toBe('codex --no-daemon resume --last')
    agentRegistry.setElevated(true)
    expect(await compose()).toBe(`codex ${CODEX_DISABLE_DAEMON_ARGS.join(' ')} --no-daemon resume --last`)
    expect(support).toHaveBeenCalledTimes(2)
    expect(lines[0]).toBe('[bat-mcp] tab agent=codex-cli terminal=tab-1 → injected: --no-daemon; mcp=no (turned off in Settings)')
  })

  it('MCP off + too old / custom --no-daemon / no check on the host → ""', async () => {
    const lines: string[] = []
    const logger = { log: (m: string) => lines.push(m), warn: (m: string) => lines.push(m) }
    expect(await handler(host({ codexNoDaemonSupport: async () => ({ inject: false, reason: 'codex-too-old', version: '0.150.0' }), logger }, OFF))('codex-cli', 'posix', '')).toBe('')
    const support = vi.fn(async () => SUPPORTED)
    expect(await handler(host({ codexNoDaemonSupport: support, logger }, OFF))('codex-cli', 'posix', '--no-daemon')).toBe('')
    expect(support).not.toHaveBeenCalled()
    expect(await handler(host({ logger }, OFF))('codex-cli', 'posix', '')).toBe('')
    expect(await handler(host({ codexNoDaemonSupport: async () => { throw new Error('boom') }, logger }, OFF))('codex-cli', 'posix', '')).toBe('')
    expect(lines).toEqual([
      '[bat-mcp] tab agent=codex-cli → not injected (turned off in Settings); no-daemon=no (codex-too-old)',
      '[bat-mcp] tab agent=codex-cli → not injected (turned off in Settings); no-daemon=no (user-args)',
      '[bat-mcp] tab agent=codex-cli → not injected (turned off in Settings); no-daemon=no (not-checked)',
      '[bat-mcp] codex version check failed: boom',
      '[bat-mcp] tab agent=codex-cli → not injected (turned off in Settings); no-daemon=no (not-checked)',
    ])
  })
})

describe('helper dispatch (createAgentPromptCommandBuilder) is unchanged', () => {
  function builder(withMcp: BatMcpHost | null) {
    return createAgentPromptCommandBuilder({
      readSettings: () => settings,
      resolveWorkspaceAgentSettings: async () => null,
      ensureElevationApplied: async () => {},
      buildLaunchCommand: (agentId, extraArgs) => agentRegistry.buildLaunchCommand(agentId, undefined, extraArgs),
      ...(withMcp ? { batMcpLaunchArgs: createBatMcpLaunchArgs(withMcp, 'dispatch') } : {}),
      logger: { warn: vi.fn() },
    })
  }
  const settings: AgentCommandSettings = { agentCustomArgs: { 'codex-cli': '--yolo' } }

  it('no --no-daemon, the check never asked; still the non-features -c', async () => {
    const support = vi.fn(async () => SUPPORTED)
    const opts = { skill: 'ct-exec', workorder: 'T0651', agent: 'codex-cli', shellFamily: 'posix' as const }
    const without = await builder(null)(opts)
    for (const h of [host({ codexNoDaemonSupport: support }, OFF), host({ codexNoDaemonSupport: support, endpointReady: () => false })]) {
      const r = await builder(h)(opts)
      expect(r?.command).toBe(without?.command)
      expect(r?.command).not.toContain(CODEX_NO_DAEMON_ARG)
    }
    expect(without?.command).toBe("codex -c check_for_update_on_startup=false --yolo '$ct-exec T0651'")
    const on = await builder(host({ codexNoDaemonSupport: support }))(opts)
    expect(on?.command).toMatch(/^codex -c 'mcp_servers\.bat\.command=.* -c check_for_update_on_startup=false --yolo '\$ct-exec T0651'$/)
    expect(on?.command).not.toContain(CODEX_NO_DAEMON_ARG)
    expect(support).not.toHaveBeenCalled()
  })
})

describe('source guards (T0651)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

  it('only the tab handler asks the codex check; dispatch never does', () => {
    const launch = read('electron/bat-mcp-launch.ts')
    expect(launch.match(/await withCodexNoDaemonSupport\(/g)).toHaveLength(1)
    const registerStart = launch.indexOf('export function registerBatMcpHandlers')
    expect(launch.indexOf('await withCodexNoDaemonSupport(')).toBeGreaterThan(registerStart)
    expect(read('electron/terminal-command-handlers.ts')).not.toMatch(/codexNoDaemon|withCodexNoDaemonSupport/)
  })

  it('main.ts and headless give their BatMcpHost the codex check', () => {
    expect(read('electron/main.ts')).toMatch(/codexNoDaemonSupport: createCodexNoDaemonSupportCheck\(\{ logger \}\)/)
    expect(read('electron/remote/headless-entry.ts')).toMatch(/codexNoDaemonSupport: headlessCodexNoDaemonSupport/)
  })

  it('the dispatch keeps its non-features -c (check_for_update_on_startup)', () => {
    expect(read('electron/terminal-command-handlers.ts')).toMatch(/export const CODEX_DISPATCH_NO_UPDATE_CHECK = 'check_for_update_on_startup=false'/)
  })
})
