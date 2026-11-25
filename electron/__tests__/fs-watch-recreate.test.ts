// @vitest-environment node
/**
 * T0916 / BUG-220: `fs:watch(dir, { recreate: true })` (electron/handlers/fs.ts `FsWatchOptions`).
 *
 * - a directory that does not exist yet: `true`, and one `fs:changed` once it appears (event-driven)
 * - without the option a missing directory still answers `false` (unchanged)
 * - an existing directory emits the same `fs:changed` events with or without the option
 * - deleted → one `fs:changed`, then waiting again; created again → `fs:changed` and watched again
 * - `fs:unwatch` stops a waiting watch (nothing after it); `fs:reset-watch` keeps `recreate`
 * - the ancestor it waits on must pass the path guard
 * - headless (wire level): the option reaches the bat-server's handler
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { registerFsHandlers, type FsHandlerDeps } from '../handlers/fs'
import type { HandlerContext, HandlerModuleDisposer, SharedHandler } from '../handlers/types'
import { createPathAllowlist } from '../path-guard'
import { startHeadlessHarness, type HeadlessHarness } from '../remote/__tests__/helpers/headless-harness'

const local: HandlerContext = { windowId: 'w1' }
const RECREATE = { recreate: true }

let root: string
let caseNo = 0
const disposers: HandlerModuleDisposer[] = []

function mount(deps: FsHandlerDeps) {
  const handlers = new Map<string, SharedHandler>()
  disposers.push(registerFsHandlers((channel, handler) => { handlers.set(channel, handler) }, deps))
  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`not registered: ${channel}`)
    return Promise.resolve(handler(local, ...args))
  }
  return call
}

/** A fresh workspace folder (allowed by the guard) and its not-yet-created `_ct-workorders`. */
function workspace(): { ws: string; ct: string; emitted: string[]; call: ReturnType<typeof mount> } {
  const ws = path.join(root, `ws${++caseNo}`)
  fs.mkdirSync(ws)
  const guard = createPathAllowlist()
  guard.rebuild([ws])
  const emitted: string[] = []
  const call = mount({
    emit: (channel, ...args) => { if (channel === 'fs:changed') emitted.push(String(args[0])) },
    pathGuard: guard,
  })
  return { ws, ct: path.join(ws, '_ct-workorders'), emitted, call }
}

const changesFor = (emitted: string[], dir: string) => emitted.filter(p => p === dir).length
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
/** Longer than the 500 ms debounce plus the 100 ms checks. */
const SETTLE_MS = 1_200

beforeAll(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0916-')))
})

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 })
})

