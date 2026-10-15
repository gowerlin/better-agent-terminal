/**
 * T0533 / BUG-136: GPU feature status logging — formatting, change detection, crash counting.
 * main.ts wiring (baseline, child-process-gone, gpu-info-update) is guarded at the bottom.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createGpuStatusLog,
  diffGpuFeatureStatus,
  formatGpuFeatureStatus,
  summarizeGpuInfo,
  toGpuFeatureStatusMap,
} from '../gpu-status-log'

const HEALTHY = {
  gpu_compositing: 'enabled',
  '2d_canvas': 'enabled',
  webgl: 'enabled',
  rasterization: 'enabled',
  video_decode: 'enabled',
}

function harness(initial: Record<string, string>) {
  let status: Record<string, string> = { ...initial }
  const lines: string[] = []
  const warnings: string[] = []
  const log = createGpuStatusLog({
    getFeatureStatus: () => status,
    log: message => lines.push(message),
    warn: message => warnings.push(message),
  })
  return {
    log,
    lines,
    warnings,
    set(next: Record<string, string>) { status = { ...next } },
  }
}

describe('formatGpuFeatureStatus', () => {
  it('lists every key on one line in a fixed order regardless of insertion order', () => {
    const reversed = Object.fromEntries(Object.entries(HEALTHY).reverse())
    const a = formatGpuFeatureStatus(HEALTHY)
    expect(a).toBe('2d_canvas=enabled gpu_compositing=enabled rasterization=enabled video_decode=enabled webgl=enabled')
    expect(formatGpuFeatureStatus(reversed)).toBe(a)
    expect(a).not.toContain('\n')
  })

  it('marks an empty status', () => {
    expect(formatGpuFeatureStatus({})).toBe('(empty)')
  })

  it('stringifies non-string values from Electron', () => {
    expect(toGpuFeatureStatusMap({ webgl: 'enabled', odd: 1 as unknown as string })).toEqual({ webgl: 'enabled', odd: '1' })
    expect(toGpuFeatureStatusMap(null)).toEqual({})
  })
})

describe('diffGpuFeatureStatus', () => {
  it('returns nothing when unchanged', () => {
    expect(diffGpuFeatureStatus(HEALTHY, { ...HEALTHY })).toEqual([])
  })

  it('lists changed keys with before and after values, sorted', () => {
    const next = { ...HEALTHY, webgl: 'unavailable_off', '2d_canvas': 'unavailable_software' }
    expect(diffGpuFeatureStatus(HEALTHY, next)).toEqual([
      '2d_canvas: enabled → unavailable_software',
      'webgl: enabled → unavailable_off',
    ])
  })

  it('reports keys present on only one side', () => {
    expect(diffGpuFeatureStatus({ a: 'enabled' }, { b: 'disabled_software' })).toEqual([
      'a: enabled → (none)',
      'b: (none) → disabled_software',
    ])
  })
})

describe('summarizeGpuInfo', () => {
  it('keeps vendor / device / driver per GPU and the machine model', () => {
    const summary = summarizeGpuInfo({
      gpuDevice: [
        { vendorId: 0x10de, deviceId: 0x2204, active: true, deviceString: 'NVIDIA GeForce RTX 3090', driverVendor: 'NVIDIA', driverVersion: '32.0.15.6094' },
        { vendorId: 0x8086, deviceId: 0x4680, active: false },
      ],
      machineModelName: 'Mac14,12',
      machineModelVersion: '',
      auxAttributes: { huge: 'x'.repeat(1000) },
    })
    expect(summary).toBe(
      'gpu0{vendor=0x10de device=0x2204 name="NVIDIA GeForce RTX 3090" driverVendor="NVIDIA" driver=32.0.15.6094 active} '
      + 'gpu1{vendor=0x8086 device=0x4680} machine="Mac14,12"',
    )
    expect(summary).not.toContain('huge')
  })

  it('handles missing or malformed info', () => {
    expect(summarizeGpuInfo(undefined)).toBe('(unavailable)')
    expect(summarizeGpuInfo({})).toBe('gpus=0')
  })
})

describe('createGpuStatusLog', () => {
  // Measured at whenReady on Windows before the first gpu-info-update (T0533).
  const PLACEHOLDER = {
    gpu_compositing: 'disabled_software',
    '2d_canvas': 'disabled_software',
    webgl: 'disabled_off',
    rasterization: 'disabled_software',
    video_decode: 'disabled_software',
  }

  it('logs the baseline at the first gpu-info-update, not the placeholder before it', () => {
    const h = harness(PLACEHOLDER)
    h.set(HEALTHY)
    h.log.onGpuInfoUpdate()
    expect(h.lines).toEqual([`[gpu] feature status: ${formatGpuFeatureStatus(HEALTHY)}`])
    // The fallback timer is a no-op once a baseline exists.
    h.log.logBaselineIfMissing()
    expect(h.lines).toHaveLength(1)
  })

  it('falls back to logging the status, marked, when no gpu-info-update arrived', () => {
    const h = harness(PLACEHOLDER)
    h.log.logBaselineIfMissing()
    expect(h.lines).toEqual([`[gpu] feature status (no gpu-info-update yet): ${formatGpuFeatureStatus(PLACEHOLDER)}`])
    h.set(HEALTHY)
    h.log.onGpuInfoUpdate()
    expect(h.lines[1]).toMatch(/^\[gpu\] feature status changed: 2d_canvas: disabled_software → enabled, /)
  })

  it('ignores an empty status from gpu-info-update', () => {
    const h = harness({})
    h.log.onGpuInfoUpdate()
    expect(h.lines).toEqual([])
  })

  it('logs gpu-info-update only when the status changes', () => {
    const h = harness(HEALTHY)
    h.log.onGpuInfoUpdate()
    h.log.onGpuInfoUpdate()
    h.log.onGpuInfoUpdate()
    expect(h.lines).toHaveLength(1)

    const degraded = { ...HEALTHY, gpu_compositing: 'disabled_software' }
    h.set(degraded)
    h.log.onGpuInfoUpdate()
    h.log.onGpuInfoUpdate()
    expect(h.lines).toEqual([
      `[gpu] feature status: ${formatGpuFeatureStatus(HEALTHY)}`,
      `[gpu] feature status changed: gpu_compositing: enabled → disabled_software | ${formatGpuFeatureStatus(degraded)}`,
    ])
  })

  it('counts only GPU child-process-gone events', () => {
    const h = harness(HEALTHY)
    h.log.onGpuInfoUpdate()
    expect(h.log.onChildProcessGone({ type: 'Utility' })).toBe(0)
    expect(h.log.onChildProcessGone({ type: 'Pepper Plugin' })).toBe(0)
    expect(h.log.onChildProcessGone({ type: 'GPU' })).toBe(1)
    expect(h.log.onChildProcessGone({ type: 'Utility' })).toBe(1)
    expect(h.log.onChildProcessGone({ type: 'GPU' })).toBe(2)
    expect(h.log.gpuCrashCount).toBe(2)
    expect(h.lines.filter(l => l.startsWith('[gpu] crash #'))).toEqual([
      '[gpu] crash #1 this session',
      '[gpu] crash #2 this session',
    ])
  })

  it('logs the status at crash and its changes, then uses it as the new reference', () => {
    const h = harness(HEALTHY)
    h.log.onGpuInfoUpdate()
    const software = { ...HEALTHY, rasterization: 'disabled_software', '2d_canvas': 'unavailable_software' }
    h.set(software)
    h.log.onChildProcessGone({ type: 'GPU' })
    expect(h.lines.slice(1)).toEqual([
      '[gpu] crash #1 this session',
      `[gpu] feature status at crash: ${formatGpuFeatureStatus(software)}`,
      '[gpu] changes since last logged: 2d_canvas: enabled → unavailable_software, rasterization: enabled → disabled_software',
    ])
    // Already logged at the crash — the following gpu-info-update with the same status stays quiet.
    h.log.onGpuInfoUpdate()
    expect(h.lines).toHaveLength(4)

    h.log.onChildProcessGone({ type: 'GPU' })
    expect(h.lines.at(-1)).toBe('[gpu] changes since last logged: none')
  })

  it('logs the crash status without a diff when no baseline was logged yet', () => {
    const h = harness(HEALTHY)
    h.log.onChildProcessGone({ type: 'GPU' })
    expect(h.lines).toEqual([
      '[gpu] crash #1 this session',
      `[gpu] feature status at crash: ${formatGpuFeatureStatus(HEALTHY)}`,
    ])
  })

  it('warns instead of throwing when getGPUFeatureStatus fails', () => {
    const warnings: string[] = []
    const log = createGpuStatusLog({
      getFeatureStatus: () => { throw new Error('boom') },
      log: () => {},
      warn: message => warnings.push(message),
    })
    expect(() => log.onGpuInfoUpdate()).not.toThrow()
    expect(() => log.logBaselineIfMissing()).not.toThrow()
    expect(log.onChildProcessGone({ type: 'GPU' })).toBe(1)
    expect(warnings).toEqual([
      '[gpu] getGPUFeatureStatus failed (gpu-info-update): boom',
      '[gpu] getGPUFeatureStatus failed (baseline fallback): boom',
      '[gpu] getGPUFeatureStatus failed (crash): boom',
    ])
  })
})

describe('main.ts wiring (T0533 source guard)', () => {
  const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')

  it('keeps the [CRASH] child-process-gone line unchanged and logs GPU status after it', () => {
    const crashLine = "logger.error(`[CRASH] child-process-gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`)"
    const crashIndex = main.indexOf(crashLine)
    expect(crashIndex).toBeGreaterThan(-1)
    const hookIndex = main.indexOf('gpuStatusLog.onChildProcessGone(details)')
    expect(hookIndex).toBeGreaterThan(crashIndex)
  })

  it('logs the baseline, GPU info, and gpu-info-update changes without awaiting getGPUInfo', () => {
    expect(main).toContain("app.on('gpu-info-update', () => gpuStatusLog.onGpuInfoUpdate())")
    expect(main).toContain('setTimeout(() => gpuStatusLog.logBaselineIfMissing(), GPU_BASELINE_FALLBACK_MS)')
    expect(main).toMatch(/void app\.getGPUInfo\('basic'\)\.then\(/)
    expect(main).not.toMatch(/await app\.getGPUInfo/)
  })
})
