// RecordingService — encapsulates the "press to record → get WAV buffer" flow
// for voice input. Consumed by the PromptBox mic button (T0005).
//
// Design notes:
//   - We deliberately avoid `MediaRecorder`: its output is Opus/WebM or OGG
//     depending on platform, neither of which whisper.cpp accepts directly.
//     Instead we tap the raw PCM stream via `AudioContext` and encode WAV
//     ourselves (see wav-encoder.ts). This gives us exact control over the
//     sample rate + bit depth that whisper expects (16 kHz mono 16-bit).
//   - We capture PCM through `AudioWorkletNode` so audio processing runs on the
//     audio thread and sends chunks back via `MessagePort`.
//   - All user-visible state transitions go through `window.electronAPI.debug.log`
//     (never `console.log`) per project logging rules.

import { encodeChunksToWhisperWav } from './wav-encoder'

const recordingWorkletUrl = new URL(
  './recording-worklet-processor.ts',
  import.meta.url,
).href

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
  private workletNode: AudioWorkletNode | null = null
  private audioprocessTickCount = 0
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
    this.audioprocessTickCount = 0
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
    debugLog('[voice:checkpoint] getUserMedia ok')

    // Lazy-typed WebKit fallback — Electron on Chromium always has AudioContext.
    const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
      await this.cleanup()
      this._state = 'idle'
      throw new RecordingError('AudioContext not supported in this environment', 'unsupported')
    }
    debugLog('[voice:checkpoint] AudioContext ctor resolved')

    this.audioContext = new Ctor()
    this.sourceSampleRate = this.audioContext.sampleRate
    debugLog(`[voice:checkpoint] AudioContext created sampleRate=${this.sourceSampleRate}`)
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    debugLog('[voice:checkpoint] source node created')

    try {
      await this.audioContext.audioWorklet.addModule(recordingWorkletUrl)
    } catch (err: unknown) {
      const message = (err as Error)?.message ?? String(err)
      debugLog(`[voice] audioWorklet.addModule failed: ${message}`)
      await this.cleanup()
      this._state = 'idle'
      throw new RecordingError(`Failed to load recording worklet: ${message}`, 'internal')
    }
    debugLog('[voice:checkpoint] worklet module loaded')

    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      'recording-worklet-processor',
      {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      },
    )
    debugLog('[voice:checkpoint] worklet node created')

    this.workletNode.port.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as {
        type?: unknown
        sampleRate?: unknown
        data?: unknown
        count?: unknown
      }
      if (message?.type === 'ready') {
        debugLog(`[voice:checkpoint] worklet ready sampleRate=${String(message.sampleRate)}`)
        return
      }
      if (message?.type === 'pcm' && message.data instanceof Float32Array) {
        const count = typeof message.count === 'number'
          ? message.count
          : this.audioprocessTickCount + 1
        this.audioprocessTickCount = count
        if (count <= 10 || count % 50 === 0) {
          debugLog(`[voice:checkpoint] worklet message #${count}`)
        }
        if (this._state !== 'recording') return
        this.chunks.push(message.data)
      }
    }
    this.source.connect(this.workletNode)
    debugLog('[voice:checkpoint] source→worklet connected')

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
      if (this.workletNode) {
        this.workletNode.port.onmessage = null
        this.workletNode.port.close()
        this.workletNode.disconnect()
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
    this.workletNode = null
    this.source = null
    this.audioContext = null
    this.stream = null
  }
}
