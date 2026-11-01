// @vitest-environment node
/**
 * PLAN-057 / T0755: bat-server takes the login shell's PATH at startup.
 *
 * - pure logic: shell choice, argv, marker parsing, merge / dedupe / validation
 * - `applyHeadlessLoginShellPath` with an injected spawn / kill / timer (switch off → no spawn and
 *   `env` untouched, timeout → SIGKILL to the process group, finishes on `exit`)
 * - real shells (Linux / macOS only; skipped on win32): a hanging `.profile`, `exit 0` in
 *   `.profile`, a `setsid` grandchild holding stdout, rc noise around the marker
 * - source guards: bat-server.mjs calls it after resolveDataDir and before createHeadlessServer
 */
import { execFileSync } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { PassThrough } from 'stream'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  HEADLESS_LOGIN_SHELL_PATH_SETTING,
  LOGIN_SHELL_PATH_TIMEOUT_MS,
  applyHeadlessLoginShellPath,
  buildLoginShellPathArgs,
  extractMarkedValue,
  isHeadlessLoginShellPathEnabled,
  resolveLoginShellPath,
  selectHeadlessLoginShell,
  type ApplyHeadlessLoginShellPathDeps,
  type LoginShellSpawn,
} from '../headless-login-path'

const MARKER = '__BAT_LOGIN_PATH_0123456789abcdef01234567__'
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')

function source(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8')
}

// ── pure logic ────────────────────────────────────────────────────────────────

describe('selectHeadlessLoginShell', () => {
  it('uses SHELL first', () => {
    expect(selectHeadlessLoginShell('/bin/zsh', '/bin/bash')).toEqual({ shell: '/bin/zsh', kind: 'posix' })
  })

  it('falls back to the passwd shell when SHELL is unset, then to /bin/sh', () => {
    expect(selectHeadlessLoginShell(undefined, '/bin/bash')).toEqual({ shell: '/bin/bash', kind: 'posix' })
    expect(selectHeadlessLoginShell('', '/usr/bin/zsh')).toEqual({ shell: '/usr/bin/zsh', kind: 'posix' })
    expect(selectHeadlessLoginShell(undefined, undefined)).toEqual({ shell: '/bin/sh', kind: 'posix' })
  })

  it('maps a shell outside the whitelist (or a relative path) to /bin/sh', () => {
    expect(selectHeadlessLoginShell('/usr/bin/tcsh', undefined).shell).toBe('/bin/sh')
    expect(selectHeadlessLoginShell('bash', undefined).shell).toBe('/bin/sh')
    expect(selectHeadlessLoginShell('/bin/bash; rm -rf /', undefined).shell).toBe('/bin/sh')
  })

  it('accepts an absolute fish as kind fish', () => {
    expect(selectHeadlessLoginShell('/usr/bin/fish', undefined)).toEqual({ shell: '/usr/bin/fish', kind: 'fish' })
    expect(selectHeadlessLoginShell('fish', undefined)).toEqual({ shell: '/bin/sh', kind: 'posix' })
  })
})

describe('buildLoginShellPathArgs', () => {
  it('posix: -l -i -c with printf "$PATH" between the marker', () => {
    expect(buildLoginShellPathArgs('posix', MARKER)).toEqual([
      '-l', '-i', '-c', `printf '\\n%s%s%s\\n' '${MARKER}' "$PATH" '${MARKER}'`,
    ])
  })

  it('fish: string join : $PATH', () => {
    expect(buildLoginShellPathArgs('fish', MARKER)).toEqual([
      '-l', '-i', '-c', `printf '\\n%s%s%s\\n' '${MARKER}' (string join : $PATH) '${MARKER}'`,
    ])
  })
})

