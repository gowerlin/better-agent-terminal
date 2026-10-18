// PLAN-007 T0288 — Legacy remote (no targetOS) details slot.
import { useTranslation } from 'react-i18next'
import type { ProfileEntry } from '../types'

export function RemoteLegacyDetails({ profile }: { profile: ProfileEntry }) {
  const { t } = useTranslation()
  return (
    <dl className="profile-details" data-testid="profile-details-remote-legacy">
      <div className="profile-details-row">
        <dt>{t('profiles.details.server')}</dt>
        <dd>
          {profile.remoteHost}:{profile.remotePort || 9876}
        </dd>
      </div>
      <div className="profile-details-row">
        <dt>{t('profiles.details.target')}</dt>
        <dd>{profile.remoteProfileId || 'default'}</dd>
      </div>
      <div className="profile-details-row profile-details-warn">
        <dt>{t('profiles.details.notice')}</dt>
        <dd>{t('profiles.details.legacyNotice')}</dd>
      </div>
    </dl>
  )
}
