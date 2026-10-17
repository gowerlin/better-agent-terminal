// @vitest-environment node
/**
 * PLAN-047 / T0576: local helper capabilities survive a BAT restart while the Terminal Server keeps
 * the PTYs (and the tokens in their env) alive.
 *
 *   - registry: `records()` (digest + binding, never the token), `onChange`, `restore` as pending,
 *     `settleRestored` (keep the surviving, drop the rest), `hasWorkerCapability`
 *   - the T0575 timing: a restored tab's `pty:create` reaches main before the T0108 replay list and
 *     gets a new capability — the restored one must survive it, the new one goes once the list
 *     shows the PTY was running (and the other way round when it was not)
 *   - store: atomic write (temp + rename, no temp left, failed write keeps the old file), missing /
 *     damaged file (warn + empty store, no throw), invalid records skipped, never a token in it
 *   - PtyManager wired like main.ts across two "processes" sharing one store: replay keeps,
 *     a PTY gone while BAT was closed is dropped, server death drops, exit removes the record
 *   - `capabilityOrSavedTabOwnership` with a restored worker capability vs the saved tab (T0537)
 *   - main.ts source guard of the wiring and the load order
 */
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager / helper-capability must not import electron')
})

import { logger } from '../logger'
import { capabilityOrSavedTabOwnership } from '../close-worker'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import {
  buildLocalHelperEnv,
  HELPER_CAPABILITY_STORE_FILE,
  HELPER_CAPABILITY_STORE_VERSION,
  HelperCapabilityRegistry,
  readHelperCapabilityStore,
  restoreHelperCapabilitiesFromStore,
  writeHelperCapabilityStore,
  type PersistedHelperCapability,
} from '../remote/helper-capability'

const CWD = os.tmpdir()
const TOWER = 'tower-1'
const WORKER = 'worker-1'

let tmpDirs: string[] = []
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0576-'))
  tmpDirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const silentLog = () => ({ log: vi.fn<(m: string) => void>(), warn: vi.fn<(m: string) => void>() })

