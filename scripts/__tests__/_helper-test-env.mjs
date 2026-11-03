// T0808 / BUG-208: the temp log dir for tests that run a helper (bat-terminal / bat-notify /
// bat-mcp / bat-hook). Every helper run is logged to bat-scripts.log, `--help` / `--version`
// included; without BAT_HELPER_LOG_DIR / BAT_USER_DATA the helper falls back to the legacy
// userData guess (%APPDATA% / ~/.config / ~/Library/Application Support) and writes into the
// user's real log. Spread helperLogEnv() under the test's own env (the test's values win).
// Not a test file (no `.test.`).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let logRoot = null

/** One temp userData dir per test process, created on first use. */
export function helperLogDir() {
  if (!logRoot) logRoot = mkdtempSync(join(tmpdir(), 'bat-helper-test-log-'))
  return logRoot
}

/** `{ BAT_HELPER_LOG_DIR, BAT_USER_DATA }` pointing at helperLogDir(). */
export function helperLogEnv() {
  const dir = helperLogDir()
  return { BAT_HELPER_LOG_DIR: join(dir, 'Logs'), BAT_USER_DATA: dir }
}

/** Removes helperLogDir() (call from afterAll); the next helperLogEnv() makes a new one. */
export function cleanupHelperLogDir() {
  if (logRoot) rmSync(logRoot, { recursive: true, force: true })
  logRoot = null
}
