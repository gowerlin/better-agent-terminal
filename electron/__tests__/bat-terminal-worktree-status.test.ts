// @vitest-environment node
/**
 * PLAN-047 W1-2 / T0585: `bat-terminal.mjs --worktree-status [T####] [--notify-id <id>]`.
 *
 * Against a mock RemoteServer (TLS + minimal WebSocket, copied from bat-terminal-worktree.test.ts)
 * that keeps broadcasting, so replies are matched by frame id (BUG-114):
 *   - request: `{ workorder }` with T####, `{}` without; channel `worktree:terminal-status`
 *   - stdout: one line of JSON (the answer without `ok`), exit 0 (isolated or not)
 *   - exit 3 NOT_FOUND / 4 NOT_OWNER / 5 AMBIGUOUS / 1 TIMEOUT, GIT_FAILED, UNSUPPORTED; stderr
 *     `worktree-status: <CODE>`; a `worktree-status` event in bat-scripts.log
 *   - usage errors (no server contacted): mutually exclusive options, --notify-id rules, bad id
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
  env: Record<string, string>
  dir: string
  invokes: Invoke[]
  close(): Promise<void>
}

/** `reply`: the invoke-result fields of every invoke. */
async function startMockRemote(reply: Record<string, unknown>): Promise<MockRemote> {
  const pems = await selfsigned.generate([{ name: 'commonName', value: '127.0.0.1' }], {
    keySize: 2048, algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }],
  })
  const dir = join(tmpdir(), `bat-t0585-helper-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
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
          ticker = setInterval(() => {
            if (socket.destroyed) return stop()
            socket.write(wsFrame({ type: 'event', id: '0', channel: 'pty:output', args: ['other', `out ${n++}\r\n`] }))
          }, 2)
        } else if (msg.type === 'invoke') {
          invokes.push({ id: msg.id, channel: msg.channel ?? '', args: msg.args ?? [] })
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

const STATUS = {
  terminalId: 'wk-1', isolated: true, workorder: 'T0585', path: '/w/.bat-worktrees/repo/T0585', branch: 'ct/T0585',
  base: 'a'.repeat(40), mainCheckout: '/w/repo', head: 'b'.repeat(40), mainHead: 'c'.repeat(40), ahead: 1, behind: 2,
  dirty: [], dirtyCount: 0, changedFiles: ['src/a.ts', 'out.ts'], changedCount: 2, outOfScopeFiles: ['out.ts'], outOfScopeCount: 1,
  touchesCtWorkorders: false, conflicts: ['src/a.ts'], computedAt: 1, cached: false,
}

describe('bat-terminal --worktree-status (T0585)', () => {
  it('a Worker by work order: { workorder } sent, one JSON line without ok, exit 0, logged', async () => {
    const remote = await startMockRemote({ result: { ok: true, ...STATUS } })
    try {
      const r = await run(['--worktree-status', 't0585', '--notify-id', 'tower-1'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      const lines = r.stdout.trim().split(/\r?\n/)
      expect(lines).toHaveLength(1)
      expect(JSON.parse(lines[0])).toEqual(STATUS)
      expect(remote.invokes).toHaveLength(1)
      expect(remote.invokes[0]).toMatchObject({ channel: 'worktree:terminal-status', args: [{ workorder: 'T0585' }] })
      expect(r.stderr).not.toContain('--workspace not specified')
      expect(helperEvents(remote.dir, 'worktree-status').at(-1)).toMatchObject({ workorder: 'T0585', notifyId: 'tower-1', result: 'OK', terminalId: 'wk-1', isolated: true, ahead: 1, behind: 2, changedCount: 2, outOfScopeCount: 1, conflicts: 1 })
      expect(helperEvents(remote.dir, 'await-invoke-response').at(-1)).toMatchObject({ timeoutMs: 15000, channel: 'worktree:terminal-status' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('itself (no T####): {} sent; not isolated → {"terminalId":…,"isolated":false}, exit 0', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'me', isolated: false } })
    try {
      const r = await run(['--worktree-status'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout.trim()).toBe('{"terminalId":"me","isolated":false}')
      expect(remote.invokes[0].args).toEqual([{}])
    } finally {
      await remote.close()
    }
  }, 20000)

  const codes: Array<[string, number, Record<string, unknown>]> = [
    ['NOT_FOUND', 3, {}],
    ['NOT_OWNER', 4, {}],
    ['AMBIGUOUS', 5, { terminalIds: ['a', 'b'] }],
    ['TIMEOUT', 1, { message: 'worktree status took longer than 10000 ms' }],
    ['GIT_FAILED', 1, { message: 'branch ct/T0585 not found' }],
    ['INVALID_ARGS', 1, {}],
  ]
  for (const [code, exit, extra] of codes) {
    it(`${code} → exit ${exit}, "worktree-status: ${code}", nothing on stdout`, async () => {
      const remote = await startMockRemote({ result: { ok: false, code, ...extra } })
      try {
        const r = await run(['--worktree-status', 'T0585', '--notify-id', 'tower-1'], remote.env)
        expect(r.code).toBe(exit)
        expect(r.stdout).toBe('')
        expect(r.stderr).toContain(`worktree-status: ${code}`)
        if (code === 'AMBIGUOUS') expect(r.stderr).toContain('(a, b)')
        expect(helperEvents(remote.dir, 'worktree-status').at(-1)).toMatchObject({ result: code })
      } finally {
        await remote.close()
      }
    }, 20000)
  }

  it('a BAT without the channel → exit 1 UNSUPPORTED; a refused capability → FORBIDDEN', async () => {
    const old = await startMockRemote({ error: 'No handler for channel: worktree:terminal-status' })
    try {
      const r = await run(['--worktree-status'], old.env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('This BAT does not support --worktree-status (update BAT)')
      expect(r.stderr).toContain('worktree-status: UNSUPPORTED')
    } finally {
      await old.close()
    }
    const refused = await startMockRemote({ error: 'Forbidden: channel-not-allowed' })
    try {
      const r = await run(['--worktree-status'], refused.env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('worktree-status: FORBIDDEN')
    } finally {
      await refused.close()
    }
  }, 20000)
})

describe('usage errors (T0585)', () => {
  const dir = join(tmpdir(), `bat-t0585-usage-${process.pid}-${Date.now()}`)
  tempDirs.push(dir)
  const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'x', BAT_HELPER_LOG_DIR: join(dir, 'Logs'), BAT_USER_DATA: dir }

  const cases: Array<[string, string[], string]> = [
    ['T#### without --notify-id', ['--worktree-status', 'T0585'], '--worktree-status <T####> requires --notify-id'],
    ['--notify-id without T####', ['--worktree-status', '--notify-id', 't'], '--notify-id is only used with --worktree-status <T####>'],
    ['a bad work order id', ['--worktree-status', 'nope'], "Invalid --worktree-status value: 'nope'"],
    ['with --close-worker', ['--worktree-status', 'T1', '--notify-id', 't', '--close-worker', 'T2'], '--worktree-status cannot be combined with --close-worker'],
    ['with --set-role', ['--set-role', 'tower', '--worktree-status'], '--worktree-status cannot be combined with --set-role'],
    ['with --worktree', ['--worktree-status', '--worktree', 'remove'], '--worktree-status cannot be combined with --worktree'],
    ['with --isolation', ['--worktree-status', '--isolation', 'worktree'], '--worktree-status cannot be combined with --isolation'],
    ['with --delay-ms', ['--worktree-status', '--delay-ms', '5'], '--worktree-status cannot be combined with --delay-ms'],
    ['with --terminal-id', ['--worktree-status', '--terminal-id', 'x'], '--worktree-status cannot be combined with --terminal-id'],
    ['with create options', ['--worktree-status', '--cwd', '/tmp', '--prompt', 'x'], '--worktree-status cannot be combined with --cwd, --prompt'],
    ['with a command', ['--worktree-status', '--', 'echo', 'hi'], '--worktree-status cannot be combined with <command>'],
  ]
  for (const [name, args, message] of cases) {
    it(`${name} → exit 1, "worktree-status: USAGE", nothing sent`, async () => {
      const r = await run(args, env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain(message)
      expect(r.stderr).toContain('worktree-status: USAGE')
      expect(r.stderr).not.toContain('Cannot connect')
    }, 20000)
  }

  it('outside BAT → NOT_IN_BAT', async () => {
    const r = await run(['--worktree-status'], { BAT_HELPER_LOG_DIR: join(dir, 'Logs'), BAT_USER_DATA: dir })
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('worktree-status: NOT_IN_BAT')
  }, 20000)

  it('--help documents --worktree-status and its exit codes', async () => {
    const r = await run(['--help'], env)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('bat-terminal.mjs --worktree-status [<T####> --notify-id <id>]')
    expect(r.stdout).toContain('--worktree-status [<T####>]')
    expect(r.stdout).toContain('Exit codes: 0 printed (isolated or not) / 3 NOT_FOUND / 4 NOT_OWNER / 5 AMBIGUOUS')
    expect(r.stdout).toContain('"worktree-status: <CODE>"')
  })
})
