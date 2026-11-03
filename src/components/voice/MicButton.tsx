import { useTranslation } from 'react-i18next'
import type { VoiceRecordingState } from '../../hooks/useVoiceRecording'
import { useVoiceAvailability } from '../../lib/voice-availability-store'
import { isVoiceUnavailable, voiceUnavailableText } from '../../lib/voice-availability'

interface MicButtonProps {
  state: VoiceRecordingState
  onClick: () => void
  disabled?: boolean
  disabledTooltip?: string
}

export function MicButton({ state, onClick, disabled, disabledTooltip }: Readonly<MicButtonProps>) {
  const { t } = useTranslation()
  const availability = useVoiceAvailability()
  // T0802 / D247: whisper cannot load here → greyed out, tooltip = reason + what to install. Only while no
  // recording is running (a recording that already started finishes normally). available / unknown: unchanged.
  const unavailable = isVoiceUnavailable(availability) && (state === 'idle' || state === 'disabled')
    ? availability
    : null
  const isDisabled = !!unavailable || disabled || state === 'disabled' || state === 'transcribing'

  const label = state === 'recording'
    ? '停止錄音'
    : state === 'transcribing'
      ? '辨識中…'
      : '語音輸入'

  const title = unavailable
    ? voiceUnavailableText(unavailable, t)
    : isDisabled && disabledTooltip
      ? disabledTooltip
      : `${label} (Alt+M)`

  return (
    <button
      className={`prompt-box-mic ${state === 'recording' ? 'recording' : ''} ${state === 'transcribing' ? 'transcribing' : ''}${unavailable ? ' voice-unavailable' : ''}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={label}
      title={title}
      type="button"
      {...(unavailable ? { 'data-voice-unavailable': unavailable.code } : {})}
    >
      {state === 'transcribing' ? (
        <span className="mic-spinner">⏳</span>
      ) : (
        <span className={state === 'recording' ? 'mic-icon-recording' : undefined}>🎤</span>
      )}
    </button>
  )
}
