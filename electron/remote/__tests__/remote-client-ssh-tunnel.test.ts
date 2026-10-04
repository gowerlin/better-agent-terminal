// @vitest-environment node
/**
 * T0425 (BUG-098, D134): SSH "direct" mode was removed. Existing ssh-* profiles
 * always connect through the SSH tunnel — including legacy ones persisted with
 * `useSshTunnel: false` — because their `remoteHost` is 'localhost' and the
 * remote bat-server only listens on loopback. Without the tunnel the client
 * would reach this machine's own RemoteServer.
 */
import { describe, expect, it } from 'vitest'
import type { ProfileEntry } from '../../profile-manager'
import { RemoteClient, resolveSshTunnelUse } from '../remote-client'

function sshProfile(overrides: Partial<ProfileEntry> = {}): ProfileEntry {
  return {
    id: 'p-ssh',
    name: 'SSH devbox',
    type: 'remote',
    remoteHost: 'localhost',
    remotePort: 9876,
    targetOS: 'ssh-linux',
    sshHost: 'devbox.example',
    sshUser: 'alice',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

/**
 * Runs the tunnel decision `connect()` makes, without `connect()` itself (which
 * would start the tunnel and spawn ssh). `SshTunnel`'s constructor spawns nothing.
 */
function tunnelOf(client: RemoteClient): unknown {
  const internals = client as unknown as { tunnel: unknown; maybeCreateTunnel: () => void }
  internals.maybeCreateTunnel()
  return internals.tunnel
}

describe('resolveSshTunnelUse (T0425)', () => {
  it.each([
    ['ssh-linux', true, false],
    ['ssh-darwin', true, false],
    ['ssh-linux', undefined, false],
    ['ssh-linux', false, true],
    ['ssh-darwin', false, true],
  ] as const)('%s with useSshTunnel=%s → tunnel (legacy direct: %s)', (targetOS, useSshTunnel, legacyDirect) => {
    expect(resolveSshTunnelUse(sshProfile({ targetOS, useSshTunnel }))).toEqual({ useTunnel: true, legacyDirect })
  })

  it.each([undefined, 'local', 'wsl-linux', 'docker-linux'] as const)('non-ssh targetOS %s → no tunnel', (targetOS) => {
    expect(resolveSshTunnelUse(sshProfile({ targetOS, useSshTunnel: true }))).toEqual({ useTunnel: false, legacyDirect: false })
  })
})

describe('RemoteClient tunnel setup (T0425)', () => {
  it('creates the SSH tunnel for a legacy useSshTunnel=false profile', () => {
    expect(tunnelOf(new RemoteClient(() => [], sshProfile({ useSshTunnel: false })))).not.toBeNull()
  })

  it('creates the SSH tunnel for tunnel / unset profiles', () => {
    expect(tunnelOf(new RemoteClient(() => [], sshProfile({ useSshTunnel: true })))).not.toBeNull()
    expect(tunnelOf(new RemoteClient(() => [], sshProfile({ useSshTunnel: undefined })))).not.toBeNull()
  })

  it('does not create a tunnel for non-ssh profiles', () => {
    expect(tunnelOf(new RemoteClient(() => [], sshProfile({ targetOS: 'wsl-linux', wslDistro: 'Ubuntu' })))).toBeNull()
  })
})
