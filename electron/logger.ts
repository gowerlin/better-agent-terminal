import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'error' | 'warn' | 'info' | 'log' | 'debug'

interface LoggerOptions {
  loggingEnabled?: boolean
  logLevel?: LogLevel
}

interface LoggingInfo {
  logsDir: string
  currentLogFilePath: string | null
  loggingEnabled: boolean
  logLevel: LogLevel
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  log: 3,
  debug: 4,
}

const LOG_PREFIX = 'debug'
const LOGS_DIR_NAME = 'Logs'
const MAX_LOG_FILES = 10

let initialized = false
let initializedUserDataPath: string | null = null
let logsDirPath: string | null = null
let logFilePath: string | null = null
let loggingEnabled = true
let activeLogLevel: LogLevel = 'debug'
// T0485: true while logger.error() itself writes to console.error, so the
// console.error mirror does not log the same entry twice.
let echoingConsoleError = false
let consoleErrorMirror: {
  original: (...args: unknown[]) => void
  active: boolean
  mirror: (...args: unknown[]) => void
} | null = null

function pad(num: number): string {
  return String(num).padStart(2, '0')
}

function toFileStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function normalizeLogLevel(level: unknown): LogLevel {
  if (level === 'error' || level === 'warn' || level === 'info' || level === 'log' || level === 'debug') {
    return level
  }
  return 'debug'
}

function isDiskWriteAllowed(level: LogLevel): boolean {
  return loggingEnabled && LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[activeLogLevel]
}

function formatArgs(args: unknown[]): string {
  return args.map(a => {
    if (a instanceof Error) return a.stack ? `${a.message}\n${a.stack}` : a.message
    if (typeof a === 'string') return a
    try { return JSON.stringify(a) } catch { return String(a) }
  }).join(' ')
}

function makeUniquePath(basePath: string): string {
  if (!fs.existsSync(basePath)) return basePath
  const ext = path.extname(basePath)
  const stem = basePath.slice(0, -ext.length)
  let index = 1
  while (true) {
    const candidate = `${stem}-${index}${ext}`
    if (!fs.existsSync(candidate)) return candidate
    index += 1
  }
}

function ensureLogFilePath(): void {
  if (!logsDirPath || logFilePath) return
  const fileName = `${LOG_PREFIX}-${toFileStamp(new Date())}.log`
  const candidate = path.join(logsDirPath, fileName)
  logFilePath = makeUniquePath(candidate)
}

function moveLegacyDebugLog(userDataPath: string): void {
  if (!logsDirPath) return
  const legacyPath = path.join(userDataPath, 'debug.log')
  if (!fs.existsSync(legacyPath)) return

  const legacyTarget = makeUniquePath(path.join(logsDirPath, `${LOG_PREFIX}-legacy-${toFileStamp(new Date())}.log`))
  try {
    fs.renameSync(legacyPath, legacyTarget)
  } catch (error) {
    console.error('[logger] Failed to move legacy debug.log:', error)
  }
}

function listManagedLogs(): { fullPath: string; mtimeMs: number }[] {
  if (!logsDirPath) return []
  try {
    return fs.readdirSync(logsDirPath)
      .filter(name => name.startsWith(`${LOG_PREFIX}-`) && name.endsWith('.log'))
      .map(name => {
        const fullPath = path.join(logsDirPath!, name)
        const stat = fs.statSync(fullPath)
        return { fullPath, mtimeMs: stat.mtimeMs }
      })
      .sort((a, b) => a.mtimeMs - b.mtimeMs)
  } catch (error) {
    console.error('[logger] Failed to enumerate log files:', error)
    return []
  }
}

function cleanupOldLogs(maxFiles: number = MAX_LOG_FILES): number {
  const logs = listManagedLogs()
  const over = logs.length - maxFiles
  if (over <= 0) return 0

  let removed = 0
  for (const entry of logs) {
    if (removed >= over) break
    if (entry.fullPath === logFilePath) continue
    try {
      fs.unlinkSync(entry.fullPath)
      removed += 1
    } catch (error) {
      console.error('[logger] Failed to delete old log file:', error)
    }
  }
  return removed
}

function writeToFile(level: LogLevel, args: unknown[]): void {
  if (!isDiskWriteAllowed(level)) return
  ensureLogFilePath()
  if (!logFilePath) return

  const ts = new Date().toISOString()
  const line = `[${ts}] [${level.toUpperCase()}] ${formatArgs(args)}\n`
  try {
    fs.appendFileSync(logFilePath, line, 'utf-8')
  } catch (error) {
    console.error('[logger] Failed to append log entry:', error)
  }
}

