// @vitest-environment node
/**
 * T0705 (BUG-171 follow-up): the Terminal Server's own settings (`BAT_IDLE_TIMEOUT_MS`,
 * `BAT_SCROLL_BUFFER_LINES`, set by main.ts on fork) must not reach the PTYs it spawns;
 * the env the host sent still does, and still wins over the server's env.
 *
 * `buildServerPtyEnv` is checked directly; one real node-pty shell through `handleMessage`
 * checks that `createPty` uses it. Client transport is stubbed as in
 * terminal-server-stale-exit.test.ts.
 */
import * as fs from 'fs'
import * as os from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TERMINAL_SERVER_OWN_ENV_KEYS, TerminalServer, buildServerPtyEnv } from '../terminal-server/server'
import type { ServerResponse } from '../terminal-server/protocol'

const IS_WIN = process.platform === 'win32'
const SHELL = IS_WIN
  ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe')
  : (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh')
const NL = IS_WIN ? '\r\n' : '\n'

describe('buildServerPtyEnv', () => {
  const serverEnv = {
    PATH: '/usr/bin',
    BAT_USER_DATA: '/data/bat',
    BAT_IDLE_TIMEOUT_MS: '1800000',
    BAT_SCROLL_BUFFER_LINES: '1000',
    ELECTRON_RUN_AS_NODE: '1',
    SHARED: 'server',
  }

  it('lists the server settings main.ts forks it with', () => {
    expect([...TERMINAL_SERVER_OWN_ENV_KEYS].sort()).toEqual(['BAT_IDLE_TIMEOUT_MS', 'BAT_SCROLL_BUFFER_LINES'])
  })

  it('leaves out the server settings and keeps the rest of the server env', () => {
    const env = buildServerPtyEnv(serverEnv, undefined)
    expect(env).not.toHaveProperty('BAT_IDLE_TIMEOUT_MS')
    expect(env).not.toHaveProperty('BAT_SCROLL_BUFFER_LINES')
    expect(env).not.toHaveProperty('ELECTRON_RUN_AS_NODE')
    expect(env.PATH).toBe('/usr/bin')
    expect(env.BAT_USER_DATA).toBe('/data/bat')
    expect(env.SHARED).toBe('server')
  })

  it('keeps the host env, which wins over the server env', () => {
    const env = buildServerPtyEnv(serverEnv, {
      SHARED: 'host',
      BAT_TERMINAL_ID: 'term-1',
      BAT_REMOTE_PORT: '9876',
      BAT_USER_DATA: '/host/bat',
    })
    expect(env.SHARED).toBe('host')
    expect(env.BAT_TERMINAL_ID).toBe('term-1')
    expect(env.BAT_REMOTE_PORT).toBe('9876')
    expect(env.BAT_USER_DATA).toBe('/host/bat')
  })

  it('a key the host sends on purpose is kept, even one of the server settings', () => {
    const env = buildServerPtyEnv(serverEnv, { BAT_IDLE_TIMEOUT_MS: 'host-value' })
    expect(env.BAT_IDLE_TIMEOUT_MS).toBe('host-value')
  })

  it('terminal defaults are set last', () => {
    const env = buildServerPtyEnv(serverEnv, { TERM: 'dumb', CI: 'true' })
    expect(env).toMatchObject({
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'better-agent-terminal',
      BAT_SESSION: '1',
      FORCE_COLOR: '3',
      CI: '',
    })
  })

  it('does not change the server env it reads', () => {
    const copy = { ...serverEnv }
    buildServerPtyEnv(copy, { SHARED: 'host' })
    expect(copy).toEqual(serverEnv)
  })
})

describe('real node-pty through handleMessage', () => {
  const ID = `t0705-${process.pid}`
  const saved: Record<string, string | undefined> = {}
  let server: TerminalServer
  let broadcasts: ServerResponse[]

  beforeEach(() => {
    for (const key of TERMINAL_SERVER_OWN_ENV_KEYS) saved[key] = process.env[key]
    process.env.BAT_IDLE_TIMEOUT_MS = '1800000'
    process.env.BAT_SCROLL_BUFFER_LINES = '1000'
    server = new TerminalServer(0, 100)
    broadcasts = []
    const internals = server as unknown as {
      broadcastToAll(msg: ServerResponse): void
      sendToClient(msg: ServerResponse): void
    }
    vi.spyOn(internals, 'broadcastToAll').mockImplementation((msg) => { broadcasts.push(msg) })
    vi.spyOn(internals, 'sendToClient').mockImplementation(() => {})
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    server.handleMessage({ type: 'pty:kill', id: ID }, 'ipc')
    for (const key of TERMINAL_SERVER_OWN_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
    vi.restoreAllMocks()
  })

  function output(): string {
    return broadcasts
      .flatMap(m => (m.type === 'pty:data' && m.id === ID ? [m.data] : []))
      .join('')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[=>]/g, '')
  }

  it('the shell sees the host env but not the server settings', async () => {
    server.handleMessage({
      type: 'pty:create', id: ID, shell: SHELL, args: [], cwd: os.tmpdir(), cols: 200, rows: 24,
      env: { T0705_HOST: 'host-val' },
    }, 'ipc')

    // Output reads `T0705:[<idle>]:[<scroll>]:[<host>]`; the echo of the typed command does
    // not (cmd `^:` / printf `T07%s:` with `05` as an argument — the echo of a literal
    // `T0705:[%s]...` format would match first, T0707). cmd leaves an unset `%VAR%` as typed; sh prints ''.
    const cmd = IS_WIN
      ? 'echo T0705^:[%BAT_IDLE_TIMEOUT_MS%]^:[%BAT_SCROLL_BUFFER_LINES%]^:[%T0705_HOST%]'
      : `printf 'T07%s:[%s]:[%s]:[%s]\\n' 05 "$BAT_IDLE_TIMEOUT_MS" "$BAT_SCROLL_BUFFER_LINES" "$T0705_HOST"`
    server.handleMessage({ type: 'pty:write', id: ID, data: cmd + NL }, 'ipc')

    let match: RegExpMatchArray | null = null
    await vi.waitFor(() => {
      match = output().match(/T0705:\[([^\]\r\n]*)\]:\[([^\]\r\n]*)\]:\[([^\]\r\n]*)\]/)
      expect(match).not.toBeNull()
    }, { timeout: 15_000, interval: 50 })

    const [, idle, scroll, host] = match!
    const unset = (name: string) => (IS_WIN ? `%${name}%` : '')
    expect(idle).toBe(unset('BAT_IDLE_TIMEOUT_MS'))
    expect(scroll).toBe(unset('BAT_SCROLL_BUFFER_LINES'))
    expect(host).toBe('host-val')
  }, 30_000)
})
