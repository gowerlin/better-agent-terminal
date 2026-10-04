/**
 * T0401 (PLAN-036 P1-F): UI degrade in a remote-profile window.
 *   - add menu: codex agents shown disabled with the reason (remote), clickable (local)
 *   - Codex Agent panel replaced by an explanation (remote server has no codex)
 */
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { ThumbnailBar } from '../ThumbnailBar'
import { RemoteAgentUnavailable } from '../RemoteAgentUnavailable'
import type { AgentDefinition } from '../../types/agent-runtime'

function def(id: string, name: string): AgentDefinition {
  return {
    id, name, icon: '•', color: '#888', providerId: id, providerMode: 'integrated',
    supportsWorktree: false, supportsStructuredEvents: true, supportsImages: false, supportsResume: true,
    supportsModelSelection: true, supportsApprovalFlow: true, supportsSandbox: false, supportsYolo: false,
  }
}

const DEFS = [def('claude-code', 'Claude Agent V1'), def('codex-agent', 'Codex Agent')]
const REASON = en.claude.remoteCodexUnsupportedShort

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function openAddMenu(props: Partial<Parameters<typeof ThumbnailBar>[0]>) {
  const onAddAgent = vi.fn()
  render(
    <ThumbnailBar
      terminals={[]}
      focusedTerminalId={null}
      onFocus={() => {}}
      onAddTerminal={() => {}}
      onAddAgent={onAddAgent}
      agentDefinitions={DEFS}
      showAddButton={true}
      {...props}
    />,
  )
  fireEvent.click(screen.getByTitle(en.terminal.addTerminalOrAgent))
  return onAddAgent
}

describe('ThumbnailBar add menu in a remote window', () => {
  test('codex agent is disabled with the reason and does not start', () => {
    const onAddAgent = openAddMenu({ unavailableAgents: { 'codex-agent': REASON } })
    const codex = screen.getByText('Codex Agent').closest('.thumbnail-add-menu-item') as HTMLElement
    expect(codex).toHaveClass('disabled')
    expect(codex).toHaveAttribute('aria-disabled', 'true')
    expect(codex).toHaveAttribute('title', REASON)
    expect(codex).toHaveTextContent(REASON)
    fireEvent.click(codex)
    expect(onAddAgent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Claude Agent V1'))
    expect(onAddAgent).toHaveBeenCalledWith('claude-code')
  })

  test('local window (no unavailableAgents): codex agent stays available', () => {
    const onAddAgent = openAddMenu({})
    const codex = screen.getByText('Codex Agent').closest('.thumbnail-add-menu-item') as HTMLElement
    expect(codex).not.toHaveClass('disabled')
    fireEvent.click(codex)
    expect(onAddAgent).toHaveBeenCalledWith('codex-agent')
  })
})

describe('RemoteAgentUnavailable', () => {
  test('explains why Codex Agent is unavailable', () => {
    render(<RemoteAgentUnavailable />)
    expect(screen.getByRole('status')).toHaveTextContent(en.claude.remoteCodexUnsupported)
  })
})

describe('T0401 locale keys', () => {
  test.each([['en', en], ['zh-TW', zhTW], ['zh-CN', zhCN]] as const)('%s has the remote-degrade strings', (_lang, locale) => {
    expect(locale.claude.remoteCodexUnsupported).toBeTruthy()
    expect(locale.claude.remoteCodexUnsupportedShort).toBeTruthy()
    expect(locale.claude.remoteChannelUnsupported).toContain('{{channel}}')
  })
})
