/**
 * T0650 (BUG-157): "Edit connection" → "Pin expected fingerprint" → Save.
 *  - the pinned fingerprint is shown in the dialog and Save keeps it (Save used to write the old one back)
 *  - a failed pin shows an error and keeps the dialog open; nothing is written
 *  - editing other fields leaves the fingerprint as it was
 *  - a pin that finishes after the dialog closed does not leak into the next edited profile
 *
 * T0655 (BUG-160): an ssh-* profile's remoteHost:remotePort is the server's own localhost (it is
 * reached through an SSH tunnel), so a direct pin would reach whatever listens on that port here.
 * Its pin button is disabled with a note, and handlePinFingerprint never connects for it.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { ProfilePanel } from '../ProfilePanel'
import type { ProfileEntry } from '../profiles'

const now = Date.now()
const LEGACY: ProfileEntry = {
  id: 'legacy-1', name: 'Legacy BAT', type: 'remote', remoteProfileId: 'work',
  remoteHost: '10.0.0.2', remotePort: 9876, remoteToken: 'tok-l', remoteFingerprint: 'fp-old', createdAt: now, updatedAt: now,
}
const OTHER: ProfileEntry = {
  id: 'legacy-2', name: 'Other BAT', type: 'remote', remoteProfileId: 'default',
  remoteHost: '10.0.0.3', remotePort: 9876, remoteToken: 'tok-o', remoteFingerprint: 'fp-other', createdAt: now, updatedAt: now,
}

const SSH: ProfileEntry = {
  id: 'ssh-1', name: 'SSH BAT', type: 'remote', targetOS: 'ssh-linux', remoteProfileId: 'default',
  remoteHost: 'localhost', remotePort: 9876, remoteToken: 'tok-s', remoteFingerprint: 'fp-ssh',
  sshHost: 'build-box', sshUser: 'dev', useSshTunnel: true, createdAt: now, updatedAt: now,
}
const WSL: ProfileEntry = {
  id: 'wsl-1', name: 'WSL BAT', type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu', remoteProfileId: 'default',
  remoteHost: 'localhost', remotePort: 9877, remoteToken: 'tok-w', remoteFingerprint: 'fp-wsl', createdAt: now, updatedAt: now,
}
const DOCKER: ProfileEntry = {
  id: 'docker-1', name: 'Docker BAT', type: 'remote', targetOS: 'docker-linux', dockerContainer: 'bat', remoteProfileId: 'default',
  remoteHost: 'localhost', remotePort: 9878, remoteToken: 'tok-d', remoteFingerprint: 'fp-docker', createdAt: now, updatedAt: now,
}

type TestConnectionResult = { ok: boolean; fingerprint?: string; errorCode?: string; error?: string }

let originalApi: unknown

function installApi(opts: { profiles: ProfileEntry[]; testConnection: () => Promise<TestConnectionResult> }) {
  let stored = opts.profiles.map(p => ({ ...p }))
  const api = {
    profile: {
      listLocal: vi.fn(async () => ({ profiles: stored.map(p => ({ ...p })), activeProfileIds: ['default'] })),
      update: vi.fn(async (id: string, patch: Partial<ProfileEntry>) => {
        stored = stored.map(p => (p.id === id ? { ...p, ...patch } : p))
        return true
      }),
    },
    app: { getWindowProfile: vi.fn().mockResolvedValue('default') },
    remote: {
      listProfiles: vi.fn(async () => ({ profiles: [], activeProfileIds: [] })),
      testConnection: vi.fn(opts.testConnection),
      profileConnectionStates: vi.fn().mockResolvedValue([]),
      onProfileConnectionsChanged: vi.fn(() => () => undefined),
    },
    // the edited card expands and mounts RemoteToolsPanel; keep its detection pending
    remoteTools: { detect: vi.fn(() => new Promise(() => undefined)), detectHere: vi.fn(() => new Promise(() => undefined)) },
    debug: { log: vi.fn() },
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
  return { api, stored: () => stored }
}

function card(profileId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-testid="profile-card"][data-profile-id="${profileId}"]`)
  if (!el) throw new Error(`card ${profileId} not rendered`)
  return el
}

async function openEdit(profileId: string): Promise<HTMLElement> {
  await waitFor(() => card(profileId))
  fireEvent.click(card(profileId).querySelector<HTMLElement>(`button[title="${en.profiles.editConnection}"]`)!)
  return screen.findByRole('heading', { name: en.profiles.editConnection })
}

function fingerprintField(): HTMLInputElement {
  return screen.getByPlaceholderText(en.profiles.fingerprint.pinnedPlaceholder) as HTMLInputElement
}

const pinButton = () => screen.getByRole('button', { name: en.profiles.fingerprint.pin })
const saveButton = () => screen.getByRole('button', { name: en.common.save })

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
})

afterEach(async () => {
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('Edit connection: pin expected fingerprint (BUG-157)', () => {
  test('pin → save keeps the newly pinned fingerprint', async () => {
    const { api, stored } = installApi({ profiles: [LEGACY], testConnection: async () => ({ ok: true, fingerprint: 'fp-new' }) })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(LEGACY.id)
    expect(fingerprintField().value).toBe('fp-old')

    fireEvent.click(pinButton())
    await waitFor(() => expect(fingerprintField().value).toBe('fp-new'))
    // observe only: the pin request does not present the old fingerprint
    expect(api.remote.testConnection).toHaveBeenCalledWith('10.0.0.2', 9876, 'tok-l', undefined)
    expect(api.profile.update).toHaveBeenCalledWith(LEGACY.id, { remoteFingerprint: 'fp-new' })

    fireEvent.click(saveButton())
    await waitFor(() => expect(api.profile.update).toHaveBeenCalledTimes(2))
    expect(api.profile.update.mock.calls[1][1]).toMatchObject({ remoteFingerprint: 'fp-new' })
    expect(stored().find(p => p.id === LEGACY.id)?.remoteFingerprint).toBe('fp-new')
  })

  test('a failed pin shows an error, keeps the dialog open and writes nothing', async () => {
    const { api, stored } = installApi({
      profiles: [LEGACY],
      testConnection: async () => ({ ok: false, errorCode: 'network', error: 'connect ECONNREFUSED 10.0.0.2:9876' }),
    })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(LEGACY.id)

    fireEvent.click(pinButton())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Connection failed: unreachable (connect ECONNREFUSED 10.0.0.2:9876)')
    expect(screen.getByRole('heading', { name: en.profiles.editConnection })).toBeInTheDocument()
    expect(fingerprintField().value).toBe('fp-old')
    expect(api.profile.update).not.toHaveBeenCalled()

    // Save after a failed pin keeps the old fingerprint
    fireEvent.click(saveButton())
    await waitFor(() => expect(api.profile.update).toHaveBeenCalledTimes(1))
    expect(api.profile.update.mock.calls[0][1]).toMatchObject({ remoteFingerprint: 'fp-old' })
    expect(stored()[0].remoteFingerprint).toBe('fp-old')
  })

  test('a rejected pin or a reply without a fingerprint also shows an error', async () => {
    let reply: () => Promise<TestConnectionResult> = async () => { throw new Error('ipc gone') }
    const { api } = installApi({ profiles: [LEGACY], testConnection: () => reply() })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(LEGACY.id)

    fireEvent.click(pinButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed: error (ipc gone)')

    reply = async () => ({ ok: true })
    fireEvent.click(pinButton())
    await waitFor(() => expect(api.remote.testConnection).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection failed: error'))
    expect(screen.getByRole('alert')).not.toHaveTextContent('ipc gone')
    expect(api.profile.update).not.toHaveBeenCalled()
    expect(fingerprintField().value).toBe('fp-old')
  })

  test('a successful pin clears an earlier pin error', async () => {
    let reply: () => Promise<TestConnectionResult> = async () => ({ ok: false, errorCode: 'timeout', error: 'timed out' })
    installApi({ profiles: [LEGACY], testConnection: () => reply() })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(LEGACY.id)

    fireEvent.click(pinButton())
    await screen.findByRole('alert')
    reply = async () => ({ ok: true, fingerprint: 'fp-new' })
    fireEvent.click(pinButton())
    await waitFor(() => expect(fingerprintField().value).toBe('fp-new'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('editing other fields leaves the fingerprint unchanged', async () => {
    const { api } = installApi({ profiles: [LEGACY], testConnection: async () => ({ ok: true, fingerprint: 'fp-new' }) })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(LEGACY.id)

    fireEvent.change(screen.getByPlaceholderText(en.profiles.host), { target: { value: '10.0.0.9' } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(api.profile.update).toHaveBeenCalledTimes(1))
    expect(api.profile.update.mock.calls[0][1]).toMatchObject({ remoteHost: '10.0.0.9', remoteFingerprint: 'fp-old' })
    expect(api.remote.testConnection).not.toHaveBeenCalled()
  })

  test('a pin that finishes after the dialog closed does not touch the next edited profile', async () => {
    let resolvePin: (r: TestConnectionResult) => void = () => undefined
    const { api } = installApi({
      profiles: [LEGACY, OTHER],
      testConnection: () => new Promise<TestConnectionResult>(resolve => { resolvePin = resolve }),
    })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(LEGACY.id)
    fireEvent.click(pinButton())
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }))

    await openEdit(OTHER.id)
    expect(fingerprintField().value).toBe('fp-other')
    resolvePin({ ok: true, fingerprint: 'fp-new' })
    // the pin itself is still written to the profile it was started for
    await waitFor(() => expect(api.profile.update).toHaveBeenCalledWith(LEGACY.id, { remoteFingerprint: 'fp-new' }))
    expect(fingerprintField().value).toBe('fp-other')

    fireEvent.click(saveButton())
    await waitFor(() => expect(api.profile.update).toHaveBeenCalledTimes(2))
    expect(api.profile.update.mock.calls[1]).toEqual([OTHER.id, expect.objectContaining({ remoteFingerprint: 'fp-other' })])
  })
})

describe('Edit connection: no pin for SSH profiles (BUG-160)', () => {
  test.each([
    ['ssh-linux', SSH],
    ['ssh-darwin', { ...SSH, id: 'ssh-2', targetOS: 'ssh-darwin' } as ProfileEntry],
  ])('%s: the pin button is disabled with a note and nothing connects', async (_os, profile) => {
    const { api } = installApi({ profiles: [profile], testConnection: async () => ({ ok: true, fingerprint: 'fp-local-other' }) })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(profile.id)

    expect(pinButton()).toBeDisabled()
    expect(screen.getByText(en.profiles.fingerprint.pinSshDisabled)).toBeInTheDocument()
    fireEvent.click(pinButton())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(api.remote.testConnection).not.toHaveBeenCalled()
    expect(api.profile.update).not.toHaveBeenCalled()
    expect(fingerprintField().value).toBe('fp-ssh')

    // Save keeps the wizard's fingerprint
    fireEvent.click(saveButton())
    await waitFor(() => expect(api.profile.update).toHaveBeenCalledTimes(1))
    expect(api.profile.update.mock.calls[0][1]).toMatchObject({ remoteFingerprint: 'fp-ssh' })
    expect(api.remote.testConnection).not.toHaveBeenCalled()
  })

  test('handlePinFingerprint refuses an SSH profile even when the button fires', async () => {
    const { api } = installApi({ profiles: [SSH], testConnection: async () => ({ ok: true, fingerprint: 'fp-local-other' }) })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(SSH.id)

    // bypass the disabled attribute: React's onClick still runs when the handler is invoked directly
    const button = pinButton()
    const reactPropsKey = Object.keys(button).find(k => k.startsWith('__reactProps$'))!
    ;(button as unknown as Record<string, { onClick: () => void }>)[reactPropsKey].onClick()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(api.remote.testConnection).not.toHaveBeenCalled()
    expect(api.profile.update).not.toHaveBeenCalled()
    expect(fingerprintField().value).toBe('fp-ssh')
  })

  test.each([
    ['wsl-linux', WSL, 'tok-w', 9877],
    ['docker-linux', DOCKER, 'tok-d', 9878],
  ])('%s: pinning works as before', async (_os, profile, token, port) => {
    const { api } = installApi({ profiles: [profile], testConnection: async () => ({ ok: true, fingerprint: 'fp-new' }) })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await openEdit(profile.id)

    expect(pinButton()).toBeEnabled()
    expect(screen.queryByText(en.profiles.fingerprint.pinSshDisabled)).toBeNull()
    fireEvent.click(pinButton())
    await waitFor(() => expect(fingerprintField().value).toBe('fp-new'))
    expect(api.remote.testConnection).toHaveBeenCalledWith('localhost', port, token, undefined)
    expect(api.profile.update).toHaveBeenCalledWith(profile.id, { remoteFingerprint: 'fp-new' })
  })
})
