/**
 * PLAN-068 W9 / T0910 (T0902 §7.2): the renderer side of a Tower's BAT hooks status.
 *
 * - `parseHooksStatus` / `hooksStatusHint` / `showsHooksBadge` (src/lib/hooks-status.ts)
 * - store (src/stores/hooks-status-store.ts): `terminal:hooks-status` per tab, subscribes itself once,
 *   the PTY exit clears it; an invalid / null status removes the entry
 * - thumbnail `🪝✕`: only for a contract-2 Tower (R9′) whose status is `none`; tooltip = prefix + reason
 *   (three languages); `ok` / `n/a` / plugin-outdated / a mismatching Tower → no badge
 * - Inbox header line with a「怎麼修」link (README), on a match only; plugin-outdated shows the update hint
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { TerminalThumbnail, clearPreviewCache } from '../TerminalThumbnail'
import { InboxHooksHint } from '../inbox/InboxHooksHint'
import { applyTowerContract, resetTowerContractStore } from '../../stores/tower-contract-store'
import { applyHooksStatus, clearHooksStatus, ensureHooksStatusSubscription, getHooksStatus, resetHooksStatusStore } from '../../stores/hooks-status-store'
import { HOOKS_HELP_URL, HOOKS_NONE_REASONS, hooksStatusHint, hooksStatusLine, parseHooksStatus, showsHooksBadge } from '../../lib/hooks-status'
import type { TerminalInstance } from '../../types'

const openExternal = vi.fn()
let hooksListener: ((info: { id: string; hooksStatus: unknown }) => void) | null = null
let exitListener: ((id: string, code: number) => void) | null = null

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  hooksListener = null
  exitListener = null
  openExternal.mockClear()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: {
      onOutput: vi.fn(() => () => {}),
      onHooksStatus: vi.fn((cb: typeof hooksListener) => { hooksListener = cb; return () => {} }),
      onExit: vi.fn((cb: typeof exitListener) => { exitListener = cb; return () => {} }),
    },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
    shell: { openExternal },
  }
})

afterEach(async () => {
  cleanup()
  act(() => {
    resetHooksStatusStore()
    resetTowerContractStore()
  })
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const term = (id: string): TerminalInstance => ({ id, workspaceId: 'ws', type: 'terminal', title: `Tab ${id}`, cwd: '/tmp/ws', scrollbackBuffer: [] })

function renderThumb(terminal: TerminalInstance): HTMLElement {
  clearPreviewCache(terminal.id)
  render(<TerminalThumbnail terminal={terminal} isActive={false} onClick={vi.fn()} />)
  return screen.getByText(terminal.title).closest('.thumbnail') as HTMLElement
}

const hooksBadge = (thumb: HTMLElement) => thumb.querySelector('.tower-hooks-badge') as HTMLElement | null

describe('hooks-status lib', () => {
  it('parse: valid shapes only', () => {
    expect(parseHooksStatus({ state: 'ok', origin: 'injected', set: 2 })).toEqual({ state: 'ok', origin: 'injected', set: 2 })
    expect(parseHooksStatus({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' })).toEqual({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' })
    for (const reason of HOOKS_NONE_REASONS) expect(parseHooksStatus({ state: 'none', reason })).toEqual({ state: 'none', reason })
    expect(parseHooksStatus({ state: 'n/a', reason: 'codex' })).toEqual({ state: 'n/a', reason: 'codex' })
    for (const bad of [null, undefined, 'ok', [], { state: 'ok', origin: 'x', set: 2 }, { state: 'ok', origin: 'injected', set: 0 }, { state: 'none', reason: 'x' }, { state: 'n/a', reason: 'claude' }]) {
      expect(parseHooksStatus(bad)).toBeNull()
    }
  })

  it('hint: none → reason (helper codes share one text); plugin-outdated → update hint without prefix; ok / n/a → none', () => {
    expect(hooksStatusHint({ state: 'none', reason: 'settings-off' })).toEqual({ key: 'hooksStatus.reason.settings-off', prefix: true })
    for (const reason of ['no-endpoint', 'script-missing', 'unrepresentable-path'] as const) {
      expect(hooksStatusHint({ state: 'none', reason })).toEqual({ key: 'hooksStatus.reason.helper', prefix: true })
    }
    expect(hooksStatusHint({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' })).toEqual({ key: 'hooksStatus.reason.plugin-outdated', prefix: false })
    expect(hooksStatusHint({ state: 'ok', origin: 'injected', set: 2 })).toBeNull()
    expect(hooksStatusHint({ state: 'n/a', reason: 'codex' })).toBeNull()
    expect(hooksStatusHint(null)).toBeNull()
    expect(showsHooksBadge({ state: 'none', reason: 'no-report' })).toBe(true)
    expect(showsHooksBadge({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' })).toBe(false)
    expect(hooksStatusLine({ state: 'none', reason: 'no-report' })).toBe('  hooks: none (no-report)')
  })

  it('every hint key exists in the three languages', () => {
    const keys = [...HOOKS_NONE_REASONS.map(reason => hooksStatusHint({ state: 'none', reason })!.key), 'hooksStatus.reason.plugin-outdated', 'hooksStatus.prefix', 'hooksStatus.help']
    for (const locale of [en, zhTW, zhCN]) {
      for (const key of keys) {
        const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale)
        expect(typeof value, `${key}`).toBe('string')
      }
    }
  })
})

describe('hooks-status store', () => {
  it('subscribes once; events set / replace / remove; the PTY exit clears', () => {
    ensureHooksStatusSubscription()
    ensureHooksStatusSubscription()
    const pty = (window as unknown as { electronAPI: { pty: { onHooksStatus: ReturnType<typeof vi.fn> } } }).electronAPI.pty
    expect(pty.onHooksStatus).toHaveBeenCalledTimes(1)
    act(() => hooksListener!({ id: 't1', hooksStatus: { state: 'none', reason: 'no-report' } }))
    expect(getHooksStatus('t1')).toEqual({ state: 'none', reason: 'no-report' })
    act(() => hooksListener!({ id: 't1', hooksStatus: { state: 'ok', origin: 'injected', set: 2 } }))
    expect(getHooksStatus('t1')).toEqual({ state: 'ok', origin: 'injected', set: 2 })
    act(() => hooksListener!({ id: 't1', hooksStatus: null }))
    expect(getHooksStatus('t1')).toBeNull()
    act(() => { applyHooksStatus({ id: 't2', hooksStatus: { state: 'none', reason: 'settings-off' } }) })
    act(() => exitListener!('t2', 0))
    expect(getHooksStatus('t2')).toBeNull()
    act(() => { applyHooksStatus({ id: 't3', hooksStatus: { state: 'none', reason: 'settings-off' } }) })
    act(() => clearHooksStatus('t3'))
    expect(getHooksStatus('t3')).toBeNull()
  })
})

describe('thumbnail 🪝✕ (R9′: contract-2 Towers only)', () => {
  it('a matching Tower without hooks: badge with prefix + reason tooltip, data-hooks-status = code', () => {
    act(() => {
      applyTowerContract({ id: 'tw', role: 'tower', towerContract: 2 })
      applyHooksStatus({ id: 'tw', hooksStatus: { state: 'none', reason: 'not-launched-by-bat' } })
    })
    const badge = hooksBadge(renderThumb(term('tw')))
    expect(badge?.textContent).toBe('🪝✕')
    expect(badge?.getAttribute('data-hooks-status')).toBe('not-launched-by-bat')
    expect(badge?.getAttribute('title')).toBe(`${en.hooksStatus.prefix}${en.hooksStatus.reason['not-launched-by-bat']}`)
  })

  it('updates live: a report arrives → the badge goes', () => {
    act(() => {
      applyTowerContract({ id: 'tw', role: 'tower', towerContract: 2 })
      applyHooksStatus({ id: 'tw', hooksStatus: { state: 'none', reason: 'no-report' } })
    })
    const thumb = renderThumb(term('tw'))
    expect(hooksBadge(thumb)).not.toBeNull()
    act(() => { applyHooksStatus({ id: 'tw', hooksStatus: { state: 'ok', origin: 'injected', set: 2 } }) })
    expect(hooksBadge(thumb)).toBeNull()
  })

  it.each([
    ['ok', 2, { state: 'ok', origin: 'injected', set: 2 }],
    ['plugin-outdated', 2, { state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' }],
    ['codex', 2, { state: 'n/a', reason: 'codex' }],
    ['CT too old', null, { state: 'none', reason: 'no-report' }],
    ['BAT too old', 3, { state: 'none', reason: 'no-report' }],
  ])('%s → no 🪝✕', (_label, towerContract, hooksStatus) => {
    act(() => {
      applyTowerContract({ id: 'tw', role: 'tower', towerContract })
      applyHooksStatus({ id: 'tw', hooksStatus })
    })
    expect(hooksBadge(renderThumb(term('tw')))).toBeNull()
  })

  it('tooltip in zh-TW / zh-CN', async () => {
    act(() => {
      applyTowerContract({ id: 'tw', role: 'tower', towerContract: 2 })
      applyHooksStatus({ id: 'tw', hooksStatus: { state: 'none', reason: 'script-missing' } })
    })
    await act(async () => { await i18n.changeLanguage('zh-TW') })
    expect(hooksBadge(renderThumb(term('tw')))?.getAttribute('title')).toBe(`${zhTW.hooksStatus.prefix}${zhTW.hooksStatus.reason.helper}`)
    cleanup()
    await act(async () => { await i18n.changeLanguage('zh-CN') })
    expect(hooksBadge(renderThumb(term('tw')))?.getAttribute('title')).toBe(`${zhCN.hooksStatus.prefix}${zhCN.hooksStatus.reason.helper}`)
  })
})

describe('Inbox header line', () => {
  it('none → one line with the reason and「How to fix」opening the README section', () => {
    act(() => { applyHooksStatus({ id: 'tw', hooksStatus: { state: 'none', reason: 'settings-off' } }) })
    render(<InboxHooksHint terminalId="tw" />)
    const line = document.querySelector('[data-inbox-hooks]') as HTMLElement
    expect(line.getAttribute('data-inbox-hooks')).toBe('settings-off')
    expect(line.textContent).toContain(en.hooksStatus.prefix.trim())
    expect(line.textContent).toContain(en.hooksStatus.reason['settings-off'])
    fireEvent.click(screen.getByText(en.hooksStatus.help))
    expect(openExternal).toHaveBeenCalledWith(HOOKS_HELP_URL)
  })

  it('plugin-outdated → the update hint without the "no hooks" prefix; ok / n/a / none selected → nothing', () => {
    act(() => { applyHooksStatus({ id: 'tw', hooksStatus: { state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' } }) })
    const { rerender } = render(<InboxHooksHint terminalId="tw" />)
    const line = document.querySelector('[data-inbox-hooks]') as HTMLElement
    expect(line.getAttribute('data-inbox-hooks')).toBe('plugin-outdated')
    expect(line.textContent).not.toContain(en.hooksStatus.prefix.trim())
    act(() => { applyHooksStatus({ id: 'tw', hooksStatus: { state: 'ok', origin: 'injected', set: 2 } }) })
    expect(document.querySelector('[data-inbox-hooks]')).toBeNull()
    rerender(<InboxHooksHint terminalId={null} />)
    expect(document.querySelector('[data-inbox-hooks]')).toBeNull()
  })
})
