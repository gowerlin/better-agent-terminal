// @vitest-environment node
/**
 * T0485: early crash capture (installed by app-paths-bootstrap, before every other
 * module body). It must write to the disk log without changing how a crash is handled:
 * no 'uncaughtException' / 'unhandledRejection' listener is added.
 */
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type LoggerModule = typeof import('../logger')
type CaptureModule = typeof import('../early-crash-log')

let userData: string
let logger: LoggerModule['logger']
let capture: CaptureModule
let proc: EventEmitter

function logText(): string {
  const dir = path.join(userData, 'Logs')
  const files = fs.readdirSync(dir).filter(n => n.startsWith('debug-') && n.endsWith('.log'))
  expect(files).toHaveLength(1)
  return fs.readFileSync(path.join(dir, files[0]), 'utf-8')
}

beforeEach(async () => {
  vi.resetModules()
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0485-crash-'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  logger = (await import('../logger')).logger
  capture = await import('../early-crash-log')
  logger.init(userData)
  proc = new EventEmitter()
})

afterEach(() => {
  capture.endEarlyCrashCapture()
  vi.restoreAllMocks()
  fs.rmSync(userData, { recursive: true, force: true })
})

describe('early crash capture', () => {
  it('registers only an uncaughtExceptionMonitor (Electron keeps its default dialog)', () => {
    capture.installEarlyCrashCapture(proc as unknown as NodeJS.Process)
    expect(proc.listenerCount('uncaughtExceptionMonitor')).toBe(1)
    expect(proc.listenerCount('uncaughtException')).toBe(0)
    expect(proc.listenerCount('unhandledRejection')).toBe(0)
  })

  it('the monitor writes the crash to the disk log; EPIPE is ignored like main.ts does', () => {
    capture.installEarlyCrashCapture(proc as unknown as NodeJS.Process)
    proc.emit('uncaughtExceptionMonitor', new Error('t0485-early-crash'), 'uncaughtException')
    const epipe = Object.assign(new Error('t0485-epipe'), { code: 'EPIPE' })
    proc.emit('uncaughtExceptionMonitor', epipe, 'uncaughtException')
    proc.emit('uncaughtExceptionMonitor', 'not-an-error', 'unhandledRejection')

    const text = logText()
    expect(text).toContain('[CRASH] early uncaughtException: Error: t0485-early-crash')
    expect(text).toContain('[CRASH] early unhandledRejection: not-an-error')
    expect(text).not.toContain('t0485-epipe')
    // logger.error's own console echo is not mirrored a second time
    expect(text.match(/t0485-early-crash/g)).toHaveLength(1)
  })

  it('hand-off removes the monitor but keeps mirroring console.error until the end', () => {
    capture.installEarlyCrashCapture(proc as unknown as NodeJS.Process)
    capture.handOffEarlyCrashCapture()
    expect(proc.listenerCount('uncaughtExceptionMonitor')).toBe(0)
    proc.emit('uncaughtExceptionMonitor', new Error('t0485-after-handoff'), 'uncaughtException')
    console.error('t0485-still-mirrored')
    capture.endEarlyCrashCapture()
    console.error('t0485-after-end')

    const text = logText()
    expect(text).not.toContain('t0485-after-handoff')
    expect(text).toContain('t0485-still-mirrored')
    expect(text).not.toContain('t0485-after-end')
  })

  it('import-time throw of a later module ends up in the disk log', async () => {
    capture.installEarlyCrashCapture(proc as unknown as NodeJS.Process)
    // Electron 41 catches an exception thrown while the main bundle loads and reports it
    // with console.error (no uncaughtException; probe in the T0485 report). Emulate that
    // report for a fake module that throws in its body.
    let thrown: unknown
    try {
      await import('./fixtures/t0485-throwing-module')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(Error)
    console.error('App threw an error during load')
    console.error((thrown as Error).stack)

    const text = logText()
    expect(text).toContain('[console.error] App threw an error during load')
    expect(text).toContain('t0485 fake module failed at import')
    expect(text).toContain('t0485-throwing-module')
  })
})
