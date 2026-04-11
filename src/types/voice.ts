// Voice input types (T0003 foundation)
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
}

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  modelSize: 'small',
  language: 'zh',
  convertToTraditional: true,
}

export interface VoiceModelDownloadProgress {
  size: WhisperModelSize
  bytesDownloaded: number
  totalBytes: number
  percent: number                    // 0..100
}
