// @vitest-environment node
/**
 * T0600 (D154): `bat-terminal.mjs … --wait-started <ms>` — after the terminal is created, wait for
 * its agent to start (`terminal:wait { terminalId, until: 'agent-started' }`).
 *
 * Against a mock RemoteServer (TLS + minimal WebSocket, as bat-terminal-worktree-status.test.ts)
 * that keeps broadcasting, so replies are matched by frame id (BUG-114):
 *   - without the option: one invoke (the create), no "started:" line, exit 0 (unchanged)
 *   - started → "  started: <ISO>", exit 0; cannot tell (agentStarted null, a BAT that refuses the
 *     `until` / has no terminal:wait / no `agentStarted`, NOT_OWNER, no answer) → "  started:
 *     unknown", exit 0, stderr `wait-started: <CODE>`; not started in time / the PTY ended first →
 *     "  started: unconfirmed", exit 8, stderr `create: LAUNCH_UNCONFIRMED`, nothing closes the tab
 *   - waits in chunks of at most 45 s, never past <ms>; > 120000 is cut
 *   - usage errors (no server contacted): no --notify-id, a bad value, with --close-worker
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

/** `reply(invoke)`: the invoke-result fields (a `terminal:wait` reply comes after 20 ms, like the others). */
type Reply = (invoke: Invoke) => Record<string, unknown>

const CREATED: Record<string, unknown> = { result: true }

