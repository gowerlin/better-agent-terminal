// @vitest-environment node
/**
 * T0732 / BUG-179 (D198): startup rotation of bat-scripts.log.
 * Every case works in its own temp directory — never on a real user log.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BAT_SCRIPTS_LOG_FILENAME,
  BAT_SCRIPTS_LOG_KEEP,
  BAT_SCRIPTS_LOG_ROTATE_BYTES,
  batScriptsLogStamp,
  rotateBatScriptsLog,
  type BatScriptsLogFs,
} from '../bat-scripts-log-rotation'

const dirs: string[] = []

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-scripts-rotation-'))
  dirs.push(dir)
  return dir
}

/** Sparse file of exactly `size` bytes (no real 10 MiB write). */
function writeSized(file: string, size: number): void {
  fs.writeFileSync(file, '')
  fs.truncateSync(file, size)
}

function sorted(dir: string): string[] {
  return fs.readdirSync(dir).sort()
}

// 2026-11-01 12:37:05 local time
const NOW = new Date(2026, 10, 1, 12, 37, 5)

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('rotateBatScriptsLog', () => {
  it('uses the D198 constants', () => {
    expect(BAT_SCRIPTS_LOG_FILENAME).toBe('bat-scripts.log')
    expect(BAT_SCRIPTS_LOG_ROTATE_BYTES).toBe(10 * 1024 * 1024)
    expect(BAT_SCRIPTS_LOG_KEEP).toBe(3)
  })

  it('formats the stamp in local time as YYYYMMDD-HHMMSS', () => {
    expect(batScriptsLogStamp(NOW)).toBe('20261101-123705')
    expect(batScriptsLogStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405')
  })

  it('leaves a file of exactly 10 MiB alone', () => {
    const dir = tempDir()
    writeSized(path.join(dir, 'bat-scripts.log'), BAT_SCRIPTS_LOG_ROTATE_BYTES)
    const lines: string[] = []
    const result = rotateBatScriptsLog(dir, { now: () => NOW, log: m => lines.push(m) })
    expect(result).toEqual({ action: 'kept', removed: [], failures: 0 })
    expect(sorted(dir)).toEqual(['bat-scripts.log'])
    expect(lines).toEqual([])
  })

  it('renames a file over 10 MiB to bat-scripts-<stamp>.log', () => {
    const dir = tempDir()
    writeSized(path.join(dir, 'bat-scripts.log'), BAT_SCRIPTS_LOG_ROTATE_BYTES + 1)
    const lines: string[] = []
    const result = rotateBatScriptsLog(dir, { now: () => NOW, log: m => lines.push(m) })
    expect(result.action).toBe('rotated')
    expect(result.rotatedTo).toBe('bat-scripts-20261101-123705.log')
    expect(sorted(dir)).toEqual(['bat-scripts-20261101-123705.log'])
    expect(fs.statSync(path.join(dir, 'bat-scripts-20261101-123705.log')).size).toBe(BAT_SCRIPTS_LOG_ROTATE_BYTES + 1)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^\[bat-scripts-log\] rotated bat-scripts\.log \(10485761 bytes > 10485760\) -> bat-scripts-20261101-123705\.log$/)
  })

  it('a helper appending after the rotation starts a new bat-scripts.log', () => {
    const dir = tempDir()
    writeSized(path.join(dir, 'bat-scripts.log'), BAT_SCRIPTS_LOG_ROTATE_BYTES + 1)
    rotateBatScriptsLog(dir, { now: () => NOW })
    // same write mode as scripts/_bat-logger.mjs / remote-logger.ts
    fs.appendFileSync(path.join(dir, 'bat-scripts.log'), '{"event":"x"}\n', { encoding: 'utf-8' })
    expect(fs.readFileSync(path.join(dir, 'bat-scripts.log'), 'utf-8')).toBe('{"event":"x"}\n')
  })

  it('does not overwrite a rotated file with the same stamp', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'bat-scripts-20261101-123705.log'), 'earlier')
    writeSized(path.join(dir, 'bat-scripts.log'), BAT_SCRIPTS_LOG_ROTATE_BYTES + 1)
    const result = rotateBatScriptsLog(dir, { now: () => NOW })
    expect(result.rotatedTo).toBe('bat-scripts-20261101-123705-2.log')
    expect(fs.readFileSync(path.join(dir, 'bat-scripts-20261101-123705.log'), 'utf-8')).toBe('earlier')
  })

  it('keeps the newest 3 rotated files by the stamp in the name and deletes the oldest', () => {
    const dir = tempDir()
    // mtimes deliberately disagree with the names: ordering is by name
    for (const name of [
      'bat-scripts-20260901-000000.log',
      'bat-scripts-20261001-000000.log',
      'bat-scripts-20260801-000000.log',
      'bat-scripts-20261015-080000.log',
    ]) fs.writeFileSync(path.join(dir, name), name)
    writeSized(path.join(dir, 'bat-scripts.log'), BAT_SCRIPTS_LOG_ROTATE_BYTES + 1)
    // unrelated files in Logs/ are never touched
    fs.writeFileSync(path.join(dir, 'debug-20261101-120000.log'), 'debug')
    fs.writeFileSync(path.join(dir, 'bat-scripts-copy.log'), 'mine')
    const lines: string[] = []

    const result = rotateBatScriptsLog(dir, { now: () => NOW, log: m => lines.push(m) })

    expect(result.action).toBe('rotated')
    expect(result.removed.sort()).toEqual(['bat-scripts-20260801-000000.log', 'bat-scripts-20260901-000000.log'])
    expect(sorted(dir)).toEqual([
      'bat-scripts-20261001-000000.log',
      'bat-scripts-20261015-080000.log',
      'bat-scripts-20261101-123705.log',
      'bat-scripts-copy.log',
      'debug-20261101-120000.log',
    ])
    expect(lines.filter(l => l.includes('removed old'))).toHaveLength(2)
  })

  it('orders a same-second suffix after the plain name', () => {
    const dir = tempDir()
    for (const name of [
      'bat-scripts-20261101-123705.log',
      'bat-scripts-20261101-123705-2.log',
      'bat-scripts-20261101-123705-3.log',
      'bat-scripts-20261030-000000.log',
    ]) fs.writeFileSync(path.join(dir, name), name)
    const result = rotateBatScriptsLog(dir, { now: () => NOW })
    expect(result.removed).toEqual(['bat-scripts-20261030-000000.log'])
  })

  it('prunes old rotated files even when bat-scripts.log is small or missing', () => {
    const dir = tempDir()
    for (let day = 1; day <= 5; day++) fs.writeFileSync(path.join(dir, `bat-scripts-2026100${day}-000000.log`), '')
    const result = rotateBatScriptsLog(dir, { now: () => NOW })
    expect(result.action).toBe('missing')
    expect(result.removed.sort()).toEqual(['bat-scripts-20261001-000000.log', 'bat-scripts-20261002-000000.log'])
  })

  it('does nothing when bat-scripts.log does not exist', () => {
    const dir = tempDir()
    const lines: string[] = []
    expect(rotateBatScriptsLog(dir, { now: () => NOW, log: m => lines.push(m) })).toEqual({ action: 'missing', removed: [], failures: 0 })
    expect(sorted(dir)).toEqual([])
    expect(lines).toEqual([])
  })

  it('does nothing when the logs directory does not exist', () => {
    const dir = path.join(tempDir(), 'Logs')
    const lines: string[] = []
    expect(rotateBatScriptsLog(dir, { log: m => lines.push(m) })).toEqual({ action: 'missing', removed: [], failures: 0 })
    expect(fs.existsSync(dir)).toBe(false)
    expect(lines).toEqual([])
  })

  it('a failing rename (EBUSY) does not throw, logs one line and leaves the file for the next startup', () => {
    const dir = tempDir()
    writeSized(path.join(dir, 'bat-scripts.log'), BAT_SCRIPTS_LOG_ROTATE_BYTES + 1)
    const busyFs: BatScriptsLogFs = {
      ...fs,
      renameSync: () => {
        throw Object.assign(new Error('resource busy or locked'), { code: 'EBUSY' })
      },
    }
    const lines: string[] = []
    let result: ReturnType<typeof rotateBatScriptsLog> | undefined
    expect(() => {
      result = rotateBatScriptsLog(dir, { now: () => NOW, log: m => lines.push(m), fs: busyFs })
    }).not.toThrow()
    expect(result?.action).toBe('failed')
    expect(result?.failures).toBe(1)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('will retry next startup (EBUSY: resource busy or locked)')
    expect(sorted(dir)).toEqual(['bat-scripts.log'])

    // next startup: the rename works now
    expect(rotateBatScriptsLog(dir, { now: () => NOW }).action).toBe('rotated')
  })

  it('a failing delete (EPERM) does not throw and keeps the other deletions going', () => {
    const dir = tempDir()
    for (let day = 1; day <= 5; day++) fs.writeFileSync(path.join(dir, `bat-scripts-2026100${day}-000000.log`), '')
    const lockedFs: BatScriptsLogFs = {
      ...fs,
      unlinkSync: (target: fs.PathLike) => {
        if (String(target).endsWith('bat-scripts-20261001-000000.log')) {
          throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
        }
        fs.unlinkSync(target)
      },
    }
    const lines: string[] = []
    const result = rotateBatScriptsLog(dir, { log: m => lines.push(m), fs: lockedFs })
    expect(result.removed).toEqual(['bat-scripts-20261002-000000.log'])
    expect(result.failures).toBe(1)
    expect(lines.some(l => l.includes('remove bat-scripts-20261001-000000.log failed, will retry next startup (EPERM'))).toBe(true)
    expect(sorted(dir)).toContain('bat-scripts-20261001-000000.log')
  })

  it('never throws, even when every fs call throws and the log callback throws', () => {
    const boom = () => {
      throw Object.assign(new Error('boom'), { code: 'EIO' })
    }
    const brokenFs = { statSync: boom, renameSync: boom, readdirSync: boom, unlinkSync: boom, existsSync: boom } as unknown as BatScriptsLogFs
    let result: ReturnType<typeof rotateBatScriptsLog> | undefined
    expect(() => {
      result = rotateBatScriptsLog('/nowhere', { fs: brokenFs, log: () => { throw new Error('log down') } })
    }).not.toThrow()
    expect(result?.action).toBe('failed')
    expect(result?.failures).toBeGreaterThanOrEqual(2)
  })
})

describe('rotateBatScriptsLog — call sites (source guard)', () => {
  const root = path.resolve(__dirname, '..', '..')
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8')

  it('main.ts rotates <userData>/Logs inside app.whenReady, before the RemoteServer starts', () => {
    const src = read('electron/main.ts')
    const ready = src.indexOf('app.whenReady().then(')
    const call = src.indexOf('rotateBatScriptsLog(batScriptsLogDir')
    const serverStart = src.indexOf('await remoteServer.start(startupPort)')
    expect(ready).toBeGreaterThan(0)
    expect(call).toBeGreaterThan(ready)
    expect(serverStart).toBeGreaterThan(call)
    expect(src).toContain('const batScriptsLogDir = logger.getLogsDir()')
  })

  it('the rotation module stays importable at import time without electron or userData', () => {
    const src = read('electron/bat-scripts-log-rotation.ts')
    expect(src).not.toMatch(/from 'electron'/)
    expect(src).not.toMatch(/getPath\(/)
  })

  it('the append paths do not rotate (rotation runs only at startup)', () => {
    expect(read('electron/remote/remote-logger.ts')).not.toContain('rotateBatScriptsLog')
    expect(read('scripts/_bat-logger.mjs')).not.toContain('rotate')
  })
})
