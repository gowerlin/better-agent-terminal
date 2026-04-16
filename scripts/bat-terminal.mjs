#!/usr/bin/env node
// scripts/bat-terminal.mjs
// BAT internal terminal creation via WebSocket RemoteServer
// Zero external dependencies — Node.js 18+ built-in modules only
//
// Usage:
//   node scripts/bat-terminal.mjs claude "/ct-exec T0131"
//   node scripts/bat-terminal.mjs echo hello
//   node scripts/bat-terminal.mjs                          # empty shell
//   node scripts/bat-terminal.mjs --cwd /tmp echo hello
//   node scripts/bat-terminal.mjs --notify-id <tower-id> claude "/ct-exec T0133"
//     └─ Injects BAT_TOWER_TERMINAL_ID=<tower-id> into the new PTY's env,
//        allowing Worker to notify Tower on completion via bat-notify.mjs.

import { createConnection } from 'net'
import { randomBytes } from 'crypto'

// ── MSYS2 path-conversion workaround (BUG-030) ──
// Git Bash (MSYS2) on Windows auto-converts `/`-prefixed arguments to Windows
// paths by prepending the Git install directory (e.g. `/ct-exec T0136` becomes
// `C:/Program Files/Git/ct-exec T0136`). This corrupts slash-commands passed
// to this script. Detect the pollution pattern and restore the original `/`-
// prefixed argument. No-op on non-Windows and for arguments that don't match.
if (process.platform === 'win32') {
  const MSYS_GIT_PREFIX_RE = /^[A-Za-z]:[\/\\](Program Files[\/\\]Git|msys64|git)[\/\\](.*)$/
  process.argv = process.argv.map((arg) => {
    const m = arg.match(MSYS_GIT_PREFIX_RE)
    return m ? '/' + m[2].replace(/\\/g, '/') : arg
  })
}

// ── Environment ──

const PORT = process.env.BAT_REMOTE_PORT
const TOKEN = process.env.BAT_REMOTE_TOKEN

if (!PORT) {
  console.error('Error: Not running inside BAT terminal (BAT_REMOTE_PORT not set)')
  process.exit(1)
}
if (!TOKEN) {
  console.error('Error: BAT_REMOTE_TOKEN not set')
  process.exit(1)
}

// ── Argument parsing ──

const rawArgs = process.argv.slice(2)
let cwd = process.cwd()
let notifyId = null

// Extract --cwd option
const cwdIdx = rawArgs.indexOf('--cwd')
if (cwdIdx !== -1) {
  if (!rawArgs[cwdIdx + 1]) {
    console.error('Error: --cwd requires a path argument')
    process.exit(1)
  }
  cwd = rawArgs[cwdIdx + 1]
  rawArgs.splice(cwdIdx, 2)
}

// Extract --notify-id option (T0133: Worker→Tower auto-notify)
const notifyIdx = rawArgs.indexOf('--notify-id')
if (notifyIdx !== -1) {
  if (!rawArgs[notifyIdx + 1]) {
    console.error('Error: --notify-id requires a terminal ID argument')
    process.exit(1)
  }
  notifyId = rawArgs[notifyIdx + 1]
  rawArgs.splice(notifyIdx, 2)
}

// Shell-quote arguments containing special characters so the command
// survives re-parsing by the shell inside the new PTY.
function shellQuote(s) {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(s)) return s
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

const command = rawArgs.length > 0 ? rawArgs.map(shellQuote).join(' ') : undefined
const terminalId = randomBytes(16).toString('hex')

// ── Minimal WebSocket client (raw net + HTTP upgrade) ──
// Implements just enough of RFC 6455 for our auth→invoke→close flow.

class MinimalWS {
  #socket = null
  #buffer = Buffer.alloc(0)
  #upgraded = false
  #msgHandler = null
  #errHandler = null

