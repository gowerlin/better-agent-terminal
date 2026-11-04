// @vitest-environment node
/**
 * PLAN-065 W4 / T0860: the installer's quit keeps a Terminal Server that runs from the PTY holder.
 * - two paths: holder (keep it, 24 h idle, end the tabs' processes under the install directory, schema 2)
 *   and no holder (T0823 unchanged: schema 1, the server stops) — controller and request process;
 * - `--uninstall-quit-request` (a real uninstall: always stops; the request process force-ends if needed);
 * - D3: which processes are ended (path only, never the shell, never outside the trees);
 * - the record schema 1 / 2 and the next start's upgrade check;
 * - source guards: main.ts wiring, build/installer.nsh (`${isUpdated}` branches, customUnInstall), templates.
 * The T0823 tests (installer-quit-request.test.ts) stay as they are.
 */
import * as fs from 'fs'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('installer-quit-request must not import electron')
})

import {
  INSTALLER_QUIT_HOLDER_IDLE_MS,
  INSTALLER_QUIT_RECORD_FILE,
  INSTALLER_QUIT_REQUEST_ARG,
  INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS,
  InstallerQuitController,
  UNINSTALL_QUIT_REQUEST_ARG,
  buildHolderKeptQuitRecord,
  buildInstallerQuitRecord,
  endInstallDirAgentProcesses,
  findInstallDirAgentProcesses,
  isInstallerQuitRequest,
  isKeptHolderHello,
  isPathInsideDir,
  isUninstallQuitRequest,
  parseProcessList,
  ptyRootsOf,
  queryKeptHolder,
  readInstallerQuitRecord,
  runInstallerQuitWithoutApp,
  summarizeEndedAgents,
  takeInstallerQuitRecord,
  writeInstallerQuitRecord,
  type EndAgentProcessesDeps,
  type InstallDirProcess,
  type InstallerQuitHolderRecord,
  type InstallerQuitRecord,
  type ProcessListEntry,
  type PtyRoot,
} from '../installer-quit-request'
import { LAST_RUN_VERSION_FILE, UpgradeInterruptionCheck, detectUpgradeInterruption, writeLastRunVersion } from '../upgrade-interruption'
import { MAX_IDLE_EXTENSION_MS, type HelloOk } from '../terminal-server/protocol'

const S1 = '11111111-2222-4333-8444-555555555555'
const S2 = '66666666-7777-4888-9999-aaaaaaaaaaaa'
const ROOT = path.join(__dirname, '..', '..')
const INSTALL = 'C:\\Users\\u\\AppData\\Local\\Programs\\BetterAgentTerminal'
const HOLDER_DIR = 'C:\\Users\\u\\AppData\\Local\\BAT-PtyHolder\\24.22.2-ec44482acf96'

let dir: string
let lines: string[]
const logger = { log: (m: string) => { lines.push(m) } }

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0860-'))
  lines = []
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function hello(over: Partial<HelloOk> = {}): HelloOk {
  return { type: 'server:hello-ok', protocol: 1, batVersion: '0.7.5', runtime: { name: 'node', version: 'v24.22.2' }, holderDir: HOLDER_DIR, pid: 4242, ...over }
}

describe('arguments', () => {
  it('--uninstall-quit-request: exact, separate from the installer\'s', () => {
    expect(UNINSTALL_QUIT_REQUEST_ARG).toBe('--uninstall-quit-request')
    expect(isUninstallQuitRequest(['exe', '--uninstall-quit-request'])).toBe(true)
    expect(isUninstallQuitRequest(['exe', '--uninstall-quit-request=1'])).toBe(false)
    expect(isUninstallQuitRequest(['exe', '--UNINSTALL-QUIT-REQUEST'])).toBe(false)
    expect(isUninstallQuitRequest(['exe', INSTALLER_QUIT_REQUEST_ARG])).toBe(false)
    expect(isInstallerQuitRequest(['exe', UNINSTALL_QUIT_REQUEST_ARG])).toBe(false)
    expect(isUninstallQuitRequest(null)).toBe(false)
  })
})

describe('holder detection (hello) and paths', () => {
  it('isPathInsideDir: case-insensitive, separators, no sibling prefix', () => {
    expect(isPathInsideDir(`${INSTALL}\\resources\\x\\claude.exe`, INSTALL)).toBe(true)
    expect(isPathInsideDir(`${INSTALL.toUpperCase()}\\A.EXE`, INSTALL)).toBe(true)
    expect(isPathInsideDir(INSTALL.replace(/\\/g, '/') + '/a.exe', INSTALL + '\\')).toBe(true)
    expect(isPathInsideDir(INSTALL, INSTALL)).toBe(true)
    expect(isPathInsideDir(`${INSTALL}-old\\claude.exe`, INSTALL)).toBe(false)
    expect(isPathInsideDir('C:\\other\\claude.exe', INSTALL)).toBe(false)
    expect(isPathInsideDir(null, INSTALL)).toBe(false)
    expect(isPathInsideDir('C:\\a', '')).toBe(false)
  })

  it('a kept holder = plain node + holderDir outside the install dir (and not containing it)', () => {
    expect(isKeptHolderHello(hello(), INSTALL)).toBe(true)
    expect(isKeptHolderHello(hello({ runtime: { name: 'electron', version: 'v24' } }), INSTALL)).toBe(false)
    expect(isKeptHolderHello(hello({ holderDir: undefined }), INSTALL)).toBe(false)
    expect(isKeptHolderHello(hello({ holderDir: `${INSTALL}\\resources\\pty-holder` }), INSTALL)).toBe(false)
    expect(isKeptHolderHello(hello({ holderDir: 'C:\\Users\\u\\AppData\\Local' }), INSTALL)).toBe(false)
    expect(isKeptHolderHello(null, INSTALL)).toBe(false) // a server before T0857
  })
})

