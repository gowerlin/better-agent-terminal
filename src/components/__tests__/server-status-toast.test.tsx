/**
 * T0705 (BUG-171 follow-up): the Terminal Server recovery toast (T0112) uses i18n.
 * The zh-TW text is the same as before T0705; en / zh-CN have their own.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { SERVER_STATUS_TOAST_KEYS, ServerStatusToast } from '../ServerStatusToast'

const ZH_TW = {
  recovering: 'Terminal Server 異常，正在自動恢復...',
  recovered: '終端已恢復（歷史輸出已重置）',
  failed: 'Terminal Server 恢復失敗，請重新啟動應用程式',
} as const

const STATUSES = ['recovering', 'recovered', 'failed'] as const

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('ServerStatusToast', () => {
  it.each(STATUSES)('zh-TW %s keeps the pre-T0705 text', async (status) => {
    await i18n.changeLanguage('zh-TW')
    render(<ServerStatusToast messageKey={SERVER_STATUS_TOAST_KEYS[status]} onDismiss={() => {}} />)
    expect(screen.getByText(ZH_TW[status])).toHaveClass('server-status-toast')
  })

  it.each(['en', 'zh-CN'])('%s has its own text for every status', async (lng) => {
    await i18n.changeLanguage(lng)
    for (const status of STATUSES) {
      const key = SERVER_STATUS_TOAST_KEYS[status]
      const text = i18n.t(key)
      expect(text).not.toBe(key)
      expect(text).not.toBe(ZH_TW[status])
      const { unmount } = render(<ServerStatusToast messageKey={key} onDismiss={() => {}} />)
      expect(screen.getByText(text)).toBeInTheDocument()
      unmount()
    }
  })

  it('follows a language switch while shown', async () => {
    await i18n.changeLanguage('zh-TW')
    render(<ServerStatusToast messageKey={SERVER_STATUS_TOAST_KEYS.recovered} onDismiss={() => {}} />)
    expect(screen.getByText(ZH_TW.recovered)).toBeInTheDocument()
    await act(async () => { await i18n.changeLanguage('en') })
    expect(screen.getByText(i18n.t(SERVER_STATUS_TOAST_KEYS.recovered))).toBeInTheDocument()
  })

  it('click dismisses', () => {
    const onDismiss = vi.fn()
    render(<ServerStatusToast messageKey={SERVER_STATUS_TOAST_KEYS.failed} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText(i18n.t(SERVER_STATUS_TOAST_KEYS.failed)))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('App.tsx source guard', () => {
  const app = readFileSync(join(__dirname, '../../App.tsx'), 'utf8')

  it('has no hard-coded toast text and maps every status to its key', () => {
    for (const text of Object.values(ZH_TW)) expect(app).not.toContain(text)
    expect(app).toContain('setServerStatusToast(SERVER_STATUS_TOAST_KEYS.recovering)')
    expect(app).toContain('setServerStatusToast(SERVER_STATUS_TOAST_KEYS.recovered)')
    expect(app).toContain('setServerStatusToast(SERVER_STATUS_TOAST_KEYS.failed)')
    expect(app).toContain('<ServerStatusToast messageKey={serverStatusToast}')
  })
})
