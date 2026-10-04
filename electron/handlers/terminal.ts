/**
 * PLAN-036 P3 / K (T0431): `terminal:create-with-command` / `terminal:create-agent-command`
 * / `terminal:notify` / `terminal:keypress`, registered by both Electron main and
 * headless bat-server (see ./types.ts).
 *
 * Events (`terminal:created-externally` / `terminal:notified` / `terminal:keypress`) go
 * out through the host `emit`:
 *   - Electron: every window + broadcastHub (remote clients of this BAT)
 *   - headless: broadcastHub only (the connected BAT clients)
 *
 * The two hosts differ in what they pass in:
 *   - Electron: `<userData>/settings.json`, workspace default agent from the window
 *     registry, Windows elevation; the local renderer's shell is trusted as before.
 *   - headless: `<dataDir>/settings.json`, no workspace default agent, no elevation;
 *     a client-supplied shell must be an absolute path to an existing file (same rule
 *     as `pty:create`), and `terminal:keypress` fails with `no-client` when no other
 *     client is connected to receive it (bat-notify `--submit` then exits 1).
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import * as fs from 'fs'
import type { PersistedShellSettings } from '../shell-path-resolver'
import { logger } from '../logger'
import { mirrorToBatScripts, pickWhitelistedEnv } from '../remote/remote-logger'
import {
  registerTerminalCommandHandlers,
  type BuiltAgentCommand,
  type AgentPromptCommandOptions,
  type TerminalCommandHandlerDeps,
} from '../terminal-command-handlers'
import { shellPathRejection } from './pty'
import type { HandlerContext, HandlerRegistrar } from './types'

/** Minimal window surface the Electron emit needs (structurally matches BrowserWindow). */
export interface TerminalEventWindow {
  webContents: { send(channel: string, payload: unknown): void }
}

/**
 * Event sink for this module. Returns how many host windows received the event
 * (Electron, logged as `broadcastWindows`); headless has none and returns 0.
 */
export type TerminalEventEmit = (channel: string, payload: unknown) => number

export interface TerminalHandlerDeps {
  getPtyManager: TerminalCommandHandlerDeps['getPtyManager']
  emit: TerminalEventEmit
  /** Shell settings (`shell` / `customShellPath`) of this host. */
  readSettings(): PersistedShellSettings | null
  buildAgentPromptCommand(opts: AgentPromptCommandOptions): Promise<BuiltAgentCommand | null>
  /**
   * headless: authenticated clients that will receive a broadcast, not counting the
   * invoking connection. When set, `terminal:keypress` with 0 → `{ ok: false, reason: 'no-client' }`.
   */
  countRemoteReceivers?(ctx: HandlerContext): number
  /** Reject a client-supplied `shell` that is not an absolute path to an existing file (headless). */
  validateShell?: boolean
  existsSync?: (path: string) => boolean
}

/**
 * Electron emit: send to every window (counting the ones that took it), then mirror
 * to remote clients through `broadcast` (broadcastHub).
 */
export function createTerminalWindowEmit(
  getWindows: () => TerminalEventWindow[],
  broadcast: (channel: string, payload: unknown) => void,
): TerminalEventEmit {
  return (channel, payload) => {
    let windowCount = 0
    for (const win of getWindows()) {
      try {
        win.webContents.send(channel, payload)
        windowCount += 1
      } catch { /* window closing */ }
    }
    broadcast(channel, payload)
    return windowCount
  }
}

