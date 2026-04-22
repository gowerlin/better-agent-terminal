// Voice input types (T0003 foundation; T0239 adds GPU detection fields)
//
// These types define the IPC contract between renderer and main process for
// the voice input feature. The main process currently returns mock data for
// most handlers (T0003) — T0004 will replace mock transcription / model
// management with real whisper-node-addon integration.
//
// Design constraints (from T0001 research + T0002 PoC):
//   - Phase 1 uses file-based whisper: no streaming, no partial results
//   - Transcription is a single request/response (not streaming)
//   - Preferences are persisted in userData/voice-preferences.json
//   - Models live in userData/whisper-models/ggml-<size>.bin (convention)
//   - whisper outputs simplified Chinese for language='zh' — convertToTraditional
//     is reserved in the type system but handled by T0004 (OpenCC integration)

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium'

export type VoiceLanguage = 'zh' | 'en' | 'auto'

/**
 * T0239 — User-controlled GPU acceleration mode.
 *
 * - 'auto'      : trust @kutalia/whisper-node-addon's internal auto-detect
 *                 (probes Metal on macOS, Vulkan on Win/Linux, falls back to CPU+OpenBLAS)
 * - 'force-cpu' : always pass use_gpu=false (for users with suboptimal GPUs
 *                 where Vulkan fp32 fallback is no faster than OpenBLAS CPU path)
 */
export type VoiceGpuMode = 'auto' | 'force-cpu'

export interface VoiceModelInfo {
  size: WhisperModelSize
  displayName: string       // e.g. 'Small (466 MB, 推薦)'
  diskSize: number          // bytes
  downloaded: boolean
  path?: string             // populated only when downloaded
}

export interface VoiceTranscribeOptions {
  modelSize?: WhisperModelSize       // defaults to user preference
  language?: VoiceLanguage           // defaults to user preference
  convertToTraditional?: boolean     // reserved; T0004 handles actual conversion
  initialPrompt?: string             // optional prompt engineering hint
}

export interface VoiceTranscribeResult {
  text: string
  detectedLanguage?: string          // e.g. 'zh', 'en' — from whisper auto-detect
  durationMs: number                 // audio length
  inferenceTimeMs: number            // transcription time
  isMock?: boolean                   // T0003 mock marker; removed once T0004 ships
}

export interface VoicePreferences {
  modelSize: WhisperModelSize
  language: VoiceLanguage
  convertToTraditional: boolean
  /** T0239 — auto-detect GPU or force CPU-only. Defaults to 'auto'. */
  gpuMode: VoiceGpuMode
}

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  modelSize: 'small',
  language: 'zh',
  convertToTraditional: true,
  gpuMode: 'auto',
}

export interface VoiceModelDownloadProgress {
  size: WhisperModelSize
  bytesDownloaded: number
  totalBytes: number
  percent: number                    // 0..100
}

/**
 * T0239 — Result of static GPU capability probe performed at main-process
 * startup. This is a *lightweight* hint for the Settings UI only; the actual
 * runtime decision is still made by @kutalia/whisper-node-addon's internal
 * auto-detect (or forced CPU when preferences.gpuMode === 'force-cpu').
 *
 * Design constraints (see T0239 work order §Q1/Q2/Q3):
 *   - Q1.A+hybrid: no heavy `systeminformation` dependency, no probe
 *     subprocess. Only cheap platform + Vulkan-loader checks.
 *   - Q2.C:  never auto-block the GPU path; surface a hint instead.
 *   - Q3.A:  shown in Settings, not as a toast.
 *
 * Note: fp16 / matrix-core detection is NOT attempted — it would require
 * parsing GGML backend stderr from a native addon, which is outside this
 * work order's sizing. Users on Pascal-era GPUs (e.g. GTX 1050 Ti, see
 * T0237 findings) can manually switch to 'force-cpu' if Vulkan fp32
 * fallback doesn't give them a speed-up.
 */
export interface VoiceGpuStatus {
  /** Effective mode after resolving user preference. */
  effectiveMode: 'gpu-auto' | 'cpu-forced'
  /** 'auto' trusts package detection; 'force-cpu' overrides it. */
  userPreference: VoiceGpuMode
  /** Runtime platform reported by os.platform(). */
  platform: 'darwin' | 'win32' | 'linux' | 'other'
  /**
   * Backend that Kutalia's auto-detect is *most likely* to pick when
   * gpuMode='auto'. NOT a guarantee — the addon's decision wins at runtime.
   *   - 'metal'  : macOS, always available via Apple-provided Metal framework
   *   - 'vulkan' : Vulkan loader detected on Win/Linux
   *   - 'cpu'    : no Vulkan loader found (or force-cpu)
   */
  expectedBackend: 'metal' | 'vulkan' | 'cpu'
  /** True if the Vulkan runtime loader is resolvable on this system. */
  vulkanLoaderAvailable: boolean
  /**
   * One-line human-readable hint for the Settings UI. Always present.
   * Examples:
   *   - "macOS Metal 加速啟用"
   *   - "偵測到 Vulkan,GPU 加速啟用。注意:Pascal 世代或更舊的 GPU 可能不顯著加速"
   *   - "未偵測到 Vulkan driver,將以 CPU 模式執行"
   *   - "使用者設定為 CPU-only"
   */
  hint: string
}
