// @vitest-environment node
/**
 * T0562 / D147: `bat-terminal.mjs --set-role tower [--terminal-id <id>] [--agent <id>]`.
 *
 * Against a mock RemoteServer (same as bat-terminal-close-worker.test.ts) that keeps
 * broadcasting, so the reply is matched by frame id (BUG-114):
 *   - ok → exit 0 + `✓ Tower role set: <id>`; terminal id from BAT_TERMINAL_ID or --terminal-id
 *   - NOT_FOUND 3 / INVALID_ARGS 1, `set-role: <CODE>` on stderr
 *   - a BAT without the handler → exit 1 UNSUPPORTED; a refused capability → exit 1 FORBIDDEN;
 *     no reply → exit 1 TIMEOUT; no server → exit 1 CONNECT_FAILED; outside BAT → NOT_IN_BAT
 *   - usage errors (no server contacted, no terminal created) and --help
 * The helper's NDJSON log goes to a temp dir (BAT_HELPER_LOG_DIR / BAT_USER_DATA), never the real one.
 *
 * T0565 / D148: `--set-role tower --mode yolo|ask|off|on` — sent as `mode` (trimmed, lower case),
 * `  mode: <m>` printed when BAT answers with the recorded mode, logged; another value → exit 1
 * USAGE; no --mode → request unchanged from T0562. `--mode` of a new tab keeps its exact grammar.
 */
import { createHash, X509Certificate } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import tls from 'node:tls'
import selfsigned from 'selfsigned'
import { afterAll, describe, expect, it } from 'vitest'

const repoRoot = resolve(__dirname, '..', '..')
const helper = join(repoRoot, 'scripts', 'bat-terminal.mjs')
const tempDirs: string[] = []

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

function wsFrame(payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body])
  const header = Buffer.alloc(4)
  header[0] = 0x81
  header[1] = 126
  header.writeUInt16BE(body.length, 2)
  return Buffer.concat([header, body])
}

function parseClientFrame(buffer: Buffer): { opcode: number; message: string; rest: Buffer } | null {
  if (buffer.length < 2) return null
  const opcode = buffer[0] & 0x0f
  let length = buffer[1] & 0x7f
  let offset = 2
  if (length === 126) {
    if (buffer.length < 4) return null
    length = buffer.readUInt16BE(2)
    offset = 4
  } else if (length === 127) {
    if (buffer.length < 10) return null
    length = Number(buffer.readBigUInt64BE(2))
    offset = 10
  }
  if (buffer.length < offset + 4 + length) return null
  const mask = buffer.subarray(offset, offset + 4)
  offset += 4
  const payload = Buffer.alloc(length)
  for (let i = 0; i < length; i++) payload[i] = buffer[offset + i] ^ mask[i & 3]
  return { opcode, message: payload.toString('utf8'), rest: buffer.subarray(offset + length) }
}

interface Invoke { id: string; channel: string; args: unknown[] }
interface MockRemote {
  port: number
  env: Record<string, string>
  dir: string
  invokes: Invoke[]
  close(): Promise<void>
}

