import { useState, useCallback, useRef, useEffect } from 'react'
import { RecordingService, RecordingError } from '../lib/voice'
import type { WhisperModelSize, VoicePreferences } from '../types/voice'
import { DEFAULT_VOICE_PREFERENCES } from '../types/voice'

export type VoiceRecordingState = 'idle' | 'recording' | 'transcribing' | 'disabled'

export interface UseVoiceRecordingResult {
  state: VoiceRecordingState
  error: string | null
  lastTranscription: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => void
  toggle: () => void
  reset: () => void
}

interface UseVoiceRecordingOptions {
  onTranscribed?: (text: string, result?: { detectedLanguage?: string; inferenceTimeMs?: number }) => void
}

function debugLog(...args: unknown[]): void {
  try { window.electronAPI?.debug?.log?.(...args) } catch { /* ignore */ }
}

export function useVoiceRecording(opts?: UseVoiceRecordingOptions): UseVoiceRecordingResult {
  const [state, setState] = useState<VoiceRecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastTranscription, setLastTranscription] = useState<string | null>(null)

  const recorderRef = useRef<RecordingService | null>(null)
  const prefsRef = useRef<VoicePreferences>(DEFAULT_VOICE_PREFERENCES)
  const onTranscribedRef = useRef(opts?.onTranscribed)
  onTranscribedRef.current = opts?.onTranscribed

  // Lazily fetch preferences once
  useEffect(() => {
    window.electronAPI?.voice?.getPreferences?.().then((prefs) => {
      if (prefs) prefsRef.current = prefs
    }).catch(() => {})
  }, [])

  const getRecorder = useCallback(() => {
    if (!recorderRef.current) {
      recorderRef.current = new RecordingService()
    }
    return recorderRef.current
  }, [])

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setError(null)

    // Check if model is downloaded
    const preferredSize: WhisperModelSize = prefsRef.current.modelSize
    try {
      const downloaded = await window.electronAPI.voice.isModelDownloaded(preferredSize)
      if (!downloaded) {
        setError('請先在 Settings 下載語音模型')
        setState('disabled')
        return
      }
    } catch {
      // If check fails, proceed anyway — the transcribe call will fail with a clear error
      debugLog('[voice] isModelDownloaded check failed, proceeding anyway')
    }

    try {
      const recorder = getRecorder()
      await recorder.start()
      setState('recording')
      debugLog('[voice] useVoiceRecording: recording started')
    } catch (err: unknown) {
      if (err instanceof RecordingError) {
        switch (err.code) {
          case 'permission-denied':
            setError('麥克風權限被拒絕，請在系統設定中允許存取麥克風')
            break
          case 'no-device':
            setError('找不到麥克風裝置')
            break
          case 'unsupported':
            setError('此環境不支援麥克風錄音')
            break
          default:
            setError(`錄音失敗: ${err.message}`)
        }
      } else {
        setError(`錄音失敗: ${(err as Error)?.message ?? String(err)}`)
      }
      setState('idle')
      debugLog('[voice] useVoiceRecording: start failed', (err as Error)?.message)
    }
  }, [state, getRecorder])

  const stop = useCallback(async () => {
    if (state !== 'recording') return
    setError(null)

    try {
      const recorder = getRecorder()
      setState('transcribing')
      const wavBuffer = await recorder.stop()
      debugLog('[voice] useVoiceRecording: recording stopped, transcribing...')

      const result = await window.electronAPI.voice.transcribe(wavBuffer, 16000)
      const text = result.text?.trim()
      if (text) {
        setLastTranscription(text)
        onTranscribedRef.current?.(text, {
          detectedLanguage: result.detectedLanguage,
          inferenceTimeMs: result.inferenceTimeMs,
        })
        debugLog(`[voice] useVoiceRecording: transcribed "${text.slice(0, 50)}..."`)
      } else {
        debugLog('[voice] useVoiceRecording: empty transcription result')
      }
      setState('idle')
    } catch (err: unknown) {
      setError(`辨識失敗: ${(err as Error)?.message ?? String(err)}`)
      setState('idle')
      debugLog('[voice] useVoiceRecording: stop/transcribe failed', (err as Error)?.message)
    }
  }, [state, getRecorder])

  const cancel = useCallback(() => {
    try {
      const recorder = getRecorder()
      recorder.cancel()
    } catch { /* ignore */ }
    setState('idle')
    setError(null)
    debugLog('[voice] useVoiceRecording: cancelled')
  }, [getRecorder])

  const toggle = useCallback(() => {
    if (state === 'idle') {
      void start()
    } else if (state === 'recording') {
      void stop()
    }
    // Do nothing if transcribing or disabled — let the operation finish
  }, [state, start, stop])

  const reset = useCallback(() => {
    setError(null)
    setLastTranscription(null)
    if (state === 'disabled') {
      setState('idle')
    }
  }, [state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { recorderRef.current?.cancel() } catch { /* ignore */ }
    }
  }, [])

  return { state, error, lastTranscription, start, stop, cancel, toggle, reset }
}
