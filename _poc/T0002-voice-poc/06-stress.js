const path = require('path');
const { transcribe } = require('whisper-node-addon');

const ROUNDS = 3; // 3 rounds (workorder says we can reduce from 5 if time is tight)
const modelPath = path.resolve(__dirname, 'models', 'ggml-small.bin');
const audioPath = path.resolve(__dirname, 'audio-samples', 'long-mixed.wav');
const AUDIO_DURATION = 62.7; // seconds

async function main() {
  console.log('=== Scene 6: Stability Stress Test ===');
  console.log(`Rounds: ${ROUNDS}`);
  console.log(`Audio: ${audioPath} (${AUDIO_DURATION}s, zh-TW + English mixed)`);
  console.log('');

  const results = [];
  const memSnapshots = [];

  for (let i = 1; i <= ROUNDS; i++) {
    const memBefore = process.memoryUsage();
    console.log(`--- Round ${i}/${ROUNDS} ---`);
    console.log(`Memory before: RSS=${(memBefore.rss / 1024 / 1024).toFixed(1)}MB, Heap=${(memBefore.heapUsed / 1024 / 1024).toFixed(1)}MB`);

    const startTime = Date.now();

    try {
      const result = await transcribe({
        language: 'zh',
        model: modelPath,
        fname_inp: audioPath,
        use_gpu: false,
        translate: false,
        no_prints: true,
      });

      const elapsed = Date.now() - startTime;
      const rtf = (elapsed / 1000) / AUDIO_DURATION;
      const text = result.map(seg => seg[2] || seg).join('');

      const memAfter = process.memoryUsage();
      memSnapshots.push({
        round: i,
        rss: memAfter.rss,
        heapUsed: memAfter.heapUsed,
      });

      results.push({ round: i, elapsed, rtf, textLen: text.length, success: true });

      console.log(`Elapsed: ${elapsed}ms | RTF: ${rtf.toFixed(3)}`);
      console.log(`Text length: ${text.length} chars`);
      console.log(`Text preview: ${text.substring(0, 80)}...`);
      console.log(`Memory after: RSS=${(memAfter.rss / 1024 / 1024).toFixed(1)}MB, Heap=${(memAfter.heapUsed / 1024 / 1024).toFixed(1)}MB`);
      console.log('');
    } catch (err) {
      results.push({ round: i, elapsed: Date.now() - startTime, success: false, error: err.message });
      console.error(`Round ${i} FAILED:`, err.message);
    }
  }

  // Summary
  console.log('=== Stress Test Summary ===');
  console.log('');

  const successRounds = results.filter(r => r.success);
  const failedRounds = results.filter(r => !r.success);

  console.log(`Total rounds: ${ROUNDS}`);
  console.log(`Successful: ${successRounds.length}`);
  console.log(`Failed: ${failedRounds.length}`);
  console.log('');

  if (successRounds.length > 0) {
    const times = successRounds.map(r => r.elapsed);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const variance = ((maxTime - minTime) / avgTime * 100).toFixed(1);

    console.log(`Avg time: ${avgTime.toFixed(0)}ms`);
    console.log(`Min/Max: ${minTime}ms / ${maxTime}ms`);
    console.log(`Variance: ${variance}%`);
    console.log(`Variance < 30%? ${parseFloat(variance) < 30 ? 'PASS' : 'FAIL'}`);
  }

  if (memSnapshots.length >= 2) {
    const firstRss = memSnapshots[0].rss;
    const lastRss = memSnapshots[memSnapshots.length - 1].rss;
    const rssGrowth = ((lastRss - firstRss) / firstRss * 100).toFixed(1);

    console.log('');
    console.log('Memory analysis:');
    memSnapshots.forEach(m => {
      console.log(`  Round ${m.round}: RSS=${(m.rss / 1024 / 1024).toFixed(1)}MB, Heap=${(m.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    });
    console.log(`RSS growth: ${rssGrowth}%`);
    console.log(`Memory stable? ${Math.abs(parseFloat(rssGrowth)) < 50 ? 'PASS' : 'WARN (growing)'}`);
  }

  console.log('');
  console.log(`All rounds passed? ${failedRounds.length === 0 ? 'PASS' : 'FAIL'}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
