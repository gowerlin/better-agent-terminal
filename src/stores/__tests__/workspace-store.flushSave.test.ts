/**
 * T0504: main waits for a renderer's flush-save ack (quit, and a detached window's close)
 * and the renderer acks once `workspaceStore.save()` resolved. When a save was already
 * queued, save() used to return at once (undefined), so the ack could go out before the
 * queued save — the one carrying the latest rename — was even sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/pty-replay', () => ({ requestPtyReplay: vi.fn() }))

import { workspaceStore } from '../workspace-store'

const sent: { title?: string }[][] = []
const gates: (() => void)[] = []

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    workspace: {
      save: vi.fn(async (data: string) => {
        sent.push(JSON.parse(data).terminals)
        await new Promise<void>(r => gates.push(r))
        return true
      }),
      onReload: () => () => {},
      onReattached: () => () => {},
    },
  }
})

afterEach(() => {
  while (gates.length) gates.shift()!()
  sent.length = 0
})

const flushMicrotasks = () => new Promise(r => setTimeout(r, 0))

describe('workspaceStore.save() while a save is queued (T0504)', () => {
  it('returns the queued save, so a flush resolves only after the latest state was sent', async () => {
    const ws = workspaceStore.addWorkspace('flush', '/tmp/flush')
    const term = workspaceStore.addTerminal(ws.id)
    void workspaceStore.save() // save #1 (in flight)
    await flushMicrotasks()
    void workspaceStore.save() // save #2 queued behind it
    expect(sent).toHaveLength(1)

    workspaceStore.renameTerminal(term.id, 'renamed before close') // no save of its own
    let flushed = false
    const flush = workspaceStore.save() // what onFlushSave awaits
    expect(flush).toBeInstanceOf(Promise)
    void flush.then(() => { flushed = true })

    gates.shift()!() // save #1 done → the queued save is sent with the rename
    await flushMicrotasks()
    expect(sent).toHaveLength(2)
    expect(sent[1].find(t => (t as { id?: string }).id === term.id)?.title).toBe('renamed before close')
    expect(flushed).toBe(false)

    gates.shift()!()
    await flushMicrotasks()
    expect(flushed).toBe(true)
    expect(sent).toHaveLength(2) // still one queued save, not one per call
  })
})
