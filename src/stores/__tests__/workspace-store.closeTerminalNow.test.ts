/**
 * PLAN-041 / T0535: ✕ and `--close-worker` close a tab through `workspaceStore.closeTerminalNow`.
 *
 * - the calls it makes equal, case by case, what WorkspaceView's ✕ path made before T0535 (the
 *   pre-T0535 `handleConfirmClose` / idle-shell branch are reproduced below as the reference)
 * - `ownsTerminalForCloseRequest`: which window closes a tab on `terminal:close-requested`
 * - source guard: the ✕ confirm condition is unchanged, both ✕ branches go through
 *   closeTerminalNow, and the close-requested handler never cleans a worktree
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/pty-replay', () => ({ requestPtyReplay: vi.fn() }))

import type { TerminalInstance } from '../../types'
import { isIntegrated, isWorktreeAgent } from '../../types/agent-runtime'
import { ownsTerminalForCloseRequest, workspaceStore } from '../workspace-store'

let calls: string[]

beforeEach(() => {
  calls = []
  const rec = (name: string) => vi.fn((...args: unknown[]) => { calls.push(`${name}(${args.map(a => JSON.stringify(a)).join(',')})`) })
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    settings: { save: vi.fn(async () => true) },
    pty: { kill: rec('pty.kill') },
    claude: { stopSession: rec('claude.stopSession'), cleanupWorktree: rec('claude.cleanupWorktree') },
    worktree: { remove: rec('worktree.remove') },
    workspace: {
      save: vi.fn(async () => { calls.push('workspace.save'); return true }),
      load: vi.fn(async () => null),
      onReload: () => () => {},
      onReattached: () => () => {},
    },
  }
})

afterEach(() => {
  workspaceStore.stopAutoSave()
})

/** WorkspaceView's ✕ close steps before T0535 (handleConfirmClose; the idle shell = kill + remove + save). */
function preT0535ConfirmClose(id: string, terminal: TerminalInstance | undefined, cleanWorktree: boolean): string[] {
  const out: string[] = []
  if (terminal?.agentPreset && isIntegrated(terminal.agentPreset)) {
    out.push(`claude.stopSession(${JSON.stringify(id)})`)
    if (cleanWorktree && (isWorktreeAgent(terminal.agentPreset) || !!terminal.worktreePath)) {
      out.push(`claude.cleanupWorktree(${JSON.stringify(id)},true)`)
    }
  } else {
    out.push(`pty.kill(${JSON.stringify(id)})`)
    if (cleanWorktree && terminal?.agentPreset === 'claude-cli-worktree') {
      out.push(`worktree.remove(${JSON.stringify(id)},true)`)
    }
  }
  out.push('removeTerminal', 'workspace.save')
  return out
}

const PRESETS = [undefined, 'none', 'claude-cli', 'claude-cli-worktree', 'codex-cli', 'claude-code', 'claude-code-v2', 'claude-code-worktree', 'codex-agent', 'codex-agent-worktree'] as const

