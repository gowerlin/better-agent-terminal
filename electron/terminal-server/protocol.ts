// IPC message protocol for BAT ↔ Terminal Server communication.
// Uses child_process.fork's built-in IPC (process.send / process.on('message')),
// which handles JSON serialization automatically.
//
// PLAN-065 W1 / T0857 — protocol v1 (docs/agent-guide/terminal-server-recovery.md「協定 v1」):
//   - TCP clients start with `server:hello` (protocol range + the token of bat-pty-server.token);
//     the server answers `server:hello-ok` with the highest protocol both support.
//   - An unauthenticated first request on TCP → `error` (code UNAUTHENTICATED) and the socket closes.
//   - An unknown request → `error` (code UNKNOWN_REQUEST); before v1 it got no answer.
//   - A server that does not answer `server:hello` (before v1) is protocol 0: the message set below
//     without the v1 additions. The protocol only grows: no existing field changes meaning.
//   - `server:hello` and `server:shutdown` stay valid in every protocol version, so a client can
//     always end a server it cannot talk to (no common version, D5).

import * as net from 'net'
import type { PtyFdGuardOutcome } from '../pty-spawn-fd-guard'

/** Protocol 0 = the message set before T0857 (no hello, no token). */
export const LEGACY_PROTOCOL = 0
/** The protocol range this build speaks (server and client side). */
export const TERMINAL_SERVER_PROTOCOL_MIN = 1
export const TERMINAL_SERVER_PROTOCOL_MAX = 1

/** D7 / T0857: the longest idle timeout `server:extendIdle` can ask for (24 h). */
export const MAX_IDLE_EXTENSION_MS = 24 * 60 * 60 * 1000

/** `error.code` values (v1). Absent on errors that existed before v1. */
export type ServerErrorCode =
  | 'UNAUTHENTICATED'      // first TCP request was not a hello with the right token → socket closes
  | 'NO_COMMON_PROTOCOL'   // hello with the right token, but no protocol both sides speak
  | 'UNKNOWN_REQUEST'      // a request type this server does not know
  | 'NOT_ALLOWED'          // a request the connection may not send (no common protocol: only shutdown)
  | 'ALREADY_EXTENDED'     // `server:extendIdle` while an extension is pending
  | 'BAD_REQUEST'          // malformed request (not a JSON object, missing fields)

/** What `server:hello-ok` says about the process holding the PTYs. */
export interface ServerRuntimeInfo {
  /** `electron` = the BAT executable run as node (ELECTRON_RUN_AS_NODE); `node` = a plain node (W3 holder). */
  name: 'electron' | 'node'
  /** `process.version` of that runtime. */
  version: string
}

// Requests sent from BAT main process → Terminal Server
export type ServerRequest =
  | { type: 'pty:create'; id: string; shell: string; args: string[]; cwd: string; cols: number; rows: number; env?: Record<string, string> }
  | { type: 'pty:write'; id: string; data: string }
  | { type: 'pty:resize'; id: string; cols: number; rows: number }
  | { type: 'pty:kill'; id: string }
  | { type: 'pty:list' }
  | { type: 'pty:getBuffer'; id: string }
  | { type: 'server:ping' }
  | { type: 'server:shutdown' }
  | { type: 'server:getConfig' }
  // v1 (T0857)
  | { type: 'server:hello'; protocolMin: number; protocolMax: number; token: string }
  | { type: 'server:extendIdle'; durationMs: number }

