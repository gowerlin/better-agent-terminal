// @vitest-environment node
//
// T0499 — bat-notify must report the server's id-less auth rejection as auth-failed.
//
// RemoteServer rejects a banned IP (on connect, before any auth frame) and an auth
// timeout with `{ type: 'auth-result', id: '0', error }` and then closes the socket
// (electron/remote/remote-server.ts). Before T0499 bat-notify waited for a reply
// carrying its own auth id only, so both surfaced as a generic `Response timeout`
// 3 s later. The broadcast case pins that waiting by id still ignores `event` frames.

import { createHash, X509Certificate } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import tls from 'node:tls'

import selfsigned from 'selfsigned'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const batNotifyScript = fileURLToPath(new URL('../scripts/bat-notify.mjs', import.meta.url))

// ── WebSocket frame helpers (mirrors tests/bat-notify-submit.test.mjs) ──

function createWsFrame(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  if (body.length < 126) {
    return Buffer.concat([Buffer.from([0x81, body.length]), body])
  }
  const header = Buffer.alloc(4)
  header[0] = 0x81
  header[1] = 126
  header.writeUInt16BE(body.length, 2)
  return Buffer.concat([header, body])
}

const CLOSE_FRAME = Buffer.from([0x88, 0x00])

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

  if ((buffer[1] & 0x80) === 0) throw new Error('client WebSocket frame was not masked')
  if (buffer.length < offset + 4 + length) return null

  const mask = buffer.subarray(offset, offset + 4)
  offset += 4

  const payload = Buffer.alloc(length)
  const encoded = buffer.subarray(offset, offset + length)
  for (let i = 0; i < encoded.length; i++) {
    payload[i] = encoded[i] ^ mask[i & 3]
  }

  return {
    opcode,
    message: payload.toString('utf8'),
    rest: buffer.subarray(offset + length),
  }
}

function broadcastFrame(n) {
  return createWsFrame({ type: 'event', id: '0', channel: 'pty:output', args: ['other-pty', `output ${n}\r\n`] })
}

/**
 * @param {object} opts
 * @param {object} [opts.rejectOnConnect]  frame sent with the 101 in ONE chunk, then close (banned IP)
 * @param {object|Function} [opts.rejectAuth] frame (or auth message → frame) sent instead of the auth-result, then close
 * @param {number} [opts.broadcastEveryMs] keep sending `event` frames after auth-result
 * @param {number} [opts.invokeDelayMs]    delay before each invoke-result frame
 */