describe('D3: processes under the install directory in the tabs\' trees', () => {
  const t0 = Date.parse('2026-11-05T00:00:00Z')
  const p = (pid: number, parentPid: number, exe: string | null, created = t0 + pid): ProcessListEntry => ({ pid, parentPid, createdAt: created, path: exe })
  const roots: PtyRoot[] = [{ id: 'tab-a', pid: 100 }, { id: 'tab-b', pid: 200 }]
  const list: ProcessListEntry[] = [
    p(10, 1, 'C:\\Users\\u\\AppData\\Local\\BAT-PtyHolder\\k\\bat-pty-holder.exe'),         // holder (not in a tree)
    p(11, 1, `${INSTALL}\\BetterAgentTerminal.exe`),                                         // BAT main (not in a tree)
    p(100, 10, 'C:\\Windows\\System32\\cmd.exe'),                                            // tab-a shell
    p(101, 100, `${INSTALL}\\resources\\app.asar.unpacked\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe`),
    p(102, 101, 'C:\\Program Files\\Git\\bin\\bash.exe'),                                    // claude's tool shell: stays
    p(103, 102, `${INSTALL}\\BetterAgentTerminal.exe`),                                      // MCP shim via the BAT exe: under the dir
    p(104, 100, 'C:\\tools\\claude.exe'),                                                    // same name, other dir: stays
    p(200, 10, `${INSTALL}\\resources\\fake-shell.exe`),                                     // tab-b root under the dir: never the shell
    p(201, 200, `${INSTALL}\\resources\\codex.exe`),
    p(300, 100, `${INSTALL}\\old.exe`, t0 - 1),                                              // older than its "parent": a reused pid
    p(400, 11, `${INSTALL}\\resources\\claude.exe`),                                         // the Claude panel's claude: not a tab
  ]

  it('path only, never the shell, never outside the trees, not a reused parent pid', () => {
    expect(findInstallDirAgentProcesses(list, roots, INSTALL)).toEqual([
      { terminalId: 'tab-a', pid: 101 },
      { terminalId: 'tab-a', pid: 103 },
      { terminalId: 'tab-b', pid: 201 },
    ])
    expect(summarizeEndedAgents(findInstallDirAgentProcesses(list, roots, INSTALL))).toEqual([
      { terminalId: 'tab-a', processes: 2 },
      { terminalId: 'tab-b', processes: 1 },
    ])
  })

  it('a different install dir, an empty one, unknown roots, cycles → nothing extra', () => {
    expect(findInstallDirAgentProcesses(list, roots, 'C:\\elsewhere')).toEqual([])
    expect(findInstallDirAgentProcesses(list, roots, '')).toEqual([])
    expect(findInstallDirAgentProcesses(list, [{ id: 'gone', pid: 999 }], INSTALL)).toEqual([])
    const cyc = [p(1, 2, 'C:\\x\\a.exe', null as unknown as number), p(2, 1, `${INSTALL}\\b.exe`, null as unknown as number)]
    cyc.forEach(c => { c.createdAt = null })
    expect(findInstallDirAgentProcesses(cyc, [{ id: 't', pid: 1 }], INSTALL)).toEqual([{ terminalId: 't', pid: 2 }])
  })

  it('parseProcessList: the PowerShell lines; malformed ones skipped', () => {
    const text = [
      `101\t100\t2026-11-05T00:00:01.0000000Z\t${INSTALL}\\claude.exe`,
      '4\t0\t\t',
      'x\t1\t\tC:\\a.exe',
      '',
      '7\t-1\t\tC:\\b.exe',
    ].join('\r\n')
    expect(parseProcessList(text)).toEqual([
      { pid: 101, parentPid: 100, createdAt: Date.parse('2026-11-05T00:00:01Z'), path: `${INSTALL}\\claude.exe` },
      { pid: 4, parentPid: 0, createdAt: null, path: null },
    ])
  })

  it('ptyRootsOf: registry entries with an id and a pid', () => {
    expect(ptyRootsOf([{ id: 'a', pid: 1, cwd: 'x' }, { id: 'b' }, { id: 'bad id!', pid: 2 }, null, { id: 'c', pid: 3 }])).toEqual([{ id: 'a', pid: 1 }, { id: 'c', pid: 3 }])
  })

  function endDeps(over: Partial<EndAgentProcessesDeps> = {}) {
    const killed: number[] = []
    const alive = new Set([101, 103, 201])
    const deps: EndAgentProcessesDeps = {
      listProcesses: async () => list,
      kill: pid => { killed.push(pid); alive.delete(pid) },
      isAlive: pid => alive.has(pid),
      sleep: async () => {},
      logger,
      ...over,
    }
    return { deps, killed }
  }

  it('endInstallDirAgentProcesses: kills only those, logs counts only', async () => {
    const { deps, killed } = endDeps()
    const ended = await endInstallDirAgentProcesses(roots, INSTALL, deps)
    expect(killed).toEqual([101, 103, 201])
    expect(ended.map(e => e.pid)).toEqual([101, 103, 201])
    expect(lines).toEqual(['[installer-quit] ended 3 agent process(es) under the install directory in 2 tab(s)'])
    expect(lines.join('\n')).not.toMatch(/claude|codex|AppData|\\\\/i)
  })

  it('no process list → nothing ended; no roots → no list asked; a vanished process still counts', async () => {
    const none = endDeps({ listProcesses: async () => null })
    expect(await endInstallDirAgentProcesses(roots, INSTALL, none.deps)).toEqual([])
    expect(none.killed).toEqual([])
    expect(lines.at(-1)).toBe('[installer-quit] process list unavailable — no agent process ended')
    const asked = vi.fn(async () => list)
    expect(await endInstallDirAgentProcesses([], INSTALL, endDeps({ listProcesses: asked }).deps)).toEqual([])
    expect(asked).not.toHaveBeenCalled()
    const gone = endDeps({ kill: () => { throw new Error('ESRCH') }, isAlive: () => false })
    expect((await endInstallDirAgentProcesses(roots, INSTALL, gone.deps)).length).toBe(3)
  })
})

