// @vitest-environment node
/**
 * BUG-210 / T0825 (D268): a BAT instance that did not get the single-instance lock hands its argv to the
 * running BAT (`second-instance`) and runs none of the whenReady startup. Its `app.quit()` at the lock check
 * runs before ready and does not stop the whenReady callback (T0823 e2e-measured), so the callback itself
 * returns first. Behavior is measured in e2e/t0825-second-instance-startup.spec.ts; these are source guards.
 */
import * as fs from 'fs'
import * as path from 'path'
import { describe, expect, it } from 'vitest'

const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf8')
const READY = 'app.whenReady().then(async () => {'
const GUARD = 'if (!gotTheLock || installerQuitRequestProcess) {'
const LOG_LINE = "logger.log('[startup] second instance: handed off to the running BAT, skipping startup')"

/** The whenReady callback's body with comment-only lines and blank lines removed. */
function readyBodyCode(): string[] {
  const start = main.indexOf(READY) + READY.length
  return main
    .slice(start, start + 4000)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
}

describe('BUG-210: second instance skips whenReady startup', () => {
  it('main.ts has exactly one whenReady / ready hook (no startup path around the guard)', () => {
    expect(main.split('app.whenReady()').length - 1).toBe(1)
    expect(main).not.toMatch(/app\.(on|once)\(\s*'ready'/)
  })

  it('the lock check still quits the second instance; the lock is taken before whenReady', () => {
    const lock = main.indexOf('const gotTheLock = app.requestSingleInstanceLock()')
    expect(lock).toBeGreaterThan(0)
    expect(main.slice(lock, lock + 500)).toMatch(/if \(!gotTheLock\) \{[\s\S]*?app\.quit\(\)\n\}/)
    expect(main.indexOf(READY)).toBeGreaterThan(lock)
  })

  it('the guard is the first statement of the whenReady callback; it logs (no argv) and returns', () => {
    const code = readyBodyCode()
    expect(code.slice(0, 4)).toEqual([
      GUARD,
      `if (!gotTheLock) ${LOG_LINE}`,
      'return',
      '}',
    ])
    expect(LOG_LINE).not.toMatch(/argv|\$\{/)
  })

  it('the guard runs before every startup step (logger re-init, tray, upgrade check, Terminal Server, windows)', () => {
    const ready = main.indexOf(READY)
    const guard = main.indexOf(GUARD, ready)
    expect(guard).toBeGreaterThan(ready)
    for (const step of [
      'logger.init(app.getPath(\'userData\'), readLoggingConfigSync())',
      "logger.log(`[startup] app.whenReady fired at",
      'rotateBatScriptsLog(',
      'crashReporter.start(',
      'tray = new Tray(trayIcon)',
      'upgradeInterruptionCheck = new UpgradeInterruptionCheck(',
      'upgradeInterruptionCheck.begin()',
      'takeInstallerQuitRecord(',
      'await startTerminalServer()',
      "app.on('second-instance', async (_event, argv) => {",
      'installerQuit.markReady()',
    ]) {
      const at = main.indexOf(step, ready)
      expect(at, step).toBeGreaterThan(guard)
    }
  })

  it('T0823 unchanged: the request process holding the lock still only stops a kept server and exits', () => {
    expect(main).toContain('const installerQuitWithoutApp = gotTheLock && installerQuitRequestProcess')
    const flag = main.indexOf('if (installerQuitWithoutApp) {')
    expect(flag).toBeGreaterThan(0)
    expect(flag).toBeLessThan(main.indexOf(READY))
    expect(main.slice(flag, flag + 1600)).toContain('.finally(() => app.exit(0))')
  })
})
