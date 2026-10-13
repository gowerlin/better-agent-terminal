/**
 * T0506: an SSH profile with no user (an ~/.ssh/config alias, T0505) or no
 * port is shown as what is stored, with a note that ssh config decides the
 * rest, instead of placeholder `user@` / `:22` values.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '../../../i18n'
import { SshDetails } from '../details/SshDetails'
import type { ProfileEntry } from '../types'

function profile(overrides: Partial<ProfileEntry>): ProfileEntry {
  return {
    id: 'p1',
    name: 'ssh',
    type: 'remote',
    targetOS: 'ssh-linux',
    sshHost: 'devbox',
    ...overrides,
  } as ProfileEntry
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('SshDetails host row (T0506)', () => {
  it('no user and no port: only the host, plus a note that ssh config decides both', () => {
    render(<SshDetails profile={profile({ sshUser: '' })} />)
    const target = screen.getByTestId('ssh-target')
    expect(target.textContent).toBe(`devbox (${i18n.t('profiles.sshDetails.userAndPortFromConfig')})`)
    expect(target.textContent).not.toContain('@')
    expect(target.textContent).not.toContain(':22')
  })

  it('no user, with a port: host:port and a user note', () => {
    render(<SshDetails profile={profile({ sshPort: 2222 })} />)
    expect(screen.getByTestId('ssh-target').textContent)
      .toBe(`devbox:2222 (${i18n.t('profiles.sshDetails.userFromConfig')})`)
  })

  it('a user, no port: user@host and a port note, without :22', () => {
    render(<SshDetails profile={profile({ sshUser: 'alice' })} />)
    expect(screen.getByTestId('ssh-target').textContent)
      .toBe(`alice@devbox (${i18n.t('profiles.sshDetails.portFromConfig')})`)
  })

  it('user and port set: unchanged user@host:port, no note', () => {
    render(<SshDetails profile={profile({ sshUser: 'alice', sshPort: 22 })} />)
    expect(screen.getByTestId('ssh-target').textContent).toBe('alice@devbox:22')
    expect(screen.queryByTestId('ssh-config-hint')).toBeNull()
  })

  it('falls back to remoteHost when sshHost is missing', () => {
    render(<SshDetails profile={profile({ sshHost: undefined, remoteHost: '10.0.0.5', sshUser: 'bob', sshPort: 2200 })} />)
    expect(screen.getByTestId('ssh-target').textContent).toBe('bob@10.0.0.5:2200')
  })

  it.each([
    ['zh-TW', '使用者與連接埠由 ~/.ssh/config 決定'],
    ['zh-CN', '用户与端口由 ~/.ssh/config 决定'],
  ])('the note follows the UI language (%s)', async (lng, note) => {
    await i18n.changeLanguage(lng)
    render(<SshDetails profile={profile({})} />)
    expect(screen.getByTestId('ssh-config-hint').textContent).toBe(` (${note})`)
  })
})
