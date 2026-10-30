import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { CT_CONFIG_SOURCES_CHANNEL, readCtConfigSources, registerCtConfigHandlers } from '../handlers/ct-config'
import { PROXIED_CHANNELS } from '../remote/protocol'
import type { HandlerRegistrar, SharedHandler } from '../handlers/types'

// T0701: `ct:read-config-sources` reads fixed files under the answering host's home only.
// T0710: plus the `ct` plugin's tower-config.md when no manual install has one.
// T0711: plus the optional `installs` (zip / plugin per agent); the other fields are unchanged.

let home: string

function write(rel: string, content: string) {
  const file = path.join(home, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return file
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-config-sources-'))
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
})

describe('readCtConfigSources', () => {
  it('nothing installed → both layers missing, candidates listed in lookup order', async () => {
    const result = await readCtConfigSources(home)
    expect(result.homeDir).toBe(home)
    expect(result.global).toEqual({
      status: 'missing',
      tried: [
        path.join(home, '.claude', 'control-tower-data', 'config.yaml'),
        path.join(home, '.claude', 'control-tower-config.yaml'),
      ],
    })
    expect(result.defaults.status).toBe('missing')
  })

  it('new global path wins over the legacy one', async () => {
    const legacy = write('.claude/control-tower-config.yaml', 'verbose: off\n')
    expect((await readCtConfigSources(home)).global).toEqual({ status: 'found', path: legacy, content: 'verbose: off\n' })
    const fresh = write('.claude/control-tower-data/config.yaml', 'verbose: on\n')
    expect((await readCtConfigSources(home)).global).toEqual({ status: 'found', path: fresh, content: 'verbose: on\n' })
  })

  it('defaults: ~/.claude skill first, then ~/.codex', async () => {
    const codex = write('.codex/skills/control-tower/references/tower-config.md', 'codex')
    expect((await readCtConfigSources(home)).defaults).toMatchObject({ status: 'found', path: codex })
    const claude = write('.claude/skills/control-tower/references/tower-config.md', 'claude')
    expect((await readCtConfigSources(home)).defaults).toMatchObject({ status: 'found', path: claude, content: 'claude' })
  })

  it('a file over 512 KiB is an error, not a fallback to the next candidate', async () => {
    const big = write('.claude/control-tower-data/config.yaml', 'x'.repeat(512 * 1024 + 1))
    write('.claude/control-tower-config.yaml', 'verbose: off\n')
    expect((await readCtConfigSources(home)).global).toEqual({ status: 'error', path: big, error: 'File too large' })
  })
})

describe('T0710 (3-2): the ct plugin in the default layer', () => {
  const TOWER_CONFIG = path.join('skills', 'control-tower', 'references', 'tower-config.md')

  function claudePlugin(version: string, content = `plugin ${version}`) {
    const root = path.join(home, '.claude', 'plugins', 'cache', 'control-tower', 'ct', version)
    write(path.relative(home, path.join(root, TOWER_CONFIG)), content)
    return root
  }

  function installed(entries: Array<{ root: string; version: string }>) {
    write('.claude/plugins/installed_plugins.json', JSON.stringify({
      version: 2,
      plugins: { 'ct@control-tower': entries.map(e => ({ scope: 'user', installPath: e.root, version: e.version })) },
    }))
  }

  it('only the Claude plugin → its tower-config.md; the path shows plugins/cache/<mkt>/ct/<version>', async () => {
    const root = claudePlugin('5.14.0')
    installed([{ root, version: '5.14.0' }])
    const defaults = (await readCtConfigSources(home)).defaults
    expect(defaults).toEqual({ status: 'found', path: path.join(root, TOWER_CONFIG), content: 'plugin 5.14.0' })
    expect(defaults.status === 'found' && defaults.path).toContain(path.join('plugins', 'cache', 'control-tower', 'ct', '5.14.0'))
  })

  it('several plugin versions → the newest', async () => {
    const old = claudePlugin('5.9.0')
    const fresh = claudePlugin('5.14.0')
    installed([{ root: fresh, version: '5.14.0' }, { root: old, version: '5.9.0' }])
    expect((await readCtConfigSources(home)).defaults).toMatchObject({ status: 'found', content: 'plugin 5.14.0' })
  })

  it('a manual install wins over the plugin (it is the one that runs)', async () => {
    const root = claudePlugin('5.14.0')
    installed([{ root, version: '5.14.0' }])
    const manual = write('.codex/skills/control-tower/references/tower-config.md', 'manual')
    expect((await readCtConfigSources(home)).defaults).toEqual({ status: 'found', path: manual, content: 'manual' })
  })

  it('only the Codex plugin, under the host CODEX_HOME', async () => {
    const codexHome = path.join(home, 'codex-home')
    const file = path.join(codexHome, 'plugins', 'cache', 'control-tower', 'ct', '5.14.0', TOWER_CONFIG)
    write(path.relative(home, file), 'codex plugin')
    expect((await readCtConfigSources(home)).defaults.status).toBe('missing')
    expect((await readCtConfigSources(home, { CODEX_HOME: codexHome })).defaults).toEqual({ status: 'found', path: file, content: 'codex plugin' })
  })

  it('no install at all → missing with the manual candidates (unchanged)', async () => {
    expect((await readCtConfigSources(home)).defaults).toEqual({
      status: 'missing',
      tried: [
        path.join(home, '.claude', 'skills', 'control-tower', 'references', 'tower-config.md'),
        path.join(home, '.codex', 'skills', 'control-tower', 'references', 'tower-config.md'),
      ],
    })
  })
})

describe('T0711: installs in the answer', () => {
  it('reports both installs for Claude without changing the default layer', async () => {
    const manual = write('.claude/skills/control-tower/references/tower-config.md', 'manual')
    write('.claude/skills/control-tower/SKILL.md', '<!-- control-tower-version: 5.13.2 -->\n')
    const root = path.join(home, '.claude', 'plugins', 'cache', 'control-tower', 'ct', '5.14.0')
    write('.claude/plugins/installed_plugins.json', JSON.stringify({
      version: 2,
      plugins: { 'ct@control-tower': [{ scope: 'user', installPath: root, version: '5.14.0' }] },
    }))
    const result = await readCtConfigSources(home)
    expect(result.defaults).toEqual({ status: 'found', path: manual, content: 'manual' })
    expect(result.installs).toEqual({
      claude: { manual: { version: '5.13.2' }, plugin: { version: '5.14.0', marketplace: 'control-tower' } },
      codex: { manual: null, plugin: null },
    })
  })
})

describe('registration', () => {
  it('is proxied (headless registration is covered by headless-parity.test.ts) and answers from the given home', async () => {
    expect(PROXIED_CHANNELS.has(CT_CONFIG_SOURCES_CHANNEL)).toBe(true)
    const handlers = new Map<string, SharedHandler>()
    const register: HandlerRegistrar = (channel, handler) => { handlers.set(channel, handler) }
    registerCtConfigHandlers(register, { homeDir: home, env: {} })
    write('.claude/control-tower-data/config.yaml', 'a: 1\n')
    const result = await handlers.get(CT_CONFIG_SOURCES_CHANNEL)!({ windowId: null }) as Awaited<ReturnType<typeof readCtConfigSources>>
    expect(result.global).toMatchObject({ status: 'found', content: 'a: 1\n' })
  })
})
