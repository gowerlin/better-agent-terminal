/**
 * T0864 (D288): `checkForUpdates` is on by default, and a `false` saved before this version is turned on
 * once. Earlier builds defaulted it to `false` and the renderer saves its whole in-memory copy, so the
 * `false` in most settings.json files was never the user's choice.
 *
 * The migration happens once: it writes `checkForUpdates: true` together with the marker
 * `checkForUpdatesMigrated: true`. With the marker present the saved value is used as is (a later `false`
 * the user sets stays off).
 *
 * The single rule for main (`parseUpdateSettings`, electron/update-checker.ts: reads only, never writes)
 * and the renderer (`settingsStore.load()`, which writes the migrated value back once). Pure: no
 * electron / DOM imports.
 */

/** The marker key in settings.json. Only `true` counts. */
export const CHECK_FOR_UPDATES_MIGRATED_KEY = 'checkForUpdatesMigrated'

export interface CheckForUpdatesResolution {
  /** The value in effect. */
  checkForUpdates: boolean
  /**
   * true → settings.json should be saved once with `checkForUpdates: true` and the marker. Only for a
   * settings object without the marker; an unreadable file / non-object is not rewritten here.
   */
  needsWrite: boolean
}

/**
 * `settings`: the object parsed from settings.json (anything else, e.g. null / an array / a string for an
 * unreadable or malformed file, gives the default: on, nothing to write).
 *
 * - no marker → on (whatever the file says), needs a write;
 * - marker → the saved value: only an explicit `false` is off (missing / non-boolean → on).
 */
export function resolveCheckForUpdates(settings: unknown): CheckForUpdatesResolution {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { checkForUpdates: true, needsWrite: false }
  }
  const record = settings as Record<string, unknown>
  if (record[CHECK_FOR_UPDATES_MIGRATED_KEY] !== true) return { checkForUpdates: true, needsWrite: true }
  return { checkForUpdates: record.checkForUpdates !== false, needsWrite: false }
}
