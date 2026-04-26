// PLAN-007 T0288 — SSH profile details slot. Differentiates ssh-linux (systemd)
// vs ssh-darwin (launchd) so the start-server contract is visually obvious.
import type { ProfileEntry } from '../types'

export function SshDetails({ profile }: { profile: ProfileEntry }) {
  const isDarwin = profile.targetOS === 'ssh-darwin'
  const serviceLabel = isDarwin ? 'launchd' : 'systemd (user)'
  const tunnelLabel = profile.useSshTunnel
    ? `tunnel → localhost:${profile.tunnelLocalPort || 9876}`
    : 'direct'
  return (
    <dl className="profile-details" data-testid={isDarwin ? 'profile-details-ssh-darwin' : 'profile-details-ssh-linux'}>
      <div className="profile-details-row">
        <dt>Host</dt>
        <dd>
          {profile.sshUser || 'user'}@{profile.sshHost || profile.remoteHost || 'host'}:{profile.sshPort || 22}
        </dd>
      </div>
      <div className="profile-details-row">
        <dt>Service</dt>
        <dd data-testid="ssh-service-badge">{serviceLabel}</dd>
      </div>
      <div className="profile-details-row">
        <dt>Connection</dt>
        <dd>{tunnelLabel}</dd>
      </div>
      {profile.sshKeyPath && (
        <div className="profile-details-row">
          <dt>Key</dt>
          <dd>{profile.sshKeyPath}</dd>
        </div>
      )}
      <div className="profile-details-row">
        <dt>Target</dt>
        <dd>{profile.remoteProfileId || 'default'}</dd>
      </div>
    </dl>
  )
}
