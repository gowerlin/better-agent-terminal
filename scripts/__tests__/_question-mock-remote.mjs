// PLAN-048 / T0608: a mock RemoteServer for the question helpers' tests (bat-notify-questions /
// bat-terminal-answer). TLS + minimal WebSocket, as electron/__tests__/bat-terminal-wait-started.test.ts:
// it keeps broadcasting `pty:output` events (and can send a reply with a wrong id first), so the
// helpers must match replies by frame id (BUG-114). The helpers' NDJSON log goes to a temp dir
// (BAT_HELPER_LOG_DIR / BAT_USER_DATA), never the real one. Not a test file (no `.test.`).
import { createHash, X509Certificate } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tls from 'node:tls'
import selfsigned from 'selfsigned'

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const tempDirs = []

export function cleanupTempDirs() {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
}

function wsFrame(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body])
  if (body.length < 65536) {
    const header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(body.length, 2)
    return Buffer.concat([header, body])
  }
  const header = Buffer.alloc(10)
  header[0] = 0x81
  header[1] = 127
  header.writeBigUInt64BE(BigInt(body.length), 2)
  return Buffer.concat([header, body])
}

function parseClientFrame(buffer) {
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

/**
 * `replies[channel]`: the reply fields (`{ result }` or `{ error }`), or `(invoke, n) => fields`
 * (n = how many invokes of that channel came before). A channel without an entry answers
 * `{ result: { ok: true } }`. `decoy: true` sends a reply with another id before each real one.
 */
export async function startMockRemote(replies = {}, { decoy = false } = {}) {
  const pems = await selfsigned.generate([{ name: 'commonName', value: '127.0.0.1' }], {
    keySize: 2048, algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }],
  })
  const dir = join(tmpdir(), `bat-t0608-helper-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  tempDirs.push(dir)
  const certPath = join(dir, 'server-cert.json')
  writeFileSync(certPath, JSON.stringify({ fingerprint: new X509Certificate(pems.cert).fingerprint256 }), 'utf8')
  const invokes = []
  const counts = new Map()

  const server = tls.createServer({ key: pems.private, cert: pems.cert }, (socket) => {
    let buffer = Buffer.alloc(0)
    let upgraded = false
    let n = 0
    let ticker = null
    const stop = () => { if (ticker) clearInterval(ticker) }
    socket.on('data', (chunk) => {
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
        const msg = JSON.parse(frame.message)
        if (msg.type === 'auth') {
          socket.write(wsFrame({ type: 'auth-result', id: msg.id, result: { platform: 'test' } }))
          ticker = setInterval(() => {
            if (socket.destroyed) return stop()
            socket.write(wsFrame({ type: 'event', id: '0', channel: 'pty:output', args: ['other', `out ${n++}\r\n`] }))
          }, 2)
        } else if (msg.type === 'invoke') {
          const invoke = { id: msg.id, channel: msg.channel ?? '', args: msg.args ?? [] }
          invokes.push(invoke)
          const seen = counts.get(invoke.channel) ?? 0
          counts.set(invoke.channel, seen + 1)
          const entry = replies[invoke.channel]
          const fields = typeof entry === 'function' ? entry(invoke, seen) : entry ?? { result: { ok: true } }
          const type = fields.error !== undefined ? 'invoke-error' : 'invoke-result'
          setTimeout(() => {
            if (socket.destroyed) return
            if (decoy) socket.write(wsFrame({ type, id: `${msg.id}-not-yours`, result: { ok: false, code: 'NOT_OWNER' } }))
            socket.write(wsFrame({ type, id: msg.id, ...fields }))
          }, 20)
        }
      }
    })
    socket.on('error', stop)
    socket.on('close', stop)
  })
  await new Promise((res, rej) => { server.once('error', rej); server.listen(0, '127.0.0.1', () => res()) })
  const port = server.address().port
  return {
    dir,
    invokes,
    env: {
      BAT_REMOTE_PORT: String(port),
      BAT_REMOTE_TOKEN: 'test-token',
      BAT_TOWER_TERMINAL_ID: 'tower-1',
      BAT_TERMINAL_ID: 'worker-1',
      BAT_SERVER_CERT_PATH: certPath,
      BAT_HELPER_LOG_DIR: join(dir, 'Logs'),
      BAT_USER_DATA: dir,
    },
    close: () => new Promise((res) => server.close(() => res())),
  }
}

/**
 * Runs `scripts/<script>` with `args`; `stdin` = a string / Buffer written then closed, or
 * undefined for no stdin at all ('ignore'). BAT_* / CT_* of this process are not inherited.
 */
export function runHelper(script, args, env, stdin) {
  return new Promise((res) => {
    const started = Date.now()
    const childEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) childEnv[k] = v
    const child = spawn(process.execPath, [join(repoRoot, 'scripts', script), ...args], {
      cwd: repoRoot,
      env: { ...childEnv, ...env },
      stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => { stdout += c.toString('utf8') })
    child.stderr.on('data', (c) => { stderr += c.toString('utf8') })
    child.on('close', (code) => res({ code, stdout, stderr, ms: Date.now() - started }))
    if (stdin !== undefined) {
      child.stdin.on('error', () => { /* the helper may exit before reading it all */ })
      child.stdin.end(stdin)
    }
  })
}

/** The raw text of the helpers' bat-scripts.log ('' when nothing was logged). */
export function helperLogText(dir) {
  const file = join(dir, 'Logs', 'bat-scripts.log')
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

export function helperEvents(dir, script, event) {
  return helperLogText(dir).split('\n').filter(Boolean).map(l => JSON.parse(l))
    .filter(e => e.script === script && (event === undefined || e.event === event))
}

/** A test env for runs that must not reach any server (usage / stdin errors). */
export function offlineEnv() {
  const dir = join(tmpdir(), `bat-t0608-offline-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  tempDirs.push(dir)
  return {
    dir,
    env: {
      // a closed port: a run that wrongly connects fails with CONNECT_FAILED instead of passing
      BAT_REMOTE_PORT: '9',
      BAT_REMOTE_TOKEN: 'test-token',
      BAT_TOWER_TERMINAL_ID: 'tower-1',
      BAT_TERMINAL_ID: 'worker-1',
      BAT_HELPER_LOG_DIR: join(dir, 'Logs'),
      BAT_USER_DATA: dir,
    },
  }
}
