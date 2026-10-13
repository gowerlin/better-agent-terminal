// BUG-119 / T0480: fixes the userData directory before any other module runs.
//
// Must stay the FIRST import of main.ts. Rollup places every imported module's
// body ahead of main.ts's own body, so code written in main.ts runs after all of
// its imports. Chromium caches userData on the first getPath('userData') using the
// app name of that moment (package.json `name` = better-agent-terminal), so a
// module reading it at import time used to split the data across two directories.
//
// Keep the imports to electron / path / ./userdata-migration — importing anything
// else from electron/ risks pulling in a module that reads getPath at import time.
// Order: setName -> runtime id -> sync migration -> explicit setPath('userData').
// The migration runs before app ready on purpose: `Local State` (safeStorage key)
// must be in place before Chromium reads it.
import { app } from 'electron'
import * as path from 'path'
import {
  migrateUserData,
  parseRuntimeId,
  runtimeSuffix,
  targetUserDataDir,
  TARGET_DIR_NAME,
  type MigrationReport,
} from './userdata-migration'

app.setName(TARGET_DIR_NAME)

// --runtime=N or BAT_RUNTIME=N: independent instances with separate data directories
// (each runtime gets its own userData and single-instance lock).
export const runtimeId: string | undefined = parseRuntimeId(process.argv, process.env)

function resolveUserData(): MigrationReport {
  const suffix = runtimeSuffix(runtimeId)
  try {
    // migrateUserData never throws; this only guards getPath('appData').
    return migrateUserData({ appData: app.getPath('appData'), suffix })
  } catch (err) {
    // setName already ran, so this is <appData>/BetterAgentTerminal.
    const target = targetUserDataDir(path.dirname(app.getPath('userData')), suffix)
    return {
      userData: target,
      legacyDir: '',
      targetDir: target,
      items: [{ name: 'migration', result: 'failed', level: 'error', detail: err instanceof Error ? err.message : String(err) }],
    }
  }
}

export const migrationReport: MigrationReport = resolveUserData()
app.setPath('userData', migrationReport.userData)
export const resolvedUserData: string = migrationReport.userData
