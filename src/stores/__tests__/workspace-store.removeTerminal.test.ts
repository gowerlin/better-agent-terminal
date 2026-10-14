/**
 * BUG-134 / T0531: closing a workspace's terminals never hands focus to — or shows — another
 * workspace's terminal.
 *
 * - store: removing the focused terminal falls back to a terminal of the same workspace, or null
 * - source guard: a hidden workspace's active tab panel stays hidden (CSS), and the terminal tab
 *   renders an opaque empty state when the workspace has no terminals
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/pty-replay', () => ({ requestPtyReplay: vi.fn() }))

import { workspaceStore } from '../workspace-store'

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    settings: { save: vi.fn(async () => true) },
    workspace: {
      save: vi.fn(async () => true),
      load: vi.fn(async () => null),
      onReload: () => () => {},
      onReattached: () => () => {},
    },
  }
})

afterEach(() => {
  workspaceStore.stopAutoSave()
})

describe('removeTerminal focus fallback (BUG-134)', () => {
  it('closing the last terminal of a workspace leaves no focus, not another workspace\'s terminal', () => {
    const b = workspaceStore.addWorkspace('b', '/tmp/b')
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    // B's terminal comes first in the global list — the old fallback picked it.
    const termB = workspaceStore.addTerminal(b.id)
    const termA = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(termA.id)

    workspaceStore.removeTerminal(termA.id)

    expect(workspaceStore.getState().focusedTerminalId).toBeNull()
    expect(workspaceStore.getWorkspaceTerminals(a.id)).toEqual([])
    expect(workspaceStore.getWorkspaceTerminals(b.id).map(t => t.id)).toEqual([termB.id])
  })

  it('falls back to another terminal of the same workspace', () => {
    const other = workspaceStore.addWorkspace('other', '/tmp/other')
    const ws = workspaceStore.addWorkspace('same', '/tmp/same')
    workspaceStore.addTerminal(other.id)
    const first = workspaceStore.addTerminal(ws.id)
    const second = workspaceStore.addTerminal(ws.id)
    workspaceStore.setActiveWorkspace(ws.id)
    workspaceStore.setFocusedTerminal(first.id)

    workspaceStore.removeTerminal(first.id)

    expect(workspaceStore.getState().focusedTerminalId).toBe(second.id)
  })

  it('keeps the focus when a terminal other than the focused one is removed', () => {
    const ws = workspaceStore.addWorkspace('keep', '/tmp/keep')
    const kept = workspaceStore.addTerminal(ws.id)
    const gone = workspaceStore.addTerminal(ws.id)
    workspaceStore.setActiveWorkspace(ws.id)
    workspaceStore.setFocusedTerminal(kept.id)

    workspaceStore.removeTerminal(gone.id)

    expect(workspaceStore.getState().focusedTerminalId).toBe(kept.id)
  })
})

describe('empty workspace does not show another workspace (BUG-134 source guard)', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf-8').replace(/\r\n/g, '\n')

  it('a hidden workspace keeps its active tab panel hidden', () => {
    const css = read('../../styles/layout.css')
    // `.workspace-tab-panel.active { visibility: visible }` would otherwise override the
    // visibility a hidden workspace passes down.
    expect(css).toMatch(/\.workspace-container\.hidden \.workspace-tab-panel\.active \{\n\s*visibility: hidden;\n\s*pointer-events: none;\n\}/)
  })

  it('the terminal tab renders an opaque empty state when the workspace has no terminals', () => {
    const view = read('../../components/WorkspaceView.tsx')
    // T0532: `!awaitingDefaultTerminals` holds it back only while the default terminals are created
    expect(view).toMatch(/\{terminals\.length === 0 && !awaitingDefaultTerminals && \(\s*<div className="terminals-empty-state" data-testid="terminals-empty-state">/)
    const css = read('../../styles/layout.css')
    expect(css).toMatch(/\.terminals-empty-state \{[^}]*position: absolute;[^}]*inset: 0;[^}]*background: var\(--bg-primary\);/)
  })
})
