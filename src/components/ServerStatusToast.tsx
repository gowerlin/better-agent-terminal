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
}

export function ServerStatusToast({ messageKey, onDismiss }: ServerStatusToastProps) {
  const { t } = useTranslation()
  return (
    <div className="server-status-toast" onClick={onDismiss}>
      {t(messageKey)}
    </div>
  )
}