describe('record schema 2 (schema 1 unchanged)', () => {
  it('build / write / read / take: schema 2', () => {
    const file = path.join(dir, INSTALLER_QUIT_RECORD_FILE)
    const record = buildHolderKeptQuitRecord({
      version: '0.7.5-pre.1',
      source: 'running-app',
      holderPid: 4242,
      endedPtys: [],
      endedAgentProcesses: [{ terminalId: 'a', processes: 2 }, { terminalId: 'a', processes: 1 }, { terminalId: 'b', processes: 0 }, { terminalId: 'bad id!', processes: 1 }],
      claudeSessions: [{ terminalId: 'a', name: 'ws · a', sessionId: S1 }],
    })
    expect(record).toEqual({
      schema: 2,
      version: '0.7.5-pre.1',
      source: 'running-app',
      holderKept: true,
      holderPid: 4242,
      endedPtys: [],
      endedAgentProcesses: [{ terminalId: 'a', processes: 2 }],
      claudeSessions: [{ terminalId: 'a', name: 'ws · a', sessionId: S1 }],
    })
    expect(buildHolderKeptQuitRecord({ version: 'x y', source: 'server-only', holderPid: -1, endedAgentProcesses: [], claudeSessions: [] })).toMatchObject({ version: 'unknown', holderPid: null, source: 'server-only' })
    expect(writeInstallerQuitRecord(file, record)).toBe(true)
    expect(readInstallerQuitRecord(file)).toEqual({ status: 'ok', record })
    expect(takeInstallerQuitRecord(file, logger)).toEqual(record)
    expect(fs.existsSync(file)).toBe(false)
    expect(lines).toEqual(['[installer-quit] record found: version=0.7.5-pre.1 source=running-app holder-kept ended-ptys=0 agent-tabs=1 claude-sessions=1'])
    expect(lines.join('\n')).not.toContain(S1)
  })

  it('schema 2 without holderKept / its arrays is invalid; schema 1 still reads as before', () => {
    const file = path.join(dir, INSTALLER_QUIT_RECORD_FILE)
    for (const bad of [
      { schema: 2, version: '1', holderKept: false, endedPtys: [], endedAgentProcesses: [] },
      { schema: 2, version: '1', holderKept: true, endedAgentProcesses: [] },
      { schema: 2, version: '1', holderKept: true, endedPtys: [] },
      { schema: 3, version: '1', holderKept: true, endedPtys: [], endedAgentProcesses: [] },
    ]) {
      fs.writeFileSync(file, JSON.stringify(bad))
      expect(readInstallerQuitRecord(file).status).toBe('invalid')
    }
    const v1 = buildInstallerQuitRecord({ version: '0.7.4', source: 'running-app', ptys: [{ id: 'a' }], claudeSessions: [] })
    writeInstallerQuitRecord(file, v1)
    expect(readInstallerQuitRecord(file)).toEqual({ status: 'ok', record: v1 })
    expect(v1.schema).toBe(1)
  })
})

