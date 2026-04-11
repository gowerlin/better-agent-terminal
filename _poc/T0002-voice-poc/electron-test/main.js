const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { transcribe } = require('whisper-node-addon');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('renderer.html');
  console.log('[main] Window created');
}

ipcMain.handle('transcribe', async () => {
  const modelPath = path.resolve(__dirname, '..', 'models', 'ggml-small.bin');
  const audioPath = path.resolve(__dirname, '..', 'audio-samples', 'zhtw-test.wav');

  console.log('[main] Starting transcription...');
  console.log('[main] Model:', modelPath);
  console.log('[main] Audio:', audioPath);

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
    const text = result.map(seg => seg[2] || seg).join('');

    console.log('[main] Transcription done in', elapsed, 'ms');
    console.log('[main] Result:', text);

    return { success: true, text, elapsed };
  } catch (err) {
    console.error('[main] Transcription error:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  console.log('[main] Electron app ready');
  console.log('[main] Electron version:', process.versions.electron);
  console.log('[main] Node version:', process.versions.node);
  console.log('[main] Chrome version:', process.versions.chrome);
  createWindow();
});

app.on('window-all-closed', () => app.quit());
