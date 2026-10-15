#!/usr/bin/env node
// scripts/bat-terminal.mjs
// BAT internal terminal creation via WebSocket RemoteServer
// Zero external dependencies — Node.js 18+ built-in modules only
//
// Usage:
//   node scripts/bat-terminal.mjs --prompt "/ct-exec T0131"
//   node scripts/bat-terminal.mjs --skill ct-exec --workorder T0131
//   node scripts/bat-terminal.mjs --agent codex-cli --prompt "/ct-exec T0131"
//   node scripts/bat-terminal.mjs echo hello
//   node scripts/bat-terminal.mjs --cwd /tmp echo hello
//   node scripts/bat-terminal.mjs --notify-id <tower-id> --prompt "/ct-exec T0133"
//     └─ Injects BAT_TOWER_TERMINAL_ID=<tower-id> into the new PTY's env,
//        allowing Worker to notify Tower on completion via bat-notify.mjs.
//   node scripts/bat-terminal.mjs --workspace <workspace-id> --prompt "/ct-exec T0137"
//     └─ Explicitly allocate the new PTY to the given workspace tab list.
//        Omitted → PTY lands in the currently active workspace (T0137/BUG-031).
//        T0523/BUG-129: when BAT knows the --notify-id terminal, its workspace wins
//        (the Tower shell's BAT_WORKSPACE_ID can be stale); --workspace is the fallback.
//   node scripts/bat-terminal.mjs --close-worker T0535 --notify-id "$BAT_TERMINAL_ID" [--delay-ms 10000]
//     └─ PLAN-041 / T0535: close the Worker tab this Tower dispatched for T0535 (no tab is
//        created). Exit 0 scheduled / 3 NOT_FOUND / 4 NOT_OWNER / 5 AMBIGUOUS / 6 BUSY / 1 other.
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