describe('HelperCapabilityRegistry persistence API (T0576)', () => {
  it('records(): digest + binding + issuedAt — never the token', () => {
    let now = 1_700_000_000_000
    const registry = new HelperCapabilityRegistry({ now: () => now })
    const tower = registry.issue(TOWER)
    now += 5
    const worker = registry.issue(WORKER, { towerId: TOWER })
    const records = registry.records()
    expect(records).toEqual([
      { digest: expect.stringMatching(/^[0-9a-f]{64}$/), terminalId: TOWER, role: 'tower', issuedAt: 1_700_000_000_000 },
      { digest: expect.stringMatching(/^[0-9a-f]{64}$/), terminalId: WORKER, role: 'worker', towerId: TOWER, issuedAt: 1_700_000_000_005 },
    ])
    const text = JSON.stringify(records)
    expect(text).not.toContain(tower)
    expect(text).not.toContain(worker)
    expect(text).not.toContain(tower.slice('batcap.'.length))
  })

  it('onChange fires on issue / revoke / clear / restore / settle, not on a no-op', () => {
    const onChange = vi.fn()
    const registry = new HelperCapabilityRegistry({ onChange })
    registry.issue(TOWER)
    expect(onChange).toHaveBeenCalledTimes(1)
    registry.issue(TOWER) // re-issue: revoke + issue = one change
    expect(onChange).toHaveBeenCalledTimes(2)
    registry.revokeTerminal('nobody')
    expect(onChange).toHaveBeenCalledTimes(2)
    registry.revokeTerminal(TOWER)
    expect(onChange).toHaveBeenCalledTimes(3)
    registry.clear()
    expect(onChange).toHaveBeenCalledTimes(3)

    const source = new HelperCapabilityRegistry()
    source.issue(TOWER)
    registry.restore(source.records())
    expect(onChange).toHaveBeenCalledTimes(4)
    registry.settleRestored(() => true)
    expect(onChange).toHaveBeenCalledTimes(5)
    registry.settleRestored(() => true) // nothing pending
    expect(onChange).toHaveBeenCalledTimes(5)
    registry.clear()
    expect(onChange).toHaveBeenCalledTimes(6)
  })

  it('a throwing onChange does not break the registry', () => {
    const registry = new HelperCapabilityRegistry({ onChange: () => { throw new Error('disk full') } })
    const token = registry.issue(TOWER)
    expect(registry.verify(token)?.capability.terminalId).toBe(TOWER)
  })

  it('restore: the previous process\'s tokens authenticate in the new registry (pending)', () => {
    const before = new HelperCapabilityRegistry()
    const tower = before.issue(TOWER)
    const worker = before.issue(WORKER, { towerId: TOWER })
    const after = new HelperCapabilityRegistry()
    expect(after.verify(tower)).toBeNull()
    expect(after.restore(before.records())).toBe(2)
    expect(after.hasPendingRestored()).toBe(true)
    expect(after.verify(tower)?.capability).toEqual({ terminalId: TOWER, role: 'tower' })
    expect(after.verify(worker)?.capability).toEqual({ terminalId: WORKER, towerId: TOWER, role: 'worker' })
    expect(after.isWorkerOf(WORKER, TOWER)).toBe(true)
  })

  it('restore skips malformed / inconsistent records and digests already live', () => {
    const source = new HelperCapabilityRegistry()
    source.issue(TOWER)
    const [good] = source.records()
    const registry = new HelperCapabilityRegistry()
    const restored = registry.restore([
      good,
      good,
      null,
      'x',
      [],
      { ...good, digest: 'zz' },
      { ...good, digest: good.digest.toUpperCase() },
      { ...good, terminalId: 'bad id' },
      { ...good, role: 'admin' },
      { ...good, role: 'worker' }, // worker without tower
      { ...good, role: 'worker', towerId: good.terminalId, digest: 'a'.repeat(64) }, // worker of itself
      { ...good, towerId: 'other', digest: 'b'.repeat(64) }, // tower with a tower id
      { ...good, issuedAt: 'now', digest: 'c'.repeat(64) },
    ])
    expect(restored).toBe(1)
    expect(registry.size).toBe(1)
  })

  it('settleRestored keeps the surviving PTYs\' capabilities and drops (revokes) the rest', () => {
    const before = new HelperCapabilityRegistry()
    const tower = before.issue(TOWER)
    const worker = before.issue(WORKER, { towerId: TOWER })
    const after = new HelperCapabilityRegistry()
    after.restore(before.records())
    expect(after.settleRestored(id => id === TOWER)).toEqual({ kept: [TOWER], dropped: [WORKER] })
    expect(after.hasPendingRestored()).toBe(false)
    expect(after.verify(tower)?.capability.terminalId).toBe(TOWER)
    expect(after.verify(worker)).toBeNull()
    expect(after.isRecentlyRevoked(worker)).toBe(true)
    expect(after.records().map(r => r.terminalId)).toEqual([TOWER])
    // settled: a later issue for the tower replaces it as before (restart)
    after.issue(TOWER)
    expect(after.verify(tower)).toBeNull()
  })

  it('no surviving Terminal Server: settle with () => false drops everything restored', () => {
    const before = new HelperCapabilityRegistry()
    const tower = before.issue(TOWER)
    const after = new HelperCapabilityRegistry()
    after.restore(before.records())
    expect(after.settleRestored(() => false)).toEqual({ kept: [], dropped: [TOWER] })
    expect(after.verify(tower)).toBeNull()
    expect(after.size).toBe(0)
  })

  describe('pty:create before the replay list (T0575 measured timing)', () => {
    function restarted() {
      const before = new HelperCapabilityRegistry()
      const restoredToken = before.issue(TOWER)
      const after = new HelperCapabilityRegistry()
      after.restore(before.records())
      // the restored tab's pty:create: main does not know the id yet and issues for it
      const earlyToken = after.issue(TOWER)
      return { after, restoredToken, earlyToken }
    }

    it('issue does not revoke a pending restored capability of the same terminal', () => {
      const { after, restoredToken, earlyToken } = restarted()
      expect(after.verify(restoredToken)?.capability.terminalId).toBe(TOWER)
      expect(after.verify(earlyToken)?.capability.terminalId).toBe(TOWER)
    })

    it('PTY on the replay list (the server kept it): the restored token stays, the early one goes', () => {
      const { after, restoredToken, earlyToken } = restarted()
      expect(after.settleRestored(id => id === TOWER)).toEqual({ kept: [TOWER], dropped: [] })
      expect(after.verify(restoredToken)?.capability.terminalId).toBe(TOWER)
      expect(after.verify(earlyToken)).toBeNull()
      expect(after.size).toBe(1)
    })

    it('PTY not on the list (the server spawned a new one): the early token stays, the restored one goes', () => {
      const { after, restoredToken, earlyToken } = restarted()
      expect(after.settleRestored(() => false)).toEqual({ kept: [], dropped: [TOWER] })
      expect(after.verify(restoredToken)).toBeNull()
      expect(after.verify(earlyToken)?.capability.terminalId).toBe(TOWER)
    })

    it('an issue for another terminal is untouched by the settle', () => {
      const { after } = restarted()
      const other = after.issue('other-tab')
      after.settleRestored(id => id === TOWER)
      expect(after.verify(other)?.capability.terminalId).toBe('other-tab')
    })

    it('a kill / exit while pending revokes both', () => {
      const { after, restoredToken, earlyToken } = restarted()
      expect(after.revokeTerminal(TOWER)).toBe(2)
      expect(after.verify(restoredToken)).toBeNull()
      expect(after.verify(earlyToken)).toBeNull()
      expect(after.hasPendingRestored()).toBe(false)
    })
  })

  it('hasWorkerCapability: any live worker capability of the terminal', () => {
    const registry = new HelperCapabilityRegistry()
    registry.issue(TOWER)
    registry.issue(WORKER, { towerId: TOWER })
    expect(registry.hasWorkerCapability(WORKER)).toBe(true)
    expect(registry.hasWorkerCapability(TOWER)).toBe(false)
    expect(registry.hasWorkerCapability('nobody')).toBe(false)
  })
})

