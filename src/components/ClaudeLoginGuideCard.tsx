import { useTranslation } from 'react-i18next'

interface ClaudeLoginGuideCardProps {
  /** Remote window: the claude (and the terminal tab) are on the remote host. */
  isRemote: boolean
  checking: boolean
  /** The last "Check again" still reported logged out. */
  stillLoggedOut: boolean
  onOpenTerminal(): void
  onRecheck(): void
}

/**
 * T0402: shown in the Claude Agent panel when `claude:auth-status` reports
 * `loggedIn: false`. Login runs in a terminal tab of the same window.
 */
export function ClaudeLoginGuideCard({ isRemote, checking, stillLoggedOut, onOpenTerminal, onRecheck }: Readonly<ClaudeLoginGuideCardProps>) {
  const { t } = useTranslation()
  return (
    <div className="claude-login-guide" role="status">
      <div className="claude-login-guide-title">{t('claude.loginGuideTitle')}</div>
      <p className="claude-login-guide-body">{t(isRemote ? 'claude.loginGuideBodyRemote' : 'claude.loginGuideBodyLocal')}</p>
      <p className="claude-login-guide-hint">{t('claude.loginGuideTerminalHint')}</p>
      {stillLoggedOut && !checking && (
        <p className="claude-login-guide-warn">{t('claude.loginGuideStillLoggedOut')}</p>
      )}
      <div className="claude-login-guide-actions">
        <button type="button" className="claude-login-guide-btn primary" onClick={onOpenTerminal}>
          {t('claude.loginGuideOpenTerminal')}
        </button>
        <button type="button" className="claude-login-guide-btn" onClick={onRecheck} disabled={checking}>
          {checking ? t('claude.loginGuideChecking') : t('claude.loginGuideRecheck')}
        </button>
      </div>
    </div>
  )
}
