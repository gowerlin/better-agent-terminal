/**
 * T0533 / BUG-136: log Chromium's GPU feature status so a log shows whether rendering fell back
 * to software after GPU process crashes. Diagnostic only — nothing here changes rendering.
 *
 * Lines written (all prefixed `[gpu]`):
 * - `feature status: <key=value …>` — baseline, at the first `gpu-info-update`. Before that event
 *   Chromium reports a placeholder status (every feature `disabled_software` / `disabled_off`,
 *   measured on Windows at whenReady, ~100 ms before the first update), so whenReady does not log
 *   it. If no update arrives within GPU_BASELINE_FALLBACK_MS the status is logged anyway as
 *   `feature status (no gpu-info-update yet): …`.
 * - `info: …` — a few fields of `app.getGPUInfo('basic')` (written by main.ts)
 * - `crash #N this session` + `feature status at crash: …` (+ `changes: …`) — after each GPU
 *   `child-process-gone`, following the unchanged `[CRASH]` line
 * - `feature status changed: <changes> | <key=value …>` — on `gpu-info-update`, only when the
 *   status differs from the last one logged
 * - `skia graphite: …` — T0669: whether main.ts disabled Skia Graphite at startup, and why
 *   (`decideSkiaGraphite`, the one thing in this file that decides a rendering switch)
 */

/** main.ts: log the baseline anyway if no `gpu-info-update` arrives within this time. */
export const GPU_BASELINE_FALLBACK_MS = 15_000

export type GpuFeatureStatusMap = Readonly<Record<string, string>>

/** Electron's GPUFeatureStatus is an interface without an index signature; accept any object. */
export function toGpuFeatureStatusMap(status: object | null | undefined): GpuFeatureStatusMap {
  const out: Record<string, string> = {}
  if (!status) return out
  for (const [key, value] of Object.entries(status)) {
    out[key] = String(value)
  }
  return out
}