async function startMockRemote(reply: Reply): Promise<MockRemote> {
  const pems = await selfsigned.generate([{ name: 'commonName', value: '127.0.0.1' }], {
    keySize: 2048, algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }],
  })
  const dir = join(tmpdir(), `bat-t0600-helper-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
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
          const invoke = { id: msg.id, channel: msg.channel ?? '', args: msg.args ?? [] }
          invokes.push(invoke)
          const fields = reply(invoke)
          setTimeout(() => { if (!socket.destroyed) socket.write(wsFrame({ type: 'invoke-result', id: msg.id, ...fields })) }, 20)
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

interface Run { code: number | null; stdout: string; stderr: string; ms: number }

function run(args: string[], env: Record<string, string>): Promise<Run> {
  return new Promise((res) => {
    const started = Date.now()
    const childEnv: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) childEnv[k] = v
    const child = spawn(process.execPath, [helper, ...args], { cwd: repoRoot, env: { ...childEnv, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
    child.on('close', (code) => res({ code, stdout, stderr, ms: Date.now() - started }))
  })
}

function helperEvents(dir: string, event: string): Array<Record<string, unknown>> {
  const file = join(dir, 'Logs', 'bat-scripts.log')
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>)
    .filter(e => e.script === 'bat-terminal' && e.event === event)
}

const DISPATCH = ['--notify-id', 'tower-1', '--workspace', 'ws-1', '--skill', 'ct-exec', '--workorder', 'T0600']
const createdId = (r: Run) => /✓ Terminal created: ([0-9a-f]{32})/.exec(r.stdout)?.[1]

/** create → `created`; terminal:wait → `wait(n)` (n = 0, 1, …). */
function replies(wait: (n: number, invoke: Invoke) => Record<string, unknown>, created: Record<string, unknown> = CREATED): Reply {
  let n = 0
  return invoke => invoke.channel === 'terminal:wait' ? wait(n++, invoke) : created
}

const waitResult = (fields: Record<string, unknown>) => ({ result: { ok: true, terminalId: 'x', changed: true, state: 'idle', blockedDetection: 'hook', waitedMs: 1, ...fields } })

describe('bat-terminal --wait-started (T0600)', () => {
  it('without it nothing changes: one invoke (the create), no "started:" line, exit 0', async () => {
    const remote = await startMockRemote(replies(() => ({ result: { ok: false, code: 'INVALID_ARGS' } })))
    try {
      const r = await run(DISPATCH, remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes.map(i => i.channel)).toEqual(['terminal:create-agent-command'])
      expect(r.stdout).not.toMatch(/started:/)
      expect(helperEvents(remote.dir, 'wait-started')).toEqual([])
    } finally {
      await remote.close()
    }
  }, 20000)

  it('started → "  started: <ISO>", exit 0; terminal:wait asks about the created terminal', async () => {
    const at = Date.UTC(2026, 9, 18, 3, 30, 0, 250)
    const remote = await startMockRemote(replies(() => waitResult({ agentStarted: true, agentStartedAt: at })))
    try {
      const r = await run([...DISPATCH, '--wait-started', '30000'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      const id = createdId(r)
      expect(id).toBeTruthy()
      const lines = r.stdout.trim().split(/\r?\n/)
      expect(lines[0]).toBe(`✓ Terminal created: ${id}`)
      expect(lines.at(-1)).toBe('  started: 2026-10-18T03:30:00.250Z')
      expect(remote.invokes.map(i => i.channel)).toEqual(['terminal:create-agent-command', 'terminal:wait'])
      const wait = remote.invokes[1].args[0] as Record<string, unknown>
      expect(wait).toMatchObject({ terminalId: id, until: 'agent-started' })
      expect(wait.timeoutMs).toBeGreaterThan(29_000)
      expect(wait.timeoutMs).toBeLessThanOrEqual(30_000)
      expect(helperEvents(remote.dir, 'wait-started').at(-1)).toMatchObject({ terminalId: id, waitStartedMs: 30000, result: 'started', agentStartedAt: '2026-10-18T03:30:00.250Z' })
      expect(helperEvents(remote.dir, 'exit').at(-1)).toEqual(expect.objectContaining({ code: 0 }))
    } finally {
      await remote.close()
    }
  }, 20000)

  it('cannot tell (agentStarted null: codex, no hooks…) → "  started: unknown", exit 0, stderr wait-started: NO_SIGNAL', async () => {
    const remote = await startMockRemote(replies(() => waitResult({ agentStarted: null, blockedDetection: 'none' })))
    try {
      const r = await run([...DISPATCH, '--wait-started', '30000'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout.trim().split(/\r?\n/).at(-1)).toBe('  started: unknown')
      expect(r.stderr).toContain('wait-started: NO_SIGNAL')
      expect(r.stderr).not.toContain('LAUNCH_UNCONFIRMED')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('not started in time → "  started: unconfirmed", exit 8, stderr create: LAUNCH_UNCONFIRMED; waits only <ms>; nothing closes the tab', async () => {
    const remote = await startMockRemote(replies(() => waitResult({ changed: false, agentStarted: false })))
    try {
      const r = await run([...DISPATCH, '--wait-started', '600'], remote.env)
      expect(r.code, r.stderr).toBe(8)
      expect(createdId(r)).toBeTruthy()
      expect(r.stdout.trim().split(/\r?\n/).at(-1)).toBe('  started: unconfirmed')
      expect(r.stderr).toContain('create: LAUNCH_UNCONFIRMED')
      expect(r.stderr).toContain('the terminal is kept')
      // the mock answers at once (changed=false), so the helper asks again until the 600 ms are over
      const channels = remote.invokes.map(i => i.channel)
      expect(new Set(channels)).toEqual(new Set(['terminal:create-agent-command', 'terminal:wait']))
      expect(channels.filter(c => c === 'terminal:wait').length).toBeGreaterThan(1)
      for (const w of remote.invokes.slice(1)) expect((w.args[0] as { timeoutMs: number }).timeoutMs).toBeLessThanOrEqual(600)
      expect(helperEvents(remote.dir, 'wait-started').at(-1)).toMatchObject({ result: 'timeout', waitStartedMs: 600 })
      expect(helperEvents(remote.dir, 'exit').at(-1)).toMatchObject({ code: 8, reason: 'launch-unconfirmed' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('the terminal ended before its agent started → unconfirmed, exit 8, at once', async () => {
    const remote = await startMockRemote(replies(() => waitResult({ state: 'exited', exitCode: 1, agentStarted: false })))
    try {
      const r = await run([...DISPATCH, '--wait-started', '60000'], remote.env)
      expect(r.code, r.stderr).toBe(8)
      expect(r.stdout).toContain('  started: unconfirmed')
      expect(r.stderr).toContain('before the terminal ended')
      expect(r.ms).toBeLessThan(15_000)
      expect(helperEvents(remote.dir, 'wait-started').at(-1)).toMatchObject({ result: 'exited', state: 'exited' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('a BAT that cannot answer → unknown, exit 0 (the terminal exists: never 1)', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ result: { ok: false, code: 'INVALID_ARGS', message: 'until' } }, 'UNSUPPORTED'], // before T0600
      [{ error: 'No handler for channel: terminal:wait' }, 'UNSUPPORTED'], // before T0582
      [{ result: { ok: true, terminalId: 'x', changed: true, state: 'idle', blockedDetection: 'hook' } }, 'UNSUPPORTED'], // no agentStarted
      [{ result: { ok: false, code: 'NOT_OWNER' } }, 'NOT_OWNER'],
      [{ error: 'Forbidden: channel-not-allowed' }, 'FORBIDDEN'],
    ]
    for (const [answer, code] of cases) {
      const remote = await startMockRemote(replies(() => answer))
      try {
        const r = await run([...DISPATCH, '--wait-started', '5000'], remote.env)
        expect(r.code, `${code}: ${r.stderr}`).toBe(0)
        expect(r.stdout.trim().split(/\r?\n/).at(-1)).toBe('  started: unknown')
        expect(r.stderr).toContain(`wait-started: ${code}`)
        expect(helperEvents(remote.dir, 'wait-started').at(-1)).toMatchObject({ result: code })
      } finally {
        await remote.close()
      }
    }
  }, 60000)

  it('more than 120000 is cut (one 45 s chunk at a time); raw command mode is allowed', async () => {
    const remote = await startMockRemote(replies(() => waitResult({ agentStarted: null, blockedDetection: 'none' })))
    try {
      const r = await run(['--notify-id', 'tower-1', '--wait-started', '999999', 'echo', 'hi'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stderr).toContain('--wait-started 999999: waiting at most 120000 ms.')
      expect(remote.invokes[0].channel).toBe('terminal:create-with-command')
      expect((remote.invokes[1].args[0] as { timeoutMs: number }).timeoutMs).toBe(45_000)
      expect(r.stdout).toContain('  started: unknown')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('a terminal that was not created: no wait, the create failure exit as before', async () => {
    const remote = await startMockRemote(replies(() => waitResult({ agentStarted: true }), { result: false }))
    try {
      const r = await run([...DISPATCH, '--wait-started', '5000'], remote.env)
      expect(r.code).toBe(1)
      expect(remote.invokes.map(i => i.channel)).toEqual(['terminal:create-agent-command'])
      expect(r.stdout).not.toContain('started:')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('usage errors, before any connection: no --notify-id, a bad value, a mode that creates no terminal', async () => {
    const remote = await startMockRemote(replies(() => waitResult({ agentStarted: true })))
    try {
      const cases: Array<[string[], RegExp]> = [
        [['--skill', 'ct-exec', '--workorder', 'T0600', '--wait-started', '1000'], /--wait-started requires --notify-id/],
        [[...DISPATCH, '--wait-started', '-5'], /--wait-started requires a number|Invalid --wait-started value/],
        [[...DISPATCH, '--wait-started', '1.5s'], /Invalid --wait-started value: '1\.5s'/],
        [[...DISPATCH, '--wait-started'], /--wait-started requires a number of milliseconds/],
        [['--close-worker', 'T0600', '--notify-id', 'tower-1', '--wait-started', '1000'], /--close-worker cannot be combined with options that create a terminal \(--wait-started\)/],
        [['--worktree-status', '--wait-started', '1000'], /--worktree-status cannot be combined with --wait-started/],
      ]
      for (const [args, message] of cases) {
        const r = await run(args, remote.env)
        expect(r.code, args.join(' ')).toBe(1)
        expect(r.stderr, args.join(' ')).toMatch(message)
      }
      expect(remote.invokes).toEqual([])
    } finally {
      await remote.close()
    }
  }, 60000)

  it('--help documents it (exit 8, the three lines, the old-helper rule)', async () => {
    const r = await run(['--help'], {})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('--wait-started <ms>')
    expect(r.stdout).toContain('started: unconfirmed')
    expect(r.stdout).toContain('exit 8')
    expect(r.stdout).toContain("Unknown option '--wait-started'")
  }, 20000)
})
