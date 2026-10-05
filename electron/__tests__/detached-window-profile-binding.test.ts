/**
 * T0446 (BUG-112): a workspace detached from a remote-profile window used to have
 * no profile binding at all (it is not in windowMap, so getWindowIdByWebContents
 * returned null) — every proxied call ran on this machine, and remote events never
 * reached it. A detached window now acts for its parent window's profile, falls
 * back to the binding recorded at detach time once the parent is gone, and fails
 * closed when neither is known.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  UNRESOLVED_DETACHED_PROFILE_ID,
  detachedSenderRouteIdentity,
  planProfileProxiedInvokeRoute,
  resolveDetachedProfileBinding,
  senderBindingProfileId,
  type DetachedWindowRecord,
  type RemoteProfileConnState,
  type SenderProfileBinding,
} from '../remote/remote-connect-plan'

const P = 'remote-P'
const L = 'local-L'

/** T0463 (PLAN-039): the registry's entries (profile id → its own client's state). */
type Conns = Record<string, RemoteProfileConnState>
const slots: Record<string, Conns> = {
  'P connected': { [P]: { isConnected: true, isReconnecting: false } },
  'P reconnecting': { [P]: { isConnected: false, isReconnecting: true } },
  'P gave up': { [P]: { isConnected: false, isReconnecting: false } },
  'only Q connected': { 'remote-Q': { isConnected: true, isReconnecting: false } },
  'empty': {},
}

const recorded = (profileId: string | null, resolved = true): DetachedWindowRecord => ({ parentWindowId: 'win-1', profileId, resolved })

/** The whole detached-window decision: binding → identity → T0443 route on the bound profile's own entry. */
function routeDetached(
  record: DetachedWindowRecord | undefined,
  parentProfileId: string | null | undefined,
  profileType: 'local' | 'remote' | null,
  conns: Conns,
) {
  const binding = resolveDetachedProfileBinding(record, parentProfileId)
  const identity = detachedSenderRouteIdentity(binding, profileType)
  const conn = identity.senderProfileId ? conns[identity.senderProfileId] ?? null : null
  return planProfileProxiedInvokeRoute({ ...identity, conn })
}

describe('resolveDetachedProfileBinding (T0446)', () => {
  const bound = (profileId: string | null): SenderProfileBinding => ({ kind: 'bound', profileId })
  it.each([
    ['parent alive, bound to P', recorded(P), P, bound(P)],
    ['parent alive, bound to P, record unresolved', recorded(null, false), P, bound(P)],
    ['parent alive, no binding (local window)', recorded(null), null, bound(null)],
    ['parent alive but unbound, recorded P → never downgraded to local', recorded(P), null, bound(P)],
    ['parent closed → recorded P', recorded(P), undefined, bound(P)],
    ['parent closed → recorded local L', recorded(L), undefined, bound(L)],
    ['parent closed → recorded "no binding"', recorded(null), undefined, bound(null)],
    ['parent alive, entry unreadable → recorded P', recorded(P), undefined, bound(P)],
    ['parent alive unbound, record unresolved → no binding', recorded(null, false), null, bound(null)],
    ['parent closed and record unresolved → unresolved', recorded(null, false), undefined, { kind: 'unresolved' }],
    ['no record at all → unresolved', undefined, undefined, { kind: 'unresolved' }],
    ['no record, parent lookup impossible even if a profile is named', undefined, P, { kind: 'unresolved' }],
  ] as const)('%s', (_label, record, parentProfileId, expected) => {
    expect(resolveDetachedProfileBinding(record, parentProfileId)).toEqual(expected)
  })

  it('senderBindingProfileId: unresolved is never a profile (never "connected")', () => {
    expect(senderBindingProfileId({ kind: 'bound', profileId: P })).toBe(P)
    expect(senderBindingProfileId({ kind: 'bound', profileId: null })).toBeNull()
    expect(senderBindingProfileId({ kind: 'unresolved' })).toBeNull()
  })
})

