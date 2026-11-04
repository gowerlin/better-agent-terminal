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

/**
 * PLAN-063 / T0821: the notice of the first start after an upgrade that ended the terminals
 * (main `terminal-server:query-upgrade-interruption`, shown once). Same toast, its own key; the
 * values (`count`, `from`, `to`) come with it.
 */
export const UPGRADE_INTERRUPTED_TOAST_KEY = 'app.upgradeInterrupted'

/**
 * T0846 (D278): the same notice when the version did not change (installer quit record,
 * `previousVersion === currentVersion`): a reinstall of the same version, or an install cancelled
 * after BAT quit — the record cannot tell them apart, so the text holds for both. Values: `count`, `version`.
 */
export const UPGRADE_REINSTALLED_TOAST_KEY = 'app.upgradeReinstalled'

/** T0846: which text an upgrade notice shows — the reinstall one when the version did not change. */
export function upgradeNoticeToastKey(notice: { previousVersion: string; currentVersion: string }): typeof UPGRADE_INTERRUPTED_TOAST_KEY | typeof UPGRADE_REINSTALLED_TOAST_KEY {
  return notice.previousVersion === notice.currentVersion ? UPGRADE_REINSTALLED_TOAST_KEY : UPGRADE_INTERRUPTED_TOAST_KEY
}

export type ServerStatusToastKey = typeof SERVER_STATUS_TOAST_KEYS[keyof typeof SERVER_STATUS_TOAST_KEYS] | typeof UPGRADE_INTERRUPTED_TOAST_KEY | typeof UPGRADE_REINSTALLED_TOAST_KEY

interface ServerStatusToastProps {
  messageKey: ServerStatusToastKey
  /** T0821: interpolation values of `messageKey` (the upgrade notice). */
  messageValues?: Record<string, string | number>
  onDismiss: () => void
  /**
   * PLAN-055 B1 / T0766: agent tabs of this window the recovery interrupted. On the `recovered`
   * toast (T0821: and the upgrade notice) a count > 0 adds a line and a click opens
   * InterruptedAgentsDialog; 0 / absent = the toast as before T0766.
   */
  interruptedCount?: number
  onOpenInterrupted?: () => void
}

export function ServerStatusToast({ messageKey, messageValues, onDismiss, interruptedCount = 0, onOpenInterrupted }: ServerStatusToastProps) {
  const { t } = useTranslation()
  const listsInterrupted = messageKey === SERVER_STATUS_TOAST_KEYS.recovered || messageKey === UPGRADE_INTERRUPTED_TOAST_KEY || messageKey === UPGRADE_REINSTALLED_TOAST_KEY
  const showInterrupted = listsInterrupted && interruptedCount > 0
  const handleClick = () => {
    if (showInterrupted) onOpenInterrupted?.()
    onDismiss()
  }
  return (
    <div className="server-status-toast" data-message-key={messageKey} onClick={handleClick}>
      {messageValues ? t(messageKey, messageValues) : t(messageKey)}
      {showInterrupted && (
        <div className="server-status-toast-interrupted" data-interrupted-count={interruptedCount}>
          {t('app.terminalServerRecoveredInterrupted', { count: interruptedCount })}
        </div>
      )}
    </div>
  )
}
