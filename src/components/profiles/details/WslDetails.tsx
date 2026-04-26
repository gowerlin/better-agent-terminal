// PLAN-007 T0288 — WSL profile details slot.
import type { ProfileEntry } from '../types'

export function WslDetails({ profile }: { profile: ProfileEntry }) {
  return (
    <dl className="profile-details" data-testid="profile-details-wsl">
      <div className="profile-details-row">
        <dt>Distro</dt>
        <dd>{profile.wslDistro || '—'}</dd>
      </div>
      <div className="profile-details-row">
        <dt>Service</dt>
        <dd>systemd (user)</dd>
      </div>
      <div className="profile-details-row">
        <dt>Server</dt>
        <dd>
          {profile.remoteHost || 'localhost'}:{profile.remotePort || 9876}
        </dd>
      </div>
      <div className="profile-details-row">
        <dt>Target</dt>
        <dd>{profile.remoteProfileId || 'default'}</dd>
      </div>
    </dl>
  )
}
