// @vitest-environment node
/**
 * PLAN-063 子項 3 / T0823: the NSIS installer asks a running BAT to quit normally.
 * - electron/installer-quit-request.ts: the argument, the record (validated, read once), the running
 *   BAT's controller (no dialog, stops the Terminal Server, kept during startup, once), the request
 *   process without a BAT window process (stops a kept Terminal Server).
 * - electron/upgrade-interruption.ts: the next start's notice also comes from the record (merge rules).
 * - Source guards: main.ts wiring, build/installer.nsh, package.json `build.nsis.include`, and the
 *   electron-builder template hooks the include relies on (re-check on an electron-builder upgrade).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('installer-quit-request must not import electron')
})

import {
  INSTALLER_QUIT_RECORD_FILE,
  INSTALLER_QUIT_REQUEST_ARG,
  INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS,
  InstallerQuitController,
  buildInstallerQuitRecord,
  isInstallerQuitRequest,
  readInstallerQuitRecord,
  runInstallerQuitWithoutApp,
  takeInstallerQuitRecord,
  writeInstallerQuitRecord,
  type InstallerQuitRecord,
} from '../installer-quit-request'
import { LAST_RUN_VERSION_FILE, UpgradeInterruptionCheck, detectUpgradeInterruption, writeLastRunVersion } from '../upgrade-interruption'

const S1 = '11111111-2222-4333-8444-555555555555'
const ROOT = path.join(__dirname, '..', '..')

let dir: string
let lines: string[]
const logger = { log: (m: string) => { lines.push(m) } }

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0823-'))
  lines = []
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('isInstallerQuitRequest', () => {
  it('only the exact argument, anywhere in argv (Chromium may add others)', () => {
    expect(INSTALLER_QUIT_REQUEST_ARG).toBe('--installer-quit-request')
    expect(isInstallerQuitRequest(['C:\\x\\BetterAgentTerminal.exe', '--installer-quit-request'])).toBe(true)
    expect(isInstallerQuitRequest(['exe', '--allow-file-access-from-files', '--installer-quit-request', '--foo'])).toBe(true)
    expect(isInstallerQuitRequest(['exe'])).toBe(false)
    expect(isInstallerQuitRequest(['exe', '--installer-quit-request=1'])).toBe(false)
    expect(isInstallerQuitRequest(['exe', '--installer-quit-requests'])).toBe(false)
    expect(isInstallerQuitRequest(['exe', '--INSTALLER-QUIT-REQUEST'])).toBe(false)
    expect(isInstallerQuitRequest(['exe', '--profile=--installer-quit-request'])).toBe(false)
    expect(isInstallerQuitRequest(null)).toBe(false)
    expect(isInstallerQuitRequest(undefined)).toBe(false)
  })
})

describe('the record', () => {
  it('build: validates ids / cwd / session ids, drops duplicates and empty sessions', () => {
    const record = buildInstallerQuitRecord({
      version: '0.7.4-pre.5',
      source: 'running-app',
      ptys: [{ id: 'a', cwd: 'C:\\w' }, { id: 'a', cwd: 'dup' }, { id: 'bad id' }, { id: 'b' }, null, 'x', { id: 'c', cwd: '' }],
      claudeSessions: [
        { terminalId: 'a', name: 'ws · Worker · T1', sessionId: S1 },
        { terminalId: 'b', name: null, sessionId: 'not-a-uuid' },
        { terminalId: 'c', name: 'n', sessionId: 'nope' },
        { terminalId: '../x', name: 'n', sessionId: S1 },
      ],
    })
    expect(record).toEqual({
      schema: 1,
      version: '0.7.4-pre.5',
      source: 'running-app',
      ptys: [{ id: 'a', cwd: 'C:\\w' }, { id: 'b' }, { id: 'c' }],
      claudeSessions: [{ terminalId: 'a', name: 'ws · Worker · T1', sessionId: S1 }, { terminalId: 'c', name: 'n', sessionId: null }],
    })
    expect(buildInstallerQuitRecord({ version: 'bad version!', source: 'server-only', ptys: [], claudeSessions: [] }).version).toBe('unknown')
  })

  it('write → take: read once (the file is deleted), logs counts only', () => {
    const file = path.join(dir, INSTALLER_QUIT_RECORD_FILE)
    const record = buildInstallerQuitRecord({ version: '0.7.4-pre.5', source: 'running-app', ptys: [{ id: 'a', cwd: 'C:\\secret-cwd' }], claudeSessions: [{ terminalId: 'a', name: 'n', sessionId: S1 }] })
    expect(writeInstallerQuitRecord(file, record)).toBe(true)
    expect(readInstallerQuitRecord(file)).toEqual({ status: 'ok', record })
    expect(takeInstallerQuitRecord(file, logger)).toEqual(record)
    expect(fs.existsSync(file)).toBe(false)
    expect(takeInstallerQuitRecord(file, logger)).toBeNull()
    expect(lines).toEqual(['[installer-quit] record found: version=0.7.4-pre.5 source=running-app ptys=1 claude-sessions=1'])
    expect(lines.join('\n')).not.toContain(S1)
    expect(lines.join('\n')).not.toContain('secret-cwd')
  })

  it('missing → null, nothing logged; corrupt / other schema → null, logged, deleted (used once)', () => {
    const file = path.join(dir, INSTALLER_QUIT_RECORD_FILE)
    expect(readInstallerQuitRecord(file)).toEqual({ status: 'missing' })
    expect(takeInstallerQuitRecord(file, logger)).toBeNull()
    expect(lines).toEqual([])
    for (const body of ['{', '{"schema":2,"version":"1","ptys":[]}', '{"schema":1,"version":"x y","ptys":[]}', '{"schema":1,"version":"1"}', 'null']) {
      fs.writeFileSync(file, body)
      expect(readInstallerQuitRecord(file).status).toBe('invalid')
      expect(takeInstallerQuitRecord(file, logger)).toBeNull()
      expect(fs.existsSync(file)).toBe(false)
    }
    expect(lines.every(l => l.includes('unreadable — ignored'))).toBe(true)
  })

  it('write failure → false, never throws', () => {
    const record = buildInstallerQuitRecord({ version: '1.0.0', source: 'running-app', ptys: [], claudeSessions: [] })
    expect(writeInstallerQuitRecord(path.join(dir, 'missing', INSTALLER_QUIT_RECORD_FILE), record)).toBe(false)
  })
})

describe('InstallerQuitController (the running BAT)', () => {
  function controller(over: Partial<ConstructorParameters<typeof InstallerQuitController>[0]> = {}) {
    const calls: string[] = []
    const written: InstallerQuitRecord[] = []
    const c = new InstallerQuitController({
      version: '0.7.4-pre.5',
      isQuitting: () => false,
      collect: () => ({ ptys: [{ id: 'a', cwd: '/a' }, { id: 'b' }], claudeSessions: [{ terminalId: 'a', name: 'n', sessionId: S1 }] }),
      writeRecord: (record) => { calls.push('write'); written.push(record); return true },
      quit: () => { calls.push('quit') },
      logger,
      ...over,
    })
    return { c, calls, written }
  }

  it('ready: records what will end, then quits (record before quit)', () => {
    const { c, calls, written } = controller()
    c.markReady()
    c.request()
    expect(calls).toEqual(['write', 'quit'])
    expect(written[0]).toMatchObject({ source: 'running-app', version: '0.7.4-pre.5', ptys: [{ id: 'a', cwd: '/a' }, { id: 'b' }] })
    expect(lines).toEqual(['[installer-quit] request received: recorded 2 terminal(s), 1 claude session(s) — quitting without confirmation, stopping the Terminal Server'])
  })

  it('during startup: kept, run once by markReady (mutation: run at once → quits before windows exist)', () => {
    const { c, calls } = controller()
    c.request()
    c.request()
    expect(calls).toEqual([])
    expect(lines).toEqual(['[installer-quit] request received during startup — quitting once startup finished'])
    c.markReady()
    expect(calls).toEqual(['write', 'quit'])
    c.markReady()
    expect(calls).toEqual(['write', 'quit'])
  })

  it('handled once: a second request only logs', () => {
    const { c, calls } = controller()
    c.markReady()
    c.request()
    c.request()
    expect(calls).toEqual(['write', 'quit'])
    expect(lines[1]).toBe('[installer-quit] request received again — already quitting')
  })

  it('a quit already in progress (the user\'s dialog open) → no record, no second quit (the installer falls back)', () => {
    const { c, calls } = controller({ isQuitting: () => true })
    c.markReady()
    c.request()
    expect(calls).toEqual([])
    expect(lines).toEqual(['[installer-quit] request ignored: a quit is already in progress'])
  })

  it('collect / write failures never stop the quit', () => {
    const a = controller({ collect: () => { throw new Error('boom') } })
    a.c.markReady()
    a.c.request()
    expect(a.calls).toEqual(['write', 'quit'])
    expect(a.written[0].ptys).toEqual([])
    lines = []
    const b = controller({ writeRecord: () => { throw new Error('disk') } })
    b.c.markReady()
    b.c.request()
    expect(b.calls).toEqual(['quit'])
    expect(lines[0]).toContain('[installer-quit] record failed: disk — quitting anyway')
  })
})

describe('runInstallerQuitWithoutApp (no BAT window process)', () => {
  function deps(over: Partial<Parameters<typeof runInstallerQuitWithoutApp>[0]> = {}) {
    const calls: string[] = []
    const written: InstallerQuitRecord[] = []
    return {
      calls,
      written,
      deps: {
        version: '0.7.4-pre.5',
        serverRunning: () => true,
        registryPtys: () => [{ id: 'a', pid: 1, cwd: '/a', createdAt: 'x' }],
        storedClaudeSessions: () => [{ terminalId: 'a', name: null, sessionId: S1 }],
        writeRecord: (record: InstallerQuitRecord) => { calls.push('write'); written.push(record); return true },
        sendShutdown: async () => { calls.push('shutdown'); return true },
        waitForServerExit: async (ms: number) => { calls.push(`wait ${ms}`); return true },
        logger,
        ...over,
      },
    }
  }

  it('no Terminal Server → nothing (no record, no shutdown)', async () => {
    const t = deps({ serverRunning: () => false })
    expect(await runInstallerQuitWithoutApp(t.deps)).toBe('no-server')
    expect(t.calls).toEqual([])
  })

  it('a kept Terminal Server → record its PTYs (server-only), server:shutdown, wait', async () => {
    const t = deps()
    expect(await runInstallerQuitWithoutApp(t.deps)).toBe('server-stopped')
    expect(t.calls).toEqual(['write', 'shutdown', `wait ${INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS}`])
    expect(t.written[0]).toMatchObject({ source: 'server-only', ptys: [{ id: 'a', cwd: '/a' }], claudeSessions: [{ terminalId: 'a', sessionId: S1 }] })
    expect(lines.at(-1)).toBe('[installer-quit] Terminal Server stopped (server:shutdown)')
  })

  it('no PTY → no record; no port file → left to the installer; still running → left to the installer', async () => {
    const empty = deps({ registryPtys: () => [] })
    expect(await runInstallerQuitWithoutApp(empty.deps)).toBe('server-stopped')
    expect(empty.calls).not.toContain('write')
    const noPort = deps({ sendShutdown: async () => false })
    expect(await runInstallerQuitWithoutApp(noPort.deps)).toBe('no-port')
    const stuck = deps({ waitForServerExit: async () => false })
    expect(await runInstallerQuitWithoutApp(stuck.deps)).toBe('server-still-running')
    const broken = deps({ serverRunning: () => { throw new Error('x') } })
    await expect(runInstallerQuitWithoutApp(broken.deps)).resolves.toBe('server-still-running')
  })
})

describe('the next start: upgrade notice from the record (T0821 detection extended)', () => {
  let file: string
  beforeEach(() => { file = path.join(dir, LAST_RUN_VERSION_FILE) })
  const count = (sources: { agentPreset?: string }[]) => sources.filter(s => s.agentPreset).length
  function check(version = '0.7.4-pre.6') {
    return new UpgradeInterruptionCheck({ filePath: file, currentVersion: version, logger })
  }
  const record = (ptys: { id: string; cwd?: string }[], sessions = [{ terminalId: 'a', name: 'ws · a', sessionId: S1 }]) =>
    buildInstallerQuitRecord({ version: '0.7.4-pre.5', source: 'running-app', ptys, claudeSessions: sessions })

  it('detect: version changed and (orphans ≥ 1 or record ≥ 1); same version / no previous → never', () => {
    expect(detectUpgradeInterruption({ previousVersion: '1', currentVersion: '2', orphanPtyCount: 0, installerQuitPtyCount: 1 })).toBe(true)
    expect(detectUpgradeInterruption({ previousVersion: '1', currentVersion: '2', orphanPtyCount: 1, installerQuitPtyCount: 0 })).toBe(true)
    expect(detectUpgradeInterruption({ previousVersion: '1', currentVersion: '2', orphanPtyCount: 0, installerQuitPtyCount: 0 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: '1', currentVersion: '2', orphanPtyCount: 0 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: '2', currentVersion: '2', orphanPtyCount: 0, installerQuitPtyCount: 3 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: null, currentVersion: '2', orphanPtyCount: 0, installerQuitPtyCount: 3 })).toBe(false)
  })

  it('record only (normal quit, no orphan) → notice with the record\'s N, agent tab from its claude session', () => {
    writeLastRunVersion(file, '0.7.4-pre.5')
    const c = check()
    c.begin()
    c.noteInstallerQuit(record([{ id: 'a', cwd: '/a' }, { id: 'b' }]))
    const sources = c.finish([{ terminals: [{ id: 'b', agentPreset: 'codex-cli' }] }], (list, nameOf) => {
      expect(nameOf('a')).toBe('ws · a')
      return count(list)
    })
    expect(sources?.map(s => [s.terminalId, s.agentPreset, s.sessionId])).toEqual([['a', 'claude-cli', S1], ['b', 'codex-cli', null]])
    expect(c.takeNotice()).toEqual({ previousVersion: '0.7.4-pre.5', currentVersion: '0.7.4-pre.6', ptyCount: 2, agentCount: 2 })
    expect(lines).toEqual(['[upgrade-interruption] detected: previous=0.7.4-pre.5 current=0.7.4-pre.6 ended-ptys=2 agent-tabs=2 source=installer'])
  })

  it('record + orphans → N is the union by id, the record\'s session wins', () => {
    writeLastRunVersion(file, '0.7.4-pre.5')
    const c = check()
    c.begin()
    c.noteInstallerQuit(record([{ id: 'a' }, { id: 'b' }]))
    c.noteOrphanCleanup([{ id: 'b' }, { id: 'c' }], [{ terminalId: 'a', name: 'old', sessionId: null }])
    const sources = c.finish([], (_list, nameOf) => (nameOf('a') === 'ws · a' ? 1 : -1))
    expect(sources?.map(s => s.terminalId)).toEqual(['a', 'b', 'c'])
    expect(c.takeNotice()).toMatchObject({ ptyCount: 3, agentCount: 1 })
    expect(lines.at(-1)).toContain('ended-ptys=3 agent-tabs=1 source=installer+orphans')
  })

  it('same version (the install was cancelled after BAT quit) → nothing; an empty record → nothing', () => {
    writeLastRunVersion(file, '0.7.4-pre.6')
    const same = check()
    same.begin()
    same.noteInstallerQuit(record([{ id: 'a' }]))
    expect(same.finish([], count)).toBeNull()
    expect(same.takeNotice()).toBeNull()
    expect(lines).toEqual([])

    writeLastRunVersion(file, '0.7.4-pre.5')
    const empty = check()
    empty.begin()
    empty.noteInstallerQuit(record([]))
    expect(empty.finish([], count)).toBeNull()
    expect(lines).toEqual(['[upgrade-interruption] none: previous=0.7.4-pre.5 current=0.7.4-pre.6 ended-ptys=0'])
  })

  it('only the first record counts; none after finish; null is ignored', () => {
    writeLastRunVersion(file, '0.7.4-pre.5')
    const c = check()
    c.begin()
    c.noteInstallerQuit(null)
    c.noteInstallerQuit(record([{ id: 'a' }]))
    c.noteInstallerQuit(record([{ id: 'x' }, { id: 'y' }]))
    expect(c.finish([], count)?.map(s => s.terminalId)).toEqual(['a'])
    c.noteInstallerQuit(record([{ id: 'z' }]))
    expect(c.finish([], count)).toBeNull()
  })
})

describe('source guards', () => {
  const main = fs.readFileSync(path.join(ROOT, 'electron', 'main.ts'), 'utf8')
  const nsh = fs.readFileSync(path.join(ROOT, 'build', 'installer.nsh'), 'utf8')

  it('main.ts: the request process without a BAT window process never opens a window', () => {
    const lock = main.indexOf('const gotTheLock = app.requestSingleInstanceLock()')
    const request = main.indexOf('const installerQuitRequestProcess = isInstallerQuitRequest(process.argv)')
    const flag = main.indexOf('const installerQuitWithoutApp = gotTheLock && installerQuitRequestProcess')
    expect(lock).toBeGreaterThan(0)
    expect(request).toBeGreaterThan(lock)
    expect(flag).toBeGreaterThan(request)
    expect(main.slice(flag, flag + 1600)).toContain('.finally(() => app.exit(0))')
    // e2e-measured: a second instance's app.quit() still runs whenReady — every request process returns there,
    // with or without the lock (mutation: `installerQuitWithoutApp` → the request process takes the record)
    // T0825 / BUG-210: merged with the second-instance return (second-instance-startup.test.ts)
    const ready = main.indexOf('app.whenReady().then(async () => {')
    const guard = main.indexOf('if (!gotTheLock || installerQuitRequestProcess) {', ready)
    expect(guard).toBeGreaterThan(ready)
    expect(guard).toBeLessThan(main.indexOf('const t0 = Date.now()', ready))
  })

  it('main.ts: second-instance listener at load; the whenReady handler opens no window for the request; markReady after it', () => {
    const listener = main.indexOf("app.on('second-instance', (_event, argv) => {\n  if (isInstallerQuitRequest(argv)) installerQuit.request()")
    expect(listener).toBeGreaterThan(0)
    // module level: after the whenReady callback closed (not registered only once startup finished)
    expect(listener).toBeGreaterThan(main.indexOf('// Cleanup runs once: before-quit covers'))
    const handler = main.indexOf("app.on('second-instance', async (_event, argv) => {")
    expect(main.slice(handler, handler + 250)).toContain('if (isInstallerQuitRequest(argv)) return')
    const markReady = main.indexOf('installerQuit.markReady()')
    expect(markReady).toBeGreaterThan(handler)
  })

  it('main.ts: before-quit skips the dialog and stops the Terminal Server for the request; the rest of the quit unchanged', () => {
    const start = main.indexOf("app.on('before-quit', async (e) => {")
    const block = main.slice(start, main.indexOf("app.on('will-quit'", start))
    const order = [
      'if (installerQuitRequested) {',
      'shouldStopServer = true',
      '} else try {',
      'dialog.showMessageBox(',
      'flushRenderer(win.webContents, QUIT_FLUSH_TIMEOUT_MS)',
      'profileManager.save(pid)',
      'if (shouldStopServer) {',
      'await stopTerminalServerGracefully()',
      'await runCleanupOnce()',
      '_quitConfirmed = true',
    ].map(text => block.indexOf(text))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // T0540: Windows never SIGTERMs the Terminal Server
    expect(main).toContain("child.send({ type: 'server:shutdown' })")
  })

  it('main.ts: the record is taken after begin and before the Terminal Server starts', () => {
    const begin = main.indexOf('upgradeInterruptionCheck.begin()')
    const take = main.indexOf('upgradeInterruptionCheck.noteInstallerQuit(takeInstallerQuitRecord(', begin)
    const start = main.indexOf('await startTerminalServer()', begin)
    expect(take).toBeGreaterThan(begin)
    expect(start).toBeGreaterThan(take)
  })

  it('module: no electron, no userData path at import time', () => {
    const mod = fs.readFileSync(path.join(ROOT, 'electron', 'installer-quit-request.ts'), 'utf8')
    expect(mod).not.toMatch(/getPath\(/)
    expect(mod).not.toMatch(/from 'electron'/)
  })

  it('installer.nsh: same argument, request then the template check, confirmation kept, elevated too', () => {
    expect(nsh).toContain(`!define BAT_INSTALLER_QUIT_ARG "${INSTALLER_QUIT_REQUEST_ARG}"`)
    expect(nsh).toMatch(/!define BAT_INSTALLER_QUIT_TIMEOUT_MS 15000\b/)
    const macro = nsh.slice(nsh.indexOf('!macro customCheckAppRunning'))
    const order = ['!insertmacro IS_POWERSHELL_AVAILABLE', '!insertmacro batRequestGracefulQuit', '!insertmacro _CHECK_APP_RUNNING'].map(t => macro.indexOf(t))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // what the template skips when customCheckAppRunning is defined, and _CHECK_APP_RUNNING needs
    expect(nsh).toContain('!include "getProcessInfo.nsh"')
    expect(nsh).toMatch(/^Var pid$/m)
    // T0823 CI: GitHub runners (UAC off) are elevated — an admin guard meant no request at all there
    expect(nsh).not.toContain('${UAC_IsAdmin}')
    // only a BAT installed by a T0823+ installer is asked (a pre-T0823 BAT would open a window for the argument)
    expect(nsh).toContain('!define BAT_INSTALLER_QUIT_MARKER "resources\\installer-quit-request.supported"')
    expect(nsh).toContain('${AndIf} ${FileExists} "$INSTDIR\\${BAT_INSTALLER_QUIT_MARKER}"')
    const install = nsh.slice(nsh.indexOf('!macro customInstall'), nsh.indexOf('!macroend', nsh.indexOf('!macro customInstall')))
    expect(install).toContain('FileOpen $0 "$INSTDIR\\${BAT_INSTALLER_QUIT_MARKER}" w')
    expect(nsh).toContain('MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK batGracefulQuitConfirmed')
    // no copy of the template's force-end logic
    expect(nsh).not.toMatch(/Stop-Process|taskkill|KILL_PROCESS/)
  })

  it('package.json: build.nsis.include points at build/installer.nsh', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { build: { nsis: { include?: string } } }
    expect(pkg.build.nsis.include).toBe('build/installer.nsh')
  })

  it('electron-builder template still has the hooks build/installer.nsh relies on (re-check on upgrade)', () => {
    const lib = path.join(ROOT, 'node_modules', 'app-builder-lib')
    const version = (JSON.parse(fs.readFileSync(path.join(lib, 'package.json'), 'utf8')) as { version: string }).version
    const tpl = fs.readFileSync(path.join(lib, 'templates', 'nsis', 'include', 'allowOnlyOneInstallerInstance.nsh'), 'utf8')
    const section = fs.readFileSync(path.join(lib, 'templates', 'nsis', 'installSection.nsh'), 'utf8')
    const uninstaller = fs.readFileSync(path.join(lib, 'templates', 'nsis', 'uninstaller.nsh'), 'utf8')
    // written against 26.8.1: another version → re-check docs/agent-guide/packaging-release-checks.md「NSIS：安裝前請 BAT 正常結束」, then update this line
    expect(version, 'app-builder-lib changed: re-check build/installer.nsh against its NSIS templates').toBe('26.8.1')
    expect(tpl).toMatch(/!ifmacrondef customCheckAppRunning\s+!include "getProcessInfo.nsh"\s+Var pid\s+!endif/)
    expect(tpl).toMatch(/!ifmacrodef customCheckAppRunning\s+!insertmacro customCheckAppRunning\s+!else\s+!insertmacro IS_POWERSHELL_AVAILABLE\s+!insertmacro _CHECK_APP_RUNNING/)
    for (const name of ['IS_POWERSHELL_AVAILABLE', 'FIND_PROCESS _FILE _RETURN', '_CHECK_APP_RUNNING']) expect(tpl).toContain(`!macro ${name}`)
    expect(section).toMatch(/\$\{ifNot\} \$\{UAC_IsInnerInstance\}\s+!insertmacro CHECK_APP_RUNNING/)
    expect(uninstaller).toMatch(/Function un\.checkAppRunning\s+!insertmacro CHECK_APP_RUNNING/)
    // the marker: written after the files are in place, removed with $INSTDIR by any uninstall (downgrade)
    expect(section).toMatch(/!ifmacrodef customInstall\s+!insertmacro customInstall/)
    expect(uninstaller).toContain('RMDir /r $INSTDIR')
  })
})
