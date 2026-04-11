import { useState, useEffect, useRef, useCallback } from 'react'

export type VoicePreviewState = 'hidden' | 'transcribing' | 'result' | 'error'

interface VoicePreviewPopoverProps {
  state: VoicePreviewState
  text?: string
  errorMessage?: string
  detectedLanguage?: string
  inferenceTimeMs?: number
  onConfirm: (finalText: string) => void
  onCancel: () => void
}

export function VoicePreviewPopover({
  state,
  text,
  errorMessage,
  detectedLanguage,
  inferenceTimeMs,
  onConfirm,
  onCancel,
}: Readonly<VoicePreviewPopoverProps>) {
  const [editedText, setEditedText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync props.text → editedText when transcription result arrives
  useEffect(() => {
    if (text !== undefined) setEditedText(text)
  }, [text])

  // Auto-focus textarea when result is shown
  useEffect(() => {
    if (state === 'result') {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [state])

  const handleConfirm = useCallback(() => {
    if (editedText.trim()) {
      onConfirm(editedText)
    }
  }, [editedText, onConfirm])

  // Keyboard: Enter to confirm, Esc to cancel (only when popover is visible)
  useEffect(() => {
    if (state !== 'result') return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        e.stopPropagation()
        handleConfirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
      }
    }

    // Use capture to intercept before PromptBox's own handlers
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [state, handleConfirm, onCancel])

  if (state === 'hidden') return null

  return (
    <div className="voice-preview-popover" role="dialog" aria-label="語音辨識結果">
      {state === 'transcribing' && (
        <div className="voice-preview-loading">
          <span className="voice-preview-spinner">⏳</span>
          <span>辨識中...</span>
        </div>
      )}

      {state === 'result' && (
        <>
          <textarea
            ref={textareaRef}
            className="voice-preview-text"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
          />
          {(detectedLanguage || inferenceTimeMs != null) && (
            <div className="voice-preview-meta">
              {detectedLanguage && <span>語言: {detectedLanguage}</span>}
              {inferenceTimeMs != null && <span>{Math.round(inferenceTimeMs)}ms</span>}
            </div>
          )}
          <div className="voice-preview-actions">
            <button onClick={handleConfirm} className="voice-preview-confirm" type="button">
              ✓ 填入 (Enter)
            </button>
            <button onClick={onCancel} className="voice-preview-cancel" type="button">
              ✗ 取消 (Esc)
            </button>
          </div>
        </>
      )}

      {state === 'error' && (
        <div className="voice-preview-error">
          <span>⚠️ {errorMessage || '辨識失敗'}</span>
          <button onClick={onCancel} type="button">關閉</button>
        </div>
      )}
    </div>
  )
}
