// T0802 / D247: check once per BAT start, after startup, whether the whisper addon can load here — in a
// short-lived child process, so the main process never loads whisper early (no memory / startup cost for
// people who do not use voice input). The child is this Electron binary in Node mode
// (`ELECTRON_RUN_AS_NODE=1`, same ABI as the real load), started with `execFile` + array args + timeout; it
// only `require`s the addon, prints one JSON line and exits. The addon path comes from `locateWhisperAddon`,
// the same function the real load uses. The result lives in memory only. See
// docs/agent-guide/voice-availability.md.
//
// 🔴 The child's env has no BAT_* / CT_* variables, nothing token-like, and no added LD_LIBRARY_PATH (it
// inherits the main process's loader environment as-is, so it sees what the real load would see).
// 🔴 unknown (timeout / crash / spawn failure) never disables voice input.

import { execFile } from 'child_process'
import * as os from 'os'
import { ipcMain, type BrowserWindow } from 'electron'
import { logger } from './logger'
import { locateDefaultWhisperAddon, type WhisperAddonLocation } from './whisper-addon-loader'
import {
  LINUX_PROBE_LIBRARIES,
  VOICE_AVAILABILITY_PENDING,
  VOICE_PROBE_MARKER,
  voiceAvailabilityFromProbe,
  voiceAvailabilityLogLine,
  voiceUnavailableFromLocateError,
  type VoiceAvailability,
  type VoiceProbeRun,
} from '../src/lib/voice-availability'
import { VOICE_IPC_CHANNELS } from '../src/types/voice-ipc'

/** Startup delay before the one background check (app ready + this). */
export const VOICE_AVAILABILITY_DELAY_MS = 5_000
/** The child is killed after this; the result is then `unknown(timeout)`. */
export const VOICE_AVAILABILITY_TIMEOUT_MS = 15_000

/**
 * Runs in the child (`<electron> -e <script> <addonPath> <lib>…`). Loads the addon and, only when that fails,
 * dlopens the known system libraries one by one (dlopen reports only the first missing one). A library that
 * loads makes `process.dlopen` throw "did not self-register", which is fine: only "cannot open" counts.
 */
export const VOICE_PROBE_SCRIPT = [
  "'use strict'",
  'const [target, ...libs] = process.argv.slice(1)',
  "const r = { ok: false, message: '', missing: [] }",
  "try { const m = require(target); if (m && typeof m.whisper === 'function') r.ok = true; else r.message = target + ' does not export a whisper() function' } catch (e) { r.message = String((e && e.message) || e) }",
  'if (!r.ok) for (const lib of libs) { try { process.dlopen({ exports: {} }, lib) } catch (e) { if (/cannot open shared object file/.test(String(e && e.message))) r.missing.push(lib) } }',
  `process.stdout.write('\\n${VOICE_PROBE_MARKER}' + JSON.stringify(r) + '\\n', () => process.exit(0))`,
].join('\n')

const SECRET_NAME_RE = /TOKEN|SECRET|PASSW|CREDENTIAL|API_?KEY|PRIVATE_?KEY|AUTH/i

/**
 * The child's env: the main process env minus BAT_* / CT_* (helper tokens), NODE_OPTIONS, ELECTRON_*, and
 * anything whose name looks like a secret; plus ELECTRON_RUN_AS_NODE=1. Nothing else is added.
 */
export function buildVoiceProbeEnv(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(parent)) {
    if (value === undefined) continue
    const upper = key.toUpperCase()
    if (upper.startsWith('BAT_') || upper.startsWith('CT_') || upper.startsWith('ELECTRON_')) continue
    if (upper === 'NODE_OPTIONS' || SECRET_NAME_RE.test(key)) continue
    env[key] = value
  }
  env.ELECTRON_RUN_AS_NODE = '1'
  return env
}

export type VoiceProbeExecFile = (
  file: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; timeout: number; windowsHide: boolean; encoding: 'utf8'; maxBuffer: number },
  callback: (error: (Error & { code?: unknown; killed?: boolean; signal?: string | null }) | null, stdout: string, stderr: string) => void,
) => unknown

export interface VoiceAvailabilityDeps {
  platform: string
  execPath: string
  env: NodeJS.ProcessEnv
  homeDir?: string
  locateAddon: () => WhisperAddonLocation
  execFile: VoiceProbeExecFile
  timeoutMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  log: (line: string) => void
}

export interface VoiceAvailabilityController {
  get(): VoiceAvailability
  /** Runs the probe now (a check already running is shared). */
  check(): Promise<VoiceAvailability>
  /** The one background check after startup; later calls do nothing. */
  schedule(delayMs?: number): void
  /** The real load (first transcription) succeeded: that result wins over any probe result. */
  noteRealLoadSucceeded(): void
  subscribe(listener: (a: VoiceAvailability) => void): () => void
}