/** `reply`: the invoke-result fields of the invoke; null = never answer. */
async function startMockRemote(reply: Record<string, unknown> | null): Promise<MockRemote> {
  const pems = await selfsigned.generate([{ name: 'commonName', value: '127.0.0.1' }], {
    keySize: 2048, algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }],
  })
  const dir = join(tmpdir(), `bat-set-role-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  tempDirs.push(dir)
  const certPath = join(dir, 'server-cert.json')
  writeFileSync(certPath, JSON.stringify({ fingerprint: new X509Certificate(pems.cert).fingerprint256 }), 'utf8')
  const invokes: Invoke[] = []

  const server = tls.createServer({ key: pems.private, cert: pems.cert }, (socket) => {
    let buffer: Buffer = Buffer.alloc(0)
    let upgraded = false
    let n = 0
    let ticker: ReturnType<typeof setInterval> | null = null
    const stop = () => { if (ticker) clearInterval(ticker) }
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])
      if (!upgraded) {
        const end = buffer.indexOf('\r\n\r\n')
        if (end === -1) return
        const key = /^Sec-WebSocket-Key:\s*(.+)$/im.exec(buffer.subarray(0, end).toString('utf8'))?.[1]?.trim()
        if (!key) { socket.destroy(); return }
        const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
        socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
        buffer = buffer.subarray(end + 4)
        upgraded = true
      }
      for (;;) {
        const frame = parseClientFrame(buffer)
        if (!frame) return
        buffer = frame.rest
        if (frame.opcode === 0x08) { stop(); socket.end(); return }
        const msg = JSON.parse(frame.message) as { type: string; id: string; channel?: string; args?: unknown[] }
        if (msg.type === 'auth') {
          socket.write(wsFrame({ type: 'auth-result', id: msg.id, result: { platform: 'test' } }))
          // broadcasts to every full-token client (BUG-114): the reply must be matched by id
          ticker = setInterval(() => {
            if (socket.destroyed) return stop()
            socket.write(wsFrame({ type: 'event', id: '0', channel: 'pty:output', args: ['other', `out ${n++}\r\n`] }))
          }, 2)
        } else if (msg.type === 'invoke') {
          invokes.push({ id: msg.id, channel: msg.channel ?? '', args: msg.args ?? [] })
          if (reply === null) continue
          setTimeout(() => { if (!socket.destroyed) socket.write(wsFrame({ type: 'invoke-result', id: msg.id, ...reply })) }, 20)
        }
      }
    })
    socket.on('error', stop)
    socket.on('close', stop)
  })
  await new Promise<void>((res, rej) => { server.once('error', rej); server.listen(0, '127.0.0.1', () => res()) })
  const port = (server.address() as { port: number }).port
  return {
    port,
    dir,
    invokes,
    env: {
      BAT_REMOTE_PORT: String(port),
      BAT_REMOTE_TOKEN: 'test-token',
      BAT_SERVER_CERT_PATH: certPath,
      BAT_HELPER_LOG_DIR: join(dir, 'Logs'),
      BAT_USER_DATA: dir,
    },
    close: () => new Promise<void>((res) => server.close(() => res())),
  }
}

interface Run { code: number | null; stdout: string; stderr: string }

function run(args: string[], env: Record<string, string>): Promise<Run> {
  return new Promise((res) => {
    const childEnv: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) childEnv[k] = v
    const child = spawn(process.execPath, [helper, ...args], { cwd: repoRoot, env: { ...childEnv, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
    child.on('close', (code) => res({ code, stdout, stderr }))
  })
}

function helperEvents(dir: string, event: string): Array<Record<string, unknown>> {
  const file = join(dir, 'Logs', 'bat-scripts.log')
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>)
    .filter(e => e.script === 'bat-terminal' && e.event === event)
}

const TOWER_ID = 'a'.repeat(32)

describe('bat-terminal --set-role (T0562)', () => {
  it('ok → exit 0, terminal id from BAT_TERMINAL_ID, no agent sent, logged as set-role', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: TOWER_ID, role: 'tower' } })
    try {
      const r = await run(['--set-role', 'tower'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout.trim()).toBe(`✓ Tower role set: ${TOWER_ID}`)
      expect(r.stderr).not.toContain('--workspace not specified')
      expect(remote.invokes).toEqual([{ id: expect.any(String), channel: 'terminal:set-role', args: [{ terminalId: TOWER_ID, role: 'tower' }] }])
      expect(helperEvents(remote.dir, 'set-role').at(-1)).toMatchObject({ terminalId: TOWER_ID, role: 'tower', agent: null, result: 'OK' })
      expect(helperEvents(remote.dir, 'exit').at(-1)).toMatchObject({ code: 0, reason: 'set-role-done' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('--terminal-id wins over BAT_TERMINAL_ID; --agent is sent as the hint; role is trimmed / case-insensitive', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'other-tab', role: 'tower' } })
    try {
      const r = await run(['--set-role', ' TOWER ', '--terminal-id', 'other-tab', '--agent', 'codex'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout.trim()).toBe('✓ Tower role set: other-tab')
      expect(remote.invokes[0].args).toEqual([{ terminalId: 'other-tab', role: 'tower', agent: 'codex' }])
    } finally {
      await remote.close()
    }
  }, 20000)

  for (const [code, exit] of [['NOT_FOUND', 3], ['INVALID_ARGS', 1]] as const) {
    it(`${code} → exit ${exit}, "set-role: ${code}" on stderr`, async () => {
      const remote = await startMockRemote({ result: { ok: false, code } })
      try {
        const r = await run(['--set-role', 'tower'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
        expect(r.code, r.stderr).toBe(exit)
        expect(r.stderr).toContain(`set-role: ${code}`)
        expect(r.stderr).toContain(`Error: Role not set (${code})`)
        expect(r.stdout).not.toContain('✓')
        expect(helperEvents(remote.dir, 'set-role').at(-1)).toMatchObject({ result: code })
        expect(helperEvents(remote.dir, 'exit').at(-1)).toMatchObject({ code: exit, reason: `set-role-${code}` })
      } finally {
        await remote.close()
      }
    }, 20000)
  }

  it('a BAT without the handler (before T0562) → exit 1 UNSUPPORTED', async () => {
    const remote = await startMockRemote({ error: 'No handler for channel: terminal:set-role' })
    try {
      const r = await run(['--set-role', 'tower'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('This BAT does not support --set-role')
      expect(r.stderr).toContain('set-role: UNSUPPORTED')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('a capability refusal (remote worker / another terminal) → exit 1 FORBIDDEN', async () => {
    const remote = await startMockRemote({ error: 'Forbidden: role-not-allowed' })
    try {
      const r = await run(['--set-role', 'tower'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('Forbidden: role-not-allowed')
      expect(r.stderr).toContain('set-role: FORBIDDEN')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('an unexpected answer (false) → exit 1 ERROR', async () => {
    const remote = await startMockRemote({ result: false })
    try {
      const r = await run(['--set-role', 'tower'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('set-role: ERROR')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('no reply (broadcasts only) → exit 1 TIMEOUT', async () => {
    const remote = await startMockRemote(null)
    try {
      const r = await run(['--set-role', 'tower'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('set-role: TIMEOUT')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('cannot connect → exit 1 CONNECT_FAILED', async () => {
    const remote = await startMockRemote(null)
    await remote.close()
    const r = await run(['--set-role', 'tower'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('set-role: CONNECT_FAILED')
  }, 20000)

  it('outside BAT (no BAT_REMOTE_PORT) → exit 1 NOT_IN_BAT', async () => {
    const dir = join(tmpdir(), `bat-set-role-nobat-${process.pid}-${Date.now()}`)
    tempDirs.push(dir)
    const r = await run(['--set-role', 'tower', '--terminal-id', 'x'], { BAT_HELPER_LOG_DIR: join(dir, 'Logs'), BAT_USER_DATA: dir })
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('set-role: NOT_IN_BAT')
  }, 20000)
})

describe('bat-terminal --set-role usage (T0562)', () => {
  const dir = join(tmpdir(), `bat-set-role-usage-${process.pid}-${Date.now()}`)
  tempDirs.push(dir)
  // A port nothing listens on: a usage error must exit before connecting.
  const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'x', BAT_HELPER_LOG_DIR: join(dir, 'Logs'), BAT_USER_DATA: dir, BAT_TERMINAL_ID: TOWER_ID }
  const ROLE = ['--set-role', 'tower']

  const cases: Array<[string, string[], string, Record<string, string>?]> = [
    ['unknown role', ['--set-role', 'worker'], "Invalid --set-role value: 'worker' (expected one of: tower)"],
    ['missing role value', ['--set-role'], '--set-role requires a role argument'],
    ['missing --terminal-id value', [...ROLE, '--terminal-id'], '--terminal-id requires a terminal ID argument'],
    ['--terminal-id without --set-role', ['--terminal-id', 'x', 'echo', 'hi'], '--terminal-id is only valid with --set-role'],
    ['no terminal id at all', ROLE, '--set-role needs --terminal-id <id> or BAT_TERMINAL_ID', { BAT_TERMINAL_ID: '' }],
    ['with --prompt', [...ROLE, '--prompt', 'hi'], '--set-role cannot be combined with --prompt'],
    ['with --skill / --workorder', [...ROLE, '--skill', 'ct-exec', '--workorder', 'T0562'], 'cannot be combined with --skill, --workorder'],
    // T0565: --mode is no longer a conflict here (it is the Tower's own mode)
    ['with --cwd / --workspace (and a valid --mode)', [...ROLE, '--cwd', '/tmp', '--workspace', 'w', '--mode', 'yolo'], 'cannot be combined with --cwd, --workspace\n'],
    ['an unknown --mode (T0565)', [...ROLE, '--mode', 'auto'], "Invalid --mode value: 'auto' (expected one of: yolo, ask, off, on)"],
    ['an unknown --mode before --set-role (T0565)', ['--mode', 'auto', ...ROLE], "Invalid --mode value: 'auto' (expected one of: yolo, ask, off, on)"],
    ['an empty --mode (T0565)', [...ROLE, '--mode', '  '], "Invalid --mode value: '  '"],
    ['missing --mode value (T0565)', [...ROLE, '--mode'], '--mode requires a value argument (yolo|ask|off|on)'],
    ['with --interactive', [...ROLE, '--interactive'], 'cannot be combined with --interactive'],
    ['with --no-interactive', [...ROLE, '--no-interactive'], 'cannot be combined with --no-interactive'],
    ['with --notify-id', [...ROLE, '--notify-id', 'tower-1'], 'cannot be combined with --notify-id'],
    ['with --close-worker', [...ROLE, '--close-worker', 'T0535', '--notify-id', 'tower-1'], 'cannot be combined with --close-worker, --notify-id'],
    ['with --delay-ms', [...ROLE, '--delay-ms', '5'], 'cannot be combined with --delay-ms'],
    ['with a command', [...ROLE, 'echo', 'hi'], 'cannot be combined with <command>'],
  ]
  for (const [name, args, message, extraEnv] of cases) {
    it(`${name} → exit 1, set-role: USAGE, nothing sent`, async () => {
      const r = await run(args, { ...env, ...(extraEnv ?? {}) })
      expect(r.code).toBe(1)
      expect(r.stderr).toContain(message)
      expect(r.stderr).toContain('set-role: USAGE')
      expect(r.stderr).not.toContain('Cannot connect')
      expect(r.stdout).not.toContain('Terminal created')
    }, 20000)
  }

  it('--help documents --set-role, --terminal-id and the exit codes', async () => {
    const r = await run(['--help'], env)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('bat-terminal.mjs --set-role tower [--mode yolo|ask|off|on] [--terminal-id <id>] [--agent <id>]')
    expect(r.stdout).toContain("--mode <value>         With --set-role (T0565): the Tower's CT mode (yolo|ask|off|on, any case);")
    expect(r.stdout).toContain('--set-role tower       Title the tab "<agent> · Tower"')
    expect(r.stdout).toContain('--terminal-id <id>     The tab to set (default: $BAT_TERMINAL_ID, i.e. this tab)')
    expect(r.stdout).toContain('Exit codes: 0 done (title applied, or kept because the user named the tab) / 3 NOT_FOUND /')
    expect(r.stdout).toContain('"set-role: <CODE>"')
    // --close-worker help unchanged
    expect(r.stdout).toContain('bat-terminal.mjs --close-worker <T####> --notify-id <id> [--delay-ms <n>]')
  })
})

describe('bat-terminal --set-role --mode (T0565)', () => {
  for (const [given, sent] of [['yolo', 'yolo'], ['ask', 'ask'], ['off', 'off'], ['on', 'on'], [' YOLO ', 'yolo'], ['Ask', 'ask']] as const) {
    it(`--mode '${given}' → exit 0, sent as mode ${sent}, "  mode: ${sent}" printed, logged`, async () => {
      const remote = await startMockRemote({ result: { ok: true, terminalId: TOWER_ID, role: 'tower', mode: sent } })
      try {
        const r = await run(['--set-role', 'tower', '--mode', given], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
        expect(r.code, r.stderr).toBe(0)
        expect(r.stdout.trim().split(/\r?\n/)).toEqual([`✓ Tower role set: ${TOWER_ID}`, `  mode: ${sent}`])
        expect(remote.invokes[0].args).toEqual([{ terminalId: TOWER_ID, role: 'tower', mode: sent }])
        expect(helperEvents(remote.dir, 'set-role').at(-1)).toMatchObject({ mode: sent, result: 'OK', recordedMode: sent })
      } finally {
        await remote.close()
      }
    }, 20000)
  }

  it('--mode before --set-role, with --agent and --terminal-id', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'other-tab', role: 'tower', mode: 'yolo' } })
    try {
      const r = await run(['--mode', 'yolo', '--agent', 'claude', '--set-role', 'tower', '--terminal-id', 'other-tab'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes[0].args).toEqual([{ terminalId: 'other-tab', role: 'tower', agent: 'claude', mode: 'yolo' }])
    } finally {
      await remote.close()
    }
  }, 20000)

  it('no --mode → no mode sent (as T0562); BAT answering with the kept mode still prints it', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: TOWER_ID, role: 'tower', mode: 'ask' } })
    try {
      const r = await run(['--set-role', 'tower'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes[0].args).toEqual([{ terminalId: TOWER_ID, role: 'tower' }])
      expect(r.stdout).toContain('  mode: ask')
      expect(helperEvents(remote.dir, 'set-role').at(-1)).toMatchObject({ mode: null, result: 'OK' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('a BAT answering without mode → only the ✓ line', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: TOWER_ID, role: 'tower' } })
    try {
      const r = await run(['--set-role', 'tower', '--mode', 'yolo'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout.trim()).toBe(`✓ Tower role set: ${TOWER_ID}`)
    } finally {
      await remote.close()
    }
  }, 20000)

  it('NOT_FOUND with --mode → exit 3 (unchanged)', async () => {
    const remote = await startMockRemote({ result: { ok: false, code: 'NOT_FOUND' } })
    try {
      const r = await run(['--set-role', 'tower', '--mode', 'yolo'], { ...remote.env, BAT_TERMINAL_ID: TOWER_ID })
      expect(r.code).toBe(3)
      expect(r.stderr).toContain('set-role: NOT_FOUND')
    } finally {
      await remote.close()
    }
  }, 20000)

  describe('--mode of a new tab keeps its exact grammar (no set-role)', () => {
    const dir = join(tmpdir(), `bat-set-role-mode-${process.pid}-${Date.now()}`)
    tempDirs.push(dir)
    const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'x', BAT_HELPER_LOG_DIR: join(dir, 'Logs'), BAT_USER_DATA: dir, BAT_TERMINAL_ID: TOWER_ID }
    for (const value of ['YOLO', ' yolo', 'auto']) {
      it(`--mode '${value}' → exit 1, no set-role diagnostic`, async () => {
        const r = await run(['--mode', value, '--prompt', 'hi'], env)
        expect(r.code).toBe(1)
        expect(r.stderr).toContain(`Invalid --mode value: '${value}' (expected one of: yolo, ask, off, on)`)
        expect(r.stderr).not.toContain('set-role:')
      }, 20000)
    }

    it('--set-role as another option value does not loosen it', async () => {
      const r = await run(['--mode', 'YOLO', '--prompt', '--set-role'], env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain("Invalid --mode value: 'YOLO'")
    }, 20000)

    it('--close-worker still refuses --mode', async () => {
      const r = await run(['--close-worker', 'T0535', '--notify-id', 't', '--mode', 'yolo'], env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('--close-worker cannot be combined with options that create a terminal (--mode)')
    }, 20000)
  })
})
