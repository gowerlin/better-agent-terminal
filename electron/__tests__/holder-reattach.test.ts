// @vitest-environment node
/**
 * PLAN-065 W5 / T0861 (D286 D4 / D5 / D6): the first start after an installer quit that kept the PTY holder.
 *   - D4: schema 2 record + holderKept + record pid = pid file pid = hello pid + ≥ 1 live PTY → reconnect without
 *     the Recovery prompt (`decideHolderReattach`), the same code as the prompt's "keep"; the notice carries
 *     `reattachedPtyCount`. Anything else → the Recovery prompt as before (T0578).
 *   - D5: a Terminal Server this BAT cannot use is ended; its registry's PTYs are a new source of the PLAN-063 notice.
 *   - D6: 0 PTYs listed + another BAT version → replaced (`shouldReplaceIdleServer`).
 *   - creates stay held until the PTY list registered the kept ids (BUG-146), and resuming an agent tab of a kept
 *     shell ends that shell before one new shell is created for the id (no second shell, nothing else ended).
 */
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager / upgrade-interruption must not import electron')
})

import {
  LAST_RUN_VERSION_FILE,
  UpgradeInterruptionCheck,
  decideHolderReattach,
  detectUpgradeInterruption,
  shouldReplaceIdleServer,
  writeLastRunVersion,
  type HolderReattachInput,
} from '../upgrade-interruption'
import { buildHolderKeptQuitRecord, buildInstallerQuitRecord } from '../installer-quit-request'
import { PtyManager, type PtyManagerDeps } from '../pty-manager'
import { registerPtyHandlers } from '../handlers/pty'
import type { SharedHandler } from '../handlers/types'
import { logger } from '../logger'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'
import type { PtyCreateResult } from '../../src/types'

const S1 = '0f8fad5b-d9cb-469f-a165-70867728950e'

describe('decideHolderReattach (D4): every row of the condition table', () => {
  const base: HolderReattachInput = { keptHolder: { pid: 4242 }, pidFilePid: 4242, hello: { pid: 4242 }, ptyCount: 2 }

  it('all conditions hold → auto', () => {
    expect(decideHolderReattach(base)).toEqual({ auto: true })
  })

  it.each([
    ['no schema 2 record (schema 1, none, the user kept the server at quit)', { keptHolder: null }, 'no-record'],
    ['record without a holder pid', { keptHolder: { pid: null } }, 'no-holder-pid'],
    ['record pid ≠ pid file', { pidFilePid: 4243 }, 'pid-file-mismatch'],
    ['no pid file', { pidFilePid: null }, 'pid-file-mismatch'],
    ['no hello (a server before T0857, protocol 0)', { hello: null }, 'no-hello'],
    ['hello pid ≠ record pid', { hello: { pid: 9 } }, 'hello-pid-mismatch'],
    ['hello without a pid', { hello: {} }, 'hello-pid-mismatch'],
    ['no live PTY', { ptyCount: 0 }, 'no-ptys'],
  ] as const)('%s → Recovery prompt (%s)', (_name, change, reason) => {
    expect(decideHolderReattach({ ...base, ...change } as HolderReattachInput)).toEqual({ auto: false, reason })
  })

  it('a malformed holder pid is not a pid', () => {
    for (const pid of [0, -1, 1.5, Number.NaN]) {
      expect(decideHolderReattach({ ...base, keptHolder: { pid } })).toEqual({ auto: false, reason: 'no-holder-pid' })
    }
  })
})

describe('shouldReplaceIdleServer (D6)', () => {
  const base = { listed: true, ptyCount: 0, serverVersion: '0.7.4-pre.9', currentVersion: '0.7.5-pre.1' }

  it('0 PTYs listed, another version → replace', () => {
    expect(shouldReplaceIdleServer(base)).toBe(true)
  })

  it.each([
    ['same version', { serverVersion: '0.7.5-pre.1' }],
    ['PTYs alive (new tabs still go to the old holder)', { ptyCount: 1 }],
    ['no pty:list answer (0 is a guess)', { listed: false }],
    ['version unknown: no hello', { serverVersion: undefined }],
    ['version unknown: a server that was not told', { serverVersion: '' }],
    ['not a version string', { serverVersion: 'x y' }],
  ] as const)('%s → keep it (silent reconnect)', (_name, change) => {
    expect(shouldReplaceIdleServer({ ...base, ...change })).toBe(false)
  })
})

