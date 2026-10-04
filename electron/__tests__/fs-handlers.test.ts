// @vitest-environment node
/**
 * T0406 (PLAN-036 P2-I): `electron/handlers/fs.ts` + the path-guard pieces it uses.
 *
 * - the module answers exactly like the old main.ts handlers (same denial shapes)
 * - no pathGuard ⇒ every channel denies (fail closed)
 * - `workspace:sync-roots`: Electron (no workspaceRoots) refuses, headless stores per connection
 * - `SyncedWorkspaceRoots`: absolute only, no `/`, no `..`, union over connections
 * - main.ts registers no fs / image handler of its own any more
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { registerFsHandlers, SYNC_ROOTS_HOST_MANAGED_ERROR, type FsHandlerDeps } from '../handlers/fs'
import type { HandlerContext, HandlerModuleDisposer, SharedHandler } from '../handlers/types'
import {
  MAX_SYNCED_ROOTS,
  SyncedWorkspaceRoots,
  createPathAllowlist,
  getRegisteredWorkspaces,
  isPathAllowed,
  rebuildWorkspaceAllowlist,
  syncedRootRejection,
} from '../path-guard'

const FS_CHANNELS = [
  'fs:watch', 'fs:reset-watch', 'fs:unwatch', 'fs:readdir', 'fs:readFile', 'fs:stat',
  'image:read-as-data-url', 'fs:search', 'workspace:sync-roots',
]

let root: string
let outside: string
const disposers: HandlerModuleDisposer[] = []

function mount(deps: FsHandlerDeps) {
  const handlers = new Map<string, SharedHandler>()
  disposers.push(registerFsHandlers((channel, handler) => { handlers.set(channel, handler) }, deps))
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`not registered: ${channel}`)
    return Promise.resolve(handler(ctx, ...args))
  }
  return { handlers, call }
}

const local: HandlerContext = { windowId: 'w1' }

beforeAll(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0406-root-')))
  outside = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0406-out-')))
  fs.mkdirSync(path.join(root, 'sub'))
  fs.writeFileSync(path.join(root, 'hello.txt'), 'hello t0406\n')
  fs.writeFileSync(path.join(root, 'sub', 'needle-file.md'), '# x\n')
  fs.writeFileSync(path.join(root, 'pic.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'nope\n')
})

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(outside, { recursive: true, force: true })
})

describe('registerFsHandlers', () => {
  it('registers the 8 fs / image channels plus workspace:sync-roots', () => {
    const { handlers } = mount({ emit: () => {} })
    expect(Array.from(handlers.keys()).sort()).toEqual([...FS_CHANNELS].sort())
  })

  it('fails closed without a pathGuard — same denial shapes as the old main.ts handlers', async () => {
    const { call } = mount({ emit: () => {} })
    expect(await call('fs:readdir', local, root)).toEqual([])
    expect(await call('fs:readFile', local, path.join(root, 'hello.txt'))).toEqual({ error: 'Path access denied' })
    expect(await call('fs:stat', local, path.join(root, 'hello.txt'))).toBeNull()
    expect(await call('fs:search', local, root, 'needle')).toEqual([])
    expect(await call('fs:watch', local, root)).toBe(false)
    expect(await call('fs:reset-watch', local, root)).toBe(false)
    expect(await call('fs:unwatch', local, root)).toBe(false)
    await expect(call('image:read-as-data-url', local, path.join(root, 'pic.png'))).rejects.toThrow('Path access denied')
  })

  it('serves paths the guard allows and denies the rest', async () => {
    const guard = createPathAllowlist()
    guard.rebuild([root])
    const { call } = mount({ emit: () => {}, pathGuard: guard })
    const entries = await call('fs:readdir', local, root) as Array<{ name: string; path: string; isDirectory: boolean }>
    expect(entries.map(e => e.name)).toEqual(['sub', 'hello.txt', 'pic.png'])
    expect(entries[0]).toEqual({ name: 'sub', path: path.join(root, 'sub'), isDirectory: true })
    expect(await call('fs:readFile', local, path.join(root, 'hello.txt'))).toEqual({ content: 'hello t0406\n' })
    expect(await call('fs:stat', local, path.join(root, 'hello.txt'))).toMatchObject({ size: 12 })
    expect(await call('image:read-as-data-url', local, path.join(root, 'pic.png'))).toBe('data:image/png;base64,iVBORw==')
    expect(await call('fs:search', local, root, 'NEEDLE')).toEqual([
      { name: 'needle-file.md', path: path.join(root, 'sub', 'needle-file.md'), isDirectory: false },
    ])
    // outside the root and `..` traversal stay denied
    expect(await call('fs:readFile', local, path.join(outside, 'secret.txt'))).toEqual({ error: 'Path access denied' })
    expect(await call('fs:readFile', local, path.join(root, '..', path.basename(outside), 'secret.txt'))).toEqual({ error: 'Path access denied' })
    expect(await call('fs:readdir', local, outside)).toEqual([])
  })

  it('fs:watch emits fs:changed through deps.emit (debounced), fs:unwatch stops it', async () => {
    const guard = createPathAllowlist()
    guard.rebuild([root])
    const emitted: unknown[][] = []
    const { call } = mount({ emit: (channel, ...args) => emitted.push([channel, ...args]), pathGuard: guard })
    expect(await call('fs:watch', local, root)).toBe(true)
    expect(await call('fs:watch', local, root)).toBe(true) // already watching
    fs.writeFileSync(path.join(root, 'touched.txt'), String(Date.now()))
    await expect.poll(() => emitted, { timeout: 5_000, interval: 100 }).toContainEqual(['fs:changed', root])
    expect(await call('fs:unwatch', local, root)).toBe(true)
    fs.rmSync(path.join(root, 'touched.txt'))
  })

  it('workspace:sync-roots on Electron (no workspaceRoots) refuses: synced roots never widen the registry sandbox', async () => {
    const { call } = mount({ emit: () => {}, pathGuard: createPathAllowlist() })
    expect(await call('workspace:sync-roots', { windowId: null, connectionId: 'c1' }, [root])).toEqual({ ok: false, error: SYNC_ROOTS_HOST_MANAGED_ERROR })
  })

  it('workspace:sync-roots on headless stores the roots per connection and reports rejected ones', async () => {
    const roots = new SyncedWorkspaceRoots()
    const { call } = mount({ emit: () => {}, pathGuard: roots, workspaceRoots: roots })
    expect(await call('workspace:sync-roots', { windowId: null }, [root])).toEqual({ ok: false, error: 'workspace:sync-roots needs a remote connection' })
    expect(roots.getRoots()).toEqual([])
    const result = await call('workspace:sync-roots', { windowId: null, connectionId: 'c1' }, [root, 'relative/dir', path.parse(root).root])
    expect(result).toEqual({
      ok: true,
      roots: [root],
      rejected: [
        { root: 'relative/dir', reason: 'not an absolute path on the server' },
        { root: path.parse(root).root, reason: 'filesystem root' },
      ],
    })
    expect(await call('fs:readFile', local, path.join(root, 'hello.txt'))).toEqual({ content: 'hello t0406\n' })
    await expect(call('workspace:sync-roots', { windowId: null, connectionId: 'c1' }, 'not-an-array')).rejects.toThrow(/expects an array/)
    // a malformed push clears the connection (fail closed)
    expect(await call('fs:readFile', local, path.join(root, 'hello.txt'))).toEqual({ error: 'Path access denied' })
  })
})

describe('SyncedWorkspaceRoots (headless fs sandbox)', () => {
  it('denies everything before any push', () => {
    const roots = new SyncedWorkspaceRoots()
    expect(roots.isPathAllowed(root)).toBe(false)
    expect(roots.isPathAllowed('/')).toBe(false)
  })

  it('rejects relative, filesystem-root, `..` and non-string roots', () => {
    expect(syncedRootRejection(root)).toBeNull()
    expect(syncedRootRejection('relative')).toBe('not an absolute path on the server')
    expect(syncedRootRejection('\\\\wsl.localhost\\Ubuntu-24.04\\home\\x', path.posix)).toBe('not an absolute path on the server')
    expect(syncedRootRejection('/', path.posix)).toBe('filesystem root')
    expect(syncedRootRejection('//', path.posix)).toBe('filesystem root')
    expect(syncedRootRejection('C:\\', path.win32)).toBe('filesystem root')
    expect(syncedRootRejection('/home/x/../..', path.posix)).toBe('contains a .. segment')
    expect(syncedRootRejection('/home/x/..', path.posix)).toBe('contains a .. segment')
    expect(syncedRootRejection('/home/x..y', path.posix)).toBeNull()
    expect(syncedRootRejection('/home/x', path.posix)).toBeNull()
    expect(syncedRootRejection('')).toBe('not a non-empty string')
    expect(syncedRootRejection(42)).toBe('not a non-empty string')
    expect(syncedRootRejection('/a\0b', path.posix)).toBe('contains NUL')
  })

  it('unions roots over connections; closing one leaves only the other', () => {
    const roots = new SyncedWorkspaceRoots()
    roots.setConnectionRoots('a', [root])
    roots.setConnectionRoots('b', [outside])
    expect(roots.isPathAllowed(path.join(root, 'hello.txt'))).toBe(true)
    expect(roots.isPathAllowed(path.join(outside, 'secret.txt'))).toBe(true)
    expect(roots.removeConnection('a')).toBe(true)
    expect(roots.isPathAllowed(path.join(root, 'hello.txt'))).toBe(false)
    expect(roots.isPathAllowed(path.join(outside, 'secret.txt'))).toBe(true)
    expect(roots.removeConnection('a')).toBe(false)
  })

  it('a push replaces that connection\'s roots (a removed workspace loses access)', () => {
    const roots = new SyncedWorkspaceRoots()
    roots.setConnectionRoots('a', [root, outside])
    roots.setConnectionRoots('a', [root])
    expect(roots.getConnectionRoots('a')).toEqual([root])
    expect(roots.isPathAllowed(outside)).toBe(false)
    roots.setConnectionRoots('a', [])
    expect(roots.getRoots()).toEqual([])
  })

  it('caps the number of roots per push', () => {
    const roots = new SyncedWorkspaceRoots()
    roots.setConnectionRoots('a', [root])
    expect(() => roots.setConnectionRoots('a', new Array(MAX_SYNCED_ROOTS + 1).fill(root))).toThrow(/at most/)
    expect(roots.getRoots()).toEqual([])
  })
})

describe('Electron path-guard module functions (unchanged behavior)', () => {
  afterEach(() => rebuildWorkspaceAllowlist([]))

  it('the registry allowlist still works as before and is separate from synced roots', () => {
    rebuildWorkspaceAllowlist([root])
    expect(getRegisteredWorkspaces()).toEqual([root])
    expect(isPathAllowed(path.join(root, 'sub'))).toBe(true)
    expect(isPathAllowed(outside)).toBe(false)
    const synced = new SyncedWorkspaceRoots()
    expect(synced.isPathAllowed(root)).toBe(false)
    synced.setConnectionRoots('a', [outside])
    expect(isPathAllowed(outside)).toBe(false)
  })
})

describe('main.ts no longer owns fs / image handlers (T0406)', () => {
  it('has no registerHandler("fs:…") / ("image:…") and calls registerFsHandlers with the registry guard', () => {
    const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf8')
    expect(main).not.toMatch(/registerHandler\(\s*['"`](fs|image):/)
    expect(main).toMatch(/registerFsHandlers\(registerHandler, \{[\s\S]*?pathGuard: \{ isPathAllowed \}/)
  })

  it('electron/handlers/fs.ts does not import electron', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'handlers', 'fs.ts'), 'utf8')
    expect(source).not.toMatch(/from\s+['"]electron['"]|require\(\s*['"]electron['"]\s*\)/)
  })
})