// T0192: Log the entry point before any parsing, so even fast-path help/version
// invocations show up in diagnostics. argv is recorded verbatim (contains no
// secrets; BAT_REMOTE_TOKEN is in env not argv).
logEvent('bat-terminal', 'invoke', {
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
       bat-terminal.mjs [options] --prompt <text>
       bat-terminal.mjs [options] --skill <name> --workorder <T####>
       bat-terminal.mjs --close-worker <T####> --notify-id <id> [--delay-ms <n>]

Open a new BAT terminal and run either a raw command or the selected/default agent with a prompt.
With --close-worker, close the Worker tab a Tower dispatched instead (no terminal is created).

Options:
  --cwd <path>           Working directory for the new terminal
  --notify-id <id>       Target terminal ID for Worker→Tower notification binding
  --workspace <id>       Explicit workspace allocation target (the --notify-id
                         terminal's own workspace wins when BAT knows it)
  --agent <id|default>   Agent definition for --prompt mode (default: default);
                         shorthands such as codex / claude map to codex-cli / claude-cli
  --prompt <text>        Start the selected/default agent with this prompt
  --skill <name>         Agent-neutral Control Tower skill name (ct-exec|ct-done)
  --workorder <T####>    Work order ID for --skill mode (optional [A-Z]{2,4}- prefix, e.g. CP-T0113)
  --mode <value>         CT mode for Worker (yolo|ask|off|on); injects CT_MODE env
  --interactive          Force interactive mode; injects CT_INTERACTIVE=1 env
  --no-interactive       Force non-interactive mode; injects CT_INTERACTIVE=0 env
  --help, -h             Show this help message
  --version              Show version

Close a Worker tab (PLAN-041):
  --close-worker <T####> Close the Worker tab the --notify-id Tower dispatched for this work
                         order (same ID format as --workorder). BAT checks that the tab is
                         that Tower's Worker, that exactly one tab matches, and that it printed
                         nothing in the last 5 s; it closes the tab like the tab's x button
                         (no confirm, worktree kept). Cannot be combined with the options above
                         that create a terminal (--cwd, --workspace, --agent, --prompt, --skill,
                         --workorder, --mode, --interactive, --no-interactive, <command>).
  --notify-id <id>       Required with --close-worker: the Tower's own terminal ID ($BAT_TERMINAL_ID)
  --delay-ms <n>         Close after n ms (default 0; BAT clamps to 0-300000). New output in the
                         tab or typing into it during the delay cancels the close.
  Exit codes: 0 scheduled (closed when --delay-ms 0) / 3 NOT_FOUND / 4 NOT_OWNER /
              5 AMBIGUOUS / 6 BUSY / 1 usage error, connection failure or BAT too old.
              stderr also prints "close-worker: <CODE>".

Examples:
  node scripts/bat-terminal.mjs --prompt "/ct-exec T0001"
  node scripts/bat-terminal.mjs --skill ct-exec --workorder T0001
  node scripts/bat-terminal.mjs --agent codex-cli --prompt "/ct-exec T0001"
  node scripts/bat-terminal.mjs echo hello
  node scripts/bat-terminal.mjs --notify-id abc123 --prompt "/ct-exec T0001"
  node scripts/bat-terminal.mjs --cwd /tmp echo hello
  node scripts/bat-terminal.mjs --notify-id <id> --workspace <uuid> --mode yolo --interactive --skill ct-exec --workorder T0001
  node scripts/bat-terminal.mjs --close-worker T0001 --notify-id "$BAT_TERMINAL_ID" --delay-ms 10000
`

// T0360/BUG-082: Work order ID grammar, shared across the whole dispatch chain.
// Optional 2-4 char uppercase prefix (CT / CP / KEENBEST-style cross-project and
// delegate work orders) followed by T + digits.
// ⚠️ Three sibling copies must stay in sync — there is no module path shared
// between this helper (.mjs), the main process and the renderer:
//   - electron/main.ts             buildControlTowerSkillPrompt()
//   - src/types/control-tower.ts   WORKORDER_ID_PREFIX / filenameToId / isWorkOrderFile
//   - src/utils/control-tower-launch.ts  buildControlTowerWorkOrderCommand()
const WORKORDER_ID_PATTERN = /^(?:[A-Z]{2,4}-)?T\d+$/

const KNOWN_FLAGS = ['--cwd', '--notify-id', '--workspace', '--agent', '--prompt', '--skill', '--workorder', '--mode', '--interactive', '--no-interactive', '--close-worker', '--delay-ms', '--help', '-h', '--version']

// PLAN-041 / T0535: `--close-worker` exit codes (contract shared with CT, PLAN-041「介面契約」).
const CLOSE_WORKER_EXIT = { NOT_FOUND: 3, NOT_OWNER: 4, AMBIGUOUS: 5, BUSY: 6 }

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
let agent = 'default'
let prompt = null
let skill = null
let workorder = null
let mode = null
let interactive = null  // null = unspecified / true = --interactive / false = --no-interactive
const positional = []
// PLAN-041 / T0535: close-worker mode, and the terminal-creating flags given (they exclude it)
let closeWorker = null
let delayMs = null
const createFlags = []

let i = 0
while (i < rawArgs.length) {
  const arg = rawArgs[i]

  // Once we hit the first positional, everything after is part of the command
  // (even if it starts with `-`, e.g. `codex --full-auto`).
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
    createFlags.push(arg)
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
    createFlags.push(arg)
    if (!rawArgs[i + 1]) { printUsageError('--workspace requires a workspace ID argument'); process.exit(1) }
    workspaceId = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--agent') {
    createFlags.push(arg)
    if (!rawArgs[i + 1]) { printUsageError('--agent requires an agent id argument'); process.exit(1) }
    agent = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--prompt') {
    createFlags.push(arg)
    if (!rawArgs[i + 1]) { printUsageError('--prompt requires a prompt argument'); process.exit(1) }
    prompt = rawArgs[i + 1]
    i += 2
    continue
  }

  if (arg === '--skill') {
    createFlags.push(arg)
    if (!rawArgs[i + 1]) { printUsageError('--skill requires a skill name argument'); process.exit(1) }
    const value = rawArgs[i + 1]
    if (!/^(ct-exec|ct-done)$/.test(value)) {
      console.error(`Error: Invalid --skill value: '${value}' (expected one of: ct-exec, ct-done)`)
      process.exit(1)
    }
    skill = value
    i += 2
    continue
  }

  if (arg === '--workorder') {
    createFlags.push(arg)
    if (!rawArgs[i + 1]) { printUsageError('--workorder requires a work order ID argument'); process.exit(1) }
    const value = rawArgs[i + 1]
    if (!WORKORDER_ID_PATTERN.test(value)) {
      console.error(`Error: Invalid --workorder value: '${value}' (expected T followed by digits, with an optional 2-4 char uppercase prefix, e.g. T0001 or CP-T0113)`)
      process.exit(1)
    }
    workorder = value
    i += 2
    continue
  }

  if (arg === '--mode') {
    createFlags.push(arg)
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
    createFlags.push(arg)
    interactive = true
    i += 1
    continue
  }

  if (arg === '--no-interactive') {
    createFlags.push(arg)
    interactive = false
    i += 1
    continue
  }

  if (arg === '--close-worker') {
    if (!rawArgs[i + 1]) { printUsageError('--close-worker requires a work order ID argument'); process.exit(1) }
    const value = rawArgs[i + 1].trim().toUpperCase()
    if (!WORKORDER_ID_PATTERN.test(value)) {
      console.error(`Error: Invalid --close-worker value: '${rawArgs[i + 1]}' (expected T followed by digits, with an optional 2-4 char uppercase prefix, e.g. T0001 or CP-T0113)`)
      console.error('close-worker: USAGE')
      process.exit(1)
    }
    closeWorker = value
    i += 2
    continue
  }

  if (arg === '--delay-ms') {
    const value = rawArgs[i + 1]
    if (!value) { printUsageError('--delay-ms requires a number of milliseconds'); process.exit(1) }
    if (!/^\d+$/.test(value)) {
      console.error(`Error: Invalid --delay-ms value: '${value}' (expected a non-negative integer, e.g. 10000)`)
      console.error('close-worker: USAGE')
      process.exit(1)
    }
    delayMs = Number(value)
    i += 2
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

// PLAN-041 / T0535: --close-worker closes a Worker tab; it never creates one.
if (closeWorker || delayMs !== null) {
  const closeUsage = (msg, reason) => {
    printUsageError(msg)
    console.error('close-worker: USAGE')
    logEvent('bat-terminal', 'exit', { code: 1, reason })
    process.exit(1)
  }
  if (!closeWorker) closeUsage('--delay-ms is only valid with --close-worker', 'delay-without-close-worker')
  if (createFlags.length > 0 || positional.length > 0) {
    const given = [...new Set(createFlags), ...(positional.length > 0 ? ['<command>'] : [])].join(', ')
    closeUsage(`--close-worker cannot be combined with options that create a terminal (${given})`, 'close-worker-with-create-options')
  }
  if (!notifyId) closeUsage('--close-worker requires --notify-id <the Tower terminal ID>', 'close-worker-without-notify-id')
}

const hasSkillMode = Boolean(skill || workorder)
if (hasSkillMode && !(skill && workorder)) {
  printUsageError('Use --skill and --workorder together')
  logEvent('bat-terminal', 'exit', { code: 1, reason: 'incomplete-skill-mode' })
  process.exit(1)
}

if ((prompt || hasSkillMode) && positional.length > 0) {
  printUsageError('Use either agent mode (--prompt or --skill/--workorder) or positional <command> [args...], not both')
  logEvent('bat-terminal', 'exit', { code: 1, reason: 'prompt-and-command' })
  process.exit(1)
}

if (prompt && hasSkillMode) {
  printUsageError('Use either --prompt or --skill/--workorder, not both')
  logEvent('bat-terminal', 'exit', { code: 1, reason: 'prompt-and-skill' })
  process.exit(1)
}

if (!closeWorker && !prompt && !hasSkillMode && positional.length === 0) {
  printUsageError('No command specified')
  logEvent('bat-terminal', 'exit', { code: 1, reason: 'no-command' })
  process.exit(1)
}

// T0192: Record parsed flags so diagnostics can distinguish "flag missing" vs
// "flag parsed but not propagated" when reconstructing a broken yolo chain.
logEvent('bat-terminal', 'parsed', {
  cwd,
  notifyId,
  workspaceId,
  agent,
  promptLength: prompt ? prompt.length : 0,
  skill,
  workorder,
  mode,
  interactive,
  cmd: positional[0] ?? null,
  cmdArgs: positional.slice(1),
  ...(closeWorker ? { closeWorker, delayMs } : {}),
})

// ── Environment (checked AFTER arg parsing so --help works outside BAT) ──

const PORT = process.env.BAT_REMOTE_PORT
const TOKEN = process.env.BAT_REMOTE_TOKEN

if (!PORT) {
  console.error('Error: Not running inside BAT terminal (BAT_REMOTE_PORT not set)')
  if (closeWorker) console.error('close-worker: NOT_IN_BAT')
  logEvent('bat-terminal', 'exit', { code: 1, reason: 'no-BAT_REMOTE_PORT' })
  process.exit(1)
}
if (!TOKEN) {
  console.error('Error: BAT_REMOTE_TOKEN not set')
  if (closeWorker) console.error('close-worker: NOT_IN_BAT')
  logEvent('bat-terminal', 'exit', { code: 1, reason: 'no-BAT_REMOTE_TOKEN' })
  process.exit(1)
}

// T0360 (ADVISORY B-2): Advisory only — behaviour is unchanged. Callers that
// dispatch on behalf of a specific project frequently do not know this flag
// exists, and silently land the PTY in whatever workspace happens to be active.
if (!workspaceId && !closeWorker) {
  console.error('[bat-terminal] --workspace not specified; PTY will land in the currently ACTIVE workspace.')
  console.error('               Callers dispatching for a specific project should pass')
  console.error('               --workspace "$BAT_WORKSPACE_ID".')
}

// Shell-quote arguments containing special characters so the command
// survives re-parsing by the shell inside the new PTY.
function shellQuote(s) {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(s)) return s
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

const command = positional.length > 0 ? positional.map(shellQuote).join(' ') : null
const terminalId = randomBytes(16).toString('hex')

// ── Minimal WebSocket client (raw net + HTTP upgrade) ──
// Implements just enough of RFC 6455 for our auth→invoke→close flow.

class MinimalWS {
  #socket = null
  #buffer = Buffer.alloc(0)
  #upgraded = false
  #msgHandler = null
  #errHandler = null
  // T0501 (as T0499 did for bat-notify.mjs): text frames drained before the first
  // onMessage() handler is set, e.g. a banned IP's `auth-result` that the server sends
  // on connect, in the same chunk as the 101. Empty in the normal flow.
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

  onMessage(fn) {
    this.#msgHandler = fn
    for (const raw of this.#pending.splice(0)) fn(raw)
  }
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

      if (opcode === 0x01) {
        if (this.#msgHandler) this.#msgHandler(payload.toString('utf-8'))
        else this.#pending.push(payload.toString('utf-8'))
      } else if (opcode === 0x08) {
        this.close()
        return
      }
      // Ignore ping/pong/continuation for this simple use-case
    }
  }
}

// ── Helpers ──

// T0497/BUG-114: A local BAT PTY authenticates with the full server token, so this
// connection is an ordinary client and receives every PROXIED_EVENTS broadcast
// (`{ type: 'event', id: '0' }`, including each PTY's pty:output). Taking the next
// arbitrary frame as the reply let a broadcast pass for `✓ Terminal created`, and the
// helper then exited before the server had read the invoke (T0490). Only a frame
// carrying the id we sent is the reply (template: bat-notify.mjs waitForMessageById).
// `acceptType` also accepts that frame type whatever its id: the server rejects a
// banned IP / auth timeout with `{ type: 'auth-result', id: '0', error }`.
let ignoredFrames = 0

function waitForMessage(ws, expectedId, timeoutMs = 3000, acceptType = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Response timeout')), timeoutMs)
    ws.onMessage((raw) => {
      let frame
      try { frame = JSON.parse(raw) }
      catch { ignoredFrames++; return } // Ignore non-JSON frames
      if (frame?.id !== expectedId && !(acceptType && frame?.type === acceptType)) {
        ignoredFrames++ // Ignore unrelated frames (broadcasts)
        return
      }
      clearTimeout(timer)
      resolve(frame)
    })
  })
}

function makeId() {
  return randomBytes(8).toString('hex')
}

const AGENT_SOURCE_TEXT = {
  explicit: 'from --agent',
  workspace: "the workspace's default agent",
  settings: 'Settings default agent',
  builtin: 'built-in default',
}

function describeNamed(ws) {
  return ws.name ? `"${ws.name}" (${ws.id})` : String(ws.id)
}

/**
 * T0523/BUG-129: the lines printed after `✓ Terminal created` from a T0523+ BAT's
 * `{ ok: true, workspace, agent }` answer (a bare `true` from older BAT prints nothing extra).
 * Informational only: success is still decided by the exit code.
 */
function describeLanding(result) {
  const out = { lines: [], warnings: [], workspace: null, agent: null }
  if (!result || typeof result !== 'object') return out
  const ws = result.workspace && typeof result.workspace === 'object' ? result.workspace : null
  if (ws) {
    out.workspace = ws
    const label = ws.id ? (ws.name ? `${ws.name} (${ws.id})` : ws.id) : 'the active workspace of the BAT window'
    const how = ws.source === 'tower-terminal'
      ? "the Tower terminal's workspace (--notify-id)"
      : ws.source === 'requested' ? 'from --workspace' : 'no --notify-id match, no --workspace'
    out.lines.push(`  workspace: ${label} — ${how}`)
    if (ws.mismatch) {
      out.warnings.push(`[bat-terminal] --workspace ${ws.requestedId} is not the Tower terminal's workspace; the terminal went to the Tower's workspace.`)
      out.warnings.push("               The Tower shell's BAT_WORKSPACE_ID is stale (see BUG-129).")
    }
    // BUG-132: the cwd is not under the landing workspace's folder (created anyway).
    const check = ws.cwdCheck && typeof ws.cwdCheck === 'object' ? ws.cwdCheck : null
    if (check) {
      out.warnings.push(`[bat-terminal] cwd ${check.cwd} is not under the landing workspace's folder ${check.folderPath}.`)
      if (check.status === 'other-workspace' && check.cwdWorkspace) {
        out.warnings.push(`               It belongs to workspace ${describeNamed(check.cwdWorkspace)}. The Tower shell's BAT_* may come`)
        out.warnings.push('               from another tab (see BUG-132); with --mode yolo this dispatch is refused.')
      } else {
        out.warnings.push('               It is under no workspace of this BAT (cross-project dispatch?).')
      }
    }
  }
  const agent = result.agent && typeof result.agent === 'object' ? result.agent : null
  if (agent) {
    out.agent = agent
    const source = AGENT_SOURCE_TEXT[agent.source] ?? agent.source ?? 'unknown'
    out.lines.push(`  agent: ${agent.id} (--agent ${agent.requested}: ${source})`)
  }
  return out
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
    // T0217/PLAN-022 Step 1+2: Distinguish fingerprint-pinning rejections from
    // pre-upgrade close so operators can tell MITM/cert-regenerated from a
    // generic transport failure at a glance.
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
    if (closeWorker) console.error('close-worker: CONNECT_FAILED')
    logEvent('bat-terminal', 'exit', exitPayload)
    process.exit(1)
  }

  // Auth
  const authId = makeId()
  ws.send(JSON.stringify({
    type: 'auth',
    id: authId,
    token: TOKEN,
    args: ['bat-terminal-cli'],
  }))

  // T0200/BUG-046: Defensive wrap — waitForMessage timeouts previously escaped
  // as rejections that main().catch() logged only as reason=unhandled, giving
  // no hint whether auth or invoke was the culprit. Explicit await-* + timeout
  // events let operators diagnose stale token vs. dead server from the log alone.
  logEvent('bat-terminal', 'await-auth-response', { timeoutMs: 3000 })
  let authResp
  try {
    authResp = await waitForMessage(ws, authId, 3000, 'auth-result')
  } catch (err) {
    const msg = err?.message || String(err)
    console.error(`Error: Auth response timeout: ${msg}`)
    console.error('Hint: BAT_REMOTE_TOKEN may be stale. Try restart this terminal or re-export token from BAT app.')
    if (closeWorker) console.error('close-worker: AUTH_FAILED')
    logEvent('bat-terminal', 'exit', {
      code: 1,
      reason: 'auth-timeout',
      error: msg,
      hint: 'BAT_REMOTE_TOKEN may be stale. Try restart this terminal or re-export token from BAT app.',
    })
    ws.close()
    process.exit(1)
  }
  if (authResp.error) {
    console.error(`Error: Authentication failed: ${authResp.error}`)
    if (closeWorker) console.error('close-worker: AUTH_FAILED')
    logEvent('bat-terminal', 'exit', { code: 1, reason: 'auth-failed', error: authResp.error })
    ws.close()
    process.exit(1)
  }

  if (closeWorker) return runCloseWorker(ws)

  const channel = prompt || hasSkillMode ? 'terminal:create-agent-command' : 'terminal:create-with-command'
  const invokePayload = prompt || hasSkillMode
    // BUG-075/T0341: BAT auto-session Workers may start Codex from Git Bash;
    // keep slash-command prompts from being rewritten by MSYS path conversion.
    ? { id: terminalId, cwd, agent, ...(prompt ? { prompt } : { skill, workorder }), customEnv: { MSYS_NO_PATHCONV: '1' } }
    : { id: terminalId, cwd, command }
  // T0133: Inject BAT_TOWER_TERMINAL_ID so Worker knows who to notify on completion
  if (notifyId) invokePayload.customEnv = { ...invokePayload.customEnv, BAT_TOWER_TERMINAL_ID: notifyId }
  // T0137/BUG-031: Forward explicit workspace allocation target
  if (workspaceId) invokePayload.workspaceId = workspaceId
  // T0523/BUG-129: ask for where the terminal landed and which agent it runs (BAT before
  // T0523 ignores this and answers `true`)
  invokePayload.reportLanding = true
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

  // T0192: The customEnv object is the terminus of the yolo propagation chain —
  // whatever ends up here is what the new Worker PTY will inherit. Logging it
  // verbatim lets BUG-043 re-reproduction compare expected vs actual env.
  logEvent('bat-terminal', 'invoke-create-with-command', {
    terminalId,
    cwd,
    workspaceId,
    channel,
    agent: prompt || hasSkillMode ? agent : null,
    promptLength: prompt ? prompt.length : 0,
    skill,
    workorder,
    command,
    customEnv: invokePayload.customEnv ?? null,
  })

  const invokeId = makeId()
  ws.send(JSON.stringify({
    type: 'invoke',
    id: invokeId,
    channel,
    args: [invokePayload],
  }))

  // T0200/BUG-046: See matching defensive wrap on auth await above.
  logEvent('bat-terminal', 'await-invoke-response', { timeoutMs: 3000 })
  let invokeResp
  try {
    invokeResp = await waitForMessage(ws, invokeId)
  } catch (err) {
    const msg = err?.message || String(err)
    const logPath = process.platform === 'win32'
      ? '%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log'
      : '~/Library/Application Support/BetterAgentTerminal/Logs/bat-scripts.log'
    const hint = `Invoke response not received in 3000ms. Check BAT app is running and log at ${logPath}`
    console.error(`Error: Invoke response timeout: ${msg}`)
    console.error(`Hint: ${hint}`)
    logEvent('bat-terminal', 'exit', {
      code: 1,
      reason: 'invoke-timeout',
      error: msg,
      hint,
      ignoredFrames,
    })
    ws.close()
    process.exit(1)
  }
  // T0497: which frame answered, and how many broadcasts went past while waiting.
  const responseDiag = { responseType: invokeResp.type, ignoredFrames }
  if (invokeResp.error) {
    console.error(`Error: Failed to create terminal: ${invokeResp.error}`)
    // T0527: a remote (headless) tower capability refuses an agent id the server's registry
    // does not know before the terminal handler sees it.
    if (String(invokeResp.error).includes('agent-not-allowed')) {
      console.error(`Hint: --agent '${agent}' is not an agent id this BAT server knows. Use a registry id such as claude-cli or codex-cli, or --agent default.`)
    }
    logEvent('bat-terminal', 'terminal-created', { result: 'error', error: invokeResp.error, ...responseDiag })
    logEvent('bat-terminal', 'exit', { code: 1, reason: 'terminal-create-failed' })
    ws.close()
    process.exit(1)
  }
  // T0433: a structured refusal ({ ok: false, code, error }) — headless bat-server answers
  // AGENT_UNAVAILABLE / AGENT_CHECK_PENDING for an agent it cannot run (e.g. codex not
  // installed on the remote machine). A local BAT answers a boolean, handled as before.
  const invokeResult = invokeResp.result
  if (invokeResult && typeof invokeResult === 'object' && invokeResult.ok === false) {
    const code = typeof invokeResult.code === 'string' ? invokeResult.code : 'refused'
    const detail = typeof invokeResult.error === 'string' ? invokeResult.error : 'terminal was not created'
    console.error(`Error: Failed to create terminal (${code}): ${detail}`)
    // BUG-132 (T0527): yolo dispatch from a cwd that belongs to another workspace.
    if (code === 'DISPATCH_CWD_OTHER_WORKSPACE' && invokeResult.cwdWorkspace && invokeResult.landingWorkspace) {
      console.error(`  cwd workspace:     ${describeNamed(invokeResult.cwdWorkspace)}`)
      console.error(`  landing workspace: ${describeNamed(invokeResult.landingWorkspace)}`)
    }
    logEvent('bat-terminal', 'terminal-created', {
      result: 'refused',
      code,
      agentId: invokeResult.agentId,
      tool: invokeResult.tool,
      status: invokeResult.status,
      ...(invokeResult.knownAgents ? { knownAgents: invokeResult.knownAgents } : {}),
      ...(invokeResult.cwdWorkspace ? { cwd: invokeResult.cwd, cwdWorkspace: invokeResult.cwdWorkspace, landingWorkspace: invokeResult.landingWorkspace } : {}),
      ...responseDiag,
    })
    logEvent('bat-terminal', 'exit', { code: 1, reason: 'terminal-create-refused', refusal: code })
    ws.close()
    process.exit(1)
  }
  // T0456: `false` = the server did not create the terminal (no PTY manager, invalid shell,
  // spawn failure, an agent / prompt it cannot build a command for). Tower auto-session
  // trusts the exit code only, so this must not exit 0 as "created".
  if (invokeResult === false) {
    console.error(`Error: Failed to create terminal: ${terminalId} was not created (server answered false — see the BAT app log)`)
    logEvent('bat-terminal', 'terminal-created', { result: 'false', terminalId, ...responseDiag })
    logEvent('bat-terminal', 'exit', { code: 1, reason: 'terminal-not-created' })
    ws.close()
    process.exit(1)
  }

  console.log(`✓ Terminal created: ${terminalId}`)
  const landing = describeLanding(invokeResult)
  for (const line of landing.lines) console.log(line)
  for (const line of landing.warnings) console.error(line)
  logEvent('bat-terminal', 'terminal-created', {
    result: 'ok',
    terminalId,
    ...(landing.workspace ? { landing: landing.workspace } : {}),
    ...(landing.agent ? { agent: landing.agent } : {}),
    ...responseDiag,
  })
  logEvent('bat-terminal', 'exit', { code: 0 })
  ws.close()
  process.exit(0)
}

