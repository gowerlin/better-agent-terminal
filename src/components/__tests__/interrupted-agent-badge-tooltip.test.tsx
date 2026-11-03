/**
 * T0822 (PLAN-063 follow-up): the thumbnail ⏸ (`.interrupted-agent-badge`, T0766) says why the agent was
 * interrupted. An upgrade-caused entry (`cause: 'upgrade'`, T0821) gets `badgeUpgradeTooltip`; a Terminal
 * Server recovery entry (no `cause`) keeps `badgeTooltip`. Whether ⏸ shows and what clicking it does are
 * unchanged.
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import { TerminalThumbnail, clearPreviewCache } from '../TerminalThumbnail'
import {
  OPEN_INTERRUPTED_AGENTS_EVENT,
  resetInterruptedAgentsStoreForTests,
  setInterruptedAgents,
  type InterruptedAgentInfo,
} from '../../stores/interrupted-agents-store'
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
  act(() => resetInterruptedAgentsStoreForTests())
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const term = (id: string): TerminalInstance => ({
  id, workspaceId: 'ws', type: 'terminal', title: `Tab ${id}`, cwd: '/tmp/ws', scrollbackBuffer: [],
})

const info = (extra: Partial<InterruptedAgentInfo> = {}): InterruptedAgentInfo => ({
  terminalId: 't1', workspaceId: 'ws', agent: 'claude-cli', claudeSessionId: null, claudeSessionName: null,
  launchedBy: 'tab', cwd: '/tmp/ws', at: 1, ...extra,
})

function renderThumb(terminal: TerminalInstance): HTMLElement {
  clearPreviewCache(terminal.id)
  render(<TerminalThumbnail terminal={terminal} isActive={false} onClick={vi.fn()} />)
  return screen.getByText(terminal.title).closest('.thumbnail') as HTMLElement
}

const badgeOf = (thumb: HTMLElement) => thumb.querySelector('.interrupted-agent-badge') as HTMLElement | null

describe('thumbnail ⏸ tooltip follows the interruption cause (T0822)', () => {
  test('upgrade-caused entry: the upgrade tooltip', () => {
    act(() => { setInterruptedAgents([info({ cause: 'upgrade' })], () => true) })
    const badge = badgeOf(renderThumb(term('t1')))
    expect(badge).not.toBeNull()
    expect(badge).toHaveAttribute('title', en.interruptedAgents.badgeUpgradeTooltip)
    expect(badge).toHaveTextContent('⏸')
  })

  test('recovery entry (no cause): the original Terminal Server tooltip, unchanged', () => {
    act(() => { setInterruptedAgents([info()], () => true) })
    const badge = badgeOf(renderThumb(term('t1')))
    expect(badge).toHaveAttribute('title', en.interruptedAgents.badgeTooltip)
    expect(badge?.getAttribute('title')).toContain('Terminal Server')
  })

  test('no interrupted entry: no ⏸', () => {
    expect(badgeOf(renderThumb(term('t1')))).toBeNull()
  })

  test('clicking ⏸ still opens the list, for an upgrade entry too', () => {
    act(() => { setInterruptedAgents([info({ cause: 'upgrade', agent: 'codex-cli' })], () => true) })
    const badge = badgeOf(renderThumb(term('t1')))!
    expect(badge).toHaveAttribute('data-interrupted-agent', 'codex-cli')
    const opened = vi.fn()
    window.addEventListener(OPEN_INTERRUPTED_AGENTS_EVENT, opened)
    try {
      fireEvent.click(badge)
    } finally {
      window.removeEventListener(OPEN_INTERRUPTED_AGENTS_EVENT, opened)
    }
    expect(opened).toHaveBeenCalledTimes(1)
  })

  test('zh-TW: upgrade and recovery entries use their own strings', async () => {
    await act(async () => { await i18n.changeLanguage('zh-TW') })
    act(() => { setInterruptedAgents([info({ terminalId: 't1', cause: 'upgrade' }), info({ terminalId: 't2' })], () => true) })
    expect(badgeOf(renderThumb(term('t1')))).toHaveAttribute('title', zhTW.interruptedAgents.badgeUpgradeTooltip)
    expect(badgeOf(renderThumb(term('t2')))).toHaveAttribute('title', zhTW.interruptedAgents.badgeTooltip)
  })

  test('the new key exists in all three locales and differs from the recovery text', () => {
    for (const locale of [en, zhTW, zhCN]) {
      const block = locale.interruptedAgents as Record<string, string>
      expect(typeof block.badgeUpgradeTooltip).toBe('string')
      expect(block.badgeUpgradeTooltip.length).toBeGreaterThan(0)
      expect(block.badgeUpgradeTooltip).not.toBe(block.badgeTooltip)
      expect(block.badgeUpgradeTooltip).not.toContain('Terminal Server')
    }
  })
})