describe('resolveLoginShellPath', () => {
  const ORIGINAL = '/usr/local/bin:/usr/bin:/bin:/snap/bin:/snap/bin'

  it('finds the PATH between rc noise (banner, MOTD, OSC title)', () => {
    const stdout = [
      'Welcome to Ubuntu 24.04 LTS',
      '\u001b]0;user@host: ~\u0007banner',
      `${MARKER}/home/u/.local/bin:/usr/local/bin:/usr/bin:/bin${MARKER}`,
      'trailing noise',
    ].join('\n')
    const result = resolveLoginShellPath({ stdout, marker: MARKER, originalPath: ORIGINAL })
    expect(result).toEqual({
      ok: true,
      path: '/home/u/.local/bin:/usr/local/bin:/usr/bin:/bin:/snap/bin',
      added: 1,
      total: 5,
      mntEntries: 0,
    })
  })

  it('takes only the last marker pair', () => {
    const stdout = `${MARKER}/fake/early${MARKER}\n${MARKER}/real/bin:/usr/bin${MARKER}\n`
    const result = resolveLoginShellPath({ stdout, marker: MARKER, originalPath: '/usr/bin' })
    expect(result.ok && result.path).toBe('/real/bin:/usr/bin')
  })

  it('no marker (or a single one) → no-marker', () => {
    expect(resolveLoginShellPath({ stdout: '/usr/bin:/bin\n', marker: MARKER, originalPath: '/bin' }))
      .toEqual({ ok: false, reason: 'no-marker' })
    expect(resolveLoginShellPath({ stdout: `${MARKER}/usr/bin`, marker: MARKER, originalPath: '/bin' }))
      .toEqual({ ok: false, reason: 'no-marker' })
    expect(extractMarkedValue(`${MARKER}`, MARKER)).toBeNull()
  })

  it('keeps entries only the original PATH had (an rc file removed them), after the login entries', () => {
    const stdout = `${MARKER}/home/u/.local/bin:/usr/bin${MARKER}`
    const result = resolveLoginShellPath({ stdout, marker: MARKER, originalPath: '/usr/bin:/opt/unit-only/bin' })
    expect(result.ok && result.path).toBe('/home/u/.local/bin:/usr/bin:/opt/unit-only/bin')
  })

  it('deduplicates, keeping the first occurrence', () => {
    const stdout = `${MARKER}/a:/b:/a:/c:/b${MARKER}`
    const result = resolveLoginShellPath({ stdout, marker: MARKER, originalPath: '/c:/d:/d' })
    expect(result.ok && result.path).toBe('/a:/b:/c:/d')
    expect(result.ok && result.added).toBe(2)
  })

  it('drops relative and empty login entries', () => {
    const stdout = `${MARKER}bin:/usr/bin::.:~/x:/bin${MARKER}`
    const result = resolveLoginShellPath({ stdout, marker: MARKER, originalPath: '' })
    expect(result.ok && result.path).toBe('/usr/bin:/bin')
  })

  it('rejects the whole value on newline / CR / NUL, or when no entry is absolute', () => {
    expect(resolveLoginShellPath({ stdout: `${MARKER}/usr/bin\n/bin${MARKER}`, marker: MARKER, originalPath: '/bin' }))
      .toEqual({ ok: false, reason: 'invalid-chars' })
    expect(resolveLoginShellPath({ stdout: `${MARKER}/usr/bin\r${MARKER}`, marker: MARKER, originalPath: '/bin' }))
      .toEqual({ ok: false, reason: 'invalid-chars' })
    expect(resolveLoginShellPath({ stdout: `${MARKER}/usr/bin\u0000:/bin${MARKER}`, marker: MARKER, originalPath: '/bin' }))
      .toEqual({ ok: false, reason: 'invalid-chars' })
    expect(resolveLoginShellPath({ stdout: `${MARKER}bin:.${MARKER}`, marker: MARKER, originalPath: '/bin' }))
      .toEqual({ ok: false, reason: 'no-absolute-entries' })
  })

  it('counts /mnt/<drive>/ entries without filtering them (D207)', () => {
    const stdout = `${MARKER}/usr/bin:/mnt/c/Windows:/mnt/d/tools/bin:/mnt/wsl/x${MARKER}`
    const result = resolveLoginShellPath({ stdout, marker: MARKER, originalPath: '/usr/bin' })
    expect(result.ok && result.path).toBe('/usr/bin:/mnt/c/Windows:/mnt/d/tools/bin:/mnt/wsl/x')
    expect(result.ok && result.mntEntries).toBe(2)
  })
})

