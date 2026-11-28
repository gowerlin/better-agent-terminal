/**
 * T0980: `useInboxFileRefs` re-checks its references when `<folder>/_ct-workorders` gets `fs:changed`
 * — a referenced file created after the list was shown becomes a link, a moved / deleted one stops
 * being one. Events are merged (`INBOX_FILE_REF_RECHECK_DEBOUNCE_MS`); no event = no re-check (no
 * polling); the watch is joined through `acquireDirWatch` and released on unmount.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { INBOX_FILE_REF_RECHECK_DEBOUNCE_MS, itemFileRefs, useInboxFileRefs } from '../inbox/useInboxFileRefs'
import { acquireDirWatch, dirWatchUsers, resetDirWatches } from '../../stores/ct-dir-watch'
import { fileRefKey, type FileRef } from '../../lib/inbox-file-refs'

const WS_DIR = '/ws/t0980'
const CT = `${WS_DIR}/_ct-workorders`

type Entry = { name: string; path: string; isDirectory: boolean }

let listings: Record<string, Entry[]>
let existing: Set<string>
let listeners: Array<(path: string) => void>
let fsApi: {
  readdir: ReturnType<typeof vi.fn>
  stat: ReturnType<typeof vi.fn>
  watch: ReturnType<typeof vi.fn>
  unwatch: ReturnType<typeof vi.fn>
  onChanged: ReturnType<typeof vi.fn>
}

const file = (dir: string, name: string): Entry => ({ name, path: `${dir}/${name}`, isDirectory: false })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  listings = { [CT]: [] }
  existing = new Set()
  listeners = []
  fsApi = {
    readdir: vi.fn(async (dir: string) => listings[dir] ?? []),
    stat: vi.fn(async (path: string) => (existing.has(path) ? { mtimeMs: 1, size: 1 } : null)),
    watch: vi.fn(async () => true),
    unwatch: vi.fn(async () => true),
    onChanged: vi.fn((cb: (path: string) => void) => {
      listeners.push(cb)
      return () => { listeners = listeners.filter(l => l !== cb) }
    }),
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = { fs: fsApi }
})

afterEach(() => {
  vi.useRealTimers()
  resetDirWatches()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

/** Lets the pending `fs:*` promises and the resulting state update run. */
async function flush() {
  for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
}

async function emit(path: string) {
  await act(async () => { for (const l of [...listeners]) l(path) })
}

async function pastDebounce() {
  await act(async () => { vi.advanceTimersByTime(INBOX_FILE_REF_RECHECK_DEBOUNCE_MS) })
  await flush()
}

const REFS: FileRef[] = itemFileRefs(['T0901'], ['see docs/notes.md'])
const ORDER_KEY = fileRefKey(REFS[0])
const DOC_KEY = fileRefKey(REFS[1])
const checks = () => fsApi.readdir.mock.calls.length + fsApi.stat.mock.calls.length

function mount() {
  return renderHook(({ refs }) => useInboxFileRefs(WS_DIR, refs), { initialProps: { refs: REFS } })
}

describe('T0980: re-check on _ct-workorders/ fs:changed', () => {
  it('① a work order created later becomes a link after the change', async () => {
    const { result } = mount()
    await flush()
    expect(result.current.has(ORDER_KEY)).toBe(false)
    listings[CT] = [file(CT, 'T0901-new-order.md')]
    await emit(CT)
    expect(result.current.has(ORDER_KEY)).toBe(false) // not before the debounce
    await pastDebounce()
    expect(result.current.get(ORDER_KEY)?.rel).toBe('_ct-workorders/T0901-new-order.md')
  })

  it('② a moved / deleted file stops being a link after the change', async () => {
    listings[CT] = [file(CT, 'T0901-new-order.md')]
    existing.add(`${WS_DIR}/docs/notes.md`)
    const { result } = mount()
    await flush()
    expect(result.current.has(ORDER_KEY)).toBe(true)
    expect(result.current.has(DOC_KEY)).toBe(true)
    listings[CT] = [] // archived to a folder the work-order lookup does not list in this fixture
    existing.clear()
    await emit(CT)
    await pastDebounce()
    expect(result.current.has(ORDER_KEY)).toBe(false)
    expect(result.current.has(DOC_KEY)).toBe(false)
  })

  it('③ a burst of events is one re-check; other directories are ignored', async () => {
    mount()
    await flush()
    const before = checks()
    const perCheck = before // the first check is one full check
    for (let i = 0; i < 5; i++) {
      await emit(CT)
      await act(async () => { vi.advanceTimersByTime(INBOX_FILE_REF_RECHECK_DEBOUNCE_MS - 1) })
    }
    await emit(`${WS_DIR}/_bmad-output`)
    await emit(`${WS_DIR}/.git`)
    expect(checks()).toBe(before)
    await pastDebounce()
    expect(checks()).toBe(before + perCheck)
  })

  it('④ no event → no re-check (no polling)', async () => {
    mount()
    await flush()
    const before = checks()
    await act(async () => { vi.advanceTimersByTime(60_000) })
    await flush()
    expect(checks()).toBe(before)
  })

  it('⑤ unmount: no re-check afterwards, the watch is released (shared count)', async () => {
    const other = acquireDirWatch(CT) // e.g. InboxDataSource of the same window
    const { unmount } = mount()
    await flush()
    expect(fsApi.watch).toHaveBeenCalledTimes(1)
    expect(fsApi.watch).toHaveBeenCalledWith(CT, { recreate: true })
    expect(dirWatchUsers(CT)).toBe(2)
    await emit(CT)
    unmount() // with a re-check pending
    expect(dirWatchUsers(CT)).toBe(1)
    expect(fsApi.unwatch).not.toHaveBeenCalled()
    expect(listeners).toHaveLength(0)
    const before = checks()
    await pastDebounce()
    expect(checks()).toBe(before)
    other()
    expect(dirWatchUsers(CT)).toBe(0)
    expect(fsApi.unwatch).toHaveBeenCalledTimes(1)
  })

  it('no references → no watch joined', async () => {
    renderHook(() => useInboxFileRefs(WS_DIR, []))
    await flush()
    expect(dirWatchUsers(CT)).toBe(0)
    expect(fsApi.onChanged).not.toHaveBeenCalled()
  })
})
