// @vitest-environment node
/**
 * PLAN-047 W1 / T0583: `bat-terminal.mjs … --isolation worktree` and `--close-worker … --worktree`.
 *
 * Against a mock RemoteServer (TLS + minimal WebSocket, same shape as bat-terminal-close-worker.test.ts)
 * that keeps broadcasting, so replies are matched by frame id (BUG-114):
 *   - isolation: payload carries `isolation`; success prints `worktree:` / `branch:` / `base:` (+ `(reused)`);
 *     WORKTREE_FAILED → exit 7 + `create: WORKTREE_FAILED`; logged with isolation / worktree / branch / base / reused
 *   - close-worker: `worktree` sent; isolated / ignored / old-BAT lines; exit codes unchanged
 *   - usage errors (no server contacted): bad values, isolation without skill mode, --worktree without --close-worker
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
  const dir = join(tmpdir(), `bat-t0583-helper-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
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

const DISPATCH = ['--notify-id', 'tower-1', '--workspace', 'ws-1', '--skill', 'ct-exec', '--workorder', 'T0583', '--isolation', 'worktree']
const WT = { path: '/w/.bat-worktrees/repo/T0583', branch: 'ct/T0583', base: 'a'.repeat(40), mainCheckout: '/w/repo', reused: false }

describe('bat-terminal --isolation worktree (T0583)', () => {
  it('sends isolation; prints worktree / branch / base after the landing lines; logged', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'x', workspace: { id: 'ws-1', source: 'requested', mismatch: false }, agent: { requested: 'default', id: 'claude-cli', source: 'builtin' }, worktree: WT } })
    try {
      const r = await run(DISPATCH, remote.env)
      expect(r.code, r.stderr).toBe(0)
      const lines = r.stdout.trim().split(/\r?\n/)
      expect(lines[0]).toMatch(/^✓ Terminal created: /)
      expect(lines.slice(1, 3).map(l => l.split(':')[0])).toEqual(['  workspace', '  agent'])
      expect(lines.slice(3)).toEqual([`  worktree: ${WT.path}`, '  branch: ct/T0583', `  base: ${WT.base}`])
      expect(remote.invokes[0].channel).toBe('terminal:create-agent-command')
      expect(remote.invokes[0].args[0]).toMatchObject({ skill: 'ct-exec', workorder: 'T0583', isolation: 'worktree' })
      expect(helperEvents(remote.dir, 'terminal-created').at(-1)).toMatchObject({ result: 'ok', isolation: 'worktree', worktree: WT.path, branch: 'ct/T0583', base: WT.base, reused: false })
      expect(helperEvents(remote.dir, 'await-invoke-response').at(-1)).toMatchObject({ timeoutMs: 40000 })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('reused → `(reused)`', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'x', worktree: { ...WT, reused: true } } })
    try {
      const r = await run(['--isolation', ' WORKTREE ', '--skill', 'ct-exec', '--workorder', 'T0583'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout).toContain(`  worktree: ${WT.path} (reused)`)
    } finally {
      await remote.close()
    }
  }, 20000)

  it('WORKTREE_FAILED → exit 7, "create: WORKTREE_FAILED" and the reason on stderr', async () => {
    const remote = await startMockRemote({ result: { ok: false, code: 'WORKTREE_FAILED', error: 'cwd /x is not a git repository (fatal: not a git repository)' } })
    try {
      const r = await run(DISPATCH, remote.env)
      expect(r.code).toBe(7)
      expect(r.stderr).toContain('Error: Failed to create terminal (WORKTREE_FAILED): cwd /x is not a git repository')
      expect(r.stderr).toContain('create: WORKTREE_FAILED')
      expect(r.stderr).not.toContain('test-token')
      expect(r.stdout).not.toContain('✓')
      expect(helperEvents(remote.dir, 'exit').at(-1)).toMatchObject({ code: 7, reason: 'worktree-failed' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('a BAT that ignores isolation (no worktree in the answer) → exit 0 with a warning', async () => {
    const remote = await startMockRemote({ result: true })
    try {
      const r = await run(DISPATCH, remote.env)
      expect(r.code).toBe(0)
      expect(r.stderr).toContain('did not report a worktree')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('without --isolation nothing changes (no isolation field, no worktree lines)', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'x' } })
    try {
      const r = await run(['--skill', 'ct-exec', '--workorder', 'T0583'], remote.env)
      expect(r.code).toBe(0)
      expect(remote.invokes[0].args[0]).not.toHaveProperty('isolation')
      expect(r.stdout).not.toContain('worktree:')
      expect(helperEvents(remote.dir, 'await-invoke-response').at(-1)).toMatchObject({ timeoutMs: 3000 })
    } finally {
      await remote.close()
    }
  }, 20000)
})

describe('bat-terminal --close-worker --worktree (T0583)', () => {
  const CLOSE = ['--close-worker', 'T0583', '--notify-id', 'tower-1']

  it('isolated Worker: worktree sent, the plan printed, exit 0', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'w', closeAt: 1, delayMs: 0, worktree: { mode: 'remove', isolated: true, path: WT.path, branch: 'ct/T0583' } } })
    try {
      const r = await run([...CLOSE, '--worktree', 'Remove'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes[0].args).toEqual([{ towerId: 'tower-1', workorder: 'T0583', worktree: 'remove' }])
      expect(r.stdout).toContain(`  worktree: remove ${WT.path} once the tab is closed (branch ct/T0583 kept; result in the BAT log)`)
      expect(helperEvents(remote.dir, 'close-worker').at(-1)).toMatchObject({ worktree: 'remove', result: 'OK', worktreeIsolated: true })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('archive names the archive branch', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'w', closeAt: 1, delayMs: 0, worktree: { mode: 'archive', isolated: true, path: WT.path, branch: 'ct/T0583' } } })
    try {
      const r = await run([...CLOSE, '--worktree', 'archive'], remote.env)
      expect(r.code).toBe(0)
      expect(r.stdout).toContain('→ ct-archive/T0583')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('not isolated → "ignored", still exit 0; old BAT → warning', async () => {
    const remote = await startMockRemote({ result: { ok: true, terminalId: 'w', closeAt: 1, delayMs: 0, worktree: { mode: 'remove', isolated: false } } })
    try {
      const r = await run([...CLOSE, '--worktree', 'remove'], remote.env)
      expect(r.code).toBe(0)
      expect(r.stdout).toContain('  worktree: ignored (T0583 was not dispatched with --isolation worktree)')
    } finally {
      await remote.close()
    }
    const old = await startMockRemote({ result: { ok: true, terminalId: 'w', closeAt: 1, delayMs: 0 } })
    try {
      const r = await run([...CLOSE, '--worktree', 'remove'], old.env)
      expect(r.code).toBe(0)
      expect(r.stderr).toContain('did not report worktree handling')
    } finally {
      await old.close()
    }
  }, 30000)

  it('exit codes unchanged (NOT_FOUND 3)', async () => {
    const remote = await startMockRemote({ result: { ok: false, code: 'NOT_FOUND' } })
    try {
      const r = await run([...CLOSE, '--worktree', 'remove'], remote.env)
      expect(r.code).toBe(3)
    } finally {
      await remote.close()
    }
  }, 20000)
})

describe('usage errors (T0583)', () => {
  const dir = join(tmpdir(), `bat-t0583-usage-${process.pid}-${Date.now()}`)
  tempDirs.push(dir)
  const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'x', BAT_HELPER_LOG_DIR: join(dir, 'Logs'), BAT_USER_DATA: dir }
  const CLOSE = ['--close-worker', 'T0583', '--notify-id', 't']

  const cases: Array<[string, string[], string, string | null]> = [
    ['bad --isolation', ['--isolation', 'copy', '--skill', 'ct-exec', '--workorder', 'T1'], "Invalid --isolation value: 'copy'", null],
    ['--isolation without a value', ['--isolation'], '--isolation requires a value', null],
    ['--isolation with a raw command', ['--isolation', 'worktree', 'echo', 'hi'], '--isolation worktree needs --skill and --workorder', null],
    ['--isolation with --prompt', ['--isolation', 'worktree', '--prompt', '/ct-exec T1'], '--isolation worktree needs --skill and --workorder', null],
    ['--worktree without --close-worker', ['--worktree', 'remove', '--skill', 'ct-exec', '--workorder', 'T1'], '--worktree is only valid with --close-worker', 'close-worker: USAGE'],
    ['bad --worktree', [...CLOSE, '--worktree', 'delete'], "Invalid --worktree value: 'delete'", 'close-worker: USAGE'],
    ['--close-worker with --isolation', [...CLOSE, '--isolation', 'worktree'], 'cannot be combined with options that create a terminal (--isolation)', 'close-worker: USAGE'],
    ['--set-role with --worktree', ['--set-role', 'tower', '--terminal-id', 'x', '--worktree', 'remove'], '--set-role cannot be combined with --worktree', 'set-role: USAGE'],
  ]
  for (const [name, args, message, tag] of cases) {
    it(`${name} → exit 1, nothing sent`, async () => {
      const r = await run(args, env)
      expect(r.code).toBe(1)
      expect(r.stderr).toContain(message)
      if (tag) expect(r.stderr).toContain(tag)
      expect(r.stderr).not.toContain('Cannot connect')
    }, 20000)
  }

  it('--help documents --isolation, --worktree and exit 7', async () => {
    const r = await run(['--help'], env)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('--isolation worktree')
    expect(r.stdout).toContain('[--worktree keep|remove|archive]')
    expect(r.stdout).toContain('--worktree <mode>')
    expect(r.stdout).toContain('Exit 7 (stderr "create: WORKTREE_FAILED")')
  })
})
