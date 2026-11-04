// @vitest-environment node
/**
 * PLAN-038 U1 (T0832): host-side upload staging (electron/upload-staging.ts) and the `upload:*`
 * handlers (electron/handlers/uploads.ts). T0828 回報區〈調查結論〉7 unit items:
 * file name table, path traversal, offset not contiguous, resend, hash mismatch, quota, statfs,
 * ENOSPC, TTL sweep, dispose, 0700 / 0600 (POSIX), channel classification, helper refused,
 * `claude:dispose-session` hook.
 */
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  UPLOAD_LIMITS,
  UPLOAD_TTL,
  UploadStaging,
  isValidSessionKey,
  logExtension,
  sanitizeUploadName,
  type UploadStagingOptions,
} from '../upload-staging'
import { UPLOAD_CHANNELS, registerUploadHandlers } from '../handlers/uploads'
import { registerClaudeHandlers } from '../handlers/claude'
import { HELPER_CHANNEL_ROLES } from '../remote/helper-capability'
import {
  PATH_AWARE_CHANNELS,
  PATH_FREE_CHANNELS,
  PATH_RETURNING_CHANNELS,
  SERVER_PATH_RESULT_CHANNELS,
  normalizePathsInResult,
} from '../remote/path-aware-channels'
import { PROXIED_CHANNELS } from '../remote/protocol'
import { ALWAYS_LOCAL_CHANNELS, HEADLESS_UNSUPPORTED } from '../remote/headless-channel-status'

const posix = process.platform !== 'win32'
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')
const b64 = (data: Buffer | string) => Buffer.from(data).toString('base64')

let dataDir: string
let logs: string[]
let clock: number

function staging(overrides: Partial<UploadStagingOptions> = {}): UploadStaging {
  return new UploadStaging({
    getDataDir: () => dataDir,
    now: () => clock,
    freeBytes: async () => 10 * 1024 * 1024 * 1024,
    log: { log: m => { logs.push(m) }, warn: m => { logs.push(m) } },
    ...overrides,
  })
}

async function upload(s: UploadStaging, session: string, name: string, content: Buffer | string) {
  const data = Buffer.from(content)
  const begin = await s.begin(session, name, data.length)
  if (!begin.ok) throw new Error(`begin failed: ${begin.code}`)
  for (let offset = 0; offset < data.length; offset += UPLOAD_LIMITS.chunkBytes) {
    const chunk = await s.chunk(begin.uploadId, offset, b64(data.subarray(offset, offset + UPLOAD_LIMITS.chunkBytes)))
    if (!chunk.ok) throw new Error(`chunk failed: ${chunk.code}`)
  }
  const finish = await s.finish(begin.uploadId, sha(data))
  if (!finish.ok) throw new Error(`finish failed: ${finish.code}`)
  return { uploadId: begin.uploadId, serverPath: finish.serverPath }
}

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0832-'))
  logs = []
  clock = 1_000_000_000_000
})

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('sanitizeUploadName', () => {
  it.each([
    ['report.pdf', 'report.pdf'],
    ['C:\\Users\\demo\\Desktop\\shot.png', 'shot.png'],
    ['/home/tester/a/b.txt', 'b.txt'],
    ['../../etc/passwd', 'passwd'],
    ['..\\..\\boot.ini', 'boot.ini'],
    ['.', 'file'],
    ['..', 'file'],
    ['', 'file'],
    ['   ', 'file'],
    ['a\u0000b\u001fc\u007f.txt', 'abc.txt'],
    ['what?<is>this:"|*.md', 'what__is_this____.md'],
    ['trailing. . ', 'trailing'],
    ['CON', '_CON'],
    ['nul.txt', '_nul.txt'],
    ['com1.log', '_com1.log'],
    ['console.log', 'console.log'],
    ['.bashrc', '.bashrc'],
    ['截圖 2026-11-04.png', '截圖 2026-11-04.png'],
  ])('%j → %j', (raw, expected) => {
    expect(sanitizeUploadName(raw)).toBe(expected)
  })

  it('non-strings become `file`', () => {
    expect(sanitizeUploadName(undefined)).toBe('file')
    expect(sanitizeUploadName(42)).toBe('file')
  })

  it('long names keep the extension within 120 chars / 200 UTF-8 bytes', () => {
    const ascii = sanitizeUploadName(`${'a'.repeat(300)}.png`)
    expect(ascii.endsWith('.png')).toBe(true)
    expect(Array.from(ascii)).toHaveLength(120)
    const cjk = sanitizeUploadName(`${'測'.repeat(300)}.jpeg`)
    expect(cjk.endsWith('.jpeg')).toBe(true)
    expect(Buffer.byteLength(cjk, 'utf8')).toBeLessThanOrEqual(200)
    // a surrogate pair is never split
    const emoji = sanitizeUploadName(`${'😀'.repeat(200)}.txt`)
    expect(emoji).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  })

  it('an over-long "extension" is treated as part of the name', () => {
    const name = sanitizeUploadName(`x.${'y'.repeat(200)}`)
    expect(Array.from(name).length).toBeLessThanOrEqual(120)
    expect(name.startsWith('x.')).toBe(true)
  })

  it('logExtension: lowercase alnum only, `-` without one', () => {
    expect(logExtension('a.PNG')).toBe('.png')
    expect(logExtension('noext')).toBe('-')
    expect(logExtension('.bashrc')).toBe('-')
    expect(logExtension('x.t$x!t')).toBe('.txt')
  })
})

