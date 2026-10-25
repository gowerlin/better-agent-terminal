import { Trans, useTranslation } from 'react-i18next'
import { ModalOverlay } from './common/ModalOverlay'

interface RecoveryPromptProps {
  ptyCount: number
  onRecover: () => void
  onFreshStart: () => void
}

export function RecoveryPrompt({ ptyCount, onRecover, onFreshStart }: RecoveryPromptProps) {
  const { t } = useTranslation()
  return (
    <ModalOverlay className="recovery-prompt-overlay">
      <div className="recovery-prompt-dialog">
        <div className="recovery-prompt-header">
          <h3>🔄 {t('app.recoveryPromptTitle')}</h3>
        </div>
        <div className="recovery-prompt-content">
          <p>
            <Trans t={t} i18nKey="app.recoveryPromptAlive" count={ptyCount} components={{ strong: <strong /> }} />
          </p>
          <p className="recovery-prompt-hint">{t('app.recoveryPromptQuestion')}</p>
        </div>
        <div className="recovery-prompt-actions">
          <button className="btn-primary" onClick={onRecover}>
            {t('app.recoveryPromptRecover')}
          </button>
          <button className="btn-secondary" onClick={onFreshStart}>
            {t('app.recoveryPromptFreshStart')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
