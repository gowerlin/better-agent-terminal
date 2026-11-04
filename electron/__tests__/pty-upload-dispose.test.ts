// @vitest-environment node
/**
 * PLAN-038 U4 (T0835, T0832 契約 C-8 ②): a terminal tab's staged uploads (session key = its
 * PTY id) are removed when the PTY really ends — not on a ⏻ restart (`onPtyExit` fires for the
 * restart's kill too, then the same id runs again). `createPtyUploadDisposer`
 * (electron/remote/headless-entry.ts) is shared by Electron main and headless; the real-server
 * path is in electron/remote/__tests__/headless-upload-e2e.test.ts.
 */
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPtyUploadDisposer, PTY_UPLOAD_DISPOSE_GRACE_MS } from '../remote/headless-entry'
import { UploadStaging } from '../upload-staging'

const quietLog = { log: () => {}, warn: () => {} }

function fakeStaging() {
  const disposeSession = vi.fn(async (_key: unknown) => ({ removed: true }))
  return { staging: { disposeSession } as unknown as UploadStaging, disposeSession }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createPtyUploadDisposer', () => {
  it('grace is 10 s', () => {
    expect(PTY_UPLOAD_DISPOSE_GRACE_MS).toBe(10_000)
  })

  it('PTY gone: its session removed after the grace, once even if exit is reported twice', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { staging, disposeSession } = fakeStaging()
    const d = createPtyUploadDisposer({ getStaging: () => staging, isPtyAlive: () => false })
    d.onPtyExit('pty-1')
    d.onPtyExit('pty-1') // kill, then its process exit
    vi.advanceTimersByTime(PTY_UPLOAD_DISPOSE_GRACE_MS - 1)
    expect(disposeSession).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(disposeSession).toHaveBeenCalledTimes(1)
    expect(disposeSession).toHaveBeenCalledWith('pty-1')
  })

  it('⏻ restart (same id alive again at the end of the grace): kept; a later real exit removes it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { staging, disposeSession } = fakeStaging()
    let alive = true
    const d = createPtyUploadDisposer({ getStaging: () => staging, isPtyAlive: () => alive })
    d.onPtyExit('pty-2') // the restart's kill
    vi.advanceTimersByTime(PTY_UPLOAD_DISPOSE_GRACE_MS)
    expect(disposeSession).not.toHaveBeenCalled()
    alive = false
    d.onPtyExit('pty-2') // the restarted PTY is closed
    vi.advanceTimersByTime(PTY_UPLOAD_DISPOSE_GRACE_MS)
    expect(disposeSession).toHaveBeenCalledTimes(1)
  })

  it('no staging yet, a throwing isPtyAlive or a rejecting dispose: nothing thrown', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const none = createPtyUploadDisposer({ getStaging: () => null, isPtyAlive: () => false })
    none.onPtyExit('a')
    expect(() => vi.advanceTimersByTime(PTY_UPLOAD_DISPOSE_GRACE_MS)).not.toThrow()
    const throwing = createPtyUploadDisposer({ getStaging: () => null, isPtyAlive: () => { throw new Error('boom') } })
    throwing.onPtyExit('b')
    expect(() => vi.advanceTimersByTime(PTY_UPLOAD_DISPOSE_GRACE_MS)).not.toThrow()
    const rejecting = createPtyUploadDisposer({
      getStaging: () => ({ disposeSession: () => Promise.reject(new Error('io')) }) as unknown as UploadStaging,
      isPtyAlive: () => false,
    })
    rejecting.onPtyExit('c')
    expect(() => vi.advanceTimersByTime(PTY_UPLOAD_DISPOSE_GRACE_MS)).not.toThrow()
    await Promise.resolve()
  })

  it('stop() cancels the pending removals; invalid ids are ignored', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { staging, disposeSession } = fakeStaging()
    const d = createPtyUploadDisposer({ getStaging: () => staging, isPtyAlive: () => false })
    d.onPtyExit('x')
    d.onPtyExit('')
    d.onPtyExit(undefined as unknown as string)
    d.stop()
    vi.advanceTimersByTime(PTY_UPLOAD_DISPOSE_GRACE_MS * 2)
    expect(disposeSession).not.toHaveBeenCalled()
  })

  it('with a real UploadStaging: the PTY session directory is removed, other sessions stay', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0835-staging-'))
    try {
      const staging = new UploadStaging({ getDataDir: () => dataDir, freeBytes: async () => null, log: quietLog })
      const stage = async (key: string) => {
        const data = Buffer.from(`data of ${key}`)
        const begin = await staging.begin(key, 'a.txt', data.length) as { ok: true; uploadId: string }
        await staging.chunk(begin.uploadId, 0, data.toString('base64'))
        const fin = await staging.finish(begin.uploadId, createHash('sha256').update(data).digest('hex')) as { ok: true; serverPath: string }
        return fin.serverPath
      }
      const gone = await stage('pty-gone')
      const kept = await stage('pty-kept')
      const d = createPtyUploadDisposer({ getStaging: () => staging, isPtyAlive: id => id === 'pty-kept', graceMs: 5 })
      d.onPtyExit('pty-gone')
      d.onPtyExit('pty-kept')
      await expect.poll(() => fs.existsSync(path.join(dataDir, 'uploads', 'pty-gone')), { timeout: 3000 }).toBe(false)
      expect(fs.existsSync(gone)).toBe(false)
      expect(fs.existsSync(kept)).toBe(true)
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true })
    }
  })
})

describe('wiring (source guards)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')

  it('Electron main: the PtyManager onPtyExit hands the id to the disposer; the PTY lifecycle is not touched', () => {
    const main = read('main.ts')
    expect(main).toMatch(/const ptyUploadDisposer = createPtyUploadDisposer\(\{\s*getStaging: \(\) => uploadStaging,\s*isPtyAlive: id => ptyManager\?\.isAlive\(id\) \?\? false,/)
    const deps = main.slice(main.indexOf('function createElectronPtyDeps('))
    const onExit = deps.slice(deps.indexOf('onPtyExit: (id) => {'), deps.indexOf('onAgentsInterrupted'))
    expect(onExit).toContain('ptyUploadDisposer.onPtyExit(id)')
  })

  it('headless: createHeadlessHandlerModules feeds every PTY exit to the disposer and stops it with the server', () => {
    const src = read('remote/headless-entry.ts')
    const fn = src.slice(src.indexOf('export function createHeadlessHandlerModules('))
    expect(fn).toMatch(/const ptyUploads = createPtyUploadDisposer\(\{\s*getStaging: \(\) => uploadStaging,\s*isPtyAlive: id => ptyManager\?\.isAlive\(id\) \?\? false,/)
    expect(fn).toContain('ptyUploads.onPtyExit(id) // T0835')
    expect(fn).toContain('() => () => ptyUploads.stop()')
  })

  it('PtyManager itself is not changed for this (no upload knowledge in pty-manager.ts)', () => {
    expect(read('pty-manager.ts')).not.toMatch(/upload/i)
  })
})
