import { useTranslation } from 'react-i18next'

/**
 * T0401: shown instead of the Codex Agent panel in a remote-profile window — the remote
 * bat-server ships no codex, so starting it there could only fail.
 */
export function RemoteAgentUnavailable() {
  const { t } = useTranslation()
  return (
    <div className="empty-state remote-agent-unavailable" role="status">
      <p>{t('claude.remoteCodexUnsupported')}</p>
    </div>
  )
}
