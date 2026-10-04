/**
 * PLAN-037 B (T0411): `remote-tools:detect`, registered by both Electron main and
 * the headless bat-server (see ./types.ts). Runs the T0408 probe
 * (`detectRemoteTools`) on the host that answers the call:
 *   - remote-profile window → proxied to its bat-server → the remote machine
 *   - local window on macOS / Linux → this machine
 *   - Windows host → `{ ok: false, errorCode: 'host-platform' }` (POSIX probe)
 *
 * Probe env: the host process env minus the keys `isScrubbedEnvKey` drops — both
 * hosts pass `isHeadlessScrubbedEnvKey`, the rule headless PTYs use, so no
 * `BAT_*` (server token, helper dir, tower ids) reaches the probe shell.
 *
 * Local windows (setup wizard, settings) are not bound to a server, so their
 * proxied call never leaves this machine. `detectRemoteToolsForProfile` is the
 * short-connection path behind the local-only `remote:detect-tools(profileId)`
 * (main.ts): connect to the profile's bat-server → invoke → disconnect.
 *
 * 🔴 No `electron` import here (headless-electron-free guard); the RemoteClient
 * is injected through `RemoteToolsDetectClient`.
 */
import { execFile as nodeExecFile } from 'child_process'
import * as os from 'os'
import {
  REMOTE_TOOLS_SCHEMA_VERSION,
  type RemoteToolsDetectResult,
} from '../../src/types/remote-tools'
import { unsupportedRemoteChannel } from '../../src/lib/remote-unsupported'
import { detectRemoteTools } from '../remote-tools/parse'
import type { ProbeExecFile } from '../remote-tools/probe-script'
import type { HandlerRegistrar } from './types'

export const REMOTE_TOOLS_DETECT_CHANNEL = 'remote-tools:detect'

/** Login probe 20 s ∥ server probe 5 s, plus connection slack. */
export const REMOTE_TOOLS_DETECT_INVOKE_TIMEOUT_MS = 30_000

const PROFILE_ID_RE = /^[a-zA-Z0-9._-]+$/

const defaultExecFile: ProbeExecFile = (file, args, options, callback) =>
  nodeExecFile(file, args, options, callback as Parameters<typeof nodeExecFile>[3])

function defaultUserShell(): string | undefined {
  try {
    return os.userInfo().shell ?? undefined
  } catch {
    return undefined
  }
}

export interface RemoteToolsHandlerDeps {
  /** Inherited env keys the probe must not see. Both hosts: `isHeadlessScrubbedEnvKey`. */
  isScrubbedEnvKey(key: string): boolean
  /** Default `child_process.execFile` (tests inject a fake). */
  execFile?: ProbeExecFile
  /** Default `process.platform`. */
  platform?: NodeJS.Platform
  /** Default `process.env`. */
  getEnv?: () => NodeJS.ProcessEnv
  /** Login shell when the env has no `SHELL`. Default `os.userInfo().shell`. */
  getUserShell?: () => string | undefined
}

/** `env` without the scrubbed keys (and without undefined values). */
export function buildProbeEnv(env: NodeJS.ProcessEnv, isScrubbedEnvKey: (key: string) => boolean): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || isScrubbedEnvKey(key)) continue
    out[key] = value
  }
  return out
}

/** Same source as the remote PTY's shell: `$SHELL`, else the passwd shell. `selectLoginShell` validates it. */
export function resolveProbeShell(env: NodeJS.ProcessEnv, getUserShell: () => string | undefined = defaultUserShell): string | undefined {
  return env.SHELL || getUserShell()
}

/** One detection on this host (what `remote-tools:detect` answers). */
export async function runRemoteToolsDetect(deps: RemoteToolsHandlerDeps): Promise<RemoteToolsDetectResult> {
  if ((deps.platform ?? process.platform) === 'win32') {
    return { ok: false, errorCode: 'host-platform', error: 'Remote tools detection needs a POSIX host; this host is Windows' }
  }
  const env = buildProbeEnv((deps.getEnv ?? (() => process.env))(), deps.isScrubbedEnvKey)
  const baseExecFile = deps.execFile ?? defaultExecFile
  const execFileWithEnv: ProbeExecFile = (file, args, options, callback) =>
    baseExecFile(file, args, { ...options, env }, callback)
  return detectRemoteTools(execFileWithEnv, { shell: resolveProbeShell(env, deps.getUserShell) })
}

export function registerRemoteToolsHandlers(register: HandlerRegistrar, deps: RemoteToolsHandlerDeps): void {
  register('remote-tools:detect', async () => runRemoteToolsDetect(deps))
}

// ── local short connection: `remote:detect-tools(profileId)` ─────────────────

/** The `ProfileEntry` fields the short connection reads. */
export interface RemoteToolsProfileTarget {
  type?: string
  remoteHost?: string
  remotePort?: number
  remoteToken?: string
  remoteFingerprint?: string
}

