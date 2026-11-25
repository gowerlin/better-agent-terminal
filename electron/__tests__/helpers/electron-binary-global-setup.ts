/**
 * T0898 / BUG-218: vitest globalSetup — fetch the Electron binary once, before any test worker starts.
 *
 * Electron 42+ has no postinstall (T0784): `npm ci` leaves `node_modules/electron` without
 * `path.txt` / `dist/`, and its `index.js` downloads the binary on the first `require('electron')`
 * with a synchronous `spawnSync(install.js)`. Some test files load modules that `require('electron')`
 * unmocked (`remote-server.ts` `resolveBundleVersion`, `secrets.ts` `tryLoadElectronSafeStorage`),
 * so in a fresh checkout the first full `npm run test:unit` had 11 workers extracting the same binary
 * at once, each blocking its own event loop: 11 parallel `install.js` took 22–25 s each (one alone
 * 2.3 s, zip already in the electron cache), and the RemoteServer / headless e2e files failed with
 * `Hook timed out in 10000ms` (their harness starts in a median 87 ms / max 273 ms once the binary is
 * there). CI fetches the binary in its own step before the tests (`tests.yml`); this does the same
 * for local runs, once, so no worker ever downloads.
 *
 * The download condition mirrors `node_modules/electron/index.js` exactly; when the binary is already
 * there (CI, second run) this only reads two paths. A failed download only warns: the run goes on as
 * it did before (a worker's `require('electron')` tries again), it is never a new failure.
 */
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..', '..')
const INSTALL_TIMEOUT_MS = 10 * 60_000

/** Would `node_modules/electron/index.js` download the binary on its first require? */
export function electronBinaryNeedsDownload(
  electronPkgDir: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.ELECTRON_OVERRIDE_DIST_PATH) return false
  const pathFile = path.join(electronPkgDir, 'path.txt')
  if (!fs.existsSync(pathFile)) return true
  const executablePath = fs.readFileSync(pathFile, 'utf-8')
  if (!executablePath) return true
  return !fs.existsSync(path.join(electronPkgDir, 'dist', executablePath))
}

/** `node_modules/electron`, or null when the package is not installed. */
export function resolveElectronPkgDir(root: string = ROOT): string | null {
  try {
    return path.dirname(createRequire(path.join(root, 'package.json')).resolve('electron/package.json'))
  } catch {
    return null
  }
}

export default function setup(): void {
  const pkgDir = resolveElectronPkgDir()
  if (!pkgDir || !electronBinaryNeedsDownload(pkgDir)) return
  const started = Date.now()
  console.log('[T0898] Electron binary missing: running electron/install.js once before the test workers start')
  const result = spawnSync(process.execPath, [path.join(pkgDir, 'install.js')], {
    stdio: 'inherit',
    timeout: INSTALL_TIMEOUT_MS,
  })
  if (result.status === 0 && !electronBinaryNeedsDownload(pkgDir)) {
    console.log(`[T0898] Electron binary ready (${Date.now() - started} ms)`)
    return
  }
  const reason = result.error ? result.error.message : `exit ${result.status ?? result.signal}`
  console.warn(`[T0898] electron/install.js failed (${reason}); test files that require('electron') will try again on their own`)
}
