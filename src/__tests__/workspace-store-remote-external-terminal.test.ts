/**
 * T0431 (PLAN-036 P3 / K): `terminal:created-externally` from a server (RemoteClient
 * stamps `remote: true`) lands only in the window holding its workspace. A miss is
 * ignored — never the BUG-031 / T0137 active-workspace fallback, which stays for the
 * local host (two BATs on one headless both get the event).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceStore } from '../stores/workspace-store'

const logSpy = vi.fn()

beforeEach(() => {
  logSpy.mockClear()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: logSpy },
  }
  const state = workspaceStore.getState()
  state.terminals.slice().forEach(t => workspaceStore.removeTerminal(t.id))
  state.workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
})

function seedWorkspaces() {
  const other = workspaceStore.addWorkspace('other', '/tmp/other')
  const active = workspaceStore.addWorkspace('active', '/tmp/active')
  return { other, active }
}

describe('addExternalTerminal — remote origin (T0431)', () => {
  it('remote + known workspace → lands in that workspace', () => {
    const { other } = seedWorkspaces()
    const added = workspaceStore.addExternalTerminal({ id: 'r-hit', cwd: 'C:/work/repo', workspaceId: other.id, remote: true })
    expect(added?.workspaceId).toBe(other.id)
  })

  it('remote + unknown workspace → ignored, no fallback to the active workspace', () => {
    seedWorkspaces()
    const added = workspaceStore.addExternalTerminal({ id: 'r-miss', cwd: '/x', workspaceId: 'other-bat-ws', remote: true })
    expect(added).toBeNull()
    expect(workspaceStore.getState().terminals.some(t => t.id === 'r-miss')).toBe(false)
    expect(logSpy.mock.calls.map(c => String(c[0]))).toEqual([
      '[T0431] Remote external terminal ignored: workspace other-bat-ws not in this window, terminal=r-miss',
    ])
  })

  it('remote without workspaceId → ignored', () => {
    seedWorkspaces()
    expect(workspaceStore.addExternalTerminal({ id: 'r-none', cwd: '/x', remote: true })).toBeNull()
  })

  it('local (no remote flag) + unknown workspace → still falls back to the active workspace', () => {
    const { active } = seedWorkspaces()
    const added = workspaceStore.addExternalTerminal({ id: 'l-miss', cwd: '/x', workspaceId: 'nope' })
    expect(added?.workspaceId).toBe(active.id)
  })
})
