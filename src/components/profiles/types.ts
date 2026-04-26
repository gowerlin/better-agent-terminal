// PLAN-007 T0288 — Shared profile types for ProfileCard + Details slot (RFC C-7).
// Mirrors the legacy inline definitions in ProfilePanel.tsx.

export type TargetOS = 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'

export interface ProfileEntry {
  id: string
  name: string
  type: 'local' | 'remote'
  remoteHost?: string
  remotePort?: number
  remoteToken?: string
  remoteProfileId?: string
  remoteFingerprint?: string
  createdAt: number
  updatedAt: number
  // PLAN-007 T0268: targetOS schema (flat — see profile-manager.ts)
  targetOS?: TargetOS
  wslDistro?: string
  dockerContainer?: string
  dockerHost?: string
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  useSshTunnel?: boolean
  tunnelLocalPort?: number
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'idle'

// Dispatcher key — kept as a plain enum-like union so the pick logic can be
// unit-tested without React.
export type ProfileDetailsVariant =
  | 'local'
  | 'wsl'
  | 'docker'
  | 'ssh-linux'
  | 'ssh-darwin'
  | 'remote-legacy'

/**
 * Pure dispatcher — picks the per-env details variant for a profile.
 * Tested in tests/profile-card.test.ts.
 */
export function selectDetailsVariant(profile: ProfileEntry): ProfileDetailsVariant {
  if (profile.type === 'local') return 'local'
  switch (profile.targetOS) {
    case 'wsl-linux':
      return 'wsl'
    case 'docker-linux':
      return 'docker'
    case 'ssh-linux':
      return 'ssh-linux'
    case 'ssh-darwin':
      return 'ssh-darwin'
    default:
      return 'remote-legacy'
  }
}
