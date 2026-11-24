/**
 * PLAN-068 W0 / T0903 (T0902 §6′): the BAT ↔ CT contract gate in the renderer.
 *
 * - store (src/stores/tower-contract-store.ts): `terminal:role-changed` → per-tab state by the §6′
 *   「分頁宣告」column (2 = match; none / 1 = CT too old; > 2 = BAT too old; not a Tower = nothing);
 *   overwrite / clear; the PTY exit clears it; the hint is claimed once per tab
 * - thumbnail: badge `CT↑` / `BAT↑` with the P-1 / P-2 text as tooltip (three languages); a matching
 *   Tower and a plain tab show none; the other badges and the title are unchanged
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import { TerminalThumbnail, clearPreviewCache } from '../TerminalThumbnail'
import {
  applyTowerContract,
  claimTowerContractHint,
  clearTowerContract,
  getTowerContract,
  resetTowerContractStore,
  towerContractBadge,
  towerContractHint,
} from '../../stores/tower-contract-store'
import type { TerminalInstance } from '../../types'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { onOutput: vi.fn(() => () => {}) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
  }
})

afterEach(async () => {
  act(() => resetTowerContractStore())
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const term = (id: string): TerminalInstance => ({
  id, workspaceId: 'ws', type: 'terminal', title: `Tab ${id}`, cwd: '/tmp/ws', scrollbackBuffer: [],
})

function renderThumb(terminal: TerminalInstance): HTMLElement {
  clearPreviewCache(terminal.id)
  render(<TerminalThumbnail terminal={terminal} isActive={false} onClick={vi.fn()} />)
  return screen.getByText(terminal.title).closest('.thumbnail') as HTMLElement
}

const badgeOf = (thumb: HTMLElement) => thumb.querySelector('.tower-contract-badge') as HTMLElement | null
const P1_EN = en.towerContract.ctOutdated.replace('{{supported}}', '2')
const p2 = (text: string, requested: number) => text.replace('{{requested}}', String(requested)).replace('{{supported}}', '2')

describe('tower-contract store (T0902 §6′「分頁宣告」)', () => {
  test.each([
    [2, 'match', null],
    [null, 'ct-outdated', 'CT↑'],
    [undefined, 'ct-outdated', 'CT↑'],
    [1, 'ct-outdated', 'CT↑'],
    [3, 'bat-outdated', 'BAT↑'],
    ['bogus', 'ct-outdated', 'CT↑'],
  ])('towerContract %j → %s, badge %j', (towerContract, status, badge) => {
    const entry = applyTowerContract({ id: 't1', role: 'tower', towerContract })
    expect(entry?.status).toBe(status)
    expect(towerContractBadge(entry)).toBe(badge)
    expect(getTowerContract('t1')).toEqual(entry)
  })

  test('not a Tower → nothing recorded (and an earlier entry is dropped)', () => {
    expect(applyTowerContract({ id: 't1', role: 'worker', towerContract: 2 })).toBeNull()
    expect(getTowerContract('t1')).toBeNull()
    applyTowerContract({ id: 't1', role: 'tower', towerContract: 2 })
    applyTowerContract({ id: 't1', role: 'shell' })
    expect(getTowerContract('t1')).toBeNull()
    expect(applyTowerContract(null)).toBeNull()
    expect(applyTowerContract({ role: 'tower', towerContract: 2 })).toBeNull()
  })

  test('every --set-role overwrites; one without --bat-contract makes the Tower "CT too old"; the PTY exit clears it', () => {
    expect(applyTowerContract({ id: 't1', role: 'tower', towerContract: 2 })?.status).toBe('match')
    expect(applyTowerContract({ id: 't1', role: 'tower', towerContract: null })?.status).toBe('ct-outdated')
    expect(applyTowerContract({ id: 't1', role: 'tower', towerContract: 3 })?.status).toBe('bat-outdated')
    clearTowerContract('t1')
    expect(getTowerContract('t1')).toBeNull()
  })

  test('the hint is claimed once per tab, and only for a mismatch', () => {
    const match = applyTowerContract({ id: 'ok', role: 'tower', towerContract: 2 })
    expect(claimTowerContractHint('ok', match)).toBe(false)
    const old = applyTowerContract({ id: 't1', role: 'tower', towerContract: null })
    expect(claimTowerContractHint('t1', old)).toBe(true)
    expect(claimTowerContractHint('t1', old)).toBe(false)
    // the same tab declaring again (even after its PTY exit) gets no second toast
    clearTowerContract('t1')
    const newer = applyTowerContract({ id: 't1', role: 'tower', towerContract: 3 })
    expect(claimTowerContractHint('t1', newer)).toBe(false)
    // another tab gets its own
    const other = applyTowerContract({ id: 't2', role: 'tower', towerContract: 3 })
    expect(claimTowerContractHint('t2', other)).toBe(true)
  })

  test('hint keys and values', () => {
    expect(towerContractHint(applyTowerContract({ id: 'a', role: 'tower', towerContract: null }))).toEqual({ key: 'towerContract.ctOutdated', values: { supported: 2 } })
    expect(towerContractHint(applyTowerContract({ id: 'b', role: 'tower', towerContract: 5 }))).toEqual({ key: 'towerContract.batOutdated', values: { supported: 2, requested: 5 } })
    expect(towerContractHint(applyTowerContract({ id: 'c', role: 'tower', towerContract: 2 }))).toBeNull()
    expect(towerContractHint(null)).toBeNull()
  })
})

describe('thumbnail badge CT↑ / BAT↑ (T0902 §6′ P-1 / P-2)', () => {
  test('CT too old: CT↑ with the P-1 tooltip', () => {
    act(() => { applyTowerContract({ id: 't1', role: 'tower', towerContract: null }) })
    const badge = badgeOf(renderThumb(term('t1')))
    expect(badge).toHaveTextContent('CT↑')
    expect(badge).toHaveAttribute('data-tower-contract', 'ct-outdated')
    expect(badge).toHaveAttribute('title', P1_EN)
    expect(badge?.getAttribute('title')).toContain('6.1.0')
  })

  test('BAT too old: BAT↑ with the P-2 tooltip naming the requested contract', () => {
    act(() => { applyTowerContract({ id: 't1', role: 'tower', towerContract: 3 }) })
    const badge = badgeOf(renderThumb(term('t1')))
    expect(badge).toHaveTextContent('BAT↑')
    expect(badge).toHaveAttribute('title', p2(en.towerContract.batOutdated, 3))
    expect(badge?.getAttribute('title')).toContain('v3')
  })

  test('a matching Tower and a tab that is not a Tower: no badge; the title is unchanged', () => {
    act(() => { applyTowerContract({ id: 't1', role: 'tower', towerContract: 2 }) })
    const thumb = renderThumb(term('t1'))
    expect(badgeOf(thumb)).toBeNull()
    expect(thumb.querySelector('.thumbnail-title')).toHaveTextContent('Tab t1')
    expect(badgeOf(renderThumb(term('t2')))).toBeNull()
  })

  test('the badge goes when the Tower declares v2 later', () => {
    act(() => { applyTowerContract({ id: 't1', role: 'tower', towerContract: null }) })
    const thumb = renderThumb(term('t1'))
    expect(badgeOf(thumb)).not.toBeNull()
    act(() => { applyTowerContract({ id: 't1', role: 'tower', towerContract: 2 }) })
    expect(badgeOf(thumb)).toBeNull()
  })

  test.each([['zh-TW', zhTW], ['zh-CN', zhCN]] as const)('%s tooltips', async (lang, strings) => {
    await act(async () => { await i18n.changeLanguage(lang) })
    act(() => {
      applyTowerContract({ id: 'old', role: 'tower', towerContract: null })
      applyTowerContract({ id: 'new', role: 'tower', towerContract: 4 })
    })
    expect(badgeOf(renderThumb(term('old')))).toHaveAttribute('title', strings.towerContract.ctOutdated.replace('{{supported}}', '2'))
    expect(badgeOf(renderThumb(term('new')))).toHaveAttribute('title', p2(strings.towerContract.batOutdated, 4))
  })

  test('the three languages carry the same placeholders', () => {
    for (const strings of [en, zhTW, zhCN]) {
      expect(strings.towerContract.ctOutdated).toContain('{{supported}}')
      expect(strings.towerContract.ctOutdated).toContain('6.1.0')
      expect(strings.towerContract.batOutdated).toContain('{{requested}}')
      expect(strings.towerContract.batOutdated).toContain('{{supported}}')
    }
  })
})

describe('App.tsx wiring (source guard)', () => {
  test('role-changed → store in every window, toast once per tab in the window holding it; PTY exit clears it', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')
    const block = src.slice(src.indexOf('PLAN-068 W0 / T0903'), src.indexOf('PLAN-044 / T0566 (D148)'))
    expect(block).toContain('window.electronAPI.pty.onRoleChanged((info) => {\n      const entry = applyTowerContract(info)')
    expect(block).toContain('ownsTerminalForCloseRequest(terminal, detachedWorkspaceId, detachedIds)')
    expect(block).toContain('if (!claimTowerContractHint(info.id, entry)) return')
    expect(block).toContain("addRuntimeToast(`${terminal.title}: ${t(hint.key, hint.values)}`, 'warning'")
    expect(block).toContain('window.electronAPI.pty.onExit((id) => clearTowerContract(id))')
    // the T0562 title handler is unchanged and separate
    expect(src).toContain('const { result, title } = workspaceStore.applyTerminalRole(info)')
  })
})
