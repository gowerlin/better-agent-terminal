// @vitest-environment node
/**
 * T0437 (BUG-105): `remote:resolve-client-paths` — which client paths the window's host can
 * read, and under which path. Rules from T0421「建議的機制」: Identity always; WSL only what
 * `owns()` claims; Docker only inside a mount; SSH never for a local file (Q1). The
 * `workspace-entry` purpose (server files in client form, T0438) always maps back with
 * `toServer`. Rules only — nothing is probed on the remote host.
 *
 * Also the classification guard: ALWAYS_LOCAL, IPC-bound, path-free, not answered by headless.
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ProfileEntry } from '../../profile-manager'
import { ALWAYS_LOCAL_CHANNELS, HEADLESS_UNSUPPORTED } from '../headless-channel-status'
import { PATH_ARG_SCHEMA, PATH_FREE_CHANNELS, SERVER_PATH_RESULT_CHANNELS } from '../path-aware-channels'
import {
  clientPathTranslatorForProfile,
  DockerPathTranslator,
  IdentityTranslator,
  resolveClientPaths,
  SshPathTranslator,
  WslPathTranslator,
  type PathTranslator,
} from '../path-translator'
import { PROXIED_CHANNELS } from '../protocol'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'
import { PROJECT_ROOT } from './helpers/server-bundle-config'

const CHANNEL = 'remote:resolve-client-paths'

interface Fixture {
  name: string
  input: string
  serverPath: string | null
  reason?: string
}

const wsl = () => new WslPathTranslator('Ubuntu-24.04')
const docker = () => new DockerPathTranslator([{ host: 'C:\\Users\\gower\\repo', container: '/workspace' }])
const ssh = () => new SshPathTranslator('C:\\Users\\gower', '/home/gower', true)

const LOCAL_FILE: Array<[string, () => PathTranslator, Fixture[]]> = [
  ['Identity', () => new IdentityTranslator(), [
    { name: 'drive path unchanged', input: 'C:\\Users\\gower\\a.txt', serverPath: 'C:\\Users\\gower\\a.txt' },
    { name: 'UNC unchanged', input: '\\\\fileserver\\share\\doc.pdf', serverPath: '\\\\fileserver\\share\\doc.pdf' },
  ]],
  ['WSL', wsl, [
    { name: 'drive → /mnt', input: 'C:\\Users\\gower\\Pictures\\a.png', serverPath: '/mnt/c/Users/gower/Pictures/a.png' },
    { name: 'other drive → /mnt', input: 'D:\\data\\x.csv', serverPath: '/mnt/d/data/x.csv' },
    { name: 'own distro UNC → linux path', input: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\gower\\repo\\f.ts', serverPath: '/home/gower/repo/f.ts' },
    { name: 'other distro UNC', input: '\\\\wsl.localhost\\Debian\\home\\gower\\f.ts', serverPath: null, reason: 'outside-wsl-distro' },
    { name: 'network share', input: '\\\\fileserver\\share\\doc.pdf', serverPath: null, reason: 'outside-wsl-distro' },
  ]],
  ['Docker', docker, [
    { name: 'inside the mount', input: 'C:\\Users\\gower\\repo\\src\\a.ts', serverPath: '/workspace/src/a.ts' },
    { name: 'outside every mount', input: 'C:\\Users\\gower\\Downloads\\a.ts', serverPath: null, reason: 'outside-docker-mounts' },
  ]],
  ['SSH', ssh, [
    // The home mapping is a workspace convention, not proof the remote has this file (Q1).
    { name: 'local file under home', input: 'C:\\Users\\gower\\Pictures\\a.png', serverPath: null, reason: 'ssh-local-file' },
    { name: 'local file outside home', input: 'D:\\data\\x.csv', serverPath: null, reason: 'ssh-local-file' },
  ]],
]

const WORKSPACE_ENTRY: Array<[string, () => PathTranslator, Fixture[]]> = [
  ['Identity', () => new IdentityTranslator(), [
    { name: 'unchanged', input: 'C:\\repo\\a.ts', serverPath: 'C:\\repo\\a.ts' },
  ]],
  ['WSL', wsl, [
    { name: 'UNC of a server file → linux path', input: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\gower\\repo\\f.ts', serverPath: '/home/gower/repo/f.ts' },
  ]],
  ['Docker', docker, [
    { name: 'host form of a mounted file → container path', input: 'C:\\Users\\gower\\repo\\src\\a.ts', serverPath: '/workspace/src/a.ts' },
    { name: 'container path outside the mounts stays', input: '/etc/hosts', serverPath: '/etc/hosts' },
  ]],
  ['SSH', ssh, [
    { name: 'home-mapped server file → server home', input: 'C:\\Users\\gower\\repo\\a.ts', serverPath: '/home/gower/repo/a.ts' },
    { name: 'server file outside home stays', input: '/etc/hosts', serverPath: '/etc/hosts' },
  ]],
]

function expectFixture(translator: PathTranslator, purpose: 'local-file' | 'workspace-entry', fx: Fixture) {
  const [result] = resolveClientPaths(translator, [fx.input], purpose)
  if (fx.serverPath === null) {
    expect(result).toEqual({ input: fx.input, serverPath: null, reachable: false, reason: fx.reason })
  } else {
    expect(result).toEqual({ input: fx.input, serverPath: fx.serverPath, reachable: true })
  }
}

describe('resolveClientPaths — purpose local-file', () => {
  for (const [name, factory, fixtures] of LOCAL_FILE) {
    for (const fx of fixtures) {
      it(`${name}: ${fx.name}`, () => expectFixture(factory(), 'local-file', fx))
    }
  }
})

describe('resolveClientPaths — purpose workspace-entry', () => {
  for (const [name, factory, fixtures] of WORKSPACE_ENTRY) {
    for (const fx of fixtures) {
      it(`${name}: ${fx.name}`, () => expectFixture(factory(), 'workspace-entry', fx))
    }
  }
})

describe('resolveClientPaths — input handling', () => {
  it('keeps order and answers each path of a batch', () => {
    const results = resolveClientPaths(wsl(), ['C:\\a.txt', '\\\\fileserver\\s\\b.txt', 'D:\\c.txt'], 'local-file')
    expect(results.map(r => [r.input, r.reachable])).toEqual([
      ['C:\\a.txt', true],
      ['\\\\fileserver\\s\\b.txt', false],
      ['D:\\c.txt', true],
    ])
  })

  it('no translator (remote window without a usable one) rejects everything', () => {
    expect(resolveClientPaths(null, ['C:\\a.txt'], 'local-file')).toEqual([
      { input: 'C:\\a.txt', serverPath: null, reachable: false, reason: 'no-translator' },
    ])
    expect(resolveClientPaths(null, ['C:\\a.txt'], 'workspace-entry')[0].reachable).toBe(false)
  })

  it('non-string / empty entries are invalid-path, even on Identity', () => {
    expect(resolveClientPaths(new IdentityTranslator(), ['', 42, null], 'local-file')).toEqual([
      { input: '', serverPath: null, reachable: false, reason: 'invalid-path' },
      { input: '', serverPath: null, reachable: false, reason: 'invalid-path' },
      { input: '', serverPath: null, reachable: false, reason: 'invalid-path' },
    ])
  })

  it('rejects a non-array paths argument and an unknown purpose', () => {
    expect(() => resolveClientPaths(new IdentityTranslator(), 'C:\\a.txt', 'local-file')).toThrow(/paths must be an array/)
    expect(() => resolveClientPaths(new IdentityTranslator(), ['C:\\a.txt'], 'upload')).toThrow(/unknown purpose/)
    expect(() => resolveClientPaths(new IdentityTranslator(), ['C:\\a.txt'], undefined)).toThrow(/unknown purpose/)
  })
})

describe('clientPathTranslatorForProfile', () => {
  const base: ProfileEntry = { id: 'p1', name: 'p1', type: 'remote', createdAt: 0, updatedAt: 0 }

  it('prefers the live connection translator', () => {
    const live = wsl()
    expect(clientPathTranslatorForProfile({ ...base, targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04' }, live)).toBe(live)
  })

  it('builds one from the profile when the slot does not serve it', () => {
    const t = clientPathTranslatorForProfile({ ...base, targetOS: 'docker-linux', dockerMounts: [{ host: 'C:\\r', container: '/w' }] }, null)
    expect(t).toBeInstanceOf(DockerPathTranslator)
  })

  it('a profile that needs a mapping but only has Identity resolves to null (fail-closed)', () => {
    expect(clientPathTranslatorForProfile({ ...base, targetOS: 'ssh-linux' }, new IdentityTranslator())).toBeNull()
    // createTranslator throws (no serverHome yet) → null, not Identity
    expect(clientPathTranslatorForProfile({ ...base, targetOS: 'ssh-linux' }, null)).toBeNull()
    expect(clientPathTranslatorForProfile({ ...base, targetOS: 'wsl-linux' }, null)).toBeNull()
  })

  it('legacy / local targetOS keeps Identity (T0421 rule: Identity is always reachable)', () => {
    expect(clientPathTranslatorForProfile({ ...base }, null)).toBeInstanceOf(IdentityTranslator)
    expect(clientPathTranslatorForProfile({ ...base, targetOS: 'local' }, new IdentityTranslator())).toBeInstanceOf(IdentityTranslator)
  })
})

describe(`${CHANNEL} classification (T0416 / T0422 guards)`, () => {
  const mainSource = fs.readFileSync(path.join(PROJECT_ROOT, 'electron', 'main.ts'), 'utf8')
  const preloadSource = fs.readFileSync(path.join(PROJECT_ROOT, 'electron', 'preload.ts'), 'utf8')

  it('is ALWAYS_LOCAL, IPC-bound (proxied list) and not HEADLESS_UNSUPPORTED', () => {
    expect(ALWAYS_LOCAL_CHANNELS.has(CHANNEL)).toBe(true)
    expect(PROXIED_CHANNELS.has(CHANNEL)).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(HEADLESS_UNSUPPORTED, CHANNEL)).toBe(false)
  })

  it('is path-free with an ALWAYS_LOCAL reason: its args are never auto-translated', () => {
    expect(PATH_FREE_CHANNELS.get(CHANNEL)).toMatch(/^ALWAYS_LOCAL \(never proxied\)/)
    expect(Object.prototype.hasOwnProperty.call(PATH_ARG_SCHEMA, CHANNEL)).toBe(false)
    expect(SERVER_PATH_RESULT_CHANNELS.has(CHANNEL)).toBe(false)
  })

  it('main registers the local handler and routes a detached window before the ALWAYS_LOCAL short-circuit', () => {
    expect(mainSource).toContain(`registerHandler('${CHANNEL}'`)
    const bind = mainSource.slice(mainSource.indexOf('function bindProxiedHandlersToIpc'))
    const detached = bind.indexOf(`channel === '${CHANNEL}'`)
    const alwaysLocal = bind.indexOf('if (ALWAYS_LOCAL_CHANNELS.has(channel))')
    expect(detached).toBeGreaterThan(-1)
    expect(alwaysLocal).toBeGreaterThan(detached)
  })

  it('preload exposes it as remote.resolveClientPaths', () => {
    expect(preloadSource).toMatch(/resolveClientPaths: \(paths: string\[\], purpose: ClientPathPurpose\) =>\s*ipcRenderer\.invoke\('remote:resolve-client-paths', paths, purpose\)/)
  })

  describe('headless', () => {
    let harness: HeadlessHarness

    beforeAll(async () => {
      harness = await startHeadlessHarness({ timeoutMs: 15_000 })
    })

    afterAll(async () => {
      await harness.dispose()
    })

    it('does not answer it (the client does)', async () => {
      await expect(harness.invoke(CHANNEL, ['C:\\a.txt'], 'local-file')).rejects.toThrow(`No handler for channel: ${CHANNEL}`)
    })
  })
})
