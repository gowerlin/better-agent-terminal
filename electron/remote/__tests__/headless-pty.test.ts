// @vitest-environment node
/**
 * T0390 (PLAN-036 P0-C): `pty:*` + `settings:get-shell-path` online on headless.
 *
 * Wire-level through the T0388 harness (in-process headless + wss client) with
 * real node-pty:
 *   - create → write → output → resize → get-cwd → kill → exit
 *   - re-sent `pty:create` (same id, also from a reconnected client) does not
 *     re-spawn: shell state survives, and a client disconnect does not kill it
 *   - restart: the old process's late exit does not delete / "exit" the new one
 *   - remote shell env carries no server token and no inherited BAT_* session vars
 *   - client-supplied shell must be an absolute path to an existing file
 * Plus pure units: shell validation, BAT_* scrub predicate, `auto` shell fallback.
 */
import * as fs from 'fs'
import * as os from 'os'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { shellPathRejection } from '../../handlers/pty'
import { logger } from '../../logger'
import { resolveShellPath } from '../../shell-path-resolver'
import { isHeadlessScrubbedEnvKey } from '../headless-entry'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'

const IS_WIN = process.platform === 'win32'
const SHELL = IS_WIN
  ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe')
  : (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh')
const NL = IS_WIN ? '\r\n' : '\n'
const CWD = os.tmpdir()

/**
 * Commands whose OUTPUT contains `<tag>:<value>:E` while the terminal echo of the
 * typed command does not (cmd `^:` escapes / printf `%s`), so echo never matches.
 */
const cmd = {
  setVar: (name: string, value: string) => IS_WIN ? `set ${name}=${value}` : `export ${name}=${value}`,
  printVar: (tag: string, name: string) => IS_WIN ? `echo ${tag}^:%${name}%^:E` : `printf '${tag}:%s:E\\n' "$${name}"`,
  dumpEnv: () => IS_WIN ? 'set' : 'env',
  marker: (tag: string) => IS_WIN ? `echo ${tag}^:done^:E` : `printf '${tag}:%s:E\\n' done`,
}

function plain(text: string): string {
  // ConPTY / readline interleave VT sequences with the text; drop them first.
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[=>]/g, '')
}

function outputOf(client: HeadlessClient, id: string, from = 0): string {
  return plain(client.events.slice(from)
    .filter(e => e.channel === 'pty:output' && e.args[0] === id)
    .map(e => String(e.args[1]))
    .join(''))
}

async function waitForOutput(client: HeadlessClient, id: string, re: RegExp, from = 0, timeoutMs = 15_000): Promise<RegExpMatchArray> {
  let match: RegExpMatchArray | null = null
  await vi.waitFor(() => {
    match = outputOf(client, id, from).match(re)
    expect(match, `no ${re} in output of ${id}`).not.toBeNull()
  }, { timeout: timeoutMs, interval: 50 })
  return match!
}

/** Type a command and wait for its marker; returns the output since the command was sent. */
async function run(client: HeadlessClient, id: string, line: string, re: RegExp): Promise<RegExpMatchArray> {
  const from = client.events.length
  expect(await client.invoke('pty:write', id, line + NL)).toEqual({ ok: true })
  return waitForOutput(client, id, re, from)
}

let harness: HeadlessHarness
let seq = 0
const termId = (label: string) => `t0390-${label}-${process.pid}-${seq++}`

beforeAll(async () => {
  harness = await startHeadlessHarness({ timeoutMs: 10_000 })
})

afterAll(async () => {
  await harness?.dispose()
})

