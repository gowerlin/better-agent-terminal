// PLAN-007 T0288 — Docker profile details slot.
import type { ProfileEntry } from '../types'

export function DockerDetails({ profile }: { profile: ProfileEntry }) {
  // Mount table is shown if the profile carries a metadata.dockerMounts array.
  // The current ProfileEntry schema doesn't expose mounts directly; we read
  // them via a lenient cast so this stays forward-compatible with future
  // schema additions without breaking the existing baseline.
  const mounts = (profile as unknown as { dockerMounts?: Array<{ host: string; container: string }> })
    .dockerMounts ?? []
  return (
    <dl className="profile-details" data-testid="profile-details-docker">
      <div className="profile-details-row">
        <dt>Container</dt>
        <dd>{profile.dockerContainer || '—'}</dd>
      </div>
      <div className="profile-details-row">
        <dt>Host</dt>
        <dd>
          {profile.dockerHost || profile.remoteHost || 'localhost'}:{profile.remotePort || 9876}
        </dd>
      </div>
      <div className="profile-details-row">
        <dt>Target</dt>
        <dd>{profile.remoteProfileId || 'default'}</dd>
      </div>
      {mounts.length > 0 && (
        <div className="profile-details-row" data-testid="docker-mount-table">
          <dt>Mounts</dt>
          <dd>
            <table className="profile-details-mounts">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Container</th>
                </tr>
              </thead>
              <tbody>
                {mounts.map((m, i) => (
                  <tr key={`${m.host}:${m.container}:${i}`}>
                    <td>{m.host}</td>
                    <td>{m.container}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </dd>
        </div>
      )}
    </dl>
  )
}
