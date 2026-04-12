import { useState, useCallback, useEffect, useRef } from 'react'
import { useVoiceRecording } from './useVoiceRecording'
import type { VoicePreviewState } from '../components/voice/VoicePreviewPopover'
import type { UseVoiceRecordingResult } from './useVoiceRecording'

interface UseVoicePopoverOptions {
  onConfirm: (text: string) => void
}

interface UseVoicePopoverResult {
  voice: UseVoiceRecordingResult
  popoverState: VoicePreviewState
  transcriptionMeta: { detectedLanguage?: string; inferenceTimeMs?: number }
  handleConfirm: (text: string) => void
  handleCancel: () => void
}

/**
 * 共用 hook：語音錄音 + popover 狀態管理
 *
 * 封裝了 PromptBox 中步驟 1-3 的通用邏輯：
 *   1. useVoiceRecording 初始化
 *   2. transcribing 狀態同步到 popoverState
 *   3. error 狀態同步到 popoverState
 *
 * 使用方式（各場景只需提供 onConfirm 回調）：
 *   - 一般終端：onConfirm = (text) => window.electronAPI.pty.write(terminalId, text)
 *   - Claude Agent Chat Box：onConfirm = (text) => setInputValue(...)
 */
export function useVoicePopover({ onConfirm }: UseVoicePopoverOptions): UseVoicePopoverResult {
  const [popoverState, setPopoverState] = useState<VoicePreviewState>('hidden')
  const [transcriptionMeta, setTranscriptionMeta] = useState<{
    detectedLanguage?: string
    inferenceTimeMs?: number
  }>({})

  // Keep onConfirm stable via ref to avoid recreating handleConfirm on every render
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  const voice = useVoiceRecording({
    onTranscribed: (_text, result) => {
      setTranscriptionMeta({
        detectedLanguage: result?.detectedLanguage,
        inferenceTimeMs: result?.inferenceTimeMs,
      })
      setPopoverState('result')
    },
  })

  const { reset } = voice

  // Sync voice.state → popoverState (transcribing phase)
  useEffect(() => {
    if (voice.state === 'transcribing' && popoverState === 'hidden') {
      setPopoverState('transcribing')
    }
  }, [voice.state, popoverState])

  // Sync voice.error → popoverState (error phase)
  useEffect(() => {
    if (voice.error && popoverState !== 'hidden') {
      setPopoverState('error')
    }
  }, [voice.error, popoverState])

  const handleConfirm = useCallback((text: string) => {
    onConfirmRef.current(text)
    setPopoverState('hidden')
    setTranscriptionMeta({})
    reset()
  }, [reset])

  const handleCancel = useCallback(() => {
    setPopoverState('hidden')
    setTranscriptionMeta({})
    reset()
  }, [reset])

  return { voice, popoverState, transcriptionMeta, handleConfirm, handleCancel }
}
