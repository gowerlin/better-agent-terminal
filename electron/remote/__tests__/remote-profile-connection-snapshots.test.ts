/**
 * T0513 (BUG-123): `remote:profile-connection-states` — the Profile dialog's status
 * light from this machine's registry entry + live windows, and the push that lets
 * an open dialog follow connection changes.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  planProfileConnectionSnapshots,
  REMOTE_PROFILE_CONNECTIONS_CHANGED_CHANNEL,
  type RemoteProfileConnState,
} from '../remote-connect-plan'

function plan(input: {
  ids: Array<string | null | undefined>
  entries: Record<string, RemoteProfileConnState | null>
  windows?: Record<string, number>
}) {
  return planProfileConnectionSnapshots(
    input.ids,
    (id) => id in input.entries,
    (id) => input.entries[id] ?? null,
    (id) => input.windows?.[id] ?? 0,
  )
}

describe('planProfileConnectionSnapshots', () => {
  test('maps each registry entry to its link state and counts windows', () => {
    expect(plan({
      ids: ['a', 'b', 'c', 'd'],
      entries: {
        a: { isConnected: true, isReconnecting: false },
        b: { isConnected: false, isReconnecting: true },
        c: { isConnected: false, isReconnecting: false },
        d: null, // entry placeholder: first connect still running
      },
      windows: { a: 2, b: 1 },
    })).toEqual([
      { profileId: 'a', state: 'connected', windows: 2 },
      { profileId: 'b', state: 'reconnecting', windows: 1 },
      { profileId: 'c', state: 'disconnected', windows: 0 },
      { profileId: 'd', state: 'connecting', windows: 0 },
    ])
  })

  test('a profile with a window but no registry entry reports state null', () => {
    expect(plan({ ids: ['w'], entries: {}, windows: { w: 1 } })).toEqual([{ profileId: 'w', state: null, windows: 1 }])
  })

  test('skips duplicates and empty ids (registry ids + window registry profile ids overlap)', () => {
    const out = plan({
      ids: ['a', null, undefined, '', 'a', 'default'],
      entries: { a: { isConnected: true, isReconnecting: false } },
      windows: { a: 1, default: 1 },
    })
    expect(out.map(s => s.profileId)).toEqual(['a', 'default'])
  })
})

describe('wiring (source guard)', () => {
  const read = (rel: string) => readFileSync(path.resolve(__dirname, '../..', rel), 'utf8')

  test('main registers the local handler and pushes the change channel to every window', () => {
    const main = read('main.ts')
    expect(main).toMatch(/ipcMain\.handle\('remote:profile-connection-states'/)
    expect(main).toMatch(/for \(const win of getAllWindows\(\)\) \{\s*if \(!win\.isDestroyed\(\)\) win\.webContents\.send\(REMOTE_PROFILE_CONNECTIONS_CHANGED_CHANNEL\)/)
  })

  test('preload invokes / listens on the same channels', () => {
    const preload = read('preload.ts')
    expect(preload).toContain(`ipcRenderer.invoke('remote:profile-connection-states')`)
    expect(preload).toContain(`ipcRenderer.on('${REMOTE_PROFILE_CONNECTIONS_CHANGED_CHANNEL}', handler)`)
  })
})
