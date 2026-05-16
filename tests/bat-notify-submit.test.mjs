// @vitest-environment node

import { createHash, X509Certificate } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import tls from 'node:tls'

import selfsigned from 'selfsigned'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const batNotifyScript = fileURLToPath(new URL('../scripts/bat-notify.mjs', import.meta.url))

function createWsFrame(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  if (body.length < 126) {
    return Buffer.concat([Buffer.from([0x81, body.length]), body])
  }
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

async function startMockBatRemote() {
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
  const certDir = join(tmpdir(), `bat-notify-submit-${process.pid}-${Date.now()}`)
  mkdirSync(certDir, { recursive: true })
  const certPath = join(certDir, 'server-cert.json')
  writeFileSync(certPath, JSON.stringify({ fingerprint }), 'utf8')

  const invokes = []
  const server = tls.createServer({ key: pems.private, cert: pems.cert }, (socket) => {
    let upgraded = false
    let buffer = Buffer.alloc(0)

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
          socket.end()
          return
        }

        const message = JSON.parse(frame.message)
        if (message.type === 'auth') {
          socket.write(createWsFrame({ id: message.id, result: true }))
        } else if (message.type === 'invoke') {
          invokes.push(message)
          socket.write(createWsFrame({ id: message.id, result: { ok: true } }))
        }
      }
    })
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  return {
    port: server.address().port,
    certPath,
    invokes,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

function runBatNotify(port, certPath, message = 'T9999 完成') {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        batNotifyScript,
        '--target',
        'tower-123',
        '--source',
        'T9999',
        '--submit',
        message,
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          BAT_REMOTE_PORT: String(port),
          BAT_REMOTE_TOKEN: 'test-token',
          BAT_SERVER_CERT_PATH: certPath,
          BAT_TOWER_TERMINAL_ID: 'tower-123',
          BAT_TERMINAL_ID: 'worker-456',
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

describe('bat-notify submit mode', () => {
  it('prefills text without CR and sends Enter through terminal:keypress', async () => {
    const remote = await startMockBatRemote()
    try {
      const run = await runBatNotify(remote.port, remote.certPath)
      expect(run.code, run.stderr || run.stdout).toBe(0)
    } finally {
      await remote.close()
    }

    expect(remote.invokes.map((invoke) => invoke.channel)).toEqual([
      'terminal:notify',
      'pty:write',
      'terminal:keypress',
    ])

    expect(remote.invokes[1].args).toEqual(['tower-123', 'T9999 完成'])
    expect(remote.invokes[2].args[0]).toMatchObject({
      targetId: 'tower-123',
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      source: 'T9999',
      reason: 'submit',
    })
    expect(typeof remote.invokes[2].args[0].traceId).toBe('string')
  }, 15000)

  it('keeps submit as a separate keypress action when text payload ends with LF', async () => {
    const remote = await startMockBatRemote()
    try {
      const run = await runBatNotify(remote.port, remote.certPath, 'T9999 完成\n')
      expect(run.code, run.stderr || run.stdout).toBe(0)
    } finally {
      await remote.close()
    }

    expect(remote.invokes.map((invoke) => invoke.channel)).toEqual([
      'terminal:notify',
      'pty:write',
      'terminal:keypress',
    ])

    expect(remote.invokes[1].args).toEqual(['tower-123', 'T9999 完成\n'])
    expect(remote.invokes[2].args[0]).toMatchObject({
      targetId: 'tower-123',
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      source: 'T9999',
      reason: 'submit',
    })
    expect(typeof remote.invokes[2].args[0].traceId).toBe('string')
  }, 15000)
})