async function startMockBatRemote({
  rejectOnConnect = null,
  rejectAuth = null,
  broadcastEveryMs = 0,
  invokeDelayMs = 0,
} = {}) {
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: '127.0.0.1' }],
    {
      days: 1,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [{ name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }],
    },
  )
  const fingerprint = new X509Certificate(pems.cert).fingerprint256
  const dir = join(tmpdir(), `bat-notify-auth-reject-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  const certPath = join(dir, 'server-cert.json')
  writeFileSync(certPath, JSON.stringify({ fingerprint }), 'utf8')

  const state = { authFrames: 0, invokes: [], broadcastsSent: 0 }

  const server = tls.createServer({ key: pems.private, cert: pems.cert }, (socket) => {
    let upgraded = false
    let closed = false
    let buffer = Buffer.alloc(0)
    let broadcastTimer = null
    const stop = () => { if (broadcastTimer) clearInterval(broadcastTimer) }
    const reject = (chunk) => {
      closed = true
      socket.end(chunk)
    }

    socket.on('data', (chunk) => {
      if (closed) return
      buffer = Buffer.concat([buffer, chunk])

      if (!upgraded) {
        const headerEnd = buffer.indexOf('\r\n\r\n')
        if (headerEnd === -1) return

        const requestHead = buffer.subarray(0, headerEnd).toString('utf8')
        const keyMatch = requestHead.match(/^Sec-WebSocket-Key:\s*(.+)$/im)
        if (!keyMatch) {
          socket.destroy()
          return
        }

        const accept = createHash('sha1')
          .update(`${keyMatch[1].trim()}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
          .digest('base64')

        const head = Buffer.from(
          'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
          'utf8',
        )
        if (rejectOnConnect) {
          reject(Buffer.concat([head, createWsFrame(rejectOnConnect), CLOSE_FRAME]))
          return
        }
        socket.write(head)
        buffer = buffer.subarray(headerEnd + 4)
        upgraded = true
      }

      while (upgraded) {
        const frame = parseClientFrame(buffer)
        if (!frame) return
        buffer = frame.rest
        if (frame.opcode === 0x08) {
          stop()
          socket.end()
          return
        }

        const message = JSON.parse(frame.message)
        if (message.type === 'auth') {
          state.authFrames++
          if (rejectAuth) {
            const frame = typeof rejectAuth === 'function' ? rejectAuth(message) : rejectAuth
            reject(Buffer.concat([createWsFrame(frame), CLOSE_FRAME]))
            return
          }
          socket.write(createWsFrame({ type: 'auth-result', id: message.id, result: { platform: 'test' } }))
          if (broadcastEveryMs > 0) {
            broadcastTimer = setInterval(() => {
              if (socket.destroyed) return stop()
              socket.write(broadcastFrame(state.broadcastsSent++))
            }, broadcastEveryMs)
          }
        } else if (message.type === 'invoke') {
          state.invokes.push(message)
          setTimeout(() => {
            if (socket.destroyed) return
            socket.write(createWsFrame({ type: 'invoke-result', id: message.id, result: { ok: true } }))
          }, invokeDelayMs)
        }
      }
    })

    // The helper may write its auth frame after we closed, or exit with unread broadcasts.
    socket.on('error', stop)
    socket.on('close', stop)
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  return {
    port: server.address().port,
    certPath,
    logDir: join(dir, 'Logs'),
    userData: dir,
    state,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

function runBatNotify(remote, extraArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [batNotifyScript, '--target', 'tower-123', '--source', 'T9999', ...extraArgs, 'T9999 完成'],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          BAT_REMOTE_PORT: String(remote.port),
          BAT_REMOTE_TOKEN: 'test-token',
          BAT_SERVER_CERT_PATH: remote.certPath,
          BAT_TOWER_TERMINAL_ID: 'tower-123',
          BAT_TERMINAL_ID: 'worker-456',
          // Keep the helper's NDJSON log in this test's temp dir, not the user's real log.
          BAT_HELPER_LOG_DIR: remote.logDir,
          BAT_USER_DATA: remote.userData,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function lastExit(remote) {
  const file = join(remote.logDir, 'bat-scripts.log')
  if (!existsSync(file)) return undefined
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.script === 'bat-notify' && entry.event === 'exit')
    .at(-1)
}

describe('bat-notify accepts the server\'s id-less auth rejection (T0499)', () => {
  it.each([
    ['banned IP', 'Too many failed attempts'],
    ['auth timeout', 'Auth timeout'],
  ])('auth answered with id \'0\' (%s) → exit 1 auth-failed, nothing invoked', async (_label, error) => {
    const remote = await startMockBatRemote({ rejectAuth: { type: 'auth-result', id: '0', error } })
    try {
      const run = await runBatNotify(remote)
      expect(run.code, run.stderr || run.stdout).toBe(1)
      expect(run.stderr).toContain(`Authentication failed: ${error}`)
      expect(run.stderr).not.toContain('Response timeout')
      expect(remote.state.authFrames).toBe(1)
      expect(remote.state.invokes).toEqual([])
      expect(lastExit(remote)).toMatchObject({ code: 1, reason: 'auth-failed', error })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('banned IP rejected on connect, in the same chunk as the 101 → exit 1 auth-failed', async () => {
    // The server sends the rejection before the helper has sent (or awaits) its auth frame.
    const remote = await startMockBatRemote({
      rejectOnConnect: { type: 'auth-result', id: '0', error: 'Too many failed attempts' },
    })
    try {
      const run = await runBatNotify(remote)
      expect(run.code, run.stderr || run.stdout).toBe(1)
      expect(run.stderr).toContain('Authentication failed: Too many failed attempts')
      expect(run.stderr).not.toContain('Response timeout')
      expect(remote.state.invokes).toEqual([])
      expect(lastExit(remote)).toMatchObject({ code: 1, reason: 'auth-failed' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('an auth-result carrying the helper\'s own id with an error is still auth-failed', async () => {
    const remote = await startMockBatRemote({
      rejectAuth: (message) => ({ type: 'auth-result', id: message.id, error: 'Invalid token' }),
    })
    try {
      const run = await runBatNotify(remote)
      expect(run.code, run.stderr || run.stdout).toBe(1)
      expect(run.stderr).toContain('Authentication failed: Invalid token')
      expect(remote.state.invokes).toEqual([])
      expect(lastExit(remote)).toMatchObject({ code: 1, reason: 'auth-failed', error: 'Invalid token' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it.each([
    ['--submit', ['--submit'], ['terminal:notify', 'pty:write', 'terminal:keypress']],
    ['default', [], ['terminal:notify', 'pty:write']],
    ['--no-pty-write', ['--no-pty-write'], ['terminal:notify']],
  ])('broadcasts after auth + delayed replies (%s) → exit 0, unchanged flow', async (_label, args, channels) => {
    const remote = await startMockBatRemote({ broadcastEveryMs: 2, invokeDelayMs: 30 })
    try {
      const run = await runBatNotify(remote, args)
      expect(run.code, run.stderr || run.stdout).toBe(0)
      expect(run.stdout).toContain('✓ Notified')
      expect(run.stderr).toBe('')
      expect(remote.state.broadcastsSent).toBeGreaterThan(0)
      expect(remote.state.invokes.map((invoke) => invoke.channel)).toEqual(channels)
      expect(lastExit(remote)).toMatchObject({ code: 0 })
    } finally {
      await remote.close()
    }
  }, 20000)
})
