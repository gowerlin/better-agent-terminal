/**
 * T0361 / G4 + G5 — addExternalTerminal 的 workspace miss 觀測訊號。
 *
 * 兩件事必須同時成立：
 *   G4  帶了不存在的 workspaceId 時發出 [T0361] warn（含 requested / landed / terminal id）；
 *       帶合法 id 或完全不帶時**不發**。
 *   G5  行為完全不變 —— miss 情境仍舊 fallback 到 active workspace、仍舊回傳 terminal。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceStore } from '../workspace-store'

const logSpy = vi.fn()

beforeEach(() => {
  logSpy.mockClear()
  // 測試環境沒有 preload bridge；補一個最小 stub 讓 debug.log 可觀測。
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: logSpy },
  }
  // 每個 case 重建乾淨的 workspace / terminal 狀態
  const state = workspaceStore.getState()
  state.workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
})

function seedWorkspaces() {
  const other = workspaceStore.addWorkspace('other', '/tmp/other')
  const active = workspaceStore.addWorkspace('active', '/tmp/active')
  // addWorkspace 會把新建的設為 active
  expect(workspaceStore.getState().activeWorkspaceId).toBe(active.id)
  return { other, active }
}

function missLogs() {
  return logSpy.mock.calls.map(c => String(c[0])).filter(m => m.includes('[T0361] Workspace miss'))
}

describe('addExternalTerminal — workspace miss signal (T0361)', () => {
  it('G4/G5: 未知 workspaceId → 發 warn，且仍 fallback 到 active workspace 並回傳 terminal', () => {
    const { active } = seedWorkspaces()

    const added = workspaceStore.addExternalTerminal({
      id: 'term-miss',
      cwd: '/tmp/x',
      workspaceId: 'no-such-workspace',
    })

    // G5 — 行為不變
    expect(added).not.toBeNull()
    expect(added!.id).toBe('term-miss')
    expect(added!.workspaceId).toBe(active.id)

    // G4 — 訊號內容含 requested + landed + terminal id
    const logs = missLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('requested=no-such-workspace')
    expect(logs[0]).toContain(`landed=${active.id}`)
    expect(logs[0]).toContain('terminal=term-miss')
  })

  it('G4: 合法 workspaceId → 不發 warn，且落在指定的 workspace', () => {
    const { other } = seedWorkspaces()

    const added = workspaceStore.addExternalTerminal({
      id: 'term-hit',
      cwd: '/tmp/x',
      workspaceId: other.id,
    })

    expect(added).not.toBeNull()
    expect(added!.workspaceId).toBe(other.id)
    expect(missLogs()).toHaveLength(0)
  })

  it('G4: 完全不帶 workspaceId → 不發 warn，落在 active workspace', () => {
    const { active } = seedWorkspaces()

    const added = workspaceStore.addExternalTerminal({ id: 'term-none', cwd: '/tmp/x' })

    expect(added).not.toBeNull()
    expect(added!.workspaceId).toBe(active.id)
    expect(missLogs()).toHaveLength(0)
  })

  it('G5: 重複 id 仍舊回傳 null 且不發 warn（早退路徑未被影響）', () => {
    seedWorkspaces()
    workspaceStore.addExternalTerminal({ id: 'term-dup', cwd: '/tmp/x' })
    logSpy.mockClear()

    const again = workspaceStore.addExternalTerminal({
      id: 'term-dup',
      cwd: '/tmp/x',
      workspaceId: 'no-such-workspace',
    })

    expect(again).toBeNull()
    expect(missLogs()).toHaveLength(0)
  })
})