describe('closeTerminalNow = the pre-T0535 ✕ close steps (T0535)', () => {
  for (const preset of PRESETS) {
    for (const worktreePath of [undefined, '/tmp/wt']) {
      for (const cleanWorktree of [false, true]) {
        it(`preset=${preset ?? '(none)'} worktreePath=${worktreePath ?? '-'} cleanWorktree=${cleanWorktree}`, async () => {
          const ws = workspaceStore.addWorkspace('close', '/tmp/close')
          const terminal = workspaceStore.addTerminal(ws.id, preset)
          if (worktreePath) workspaceStore.setTerminalWorktreeInfo(terminal.id, worktreePath, 'branch')
          const expected = preT0535ConfirmClose(terminal.id, workspaceStore.getState().terminals.find(t => t.id === terminal.id), cleanWorktree)

          const unsubscribe = workspaceStore.subscribe(() => {
            if (!workspaceStore.getState().terminals.some(t => t.id === terminal.id) && !calls.includes('removeTerminal')) calls.push('removeTerminal')
          })
          workspaceStore.closeTerminalNow(terminal.id, { cleanWorktree })
          unsubscribe()
          await vi.waitFor(() => expect(calls).toContain('workspace.save'))

          expect(calls).toEqual(expected)
          expect(workspaceStore.getState().terminals.some(t => t.id === terminal.id)).toBe(false)
        })
      }
    }
  }

  it('default options = no worktree cleanup (the --close-worker path)', async () => {
    const ws = workspaceStore.addWorkspace('close', '/tmp/close')
    const terminal = workspaceStore.addTerminal(ws.id, 'claude-cli-worktree')
    workspaceStore.closeTerminalNow(terminal.id)
    await vi.waitFor(() => expect(calls).toContain('workspace.save'))
    expect(calls).toEqual([`pty.kill(${JSON.stringify(terminal.id)})`, 'workspace.save'])
  })

  it('an id the store does not hold: kill + save as before (✕ on an unknown id)', async () => {
    workspaceStore.closeTerminalNow('unknown-id')
    await vi.waitFor(() => expect(calls).toContain('workspace.save'))
    expect(calls).toEqual(['pty.kill("unknown-id")', 'workspace.save'])
  })
})

describe('ownsTerminalForCloseRequest (T0535)', () => {
  const t = (workspaceId: string) => ({ workspaceId })

  it('main window: tabs of workspaces not detached from it', () => {
    expect(ownsTerminalForCloseRequest(t('a'), null, new Set())).toBe(true)
    expect(ownsTerminalForCloseRequest(t('a'), null, new Set(['a']))).toBe(false)
    expect(ownsTerminalForCloseRequest(t('b'), null, new Set(['a']))).toBe(true)
  })

  it('detached window: only its own workspace', () => {
    expect(ownsTerminalForCloseRequest(t('a'), 'a', new Set())).toBe(true)
    expect(ownsTerminalForCloseRequest(t('b'), 'a', new Set())).toBe(false)
  })

  it('a tab this window does not hold', () => {
    expect(ownsTerminalForCloseRequest(undefined, null, new Set())).toBe(false)
    expect(ownsTerminalForCloseRequest(undefined, 'a', new Set())).toBe(false)
  })
})

describe('source guard: ✕ path and close-requested (T0535)', () => {
  const view = readFileSync(resolve(__dirname, '../../components/WorkspaceView.tsx'), 'utf8')
  const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8')

  it('the ✕ confirm condition is unchanged', () => {
    expect(view).toContain("const isAgentTerminal = !!(terminal?.agentPreset && terminal.agentPreset !== 'none')")
    expect(view).toContain('const shouldWarn = isAgentTerminal || !!terminal?.isAltBuffer || !!terminal?.hasPendingAction')
    expect(view).toMatch(/if \(shouldWarn\) \{\s*setShowCloseConfirm\(id\)\s*\} else \{[^}]*workspaceStore\.closeTerminalNow\(id\)\s*\}/)
  })

  it('confirming the dialog closes through closeTerminalNow with the dialog\'s worktree choice', () => {
    expect(view).toMatch(/const handleConfirmClose = useCallback\(\(cleanWorktree = false\) => \{\s*if \(showCloseConfirm\) \{\s*workspaceStore\.closeTerminalNow\(showCloseConfirm, \{ cleanWorktree \}\)\s*setShowCloseConfirm\(null\)/)
    // the stop / worktree calls live only in the store now
    expect(view).not.toContain('window.electronAPI.claude.stopSession(showCloseConfirm)')
    expect(view).not.toContain('window.electronAPI.worktree.remove(')
  })

  it('close-requested: ownership check, no confirm, worktree kept', () => {
    expect(app).toMatch(/onCloseRequested\(\(\{ id \}\) => \{[\s\S]*?ownsTerminalForCloseRequest\(terminal, detachedWorkspaceId, detachedIds\)[\s\S]*?workspaceStore\.closeTerminalNow\(id, \{ cleanWorktree: false \}\)/)
  })
})
