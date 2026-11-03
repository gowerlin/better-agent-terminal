// IPC message protocol for BAT ↔ Terminal Server communication.
// Uses child_process.fork's built-in IPC (process.send / process.on('message')),
// which handles JSON serialization automatically.

import type { PtyFdGuardOutcome } from '../pty-spawn-fd-guard'

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
  | { type: 'error'; requestType: string; message: string }
