/**
 * T0513 (BUG-123): Profile dialog status light of remote cards.
 *  - headless target answers `profile:list` with an empty stub, but this machine is connected → green
 *  - no window, target reachable → idle (not red); probe failure → red with the reason in the tooltip
 *  - ssh-* profiles are not probed directly; tooltips are translated; the light follows connection pushes
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import { ProfilePanel } from '../ProfilePanel'
import type { ProfileEntry, RemoteProfileConnectionSnapshot } from '../profiles'

const now = Date.now()
const LOCAL: ProfileEntry = { id: 'default', name: 'Default', type: 'local', createdAt: now, updatedAt: now }
const WSL: ProfileEntry = {
  id: 'wsl-ubuntu-24-04', name: 'WSL Ubuntu-24.04', type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04',
  remoteHost: 'localhost', remotePort: 9877, remoteToken: 'tok', remoteFingerprint: 'fp', createdAt: now, updatedAt: now,
}
const DOCKER: ProfileEntry = {
  id: 'docker-1', name: 'Docker', type: 'remote', targetOS: 'docker-linux', dockerContainer: 'bat',
  remoteHost: 'localhost', remotePort: 9880, remoteToken: 'tok-d', remoteFingerprint: 'fp-d', createdAt: now, updatedAt: now,
}
const SSH: ProfileEntry = {
  id: 'ssh-1', name: 'SSH box', type: 'remote', targetOS: 'ssh-linux', sshHost: 'box',
  remoteHost: 'localhost', remotePort: 9876, remoteToken: 'tok-s', remoteFingerprint: 'fp-s', createdAt: now, updatedAt: now,
}
const LEGACY: ProfileEntry = {
  id: 'legacy-1', name: 'Legacy BAT', type: 'remote', remoteProfileId: 'work',
  remoteHost: '10.0.0.2', remotePort: 9876, remoteToken: 'tok-l', remoteFingerprint: 'fp-l', createdAt: now, updatedAt: now,
}

type ListProfilesResult =
  | { profiles: { id: string; name: string; type: string }[]; activeProfileIds: string[]; fingerprint?: string }
  | { error: string; errorCode?: string }

let originalApi: unknown
let pushChanged: (() => void) | null

function installApi(opts: {
  profiles: ProfileEntry[]
  conns?: RemoteProfileConnectionSnapshot[]
  listProfiles?: (host: string, port: number) => Promise<ListProfilesResult>
  activeProfileIds?: string[]
}) {
  const api = {
    profile: { listLocal: vi.fn().mockResolvedValue({ profiles: opts.profiles, activeProfileIds: opts.activeProfileIds ?? ['default'] }) },
    app: { getWindowProfile: vi.fn().mockResolvedValue('default') },
    remote: {
      // headless bat-server's profile:list stub by default
      listProfiles: vi.fn(opts.listProfiles ?? (async () => ({ profiles: [], activeProfileIds: [] }))),
      profileConnectionStates: vi.fn().mockResolvedValue(opts.conns ?? []),
      onProfileConnectionsChanged: vi.fn((cb: () => void) => { pushChanged = cb; return () => { pushChanged = null } }),
    },
    remoteTools: { detect: vi.fn(), detectHere: vi.fn() },
    debug: { log: vi.fn() },
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
  return api
}

function dot(profileId: string): HTMLElement {
  const card = document.querySelector<HTMLElement>(`[data-testid="profile-card"][data-profile-id="${profileId}"]`)
  if (!card) throw new Error(`card ${profileId} not rendered`)
  return card.querySelector<HTMLElement>('[data-testid="profile-card-status"]')!
}

async function settledDot(profileId: string, status: string): Promise<HTMLElement> {
  await waitFor(() => expect(dot(profileId)).toHaveAttribute('data-status', status))
  return dot(profileId)
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
  pushChanged = null
})

afterEach(async () => {
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('ProfilePanel remote status light (BUG-123)', () => {
  test('headless remote with an open, connected window is green although profile:list is empty', async () => {
    const api = installApi({
      profiles: [LOCAL, WSL],
      activeProfileIds: ['default', WSL.id],
      conns: [{ profileId: WSL.id, state: 'connected', windows: 1 }],
    })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    const el = await settledDot(WSL.id, 'connected')
    expect(el).toHaveTextContent('🟢')
    expect(el).toHaveAttribute('title', en.profiles.statusReason.linked)
    // this machine already knows: the target is not probed
    expect(api.remote.listProfiles).not.toHaveBeenCalled()
    expect(dot('default')).toHaveAttribute('data-status', 'connected')
  })

  test('no window + reachable server is idle, not red', async () => {
    installApi({ profiles: [LOCAL, WSL] })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await waitFor(() => expect(dot(WSL.id)).toHaveAttribute('title', en.profiles.statusReason.reachable))
    expect(dot(WSL.id)).toHaveAttribute('data-status', 'idle')
    expect(dot(WSL.id)).toHaveTextContent('⚪')
  })

  test('probe failure is red with a short reason and the raw error', async () => {
    installApi({
      profiles: [WSL, DOCKER],
      listProfiles: async (_host, port) => port === 9877
        ? { error: 'connect ECONNREFUSED 127.0.0.1:9877', errorCode: 'network' }
        : { error: 'Fingerprint mismatch', errorCode: 'fingerprint-mismatch' },
    })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    const wsl = await settledDot(WSL.id, 'disconnected')
    expect(wsl).toHaveTextContent('🔴')
    expect(wsl.getAttribute('title')).toBe('Connection failed: unreachable (connect ECONNREFUSED 127.0.0.1:9877)')
    const docker = await settledDot(DOCKER.id, 'disconnected')
    expect(docker.getAttribute('title')).toBe('Connection failed: fingerprint mismatch (Fingerprint mismatch)')
  })

  test('a rejected probe is red too', async () => {
    installApi({ profiles: [WSL], listProfiles: async () => { throw new Error('ipc gone') } })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    const el = await settledDot(WSL.id, 'disconnected')
    expect(el.getAttribute('title')).toBe('Connection failed: error (ipc gone)')
  })

  test('ssh profile without a connection is idle and never probed directly', async () => {
    const api = installApi({ profiles: [SSH] })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await waitFor(() => expect(api.remote.profileConnectionStates).toHaveBeenCalled())
    const el = await settledDot(SSH.id, 'idle')
    expect(el).toHaveAttribute('title', en.profiles.statusReason.notChecked)
    expect(api.remote.listProfiles).not.toHaveBeenCalled()
  })

  test('open window whose connection is reconnecting is yellow; a window without a connection is red', async () => {
    installApi({
      profiles: [WSL, DOCKER],
      conns: [
        { profileId: WSL.id, state: 'reconnecting', windows: 1 },
        { profileId: DOCKER.id, state: null, windows: 1 },
      ],
    })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    expect(await settledDot(WSL.id, 'connecting')).toHaveTextContent('🟡')
    expect(await settledDot(DOCKER.id, 'disconnected')).toHaveAttribute('title', en.profiles.statusReason.linkLost)
  })

  test('legacy remote (full BAT): target profile open there is not green here — idle with a hint', async () => {
    installApi({
      profiles: [LEGACY],
      listProfiles: async () => ({ profiles: [{ id: 'work', name: 'Work', type: 'local' }], activeProfileIds: ['work'] }),
    })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await waitFor(() => expect(dot(LEGACY.id)).toHaveAttribute('title', en.profiles.statusReason.reachableRemoteActive))
    expect(dot(LEGACY.id)).toHaveAttribute('data-status', 'idle')
  })

  test('legacy remote connected from this machine is green', async () => {
    installApi({ profiles: [LEGACY], conns: [{ profileId: LEGACY.id, state: 'connected', windows: 1 }] })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await settledDot(LEGACY.id, 'connected')
  })

  test('the light follows connection pushes while the dialog is open', async () => {
    const api = installApi({ profiles: [WSL] })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await waitFor(() => expect(dot(WSL.id)).toHaveAttribute('title', en.profiles.statusReason.reachable))
    api.remote.profileConnectionStates.mockResolvedValue([{ profileId: WSL.id, state: 'connected', windows: 1 }])
    expect(pushChanged).toBeTypeOf('function')
    await act(async () => { pushChanged!() })
    await settledDot(WSL.id, 'connected')
  })

  test('tooltip is translated (zh-TW)', async () => {
    await i18n.changeLanguage('zh-TW')
    installApi({ profiles: [WSL], conns: [{ profileId: WSL.id, state: 'connected', windows: 1 }] })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    const el = await settledDot(WSL.id, 'connected')
    expect(el).toHaveAttribute('title', zhTW.profiles.statusReason.linked)
  })

  test('without the connection-states API (older preload) the dialog still renders, nothing is red for "not open"', async () => {
    const api = installApi({ profiles: [WSL] })
    ;(api.remote as Partial<typeof api.remote>).profileConnectionStates = undefined
    ;(api.remote as Partial<typeof api.remote>).onProfileConnectionsChanged = undefined
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    await waitFor(() => expect(dot(WSL.id)).toHaveAttribute('title', en.profiles.statusReason.reachable))
  })
})