describe('InstallerQuitController: two paths', () => {
  function controller(over: Partial<ConstructorParameters<typeof InstallerQuitController>[0]> = {}) {
    const calls: string[] = []
    const v1: InstallerQuitRecord[] = []
    const v2: InstallerQuitHolderRecord[] = []
    const c = new InstallerQuitController({
      version: '0.7.5-pre.1',
      isQuitting: () => false,
      collect: () => ({
        ptys: [{ id: 'a', cwd: '/a' }, { id: 'b' }],
        claudeSessions: [{ terminalId: 'a', name: 'n', sessionId: S1 }, { terminalId: 'b', name: null, sessionId: S2 }],
      }),
      writeRecord: (record) => { calls.push('write'); v1.push(record); return true },
      quit: () => { calls.push('quit') },
      logger,
      serverFromHolder: () => true,
      writeHolderRecord: (record) => { calls.push('write2'); v2.push(record); return true },
      keptHolder: async () => { calls.push('holder?'); return { pid: 4242, extension: 'extended' } },
      ptyRoots: () => [{ id: 'a', pid: 100 }, { id: 'b', pid: 200 }],
      endAgentProcesses: async (roots) => { calls.push(`end ${roots.length}`); return [{ terminalId: 'a', pid: 101 }, { terminalId: 'a', pid: 103 }] },
      quitKeepingServer: () => { calls.push('quit-keep') },
      ...over,
    })
    return { c, calls, v1, v2 }
  }

  it('holder: hello + idle first, then the agents, the schema 2 record, quit keeping the server', async () => {
    const { c, calls, v2 } = controller()
    c.markReady()
    c.request()
    await c.whenDone()
    expect(calls).toEqual(['holder?', 'end 2', 'write2', 'quit-keep'])
    expect(v2[0]).toEqual({
      schema: 2,
      version: '0.7.5-pre.1',
      source: 'running-app',
      holderKept: true,
      holderPid: 4242,
      endedPtys: [],
      endedAgentProcesses: [{ terminalId: 'a', processes: 2 }],
      // only the tabs whose agent ended (b's claude was not under the install dir)
      claudeSessions: [{ terminalId: 'a', name: 'n', sessionId: S1 }],
    })
    expect(lines).toEqual(['[installer-quit] request received: Terminal Server runs from the PTY holder (idle extended) — keeping it with 2 terminal(s); recorded 1 tab(s) with ended agent processes, 1 claude session(s) — quitting without confirmation'])
    expect(lines.join('\n')).not.toContain(S1)
  })

  it('🔴 no holder known (zip, dev, macOS / Linux) → T0823 exactly: synchronous, schema 1, quit stopping the server', () => {
    const { c, calls, v1 } = controller({ serverFromHolder: () => false })
    c.markReady()
    c.request()
    expect(calls).toEqual(['write', 'quit'])
    expect(v1[0]).toMatchObject({ schema: 1, source: 'running-app', ptys: [{ id: 'a', cwd: '/a' }, { id: 'b' }] })
    expect(lines).toEqual(['[installer-quit] request received: recorded 2 terminal(s), 2 claude session(s) — quitting without confirmation, stopping the Terminal Server'])
  })

  it('no holder deps at all (T0823 deps) → T0823 path', () => {
    const { c, calls } = controller({ keptHolder: undefined, quitKeepingServer: undefined })
    c.markReady()
    c.request()
    expect(calls).toEqual(['write', 'quit'])
  })

  it('holder known but the hello says otherwise (or fails) → T0823 path, no agent ended', async () => {
    for (const keptHolder of [async () => null, async () => { throw new Error('x') }]) {
      lines = []
      const { c, calls, v1 } = controller({ keptHolder })
      c.markReady()
      c.request()
      await c.whenDone()
      expect(calls).toEqual(['write', 'quit'])
      expect(v1[0].schema).toBe(1)
    }
  })

  it('uninstall: always the T0823 path (the server stops), the hello is not even asked', () => {
    const { c, calls } = controller()
    c.markReady()
    c.request('uninstall')
    expect(calls).toEqual(['write', 'quit'])
    expect(lines[0]).toBe('[installer-quit] uninstall request — the Terminal Server stops too')
  })

  it('during startup: an uninstall request wins over an upgrade one; run once by markReady', () => {
    const { c, calls } = controller()
    c.request()
    c.request('uninstall')
    expect(calls).toEqual([])
    c.markReady()
    expect(calls).toEqual(['write', 'quit'])
  })

  it('a quit in progress → nothing on either path; agent / record failures never stop the quit', async () => {
    const busy = controller({ isQuitting: () => true })
    busy.c.markReady()
    busy.c.request()
    await busy.c.whenDone()
    expect(busy.calls).toEqual([])
    const broken = controller({ endAgentProcesses: async () => { throw new Error('ps') }, writeHolderRecord: () => { throw new Error('disk') } })
    broken.c.markReady()
    broken.c.request()
    await broken.c.whenDone()
    expect(broken.calls).toEqual(['holder?', 'quit-keep'])
  })
})