describe('isHeadlessLoginShellPathEnabled', () => {
  it('on unless the setting is exactly false', () => {
    expect(HEADLESS_LOGIN_SHELL_PATH_SETTING).toBe('headlessLoginShellPath')
    expect(isHeadlessLoginShellPathEnabled({})).toBe(true)
    expect(isHeadlessLoginShellPathEnabled({ headlessLoginShellPath: true })).toBe(true)
    expect(isHeadlessLoginShellPathEnabled({ headlessLoginShellPath: 'false' })).toBe(true)
    expect(isHeadlessLoginShellPathEnabled({ headlessLoginShellPath: 0 })).toBe(true)
    expect(isHeadlessLoginShellPathEnabled({ headlessLoginShellPath: false })).toBe(false)
  })
})

// ── apply with injected spawn ─────────────────────────────────────────────────

class FakeChild extends EventEmitter {
  pid = 4242
  stdout = new PassThrough()
  stderr = new PassThrough()
  kill = vi.fn(() => true)
}

interface Harness {
  deps: ApplyHeadlessLoginShellPathDeps
  env: NodeJS.ProcessEnv
  child: FakeChild
  spawnCalls: Array<{ file: string; args: string[]; options: Record<string, unknown> }>
  killGroup: ReturnType<typeof vi.fn>
  timers: Array<{ fn: () => void; ms: number; cleared: boolean }>
  logs: string[]
  logger: { log: (m: string) => void; warn: (m: string) => void }
}

function harness(overrides: Partial<ApplyHeadlessLoginShellPathDeps> = {}, env?: NodeJS.ProcessEnv): Harness {
  const child = new FakeChild()
  const spawnCalls: Harness['spawnCalls'] = []
  const timers: Harness['timers'] = []
  const logs: string[] = []
  const killGroup = vi.fn()
  const theEnv: NodeJS.ProcessEnv = env ?? { PATH: '/usr/bin:/bin', SHELL: '/bin/bash', HOME: '/home/u' }
  const spawn: LoginShellSpawn = (file, args, options) => {
    spawnCalls.push({ file, args, options: options as Record<string, unknown> })
    return child as never
  }
  let clock = 1000
  const deps: ApplyHeadlessLoginShellPathDeps = {
    platform: 'linux',
    env: theEnv,
    getUserShell: () => '/bin/bash',
    readSettings: () => ({}),
    makeMarker: () => MARKER,
    now: () => (clock += 40),
    spawn,
    killGroup,
    setTimer: (fn, ms) => {
      const t = { fn, ms, cleared: false }
      timers.push(t)
      return t
    },
    clearTimer: (handle) => { (handle as { cleared: boolean }).cleared = true },
    ...overrides,
  }
  const logger = { log: (m: string) => logs.push(m), warn: (m: string) => logs.push(`WARN ${m}`) }
  return { deps, env: theEnv, child, spawnCalls, killGroup, timers, logs, logger }
}

async function flush(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve))
}

