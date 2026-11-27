/** T0942: the Inbox「已送出」records (memory only) and the `HH:MM` they show. */
import { afterEach, describe, expect, it } from 'vitest'
import {
  batchSentKey,
  getInboxSentMap,
  pruneInboxSent,
  recordInboxSent,
  resetInboxSentStore,
} from '../inbox-sent-store'
import { formatSentClock } from '../../lib/tower-inbox'

afterEach(() => resetInboxSentStore())

describe('inbox-sent-store', () => {
  it('keeps records per folder; a new record replaces the key and gives a new map', () => {
    recordInboxSent('/a', 'U-1', { text: 'U-1：A', at: 1, status: 'sent', ids: ['U-1'] })
    const first = getInboxSentMap('/a')
    recordInboxSent('/a', 'U-1', { text: 'U-1：B', at: 2, status: 'held', ids: ['U-1'] })
    expect(getInboxSentMap('/a')).not.toBe(first)
    expect(getInboxSentMap('/a').get('U-1')).toMatchObject({ text: 'U-1：B', status: 'held' })
    expect(getInboxSentMap('/b').size).toBe(0)
    expect(getInboxSentMap(null).size).toBe(0)
  })

  it('prunes records whose ids are all gone; a batch record lives while any id is listed', () => {
    recordInboxSent('/a', 'U-1', { text: 'x', at: 1, status: 'sent', ids: ['U-1'] })
    recordInboxSent('/a', batchSentKey('awaiting'), { text: 'U-1、U-3：放棄', at: 1, status: 'sent', ids: ['U-1', 'U-3'] })
    recordInboxSent('/b', 'U-1', { text: 'y', at: 1, status: 'sent', ids: ['U-1'] })
    const before = getInboxSentMap('/a')
    pruneInboxSent('/a', new Set(['U-1', 'U-3']))
    expect(getInboxSentMap('/a')).toBe(before) // nothing gone → same map
    pruneInboxSent('/a', new Set(['U-3']))
    expect([...getInboxSentMap('/a').keys()]).toEqual([batchSentKey('awaiting')])
    pruneInboxSent('/a', new Set())
    expect(getInboxSentMap('/a').size).toBe(0)
    // another folder is untouched
    expect(getInboxSentMap('/b').has('U-1')).toBe(true)
  })

  it('batch keys never look like a CT id', () => {
    expect(batchSentKey('awaiting')).not.toMatch(/^[UA]-\d+$/)
    expect(batchSentKey('action')).not.toBe(batchSentKey('awaiting'))
  })
})

describe('formatSentClock', () => {
  it('is the local HH:MM, zero padded', () => {
    expect(formatSentClock(new Date(2026, 10, 27, 9, 5, 59).getTime())).toBe('09:05')
    expect(formatSentClock(new Date(2026, 10, 27, 23, 41).getTime())).toBe('23:41')
  })
})
