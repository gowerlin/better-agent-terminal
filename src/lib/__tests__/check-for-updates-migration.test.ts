/**
 * T0864 (D288): `checkForUpdates` on by default, a `false` saved before the marker migrated once.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { CHECK_FOR_UPDATES_MIGRATED_KEY, resolveCheckForUpdates } from '../check-for-updates-migration'

describe('resolveCheckForUpdates', () => {
  it('the marker key', () => {
    expect(CHECK_FOR_UPDATES_MIGRATED_KEY).toBe('checkForUpdatesMigrated')
  })

  it('no marker → on and written back, whatever the file says', () => {
    expect(resolveCheckForUpdates({})).toEqual({ checkForUpdates: true, needsWrite: true })
    expect(resolveCheckForUpdates({ checkForUpdates: false })).toEqual({ checkForUpdates: true, needsWrite: true })
    expect(resolveCheckForUpdates({ checkForUpdates: true })).toEqual({ checkForUpdates: true, needsWrite: true })
    expect(resolveCheckForUpdates({ checkForUpdates: 'no' })).toEqual({ checkForUpdates: true, needsWrite: true })
  })

  it('only a marker of true counts', () => {
    for (const marker of [false, 'true', 1, null]) {
      expect(resolveCheckForUpdates({ checkForUpdates: false, checkForUpdatesMigrated: marker })).toEqual({ checkForUpdates: true, needsWrite: true })
    }
  })

  it('marker → the saved value (only an explicit false is off), nothing to write', () => {
    expect(resolveCheckForUpdates({ checkForUpdates: false, checkForUpdatesMigrated: true })).toEqual({ checkForUpdates: false, needsWrite: false })
    expect(resolveCheckForUpdates({ checkForUpdates: true, checkForUpdatesMigrated: true })).toEqual({ checkForUpdates: true, needsWrite: false })
    expect(resolveCheckForUpdates({ checkForUpdatesMigrated: true })).toEqual({ checkForUpdates: true, needsWrite: false })
    expect(resolveCheckForUpdates({ checkForUpdates: 0, checkForUpdatesMigrated: true })).toEqual({ checkForUpdates: true, needsWrite: false })
  })

  it('unreadable file / not an object → on, nothing to write', () => {
    for (const value of [null, undefined, '', 'text', 42, true, [], [{ checkForUpdates: false }]]) {
      expect(resolveCheckForUpdates(value)).toEqual({ checkForUpdates: true, needsWrite: false })
    }
  })

  it('pure: no electron / DOM imports', () => {
    const source = readFileSync(join(__dirname, '..', 'check-for-updates-migration.ts'), 'utf8')
    expect(source).not.toMatch(/from 'electron'|window\.|document\./)
  })
})