describe('applyHeadlessLoginShellPath (injected spawn)', () => {
  it('switch false → no spawn, env deep-equal, logs off (setting)', async () => {
    const h = harness({ readSettings: () => ({ headlessLoginShellPath: false }) })
    const before = structuredClone(h.env)
    const result = await applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    expect(result).toEqual({ status: 'off' })
    expect(h.spawnCalls).toHaveLength(0)
    expect(h.timers).toHaveLength(0)
    expect(h.env).toStrictEqual(before)
    expect(h.logs).toEqual(['[bat-server] login shell PATH: off (setting)'])
  })

  it('win32 → skipped, no spawn', async () => {
    const h = harness({ platform: 'win32' })
    const before = structuredClone(h.env)
    const result = await applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    expect(result).toEqual({ status: 'skipped', reason: 'win32' })
    expect(h.spawnCalls).toHaveLength(0)
    expect(h.env).toStrictEqual(before)
  })

  it('reads the setting from <dataDir>/settings.json by default', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0755-settings-'))
    try {
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ headlessLoginShellPath: false }))
      const h = harness({ readSettings: undefined })
      const result = await applyHeadlessLoginShellPath({ dataDir: dir, logger: h.logger, deps: h.deps })
      expect(result.status).toBe('off')
      expect(h.spawnCalls).toHaveLength(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('spawns <shell> -l -i -c detached with the env, applies the merged PATH and logs counts only', async () => {
    const h = harness()
    const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    await flush()
    expect(h.spawnCalls).toHaveLength(1)
    expect(h.spawnCalls[0].file).toBe('/bin/bash')
    expect(h.spawnCalls[0].args).toEqual(buildLoginShellPathArgs('posix', MARKER))
    expect(h.spawnCalls[0].options).toMatchObject({ detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    expect(h.spawnCalls[0].options.env).toBe(h.env)
    expect(h.timers[0].ms).toBe(LOGIN_SHELL_PATH_TIMEOUT_MS)

    h.child.stdout.write(`motd line\n${MARKER}/home/u/.local/bin:/usr/bin:/bin${MARKER}\n`)
    await flush()
    h.child.emit('exit', 0, null)
    const result = await pending
    expect(result).toMatchObject({ status: 'applied', shell: '/bin/bash', added: 1, total: 3, mntEntries: 0 })
    expect(h.env.PATH).toBe('/home/u/.local/bin:/usr/bin:/bin')
    expect(h.timers[0].cleared).toBe(true)
    expect(h.killGroup).not.toHaveBeenCalled()
    expect(h.child.stdout.destroyed).toBe(true)
    expect(h.child.stderr.destroyed).toBe(true)
    expect(h.logs).toHaveLength(1)
    expect(h.logs[0]).toMatch(/^\[bat-server\] login shell PATH: applied \(shell=\/bin\/bash, \d+ ms, \+1 entries, 3 total, \/mnt 0\)$/)
    expect(h.logs[0]).not.toContain('.local')
  })

  it('finishes on exit even when close never comes (a grandchild holds the pipes)', async () => {
    const h = harness()
    const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    await flush()
    h.child.stdout.write(`${MARKER}/x/bin:/usr/bin${MARKER}`)
    await flush()
    h.child.emit('exit', 0, null) // no 'close'
    const result = await pending
    expect(result.status).toBe('applied')
  })

  it('non-zero exit with a marker still applies', async () => {
    const h = harness()
    const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    await flush()
    h.child.stdout.write(`${MARKER}/x/bin:/usr/bin${MARKER}`)
    await flush()
    h.child.emit('exit', 3, null)
    expect((await pending).status).toBe('applied')
    expect(h.env.PATH).toBe('/x/bin:/usr/bin:/bin')
  })

  it('no marker (rc exit 0 / exec) → failed, PATH unchanged', async () => {
    const h = harness()
    const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    await flush()
    h.child.stdout.write('/evil/bin:/usr/bin\n')
    await flush()
    h.child.emit('exit', 0, null)
    const result = await pending
    expect(result).toMatchObject({ status: 'failed', reason: 'no-marker, exit 0' })
    expect(h.env.PATH).toBe('/usr/bin:/bin')
    expect(h.logs[0]).toMatch(/^WARN \[bat-server\] login shell PATH: failed \(no-marker, exit 0; shell=\/bin\/bash, \d+ ms\) — PATH unchanged$/)
  })

  it('timeout → SIGKILL to the process group (-pid), failed, PATH unchanged', async () => {
    const h = harness()
    const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    await flush()
    h.timers[0].fn()
    expect(h.killGroup).toHaveBeenCalledWith(4242, 'SIGKILL')
    expect(h.child.kill).not.toHaveBeenCalled()
    h.child.emit('exit', null, 'SIGKILL')
    const result = await pending
    expect(result).toMatchObject({ status: 'failed', reason: `timeout ${LOGIN_SHELL_PATH_TIMEOUT_MS} ms` })
    expect(h.env.PATH).toBe('/usr/bin:/bin')
    expect(h.child.stdout.destroyed).toBe(true)
  })

  it('default killGroup signals the negative pid', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    try {
      const h = harness({ killGroup: undefined })
      const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
      await flush()
      h.timers[0].fn()
      expect(kill).toHaveBeenCalledWith(-4242, 'SIGKILL')
      h.child.emit('exit', null, 'SIGKILL')
      await pending
    } finally {
      kill.mockRestore()
    }
  })

  it('timeout without an exit event still finishes after the grace timer', async () => {
    const h = harness()
    const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    await flush()
    h.timers[0].fn()
    expect(h.timers).toHaveLength(2)
    h.timers[1].fn()
    expect((await pending).status).toBe('failed')
  })

  it('spawn error (ENOENT) → failed, PATH unchanged', async () => {
    const h = harness()
    const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    await flush()
    h.child.emit('error', Object.assign(new Error('spawn /bin/bash ENOENT'), { code: 'ENOENT' }))
    expect(await pending).toMatchObject({ status: 'failed', reason: 'spawn error ENOENT' })
    expect(h.env.PATH).toBe('/usr/bin:/bin')
  })

  it('a throwing spawn → failed, never throws', async () => {
    const h = harness({ spawn: () => { throw Object.assign(new Error('x'), { code: 'EACCES' }) } })
    expect(await applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps }))
      .toMatchObject({ status: 'failed', reason: 'spawn error EACCES' })
    expect(h.env.PATH).toBe('/usr/bin:/bin')
  })

  it('SHELL unset → passwd shell; fish uses string join', async () => {
    const h = harness({ getUserShell: () => '/usr/bin/fish' }, { PATH: '/usr/bin' })
    const pending = applyHeadlessLoginShellPath({ dataDir: '/data', logger: h.logger, deps: h.deps })
    await flush()
    expect(h.spawnCalls[0].file).toBe('/usr/bin/fish')
    expect(h.spawnCalls[0].args[3]).toContain('(string join : $PATH)')
    h.child.emit('exit', 0, null)
    await pending
  })
})

