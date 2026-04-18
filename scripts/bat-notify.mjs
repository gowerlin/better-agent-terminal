#!/usr/bin/env node
// scripts/bat-notify.mjs
// Notify another BAT terminal (e.g. Worker → Tower) with a message.
// Zero external dependencies — Node.js 18+ built-in modules only.
//
// Dual-channel notification:
//   1. invoke `terminal:notify` → UI Toast + Tab badge in renderer
//   2. invoke `pty:write`       → Pre-fill text into target PTY stdin (without \r)
//
// Usage:
//   BAT_REMOTE_PORT=... BAT_REMOTE_TOKEN=... \
//   BAT_TOWER_TERMINAL_ID=<tower-id> \
//   node scripts/bat-notify.mjs "T0133 完成"
//
//   # Or explicitly:
//   node scripts/bat-notify.mjs --target <tower-id> "T0133 完成"
//
//   # Skip PTY write (UI-only):
//   node scripts/bat-notify.mjs --no-pty-write "T0133 完成"
//
//   # With custom source label:
//   node scripts/bat-notify.mjs --source "T0133" "T0133 完成"
//
//   # Pre-fill AND auto-submit (PLAN-020 yolo mode):
//   node scripts/bat-notify.mjs --submit "T0133 完成"
//   # (appends \r to trigger PTY read; mutually exclusive with --no-pty-write)

import { createConnection } from 'net'
import { randomBytes } from 'crypto'

// ── MSYS2 path-conversion workaround (BUG-030) ──
// Git Bash (MSYS2) on Windows auto-converts `/`-prefixed arguments to Windows
// paths by prepending the Git install directory. Detect and restore. No-op on
// non-Windows and for arguments that don't match the pollution pattern.
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
const SELF_ID = process.env.BAT_TERMINAL_ID || null

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
let target = process.env.BAT_TOWER_TERMINAL_ID || null
let source = SELF_ID
let ptyWrite = true
let submit = false

// Extract --target option
const targetIdx = rawArgs.indexOf('--target')
if (targetIdx !== -1) {
  if (!rawArgs[targetIdx + 1]) {
    console.error('Error: --target requires a terminal ID argument')
    process.exit(1)
  }
  target = rawArgs[targetIdx + 1]
  rawArgs.splice(targetIdx, 2)
}

// Extract --source option
const srcIdx = rawArgs.indexOf('--source')
if (srcIdx !== -1) {
  if (!rawArgs[srcIdx + 1]) {
    console.error('Error: --source requires a label argument')
    process.exit(1)
  }
  source = rawArgs[srcIdx + 1]
  rawArgs.splice(srcIdx, 2)
}

// Extract --no-pty-write flag
const noWriteIdx = rawArgs.indexOf('--no-pty-write')
if (noWriteIdx !== -1) {
  ptyWrite = false
  rawArgs.splice(noWriteIdx, 1)
}

// Extract --submit flag (append \r to auto-submit in target PTY)
const submitIdx = rawArgs.indexOf('--submit')
if (submitIdx !== -1) {
  submit = true
  rawArgs.splice(submitIdx, 1)
}

// Mutual exclusion: --submit requires PTY write path
if (submit && !ptyWrite) {
  console.error('Error: --submit and --no-pty-write are mutually exclusive')
  process.exit(1)
}

if (!target) {
  console.error('Error: No target terminal ID (set BAT_TOWER_TERMINAL_ID or use --target)')
  process.exit(1)
}

const message = rawArgs.join(' ').trim()
if (!message) {
  console.error('Error: Message is required')
  console.error('Usage: bat-notify.mjs [--target <id>] [--source <label>] [--no-pty-write|--submit] <message>')
  process.exit(1)
}

// ── Minimal WebSocket client (duplicated from bat-terminal.mjs — zero deps principle) ──

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
      header[0] = 0x81
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
    const frame = Buffer.alloc(6)
    frame[0] = 0x88
    frame[1] = 0x80
    randomBytes(4).copy(frame, 2)
    try { this.#socket.write(frame) } catch { /* already closing */ }
    this.#socket.end()
  }

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

      if (isMasked) off += 4
      if (this.#buffer.length < off + len) return

      const payload = this.#buffer.subarray(off, off + len)
      this.#buffer = this.#buffer.subarray(off + len)

      if (opcode === 0x01 && this.#msgHandler) {
        this.#msgHandler(payload.toString('utf-8'))
      } else if (opcode === 0x08) {
        this.close()
        return
      }
    }
  }
}

// ── Helpers ──

function waitForMessageById(ws, expectedId, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Response timeout')), timeoutMs)
    ws.onMessage((raw) => {
      let frame
      try { frame = JSON.parse(raw) }
      catch { return } // Ignore non-JSON frames
      if (frame.id !== expectedId) return // Ignore unrelated frames
      clearTimeout(timer)
      resolve(frame)
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
  const authId = makeId()
  ws.send(JSON.stringify({
    type: 'auth',
    id: authId,
    token: TOKEN,
    args: ['bat-notify-cli'],
  }))

  const authResp = await waitForMessageById(ws, authId)
  if (authResp.error) {
    console.error(`Error: Authentication failed: ${authResp.error}`)
    ws.close()
    process.exit(1)
  }

  // Step 1: UI notification (toast + tab badge)
  const notifyId = makeId()
  ws.send(JSON.stringify({
    type: 'invoke',
    id: notifyId,
    channel: 'terminal:notify',
    args: [{ targetId: target, message, source }],
  }))

  const notifyResp = await waitForMessageById(ws, notifyId)
  if (notifyResp.error) {
    console.error(`Warning: UI notify failed: ${notifyResp.error}`)
    // Continue to PTY write — not fatal
  }

  // Step 2: PTY write (pre-fill text in target terminal).
  // With --submit, append \r to trigger PTY read (auto-submit).
  // If message already ends with \r or \n, do not double-append.
  if (ptyWrite) {
    const writeId = makeId()
    const endsWithNewline = submit && /[\r\n]$/.test(message)
    const payload = submit && !endsWithNewline ? message + '\r' : message
    ws.send(JSON.stringify({
      type: 'invoke',
      id: writeId,
      channel: 'pty:write',
      args: [target, payload],
    }))

    const writeResp = await waitForMessageById(ws, writeId)
    if (writeResp.error) {
      console.error(`Warning: PTY write failed: ${writeResp.error}`)
    }
  }

  console.log(`✓ Notified ${target.slice(0, 8)}…: ${message}`)
  ws.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
