// @vitest-environment node
/**
 * PLAN-041 / T0535: `bat-terminal.mjs --close-worker <T####> --notify-id <tower> [--delay-ms n]`.
 *
 * Against a mock RemoteServer (TLS + minimal WebSocket, same shape as
 * tests/bat-terminal-response-correlation.test.mjs) that keeps broadcasting, so the reply is
 * matched by frame id (BUG-114):
 *   - ok → exit 0 + `✓ Worker close scheduled: <id> (in <n> ms)`
 *   - NOT_FOUND 3 / NOT_OWNER 4 / AMBIGUOUS 5 / BUSY 6 / INVALID_ARGS 1, `close-worker: <CODE>` on stderr
 *   - a BAT without the handler → exit 1 UNSUPPORTED; no reply → exit 1 TIMEOUT
 *   - usage errors (no server contacted) and --help
 * The helper's NDJSON log goes to a temp dir (BAT_HELPER_LOG_DIR / BAT_USER_DATA), never the real one.
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

/** `reply`: the invoke-result fields for terminal:close-worker; null = never answer. */
async function startMockRemote(reply: Record<string, unknown> | null): Promise<MockRemote> {
  const pems = await selfsigned.generate([{ name: 'commonName', value: '127.0.0.1' }], {
    keySize: 2048, algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }],
  })
  const dir = join(tmpdir(), `bat-close-worker-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
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

const CLOSE = ['--close-worker', 'T0535', '--notify-id', 'tower-1']

describe('bat-terminal --close-worker (T0535)', () => {
  it('ok → exit 0, request carries tower / work order / delay, logged as close-worker', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'w'.repeat(32), closeAt: 123, delayMs: 10000 } })
    try {
      const r = await run([...CLOSE, '--delay-ms', '10000'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout.trim()).toBe(`✓ Worker close scheduled: ${'w'.repeat(32)} (in 10000 ms)`)
      expect(r.stderr).not.toContain('--workspace not specified')
      expect(remote.invokes).toEqual([{ id: expect.any(String), channel: 'terminal:close-worker', args: [{ towerId: 'tower-1', workorder: 'T0535', delayMs: 10000 }] }])
      expect(helperEvents(remote.dir, 'close-worker').at(-1)).toMatchObject({ towerId: 'tower-1', workorder: 'T0535', delayMs: 10000, result: 'OK', terminalId: 'w'.repeat(32) })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('no --delay-ms → no delayMs sent (BAT default 0); work order upper-cased', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'abc', closeAt: 1, delayMs: 0 } })
    try {
      const r = await run(['--notify-id', 'tower-1', '--close-worker', ' cp-t0113 '], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout.trim()).toBe('✓ Worker close scheduled: abc (in 0 ms)')
      expect(remote.invokes[0].args).toEqual([{ towerId: 'tower-1', workorder: 'CP-T0113' }])
    } finally {
      await remote.close()
    }
  }, 20000)

  for (const [code, exit] of [['NOT_FOUND', 3], ['NOT_OWNER', 4], ['AMBIGUOUS', 5], ['BUSY', 6], ['INVALID_ARGS', 1]] as const) {
    it(`${code} → exit ${exit}, "close-worker: ${code}" on stderr`, async () => {
      const remote = await startMockRemote({ result: { ok: false, code, ...(code === 'AMBIGUOUS' ? { terminalIds: ['a', 'b'] } : {}) } })
      try {
        const r = await run(CLOSE, remote.env)
        expect(r.code, r.stderr).toBe(exit)
        expect(r.stderr).toContain(`close-worker: ${code}`)
        expect(r.stderr).toContain(`Error: Worker not closed (${code})`)
        expect(r.stdout).not.toContain('✓')
        if (code === 'AMBIGUOUS') expect(r.stderr).toContain('(a, b)')
        expect(helperEvents(remote.dir, 'close-worker').at(-1)).toMatchObject({ result: code })
        expect(helperEvents(remote.dir, 'exit').at(-1)).toMatchObject({ code: exit, reason: `close-worker-${code}` })
      } finally {
        await remote.close()
      }
    }, 20000)
  }

  it('a BAT without the handler → exit 1 UNSUPPORTED', async () => {
    const remote = await startMockRemote({ error: 'No handler for channel: terminal:close-worker' })
    try {
      const r = await run(CLOSE, remote.env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('This BAT does not support --close-worker')
      expect(r.stderr).toContain('close-worker: UNSUPPORTED')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('no reply (broadcasts only) → exit 1 TIMEOUT', async () => {
    const remote = await startMockRemote(null)
    try {
      const r = await run(CLOSE, remote.env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('close-worker: TIMEOUT')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('cannot connect → exit 1 CONNECT_FAILED', async () => {
    const remote = await startMockRemote(null)
    await remote.close()
    const r = await run(CLOSE, remote.env)
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('close-worker: CONNECT_FAILED')
  }, 20000)
})

describe('bat-terminal --close-worker usage (T0535)', () => {
  const dir = join(tmpdir(), `bat-close-worker-usage-${process.pid}-${Date.now()}`)
  tempDirs.push(dir)
  // A port nothing listens on: a usage error must exit before connecting.
  const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'x', BAT_HELPER_LOG_DIR: join(dir, 'Logs'), BAT_USER_DATA: dir }

  const cases: Array<[string, string[], string]> = [
    ['missing --notify-id', ['--close-worker', 'T0535'], '--close-worker requires --notify-id'],
    ['with --prompt', [...CLOSE, '--prompt', 'hi'], 'cannot be combined with options that create a terminal (--prompt)'],
    ['with --skill / --workorder', [...CLOSE, '--skill', 'ct-exec', '--workorder', 'T0535'], '(--skill, --workorder)'],
    ['with --cwd / --workspace / --agent / --mode', [...CLOSE, '--cwd', '/tmp', '--workspace', 'w', '--agent', 'codex', '--mode', 'yolo'], '(--cwd, --workspace, --agent, --mode)'],
    ['with --interactive', [...CLOSE, '--no-interactive'], '(--no-interactive)'],
    ['with a command', [...CLOSE, 'echo', 'hi'], '(<command>)'],
    ['--delay-ms without --close-worker', ['--delay-ms', '5', 'echo', 'hi'], '--delay-ms is only valid with --close-worker'],
    ['negative --delay-ms', [...CLOSE, '--delay-ms', '-1'], "Invalid --delay-ms value: '-1'"],
    ['non-numeric --delay-ms', [...CLOSE, '--delay-ms', '10s'], "Invalid --delay-ms value: '10s'"],
    ['bad work order', ['--close-worker', 'X1', '--notify-id', 't'], "Invalid --close-worker value: 'X1'"],
  ]
  for (const [name, args, message] of cases) {
    it(`${name} → exit 1, close-worker: USAGE, nothing sent`, async () => {
      const r = await run(args, env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain(message)
      expect(r.stderr).toContain('close-worker: USAGE')
      expect(r.stderr).not.toContain('Cannot connect')
    }, 20000)
  }

  it('--help documents --close-worker, --delay-ms and the exit codes', async () => {
    const r = await run(['--help'], env)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('bat-terminal.mjs --close-worker <T####> --notify-id <id> [--delay-ms <n>]')
    expect(r.stdout).toContain('--close-worker <T####>')
    expect(r.stdout).toContain('--delay-ms <n>')
    expect(r.stdout).toContain('0 scheduled (closed when --delay-ms 0) / 3 NOT_FOUND / 4 NOT_OWNER /')
    expect(r.stdout).toContain('5 AMBIGUOUS / 6 BUSY / 1 usage error')
  })
})