describe('session key whitelist', () => {
  it.each(['abc', 'term-1', 'a.b_c-D9', '0f8e6a1c-5b8e-4a77-9e1b-2c4c1d0f3a12'])('accepts %j', key => {
    expect(isValidSessionKey(key)).toBe(true)
  })
  it.each(['', '.', '..', '../x', 'a/b', 'a\\b', 'a b', 'ä', 'x'.repeat(129), 42, null])('rejects %j', key => {
    expect(isValidSessionKey(key)).toBe(false)
  })
})

describe('UploadStaging — happy path', () => {
  it('stages a multi-chunk file at <dataDir>/uploads/<session>/<uploadId>/<name>', async () => {
    const s = staging({ randomId: () => '0123456789abcdef' })
    const content = Buffer.alloc(UPLOAD_LIMITS.chunkBytes * 2 + 17, 7)
    const { uploadId, serverPath } = await upload(s, 'sess-1', 'C:\\x\\pic.png', content)
    expect(uploadId).toBe('0123456789abcdef')
    expect(serverPath).toBe(path.join(dataDir, 'uploads', 'sess-1', uploadId, 'pic.png'))
    expect(fs.readFileSync(serverPath).equals(content)).toBe(true)
    expect(fs.readdirSync(path.dirname(serverPath))).toEqual(['pic.png']) // no .part left
    expect(s.activeCount).toBe(0)
  })

  it('begin returns the chunk size; a zero-byte file finishes without chunks', async () => {
    const s = staging()
    const begin = await s.begin('sess', 'empty.txt', 0)
    expect(begin).toMatchObject({ ok: true, chunkBytes: UPLOAD_LIMITS.chunkBytes })
    if (!begin.ok) return
    const finish = await s.finish(begin.uploadId, sha(''))
    expect(finish).toMatchObject({ ok: true, size: 0 })
    if (finish.ok) expect(fs.statSync(finish.serverPath).size).toBe(0)
  })

  it('the same name twice lands in two directories', async () => {
    const s = staging()
    const a = await upload(s, 'sess', 'same.txt', 'one')
    const b = await upload(s, 'sess', 'same.txt', 'two')
    expect(a.serverPath).not.toBe(b.serverPath)
    expect(fs.readFileSync(a.serverPath, 'utf8')).toBe('one')
    expect(fs.readFileSync(b.serverPath, 'utf8')).toBe('two')
  })

  it.skipIf(!posix)('POSIX: dirs 0700, files 0600 (also when umask is permissive)', async () => {
    const oldMask = process.umask(0o000)
    try {
      const s = staging()
      const { serverPath } = await upload(s, 'sess', 'secret.txt', 'x')
      const mode = (p: string) => fs.statSync(p).mode & 0o777
      expect(mode(path.join(dataDir, 'uploads'))).toBe(0o700)
      expect(mode(path.join(dataDir, 'uploads', 'sess'))).toBe(0o700)
      expect(mode(path.dirname(serverPath))).toBe(0o700)
      expect(mode(serverPath)).toBe(0o600)
    } finally {
      process.umask(oldMask)
    }
  })

  it('logs carry id / session prefix / size / extension, never the file name', async () => {
    const s = staging()
    await upload(s, 'abcdefghijklmnop', 'my-private-name.png', 'data')
    const all = logs.join('\n')
    expect(all).toMatch(/\[upload\] begin id=[0-9a-f]{16} session=abcdefgh size=4 ext=\.png result=ok/)
    expect(all).toMatch(/\[upload\] finish id=[0-9a-f]{16} session=abcdefgh size=4 ext=\.png result=ok/)
    expect(all).not.toContain('my-private-name')
    expect(all).not.toContain('abcdefghijklmnop')
    expect(all).not.toContain(b64('data'))
  })
})