function sortedKeys(keys: Iterable<string>): string[] {
  return [...new Set(keys)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** One line, every key, fixed (code unit) key order: `2d_canvas=enabled gpu_compositing=enabled …`. */
export function formatGpuFeatureStatus(status: GpuFeatureStatusMap): string {
  const keys = sortedKeys(Object.keys(status))
  if (keys.length === 0) return '(empty)'
  return keys.map(key => `${key}=${status[key]}`).join(' ')
}

/** Keys whose value differs, as `key: before → after` (`(none)` for a key missing on one side). */
export function diffGpuFeatureStatus(prev: GpuFeatureStatusMap, next: GpuFeatureStatusMap): string[] {
  const changes: string[] = []
  for (const key of sortedKeys([...Object.keys(prev), ...Object.keys(next)])) {
    const before = Object.prototype.hasOwnProperty.call(prev, key) ? prev[key] : undefined
    const after = Object.prototype.hasOwnProperty.call(next, key) ? next[key] : undefined
    if (before !== after) changes.push(`${key}: ${before ?? '(none)'} → ${after ?? '(none)'}`)
  }
  return changes
}

function hexId(value: unknown): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? `0x${value.toString(16).padStart(4, '0')}` : undefined
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** A few fields of `app.getGPUInfo('basic')` — vendor / device / driver per GPU, not the whole JSON. */
export function summarizeGpuInfo(info: unknown): string {
  if (!info || typeof info !== 'object') return '(unavailable)'
  const record = info as Record<string, unknown>
  const parts: string[] = []
  const devices = Array.isArray(record.gpuDevice) ? record.gpuDevice : []
  devices.forEach((device, index) => {
    if (!device || typeof device !== 'object') return
    const d = device as Record<string, unknown>
    const fields = [
      `vendor=${hexId(d.vendorId) ?? '?'}`,
      `device=${hexId(d.deviceId) ?? '?'}`,
    ]
    const name = text(d.deviceString)
    if (name) fields.push(`name="${name}"`)
    const driverVendor = text(d.driverVendor)
    if (driverVendor) fields.push(`driverVendor="${driverVendor}"`)
    const driverVersion = text(d.driverVersion)
    if (driverVersion) fields.push(`driver=${driverVersion}`)
    if (d.active === true) fields.push('active')
    parts.push(`gpu${index}{${fields.join(' ')}}`)
  })
  if (devices.length === 0) parts.push('gpus=0')
  const model = text(record.machineModelName)
  if (model) {
    const version = text(record.machineModelVersion)
    parts.push(`machine="${version ? `${model} ${version}` : model}"`)
  }
  return parts.join(' ')
}

export interface GpuStatusLogDeps {
  getFeatureStatus: () => object
  log: (message: string) => void
  warn: (message: string) => void
}

export interface GpuStatusLog {
  /** `gpu-info-update`: the first one logs the baseline; later ones log only when the status changed. */
  onGpuInfoUpdate(): void
  /** Timer fallback: logs the status if nothing has been logged yet (no `gpu-info-update` so far). */
  logBaselineIfMissing(): void
  /** `child-process-gone`: counts and logs only `type === 'GPU'`; returns the session crash count. */
  onChildProcessGone(details: { type: string }): number
  readonly gpuCrashCount: number
}

export function createGpuStatusLog(deps: GpuStatusLogDeps): GpuStatusLog {
  /** Last status written to the log; null until the baseline (or a crash) logged one. */
  let last: GpuFeatureStatusMap | null = null
  let gpuCrashCount = 0

  const read = (context: string): GpuFeatureStatusMap | null => {
    try {
      return toGpuFeatureStatusMap(deps.getFeatureStatus())
    } catch (err) {
      deps.warn(`[gpu] getGPUFeatureStatus failed (${context}): ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }

  return {
    get gpuCrashCount() { return gpuCrashCount },

    onGpuInfoUpdate() {
      const status = read('gpu-info-update')
      if (!status || Object.keys(status).length === 0) return
      if (!last) {
        last = status
        deps.log(`[gpu] feature status: ${formatGpuFeatureStatus(status)}`)
        return
      }
      const changes = diffGpuFeatureStatus(last, status)
      if (changes.length === 0) return
      last = status
      deps.log(`[gpu] feature status changed: ${changes.join(', ')} | ${formatGpuFeatureStatus(status)}`)
    },

    logBaselineIfMissing() {
      if (last) return
      const status = read('baseline fallback')
      if (!status) return
      last = status
      deps.log(`[gpu] feature status (no gpu-info-update yet): ${formatGpuFeatureStatus(status)}`)
    },

    onChildProcessGone(details) {
      if (details.type !== 'GPU') return gpuCrashCount
      gpuCrashCount += 1
      deps.log(`[gpu] crash #${gpuCrashCount} this session`)
      const status = read('crash')
      if (!status) return gpuCrashCount
      deps.log(`[gpu] feature status at crash: ${formatGpuFeatureStatus(status)}`)
      if (last) {
        const changes = diffGpuFeatureStatus(last, status)
        deps.log(`[gpu] changes since last logged: ${changes.length > 0 ? changes.join(', ') : 'none'}`)
      }
      last = status
      return gpuCrashCount
    },
  }
}

/**
 * T0669 / BUG-164: Electron 41 (Chromium 146) crashes the GPU process on a CHECK in Skia Graphite's
 * `GraphiteSharedContext` (`kOutOfOrderRecording`). Graphite is on by default only on Apple, so
 * main.ts adds `--disable-skia-graphite` on darwin (Ganesh / ANGLE Metal instead). It is its own
 * switch on purpose: a second `appendSwitch('disable-features', …)` would replace the existing
 * `disable-features=ServiceWorker`. Setting this env to `1` keeps Graphite on (escape hatch).
 */
export const SKIA_GRAPHITE_ENV = 'BAT_SKIA_GRAPHITE'

export interface SkiaGraphiteDecision {
  /** true → main.ts appends `disable-skia-graphite` */
  disable: boolean
  reason: 'darwin-default' | 'env-override' | 'not-darwin'
}

export function decideSkiaGraphite(platform: string, env: Readonly<Record<string, string | undefined>>): SkiaGraphiteDecision {
  if (platform !== 'darwin') return { disable: false, reason: 'not-darwin' }
  if (env[SKIA_GRAPHITE_ENV]?.trim() === '1') return { disable: false, reason: 'env-override' }
  return { disable: true, reason: 'darwin-default' }
}

/** The startup `[gpu]` line for the decision. */
export function formatSkiaGraphiteDecision(decision: SkiaGraphiteDecision, platform: string): string {
  switch (decision.reason) {
    case 'darwin-default':
      return `[gpu] skia graphite: disabled (darwin default, --disable-skia-graphite; ${SKIA_GRAPHITE_ENV}=1 keeps it on)`
    case 'env-override':
      return `[gpu] skia graphite: not disabled (${SKIA_GRAPHITE_ENV}=1)`
    case 'not-darwin':
      return `[gpu] skia graphite: not disabled (platform=${platform})`
  }
}
