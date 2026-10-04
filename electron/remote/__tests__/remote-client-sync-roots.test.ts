// @vitest-environment node
/**
 * T0406 (PLAN-036 P2-I): client side of `workspace:sync-roots`.
 *
 * A real `RemoteClient` (WSL profile ⇒ WslPathTranslator) connects to an
 * in-process headless server whose `workspace:sync-roots` is replaced by a spy,
 * so the test sees exactly what reaches the server:
 *   - roots are pushed after every auth (first connect and each new connection),
 *     converted once: `\\wsl.localhost\Ubuntu-24.04\home\x` → `/home/x`
 *   - `syncWorkspaceRoots()` re-pushes the provider's current roots (workspace:save / load)
 *   - no provider ⇒ nothing is pushed; local windows never trigger a push
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ProfileEntry } from '../../profile-manager'
import type { HandlerContext } from '../handler-registry'
import { RemoteClient, collectWorkspaceRoots, shouldSyncWorkspaceRoots } from '../remote-client'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const UNC_HOME = '\\\\wsl.localhost\\Ubuntu-24.04\\home\\x'
const WIN_PROJ = 'C:\\Users\\x\\proj'

const pushes: Array<{ connectionId: string | null | undefined; roots: unknown }> = []
let harness: HeadlessHarness

const wslProfile: ProfileEntry = {
  id: 'p-wsl',
  name: 'WSL',
  type: 'remote',
  targetOS: 'wsl-linux',
  wslDistro: 'Ubuntu-24.04',
  createdAt: 0,
  updatedAt: 0,
}

beforeAll(async () => {
  harness = await startHeadlessHarness({
    timeoutMs: 15_000,
    handlers: [{
      channel: 'workspace:sync-roots',
      handler: (ctx: HandlerContext, roots: unknown) => {
        pushes.push({ connectionId: ctx.connectionId, roots })
        return { ok: true, roots: Array.isArray(roots) ? roots : [], rejected: [] }
      },
    }],
  })
}, 60_000)

afterAll(async () => {
  await harness?.dispose()
})

async function connect(client: RemoteClient) {
  const result = await client.connect('127.0.0.1', harness.port, harness.token, 'T0406 client', harness.fingerprint)
  expect(result.ok, result.error).toBe(true)
}

describe('RemoteClient workspace roots push', () => {
  it('pushes server-form roots right after auth, again on every new connection', async () => {
    pushes.length = 0
    const client = new RemoteClient(() => [], wslProfile)
    let roots = [UNC_HOME, WIN_PROJ]
    client.setWorkspaceRootsProvider(() => roots)
    try {
      await connect(client)
      await expect.poll(() => pushes.length, { timeout: 5_000 }).toBe(1)
      expect(pushes[0].roots).toEqual(['/home/x', '/mnt/c/Users/x/proj'])
      expect(typeof pushes[0].connectionId).toBe('string')

      // workspace:save / workspace:load of a bound window → main calls syncWorkspaceRoots()
      roots = [UNC_HOME]
      const result = await client.syncWorkspaceRoots()
      expect(result).toEqual({ ok: true, roots: ['/home/x'], rejected: [] })
      expect(pushes[1]).toEqual({ connectionId: pushes[0].connectionId, roots: ['/home/x'] })

      // a new connection starts empty on the server ⇒ pushed again after its auth
      await client.disconnect()
      await connect(client)
      await expect.poll(() => pushes.length, { timeout: 5_000 }).toBe(3)
      expect(pushes[2].roots).toEqual(['/home/x'])
      expect(pushes[2].connectionId).not.toBe(pushes[0].connectionId)
    } finally {
      await client.disconnect()
    }
  })

  it('pushes nothing without a provider (e.g. remote:test-connection clients)', async () => {
    pushes.length = 0
    const client = new RemoteClient(() => [], wslProfile)
    try {
      await connect(client)
      expect(await client.syncWorkspaceRoots()).toBeNull()
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(pushes).toEqual([])
    } finally {
      await client.disconnect()
    }
  })

  it('is best effort: not connected ⇒ null, no throw', async () => {
    const client = new RemoteClient(() => [], wslProfile)
    client.setWorkspaceRootsProvider(() => [UNC_HOME])
    expect(await client.syncWorkspaceRoots()).toBeNull()
  })
})

describe('collectWorkspaceRoots / shouldSyncWorkspaceRoots (main.ts gate)', () => {
  const entries = [
    { profileId: 'p-wsl', workspaces: [{ folderPath: UNC_HOME }, { folderPath: WIN_PROJ }, { folderPath: '' }, null] },
    { profileId: 'default', workspaces: [{ folderPath: 'D:\\local\\only' }] },
    { profileId: 'p-wsl', workspaces: [{ folderPath: UNC_HOME }, { name: 'no folder' }] },
    { profileId: 'p-wsl' },
  ]

  it('collects the bound profile\'s folderPaths, deduplicated, client form', () => {
    expect(collectWorkspaceRoots(entries, 'p-wsl')).toEqual([UNC_HOME, WIN_PROJ])
    expect(collectWorkspaceRoots(entries, 'default')).toEqual(['D:\\local\\only'])
    expect(collectWorkspaceRoots(entries, null)).toEqual([])
  })

  it('only a connected window of the bound remote profile pushes; local windows never do', () => {
    expect(shouldSyncWorkspaceRoots('p-wsl', 'p-wsl', true)).toBe(true)
    expect(shouldSyncWorkspaceRoots('default', 'p-wsl', true)).toBe(false) // local window
    expect(shouldSyncWorkspaceRoots('p-wsl', 'p-wsl', false)).toBe(false) // not connected
    expect(shouldSyncWorkspaceRoots(null, null, true)).toBe(false)
    expect(shouldSyncWorkspaceRoots('default', null, false)).toBe(false) // no remote client at all
  })
})
