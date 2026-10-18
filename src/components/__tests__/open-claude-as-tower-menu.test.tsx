/**
 * PLAN-050 / T0644: the add menu's "Open Claude as Tower" entry.
 *   - listed right after Claude CLI; calls onAddClaudeCliAsTower (not onAddAgent)
 *   - disabled with the reason when Claude CLI is unavailable; at the end when Claude CLI is not listed
 *   - absent without the callback; the legacy (no definitions) menu lists it after Claude CLI
 *   - three locales have the label and the hint
 */
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { ThumbnailBar } from '../ThumbnailBar'
import type { AgentDefinition } from '../../types/agent-runtime'

function def(id: string, name: string): AgentDefinition {
  return {
    id, name, icon: '•', color: '#888', providerId: id, providerMode: 'terminal-driven',
    supportsWorktree: false, supportsStructuredEvents: false, supportsImages: false, supportsResume: false,
    supportsModelSelection: false, supportsApprovalFlow: false, supportsSandbox: false, supportsYolo: false,
  }
}

const DEFS = [def('claude-code', 'Claude Agent V1'), def('claude-cli', 'Claude CLI'), def('codex-cli', 'Codex CLI')]
const LABEL = en.terminal.openClaudeAsTower

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function openAddMenu(props: Partial<Parameters<typeof ThumbnailBar>[0]>) {
  render(
    <ThumbnailBar
      terminals={[]}
      focusedTerminalId={null}
      onFocus={() => {}}
      onAddTerminal={() => {}}
      showAddButton={true}
      {...props}
    />,
  )
  fireEvent.click(screen.getByTitle(en.terminal.addTerminalOrAgent))
}

/** The menu's items in order, each as the first of `labels` its text contains (others dropped). */
const itemOrder = (labels: string[]) => Array.from(document.querySelectorAll('.thumbnail-add-menu-item'))
  .map(el => labels.find(label => (el.textContent ?? '').includes(label)))
  .filter((label): label is string => !!label)

describe('ThumbnailBar "Open Claude as Tower" (T0644)', () => {
  test('right after Claude CLI; starts the tower tab, not a registry agent', () => {
    const onAddAgent = vi.fn()
    const onAddClaudeCliAsTower = vi.fn()
    openAddMenu({ onAddAgent, agentDefinitions: DEFS, onAddClaudeCliAsTower })
    expect(itemOrder([LABEL, 'Claude Agent V1', 'Claude CLI', 'Codex CLI'])).toEqual(['Claude Agent V1', 'Claude CLI', LABEL, 'Codex CLI'])
    const item = screen.getByText(LABEL).closest('.thumbnail-add-menu-item') as HTMLElement
    expect(item).toHaveAttribute('title', en.terminal.openClaudeAsTowerHint)
    fireEvent.click(item)
    expect(onAddClaudeCliAsTower).toHaveBeenCalledTimes(1)
    expect(onAddAgent).not.toHaveBeenCalled()
    expect(screen.queryByText(LABEL)).toBeNull() // the menu closed
  })

  test('Claude CLI unavailable → disabled with the same reason', () => {
    const onAddClaudeCliAsTower = vi.fn()
    openAddMenu({ onAddAgent: vi.fn(), agentDefinitions: DEFS, onAddClaudeCliAsTower, unavailableAgents: { 'claude-cli': 'nope' } })
    const item = screen.getByText(LABEL).closest('.thumbnail-add-menu-item') as HTMLElement
    expect(item).toHaveClass('disabled')
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveTextContent('nope')
    fireEvent.click(item)
    expect(onAddClaudeCliAsTower).not.toHaveBeenCalled()
  })

  test('Claude CLI not listed → at the end of the agents', () => {
    openAddMenu({ onAddAgent: vi.fn(), agentDefinitions: [def('codex-cli', 'Codex CLI')], onAddClaudeCliAsTower: vi.fn() })
    expect(itemOrder([LABEL, 'Codex CLI'])).toEqual(['Codex CLI', LABEL])
  })

  test('without the callback there is no entry', () => {
    openAddMenu({ onAddAgent: vi.fn(), agentDefinitions: DEFS })
    expect(screen.queryByText(LABEL)).toBeNull()
  })

  test('legacy menu (no definitions): after Claude CLI', () => {
    const onAddClaudeCliAsTower = vi.fn()
    openAddMenu({ onAddClaudeCli: vi.fn(), onAddClaudeCliAsTower })
    fireEvent.click(screen.getByText(LABEL))
    expect(onAddClaudeCliAsTower).toHaveBeenCalledTimes(1)
  })

  test('three locales have the label and the hint', () => {
    for (const loc of [en, zhTW, zhCN]) {
      expect(loc.terminal.openClaudeAsTower).toBeTruthy()
      expect(loc.terminal.openClaudeAsTowerHint).toContain('Tower')
    }
    expect(zhTW.terminal.openClaudeAsTower).toBe('以塔台開啟 Claude')
  })
})
