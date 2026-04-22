// T0237 PoC — @kutalia/whisper-node-addon Vulkan vs CPU benchmark
// Runs under Electron 41 (set ELECTRON_RUN_AS_NODE=1)
// Usage: ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron poc-bench/bench.cjs

const path = require('path')

const { transcribe } = require('@kutalia/whisper-node-addon')

const MODEL = path.join(__dirname, 'ggml-tiny.en.bin')
const WAV = path.join(__dirname, 'jfk.wav')
const SAMPLES = 3

async function runOnce(useGpu) {
  const t0 = Date.now()
  const result = await transcribe({
    model: MODEL,
    fname_inp: WAV,
    use_gpu: useGpu,
    no_prints: false,      // keep whisper logs on — we need to see backend selection
    language: 'en',
  })
  const ms = Date.now() - t0
  const segments = result && typeof result === 'object' && 'transcription' in result
    ? result.transcription
    : result
  const text = Array.isArray(segments)
    ? segments.map(s => (Array.isArray(s) ? (s[2] ?? s[0]) : String(s))).join('').trim()
    : ''
  return { ms, text }
}

async function bench(label, useGpu) {
  console.log(`\n========== ${label} (use_gpu=${useGpu}) ==========`)
  const runs = []
  for (let i = 0; i < SAMPLES; i++) {
    const r = await runOnce(useGpu)
    console.log(`  [${label}] run ${i + 1}: ${r.ms}ms  text="${r.text.slice(0, 80)}..."`)
    runs.push(r.ms)
  }
  const avg = runs.reduce((a, b) => a + b, 0) / runs.length
  console.log(`  [${label}] avg: ${avg.toFixed(0)}ms  (runs: ${runs.join(', ')}ms)`)
  return { label, useGpu, runs, avg }
}

;(async () => {
  console.log('Node:', process.versions.node, 'Electron:', process.versions.electron, 'ABI:', process.versions.modules)
  console.log('Platform:', process.platform, process.arch)
  console.log('Model:', MODEL)
  console.log('WAV:', WAV)

  const gpu = await bench('GPU (Vulkan auto-detect)', true)
  const cpu = await bench('CPU baseline', false)

  const speedup = cpu.avg / gpu.avg
  console.log('\n========== SUMMARY ==========')
  console.log(`CPU avg: ${cpu.avg.toFixed(0)}ms`)
  console.log(`GPU avg: ${gpu.avg.toFixed(0)}ms`)
  console.log(`Speedup: ${speedup.toFixed(2)}x ${speedup >= 3 ? '✅ PASS (≥3x)' : '❌ FAIL (<3x)'}`)

  process.exit(0)
})().catch(err => {
  console.error('BENCH FAILED:', err)
  process.exit(1)
})
