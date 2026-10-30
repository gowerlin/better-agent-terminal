// @vitest-environment node
/**
 * T0710 (3-1): the Codex CT prompt follows how CT is installed on the host — helper dispatch
 * (`createAgentPromptCommandBuilder` / `terminal:create-agent-command`) and the panel's one-click
 * dispatch (`terminal:control-tower-prompt`) use the same decision (electron/ct-install-detect.ts):
 *   - only the `ct` plugin → `$ct:ct-exec`; both / only manual / disabled → `$ct-exec`
 *   - no resolver on the host, a failing one → `$ct-exec`
 *   - raw prompts `/ct-exec …` and `/ct:ct-exec …` follow the same decision
 *   - claude stays `/ct-exec`
 *   - the tab's `customEnv.CODEX_HOME` reaches the decision
 *   - `$ct:ct-exec` is quoted so pwsh / cmd / bash pass it literally (checked with real shells
 *     when present)
 */
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-command-handlers / ct-install-detect must not import electron')
})

import { createCodexSkillNameResolver } from '../ct-install-detect'
import {
  CONTROL_TOWER_PROMPT_CHANNEL,
  createAgentPromptCommandBuilder,
  registerTerminalCommandHandlers,
  type AgentPromptCommandOptions,
  type CodexSkillNameResolver,
} from '../terminal-command-handlers'
import { PROXIED_CHANNELS } from '../remote/protocol'
import { PATH_FREE_CHANNELS } from '../remote/path-aware-channels'
import type { ControlTowerPromptResult } from '../../src/types/ct-dispatch-prompt'

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

const WIN_PWSH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
const WIN_CMD = 'C:\\Windows\\System32\\cmd.exe'
const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'

let root: string
let home: string

function write(file: string, content = 'x') {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function installPlugin(codexHome: string, enabled = true) {
  write(path.join(codexHome, 'plugins', 'cache', 'ct-test-mkt', 'ct', '0.0.1', 'skills', 'ct-exec', 'SKILL.md'))
  write(path.join(codexHome, 'config.toml'), `[plugins."ct@ct-test-mkt"]\nenabled = ${enabled}\n`)
}

function installManual(codexHome: string) {
  write(path.join(codexHome, 'skills', 'ct-exec', 'SKILL.md'))
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 't0710-dispatch-'))
  home = path.join(root, 'home')
  fs.mkdirSync(home, { recursive: true })
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function resolver(env: Record<string, string> = {}): CodexSkillNameResolver {
  return createCodexSkillNameResolver({ homeDir: home, env })
}

function builder(codexSkillName?: CodexSkillNameResolver, warn = vi.fn()) {
  return createAgentPromptCommandBuilder({
    readSettings: () => ({}),
    resolveWorkspaceAgentSettings: async () => null,
    ensureElevationApplied: async () => {},
    buildLaunchCommand: agentId => (agentId === 'codex-cli' ? 'codex' : agentId === 'claude-cli' ? 'claude' : null),
    ...(codexSkillName ? { codexSkillName } : {}),
    logger: { warn },
  })
}

async function build(opts: AgentPromptCommandOptions, codexSkillName?: CodexSkillNameResolver) {
  const built = await builder(codexSkillName)(opts)
  if (!built) throw new Error('no command')
  return built
}

const CODEX_UPDATE = '-c check_for_update_on_startup=false'

