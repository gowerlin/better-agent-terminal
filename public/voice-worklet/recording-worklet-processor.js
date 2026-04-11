/**
 * AudioWorkletProcessor for voice recording.
 *
 * Keep this file as plain JS in /public so Vite copies it as-is for both dev
 * and packaged builds, avoiding .ts asset MIME issues in addModule().
 */
class RecordingWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.messageCount = 0
    this.port.postMessage({ type: 'ready', sampleRate })
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel && channel.length > 0) {
      const copy = new Float32Array(channel.length)
      copy.set(channel)
      this.messageCount += 1
      this.port.postMessage(
        {
          type: 'pcm',
          data: copy,
          count: this.messageCount,
        },
        [copy.buffer],
      )
    }
    return true
  }
}

registerProcessor('recording-worklet-processor', RecordingWorkletProcessor)
