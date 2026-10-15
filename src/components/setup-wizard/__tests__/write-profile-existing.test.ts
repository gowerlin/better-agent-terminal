/**
 * T0552 (BUG-138): re-running the WSL / SSH wizard against a server that
 * already has a profile updates that profile instead of adding a second one;
 * rollback puts the overwritten values back and never deletes it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WizardContext } from '../wizard-runner'
import { writeProfileStep } from '../steps/wsl/write-profile'

type Profile = {
  id: string
  name: string
  type: 'local' | 'remote'
  remoteHost?: string
  remotePort?: number
  remoteToken?: string
  remoteFingerprint?: string
  targetOS?: string
  wslDistro?: string
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  createdAt: number
  updatedAt: number
}

let profiles: Profile[]
let createMock: ReturnType<typeof vi.fn>
let updateMock: ReturnType<typeof vi.fn>
let deleteMock: ReturnType<typeof vi.fn>

function remote(fields: Partial<Profile> & { id: string }): Profile {
  return { name: fields.id, type: 'remote', remoteHost: 'localhost', createdAt: 1, updatedAt: 1, ...fields }
}

function wslCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: '' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    wslDistro: 'Ubuntu-24.04',
    serverPort: 9877,
    remoteToken: 'token-1',
    fingerprint: 'AA:BB',
    ...overrides,
  }
}

function sshCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: '' },
    warnings: [],
    state: { sshHost: 'devbox', sshUser: 'alice', sshServerHome: '/home/alice' },
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    serverPort: 9876,
    remoteToken: 'token-ssh',
    fingerprint: 'CC:DD',
    ...overrides,
  }
}

beforeEach(() => {
  profiles = []
  let next = 1
  createMock = vi.fn(async (name: string, options: Partial<Profile>) => {
    const profile = remote({ ...options, id: `p-new-${next++}`, name })
    profiles.push(profile)
    return profile
  })
  updateMock = vi.fn(async (id: string, updates: Partial<Profile>) => {
    const profile = profiles.find((p) => p.id === id)
    if (!profile) return false
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) (profile as Record<string, unknown>)[key] = value
    }
    return true
  })
  deleteMock = vi.fn(async (id: string) => {
    const before = profiles.length
    profiles = profiles.filter((p) => p.id !== id)
    return profiles.length !== before
  })
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      profile: {
        listLocal: vi.fn(async () => ({ profiles: profiles.map((p) => ({ ...p })), activeProfileIds: [] })),
        create: createMock,
        update: updateMock,
        delete: deleteMock,
      },
    },
  }
})

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('write-profile, WSL (T0552 / BUG-138)', () => {
  it('updates the profile of the same distro + port instead of creating one', async () => {
    profiles.push(remote({ id: 'wsl-ubuntu-24-04', name: 'Ubuntu 24.04', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04', remotePort: 9877, remoteToken: 'token-1', remoteFingerprint: 'AA:BB' }))
    const ctx = wslCtx()
    await writeProfileStep.run(ctx)

    expect(createMock).not.toHaveBeenCalled()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]).toMatchObject({ id: 'wsl-ubuntu-24-04', name: 'Ubuntu 24.04', remotePort: 9877, remoteToken: 'token-1', remoteFingerprint: 'AA:BB' })
    expect(ctx.updatedProfileId).toBe('wsl-ubuntu-24-04')
    expect(ctx.createdProfileId).toBeUndefined()
  })

  it('writes a new token / fingerprint into it; rollback restores the old ones and keeps the profile', async () => {
    profiles.push(remote({ id: 'w1', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04', remotePort: 9877, remoteToken: 'old-token', remoteFingerprint: 'OLD' }))
    const ctx = wslCtx()
    await writeProfileStep.run(ctx)
    expect(profiles[0]).toMatchObject({ remoteToken: 'token-1', remoteFingerprint: 'AA:BB' })

    await writeProfileStep.rollback!(ctx)
    expect(deleteMock).not.toHaveBeenCalled()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]).toMatchObject({ id: 'w1', remoteToken: 'old-token', remoteFingerprint: 'OLD' })
    expect(ctx.updatedProfileId).toBeUndefined()
  })

  it('creates a new profile when only another distro, another port or a non-WSL profile exists', async () => {
    profiles.push(
      remote({ id: 'other-distro', targetOS: 'wsl-linux', wslDistro: 'Debian', remotePort: 9877 }),
      remote({ id: 'other-port', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04', remotePort: 9878 }),
      remote({ id: 'docker', targetOS: 'docker-linux', remotePort: 9877 }),
      remote({ id: 'far', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04', remotePort: 9877, remoteHost: '10.0.0.5' }),
    )
    const ctx = wslCtx()
    await writeProfileStep.run(ctx)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(ctx.createdProfileId).toBe('p-new-1')
    expect(ctx.updatedProfileId).toBeUndefined()
    expect(updateMock.mock.calls.map((call) => call[0])).toEqual(['p-new-1'])
  })

  it('updates every profile of that server, and deletes what earlier attempts of this run created', async () => {
    profiles.push(
      remote({ id: 'a', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04', remotePort: 9877 }),
      remote({ id: 'b', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04', remotePort: 9877, remoteHost: '127.0.0.1' }),
      remote({ id: 'left-by-attempt-1', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04', remotePort: 9877 }),
    )
    const ctx = wslCtx({ createdProfileId: 'left-by-attempt-1', createdProfileIds: ['left-by-attempt-1'] })
    await writeProfileStep.run(ctx)
    expect(updateMock.mock.calls.map((call) => call[0])).toEqual(['a', 'b'])
    expect(deleteMock).toHaveBeenCalledWith('left-by-attempt-1')
    expect(profiles.map((p) => p.id)).toEqual(['a', 'b'])
    expect(ctx.updatedProfileId).toBe('a')
    expect(ctx.createdProfileIds).toBeUndefined()
  })

  it('a failed list falls back to creating a profile (pre-T0552 behaviour)', async () => {
    ;(window.electronAPI.profile as unknown as { listLocal: () => Promise<never> }).listLocal = async () => {
      throw new Error('ipc down')
    }
    const ctx = wslCtx()
    await writeProfileStep.run(ctx)
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})

describe('write-profile, SSH (T0552: same disease — a re-run added a second profile)', () => {
  it('updates the profile of the same host / user / ssh port / server port', async () => {
    profiles.push(remote({ id: 's1', name: 'devbox', targetOS: 'ssh-linux', sshHost: 'devbox', sshUser: 'alice', remotePort: 9876, remoteToken: 'old' }))
    const ctx = sshCtx()
    await writeProfileStep.run(ctx)
    expect(createMock).not.toHaveBeenCalled()
    expect(profiles[0]).toMatchObject({ id: 's1', name: 'devbox', remoteToken: 'token-ssh', remoteFingerprint: 'CC:DD', useSshTunnel: true })
    expect(ctx.updatedProfileId).toBe('s1')
  })

  it('another user or another ssh port is another server -> new profile', async () => {
    profiles.push(
      remote({ id: 'bob', targetOS: 'ssh-linux', sshHost: 'devbox', sshUser: 'bob', remotePort: 9876 }),
      remote({ id: 'port2222', targetOS: 'ssh-linux', sshHost: 'devbox', sshUser: 'alice', sshPort: 2222, remotePort: 9876 }),
    )
    const ctx = sshCtx()
    await writeProfileStep.run(ctx)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(ctx.updatedProfileId).toBeUndefined()
  })

  it('ssh port 22 written out matches a profile that left it unset', async () => {
    profiles.push(remote({ id: 's22', targetOS: 'ssh-linux', sshHost: 'devbox', sshUser: 'alice', remotePort: 9876 }))
    const ctx = sshCtx({ state: { sshHost: 'devbox', sshUser: 'alice', sshPort: 22, sshServerHome: '/home/alice' } })
    await writeProfileStep.run(ctx)
    expect(createMock).not.toHaveBeenCalled()
    expect(ctx.updatedProfileId).toBe('s22')
  })
})
