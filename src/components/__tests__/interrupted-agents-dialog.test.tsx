/**
 * PLAN-055 B1 / T0766: InterruptedAgentsDialog (grouping, order, Esc = close without resuming,
 * resume-all = claude rows only), the renderer store's resume paths, the recovery toast count, and
 * source guards (⏻ restart still launches a new claude; the resume goes through startClaudeCliPty).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { groupInterruptedAgentRows, InterruptedAgentsDialog, type InterruptedAgentRow } from '../InterruptedAgentsDialog'
import { SERVER_STATUS_TOAST_KEYS, ServerStatusToast } from '../ServerStatusToast'
import {
  getInterruptedAgent,
  listInterruptedAgents,
  registerTabResumeHandler,
  resetInterruptedAgentsStoreForTests,
  resumeInterruptedAgent,
  setInterruptedAgents,
  type InterruptedAgentInfo,
} from '../../stores/interrupted-agents-store'

const S1 = '11111111-2222-4333-8444-555555555555'

function info(extra: Partial<InterruptedAgentInfo> & { terminalId: string }): InterruptedAgentInfo {
  return { agent: 'claude-cli', claudeSessionId: null, claudeSessionName: null, launchedBy: 'tab', cwd: '/w', at: 1, ...extra }
}

function row(agent: InterruptedAgentInfo, workspaceId = 'ws-1', title = agent.terminalId): InterruptedAgentRow {
  return { agent, title, workspaceId, workspaceName: workspaceId === 'ws-1' ? 'Alpha' : 'Beta' }
}

afterEach(async () => {
  await i18n.changeLanguage('en')
  resetInterruptedAgentsStoreForTests()
})

describe('groupInterruptedAgentRows', () => {
  it('by workspace (first seen), Towers → tabs → Workers inside each', () => {
    const groups = groupInterruptedAgentRows([
      row(info({ terminalId: 'w1', workorder: 'T1', towerTerminalId: 't1', launchedBy: 'dispatch' })),
      row(info({ terminalId: 'b1' }), 'ws-2'),
      row(info({ terminalId: 'tab1' })),
      row(info({ terminalId: 't1', role: 'tower' })),
    ])
    expect(groups.map(g => [g.workspaceName, g.rows.map(r => r.agent.terminalId)])).toEqual([
      ['Alpha', ['t1', 'tab1', 'w1']],
      ['Beta', ['b1']],
    ])
  })
})

describe('InterruptedAgentsDialog', () => {
  function renderDialog(rows: InterruptedAgentRow[]) {
    const handlers = { onResume: vi.fn(), onResumeAll: vi.fn(), onDismiss: vi.fn(), onClose: vi.fn() }
    render(<InterruptedAgentsDialog rows={rows} busy={new Set()} message={null} {...handlers} />)
    return handlers
  }

  it('rows: claude with a session → Resume, without → Open resume menu, codex → Open resume menu (T0767), unknown → no resume; all rows can be dismissed', () => {
    const h = renderDialog([
      row(info({ terminalId: 'c1', claudeSessionId: S1 })),
      row(info({ terminalId: 'c2' })),
      row(info({ terminalId: 'x1', agent: 'codex-cli' })),
      row(info({ terminalId: 'u1', agent: 'unknown' })),
    ])
    const item = (id: string) => document.querySelector(`li[data-terminal-id="${id}"]`) as HTMLElement
    expect(within(item('c1')).getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(within(item('c1')).getByText('session 11111111')).toBeInTheDocument()
    expect(within(item('c2')).getByRole('button', { name: 'Open resume menu' })).toBeInTheDocument()
    expect(within(item('x1')).getByRole('button', { name: 'Open resume menu' })).toBeInTheDocument()
    expect(within(item('x1')).getByText("codex: opens codex's resume menu (sessions of this folder)")).toBeInTheDocument()
    expect(item('u1').querySelector('[data-action="resume"]')).toBeNull()
    fireEvent.click(within(item('c1')).getByRole('button', { name: 'Resume' }))
    expect(h.onResume).toHaveBeenCalledWith('c1')
    fireEvent.click(within(item('x1')).getByRole('button', { name: 'Dismiss' }))
    expect(h.onDismiss).toHaveBeenCalledWith('x1')
    expect(screen.getByRole('button', { name: 'Resume all (3)' })).toBeEnabled()
  })

  it('Esc and [X] close without resuming or dismissing', () => {
    const h = renderDialog([row(info({ terminalId: 'c1', claudeSessionId: S1 }))])
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(h.onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(document.querySelector('.interrupted-agents-x')!)
    expect(h.onClose).toHaveBeenCalledTimes(2)
    expect(h.onResume).not.toHaveBeenCalled()
    expect(h.onResumeAll).not.toHaveBeenCalled()
    expect(h.onDismiss).not.toHaveBeenCalled()
  })

  it('a Tower and a Worker → the "resume Towers first" hint; no resumable row → resume-all disabled', () => {
    renderDialog([
      row(info({ terminalId: 'w1', workorder: 'T1', launchedBy: 'dispatch' })),
      row(info({ terminalId: 't1', role: 'tower' })),
    ])
    expect(screen.getByText(/Resume Towers first/)).toBeInTheDocument()
    document.body.innerHTML = ''
    renderDialog([row(info({ terminalId: 'u1', agent: 'unknown' }))])
    expect(screen.getByRole('button', { name: 'Resume all (0)' })).toBeDisabled()
  })
})

describe('interrupted-agents-store', () => {
  beforeEach(() => resetInterruptedAgentsStoreForTests())

  it('keeps only this window\'s tabs', () => {
    const kept = setInterruptedAgents([info({ terminalId: 'mine' }), info({ terminalId: 'other' })], id => id === 'mine')
    expect(kept.map(a => a.terminalId)).toEqual(['mine'])
    expect(listInterruptedAgents().map(a => a.terminalId)).toEqual(['mine'])
  })

  it('a claude-cli tab → the workspace handler (startClaudeCliPty); other claude tabs → main; unknown → refused', async () => {
    setInterruptedAgents([
      info({ terminalId: 'tab', claudeSessionId: S1 }),
      info({ terminalId: 'worker', launchedBy: 'dispatch', workorder: 'T1' }),
      info({ terminalId: 'unknown', agent: 'unknown' }),
    ], () => true)
    const handler = vi.fn(async () => ({ ok: true as const, mode: 'session' as const }))
    registerTabResumeHandler('ws-1', handler)
    const resumeInMain = vi.fn(async () => ({ ok: true as const, mode: 'picker' as const }))
    const deps = {
      terminalOf: (id: string) => (id === 'tab' ? { agentPreset: 'claude-cli', workspaceId: 'ws-1' } : { workspaceId: 'ws-1' }),
      resumeInMain,
      activateWorkspace: vi.fn(),
    }
    expect(await resumeInterruptedAgent(getInterruptedAgent('tab')!, deps)).toEqual({ ok: true, mode: 'session' })
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ terminalId: 'tab', claudeSessionId: S1 }))
    expect(resumeInMain).not.toHaveBeenCalled()
    expect(await resumeInterruptedAgent(getInterruptedAgent('worker')!, deps)).toEqual({ ok: true, mode: 'picker' })
    expect(resumeInMain).toHaveBeenCalledWith('worker')
    expect(await resumeInterruptedAgent(getInterruptedAgent('unknown')!, deps)).toMatchObject({ ok: false, code: 'NOT_RESUMABLE' })
    expect(listInterruptedAgents().map(a => a.terminalId)).toEqual(['unknown'])
  })

  it('a workspace whose view is not mounted is activated first, then its handler runs', async () => {
    setInterruptedAgents([info({ terminalId: 'tab' })], () => true)
    const handler = vi.fn(async () => ({ ok: true as const, mode: 'picker' as const }))
    const activateWorkspace = vi.fn(() => { setTimeout(() => registerTabResumeHandler('ws-2', handler), 0) })
    const result = await resumeInterruptedAgent(getInterruptedAgent('tab')!, {
      terminalOf: () => ({ agentPreset: 'claude-cli-worktree', workspaceId: 'ws-2' }),
      resumeInMain: vi.fn(),
      activateWorkspace,
      handlerTimeoutMs: 1000,
    })
    expect(activateWorkspace).toHaveBeenCalledWith('ws-2')
    expect(result).toEqual({ ok: true, mode: 'picker' })
  })

  it('no view registers in time → NO_WORKSPACE_VIEW, entry kept', async () => {
    setInterruptedAgents([info({ terminalId: 'tab' })], () => true)
    const result = await resumeInterruptedAgent(getInterruptedAgent('tab')!, {
      terminalOf: () => ({ agentPreset: 'claude-cli', workspaceId: 'ws-3' }),
      resumeInMain: vi.fn(),
      activateWorkspace: vi.fn(),
      handlerTimeoutMs: 10,
    })
    expect(result).toMatchObject({ ok: false, code: 'NO_WORKSPACE_VIEW' })
    expect(getInterruptedAgent('tab')).not.toBeNull()
  })
})

describe('ServerStatusToast: interrupted count (T0766)', () => {
  it('count 0 → the toast as before; count > 0 on recovered → a line, a click opens the dialog and dismisses', () => {
    const onDismiss = vi.fn()
    const onOpen = vi.fn()
    const { container, rerender } = render(<ServerStatusToast messageKey={SERVER_STATUS_TOAST_KEYS.recovered} onDismiss={onDismiss} interruptedCount={0} onOpenInterrupted={onOpen} />)
    expect(container.querySelector('.server-status-toast')?.textContent).toBe(i18n.t(SERVER_STATUS_TOAST_KEYS.recovered))
    fireEvent.click(container.querySelector('.server-status-toast')!)
    expect(onOpen).not.toHaveBeenCalled()
    rerender(<ServerStatusToast messageKey={SERVER_STATUS_TOAST_KEYS.recovered} onDismiss={onDismiss} interruptedCount={2} onOpenInterrupted={onOpen} />)
    expect(screen.getByText('2 agent tabs were interrupted — click to review')).toBeInTheDocument()
    fireEvent.click(container.querySelector('.server-status-toast')!)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(2)
    // only the recovered toast carries it
    rerender(<ServerStatusToast messageKey={SERVER_STATUS_TOAST_KEYS.recovering} onDismiss={onDismiss} interruptedCount={2} onOpenInterrupted={onOpen} />)
    expect(container.querySelector('.server-status-toast-interrupted')).toBeNull()
  })

  it('zh-TW text', async () => {
    await act(async () => { await i18n.changeLanguage('zh-TW') })
    render(<ServerStatusToast messageKey={SERVER_STATUS_TOAST_KEYS.recovered} onDismiss={() => {}} interruptedCount={1} />)
    expect(screen.getByText('1 個 agent 分頁已中斷，按此查看')).toBeInTheDocument()
  })
})

describe('source guards (T0766)', () => {
  const view = readFileSync(join(__dirname, '../WorkspaceView.tsx'), 'utf8')

  it('⏻ restart of a claude-cli tab still launches a new claude (no resume argument)', () => {
    const restart = view.slice(view.indexOf('const handleRestart = useCallback('))
    expect(restart).toMatch(/await startClaudeCliPty\(id, terminal\.cwd \|\| workspace\.folderPath, isWorktreeAgent\(terminal\.agentPreset\)\)\n/)
  })

  it('the tab resume goes through startClaudeCliPty after a kill, never a second worktree.create', () => {
    const handler = view.slice(view.indexOf('registerTabResumeHandler(workspace.id'))
    expect(handler.indexOf('await window.electronAPI.pty.kill(terminal.id)')).toBeGreaterThan(-1)
    expect(handler.indexOf('await startClaudeCliPty(')).toBeGreaterThan(handler.indexOf('await window.electronAPI.pty.kill(terminal.id)'))
    expect(view).toContain('if (isWorktree && !resume) {')
    // --resume after BAT's args, before the custom args
    const start = view.slice(view.indexOf('const startClaudeCliPty = useCallback('), view.indexOf('const handleAddClaudeCli = useCallback('))
    expect(start.indexOf('if (resumeDecision?.arg) cmdParts.push(resumeDecision.arg)')).toBeGreaterThan(start.indexOf('withBatMcpLaunchArgs('))
    expect(start.indexOf('if (resumeDecision?.arg) cmdParts.push(resumeDecision.arg)')).toBeLessThan(start.indexOf('cmdParts.push(customArgs)'))
    const code = start.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n')
    expect(code).not.toContain('--fork-session')
  })
})
