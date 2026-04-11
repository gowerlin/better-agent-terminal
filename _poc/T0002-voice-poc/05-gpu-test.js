const path = require('path');
const { transcribe } = require('whisper-node-addon');

async function runTest(label, useGpu) {
  const modelPath = path.resolve(__dirname, 'models', 'ggml-small.bin');
  const audioPath = path.resolve(__dirname, 'audio-samples', 'zhtw-test.wav');

  console.log(`\n--- ${label} (use_gpu=${useGpu}) ---`);
  const startTime = Date.now();

  const result = await transcribe({
    language: 'zh',
    model: modelPath,
    fname_inp: audioPath,
    use_gpu: useGpu,
    translate: false,
    no_prints: false,  // show GPU detection logs
  });

  const elapsed = Date.now() - startTime;
  const text = result.map(seg => seg[2] || seg).join('');
  console.log(`Result: ${text}`);
  console.log(`Elapsed: ${elapsed}ms`);
  console.log(`RTF: ${(elapsed / 1000 / 4.49).toFixed(3)}`);
  return elapsed;
}

async function main() {
  console.log('=== Scene 5: GPU Acceleration Test ===');
  console.log('Platform:', process.platform);
  console.log('Arch:', process.arch);

  // Check available DLLs for GPU backends
  const fs = require('fs');
  const platformDir = path.join(__dirname, 'node_modules', 'whisper-node-addon', 'platform', 'win32-x64');
  console.log('\nNative files in platform dir:');
  fs.readdirSync(platformDir).forEach(f => console.log('  ' + f));

  // Test 1: CPU only
  const cpuTime = await runTest('CPU Only', false);

  // Test 2: GPU enabled
  const gpuTime = await runTest('GPU Enabled', true);

  console.log('\n=== GPU Test Summary ===');
  console.log(`CPU time: ${cpuTime}ms`);
  console.log(`GPU time: ${gpuTime}ms`);
  const speedup = cpuTime / gpuTime;
  console.log(`Speedup: ${speedup.toFixed(2)}x`);
  console.log(`GPU useful? ${speedup > 1.5 ? 'YES' : 'NO (< 1.5x)'}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