describe('fs:watch { recreate: true } (T0916)', () => {
  it('a missing directory: true, then fs:changed once it is created, and its files are watched', async () => {
    const { ct, emitted, call } = workspace()
    expect(await call('fs:watch', ct, RECREATE)).toBe(true)
    await sleep(300)
    expect(changesFor(emitted, ct)).toBe(0)
    fs.mkdirSync(ct)
    fs.writeFileSync(path.join(ct, '_tower-state.md'), 'bat_contract: 2\n')
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThanOrEqual(1)
    // the recursive watcher took over: a later write is reported too
    await sleep(SETTLE_MS)
    const before = changesFor(emitted, ct)
    fs.writeFileSync(path.join(ct, 'T0001-a.md'), 'status: TODO\n')
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThan(before)
    expect(await call('fs:unwatch', ct)).toBe(true)
  })

  it('without the option a missing directory still answers false and is not watched', async () => {
    const { ct, emitted, call } = workspace()
    expect(await call('fs:watch', ct)).toBe(false)
    fs.mkdirSync(ct)
    fs.writeFileSync(path.join(ct, 'x.md'), 'x')
    await sleep(SETTLE_MS)
    expect(changesFor(emitted, ct)).toBe(0)
  })

  it('a missing level in between: waits on the nearest existing ancestor, follows it down', async () => {
    const { ws, emitted, call } = workspace()
    const deep = path.join(ws, 'a', 'b')
    expect(await call('fs:watch', deep, RECREATE)).toBe(true)
    fs.mkdirSync(path.join(ws, 'a'))
    await sleep(400)
    fs.mkdirSync(deep)
    await expect.poll(() => changesFor(emitted, deep), { timeout: 5_000, interval: 50 }).toBeGreaterThanOrEqual(1)
    expect(await call('fs:unwatch', deep)).toBe(true)
  })

  it('an existing directory: the same fs:changed events with and without the option', async () => {
    const plain = workspace()
    const withOpt = workspace()
    for (const w of [plain, withOpt]) fs.mkdirSync(w.ct)
    expect(await plain.call('fs:watch', plain.ct)).toBe(true)
    expect(await withOpt.call('fs:watch', withOpt.ct, RECREATE)).toBe(true)
    for (const w of [plain, withOpt]) {
      fs.writeFileSync(path.join(w.ct, 'a.md'), '1')
      fs.writeFileSync(path.join(w.ct, 'b.md'), '2')
    }
    await sleep(SETTLE_MS)
    expect(changesFor(plain.emitted, plain.ct)).toBe(1)
    expect(changesFor(withOpt.emitted, withOpt.ct)).toBe(1)
    for (const w of [plain, withOpt]) fs.writeFileSync(path.join(w.ct, 'a.md'), '3')
    await sleep(SETTLE_MS)
    expect(changesFor(plain.emitted, plain.ct)).toBe(2)
    expect(changesFor(withOpt.emitted, withOpt.ct)).toBe(2)
  })

  it('deleted → fs:changed and waiting; created again → fs:changed and watched again', async () => {
    const { ct, emitted, call } = workspace()
    fs.mkdirSync(ct)
    fs.writeFileSync(path.join(ct, 'old.md'), 'x')
    expect(await call('fs:watch', ct, RECREATE)).toBe(true)
    fs.rmSync(ct, { recursive: true, force: true })
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThanOrEqual(1)
    await sleep(SETTLE_MS)
    const afterDelete = changesFor(emitted, ct)
    fs.mkdirSync(ct)
    fs.writeFileSync(path.join(ct, '_tower-state.md'), 'bat_contract: 2\n')
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThan(afterDelete)
    await sleep(SETTLE_MS)
    const afterCreate = changesFor(emitted, ct)
    fs.writeFileSync(path.join(ct, 'T0002-b.md'), 'status: TODO\n')
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThan(afterCreate)
    expect(await call('fs:unwatch', ct)).toBe(true)
  })

  it('fs:unwatch stops a waiting watch: nothing is emitted after it', async () => {
    const { ct, emitted, call } = workspace()
    expect(await call('fs:watch', ct, RECREATE)).toBe(true)
    expect(await call('fs:unwatch', ct)).toBe(true)
    fs.mkdirSync(ct)
    fs.writeFileSync(path.join(ct, 'x.md'), 'x')
    await sleep(SETTLE_MS)
    expect(emitted).toEqual([])
  })

  it('fs:unwatch after a delete stops the waiting watch too (no leftover watcher)', async () => {
    const { ct, emitted, call } = workspace()
    fs.mkdirSync(ct)
    expect(await call('fs:watch', ct, RECREATE)).toBe(true)
    fs.rmSync(ct, { recursive: true, force: true })
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThanOrEqual(1)
    expect(await call('fs:unwatch', ct)).toBe(true)
    await sleep(SETTLE_MS)
    const count = emitted.length
    fs.mkdirSync(ct)
    fs.writeFileSync(path.join(ct, 'x.md'), 'x')
    await sleep(SETTLE_MS)
    expect(emitted.length).toBe(count)
  })

  it('fs:reset-watch (↻) keeps a waiting watch waiting', async () => {
    const { ct, emitted, call } = workspace()
    expect(await call('fs:watch', ct, RECREATE)).toBe(true)
    expect(await call('fs:reset-watch', ct)).toBe(true)
    fs.mkdirSync(ct)
    fs.writeFileSync(path.join(ct, 'x.md'), 'x')
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThanOrEqual(1)
    expect(await call('fs:unwatch', ct)).toBe(true)
  })

  it('fs:reset-watch of a plain watch on a missing directory stays false (unchanged)', async () => {
    const { ct, call } = workspace()
    expect(await call('fs:reset-watch', ct)).toBe(false)
  })

  it('the ancestor it would wait on must pass the path guard', async () => {
    const ws = path.join(root, `ws${++caseNo}`)
    fs.mkdirSync(ws)
    const ct = path.join(ws, '_ct-workorders')
    const guard = createPathAllowlist()
    guard.rebuild([ct]) // only the (missing) directory itself is allowed, not the workspace folder
    const call = mount({ emit: () => {}, pathGuard: guard })
    expect(await call('fs:watch', ct, RECREATE)).toBe(false)
  })

  it('a plain watch joined later by a recreate watch becomes recreate', async () => {
    const { ct, emitted, call } = workspace()
    fs.mkdirSync(ct)
    expect(await call('fs:watch', ct)).toBe(true)
    expect(await call('fs:watch', ct, RECREATE)).toBe(true)
    fs.rmSync(ct, { recursive: true, force: true })
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThanOrEqual(1)
    await sleep(SETTLE_MS)
    const afterDelete = changesFor(emitted, ct)
    fs.mkdirSync(ct)
    await expect.poll(() => changesFor(emitted, ct), { timeout: 5_000, interval: 50 }).toBeGreaterThan(afterDelete)
    expect(await call('fs:unwatch', ct)).toBe(true)
  })
})

describe('headless bat-server (wire level)', () => {
  let harness: HeadlessHarness
  let ws: string

  beforeAll(async () => {
    ws = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0916-hl-')))
    harness = await startHeadlessHarness({ timeoutMs: 15_000 })
    await harness.invoke('workspace:sync-roots', [ws])
  }, 60_000)

  afterAll(async () => {
    await harness?.dispose()
    if (ws) fs.rmSync(ws, { recursive: true, force: true, maxRetries: 3 })
  })

  it('the { recreate: true } argument reaches the handler: a later _ct-workorders/ is reported', async () => {
    const ct = path.join(ws, '_ct-workorders')
    expect(await harness.invoke('fs:watch', ct)).toBe(false) // without the option: as before
    expect(await harness.invoke('fs:watch', ct, RECREATE)).toBe(true)
    try {
      fs.mkdirSync(ct)
      fs.writeFileSync(path.join(ct, '_tower-state.md'), 'bat_contract: 2\n')
      const args = await harness.waitForEvent('fs:changed', a => a[0] === ct, 10_000)
      expect(args).toEqual([ct])
    } finally {
      expect(await harness.invoke('fs:unwatch', ct)).toBe(true)
    }
  })
})
