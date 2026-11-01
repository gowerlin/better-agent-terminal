import { useTranslation } from 'react-i18next'

/**
 * T0705: text keys of the Terminal Server heartbeat-recovery toast (T0112), one per
 * `terminalServer.onStatusChange` status. App.tsx keeps the key and this component
 * translates it on render, so the toast follows a language switch while it is shown.
 */
export const SERVER_STATUS_TOAST_KEYS = {
  recovering: 'app.terminalServerRecovering',
  recovered: 'app.terminalServerRecovered',
  failed: 'app.terminalServerRecoveryFailed',
} as const

export type ServerStatusToastKey = typeof SERVER_STATUS_TOAST_KEYS[keyof typeof SERVER_STATUS_TOAST_KEYS]

interface ServerStatusToastProps {
  messageKey: ServerStatusToastKey
  onDismiss: () => void
  /**
   * PLAN-055 B1 / T0766: agent tabs of this window the recovery interrupted. On the `recovered`
   * toast a count > 0 adds a line and a click opens InterruptedAgentsDialog; 0 / absent = the toast
   * as before T0766.
   */
  interruptedCount?: number
  onOpenInterrupted?: () => void
}

export function ServerStatusToast({ messageKey, onDismiss, interruptedCount = 0, onOpenInterrupted }: ServerStatusToastProps) {
  const { t } = useTranslation()
  const showInterrupted = messageKey === SERVER_STATUS_TOAST_KEYS.recovered && interruptedCount > 0
  const handleClick = () => {
    if (showInterrupted) onOpenInterrupted?.()
    onDismiss()
  }
  return (
    <div className="server-status-toast" onClick={handleClick}>
      {t(messageKey)}
      {showInterrupted && (
        <div className="server-status-toast-interrupted" data-interrupted-count={interruptedCount}>
          {t('app.terminalServerRecoveredInterrupted', { count: interruptedCount })}
        </div>
      )}
    </div>
  )
}