describe('headless pty (T0390, real node-pty)', () => {
  it('settings:get-shell-path answers on headless', async () => {
    const shellPath = await harness.invoke('settings:get-shell-path', 'auto')
    expect(typeof shellPath).toBe('string')
    expect(String(shellPath).length).toBeGreaterThan(0)
  })

  it('create → write → output → resize → get-cwd → kill → exit', { timeout: 30_000 }, async () => {
    const id = termId('lifecycle')
    expect(await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', shell: SHELL })).toBe(true)

    await run(harness, id, cmd.marker('LIFE'), /LIFE:done:E/)
    expect(await harness.invoke('pty:resize', id, 100, 40)).toBeUndefined()
    expect(await harness.invoke('pty:get-cwd', id)).toBe(CWD)

    expect(await harness.invoke('pty:kill', id)).toBe(true)
    const exitArgs = await harness.waitForEvent('pty:exit', args => args[0] === id, 15_000)
    expect(exitArgs[0]).toBe(id)
    expect(await harness.invoke('pty:get-cwd', id)).toBeNull()
  })

  it('re-sent pty:create with the same id does not re-spawn, also from a reconnected client', { timeout: 40_000 }, async () => {
    const id = termId('idempotent')
    const createOpts = { id, cwd: CWD, type: 'terminal', shell: SHELL }
    const first = await harness.connect()
    expect(await first.invoke('pty:create', createOpts)).toBe(true)
    await run(first, id, cmd.setVar('T0390_STATE', 'alive'), /.*/)
    await run(first, id, cmd.printVar('ST1', 'T0390_STATE'), /ST1:alive:E/)

    // Same client re-sends (renderer reload): same shell, state kept.
    expect(await first.invoke('pty:create', createOpts)).toBe(true)
    await run(first, id, cmd.printVar('ST2', 'T0390_STATE'), /ST2:alive:E/)

    // BAT closed (client disconnects) and reopened (new client re-sends create).
    await first.close()
    const second = await harness.connect()
    expect(await second.invoke('pty:create', createOpts)).toBe(true)
    await run(second, id, cmd.printVar('ST3', 'T0390_STATE'), /ST3:alive:E/)

    expect(await second.invoke('pty:kill', id)).toBe(true)
    await second.waitForEvent('pty:exit', args => args[0] === id, 15_000)
    await second.close()
  })

  it('restart: the old process exit neither removes nor "exits" the new terminal', { timeout: 40_000 }, async () => {
    const logSpy = vi.spyOn(logger, 'log')
    try {
      const id = termId('restart')
      expect(await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', shell: SHELL })).toBe(true)
      await run(harness, id, cmd.marker('PRE'), /PRE:done:E/)

      const from = harness.events.length
      expect(await harness.invoke('pty:restart', id, CWD, SHELL)).toBe(true)
      await vi.waitFor(() => {
        expect(logSpy.mock.calls.some(c => String(c[0]).includes(`stale exit ignored id=${id}`))).toBe(true)
      }, { timeout: 15_000, interval: 50 })

      expect(await harness.invoke('pty:get-cwd', id)).toBe(CWD)
      expect(harness.events.slice(from).some(e => e.channel === 'pty:exit' && e.args[0] === id)).toBe(false)
      await run(harness, id, cmd.marker('POST'), /POST:done:E/)

      expect(await harness.invoke('pty:kill', id)).toBe(true)
      await harness.waitForEvent('pty:exit', args => args[0] === id, 15_000)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('remote shell env has no server token and no inherited BAT_* session vars', { timeout: 30_000 }, async () => {
    const inheritedKeys = ['BAT_REMOTE_TOKEN', 'BAT_REMOTE_PORT', 'BAT_HELPER_DIR', 'BAT_TOWER_TERMINAL_ID', 'BAT_TERMINAL_ID'] as const
    const saved = Object.fromEntries(inheritedKeys.map(k => [k, process.env[k]]))
    // As if bat-server had been started by hand from inside a BAT terminal.
    process.env.BAT_REMOTE_TOKEN = 'inherited-secret-t0390'
    process.env.BAT_REMOTE_PORT = '9876'
    process.env.BAT_HELPER_DIR = '/inherited/helper/dir'
    process.env.BAT_TOWER_TERMINAL_ID = 'inherited-tower-id'
    process.env.BAT_TERMINAL_ID = 'inherited-terminal-id'
    const id = termId('env')
    try {
      expect(await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', shell: SHELL })).toBe(true)
    } finally {
      for (const k of inheritedKeys) {
        if (saved[k] === undefined) delete process.env[k]
        else process.env[k] = saved[k]
      }
    }

    const from = harness.events.length
    await run(harness, id, `${cmd.dumpEnv()}${IS_WIN ? ' & ' : '; '}${cmd.marker('DUMP')}`, /DUMP:done:E/)
    const dump = outputOf(harness, id, from)

    // The dump really is the env: the PTY's own id is there.
    expect(dump).toContain(`BAT_TERMINAL_ID=${id}`)
    expect(dump).toContain('BAT_SESSION=1')
    expect(dump).not.toContain(harness.token)
    expect(dump).not.toContain('inherited-secret-t0390')
    expect(dump).not.toContain('inherited-tower-id')
    expect(dump).not.toContain('inherited-terminal-id')
    expect(dump).not.toMatch(/BAT_REMOTE_/)
    expect(dump).not.toMatch(/BAT_HELPER_DIR=/)
    expect(dump).not.toMatch(/BAT_TOWER_TERMINAL_ID=/)

    expect(await harness.invoke('pty:kill', id)).toBe(true)
  })

  it('rejects client-supplied shells that are not an absolute path to an existing file', { timeout: 30_000 }, async () => {
    const bad = [
      IS_WIN ? 'cmd.exe' : 'bash',
      IS_WIN ? 'C:\\t0390\\no-such-shell.exe' : '/t0390/no-such-shell',
      CWD, // a directory
      42,
    ]
    for (const shell of bad) {
      const id = termId('bad-shell')
      expect(await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', shell }), String(shell)).toBe(false)
      expect(await harness.invoke('pty:get-cwd', id)).toBeNull()
    }

    // pty:restart with a bad shell is refused before the running shell is killed.
    const id = termId('restart-bad-shell')
    expect(await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', shell: SHELL })).toBe(true)
    expect(await harness.invoke('pty:restart', id, CWD, IS_WIN ? 'cmd.exe' : 'bash')).toBe(false)
    expect(await harness.invoke('pty:get-cwd', id)).toBe(CWD)
    await run(harness, id, cmd.marker('ALIVE'), /ALIVE:done:E/)
    expect(await harness.invoke('pty:kill', id)).toBe(true)
  })
})

describe('shellPathRejection', () => {
  const stat = (files: string[], dirs: string[] = []) => (p: string) => {
    if (files.includes(p)) return { isFile: () => true }
    if (dirs.includes(p)) return { isFile: () => false }
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  }
  const abs = IS_WIN ? 'C:\\bin\\sh.exe' : '/bin/sh'
  const absDir = IS_WIN ? 'C:\\bin' : '/bin'

  it('accepts no shell (host default) and an existing absolute file', () => {
    expect(shellPathRejection(undefined, stat([]))).toBeNull()
    expect(shellPathRejection('', stat([]))).toBeNull()
    expect(shellPathRejection(abs, stat([abs]))).toBeNull()
  })

  it('rejects non-strings, relative paths, missing files and directories', () => {
    expect(shellPathRejection(7, stat([]))).toBe('shell must be a string')
    expect(shellPathRejection('bash', stat(['bash']))).toBe('shell must be an absolute path')
    expect(shellPathRejection(abs, stat([]))).toBe('shell does not exist')
    expect(shellPathRejection(absDir, stat([], [absDir]))).toBe('shell is not a file')
  })
})

describe('isHeadlessScrubbedEnvKey', () => {
  it('drops every inherited BAT_* key (any case) and nothing else', () => {
    for (const key of ['BAT_REMOTE_TOKEN', 'BAT_REMOTE_PORT', 'BAT_HELPER_DIR', 'BAT_TERMINAL_ID', 'BAT_TOWER_TERMINAL_ID', 'BAT_SESSION', 'bat_helper_dir']) {
      expect(isHeadlessScrubbedEnvKey(key), key).toBe(true)
    }
    for (const key of ['PATH', 'HOME', 'SHELL', 'LANG', 'BATCH_SIZE', 'XBAT_X']) {
      expect(isHeadlessScrubbedEnvKey(key), key).toBe(false)
    }
  })
})

describe('resolveShellPath auto fallback without $SHELL (aligned with PtyManager)', () => {
  const exists = (paths: string[]) => (p: string) => paths.includes(p)

  it('linux: /bin/bash, else /bin/sh', () => {
    expect(resolveShellPath('auto', { platform: 'linux', env: {}, existsSync: exists(['/bin/bash']) })).toBe('/bin/bash')
    expect(resolveShellPath('auto', { platform: 'linux', env: {}, existsSync: exists([]) })).toBe('/bin/sh')
    expect(resolveShellPath('pwsh', { platform: 'linux', env: {}, existsSync: exists(['/bin/bash']) })).toBe('/bin/bash')
  })

  it('darwin keeps /bin/zsh; $SHELL still wins everywhere', () => {
    expect(resolveShellPath('auto', { platform: 'darwin', env: {}, existsSync: exists(['/bin/bash']) })).toBe('/bin/zsh')
    expect(resolveShellPath('auto', { platform: 'linux', env: { SHELL: '/usr/bin/fish' }, existsSync: exists(['/bin/bash']) })).toBe('/usr/bin/fish')
  })
})