describe('runInstallerQuitWithoutApp: holder, uninstall', () => {
  function deps(over: Partial<Parameters<typeof runInstallerQuitWithoutApp>[0]> = {}) {
    const calls: string[] = []
    const v1: InstallerQuitRecord[] = []
    const v2: InstallerQuitHolderRecord[] = []
    let roots: readonly PtyRoot[] = []
    return {
      calls,
      v1,
      v2,
      roots: () => roots,
      deps: {
        version: '0.7.5-pre.1',
        serverRunning: () => true,
        registryPtys: () => [{ id: 'a', pid: 100, cwd: '/a', createdAt: 'x' }, { id: 'b', pid: 200, cwd: '/b', createdAt: 'x' }],
        storedClaudeSessions: () => [{ terminalId: 'a', name: null, sessionId: S1 }, { terminalId: 'b', name: null, sessionId: S2 }],
        writeRecord: (record: InstallerQuitRecord) => { calls.push('write'); v1.push(record); return true },
        writeHolderRecord: (record: InstallerQuitHolderRecord) => { calls.push('write2'); v2.push(record); return true },
        sendShutdown: async () => { calls.push('shutdown'); return true },
        waitForServerExit: async (ms: number) => { calls.push(`wait ${ms}`); return true },
        logger,
        keptHolder: async () => { calls.push('holder?'); return { pid: 4242, extension: 'already-extended' as const } },
        endAgentProcesses: async (r: readonly PtyRoot[]) => { calls.push('end'); roots = r; return [{ terminalId: 'b', pid: 201 }] as InstallDirProcess[] },
        forceStopServer: async () => { calls.push('force'); return true },
        ...over,
      },
    }
  }

  it('upgrade + kept holder → no shutdown; agents of the registry\'s tabs ended; schema 2 (server-only)', async () => {
    const t = deps()
    expect(await runInstallerQuitWithoutApp(t.deps)).toBe('holder-kept')
    expect(t.calls).toEqual(['holder?', 'end', 'write2'])
    expect(t.roots()).toEqual([{ id: 'a', pid: 100 }, { id: 'b', pid: 200 }])
    expect(t.v2[0]).toMatchObject({ schema: 2, source: 'server-only', holderPid: 4242, endedPtys: [], endedAgentProcesses: [{ terminalId: 'b', processes: 1 }], claudeSessions: [{ terminalId: 'b', sessionId: S2 }] })
    expect(lines.at(-1)).toBe('[installer-quit] no running BAT; Terminal Server runs from the PTY holder (idle already-extended) — keeping it with 2 terminal(s); recorded 1 tab(s) with ended agent processes')
  })

  it('🔴 upgrade, not a holder → T0823 path exactly (schema 1 record, shutdown, wait)', async () => {
    const t = deps({ keptHolder: async () => { t.calls.push('holder?'); return null } })
    expect(await runInstallerQuitWithoutApp(t.deps)).toBe('server-stopped')
    expect(t.calls).toEqual(['holder?', 'write', 'shutdown', `wait ${INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS}`])
    expect(t.v1[0].schema).toBe(1)
  })

  it('uninstall: the holder is not kept (not even asked); stuck → force-ended; upgrade never forces', async () => {
    const u = deps({ kind: 'uninstall' })
    expect(await runInstallerQuitWithoutApp(u.deps)).toBe('server-stopped')
    expect(u.calls).toEqual(['write', 'shutdown', `wait ${INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS}`])
    const stuck = deps({ kind: 'uninstall', waitForServerExit: async () => false })
    expect(await runInstallerQuitWithoutApp(stuck.deps)).toBe('server-force-stopped')
    expect(stuck.calls).toEqual(['write', 'shutdown', 'force'])
    expect(lines.at(-1)).toContain('— ended (uninstall)')
    const cannot = deps({ kind: 'uninstall', waitForServerExit: async () => false, forceStopServer: async () => false })
    expect(await runInstallerQuitWithoutApp(cannot.deps)).toBe('server-still-running')
    const upgradeStuck = deps({ keptHolder: async () => null, waitForServerExit: async () => false })
    expect(await runInstallerQuitWithoutApp(upgradeStuck.deps)).toBe('server-still-running')
    expect(upgradeStuck.calls).not.toContain('force')
  })

  it('no server → nothing on any kind', async () => {
    for (const kind of ['upgrade', 'uninstall'] as const) {
      const t = deps({ kind, serverRunning: () => false })
      expect(await runInstallerQuitWithoutApp(t.deps)).toBe('no-server')
      expect(t.calls).toEqual([])
    }
  })
})

