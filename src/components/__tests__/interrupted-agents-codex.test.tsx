/**
 * PLAN-055 B2 / T0767 (D211 P-4 a): codex tabs in the interrupted-agents flow — the renderer store
 * routes a codex-cli tab to its workspace handler and any other codex tab to main, the dialog offers
 * codex's resume menu and counts codex rows in 全部恢復, and source guards on WorkspaceView's codex
 * resume (⏻'s path + `withBatMcpLaunchArgs` + `codexResumeCommand`, never `--last`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { InterruptedAgentsController, InterruptedAgentsDialog, type InterruptedAgentRow } from '../InterruptedAgentsDialog'
import {
  getInterruptedAgent,
  isCodexResumableAgent,
  isResumableAgent,
  listInterruptedAgents,
  registerTabResumeHandler,
  resetInterruptedAgentsStoreForTests,
  resumeInterruptedAgent,
  setInterruptedAgents,
  type InterruptedAgentInfo,
} from '../../stores/interrupted-agents-store'
import { workspaceStore } from '../../stores/workspace-store'

function info(extra: Partial<InterruptedAgentInfo> & { terminalId: string }): InterruptedAgentInfo {
  return { agent: 'codex-cli', claudeSessionId: null, claudeSessionName: null, launchedBy: 'tab', cwd: '/w', at: 1, ...extra }
}

function row(agent: InterruptedAgentInfo): InterruptedAgentRow {
  return { agent, title: agent.terminalId, workspaceId: 'ws-1', workspaceName: 'Alpha' }
}

afterEach(async () => {
  await i18n.changeLanguage('en')
  resetInterruptedAgentsStoreForTests()
})

describe('interrupted-agents-store: codex (T0767)', () => {
  beforeEach(() => resetInterruptedAgentsStoreForTests())

  it('codex-cli is resumable; unknown is not', () => {
    expect(isResumableAgent({ agent: 'codex-cli' })).toBe(true)
    expect(isCodexResumableAgent({ agent: 'codex-cli' })).toBe(true)
    expect(isCodexResumableAgent({ agent: 'claude-cli' })).toBe(false)
    expect(isResumableAgent({ agent: 'unknown' })).toBe(false)
  })

  it('a codex-cli tab → the workspace handler; a dispatched codex (no renderer preset) → main', async () => {
    setInterruptedAgents([
      info({ terminalId: 'tab' }),
      info({ terminalId: 'worker', launchedBy: 'dispatch', workorder: 'T1' }),
    ], () => true)
    const handler = vi.fn(async () => ({ ok: true as const, mode: 'picker' as const }))
    registerTabResumeHandler('ws-1', handler)
    const resumeInMain = vi.fn(async () => ({ ok: true as const, mode: 'picker' as const }))
    const deps = {
      terminalOf: (id: string) => (id === 'tab' ? { agentPreset: 'codex-cli', workspaceId: 'ws-1' } : { workspaceId: 'ws-1' }),
      resumeInMain,
      activateWorkspace: vi.fn(),
    }
    expect(await resumeInterruptedAgent(getInterruptedAgent('tab')!, deps)).toEqual({ ok: true, mode: 'picker' })
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ terminalId: 'tab', agent: 'codex-cli' }))
    expect(resumeInMain).not.toHaveBeenCalled()
    expect(await resumeInterruptedAgent(getInterruptedAgent('worker')!, deps)).toEqual({ ok: true, mode: 'picker' })
    expect(resumeInMain).toHaveBeenCalledWith('worker')
    expect(listInterruptedAgents()).toEqual([])
  })

  it('a failed codex resume keeps the entry', async () => {
    setInterruptedAgents([info({ terminalId: 'tab' })], () => true)
    registerTabResumeHandler('ws-1', async () => ({ ok: false, code: 'PTY_RESTART_FAILED' }))
    const result = await resumeInterruptedAgent(getInterruptedAgent('tab')!, {
      terminalOf: () => ({ agentPreset: 'codex-cli', workspaceId: 'ws-1' }),
      resumeInMain: vi.fn(),
      activateWorkspace: vi.fn(),
    })
    expect(result).toEqual({ ok: false, code: 'PTY_RESTART_FAILED' })
    expect(listInterruptedAgents().map(a => a.terminalId)).toEqual(['tab'])
  })
})

describe('InterruptedAgentsDialog: codex rows (T0767)', () => {
  it('a codex row: codex resume menu status + Open resume menu; counted in Resume all', () => {
    const onResume = vi.fn()
    render(<InterruptedAgentsDialog rows={[row(info({ terminalId: 'x1' })), row(info({ terminalId: 'c1', agent: 'claude-cli' }))]} busy={new Set()} message={null} onResume={onResume} onResumeAll={vi.fn()} onDismiss={vi.fn()} onClose={vi.fn()} />)
    const item = document.querySelector('li[data-terminal-id="x1"]') as HTMLElement
    expect(item.dataset.resumable).toBe('true')
    expect(within(item).getByText("codex: opens codex's resume menu (sessions of this folder)")).toBeInTheDocument()
    fireEvent.click(within(item).getByRole('button', { name: 'Open resume menu' }))
    expect(onResume).toHaveBeenCalledWith('x1')
    expect(screen.getByRole('button', { name: 'Resume all (2)' })).toBeEnabled()
  })

  it('zh-TW: the codex texts', async () => {
    await i18n.changeLanguage('zh-TW')
    render(<InterruptedAgentsDialog rows={[row(info({ terminalId: 'x1' }))]} busy={new Set()} message={null} onResume={vi.fn()} onResumeAll={vi.fn()} onDismiss={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('codex：開啟 codex 的 resume 選單（這個資料夾的 session）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '全部恢復（1）' })).toBeEnabled()
  })
})

describe('InterruptedAgentsController: codex outcome message (T0767)', () => {
  it('a resumed codex tab → "Opened codex\'s resume menu"', async () => {
    const ws = workspaceStore.addWorkspace('T0767', '/w')
    const terminal = workspaceStore.addTerminal(ws.id, 'codex-cli')
    let push: ((event: { reason: 'recovery' | 'update'; agents: InterruptedAgentInfo[] }) => void) | undefined
    const api = window as unknown as { electronAPI: Record<string, unknown> }
    const previous = api.electronAPI
    api.electronAPI = {
      ...previous,
      terminalServer: {
        onAgentsInterrupted: (cb: typeof push) => { push = cb; return () => {} },
        queryInterruptedAgents: async () => [],
        resumeInterruptedAgent: vi.fn(),
        dismissInterruptedAgent: vi.fn(async () => true),
      },
      debug: { log: vi.fn() },
    }
    const unregister = registerTabResumeHandler(ws.id, async () => ({ ok: true, mode: 'picker' }))
    try {
      render(<InterruptedAgentsController />)
      await waitFor(() => expect(push).toBeDefined())
      act(() => push!({ reason: 'recovery', agents: [info({ terminalId: terminal.id, workspaceId: ws.id })] }))
      const item = await waitFor(() => document.querySelector(`li[data-terminal-id="${terminal.id}"]`) as HTMLElement)
      expect(item).toBeTruthy()
      await act(async () => { fireEvent.click(within(item).getByRole('button', { name: 'Open resume menu' })) })
      // the list empties → the dialog closes; the message was set on the way (checked through the log line)
      await waitFor(() => expect((api.electronAPI.debug as { log: ReturnType<typeof vi.fn> }).log).toHaveBeenCalledWith(expect.stringContaining(`[interrupted-agents] resume terminal=${terminal.id} agent=codex-cli launchedBy=tab → ok mode=picker`)))
    } finally {
      unregister()
      api.electronAPI = previous
      workspaceStore.removeWorkspace(ws.id)
    }
  })
})

describe('source guards (T0767)', () => {
  const view = readFileSync(join(__dirname, '..', 'WorkspaceView.tsx'), 'utf8')
  const fn = view.slice(view.indexOf('const resumeCodexCliTab = useCallback'), view.indexOf('// PLAN-055 B1 / T0766: resume a claude-cli tab'))

  it('WorkspaceView: a codex-cli tab resumes through ⏻\'s path with BAT\'s args and codexResumeCommand', () => {
    expect(fn.length).toBeGreaterThan(0)
    expect(fn).toContain('restartOrCreatePty(')
    expect(fn).toContain("buildLaunchCommand('codex-cli', undefined, extraArgs)")
    expect(fn).toContain("const launchWithBatArgs = await withBatMcpLaunchArgs(launchCmd, 'codex-cli', shell, extraArgs, terminalId)")
    expect(fn).toContain('codexResumeCommand(launchWithBatArgs, extraArgs)')
    expect(fn).not.toContain('--last')
    expect(view).toContain("if (terminal?.agentPreset === 'codex-cli') return resumeCodexCliTab(")
  })

  it('no `--last` in the codex resume sources', () => {
    for (const file of [join(__dirname, '..', '..', 'lib', 'codex-resume-args.ts'), join(__dirname, '..', '..', '..', 'electron', 'interrupted-agents.ts')]) {
      const code = readFileSync(file, 'utf8').split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n')
      expect(code, file).not.toContain('--last')
    }
  })
})
