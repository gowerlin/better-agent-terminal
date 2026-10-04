/**
 * T0413 (PLAN-037 F): RemoteToolsPanel entry points outside the remote window.
 *  - RemoteToolsEntry: detect(profileId) wiring + T0412 requestInstall present / absent / failing
 *  - ProfilePanel: panel only on remote profiles, probe only on expand, coexists with the legacy targetOS prompt
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { RemoteToolsEntry } from '../profiles/RemoteToolsEntry'
import { ProfilePanel } from '../ProfilePanel'
import type { ProfileEntry } from '../profiles'
import {
  REMOTE_AUTH_ENV_VARS,
  REMOTE_TOOL_IDS,
  type RemoteToolsDetectResult,
  type RemoteToolsEnv,
} from '../../types/remote-tools'

const rt = en.remoteTools

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

const NO_AUTH_ENV = Object.fromEntries(REMOTE_AUTH_ENV_VARS.map((name) => [name, false])) as RemoteToolsEnv['authEnv']

/** Debian-ish host: everything present except git (missing ⇒ apt install button). */
const REPORT: RemoteToolsDetectResult = {
  ok: true,
  report: {
    schemaVersion: 1,
    env: {
      osFamily: 'linux', osId: 'debian', osVersion: '12', arch: 'x86_64', musl: false, pkgManager: 'apt',
      privilege: 'passwordless', isWsl: false, hasTimeout: true, authEnv: NO_AUTH_ENV,
    },
    tools: REMOTE_TOOL_IDS.map((id) => ({
      id,
      status: id === 'git' ? 'missing' : 'ok',
      version: id === 'git' ? undefined : '1.0.0',
      login: 'n/a',
      serverVisible: true,
    })),
    serverViewAvailable: true,
    warnings: [],
  },
}

type ElectronApiMock = {
  remoteTools: { detect: ReturnType<typeof vi.fn>; detectHere: ReturnType<typeof vi.fn>; requestInstall?: ReturnType<typeof vi.fn> }
  [key: string]: unknown
}

let originalApi: unknown

function installApi(extra: Partial<ElectronApiMock> = {}, requestInstall?: ReturnType<typeof vi.fn>): ElectronApiMock {
  const api: ElectronApiMock = {
    remoteTools: {
      detect: vi.fn().mockResolvedValue(REPORT),
      detectHere: vi.fn().mockResolvedValue(REPORT),
      ...(requestInstall ? { requestInstall } : {}),
    },
    ...extra,
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
  return api
}

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
})

afterEach(() => {
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
  vi.restoreAllMocks()
})

async function confirmGitInstall() {
  const row = await screen.findByTestId('remote-tool-git')
  fireEvent.click(within(row).getByRole('button', { name: rt.install }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: rt.confirm.confirmInstall }))
}

describe('RemoteToolsEntry', () => {
  test('detects with the given profileId once and keeps detect identity across re-renders', async () => {
    const api = installApi()
    const view = render(<RemoteToolsEntry profileId="p-1" host="profile" />)
    await screen.findByTestId('remote-tool-git')
    view.rerender(<RemoteToolsEntry profileId="p-1" host="profile" />)
    expect(api.remoteTools.detect).toHaveBeenCalledTimes(1)
    expect(api.remoteTools.detect).toHaveBeenCalledWith('p-1')
    expect(api.remoteTools.detectHere).not.toHaveBeenCalled()
  })

  test('without requestInstall (T0412 not landed) no install / update buttons are shown', async () => {
    installApi()
    render(<RemoteToolsEntry profileId="p-1" host="profile" />)
    const row = await screen.findByTestId('remote-tool-git')
    expect(within(row).queryByRole('button', { name: rt.install })).toBeNull()
    expect(screen.queryByRole('button', { name: rt.update })).toBeNull()
  })

  test('with requestInstall the confirmed plan is sent as { profileId, toolId, kind } only', async () => {
    const requestInstall = vi.fn().mockResolvedValue({ ok: true })
    installApi({}, requestInstall)
    render(<RemoteToolsEntry profileId="p-9" host="wizard" />)
    await confirmGitInstall()
    await waitFor(() => expect(requestInstall).toHaveBeenCalledTimes(1))
    expect(requestInstall).toHaveBeenCalledWith({ profileId: 'p-9', toolId: 'git', kind: 'install' })
    expect(screen.queryByTestId('remote-tools-install-error')).toBeNull()
  })

  test('requestInstall { ok: false } shows the error', async () => {
    const requestInstall = vi.fn().mockResolvedValue({ ok: false, error: 'profile window refused' })
    installApi({}, requestInstall)
    render(<RemoteToolsEntry profileId="p-9" host="profile" />)
    await confirmGitInstall()
    const alert = await screen.findByTestId('remote-tools-install-error')
    expect(alert).toHaveTextContent('profile window refused')
  })

  test('requestInstall rejection is shown as an error too', async () => {
    const requestInstall = vi.fn().mockRejectedValue(new Error('ipc gone'))
    installApi({}, requestInstall)
    render(<RemoteToolsEntry profileId="p-9" host="profile" />)
    await confirmGitInstall()
    expect(await screen.findByTestId('remote-tools-install-error')).toHaveTextContent('ipc gone')
  })
})

