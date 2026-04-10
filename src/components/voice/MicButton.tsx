import type { VoiceRecordingState } from '../../hooks/useVoiceRecording'

interface MicButtonProps {
  state: VoiceRecordingState
  onClick: () => void
  disabled?: boolean
  disabledTooltip?: string
}

export function MicButton({ state, onClick, disabled, disabledTooltip }: Readonly<MicButtonProps>) {
  const isDisabled = disabled || state === 'disabled' || state === 'transcribing'

  const label = state === 'recording'
    ? '停止錄音'
    : state === 'transcribing'
      ? '辨識中…'
      : '語音輸入'

  const title = isDisabled && disabledTooltip
    ? disabledTooltip
    : `${label} (Alt+M)`

  return (
    <button
      className={`prompt-box-mic ${state === 'recording' ? 'recording' : ''} ${state === 'transcribing' ? 'transcribing' : ''}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={label}
      title={title}
      type="button"
    >
      {state === 'transcribing' ? (
        <span className="mic-spinner">⏳</span>
      ) : (
        <span className={state === 'recording' ? 'mic-icon-recording' : undefined}>🎤</span>
      )}
    </button>
  )
}
