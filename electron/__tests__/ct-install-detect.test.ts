// @vitest-environment node
/**
 * T0710: how Control Tower is installed (zip / `ct` plugin / both), electron/ct-install-detect.ts.
 *   - 3-1 Codex skill name (handover § 3-1 order, § 6-2 scenarios): only plugin → `ct:ct-exec`;
 *     both → `ct-exec`; only manual / plugin `enabled = false` → `ct-exec`; anything unreadable → `ct-exec`
 *   - `CODEX_HOME` of the tab's env, never a fixed `~/.codex`
 *   - 3-2 / 3-3 plugin locations (Claude `installed_plugins.json`, Codex plugin cache, newest version)
 * Everything runs in temp dirs; the real `~/.codex` / `~/.claude` are never read.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('ct-install-detect must not import electron')
})

import {
  MAX_CT_DETECT_FILE_BYTES,
  claudeCtPluginSkillDirs,
  compareCtPluginVersions,
  createCodexSkillNameResolver,
  ctPluginTowerConfigCandidates,
  findClaudeCtPlugins,
  findCodexCtPlugin,
  findCodexCtPlugins,
  resolveCodexSkillName,
  type CtInstallHost,
} from '../ct-install-detect'

let root: string
let home: string

function write(file: string, content = 'x') {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return file
}

const SKILL_MD = '---\nname: ct-exec\ndescription: fake\n---\n'

/** `codex plugin add ct@<mkt>` result (handover § 6-2): cache + `[plugins."ct@<mkt>"] enabled = true`. */
function installCodexPlugin(codexHome: string, opts: { marketplace?: string; enabled?: boolean | null; version?: string } = {}) {
  const marketplace = opts.marketplace ?? 'ct-test-mkt'
  write(path.join(codexHome, 'plugins', 'cache', marketplace, 'ct', opts.version ?? '0.0.1', 'skills', 'ct-exec', 'SKILL.md'), SKILL_MD)
  const enabledLine = opts.enabled === null ? '' : `enabled = ${opts.enabled ?? true}\n`
  write(path.join(codexHome, 'config.toml'), [
    'model = "gpt-5"',
    '',
    `[marketplaces.${marketplace}]`,
    'source = "C:\\\\tmp\\\\ctp\\\\mkt"',
    '',
    `[plugins."ct@${marketplace}"]`,
    enabledLine,
  ].join('\n'))
}

function installManual(dir: string, skill = 'ct-exec') {
  write(path.join(dir, skill, 'SKILL.md'), SKILL_MD)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 't0710-'))
  home = path.join(root, 'home')
  fs.mkdirSync(home, { recursive: true })
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function host(env: Record<string, string | undefined> = {}): CtInstallHost {
  return { homeDir: home, env }
}

