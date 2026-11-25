/**
 * T0916 / BUG-220: `acquireDirWatch` asks main for `{ recreate: true }` (so a `_ct-workorders/` created
 * later is still watched); `fs.unwatch` and the per-window count (T0906) are unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireDirWatch, dirWatchUsers, resetDirWatches } from '../ct-dir-watch'

const CT = 'C:/ws/_ct-workorders'

let watch: ReturnType<typeof vi.fn>
let unwatch: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetDirWatches()
  watch = vi.fn(async () => true)
  unwatch = vi.fn(async () => true)
  ;(window as unknown as { electronAPI: unknown }).electronAPI = { fs: { watch, unwatch } }
})

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('acquireDirWatch (T0916)', () => {
  it('watches with { recreate: true }; unwatch keeps its one argument', () => {
    const release = acquireDirWatch(CT)
    expect(watch).toHaveBeenCalledTimes(1)
    expect(watch).toHaveBeenCalledWith(CT, { recreate: true })
    release()
    expect(unwatch).toHaveBeenCalledTimes(1)
    expect(unwatch).toHaveBeenCalledWith(CT)
    expect(unwatch.mock.calls[0]).toHaveLength(1)
  })

  it('still one fs.watch per directory per window', () => {
    const a = acquireDirWatch(CT)
    const b = acquireDirWatch(CT)
    expect(watch).toHaveBeenCalledTimes(1)
    expect(dirWatchUsers(CT)).toBe(2)
    a()
    b()
    expect(unwatch).toHaveBeenCalledTimes(1)
  })

  it('an older bridge (false / rejection) is swallowed', async () => {
    watch.mockImplementation(async () => { throw new Error('No handler') })
    const release = acquireDirWatch(CT)
    await Promise.resolve()
    release()
    expect(unwatch).toHaveBeenCalledTimes(1)
  })
})
