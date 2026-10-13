// @vitest-environment node
//
// T0497 / BUG-114 — bat-terminal must match the auth / invoke reply by frame id.
//
// A local BAT PTY authenticates with the full server token, so the helper's
// connection receives every PROXIED_EVENTS broadcast (`{ type: 'event', id: '0' }`,
// e.g. each PTY's pty:output). Before T0497 the helper took the next arbitrary
// frame as the invoke reply: a broadcast arriving first was reported as
// `✓ Terminal created` (exit 0) and the helper exited before the server had read
// the invoke, so the dispatch was lost (T0490). The mock server below behaves like
// the real one: it keeps broadcasting after auth and answers the invoke late.

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
const batTerminalScript = fileURLToPath(new URL('../scripts/bat-terminal.mjs', import.meta.url))

const ARGS = ['--workspace', 'ws-uuid-t0497', '--skill', 'ct-exec', '--workorder', 'T0497']

// ── WebSocket frame helpers (mirrors tests/bat-terminal-workorder-id.test.mjs) ──

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

  return { opcode, message: payload.toString('utf8'), rest: buffer.subarray(offset + length) }
}

// Same shape as RemoteServer.broadcastHub (electron/remote/remote-server.ts).
function broadcastFrame(n) {
  return createWsFrame({ type: 'event', id: '0', channel: 'pty:output', args: ['other-pty', `output ${n}\r\n`] })
}

/**
 * @param {object} opts
 * @param {number} [opts.broadcastEveryMs]  keep sending `event` frames after auth-result
 * @param {boolean} [opts.coalesceAuth]     write event + auth-result + event in ONE chunk
 * @param {object|null} [opts.authReply]    replaces the auth-result frame (id included)
 * @param {number} [opts.invokeDelayMs]     delay before the invoke-result frame
 * @param {object|null} [opts.invokeReply]  fields of the invoke-result; null = never answer
 */
