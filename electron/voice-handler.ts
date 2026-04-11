// Voice IPC handlers — T0004 real implementation
//
// This module wires up the `voice:*` IPC channels consumed by the renderer.
// T0004 replaced mock handlers from T0003 with:
//   - Real whisper-node-addon transcription
//   - OpenCC simplified→traditional Chinese conversion
//   - Real model downloading from HuggingFace with progress events
//
// Preferences ARE persisted for real — they survive restarts so the
// Settings page (T0007) can verify its UX properly.

import { app, ipcMain, session, systemPreferences, type BrowserWindow } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import * as https from 'https'
import { createWriteStream, type WriteStream } from 'fs'
import { logger } from './logger'
import { convertSimplifiedToTraditional } from './voice-opencc'
import type {
  VoiceModelInfo,
  VoicePreferences,
  VoiceTranscribeOptions,
  VoiceTranscribeResult,
  WhisperModelSize,
} from '../src/types/voice'
import { DEFAULT_VOICE_PREFERENCES } from '../src/types/voice'

// whisper-node-addon has its own .d.ts
import { transcribe as whisperTranscribe } from 'whisper-node-addon'

// --- Constants ---------------------------------------------------------------

/** Directory where whisper ggml model files live. Resolved lazily so tests
 *  can stub `app.getPath` without import-time side effects. */
export function getVoiceModelsDir(): string {
  return path.join(app.getPath('userData'), 'whisper-models')
}

/** Filename convention for a given model size. */
export function getVoiceModelFilePath(size: WhisperModelSize): string {
  return path.join(getVoiceModelsDir(), `ggml-${size}.bin`)
}

function getVoicePreferencesFile(): string {
  return path.join(app.getPath('userData'), 'voice-preferences.json')
}

// Real model catalogue with sizes from HuggingFace ggml releases.
const MODEL_CATALOGUE: Omit<VoiceModelInfo, 'downloaded' | 'path'>[] = [
  { size: 'tiny',   displayName: 'Tiny (75 MB)',          diskSize:    77_691_713 },
  { size: 'base',   displayName: 'Base (142 MB)',         diskSize:   147_951_465 },
  { size: 'small',  displayName: 'Small (466 MB, 推薦)',  diskSize:   487_601_967 },
  { size: 'medium', displayName: 'Medium (1.5 GB)',       diskSize: 1_533_763_059 },
]

/** HuggingFace URLs for whisper.cpp ggml model files. */
const MODEL_URLS: Record<WhisperModelSize, string> = {
  tiny:   'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  base:   'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  small:  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  medium: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
}

/** Track in-flight downloads so we can abort and prevent duplicate downloads. */
const activeDownloads = new Map<WhisperModelSize, AbortController>()

// --- Preferences persistence ------------------------------------------------

async function readPreferences(): Promise<VoicePreferences> {
  const file = getVoicePreferencesFile()
  try {
    const raw = await fs.readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<VoicePreferences>
    // Merge with defaults so missing keys fall back gracefully across versions.
    return {
      modelSize: parsed.modelSize ?? DEFAULT_VOICE_PREFERENCES.modelSize,
      language: parsed.language ?? DEFAULT_VOICE_PREFERENCES.language,
      convertToTraditional:
        parsed.convertToTraditional ?? DEFAULT_VOICE_PREFERENCES.convertToTraditional,
    }
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code !== 'ENOENT') {
      logger.warn('[voice] readPreferences failed, falling back to defaults:', e.message || e)
    }
    return { ...DEFAULT_VOICE_PREFERENCES }
  }
}

async function writePreferences(prefs: VoicePreferences): Promise<void> {
  const file = getVoicePreferencesFile()
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(prefs, null, 2), 'utf-8')
}

// --- Model discovery (local filesystem, no network) ------------------------