describe('helper dispatch (createAgentPromptCommandBuilder)', () => {
  it('handover § 6-2: only plugin → $ct:ct-exec; both → $ct-exec; only manual → $ct-exec; disabled → $ct-exec', async () => {
    const codexHome = path.join(home, '.codex')
    const opts = { agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710', shellFamily: 'pwsh' } as const
    installPlugin(codexHome)
    let built = await build(opts, resolver())
    expect(built.command).toBe(`codex ${CODEX_UPDATE} '$ct:ct-exec T0710'`)
    expect(built.prompt).toBe('$ct:ct-exec T0710')
    expect(built.codexSkillName).toEqual({ name: 'ct:ct-exec', reason: 'plugin', marketplace: 'ct-test-mkt' })

    installManual(codexHome)
    built = await build(opts, resolver())
    expect(built.command).toBe(`codex ${CODEX_UPDATE} '$ct-exec T0710'`)
    expect(built.codexSkillName).toEqual({ name: 'ct-exec', reason: 'manual' })

    fs.rmSync(path.join(codexHome, 'plugins'), { recursive: true })
    installPlugin(codexHome, false)
    expect((await build(opts, resolver())).prompt).toBe('$ct-exec T0710')
    fs.rmSync(path.join(codexHome, 'skills'), { recursive: true })
    expect((await build(opts, resolver())).codexSkillName).toEqual({ name: 'ct-exec', reason: 'fallback-plugin-disabled' })
  })

  it.each([
    ['posix', "'$ct:ct-exec T0710'"],
    ['pwsh', "'$ct:ct-exec T0710'"],
    ['cmd', '"$ct:ct-exec T0710"'],
  ] as const)('%s quoting of $ct:ct-exec', async (shellFamily, quoted) => {
    installPlugin(path.join(home, '.codex'))
    const built = await build({ agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710', shellFamily }, resolver())
    expect(built.command).toBe(`codex ${CODEX_UPDATE} ${quoted}`)
  })

  it('codex-agent presets and CP- work orders too; ct-done', async () => {
    installPlugin(path.join(home, '.codex'))
    expect((await build({ agent: 'codex-agent', skill: 'ct-done', workorder: 'CP-T0113' }, resolver())).prompt).toBe('$ct:ct-done CP-T0113')
  })

  it('claude is unchanged (/ct-exec) and never asks the resolver', async () => {
    const ask = vi.fn(async (skill: string) => ({ name: `ct:${skill}`, reason: 'plugin' as const }))
    const built = await build({ agent: 'claude-cli', skill: 'ct-exec', workorder: 'T0710', shellFamily: 'pwsh' }, ask)
    expect(built.command).toBe("claude '/ct-exec T0710'")
    expect(built.codexSkillName).toBeUndefined()
    expect(ask).not.toHaveBeenCalled()
  })

  it('raw prompts: /ct-exec and /ct:ct-exec follow the same decision; the rest is kept', async () => {
    installPlugin(path.join(home, '.codex'))
    for (const prompt of ['/ct-exec T0710 extra words', '/ct:ct-exec T0710 extra words']) {
      const built = await build({ agent: 'codex-cli', prompt, shellFamily: 'posix' }, resolver())
      expect(built.prompt).toBe('$ct:ct-exec T0710 extra words')
      expect(built.prefixNormalized).toBe(true)
    }
    installManual(path.join(home, '.codex'))
    expect((await build({ agent: 'codex-cli', prompt: '/ct:ct-exec T0710' }, resolver())).prompt).toBe('$ct-exec T0710')
    // not a CT prompt → untouched, no decision
    const plain = await build({ agent: 'codex-cli', prompt: '/other T0710' }, resolver())
    expect(plain.prompt).toBe('/other T0710')
    expect(plain.codexSkillName).toBeUndefined()
  })

  it('no resolver on the host → $ct-exec (fallback-unsupported), also for /ct:ct-exec', async () => {
    expect((await build({ agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710' })).codexSkillName).toEqual({ name: 'ct-exec', reason: 'fallback-unsupported' })
    expect((await build({ agent: 'codex-cli', prompt: '/ct:ct-exec T0710' })).prompt).toBe('$ct-exec T0710')
    expect((await build({ agent: 'codex-cli', prompt: '/ct-exec T0710' })).prompt).toBe('$ct-exec T0710')
  })

  it('a failing resolver → $ct-exec (fallback-error), logged as a warning', async () => {
    const warn = vi.fn()
    const built = await builder(async () => { throw new Error('boom') }, warn)({ agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710' })
    expect(built?.prompt).toBe('$ct-exec T0710')
    expect(built?.codexSkillName).toEqual({ name: 'ct-exec', reason: 'fallback-error' })
    expect(warn.mock.calls.join(' ')).toContain('codex skill name of ct-exec failed: boom')
  })

  it("the tab's CODEX_HOME (customEnv) is used, not the host's ~/.codex", async () => {
    const tabHome = path.join(root, 'tab-codex')
    installPlugin(tabHome)
    installManual(path.join(home, '.codex'))
    const opts = { agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710' }
    expect((await build(opts, resolver())).prompt).toBe('$ct-exec T0710')
    expect((await build({ ...opts, customEnv: { CODEX_HOME: tabHome } }, resolver())).prompt).toBe('$ct:ct-exec T0710')
  })
})

interface HostOptions {
  defaultShell: string
  codexSkillName?: CodexSkillNameResolver
}

function registerHost(opts: HostOptions) {
  const handlers = new Map<string, Handler>()
  const written: string[] = []
  const logs: string[] = []
  const mirrored: Array<[string, Record<string, unknown>]> = []
  const buildAgentPromptCommand = builder(opts.codexSkillName)
  registerTerminalCommandHandlers({
    registerHandler(channel, handler) {
      handlers.set(channel, handler as Handler)
    },
    getPtyManager() {
      return {
        isAlive: () => false,
        create: () => true,
        write: (_id: string, data: string) => { written.push(data) },
        getDefaultShell: () => opts.defaultShell,
      }
    },
    getAllWindows: () => [],
    readPersistedSettingsSync: () => ({}),
    buildAgentPromptCommand,
    pickWhitelistedEnv: () => ({}),
    mirrorToBatScripts: (event, payload) => { mirrored.push([event, payload]) },
    logger: { log: (...a: unknown[]) => { logs.push(a.join(' ')) }, warn: () => undefined },
    platform: 'win32',
    env: {},
    existsSync: p => p === opts.defaultShell,
    setTimeout: (callback: () => void) => {
      callback()
      return 0
    },
    ...(opts.codexSkillName ? { codexSkillName: opts.codexSkillName } : {}),
  })
  return { handlers, written, logs, mirrored }
}

describe('terminal:create-agent-command (helper dispatch end to end)', () => {
  it('passes the tab customEnv to the decision and logs name + reason (no config content)', async () => {
    const tabHome = path.join(root, 'tab-codex')
    installPlugin(tabHome)
    const host = registerHost({ defaultShell: WIN_PWSH, codexSkillName: resolver() })
    const result = await host.handlers.get('terminal:create-agent-command')!({ windowId: null }, {
      id: 'worker-1',
      cwd: 'D:\\repo',
      skill: 'ct-exec',
      workorder: 'T0710',
      agent: 'codex',
      customEnv: { CODEX_HOME: tabHome, CT_MODE: 'yolo' },
    })
    expect(result).toBe(true)
    expect(host.written[0]).toContain("'$ct:ct-exec T0710'")
    expect(host.logs).toContain('[agent-command] codex skill id=worker-1 name=$ct:ct-exec reason=plugin')
    expect(host.mirrored).toContainEqual(['codex-skill-name', { channel: 'terminal:create-agent-command', terminalId: 'worker-1', name: 'ct:ct-exec', reason: 'plugin' }])
    expect(host.logs.join('\n')).not.toContain('enabled = true')
  })
})

describe('terminal:control-tower-prompt (panel one-click dispatch)', () => {
  it('is proxied and path-free (headless registration: headless-parity.test.ts)', () => {
    expect(PROXIED_CHANNELS.has(CONTROL_TOWER_PROMPT_CHANNEL)).toBe(true)
    expect(PATH_FREE_CHANNELS.has(CONTROL_TOWER_PROMPT_CHANNEL)).toBe(true)
  })

  async function ask(opts: HostOptions, request: unknown): Promise<ControlTowerPromptResult> {
    const handler = registerHost(opts).handlers.get(CONTROL_TOWER_PROMPT_CHANNEL)
    if (!handler) throw new Error('not registered')
    return await handler({ windowId: 'w1' }, request) as ControlTowerPromptResult
  }

  it.each([
    [WIN_PWSH, 'pwsh', "'$ct:ct-exec T0710'"],
    [WIN_CMD, 'cmd', '"$ct:ct-exec T0710"'],
    [GIT_BASH, 'posix', "'$ct:ct-exec T0710'"],
  ])('only plugin, default shell %s → %s quoting', async (defaultShell, shellFamily, quotedPrompt) => {
    installPlugin(path.join(home, '.codex'))
    expect(await ask({ defaultShell, codexSkillName: resolver() }, { agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710' })).toEqual({
      ok: true,
      prompt: '$ct:ct-exec T0710',
      quotedPrompt,
      shellFamily,
      skillName: { name: 'ct:ct-exec', reason: 'plugin', marketplace: 'ct-test-mkt' },
    })
  })

  it('both installs → $ct-exec; customEnv CODEX_HOME counts', async () => {
    installPlugin(path.join(home, '.codex'))
    installManual(path.join(home, '.codex'))
    const r = await ask({ defaultShell: WIN_PWSH, codexSkillName: resolver() }, { agent: 'codex-agent', skill: 'ct-done', workorder: 'T0710' })
    expect(r).toMatchObject({ ok: true, prompt: '$ct:ct-done T0710' }) // manual install has ct-exec only
    const tabHome = path.join(root, 'tab-codex')
    installManual(tabHome)
    installPlugin(tabHome)
    expect(await ask({ defaultShell: WIN_PWSH, codexSkillName: resolver() }, { agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710', customEnv: { CODEX_HOME: tabHome } }))
      .toMatchObject({ ok: true, prompt: '$ct-exec T0710', skillName: { reason: 'manual' } })
  })

  it('claude → /ct-exec without a decision', async () => {
    expect(await ask({ defaultShell: WIN_PWSH, codexSkillName: resolver() }, { agent: 'claude-cli', skill: 'ct-exec', workorder: 'T0710' }))
      .toEqual({ ok: true, prompt: '/ct-exec T0710', quotedPrompt: "'/ct-exec T0710'", shellFamily: 'pwsh' })
  })

  it('no resolver → $ct-exec (fallback-unsupported)', async () => {
    expect(await ask({ defaultShell: GIT_BASH }, { agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710' }))
      .toMatchObject({ ok: true, prompt: '$ct-exec T0710', quotedPrompt: "'$ct-exec T0710'", skillName: { name: 'ct-exec', reason: 'fallback-unsupported' } })
  })

  it.each([
    [{ agent: 'codex-cli', skill: 'ct-status', workorder: 'T0710' }],
    [{ agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710; rm -rf' }],
    [null],
  ])('invalid request %j → ok: false', async (request) => {
    expect(await ask({ defaultShell: WIN_PWSH, codexSkillName: resolver() }, request)).toMatchObject({ ok: false })
  })
})

// The literal the shell hands to codex: run the quoted argument through a real shell when present.
const run = promisify(execFile)
const PRINT_ARG = 'console.log(process.argv[1])'

const SHELLS: Array<{ family: 'posix' | 'pwsh' | 'cmd'; exe: string | null; exec(quoted: string): Promise<string> }> = [
  {
    family: 'pwsh',
    exe: findExe(['pwsh', 'pwsh.exe']),
    async exec(quoted) {
      const { stdout } = await run(this.exe!, ['-NoProfile', '-NonInteractive', '-Command', `node -e '${PRINT_ARG}' ${quoted}`], { timeout: 30000 })
      return stdout
    },
  },
  {
    family: 'cmd',
    exe: process.platform === 'win32' ? findExe(['cmd.exe']) : null,
    async exec(quoted) {
      const { stdout } = await run(this.exe!, ['/d', '/s', '/c', `"node -e "${PRINT_ARG}" ${quoted}"`], { timeout: 30000, windowsVerbatimArguments: true })
      return stdout
    },
  },
  {
    family: 'posix',
    exe: process.platform === 'win32' ? (fs.existsSync(GIT_BASH) ? GIT_BASH : null) : findExe(['bash']),
    async exec(quoted) {
      const { stdout } = await run(this.exe!, ['-c', `node -e '${PRINT_ARG}' ${quoted}`], { timeout: 30000 })
      return stdout
    },
  },
]

function findExe(names: string[]): string | null {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const name of names) {
      const candidate = path.join(dir, name)
      try {
        if (fs.statSync(candidate).isFile()) return candidate
      } catch { /* next */ }
    }
  }
  return null
}

describe('the shell passes $ct:ct-exec literally (real shells, skipped when absent)', () => {
  for (const shell of SHELLS) {
    it.skipIf(!shell.exe)(`${shell.family}`, async () => {
      installPlugin(path.join(home, '.codex'))
      const built = await build({ agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710', shellFamily: shell.family }, resolver())
      const quoted = built.command.slice(`codex ${CODEX_UPDATE} `.length)
      expect((await shell.exec(quoted)).trim()).toBe('$ct:ct-exec T0710')
    }, 60000)
  }
})
