// PLAN-007 T0288 — SSH profile details slot. Differentiates ssh-linux (systemd)
// vs ssh-darwin (launchd) so the start-server contract is visually obvious.
import { useTranslation } from 'react-i18next'
import type { ProfileEntry } from '../types'

// T0506: an empty user (an ~/.ssh/config alias, or a host typed without
// `user@`) and an unset port are decided by ssh config at connect time, so
// they are not shown as placeholder `user@` / `:22` values.
function sshConfigHintKey(hasUser: boolean, hasPort: boolean): string | null {
  if (hasUser && hasPort) return null
  if (!hasUser && !hasPort) return 'profiles.sshDetails.userAndPortFromConfig'
  return hasUser ? 'profiles.sshDetails.portFromConfig' : 'profiles.sshDetails.userFromConfig'
}

export function SshDetails({ profile }: { profile: ProfileEntry }) {
  const { t } = useTranslation()
  const isDarwin = profile.targetOS === 'ssh-darwin'
  const serviceLabel = isDarwin ? 'launchd' : 'systemd (user)'
  // T0425 (BUG-098): SSH profiles always connect through the tunnel; a legacy
  // useSshTunnel=false (removed "direct" mode) is shown as such, not as direct.
  const tunnelLabel = `tunnel → localhost:${profile.tunnelLocalPort || 9876}`
    + (profile.useSshTunnel === false ? ' (legacy direct setting ignored)' : '')
  const host = profile.sshHost || profile.remoteHost || 'host'
  const target = (profile.sshUser ? `${profile.sshUser}@` : '') + host
    + (profile.sshPort ? `:${profile.sshPort}` : '')
  const hintKey = sshConfigHintKey(Boolean(profile.sshUser), Boolean(profile.sshPort))
  return (
    <dl className="profile-details" data-testid={isDarwin ? 'profile-details-ssh-darwin' : 'profile-details-ssh-linux'}>
      <div className="profile-details-row">
        <dt>Host</dt>
        <dd data-testid="ssh-target">
          {target}
          {hintKey && <span className="profile-details-hint" data-testid="ssh-config-hint"> ({t(hintKey)})</span>}
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
