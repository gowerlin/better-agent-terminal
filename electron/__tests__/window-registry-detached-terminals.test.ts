/**
 * T0491 (BUG-113 known limitation): terminals opened / closed in a detached workspace
 * window used to be lost (its workspace:save was a no-op). Now its save merges only that
 * workspace's terminal list into the parent window's registry entry, and while the
 * workspace is detached the parent's own (30 s auto)save keeps that list as persisted.
 * These cover the merge rule and the parent-save / detached-save race on a real registry
 * file; main.ts wiring is guarded in detached-workspace-persistence.test.ts.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const paths = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => paths.userData } }))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import {
  DetachedTerminalOwners,
  replaceWorkspaceTerminals,
  saveDetachedWorkspaceTerminals,
  saveWindowWorkspaces,
  WindowRegistry,
  workspaceTerminals,
  type WindowEntry,
} from '../window-registry'

const term = (id: string, workspaceId: string) => ({ id, workspaceId, title: id })
const workspaces = [{ id: 'A', folderPath: '/a' }, { id: 'D', folderPath: '/d' }, { id: 'B', folderPath: '/b' }]

describe('replaceWorkspaceTerminals', () => {
  const list = [term('a1', 'A'), term('d1', 'D'), term('d2', 'D'), term('b1', 'B')]

  it('puts the new list where the old one started and keeps every other terminal in place', () => {
    expect(replaceWorkspaceTerminals(list, 'D', [term('d2', 'D'), term('d3', 'D')]).map(t => (t as { id: string }).id))
      .toEqual(['a1', 'd2', 'd3', 'b1'])
  })

  it("ignores other workspaces' terminals in the replacement", () => {
    expect(replaceWorkspaceTerminals(list, 'D', [term('x', 'A'), term('d9', 'D'), term('y', 'B')]))
      .toEqual([term('a1', 'A'), term('d9', 'D'), term('b1', 'B')])
  })

  it('appends when the workspace had no terminal, and removes them all with an empty list', () => {
    expect(replaceWorkspaceTerminals([term('a1', 'A')], 'D', [term('d1', 'D')])).toEqual([term('a1', 'A'), term('d1', 'D')])
    expect(replaceWorkspaceTerminals(list, 'D', [])).toEqual([term('a1', 'A'), term('b1', 'B')])
  })

  it('workspaceTerminals keeps order and skips malformed rows', () => {
    expect(workspaceTerminals([term('d1', 'D'), null, 'x', term('a1', 'A'), term('d2', 'D')], 'D')).toEqual([term('d1', 'D'), term('d2', 'D')])
  })
})

describe('DetachedTerminalOwners', () => {
  it('claims and releases per parent window', () => {
    const owners = new DetachedTerminalOwners()
    owners.claim('w1', 'D')
    owners.claim('w1', 'E')
    owners.claim('w2', 'F')
    expect(owners.owned('w1')).toEqual(['D', 'E'])
    owners.release('w1', 'D')
    expect(owners.owned('w1')).toEqual(['E'])
    owners.releaseUnless('w1', () => false)
    expect(owners.owned('w1')).toEqual([])
    owners.releaseUnless('w2', ws => ws === 'F')
    expect(owners.owned('w2')).toEqual(['F'])
    owners.release('nope', 'F')
    expect(owners.owned('nope')).toEqual([])
  })
})

describe('parent save vs detached save on one registry entry', () => {
  let registry: WindowRegistry
  let owners: DetachedTerminalOwners
  const parentId = 'win-parent'
  // What the parent window's store holds while D is detached: D as it was at detach time.
  const parentPayload = () => ({
    workspaces,
    activeWorkspaceId: 'A',
    activeGroup: null,
    terminals: [term('a1', 'A'), term('d1', 'D'), term('d2', 'D'), term('b1', 'B'), term('b2', 'B')],
    activeTerminalId: 'a1',
    layout: { workspaceTab: 'parent' },
  })
  // The detached window closed d1 and opened d3; its copy of the rest of the entry is stale.
  const detachedPayload = () => ({
    workspaces: [{ id: 'D', folderPath: '/d' }],
    activeWorkspaceId: 'D',
    activeGroup: 'stale',
    terminals: [term('a1', 'A'), term('d2', 'D'), term('d3', 'D')],
    activeTerminalId: 'd3',
    layout: { workspaceTab: 'detached' },
  })
  const saveParent = () => saveWindowWorkspaces(registry, parentId, parentPayload(), () => owners.owned(parentId))
  const saveDetached = () => saveDetachedWorkspaceTerminals(registry, parentId, 'D', detachedPayload())
  const ids = (entry: WindowEntry | null) => (entry?.terminals ?? []).map(t => (t as { id: string }).id)

  beforeEach(async () => {
    paths.userData = mkdtempSync(join(tmpdir(), 'bat-t0491-'))
    registry = new WindowRegistry()
    owners = new DetachedTerminalOwners()
    await registry.saveEntry({
      id: parentId,
      workspaces,
      activeWorkspaceId: 'A',
      activeGroup: null,
      terminals: parentPayload().terminals,
      activeTerminalId: 'a1',
      lastActiveAt: 0,
    })
    await registry.saveEntry({ id: 'win-other', workspaces: [], activeWorkspaceId: null, activeGroup: null, terminals: [term('o1', 'O')], activeTerminalId: null, lastActiveAt: 0 })
    owners.claim(parentId, 'D')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(paths.userData, { recursive: true, force: true })
  })

  /** Every read of windows.json takes a while, so unserialized read-modify-writes overlap. */
  function slowReads() {
    const readAll = registry.readAll.bind(registry)
    vi.spyOn(registry, 'readAll').mockImplementation(async () => {
      const entries = await readAll()
      await new Promise(r => setTimeout(r, 15))
      return entries
    })
  }

  it('the detached save replaces only its workspace terminals; every other field stays the parent\'s', async () => {
    const entry = await saveDetached()
    expect(ids(entry)).toEqual(['a1', 'd2', 'd3', 'b1', 'b2'])
    expect(entry).toMatchObject({ workspaces, activeWorkspaceId: 'A', activeGroup: null, activeTerminalId: 'a1' })
    expect(entry?.layout).toBeUndefined()
    expect(ids(await registry.getEntry('win-other'))).toEqual(['o1'])
  })

  it("a later parent autosave (stale copy of D) does not undo the detached window's terminals", async () => {
    await saveDetached()
    const entry = await saveParent()
    expect(ids(entry)).toEqual(['a1', 'd2', 'd3', 'b1', 'b2'])
    expect(entry?.layout).toEqual({ workspaceTab: 'parent' })
    expect(ids(await registry.getEntry(parentId))).toEqual(['a1', 'd2', 'd3', 'b1', 'b2'])
  })

  it.each([
    ['parent first', () => [saveParent(), saveDetached()]],
    ['detached first', () => [saveDetached(), saveParent()]],
  ])('concurrent saves (%s) with slow disk reads: neither overwrites the other', async (_order, start) => {
    slowReads()
    await Promise.all(start())
    const entry = await registry.getEntry(parentId)
    expect(ids(entry)).toEqual(['a1', 'd2', 'd3', 'b1', 'b2'])
    expect(entry?.layout).toEqual({ workspaceTab: 'parent' })
  })

  it('control: an unserialized getEntry → saveEntry of the same overlap loses the detached update', async () => {
    slowReads()
    const naiveParentSave = async () => {
      const entry = (await registry.getEntry(parentId))!
      entry.terminals = parentPayload().terminals
      await registry.saveEntry(entry)
    }
    await Promise.all([naiveParentSave(), saveDetached()])
    // The parent's stale D (d1, d2) is back: this is the overwrite the queue prevents.
    expect(ids(await registry.getEntry(parentId))).toEqual(['a1', 'd1', 'd2', 'b1', 'b2'])
  })

  it('once released (adopted), the parent writes D again — including its own removals', async () => {
    await saveDetached()
    const adopted = await registry.withEntry(parentId, (entry) => {
      owners.release(parentId, 'D')
      return workspaceTerminals(entry!.terminals, 'D')
    })
    expect(adopted).toEqual([term('d2', 'D'), term('d3', 'D')])
    const entry = await saveWindowWorkspaces(registry, parentId, { ...parentPayload(), terminals: [term('a1', 'A'), term('d3', 'D'), term('b1', 'B')] }, () => owners.owned(parentId))
    expect(ids(entry)).toEqual(['a1', 'd3', 'b1'])
  })

  it('whenIdle waits for every queued write (main sends workspace:reattached after it)', async () => {
    slowReads()
    const pending = saveDetached()
    await registry.whenIdle()
    expect(ids(await registry.getEntry(parentId))).toEqual(['a1', 'd2', 'd3', 'b1', 'b2'])
    await pending
  })

  it('a detached save whose parent entry is gone writes nothing', async () => {
    await registry.removeEntry(parentId)
    expect(await saveDetached()).toBeNull()
    expect(await registry.getEntry(parentId)).toBeNull()
    expect(ids(await registry.getEntry('win-other'))).toEqual(['o1'])
  })

  it('survives a restart: a fresh registry reads the merged list from disk', async () => {
    await saveDetached()
    await saveParent()
    expect(ids(await new WindowRegistry().getEntry(parentId))).toEqual(['a1', 'd2', 'd3', 'b1', 'b2'])
  })
})
