// electron/bat-scripts-log-rotation.ts
// Startup rotation of the shared helper diagnostic log `bat-scripts.log` (T0732 / BUG-179, D198).
//
// Writers: every helper process (scripts/_bat-logger.mjs), the Electron main process mirror
// (electron/remote/remote-logger.ts) and, on a remote host, the helpers inside the headless
// bat-server's PTYs. All of them only append (open + append + close per line), so the file grew
// without bound (41.6 MB measured in T0731).
//
// Rule (D198 — do not change on your own):
//   - Run once at startup by the process that owns the log directory: the Electron main process
//     (<userData>/Logs) and the headless bat-server (<dataDir>/Logs = BAT_HELPER_LOG_DIR of its
//     PTYs). Never on the append path.
//   - Size > 10 MiB (10 * 1024 * 1024 bytes) -> rename to bat-scripts-<YYYYMMDD-HHMMSS>.log
//     (local time of the moment it runs). Helpers keep appending to bat-scripts.log, which is
//     simply created again on their next write.
//   - Keep only the newest 3 rotated files, ordered by the timestamp in their file name.
//   - Rename / delete failures (Windows EBUSY / EPERM while a helper is appending, ...) are
//     skipped silently: one line to the caller's debug log, retried at the next startup.
//     This function never throws.
//
// Pure fs + path: no electron import, shared by main.ts and headless-entry.ts.
import * as nodeFs from 'fs'
import * as path from 'path'

export const BAT_SCRIPTS_LOG_FILENAME = 'bat-scripts.log'
/** Rotate when the file is strictly larger than this many bytes. */
export const BAT_SCRIPTS_LOG_ROTATE_BYTES = 10 * 1024 * 1024
/** Number of rotated files kept after a startup. */
export const BAT_SCRIPTS_LOG_KEEP = 3

const LOG_TAG = '[bat-scripts-log]'
// bat-scripts-20261101-123705.log, or bat-scripts-20261101-123705-2.log when two rotations
// fall in the same second (the existing file is never overwritten).
const ROTATED_NAME = /^bat-scripts-(\d{8}-\d{6})(?:-(\d+))?\.log$/

export type BatScriptsLogFs = Pick<typeof nodeFs, 'statSync' | 'renameSync' | 'readdirSync' | 'unlinkSync' | 'existsSync'>

export interface RotateBatScriptsLogOptions {
  /** One line per notable outcome (rotated, removed, failures); goes to the caller's debug log. */
  log?: (message: string) => void
  /** Clock for the rotated file's name; local time is used. */
  now?: () => Date
  /** Test seam. */
  fs?: BatScriptsLogFs
  /** Test seam; production always uses BAT_SCRIPTS_LOG_ROTATE_BYTES. */
  maxBytes?: number
  /** Test seam; production always uses BAT_SCRIPTS_LOG_KEEP. */
  keep?: number
}

export interface RotateBatScriptsLogResult {
  /** `missing` = no bat-scripts.log; `kept` = not over the limit; `failed` = stat / rename failed. */
  action: 'missing' | 'kept' | 'rotated' | 'failed'
  /** File name of the new rotated file (`rotated` only). */
  rotatedTo?: string
  /** File names of rotated files deleted to keep the newest `keep`. */
  removed: string[]
  /** Number of rename / delete / listing failures (each one logged once). */
  failures: number
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/** `YYYYMMDD-HHMMSS` in local time. */
export function batScriptsLogStamp(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

function errorText(err: unknown): string {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  const message = err instanceof Error ? err.message : String(err)
  return code ? `${code}: ${message}` : message
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
}

interface RotatedEntry {
  name: string
  stamp: string
  seq: number
}

function parseRotatedName(name: string): RotatedEntry | null {
  const match = ROTATED_NAME.exec(name)
  if (!match) return null
  return { name, stamp: match[1], seq: match[2] ? Number(match[2]) : 0 }
}

function compareNewestFirst(a: RotatedEntry, b: RotatedEntry): number {
  if (a.stamp !== b.stamp) return a.stamp < b.stamp ? 1 : -1
  return b.seq - a.seq
}

function pickRotatedName(fs: BatScriptsLogFs, dir: string, stamp: string): string {
  let name = `bat-scripts-${stamp}.log`
  for (let seq = 2; fs.existsSync(path.join(dir, name)); seq++) {
    name = `bat-scripts-${stamp}-${seq}.log`
  }
  return name
}

/**
 * Rotate `<logDir>/bat-scripts.log` when it is over the limit, then keep the newest rotated
 * files. Never throws; failures are logged once each and retried at the next startup.
 */
export function rotateBatScriptsLog(logDir: string, options: RotateBatScriptsLogOptions = {}): RotateBatScriptsLogResult {
  const fs = options.fs ?? nodeFs
  const maxBytes = options.maxBytes ?? BAT_SCRIPTS_LOG_ROTATE_BYTES
  const keep = options.keep ?? BAT_SCRIPTS_LOG_KEEP
  const result: RotateBatScriptsLogResult = { action: 'missing', removed: [], failures: 0 }
  const log = (message: string): void => {
    try {
      options.log?.(`${LOG_TAG} ${message}`)
    } catch {
      /* the debug log itself failed — stay silent */
    }
  }

  try {
    const current = path.join(logDir, BAT_SCRIPTS_LOG_FILENAME)
    let size: number | null = null
    try {
      size = fs.statSync(current).size
    } catch (err) {
      if (!isMissing(err)) {
        result.action = 'failed'
        result.failures++
        log(`stat ${BAT_SCRIPTS_LOG_FILENAME} failed, will retry next startup (${errorText(err)})`)
      }
    }

    if (size !== null) {
      if (size > maxBytes) {
        const now = options.now ? options.now() : new Date()
        const target = pickRotatedName(fs, logDir, batScriptsLogStamp(now))
        try {
          fs.renameSync(current, path.join(logDir, target))
          result.action = 'rotated'
          result.rotatedTo = target
          log(`rotated ${BAT_SCRIPTS_LOG_FILENAME} (${size} bytes > ${maxBytes}) -> ${target}`)
        } catch (err) {
          result.action = 'failed'
          result.failures++
          log(`rename ${BAT_SCRIPTS_LOG_FILENAME} (${size} bytes) failed, will retry next startup (${errorText(err)})`)
        }
      } else {
        result.action = 'kept'
      }
    }

    // Prune on every startup, not only after a rotation, so a delete that failed last time is
    // retried even when nothing new was rotated.
    let names: string[]
    try {
      names = fs.readdirSync(logDir) as string[]
    } catch (err) {
      if (!isMissing(err)) {
        result.failures++
        log(`list ${logDir} failed, will retry next startup (${errorText(err)})`)
      }
      return result
    }
    const rotated = names
      .map(parseRotatedName)
      .filter((entry): entry is RotatedEntry => entry !== null)
      .sort(compareNewestFirst)
    for (const entry of rotated.slice(keep)) {
      try {
        fs.unlinkSync(path.join(logDir, entry.name))
        result.removed.push(entry.name)
        log(`removed old ${entry.name} (keeping newest ${keep})`)
      } catch (err) {
        if (isMissing(err)) continue
        result.failures++
        log(`remove ${entry.name} failed, will retry next startup (${errorText(err)})`)
      }
    }
  } catch (err) {
    // Outer guard: rotation must never affect startup.
    result.failures++
    log(`unexpected failure, skipped (${errorText(err)})`)
  }
  return result
}
