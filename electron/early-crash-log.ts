// T0485: puts startup crashes into the disk log before main.ts's own handlers exist.
//
// app-paths-bootstrap installs this right after logger.init, i.e. before every other
// module body of the main bundle. It must not change how a crash is handled:
//   - 'uncaughtExceptionMonitor' is used instead of 'uncaughtException'. A monitor is
//     not counted by process.listenerCount('uncaughtException'), so Electron's default
//     handler still shows its "A JavaScript error occurred in the main process" dialog.
//   - No early 'unhandledRejection' listener: Electron 41 runs in warn mode, and adding
//     a listener would suppress Node's UnhandledPromiseRejectionWarning. The warning is
//     printed with console.error, which the console mirror below writes to disk.
//   - An exception thrown while the bundle loads never reaches either event: Electron
//     catches it and prints console.error('App threw an error during load') + the stack,
//     then keeps running without a window. The console mirror is what records it.
//
// Hand-off: main.ts calls handOffEarlyCrashCapture() where it registers its own
// uncaughtException / unhandledRejection handlers (they log from then on, so the monitor
// would only duplicate them), and endEarlyCrashCapture() in app.whenReady() once the
// bundle has loaded.
// Keep the imports to ./logger — see app-paths-bootstrap-order.test.ts.
import { logger } from './logger'

type CrashProcess = Pick<NodeJS.Process, 'on' | 'removeListener'>

let monitor: ((error: unknown, origin: string) => void) | null = null
let monitoredProcess: CrashProcess | null = null

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message
  return String(error)
}

export function installEarlyCrashCapture(proc: CrashProcess = process): void {
  if (!monitor) {
    monitor = (error: unknown, origin: string) => {
      // Same filter as main.ts's handler: EPIPE from killed subprocess pipes is noise.
      if ((error as NodeJS.ErrnoException | null)?.code === 'EPIPE') return
      logger.error(`[CRASH] early ${origin}: ${describeError(error)}`)
    }
    monitoredProcess = proc
    proc.on('uncaughtExceptionMonitor', monitor)
  }
  logger.mirrorConsoleErrors(true)
}

/** main.ts registered its own process handlers — stop the monitor (avoids duplicates). */
export function handOffEarlyCrashCapture(): void {
  if (monitor && monitoredProcess) monitoredProcess.removeListener('uncaughtExceptionMonitor', monitor)
  monitor = null
  monitoredProcess = null
}

/** The main bundle has loaded (app.whenReady fired) — stop all early capture. */
export function endEarlyCrashCapture(): void {
  handOffEarlyCrashCapture()
  logger.mirrorConsoleErrors(false)
}