describe('detachedSenderRouteIdentity (T0446)', () => {
  it('unbound → local, like its parent', () => {
    expect(detachedSenderRouteIdentity({ kind: 'bound', profileId: null }, null)).toEqual({ senderIsRemote: false, senderProfileId: null })
  })
  it('local profile → local; remote profile → remote', () => {
    expect(detachedSenderRouteIdentity({ kind: 'bound', profileId: L }, 'local')).toEqual({ senderIsRemote: false, senderProfileId: L })
    expect(detachedSenderRouteIdentity({ kind: 'bound', profileId: P }, 'remote')).toEqual({ senderIsRemote: true, senderProfileId: P })
  })
  it('profile not found → treated as remote (fail closed)', () => {
    expect(detachedSenderRouteIdentity({ kind: 'bound', profileId: P }, null)).toEqual({ senderIsRemote: true, senderProfileId: P })
  })
  it('unresolved → remote under a profile id no registry entry ever has', () => {
    expect(detachedSenderRouteIdentity({ kind: 'unresolved' }, null)).toEqual({ senderIsRemote: true, senderProfileId: UNRESOLVED_DETACHED_PROFILE_ID })
  })
})

describe('detached window routing matrix (T0446 × T0443)', () => {
  it('remote-profile detached window, connected → remote', () => {
    expect(routeDetached(recorded(P), P, 'remote', slots['P connected'])).toEqual({ kind: 'remote' })
  })

  it.each([
    ['P reconnecting', 'reconnecting'],
    ['P gave up', 'disconnected'],
    ['only Q connected', 'no-client'],
    ['empty', 'no-client'],
  ] as const)('remote-profile detached window, %s → refused (%s), not local', (slot, reason) => {
    expect(routeDetached(recorded(P), P, 'remote', slots[slot])).toEqual({ kind: 'refuse', errorCode: 'REMOTE_NOT_CONNECTED', profileId: P, reason })
  })

  it('local-profile / unbound detached window stays local whatever the registry holds', () => {
    for (const slot of Object.values(slots)) {
      expect(routeDetached(recorded(L), L, 'local', slot)).toEqual({ kind: 'local' })
      expect(routeDetached(recorded(null), null, null, slot)).toEqual({ kind: 'local' })
    }
  })

  it('parent closed: the recorded remote binding still routes remote / refused, never local', () => {
    expect(routeDetached(recorded(P), undefined, 'remote', slots['P connected'])).toEqual({ kind: 'remote' })
    for (const slot of ['P reconnecting', 'P gave up', 'only Q connected', 'empty']) {
      expect(routeDetached(recorded(P), undefined, 'remote', slots[slot]).kind, slot).toBe('refuse')
    }
  })

  it('parent closed and the profile deleted: refused unless P\'s own client is live', () => {
    expect(routeDetached(recorded(P), undefined, null, slots['empty']).kind).toBe('refuse')
    expect(routeDetached(recorded(P), undefined, null, slots['only Q connected']).kind).toBe('refuse')
  })

  it('unresolved detached window is refused in every registry state', () => {
    const all: Conns = Object.assign({}, ...Object.values(slots))
    for (const [label, slot] of [...Object.entries(slots), ['every profile connected', all] as const]) {
      const route = routeDetached(recorded(null, false), undefined, null, slot)
      expect(route.kind, label).toBe('refuse')
      expect(routeDetached(undefined, undefined, null, slot).kind, label).toBe('refuse')
    }
  })

  it('event fan-out: a detached window matches its parent\'s profile (not its workspaceId)', () => {
    // getWindowsForProfile compares senderBindingProfileId(binding) to the event's profile
    expect(senderBindingProfileId(resolveDetachedProfileBinding(recorded(P), P))).toBe(P)
    expect(senderBindingProfileId(resolveDetachedProfileBinding(recorded(P), undefined))).toBe(P)
    expect(senderBindingProfileId(resolveDetachedProfileBinding(recorded(L), L))).not.toBe(P)
    expect(senderBindingProfileId(resolveDetachedProfileBinding(recorded(null, false), undefined))).toBeNull()
  })
})

