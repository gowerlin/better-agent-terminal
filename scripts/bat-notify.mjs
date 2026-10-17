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
//   # (prefills text, then asks the renderer/xterm layer to press Enter)
//
//   # PLAN-048 / T0608: ask the Tower a question (JSON on stdin, never in argv), then notify it:
//   node scripts/bat-notify.mjs --ask --source T0608 --submit "T0608 提問" < question.json
//   # Wait for the answer (one line of JSON) / withdraw the question:
//   node scripts/bat-notify.mjs --wait-answer q-0123abcd-0123456789abcdef [--timeout-ms 45000]
//   node scripts/bat-notify.mjs --cancel-question q-0123abcd-0123456789abcdef
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

const SUBMIT_KEYPRESS_DELAY_MS = 250

// T0450 (T0445 #6): the server accepts printable text only in a helper's pty:write (C0
// controls incl. \r / \n / \t, DEL and C1 are refused). The pre-fill flattens each run of
// them into one space; the toast (terminal:notify) keeps the message as given.
const PTY_PREFILL_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]+/g

function toPtyPrefill(message) {
  return message.replace(PTY_PREFILL_CONTROL_CHARS, ' ').trim()
}

// PLAN-048 / T0608 (T0606「介面契約」C-5): the question is read from stdin only — argv is logged
// verbatim below (D155: question / answer text never lands on disk). stdin: UTF-8, at most 64 KiB.
const QUESTION_STDIN_MAX_BYTES = 65_536
const STDIN_READ_TIMEOUT_MS = 10_000
const QUESTION_ID_PATTERN = /^q-[0-9a-f]{8}-[0-9a-f]{16}$/
// the `question:ask` fields a stdin JSON may carry (others are dropped)
const ASK_KEYS = ['question', 'options', 'allowFreeText', 'detail', 'blocking', 'expiresInMs']
const EXPIRES_MIN_MAX = 120
// `question:wait` holds the reply up to 45 s (QUESTION_WAIT_MAX_MS) — wait a little longer than that
const QUESTION_WAIT_MAX_MS = 45_000
const QUESTION_WAIT_INVOKE_MARGIN_MS = 5_000
// exit codes (T0606 C-5); anything else is 1
const ASK_EXIT = { NOT_FOUND: 3, TOO_MANY_QUESTIONS: 10 }
const QUESTION_EXIT = { NOT_FOUND: 3, NOT_OWNER: 4 }

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
       bat-notify.mjs --ask [options] [--expires-min <1-120>] <message> < question.json
       bat-notify.mjs --wait-answer <question id> [--timeout-ms <0-45000>]
       bat-notify.mjs --cancel-question <question id>

Notify another BAT terminal with a message (UI toast + PTY pre-fill).
With --ask, first register a question for this Worker's Tower, then notify it.

Options:
  --target <id>      Target terminal ID (default: $BAT_TOWER_TERMINAL_ID)
  --source <label>   Source label shown in UI toast (default: $BAT_TERMINAL_ID)
  --no-pty-write     Skip PTY pre-fill (UI notification only)
  --submit           Pre-fill PTY, then send Enter through the renderer/xterm
                     keypress path (mutually exclusive with --no-pty-write)
  --help, -h         Show this help message
  --version          Show version

Ask the Tower (PLAN-048, Worker tabs only):
  --ask              Read the question from stdin (UTF-8 JSON, at most 64 KiB; never put it in the
                     command line, which is logged):
                       {"question": "…", "options": ["…", "…"], "allowFreeText": true,
                        "detail": "…", "blocking": true}
                     BAT keeps it in memory only and sends it to this Worker's Tower; then <message>
                     is sent as a normal notify (toast, pre-fill, --submit). If any notify step
                     fails, the question is cancelled again (exit 1). stdout:
                       "  question: <id>", "  expires: <ISO time>", "  notified: yes"
  --expires-min <n>  With --ask: the question expires after n minutes (1-120; BAT default 30)
  Exit codes: 0 asked and notified / 3 NOT_FOUND (the Tower tab is not running) /
              10 TOO_MANY_QUESTIONS / 1 usage error, bad stdin, connection failure, BAT too old
              (UNSUPPORTED), notify failed. stderr also prints "ask: <CODE>".

  --wait-answer <id> Wait (BAT side, at most 45 s) until the question is no longer pending; stdout's
                     last line is one line of JSON: questionId, status (pending / answered /
                     cancelled / expired / lost), changed, endReason, answer {choice, text},
                     answeredAt, waitedMs. changed=false + status pending = timed out: run it again.
                     lost = BAT restarted since the question was asked (it is gone).
  --timeout-ms <n>   With --wait-answer: wait at most n ms (0-45000; more is cut to 45000)
  --cancel-question <id>
                     Withdraw a question this Worker asked (an ended one keeps its status).
  Exit codes: 0 (any status, including pending and lost) / 3 NOT_FOUND / 4 NOT_OWNER / 1 usage
              error, connection failure, BAT too old (UNSUPPORTED). stderr also prints
              "wait-answer: <CODE>" / "cancel-question: <CODE>".
  A helper that does not know these options exits 1 with "Unknown option '--ask'" (no question).