async function startMockBatRemote({
  broadcastEveryMs = 0,
  coalesceAuth = false,
  authReply = undefined,
  invokeDelayMs = 0,
  invokeReply = { result: true },
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
  const dir = join(tmpdir(), `bat-terminal-correlation-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  const certPath = join(dir, 'server-cert.json')
  writeFileSync(certPath, JSON.stringify({ fingerprint }), 'utf8')

  const state = { invoke: null, invokeResultSentAt: null, broadcastsSent: 0 }

  const server = tls.createServer({ key: pems.private, cert: pems.cert }, (socket) => {
    let upgraded = false
    let buffer = Buffer.alloc(0)
    let broadcastTimer = null
    const stop = () => { if (broadcastTimer) clearInterval(broadcastTimer) }
    const sendBroadcast = () => {
      if (socket.destroyed) return stop()
      socket.write(broadcastFrame(state.broadcastsSent++))
    }

    socket.on('data', (chunk) => {
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

        socket.write(
          'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
        )
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
          const reply = createWsFrame(authReply === undefined
            ? { type: 'auth-result', id: message.id, result: { platform: 'test' } }
            : authReply)
          if (coalesceAuth) {
            socket.write(Buffer.concat([broadcastFrame(state.broadcastsSent++), reply, broadcastFrame(state.broadcastsSent++)]))
          } else {
            socket.write(reply)
          }
          if (broadcastEveryMs > 0) broadcastTimer = setInterval(sendBroadcast, broadcastEveryMs)
        } else if (message.type === 'invoke') {
          state.invoke = message
          if (invokeReply === null) continue
          setTimeout(() => {
            if (socket.destroyed) return
            socket.write(createWsFrame({ type: 'invoke-result', id: message.id, ...invokeReply }))
            state.invokeResultSentAt = Date.now()
          }, invokeDelayMs)
        }
      }
    })

    // The helper exits with unread broadcasts in its socket (RST) — expected here.
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

function runBatTerminal(remote) {
  return new Promise((resolve) => {
    const childEnv = {
      ...process.env,
      BAT_REMOTE_PORT: String(remote.port),
      BAT_REMOTE_TOKEN: 'test-token',
      BAT_SERVER_CERT_PATH: remote.certPath,
      // Keep the helper's NDJSON log in this test's temp dir, not the user's real log.
      BAT_HELPER_LOG_DIR: remote.logDir,
      BAT_USER_DATA: remote.userData,
    }

    const startedAt = Date.now()
    const child = spawn(process.execPath, [batTerminalScript, ...ARGS], {
      cwd: repoRoot,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })
    child.on('close', (code) => resolve({ code, stdout, stderr, startedAt, exitedAt: Date.now() }))
  })
}

function readHelperEvents(remote) {
  const file = join(remote.logDir, 'bat-scripts.log')
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.script === 'bat-terminal')
}

function lastEvent(remote, name) {
  return readHelperEvents(remote).filter((entry) => entry.event === name).at(-1)
}

describe('bat-terminal matches the invoke reply by frame id (T0497 / BUG-114)', () => {
  it('ignores broadcasts and waits for the delayed invoke-result → exit 0', async () => {
    const remote = await startMockBatRemote({ broadcastEveryMs: 2, invokeDelayMs: 30 })
    try {
      const run = await runBatTerminal(remote)
      expect(run.code, run.stderr || run.stdout).toBe(0)
      expect(run.stdout).toContain('✓ Terminal created')

      // The server saw the invoke and answered it before the helper exited.
      expect(remote.state.invoke?.channel).toBe('terminal:create-agent-command')
      expect(remote.state.invokeResultSentAt).not.toBeNull()
      expect(run.exitedAt).toBeGreaterThanOrEqual(remote.state.invokeResultSentAt)
      expect(remote.state.broadcastsSent).toBeGreaterThan(0)

      const created = lastEvent(remote, 'terminal-created')
      expect(created).toMatchObject({ result: 'ok', responseType: 'invoke-result' })
      expect(created.ignoredFrames).toBeGreaterThan(0)
    } finally {
      await remote.close()
    }
  }, 20000)

  it('result false under broadcasts → exit 1, no "Terminal created" (T0456)', async () => {
    const remote = await startMockBatRemote({ broadcastEveryMs: 2, invokeDelayMs: 30, invokeReply: { result: false } })
    try {
      const run = await runBatTerminal(remote)
      expect(run.code, run.stderr || run.stdout).toBe(1)
      expect(run.stderr).toMatch(/Failed to create terminal: \S+ was not created \(server answered false/)
      expect(run.stdout).not.toContain('Terminal created')
      expect(lastEvent(remote, 'terminal-created')).toMatchObject({ result: 'false', responseType: 'invoke-result' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('a structured refusal under broadcasts → exit 1 with its code (T0433)', async () => {
    const remote = await startMockBatRemote({
      broadcastEveryMs: 2,
      invokeDelayMs: 30,
      invokeReply: { result: { ok: false, code: 'AGENT_UNAVAILABLE', error: 'codex is not available on this server' } },
    })
    try {
      const run = await runBatTerminal(remote)
      expect(run.code, run.stderr || run.stdout).toBe(1)
      expect(run.stderr).toContain('Failed to create terminal (AGENT_UNAVAILABLE): codex is not available on this server')
      expect(run.stdout).not.toContain('Terminal created')
      expect(lastEvent(remote, 'terminal-created')).toMatchObject({ result: 'refused', code: 'AGENT_UNAVAILABLE' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('auth-result coalesced with broadcasts in one chunk → normal success', async () => {
    const remote = await startMockBatRemote({ coalesceAuth: true, invokeDelayMs: 30 })
    try {
      const run = await runBatTerminal(remote)
      expect(run.code, run.stderr || run.stdout).toBe(0)
      expect(run.stdout).toContain('✓ Terminal created')
      expect(remote.state.invoke).not.toBeNull()
      expect(run.exitedAt).toBeGreaterThanOrEqual(remote.state.invokeResultSentAt)
    } finally {
      await remote.close()
    }
  }, 20000)

  it('auth-result coalesced with broadcasts, then result false → exit 1', async () => {
    const remote = await startMockBatRemote({ coalesceAuth: true, broadcastEveryMs: 2, invokeDelayMs: 30, invokeReply: { result: false } })
    try {
      const run = await runBatTerminal(remote)
      expect(run.code, run.stderr || run.stdout).toBe(1)
      expect(run.stdout).not.toContain('Terminal created')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('only broadcasts, never an invoke-result → exit 1 invoke-timeout after 3000 ms', async () => {
    const remote = await startMockBatRemote({ broadcastEveryMs: 5, invokeReply: null })
    try {
      const run = await runBatTerminal(remote)
      expect(run.code, run.stderr || run.stdout).toBe(1)
      expect(run.stderr).toContain('Invoke response timeout')
      expect(run.stdout).not.toContain('Terminal created')
      expect(run.exitedAt - run.startedAt).toBeGreaterThanOrEqual(3000)

      const exit = lastEvent(remote, 'exit')
      expect(exit).toMatchObject({ code: 1, reason: 'invoke-timeout' })
      expect(exit.ignoredFrames).toBeGreaterThan(0)
    } finally {
      await remote.close()
    }
  }, 20000)

  it('still reports the server\'s id-less auth rejection as auth-failed', async () => {
    // RemoteServer answers a banned IP / auth timeout with `id: '0'` (remote-server.ts).
    const remote = await startMockBatRemote({ authReply: { type: 'auth-result', id: '0', error: 'Too many failed attempts' } })
    try {
      const run = await runBatTerminal(remote)
      expect(run.code, run.stderr || run.stdout).toBe(1)
      expect(run.stderr).toContain('Authentication failed: Too many failed attempts')
      expect(remote.state.invoke).toBeNull()
      expect(lastEvent(remote, 'exit')).toMatchObject({ code: 1, reason: 'auth-failed' })
    } finally {
      await remote.close()
    }
  }, 20000)
})
