// PLAN-007 T0288 — RFC C-7: edit-remote form lifted out of ProfilePanel rows
// into a dedicated modal. Mirrors SetupWizardShell modal chrome.
import { useTranslation } from 'react-i18next'
import type { ProfileEntry } from './types'

interface RemoteProfileOption {
  id: string
  name: string
  type: string
}

export interface EditRemoteProfileModalProps {
  profile: ProfileEntry
  host: string
  port: string
  token: string
  fingerprint: string
  selectedRemoteProfileId: string
  remoteProfiles: RemoteProfileOption[]
  fetching: boolean
  setHost: (v: string) => void
  setPort: (v: string) => void
  setToken: (v: string) => void
  setFingerprint: (v: string) => void
  setSelectedRemoteProfileId: (v: string) => void
  setRemoteProfiles: (v: RemoteProfileOption[]) => void
  parseConnectionUrl: (input: string) => { host: string; port: number; token: string; fingerprint: string } | null
  onFetch: () => void
  onPin: () => void
  onSave: () => void
  onClose: () => void
}

export function EditRemoteProfileModal({
  profile,
  host,
  port,
  token,
  fingerprint,
  selectedRemoteProfileId,
  remoteProfiles,
  fetching,
  setHost,
  setPort,
  setToken,
  setFingerprint,
  setSelectedRemoteProfileId,
  setRemoteProfiles,
  parseConnectionUrl,
  onFetch,
  onPin,
  onSave,
  onClose,
}: EditRemoteProfileModalProps) {
  const { t } = useTranslation()
  return (
    <div className="settings-overlay" style={{ zIndex: 1001 }} onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="settings-header">
          <h2>{t('profiles.editConnection')}</h2>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>
        <div className="settings-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            className="profile-name-input"
            placeholder={t('profiles.connectionUrlPlaceholder', 'Paste connection URL (wss://host:port?token=…&fp=…)')}
            onChange={(e) => {
              const parsed = parseConnectionUrl(e.target.value)
              if (!parsed) return
              setHost(parsed.host)
              setPort(String(parsed.port))
              setToken(parsed.token)
              setFingerprint(parsed.fingerprint)
              setRemoteProfiles([])
              e.target.value = ''
            }}
            style={{ fontFamily: 'monospace', fontSize: 11 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="profile-name-input"
              placeholder={t('profiles.host')}
              value={host}
              onChange={(e) => { setHost(e.target.value); setRemoteProfiles([]) }}
              style={{ flex: '1 1 120px' }}
            />
            <input
              type="number"
              className="profile-name-input"
              placeholder={t('profiles.portPlaceholder')}
              value={port}
              onChange={(e) => { setPort(e.target.value); setRemoteProfiles([]) }}
              style={{ width: 70 }}
            />
            <input
              type="text"
              className="profile-name-input"
              placeholder={t('profiles.tokenPlaceholder')}
              value={token}
              onChange={(e) => { setToken(e.target.value); setRemoteProfiles([]) }}
              style={{ flex: '1 1 160px' }}
            />
          </div>
          <input
            type="text"
            className="profile-name-input"
            placeholder="Pinned fingerprint (read-only)"
            value={fingerprint}
            readOnly
            title="Read-only. Use 'Pin expected fingerprint' below to refresh from the server."
            style={{ fontFamily: 'monospace', fontSize: 11 }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="profile-action-btn"
              onClick={onFetch}
              disabled={fetching || !host.trim() || !token.trim()}
            >
              {fetching ? t('profiles.fetchingProfiles') : t('profiles.fetchProfiles')}
            </button>
            <button
              className="profile-action-btn"
              onClick={onPin}
              disabled={!profile.remoteHost || !profile.remoteToken}
              title="Fetch current server fingerprint and pin it for future connections"
            >
              Pin expected fingerprint
            </button>
            {selectedRemoteProfileId && remoteProfiles.length === 0 && (
              <span style={{ fontSize: 11, color: '#8b949e' }}>
                {t('profiles.currentTarget')}: {selectedRemoteProfileId}
              </span>
            )}
          </div>
          {remoteProfiles.length > 0 && (
            <select
              className="profile-name-input"
              value={selectedRemoteProfileId}
              onChange={(e) => setSelectedRemoteProfileId(e.target.value)}
              style={{ width: '100%' }}
            >
              {remoteProfiles.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.name} {rp.type === 'remote' ? `(${t('profiles.remote')})` : ''}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="profile-action-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button className="profile-action-btn" onClick={onSave}>{t('common.save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
