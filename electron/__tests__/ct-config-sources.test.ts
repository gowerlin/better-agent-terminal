import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { CT_CONFIG_SOURCES_CHANNEL, readCtConfigSources, registerCtConfigHandlers } from '../handlers/ct-config'
import { PROXIED_CHANNELS } from '../remote/protocol'
import type { HandlerRegistrar, SharedHandler } from '../handlers/types'

// T0701: `ct:read-config-sources` reads fixed files under the answering host's home only.

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

describe('registration', () => {
  it('is proxied (headless registration is covered by headless-parity.test.ts) and answers from the given home', async () => {
    expect(PROXIED_CHANNELS.has(CT_CONFIG_SOURCES_CHANNEL)).toBe(true)
    const handlers = new Map<string, SharedHandler>()
    const register: HandlerRegistrar = (channel, handler) => { handlers.set(channel, handler) }
    registerCtConfigHandlers(register, { homeDir: home })
    write('.claude/control-tower-data/config.yaml', 'a: 1\n')
    const result = await handlers.get(CT_CONFIG_SOURCES_CHANNEL)!({ windowId: null }) as Awaited<ReturnType<typeof readCtConfigSources>>
    expect(result.global).toMatchObject({ status: 'found', content: 'a: 1\n' })
  })
})
