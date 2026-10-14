/**
 * T0491 (BUG-113 known limitation): when a detached workspace window closes, the parent
 * window adopts the terminal list that window persisted (main `workspace:adopt-detached`),
 * so it shows terminals opened there and drops those closed there. Adoption runs in the
 * save queue: a save requested before it still carries the stale list (main keeps the
 * detached list for it), every save requested after it carries the adopted one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replay = vi.hoisted(() => ({ requestPtyReplay: vi.fn() }))
vi.mock('../../lib/pty-replay', () => replay)

import { workspaceStore } from '../workspace-store'
import type { TerminalInstance } from '../../types'

type Persisted = Partial<TerminalInstance>

let adoptResult: { terminals: Persisted[] } | null
let reattachedListener: ((workspaceId: string) => void) | null
const saved: string[][] = []
const adoptDetached = vi.fn(async () => adoptResult)
let releaseSave: (() => void) | null = null

function installApi(opts: { slowSave?: boolean } = {}) {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    workspace: {
      save: vi.fn(async (data: string) => {
        saved.push((JSON.parse(data).terminals as Persisted[]).map(t => t.id!))
        if (opts.slowSave) await new Promise<void>(r => { releaseSave = r })
        return true
      }),
      adoptDetached,
      onReload: () => () => {},
      onReattached: (cb: (workspaceId: string) => void) => {
        reattachedListener = cb
        return () => { reattachedListener = null }
      },
    },
  }
}

function seed() {
  const a = workspaceStore.addWorkspace('a', '/tmp/a')
  const d = workspaceStore.addWorkspace('d', '/tmp/d')
  const a1 = workspaceStore.addTerminal(a.id)
  const d1 = workspaceStore.addTerminal(d.id)
  const d2 = workspaceStore.addTerminal(d.id)
  workspaceStore.appendScrollback(d2.id, 'kept output')
  workspaceStore.setFocusedTerminal(d1.id)
  return { a, d, a1, d1, d2 }
}

const ids = () => workspaceStore.getState().terminals.map(t => t.id)

beforeEach(() => {
  saved.length = 0
  adoptResult = null
  reattachedListener = null
  adoptDetached.mockClear()
  replay.requestPtyReplay.mockClear()
  installApi()
  workspaceStore.getState().workspaces.slice().forEach(w => workspaceStore.removeWorkspace(w.id))
  workspaceStore.getState().terminals.slice().forEach(t => workspaceStore.removeTerminal(t.id))
})

afterEach(() => {
  releaseSave?.()
  releaseSave = null
})

describe('adoptDetachedWorkspaceTerminals (T0491)', () => {
  it('replaces only that workspace\'s terminals, keeps runtime state of known ones, reports the new ids', async () => {
    const { a, d, a1, d1, d2 } = seed()
    adoptResult = { terminals: [
      { id: d2.id, workspaceId: d.id, title: 'renamed in detached', alias: 'x' },
      { id: 'd3', workspaceId: d.id, title: 'opened in detached', agentPreset: 'none' },
      { id: 'stray', workspaceId: a.id, title: 'other workspace' },
    ] }

    const adopted = await workspaceStore.adoptDetachedWorkspaceTerminals(d.id)

    expect(adoptDetached).toHaveBeenCalledWith(d.id)
    expect(adopted).toEqual(['d3'])
    expect(ids()).toEqual([a1.id, d2.id, 'd3'])
    const kept = workspaceStore.getState().terminals.find(t => t.id === d2.id)!
    expect(kept.title).toBe('renamed in detached')
    expect(kept.alias).toBe('x')
    expect(kept.scrollbackBuffer).toEqual(['kept output'])
    expect(workspaceStore.getState().terminals.find(t => t.id === 'd3')).toMatchObject({ workspaceId: d.id, cwd: '/tmp/d' })
    // d1 was closed in the detached window and had the focus. BUG-135 / T0532: the fallback is
    // the active workspace's (d) first terminal, not the first terminal overall (a1).
    expect(ids()).not.toContain(d1.id)
    expect(workspaceStore.getState().focusedTerminalId).toBe(d2.id)
  })

  it('changes nothing while main still sees the workspace detached (null)', async () => {
    const { d } = seed()
    const before = ids()
    adoptResult = null
    expect(await workspaceStore.adoptDetachedWorkspaceTerminals(d.id)).toEqual([])
    expect(ids()).toEqual(before)
  })

  it('runs after a save requested before it and before any save requested after it', async () => {
    installApi({ slowSave: true })
    const { a1, d, d1, d2 } = seed()
    adoptResult = { terminals: [{ id: 'd3', workspaceId: d.id, title: 'opened in detached' }] }

    const earlier = workspaceStore.save()
    const adoption = workspaceStore.adoptDetachedWorkspaceTerminals(d.id)
    await vi.waitFor(() => expect(saved).toHaveLength(1))
    // The earlier save is in flight with the stale list; adoption has not run yet.
    expect(saved[0]).toEqual([a1.id, d1.id, d2.id])
    expect(adoptDetached).not.toHaveBeenCalled()
    releaseSave!()
    await earlier
    await adoption
    expect(adoptDetached).toHaveBeenCalledTimes(1)

    const later = workspaceStore.save()
    await vi.waitFor(() => expect(saved).toHaveLength(2))
    expect(saved[1]).toEqual([a1.id, 'd3'])
    releaseSave!()
    await later
  })

  it("listenForReload adopts on 'workspace:reattached' and replays only PTY terminals new to this window", async () => {
    const { d, d2 } = seed()
    adoptResult = { terminals: [
      { id: d2.id, workspaceId: d.id },
      { id: 'pty-new', workspaceId: d.id, agentPreset: 'none' },
      { id: 'cli-new', workspaceId: d.id, agentPreset: 'claude-cli' },
      { id: 'sdk-new', workspaceId: d.id, agentPreset: 'claude-code' },
    ] }
    const unsubscribe = workspaceStore.listenForReload()
    expect(reattachedListener).not.toBeNull()

    reattachedListener!(d.id)
    await vi.waitFor(() => expect(ids()).toContain('sdk-new'))
    await vi.waitFor(() => expect(replay.requestPtyReplay).toHaveBeenCalledTimes(2))
    expect(replay.requestPtyReplay.mock.calls.map(c => c[0]).sort()).toEqual(['cli-new', 'pty-new'])

    unsubscribe()
    expect(reattachedListener).toBeNull()
  })
})