describe('the upgrade check: reattached, incompatible (D4 / D5)', () => {
  let dir: string
  let file: string
  let lines: string[]
  const logger = { log: (m: string) => { lines.push(m) } }
  const check = (current = '0.7.5-pre.2') => new UpgradeInterruptionCheck({ filePath: file, currentVersion: current, logger })
  const v2 = (agents: { terminalId: string; processes: number }[] = [], holderPid: number | null = 4242) =>
    buildHolderKeptQuitRecord({ version: '0.7.5-pre.1', source: 'running-app', holderPid, endedPtys: [], endedAgentProcesses: agents, claudeSessions: [{ terminalId: 'a', name: 'ws · a', sessionId: S1 }] })

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0861-'))
    file = path.join(dir, LAST_RUN_VERSION_FILE)
    lines = []
  })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('keptHolder: the schema 2 record\'s pid; schema 1 / none → null', () => {
    const c = check()
    expect(c.keptHolder()).toBeNull()
    c.noteInstallerQuit(v2())
    expect(c.keptHolder()).toEqual({ pid: 4242 })
    const one = check()
    one.noteInstallerQuit(buildInstallerQuitRecord({ version: '0.7.5-pre.1', source: 'running-app', ptys: [{ id: 'a' }], claudeSessions: [] }))
    expect(one.keptHolder()).toBeNull()
    const noPid = check()
    noPid.noteInstallerQuit(v2([], null))
    expect(noPid.keptHolder()).toEqual({ pid: null })
  })

  it('reattached, nothing ended → a notice with reattachedPtyCount (ptyCount 0), one log line, no sources', () => {
    writeLastRunVersion(file, '0.7.5-pre.1')
    const c = check()
    c.begin()
    c.noteInstallerQuit(v2())
    c.noteHolderReattached(3, '0.7.5-pre.1')
    expect(c.finish([], list => list.length)).toBeNull()
    expect(c.takeNotice()).toEqual({ previousVersion: '0.7.5-pre.1', currentVersion: '0.7.5-pre.2', ptyCount: 0, agentCount: 0, holderKept: true, reattachedPtyCount: 3 })
    expect(c.takeNotice()).toBeNull()
    expect(lines).toEqual(['[upgrade-interruption] reattached: previous=0.7.5-pre.1 current=0.7.5-pre.2 reattached-ptys=3 holder-version=0.7.5-pre.1'])
  })

  it('reattached with an ended agent → the agent tab listed (cause upgrade) and the reattach count kept', () => {
    writeLastRunVersion(file, '0.7.5-pre.1')
    const c = check()
    c.begin()
    c.noteInstallerQuit(v2([{ terminalId: 'a', processes: 1 }]))
    c.noteHolderReattached(2, '0.7.5-pre.1')
    const sources = c.finish([{ terminals: [{ id: 'a', workspaceId: 'ws' }] }], list => list.length)
    expect(sources?.map(s => [s.terminalId, s.agentPreset, s.sessionId])).toEqual([['a', 'claude-cli', S1]])
    expect(c.takeNotice()).toEqual({ previousVersion: '0.7.5-pre.1', currentVersion: '0.7.5-pre.2', ptyCount: 0, agentCount: 1, holderKept: true, reattachedPtyCount: 2 })
    expect(lines).toEqual(['[upgrade-interruption] detected: previous=0.7.5-pre.1 current=0.7.5-pre.2 ended-ptys=0 agent-tabs=1 source=installer holder-kept ended-agent-tabs=1 reattached-ptys=2 holder-version=0.7.5-pre.1'])
    expect(lines.join('\n')).not.toContain(S1)
  })

  it('same version (a reinstall / cancelled install) → the notice has equal versions (neutral text), log marked same-version', () => {
    writeLastRunVersion(file, '0.7.5-pre.2')
    const c = check()
    c.begin()
    c.noteInstallerQuit(v2())
    c.noteHolderReattached(1, '0.7.5-pre.2')
    c.finish([], list => list.length)
    expect(c.takeNotice()).toMatchObject({ previousVersion: '0.7.5-pre.2', currentVersion: '0.7.5-pre.2', reattachedPtyCount: 1 })
    expect(lines[0]).toContain(' same-version reattached-ptys=1')
  })

  it('last-run-version.json missing → the record\'s version names the previous one', () => {
    const c = check()
    c.begin()
    c.noteInstallerQuit(v2())
    c.noteHolderReattached(1, '0.7.5-pre.1')
    c.finish([], list => list.length)
    expect(c.takeNotice()).toMatchObject({ previousVersion: '0.7.5-pre.1', reattachedPtyCount: 1 })
  })

  it('reattach noted after finish / with 0 PTYs → ignored', () => {
    writeLastRunVersion(file, '0.7.5-pre.1')
    const c = check()
    c.begin()
    c.noteHolderReattached(0, '0.7.5-pre.1')
    expect(c.finish([], list => list.length)).toBeNull()
    c.noteHolderReattached(2, '0.7.5-pre.1')
    expect(c.takeNotice()).toBeNull()
  })

  it('D5: an upgrade met an unusable server → its registry PTYs are ended terminals (source incompatible)', () => {
    writeLastRunVersion(file, '0.7.5-pre.1')
    const c = check()
    c.begin()
    c.noteIncompatibleServer([{ id: 'a', cwd: '/a' }, { id: 'b' }], [{ terminalId: 'a', name: null, sessionId: S1 }])
    const sources = c.finish([{ terminals: [{ id: 'b', agentPreset: 'codex-cli' }] }], list => list.filter(s => s.agentPreset).length)
    expect(sources?.map(s => [s.terminalId, s.agentPreset])).toEqual([['a', 'claude-cli'], ['b', 'codex-cli']])
    expect(c.takeNotice()).toEqual({ previousVersion: '0.7.5-pre.1', currentVersion: '0.7.5-pre.2', ptyCount: 2, agentCount: 2 })
    expect(lines).toEqual(['[upgrade-interruption] detected: previous=0.7.5-pre.1 current=0.7.5-pre.2 ended-ptys=2 agent-tabs=2 source=incompatible'])
  })

  it('D5: same version with a holder-keeping record → detected; same version without one → nothing', () => {
    writeLastRunVersion(file, '0.7.5-pre.2')
    const kept = check()
    kept.begin()
    kept.noteInstallerQuit(v2())
    kept.noteIncompatibleServer([{ id: 'a' }], [])
    kept.finish([], list => list.length)
    expect(kept.takeNotice()).toMatchObject({ ptyCount: 1, holderKept: true })

    lines = []
    const plain = check()
    plain.begin()
    plain.noteIncompatibleServer([{ id: 'a' }], [])
    expect(plain.finish([], list => list.length)).toBeNull()
    expect(plain.takeNotice()).toBeNull()
    expect(lines).toEqual([])
  })

  it('detectUpgradeInterruption: the incompatible input (unchanged rules for the rest)', () => {
    expect(detectUpgradeInterruption({ previousVersion: '1', currentVersion: '2', orphanPtyCount: 0, incompatibleServerPtyCount: 1 })).toBe(true)
    expect(detectUpgradeInterruption({ previousVersion: '2', currentVersion: '2', orphanPtyCount: 0, incompatibleServerPtyCount: 1 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: '2', currentVersion: '2', orphanPtyCount: 0, incompatibleServerPtyCount: 1, holderKept: true })).toBe(true)
    expect(detectUpgradeInterruption({ previousVersion: null, currentVersion: '2', orphanPtyCount: 0, incompatibleServerPtyCount: 3 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: '1', currentVersion: '2', orphanPtyCount: 0, incompatibleServerPtyCount: 0 })).toBe(false)
  })
})