describe('ProfilePanel remote tools entry', () => {
  const now = Date.now()
  const LOCAL: ProfileEntry = { id: 'default', name: 'Default', type: 'local', createdAt: now, updatedAt: now }
  const REMOTE_WSL: ProfileEntry = {
    id: 'r-wsl', name: 'WSL box', type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu',
    remoteHost: 'localhost', remotePort: 9877, remoteToken: 'tok', remoteFingerprint: 'fp', createdAt: now, updatedAt: now,
  }
  const REMOTE_LEGACY: ProfileEntry = {
    id: 'r-legacy', name: 'Legacy box', type: 'remote',
    remoteHost: '10.0.0.2', remotePort: 9876, remoteToken: 'tok2', remoteFingerprint: 'fp2', createdAt: now, updatedAt: now,
  }

  function renderPanel(profiles: ProfileEntry[]) {
    const api = installApi({
      profile: { listLocal: vi.fn().mockResolvedValue({ profiles, activeProfileIds: ['default'] }) },
      app: { getWindowProfile: vi.fn().mockResolvedValue('default') },
      remote: { listProfiles: vi.fn().mockResolvedValue({ profiles: [], activeProfileIds: [] }) },
    })
    render(<ProfilePanel onClose={() => undefined} onSwitchNewWindow={() => undefined} />)
    return api
  }

  function card(profileId: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(`[data-testid="profile-card"][data-profile-id="${profileId}"]`)
    if (!el) throw new Error(`card ${profileId} not rendered`)
    return el
  }

  async function expand(profileId: string) {
    await waitFor(() => card(profileId))
    fireEvent.click(within(card(profileId)).getByRole('button', { name: 'Expand' }))
  }

  test('loading the list does not probe any profile', async () => {
    const api = renderPanel([LOCAL, REMOTE_WSL, REMOTE_LEGACY])
    await waitFor(() => card('r-legacy'))
    expect(api.remoteTools.detect).not.toHaveBeenCalled()
    expect(screen.queryByTestId('remote-tools-entry-profile')).toBeNull()
  })

  test('expanding a remote profile probes that profile only', async () => {
    const api = renderPanel([LOCAL, REMOTE_WSL, REMOTE_LEGACY])
    await expand('r-wsl')
    expect(await within(card('r-wsl')).findByTestId('remote-tools-entry-profile')).toBeInTheDocument()
    await within(card('r-wsl')).findByTestId('remote-tool-git')
    expect(api.remoteTools.detect).toHaveBeenCalledTimes(1)
    expect(api.remoteTools.detect).toHaveBeenCalledWith('r-wsl')
  })

  test('local profiles never show the panel', async () => {
    const api = renderPanel([LOCAL, REMOTE_WSL])
    await expand('default')
    expect(within(card('default')).queryByTestId('remote-tools-entry-profile')).toBeNull()
    expect(api.remoteTools.detect).not.toHaveBeenCalled()
  })

  test('legacy remote profile shows the targetOS prompt and the panel together', async () => {
    const api = renderPanel([LOCAL, REMOTE_LEGACY])
    await expand('r-legacy')
    const legacy = card('r-legacy')
    expect(within(legacy).getByTestId('legacy-remote-targetos-prompt')).toBeInTheDocument()
    expect(within(legacy).getByTestId('remote-tools-entry-profile')).toBeInTheDocument()
    await waitFor(() => expect(api.remoteTools.detect).toHaveBeenCalledWith('r-legacy'))
  })

  test('collapsing unmounts the panel; re-expanding probes again', async () => {
    const api = renderPanel([REMOTE_WSL])
    await expand('r-wsl')
    await within(card('r-wsl')).findByTestId('remote-tool-git')
    fireEvent.click(within(card('r-wsl')).getByRole('button', { name: 'Collapse' }))
    expect(within(card('r-wsl')).queryByTestId('remote-tools-entry-profile')).toBeNull()
    fireEvent.click(within(card('r-wsl')).getByRole('button', { name: 'Expand' }))
    await waitFor(() => expect(api.remoteTools.detect).toHaveBeenCalledTimes(2))
  })
})
