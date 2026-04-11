/**
 * AudioWorkletProcessor for voice recording.
 *
 * Runs in AudioWorkletGlobalScope (audio thread), captures mono PCM chunks,
 * and sends them to the main thread via MessagePort.
 */

declare const registerProcessor: (
  name: string,
  processorCtor: new (...args: any[]) => AudioWorkletProcessor,
) => void
declare const sampleRate: number

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

class RecordingWorkletProcessor extends AudioWorkletProcessor {
  private messageCount = 0

  constructor() {
    super()
    this.port.postMessage({ type: 'ready', sampleRate })
  }

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const channel = inputs[0]?.[0]
    if (channel && channel.length > 0) {
      const copy = new Float32Array(channel.length)
      copy.set(channel)
      this.messageCount++
      this.port.postMessage(
        {
          type: 'pcm',
          data: copy,
          count: this.messageCount,
        },
        [copy.buffer as ArrayBuffer],
      )
    }
    return true
  }
}

registerProcessor('recording-worklet-processor', RecordingWorkletProcessor)
