// PLAN-007 T0288 — WSL profile details slot.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileEntry } from '../types'

/**
 * T0830 (PLAN-043, D271): `wslKeepAlive` is read off the persisted profile entry
 * (electron/profile-manager.ts). Missing = on, the pre-T0830 behaviour.
 */
type WslProfileEntry = ProfileEntry & { wslKeepAlive?: boolean }

export function WslDetails({ profile }: { profile: WslProfileEntry }) {
  const { t } = useTranslation()
  const persisted = profile.wslKeepAlive !== false
  const [keepAlive, setKeepAlive] = useState(persisted)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  // A refreshed profile list wins over the local value.
  useEffect(() => {
    setKeepAlive(persisted)
  }, [persisted])

  const onToggle = async (next: boolean) => {
    const previous = keepAlive
    setKeepAlive(next)
    setSaving(true)
    setFailed(false)
    try {
      // profile:update re-syncs the keep-alive holders in main (syncWslKeepAlive).
      const ok = await window.electronAPI.profile.update(profile.id, { wslKeepAlive: next })
      if (!ok) {
        setKeepAlive(previous)
        setFailed(true)
      }
    } catch (err) {
      window.electronAPI?.debug?.log?.(`[profiles] wslKeepAlive update failed: ${err instanceof Error ? err.message : String(err)}`)
      setKeepAlive(previous)
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <dl className="profile-details" data-testid="profile-details-wsl">
      <div className="profile-details-row">
        <dt>{t('profiles.details.distro')}</dt>
        <dd>{profile.wslDistro || '—'}</dd>
      </div>
      <div className="profile-details-row">
        <dt>{t('profiles.details.service')}</dt>
        <dd>systemd (user)</dd>
      </div>
      <div className="profile-details-row">
        <dt>{t('profiles.details.server')}</dt>
        <dd>
          {profile.remoteHost || 'localhost'}:{profile.remotePort || 9876}
        </dd>
      </div>
      <div className="profile-details-row">
        <dt>{t('profiles.details.target')}</dt>
        <dd>{profile.remoteProfileId || 'default'}</dd>
      </div>
      <div className="profile-details-row">
        <dt>{t('profiles.details.keepAlive')}</dt>
        <dd>
          <label onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              data-testid="wsl-keepalive-toggle"
              checked={keepAlive}
              disabled={saving}
              onChange={(e) => { void onToggle(e.target.checked) }}
            />
            {' '}{t('profiles.details.keepAliveLabel')}
          </label>
          <div className="profile-details-hint" data-testid="wsl-keepalive-hint">
            {t(keepAlive ? 'profiles.details.keepAliveOnHint' : 'profiles.details.keepAliveOffHint')}
          </div>
          {failed && (
            <div className="profile-details-hint" role="alert" data-testid="wsl-keepalive-error">
              {t('profiles.details.keepAliveSaveFailed')}
            </div>
          )}
        </dd>
      </div>
    </dl>
  )
}
