// Headless test: just check if whisper-node-addon loads in Electron main process
const { app } = require('electron');

app.on('ready', async () => {
  console.log('[electron] App ready');
  console.log('[electron] Electron:', process.versions.electron);
  console.log('[electron] Node:', process.versions.node);
  console.log('[electron] ABI:', process.versions.modules);

  try {
    const whisper = require('whisper-node-addon');
    console.log('[electron] whisper-node-addon loaded successfully');
    console.log('[electron] exports:', Object.keys(whisper));

    // Test actual transcription
    const path = require('path');
    const modelPath = path.resolve(__dirname, '..', 'models', 'ggml-small.bin');
    const audioPath = path.resolve(__dirname, '..', 'audio-samples', 'zhtw-test.wav');

    console.log('[electron] Starting transcription test...');
    const startTime = Date.now();

    const result = await whisper.transcribe({
      language: 'zh',
      model: modelPath,
      fname_inp: audioPath,
      use_gpu: false,
      translate: false,
      no_prints: true,
    });

    const elapsed = Date.now() - startTime;
    const text = result.map(seg => seg[2] || seg).join('');
    console.log('[electron] Transcription result:', text);
    console.log('[electron] Elapsed:', elapsed, 'ms');
    console.log('[electron] PASS: Native addon works in Electron main process');
  } catch (err) {
    console.error('[electron] FAIL:', err.message);
    console.error('[electron] Stack:', err.stack);
  }

  app.quit();
});

app.on('window-all-closed', () => {});
