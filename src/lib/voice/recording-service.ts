// RecordingService — encapsulates the "press to record → get WAV buffer" flow
// for voice input. Consumed by the PromptBox mic button (T0005).
//
// Design notes:
//   - We deliberately avoid `MediaRecorder`: its output is Opus/WebM or OGG
//     depending on platform, neither of which whisper.cpp accepts directly.
//     Instead we tap the raw PCM stream via `AudioContext` and encode WAV
//     ourselves (see wav-encoder.ts). This gives us exact control over the
//     sample rate + bit depth that whisper expects (16 kHz mono 16-bit).
//   - `ScriptProcessorNode` is technically deprecated but remains supported
//     in Electron/Chromium and is far simpler than `AudioWorkletNode` for a
//     single consumer. If the deprecation actually lands in a future Chromium
//     release, swap this out — the surface exposed to callers is stable.
//   - All user-visible state transitions go through `window.electronAPI.debug.log`
//     (never `console.log`) per project logging rules.

import { encodeChunksToWhisperWav } from './wav-encoder'

type RecordingState = 'idle' | 'recording' | 'stopping'

/** Tiny helper to route debug messages through the main process logger when
 *  available, and silently swallow otherwise (e.g. renderer running outside
 *  Electron during a unit test). */
function debugLog(...args: unknown[]): void {
  const api = (globalThis as unknown as { window?: { electronAPI?: { debug?: { log?: (...a: unknown[]) => void } } } }).window
  const log = api?.electronAPI?.debug?.log
  if (typeof log === 'function') log(...args)
}

export class RecordingError extends Error {
  constructor(message: string, public readonly code: 'permission-denied' | 'no-device' | 'unsupported' | 'internal') {
    super(message)
    this.name = 'RecordingError'
  }
}

export class RecordingService {
  private _state: RecordingState = 'idle'
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private chunks: Float32Array[] = []
  private sourceSampleRate = 0

  get state(): RecordingState {
    return this._state
  }

  /** Request microphone permission and start capturing audio. */
  async start(): Promise<void> {
    if (this._state !== 'idle') {
      throw new RecordingError(`RecordingService.start() called in state=${this._state}`, 'internal')
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new RecordingError('navigator.mediaDevices.getUserMedia not available', 'unsupported')
    }

    this._state = 'recording'
    this.chunks = []

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
    } catch (err: unknown) {
      this._state = 'idle'
      const name = (err as { name?: string })?.name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new RecordingError('Microphone permission denied', 'permission-denied')
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        throw new RecordingError('No microphone device found', 'no-device')
      }
      throw new RecordingError(`Microphone access failed: ${(err as Error)?.message ?? String(err)}`, 'internal')
    }

    // Lazy-typed WebKit fallback — Electron on Chromium always has AudioContext.
    const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
      await this.cleanup()
      this._state = 'idle'
      throw new RecordingError('AudioContext not supported in this environment', 'unsupported')
    }

    this.audioContext = new Ctor()
    this.sourceSampleRate = this.audioContext.sampleRate
    this.source = this.audioContext.createMediaStreamSource(this.stream)

    // Buffer size 4096 is a good balance between latency and CPU — roughly
    // 93 ms per chunk at 44.1 kHz. Whisper batches things internally so this
    // has no impact on recognition quality.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (event) => {
      if (this._state !== 'recording') return
      // Clone the channel data — the underlying buffer is reused by the
      // audio engine on the next tick, so we MUST copy to own the memory.
      const input = event.inputBuffer.getChannelData(0)
      const copy = new Float32Array(input.length)
      copy.set(input)
      this.chunks.push(copy)
    }
    this.source.connect(this.processor)
    // ScriptProcessorNode only fires audioprocess events while connected to
    // a destination — connect to the context destination but don't add gain,
    // so nothing is actually audible.
    this.processor.connect(this.audioContext.destination)

    debugLog(`[voice] RecordingService started (sampleRate=${this.sourceSampleRate})`)
  }

  /** Stop recording and return a whisper-ready 16 kHz mono 16-bit WAV. */
  async stop(): Promise<ArrayBuffer> {
    if (this._state !== 'recording') {
      throw new RecordingError(`RecordingService.stop() called in state=${this._state}`, 'internal')
    }
    this._state = 'stopping'
    const sourceSampleRate = this.sourceSampleRate
    const chunks = this.chunks
    await this.cleanup()
    this._state = 'idle'

    const wav = encodeChunksToWhisperWav(chunks, sourceSampleRate)
    debugLog(`[voice] RecordingService stopped (chunks=${chunks.length}, wavBytes=${wav.byteLength})`)
    return wav
  }

  /** Discard the current recording without producing any output. */
  cancel(): void {
    if (this._state === 'idle') return
    void this.cleanup()
    this._state = 'idle'
    this.chunks = []
    debugLog('[voice] RecordingService cancelled')
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.processor) {
        this.processor.disconnect()
        this.processor.onaudioprocess = null
      }
    } catch { /* ignore */ }
    try {
      if (this.source) this.source.disconnect()
    } catch { /* ignore */ }
    try {
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close()
      }
    } catch { /* ignore */ }
    try {
      if (this.stream) {
        for (const track of this.stream.getTracks()) track.stop()
      }
    } catch { /* ignore */ }
    this.processor = null
    this.source = null
    this.audioContext = null
    this.stream = null
  }
}