function applySettings(options: LoggerOptions): void {
  if (typeof options.loggingEnabled === 'boolean') {
    loggingEnabled = options.loggingEnabled
  }
  if (typeof options.logLevel !== 'undefined') {
    activeLogLevel = normalizeLogLevel(options.logLevel)
  }
}

/**
 * Logging settings from `<userData>/settings.json` (Settings → Advanced → Debug Logging).
 * Missing or unreadable file → defaults (enabled, level debug).
 */
function readSettings(userDataPath: string): Required<LoggerOptions> {
  let parsed: { loggingEnabled?: unknown; logLevel?: unknown } | null = null
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(userDataPath, 'settings.json'), 'utf-8'))
  } catch {
    parsed = null
  }
  return {
    loggingEnabled: parsed?.loggingEnabled !== false,
    logLevel: normalizeLogLevel(parsed?.logLevel),
  }
}

/**
 * Initialize the disk log under `<userDataPath>/Logs`. Idempotent (T0485): the first
 * successful call opens the log file and rotates old ones; later calls only apply the
 * settings. app-paths-bootstrap calls it right after userData is fixed; the call in
 * app.whenReady() is then a settings refresh.
 */
function init(userDataPath: string, options: LoggerOptions = {}): void {
  applySettings(options)
  if (initialized) {
    if (initializedUserDataPath !== userDataPath) {
      writeToFile('warn', [`[logger] init called again with a different userData (${userDataPath}); keeping ${initializedUserDataPath}`])
    }
    return
  }

  logsDirPath = path.join(userDataPath, LOGS_DIR_NAME)
  try {
    fs.mkdirSync(logsDirPath, { recursive: true })
  } catch (error) {
    logsDirPath = null
    console.error('[logger] Failed to create log directory:', error)
    return
  }
  initialized = true
  initializedUserDataPath = userDataPath

  moveLegacyDebugLog(userDataPath)
  if (loggingEnabled) ensureLogFilePath()
  cleanupOldLogs(MAX_LOG_FILES)
  writeToFile('info', [`[startup] Debug logging started. PID=${process.pid} argv=${process.argv.join(' ')}`])
}

function setConfig(options: LoggerOptions): void {
  const wasDisabled = !loggingEnabled
  applySettings(options)
  if (loggingEnabled && wasDisabled) ensureLogFilePath()
  writeToFile('info', [`[logging] config updated enabled=${loggingEnabled} level=${activeLogLevel}`])
}

function info(...args: unknown[]): void {
  console.info(...args)
  writeToFile('info', args)
}

function log(...args: unknown[]): void {
  console.log(...args)
  writeToFile('log', args)
}

function debug(...args: unknown[]): void {
  console.debug(...args)
  writeToFile('debug', args)
}

function warn(...args: unknown[]): void {
  console.warn(...args)
  writeToFile('warn', args)
}

function error(...args: unknown[]): void {
  echoingConsoleError = true
  try {
    console.error(...args)
  } finally {
    echoingConsoleError = false
  }
  writeToFile('error', args)
}

/**
 * T0485: also write every console.error call to the disk log while enabled. Used during
 * startup only: Electron reports an exception thrown while the main bundle loads with
 * console.error('App threw an error during load') — no uncaughtException is emitted —
 * and Node prints unhandled-rejection warnings the same way.
 */
function mirrorConsoleErrors(enabled: boolean): void {
  if (enabled) {
    if (consoleErrorMirror) return
    const state = {
      original: console.error,
      active: true,
      mirror: function (this: Console, ...args: unknown[]) {
        if (state.active && !echoingConsoleError) writeToFile('error', ['[console.error]', ...args])
        return state.original.apply(this, args)
      },
    }
    consoleErrorMirror = state
    console.error = state.mirror
    return
  }
  if (!consoleErrorMirror) return
  consoleErrorMirror.active = false
  // If something wrapped console.error on top of the mirror, leave the chain alone —
  // the inactive mirror is a plain pass-through.
  if (console.error === consoleErrorMirror.mirror) console.error = consoleErrorMirror.original
  consoleErrorMirror = null
}

function writeRenderer(level: unknown, args: unknown[]): void {
  const normalized = normalizeLogLevel(level)
  writeToFile(normalized, ['[RENDERER]', ...args])
}

function getLogsDir(): string {
  return logsDirPath || ''
}

function getInfo(): LoggingInfo {
  return {
    logsDir: getLogsDir(),
    currentLogFilePath: logFilePath,
    loggingEnabled,
    logLevel: activeLogLevel,
  }
}

export const logger = {
  init,
  readSettings,
  mirrorConsoleErrors,
  setConfig,
  cleanupOldLogs,
  writeRenderer,
  getLogsDir,
  getInfo,
  log,
  info,
  debug,
  warn,
  error,
  get enabled() { return loggingEnabled },
}