  connect(host, port, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connection timeout (${timeoutMs}ms)`))
        this.#socket?.destroy()
      }, timeoutMs)

      const onFail = (err) => {
        clearTimeout(timer)
        reject(err)
      }

      this.#socket = createConnection({ host, port }, () => {
        const key = randomBytes(16).toString('base64')
        this.#socket.write(
          `GET / HTTP/1.1\r\nHost: ${host}:${port}\r\nUpgrade: websocket\r\n` +
          `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
        )
      })

      this.#socket.on('data', (chunk) => {
        this.#buffer = Buffer.concat([this.#buffer, chunk])

        if (!this.#upgraded) {
          const idx = this.#buffer.indexOf('\r\n\r\n')
          if (idx === -1) return
          const head = this.#buffer.subarray(0, idx).toString()
          this.#buffer = this.#buffer.subarray(idx + 4)
          if (!head.startsWith('HTTP/1.1 101')) {
            clearTimeout(timer)
            reject(new Error('WebSocket upgrade failed'))
            return
          }
          this.#upgraded = true
          clearTimeout(timer)
          resolve()
          this.#drain()
        } else {
          this.#drain()
        }
      })

      this.#socket.on('error', onFail)
      this.#socket.once('close', () => { clearTimeout(timer) })
    })
  }

  send(data) {
    const payload = Buffer.from(data, 'utf-8')
    const mask = randomBytes(4)
    let header

    if (payload.length < 126) {
      header = Buffer.alloc(6)
      header[0] = 0x81 // FIN + text opcode
      header[1] = 0x80 | payload.length
      mask.copy(header, 2)
    } else if (payload.length < 65536) {
      header = Buffer.alloc(8)
      header[0] = 0x81
      header[1] = 0x80 | 126
      header.writeUInt16BE(payload.length, 2)
      mask.copy(header, 4)
    } else {
      header = Buffer.alloc(14)
      header[0] = 0x81
      header[1] = 0x80 | 127
      header.writeBigUInt64BE(BigInt(payload.length), 2)
      mask.copy(header, 10)
    }

    // Mask payload (client→server frames MUST be masked per RFC 6455)
    const masked = Buffer.alloc(payload.length)
    for (let i = 0; i < payload.length; i++) {
      masked[i] = payload[i] ^ mask[i & 3]
    }
    this.#socket.write(Buffer.concat([header, masked]))
  }

  onMessage(fn) { this.#msgHandler = fn }
  onError(fn) { this.#errHandler = fn }

  close() {
    if (!this.#socket) return
    // Send close frame (opcode 0x08, masked, zero payload)
    const frame = Buffer.alloc(6)
    frame[0] = 0x88
    frame[1] = 0x80
    randomBytes(4).copy(frame, 2)
    try { this.#socket.write(frame) } catch { /* already closing */ }
    this.#socket.end()
  }

  // Parse zero or more complete WebSocket frames from #buffer
  #drain() {
    while (this.#buffer.length >= 2) {
      const opcode = this.#buffer[0] & 0x0f
      const isMasked = (this.#buffer[1] & 0x80) !== 0
      let len = this.#buffer[1] & 0x7f
      let off = 2

      if (len === 126) {
        if (this.#buffer.length < 4) return
        len = this.#buffer.readUInt16BE(2)
        off = 4
      } else if (len === 127) {
        if (this.#buffer.length < 10) return
        len = Number(this.#buffer.readBigUInt64BE(2))
        off = 10
      }

      if (isMasked) off += 4 // server shouldn't mask, but be safe
      if (this.#buffer.length < off + len) return

      const payload = this.#buffer.subarray(off, off + len)
      this.#buffer = this.#buffer.subarray(off + len)

      if (opcode === 0x01 && this.#msgHandler) {
        this.#msgHandler(payload.toString('utf-8'))
      } else if (opcode === 0x08) {
        this.close()
        return
      }
      // Ignore ping/pong/continuation for this simple use-case
    }
  }
}

// ── Helpers ──

function waitForMessage(ws, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Response timeout')), timeoutMs)
    ws.onMessage((raw) => {
      clearTimeout(timer)
      try { resolve(JSON.parse(raw)) }
      catch { reject(new Error('Invalid JSON response')) }
    })
  })
}

function makeId() {
  return randomBytes(8).toString('hex')
}

// ── Main ──

async function main() {
  const ws = new MinimalWS()

  try {
    await ws.connect('127.0.0.1', Number(PORT), 3000)
  } catch (err) {
    console.error(`Error: Cannot connect to BAT RemoteServer (port ${PORT}): ${err.message}`)
    process.exit(1)
  }

  // Auth
  ws.send(JSON.stringify({
    type: 'auth',
    id: makeId(),
    token: TOKEN,
    args: ['bat-terminal-cli'],
  }))

  const authResp = await waitForMessage(ws)
  if (authResp.error) {
    console.error(`Error: Authentication failed: ${authResp.error}`)
    ws.close()
    process.exit(1)
  }

  // Invoke terminal:create-with-command
  const invokePayload = { id: terminalId, cwd }
  if (command) invokePayload.command = command
  // T0133: Inject BAT_TOWER_TERMINAL_ID so Worker knows who to notify on completion
  if (notifyId) invokePayload.customEnv = { BAT_TOWER_TERMINAL_ID: notifyId }

  ws.send(JSON.stringify({
    type: 'invoke',
    id: makeId(),
    channel: 'terminal:create-with-command',
    args: [invokePayload],
  }))

  const invokeResp = await waitForMessage(ws)
  if (invokeResp.error) {
    console.error(`Error: Failed to create terminal: ${invokeResp.error}`)
    ws.close()
    process.exit(1)
  }

  console.log(`✓ Terminal created${command ? `: ${command}` : ' (empty shell)'}`)
  ws.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
