// @vitest-environment node
/**
 * BUG-178 / T0730: Claude's user config dir is `CLAUDE_CONFIG_DIR` (trimmed, non-empty), else
 * `<home>/.claude` — one implementation (`resolveClaudeConfigDir`, electron/claude-config-dir.ts)
 * for the Claude panel's session history / session list / installed plugins, the skill scans,
 * the statusline extras, the claude settings files of a launch and the ct-config default layer.
 * Unset or empty: exactly the pre-T0730 path.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import { resolveClaudeConfigDir, resolveClaudePluginsDir } from '../claude-config-dir'
import { ClaudeAgentManager, panelClaudeConfigDir, panelClaudePluginsDir, sdkSpawnEnv } from '../claude-agent-manager'
import { defaultClaudeSettingsFiles } from '../bat-mcp-launch'
import { claudeConfigDir, claudePluginsDir } from '../ct-install-detect'
import { ctConfigCandidates } from '../handlers/ct-config'
import { registerClaudeHandlers } from '../handlers/claude'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const savedConfigDir = process.env.CLAUDE_CONFIG_DIR
let root: string

beforeEach(() => {
  delete process.env.CLAUDE_CONFIG_DIR
  root = fs.mkdtempSync(path.join(os.tmpdir(), 't0730-cfg-'))
})

afterEach(() => {
  if (savedConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = savedConfigDir
  fs.rmSync(root, { recursive: true, force: true })
})

describe('resolveClaudeConfigDir', () => {
  it('unset → <home>/.claude', () => {
    expect(resolveClaudeConfigDir({}, path.join(root, 'home'))).toBe(path.join(root, 'home', '.claude'))
  })

  it.each([[''], ['   '], ['\t']])('empty / blank %j → <home>/.claude', (value) => {
    expect(resolveClaudeConfigDir({ CLAUDE_CONFIG_DIR: value }, path.join(root, 'home'))).toBe(path.join(root, 'home', '.claude'))
  })

  it('set → the value (trimmed), home ignored', () => {
    expect(resolveClaudeConfigDir({ CLAUDE_CONFIG_DIR: '/cfg/claude' }, '/home/u')).toBe('/cfg/claude')
    expect(resolveClaudeConfigDir({ CLAUDE_CONFIG_DIR: '  /cfg/claude ' }, '/home/u')).toBe('/cfg/claude')
  })

  it('uses the given join (platform path module)', () => {
    expect(resolveClaudeConfigDir({}, 'C:\\Users\\demo', (...p) => path.win32.join(...p))).toBe('C:\\Users\\demo\\.claude')
    expect(resolveClaudeConfigDir({}, '/Users/tester', (...p) => path.posix.join(...p))).toBe('/Users/tester/.claude')
  })

  it('the existing consumers follow the same rule (set / unset / empty)', () => {
    for (const env of [{}, { CLAUDE_CONFIG_DIR: '' }, { CLAUDE_CONFIG_DIR: '  ' }, { CLAUDE_CONFIG_DIR: '/cfg/claude' }]) {
      const expected = resolveClaudeConfigDir(env, '/home/u', (...p) => path.posix.join(...p))
      expect(claudeConfigDir({ homeDir: '/home/u', env }).replace(/\\/g, '/')).toBe(expected)
      expect(defaultClaudeSettingsFiles(env, 'linux', '/home/u')[1].file).toBe(path.posix.join(expected, 'settings.json'))
    }
  })
})

// BUG-191 / T0760: CLI 2.1.316 measured — CLAUDE_CODE_PLUGIN_CACHE_DIR moves the whole plugins dir
// (installed_plugins.json, known_marketplaces.json, cache/); '' / blanks → <config>/plugins; '~/x' →
// <home>/x; a relative value → against the CLI's cwd.
describe('resolveClaudePluginsDir', () => {
  const posix = path.posix
  const win = path.win32

  it.each([[{}], [{ CLAUDE_CODE_PLUGIN_CACHE_DIR: '' }], [{ CLAUDE_CODE_PLUGIN_CACHE_DIR: '   ' }], [{ CLAUDE_CODE_PLUGIN_CACHE_DIR: '\t' }]])(
    'unset / empty / blank %j → <config dir>/plugins (unchanged)', (env) => {
      expect(resolveClaudePluginsDir(env, '/home/u', undefined, posix)).toBe('/home/u/.claude/plugins')
      expect(resolveClaudePluginsDir({ ...env, CLAUDE_CONFIG_DIR: '/cfg/claude' }, '/home/u', undefined, posix)).toBe('/cfg/claude/plugins')
      expect(resolveClaudePluginsDir(env, 'C:\\Users\\demo', undefined, win)).toBe('C:\\Users\\demo\\.claude\\plugins')
    })

  it('set → the value (trimmed), whatever CLAUDE_CONFIG_DIR is', () => {
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: '/pc' }, '/home/u', undefined, posix)).toBe('/pc')
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: ' /pc ', CLAUDE_CONFIG_DIR: '/cfg' }, '/home/u', '/proj', posix)).toBe('/pc')
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: 'D:\\pc' }, 'C:\\Users\\demo', 'C:\\proj', win)).toBe('D:\\pc')
  })

  it('~ / ~/… → under home', () => {
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: '~' }, '/home/u', undefined, posix)).toBe('/home/u')
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: '~/pc' }, '/home/u', '/proj', posix)).toBe('/home/u/pc')
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: '~\\pc' }, 'C:\\Users\\demo', undefined, win)).toBe('C:\\Users\\demo\\pc')
  })

  it('relative → against cwd when given, else as is', () => {
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: 'relpc' }, '/home/u', '/proj', posix)).toBe('/proj/relpc')
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: 'relpc' }, 'C:\\Users\\demo', 'C:\\proj', win)).toBe('C:\\proj\\relpc')
    expect(resolveClaudePluginsDir({ CLAUDE_CODE_PLUGIN_CACHE_DIR: 'relpc' }, '/home/u', undefined, posix)).toBe('relpc')
  })

  it('claudePluginsDir (CT install detection) follows the same rule', () => {
    for (const env of [{}, { CLAUDE_CODE_PLUGIN_CACHE_DIR: '' }, { CLAUDE_CONFIG_DIR: '/cfg' }, { CLAUDE_CODE_PLUGIN_CACHE_DIR: '/pc' }]) {
      expect(claudePluginsDir({ homeDir: root, env })).toBe(resolveClaudePluginsDir(env, root))
    }
  })
})

describe('panelClaudePluginsDir (the Claude panel plugins list, SDK spawn env)', () => {
  const savedCache = process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR
  afterEach(() => {
    if (savedCache === undefined) delete process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR
    else process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR = savedCache
  })

  it('unset → <config dir>/plugins; set → the value, for every runtime', () => {
    delete process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR
    const home = path.join(root, 'home')
    expect(panelClaudePluginsDir({ source: 'embedded' }, undefined, home)).toBe(path.join(home, '.claude', 'plugins'))
    const cache = path.join(root, 'pc')
    process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR = cache
    for (const source of ['embedded', 'system', 'system-fallback-to-embedded'] as const) {
      expect(panelClaudePluginsDir({ source }, path.join(root, 'proj'), home)).toBe(cache)
      expect((sdkSpawnEnv({ source }).env ?? process.env).CLAUDE_CODE_PLUGIN_CACHE_DIR).toBe(cache)
    }
    process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR = 'relpc'
    expect(panelClaudePluginsDir({ source: 'embedded' }, path.join(root, 'proj'), home)).toBe(path.join(root, 'proj', 'relpc'))
  })

  it('runQuery reads installed_plugins.json from panelClaudePluginsDir with the session cwd', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'electron/claude-agent-manager.ts'), 'utf-8')
    expect(src).toContain("pathModule.join(panelClaudePluginsDir(resolvedRuntime, session.cwd), 'installed_plugins.json')")
  })
})

describe('panelClaudeConfigDir (the Claude panel SDK spawn env)', () => {
  it('unset / empty → <home>/.claude, for both runtimes', () => {
    const home = path.join(root, 'home')
    expect(panelClaudeConfigDir({ source: 'embedded' }, home)).toBe(path.join(home, '.claude'))
    expect(panelClaudeConfigDir({ source: 'system' }, home)).toBe(path.join(home, '.claude'))
    process.env.CLAUDE_CONFIG_DIR = ''
    expect(panelClaudeConfigDir(undefined, home)).toBe(path.join(home, '.claude'))
  })

  it('set → CLAUDE_CONFIG_DIR, which the spawn env carries unchanged for every runtime', () => {
    const cfg = path.join(root, 'cfg')
    process.env.CLAUDE_CONFIG_DIR = cfg
    for (const source of ['embedded', 'system', 'system-fallback-to-embedded'] as const) {
      expect(panelClaudeConfigDir({ source }, path.join(root, 'home'))).toBe(cfg)
      // the history / list paths pass no runtime: valid only while sdkSpawnEnv never sets this key
      expect((sdkSpawnEnv({ source }).env ?? process.env).CLAUDE_CONFIG_DIR).toBe(cfg)
    }
    expect(panelClaudeConfigDir(undefined, path.join(root, 'home'))).toBe(cfg)
  })
})

describe('Claude panel: session history and session list read the Claude config dir', () => {
  const SDK_ID = '11111111-2222-3333-4444-555555555555'
  const managers: ClaudeAgentManager[] = []
  afterEach(() => {
    for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
  })

  function writeSession(configDir: string, cwd: string): void {
    const dir = path.join(configDir, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'))
    fs.mkdirSync(dir, { recursive: true })
    const lines = [
      { type: 'user', uuid: 'u1', sessionId: SDK_ID, timestamp: '2026-11-01T00:00:00.000Z', message: { role: 'user', content: 'T0730 hello' } },
      { type: 'assistant', uuid: 'a1', sessionId: SDK_ID, timestamp: '2026-11-01T00:00:01.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'T0730 answer' }] } },
    ]
    fs.writeFileSync(path.join(dir, `${SDK_ID}.jsonl`), lines.map(l => JSON.stringify(l)).join('\n') + '\n')
  }

  function manager(emit: (channel: string, ...args: unknown[]) => void) {
    const m = new ClaudeAgentManager({ emit, getSettings: () => null, notifier: { notify: () => {}, hasFocusedWindow: () => false } } as never)
    managers.push(m)
    return m as unknown as {
      loadSessionHistory(sessionId: string, sdkSessionId: string, cwd: string): Promise<void>
      listSessionsFallback(cwd: string): Promise<Array<{ sdkSessionId: string; preview: string }>>
    }
  }

  it.each([
    ['set', true],
    ['unset (control: the file is under the config dir, not <home>/.claude)', false],
  ])('CLAUDE_CONFIG_DIR %s', async (_label, set) => {
    const cfg = path.join(root, 'cfg')
    const cwd = path.join(root, 'proj')
    writeSession(cfg, cwd)
    if (set) process.env.CLAUDE_CONFIG_DIR = cfg
    const emitted: Array<[string, unknown[]]> = []
    const m = manager((channel, ...args) => { emitted.push([channel, args]) })

    await m.loadSessionHistory('tab-1', SDK_ID, cwd)
    const history = emitted.find(([channel]) => channel === 'claude:history')
    const list = await m.listSessionsFallback(cwd)
    if (set) {
      expect(history?.[1][0]).toBe('tab-1')
      expect(JSON.stringify(history?.[1][1])).toContain('T0730 answer')
      expect(list.map(s => [s.sdkSessionId, s.preview])).toEqual([[SDK_ID, 'T0730 hello']])
    } else {
      expect(panelClaudeConfigDir()).toBe(path.join(os.homedir(), '.claude'))
      expect(history).toBeUndefined()
      expect(list.find(s => s.sdkSessionId === SDK_ID)).toBeUndefined()
    }
  })
})

describe('handlers and ct-config follow the host env', () => {
  type Handler = (ctx: unknown, ...args: unknown[]) => unknown
  function handlers(home: string, env: Record<string, string | undefined>): Map<string, Handler> {
    const map = new Map<string, Handler>()
    registerClaudeHandlers(((channel: string, fn: Handler) => { map.set(channel, fn) }) as never, {
      emit: () => {}, homeDir: home, getClaudeManager: () => null, env,
    })
    return map
  }
  function skill(dir: string, name: string): void {
    fs.mkdirSync(path.join(dir, name), { recursive: true })
    fs.writeFileSync(path.join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} skill\n---\n`)
  }

  it('claude:scan-skills / scan-star-commands / statusline extras: <CLAUDE_CONFIG_DIR> when set, <home>/.claude when unset or empty', async () => {
    const home = path.join(root, 'home')
    const cwd = path.join(root, 'proj')
    const cfg = path.join(root, 'cfg')
    fs.mkdirSync(cwd, { recursive: true })
    skill(path.join(home, '.claude', 'skills'), 'ct-home')
    skill(path.join(cfg, 'skills'), 'ct-cfg')
    fs.mkdirSync(path.join(home, '.claude', 'commands'), { recursive: true })
    fs.writeFileSync(path.join(home, '.claude', 'commands', 'home-cmd.md'), 'home command\n')
    fs.mkdirSync(path.join(cfg, 'commands'), { recursive: true })
    fs.writeFileSync(path.join(cfg, 'commands', 'cfg-cmd.md'), 'cfg command\n')
    fs.writeFileSync(path.join(home, '.claude', 'account-label.txt'), 'home-label')
    fs.writeFileSync(path.join(cfg, 'account-label.txt'), 'cfg-label')

    const names = async (env: Record<string, string | undefined>) => {
      const h = handlers(home, env)
      const skills = await h.get('claude:scan-skills')!({}, cwd) as Array<{ name: string }>
      const star = await h.get('claude:scan-star-commands')!({}) as Array<{ name: string }>
      const extras = await h.get('claude:get-statusline-extras')!({}) as { accountLabel?: string }
      return { skills: skills.map(s => s.name).sort(), star: star.map(s => s.name).sort(), label: extras.accountLabel }
    }
    expect(await names({ CLAUDE_CONFIG_DIR: cfg })).toEqual({ skills: ['cfg-cmd', 'ct-cfg'], star: ['cfg'], label: 'cfg-label' })
    expect(await names({})).toEqual({ skills: ['ct-home', 'home-cmd'], star: ['home'], label: 'home-label' })
    expect(await names({ CLAUDE_CONFIG_DIR: '' })).toEqual({ skills: ['ct-home', 'home-cmd'], star: ['home'], label: 'home-label' })
  })

  it('ct-config default layer: the Claude manual install under the config dir; the global layer stays under <home>/.claude', () => {
    const home = path.join(root, 'home')
    const cfg = path.join(root, 'cfg')
    const towerConfig = (dir: string) => path.join(dir, 'skills', 'control-tower', 'references', 'tower-config.md')
    const unset = ctConfigCandidates(home, {})
    expect(unset.defaults[0]).toBe(towerConfig(path.join(home, '.claude')))
    expect(ctConfigCandidates(home, { CLAUDE_CONFIG_DIR: '' })).toEqual(unset)
    const set = ctConfigCandidates(home, { CLAUDE_CONFIG_DIR: cfg })
    expect(set.defaults[0]).toBe(towerConfig(cfg))
    expect(set.defaults.slice(1)).toEqual(unset.defaults.slice(1))
    expect(set.global).toEqual(unset.global)
    expect(set.global[0]).toBe(path.join(home, '.claude', 'control-tower-data', 'config.yaml'))
  })
})

describe('source guard (BUG-178)', () => {
  // `<home>/.claude` joined by hand is only allowed where it is not Claude's config dir.
  const ALLOWED: Record<string, string> = {
    'electron/claude-config-dir.ts': 'the single implementation',
    'electron/claude-resolver.ts': '<home>/.claude/local: the old local install of the claude binary',
    'electron/node-resolver.ts': '<home>/.claude/local/node.exe: same',
    'electron/handlers/ct-config.ts': 'the CT global layer (control-tower-data), CT data, not moved by CLAUDE_CONFIG_DIR',
  }
  const HOME_CLAUDE = /(homedir\(\)|homePath|homeDir|HOME)\s*,\s*['"]\.claude['"]/

  function sources(dir: string): string[] {
    return fs.readdirSync(path.join(PROJECT_ROOT, dir), { withFileTypes: true }).flatMap(e => {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(rel)
      return /\.tsx?$/.test(e.name) ? [rel] : []
    })
  }

  it('no other electron/ or src/ file builds <home>/.claude itself', () => {
    const offenders = [...sources('electron'), ...sources('src')]
      .filter(f => !(f in ALLOWED))
      .filter(f => fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf-8').split('\n').some(line => HOME_CLAUDE.test(line)))
    expect(offenders).toEqual([])
  })

  it('BUG-191: no other electron/ or src/ file reads CLAUDE_CODE_PLUGIN_CACHE_DIR or joins <config>/plugins itself', () => {
    const offenders = [...sources('electron'), ...sources('src')]
      .filter(f => f !== 'electron/claude-config-dir.ts')
      .filter(f => fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf-8').split('\n').some(line =>
        /\.CLAUDE_CODE_PLUGIN_CACHE_DIR\b|\[['"]CLAUDE_CODE_PLUGIN_CACHE_DIR['"]\]/.test(line)
        || /['"]plugins['"]\s*,\s*['"]installed_plugins\.json['"]/.test(line)))
    expect(offenders).toEqual([])
  })

  it('the ct-config exception is only the global layer', () => {
    const lines = fs.readFileSync(path.join(PROJECT_ROOT, 'electron/handlers/ct-config.ts'), 'utf-8').split('\n').filter(l => HOME_CLAUDE.test(l))
    expect(lines.length).toBe(2)
    for (const line of lines) expect(line).toMatch(/control-tower-(data|config\.yaml)/)
  })
})