describe('main.ts wiring (T0446 source guard)', () => {
  const src = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
  const section = (from: string, to: string) => {
    const at = src.indexOf(from)
    expect(at, from).toBeGreaterThan(-1)
    const end = src.indexOf(to, at)
    expect(end, to).toBeGreaterThan(at)
    return src.slice(at, end)
  }

  it('bindProxiedHandlersToIpc resolves a detached sender before routing; handlers keep windowId', () => {
    const fn = section('function bindProxiedHandlersToIpc()', '// ── Renderer debug log')
    // T0453: anchored on the routing resolution — the detached workspace:load / save divert comes earlier.
    const detached = fn.indexOf('await resolveDetachedBinding(detachedWorkspaceId)')
    expect(detached).toBeGreaterThan(fn.indexOf('if (ALWAYS_LOCAL_CHANNELS.has(channel))'))
    expect(detached).toBeLessThan(fn.indexOf('planProfileProxiedInvokeRoute('))
    expect(fn).toMatch(/detachedSenderRouteIdentity\(binding, /)
    expect(fn).toMatch(/if \(route\.kind === 'local'\) return invokeHandler\(channel, args, windowId\)/)
  })

  it('getWindowsForProfile matches detached windows by their resolved binding', () => {
    // T0464: the matching itself lives in collectProfileWindows (behaviour covered in
    // electron/remote/__tests__/remote-connection-lifecycle.test.ts).
    const fn = section('function getWindowsForProfile(', '/** Reverse lookup')
    expect(fn).toMatch(/return collectProfileWindows\(\{/)
    expect(fn).toMatch(/windows: windowMap,/)
    expect(fn).toMatch(/^\s*detachedWindows,$/m)
    expect(fn).toMatch(/detachedProfileId: \(workspaceId\) => senderBindingProfileId\(resolveDetachedBindingSync\(workspaceId\)\)/)
    expect(fn).not.toMatch(/matchIds\.has\(workspaceId\)/)
  })

  it('every sender-identity handler uses getSenderProfileBinding', () => {
    expect(section("ipcMain.handle('remote:connect'", "ipcMain.handle('remote:disconnect'")).toMatch(/await getSenderProfileBinding\(event\.sender\)[\s\S]*senderBinding\.kind === 'unresolved'/)
    expect(section("ipcMain.handle('remote:client-status'", "ipcMain.handle('remote:test-connection'")).toMatch(/getSenderProfileBinding\(event\.sender\)/)
    expect(section("ipcMain.handle('app:get-window-profile'", "ipcMain.handle('app:get-user-data-path'")).toMatch(/getSenderProfileBinding\(event\.sender\)/)
    expect(section("ipcMain.handle('app:new-window'", 'const remoteToolInstallIpc')).toMatch(/getSenderProfileBinding\(event\.sender\)[\s\S]*sourceBinding\.kind === 'unresolved'[\s\S]*return null/)
    expect(section('async function wslFolderDefaultForSender(', 'function registerLocalHandlers(')).toMatch(/getSenderProfileBinding\(sender\)/)
  })

  it('detach records the parent binding before the window loads; every teardown drops it', () => {
    const detach = section("ipcMain.handle('workspace:detach'", "ipcMain.handle('workspace:reattach'")
    expect(detach.indexOf('getSenderProfileBinding(event.sender)')).toBeLessThan(detach.indexOf('detachedWindowRecords.set(workspaceId, record)'))
    expect(detach.indexOf('detachedWindowRecords.set(workspaceId, record)')).toBeLessThan(detach.indexOf('detachedWin.loadURL'))
    expect(detach).toMatch(/on\('closed'[\s\S]*detachedWindowRecords\.delete\(workspaceId\)/)
    const reattach = section("ipcMain.handle('workspace:reattach'", '// ── Agent Runtime IPC')
    expect(reattach).toMatch(/detachedWindowRecords\.delete\(workspaceId\)/)
    expect(src).toMatch(/detachedWindows\.clear\(\)\s+detachedWindowRecords\.clear\(\)/)
  })
})
