/**
 * BUG-135 / T0532: the store never hands the focus to — or leaves it on — a terminal outside the
 * active workspace when it has to pick (or drop) a focus by itself.
 *
 * - adoptDetachedWorkspaceTerminals: the focused terminal was closed in the detached window →
 *   the active workspace's first terminal, or null (was: the first terminal overall)
 * - removeWorkspace / archiveWorkspace: the active workspace changes → null, as setActiveWorkspace
 * - addExternalTerminal: a terminal landing in a non-active workspace does not take the focus
 * - reload (workspace:reload with data): the focus survives only on a terminal of the active workspace
 * - source guard: the terminal tab shows an opaque placeholder, not the empty state, while the
 *   default terminals are being created
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/pty-replay', () => ({ requestPtyReplay: vi.fn() }))

import { workspaceStore } from '../workspace-store'
import type { TerminalInstance } from '../../types'

let adoptResult: { terminals: Partial<TerminalInstance>[] } | null = null
let reloadListener: ((data?: string) => void) | null = null

beforeEach(() => {
  adoptResult = null
  reloadListener = null
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    settings: { save: vi.fn(async () => true) },
    workspace: {
      save: vi.fn(async () => true),
      load: vi.fn(async () => null),
      adoptDetached: vi.fn(async () => adoptResult),
      onReload: (cb: (data?: string) => void) => {
        reloadListener = cb
        return () => { reloadListener = null }
      },
      onReattached: () => () => {},
    },
  }
  workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
  workspaceStore.getState().terminals.slice().forEach(t => workspaceStore.removeTerminal(t.id))
})

afterEach(() => {
  workspaceStore.stopAutoSave()
})

const focused = () => workspaceStore.getState().focusedTerminalId

describe('adoptDetachedWorkspaceTerminals focus fallback (BUG-135)', () => {
  it('falls back to the active workspace\'s first terminal, not the first terminal overall', async () => {
    const other = workspaceStore.addWorkspace('other', '/tmp/other')
    const d = workspaceStore.addWorkspace('d', '/tmp/d')
    workspaceStore.addTerminal(other.id) // first overall — the old fallback picked it
    const d1 = workspaceStore.addTerminal(d.id)
    const d2 = workspaceStore.addTerminal(d.id)
    workspaceStore.setActiveWorkspace(d.id)
    workspaceStore.setFocusedTerminal(d1.id)
    // d1 was closed in the detached window
    adoptResult = { terminals: [{ id: d2.id, workspaceId: d.id, title: 'kept' }] }

    await workspaceStore.adoptDetachedWorkspaceTerminals(d.id)

    expect(focused()).toBe(d2.id)
  })

  it('is null when the active workspace has no terminal', async () => {
    const other = workspaceStore.addWorkspace('other', '/tmp/other')
    const d = workspaceStore.addWorkspace('d', '/tmp/d')
    workspaceStore.addTerminal(other.id)
    const d1 = workspaceStore.addTerminal(d.id)
    workspaceStore.setActiveWorkspace(d.id)
    workspaceStore.setFocusedTerminal(d1.id)
    adoptResult = { terminals: [] }

    await workspaceStore.adoptDetachedWorkspaceTerminals(d.id)

    expect(focused()).toBeNull()
  })

  it('keeps a focus that is still there', async () => {
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    const d = workspaceStore.addWorkspace('d', '/tmp/d')
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.addTerminal(d.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)
    adoptResult = { terminals: [{ id: 'd9', workspaceId: d.id, title: 'new' }] }

    await workspaceStore.adoptDetachedWorkspaceTerminals(d.id)

    expect(workspaceStore.getWorkspaceTerminals(d.id).map(t => t.id)).toEqual(['d9'])
    expect(focused()).toBe(a1.id)
  })
})

describe('removeWorkspace / archiveWorkspace focus (BUG-135)', () => {
  it('removing the active workspace clears the focus instead of leaving it on a removed terminal', () => {
    const b = workspaceStore.addWorkspace('b', '/tmp/b')
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    workspaceStore.addTerminal(b.id)
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)

    workspaceStore.removeWorkspace(a.id)

    expect(workspaceStore.getState().activeWorkspaceId).toBe(b.id)
    expect(focused()).toBeNull()
  })

  it('removing another workspace keeps the focus of the active one', () => {
    const b = workspaceStore.addWorkspace('b', '/tmp/b')
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    workspaceStore.addTerminal(b.id)
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)

    workspaceStore.removeWorkspace(b.id)

    expect(focused()).toBe(a1.id)
  })

  it('archiving the active workspace clears the focus instead of leaving it on the archived workspace', () => {
    const b = workspaceStore.addWorkspace('b', '/tmp/b')
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    workspaceStore.addTerminal(b.id)
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)

    workspaceStore.archiveWorkspace(a.id)

    expect(workspaceStore.getState().activeWorkspaceId).toBe(b.id)
    expect(focused()).toBeNull()
  })

  it('archiving another workspace keeps the focus of the active one', () => {
    const b = workspaceStore.addWorkspace('b', '/tmp/b')
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    workspaceStore.addTerminal(b.id)
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)

    workspaceStore.archiveWorkspace(b.id)

    expect(focused()).toBe(a1.id)
  })
})

describe('addExternalTerminal focus (BUG-135)', () => {
  it('a terminal landing in a non-active workspace does not take the focus', () => {
    const tower = workspaceStore.addWorkspace('tower', '/tmp/tower')
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    workspaceStore.addTerminal(tower.id)
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)

    const added = workspaceStore.addExternalTerminal({ id: 'ext-1', cwd: '/tmp/tower', workspaceId: tower.id })

    expect(added?.workspaceId).toBe(tower.id)
    expect(focused()).toBe(a1.id)
  })

  it('a terminal landing in the active workspace takes the focus (unchanged)', () => {
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setFocusedTerminal(a1.id)

    workspaceStore.addExternalTerminal({ id: 'ext-2', cwd: '/tmp/a', workspaceId: a.id })

    expect(focused()).toBe('ext-2')
  })
})

describe('addExternalTerminal focus — helper dispatch (BUG-152 / T0599)', () => {
  it('a helper-dispatched Worker in the active workspace does not take the focus from the tower', () => {
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    const tower = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(tower.id)

    const added = workspaceStore.addExternalTerminal({
      id: 'worker-1', cwd: '/tmp/a', workspaceId: a.id, towerTerminalId: tower.id, workorder: 'T0599', dispatchedByHelper: true,
    })

    expect(added?.workspaceId).toBe(a.id)
    expect(workspaceStore.getWorkspaceTerminals(a.id).map(t => t.id)).toEqual([tower.id, 'worker-1'])
    expect(focused()).toBe(tower.id)
    expect(workspaceStore.getState().activeWorkspaceId).toBe(a.id)
  })

  it('a helper-dispatched Worker in a non-active workspace does not take the focus either', () => {
    const tower = workspaceStore.addWorkspace('tower', '/tmp/tower')
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    workspaceStore.addTerminal(tower.id)
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)

    workspaceStore.addExternalTerminal({ id: 'worker-2', cwd: '/tmp/tower', workspaceId: tower.id, dispatchedByHelper: true })

    expect(focused()).toBe(a1.id)
    expect(workspaceStore.getState().activeWorkspaceId).toBe(a.id)
  })

  it('without the marker (not a helper: e.g. a remote client window) the tab takes the focus as before', () => {
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)

    workspaceStore.addExternalTerminal({ id: 'ext-3', cwd: '/tmp/a', workspaceId: a.id, dispatchedByHelper: false })

    expect(focused()).toBe('ext-3')
  })
})

describe('reload focus (BUG-135)', () => {
  const serialized = (activeWorkspaceId: string, terminals: Partial<TerminalInstance>[]) => JSON.stringify({
    workspaces: workspaceStore.getState().workspaces,
    activeWorkspaceId,
    terminals,
  })

  it('drops a focus that is not a terminal of the reloaded active workspace', () => {
    const b = workspaceStore.addWorkspace('b', '/tmp/b')
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    const b1 = workspaceStore.addTerminal(b.id)
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setActiveWorkspace(a.id)
    workspaceStore.setFocusedTerminal(a1.id)
    const unsubscribe = workspaceStore.listenForReload()

    reloadListener!(serialized(b.id, [
      { id: b1.id, workspaceId: b.id, title: 'b1', cwd: '/tmp/b' },
      { id: a1.id, workspaceId: a.id, title: 'a1', cwd: '/tmp/a' },
    ]))
    unsubscribe()

    expect(focused()).toBeNull()
  })

  it('keeps a focus on a terminal of the reloaded active workspace', () => {
    const a = workspaceStore.addWorkspace('a', '/tmp/a')
    const a1 = workspaceStore.addTerminal(a.id)
    workspaceStore.setFocusedTerminal(a1.id)
    const unsubscribe = workspaceStore.listenForReload()

    reloadListener!(serialized(a.id, [{ id: a1.id, workspaceId: a.id, title: 'a1', cwd: '/tmp/a' }]))
    unsubscribe()

    expect(focused()).toBe(a1.id)
  })
})

describe('default terminals being created do not flash the empty state (T0532 source guard)', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf-8').replace(/\r\n/g, '\n')

  it('the terminal tab shows an opaque placeholder until the default terminals exist', () => {
    const view = read('../../components/WorkspaceView.tsx')
    expect(view).toMatch(/\{terminals\.length === 0 && awaitingDefaultTerminals && \(\s*<div className="terminals-pending-state" data-testid="terminals-pending-state" \/>/)
    expect(view).toMatch(/\{terminals\.length === 0 && !awaitingDefaultTerminals && \(\s*<div className="terminals-empty-state" data-testid="terminals-empty-state">/)
    // covers the first render before the init effect, and the async shell lookup after it
    expect(view).toMatch(/const awaitingDefaultTerminals = isCreatingDefaults \|\| \(isActive && !initializedWorkspaces\.has\(workspace\.id\)\)/)
    // cleared once the init settles, whether it created the terminals or failed
    expect(view).toMatch(/retryOnceWhenRemoteConnected\(initTerminals, window\.electronAPI\.remote\)\.catch\([\s\S]*?\}\)\.finally\(\(\) => \{\s*if \(!createsDefaults\) return\s*creatingDefaultTerminals\.delete\(workspace\.id\)\s*setIsCreatingDefaults\(false\)/)
    const css = read('../../styles/layout.css')
    expect(css).toMatch(/\.terminals-pending-state \{[^}]*position: absolute;[^}]*inset: 0;[^}]*background: var\(--bg-primary\);/)
  })
})