// ── the PtyManager side of the reattach (same calls main makes) ─────────────────────────────────────────

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

describe('PtyManager during and after the reattach', () => {
  const KEPT = 'tab-kept'
  const CWD = os.tmpdir()
  let manager: PtyManager
  let helperEnv: Mock<NonNullable<PtyManagerDeps['helperEnv']>>
  let create: (opts: unknown) => PtyCreateResult | Promise<PtyCreateResult>
  const opts = (id: string) => ({ id, cwd: CWD, type: 'terminal', shell: 'test-shell' })
  const flush = () => new Promise<void>(r => setTimeout(r, 0))

  beforeEach(() => {
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    helperEnv = vi.fn<NonNullable<PtyManagerDeps['helperEnv']>>(() => ({}))
    manager = new PtyManager({ emit: vi.fn(), dataDir: os.tmpdir(), helperEnv })
    const handlers = new Map<string, SharedHandler>()
    registerPtyHandlers((channel, handler) => { handlers.set(channel, handler) }, { getPtyManager: () => manager })
    create = (o) => handlers.get('pty:create')!({ windowId: 'w1' } as never, o) as PtyCreateResult | Promise<PtyCreateResult>
  })

  afterEach(() => {
    manager.beginShutdown()
    manager.dispose()
    vi.restoreAllMocks()
  })

  it('creates stay held until the PTY list registered the kept ids: kept → created: false, no spawn, no capability', async () => {
    manager.holdCreates('PTY holder reattach')
    const kept = create(opts(KEPT))
    expect(kept).toBeInstanceOf(Promise)
    const server = new FakeServer()
    manager.setServerProcess(server as unknown as ChildProcess)
    manager.releaseCreatesOnReplayList()
    await flush()
    expect(manager.isCreateHeld()).toBe(true) // connected, list not there yet: still held
    expect(server.sent.filter(m => m.type === 'pty:create')).toEqual([])
    server.reply({ type: 'pty:list', ptys: [{ id: KEPT, pid: 4242, cwd: CWD }] })
    await expect(kept).resolves.toEqual({ ok: true, created: false })
    expect(server.sent.filter(m => m.type === 'pty:create')).toEqual([])
    expect(helperEnv).not.toHaveBeenCalled()
  })

  it('resuming an agent tab on a kept shell (T0766 / T0767: kill, then create): one pty:kill, then one pty:create on the holder', async () => {
    const server = new FakeServer()
    manager.setServerProcess(server as unknown as ChildProcess)
    server.reply({ type: 'pty:list', ptys: [{ id: KEPT, pid: 4242, cwd: CWD }, { id: 'tab-other', pid: 4343, cwd: CWD }] })
    expect(create(opts(KEPT))).toEqual({ ok: true, created: false }) // the restored tab attaches, no launch

    expect(manager.kill(KEPT)).toBe(true)
    expect(await create(opts(KEPT))).toEqual({ ok: true, created: true })
    const ptyMessages = server.sent.filter(m => m.type === 'pty:kill' || m.type === 'pty:create').map(m => [m.type, (m as { id: string }).id])
    expect(ptyMessages).toEqual([['pty:kill', KEPT], ['pty:create', KEPT]])
    // the other kept tab is untouched
    expect(manager.isAlive('tab-other')).toBe(true)
  })
})

