// WAV encoder — converts Float32 PCM samples to a 16-bit PCM WAV ArrayBuffer.
//
// Target format (whisper.cpp requires):
//   - 16 kHz sample rate
//   - mono (1 channel)
//   - 16-bit signed PCM (little-endian)
//
// The encoder accepts whatever sample rate the source audio arrived at
// (typically 44.1 kHz or 48 kHz from getUserMedia) and linearly resamples
// down to 16 kHz. Linear resampling is good enough for speech recognition —
// whisper.cpp itself does higher-quality resampling internally for anything
// it receives, but shipping 16 kHz WAV across the IPC boundary keeps the
// transfer size minimal (~32 KB per second vs ~96–192 KB at the raw rate).

const TARGET_SAMPLE_RATE = 16_000

/** Concatenate a list of Float32 chunks into a single Float32Array. */
export function concatFloat32(chunks: Float32Array[]): Float32Array {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

/** Linear downsample from `inputSampleRate` to `TARGET_SAMPLE_RATE`. */
export function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === TARGET_SAMPLE_RATE) return input
  if (inputSampleRate < TARGET_SAMPLE_RATE) {
    // Upsampling is unusual here (most mics run ≥44.1 kHz) but handle it
    // just in case — simple linear interpolation.
    const ratio = TARGET_SAMPLE_RATE / inputSampleRate
    const outLength = Math.floor(input.length * ratio)
    const out = new Float32Array(outLength)
    for (let i = 0; i < outLength; i++) {
      const src = i / ratio
      const lo = Math.floor(src)
      const hi = Math.min(lo + 1, input.length - 1)
      const frac = src - lo
      out[i] = input[lo] * (1 - frac) + input[hi] * frac
    }
    return out
  }
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const src = i * ratio
    const lo = Math.floor(src)
    const hi = Math.min(lo + 1, input.length - 1)
    const frac = src - lo
    out[i] = input[lo] * (1 - frac) + input[hi] * frac
  }
  return out
}

/** Convert Float32 [-1, 1] samples to signed 16-bit PCM. */
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/** Write an ASCII string into a DataView at the given offset. */
function writeString(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
}

/**
 * Encode a mono Float32 PCM buffer as a 16-bit PCM WAV file (RIFF container).
 *
 * Header layout (44 bytes):
 *   0  "RIFF"                         4 bytes
 *   4  file length - 8                uint32 LE
 *   8  "WAVE"                         4 bytes
 *   12 "fmt "                         4 bytes
 *   16 16 (PCM chunk size)            uint32 LE
 *   20 1 (PCM format)                 uint16 LE
 *   22 channels                       uint16 LE
 *   24 sample rate                    uint32 LE
 *   28 byte rate                      uint32 LE
 *   32 block align                    uint16 LE
 *   34 bits per sample                uint16 LE
 *   36 "data"                         4 bytes
 *   40 data length                    uint32 LE
 *   44 <PCM samples>
 */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const pcm = floatTo16BitPCM(samples)
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcm.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)          // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Write PCM samples.
  let offset = 44
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(offset, pcm[i], true)
    offset += 2
  }
  return buffer
}

/**
 * Convenience: take raw Float32 chunks at a source sample rate and produce a
 * 16 kHz mono 16-bit PCM WAV ArrayBuffer ready to ship to the whisper IPC
 * handler.
 */
export function encodeChunksToWhisperWav(chunks: Float32Array[], sourceSampleRate: number): ArrayBuffer {
  const merged = concatFloat32(chunks)
  const resampled = downsampleTo16k(merged, sourceSampleRate)
  return encodeWav(resampled, TARGET_SAMPLE_RATE)
}

export { TARGET_SAMPLE_RATE as WHISPER_TARGET_SAMPLE_RATE }
