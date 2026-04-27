// @vitest-environment node

import { createHash, X509Certificate } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import tls from 'node:tls'

import selfsigned from 'selfsigned'
import { describe, expect, it } from 'vitest'

const isWindows = process.platform === 'win32'
const describeWindows = isWindows ? describe : describe.skip

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const batTerminalScript = fileURLToPath(new URL('../scripts/bat-terminal.mjs', import.meta.url))
const prompt = '/ct-exec T0001'

function findGitBash() {
  const candidates = [
    process.env.GIT_BASH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'C:\\msys64\\usr\\bin\\bash.exe',
  ].filter(Boolean)

  return candidates.find((candidate) => existsSync(candidate))
}

function runGitBashArgvProbe(bash, envOverrides = {}) {
  const env = { ...process.env, ...envOverrides }
  if (!Object.prototype.hasOwnProperty.call(envOverrides, 'MSYS_NO_PATHCONV')) {
    delete env.MSYS_NO_PATHCONV
  }

  const result = spawnSync(
    bash,
    ['-lc', "node -e 'console.log(JSON.stringify(process.argv.slice(1)))' /ct-exec T0001"],
    { cwd: repoRoot, env, encoding: 'utf8' },
  )

  expect(result.status, result.stderr || result.stdout).toBe(0)
  return JSON.parse(result.stdout.trim())
}

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

  const masked = (buffer[1] & 0x80) !== 0
  if (!masked) throw new Error('client WebSocket frame was not masked')
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
  const certDir = join(tmpdir(), `bat-terminal-msys-${process.pid}-${Date.now()}`)
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

function runBatTerminal(port, certPath) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [batTerminalScript, '--prompt', prompt],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          BAT_REMOTE_PORT: String(port),
          BAT_REMOTE_TOKEN: 'test-token',
          BAT_SERVER_CERT_PATH: certPath,
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

describeWindows('bat-terminal MSYS path conversion regression guard', () => {
  it('documents the Git Bash argv conversion fixture and MSYS_NO_PATHCONV escape hatch', () => {
    const bash = findGitBash()
    if (!bash) {
      console.warn('Skipping MSYS argv fixture: Git Bash not found')
      return
    }

    const converted = runGitBashArgvProbe(bash)
    expect(converted).toHaveLength(2)
    expect(converted[0]).not.toBe('/ct-exec')
    expect(converted[0]).toMatch(/^[A-Za-z]:\/.*\/ct-exec$/)
    expect(converted[1]).toBe('T0001')

    const literal = runGitBashArgvProbe(bash, { MSYS_NO_PATHCONV: '1' })
    expect(literal).toEqual(['/ct-exec', 'T0001'])
  })

  it('passes literal slash prompts through invokePayload and injects MSYS_NO_PATHCONV for worker PTYs', async () => {
    const remote = await startMockBatRemote()
    try {
      const run = await runBatTerminal(remote.port, remote.certPath)
      expect(run.code, run.stderr || run.stdout).toBe(0)

      const invoke = await remote.invoke
      expect(invoke.channel).toBe('terminal:create-agent-command')
      expect(invoke.args).toHaveLength(1)

      const payload = invoke.args[0]
      expect(payload.prompt).toBe(prompt)
      expect(payload.prompt).toHaveLength(14)
      expect(payload.customEnv).toMatchObject({ MSYS_NO_PATHCONV: '1' })
    } finally {
      await remote.close()
    }
  }, 15000)
})
