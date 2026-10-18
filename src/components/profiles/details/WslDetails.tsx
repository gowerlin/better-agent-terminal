// PLAN-007 T0288 — WSL profile details slot.
import { useTranslation } from 'react-i18next'
import type { ProfileEntry } from '../types'

export function WslDetails({ profile }: { profile: ProfileEntry }) {
  const { t } = useTranslation()
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
    </dl>
  )
}