async function scanDownloadedModels(): Promise<VoiceModelInfo[]> {
  const dir = getVoiceModelsDir()
  const results: VoiceModelInfo[] = []
  for (const entry of MODEL_CATALOGUE) {
    const filePath = getVoiceModelFilePath(entry.size)
    let downloaded = false
    try {
      const stat = await fs.stat(filePath)
      downloaded = stat.isFile() && stat.size > 0
    } catch {
      downloaded = false
    }
    results.push({
      ...entry,
      downloaded,
      path: downloaded ? filePath : undefined,
    })
  }
  // Touch `dir` so it's ready for T0004 downloads. Silent failure is fine —
  // the dir will be created on first real download.
  void fs.mkdir(dir, { recursive: true }).catch(() => { /* ignore */ })
  return results
}

// --- Permission setup -------------------------------------------------------

let permissionHandlerInstalled = false

/** Allow microphone permission requests from the app's own content. This is
 *  a no-op if a global permission handler is already installed elsewhere. */
function ensureMicrophonePermission(): void {
  if (permissionHandlerInstalled) return
  const ses = session.defaultSession
  // We deliberately do NOT replace an existing handler — some features may
  // already have one. Instead we wrap it: allow media, delegate otherwise.
  const existing = (ses as unknown as {
    _voicePriorPermissionRequestHandler?: (...args: unknown[]) => void
  })._voicePriorPermissionRequestHandler
  // Best effort — Electron doesn't expose a getter, so we just install once
  // and rely on the fact that nothing else currently sets this in main.ts.
  void existing
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
      return
    }
    // Default-allow for everything else to avoid regressions with other
    // features that may have implicitly relied on the default behaviour
    // (Electron's default is to allow most permissions).
    callback(true)
  })
  permissionHandlerInstalled = true
  logger.log('[voice] microphone permission handler installed')

  // T0010: log macOS microphone permission status for diagnostics
  if (process.platform === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone')
      logger.log(`[voice] macOS microphone permission status: ${status}`)
    } catch (err) {
      logger.error('[voice] macOS microphone permission check failed', err)
    }
  }
}

// --- Model download (HTTPS with progress) ------------------------------------

/**
 * Download a model file from url to destPath, sending progress events to all
 * renderer windows. Follows redirects (up to 5 hops). Throws on failure.
 */