/** The `RemoteClient` surface the short connection uses (main.ts passes a real one). */
export interface RemoteToolsDetectClient {
  connect(host: string, port: number, token: string, label?: string, expectedFingerprint?: string): Promise<{ ok: boolean; error?: string; errorCode?: string }>
  invoke(channel: string, args: unknown[], timeout?: number): Promise<unknown>
  disconnect(): Promise<void> | void
}

export interface DetectRemoteToolsForProfileDeps<P extends RemoteToolsProfileTarget> {
  getProfile(profileId: string): Promise<P | null>
  /** A fresh client bound to `profile` (ssh profiles bring up their tunnel in `connect`). */
  createClient(profile: P): RemoteToolsDetectClient
  /** Detection for a local (non-remote) profile: this host's `remote-tools:detect`. */
  detectLocal(): Promise<RemoteToolsDetectResult>
}

const DEFAULT_REMOTE_PORT = 9876

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Narrow whatever the server answered to a `RemoteToolsDetectResult`, or null. */
export function asRemoteToolsDetectResult(value: unknown): RemoteToolsDetectResult | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { ok?: unknown; report?: { schemaVersion?: unknown }; errorCode?: unknown; error?: unknown }
  if (v.ok === true) {
    return v.report && typeof v.report === 'object' && v.report.schemaVersion === REMOTE_TOOLS_SCHEMA_VERSION
      ? (value as RemoteToolsDetectResult)
      : null
  }
  if (v.ok === false && typeof v.errorCode === 'string' && typeof v.error === 'string') return value as RemoteToolsDetectResult
  return null
}

/**
 * `remote:detect-tools(profileId)`: detection for a profile from a window that
 * is not bound to it. `profileId` is validated like `remote:detect-arch`; the
 * connection parameters come from the stored profile, never from the renderer.
 * Never throws — every failure is a `RemoteToolsDetectResult` error code.
 */
export async function detectRemoteToolsForProfile<P extends RemoteToolsProfileTarget>(
  profileId: unknown,
  deps: DetectRemoteToolsForProfileDeps<P>,
): Promise<RemoteToolsDetectResult> {
  if (typeof profileId !== 'string' || !PROFILE_ID_RE.test(profileId)) {
    return { ok: false, errorCode: 'invalid-profile', error: 'Invalid profileId' }
  }
  let profile: P | null
  try {
    profile = await deps.getProfile(profileId)
  } catch (err) {
    return { ok: false, errorCode: 'invalid-profile', error: `Profile lookup failed: ${errorMessage(err)}` }
  }
  if (!profile) return { ok: false, errorCode: 'invalid-profile', error: `Profile not found: ${profileId}` }
  if (profile.type !== 'remote') return deps.detectLocal()
  if (!profile.remoteHost || !profile.remoteToken) {
    return { ok: false, errorCode: 'invalid-profile', error: `Remote profile ${profileId} has no host / token` }
  }
  // Same rule as loadProfileSnapshotDetailed: no pinned fingerprint ⇒ no connection.
  if (!profile.remoteFingerprint) {
    return { ok: false, errorCode: 'invalid-profile', error: `Remote profile ${profileId} has no pinned server fingerprint (legacy setup, re-pair)` }
  }

  const client = deps.createClient(profile)
  try {
    let connected: Awaited<ReturnType<RemoteToolsDetectClient['connect']>>
    try {
      connected = await client.connect(
        profile.remoteHost,
        profile.remotePort || DEFAULT_REMOTE_PORT,
        profile.remoteToken,
        undefined,
        profile.remoteFingerprint,
      )
    } catch (err) {
      return { ok: false, errorCode: 'connect-failed', error: errorMessage(err) }
    }
    if (!connected.ok) {
      const code = connected.errorCode ? ` [${connected.errorCode}]` : ''
      return { ok: false, errorCode: 'connect-failed', error: (connected.error || 'Connection failed') + code }
    }

    let answer: unknown
    try {
      answer = await client.invoke(REMOTE_TOOLS_DETECT_CHANNEL, [], REMOTE_TOOLS_DETECT_INVOKE_TIMEOUT_MS)
    } catch (err) {
      if (unsupportedRemoteChannel(err) === REMOTE_TOOLS_DETECT_CHANNEL) {
        return { ok: false, errorCode: 'server-too-old', error: `bat-server predates T0411: ${errorMessage(err)}` }
      }
      return { ok: false, errorCode: 'invoke-failed', error: errorMessage(err) }
    }
    return asRemoteToolsDetectResult(answer)
      ?? { ok: false, errorCode: 'invoke-failed', error: 'bat-server answered remote-tools:detect with an unexpected shape' }
  } finally {
    try {
      await client.disconnect()
    } catch {
      // already closed
    }
  }
}