describe('UploadStaging — rejections', () => {
  it('bad arguments', async () => {
    const s = staging()
    expect(await s.begin('../x', 'a', 1)).toMatchObject({ ok: false, code: 'BAD_ARGS' })
    expect(await s.begin('ok', 5, 1)).toMatchObject({ ok: false, code: 'BAD_ARGS' })
    expect(await s.begin('ok', 'a', -1)).toMatchObject({ ok: false, code: 'BAD_ARGS' })
    expect(await s.begin('ok', 'a', 1.5)).toMatchObject({ ok: false, code: 'BAD_ARGS' })
    expect(await s.chunk('nope', 0, b64('x'))).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await s.finish('nope', sha('x'))).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await s.abort(7)).toMatchObject({ ok: false, code: 'BAD_ARGS' })
    expect(await s.abort('nope')).toEqual({ ok: true, aborted: false })
    expect(fs.existsSync(path.join(dataDir, 'x'))).toBe(false)
  })

  it('TOO_LARGE above 50 MiB (nothing created)', async () => {
    const s = staging()
    expect(await s.begin('sess', 'big.bin', UPLOAD_LIMITS.maxFileBytes + 1)).toMatchObject({ ok: false, code: 'TOO_LARGE' })
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'sess'))).toBe(false)
  })

  it('BAD_OFFSET when not contiguous; a resend of the last chunk is acknowledged, not written twice', async () => {
    const s = staging()
    const begin = await s.begin('sess', 'a.txt', 6)
    if (!begin.ok) throw new Error('begin')
    expect(await s.chunk(begin.uploadId, 3, b64('def'))).toMatchObject({ ok: false, code: 'BAD_OFFSET' })
    expect(await s.chunk(begin.uploadId, 0, b64('abc'))).toEqual({ ok: true, received: 3 })
    expect(await s.chunk(begin.uploadId, 0, b64('abc'))).toEqual({ ok: true, received: 3 }) // retry after a lost answer
    expect(await s.chunk(begin.uploadId, 0, b64('xyz'))).toMatchObject({ ok: false, code: 'BAD_OFFSET' }) // different bytes
    expect(await s.chunk(begin.uploadId, 3, b64('def'))).toEqual({ ok: true, received: 6 })
    const finish = await s.finish(begin.uploadId, sha('abcdef'))
    expect(finish.ok && fs.readFileSync(finish.serverPath, 'utf8')).toBe('abcdef')
  })

  it('concurrent chunks for one upload are serialized (the second sees the first)', async () => {
    const s = staging()
    const begin = await s.begin('sess', 'a.txt', 6)
    if (!begin.ok) throw new Error('begin')
    const [first, second] = await Promise.all([
      s.chunk(begin.uploadId, 0, b64('abc')),
      s.chunk(begin.uploadId, 3, b64('def')),
    ])
    expect(first).toEqual({ ok: true, received: 3 })
    expect(second).toEqual({ ok: true, received: 6 })
  })

  it('BAD_CHUNK: not base64, empty, too big, past the declared size', async () => {
    const s = staging()
    const begin = await s.begin('sess', 'a.txt', 4)
    if (!begin.ok) throw new Error('begin')
    expect(await s.chunk(begin.uploadId, 0, '!!!!')).toMatchObject({ code: 'BAD_CHUNK' })
    expect(await s.chunk(begin.uploadId, 0, '')).toMatchObject({ code: 'BAD_CHUNK' })
    expect(await s.chunk(begin.uploadId, 0, 'abc')).toMatchObject({ code: 'BAD_CHUNK' })
    expect(await s.chunk(begin.uploadId, 0, b64(Buffer.alloc(UPLOAD_LIMITS.chunkBytes + 1)))).toMatchObject({ code: 'BAD_CHUNK' })
    expect(await s.chunk(begin.uploadId, 0, b64('12345'))).toMatchObject({ code: 'BAD_CHUNK' })
    expect(await s.chunk(begin.uploadId, 0, b64('1234'))).toEqual({ ok: true, received: 4 })
  })

  it('SIZE_MISMATCH keeps the upload; HASH_MISMATCH removes it', async () => {
    const s = staging()
    const begin = await s.begin('sess', 'a.txt', 4)
    if (!begin.ok) throw new Error('begin')
    await s.chunk(begin.uploadId, 0, b64('12'))
    expect(await s.finish(begin.uploadId, sha('12'))).toMatchObject({ ok: false, code: 'SIZE_MISMATCH' })
    await s.chunk(begin.uploadId, 2, b64('34'))
    expect(await s.finish(begin.uploadId, 'zz')).toMatchObject({ ok: false, code: 'BAD_ARGS' })
    expect(await s.finish(begin.uploadId, sha('wrong'))).toMatchObject({ ok: false, code: 'HASH_MISMATCH' })
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'sess', begin.uploadId))).toBe(false)
    expect(await s.chunk(begin.uploadId, 4, b64('5'))).toMatchObject({ code: 'NOT_FOUND' })
    expect(logs.join('\n')).toContain('result=HASH_MISMATCH')
  })

  it('finish accepts an uppercase sha256', async () => {
    const s = staging()
    const begin = await s.begin('sess', 'a.txt', 1)
    if (!begin.ok) throw new Error('begin')
    await s.chunk(begin.uploadId, 0, b64('Z'))
    expect(await s.finish(begin.uploadId, sha('Z').toUpperCase())).toMatchObject({ ok: true })
  })

  it('abort removes the partial file; aborting twice is a no-op', async () => {
    const s = staging()
    const begin = await s.begin('sess', 'a.txt', 4)
    if (!begin.ok) throw new Error('begin')
    await s.chunk(begin.uploadId, 0, b64('12'))
    expect(await s.abort(begin.uploadId)).toEqual({ ok: true, aborted: true })
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'sess', begin.uploadId))).toBe(false)
    expect(await s.abort(begin.uploadId)).toEqual({ ok: true, aborted: false })
  })

  it('QUOTA counts finished files and in-progress declared sizes of the session only', async () => {
    const s = staging()
    const big = UPLOAD_LIMITS.maxFileBytes // 50 MiB
    const ids: string[] = []
    for (let i = 0; i < 9; i++) {
      const begin = await s.begin('sess', `f${i}.bin`, big)
      expect(begin.ok).toBe(true)
      if (begin.ok) ids.push(begin.uploadId)
    }
    // 8 × 50 = 400 MiB in progress + a 99 MiB file on disk = 499 MiB: 2 MiB more is over 500, 1 MiB fits
    await s.abort(ids.pop())
    const onDisk = path.join(dataDir, 'uploads', 'sess', 'aaaaaaaaaaaaaaaa')
    fs.mkdirSync(onDisk)
    fs.writeFileSync(path.join(onDisk, 'old.bin'), Buffer.alloc(1))
    fs.truncateSync(path.join(onDisk, 'old.bin'), 99 * 1024 * 1024)
    expect(await s.begin('sess', 'more.bin', 2 * 1024 * 1024)).toMatchObject({ ok: false, code: 'QUOTA' })
    expect(await s.begin('sess', 'fits.bin', 1024 * 1024)).toMatchObject({ ok: true })
    // another session is unaffected
    expect(await s.begin('other', 'x.bin', big)).toMatchObject({ ok: true })
    expect(logs.join('\n')).toContain('result=QUOTA')
  })

  it('TOO_MANY above 10 uploads in progress for one session', async () => {
    const s = staging()
    for (let i = 0; i < UPLOAD_LIMITS.maxActivePerSession; i++) {
      expect((await s.begin('sess', `f${i}`, 1)).ok).toBe(true)
    }
    expect(await s.begin('sess', 'one-more', 1)).toMatchObject({ ok: false, code: 'TOO_MANY' })
    expect(await s.begin('other', 'fine', 1)).toMatchObject({ ok: true })
  })

  it('NO_SPACE when free < size + 64 MiB (statfs); unknown free space does not block', async () => {
    const tight = staging({ freeBytes: async () => UPLOAD_LIMITS.reserveFreeBytes + 10 })
    expect(await tight.begin('sess', 'a', 11)).toMatchObject({ ok: false, code: 'NO_SPACE' })
    expect(await tight.begin('sess', 'a', 10)).toMatchObject({ ok: true })
    const unknown = staging({ freeBytes: async () => null })
    expect(await unknown.begin('sess', 'a', 10)).toMatchObject({ ok: true })
    expect(logs.join('\n')).toContain('free=unknown')
  })

  it('the default free-space probe answers on this host', async () => {
    const s = new UploadStaging({ getDataDir: () => dataDir, log: { log: () => {}, warn: () => {} } })
    expect(await s.begin('sess', 'a', 1)).toMatchObject({ ok: true })
  })

  it('ENOSPC while writing → NO_SPACE and the upload is removed', async () => {
    const enospc = Object.assign(new Error('no space'), { code: 'ENOSPC' })
    const s = staging({ appendChunk: async () => { throw enospc } })
    const begin = await s.begin('sess', 'a.txt', 3)
    if (!begin.ok) throw new Error('begin')
    expect(await s.chunk(begin.uploadId, 0, b64('abc'))).toMatchObject({ ok: false, code: 'NO_SPACE' })
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'sess', begin.uploadId))).toBe(false)
    expect(await s.chunk(begin.uploadId, 0, b64('abc'))).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('every path stays under <dataDir>/uploads', async () => {
    const s = staging()
    for (const name of ['../../../evil', '..\\..\\evil', '/etc/passwd', 'C:\\Windows\\win.ini', '..']) {
      const { serverPath } = await upload(s, 'sess', name, 'x')
      expect(path.relative(path.join(dataDir, 'uploads', 'sess'), serverPath).split(path.sep)).toHaveLength(2)
    }
    expect(fs.readdirSync(dataDir)).toEqual(['uploads'])
  })
})

