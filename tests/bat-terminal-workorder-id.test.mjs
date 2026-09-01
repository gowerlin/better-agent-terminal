// @vitest-environment node
//
// T0360 / BUG-082 — helper-level guard for the work order ID grammar.
//
// The reported failure was `--workorder CP-T0113` being rejected outright, which
// blocked structured dispatch for every cross-project work order in the CT
// ecosystem. These tests pin BOTH halves of the fix: the grammar was widened
// (G1) and it was NOT removed (G2). They also cover the ADVISORY B-2 stderr
// hint for a missing --workspace (G7).

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
const batTerminalScript = fileURLToPath(new URL('../scripts/bat-terminal.mjs', import.meta.url))

const ACCEPTED_IDS = ['T0001', 'T1', 'CP-T0113', 'CP-T1148', 'CT-T001', 'KEEN-T0002']
const REJECTED_IDS = ['T', 'X-T1', 'TOOLONG-T1', 'cp-t1', 'CP-T', 'T0001-extra', 'BUG-001']

// ── WebSocket frame helpers (mirrors tests/bat-terminal-msys.test.mjs) ──

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
  const certDir = join(tmpdir(), `bat-terminal-workorder-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(certDir, { recursive: true })
  const certPath = join(certDir, 'server-cert.json')
  writeFileSync(certPath, JSON.stringify({ fingerprint }), 'utf8')

  let resolveInvoke
  let rejectInvoke
  const invoke = new Promise((resolve, reject) => {
    resolveInvoke = resolve
    rejectInvoke = reject
  })

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
          rejectInvoke(new Error('missing Sec-WebSocket-Key'))
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
          socket.write(createWsFrame({ id: message.id, ok: true }))
        } else if (message.type === 'invoke') {
          resolveInvoke(message)
          socket.write(createWsFrame({ id: message.id, ok: true }))
        }
      }
    })

    socket.on('error', rejectInvoke)
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  return {
    port: server.address().port,
    certPath,
    invoke,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

function runBatTerminal(args, env = {}) {
  return new Promise((resolve) => {
    // Strip inherited BAT_* wiring: this suite must not talk to the real BAT
    // instance the test runner may be hosted inside.
    const childEnv = { ...process.env, ...env }
    if (!('BAT_REMOTE_PORT' in env)) delete childEnv.BAT_REMOTE_PORT
    if (!('BAT_REMOTE_TOKEN' in env)) delete childEnv.BAT_REMOTE_TOKEN
    if (!('BAT_SERVER_CERT_PATH' in env)) delete childEnv.BAT_SERVER_CERT_PATH

    const child = spawn(process.execPath, [batTerminalScript, ...args], {
      cwd: repoRoot,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

describe('bat-terminal --workorder ID grammar (T0360/BUG-082)', () => {
  it.each(ACCEPTED_IDS)('accepts %s (G1)', async (id) => {
    const run = await runBatTerminal(['--skill', 'ct-exec', '--workorder', id])
    // Validation passed when the run gets as far as the env check.
    expect(run.stderr).not.toContain('Invalid --workorder value')
    expect(run.stderr).toContain('BAT_REMOTE_PORT not set')
  }, 15000)

  it.each(REJECTED_IDS)('still rejects %s (G2)', async (id) => {
    const run = await runBatTerminal(['--skill', 'ct-exec', '--workorder', id])
    expect(run.code).toBe(1)
    expect(run.stderr).toContain(`Invalid --workorder value: '${id}'`)
  }, 15000)

  it('rejects an empty --workorder value', async () => {
    const run = await runBatTerminal(['--skill', 'ct-exec', '--workorder'])
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('--workorder requires a work order ID argument')
  }, 15000)

  it('forwards a prefixed work order through the structured skill payload', async () => {
    const remote = await startMockBatRemote()
    try {
      const run = await runBatTerminal(
        ['--workspace', 'ws-uuid-1', '--skill', 'ct-exec', '--workorder', 'CP-T0113'],
        { BAT_REMOTE_PORT: String(remote.port), BAT_REMOTE_TOKEN: 'test-token', BAT_SERVER_CERT_PATH: remote.certPath },
      )
      expect(run.code, run.stderr || run.stdout).toBe(0)

      const invoke = await remote.invoke
      expect(invoke.channel).toBe('terminal:create-agent-command')
      const payload = invoke.args[0]
      expect(payload.skill).toBe('ct-exec')
      expect(payload.workorder).toBe('CP-T0113')
      expect(payload.workspaceId).toBe('ws-uuid-1')
    } finally {
      await remote.close()
    }
  }, 20000)
})

describe('bat-terminal --workspace omission hint (T0360 ADVISORY B-2)', () => {
  it('warns on stderr and still exits 0 when --workspace is omitted (G7)', async () => {
    const remote = await startMockBatRemote()
    try {
      const run = await runBatTerminal(
        ['--skill', 'ct-exec', '--workorder', 'T0001'],
        { BAT_REMOTE_PORT: String(remote.port), BAT_REMOTE_TOKEN: 'test-token', BAT_SERVER_CERT_PATH: remote.certPath },
      )
      expect(run.code, run.stderr || run.stdout).toBe(0)
      expect(run.stderr).toContain('--workspace not specified')
      expect(run.stderr).toContain('BAT_WORKSPACE_ID')

      const payload = (await remote.invoke).args[0]
      expect(payload.workspaceId).toBeUndefined()
    } finally {
      await remote.close()
    }
  }, 20000)

  it('stays silent when --workspace is supplied (G7)', async () => {
    const remote = await startMockBatRemote()
    try {
      const run = await runBatTerminal(
        ['--workspace', 'ws-uuid-2', '--skill', 'ct-exec', '--workorder', 'T0001'],
        { BAT_REMOTE_PORT: String(remote.port), BAT_REMOTE_TOKEN: 'test-token', BAT_SERVER_CERT_PATH: remote.certPath },
      )
      expect(run.code, run.stderr || run.stdout).toBe(0)
      expect(run.stderr).not.toContain('--workspace not specified')

      const payload = (await remote.invoke).args[0]
      expect(payload.workspaceId).toBe('ws-uuid-2')
    } finally {
      await remote.close()
    }
  }, 20000)
})
