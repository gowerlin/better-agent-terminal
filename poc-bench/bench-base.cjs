// T0237 PoC — benchmark on ggml-base.en.bin (more representative of BAT usage)
// Fair-comparison protocol: warm up GPU once (absorb Vulkan shader cache cost),
// then measure GPU×3 and CPU×3 on the warm runtime.

const path = require('path')
const { transcribe } = require('@kutalia/whisper-node-addon')

const MODEL = path.join(__dirname, 'ggml-base.en.bin')
const WAV = path.join(__dirname, 'jfk.wav')

async function runOnce(useGpu) {
  const t0 = Date.now()
  const result = await transcribe({
    model: MODEL,
    fname_inp: WAV,
    use_gpu: useGpu,
    no_prints: true,
    language: 'en',
  })
  const ms = Date.now() - t0
  const segs = result && typeof result === 'object' && 'transcription' in result ? result.transcription : result
  const text = Array.isArray(segs)
    ? segs.map(s => (Array.isArray(s) ? (s[2] ?? s[0]) : String(s))).join('').trim()
    : ''
  return { ms, text }
}

async function bench(label, useGpu, samples) {
  const runs = []
  for (let i = 0; i < samples; i++) {
    const r = await runOnce(useGpu)
    console.log(`  [${label}] run ${i + 1}: ${r.ms}ms`)
    runs.push(r.ms)
  }
  const avg = runs.reduce((a, b) => a + b, 0) / runs.length
  console.log(`  [${label}] avg=${avg.toFixed(0)}ms min=${Math.min(...runs)}ms`)
  return { runs, avg, min: Math.min(...runs) }
}

;(async () => {
  console.log('Electron:', process.versions.electron, 'ABI:', process.versions.modules)
  console.log('Model: base.en (142MB)  WAV: jfk (11s)')

  console.log('\n--- GPU warm-up (absorb Vulkan shader cache cost) ---')
  await runOnce(true)

  console.log('\n--- GPU (Vulkan) ---')
  const gpu = await bench('GPU', true, 3)

  console.log('\n--- CPU baseline ---')
  const cpu = await bench('CPU', false, 3)

  console.log('\n========== SUMMARY ==========')
  console.log(`CPU avg: ${cpu.avg.toFixed(0)}ms   min: ${cpu.min}ms`)
  console.log(`GPU avg: ${gpu.avg.toFixed(0)}ms   min: ${gpu.min}ms`)
  console.log(`avg speedup: ${(cpu.avg / gpu.avg).toFixed(2)}x`)
  console.log(`min speedup: ${(cpu.min / gpu.min).toFixed(2)}x`)
  const best = cpu.min / gpu.min
  console.log(`verdict (min-vs-min): ${best >= 3 ? '✅ PASS (≥3x)' : `❌ FAIL (<3x, got ${best.toFixed(2)}x)`}`)
  process.exit(0)
})().catch(err => {
  console.error('BENCH FAILED:', err)
  process.exit(1)
})
