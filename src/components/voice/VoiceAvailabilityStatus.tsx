// T0802 / D247: Settings › Voice — is whisper usable on this machine, why not, and a manual re-check.
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { recheckVoiceAvailability, useVoiceAvailability } from '../../lib/voice-availability-store'
import { voiceUnavailableLines } from '../../lib/voice-availability'

export function VoiceAvailabilityStatus() {
  const { t } = useTranslation()
  const availability = useVoiceAvailability()
  const [checking, setChecking] = useState(false)

  const handleRecheck = useCallback(async () => {
    setChecking(true)
    try {
      await recheckVoiceAvailability()
    } finally {
      setChecking(false)
    }
  }, [])

  let tag: string
  let lines: string[] = []
  if (availability.state === 'available') {
    tag = t('voiceAvailability.settings.available')
  } else if (availability.state === 'unavailable') {
    tag = t('voiceAvailability.settings.unavailable')
    lines = voiceUnavailableLines(availability, t).slice(1)
  } else if (availability.reason === 'pending') {
    tag = t('voiceAvailability.settings.pending')
  } else {
    tag = t('voiceAvailability.settings.unknown', { reason: availability.reason })
    lines = [t('voiceAvailability.settings.unknownHint')]
  }

  return (
    <div className="settings-group voice-availability" data-voice-availability={availability.state}>
      <label>{t('voiceAvailability.settings.label')}</label>
      <div className="voice-gpu-status">
        <div className="voice-gpu-status-row">
          <span className="voice-gpu-status-value">{tag}</span>
          <button
            className="profile-action-btn"
            onClick={handleRecheck}
            disabled={checking}
            type="button"
            style={{ marginLeft: 8, flexShrink: 0 }}
          >
            {checking ? t('voiceAvailability.settings.checking') : t('voiceAvailability.settings.recheck')}
          </button>
        </div>
        {lines.map((line, i) => (
          <p key={i} className="settings-hint" style={{ userSelect: 'text' }}>{line}</p>
        ))}
      </div>
    </div>
  )
}