describe('queryKeptHolder (real TCP)', () => {
  let server: net.Server | null = null
  let received: Record<string, unknown>[] = []
  afterEach(async () => {
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()))
    server = null
    received = []
  })

  async function fakeServer(answer: (msg: Record<string, unknown>, socket: net.Socket) => void): Promise<number> {
    server = net.createServer((socket) => {
      let buf = ''
      socket.on('data', (chunk) => {
        buf += chunk.toString()
        const parts = buf.split('\n')
        buf = parts.pop()!
        for (const line of parts) {
          if (!line.trim()) continue
          const msg = JSON.parse(line) as Record<string, unknown>
          received.push(msg)
          answer(msg, socket)
        }
      })
      socket.on('error', () => {})
    })
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', () => resolve()))
    return (server!.address() as net.AddressInfo).port
  }

  const send = (socket: net.Socket, msg: unknown) => socket.write(JSON.stringify(msg) + '\n')

  it('a holder → hello with the token, then extendIdle 24 h on the same connection', async () => {
    const port = await fakeServer((msg, socket) => {
      if (msg.type === 'server:hello') send(socket, hello())
      if (msg.type === 'server:ping') send(socket, { type: 'server:pong' })
      if (msg.type === 'server:extendIdle') send(socket, { type: 'server:idle-extended', idleTimeoutMs: msg.durationMs, configuredIdleTimeoutMs: 1800000 })
    })
    expect(await queryKeptHolder({ port, token: 'tok', installDir: INSTALL })).toEqual({ holder: true, pid: 4242, extension: 'extended' })
    expect(received.map(m => m.type)).toEqual(['server:hello', 'server:ping', 'server:extendIdle'])
    expect(received[0].token).toBe('tok')
    expect(received[2].durationMs).toBe(INSTALLER_QUIT_HOLDER_IDLE_MS)
    expect(INSTALLER_QUIT_HOLDER_IDLE_MS).toBe(MAX_IDLE_EXTENSION_MS)
    expect(INSTALLER_QUIT_HOLDER_IDLE_MS).toBe(86_400_000)
  })

  it('ALREADY_EXTENDED is not a failure; no answer → failed (still the holder)', async () => {
    const port = await fakeServer((msg, socket) => {
      if (msg.type === 'server:hello') send(socket, hello())
      if (msg.type === 'server:extendIdle') send(socket, { type: 'error', requestType: 'server:extendIdle', code: 'ALREADY_EXTENDED', message: 'x' })
    })
    expect(await queryKeptHolder({ port, token: 't', installDir: INSTALL })).toEqual({ holder: true, pid: 4242, extension: 'already-extended' })
    await new Promise<void>(resolve => server!.close(() => resolve()))
    const silent = await fakeServer((msg, socket) => { if (msg.type === 'server:hello') send(socket, hello()) })
    expect(await queryKeptHolder({ port: silent, token: 't', installDir: INSTALL, timeoutMs: 200 })).toEqual({ holder: true, pid: 4242, extension: 'failed' })
  })

  it('not a holder (Electron-run server, server before v1) → no extendIdle sent', async () => {
    const port = await fakeServer((msg, socket) => {
      if (msg.type === 'server:hello') send(socket, hello({ runtime: { name: 'electron', version: 'v24' }, holderDir: undefined }))
    })
    expect(await queryKeptHolder({ port, token: 't', installDir: INSTALL })).toEqual({ holder: false, reason: 'not-a-holder' })
    expect(received.map(m => m.type)).not.toContain('server:extendIdle')
    await new Promise<void>(resolve => server!.close(() => resolve()))
    received = []
    const old = await fakeServer((msg, socket) => { if (msg.type === 'server:ping') send(socket, { type: 'server:pong' }) })
    expect(await queryKeptHolder({ port: old, token: null, installDir: INSTALL })).toEqual({ holder: false, reason: 'not-a-holder' })
    expect(received.map(m => m.type)).not.toContain('server:extendIdle')
  })

  it('no port / nothing listening → the T0823 path', async () => {
    expect(await queryKeptHolder({ port: null, token: 't', installDir: INSTALL })).toEqual({ holder: false, reason: 'no-port' })
    const port = await fakeServer(() => {})
    await new Promise<void>(resolve => server!.close(() => resolve()))
    server = null
    expect(await queryKeptHolder({ port, token: 't', installDir: INSTALL, timeoutMs: 500 })).toEqual({ holder: false, reason: 'hello-failed' })
  })
})

