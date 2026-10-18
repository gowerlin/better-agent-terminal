// PLAN-007 T0288 — Local profile details slot.
import { useTranslation } from 'react-i18next'
import type { ProfileEntry } from '../types'

export function LocalDetails({ profile }: { profile: ProfileEntry }) {
  const { t } = useTranslation()
  return (
    <dl className="profile-details" data-testid="profile-details-local">
      <div className="profile-details-row">
        <dt>{t('profiles.details.type')}</dt>
        <dd>{t('profiles.details.local')}</dd>
      </div>
      <div className="profile-details-row">
        <dt>{t('profiles.details.updated')}</dt>
        <dd>{new Date(profile.updatedAt).toLocaleString()}</dd>
      </div>
    </dl>
  )
}