// Responses sent from Terminal Server → BAT main process
export type ServerResponse =
  // T0806 / BUG-205: `fdGuard` only from a Linux server (electron/pty-spawn-fd-guard.ts); absent elsewhere and from older servers
  | { type: 'pty:created'; id: string; pid: number; fdGuard?: PtyFdGuardOutcome }
  | { type: 'pty:data'; id: string; data: string }
  | { type: 'pty:exit'; id: string; exitCode: number }
  | { type: 'pty:buffer'; id: string; lines: string[] }
  | { type: 'pty:list'; ptys: Array<{ id: string; pid: number; cwd: string }> }
  | { type: 'server:pong' }
  | { type: 'server:config'; scrollBufferLines: number; idleTimeoutMs: number }
  // T0857: `code` (and the server's range on NO_COMMON_PROTOCOL) are v1 additions
  | { type: 'error'; requestType: string; message: string; code?: ServerErrorCode; protocolMin?: number; protocolMax?: number }
  // v1 (T0857)
  | {
      type: 'server:hello-ok'
      protocol: number
      /** BAT version that started the server ('' when it was not told). */
      batVersion: string
      runtime: ServerRuntimeInfo
      /** W3 (T0859): the holder directory when the server runs from one; absent otherwise. */
      holderDir?: string
      pid: number
    }
  | { type: 'server:idle-extended'; idleTimeoutMs: number; configuredIdleTimeoutMs: number }

export type HelloOk = Extract<ServerResponse, { type: 'server:hello-ok' }>

/**
 * The highest protocol both ranges contain, or null when they do not overlap
 * (or a range is malformed). Single implementation for server and client.
 */
export function negotiateProtocol(
  ours: { min: number; max: number },
  theirs: { min: unknown; max: unknown },
): number | null {
  const { min: theirMin, max: theirMax } = theirs
  if (!Number.isInteger(theirMin) || !Number.isInteger(theirMax)) return null
  const lo = Math.max(ours.min, theirMin as number)
  const hi = Math.min(ours.max, theirMax as number)
  return lo <= hi ? hi : null
}

// ── Client side of the hello (main.ts probe / shutdown, PtyManager.connectToServer) ──────────

/**
 * T0857: how long a client waits for the answer to `server:hello` + `server:ping`.
 * The client sends both in one write. A v1 server answers the hello first; a server before v1
 * ignores the hello and answers only the ping — so an old server is recognised on its pong, in
 * one round trip, not after a timeout. This timeout only covers a server that answers neither
 * (hung, or not a Terminal Server); 3 s = the timeout the probe / reconnect had before T0857.
 */
export const HELLO_TIMEOUT_MS = 3_000

export type HelloResult =
  | { ok: true; protocol: number; hello: HelloOk | null }
  | { ok: false; reason: HelloFailure }

/**
 * - `unauthenticated`: the server refused the token (socket closes)
 * - `incompatible`: right token, no common protocol (the socket still accepts `server:shutdown`)
 * - `timeout`: neither hello-ok nor pong within HELLO_TIMEOUT_MS
 * - `closed`: the socket closed / failed before an answer (server gone, or refused us)
 */
export type HelloFailure = 'unauthenticated' | 'incompatible' | 'timeout' | 'closed'

/** The two lines a client opens with (JSON-line framing). The token never goes anywhere else. */
export function helloOpeningLines(token: string | null): string {
  const hello: ServerRequest = {
    type: 'server:hello',
    protocolMin: TERMINAL_SERVER_PROTOCOL_MIN,
    protocolMax: TERMINAL_SERVER_PROTOCOL_MAX,
    token: token ?? '',
  }
  const ping: ServerRequest = { type: 'server:ping' }
  return JSON.stringify(hello) + '\n' + JSON.stringify(ping) + '\n'
}

/**
 * Reads the server's lines during the hello. `feed(msg)` returns the result once the hello is
 * decided (null = keep reading); messages that are not part of the hello (an old server
 * broadcasts `pty:data` to every TCP client at once) are kept in `held` in arrival order for the
 * caller to handle after the decision. The pong that follows a v1 hello-ok is not part of the
 * hello either: it reaches the caller like any other message.
 */
export class HelloReader {
  readonly held: ServerResponse[] = []
  private result: HelloResult | null = null