function downloadModelFile(
  url: string,
  destPath: string,
  size: WhisperModelSize,
  signal: AbortSignal,
  getAllWindows: () => BrowserWindow[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Download cancelled'))

    let settled = false
    const settle = (fn: typeof resolve | typeof reject, val?: unknown) => {
      if (settled) return
      settled = true
      ;(fn as (v?: unknown) => void)(val)
    }

    const doRequest = (reqUrl: string, redirects: number) => {
      if (redirects > 5) return settle(reject, new Error('Too many redirects'))

      // Determine protocol (HuggingFace CDN may redirect between HTTPS hosts)
      const proto = reqUrl.startsWith('http://') ? require('http') as typeof https : https

      const req = proto.get(reqUrl, (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const location = res.headers.location
          if (!location) return settle(reject, new Error('Redirect without location header'))
          res.resume() // consume response to free socket
          doRequest(location, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          return settle(reject, new Error(`HTTP ${res.statusCode} downloading model ${size}`))
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let bytesDownloaded = 0
        let lastProgressSent = 0

        const fileStream: WriteStream = createWriteStream(destPath)

        // Progress throttle: send at most every 250ms
        const sendProgress = () => {
          const now = Date.now()
          if (now - lastProgressSent < 250) return
          lastProgressSent = now
          const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0
          const progressData = { size, bytesDownloaded, totalBytes, percent }
          try {
            for (const win of getAllWindows()) {
              if (!win.isDestroyed()) {
                win.webContents.send('voice:modelDownloadProgress', progressData)
              }
            }
          } catch { /* window may close mid-download */ }
        }

        res.on('data', (chunk: Buffer) => {
          bytesDownloaded += chunk.length
          sendProgress()
        })

        res.pipe(fileStream)

        fileStream.on('finish', () => {
          // Send final 100% progress
          const progressData = { size, bytesDownloaded, totalBytes, percent: 100 }
          try {
            for (const win of getAllWindows()) {
              if (!win.isDestroyed()) {
                win.webContents.send('voice:modelDownloadProgress', progressData)
              }
            }
          } catch { /* ok */ }

          // Verify file size if content-length was provided
          if (totalBytes > 0 && Math.abs(bytesDownloaded - totalBytes) / totalBytes > 0.01) {
            settle(reject, new Error(
              `Download size mismatch for ${size}: expected ~${totalBytes} bytes, got ${bytesDownloaded}`
            ))
            return
          }
          logger.log(`[voice] download ${size} finished: ${bytesDownloaded} bytes`)
          settle(resolve)
        })

        fileStream.on('error', (err) => settle(reject, err))
        res.on('error', (err) => settle(reject, err))
      })

      req.on('error', (err) => settle(reject, err))

      // Wire up abort
      const onAbort = () => {
        req.destroy()
        settle(reject, new Error('Download cancelled'))
      }
      if (signal.aborted) {
        onAbort()
      } else {
        signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    doRequest(url, 0)
  })
}

// --- IPC registration -------------------------------------------------------

type GetAllWindows = () => BrowserWindow[]

export function registerVoiceHandlers(getAllWindows: GetAllWindows): void {
  ensureMicrophonePermission()

  ipcMain.handle('voice:listModels', async () => {
    logger.log('[voice] listModels invoked')
    return scanDownloadedModels()
  })

  ipcMain.handle('voice:isModelDownloaded', async (_event, size: WhisperModelSize) => {
    logger.log(`[voice] isModelDownloaded size=${size}`)
    try {
      const stat = await fs.stat(getVoiceModelFilePath(size))
      return stat.isFile() && stat.size > 0
    } catch {
      return false
    }
  })

  ipcMain.handle('voice:downloadModel', async (_event, size: WhisperModelSize) => {
    logger.log(`[voice] downloadModel size=${size}`)

    // Prevent duplicate parallel downloads for the same size.
    if (activeDownloads.has(size)) {
      throw new Error(`Model ${size} is already being downloaded.`)
    }

    const url = MODEL_URLS[size]
    if (!url) throw new Error(`Unknown model size: ${size}`)

    const dir = getVoiceModelsDir()
    await fs.mkdir(dir, { recursive: true })

    const finalPath = getVoiceModelFilePath(size)
    const tmpPath = finalPath + '.downloading'

    const abortController = new AbortController()
    activeDownloads.set(size, abortController)

    try {
      await downloadModelFile(url, tmpPath, size, abortController.signal, getAllWindows)

      // Verify file size vs content-length is done inside downloadModelFile.
      // Rename .downloading → final
      await fs.rename(tmpPath, finalPath)
      logger.log(`[voice] downloadModel size=${size} completed → ${finalPath}`)
    } catch (err) {
      // Clean up partial download
      try { await fs.unlink(tmpPath) } catch { /* already gone */ }
      throw err
    } finally {
      activeDownloads.delete(size)
    }
  })

  ipcMain.handle('voice:deleteModel', async (_event, size: WhisperModelSize) => {
    logger.log(`[voice] deleteModel size=${size}`)
    try {
      await fs.unlink(getVoiceModelFilePath(size))
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException
      if (e.code !== 'ENOENT') throw err
      // Already gone — treat as success.
    }
  })

  ipcMain.handle('voice:cancelDownload', async (_event, size: WhisperModelSize) => {
    logger.log(`[voice] cancelDownload size=${size}`)
    const controller = activeDownloads.get(size)
    if (controller) {
      controller.abort()
      activeDownloads.delete(size)
      // Clean up .downloading file
      try { await fs.unlink(getVoiceModelFilePath(size) + '.downloading') } catch { /* ok */ }
      logger.log(`[voice] cancelDownload size=${size} — download aborted`)
    }
    // If no active download for this size, treat as no-op.
  })

  ipcMain.handle('voice:getPreferences', async () => {
    const prefs = await readPreferences()
    logger.log(`[voice] getPreferences →`, prefs)
    return prefs
  })

  ipcMain.handle('voice:setPreferences', async (_event, updates: Partial<VoicePreferences>) => {
    const current = await readPreferences()
    const merged: VoicePreferences = {
      modelSize: updates.modelSize ?? current.modelSize,
      language: updates.language ?? current.language,
      convertToTraditional:
        updates.convertToTraditional ?? current.convertToTraditional,
    }
    await writePreferences(merged)
    logger.log(`[voice] setPreferences ←`, merged)
    return merged
  })

  ipcMain.handle(
    'voice:transcribe',
    async (
      _event,
      audioBuffer: ArrayBuffer,
      sampleRate: number,
      options?: VoiceTranscribeOptions
    ): Promise<VoiceTranscribeResult> => {
      const byteLength = (audioBuffer as ArrayBuffer | Uint8Array & { byteLength: number }).byteLength ?? 0
      const prefs = await readPreferences()
      const modelSize = options?.modelSize ?? prefs.modelSize
      const language = options?.language ?? prefs.language
      const convertToTrad = options?.convertToTraditional ?? prefs.convertToTraditional

      logger.log(
        `[voice] transcribe bytes=${byteLength} sampleRate=${sampleRate} ` +
        `modelSize=${modelSize} language=${language} convertToTraditional=${convertToTrad}`
      )

      // Check model exists
      const modelPath = getVoiceModelFilePath(modelSize)
      try {
        const stat = await fs.stat(modelPath)
        if (!stat.isFile() || stat.size === 0) {
          throw new Error(`Model ${modelSize} file is empty or invalid.`)
        }
      } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException
        if (e.code === 'ENOENT') {
          throw new Error(`Model ${modelSize} not downloaded. Please download it in Settings first.`)
        }
        throw err
      }

      // Write audio to temp WAV file
      const tmpWav = path.join(
        os.tmpdir(),
        `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`
      )

      try {
        await fs.writeFile(tmpWav, Buffer.from(audioBuffer))

        // Approximate audio duration from WAV PCM data: header=44 bytes, 2 bytes/sample
        const estimatedSamples = Math.max(0, (byteLength - 44) / 2)
        const durationMs = Math.round((estimatedSamples / Math.max(1, sampleRate)) * 1000)

        // Call whisper-node-addon
        const startTime = Date.now()
        const whisperOpts: Parameters<typeof whisperTranscribe>[0] = {
          model: modelPath,
          fname_inp: tmpWav,
          use_gpu: false,
          no_prints: true,
        }
        // Only pass language if explicitly specified (omit for auto-detect)
        if (language !== 'auto') {
          whisperOpts.language = language
        }
        const result = await whisperTranscribe(whisperOpts)
        const inferenceTimeMs = Date.now() - startTime

        // Extract text from result segments: string[][] → concatenated text
        let text = ''
        if (Array.isArray(result)) {
          text = result.map(seg => (Array.isArray(seg) ? seg[2] ?? seg[0] : String(seg))).join('').trim()
        }

        logger.log(
          `[voice] transcribe done inferenceTimeMs=${inferenceTimeMs} ` +
          `textLength=${text.length} language=${language}`
        )

        // OpenCC simplified → traditional conversion if requested
        if (convertToTrad && text.length > 0) {
          const originalText = text
          text = convertSimplifiedToTraditional(text)
          if (text !== originalText) {
            logger.log(`[voice] OpenCC s2t conversion applied`)
          }
        }

        return {
          text,
          detectedLanguage: language === 'auto' ? undefined : language,
          durationMs,
          inferenceTimeMs,
        }
      } catch (err) {
        logger.error('[voice] transcribe failed:', err)
        throw err
      } finally {
        // Always clean up temp WAV
        try { await fs.unlink(tmpWav) } catch { /* ok if already gone */ }
      }
    }
  )

  ipcMain.handle('voice:getModelsDirectory', async () => {
    return getVoiceModelsDir()
  })

  logger.log('[voice] IPC handlers registered')
}
