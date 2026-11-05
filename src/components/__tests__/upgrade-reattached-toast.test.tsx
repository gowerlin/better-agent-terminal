/**
 * PLAN-065 W5 / T0861 (D4): main reconnected to the PTY holder the installer kept, without the Recovery prompt.
 * The notice carries `reattachedPtyCount`; the toast says "reconnected N terminals" (upgrade / same-version
 * neutral text), keeps the interrupted-agents line, and every T0821 / T0846 notice (ptyCount ≥ 1) is unchanged.
 */
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import {
  ServerStatusToast,
  UPGRADE_INTERRUPTED_TOAST_KEY,
  UPGRADE_REATTACHED_SAME_VERSION_TOAST_KEY,
  UPGRADE_REATTACHED_TOAST_KEY,
  UPGRADE_REINSTALLED_TOAST_KEY,
  upgradeNoticeToastKey,
  upgradeNoticeToastValues,
} from '../ServerStatusToast'
import { parseUpgradeInterruptionNotice } from '../../stores/interrupted-agents-store'

type Locale = Record<string, Record<string, string>>
const LOCALES: Array<[string, Locale]> = [['en', en as unknown as Locale], ['zh-TW', zhTW as unknown as Locale], ['zh-CN', zhCN as unknown as Locale]]

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('locales (T0861)', () => {
  it.each(LOCALES)('%s has the reconnected texts with the right values', (_lng, locale) => {
    for (const key of ['upgradeReattached_one', 'upgradeReattached_other']) {
      expect(locale.app[key]).toContain('{{count}}')
      expect(locale.app[key]).toContain('{{from}}')
      expect(locale.app[key]).toContain('{{to}}')
    }
    for (const key of ['upgradeReattachedSameVersion_one', 'upgradeReattachedSameVersion_other']) {
      expect(locale.app[key]).toContain('{{count}}')
      expect(locale.app[key]).toContain('{{version}}')
      expect(locale.app[key]).not.toContain('{{from}}')
    }
  })

  it('each language has its own text', () => {
    expect(new Set(LOCALES.map(([, l]) => l.app.upgradeReattached_other)).size).toBe(3)
  })
})

describe('parseUpgradeInterruptionNotice (T0861)', () => {
  it('a reattach notice (nothing ended, ptyCount 0) is kept', () => {
    expect(parseUpgradeInterruptionNotice({ previousVersion: '0.7.5-pre.1', currentVersion: '0.7.5-pre.2', ptyCount: 0, agentCount: 1, holderKept: true, reattachedPtyCount: 3 }))
      .toEqual({ previousVersion: '0.7.5-pre.1', currentVersion: '0.7.5-pre.2', ptyCount: 0, agentCount: 1, reattachedPtyCount: 3 })
  })

  it('malformed / zero reattach counts are not a notice; an ended-terminals notice is unchanged (no reattachedPtyCount field)', () => {
    expect(parseUpgradeInterruptionNotice({ previousVersion: 'a', currentVersion: 'b', ptyCount: 0, reattachedPtyCount: 0 })).toBeNull()
    expect(parseUpgradeInterruptionNotice({ previousVersion: 'a', currentVersion: 'b', ptyCount: 0, reattachedPtyCount: 1.5 })).toBeNull()
    expect(parseUpgradeInterruptionNotice({ previousVersion: 'a', currentVersion: 'b', ptyCount: 0, reattachedPtyCount: '2' })).toBeNull()
    expect(parseUpgradeInterruptionNotice({ previousVersion: 'a', currentVersion: 'b', ptyCount: 2, agentCount: 1 })).toEqual({ previousVersion: 'a', currentVersion: 'b', ptyCount: 2, agentCount: 1 })
  })
})

describe('which text and values', () => {
  it('reattached → the reconnected text (split by version); otherwise T0846 as before', () => {
    expect(upgradeNoticeToastKey({ previousVersion: '1', currentVersion: '2', ptyCount: 0, reattachedPtyCount: 2 })).toBe(UPGRADE_REATTACHED_TOAST_KEY)
    expect(upgradeNoticeToastKey({ previousVersion: '2', currentVersion: '2', ptyCount: 0, reattachedPtyCount: 2 })).toBe(UPGRADE_REATTACHED_SAME_VERSION_TOAST_KEY)
    expect(upgradeNoticeToastKey({ previousVersion: '1', currentVersion: '2', ptyCount: 2 })).toBe(UPGRADE_INTERRUPTED_TOAST_KEY)
    expect(upgradeNoticeToastKey({ previousVersion: '2', currentVersion: '2', ptyCount: 2 })).toBe(UPGRADE_REINSTALLED_TOAST_KEY)
  })

  it('count = the reconnected terminals when reattached, the ended ones otherwise', () => {
    expect(upgradeNoticeToastValues({ previousVersion: '1', currentVersion: '2', ptyCount: 0, reattachedPtyCount: 3 })).toEqual({ count: 3, from: '1', to: '2', version: '2' })
    expect(upgradeNoticeToastValues({ previousVersion: '1', currentVersion: '2', ptyCount: 4 })).toEqual({ count: 4, from: '1', to: '2', version: '2' })
  })
})

describe('the reconnected toast', () => {
  it('upgrade: N and both versions, word for word, in every language', async () => {
    const notice = { previousVersion: '0.7.5-pre.1', currentVersion: '0.7.5-pre.2', ptyCount: 0, reattachedPtyCount: 3 }
    for (const [lng, locale] of LOCALES) {
      await i18n.changeLanguage(lng)
      const { unmount } = render(<ServerStatusToast messageKey={upgradeNoticeToastKey(notice)} messageValues={upgradeNoticeToastValues(notice)} onDismiss={() => {}} />)
      const toast = document.querySelector('.server-status-toast')!
      expect(toast).toHaveAttribute('data-message-key', UPGRADE_REATTACHED_TOAST_KEY)
      expect(toast.textContent).toBe(locale.app.upgradeReattached_other.replace('{{from}}', '0.7.5-pre.1').replace('{{to}}', '0.7.5-pre.2').replace('{{count}}', '3'))
      unmount()
    }
  })

  it('same version: the neutral text with one version, in every language', async () => {
    const notice = { previousVersion: '0.7.5-pre.2', currentVersion: '0.7.5-pre.2', ptyCount: 0, reattachedPtyCount: 1 }
    for (const [lng, locale] of LOCALES) {
      await i18n.changeLanguage(lng)
      const { unmount } = render(<ServerStatusToast messageKey={upgradeNoticeToastKey(notice)} messageValues={upgradeNoticeToastValues(notice)} onDismiss={() => {}} />)
      const toast = document.querySelector('.server-status-toast')!
      expect(toast.textContent).toBe(locale.app.upgradeReattachedSameVersion_one.replace('{{version}}', '0.7.5-pre.2').replace('{{count}}', '1'))
      expect(toast.textContent).not.toContain('→')
      unmount()
    }
  })

  it('agents the quit ended: the interrupted line, and a click opens the list', () => {
    const onOpenInterrupted = vi.fn()
    const onDismiss = vi.fn()
    render(<ServerStatusToast messageKey={UPGRADE_REATTACHED_TOAST_KEY} messageValues={{ count: 2, from: 'a', to: 'b' }} onDismiss={onDismiss} interruptedCount={1} onOpenInterrupted={onOpenInterrupted} />)
    expect(document.querySelector('.server-status-toast-interrupted')).toHaveAttribute('data-interrupted-count', '1')
    fireEvent.click(document.querySelector('.server-status-toast')!)
    expect(onOpenInterrupted).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