describe('resolveCodexSkillName — handover § 6-2 scenarios', () => {
  it('only the plugin → ct:ct-exec (reason plugin, marketplace kept)', async () => {
    installCodexPlugin(path.join(home, '.codex'))
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct:ct-exec', reason: 'plugin', marketplace: 'ct-test-mkt' })
    expect((await resolveCodexSkillName('ct-done', host())).name).toBe('ct:ct-done')
  })

  it('both installs → ct-exec (Codex uses the manual one too)', async () => {
    installCodexPlugin(path.join(home, '.codex'))
    installManual(path.join(home, '.codex', 'skills'))
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'manual' })
    // a skill the manual install lacks still follows the plugin
    expect((await resolveCodexSkillName('ct-done', host())).name).toBe('ct:ct-done')
  })

  it('only the manual install → ct-exec', async () => {
    installManual(path.join(home, '.codex', 'skills'))
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'manual' })
  })

  it('manual install in ~/.agents/skills → ct-exec', async () => {
    installCodexPlugin(path.join(home, '.codex'))
    installManual(path.join(home, '.agents', 'skills'))
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'manual' })
  })

  it('plugin enabled = false → ct-exec', async () => {
    installCodexPlugin(path.join(home, '.codex'), { enabled: false })
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'fallback-plugin-disabled' })
  })

  it('no config.toml → ct-exec', async () => {
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'fallback-no-config' })
  })

  it('plugin table without an enabled line → ct-exec', async () => {
    installCodexPlugin(path.join(home, '.codex'), { enabled: null })
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'fallback-no-enabled-line' })
  })

  it('broken toml (enabled is not a boolean) → ct-exec', async () => {
    write(path.join(home, '.codex', 'config.toml'), '[plugins."ct@control-tower"]\nenabled = maybe\n')
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'fallback-parse-error' })
  })

  it('other plugins only → ct-exec', async () => {
    write(path.join(home, '.codex', 'config.toml'), '[plugins."claude-mem@thedotmack"]\nenabled = true\n[plugins."ctx@m"]\nenabled = true\n')
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'fallback-no-plugin' })
  })

  it('config.toml over the size cap is not read → ct-exec', async () => {
    write(path.join(home, '.codex', 'config.toml'), `[plugins."ct@m"]\nenabled = true\n${'#'.repeat(MAX_CT_DETECT_FILE_BYTES)}\n`)
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'fallback-too-large' })
  })

  it('config.toml that is a directory → ct-exec (read error)', async () => {
    fs.mkdirSync(path.join(home, '.codex', 'config.toml'), { recursive: true })
    expect(await resolveCodexSkillName('ct-exec', host())).toEqual({ name: 'ct-exec', reason: 'fallback-read-error' })
  })

  it('a skill name that is not a plain name is returned unchanged', async () => {
    expect(await resolveCodexSkillName('../x', host())).toEqual({ name: '../x', reason: 'fallback-invalid-skill' })
  })
})

describe('CODEX_HOME', () => {
  it('the env CODEX_HOME is used, not ~/.codex', async () => {
    const codexHome = path.join(root, 'codex-home')
    installCodexPlugin(codexHome)
    installManual(path.join(home, '.codex', 'skills')) // a ~/.codex the tab does not use
    expect((await resolveCodexSkillName('ct-exec', host({ CODEX_HOME: codexHome }))).name).toBe('ct:ct-exec')
    expect((await resolveCodexSkillName('ct-exec', host())).name).toBe('ct-exec')
  })

  it("the tab's customEnv CODEX_HOME wins over the host's; an empty one means <home>/.codex", async () => {
    const tabHome = path.join(root, 'tab-codex')
    installCodexPlugin(tabHome)
    const resolve = createCodexSkillNameResolver(host({ CODEX_HOME: path.join(root, 'host-codex') }))
    expect((await resolve('ct-exec', { CODEX_HOME: tabHome })).name).toBe('ct:ct-exec')
    expect(await resolve('ct-exec')).toEqual({ name: 'ct-exec', reason: 'fallback-no-config' })
    installCodexPlugin(path.join(home, '.codex'), { marketplace: 'control-tower' })
    expect(await resolve('ct-exec', { CODEX_HOME: '' })).toMatchObject({ name: 'ct:ct-exec', marketplace: 'control-tower' })
    expect((await resolve('ct-exec', { OTHER: '1' })).reason).toBe('fallback-no-config')
  })
})

