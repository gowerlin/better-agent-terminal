// T0802 / D247: is voice input usable on this host? Pure logic shared by the main process (probe result →
// state, log line) and the renderer (state → mic button / hint text). No electron / DOM imports.
//
// The main process probes the whisper addon in a short-lived child process after startup
// (electron/voice-availability.ts). Three states:
//   available    the addon loaded (in the probe, or in the real first transcription)
//   unavailable  the addon cannot load here; `code` says why (missing-library / glibc-too-old / load-failed)
//   unknown      not checked yet, or the check itself failed (timeout, crash, spawn failure, no result).
//                🔴 unknown keeps the pre-T0802 behaviour: the mic button works and the real load fails soft.
// See docs/agent-guide/voice-availability.md.

export type VoiceUnavailableCode = 'missing-library' | 'glibc-too-old' | 'load-failed'

export type VoiceUnknownReason = 'pending' | 'timeout' | 'crashed' | 'spawn-failed' | 'no-result'

export type VoiceAvailability =
  | { state: 'unknown'; reason: VoiceUnknownReason; detail?: string }
  | { state: 'available'; source: 'probe' | 'load' }
  | {
      state: 'unavailable'
      code: VoiceUnavailableCode
      /** `process.platform` of the host that runs recognition (picks the install hint). */
      platform: string
      /** Shared libraries the addon could not find (Linux sonames / macOS dylib names), in report order. */
      libraries: string[]
      /** `glibc-too-old`: the newest GLIBC_x.y the addon asked for. */
      requiredGlibc?: string
      /** The load error, truncated, home directory replaced by `~`. */
      detail: string
    }

export const VOICE_AVAILABILITY_PENDING: VoiceAvailability = { state: 'unknown', reason: 'pending' }

/** Upper bound of `detail` (UI tooltip and log line). */
export const VOICE_DETAIL_MAX_CHARS = 300

/**
 * Libraries the whisper addon links that a Linux desktop may lack (T0800 measured both), with the
 * Debian / Ubuntu package that provides each. The probe also dlopens these one by one, because the
 * loader reports only the first missing library.
 */
export const LINUX_LIBRARY_PACKAGES: Readonly<Record<string, string>> = {
  'libgomp.so.1': 'libgomp1',
  'libvulkan.so.1': 'libvulkan1',
}

export const LINUX_PROBE_LIBRARIES: readonly string[] = Object.keys(LINUX_LIBRARY_PACKAGES)

/** Marker in front of the probe's one JSON line on stdout (anything else the addon prints is ignored). */
export const VOICE_PROBE_MARKER = '@@bat-voice-probe@@'

/** What the probe child process prints after the marker. */
export interface VoiceProbeOutput {
  ok: boolean
  message: string
  /** Libraries from LINUX_PROBE_LIBRARIES that dlopen could not find (probed only when the load failed). */
  missing: string[]
}

