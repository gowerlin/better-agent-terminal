/**
 * PLAN-063 / T0821: the Windows-only line of the update notification (子項 1), the upgrade notice
 * toast and the upgrade text of InterruptedAgentsDialog (子項 2), the renderer's notice parsing,
 * the three locales, and App.tsx source guards.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { showsWindowsUpgradeWarning, UpdateNotification } from '../UpdateNotification'
import { SERVER_STATUS_TOAST_KEYS, ServerStatusToast, UPGRADE_INTERRUPTED_TOAST_KEY } from '../ServerStatusToast'
import { InterruptedAgentsDialog, type InterruptedAgentRow } from '../InterruptedAgentsDialog'
import { allUpgradeInterrupted, parseUpgradeInterruptionNotice, type InterruptedAgentInfo } from '../../stores/interrupted-agents-store'

type Locale = Record<string, Record<string, string>>
const LOCALES: Array<[string, Locale]> = [['en', en as unknown as Locale], ['zh-TW', zhTW as unknown as Locale], ['zh-CN', zhCN as unknown as Locale]]

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('locales', () => {
  it.each(LOCALES)('%s has every T0821 string', (_lng, locale) => {
    expect(locale.update.windowsInstallEndsTerminals).toBeTruthy()
    expect(locale.app.upgradeInterrupted_one).toContain('{{count}}')
    expect(locale.app.upgradeInterrupted_other).toContain('{{count}}')
    for (const key of ['upgradeInterrupted_one', 'upgradeInterrupted_other']) {
      expect(locale.app[key]).toContain('{{from}}')
      expect(locale.app[key]).toContain('{{to}}')
    }
    expect(locale.interruptedAgents.upgradeTitle).toBeTruthy()
    expect(locale.interruptedAgents.upgradeDesc).toBeTruthy()
  })

  it('each language has its own text', () => {
    const texts = LOCALES.map(([, locale]) => locale.update.windowsInstallEndsTerminals)
    expect(new Set(texts).size).toBe(3)
  })
})

describe('UpdateNotification — Windows upgrade warning (子項 1)', () => {
  it('only win32', () => {
    expect(showsWindowsUpgradeWarning('win32')).toBe(true)
    expect(showsWindowsUpgradeWarning('darwin')).toBe(false)
    expect(showsWindowsUpgradeWarning('linux')).toBe(false)
    expect(showsWindowsUpgradeWarning(undefined)).toBe(false)
  })

  const original = window.electronAPI
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    ;(window as unknown as { electronAPI: unknown }).electronAPI = original
  })

  async function renderWith(platform: string) {
    const openExternal = vi.fn()
    ;(window as unknown as { electronAPI: unknown }).electronAPI = {
      platform,
      settings: { load: vi.fn().mockResolvedValue(null) },
      update: {
        check: vi.fn().mockResolvedValue({
          hasUpdate: true,
          currentVersion: '0.7.4-pre.5',
          latestRelease: { version: '0.7.4-pre.6', tagName: 'v0.7.4-pre.6', htmlUrl: 'https://example.invalid', downloadUrl: null, body: '- fix\n- feat', publishedAt: '' },
        }),
      },
      shell: { openExternal },
    }
    render(<UpdateNotification />)
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
    return { openExternal }
  }

  it('win32: the warning is shown and the existing title / versions / changelog / button stay', async () => {
    const { openExternal } = await renderWith('win32')
    expect(screen.getByText(i18n.t('update.newVersionAvailable'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('update.currentVersion', { version: '0.7.4-pre.5' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('update.newVersion', { version: 'v0.7.4-pre.6' }))).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(i18n.t('update.windowsInstallEndsTerminals'))
    fireEvent.click(screen.getByText(i18n.t('update.viewOnGithub')))
    expect(openExternal).toHaveBeenCalledWith('https://github.com/gowerlin/better-agent-terminal/releases')
  })

  it.each(['darwin', 'linux'])('%s: no warning, the notification as before', async (platform) => {
    await renderWith(platform)
    expect(screen.getByText(i18n.t('update.newVersionAvailable'))).toBeInTheDocument()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.queryByText(i18n.t('update.windowsInstallEndsTerminals'))).toBeNull()
  })
})

describe('parseUpgradeInterruptionNotice', () => {
  it('a notice from main', () => {
    expect(parseUpgradeInterruptionNotice({ previousVersion: '0.7.4-pre.4', currentVersion: '0.7.4-pre.5', ptyCount: 3, agentCount: 1 }))
      .toEqual({ previousVersion: '0.7.4-pre.4', currentVersion: '0.7.4-pre.5', ptyCount: 3, agentCount: 1 })
  })

  it('nothing to show: null, older main, malformed, N < 1', () => {
    expect(parseUpgradeInterruptionNotice(null)).toBeNull()
    expect(parseUpgradeInterruptionNotice(undefined)).toBeNull()
    expect(parseUpgradeInterruptionNotice([])).toBeNull()
    expect(parseUpgradeInterruptionNotice({ previousVersion: 'a', currentVersion: 'b', ptyCount: 0, agentCount: 0 })).toBeNull()
    expect(parseUpgradeInterruptionNotice({ previousVersion: 'a', currentVersion: 'b', ptyCount: 1.5 })).toBeNull()
    expect(parseUpgradeInterruptionNotice({ previousVersion: 1, currentVersion: 'b', ptyCount: 1 })).toBeNull()
    expect(parseUpgradeInterruptionNotice({ previousVersion: 'a', currentVersion: 'b', ptyCount: 2, agentCount: -1 })).toMatchObject({ agentCount: 0 })
  })
})

describe('upgrade notice toast (子項 2)', () => {
  it('shows N and the versions, in every language', async () => {
    for (const [lng] of LOCALES) {
      await i18n.changeLanguage(lng)
      const { unmount } = render(<ServerStatusToast messageKey={UPGRADE_INTERRUPTED_TOAST_KEY} messageValues={{ count: 4, from: '0.7.4-pre.4', to: '0.7.4-pre.5' }} onDismiss={() => {}} />)
      const toast = document.querySelector('.server-status-toast')!
      expect(toast).toHaveTextContent('4')
      expect(toast).toHaveTextContent('v0.7.4-pre.4')
      expect(toast).toHaveTextContent('v0.7.4-pre.5')
      expect(toast.textContent).not.toContain('{{')
      unmount()
    }
  })

  it('with agent tabs: the line and a click opens the list; without: the click only dismisses', () => {
    const onDismiss = vi.fn()
    const onOpenInterrupted = vi.fn()
    const { unmount } = render(<ServerStatusToast messageKey={UPGRADE_INTERRUPTED_TOAST_KEY} messageValues={{ count: 2, from: 'a', to: 'b' }} onDismiss={onDismiss} interruptedCount={1} onOpenInterrupted={onOpenInterrupted} />)
    expect(document.querySelector('.server-status-toast-interrupted')).toHaveAttribute('data-interrupted-count', '1')
    fireEvent.click(document.querySelector('.server-status-toast')!)
    expect(onOpenInterrupted).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    unmount()
    render(<ServerStatusToast messageKey={UPGRADE_INTERRUPTED_TOAST_KEY} messageValues={{ count: 2, from: 'a', to: 'b' }} onDismiss={onDismiss} interruptedCount={0} onOpenInterrupted={onOpenInterrupted} />)
    expect(document.querySelector('.server-status-toast-interrupted')).toBeNull()
    fireEvent.click(document.querySelector('.server-status-toast')!)
    expect(onOpenInterrupted).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('the heartbeat toasts are unchanged (no interrupted line on recovering / failed)', () => {
    render(<ServerStatusToast messageKey={SERVER_STATUS_TOAST_KEYS.failed} onDismiss={() => {}} interruptedCount={3} />)
    expect(screen.getByText(i18n.t(SERVER_STATUS_TOAST_KEYS.failed))).toBeInTheDocument()
    expect(document.querySelector('.server-status-toast-interrupted')).toBeNull()
  })
})

describe('InterruptedAgentsDialog — upgrade entries', () => {
  function info(extra: Partial<InterruptedAgentInfo> & { terminalId: string }): InterruptedAgentInfo {
    return { agent: 'claude-cli', claudeSessionId: null, claudeSessionName: null, launchedBy: 'tab', cwd: '/w', at: 1, ...extra }
  }
  function row(agent: InterruptedAgentInfo): InterruptedAgentRow {
    return { agent, title: agent.terminalId, workspaceId: 'ws-1', workspaceName: 'Alpha' }
  }
  const handlers = () => ({ onResume: vi.fn(), onResumeAll: vi.fn(), onDismiss: vi.fn(), onClose: vi.fn() })

  it('allUpgradeInterrupted', () => {
    expect(allUpgradeInterrupted([])).toBe(false)
    expect(allUpgradeInterrupted([{ cause: 'upgrade' }, { cause: 'upgrade' }])).toBe(true)
    expect(allUpgradeInterrupted([{ cause: 'upgrade' }, {}])).toBe(false)
  })

  it('every row from the upgrade → upgrade title / text; resume buttons as before', () => {
    render(<InterruptedAgentsDialog rows={[row(info({ terminalId: 'a', cause: 'upgrade' })), row(info({ terminalId: 'b', agent: 'codex-cli', cause: 'upgrade' }))]} busy={new Set()} message={null} {...handlers()} />)
    expect(screen.getByText(i18n.t('interruptedAgents.upgradeTitle'))).toBeInTheDocument()
    expect(document.querySelector('.interrupted-agents-desc')).toHaveAttribute('data-cause', 'upgrade')
    expect(document.querySelectorAll('[data-action="resume"]').length).toBe(2)
  })

  it('a recovery row present → the recovery title / text (T0766 unchanged)', () => {
    render(<InterruptedAgentsDialog rows={[row(info({ terminalId: 'a', cause: 'upgrade' })), row(info({ terminalId: 'b' }))]} busy={new Set()} message={null} {...handlers()} />)
    expect(screen.getByText(i18n.t('interruptedAgents.title'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('interruptedAgents.desc'))).toBeInTheDocument()
  })
})

describe('App.tsx source guard', () => {
  const app = readFileSync(join(__dirname, '../../App.tsx'), 'utf8')

  it('pulls the notice once on mount and shows it after the heartbeat toast', () => {
    expect(app).toContain('window.electronAPI.terminalServer.queryUpgradeInterruption?.().then((raw) => {')
    expect(app).toContain('const notice = parseUpgradeInterruptionNotice(raw)')
    expect(app).toContain('{!serverStatusToast && upgradeNotice && (')
    expect(app).toContain('<ServerStatusToast messageKey={UPGRADE_INTERRUPTED_TOAST_KEY}')
  })

  it('does not log a session id or a command for the notice', () => {
    const line = app.split('\n').find(l => l.includes('[upgrade-interruption] notice shown'))!
    expect(line).toBeTruthy()
    expect(line).not.toMatch(/session|command/i)
  })
})
