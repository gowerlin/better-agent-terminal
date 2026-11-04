/**
 * T0864 (D288): settingsStore.load() — `checkForUpdates` on by default, a `false` saved without the
 * marker migrated once and written back once (local, non-detached window only); with the marker the
 * saved value stays. Help › Check for Updates… does not read `checkForUpdates`.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Env {
  file: string | null
  detached?: string | null
  remoteConnected?: boolean
}

let file: string | null = null
let save: ReturnType<typeof vi.fn>
let log: ReturnType<typeof vi.fn>

function setup(env: Env): void {
  file = env.file
  save = vi.fn(async (data: string) => { file = data; return true })
  log = vi.fn()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log },
    settings: { load: vi.fn(async () => file), save },
    workspace: { getDetachedId: () => env.detached ?? null },
    remote: { clientStatus: vi.fn(async () => ({ connected: !!env.remoteConnected, info: null })) },
  }
}

/** A fresh store (the module keeps one instance). */
async function freshStore() {
  vi.resetModules()
  return (await import('../settings-store')).settingsStore
}

const savedJson = () => JSON.parse(file!) as Record<string, unknown>

beforeEach(() => {
  setup({ file: null })
})

describe('settingsStore checkForUpdates (T0864)', () => {
  it('default: on, with the marker (a new install keeps a later user-chosen false)', async () => {
    const store = await freshStore()
    expect(store.getSettings().checkForUpdates).toBe(true)
    expect(store.getSettings().checkForUpdatesMigrated).toBe(true)
    await store.load() // no settings.json
    expect(store.getSettings().checkForUpdates).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('false without the marker → on, written back once with the marker, then never again', async () => {
    setup({ file: JSON.stringify({ language: 'en', checkForUpdates: false }) })
    const store = await freshStore()
    await store.load()
    expect(store.getSettings().checkForUpdates).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
    expect(savedJson()).toMatchObject({ language: 'en', checkForUpdates: true, checkForUpdatesMigrated: true })
    expect(log).toHaveBeenCalledWith('[update-check] settings migrated: checkForUpdates on (written once)')
    // the log carries the result only, never the file
    for (const [message] of log.mock.calls) expect(String(message)).not.toContain('language')

    await store.load() // marker in the file now
    const fresh = await freshStore()
    await fresh.load()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('true / missing key without the marker → written back once too', async () => {
    for (const settings of [{ checkForUpdates: true }, { language: 'en' }]) {
      setup({ file: JSON.stringify(settings) })
      const store = await freshStore()
      await store.load()
      expect(store.getSettings().checkForUpdates).toBe(true)
      expect(save).toHaveBeenCalledTimes(1)
      expect(savedJson()).toMatchObject({ checkForUpdates: true, checkForUpdatesMigrated: true })
    }
  })

  it('marker present → the saved value as is (user turned it off), no write', async () => {
    setup({ file: JSON.stringify({ checkForUpdates: false, checkForUpdatesMigrated: true }) })
    const store = await freshStore()
    await store.load()
    expect(store.getSettings().checkForUpdates).toBe(false)
    expect(save).not.toHaveBeenCalled()

    setup({ file: JSON.stringify({ checkForUpdates: true, checkForUpdatesMigrated: true }) })
    const other = await freshStore()
    await other.load()
    expect(other.getSettings().checkForUpdates).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('after the migration the user turns it off: saved false + marker, the next load keeps it off', async () => {
    setup({ file: JSON.stringify({ checkForUpdates: false }) })
    const store = await freshStore()
    await store.load()
    store.setCheckForUpdates(false)
    await Promise.resolve()
    expect(savedJson()).toMatchObject({ checkForUpdates: false, checkForUpdatesMigrated: true })
    const next = await freshStore()
    await next.load()
    expect(next.getSettings().checkForUpdates).toBe(false)
    expect(save).toHaveBeenCalledTimes(2) // migration + the user's change, nothing more
  })

  it('malformed settings.json → defaults (on), no write', async () => {
    setup({ file: '{' })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = await freshStore()
    await store.load()
    errorSpy.mockRestore()
    expect(store.getSettings().checkForUpdates).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('detached window: migrated in memory, never writes', async () => {
    setup({ file: JSON.stringify({ checkForUpdates: false }), detached: 'ws-1' })
    const store = await freshStore()
    await store.load()
    expect(store.getSettings().checkForUpdates).toBe(true)
    expect(save).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('[update-check] settings migration: not written (detached window)')
  })

  it('remote window (settings from the remote host): migrated in memory, never writes', async () => {
    setup({ file: JSON.stringify({ checkForUpdates: false }), remoteConnected: true })
    const store = await freshStore()
    await store.load()
    expect(store.getSettings().checkForUpdates).toBe(true)
    expect(save).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('[update-check] settings migration: not written (remote window)')
  })

  it('a failed write does not fail load()', async () => {
    setup({ file: JSON.stringify({ checkForUpdates: false }) })
    save.mockRejectedValueOnce(new Error('disk full'))
    const store = await freshStore()
    await expect(store.load()).resolves.toBeUndefined()
    expect(store.getSettings().checkForUpdates).toBe(true)
    expect(log).toHaveBeenCalledWith('[update-check] settings migration: write failed: disk full')
  })

  it('Help › Check for Updates… reads includePrereleaseUpdates only; main.ts never writes settings for the migration', () => {
    const main = readFileSync(join(__dirname, '..', '..', '..', 'electron', 'main.ts'), 'utf8')
    const manual = main.slice(main.indexOf('function runManualUpdateCheck'), main.indexOf('function runManualUpdateCheck') + 600)
    expect(manual).toContain('const { includePrereleaseUpdates } = readUpdateSettings()')
    expect(manual).not.toContain('checkForUpdates: enabled')
    expect(main).not.toContain('checkForUpdatesMigrated')
  })
})