describe('UploadStaging — cleanup', () => {
  it('disposeSession removes the session dir and aborts its uploads; other sessions stay', async () => {
    const s = staging()
    const keep = await upload(s, 'keep', 'a.txt', 'a')
    await upload(s, 'gone', 'b.txt', 'b')
    const open = await s.begin('gone', 'c.txt', 5)
    expect(open.ok).toBe(true)
    expect(await s.disposeSession('gone')).toEqual({ removed: true })
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'gone'))).toBe(false)
    if (open.ok) expect(await s.chunk(open.uploadId, 0, b64('x'))).toMatchObject({ code: 'NOT_FOUND' })
    expect(fs.existsSync(keep.serverPath)).toBe(true)
    expect(await s.disposeSession('gone')).toEqual({ removed: false })
    expect(await s.disposeSession('../keep')).toEqual({ removed: false })
    expect(fs.existsSync(keep.serverPath)).toBe(true)
  })

  it('sweep: finished > 24 h and orphan .part > 10 min removed, fresh ones kept, empty session dirs removed', async () => {
    const s = staging()
    const old = await upload(s, 'old', 'a.txt', 'a')
    const fresh = await upload(s, 'fresh', 'b.txt', 'b')
    // an orphan .part from an earlier process (no live upload owns it)
    const orphanDir = path.join(dataDir, 'uploads', 'fresh', 'bbbbbbbbbbbbbbbb')
    fs.mkdirSync(orphanDir)
    fs.writeFileSync(path.join(orphanDir, 'x.txt.part'), 'x')
    const setAge = (p: string, ms: number) => {
      const t = new Date(clock - ms)
      fs.utimesSync(p, t, t)
    }
    setAge(old.serverPath, UPLOAD_TTL.finishedMs + 1000)
    setAge(path.dirname(old.serverPath), UPLOAD_TTL.finishedMs + 1000)
    setAge(fresh.serverPath, UPLOAD_TTL.finishedMs - 60_000)
    setAge(path.dirname(fresh.serverPath), UPLOAD_TTL.finishedMs - 60_000)
    setAge(path.join(orphanDir, 'x.txt.part'), UPLOAD_TTL.partMs + 1000)
    setAge(orphanDir, UPLOAD_TTL.partMs + 1000)
    expect(await s.sweep()).toEqual({ removed: 2 })
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'old'))).toBe(false)
    expect(fs.existsSync(fresh.serverPath)).toBe(true)
    expect(fs.existsSync(orphanDir)).toBe(false)
  })

  it('sweep: an in-progress upload idle > 10 min is dropped, an active one kept', async () => {
    const s = staging()
    const idle = await s.begin('sess', 'idle.txt', 4)
    const busy = await s.begin('sess', 'busy.txt', 4)
    if (!idle.ok || !busy.ok) throw new Error('begin')
    clock += UPLOAD_TTL.partMs - 1000
    await s.chunk(busy.uploadId, 0, b64('12'))
    clock += 2000
    await s.sweep()
    expect(await s.chunk(idle.uploadId, 0, b64('12'))).toMatchObject({ code: 'NOT_FOUND' })
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'sess', idle.uploadId))).toBe(false)
    expect(await s.chunk(busy.uploadId, 2, b64('34'))).toEqual({ ok: true, received: 4 })
  })

  it('sweep without an uploads dir is a no-op; startSweeper sweeps at once and stops', async () => {
    const s = staging()
    expect(await s.sweep()).toEqual({ removed: 0 })
    const spy = vi.spyOn(s, 'sweep')
    const stop = s.startSweeper(60_000)
    expect(spy).toHaveBeenCalledTimes(1)
    stop()
    spy.mockRestore()
  })

  it('getDataDir is not read before first use', () => {
    const getDataDir = vi.fn(() => dataDir)
    const s = new UploadStaging({ getDataDir })
    expect(getDataDir).not.toHaveBeenCalled()
    expect(s.activeCount).toBe(0)
  })
})

