// T0239 — Lightweight static GPU capability probe for voice transcription.
//
// Design rationale (see T0239 work order §Q1/Q2/Q3):
//   Q1 = A + hybrid — runtime decision stays with @kutalia/whisper-node-addon's
//        internal auto-detect; BAT adds a *cheap* static probe purely to
//        populate a Settings hint. We deliberately do NOT:
//          * pull in `systeminformation` or similar heavy deps
//          * spawn a probe subprocess (would need a model file + add latency)
//          * parse GGML backend stderr from the native addon
//        The only signals we collect are:
//          * process.platform
//          * Vulkan loader resolvable (via fs.access on well-known paths)
//
//   Q2 = C   — result is advisory only; the transcribe handler still honours
//              `preferences.gpuMode` for the hard decision (auto vs force-cpu).
//
//   Q3 = A   — consumed by VoiceSettingsSection's GPU status subsection.
//
// T0237 findings this module consciously accepts:
//   - Pascal-era GPUs (GTX 1050 Ti etc.) report `fp16: 0` from ggml-vulkan
//     and show no speedup over CPU+OpenBLAS. We can't detect that without
//     parsing the addon's stderr — the hint text simply warns about older
//     GPUs and points users to the 'force-cpu' override.
//
// Result is cached for the lifetime of the process (GPU hardware doesn't
// change at runtime; forcing a re-probe would require a driver reinstall).

import { existsSync } from 'fs'
import * as path from 'path'
import { logger } from './logger'
import type { VoiceGpuMode, VoiceGpuStatus } from '../src/types/voice'

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function normalisePlatform(): VoiceGpuStatus['platform'] {
  const p = process.platform
  if (p === 'darwin') return 'darwin'
  if (p === 'win32') return 'win32'
  if (p === 'linux') return 'linux'
  return 'other'
}

// ---------------------------------------------------------------------------
// Vulkan loader detection
// ---------------------------------------------------------------------------

/**
 * Check if the Vulkan runtime loader library is present on this system.
 *
 * Windows: `vulkan-1.dll` is shipped by GPU drivers (NVIDIA/AMD/Intel) into
 *          %SystemRoot%\System32. Absence strongly suggests no GPU driver
 *          or ancient driver stack.
 *
 * Linux:   `libvulkan.so.1` is provided by the `libvulkan1` package or
 *          packaged with the GPU driver. We probe the standard multiarch
 *          paths used by Debian/Ubuntu/Arch/RHEL.
 *
 * macOS:   Metal is always available on supported macOS versions, so this
 *          check is never invoked for darwin (caller short-circuits).
 *
 * Returns `false` on any access error (ENOENT / EACCES) — conservatively
 * treated as "loader not available".
 */
function probeVulkanLoader(platform: VoiceGpuStatus['platform']): boolean {
  try {
    if (platform === 'win32') {
      // Prefer %SystemRoot% but fall back to the usual default.
      const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
      const candidates = [
        path.join(sysRoot, 'System32', 'vulkan-1.dll'),
        // SysWOW64 is for 32-bit processes — unlikely for Electron 41 (x64)
        // but harmless to check.
        path.join(sysRoot, 'SysWOW64', 'vulkan-1.dll'),
      ]
      for (const c of candidates) {
        if (existsSync(c)) return true
      }
      return false
    }

    if (platform === 'linux') {
      const candidates = [
        '/usr/lib/x86_64-linux-gnu/libvulkan.so.1',     // Debian/Ubuntu multiarch
        '/usr/lib64/libvulkan.so.1',                    // RHEL/Fedora/SUSE
        '/usr/lib/libvulkan.so.1',                      // Arch, fallback
        '/lib/x86_64-linux-gnu/libvulkan.so.1',         // some Debian variants
      ]
      for (const c of candidates) {
        if (existsSync(c)) return true
      }
      return false
    }

    // darwin / other: not relevant
    return false
  } catch (err) {
    logger.warn('[gpu-detector] probeVulkanLoader failed:', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Result composition
// ---------------------------------------------------------------------------

function composeHint(
  platform: VoiceGpuStatus['platform'],
  vulkanLoaderAvailable: boolean,
  userPreference: VoiceGpuMode
): { expectedBackend: VoiceGpuStatus['expectedBackend']; hint: string } {
  // User override always wins.
  if (userPreference === 'force-cpu') {
    return {
      expectedBackend: 'cpu',
      hint: '使用者設定為 CPU-only 模式。語音辨識將使用 CPU + OpenBLAS 路徑。',
    }
  }

  if (platform === 'darwin') {
    return {
      expectedBackend: 'metal',
      hint: 'macOS Metal GPU 加速已啟用(由套件自動偵測)。',
    }
  }

  if (platform === 'win32' || platform === 'linux') {
    if (vulkanLoaderAvailable) {
      return {
        expectedBackend: 'vulkan',
        hint:
          '偵測到 Vulkan driver,GPU 加速將啟用。' +
          '注意:Pascal 世代或更舊的 GPU(例如 GTX 1050 Ti)可能因缺少 fp16 支援而沒有明顯加速,' +
          '如辨識速度不佳可切換為「強制 CPU」模式。',
      }
    }
    return {
      expectedBackend: 'cpu',
      hint:
        '未偵測到 Vulkan driver(系統缺少 vulkan-1.dll / libvulkan.so.1)。' +
        '語音辨識將由套件自動 fallback 到 CPU + OpenBLAS 路徑。' +
        '如預期應有 GPU,請更新顯卡 driver 後重啟 BAT。',
    }
  }

  return {
    expectedBackend: 'cpu',
    hint: `目前平台 (${process.platform}) 未列在 GPU 加速支援範圍,使用 CPU 模式。`,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let cached: { vulkanLoaderAvailable: boolean; platform: VoiceGpuStatus['platform'] } | null = null

function getStaticProbe() {
  if (cached) return cached
  const platform = normalisePlatform()
  // macOS: Metal is always available; skip Vulkan probe.
  const vulkanLoaderAvailable =
    platform === 'darwin' ? false : probeVulkanLoader(platform)
  cached = { platform, vulkanLoaderAvailable }
  logger.log(
    `[gpu-detector] static probe: platform=${platform} vulkanLoader=${vulkanLoaderAvailable}`
  )
  return cached
}

/**
 * Build a fresh GPU status for the renderer UI. Combines the cached static
 * probe with the current user preference (which changes at runtime).
 */
export function getGpuStatus(userPreference: VoiceGpuMode): VoiceGpuStatus {
  const { platform, vulkanLoaderAvailable } = getStaticProbe()
  const { expectedBackend, hint } = composeHint(
    platform,
    vulkanLoaderAvailable,
    userPreference
  )
  const effectiveMode =
    userPreference === 'force-cpu' ? 'cpu-forced' : 'gpu-auto'
  return {
    effectiveMode,
    userPreference,
    platform,
    expectedBackend,
    vulkanLoaderAvailable,
    hint,
  }
}

/**
 * Resolve the `use_gpu` flag passed to @kutalia/whisper-node-addon.
 *
 *   'auto'      → true  (trust package auto-detect; graceful CPU fallback)
 *   'force-cpu' → false (skip GPU path entirely)
 */
export function resolveUseGpu(userPreference: VoiceGpuMode): boolean {
  return userPreference !== 'force-cpu'
}