describe('the next start: schema 2 in the upgrade check', () => {
  let file: string
  beforeEach(() => { file = path.join(dir, LAST_RUN_VERSION_FILE) })
  const check = () => new UpgradeInterruptionCheck({ filePath: file, currentVersion: '0.7.5-pre.2', logger })
  const v2 = (agents: { terminalId: string; processes: number }[], sessions = [{ terminalId: 'a', name: 'ws · a', sessionId: S1 }]) =>
    buildHolderKeptQuitRecord({ version: '0.7.5-pre.1', source: 'running-app', holderPid: 4242, endedPtys: [], endedAgentProcesses: agents, claudeSessions: sessions })

  it('detect: the record\'s agent tabs count like its PTYs (schema 1 inputs unchanged)', () => {
    expect(detectUpgradeInterruption({ previousVersion: '1', currentVersion: '2', orphanPtyCount: 0, installerQuitPtyCount: 0, installerQuitAgentTabCount: 1 })).toBe(true)
    expect(detectUpgradeInterruption({ previousVersion: '2', currentVersion: '2', orphanPtyCount: 0, installerQuitAgentTabCount: 1 })).toBe(true)
    expect(detectUpgradeInterruption({ previousVersion: null, currentVersion: '2', orphanPtyCount: 0, installerQuitAgentTabCount: 1 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: '1', currentVersion: '2', orphanPtyCount: 0, installerQuitAgentTabCount: 0 })).toBe(false)
  })

  it('holder kept with an ended agent → its tab listed (cause upgrade), no "ended N terminals" (ptyCount 0)', () => {
    writeLastRunVersion(file, '0.7.5-pre.1')
    const c = check()
    c.begin()
    c.noteInstallerQuit(v2([{ terminalId: 'a', processes: 1 }]))
    const sources = c.finish([{ terminals: [{ id: 'a', workspaceId: 'ws' }, { id: 'b', agentPreset: 'claude-cli' }] }], list => list.filter(s => s.agentPreset).length)
    expect(sources?.map(s => [s.terminalId, s.agentPreset, s.sessionId])).toEqual([['a', 'claude-cli', S1]])
    expect(c.takeNotice()).toEqual({ previousVersion: '0.7.5-pre.1', currentVersion: '0.7.5-pre.2', ptyCount: 0, agentCount: 1, holderKept: true })
    expect(lines).toEqual(['[upgrade-interruption] detected: previous=0.7.5-pre.1 current=0.7.5-pre.2 ended-ptys=0 agent-tabs=1 source=installer holder-kept ended-agent-tabs=1'])
    expect(lines.join('\n')).not.toContain(S1)
  })

  it('holder kept, nothing ended → nothing (the terminals are still running)', () => {
    writeLastRunVersion(file, '0.7.5-pre.1')
    const c = check()
    c.begin()
    c.noteInstallerQuit(v2([]))
    expect(c.finish([], list => list.length)).toBeNull()
    expect(c.takeNotice()).toBeNull()
  })

  it('holder kept but it died before the restart (orphans) → the orphans + the agent tabs, by id once', () => {
    writeLastRunVersion(file, '0.7.5-pre.1')
    const c = check()
    c.begin()
    c.noteInstallerQuit(v2([{ terminalId: 'a', processes: 1 }]))
    c.noteOrphanCleanup([{ id: 'a' }, { id: 'b' }], [])
    const sources = c.finish([], list => list.length)
    expect(sources?.map(s => s.terminalId)).toEqual(['a', 'b'])
    expect(c.takeNotice()).toMatchObject({ ptyCount: 2, holderKept: true })
  })
})

