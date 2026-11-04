// PLAN-064 / T0827 (D270 / D271): on Linux, once per BAT start and a few seconds after app ready, ask
// fontconfig (`fc-list`, two queries) whether any Chinese font and any emoji font is installed. The result
// lives in memory only; the main window shows a one-time hint with the install command when fonts are
// missing (src/components/LinuxFontHint.tsx). Pure parts: src/lib/linux-font-hint.ts. See
// docs/agent-guide/linux-cjk-font-hint.md.
//
// 🔴 Only Linux spawns anything. On Windows / macOS the IPC handlers exist but answer `unknown(not-linux)`;
//    nothing is scheduled, spawned or logged.
// 🔴 `execFile` + array args + timeout (5 s), no shell. fc-list missing / timeout / exit ≠ 0 / unparseable
//    output → `unknown`, which never shows a hint. Never run at import time or before app ready.
// 🔴 No fonts are shipped and no font setting is changed (D270).

import { execFile } from 'child_process'
import { ipcMain, type BrowserWindow } from 'electron'
import { logger } from './logger'
import {
  FC_LIST_QUERIES,
  LINUX_FONT_CHECK_IPC,
  LINUX_FONT_CHECK_NOT_LINUX,
  LINUX_FONT_CHECK_PENDING,
  linuxFontCheckFromRuns,
  linuxFontCheckLogLine,
  type FcListRun,
  type LinuxFontCheck,
} from '../src/lib/linux-font-hint'

/** Startup delay before the one background check (app ready + this; same as T0802). */
export const LINUX_FONT_CHECK_DELAY_MS = 5_000
/** Each `fc-list` is killed after this; the result is then `unknown(timeout)`. */
export const LINUX_FONT_CHECK_TIMEOUT_MS = 5_000

export type FcListExecFile = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean; encoding: 'utf8'; maxBuffer: number },
  callback: (error: (Error & { code?: unknown; killed?: boolean; signal?: string | null }) | null, stdout: string, stderr: string) => void,
) => unknown

export interface LinuxFontCheckDeps {
  platform: string
  execFile: FcListExecFile
  timeoutMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  log: (line: string) => void
}

export interface LinuxFontCheckController {
  get(): LinuxFontCheck
  /** Runs the check now (a check already running is shared). Not Linux → `unknown(not-linux)`, no spawn. */
  check(): Promise<LinuxFontCheck>
  /** The one background check after startup; later calls do nothing. Not Linux → nothing at all. */
  schedule(delayMs?: number): void
  /** True for the first caller only: one window shows the hint, once per BAT start. */
  claimHint(): boolean
  subscribe(listener: (r: LinuxFontCheck) => void): () => void
}

function runFcList(deps: LinuxFontCheckDeps, args: readonly string[]): Promise<FcListRun> {
  const options = {
    timeout: deps.timeoutMs ?? LINUX_FONT_CHECK_TIMEOUT_MS,
    windowsHide: true,
    encoding: 'utf8' as const,
    maxBuffer: 1024 * 1024,
  }
  return new Promise(resolve => {
    try {
      deps.execFile('fc-list', [...args], options, (error, stdout) => {
        if (!error) return resolve({ stdout, exitCode: 0 })
        // a string code (ENOENT, EACCES, …) = never ran; maxBuffer overflow = it ran but the output is unusable
        if (typeof error.code === 'string') {
          return resolve({ stdout: '', spawnErrorCode: error.code, spawnError: error.message })
        }
        resolve({
          stdout: stdout ?? '',
          timedOut: error.killed === true,
          exitCode: typeof error.code === 'number' ? error.code : null,
        })
      })
    } catch (err) {
      resolve({ stdout: '', spawnError: err instanceof Error ? err.message : String(err) })
    }
  })
}

export function createLinuxFontCheck(deps: LinuxFontCheckDeps): LinuxFontCheckController {
  const isLinux = deps.platform === 'linux'
  const now = deps.now ?? (() => Date.now())
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    t.unref?.()
    return t
  })
  let current: LinuxFontCheck = isLinux ? LINUX_FONT_CHECK_PENDING : LINUX_FONT_CHECK_NOT_LINUX
  let scheduled = false
  let claimed = false
  let inFlight: Promise<LinuxFontCheck> | null = null
  const listeners = new Set<(r: LinuxFontCheck) => void>()

  const runOnce = async (): Promise<LinuxFontCheck> => {
    const t0 = now()
    let result: LinuxFontCheck
    try {
      const [cjk, emoji] = await Promise.all([runFcList(deps, FC_LIST_QUERIES.cjk), runFcList(deps, FC_LIST_QUERIES.emoji)])
      result = linuxFontCheckFromRuns(cjk, emoji)
    } catch (err) {
      result = { state: 'unknown', reason: 'failed', detail: err instanceof Error ? err.message : String(err) }
    }
    deps.log(linuxFontCheckLogLine(result, now() - t0))
    current = result
    for (const l of listeners) {
      try { l(result) } catch { /* a closed window */ }
    }
    return result
  }

  const check = (): Promise<LinuxFontCheck> => {
    if (!isLinux) return Promise.resolve(current)
    inFlight ??= runOnce().finally(() => { inFlight = null })
    return inFlight
  }

  return {
    get: () => current,
    check,
    schedule(delayMs = LINUX_FONT_CHECK_DELAY_MS) {
      if (!isLinux || scheduled) return
      scheduled = true
      setTimer(() => { void check() }, delayMs)
    },
    claimHint() {
      if (!isLinux || claimed) return false
      claimed = true
      return true
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

let defaultController: LinuxFontCheckController | null = null

/** Process-wide controller (lazy; creating it starts nothing). */
export function getLinuxFontCheck(): LinuxFontCheckController {
  defaultController ??= createLinuxFontCheck({
    platform: process.platform,
    execFile: execFile as unknown as FcListExecFile,
    log: (line) => logger.log(line),
  })
  return defaultController
}

/** `font-check:get` / `font-check:claim-hint` (local `ipcMain.handle`) + push `font-check:changed` to every window. */
export function registerLinuxFontCheckHandlers(getAllWindows: () => BrowserWindow[]): void {
  const controller = getLinuxFontCheck()
  ipcMain.handle(LINUX_FONT_CHECK_IPC.get, async () => controller.get())
  ipcMain.handle(LINUX_FONT_CHECK_IPC.claimHint, async () => {
    const granted = controller.claimHint()
    if (granted) logger.log('[font-check] hint handed to a window')
    return granted
  })
  controller.subscribe((r) => {
    for (const win of getAllWindows()) {
      try {
        if (!win.isDestroyed()) win.webContents.send(LINUX_FONT_CHECK_IPC.changed, r)
      } catch { /* window closing */ }
    }
  })
}

/** main.ts, after app ready: the one background check, delayed. Does nothing off Linux. */
export function startLinuxFontCheck(delayMs = LINUX_FONT_CHECK_DELAY_MS): void {
  getLinuxFontCheck().schedule(delayMs)
}