describe('upload:* handlers', () => {
  function harness(getStaging: () => UploadStaging | null) {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    registerUploadHandlers((channel, fn) => { handlers.set(channel, fn as never) }, { getStaging })
    return handlers
  }

  it('registers exactly the four channels', () => {
    expect([...harness(() => null).keys()].sort()).toEqual([...UPLOAD_CHANNELS].sort())
  })

  it('a client window uploads; a helper capability is refused before the staging is touched', async () => {
    const s = staging()
    const h = harness(() => s)
    const begin = await h.get('upload:begin')!({ windowId: null }, 'sess', 'a.txt', 2) as { ok: true; uploadId: string }
    expect(begin.ok).toBe(true)
    expect(await h.get('upload:chunk')!({ windowId: null }, begin.uploadId, 0, b64('hi'))).toEqual({ ok: true, received: 2 })
    const finish = await h.get('upload:finish')!({ windowId: null }, begin.uploadId, sha('hi')) as { serverPath: string }
    expect(fs.readFileSync(finish.serverPath, 'utf8')).toBe('hi')
    const helper = { windowId: null, helper: { terminalId: 't1', role: 'tower' as const } }
    for (const channel of UPLOAD_CHANNELS) {
      expect(await h.get(channel)!(helper, 'sess', 'x', 1)).toMatchObject({ ok: false, code: 'FORBIDDEN' })
    }
    expect(fs.readdirSync(path.join(dataDir, 'uploads', 'sess'))).toHaveLength(1)
  })

  it('no staging yet → IO_ERROR', async () => {
    expect(await harness(() => null).get('upload:begin')!({ windowId: null }, 's', 'a', 1)).toMatchObject({ ok: false, code: 'IO_ERROR' })
  })
})