/**
 * PLAN-041 / T0535: `terminal:close-worker { towerId, workorder, delayMs }`. Success is decided
 * by the exit code (CT never parses stdout); `close-worker: <CODE>` on stderr is diagnostic.
 */
async function runCloseWorker(ws) {
  const request = { towerId: notifyId, workorder: closeWorker, ...(delayMs !== null ? { delayMs } : {}) }
  const finish = (exitCode, code, fields = {}) => {
    logEvent('bat-terminal', 'close-worker', { towerId: notifyId, workorder: closeWorker, delayMs, result: code, ...fields, ignoredFrames })
    logEvent('bat-terminal', 'exit', { code: exitCode, reason: exitCode === 0 ? 'close-worker-scheduled' : `close-worker-${code}` })
    ws.close()
    process.exit(exitCode)
  }

  const invokeId = makeId()
  ws.send(JSON.stringify({ type: 'invoke', id: invokeId, channel: 'terminal:close-worker', args: [request] }))
  logEvent('bat-terminal', 'await-invoke-response', { timeoutMs: 3000, channel: 'terminal:close-worker' })
  let resp
  try {
    resp = await waitForMessage(ws, invokeId)
  } catch (err) {
    const msg = err?.message || String(err)
    console.error(`Error: Invoke response timeout: ${msg}`)
    console.error('close-worker: TIMEOUT')
    return finish(1, 'TIMEOUT', { error: msg })
  }
  if (resp.error) {
    // A BAT from before T0535 has no such handler.
    const unsupported = /No handler for channel/i.test(String(resp.error))
    console.error(`Error: ${unsupported ? 'This BAT does not support --close-worker (update BAT)' : `Failed to close the Worker: ${resp.error}`}`)
    const code = unsupported ? 'UNSUPPORTED' : 'ERROR'
    console.error(`close-worker: ${code}`)
    return finish(1, code, { error: resp.error })
  }
  const result = resp.result
  if (result && typeof result === 'object' && result.ok === true) {
    const terminalId = String(result.terminalId)
    const inMs = typeof result.delayMs === 'number' ? result.delayMs : Math.max(0, Number(result.closeAt) - Date.now()) || 0
    console.log(`✓ Worker close scheduled: ${terminalId} (in ${inMs} ms)`)
    return finish(0, 'OK', { terminalId, closeAt: result.closeAt, scheduledDelayMs: inMs })
  }
  const code = result && typeof result === 'object' && typeof result.code === 'string' ? result.code : 'ERROR'
  const exitCode = CLOSE_WORKER_EXIT[code] ?? 1
  const detail = {
    NOT_FOUND: `no Worker tab for ${closeWorker} (BAT reopened since the dispatch, or already closed) — close it by hand if it is still open`,
    NOT_OWNER: `the Worker tab of ${closeWorker} was not dispatched by terminal ${notifyId}`,
    AMBIGUOUS: `more than one Worker tab of ${closeWorker} from this Tower${Array.isArray(result?.terminalIds) ? ` (${result.terminalIds.join(', ')})` : ''}`,
    BUSY: `the Worker tab of ${closeWorker} printed output in the last 5 s`,
    INVALID_ARGS: 'BAT rejected the request arguments',
  }[code] ?? 'the Worker tab was not closed'
  console.error(`Error: Worker not closed (${code}): ${detail}`)
  console.error(`close-worker: ${code}`)
  return finish(exitCode, code, Array.isArray(result?.terminalIds) ? { terminalIds: result.terminalIds } : {})
}

// T0200/BUG-046: Safety net for rejections that escape main()'s await chain
// (e.g., event-loop-scheduled promises inside MinimalWS or waitForMessage
// after main resolved). main().catch() alone can't see those.
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  console.error(`Error: Unhandled rejection: ${err.message}`)
  logEvent('bat-terminal', 'exit', {
    code: 1,
    reason: 'unhandled-rejection',
    error: err.message,
    stack: err.stack,
  })
  process.exit(1)
})

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  logEvent('bat-terminal', 'exit', { code: 1, reason: 'unhandled', error: err.message })
  process.exit(1)
})