describe('findCodexCtPlugin (config.toml subset)', () => {
  it('any marketplace, comments, single-quoted keys and spacing', () => {
    expect(findCodexCtPlugin('# c\n[ plugins . \'ct@my-mkt\' ]  # tail\n  enabled   =   true   # yes\n')).toEqual({ status: 'enabled', marketplace: 'my-mkt' })
    expect(findCodexCtPlugin('\uFEFF[plugins."ct@control-tower"]\r\nenabled = true\r\n')).toEqual({ status: 'enabled', marketplace: 'control-tower' })
  })

  it('an enabled line of another table does not count', () => {
    expect(findCodexCtPlugin('[plugins."ct@m"]\n[plugins."other@m"]\nenabled = true\n')).toEqual({ status: 'no-enabled-line' })
    expect(findCodexCtPlugin('enabled = true\n[plugins."ct@m"]\nmodel = "x"\n')).toEqual({ status: 'no-enabled-line' })
  })

  it('one enabled table of several is enough', () => {
    expect(findCodexCtPlugin('[plugins."ct@a"]\nenabled = false\n[plugins."ct@b"]\nenabled = true\n')).toEqual({ status: 'enabled', marketplace: 'b' })
  })

  it('a header inside a multi-line string is not a table', () => {
    const text = 'notes = """\n[plugins."ct@fake"]\nenabled = true\n"""\n[plugins."ct@real"]\nenabled = false\n'
    expect(findCodexCtPlugin(text)).toEqual({ status: 'disabled' })
  })

  it('a ct@ table twice → parse error; dotted / inline forms are not understood (absent)', () => {
    expect(findCodexCtPlugin('[plugins."ct@m"]\nenabled = true\n[plugins."ct@m"]\nenabled = true\n')).toEqual({ status: 'parse-error' })
    expect(findCodexCtPlugin('[plugins]\n"ct@m" = { enabled = true }\n')).toEqual({ status: 'absent' })
    expect(findCodexCtPlugin('plugins."ct@m".enabled = true\n')).toEqual({ status: 'absent' })
    expect(findCodexCtPlugin('[[plugins."ct@m"]]\nenabled = true\n')).toEqual({ status: 'absent' })
  })
})

describe('compareCtPluginVersions', () => {
  it.each([
    ['5.10.0', '5.9.0'],
    ['5.14.0', '5.14.0-pre.1'],
    ['5.14.0-pre.10', '5.14.0-pre.2'],
    ['5.14.1', '5.14'],
    ['v6.0.0', '5.99.99'],
    ['0.0.1', 'not-a-version'],
    ['5.14.0-pre.1', '5.14.0-pre'],
    ['5.14.0-pre.1', '5.14.0-beta'],
  ])('%s > %s', (newer, older) => {
    expect(compareCtPluginVersions(newer, older)).toBeGreaterThan(0)
    expect(compareCtPluginVersions(older, newer)).toBeLessThan(0)
  })

  it('equal versions (build metadata ignored)', () => {
    expect(compareCtPluginVersions('5.14.0', '5.14.0+abc')).toBe(0)
    expect(compareCtPluginVersions('5.14', '5.14.0')).toBe(0)
  })
})

