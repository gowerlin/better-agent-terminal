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
//
//   # Pre-fill AND ask the renderer/xterm layer to press Enter:
//   node scripts/bat-notify.mjs --submit-keypress "T0133 完成"
//   # (experimental Codex-friendly path; mutually exclusive with --submit)
//
// Options:
//   --help, -h     Show help
//   --version      Show version

import { connect as tlsConnect } from 'tls'
import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { logEvent, snapshotBatEnv } from './_bat-logger.mjs'
import { loadTrustedFingerprint } from './_bat-cert.mjs'

// T0192: Log entry point before parsing, so every invocation is recorded even
// when args are malformed. Paired with bat-terminal.mjs's same event for
// end-to-end chain tracing (terminal dispatch → worker → notify).
logEvent('bat-notify', 'invoke', {
  argv: process.argv.slice(2),
  env: snapshotBatEnv(),
})

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
// paths by prepending the Git install directory. Detect and restore. No-op on
// non-Windows and for arguments that don't match the pollution pattern.
if (process.platform === 'win32') {
  const MSYS_GIT_PREFIX_RE = /^[A-Za-z]:[\/\\](Program Files[\/\\]Git|msys64|git)[\/\\](.*)$/
  process.argv = process.argv.map((arg) => {
    const m = arg.match(MSYS_GIT_PREFIX_RE)
    return m ? '/' + m[2].replace(/\\/g, '/') : arg
  })
}

// ── Help / version (handled before env check so they work universally) ──

const HELP_TEXT = `Usage: bat-notify.mjs [options] <message>

Notify another BAT terminal with a message (UI toast + PTY pre-fill).

Options:
  --target <id>      Target terminal ID (default: $BAT_TOWER_TERMINAL_ID)
  --source <label>   Source label shown in UI toast (default: $BAT_TERMINAL_ID)
  --no-pty-write     Skip PTY pre-fill (UI notification only)
  --submit           Pre-fill PTY and append \\r to auto-submit (mutually
                     exclusive with --no-pty-write)
  --submit-keypress  Pre-fill PTY, then send Enter through the renderer/xterm
                     keypress path (experimental; mutually exclusive with
                     --submit and --no-pty-write)
  --help, -h         Show this help message
  --version          Show version

Examples:
  node scripts/bat-notify.mjs "T0133 完成"
  node scripts/bat-notify.mjs --target abc123 --source T0133 "T0133 完成"
  node scripts/bat-notify.mjs --submit "T0133 完成"
  node scripts/bat-notify.mjs --submit-keypress "T0133 完成"
`

const KNOWN_FLAGS = [
  '--target', '--source', '--no-pty-write', '--submit', '--submit-keypress',
  '--help', '-h', '--version',
]

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
  console.error('Usage: bat-notify.mjs [options] <message>')
  console.error("Run with --help for details.")
}

// Fast-path help / version (works even without BAT env vars).
for (const arg of process.argv.slice(2)) {
  if (arg === '--help' || arg === '-h') {
    process.stdout.write(HELP_TEXT)
    process.exit(0)
  }
  if (arg === '--version') {
    console.log(`bat-notify.mjs v${VERSION}`)
    process.exit(0)
  }
}

// ── Argument parsing (state machine: flags first, then message) ──

const rawArgs = process.argv.slice(2)
let target = process.env.BAT_TOWER_TERMINAL_ID || null
let source = process.env.BAT_TERMINAL_ID || null
let ptyWrite = true
let submit = false
let submitKeypress = false
const messageParts = []

