import { useTranslation } from 'react-i18next'
import { ModalOverlay } from './common/ModalOverlay'

interface AppNotificationDialogProps {
  message: string
  onClose: () => void
}

/**
 * Informational message box (`app:notification`). T0563: the backdrop no longer dismisses it;
 * it closes through the header [X] or the OK button.
 */
export function AppNotificationDialog({ message, onClose }: Readonly<AppNotificationDialogProps>) {
  const { t } = useTranslation()
  return (
    <ModalOverlay className="app-notification-overlay" onEscape={onClose}>
      <div className="app-notification" role="dialog" onClick={e => e.stopPropagation()}>
        <button className="close-btn app-notification-x" aria-label={t('common.close')} title={t('common.close')} onClick={onClose}>×</button>
        <div className="app-notification-message">{message}</div>
        <button className="app-notification-close" onClick={onClose}>{t('common.ok')}</button>
      </div>
    </ModalOverlay>
  )
}