describe('source guards (T0860)', () => {
  const main = fs.readFileSync(path.join(ROOT, 'electron', 'main.ts'), 'utf8')
  const nsh = fs.readFileSync(path.join(ROOT, 'build', 'installer.nsh'), 'utf8')
  const macro = (name: string) => {
    const start = nsh.indexOf(`!macro ${name}`)
    expect(start, name).toBeGreaterThanOrEqual(0)
    return nsh.slice(start, nsh.indexOf('!macroend', start))
  }

  it('main.ts: both requests make a request process; the whenReady guard returns for it', () => {
    expect(main).toContain('const installerQuitRequestProcess = isInstallerQuitRequest(process.argv) || isUninstallQuitRequest(process.argv)')
    const handler = main.indexOf("app.on('second-instance', async (_event, argv) => {")
    expect(main.slice(handler, handler + 400)).toContain('if (isUninstallQuitRequest(argv)) return')
    expect(main).toContain("  if (isInstallerQuitRequest(argv)) installerQuit.request()\n  else if (isUninstallQuitRequest(argv)) installerQuit.request('uninstall')")
  })

  it('main.ts: the holder flag comes only from the holder spawn and a hello', () => {
    const fork = main.slice(main.indexOf('async function forkTerminalServer('), main.indexOf('async function startTerminalServer('))
    const set = fork.indexOf('terminalServerFromHolder = holder.use')
    expect(set).toBeGreaterThan(fork.indexOf('const holder = await resolvePtyHolder('))
    expect(set).toBeLessThan(fork.indexOf('if (holder.use) {'))
    expect(fork.indexOf('terminalServerFromHolder = false')).toBeGreaterThan(fork.indexOf('return spawn(spec.command'))
    expect(fork.indexOf('terminalServerFromHolder = false')).toBeLessThan(fork.indexOf('return runWithoutCrashpadClient('))
    expect(main.match(/terminalServerFromHolder = /g)?.length).toBe(4) // the let, holder.use, false, noteTerminalServerHello
    expect(main.match(/noteTerminalServerHello\(/g)?.length).toBe(4) // the definition + probe, reconnect, recover
    expect(main).toContain("terminalServerFromHolder = process.platform === 'win32' && isKeptHolderHello(hello, path.dirname(process.execPath))")
  })

  it('main.ts: before-quit keeps the server only for the holder-keeping request', () => {
    const start = main.indexOf("app.on('before-quit', async (e) => {")
    const block = main.slice(start, main.indexOf('} else try {', start))
    let at = 0
    for (const text of ['if (installerQuitRequested) {', 'shouldStopServer = true', 'if (installerQuitKeepsServer) {', 'shouldStopServer = false', '} else {', "logger.log('[installer-quit] quit without confirmation (stopTerminalServer=true)')"]) {
      const next = block.indexOf(text, at)
      expect(next, text).toBeGreaterThanOrEqual(at)
      at = next + text.length
    }
    expect(main.match(/installerQuitKeepsServer = true/g)?.length).toBe(1)
    const keep = main.slice(main.indexOf('quitKeepingServer: () => {'), main.indexOf('quitKeepingServer: () => {') + 200)
    expect(keep).toContain('installerQuitKeepsServer = true')
  })

  it('module: no electron, no userData path at import time, child_process only via execFile + timeout', () => {
    const mod = fs.readFileSync(path.join(ROOT, 'electron', 'installer-quit-request.ts'), 'utf8')
    expect(mod).not.toMatch(/getPath\(/)
    expect(mod).not.toMatch(/from 'electron'/)
    expect(mod).toMatch(/import \{ execFile \} from 'child_process'/)
    expect(mod).not.toMatch(/\bexecSync\b|\bspawn\(|child_process'\)\.exec\b/)
    expect(mod).toMatch(/timeout: timeoutMs/)
  })

  it('installer.nsh: same strings; the uninstall argument only in the uninstaller build without isUpdated', () => {
    expect(nsh).toContain(`!define BAT_UNINSTALL_QUIT_ARG "${UNINSTALL_QUIT_REQUEST_ARG}"`)
    expect(nsh).toContain('!define BAT_UNINSTALL_QUIT_MARKER "resources\\uninstall-quit-request.supported"')
    const quit = macro('batRequestGracefulQuit')
    const order = ['StrCpy $R8 "${BAT_INSTALLER_QUIT_ARG}"', '!ifdef BUILD_UNINSTALLER', '${IfNot} ${isUpdated}', '${AndIf} ${FileExists} "$INSTDIR\\${BAT_UNINSTALL_QUIT_MARKER}"', 'StrCpy $R8 "${BAT_UNINSTALL_QUIT_ARG}"', '!endif', 'Exec `"$INSTDIR\\${APP_EXECUTABLE_FILENAME}" $R8`'].map(t => quit.indexOf(t))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(quit.indexOf('Push $R8')).toBeLessThan(quit.indexOf('StrCpy $R8'))
    expect(quit.trimEnd().endsWith('Pop $R8')).toBe(true)
  })

  it('installer.nsh: customInstall writes the new marker after the T0823 one and before the holder copy', () => {
    const install = macro('customInstall')
    const order = ['FileOpen $0 "$INSTDIR\\${BAT_INSTALLER_QUIT_MARKER}" w', 'FileOpen $0 "$INSTDIR\\${BAT_UNINSTALL_QUIT_MARKER}" w', '!insertmacro batInstallPtyHolder'].map(t => install.indexOf(t))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('🔴 installer.nsh: customUnInstall does nothing on an upgrade; a real uninstall asks, waits, removes only an unused root', () => {
    const un = macro('customUnInstall')
    expect(un).toMatch(/\$\{IfNot\} \$\{isUpdated\}\s+!insertmacro batUninstallPtyHolder\s+\$\{EndIf\}/)
    const body = macro('batUninstallPtyHolder')
    const order = [
      '${If} $installMode == "all"',
      'StrCpy $R1 "$PROGRAMFILES64\\${BAT_PTY_HOLDER_ROOT_NAME}"',
      'StrCpy $R1 "$LOCALAPPDATA\\${BAT_PTY_HOLDER_ROOT_NAME}"',
      '${OrIf} $R4 == $R1',
      '${AndIf} ${FileExists} "$INSTDIR\\${BAT_UNINSTALL_QUIT_MARKER}"',
      'Exec `"$INSTDIR\\${APP_EXECUTABLE_FILENAME}" ${BAT_UNINSTALL_QUIT_ARG}`',
      '!insertmacro batPtyHolderInUse "$R1" $R0',
      '${If} $R0 == ${BAT_PTY_HOLDER_UNUSED}\n    RMDir /r "$R1"',
    ].map(t => body.indexOf(t))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(body.match(/RMDir/g)?.length).toBe(1)
    // never the other scope's root, never a force-end in NSIS (T0823 guard: BAT ends what it started)
    expect(nsh).not.toMatch(/Stop-Process|taskkill|KILL_PROCESS/)
    expect(body).not.toMatch(/\$APPDATA|\$PROFILE/)
  })

  it('electron-builder template: customUnInstall runs before the files go; the upgrade passes --updated', () => {
    const lib = path.join(ROOT, 'node_modules', 'app-builder-lib')
    const uninstaller = fs.readFileSync(path.join(lib, 'templates', 'nsis', 'uninstaller.nsh'), 'utf8')
    const installUtil = fs.readFileSync(path.join(lib, 'templates', 'nsis', 'include', 'installUtil.nsh'), 'utf8')
    const hook = uninstaller.indexOf('!insertmacro customUnInstall')
    expect(hook).toBeGreaterThan(0)
    expect(uninstaller.indexOf('RMDir /r $INSTDIR')).toBeGreaterThan(hook)
    expect(uninstaller.indexOf('Function un.checkAppRunning')).toBeLessThan(hook)
    expect(installUtil).toContain('StrCpy $0 "$0 --updated"')
  })
})
