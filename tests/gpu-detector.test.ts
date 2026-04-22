/**
 * Unit tests for electron/gpu-detector.ts (T0239)
 *
 * Run: npx tsx tests/gpu-detector.test.ts
 *
 * Tests focus on the *pure* parts of gpu-detector — `getGpuStatus` result
 * shape and `resolveUseGpu` logic. The static Vulkan loader probe does a
 * real filesystem check against the current machine; we don't mock fs here,
 * so the `expectedBackend` assertion for Windows accepts either 'vulkan'
 * (if vulkan-1.dll is present) or 'cpu' (if not), matching the honest
 * real-world behaviour of the hint system.
 */

import * as assert from 'assert'
import { getGpuStatus, resolveUseGpu } from '../electron/gpu-detector'
import type { VoiceGpuMode } from '../src/types/voice'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ❌ ${name}`)
    console.error(`     ${(e as Error).message}`)
    failed++
  }
}

console.log('\n=== gpu-detector: resolveUseGpu ===')

test('auto mode → true', () => {
  assert.strictEqual(resolveUseGpu('auto'), true)
})

test('force-cpu mode → false', () => {
  assert.strictEqual(resolveUseGpu('force-cpu'), false)
})

console.log('\n=== gpu-detector: getGpuStatus result shape ===')

test('returns an object with all required keys', () => {
  const status = getGpuStatus('auto')
  assert.ok('effectiveMode' in status, 'missing effectiveMode')
  assert.ok('userPreference' in status, 'missing userPreference')
  assert.ok('platform' in status, 'missing platform')
  assert.ok('expectedBackend' in status, 'missing expectedBackend')
  assert.ok('vulkanLoaderAvailable' in status, 'missing vulkanLoaderAvailable')
  assert.ok('hint' in status, 'missing hint')
  assert.ok(typeof status.hint === 'string' && status.hint.length > 0, 'hint must be non-empty string')
})

test('auto mode → effectiveMode=gpu-auto', () => {
  const status = getGpuStatus('auto')
  assert.strictEqual(status.effectiveMode, 'gpu-auto')
  assert.strictEqual(status.userPreference, 'auto')
})

test('force-cpu mode → effectiveMode=cpu-forced, expectedBackend=cpu', () => {
  const status = getGpuStatus('force-cpu')
  assert.strictEqual(status.effectiveMode, 'cpu-forced')
  assert.strictEqual(status.userPreference, 'force-cpu')
  assert.strictEqual(status.expectedBackend, 'cpu')
})

test('force-cpu mode → hint mentions CPU-only', () => {
  const status = getGpuStatus('force-cpu')
  assert.ok(status.hint.includes('CPU'), `hint does not mention CPU: ${status.hint}`)
})

console.log('\n=== gpu-detector: platform classification ===')

test('platform matches process.platform family', () => {
  const status = getGpuStatus('auto')
  const expected =
    process.platform === 'darwin' ? 'darwin' :
    process.platform === 'win32'  ? 'win32'  :
    process.platform === 'linux'  ? 'linux'  : 'other'
  assert.strictEqual(status.platform, expected)
})

console.log('\n=== gpu-detector: platform-specific hint behaviour ===')

if (process.platform === 'darwin') {
  test('darwin + auto → expectedBackend=metal', () => {
    const status = getGpuStatus('auto')
    assert.strictEqual(status.expectedBackend, 'metal')
    assert.ok(status.hint.toLowerCase().includes('metal'))
  })
} else if (process.platform === 'win32' || process.platform === 'linux') {
  test('win32/linux + auto → expectedBackend is vulkan or cpu', () => {
    const status = getGpuStatus('auto')
    assert.ok(
      status.expectedBackend === 'vulkan' || status.expectedBackend === 'cpu',
      `expectedBackend must be vulkan or cpu on ${process.platform}, got: ${status.expectedBackend}`
    )
  })

  test('win32/linux + auto → vulkanLoaderAvailable correlates with expectedBackend', () => {
    const status = getGpuStatus('auto')
    if (status.vulkanLoaderAvailable) {
      assert.strictEqual(status.expectedBackend, 'vulkan')
    } else {
      assert.strictEqual(status.expectedBackend, 'cpu')
    }
  })

  test('win32/linux + no-vulkan hint mentions CPU fallback', () => {
    const status = getGpuStatus('auto')
    if (!status.vulkanLoaderAvailable) {
      assert.ok(
        status.hint.includes('CPU') || status.hint.includes('cpu'),
        `hint should mention CPU fallback when vulkan loader missing: ${status.hint}`
      )
    } else {
      // Has vulkan → hint should mention Vulkan OR GPU acceleration
      assert.ok(
        status.hint.includes('Vulkan') || status.hint.includes('GPU'),
        `hint should mention Vulkan/GPU when loader present: ${status.hint}`
      )
    }
  })
}

console.log('\n=== gpu-detector: cache behaviour (process-lifetime) ===')

test('repeated calls with same mode return consistent platform/vulkan result', () => {
  const a = getGpuStatus('auto')
  const b = getGpuStatus('auto')
  assert.strictEqual(a.platform, b.platform)
  assert.strictEqual(a.vulkanLoaderAvailable, b.vulkanLoaderAvailable)
})

test('switching userPreference updates effectiveMode without re-probing vulkan', () => {
  const autoResult = getGpuStatus('auto')
  const cpuResult = getGpuStatus('force-cpu')
  assert.strictEqual(autoResult.vulkanLoaderAvailable, cpuResult.vulkanLoaderAvailable)
  assert.notStrictEqual(autoResult.effectiveMode, cpuResult.effectiveMode)
})

console.log('\n=== gpu-detector: invalid userPreference is rejected by type system ===')
// Compile-time guarantee — runtime check just documents the contract.
test('only "auto" and "force-cpu" are valid VoiceGpuMode values', () => {
  const validModes: VoiceGpuMode[] = ['auto', 'force-cpu']
  for (const m of validModes) {
    const s = getGpuStatus(m)
    assert.ok(s.effectiveMode === 'gpu-auto' || s.effectiveMode === 'cpu-forced')
  }
})

console.log(`\nResults: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