  feed(msg: ServerResponse): HelloResult | null {
    if (this.result) {
      this.held.push(msg)
      return this.result
    }
    if (msg && msg.type === 'server:hello-ok') {
      const protocol = negotiateProtocol(
        { min: TERMINAL_SERVER_PROTOCOL_MIN, max: TERMINAL_SERVER_PROTOCOL_MAX },
        { min: msg.protocol, max: msg.protocol },
      )
      // a server that picked a protocol outside our range is as good as no common protocol
      this.result = protocol === null ? { ok: false, reason: 'incompatible' } : { ok: true, protocol, hello: msg }
    } else if (msg && msg.type === 'error' && msg.requestType === 'server:hello') {
      this.result = { ok: false, reason: msg.code === 'NO_COMMON_PROTOCOL' ? 'incompatible' : 'unauthenticated' }
    } else if (msg && msg.type === 'error' && msg.code === 'UNAUTHENTICATED') {
      this.result = { ok: false, reason: 'unauthenticated' }
    } else if (msg && msg.type === 'server:pong') {
      // no hello-ok before the pong of the same write: a server before v1
      this.result = { ok: true, protocol: LEGACY_PROTOCOL, hello: null }
    } else {
      this.held.push(msg)
    }
    return this.result
  }
}

/** Splits a JSON-line stream; malformed lines are skipped (as both sides always did). */
export function createLineParser(onMessage: (msg: unknown) => void): (chunk: Buffer | string) => void {
  let lineBuffer = ''
  return (chunk) => {
    lineBuffer += chunk.toString()
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop()!
    for (const line of lines) {
      if (!line.trim()) continue
      let msg: unknown
      try { msg = JSON.parse(line) } catch { continue }
      onMessage(msg)
    }
  }
}

export interface HelloConnection {
  result: HelloResult
  /** The open socket when `result.ok` and `keepOpen`; otherwise null (already destroyed). */
  socket: net.Socket | null
  /** Messages that came during the hello and are not part of it, in arrival order. */
  held: ServerResponse[]
  /** The unparsed tail of the stream (an incomplete line) for the next parser. */
  tail: string
}

/**
 * T0857: connect to a Terminal Server's TCP port and say hello (hello + ping in one write).
 * Never rejects. With `keepOpen` the socket of a successful hello is handed over with every
 * listener of this function removed; in every other case the socket is destroyed.
 */
export function openHelloConnection(
  port: number,
  token: string | null,
  { keepOpen = false, timeoutMs = HELLO_TIMEOUT_MS }: { keepOpen?: boolean; timeoutMs?: number } = {},
): Promise<HelloConnection> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const reader = new HelloReader()
    let tail = ''
    let settled = false

    const finish = (result: HelloResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.removeListener('data', onData)
      socket.removeListener('error', onFail)
      socket.removeListener('close', onFail)
      const keep = keepOpen && result.ok && !socket.destroyed
      if (!keep) socket.destroy()
      resolve({ result, socket: keep ? socket : null, held: reader.held, tail })
    }
    const onFail = () => finish({ ok: false, reason: 'closed' })
    const onData = (chunk: Buffer) => {
      tail += chunk.toString()
      const lines = tail.split('\n')
      tail = lines.pop()!
      let decided: HelloResult | null = null
      for (const line of lines) {
        if (!line.trim()) continue
        let msg: ServerResponse
        try { msg = JSON.parse(line) as ServerResponse } catch { continue }
        decided = reader.feed(msg) ?? decided
      }
      if (decided) finish(decided)
    }
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs)

    socket.on('data', onData)
    socket.on('error', onFail)
    socket.on('close', onFail)
    socket.connect(port, '127.0.0.1', () => {
      socket.write(helloOpeningLines(token))
    })
  })
}

/**
 * T0857: the request lines of a TCP `server:shutdown` — after a hello, which a server before v1
 * ignores and a v1 server needs (it also accepts the shutdown when there is no common protocol).
 */
export function shutdownLines(token: string | null): string {
  const hello: ServerRequest = {
    type: 'server:hello',
    protocolMin: TERMINAL_SERVER_PROTOCOL_MIN,
    protocolMax: TERMINAL_SERVER_PROTOCOL_MAX,
    token: token ?? '',
  }
  return JSON.stringify(hello) + '\n' + JSON.stringify({ type: 'server:shutdown' } satisfies ServerRequest) + '\n'
}