export function registerTerminalHandlers(register: HandlerRegistrar, deps: TerminalHandlerDeps): void {
  // Terminal: create + immediately send a command (for Control Tower auto-session).
  registerTerminalCommandHandlers({
    registerHandler: register,
    getPtyManager: deps.getPtyManager,
    emit: deps.emit,
    rejectShell: deps.validateShell ? shell => shellPathRejection(shell) : undefined,
    readPersistedSettingsSync: deps.readSettings,
    buildAgentPromptCommand: deps.buildAgentPromptCommand,
    pickWhitelistedEnv,
    mirrorToBatScripts,
    logger,
    existsSync: deps.existsSync ?? fs.existsSync,
  })

  // T0133: Worker→Tower auto-notify — broadcast a notification toast + tab badge.
  // Invoked by bat-notify.mjs over WebSocket; renderer(s) show UI cues for targetId.
  register('terminal:notify', (_ctx, opts: { targetId: string; message: string; source?: string }) => {
    // T0193: Diagnostic logging — capture notify routing so we can correlate with
    // bat-notify.mjs entries in the same NDJSON timeline.
    const invokerWindowId = _ctx.windowId ?? null
    logger.log(`[remote][terminal] ipc-invoke channel=terminal:notify target=${opts?.targetId ?? 'n/a'} source=${opts?.source ?? 'n/a'} windowId=${invokerWindowId ?? 'n/a'}`)
    mirrorToBatScripts('ipc-invoke', {
      channel: 'terminal:notify',
      targetTerminalId: opts?.targetId,
      sourceTerminalId: opts?.source,
      messageLength: opts?.message ? opts.message.length : 0,
      windowId: invokerWindowId,
    })

    if (!opts || !opts.targetId || !opts.message) {
      logger.log('[remote][terminal] ipc-result channel=terminal:notify result=false reason=invalid-payload')
      mirrorToBatScripts('ipc-result', {
        channel: 'terminal:notify',
        result: false,
        reason: 'invalid-payload',
      })
      return false
    }
    const windowCount = deps.emit('terminal:notified', {
      targetId: opts.targetId,
      message: opts.message,
      source: opts.source,
    })
    logger.log(`[remote][terminal] ipc-result channel=terminal:notify result=true target=${opts.targetId} broadcastWindows=${windowCount}`)
    mirrorToBatScripts('ipc-result', {
      channel: 'terminal:notify',
      targetTerminalId: opts.targetId,
      sourceTerminalId: opts.source,
      result: true,
      broadcastWindows: windowCount,
      windowId: invokerWindowId,
    })
    return true
  })

  // Submit path for terminal-driven agents: let the renderer/xterm
  // layer synthesize Enter as user input instead of writing CR directly to PTY.
  register('terminal:keypress', (_ctx, opts: { targetId: string; key?: string; code?: string; keyCode?: number; source?: string; reason?: string; traceId?: string }) => {
    const invokerWindowId = _ctx.windowId ?? null
    logger.log(`[remote][terminal] ipc-invoke channel=terminal:keypress target=${opts?.targetId ?? 'n/a'} key=${opts?.key ?? 'n/a'} source=${opts?.source ?? 'n/a'} trace=${opts?.traceId ?? 'n/a'} windowId=${invokerWindowId ?? 'n/a'}`)
    mirrorToBatScripts('ipc-invoke', {
      channel: 'terminal:keypress',
      targetTerminalId: opts?.targetId,
      key: opts?.key,
      keyCode: opts?.keyCode,
      sourceTerminalId: opts?.source,
      reason: opts?.reason,
      traceId: opts?.traceId,
      delivery: 'renderer-dom-keydown',
      windowId: invokerWindowId,
    })

    const isEnter = opts?.key === 'Enter' || opts?.code === 'Enter' || opts?.keyCode === 13
    if (!opts || !opts.targetId || !isEnter) {
      logger.log('[remote][terminal] ipc-result channel=terminal:keypress result=false reason=invalid-payload')
      mirrorToBatScripts('ipc-result', {
        channel: 'terminal:keypress',
        result: false,
        reason: 'invalid-payload',
        traceId: opts?.traceId,
      })
      return { ok: false, reason: 'invalid-payload' }
    }

    // headless: the Enter is synthesized by a client renderer. With nobody connected the
    // broadcast goes nowhere, so say so instead of reporting a submit that never happened.
    const remoteReceivers = deps.countRemoteReceivers?.(_ctx)
    if (remoteReceivers !== undefined && remoteReceivers <= 0) {
      logger.log(`[remote][terminal] ipc-result channel=terminal:keypress result=false reason=no-client target=${opts.targetId} trace=${opts.traceId ?? 'n/a'}`)
      mirrorToBatScripts('ipc-result', {
        channel: 'terminal:keypress',
        targetTerminalId: opts.targetId,
        result: false,
        reason: 'no-client',
        traceId: opts.traceId,
      })
      return { ok: false, reason: 'no-client' }
    }

    const payload = {
      targetId: opts.targetId,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      source: opts.source,
      reason: opts.reason,
      traceId: opts.traceId,
    }
    const windowCount = deps.emit('terminal:keypress', payload)
    const clientsLog = remoteReceivers !== undefined ? ` broadcastClients=${remoteReceivers}` : ''
    logger.log(`[remote][terminal] ipc-result channel=terminal:keypress result=true target=${opts.targetId} trace=${opts.traceId ?? 'n/a'} broadcastWindows=${windowCount}${clientsLog}`)
    mirrorToBatScripts('ipc-result', {
      channel: 'terminal:keypress',
      targetTerminalId: opts.targetId,
      sourceTerminalId: opts.source,
      result: true,
      traceId: opts.traceId,
      delivery: 'renderer-dom-keydown',
      broadcastWindows: windowCount,
      ...(remoteReceivers !== undefined ? { broadcastClients: remoteReceivers } : {}),
      windowId: invokerWindowId,
    })
    return remoteReceivers !== undefined
      ? { ok: true, broadcastWindows: windowCount, broadcastClients: remoteReceivers }
      : { ok: true, broadcastWindows: windowCount }
  })
}