// ── main.ts wiring ─────────────────────────────────────────────────────────────────────────────────────

describe('main.ts wiring (source guard)', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8')
  const fn = (name: string) => {
    const start = main.indexOf(`async function ${name}(`)
    expect(start, name).toBeGreaterThan(-1)
    return main.slice(start, main.indexOf('\n}\n', start))
  }
  const ordered = (block: string, texts: string[]) => {
    let at = 0
    for (const text of texts) {
      const next = block.indexOf(text, at)
      expect(next, text).toBeGreaterThanOrEqual(at)
      at = next + text.length
    }
  }

  it('startTerminalServer: the reattach decision comes before the Recovery prompt; hold → shared keep → noted → return', () => {
    const start = fn('startTerminalServer')
    ordered(start, [
      'if (ptyCount > 0) {',
      'const reattach = decideHolderReattach({',
      'keptHolder: upgradeInterruptionCheck?.keptHolder() ?? null',
      'pidFilePid: readPidFile(userDataPath)',
      'if (reattach.auto) {',
      "ptyManager?.holdCreates('PTY holder reattach')",
      "if (await reconnectKeptTerminalServer(port, userDataPath, 'PTY holder reattach')) {",
      'terminalServerReattachedAtStartup = true',
      'upgradeInterruptionCheck?.noteHolderReattached(ptyCount,',
      'return',
      '_terminalServerStarted = false',
      'await startTerminalServer() // the server is gone or ended',
      "ptyManager?.releaseCreates('PTY holder reattach failed: new Terminal Server')",
      'pendingRecovery = { port, ptyCount }',
      "ptyManager?.holdCreates('Recovery prompt pending')",
    ])
    expect(start).toMatch(/finally \{\s*ptyManager\?\.releaseCreates\('PTY holder reattach failed/)
    // the automatic path never sets pendingRecovery (no prompt)
    const auto = start.slice(start.indexOf('if (reattach.auto) {'), start.indexOf('pendingRecovery = { port, ptyCount }'))
    expect(auto).not.toContain('pendingRecovery')
  })

  it('D5: an unusable server is ended through endUnusableTerminalServer (registry read before the shutdown)', () => {
    expect(fn('startTerminalServer')).toContain('await endUnusableTerminalServer(port, userDataPath, token)')
    ordered(fn('endUnusableTerminalServer'), [
      'const registry = readRegistry(userDataPath)',
      'const gone = await endTerminalServer(port, userDataPath, token)',
      'if (!gone) return',
      'upgradeInterruptionCheck?.noteIncompatibleServer(registry?.ptys ?? [], sessions)',
    ])
    ordered(fn('endTerminalServer'), [
      'if (await shutdownTerminalServerAndWait(port, userDataPath, token, what)) return true',
      "if (process.platform !== 'win32') return false",
      'await forceStopTerminalServer(userDataPath)',
    ])
    expect(fn('reconnectKeptTerminalServer')).toContain('await endUnusableTerminalServer(port, userDataPath, token)')
  })

  it('D6: 0 PTYs + another version → endTerminalServer, then the normal fork (silent reconnect otherwise)', () => {
    ordered(fn('startTerminalServer'), [
      'const replace = probe.ok && shouldReplaceIdleServer({ listed: probe.listed, ptyCount: probe.ptyCount, serverVersion, currentVersion: app.getVersion() })',
      '} else if (replace) {',
      "await endTerminalServer(port, userDataPath, token, 'replaced')",
      '} else if (ptyManager) {',
      'const connected = await ptyManager.connectToServer(port, token)',
    ])
  })

  it('the first load after a reattach does not re-probe (no Recovery prompt for the attached PTYs); later loads do', () => {
    const at = main.indexOf("win.webContents.on('did-finish-load', async () => {")
    const block = main.slice(main.lastIndexOf('let firstLoad = true', at), main.indexOf("win.webContents.send('terminal-server:recovery-available'", at))
    ordered(block, [
      'let firstLoad = true',
      'const reattachedLoad = firstLoad && terminalServerReattachedAtStartup',
      'firstLoad = false',
      'if (!pendingRecovery && !reattachedLoad) {',
      'const probe = await probeServerPtyCount(',
    ])
    expect(main.match(/terminalServerReattachedAtStartup = true/g)).toHaveLength(1)
  })

  it('no userData path, no electron import in upgrade-interruption.ts (unchanged)', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'upgrade-interruption.ts'), 'utf8')
    expect(mod).not.toMatch(/getPath\(/)
    expect(mod).not.toMatch(/from 'electron'/)
  })
})
