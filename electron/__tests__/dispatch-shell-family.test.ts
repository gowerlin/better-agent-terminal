// @vitest-environment node
/**
 * BUG-149 / T0593: the shell family `terminal:create-agent-command` quotes for.
 *
 * settings.json without `shell` (a fresh install that never saved a setting) used to resolve to
 * basename `pty-default` → `detectShellFamily` = posix, while the Windows PTY starts pwsh
 * (`PtyManager.getDefaultShell`). The posix-quoted codex `-c` TOML values split in pwsh and the
 * Worker's codex exited at once; the posix-quoted claude path (`'C:\…\claude.exe'`) is a string
 * expression in pwsh, not a command.
 *
 *   - missing key / null settings / `custom` with an empty path: family of
 *     `ptyManager.getDefaultShell()` — the same function `create` uses when it gets no `shell`
 *     (`create` still gets no `shell`)
 *   - `auto` / `pwsh` / `git-bash` / `cmd`: unchanged (the persisted shell, passed to `create`)
 *   - codex `-c` and claude base command quoted for that family
 *   - a real PtyManager: Windows → pwsh, Linux / macOS → posix (headless unchanged)
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-command-handlers / pty-manager must not import electron')
})

import { buildBatMcpLaunchArgs, type BatMcpHost } from '../bat-mcp-launch'
import { PtyManager } from '../pty-manager'
import { createAgentPromptCommandBuilder, registerTerminalCommandHandlers } from '../terminal-command-handlers'
import type { PersistedShellSettings } from '../shell-path-resolver'
import { detectShellFamily, quoteCommandPath, type ShellFamily } from '../../src/utils/shell-quote'

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

const ROOT = path.resolve(__dirname, '..', '..')
const WIN_PWSH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
const WIN_GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'
const CLAUDE_EXE = 'C:\\Program Files\\BAT\\claude.exe'

let dir: string
let helperDir: string
let dataDir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0593-shell-'))
  helperDir = path.join(dir, 'Program Files', 'BAT', 'scripts')
  dataDir = path.join(dir, 'userData')
  fs.mkdirSync(helperDir, { recursive: true })
  fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '// shim\n')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function mcpHost(): BatMcpHost {
  return {
    dataDir: () => dataDir,
    helperDir: () => helperDir,
    nodeCommand: () => 'node',
    endpointReady: () => true,
    readSettings: () => ({}),
    platform: 'win32',
  }
}

interface DispatchOptions {
  settings: PersistedShellSettings | null
  defaultShell: string | (() => string) | null
  agent: 'codex' | 'claude-cli'
  platform?: NodeJS.Platform
  existsSync?: (p: string) => boolean
}

async function dispatch(opts: DispatchOptions) {
  const handlers = new Map<string, Handler>()
  const created: Array<{ shell?: string }> = []
  const written: string[] = []
  const families: Array<ShellFamily | undefined> = []
  const logs: string[] = []
  const getDefaultShell = typeof opts.defaultShell === 'function'
    ? opts.defaultShell
    : opts.defaultShell === null ? undefined : (() => opts.defaultShell as string)
  const buildAgentPromptCommand = createAgentPromptCommandBuilder({
    readSettings: () => ({}),
    resolveWorkspaceAgentSettings: async () => null,
    ensureElevationApplied: async () => {},
    buildLaunchCommand: agentId => (agentId === 'codex-cli' ? 'codex' : null),
    resolveClaudeBaseCommand: async family => quoteCommandPath(CLAUDE_EXE, family ?? 'posix'),
    batMcpLaunchArgs: request => buildBatMcpLaunchArgs(mcpHost(), request),
    logger: { warn: () => undefined },
  })
  registerTerminalCommandHandlers({
    registerHandler(channel, handler) {
      handlers.set(channel, handler as Handler)
    },
    getPtyManager() {
      return {
        isAlive: () => false,
        create: (o: { shell?: string }) => {
          created.push({ shell: o.shell })
          return true
        },
        write: (_id: string, data: string) => {
          written.push(data)
        },
        ...(getDefaultShell ? { getDefaultShell } : {}),
      }
    },
    getAllWindows: () => [],
    readPersistedSettingsSync: () => opts.settings,
    buildAgentPromptCommand: async o => {
      families.push(o.shellFamily)
      return buildAgentPromptCommand(o)
    },
    pickWhitelistedEnv: () => ({}),
    mirrorToBatScripts: () => undefined,
    logger: { log: (...a: unknown[]) => { logs.push(a.join(' ')) }, warn: () => undefined },
    platform: opts.platform ?? 'win32',
    env: { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' },
    existsSync: opts.existsSync ?? (p => p === WIN_PWSH || p === WIN_GIT_BASH),
    setTimeout: (callback: () => void) => {
      callback()
      return 0
    },
  })
  const handler = handlers.get('terminal:create-agent-command')
  if (!handler) throw new Error('terminal:create-agent-command was not registered')
  const result = await handler({ windowId: null }, {
    id: 'worker-1',
    cwd: 'D:\\repo',
    skill: 'ct-exec',
    workorder: 'T0593',
    agent: opts.agent,
  })
  expect(result).toBe(true)
  expect(written).toHaveLength(1)
  return { family: families[0], createdShell: created[0]?.shell, command: written[0].replace(/\r$/, ''), logs }
}

function codexArgs(family: ShellFamily): string {
  const r = buildBatMcpLaunchArgs(mcpHost(), { agentId: 'codex-cli', shellFamily: family })
  if (!r.injected) throw new Error('codex BAT MCP args not injected')
  return r.args
}

describe('BUG-149: settings.json without "shell" (Windows)', () => {
  it.each([
    ['no shell key', {} as PersistedShellSettings],
    ['no settings.json', null],
    ['custom with an empty path', { shell: 'custom', customShellPath: '  ' }],
  ])('%s → the PtyManager default shell (pwsh): codex -c quoted for pwsh, create gets no shell', async (_label, settings) => {
    const r = await dispatch({ settings, defaultShell: WIN_PWSH, agent: 'codex' })
    expect(r.family).toBe('pwsh')
    expect(r.createdShell).toBeUndefined()
    expect(r.command).toBe(`codex ${codexArgs('pwsh')} '$ct-exec T0593'`)
    // the pre-fix posix form (`'\''`) is gone
    expect(r.command).not.toContain("'\\''")
    expect(r.logs.some(l => l.includes('[agent-command] id=worker-1 shell family=pwsh from=pty-default:pwsh.exe'))).toBe(true)
  })

  it('Windows PowerShell 5 default (powershell.exe) → pwsh', async () => {
    const r = await dispatch({ settings: {}, defaultShell: 'powershell.exe', agent: 'codex' })
    expect(r.family).toBe('pwsh')
  })

  it('claude-cli: the claude path is run with the pwsh call operator', async () => {
    const r = await dispatch({ settings: {}, defaultShell: WIN_PWSH, agent: 'claude-cli' })
    expect(r.family).toBe('pwsh')
    expect(r.command.startsWith(`& '${CLAUDE_EXE}' `)).toBe(true)
    expect(r.command.endsWith(' /ct-exec T0593') || r.command.endsWith(" '/ct-exec T0593'")).toBe(true)
  })

  it('no PtyManager default shell available → pty-default (posix), as before', async () => {
    const r = await dispatch({ settings: {}, defaultShell: null, agent: 'codex' })
    expect(r.family).toBe('posix')
    expect(r.logs.some(l => l.includes('shell family=posix from=pty-default'))).toBe(true)
  })
})

describe('a persisted shell is unchanged (the default shell is not consulted)', () => {
  const notConsulted = () => {
    throw new Error('getDefaultShell must not be called when a shell is persisted')
  }
  it.each([
    ['auto', { shell: 'auto' }, 'pwsh', WIN_PWSH],
    ['pwsh', { shell: 'pwsh' }, 'pwsh', WIN_PWSH],
    ['git-bash', { shell: 'git-bash' }, 'posix', WIN_GIT_BASH],
    ['cmd', { shell: 'cmd' }, 'cmd', 'cmd.exe'],
    ['custom path', { shell: 'custom', customShellPath: 'C:\\Tools\\bash.exe' }, 'posix', 'C:\\Tools\\bash.exe'],
  ] satisfies Array<[string, PersistedShellSettings, ShellFamily, string]>)('%s → %s', async (_label, settings, family, shellPath) => {
    const r = await dispatch({ settings, defaultShell: notConsulted, agent: 'codex' })
    expect(r.family).toBe(family)
    expect(r.createdShell).toBe(shellPath)
    expect(r.command).toBe(`codex ${codexArgs(family)} ${family === 'cmd' ? '"$ct-exec T0593"' : "'$ct-exec T0593'"}`)
  })
})

describe('the family follows the real PtyManager.getDefaultShell', () => {
  const realPlatform = process.platform
  const realShell = process.env.SHELL
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform })
    if (realShell === undefined) delete process.env.SHELL
    else process.env.SHELL = realShell
  })

  function realDefault() {
    const manager = new PtyManager({ emit: () => undefined, dataDir: ROOT })
    return () => manager.getDefaultShell()
  }

  it('Windows → pwsh (pwsh.exe, or powershell.exe without PowerShell 7)', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const getDefault = realDefault()
    const shell = getDefault()
    expect(detectShellFamily(shell)).toBe('pwsh')
    const r = await dispatch({ settings: {}, defaultShell: getDefault, agent: 'codex' })
    expect(r.family).toBe(detectShellFamily(shell))
    expect(r.createdShell).toBeUndefined()
  })

  it.each([
    ['linux', '/bin/bash'],
    ['darwin', '/bin/zsh'],
  ] satisfies Array<[NodeJS.Platform, string]>)('%s ($SHELL=%s) → posix (headless unchanged)', async (platform, shell) => {
    Object.defineProperty(process, 'platform', { value: platform })
    process.env.SHELL = shell
    const getDefault = realDefault()
    expect(getDefault()).toBe(shell)
    const r = await dispatch({ settings: {}, defaultShell: getDefault, agent: 'codex', platform, existsSync: () => false })
    expect(r.family).toBe('posix')
    expect(r.command).toBe(`codex ${codexArgs('posix')} '$ct-exec T0593'`)
  })
})

describe('source guards', () => {
  it('create starts getDefaultShell() without a shell; create-agent-command quotes for the same function', () => {
    const pty = fs.readFileSync(path.join(ROOT, 'electron', 'pty-manager.ts'), 'utf8')
    expect(pty).toContain('const shell = shellOverride || this.getDefaultShell()')
    const handlers = fs.readFileSync(path.join(ROOT, 'electron', 'terminal-command-handlers.ts'), 'utf8')
    expect(handlers).toContain('const quoting = quotingShell(shellResolution, deps.getPtyManager())')
    expect(handlers).toContain('ptyManager?.getDefaultShell?.()')
    // no parallel default-shell inference of its own
    expect(handlers).not.toMatch(/PowerShell\\\\7|pwsh\.exe'/)
  })
})
