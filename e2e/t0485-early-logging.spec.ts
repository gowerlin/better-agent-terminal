// T0485: the disk log starts in app-paths-bootstrap (before app ready) and the second
// logger.init in app.whenReady() only refreshes settings — one launch, one log file.
// Only isolated e2e runtimes are used.
// Run: `npx vite build` then `npx playwright test e2e/t0485-early-logging.spec.ts`.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

const log = testLogger('t0485')

test('one launch writes exactly one log file, opened before app ready', async () => {
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0485-log', log)
    const logsDir = path.join(inst.userData, 'Logs')
    await expect.poll(() => {
      try {
        return fs.readFileSync(path.join(logsDir, fs.readdirSync(logsDir)[0]), 'utf-8').includes('app.whenReady fired')
      } catch {
        return false
      }
    }, { message: 'whenReady line in the log', timeout: 20_000 }).toBe(true)

    const files = fs.readdirSync(logsDir)
    log(`Logs/: ${files.join(', ')}`)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^debug-\d{8}-\d{6}\.log$/)

    const text = fs.readFileSync(path.join(logsDir, files[0]), 'utf-8')
    const started = text.indexOf('[startup] Debug logging started')
    const migration = text.indexOf('[userdata-migration]')
    const ready = text.indexOf('app.whenReady fired')
    log(`offsets: startup=${started} userdata-migration=${migration} whenReady=${ready}`)
    expect(text.match(/\[startup\] Debug logging started/g)).toHaveLength(1)
    expect(started).toBeGreaterThanOrEqual(0)
    expect(migration).toBeGreaterThan(started)
    expect(ready).toBeGreaterThan(migration)

    const info = await inst.win.evaluate(async () => (window as unknown as {
      electronAPI: { settings: { getLoggingInfo(): Promise<{ logsDir: string; currentLogFilePath: string | null }> } }
    }).electronAPI.settings.getLoggingInfo())
    expect(info.logsDir).toBe(logsDir)
    expect(info.currentLogFilePath).toBe(path.join(logsDir, files[0]))

    const mirrored = text.split('\n').filter(line => line.includes('[console.error]'))
    log(`console.error lines mirrored before app ready: ${mirrored.length}`)
    for (const line of mirrored.slice(0, 5)) log(`  ${line.slice(0, 200)}`)
  } finally {
    await closeIsolated(inst, log)
  }
})