/** Replace the home directory with `~` and cut to `max` characters. */
export function sanitizeVoiceDetail(text: string, homeDir?: string, max = VOICE_DETAIL_MAX_CHARS): string {
  let out = text.replace(/\s+/g, ' ').trim()
  if (homeDir && homeDir.length > 1) {
    out = out.split(homeDir).join('~')
    // Windows paths also show up with forward slashes
    const alt = homeDir.includes('\\') ? homeDir.replace(/\\/g, '/') : null
    if (alt) out = out.split(alt).join('~')
  }
  return out.length > max ? `${out.slice(0, max - 1)}…` : out
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export interface WhisperLoadErrorClass {
  code: VoiceUnavailableCode
  libraries: string[]
  requiredGlibc?: string
}

/**
 * Load error text → reason code.
 *   Linux  `version \`GLIBC_2.38' not found`                     → glibc-too-old (2.38)
 *   Linux  `libgomp.so.1: cannot open shared object file: …`      → missing-library (libgomp.so.1)
 *   macOS  `Library not loaded: @rpath/libomp.dylib`              → missing-library (libomp.dylib)
 *   other (Windows "The specified module could not be found." names no DLL) → load-failed
 * `extraMissing` (the probe's own dlopen of LINUX_PROBE_LIBRARIES) is merged into `libraries`.
 */
export function classifyWhisperLoadError(message: string, extraMissing: readonly string[] = []): WhisperLoadErrorClass {
  const libraries: string[] = []
  const add = (lib: string) => { if (lib && !libraries.includes(lib)) libraries.push(lib) }

  for (const m of message.matchAll(/([A-Za-z0-9_+.-]+\.so(?:\.[0-9]+)*): cannot open shared object file/g)) add(m[1])
  for (const m of message.matchAll(/Library not loaded:\s*(\S+)/g)) add(m[1].replace(/[,'"]+$/, '').split('/').pop() ?? '')
  for (const lib of extraMissing) add(lib)

  let requiredGlibc: string | undefined
  for (const m of message.matchAll(/version [`'‘"]?GLIBC_([0-9]+(?:\.[0-9]+)+)[`'’"]? not found/g)) {
    if (!requiredGlibc || compareVersions(m[1], requiredGlibc) > 0) requiredGlibc = m[1]
  }
  if (requiredGlibc) return { code: 'glibc-too-old', libraries, requiredGlibc }
  if (libraries.length > 0) return { code: 'missing-library', libraries }
  return { code: 'load-failed', libraries }
}

/** The JSON line after VOICE_PROBE_MARKER in the probe's stdout, or null. */
export function parseVoiceProbeOutput(stdout: string): VoiceProbeOutput | null {
  const lines = stdout.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const at = lines[i].indexOf(VOICE_PROBE_MARKER)
    if (at < 0) continue
    try {
      const v = JSON.parse(lines[i].slice(at + VOICE_PROBE_MARKER.length)) as Partial<VoiceProbeOutput>
      if (typeof v?.ok !== 'boolean') return null
      return {
        ok: v.ok,
        message: typeof v.message === 'string' ? v.message : '',
        missing: Array.isArray(v.missing) ? v.missing.filter((x): x is string => typeof x === 'string') : [],
      }
    } catch {
      return null
    }
  }
  return null
}

/** How the probe child process ended (an `execFile` callback, flattened). */
export interface VoiceProbeRun {
  stdout: string
  /** The process could not be started (ENOENT, EACCES, …): its error text. */
  spawnError?: string
  /** Killed by the timeout. */
  timedOut?: boolean
  exitCode?: number | null
  signal?: string | null
}

/** Probe run → state. A result line wins over the exit status (the addon may crash on exit after reporting). */
export function voiceAvailabilityFromProbe(run: VoiceProbeRun, platform: string, homeDir?: string): VoiceAvailability {
  const out = parseVoiceProbeOutput(run.stdout ?? '')
  if (out) {
    if (out.ok) return { state: 'available', source: 'probe' }
    const cls = classifyWhisperLoadError(out.message, out.missing)
    return {
      state: 'unavailable',
      code: cls.code,
      platform,
      libraries: cls.libraries,
      ...(cls.requiredGlibc ? { requiredGlibc: cls.requiredGlibc } : {}),
      detail: sanitizeVoiceDetail(out.message || 'unknown load error', homeDir),
    }
  }
  if (run.spawnError !== undefined) return { state: 'unknown', reason: 'spawn-failed', detail: sanitizeVoiceDetail(run.spawnError, homeDir) }
  if (run.timedOut) return { state: 'unknown', reason: 'timeout' }
  if (run.signal || (typeof run.exitCode === 'number' && run.exitCode !== 0)) {
    return { state: 'unknown', reason: 'crashed', detail: run.signal ? `signal ${run.signal}` : `exit code ${run.exitCode}` }
  }
  return { state: 'unknown', reason: 'no-result' }
}

/** The addon cannot even be located (not installed, no `whisper.node` for this host): the real load fails the same way. */
export function voiceUnavailableFromLocateError(message: string, platform: string, homeDir?: string): VoiceAvailability {
  return { state: 'unavailable', code: 'load-failed', platform, libraries: [], detail: sanitizeVoiceDetail(message, homeDir) }
}

/** `[voice] availability: …` debug log line (no env, home directory already replaced in `detail`). */
export function voiceAvailabilityLogLine(a: VoiceAvailability, ms: number): string {
  const head = '[voice] availability: '
  if (a.state === 'available') return `${head}available in ${ms} ms (${a.source})`
  if (a.state === 'unknown') return `${head}unknown(${a.reason}) in ${ms} ms${a.detail ? `: ${a.detail}` : ''}`
  const extra = [
    a.libraries.length ? `libraries=${a.libraries.join(',')}` : '',
    a.requiredGlibc ? `glibc>=${a.requiredGlibc}` : '',
  ].filter(Boolean).join(' ')
  return `${head}unavailable(${a.code}) in ${ms} ms${extra ? ` ${extra}` : ''}: ${a.detail}`
}

/** Only `unavailable` blocks recording; `available` and `unknown` leave the pre-T0802 behaviour. */
export function isVoiceUnavailable(a: VoiceAvailability | null | undefined): a is Extract<VoiceAvailability, { state: 'unavailable' }> {
  return a?.state === 'unavailable'
}

/** `sudo apt install …` for the known libraries, or null when none of them has a known package. */
export function aptInstallCommand(libraries: readonly string[]): string | null {
  const pkgs = [...new Set(libraries.map(l => LINUX_LIBRARY_PACKAGES[l]).filter((p): p is string => !!p))]
  return pkgs.length ? `sudo apt install ${pkgs.join(' ')}` : null
}

export type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * Lines shown for `unavailable` (mic tooltip, recording refusal, Settings): reason first, then what to do.
 * Keys live under `voiceAvailability.*` in src/locales/*.json.
 */
export function voiceUnavailableLines(a: Extract<VoiceAvailability, { state: 'unavailable' }>, t: Translate): string[] {
  const lines: string[] = [t('voiceAvailability.unavailableTitle')]
  if (a.code === 'glibc-too-old') {
    lines.push(t('voiceAvailability.reason.glibcTooOld', { version: a.requiredGlibc ?? '?' }))
  } else if (a.code === 'missing-library') {
    lines.push(t('voiceAvailability.reason.missingLibrary', { libraries: a.libraries.join(', ') }))
  } else {
    lines.push(t('voiceAvailability.reason.loadFailed', { detail: a.detail }))
  }
  if (a.libraries.length > 0) {
    const apt = a.platform === 'linux' ? aptInstallCommand(a.libraries) : null
    const unknown = a.platform === 'linux' ? a.libraries.filter(l => !LINUX_LIBRARY_PACKAGES[l]) : a.libraries
    if (apt) lines.push(t('voiceAvailability.action.aptInstall', { command: apt }))
    if (unknown.length) lines.push(t('voiceAvailability.action.installLibrary', { libraries: unknown.join(', ') }))
  }
  if (a.code === 'glibc-too-old') lines.push(t('voiceAvailability.action.glibc', { version: a.requiredGlibc ?? '?' }))
  return lines
}

export function voiceUnavailableText(a: Extract<VoiceAvailability, { state: 'unavailable' }>, t: Translate): string {
  return voiceUnavailableLines(a, t).join('\n')
}
