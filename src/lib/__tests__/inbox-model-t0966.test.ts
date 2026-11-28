/**
 * T0966 (U-58: A): `heldWorkerNotifications` — a tab's 📨 for「Worker 等你」is its held Worker
 * notifications only; the user's own inbox answers (`kind: 'answer'`) are left out.
 */
import { describe, expect, it } from 'vitest'
import { heldWorkerNotifications, inboxActionCount, workerWaitItems } from '../inbox-model'

const answer = (heldAt: number) => ({ heldAt, kind: 'answer' as const })
const notice = (heldAt: number) => ({ heldAt })

describe('heldWorkerNotifications', () => {
  it('nothing held → 0, no since', () => {
    expect(heldWorkerNotifications([])).toEqual({ count: 0, since: null })
  })

  it('only answers → 0, no since', () => {
    expect(heldWorkerNotifications([answer(1), answer(2)])).toEqual({ count: 0, since: null })
  })

  it('Worker notifications + answers → the notifications only; since = the oldest notification', () => {
    expect(heldWorkerNotifications([answer(1), notice(7), answer(3), notice(4)])).toEqual({ count: 2, since: 4 })
  })

  it('items without `kind` are Worker notifications (as before T0966)', () => {
    expect(heldWorkerNotifications([notice(5)])).toEqual({ count: 1, since: 5 })
  })

  it('a tab with only answers is not a「Worker 等你」row and adds nothing to the title number', () => {
    const items = workerWaitItems([{ id: 't', title: 'Tower' }], {
      getAttention: () => null,
      getHeld: () => heldWorkerNotifications([answer(1)]),
      getInterrupted: () => null,
    })
    expect(items).toEqual([])
    expect(inboxActionCount({ workerItems: items.length, pendingBugs: 0, awaiting: 1 })).toBe(1)
  })
})
