/**
 * PLAN-007 T0288: ProfileCard, the per-env details dispatcher and DockerDetails,
 * rendered for real with i18n (T0652 moved their labels to i18n). Moved from
 * tests/profile-card.test.ts by T0680 (BUG-168): that file called the components
 * as plain functions, which breaks on any hook.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '../../../i18n'
import { ProfileCard, type ProfileCardProps } from '../ProfileCard'
import { ProfileCardDetails } from '../ProfileCardDetails'
import { DockerDetails } from '../details/DockerDetails'
import { selectDetailsVariant, type ProfileEntry } from '../types'

function mk(partial: Partial<ProfileEntry> = {}): ProfileEntry {
  return {
    id: 'p1',
    name: 'Demo Profile',
    type: 'local',
    createdAt: 1,
    updatedAt: 2,
    ...partial,
  } as ProfileEntry
}

function renderCard(overrides: Partial<ProfileCardProps> = {}) {
  const props: ProfileCardProps = {
    profile: mk(),
    isActive: false,
    isRunning: false,
    isExpanded: false,
    onToggleExpand: vi.fn(),
    onSwitch: vi.fn(),
    ...overrides,
  }
  render(<ProfileCard {...props} />)
  return props
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('selectDetailsVariant', () => {
  it.each([
    [mk({ type: 'local' }), 'local'],
    [mk({ type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu' }), 'wsl'],
    [mk({ type: 'remote', targetOS: 'docker-linux', dockerContainer: 'bat' }), 'docker'],
    [mk({ type: 'remote', targetOS: 'ssh-linux' }), 'ssh-linux'],
    [mk({ type: 'remote', targetOS: 'ssh-darwin' }), 'ssh-darwin'],
    [mk({ type: 'remote' }), 'remote-legacy'],
  ] as const)('routes %o to %s', (profile, variant) => {
    expect(selectDetailsVariant(profile)).toBe(variant)
  })

  it('routes an unknown targetOS (legacy or newer schema) to remote-legacy', () => {
    const exotic = { ...mk({ type: 'remote' }), targetOS: 'beos' } as unknown as ProfileEntry
    expect(selectDetailsVariant(exotic)).toBe('remote-legacy')
  })
})

describe('ProfileCardDetails', () => {
  it.each([
    [mk({ type: 'local' }), 'profile-details-local'],
    [mk({ type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu' }), 'profile-details-wsl'],
    [mk({ type: 'remote', targetOS: 'docker-linux' }), 'profile-details-docker'],
    [mk({ type: 'remote', targetOS: 'ssh-linux', sshHost: 'devbox' }), 'profile-details-ssh-linux'],
    [mk({ type: 'remote', targetOS: 'ssh-darwin', sshHost: 'devbox' }), 'profile-details-ssh-darwin'],
    [mk({ type: 'remote' }), 'profile-details-remote-legacy'],
  ] as const)('renders the details slot for %o (%s)', (profile, testId) => {
    render(<ProfileCardDetails profile={profile} />)
    expect(screen.getByTestId(testId)).toBeInTheDocument()
  })

  it('SshDetails tells ssh-linux (systemd) and ssh-darwin (launchd) apart', () => {
    const { unmount } = render(<ProfileCardDetails profile={mk({ type: 'remote', targetOS: 'ssh-linux', sshHost: 'devbox' })} />)
    expect(screen.getByTestId('ssh-service-badge').textContent).toBe('systemd (user)')
    unmount()
    render(<ProfileCardDetails profile={mk({ type: 'remote', targetOS: 'ssh-darwin', sshHost: 'devbox' })} />)
    expect(screen.getByTestId('ssh-service-badge').textContent).toBe('launchd')
  })
})

describe('DockerDetails', () => {
  function dockerProfile(partial: Partial<ProfileEntry> & { dockerMounts?: Array<{ host: string; container: string }> } = {}) {
    return mk({ type: 'remote', targetOS: 'docker-linux', ...partial } as Partial<ProfileEntry>)
  }

  it('renders the mount table when the profile carries dockerMounts', () => {
    render(<DockerDetails profile={dockerProfile({
      dockerMounts: [
        { host: '/host/a', container: '/container/a' },
        { host: '/host/b', container: '/container/b' },
      ],
    })} />)
    const table = screen.getByTestId('docker-mount-table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => Array.from(row.querySelectorAll('td'), (td) => td.textContent))).toEqual([
      ['/host/a', '/container/a'],
      ['/host/b', '/container/b'],
    ])
    expect(within(table).getByText(i18n.t('profiles.details.mounts'))).toBeInTheDocument()
  })

  it('has no mount table without mounts', () => {
    render(<DockerDetails profile={dockerProfile({ dockerMounts: [] })} />)
    expect(screen.getByTestId('profile-details-docker')).toBeInTheDocument()
    expect(screen.queryByTestId('docker-mount-table')).toBeNull()
  })

  it('shows container, host:port and target, with defaults for missing values', () => {
    const { unmount } = render(<DockerDetails profile={dockerProfile({ dockerContainer: 'bat-demo', dockerHost: 'docker.local', remotePort: 19877, remoteProfileId: 'work' })} />)
    let details = screen.getByTestId('profile-details-docker')
    expect(Array.from(details.querySelectorAll('dd'), (dd) => dd.textContent)).toEqual(['bat-demo', 'docker.local:19877', 'work'])
    unmount()

    render(<DockerDetails profile={dockerProfile()} />)
    details = screen.getByTestId('profile-details-docker')
    expect(Array.from(details.querySelectorAll('dd'), (dd) => dd.textContent)).toEqual(['—', 'localhost:9876', 'default'])
  })

  it('labels follow the UI language (zh-TW)', async () => {
    await i18n.changeLanguage('zh-TW')
    render(<DockerDetails profile={dockerProfile({ dockerMounts: [{ host: '/host/a', container: '/container/a' }] })} />)
    const headers = Array.from(screen.getByTestId('docker-mount-table').querySelectorAll('th'), (th) => th.textContent)
    expect(headers).toEqual([i18n.t('profiles.details.mountHost'), i18n.t('profiles.details.mountContainer')])
    expect(headers).toEqual(['本機', '容器'])
  })
})

describe('ProfileCard', () => {
  it('renders the card with name and id, collapsed without details', () => {
    renderCard({ profile: mk({ id: 'p-demo', name: 'Demo Local' }) })
    const card = screen.getByTestId('profile-card')
    expect(card.getAttribute('data-profile-id')).toBe('p-demo')
    expect(card.textContent).toContain('Demo Local')
    expect(card.querySelector('.profile-card-body')).toBeNull()
    expect(screen.getByRole('button', { name: 'Expand' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('expanded: renders extras and the per-env details', () => {
    renderCard({
      profile: mk({ type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu' }),
      isExpanded: true,
      expandedExtras: <div data-testid="demo-extras" />,
    })
    expect(screen.getByTestId('demo-extras')).toBeInTheDocument()
    expect(screen.getByTestId('profile-details-wsl')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse' }).getAttribute('aria-expanded')).toBe('true')
  })

  it.each([
    [mk({ type: 'remote', targetOS: 'wsl-linux' }), 'WSL'],
    [mk({ type: 'remote', targetOS: 'docker-linux' }), 'Docker'],
    [mk({ type: 'remote', targetOS: 'ssh-linux' }), 'SSH (Linux)'],
    [mk({ type: 'remote', targetOS: 'ssh-darwin' }), 'SSH (macOS)'],
  ] as const)('the badge of %o is the product name %s', (profile, label) => {
    renderCard({ profile })
    expect(screen.getByTestId('profile-card-badge').textContent).toBe(label)
  })

  it.each(['en', 'zh-TW'])('Local / Remote badges follow the UI language (%s)', async (lng) => {
    await i18n.changeLanguage(lng)
    const { unmount } = render(<ProfileCard profile={mk({ type: 'local' })} isActive={false} isRunning={false} isExpanded={false} onToggleExpand={() => {}} onSwitch={() => {}} />)
    expect(screen.getByTestId('profile-card-badge').textContent).toBe(i18n.t('profiles.details.local'))
    unmount()
    render(<ProfileCard profile={mk({ type: 'remote' })} isActive={false} isRunning={false} isExpanded={false} onToggleExpand={() => {}} onSwitch={() => {}} />)
    expect(screen.getByTestId('profile-card-badge').textContent).toBe(i18n.t('profiles.remote'))
  })

  it('remote meta shows host:port (default 9876) and the remote profile id', () => {
    renderCard({ profile: mk({ type: 'remote', remoteHost: '10.0.0.5', remoteProfileId: 'work' }) })
    expect(screen.getByTestId('profile-card').querySelector('.profile-card-meta')?.textContent).toBe('10.0.0.5:9876 → work')
  })

  it('header click and the toggle button expand; switch and actions do not', () => {
    const props = renderCard({ actions: <button type="button" data-testid="demo-action">x</button> })
    fireEvent.click(screen.getByTestId('profile-card').querySelector('.profile-card-header')!)
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(props.onToggleExpand).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByTestId('profile-card-switch'))
    fireEvent.click(screen.getByTestId('demo-action'))
    expect(props.onSwitch).toHaveBeenCalledTimes(1)
    expect(props.onToggleExpand).toHaveBeenCalledTimes(2)
  })

  it('edit / delete buttons appear only with their callbacks', () => {
    const { unmount } = render(<ProfileCard profile={mk()} isActive={false} isRunning={false} isExpanded={false} onToggleExpand={() => {}} onSwitch={() => {}} />)
    expect(screen.queryByTestId('profile-card-edit')).toBeNull()
    expect(screen.queryByTestId('profile-card-delete')).toBeNull()
    unmount()

    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderCard({ onEdit, onDelete })
    fireEvent.click(screen.getByTestId('profile-card-edit'))
    fireEvent.click(screen.getByTestId('profile-card-delete'))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('status light: idle / connected from isRunning, an explicit status and title win (T0513)', () => {
    const { unmount } = render(<ProfileCard profile={mk()} isActive={false} isRunning={false} isExpanded={false} onToggleExpand={() => {}} onSwitch={() => {}} />)
    let dot = screen.getByTestId('profile-card-status')
    expect(dot.getAttribute('data-status')).toBe('idle')
    expect(dot.getAttribute('title')).toBe(i18n.t('profiles.status.idle'))
    unmount()

    const second = render(<ProfileCard profile={mk()} isActive={false} isRunning isExpanded={false} onToggleExpand={() => {}} onSwitch={() => {}} />)
    expect(screen.getByTestId('profile-card-status').getAttribute('data-status')).toBe('connected')
    second.unmount()

    renderCard({ isRunning: true, connectionStatus: 'disconnected', connectionStatusTitle: 'Demo failure' })
    dot = screen.getByTestId('profile-card-status')
    expect(dot.getAttribute('data-status')).toBe('disconnected')
    expect(dot.getAttribute('title')).toBe('Demo failure')
  })
})
