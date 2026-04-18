#!/usr/bin/env node
// scripts/bat-terminal.mjs
// BAT internal terminal creation via WebSocket RemoteServer
// Zero external dependencies — Node.js 18+ built-in modules only
//
// Usage:
//   node scripts/bat-terminal.mjs claude "/ct-exec T0131"
//   node scripts/bat-terminal.mjs echo hello
//   node scripts/bat-terminal.mjs --cwd /tmp echo hello
//   node scripts/bat-terminal.mjs --notify-id <tower-id> claude "/ct-exec T0133"
//     └─ Injects BAT_TOWER_TERMINAL_ID=<tower-id> into the new PTY's env,
//        allowing Worker to notify Tower on completion via bat-notify.mjs.
//   node scripts/bat-terminal.mjs --workspace <workspace-id> claude "/ct-exec T0137"
//     └─ Explicitly allocate the new PTY to the given workspace tab list.
//        Omitted → PTY lands in the currently active workspace (T0137/BUG-031).
//
// Options:
//   --help, -h     Show help
//   --version      Show version

import { createConnection } from 'net'
import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ── Version (read from package.json, fallback on failure) ──

const VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    return JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf-8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
})()

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

// ── Help / version (handled before env check so they work universally) ──

const HELP_TEXT = `Usage: bat-terminal.mjs [options] <command> [args...]

Open a new BAT terminal and run <command> in it.

Options:
  --cwd <path>           Working directory for the new terminal
  --notify-id <id>       Target terminal ID for Worker→Tower notification binding
  --workspace <id>       Explicit workspace allocation target
  --mode <value>         CT mode for Worker (yolo|ask|off|on); injects CT_MODE env
  --interactive          Force interactive mode; injects CT_INTERACTIVE=1 env
  --no-interactive       Force non-interactive mode; injects CT_INTERACTIVE=0 env
  --help, -h             Show this help message
  --version              Show version

Examples:
  node scripts/bat-terminal.mjs claude "/ct-exec T0001"
  node scripts/bat-terminal.mjs --notify-id abc123 claude "/ct-exec T0001"
  node scripts/bat-terminal.mjs --cwd /tmp echo hello
  node scripts/bat-terminal.mjs --notify-id <id> --workspace <uuid> --mode yolo --interactive claude "/ct-exec T0001"
`

const KNOWN_FLAGS = ['--cwd', '--notify-id', '--workspace', '--mode', '--interactive', '--no-interactive', '--help', '-h', '--version']

function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function suggest(unknown, known) {
  let best = null, bestD = Infinity
  for (const k of known) {
    const d = levenshtein(unknown, k)
    if (d < bestD) { bestD = d; best = k }
  }
  return bestD <= 2 ? best : null
}

function printUsageError(msg) {
  console.error(`Error: ${msg}`)
  console.error('Usage: bat-terminal.mjs [options] <command> [args...]')
  console.error("Run with --help for details.")
}

// Fast-path help / version: scan args before any parsing, so these work even
// without BAT_REMOTE_PORT / BAT_REMOTE_TOKEN set.
for (const arg of process.argv.slice(2)) {
  if (arg === '--help' || arg === '-h') {
    process.stdout.write(HELP_TEXT)
    process.exit(0)
  }
  if (arg === '--version') {
    console.log(`bat-terminal.mjs v${VERSION}`)
    process.exit(0)
  }
}

// ── Argument parsing (state machine: flags first, then positionals) ──

const rawArgs = process.argv.slice(2)
let cwd = process.cwd()
let notifyId = null
let workspaceId = null
let mode = null
let interactive = null  // null = unspecified / true = --interactive / false = --no-interactive
const positional = []

let i = 0
while (i < rawArgs.length) {
  const arg = rawArgs[i]

  // Once we hit the first positional, everything after is part of the command
  // (even if it starts with `-`, e.g. `claude --dangerously-skip-permissions`).
  if (positional.length > 0) {
    positional.push(arg)
    i++
    continue
  }

  // `--` terminator: rest is positional
  if (arg === '--') {
    positional.push(...rawArgs.slice(i + 1))
    break
  }

  if (arg === '--cwd') {
    if (!rawArgs[i + 1]) { printUsageError('--cwd requires a path argument'); process.exit(1) }
    cwd = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--notify-id') {
    if (!rawArgs[i + 1]) { printUsageError('--notify-id requires a terminal ID argument'); process.exit(1) }
    notifyId = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--workspace') {
    if (!rawArgs[i + 1]) { printUsageError('--workspace requires a workspace ID argument'); process.exit(1) }
    workspaceId = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--mode') {
    if (!rawArgs[i + 1]) { printUsageError('--mode requires a value argument (yolo|ask|off|on)'); process.exit(1) }
    const value = rawArgs[i + 1]
    if (!/^(yolo|ask|off|on)$/.test(value)) {
      console.error(`Error: Invalid --mode value: '${value}' (expected one of: yolo, ask, off, on)`)
      process.exit(1)
    }
    mode = value
    i += 2
    continue
  }

  if (arg === '--interactive') {
    interactive = true
    i += 1
    continue
  }

  if (arg === '--no-interactive') {
    interactive = false
    i += 1
    continue
  }

  // If it starts with `-` at this point, it's an unknown option (help/version
  // already handled in the fast-path above).
  if (arg.startsWith('-')) {
    const hint = suggest(arg, KNOWN_FLAGS)
    printUsageError(`Unknown option '${arg}'${hint ? ` (did you mean '${hint}'?)` : ''}`)
    process.exit(1)
  }

  // First non-flag → start of command
  positional.push(arg)
  i++
}

if (positional.length === 0) {
  printUsageError('No command specified')
  process.exit(1)
}

// ── Environment (checked AFTER arg parsing so --help works outside BAT) ──

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

// Shell-quote arguments containing special characters so the command
// survives re-parsing by the shell inside the new PTY.
function shellQuote(s) {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(s)) return s
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

const command = positional.map(shellQuote).join(' ')
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
  const invokePayload = { id: terminalId, cwd, command }
  // T0133: Inject BAT_TOWER_TERMINAL_ID so Worker knows who to notify on completion
  if (notifyId) invokePayload.customEnv = { BAT_TOWER_TERMINAL_ID: notifyId }
  // T0137/BUG-031: Forward explicit workspace allocation target
  if (workspaceId) invokePayload.workspaceId = workspaceId
  // T0180/BUG-041 Phase 2.2: Inject CT_MODE / CT_INTERACTIVE env when explicitly specified.
  // Unset values are NOT injected (strict stateless — Worker falls back to workorder rules).
  if (mode) {
    invokePayload.customEnv = { ...invokePayload.customEnv, CT_MODE: mode }
  }
  if (interactive === true) {
    invokePayload.customEnv = { ...invokePayload.customEnv, CT_INTERACTIVE: '1' }
  }
  if (interactive === false) {
    invokePayload.customEnv = { ...invokePayload.customEnv, CT_INTERACTIVE: '0' }
  }

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

  console.log(`✓ Terminal created: ${command}`)
  ws.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