describe('capability store file (T0576)', () => {
  it('write + read round trip; the file holds digests and bindings, never a token', () => {
    const dir = tmpDir()
    const file = path.join(dir, HELPER_CAPABILITY_STORE_FILE)
    const registry = new HelperCapabilityRegistry()
    const tokens = [registry.issue(TOWER), registry.issue(WORKER, { towerId: TOWER })]
    writeHelperCapabilityStore(file, registry.records())
    const text = fs.readFileSync(file, 'utf8')
    for (const token of tokens) {
      expect(text).not.toContain(token)
      expect(text).not.toContain(token.slice('batcap.'.length))
    }
    expect(text).not.toContain('batcap.')
    expect(JSON.parse(text)).toEqual({ version: HELPER_CAPABILITY_STORE_VERSION, capabilities: registry.records() })
    expect(readHelperCapabilityStore(file)).toEqual({ status: 'ok', records: registry.records() })
    // atomic: only the store is left in the directory (the temp file was renamed over it)
    expect(fs.readdirSync(dir)).toEqual([HELPER_CAPABILITY_STORE_FILE])
  })

  it('a rewrite replaces the whole file (revoke removes the record)', () => {
    const dir = tmpDir()
    const file = path.join(dir, HELPER_CAPABILITY_STORE_FILE)
    const registry = new HelperCapabilityRegistry({ onChange: () => writeHelperCapabilityStore(file, registry.records()) })
    registry.issue(TOWER)
    registry.issue(WORKER, { towerId: TOWER })
    expect((readHelperCapabilityStore(file).records as PersistedHelperCapability[]).map(r => r.terminalId)).toEqual([TOWER, WORKER])
    registry.revokeTerminal(WORKER)
    expect((readHelperCapabilityStore(file).records as PersistedHelperCapability[]).map(r => r.terminalId)).toEqual([TOWER])
    registry.revokeTerminal(TOWER)
    expect(readHelperCapabilityStore(file)).toEqual({ status: 'ok', records: [] })
    expect(fs.readdirSync(dir)).toEqual([HELPER_CAPABILITY_STORE_FILE])
  })

  it('a failed write throws, keeps what was there and leaves no temp file', () => {
    const dir = tmpDir()
    const file = path.join(dir, HELPER_CAPABILITY_STORE_FILE)
    fs.mkdirSync(file) // the rename over a directory fails
    const registry = new HelperCapabilityRegistry()
    registry.issue(TOWER)
    expect(() => writeHelperCapabilityStore(file, registry.records())).toThrow()
    expect(fs.statSync(file).isDirectory()).toBe(true)
    expect(fs.readdirSync(dir)).toEqual([HELPER_CAPABILITY_STORE_FILE])
  })

  it('read: missing / damaged JSON / other version / no array', () => {
    const dir = tmpDir()
    const file = path.join(dir, HELPER_CAPABILITY_STORE_FILE)
    expect(readHelperCapabilityStore(file)).toEqual({ status: 'missing', records: [] })
    fs.writeFileSync(file, '{"version":1,"capabilities":[')
    expect(readHelperCapabilityStore(file).status).toBe('corrupt')
    fs.writeFileSync(file, JSON.stringify({ version: 2, capabilities: [] }))
    expect(readHelperCapabilityStore(file).status).toBe('corrupt')
    fs.writeFileSync(file, JSON.stringify({ version: 1, capabilities: {} }))
    expect(readHelperCapabilityStore(file).status).toBe('corrupt')
    fs.writeFileSync(file, 'null')
    expect(readHelperCapabilityStore(file).status).toBe('corrupt')
  })

  it('restoreHelperCapabilitiesFromStore: a damaged file ⇒ warn, empty store, no throw', () => {
    const dir = tmpDir()
    const file = path.join(dir, HELPER_CAPABILITY_STORE_FILE)
    fs.writeFileSync(file, '\u0000\u0001 not json')
    const log = silentLog()
    const registry = new HelperCapabilityRegistry()
    expect(restoreHelperCapabilitiesFromStore({ registry, filePath: file, log })).toEqual({ status: 'corrupt', restored: 0, skipped: 0 })
    expect(registry.size).toBe(0)
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.warn.mock.calls[0][0]).toContain(`[helper-cap] ${HELPER_CAPABILITY_STORE_FILE} unreadable`)
    expect(readHelperCapabilityStore(file)).toEqual({ status: 'ok', records: [] })
  })

  it('restoreHelperCapabilitiesFromStore: a damaged file that cannot be rewritten still does not throw', () => {
    const dir = tmpDir()
    const file = path.join(dir, 'missing-dir', HELPER_CAPABILITY_STORE_FILE)
    const registry = new HelperCapabilityRegistry()
    const log = silentLog()
    // a directory where the file should be: read fails (not ENOENT), the rewrite fails too
    fs.mkdirSync(file, { recursive: true })
    expect(() => restoreHelperCapabilitiesFromStore({ registry, filePath: file, log })).not.toThrow()
    expect(log.warn).toHaveBeenCalledTimes(2)
    expect(registry.size).toBe(0)
  })

  it('restoreHelperCapabilitiesFromStore: restores valid records, drops invalid ones from the file', () => {
    const dir = tmpDir()
    const file = path.join(dir, HELPER_CAPABILITY_STORE_FILE)
    const source = new HelperCapabilityRegistry()
    const token = source.issue(TOWER)
    fs.writeFileSync(file, JSON.stringify({ version: 1, capabilities: [...source.records(), { digest: 'nope' }] }))
    const log = silentLog()
    const registry = new HelperCapabilityRegistry()
    expect(restoreHelperCapabilitiesFromStore({ registry, filePath: file, log })).toEqual({ status: 'ok', restored: 1, skipped: 1 })
    expect(registry.verify(token)?.capability.terminalId).toBe(TOWER)
    expect(log.log.mock.calls[0][0]).toContain('[helper-cap] restored 1 capability record(s)')
    expect(readHelperCapabilityStore(file)).toEqual({ status: 'ok', records: source.records() })
    for (const line of [...log.log.mock.calls, ...log.warn.mock.calls].map(c => c[0])) expect(line).not.toContain(token)
  })

  it('restoreHelperCapabilitiesFromStore: missing file ⇒ nothing, nothing written', () => {
    const dir = tmpDir()
    const file = path.join(dir, HELPER_CAPABILITY_STORE_FILE)
    const log = silentLog()
    expect(restoreHelperCapabilitiesFromStore({ registry: new HelperCapabilityRegistry(), filePath: file, log })).toEqual({ status: 'missing', restored: 0, skipped: 0 })
    expect(fs.existsSync(file)).toBe(false)
    expect(log.log).not.toHaveBeenCalled()
    expect(log.warn).not.toHaveBeenCalled()
  })
})

