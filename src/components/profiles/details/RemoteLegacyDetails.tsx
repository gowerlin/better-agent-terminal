// PLAN-007 T0288 — Legacy remote (no targetOS) details slot.
import type { ProfileEntry } from '../types'

export function RemoteLegacyDetails({ profile }: { profile: ProfileEntry }) {
  return (
    <dl className="profile-details" data-testid="profile-details-remote-legacy">
      <div className="profile-details-row">
        <dt>Server</dt>
        <dd>
          {profile.remoteHost}:{profile.remotePort || 9876}
        </dd>
      </div>
      <div className="profile-details-row">
        <dt>Target</dt>
        <dd>{profile.remoteProfileId || 'default'}</dd>
      </div>
      <div className="profile-details-row profile-details-warn">
        <dt>Notice</dt>
        <dd>No targetOS — legacy mode (no path translation).</dd>
      </div>
    </dl>
  )
}
