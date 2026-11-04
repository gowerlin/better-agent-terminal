/**
 * T0830 (PLAN-043, D271): the WSL profile details show a keep-alive switch. A profile without
 * `wslKeepAlive` shows it on; toggling calls profile:update with the new value (main re-syncs the
 * holders); a failed save puts the switch back and says so.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import { WslDetails } from '../details/WslDetails'
import type { ProfileEntry } from '../types'

type WslProfile = ProfileEntry & { wslKeepAlive?: boolean }

function profile(overrides: Partial<WslProfile> = {}): WslProfile {
  return {
    id: 'wsl-1',
    name: 'Ubuntu',
    type: 'remote',
    targetOS: 'wsl-linux',
    wslDistro: 'Ubuntu-24.04',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

let update: ReturnType<typeof vi.fn>

beforeEach(async () => {
  await i18n.changeLanguage('en')
  update = vi.fn(async () => true)
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    profile: { update },
    debug: { log: vi.fn() },
  }
})

afterEach(async () => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
  await i18n.changeLanguage('en')
})

describe('WslDetails keep-alive switch (T0830)', () => {
  it('a profile without the field shows keep-alive on', () => {
    render(<WslDetails profile={profile()} />)
    expect(screen.getByTestId('wsl-keepalive-toggle')).toBeChecked()
    expect(screen.getByTestId('wsl-keepalive-hint').textContent).toContain('keeps this distro running')
  })

  it('`wslKeepAlive: false` shows it off with the idle-shutdown note', () => {
    render(<WslDetails profile={profile({ wslKeepAlive: false })} />)
    expect(screen.getByTestId('wsl-keepalive-toggle')).not.toBeChecked()
    expect(screen.getByTestId('wsl-keepalive-hint').textContent).toContain('shut the distro down when it is idle')
  })

  it('toggling off calls profile:update({ wslKeepAlive: false }); toggling on sends true', async () => {
    render(<WslDetails profile={profile()} />)
    const toggle = screen.getByTestId('wsl-keepalive-toggle')
    fireEvent.click(toggle)
    await waitFor(() => expect(update).toHaveBeenCalledWith('wsl-1', { wslKeepAlive: false }))
    await waitFor(() => expect(toggle).not.toBeDisabled())
    expect(toggle).not.toBeChecked()

    fireEvent.click(toggle)
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('wsl-1', { wslKeepAlive: true }))
    await waitFor(() => expect(toggle).toBeChecked())
  })

  it('a failed save restores the previous value and shows an error', async () => {
    update.mockResolvedValueOnce(false)
    render(<WslDetails profile={profile()} />)
    const toggle = screen.getByTestId('wsl-keepalive-toggle')
    fireEvent.click(toggle)
    await screen.findByTestId('wsl-keepalive-error')
    expect(toggle).toBeChecked()
  })

  it('zh-TW text', async () => {
    await i18n.changeLanguage('zh-TW')
    render(<WslDetails profile={profile({ wslKeepAlive: false })} />)
    expect(screen.getByText(/保持 WSL 執行/)).toBeInTheDocument()
    expect(screen.getByTestId('wsl-keepalive-hint').textContent).toContain('下次連線會比較慢')
  })
})
