// @vitest-environment node
/**
 * T0485: logger.init runs twice at startup — in app-paths-bootstrap and again in
 * app.whenReady(). The second call must only re-apply the settings (one log file, no
 * second rotation). The console.error mirror records startup errors that never reach
 * the logger (Electron's load-error report, Node's rejection warnings).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type LoggerModule = typeof import('../logger')

let userData: string
let mod: LoggerModule

function logFiles(): string[] {
  const dir = path.join(userData, 'Logs')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n.startsWith('debug-') && n.endsWith('.log')) : []
}

function logText(): string {
  const files = logFiles()
  expect(files).toHaveLength(1)
  return fs.readFileSync(path.join(userData, 'Logs', files[0]), 'utf-8')
}

beforeEach(async () => {
  vi.resetModules()
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0485-logger-'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  mod = await import('../logger')
})

afterEach(() => {
  mod.logger.mirrorConsoleErrors(false)
  vi.restoreAllMocks()
  fs.rmSync(userData, { recursive: true, force: true })
})

describe('logger.init idempotency', () => {
  it('second init keeps the same file, does not rotate again, and re-applies the settings', () => {
    const { logger } = mod
    logger.init(userData, { loggingEnabled: true, logLevel: 'debug' })
    const first = logger.getInfo().currentLogFilePath
    expect(first).toBeTruthy()

    logger.init(userData, { loggingEnabled: true, logLevel: 'warn' })
    expect(logger.getInfo().currentLogFilePath).toBe(first)
    expect(logger.getInfo().logLevel).toBe('warn')
    logger.log('t0485-filtered-out')
    logger.warn('t0485-kept')

    const text = logText()
    expect(text.match(/\[startup\] Debug logging started/g)).toHaveLength(1)
    expect(text).not.toContain('t0485-filtered-out')
    expect(text).toContain('t0485-kept')
  })

  it('a second init with a different userData keeps the first and logs a warning', () => {
    const { logger } = mod
    logger.init(userData)
    const other = path.join(userData, 'elsewhere')
    logger.init(other)
    expect(logger.getLogsDir()).toBe(path.join(userData, 'Logs'))
    expect(fs.existsSync(other)).toBe(false)
    expect(logText()).toContain('init called again with a different userData')
  })

  it('init retries when the first attempt could not create Logs/', () => {
    const { logger } = mod
    const blocked = path.join(userData, 'blocked')
    fs.writeFileSync(blocked, 'not a directory')
    logger.init(blocked)
    expect(logger.getLogsDir()).toBe('')
    logger.init(userData)
    expect(logger.getLogsDir()).toBe(path.join(userData, 'Logs'))
    expect(logFiles()).toHaveLength(1)
  })

  it('loggingEnabled=false at the first init opens no file', () => {
    const { logger } = mod
    logger.init(userData, { loggingEnabled: false })
    logger.error('t0485-not-written')
    expect(logFiles()).toHaveLength(0)
  })
})

describe('logger.readSettings', () => {
  it('reads loggingEnabled / logLevel from settings.json', () => {
    fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ loggingEnabled: false, logLevel: 'info', other: 1 }))
    expect(mod.logger.readSettings(userData)).toEqual({ loggingEnabled: false, logLevel: 'info' })
  })

  it('defaults to enabled / debug when the file is missing, broken, or has an unknown level', () => {
    expect(mod.logger.readSettings(userData)).toEqual({ loggingEnabled: true, logLevel: 'debug' })
    fs.writeFileSync(path.join(userData, 'settings.json'), '{not json')
    expect(mod.logger.readSettings(userData)).toEqual({ loggingEnabled: true, logLevel: 'debug' })
    fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ logLevel: 'verbose' }))
    expect(mod.logger.readSettings(userData)).toEqual({ loggingEnabled: true, logLevel: 'debug' })
  })
})

describe('logger.mirrorConsoleErrors', () => {
  it('writes console.error calls to disk while enabled and still calls the original', () => {
    const { logger } = mod
    const original = console.error
    logger.init(userData)
    logger.mirrorConsoleErrors(true)
    console.error('App threw an error during load')
    console.error('Error: t0485-load\n    at fake (fake.js:1:1)')
    expect(original).toHaveBeenCalledWith('App threw an error during load')
    logger.mirrorConsoleErrors(false)
    expect(console.error).toBe(original)
    console.error('t0485-after-mirror')

    const text = logText()
    expect(text).toContain('[ERROR] [console.error] App threw an error during load')
    expect(text).toContain('Error: t0485-load')
    expect(text).not.toContain('t0485-after-mirror')
  })

  it('does not log logger.error twice', () => {
    const { logger } = mod
    logger.init(userData)
    logger.mirrorConsoleErrors(true)
    logger.error('t0485-once')
    expect(logText().match(/t0485-once/g)).toHaveLength(1)
  })

  it('disabling leaves a wrapper installed on top alone (mirror becomes a pass-through)', () => {
    const { logger } = mod
    logger.init(userData)
    logger.mirrorConsoleErrors(true)
    const mirror = console.error
    const outer = vi.fn((...args: unknown[]) => mirror(...args))
    console.error = outer
    logger.mirrorConsoleErrors(false)
    expect(console.error).toBe(outer)
    console.error('t0485-pass-through')
    expect(logText()).not.toContain('t0485-pass-through')
  })
})