function runProbe(deps: VoiceAvailabilityDeps, addonPath: string): Promise<VoiceProbeRun> {
  const args = ['-e', VOICE_PROBE_SCRIPT, addonPath, ...(deps.platform === 'linux' ? LINUX_PROBE_LIBRARIES : [])]
  const options = {
    env: buildVoiceProbeEnv(deps.env),
    timeout: deps.timeoutMs ?? VOICE_AVAILABILITY_TIMEOUT_MS,
    windowsHide: true,
    encoding: 'utf8' as const,
    maxBuffer: 1024 * 1024,
  }
  return new Promise(resolve => {
    try {
      deps.execFile(deps.execPath, args, options, (error, stdout) => {
        if (!error) return resolve({ stdout: stdout ?? '', exitCode: 0 })
        // a string code (ENOENT, EACCES, …) = the process never ran; a number = its exit code
        if (typeof error.code === 'string' && error.code !== 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          return resolve({ stdout: stdout ?? '', spawnError: error.message })
        }
        resolve({
          stdout: stdout ?? '',
          timedOut: error.killed === true,
          exitCode: typeof error.code === 'number' ? error.code : null,
          signal: error.signal ?? null,
        })
      })
    } catch (err) {
      resolve({ stdout: '', spawnError: err instanceof Error ? err.message : String(err) })
    }
  })
}

export function createVoiceAvailability(deps: VoiceAvailabilityDeps): VoiceAvailabilityController {
  const now = deps.now ?? (() => Date.now())
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    t.unref?.()
    return t
  })
  let current: VoiceAvailability = VOICE_AVAILABILITY_PENDING
  let realLoadOk = false
  let scheduled = false
  let inFlight: Promise<VoiceAvailability> | null = null
  const listeners = new Set<(a: VoiceAvailability) => void>()

  const set = (next: VoiceAvailability) => {
    current = next
    for (const l of listeners) {
      try { l(next) } catch { /* a closed window */ }
    }
  }

  const probeOnce = async (): Promise<VoiceAvailability> => {
    const t0 = now()
    let result: VoiceAvailability
    try {
      const located = deps.locateAddon()
      result = located.ok
        ? voiceAvailabilityFromProbe(await runProbe(deps, located.addonPath), deps.platform, deps.homeDir)
        : voiceUnavailableFromLocateError(located.error.message, deps.platform, deps.homeDir)
    } catch (err) {
      result = { state: 'unknown', reason: 'spawn-failed', detail: err instanceof Error ? err.message : String(err) }
    }
    deps.log(voiceAvailabilityLogLine(result, now() - t0))
    if (realLoadOk && result.state !== 'available') {
      deps.log('[voice] availability: kept available (the real load already succeeded)')
      result = { state: 'available', source: 'load' }
    }
    set(result)
    return result
  }

  const check = (): Promise<VoiceAvailability> => {
    inFlight ??= probeOnce().finally(() => { inFlight = null })
    return inFlight
  }

  return {
    get: () => current,
    check,
    schedule(delayMs = VOICE_AVAILABILITY_DELAY_MS) {
      if (scheduled) return
      scheduled = true
      setTimer(() => { void check() }, delayMs)
    },
    noteRealLoadSucceeded() {
      realLoadOk = true
      if (current.state === 'available') return
      if (current.state === 'unavailable') deps.log(`[voice] availability: available (real load succeeded; the check said unavailable(${current.code}))`)
      set({ state: 'available', source: 'load' })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

let defaultController: VoiceAvailabilityController | null = null

/** Process-wide controller (lazy; creating it starts nothing). */
export function getVoiceAvailability(): VoiceAvailabilityController {
  defaultController ??= createVoiceAvailability({
    platform: process.platform,
    execPath: process.execPath,
    env: process.env,
    homeDir: os.homedir(),
    locateAddon: () => locateDefaultWhisperAddon(),
    execFile: execFile as unknown as VoiceProbeExecFile,
    log: (line) => logger.log(line),
  })
  return defaultController
}

/** `voice:getAvailability` / `voice:recheckAvailability` + push `voice:availabilityChanged` to every window. */
export function registerVoiceAvailabilityHandlers(getAllWindows: () => BrowserWindow[]): void {
  const controller = getVoiceAvailability()
  ipcMain.handle(VOICE_IPC_CHANNELS.getAvailability, async () => controller.get())
  ipcMain.handle(VOICE_IPC_CHANNELS.recheckAvailability, async () => controller.check())
  controller.subscribe((a) => {
    for (const win of getAllWindows()) {
      try {
        if (!win.isDestroyed()) win.webContents.send(VOICE_IPC_CHANNELS.availabilityChanged, a)
      } catch { /* window closing */ }
    }
  })
}

/** main.ts, after app ready: the one background check, delayed (never during startup). */
export function startVoiceAvailabilityCheck(delayMs = VOICE_AVAILABILITY_DELAY_MS): void {
  getVoiceAvailability().schedule(delayMs)
}