describe('plugin locations (3-2 / 3-3)', () => {
  function writeInstalled(configDir: string, plugins: Record<string, unknown>) {
    write(path.join(configDir, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins }))
  }

  function claudePluginRoot(name: string, version: string, withTowerConfig = true) {
    const dir = path.join(home, '.claude', 'plugins', 'cache', 'control-tower', name, version)
    write(path.join(dir, 'skills', 'ct-exec', 'SKILL.md'), SKILL_MD)
    if (withTowerConfig) write(path.join(dir, 'skills', 'control-tower', 'references', 'tower-config.md'), `defaults ${version}`)
    return dir
  }

  it('Claude: only ct@* entries in user scope, newest first; other plugins ignored', async () => {
    const v1 = claudePluginRoot('ct', '5.13.0')
    const v2 = claudePluginRoot('ct', '5.14.0')
    writeInstalled(path.join(home, '.claude'), {
      'ct@control-tower': [
        { scope: 'user', installPath: v1, version: '5.13.0' },
        { scope: 'user', installPath: v2, version: '5.14.0' },
      ],
      'codex@openai-codex': [{ scope: 'user', installPath: path.join(home, 'x'), version: '1.0.0' }],
      'ct-guide@control-tower': [{ scope: 'user', installPath: path.join(home, 'y'), version: '9.0.0' }],
    })
    const found = await findClaudeCtPlugins(host())
    expect(found.map(p => [p.id, p.version, p.root])).toEqual([
      ['ct@control-tower', '5.14.0', v2],
      ['ct@control-tower', '5.13.0', v1],
    ])
    expect(await claudeCtPluginSkillDirs(host())).toEqual([
      { dir: path.join(v2, 'skills'), scope: 'global' },
      { dir: path.join(v1, 'skills'), scope: 'global' },
    ])
  })

  it('Claude: project / local scope only for its project; disabled in settings.json → skipped', async () => {
    const dir = claudePluginRoot('ct', '5.14.0')
    const project = path.join(root, 'proj')
    writeInstalled(path.join(home, '.claude'), { 'ct@control-tower': [{ scope: 'project', projectPath: project, installPath: dir, version: '5.14.0' }] })
    expect(await findClaudeCtPlugins(host())).toEqual([])
    expect((await findClaudeCtPlugins(host(), project)).map(p => p.root)).toEqual([dir])
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'ct@control-tower': false } }))
    expect(await findClaudeCtPlugins(host(), project)).toEqual([])
  })

  it('Claude: CLAUDE_CONFIG_DIR, and CLAUDE_CODE_PLUGIN_CACHE_DIR when installPath is missing', async () => {
    const configDir = path.join(root, 'claude-home')
    const cacheDir = path.join(root, 'plugin-cache')
    const pluginDir = path.join(cacheDir, 'cache', 'ct-test-mkt', 'ct', '0.0.1')
    write(path.join(pluginDir, 'skills', 'control-tower', 'references', 'tower-config.md'), 'defaults')
    writeInstalled(configDir, { 'ct@ct-test-mkt': [{ scope: 'user', version: '0.0.1' }] })
    const env = { CLAUDE_CONFIG_DIR: configDir, CLAUDE_CODE_PLUGIN_CACHE_DIR: cacheDir }
    expect((await findClaudeCtPlugins(host(env))).map(p => p.root)).toEqual([pluginDir])
    expect(await ctPluginTowerConfigCandidates(host(env))).toEqual([path.join(pluginDir, 'skills', 'control-tower', 'references', 'tower-config.md')])
  })

  it('Claude: a broken installed_plugins.json is no plugin', async () => {
    write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), '{ not json')
    expect(await findClaudeCtPlugins(host())).toEqual([])
  })

  it('Codex: <CODEX_HOME>/plugins/cache/*/ct/* newest first; tower-config candidates skip versions without the file', async () => {
    const codexHome = path.join(root, 'codex-home')
    const base = path.join(codexHome, 'plugins', 'cache')
    write(path.join(base, 'control-tower', 'ct', '5.9.0', 'skills', 'control-tower', 'references', 'tower-config.md'))
    write(path.join(base, 'control-tower', 'ct', '5.10.0', 'skills', 'control-tower', 'references', 'tower-config.md'))
    write(path.join(base, 'control-tower', 'ct', '5.11.0-pre.1', 'skills', 'ct-exec', 'SKILL.md'))
    write(path.join(base, 'control-tower', 'ct-guide', '9.0.0', 'skills', 'control-tower', 'references', 'tower-config.md'))
    const env = { CODEX_HOME: codexHome }
    expect((await findCodexCtPlugins(host(env))).map(p => p.version)).toEqual(['5.11.0-pre.1', '5.10.0', '5.9.0'])
    expect(await ctPluginTowerConfigCandidates(host(env))).toEqual([
      path.join(base, 'control-tower', 'ct', '5.10.0', 'skills', 'control-tower', 'references', 'tower-config.md'),
      path.join(base, 'control-tower', 'ct', '5.9.0', 'skills', 'control-tower', 'references', 'tower-config.md'),
    ])
  })

  it('Claude plugin copies come before the Codex ones', async () => {
    const claude = claudePluginRoot('ct', '5.14.0')
    writeInstalled(path.join(home, '.claude'), { 'ct@control-tower': [{ scope: 'user', installPath: claude, version: '5.14.0' }] })
    write(path.join(home, '.codex', 'plugins', 'cache', 'control-tower', 'ct', '6.0.0', 'skills', 'control-tower', 'references', 'tower-config.md'))
    const candidates = await ctPluginTowerConfigCandidates(host())
    expect(candidates).toHaveLength(2)
    expect(candidates[0].startsWith(claude)).toBe(true)
  })
})