describe('channel classification (T0832)', () => {
  it.each(UPLOAD_CHANNELS)('%s: proxied, path-free, answered on headless, not helper-callable', channel => {
    expect(PROXIED_CHANNELS.has(channel)).toBe(true)
    expect(PATH_FREE_CHANNELS.has(channel)).toBe(true)
    expect(PATH_AWARE_CHANNELS.has(channel)).toBe(false)
    expect(PATH_RETURNING_CHANNELS.has(channel)).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(HELPER_CHANNEL_ROLES, channel)).toBe(false)
    expect(ALWAYS_LOCAL_CHANNELS.has(channel)).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(HEADLESS_UNSUPPORTED, channel)).toBe(false)
  })

  it('upload:finish keeps serverPath in server form (never toClient)', () => {
    expect(SERVER_PATH_RESULT_CHANNELS.has('upload:finish')).toBe(true)
    const translator = { toServer: (p: string) => `S:${p}`, toClient: (p: string) => `C:${p}` }
    const result = { ok: true, serverPath: '/home/u/.local/share/bat-server/uploads/s/0123456789abcdef/a.png', size: 1 }
    expect(normalizePathsInResult('upload:finish', result, translator as never)).toBe(result)
  })
})

describe('claude:dispose-session removes the session uploads (T0832)', () => {
  it('calls onSessionDisposed for claude and codex sessions; the return value is unchanged', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const onSessionDisposed = vi.fn()
    const claude = { disposeSession: vi.fn(() => true) }
    const codex = { stopSession: vi.fn(async () => true) }
    registerClaudeHandlers(((channel: string, fn: (...args: unknown[]) => unknown) => { handlers.set(channel, fn) }) as never, {
      emit: vi.fn(),
      homeDir: process.cwd(),
      getClaudeManager: () => claude as never,
      getCodexManager: () => codex as never,
      sessionKinds: new Map([['c1', 'codex']]),
      onSessionDisposed,
    })
    const fn = handlers.get('claude:dispose-session')!
    expect(fn({}, 's1')).toBe(true)
    expect(onSessionDisposed).toHaveBeenCalledWith('s1')
    expect(await fn({}, 'c1')).toBe(true)
    expect(onSessionDisposed).toHaveBeenCalledWith('c1')
  })

  it('still runs when the dispose throws', () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const onSessionDisposed = vi.fn()
    registerClaudeHandlers(((channel: string, fn: (...args: unknown[]) => unknown) => { handlers.set(channel, fn) }) as never, {
      emit: vi.fn(),
      homeDir: process.cwd(),
      getClaudeManager: () => ({ disposeSession: () => { throw new Error('boom') } }) as never,
      onSessionDisposed,
    })
    expect(() => handlers.get('claude:dispose-session')!({}, 's1')).toThrow('boom')
    expect(onSessionDisposed).toHaveBeenCalledWith('s1')
  })
})
