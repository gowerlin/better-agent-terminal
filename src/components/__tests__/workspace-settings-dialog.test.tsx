/**
 * PLAN-040 / T0529: Workspace Settings dialog — default agent, per-preset launch args override,
 * effective values with their source, and the read-only detached-window mode (D142).
 * Plus a source guard: every UI consumer reads the workspace's effective values.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { settingsStore } from '../../stores/settings-store'
import type { Workspace } from '../../types'
import { WorkspaceEnvDialog } from '../WorkspaceEnvDialog'

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    settings: { save: vi.fn(async () => true) },
  }
  settingsStore.setDefaultAgent('claude-code')
  settingsStore.setAgentCustomArg('codex-cli', '--yolo')
  settingsStore.setAgentCustomArg('claude-cli', '--dangerously-skip-permissions')
})

function renderDialog(workspace: Partial<Workspace>, readOnly = false) {
  const onSetDefaultAgent = vi.fn()
  const onSetAgentArg = vi.fn()
  render(
    <WorkspaceEnvDialog
      workspace={{ id: 'ws', name: 'WS', folderPath: '/ws', createdAt: 0, ...workspace }}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onUpdate={vi.fn()}
      onClose={vi.fn()}
      onSetDefaultAgent={onSetDefaultAgent}
      onSetAgentArg={onSetAgentArg}
      readOnly={readOnly}
    />,
  )
  return { onSetDefaultAgent, onSetAgentArg }
}

const row = (presetId: string) => document.querySelector(`.workspace-args-row[data-preset="${presetId}"]`) as HTMLElement

describe('Workspace Settings dialog (T0529)', () => {
  test('unset workspace: follows the global agent, args shown read-only from Settings', () => {
    renderDialog({})
    const select = screen.getByLabelText(en.workspaceSettings.defaultAgent) as HTMLSelectElement
    expect(select.value).toBe('')
    expect(select.options[0].textContent).toContain('Claude Agent')
    expect(screen.getByTestId('workspace-effective-agent').textContent).toContain(en.workspaceSettings.source.settings)

    const codex = within(row('codex-cli'))
    const input = codex.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('--yolo')
    expect(input.readOnly).toBe(true)
    expect((codex.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
    expect(codex.getByText(en.workspaceSettings.source.settings)).toBeInTheDocument()
  })

  test('set / clear the default agent', () => {
    const { onSetDefaultAgent } = renderDialog({ defaultAgent: 'codex-cli' })
    expect(screen.getByTestId('workspace-effective-agent').textContent).toContain(en.workspaceSettings.source.workspace)
    const select = screen.getByLabelText(en.workspaceSettings.defaultAgent)
    fireEvent.change(select, { target: { value: 'gemini-cli' } })
    fireEvent.change(select, { target: { value: '' } })
    expect(onSetDefaultAgent.mock.calls).toEqual([['gemini-cli'], [undefined]])
  })

  test('override: tick copies the global args, edit replaces them, untick clears', () => {
    const { onSetAgentArg } = renderDialog({})
    fireEvent.click(within(row('codex-cli')).getByRole('checkbox'))
    expect(onSetAgentArg).toHaveBeenLastCalledWith('codex-cli', '--yolo')
  })

  test('an overriding workspace: editable value, empty override shown as "no args"', () => {
    const { onSetAgentArg } = renderDialog({ agentCustomArgs: { 'codex-cli': '--model o3', 'claude-cli': '' } })
    const codex = within(row('codex-cli'))
    const input = codex.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('--model o3')
    expect(input.readOnly).toBe(false)
    expect(codex.getByText(en.workspaceSettings.source.workspace)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '--model gpt-5' } })
    expect(onSetAgentArg).toHaveBeenLastCalledWith('codex-cli', '--model gpt-5')
    fireEvent.click(codex.getByRole('checkbox'))
    expect(onSetAgentArg).toHaveBeenLastCalledWith('codex-cli', undefined)

    const claudeInput = within(row('claude-cli')).getByRole('textbox') as HTMLInputElement
    expect(claudeInput.value).toBe('')
    expect(claudeInput.placeholder).toBe(en.workspaceSettings.emptyOverride)
  })

  test('detached window: read-only with the main-window hint', () => {
    renderDialog({ defaultAgent: 'codex-cli', envVars: [{ key: 'FOO', value: 'bar', enabled: true }] }, true)
    expect(screen.getByRole('note').textContent).toBe(en.workspaceSettings.detachedReadOnly)
    expect((screen.getByLabelText(en.workspaceSettings.defaultAgent) as HTMLSelectElement).disabled).toBe(true)
    for (const box of screen.getAllByRole('checkbox')) expect((box as HTMLInputElement).disabled).toBe(true)
    for (const input of screen.getAllByRole('textbox')) expect((input as HTMLInputElement).disabled).toBe(true)
    // env vars listed, not editable (no editor inputs / add button)
    expect(screen.getByText('FOO')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(en.envVars.variableName)).not.toBeInTheDocument()
  })
})

describe('UI consumers read the effective workspace values (T0529 source guard)', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf-8')

  test.each(['../../App.tsx', '../WorkspaceView.tsx'])('%s', (rel) => {
    const src = read(rel)
    expect(src).not.toMatch(/settingsStore\.getAgentCustomArgs\(/)
    expect(src).not.toMatch(/defaultAgent \|\| settings\.defaultAgent/)
    expect(src).toMatch(/workspaceStore\.getEffectiveDefaultAgent\(/)
    expect(src).toMatch(/workspaceStore\.getEffectiveAgentArgs\(/)
  })

  test('App.tsx: the detached window opens Workspace Settings read-only', () => {
    const src = read('../../App.tsx')
    const detached = src.slice(src.indexOf('if (detachedWorkspaceId) {'), src.indexOf('// Filter out detached workspaces'))
    expect(detached).toMatch(/onOpenWorkspaceSettings=/)
    expect(detached).toMatch(/<WorkspaceEnvDialog[\s\S]*?readOnly/)
    expect(detached).not.toMatch(/setWorkspaceDefaultAgent|setWorkspaceAgentCustomArg/)
  })
})
