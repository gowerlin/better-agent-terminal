const path = require('path');
const { transcribe } = require('whisper-node-addon');

async function main() {
  const modelPath = path.resolve(__dirname, 'models', 'ggml-small.bin');
  const audioPath = path.resolve(__dirname, 'audio-samples', 'zhtw-test.wav');

  console.log('=== Scene 2: Traditional Chinese Offline Transcription ===');
  console.log('Model:', modelPath);
  console.log('Audio:', audioPath);
  console.log('Audio duration: ~4.49s');
  console.log('');

  const startTime = Date.now();

  try {
    const result = await transcribe({
      language: 'zh',
      model: modelPath,
      fname_inp: audioPath,
      use_gpu: false,  // CPU first for baseline
      translate: false,
      no_prints: false,  // show whisper.cpp internal output
    });

    const elapsed = Date.now() - startTime;
    const audioDuration = 4.49; // seconds
    const rtf = (elapsed / 1000) / audioDuration;

    console.log('');
    console.log('=== Results ===');
    console.log('Raw result:', JSON.stringify(result, null, 2));
    console.log('');

    // Extract text
    const fullText = result.map(seg => seg[2] || seg).join('');
    console.log('Transcribed text:', fullText);
    console.log('Expected text: 幫我建立一個新的 agent terminal 並執行 npm run dev');
    console.log('');
    console.log('Elapsed time:', elapsed, 'ms');
    console.log('Audio duration:', audioDuration, 's');
    console.log('RTF (Real-time Factor):', rtf.toFixed(3));
    console.log('RTF < 2.0?', rtf < 2.0 ? 'PASS' : 'FAIL');
    console.log('');
    console.log('Memory:', JSON.stringify(process.memoryUsage()));
  } catch (err) {
    console.error('Transcription failed:', err);
    process.exit(1);
  }
}

main();