Examples:
  node scripts/bat-notify.mjs "T0133 完成"
  node scripts/bat-notify.mjs --target abc123 --source T0133 "T0133 完成"
  node scripts/bat-notify.mjs --submit "T0133 完成"
  node scripts/bat-notify.mjs --ask --source T0608 --submit --expires-min 30 "T0608 提問" < question.json
  node scripts/bat-notify.mjs --wait-answer q-0123abcd-0123456789abcdef
`

const KNOWN_FLAGS = [
  '--target', '--source', '--no-pty-write', '--submit',
  '--ask', '--expires-min', '--wait-answer', '--timeout-ms', '--cancel-question',
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
const messageParts = []
// PLAN-048 / T0608: question modes (flags given, for the "cannot be combined" checks)
let ask = false
let expiresMin = null
let waitAnswer = null
let timeoutMs = null
let cancelQuestion = null
const notifyFlags = []

function questionUsage(tag, msg, reason) {
  printUsageError(msg)
  console.error(`${tag}: USAGE`)
  logEvent('bat-notify', 'exit', { code: 1, reason })
  process.exit(1)
}

/** `--wait-answer` / `--cancel-question` value: a question id (T0606 C-1). */
function questionIdArg(flag, tag, value) {
  if (!value) questionUsage(tag, `${flag} requires a question id argument`, `${tag}-without-id`)
  if (!QUESTION_ID_PATTERN.test(value)) {
    questionUsage(tag, `Invalid ${flag} value: '${value}' (expected a question id such as q-0123abcd-0123456789abcdef)`, `${tag}-invalid-id`)
  }
  return value
}

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
    notifyFlags.push(arg)
    if (!rawArgs[i + 1]) { printUsageError('--target requires a terminal ID argument'); process.exit(1) }
    target = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--source') {
    notifyFlags.push(arg)
    if (!rawArgs[i + 1]) { printUsageError('--source requires a label argument'); process.exit(1) }
    source = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--no-pty-write') { notifyFlags.push(arg); ptyWrite = false; i++; continue }
  if (arg === '--submit')       { notifyFlags.push(arg); submit = true;   i++; continue }

  // PLAN-048 / T0608 (T0606 C-5)
  if (arg === '--ask') { ask = true; i++; continue }

  if (arg === '--expires-min') {
    const value = rawArgs[i + 1]
    if (!value) questionUsage('ask', '--expires-min requires a number of minutes (1-120)', 'expires-min-without-value')
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > EXPIRES_MIN_MAX) {
      questionUsage('ask', `Invalid --expires-min value: '${value}' (expected minutes, 1-${EXPIRES_MIN_MAX})`, 'invalid-expires-min')
    }
    expiresMin = Number(value)
    i += 2
    continue
  }

  if (arg === '--wait-answer') {
    waitAnswer = questionIdArg(arg, 'wait-answer', rawArgs[i + 1])
    i += 2
    continue
  }

  if (arg === '--timeout-ms') {
    const value = rawArgs[i + 1]
    if (!value) questionUsage('wait-answer', '--timeout-ms requires a number of milliseconds', 'timeout-ms-without-value')
    if (!/^\d+$/.test(value)) {
      questionUsage('wait-answer', `Invalid --timeout-ms value: '${value}' (expected a non-negative integer, at most ${QUESTION_WAIT_MAX_MS})`, 'invalid-timeout-ms')
    }
    timeoutMs = Number(value)
    if (timeoutMs > QUESTION_WAIT_MAX_MS) {
      console.error(`[bat-notify] --timeout-ms ${value}: waiting at most ${QUESTION_WAIT_MAX_MS} ms.`)
      timeoutMs = QUESTION_WAIT_MAX_MS
    }
    i += 2
    continue
  }

  if (arg === '--cancel-question') {
    cancelQuestion = questionIdArg(arg, 'cancel-question', rawArgs[i + 1])
    i += 2
    continue
  }

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

// PLAN-048 / T0608: --wait-answer / --cancel-question only query; they notify nobody.
const questionMode = waitAnswer ? 'wait-answer' : cancelQuestion ? 'cancel-question' : null
// the `<mode>: <CODE>` diagnostic line on stderr (T0606 C-5)
const modeTag = questionMode ?? (ask ? 'ask' : null)
if (questionMode) {
  const flag = `--${questionMode}`
  const conflicting = [
    ...(waitAnswer && cancelQuestion ? ['--cancel-question'] : []),
    ...(ask ? ['--ask'] : []),
    ...(expiresMin !== null ? ['--expires-min'] : []),
    ...new Set(notifyFlags),
    ...(messageParts.length > 0 ? ['<message>'] : []),
  ]
  if (conflicting.length > 0) questionUsage(questionMode, `${flag} cannot be combined with ${conflicting.join(', ')}`, `${questionMode}-with-other-options`)
} else {
  if (expiresMin !== null && !ask) questionUsage('ask', '--expires-min is only valid with --ask', 'expires-min-without-ask')
  if (timeoutMs !== null) questionUsage('wait-answer', '--timeout-ms is only valid with --wait-answer', 'timeout-ms-without-wait-answer')
}

// Submit requires the PTY pre-fill path.
if (submit && !ptyWrite) {
  printUsageError('--submit and --no-pty-write are mutually exclusive')
  if (modeTag) console.error(`${modeTag}: USAGE`)
  logEvent('bat-notify', 'exit', { code: 1, reason: 'submit-vs-no-pty-write' })
  process.exit(1)
}

if (!target && !questionMode) {
  printUsageError('No target terminal ID (set BAT_TOWER_TERMINAL_ID or use --target)')
  if (modeTag) console.error(`${modeTag}: USAGE`)
  logEvent('bat-notify', 'exit', { code: 1, reason: 'no-target' })
  process.exit(1)
}

const message = messageParts.join(' ')
if (!questionMode && !/\S/u.test(message)) {
  printUsageError(ask ? 'Message is required (the notify text, e.g. "T#### 提問"; the question itself comes on stdin)' : 'Message is required')
  if (modeTag) console.error(`${modeTag}: USAGE`)
  logEvent('bat-notify', 'exit', { code: 1, reason: 'no-message' })
  process.exit(1)
}

// T0192: Record the resolved notification target and submit mode. For
// BUG-043 diagnostics this pins down whether the notify-id env propagated
// correctly from the spawning bat-terminal.mjs call.
logEvent('bat-notify', 'parsed', questionMode ? {
  // T0608: only the id and the wait; never question / answer text
  mode: questionMode,
  questionId: waitAnswer ?? cancelQuestion,
  ...(timeoutMs !== null ? { timeoutMs } : {}),
} : {
  target,
  source,
  ptyWrite,
  submit,
  messageLength: message.length,
  // Preview keeps the leading portion of the message in clear text — these
  // are CT status strings like "T0192 完成", not secrets. With --ask the question
  // itself is on stdin and never logged (T0608 / D155).
  messagePreview: message.slice(0, 80),
  ...(ask ? { ask, expiresMin } : {}),
})

// ── Environment (checked AFTER arg parsing so --help works outside BAT) ──

const PORT = process.env.BAT_REMOTE_PORT
const TOKEN = process.env.BAT_REMOTE_TOKEN

if (!PORT) {
  console.error('Error: Not running inside BAT terminal (BAT_REMOTE_PORT not set)')
  if (modeTag) console.error(`${modeTag}: NOT_IN_BAT`)
  logEvent('bat-notify', 'exit', { code: 1, reason: 'no-BAT_REMOTE_PORT' })
  process.exit(1)
}
if (!TOKEN) {
  console.error('Error: BAT_REMOTE_TOKEN not set')
  if (modeTag) console.error(`${modeTag}: NOT_IN_BAT`)
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
  // T0499: text frames drained before the first onMessage() handler is set, e.g. a banned
  // IP's `auth-result` that the server sends on connect, in the same chunk as the 101.
  #pending = []

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

  onMessage(fn) {
    this.#msgHandler = fn
    for (const raw of this.#pending.splice(0)) fn(raw)
  }
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

      if (opcode === 0x01) {
        if (this.#msgHandler) this.#msgHandler(payload.toString('utf-8'))
        else this.#pending.push(payload.toString('utf-8'))
      } else if (opcode === 0x08) {
        this.close()
        return
      }
    }
  }
}

// ── Helpers ──

// `acceptType` also accepts that frame type whatever its id: the server rejects a banned
// IP / auth timeout with `{ type: 'auth-result', id: '0', error }` (T0499, as T0497 did
// for bat-terminal.mjs). Broadcasts are `type: 'event'` and stay ignored.
function waitForMessageById(ws, expectedId, timeoutMs = 3000, acceptType = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Response timeout')), timeoutMs)
    ws.onMessage((raw) => {
      let frame
      try { frame = JSON.parse(raw) }
      catch { return } // Ignore non-JSON frames
      if (frame?.id !== expectedId && !(acceptType && frame?.type === acceptType)) return // Ignore unrelated frames
      clearTimeout(timer)
      resolve(frame)
    })
  })
}

function makeId() {
  return randomBytes(8).toString('hex')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── PLAN-048 / T0608: questions for the Tower (T0606「介面契約」C-3 / C-5) ──

/**
 * All of stdin as UTF-8 (at most QUESTION_STDIN_MAX_BYTES; a BOM is dropped). A terminal on
 * stdin (nothing redirected) reads as empty; stdin that never ends is an error, not a hang.
 */
function readStdin() {
  return new Promise((resolve) => {
    const stdin = process.stdin
    if (stdin.isTTY) { resolve({ ok: true, tty: true, bytes: 0, text: '' }); return }
    const chunks = []
    let bytes = 0
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      stdin.pause()
      resolve(result)
    }
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout', bytes }), STDIN_READ_TIMEOUT_MS)
    stdin.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > QUESTION_STDIN_MAX_BYTES) { finish({ ok: false, reason: 'too-large', bytes }); return }
      chunks.push(chunk)
    })
    stdin.on('end', () => {
      let text
      try {
        // fatal: bytes that are not UTF-8 are refused rather than turned into U+FFFD
        text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
      } catch {
        finish({ ok: false, reason: 'not-utf8', bytes })
        return
      }
      finish({ ok: true, tty: false, bytes, text })
    })
    stdin.on('error', () => finish({ ok: false, reason: 'error', bytes }))
  })
}

const STDIN_PROBLEM = {
  'too-large': `stdin is larger than ${QUESTION_STDIN_MAX_BYTES} bytes`,
  'not-utf8': 'stdin is not UTF-8 (on Windows PowerShell 5.1 use pwsh 7 or Git Bash)',
  timeout: `stdin did not end within ${STDIN_READ_TIMEOUT_MS / 1000} s (redirect it from a file or a heredoc)`,
  error: 'stdin could not be read',
}

/** An `invoke-error` text → `{ code, message }` (as scripts/bat-mcp.mjs classifyInvokeError). */
function classifyInvokeError(error) {
  const message = String(error ?? '')
  if (/^No handler for channel/.test(message) || message === 'Forbidden: channel-not-allowed') {
    return { code: 'UNSUPPORTED', message: 'this BAT does not support questions for the Tower (update BAT)' }
  }
  if (message.startsWith('Forbidden: ')) return { code: 'FORBIDDEN', message: message.slice('Forbidden: '.length) }
  return { code: 'ERROR', message }
}

/** One invoke → `{ ok: true, result }` or `{ ok: false, code, message?, result? }`; never throws. */
async function invokeChannel(ws, channel, args, timeoutMs) {
  const id = makeId()
  ws.send(JSON.stringify({ type: 'invoke', id, channel, args }))
  let resp
  try {
    resp = await waitForMessageById(ws, id, timeoutMs)
  } catch (err) {
    return { ok: false, code: 'TIMEOUT', message: `no reply from BAT within ${timeoutMs} ms (${err?.message || String(err)})` }
  }
  if (resp.error) return { ok: false, ...classifyInvokeError(resp.error) }
  const result = resp.result
  if (result && typeof result === 'object' && result.ok === true) return { ok: true, result }
  const code = result && typeof result === 'object' && typeof result.code === 'string' ? result.code : 'ERROR'
  return { ok: false, code, ...(typeof result?.message === 'string' ? { message: result.message } : {}), result }
}

function exitQuestionMode(ws, exitCode, reason) {
  logEvent('bat-notify', 'exit', exitCode === 0 ? { code: 0 } : { code: exitCode, reason })
  ws?.close()
  process.exit(exitCode)
}

function isoTime(value) {
  return typeof value === 'number' ? new Date(value).toISOString() : String(value ?? 'unknown')
}

/** stdin JSON → the `question:ask` request; exits 1 (`ask: INVALID_INPUT`) when it is not usable. */
async function readAskRequest() {
  const input = await readStdin()
  const fail = (msg, fields) => {
    // never the input itself (nor JSON.parse's message, which quotes it)
    console.error(`Error: ${msg}`)
    console.error('ask: INVALID_INPUT')
    logEvent('bat-notify', 'exit', { code: 1, reason: 'ask-invalid-input', ...fields })
    process.exit(1)
  }
  if (!input.ok) fail(STDIN_PROBLEM[input.reason], { stdin: input.reason, stdinBytes: input.bytes })
  if (!input.text.trim()) fail('the question must come as JSON on stdin (e.g. < question.json)', { stdin: input.tty ? 'tty' : 'empty', stdinBytes: input.bytes })
  let parsed
  try {
    parsed = JSON.parse(input.text)
  } catch {
    fail('stdin is not valid JSON', { stdin: 'not-json', stdinBytes: input.bytes })
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('stdin JSON must be an object', { stdin: 'not-object', stdinBytes: input.bytes })
  if (typeof parsed.question !== 'string' || !parsed.question.trim()) fail('"question" (a non-empty string) is required in the stdin JSON', { stdin: 'no-question', stdinBytes: input.bytes })
  const request = {}
  for (const key of ASK_KEYS) if (parsed[key] !== undefined) request[key] = parsed[key]
  if (expiresMin !== null) request.expiresInMs = expiresMin * 60_000
  return { request, stdinBytes: input.bytes }
}

/** `question:ask`; returns its reply, or exits (3 / 10 / 1, `ask: <CODE>`). Logs sizes only. */
async function runAsk(ws, { request, stdinBytes }) {
  const shape = {
    questionLength: request.question.length,
    optionsCount: Array.isArray(request.options) ? request.options.length : 0,
    detailLength: typeof request.detail === 'string' ? request.detail.length : 0,
    blocking: typeof request.blocking === 'boolean' ? request.blocking : null,
    expiresInMs: request.expiresInMs ?? null,
    stdinBytes,
  }
  const outcome = await invokeChannel(ws, 'question:ask', [request], 3000)
  if (outcome.ok && typeof outcome.result.questionId === 'string') {
    const r = outcome.result
    logEvent('bat-notify', 'question-ask', {
      result: 'ok',
      questionId: r.questionId,
      towerTerminalId: r.towerTerminalId ?? null,
      expiresAt: r.expiresAt ?? null,
      masked: r.masked ?? 0,
      ...shape,
    })
    return r
  }
  const code = outcome.ok ? 'ERROR' : outcome.code
  logEvent('bat-notify', 'question-ask', { result: code, ...shape })
  const detail = {
    NOT_FOUND: "this Worker's Tower tab is not running",
    TOO_MANY_QUESTIONS: 'this Worker (8) or its Tower (64) has too many pending questions',
    INVALID_ARGS: 'BAT refused the question (empty, too long, a control character, bad options or expiry)',
    UNSUPPORTED: 'this BAT does not support questions for the Tower (update BAT); no question was registered',
    FORBIDDEN: 'not allowed (only a Worker tab dispatched by a Tower can ask)',
    TIMEOUT: 'no reply from BAT',
  }[code] ?? (outcome.ok ? 'BAT answered without a question id' : 'the question was not registered')
  console.error(`Error: Question not asked (${code}): ${detail}${outcome.message ? ` — ${outcome.message}` : ''}`)
  console.error(`ask: ${code}`)
  return exitQuestionMode(ws, ASK_EXIT[code] ?? 1, `ask-${code}`)
}

/**
 * A notify step after `question:ask` failed: cancel the question (the Tower would not know about
 * it), then exit 1 with `ask: NOTIFY_FAILED`.
 */
async function failAfterAsk(ws, asked, step, reason) {
  console.error(`Error: ${step} failed: ${reason}`)
  const cancel = await invokeChannel(ws, 'question:cancel', [{ questionId: asked.questionId }], 3000)
  logEvent('bat-notify', 'question-cancel', { questionId: asked.questionId, after: 'notify-failed', step, result: cancel.ok ? 'ok' : cancel.code, status: cancel.ok ? cancel.result.status ?? null : null })
  if (cancel.ok) {
    console.error(`[bat-notify] The Tower was not notified; question ${asked.questionId} was cancelled.`)
  } else {
    console.error(`[bat-notify] The Tower was not notified, and question ${asked.questionId} could not be cancelled (${cancel.code}); it expires at ${isoTime(asked.expiresAt)}.`)
  }
  console.error('ask: NOTIFY_FAILED')
  return exitQuestionMode(ws, 1, 'ask-notify-failed')
}

/** `question:wait`: stdout's last line = the reply without `ok`, as one line of JSON. */
async function runWaitAnswer(ws) {
  const request = { questionId: waitAnswer, ...(timeoutMs !== null ? { timeoutMs } : {}) }
  const outcome = await invokeChannel(ws, 'question:wait', [request], (timeoutMs ?? QUESTION_WAIT_MAX_MS) + QUESTION_WAIT_INVOKE_MARGIN_MS)
  if (outcome.ok) {
    const { ok: _ok, ...data } = outcome.result
    console.log(JSON.stringify(data))
    const answer = data.answer && typeof data.answer === 'object' ? data.answer : null
    logEvent('bat-notify', 'question-wait', {
      questionId: waitAnswer,
      result: 'ok',
      status: data.status ?? null,
      changed: data.changed ?? null,
      endReason: data.endReason ?? null,
      waitedMs: data.waitedMs ?? null,
      // the answer's size only, never its text
      ...(answer ? { choice: answer.choice ?? null, answerLength: typeof answer.text === 'string' ? answer.text.length : 0 } : {}),
    })
    return exitQuestionMode(ws, 0)
  }
  logEvent('bat-notify', 'question-wait', { questionId: waitAnswer, result: outcome.code })
  const detail = {
    NOT_FOUND: `BAT does not know ${waitAnswer} (mistyped, or ended more than 10 min ago)`,
    NOT_OWNER: `${waitAnswer} is not a question of this tab (or of its Workers)`,
    TOO_MANY_WAITS: 'too many open waits of this tab',
    INVALID_ARGS: 'BAT rejected the request arguments',
    TIMEOUT: 'no reply from BAT (restarting? try again: a restarted BAT answers status lost)',
  }[outcome.code] ?? 'the question was not read'
  console.error(`Error: Answer not read (${outcome.code}): ${detail}${outcome.message ? ` — ${outcome.message}` : ''}`)
  console.error(`wait-answer: ${outcome.code}`)
  return exitQuestionMode(ws, QUESTION_EXIT[outcome.code] ?? 1, `wait-answer-${outcome.code}`)
}

/** `question:cancel` (a question that already ended keeps its status; exit 0 either way). */
async function runCancelQuestion(ws) {
  const outcome = await invokeChannel(ws, 'question:cancel', [{ questionId: cancelQuestion }], 3000)
  if (outcome.ok) {
    const status = outcome.result.status ?? 'cancelled'
    const endReason = outcome.result.endReason
    console.log(status === 'cancelled' && (!endReason || endReason === 'worker')
      ? `✓ Question cancelled: ${cancelQuestion}`
      : `✓ Question already ended: ${cancelQuestion}`)
    console.log(`  status: ${status}${endReason ? ` ${endReason}` : ''}`)
    logEvent('bat-notify', 'question-cancel', { questionId: cancelQuestion, result: 'ok', status, endReason: endReason ?? null })
    return exitQuestionMode(ws, 0)
  }
  const lost = outcome.code === 'NOT_FOUND' && outcome.result?.status === 'lost'
  const code = lost ? 'LOST' : outcome.code
  logEvent('bat-notify', 'question-cancel', { questionId: cancelQuestion, result: code })
  const detail = {
    LOST: `${cancelQuestion} belonged to a BAT that has restarted since (it is gone)`,
    NOT_FOUND: `BAT does not know ${cancelQuestion} (mistyped, or ended more than 10 min ago)`,
    NOT_OWNER: `${cancelQuestion} was not asked by this tab`,
    INVALID_ARGS: 'BAT rejected the request arguments',
    FORBIDDEN: 'not allowed (only the Worker that asked can cancel)',
  }[code] ?? 'the question was not cancelled'
  console.error(`Error: Question not cancelled (${code}): ${detail}${outcome.message ? ` — ${outcome.message}` : ''}`)
  console.error(`cancel-question: ${code}`)
  return exitQuestionMode(ws, QUESTION_EXIT[outcome.code] ?? 1, `cancel-question-${code}`)
}

// ── Main ──

async function main() {
  // PLAN-048 / T0608: the question comes on stdin — read and check it before connecting
  const askRequest = ask ? await readAskRequest() : null

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
    if (modeTag) console.error(`${modeTag}: CONNECT_FAILED`)
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

  let authResp
  try {
    authResp = await waitForMessageById(ws, authId, 3000, 'auth-result')
  } catch (err) {
    // T0608: the question modes print their `<mode>: <CODE>` line; plain notify is unchanged
    if (!modeTag) throw err
    console.error(`Error: Auth response timeout: ${err?.message || String(err)}`)
    console.error(`${modeTag}: AUTH_FAILED`)
    return exitQuestionMode(ws, 1, 'auth-timeout')
  }
  if (authResp.error) {
    console.error(`Error: Authentication failed: ${authResp.error}`)
    if (modeTag) console.error(`${modeTag}: AUTH_FAILED`)
    logEvent('bat-notify', 'exit', { code: 1, reason: 'auth-failed', error: authResp.error })
    ws.close()
    process.exit(1)
  }

  if (waitAnswer) return runWaitAnswer(ws)
  if (cancelQuestion) return runCancelQuestion(ws)
  // T0608 (T0606 C-5): register the question, then notify as usual; a failed notify step
  // cancels it again (no question the Tower does not know about)
  const asked = askRequest ? await runAsk(ws, askRequest) : null
  // with --ask a missing reply is a failed step (cancel), not an unhandled rejection
  const reply = (id) => asked
    ? waitForMessageById(ws, id).catch((err) => ({ error: `no reply (${err?.message || String(err)})` }))
    : waitForMessageById(ws, id)

  // Step 1: UI notification (toast + tab badge)
  const notifyId = makeId()
  ws.send(JSON.stringify({
    type: 'invoke',
    id: notifyId,
    channel: 'terminal:notify',
    args: [{ targetId: target, message, source }],
  }))

  const notifyResp = await reply(notifyId)
  if (notifyResp.error) {
    if (asked) {
      logEvent('bat-notify', 'send', { channel: 'terminal:notify', result: 'error', error: notifyResp.error })
      return failAfterAsk(ws, asked, 'UI notify', notifyResp.error)
    }
    console.error(`Warning: UI notify failed: ${notifyResp.error}`)
    // Continue to PTY write — not fatal
  }
  logEvent('bat-notify', 'send', {
    channel: 'terminal:notify',
    result: notifyResp.error ? 'error' : 'ok',
    error: notifyResp.error ?? null,
  })

  // Step 2: PTY write (pre-fill text in target terminal).
  // With --submit, keep the PTY payload as text-only and ask the renderer/xterm
  // layer to synthesize an Enter keypress in Step 3. Raw \r is not equivalent
  // for all terminal-driven agents because some treat it as a literal newline.
  // T0450: line breaks / other control characters are flattened to spaces (`toPtyPrefill`);
  // submit is always a separate keypress action.
  if (ptyWrite) {
    const writeId = makeId()
    const payloadHasLineBreak = /[\r\n]/.test(message)
    const payloadEndsWithLineBreak = /[\r\n]$/.test(message)
    const payload = toPtyPrefill(message)
    logEvent('bat-notify', 'submit-boundary', {
      target,
      submit,
      payloadLength: payload.length,
      payloadHasLineBreak,
      payloadEndsWithLineBreak,
      controlCharsFlattened: payload !== message,
      textChannel: 'pty:write',
      submitChannel: submit ? 'terminal:keypress' : null,
    })
    ws.send(JSON.stringify({
      type: 'invoke',
      id: writeId,
      channel: 'pty:write',
      args: [target, payload],
    }))

    const writeResp = await reply(writeId)
    const writeResult = writeResp.result
    // T0215 (BUG-050 階段 1):嚴格 === false 避免舊 server undefined payload 誤觸發
    const failed = writeResp.error || (writeResult && writeResult.ok === false)
    if (failed) {
      const reason = writeResp.error || writeResult?.reason || 'unknown'
      if (asked) {
        logEvent('bat-notify', 'send', { channel: 'pty:write', result: 'error', reason, submit })
        return failAfterAsk(ws, asked, 'PTY write', reason)
      }
      console.error(`Error: PTY write failed: ${reason}`)
      logEvent('bat-notify', 'send', {
        channel: 'pty:write',
        result: 'error',
        reason,
        submit,
      })
      logEvent('bat-notify', 'exit', { code: 1, reason: `pty-write-${reason}` })
      ws.close()
      process.exit(1)
    }
    logEvent('bat-notify', 'send', {
      channel: 'pty:write',
      result: 'ok',
      submit,
      payloadLength: payload.length,
      payloadHasLineBreak,
      payloadEndsWithLineBreak,
      error: null,
    })

    // Step 3: Optional renderer/xterm keypress path for agents that treat a
    // raw PTY newline as multiline input. This asks the active BAT renderer to
    // feed Enter through xterm's user-input API instead of writing \r directly.
    if (submit) {
      logEvent('bat-notify', 'submit-delay', {
        delayMs: SUBMIT_KEYPRESS_DELAY_MS,
        target,
        source,
      })
      await sleep(SUBMIT_KEYPRESS_DELAY_MS)

      const keypressId = makeId()
      logEvent('bat-notify', 'submit-action', {
        channel: 'terminal:keypress',
        traceId: keypressId,
        target,
        source,
        payloadLength: payload.length,
        payloadHasLineBreak,
        payloadEndsWithLineBreak,
      })
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
          reason: 'submit',
          traceId: keypressId,
        }],
      }))

      const keypressResp = await reply(keypressId)
      const keypressResult = keypressResp.result
      const keypressFailed = keypressResp.error || (keypressResult && keypressResult.ok === false)
      if (keypressFailed) {
        const reason = keypressResp.error || keypressResult?.reason || 'unknown'
        if (asked) {
          logEvent('bat-notify', 'send', { channel: 'terminal:keypress', result: 'error', reason, submit, traceId: keypressId })
          return failAfterAsk(ws, asked, 'terminal keypress', reason)
        }
        console.error(`Error: terminal keypress failed: ${reason}`)
        logEvent('bat-notify', 'send', {
          channel: 'terminal:keypress',
          result: 'error',
          reason,
          submit,
          traceId: keypressId,
        })
        logEvent('bat-notify', 'exit', { code: 1, reason: `terminal-keypress-${reason}` })
        ws.close()
        process.exit(1)
      }
      logEvent('bat-notify', 'send', {
        channel: 'terminal:keypress',
        result: 'ok',
        submit,
        traceId: keypressId,
        error: null,
      })
    }
  }

  console.log(`✓ Notified ${target.slice(0, 8)}…: ${message}`)
  // T0608 (T0606 C-5): the question's result lines (id and expiry only, never its text)
  if (asked) {
    console.log(`  question: ${asked.questionId}`)
    console.log(`  expires: ${isoTime(asked.expiresAt)}`)
    console.log('  notified: yes')
  }
  logEvent('bat-notify', 'exit', { code: 0 })
  ws.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  logEvent('bat-notify', 'exit', { code: 1, reason: 'unhandled', error: err.message })
  process.exit(1)
})