// ── PtyManager wired like main.ts, two processes sharing one store ──

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}

class FakeServer extends EventEmitter {
  connected = true
  sent: Array<{ type: string; id?: string; env?: Record<string, string> }> = []
  send = (msg: { type: string; id?: string; env?: Record<string, string> }) => { this.sent.push(msg); return true }
  reply(msg: unknown): void { this.emit('message', msg) }
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: { env: Record<string, string> }) => new FakePty())
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

describe('PtyManager + store across a BAT restart (T0576)', () => {
  let dataDir: string
  let storeFile: string
  const managers: PtyManagerType[] = []

  beforeEach(() => {
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    ptySpawn.mockClear()
    dataDir = tmpDir()
    storeFile = path.join(dataDir, HELPER_CAPABILITY_STORE_FILE)
  })

  afterEach(() => {
    for (const manager of managers.splice(0)) manager.dispose()
    vi.restoreAllMocks()
  })

  /** One BAT main process: registry persisted like main.ts, loaded before the PtyManager exists. */
  function bat() {
    let storePath: string | null = null
    const registry: HelperCapabilityRegistry = new HelperCapabilityRegistry({
      onChange: () => { if (storePath) writeHelperCapabilityStore(storePath, registry.records()) },
    })
    restoreHelperCapabilitiesFromStore({ registry, filePath: storeFile, log: silentLog() })
    storePath = storeFile
    const settled: Array<{ kept: string[]; dropped: string[] }> = []
    const manager = new PtyManager({
      emit: vi.fn(),
      dataDir,
      helperDir: path.join(dataDir, 'scripts'),
      helperEnv: (id, customEnv) => buildLocalHelperEnv({ id, customEnv, capabilities: registry, endpoint: { port: 9876 } }),
      onPtyExit: id => { registry.revokeTerminal(id) },
      onSurvivingPtys: ids => {
        const alive = new Set(ids)
        if (registry.hasPendingRestored()) settled.push(registry.settleRestored(id => alive.has(id)))
      },
    })
    managers.push(manager)
    const server = new FakeServer()
    manager.setServerProcess(server as unknown as ChildProcess)
    return { registry, manager, server, settled }
  }

  const storedIds = () => (readHelperCapabilityStore(storeFile).records as PersistedHelperCapability[]).map(r => r.terminalId).sort()
  const tokenSentFor = (server: FakeServer, id: string) => server.sent.filter(m => m.type === 'pty:create' && m.id === id).at(-1)?.env?.BAT_REMOTE_TOKEN

  function firstRun() {
    const one = bat()
    one.manager.create({ id: TOWER, cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    one.manager.create({ id: WORKER, cwd: CWD, type: 'terminal', shell: '/bin/sh', customEnv: { BAT_TOWER_TERMINAL_ID: TOWER, CT_MODE: 'yolo' } })
    const towerToken = tokenSentFor(one.server, TOWER)!
    const workerToken = tokenSentFor(one.server, WORKER)!
    expect(storedIds()).toEqual([TOWER, WORKER].sort())
    // BAT quits, the Terminal Server keeps running: dispose reports no exit, the store stays
    one.manager.dispose()
    expect(storedIds()).toEqual([TOWER, WORKER].sort())
    return { towerToken, workerToken }
  }

  it('replay list with both PTYs: the env tokens of the previous process authenticate after the restart', () => {
    const { towerToken, workerToken } = firstRun()
    const two = bat()
    // the restored tab's pty:create reaches main before the replay list (T0575 measurement)
    two.manager.create({ id: TOWER, cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    const earlyToken = tokenSentFor(two.server, TOWER)!
    expect(earlyToken).not.toBe(towerToken)
    expect(two.registry.verify(towerToken)?.capability.terminalId).toBe(TOWER)
    two.server.reply({ type: 'pty:list', ptys: [{ id: TOWER, pid: 11, cwd: CWD }, { id: WORKER, pid: 12, cwd: CWD }] })
    expect(two.settled).toEqual([{ kept: [TOWER, WORKER], dropped: [] }])
    expect(two.registry.verify(towerToken)?.capability).toEqual({ terminalId: TOWER, role: 'tower' })
    expect(two.registry.verify(workerToken)?.capability).toEqual({ terminalId: WORKER, towerId: TOWER, role: 'worker' })
    expect(two.registry.verify(earlyToken)).toBeNull()
    expect(two.registry.isWorkerOf(WORKER, TOWER)).toBe(true)
    expect(two.registry.size).toBe(2)
    expect(storedIds()).toEqual([TOWER, WORKER].sort())
    // the PTYs are known again: a further re-create is idempotent and issues nothing
    two.manager.create({ id: WORKER, cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    expect(two.registry.verify(workerToken)).not.toBeNull()
  })

  it('a PTY that ended while BAT was closed is dropped from the registry and the store', () => {
    const { towerToken, workerToken } = firstRun()
    const two = bat()
    two.server.reply({ type: 'pty:list', ptys: [{ id: TOWER, pid: 11, cwd: CWD }] })
    expect(two.settled).toEqual([{ kept: [TOWER], dropped: [WORKER] }])
    expect(two.registry.verify(towerToken)).not.toBeNull()
    expect(two.registry.verify(workerToken)).toBeNull()
    expect(storedIds()).toEqual([TOWER])
  })

  it('the Worker exiting after the restart removes its record', () => {
    const { workerToken } = firstRun()
    const two = bat()
    two.server.reply({ type: 'pty:list', ptys: [{ id: TOWER, pid: 11, cwd: CWD }, { id: WORKER, pid: 12, cwd: CWD }] })
    two.server.reply({ type: 'pty:exit', id: WORKER, exitCode: 0 })
    expect(two.registry.verify(workerToken)).toBeNull()
    expect(storedIds()).toEqual([TOWER])
  })

  it('an empty replay list (server alive without PTYs) drops every restored record', () => {
    firstRun()
    const two = bat()
    two.server.reply({ type: 'pty:list', ptys: [] })
    expect(two.settled).toEqual([{ kept: [], dropped: [TOWER, WORKER] }])
    expect(storedIds()).toEqual([])
  })

  it('the Terminal Server dying before the list drops the restored records; rebuilt PTYs get new ones', async () => {
    const { towerToken } = firstRun()
    const two = bat()
    two.manager.create({ id: TOWER, cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    const next = new FakeServer()
    two.manager.onRequestNewServer = async () => next as unknown as ChildProcess
    two.server.connected = false
    await (two.manager as unknown as { handleServerDeath(): Promise<void> }).handleServerDeath()
    expect(two.settled[0].kept).toEqual([])
    expect(two.registry.verify(towerToken)).toBeNull()
    const rebuilt = tokenSentFor(next, TOWER)!
    expect(two.registry.verify(rebuilt)?.capability).toEqual({ terminalId: TOWER, role: 'tower' })
    expect(storedIds()).toEqual([TOWER])
  })

  it('a damaged store at start: no restored records, BAT carries on and rewrites it', () => {
    firstRun()
    fs.writeFileSync(storeFile, '{ broken')
    const two = bat()
    expect(two.registry.size).toBe(0)
    two.manager.create({ id: 'new-tab', cwd: CWD, type: 'terminal', shell: '/bin/sh' })
    expect(storedIds()).toEqual(['new-tab'])
  })
})

describe('capabilityOrSavedTabOwnership with restored capabilities (T0576)', () => {
  const owned = (registry: HelperCapabilityRegistry, recorded: boolean) => capabilityOrSavedTabOwnership(
    (id, tower) => registry.isWorkerOf(id, tower),
    () => recorded,
    id => registry.hasWorkerCapability(id),
  )

  it('a restored worker capability decides: its own tower yes, another tower no (whatever the saved tab says)', () => {
    const before = new HelperCapabilityRegistry()
    before.issue(WORKER, { towerId: TOWER })
    const after = new HelperCapabilityRegistry()
    after.restore(before.records())
    after.settleRestored(() => true)
    // replay PTY: nothing recorded by this process (T0537 path)
    expect(owned(after, false)(WORKER, TOWER)).toBe(true)
    expect(owned(after, false)(WORKER, 'tower-2')).toBe(false)
  })

  it('no worker capability (Terminal Server did not survive, the tab came back as a plain shell): the saved tab stands', () => {
    const registry = new HelperCapabilityRegistry()
    registry.issue(WORKER) // re-created shell: a tower capability
    expect(owned(registry, false)(WORKER, TOWER)).toBe(true)
    expect(owned(new HelperCapabilityRegistry(), false)(WORKER, TOWER)).toBe(true)
  })

  it('recorded by this process: still needs the worker capability (T0575)', () => {
    const registry = new HelperCapabilityRegistry()
    registry.issue(WORKER)
    expect(owned(registry, true)(WORKER, TOWER)).toBe(false)
  })

  it('the two-argument form (T0575 callers) keeps its behaviour', () => {
    const registry = new HelperCapabilityRegistry()
    const twoArg = capabilityOrSavedTabOwnership((id, tower) => registry.isWorkerOf(id, tower), () => false)
    expect(twoArg(WORKER, TOWER)).toBe(true)
  })
})

describe('main.ts wiring (T0576 source guard)', () => {
  const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf-8')

  it('the registry persists on change; the store path is set at whenReady, not at import time', () => {
    expect(main).toContain('new HelperCapabilityRegistry({ onChange: () => persistLocalHelperCapabilities() })')
    expect(main).toContain('let helperCapabilityStorePath: string | null = null')
    const load = main.match(/function loadLocalHelperCapabilities\(\): void \{([\s\S]*?)\n\}/)
    expect(load).not.toBeNull()
    expect(load![1]).toContain("app.getPath('userData')")
    expect(load![1]).toContain('restoreHelperCapabilitiesFromStore(')
  })

  it('the store is loaded before the PtyManager and the Terminal Server reconnect', () => {
    const load = main.indexOf('  loadLocalHelperCapabilities()')
    const init = main.indexOf('  // Initialize PtyManager before starting Terminal Server')
    const start = main.indexOf('  await startTerminalServer()\n')
    expect(load).toBeGreaterThan(0)
    expect(load).toBeLessThan(init)
    expect(init).toBeLessThan(start)
  })

  it('the replay list settles; no surviving Terminal Server drops (before forking a new one)', () => {
    const deps = main.match(/function createElectronPtyDeps\(\): PtyManagerDeps \{([\s\S]*?)\n\}/)
    expect(deps![1]).toContain('onSurvivingPtys: (ids) =>')
    expect(deps![1]).toContain('settleRestoredHelperCapabilities(')
    const fn = main.match(/async function startTerminalServer\(\): Promise<void> \{([\s\S]*?)\n\}/)
    expect(fn).not.toBeNull()
    const drop = fn![1].indexOf("settleRestoredHelperCapabilities(() => false, 'no surviving Terminal Server')")
    expect(drop).toBeGreaterThan(fn![1].indexOf('pendingRecovery = { port, ptyCount }'))
    expect(drop).toBeLessThan(fn![1].indexOf('fork(serverScript'))
  })

  it('--close-worker ownership prefers a worker capability over the saved tab', () => {
    expect(main).toContain('terminalId => localHelperCapabilities.hasWorkerCapability(terminalId)')
  })

  it('the log lines name terminals, never tokens or digests', () => {
    for (const line of main.split('\n').filter(l => l.includes('[helper-cap]'))) {
      expect(line).not.toMatch(/token|digest/i)
    }
  })
})