// ── real shells (Linux / macOS) ───────────────────────────────────────────────

function hasCommand(cmd: string): boolean {
  if (process.platform === 'win32') return false
  try {
    execFileSync('/bin/sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

const CAN_RUN_REAL = process.platform !== 'win32' && fs.existsSync('/bin/bash')
const HAS_SETSID = CAN_RUN_REAL && hasCommand('setsid')

function taggedPids(tag: string): number[] {
  const out = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8', timeout: 5000 })
  return out
    .split('\n')
    .filter(line => line.includes(tag))
    .map(line => Number.parseInt(line.trim().split(/\s+/)[0], 10))
    .filter(pid => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
}

function killTagged(tag: string): void {
  for (const pid of taggedPids(tag)) {
    try { process.kill(pid, 'SIGKILL') } catch { /* gone */ }
  }
}

describe.skipIf(!CAN_RUN_REAL)('applyHeadlessLoginShellPath (real bash)', () => {
  const homes: string[] = []
  const tags: string[] = []

  afterAll(() => {
    for (const tag of tags) killTagged(tag)
    for (const home of homes) fs.rmSync(home, { recursive: true, force: true })
  })

  function makeHome(profile: string): { home: string; env: NodeJS.ProcessEnv; tag: string } {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0755-home-'))
    homes.push(home)
    const tag = `bat-t0755-${path.basename(home).slice(-6)}`
    tags.push(tag)
    fs.writeFileSync(path.join(home, '.profile'), profile.replace(/@TAG@/g, tag))
    return { home, tag, env: { HOME: home, PATH: '/usr/bin:/bin', SHELL: '/bin/bash', LANG: 'C' } }
  }

  async function waitNoTagged(tag: string): Promise<number[]> {
    for (let i = 0; i < 10; i++) {
      const pids = taggedPids(tag)
      if (pids.length === 0) return []
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return taggedPids(tag)
  }

  // `trap '' TERM`: the shell and what it starts ignore SIGTERM (an interactive bash does too), so
  // only a SIGKILL to the whole process group ends it without leftovers.
  it('a hanging .profile (sleep 37, SIGTERM ignored) ends within 3.5 s, PATH unchanged, nothing left behind', async () => {
    const { env, tag } = makeHome(`trap '' TERM\nsh -c 'sleep 37; :' @TAG@\n`)
    const started = Date.now()
    const result = await applyHeadlessLoginShellPath({ dataDir: '/nonexistent', logger: { log: () => {} }, deps: { env, readSettings: () => ({}) } })
    const elapsed = Date.now() - started
    expect(result).toMatchObject({ status: 'failed', reason: `timeout ${LOGIN_SHELL_PATH_TIMEOUT_MS} ms` })
    expect(elapsed).toBeLessThan(3500)
    expect(env.PATH).toBe('/usr/bin:/bin')
    expect(await waitNoTagged(tag)).toEqual([])
  }, 15000)

  it('exit 0 in .profile → no marker, PATH unchanged', async () => {
    const { env } = makeHome('exit 0\n')
    const result = await applyHeadlessLoginShellPath({ dataDir: '/nonexistent', logger: { log: () => {} }, deps: { env, readSettings: () => ({}) } })
    expect(result).toMatchObject({ status: 'failed' })
    expect(result.status === 'failed' && result.reason).toMatch(/^no-marker/)
    expect(env.PATH).toBe('/usr/bin:/bin')
  }, 15000)

  // /etc/profile may add its own entries (Ubuntu: /snap/bin), so only the rc entry's position, the
  // original entries and the absence of duplicates are asserted.
  function expectRcEntryFirst(pathValue: string | undefined, home: string): void {
    const entries = (pathValue ?? '').split(':')
    expect(entries[0]).toBe(`${home}/t0755-bin`)
    expect(entries).toEqual(expect.arrayContaining(['/usr/bin', '/bin']))
    expect(new Set(entries).size).toBe(entries.length)
  }

  it('rc noise (banner, OSC title) around the marker → applied, rc entry first', async () => {
    const { home, env } = makeHome(`echo 'Welcome banner'\nprintf '\\033]0;title\\007'\nexport PATH="$HOME/t0755-bin:$PATH"\n`)
    const result = await applyHeadlessLoginShellPath({ dataDir: '/nonexistent', logger: { log: () => {} }, deps: { env, readSettings: () => ({}) } })
    expect(result).toMatchObject({ status: 'applied' })
    expectRcEntryFirst(env.PATH, home)
  }, 15000)

  it.skipIf(!HAS_SETSID)('a setsid grandchild holding stdout does not delay the result', async () => {
    const { home, env, tag } = makeHome(`setsid sh -c 'sleep 37; :' @TAG@ &\nexport PATH="$HOME/t0755-bin:$PATH"\n`)
    const started = Date.now()
    try {
      const result = await applyHeadlessLoginShellPath({ dataDir: '/nonexistent', logger: { log: () => {} }, deps: { env, readSettings: () => ({}) } })
      expect(result).toMatchObject({ status: 'applied' })
      expect(Date.now() - started).toBeLessThan(LOGIN_SHELL_PATH_TIMEOUT_MS)
      expectRcEntryFirst(env.PATH, home)
    } finally {
      killTagged(tag)
    }
  }, 15000)
})

// ── source guards ─────────────────────────────────────────────────────────────

describe('wiring (source guards)', () => {
  it('bat-server.mjs awaits applyHeadlessLoginShellPath?.() after resolveDataDir and before createHeadlessServer', () => {
    const code = source('scripts/bat-server.mjs')
    const main = code.slice(code.indexOf('async function main()'))
    const dataDir = main.indexOf('resolveDataDir(')
    const apply = main.indexOf('await serverEntry.applyHeadlessLoginShellPath?.({ dataDir')
    const create = main.indexOf('serverEntry.createHeadlessServer(')
    expect(dataDir).toBeGreaterThan(0)
    expect(apply).toBeGreaterThan(dataDir)
    expect(create).toBeGreaterThan(apply)
    expect(code.match(/applyHeadlessLoginShellPath/g)).toHaveLength(1)
  })

  it('server-entry exports it; createHeadlessServer never calls it', () => {
    expect(source('electron/remote/server-entry.ts')).toMatch(/export \{ applyHeadlessLoginShellPath \} from '\.\/headless-login-path'/)
    expect(source('electron/remote/headless-entry.ts')).not.toContain('applyHeadlessLoginShellPath')
    expect(source('electron/remote/headless-entry.ts')).not.toContain('headless-login-path')
  })

  it('the module does not import electron and never uses execFile / spawnSync timeouts', () => {
    const code = source('electron/remote/headless-login-path.ts').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/from 'electron'|require\('electron'\)/)
    expect(code).not.toMatch(/\bexecFile\b|\bexecFileSync\b|\bspawnSync\b|\bexecSync\b/)
    expect(code).toContain('detached: true')
    expect(code).toContain("killGroup(pid, 'SIGKILL')")
    expect(code).not.toMatch(/\.on\('close'/)
  })
})
