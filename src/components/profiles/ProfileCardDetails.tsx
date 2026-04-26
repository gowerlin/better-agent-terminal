// PLAN-007 T0288 — Per-env details slot dispatcher (RFC C-7).
import type { ProfileEntry } from './types'
import { selectDetailsVariant } from './types'
import { LocalDetails } from './details/LocalDetails'
import { WslDetails } from './details/WslDetails'
import { DockerDetails } from './details/DockerDetails'
import { SshDetails } from './details/SshDetails'
import { RemoteLegacyDetails } from './details/RemoteLegacyDetails'

export function ProfileCardDetails({ profile }: { profile: ProfileEntry }) {
  const variant = selectDetailsVariant(profile)
  switch (variant) {
    case 'local':
      return <LocalDetails profile={profile} />
    case 'wsl':
      return <WslDetails profile={profile} />
    case 'docker':
      return <DockerDetails profile={profile} />
    case 'ssh-linux':
    case 'ssh-darwin':
      return <SshDetails profile={profile} />
    case 'remote-legacy':
    default:
      return <RemoteLegacyDetails profile={profile} />
  }
}
