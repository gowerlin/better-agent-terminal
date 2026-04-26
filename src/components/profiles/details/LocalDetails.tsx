// PLAN-007 T0288 — Local profile details slot.
import type { ProfileEntry } from '../types'

export function LocalDetails({ profile }: { profile: ProfileEntry }) {
  return (
    <dl className="profile-details" data-testid="profile-details-local">
      <div className="profile-details-row">
        <dt>Type</dt>
        <dd>Local</dd>
      </div>
      <div className="profile-details-row">
        <dt>Updated</dt>
        <dd>{new Date(profile.updatedAt).toLocaleString()}</dd>
      </div>
    </dl>
  )
}
