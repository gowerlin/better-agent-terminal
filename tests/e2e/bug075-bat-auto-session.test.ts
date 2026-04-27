import { createHash, X509Certificate } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path, { basename, join } from 'node:path'
import { spawn } from 'node:child_process'
import tls from 'node:tls'

import { test, expect } from '@playwright/test'
import selfsigned from 'selfsigned'

import { registerTerminalCommandHandlers } from '../../electron/terminal-command-handlers'

const repoRoot = path.resolve(__dirname, '../..')
const batTerminalScript = path.join(repoRoot, 'scripts', 'bat-terminal.mjs')
const workorder = 'T0345'

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

interface PtyCreateRecord {
  id: string
  shell?: string
  command?: string
  customEnv?: Record<string, string>
}

function createWsFrame(payload: unknown) {
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

function parseClientFrame(buffer: Buffer) {
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

async function startMockBatRemote(onInvoke: (message: any) => Promise<unknown>) {
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
  const certDir = join(tmpdir(), `bug075-bat-auto-session-${process.pid}-${Date.now()}`)
  mkdirSync(certDir, { recursive: true })
  const certPath = join(certDir, 'server-cert.json')
  writeFileSync(certPath, JSON.stringify({ fingerprint }), 'utf8')

  const server = tls.createServer({ key: pems.private, cert: pems.cert }, (socket) => {
    let upgraded = false
    let buffer = Buffer.alloc(0)

    socket.on('data', async (chunk) => {
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
          socket.write(createWsFrame({ id: message.id, ok: true }))
        } else if (message.type === 'invoke') {
          try {
            await onInvoke(message)
            socket.write(createWsFrame({ id: message.id, ok: true }))
          } catch (error) {
            socket.write(createWsFrame({ id: message.id, error: (error as Error).message }))
          }
        }
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('mock BAT RemoteServer did not bind to a TCP port')

  return {
    port: address.port,
    certPath,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

function createBatHandlers() {
  const handlers = new Map<string, Handler>()
  const created: PtyCreateRecord[] = []
  const writes: string[] = []

  registerTerminalCommandHandlers({
    registerHandler(channel, handler) {
      handlers.set(channel, handler)
    },
    async invokeHandler(channel, args, windowId) {
      const handler = handlers.get(channel)
      if (!handler) throw new Error(`No handler for channel: ${channel}`)
      return handler({ windowId: windowId ?? null }, ...args)
    },
    getPtyManager() {
      return {
        isAlive: () => false,
        create(options) {
          created.push({
            id: options.id,
            shell: options.shell,
            customEnv: options.customEnv,
          })
          return true
        },
        write(id, data) {
          writes.push(data)
          const record = created.find((entry) => entry.id === id)
          if (record) record.command = data.replace(/\r$/, '')
        },
      }
    },
    getAllWindows: () => [],
    readPersistedSettingsSync: () => ({ shell: 'git-bash' }),
    buildAgentPromptCommand: async (opts) => {
      expect(opts.agent).toBe('default')
      expect(opts.skill).toBe('ct-exec')
      expect(opts.workorder).toBe(workorder)
      return {
        command: `codex "$ct-exec ${workorder}"`,
        agentId: 'codex-cli',
        prompt: `$ct-exec ${workorder}`,
        prefixNormalized: false,
      }
    },
    pickWhitelistedEnv: (env) => ({ ...env }),
    mirrorToBatScripts: () => undefined,
    logger: {
      log: () => undefined,
      warn: () => undefined,
    },
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
    existsSync: (candidate) => candidate === 'C:\\Program Files\\Git\\bin\\bash.exe',
    setTimeout: (callback: () => void) => {
      callback()
      return 0
    },
  })

  const agentCommand = handlers.get('terminal:create-agent-command')
  if (!agentCommand) throw new Error('terminal:create-agent-command was not registered')

  return {
    created,
    writes,
    handleInvoke: async (message: any) => {
      expect(message.channel).toBe('terminal:create-agent-command')
      expect(message.args).toHaveLength(1)
      const result = await agentCommand({ windowId: null }, message.args[0])
      expect(result).toBe(true)
    },
  }
}

function runBatTerminal(port: number, certPath: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(
      process.execPath,
      [
        batTerminalScript,
        '--agent',
        'default',
        '--skill',
        'ct-exec',
        '--workorder',
        workorder,
      ],
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

test.describe('BUG-075 BAT auto-session regression', () => {
  test.skip(process.platform !== 'win32', 'BUG-075 auto-session regression is Windows/Git Bash specific')

  test('dispatches three codex worker sessions with literal prompt, Git Bash shell, and MSYS guard', async () => {
    const harness = createBatHandlers()
    const remote = await startMockBatRemote(harness.handleInvoke)

    try {
      for (let index = 0; index < 3; index++) {
        const run = await runBatTerminal(remote.port, remote.certPath)
        expect(run.code, run.stderr || run.stdout).toBe(0)
      }
    } finally {
      await remote.close()
    }

    expect(harness.created).toHaveLength(3)
    expect(harness.created.map((entry) => basename(entry.shell ?? ''))).toEqual(['bash.exe', 'bash.exe', 'bash.exe'])
    expect(harness.created.map((entry) => entry.customEnv?.MSYS_NO_PATHCONV)).toEqual(['1', '1', '1'])
    expect(harness.created.map((entry) => entry.command)).toEqual([
      `codex "$ct-exec ${workorder}"`,
      `codex "$ct-exec ${workorder}"`,
      `codex "$ct-exec ${workorder}"`,
    ])
    expect(harness.writes).toHaveLength(3)
    for (const command of harness.writes) {
      expect(command).toContain(`$ct-exec ${workorder}`)
      expect(command).not.toContain('C:/Program Files/Git/ct-exec')
      expect(command).not.toContain('/ct-exec')
    }
  })
})
