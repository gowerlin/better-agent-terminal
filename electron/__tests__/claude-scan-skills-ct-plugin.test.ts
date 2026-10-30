/**
 * T0710 (3-3): `claude:scan-skills` (skill panel) and `claude:scan-star-commands` (`*` completion)
 * also list the Claude `ct@*` plugin's skills — no other plugin — and a manual install of the
 * same name is listed once, as the manual one (Claude itself uses that one).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import { registerClaudeHandlers } from '../handlers/claude'

type Handler = (ctx: unknown, ...args: unknown[]) => unknown

let root: string
let home: string
let cwd: string

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function skill(dir: string, name: string, description: string) {
  write(path.join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`)
}

function installPlugin(id: string, version: string, skills: string[]): string {
  const [name, marketplace] = id.split('@')
  const pluginRoot = path.join(home, '.claude', 'plugins', 'cache', marketplace, name, version)
  for (const s of skills) skill(path.join(pluginRoot, 'skills'), s, `${id} ${s}`)
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json')
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : { version: 2, plugins: {} }
  current.plugins[id] = [{ scope: 'user', installPath: pluginRoot, version }]
  write(file, JSON.stringify(current))
  return pluginRoot
}

function handlers(): Map<string, Handler> {
  const map = new Map<string, Handler>()
  registerClaudeHandlers(((channel: string, fn: Handler) => { map.set(channel, fn) }) as never, {
    emit: () => {},
    homeDir: home,
    getClaudeManager: () => null,
    env: {},
  })
  return map
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 't0710-scan-'))
  home = path.join(root, 'home')
  cwd = path.join(root, 'proj')
  fs.mkdirSync(cwd, { recursive: true })
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('claude:scan-skills', () => {
  it('only the ct plugin → its skills are listed (global)', async () => {
    installPlugin('ct@control-tower', '5.14.0', ['control-tower', 'ct-exec'])
    const result = await handlers().get('claude:scan-skills')!({}, cwd) as Array<{ name: string; description: string; scope: string }>
    expect(result).toEqual([
      { name: 'control-tower', description: 'ct@control-tower control-tower', scope: 'global' },
      { name: 'ct-exec', description: 'ct@control-tower ct-exec', scope: 'global' },
    ])
  })

  it('manual and plugin with the same name → listed once, the manual one', async () => {
    installPlugin('ct@control-tower', '5.14.0', ['ct-exec', 'ct-done'])
    skill(path.join(home, '.claude', 'skills'), 'ct-exec', 'manual ct-exec')
    const result = await handlers().get('claude:scan-skills')!({}, cwd) as Array<{ name: string; description: string }>
    expect(result.filter(r => r.name === 'ct-exec')).toEqual([{ name: 'ct-exec', description: 'manual ct-exec', scope: 'global' }])
    expect(result.map(r => r.name).sort()).toEqual(['ct-done', 'ct-exec'])
  })

  it('other plugins are not listed', async () => {
    installPlugin('frontend-design@anthropic-plugin-directory', '1.0.0', ['frontend-design'])
    installPlugin('ct-guide@control-tower', '5.14.0', ['control-tower-guide'])
    expect(await handlers().get('claude:scan-skills')!({}, cwd)).toEqual([])
  })
})

describe('claude:scan-star-commands', () => {
  it('ct-* skills of the plugin, deduplicated against the manual install', async () => {
    installPlugin('ct@control-tower', '5.14.0', ['control-tower', 'ct-exec', 'ct-status'])
    skill(path.join(home, '.agents', 'skills'), 'ct-exec', 'manual ct-exec')
    const result = await handlers().get('claude:scan-star-commands')!({}) as Array<{ name: string; description: string; prefix: string }>
    expect(result).toEqual([
      { name: 'exec', description: 'manual ct-exec', prefix: 'ct' },
      { name: 'status', description: 'ct@control-tower ct-status', prefix: 'ct' },
    ])
  })
})
