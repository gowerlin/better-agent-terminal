/**
 * T0424 (PLAN-036): a remote server refusing `pty:create` at its PTY cap shows a toast
 * (the existing CtToast) and a line in the terminal itself, instead of a blank terminal.
 * The refusal is recognised by `code: 'PTY_LIMIT_REACHED'`, never by message text.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { CtToast, useCtToast } from '../../components/CtToast'
import { createPtyWithReplay, registerPtyNoticeSink, resetPtyReplayRegistry } from '../../lib/pty-replay'
import type { CreatePtyOptions } from '../../types'
import { PTY_LIMIT_TOAST_COALESCE_MS, usePtyLimitNotice } from '../usePtyLimitNotice'

const LIMIT = { ok: false, created: false, code: 'PTY_LIMIT_REACHED', limit: 2 }
const refusingApi = { create: vi.fn(async () => LIMIT as never) }
const opts = (id: string, workspaceId = 'w1'): CreatePtyOptions => ({ id, cwd: '/w', type: 'terminal', workspaceId })

const toastText = en.toast.ptyLimit.reached.replace('{{limit}}', '2')
const noticeText = en.terminal.ptyLimitNotice.replace('{{limit}}', '2')

function Host({ workspaceId }: { workspaceId: string }) {
  const { messages, addToast, dismissToast } = useCtToast()
  usePtyLimitNotice(workspaceId, addToast)
  return <CtToast messages={messages} onDismiss={dismissToast} />
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  resetPtyReplayRegistry()
  vi.useRealTimers()
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('usePtyLimitNotice (T0424)', () => {
  it('toast + terminal line for a refused terminal of this workspace; nothing retried', async () => {
    render(<Host workspaceId="w1" />)
    const sink = vi.fn()
    registerPtyNoticeSink('t1', sink)
    refusingApi.create.mockClear()

    await act(async () => { await createPtyWithReplay(opts('t1'), refusingApi) })

    expect(screen.getByText(toastText)).toBeInTheDocument()
    expect(screen.getByText(toastText).closest('.ct-toast')).toHaveClass('ct-toast-warning')
    expect(sink).toHaveBeenCalledWith(noticeText)
    expect(refusingApi.create).toHaveBeenCalledTimes(1)
  })

  it('a terminal view mounting after the refusal still gets its line', async () => {
    render(<Host workspaceId="w1" />)
    await act(async () => { await createPtyWithReplay(opts('late'), refusingApi) })
    const sink = vi.fn()
    registerPtyNoticeSink('late', sink)
    expect(sink).toHaveBeenCalledWith(noticeText)
  })

  it("another workspace's refusal is not this view's business", async () => {
    render(<Host workspaceId="w1" />)
    const sink = vi.fn()
    registerPtyNoticeSink('other', sink)
    await act(async () => { await createPtyWithReplay(opts('other', 'w2'), refusingApi) })
    expect(screen.queryByText(toastText)).not.toBeInTheDocument()
    expect(sink).not.toHaveBeenCalled()
  })

  it('a burst shares one toast, every terminal gets its line; a later refusal toasts again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000_000)
    render(<Host workspaceId="w1" />)
    const sinks = ['a', 'b', 'c'].map((id) => {
      const sink = vi.fn()
      registerPtyNoticeSink(id, sink)
      return sink
    })

    await act(async () => {
      await Promise.all(['a', 'b', 'c'].map((id) => createPtyWithReplay(opts(id), refusingApi)))
    })
    expect(screen.getAllByText(toastText)).toHaveLength(1)
    for (const sink of sinks) expect(sink).toHaveBeenCalledWith(noticeText)

    vi.setSystemTime(1_000_000 + PTY_LIMIT_TOAST_COALESCE_MS + 1)
    await act(async () => { await createPtyWithReplay(opts('d'), refusingApi) })
    expect(screen.getAllByText(toastText)).toHaveLength(2)
  })

  it('success and unspecified failures show nothing', async () => {
    render(<Host workspaceId="w1" />)
    const sink = vi.fn()
    registerPtyNoticeSink('t1', sink)
    await act(async () => {
      await createPtyWithReplay(opts('t1'), { create: async () => ({ ok: true, created: true }) })
      await createPtyWithReplay(opts('t1'), { create: async () => ({ ok: false, created: false }) })
    })
    expect(document.querySelector('.ct-toast')).toBeNull()
    expect(sink).not.toHaveBeenCalled()
  })

  it('all three locales carry both strings with the {{limit}} placeholder', () => {
    for (const locale of [en, zhTW, zhCN]) {
      expect(locale.toast.ptyLimit.reached).toContain('{{limit}}')
      expect(locale.terminal.ptyLimitNotice).toContain('{{limit}}')
    }
  })
})