let i = 0
while (i < rawArgs.length) {
  const arg = rawArgs[i]

  // Once first positional seen, rest are message parts (preserves user intent
  // if message itself contains `--foo`-looking tokens).
  if (messageParts.length > 0) {
    messageParts.push(arg)
    i++
    continue
  }

  // `--` terminator: everything after is message
  if (arg === '--') {
    messageParts.push(...rawArgs.slice(i + 1))
    break
  }

  if (arg === '--target') {
    if (!rawArgs[i + 1]) { printUsageError('--target requires a terminal ID argument'); process.exit(1) }
    target = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--source') {
    if (!rawArgs[i + 1]) { printUsageError('--source requires a label argument'); process.exit(1) }
    source = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--no-pty-write') { ptyWrite = false; i++; continue }
  if (arg === '--submit')       { submit = true;   i++; continue }
  if (arg === '--submit-keypress') { submitKeypress = true; i++; continue }

  // Unknown flag (help/version already consumed by fast-path)
  if (arg.startsWith('-')) {
    const hint = suggest(arg, KNOWN_FLAGS)
    printUsageError(`Unknown option '${arg}'${hint ? ` (did you mean '${hint}'?)` : ''}`)
    process.exit(1)
  }

  // First non-flag → start of message
  messageParts.push(arg)
  i++
}

// Mutual exclusion: submit modes require the PTY pre-fill path
if ((submit || submitKeypress) && !ptyWrite) {
  printUsageError('--submit/--submit-keypress and --no-pty-write are mutually exclusive')
  logEvent('bat-notify', 'exit', { code: 1, reason: 'submit-vs-no-pty-write' })
  process.exit(1)
}

if (submit && submitKeypress) {
  printUsageError('--submit and --submit-keypress are mutually exclusive')
  logEvent('bat-notify', 'exit', { code: 1, reason: 'submit-vs-submit-keypress' })
  process.exit(1)
}

if (!target) {
  printUsageError('No target terminal ID (set BAT_TOWER_TERMINAL_ID or use --target)')
  logEvent('bat-notify', 'exit', { code: 1, reason: 'no-target' })
  process.exit(1)
}

const message = messageParts.join(' ').trim()
if (!message) {
  printUsageError('Message is required')
  logEvent('bat-notify', 'exit', { code: 1, reason: 'no-message' })
  process.exit(1)
}

// T0192: Record the resolved notification target and submit mode. For
// BUG-043 diagnostics this pins down whether the notify-id env propagated
// correctly from the spawning bat-terminal.mjs call.
logEvent('bat-notify', 'parsed', {
  target,
  source,
  ptyWrite,
  submit,
  submitKeypress,
  messageLength: message.length,
  // Preview keeps the leading portion of the message in clear text — these
  // are CT status strings like "T0192 完成", not secrets.
  messagePreview: message.slice(0, 80),
})

// ── Environment (checked AFTER arg parsing so --help works outside BAT) ──

const PORT = process.env.BAT_REMOTE_PORT
const TOKEN = process.env.BAT_REMOTE_TOKEN

if (!PORT) {
  console.error('Error: Not running inside BAT terminal (BAT_REMOTE_PORT not set)')
  logEvent('bat-notify', 'exit', { code: 1, reason: 'no-BAT_REMOTE_PORT' })
  process.exit(1)
}
if (!TOKEN) {
  console.error('Error: BAT_REMOTE_TOKEN not set')
  logEvent('bat-notify', 'exit', { code: 1, reason: 'no-BAT_REMOTE_TOKEN' })
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

      // T0202b/BUG-046: Server is https.createServer + wss:// since PLAN-018 T0182.
      // Dispatcher must TLS-handshake before sending HTTP upgrade. Self-signed cert,
      // so chain validation is disabled; we pin the fingerprint instead (T0217/PLAN-022).
      // SNI (servername) may not be an IP literal per RFC 6066; only set when host
      // looks like a hostname.
      // T0205/BUG-049: Mirrored from bat-terminal.mjs (T0202a + T0202b); previously
      // bat-notify.mjs used plain net.createConnection which silent-hung against
      // the TLS server (FIN close without data, Promise never resolved).
      // T0217/PLAN-022 GP056 sibling fix: fingerprint pinning mirrored from
      // bat-terminal.mjs to keep both MinimalWS callers on the same trust path.
      const isIpLiteral = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')
      this.#socket = tlsConnect({
        host,
        port,
        rejectUnauthorized: false,
        ...(isIpLiteral ? {} : { servername: host }),
      })

      this.#socket.once('secureConnect', () => {
        // T0217/PLAN-022 Step 1+2: Verify peer cert against BAT app's
        // server-cert.json fingerprint (fail-close on read failure or mismatch).
        // Aborting before sending the HTTP upgrade ensures we never leak the
        // auth token to a server we don't trust.
        const trust = loadTrustedFingerprint()
        if (!trust.ok) {
          clearTimeout(timer)
          this.#socket.destroy()
          reject(new Error(
            `server-cert-unreadable: ${trust.error} ` +
            `(path: ${trust.certPath || 'unresolved'})`
          ))
          return
        }
        const peer = this.#socket.getPeerCertificate()
        const actual = peer?.fingerprint256
        if (!actual) {
          clearTimeout(timer)
          this.#socket.destroy()
          reject(new Error('server-cert-unreadable: peer certificate has no fingerprint256'))
          return
        }
        if (actual !== trust.fingerprint) {
          clearTimeout(timer)
          this.#socket.destroy()
          reject(new Error(
            `fingerprint-mismatch: expected ${trust.fingerprint}, actual ${actual}. ` +
            `Possible MITM or BAT app cert regenerated. ` +
            `Restart this terminal to pick up the new fingerprint.`
          ))
          return
        }

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
      // T0202a/BUG-046: If server performs a clean FIN during upgrade (TLS
      // handshake rejected, auth failed, brute-force ban, listener replacement),
      // net.Socket fires 'close' without 'error'. Without this reject, the
      // connect Promise stays pending forever → node silent-exits with code 0.
      // Promise reject after resolve/reject is a no-op, so this is safe even
      // when upgrade succeeds and close fires later during normal teardown.
      this.#socket.once('close', () => {
        clearTimeout(timer)
        if (!this.#upgraded) {
          reject(new Error('connection closed before upgrade (server rejected upgrade request; possible TLS/auth/listener mismatch)'))
        }
      })
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
    const msg = err?.message || String(err)
    // T0202a/BUG-046: distinguish "TCP up but upgrade rejected" from generic
    // connect failure (ECONNREFUSED etc.) so operators can tell protocol/auth
    // mismatch from server-down at a glance.
    // T0217/PLAN-022 Step 1+2 (sibling of bat-terminal.mjs): Distinguish
    // fingerprint-pinning rejections so operators can tell MITM/cert-regenerated
    // from a generic transport failure at a glance.
    let reason
    if (msg.startsWith('fingerprint-mismatch')) {
      reason = 'fingerprint-mismatch'
    } else if (msg.startsWith('server-cert-unreadable')) {
      reason = 'server-cert-unreadable'
    } else if (msg.startsWith('connection closed before upgrade')) {
      reason = 'connect-closed-before-upgrade'
    } else {
      reason = 'connect-failed'
    }
    const exitPayload = { code: 1, reason, error: msg }
    if (reason === 'connect-closed-before-upgrade') {
      exitPayload.hint = 'Server accepted TCP but rejected WS upgrade. Check BAT app is up-to-date or TLS/auth state.'
    } else if (reason === 'fingerprint-mismatch') {
      exitPayload.hint = 'Server cert fingerprint does not match BAT app server-cert.json. Restart terminal after BAT app upgrades cert, or investigate possible MITM.'
    } else if (reason === 'server-cert-unreadable') {
      exitPayload.hint = 'Cannot read BAT app server-cert.json. Ensure BAT app is running and has initialized its remote server.'
    }
    console.error(`Error: Cannot connect to BAT RemoteServer (port ${PORT}): ${msg}`)
    logEvent('bat-notify', 'exit', exitPayload)
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
    logEvent('bat-notify', 'exit', { code: 1, reason: 'auth-failed', error: authResp.error })
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
  logEvent('bat-notify', 'send', {
    channel: 'terminal:notify',
    result: notifyResp.error ? 'error' : 'ok',
    error: notifyResp.error ?? null,
  })

  // Step 2: PTY write (pre-fill text in target terminal).
  // With --submit, append \r to trigger PTY read (auto-submit).
  // With --submit-keypress, keep the PTY payload as text-only and ask the
  // renderer/xterm layer to synthesize an Enter keypress in Step 3.
  // If message already ends with \r or \n, do not double-submit.
  if (ptyWrite) {
    const writeId = makeId()
    const shouldSubmit = submit || submitKeypress
    const endsWithNewline = shouldSubmit && /[\r\n]$/.test(message)
    const appendCR = submit && !endsWithNewline
    const payload = appendCR ? message + '\r' : message
    ws.send(JSON.stringify({
      type: 'invoke',
      id: writeId,
      channel: 'pty:write',
      args: [target, payload],
    }))

    const writeResp = await waitForMessageById(ws, writeId)
    const writeResult = writeResp.result
    // [T0215-DEBUG-REMOVE] writeResp dump — 供 refork race 分析
    console.error(`[T0215-DEBUG-REMOVE] writeResp: ${JSON.stringify({
      hasError: !!writeResp.error,
      payload: writeResult,
      target,
    })}`)
    // T0215 (BUG-050 階段 1):嚴格 === false 避免舊 server undefined payload 誤觸發
    const failed = writeResp.error || (writeResult && writeResult.ok === false)
    if (failed) {
      const reason = writeResp.error || writeResult?.reason || 'unknown'
      console.error(`Error: PTY write failed: ${reason}`)
      logEvent('bat-notify', 'send', {
        channel: 'pty:write',
        result: 'error',
        reason,
        submit,
        submitKeypress,
        appendedCR: appendCR,
      })
      logEvent('bat-notify', 'exit', { code: 1, reason: `pty-write-${reason}` })
      ws.close()
      process.exit(1)
    }
    logEvent('bat-notify', 'send', {
      channel: 'pty:write',
      result: 'ok',
      submit,
      submitKeypress,
      appendedCR: appendCR,
      error: null,
    })

    // Step 3: Optional renderer/xterm keypress path for agents that treat a
    // raw PTY newline as multiline input. This asks the active BAT renderer to
    // feed Enter through xterm's user-input API instead of writing \r directly.
    if (submitKeypress && !endsWithNewline) {
      const keypressId = makeId()
      ws.send(JSON.stringify({
        type: 'invoke',
        id: keypressId,
        channel: 'terminal:keypress',
        args: [{
          targetId: target,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          source,
          reason: 'submit-keypress',
        }],
      }))

      const keypressResp = await waitForMessageById(ws, keypressId)
      const keypressResult = keypressResp.result
      const keypressFailed = keypressResp.error || (keypressResult && keypressResult.ok === false)
      if (keypressFailed) {
        const reason = keypressResp.error || keypressResult?.reason || 'unknown'
        console.error(`Error: terminal keypress failed: ${reason}`)
        logEvent('bat-notify', 'send', {
          channel: 'terminal:keypress',
          result: 'error',
          reason,
          submitKeypress,
        })
        logEvent('bat-notify', 'exit', { code: 1, reason: `terminal-keypress-${reason}` })
        ws.close()
        process.exit(1)
      }
      logEvent('bat-notify', 'send', {
        channel: 'terminal:keypress',
        result: 'ok',
        submitKeypress,
        error: null,
      })
    }
  }

  console.log(`✓ Notified ${target.slice(0, 8)}…: ${message}`)
  logEvent('bat-notify', 'exit', { code: 0 })
  ws.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  logEvent('bat-notify', 'exit', { code: 1, reason: 'unhandled', error: err.message })
  process.exit(1)
})
