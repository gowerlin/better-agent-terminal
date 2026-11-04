// @vitest-environment node
/**
 * PLAN-063 子項 2 / T0821: the upgrade-interruption check (electron/upgrade-interruption.ts) — the
 * last-run version file, the trigger (version changed + orphan PTYs ≥ 1; T0846: an installer quit
 * record ≥ 1 also on the same version), the agent sources from the
 * saved tabs / claude sessions, the once-only notice — the upgrade entries in InterruptedAgentsStore
 * (no session-start removal, no dialog on its own), and source guards on the main.ts wiring
 * (the orphan cleanup's order is unchanged).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('upgrade-interruption must not import electron')
})

import {
  LAST_RUN_VERSION_FILE,
  UpgradeInterruptionCheck,
  buildUpgradeInterruptedSources,
  detectUpgradeInterruption,
  readLastRunVersion,
  writeLastRunVersion,
} from '../upgrade-interruption'
import { InterruptedAgentsStore, buildInterruptedAgentSnapshot } from '../interrupted-agents'

const S1 = '11111111-2222-4333-8444-555555555555'

let dir: string
let file: string
let lines: string[]
const logger = { log: (m: string) => { lines.push(m) } }

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0821-'))
  file = path.join(dir, LAST_RUN_VERSION_FILE)
  lines = []
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('detectUpgradeInterruption', () => {
  it('version changed and N ≥ 1 → detected', () => {
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.4', currentVersion: '0.7.4-pre.5', orphanPtyCount: 1 })).toBe(true)
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.4', currentVersion: '0.7.4-pre.5', orphanPtyCount: 6 })).toBe(true)
  })

  it('same version (a crash) → not detected (mutation: drop the version condition)', () => {
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.5', currentVersion: '0.7.4-pre.5', orphanPtyCount: 3 })).toBe(false)
  })

  it('no orphan PTY → not detected (mutation: drop the N condition)', () => {
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.4', currentVersion: '0.7.4-pre.5', orphanPtyCount: 0 })).toBe(false)
  })

  it('T0846: same version + installer quit record ≥ 1 (a reinstall) → detected (mutation: keep the version condition first)', () => {
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.7', currentVersion: '0.7.4-pre.7', orphanPtyCount: 0, installerQuitPtyCount: 1 })).toBe(true)
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.7', currentVersion: '0.7.4-pre.7', orphanPtyCount: 2, installerQuitPtyCount: 1 })).toBe(true)
  })

  it('T0846: same version + orphans only, or a record with 0 PTYs → not detected (a crash)', () => {
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.7', currentVersion: '0.7.4-pre.7', orphanPtyCount: 3 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.7', currentVersion: '0.7.4-pre.7', orphanPtyCount: 3, installerQuitPtyCount: 0 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: '0.7.4-pre.7', currentVersion: '0.7.4-pre.7', orphanPtyCount: 0, installerQuitPtyCount: 0 })).toBe(false)
  })

  it('no previous version (first run / unreadable file) → not detected', () => {
    expect(detectUpgradeInterruption({ previousVersion: null, currentVersion: '0.7.4-pre.5', orphanPtyCount: 3 })).toBe(false)
    expect(detectUpgradeInterruption({ previousVersion: null, currentVersion: '0.7.4-pre.5', orphanPtyCount: 0, installerQuitPtyCount: 3 })).toBe(false)
  })
})

describe('last-run version file', () => {
  it('round trip', () => {
    expect(writeLastRunVersion(file, '0.7.4-pre.5')).toBe(true)
    expect(readLastRunVersion(file)).toBe('0.7.4-pre.5')
    expect(fs.readdirSync(dir)).toEqual([LAST_RUN_VERSION_FILE]) // no temp file left
  })

  it('missing / corrupt / unexpected content → null, never throws', () => {
    expect(readLastRunVersion(file)).toBeNull()
    fs.writeFileSync(file, '{oops')
    expect(readLastRunVersion(file)).toBeNull()
    fs.writeFileSync(file, JSON.stringify({ version: 7 }))
    expect(readLastRunVersion(file)).toBeNull()
    fs.writeFileSync(file, JSON.stringify({ version: 'a b\nc' }))
    expect(readLastRunVersion(file)).toBeNull()
    fs.writeFileSync(file, 'null')
    expect(readLastRunVersion(file)).toBeNull()
  })

  it('write failure → false, never throws', () => {
    expect(writeLastRunVersion(path.join(dir, 'no-such-dir', LAST_RUN_VERSION_FILE), '1.0.0')).toBe(false)
  })
})

describe('buildUpgradeInterruptedSources', () => {
  const windows = [{
    terminals: [
      { id: 'claude-tab', workspaceId: 'ws-1', agentPreset: 'claude-cli', cwd: '/saved' },
      { id: 'codex-tab', workspaceId: 'ws-1', agentPreset: 'codex-cli' },
      { id: 'shell-tab', workspaceId: 'ws-1', agentPreset: 'none' },
      { id: 'plain-tab', workspaceId: 'ws-2' },
      { id: 'tower-tab', workspaceId: 'ws-2', agentPreset: 'claude-cli', launchRole: 'tower' },
      'garbage',
    ],
  }, { terminals: 'not-an-array' }] as unknown as Array<{ terminals?: unknown[] }>

  it('agentPreset from the saved tab, claude-cli from a session record, session id only when a UUID', () => {
    const sources = buildUpgradeInterruptedSources(
      [
        { id: 'claude-tab', cwd: '/reg' },
        { id: 'codex-tab', cwd: '/c' },
        { id: 'shell-tab', cwd: '/s' },
        { id: 'plain-tab', cwd: '/p' },
        { id: 'dispatched', cwd: '/d' },
        { id: 'tower-tab', cwd: '/t' },
        { id: 'claude-tab', cwd: '/dup' },
      ],
      windows,
      [
        { terminalId: 'claude-tab', name: 'ws · abc', sessionId: S1 },
        { terminalId: 'dispatched', name: 'ws · Worker · T1', sessionId: null },
        { terminalId: 'tower-tab', name: null, sessionId: 'not-a-uuid' },
      ],
    )
    expect(sources.map(s => [s.terminalId, s.agentPreset ?? null, s.sessionId, s.workspaceId ?? null, s.cwd, s.role ?? null])).toEqual([
      ['claude-tab', 'claude-cli', S1, 'ws-1', '/reg', null],
      ['codex-tab', 'codex-cli', null, 'ws-1', '/c', null],
      ['shell-tab', 'none', null, 'ws-1', '/s', null],
      ['plain-tab', null, null, 'ws-2', '/p', null],
      ['dispatched', 'claude-cli', null, null, '/d', null],
      ['tower-tab', 'claude-cli', null, 'ws-2', '/t', 'tower'],
    ])
    for (const s of sources) {
      expect(s.startedAt).toBeNull()
      expect(s.blockedDetection).toBe('none')
    }
  })

  it('the snapshot keeps the agent tabs only, marked upgrade', () => {
    const sources = buildUpgradeInterruptedSources(
      [{ id: 'claude-tab', cwd: '/reg' }, { id: 'shell-tab', cwd: '/s' }, { id: 'plain-tab', cwd: '/p' }, { id: 'codex-tab', cwd: '/c' }],
      windows,
      [],
    )
    const snapshot = buildInterruptedAgentSnapshot(sources, { nameOf: () => null, now: 5, cause: 'upgrade' })
    expect(snapshot.map(a => [a.terminalId, a.agent, a.launchedBy, a.cause])).toEqual([
      ['claude-tab', 'claude-cli', 'tab', 'upgrade'],
      ['codex-tab', 'codex-cli', 'tab', 'upgrade'],
    ])
  })

  it('a recovery snapshot (no cause) is unchanged: no cause field', () => {
    const snapshot = buildInterruptedAgentSnapshot([{ terminalId: 'a', cwd: '/w', agentPreset: 'claude-cli', startedAt: null, sessionId: null, blockedDetection: 'none' }], { nameOf: () => null, now: 1 })
    expect(snapshot[0]).not.toHaveProperty('cause')
  })
})

describe('UpgradeInterruptionCheck', () => {
  function check(version = '0.7.4-pre.5') {
    return new UpgradeInterruptionCheck({ filePath: file, currentVersion: version, logger })
  }
  const count = (sources: unknown[]) => sources.length

  it('upgrade with orphan PTYs → sources, one log line, notice once', () => {
    writeLastRunVersion(file, '0.7.4-pre.4')
    const c = check()
    c.begin()
    expect(readLastRunVersion(file)).toBe('0.7.4-pre.5') // written before the upgrade check finishes
    c.noteOrphanCleanup([{ id: 'a', cwd: '/a' }, { id: 'b', cwd: '/b' }], [{ terminalId: 'a', name: 'n', sessionId: S1 }])
    const sources = c.finish([{ terminals: [{ id: 'a', agentPreset: 'claude-cli', workspaceId: 'ws' }] }], (list, nameOf) => {
      expect(nameOf('a')).toBe('n')
      expect(nameOf('b')).toBeNull()
      return list.filter(s => s.agentPreset).length
    })
    expect(sources?.map(s => s.terminalId)).toEqual(['a', 'b'])
    expect(c.takeNotice()).toEqual({ previousVersion: '0.7.4-pre.4', currentVersion: '0.7.4-pre.5', ptyCount: 2, agentCount: 1 })
    expect(c.takeNotice()).toBeNull()
    expect(lines).toEqual(['[upgrade-interruption] detected: previous=0.7.4-pre.4 current=0.7.4-pre.5 ended-ptys=2 agent-tabs=1 source=orphans'])
    expect(lines.join('\n')).not.toContain(S1)
    // finish runs once
    expect(c.finish([], count)).toBeNull()
  })

  it('same version with orphan PTYs (a crash) → nothing, no log', () => {
    writeLastRunVersion(file, '0.7.4-pre.5')
    const c = check()
    c.begin()
    c.noteOrphanCleanup([{ id: 'a' }], [])
    expect(c.finish([], count)).toBeNull()
    expect(c.takeNotice()).toBeNull()
    expect(lines).toEqual([])
  })

  it('T0846: same version + installer quit record → notice with equal versions, log marked same-version', () => {
    writeLastRunVersion(file, '0.7.4-pre.7')
    const c = check('0.7.4-pre.7')
    c.begin()
    c.noteInstallerQuit({ ptys: [{ id: 'a', cwd: '/a' }], claudeSessions: [{ terminalId: 'a', name: 'ws · a', sessionId: S1 }] })
    c.noteOrphanCleanup([{ id: 'b' }], [])
    const sources = c.finish([], list => list.filter(s => s.agentPreset).length)
    expect(sources?.map(s => [s.terminalId, s.agentPreset, s.sessionId])).toEqual([['a', 'claude-cli', S1], ['b', undefined, null]])
    expect(c.takeNotice()).toEqual({ previousVersion: '0.7.4-pre.7', currentVersion: '0.7.4-pre.7', ptyCount: 2, agentCount: 1 })
    expect(lines).toEqual(['[upgrade-interruption] detected: previous=0.7.4-pre.7 current=0.7.4-pre.7 ended-ptys=2 agent-tabs=1 source=installer+orphans same-version'])
    expect(lines.join('\n')).not.toContain(S1)
  })

  it('T0846: same version + an empty installer quit record + orphans (a crash) → nothing, no log', () => {
    writeLastRunVersion(file, '0.7.4-pre.7')
    const c = check('0.7.4-pre.7')
    c.begin()
    c.noteInstallerQuit({ ptys: [], claudeSessions: [] })
    c.noteOrphanCleanup([{ id: 'a' }], [])
    expect(c.finish([], count)).toBeNull()
    expect(c.takeNotice()).toBeNull()
    expect(lines).toEqual([])
  })

  it('upgrade without orphan PTYs → nothing, one "none" line', () => {
    writeLastRunVersion(file, '0.7.4-pre.4')
    const c = check()
    c.begin()
    expect(c.finish([], count)).toBeNull()
    expect(c.takeNotice()).toBeNull()
    expect(lines).toEqual(['[upgrade-interruption] none: previous=0.7.4-pre.4 current=0.7.4-pre.5 ended-ptys=0'])
  })

  it('first run (no file) → nothing, the version is written', () => {
    const c = check()
    c.begin()
    c.noteOrphanCleanup([{ id: 'a' }], [])
    expect(c.finish([], count)).toBeNull()
    expect(c.takeNotice()).toBeNull()
    expect(readLastRunVersion(file)).toBe('0.7.4-pre.5')
  })

  it('the version file cannot be written → logged, never throws', () => {
    const c = new UpgradeInterruptionCheck({ filePath: path.join(dir, 'missing', LAST_RUN_VERSION_FILE), currentVersion: '1.0.0', logger })
    expect(() => c.begin()).not.toThrow()
    expect(lines[0]).toContain('[upgrade-interruption] could not write')
    expect(c.finish([], count)).toBeNull()
  })

  it('only the first orphan cleanup counts; a counting failure keeps the notice (agentCount 0)', () => {
    writeLastRunVersion(file, '0.1.0')
    const c = check('0.2.0')
    c.begin()
    c.noteOrphanCleanup([{ id: 'a' }], [])
    c.noteOrphanCleanup([{ id: 'x' }, { id: 'y' }], [])
    const sources = c.finish([], () => { throw new Error('boom') })
    expect(sources?.map(s => s.terminalId)).toEqual(['a'])
    expect(c.takeNotice()).toMatchObject({ ptyCount: 1, agentCount: 0 })
  })
})

describe('InterruptedAgentsStore with upgrade entries', () => {
  function upgradeSnapshot() {
    return buildInterruptedAgentSnapshot(
      [{ terminalId: 'a', cwd: '/w', agentPreset: 'claude-cli', startedAt: null, sessionId: S1, blockedDetection: 'none' }],
      { nameOf: () => null, now: 1, cause: 'upgrade' },
    )
  }

  it("record(…, 'upgrade') emits update (no dialog on its own) and logs upgrade", () => {
    const store = new InterruptedAgentsStore(logger)
    const reasons: string[] = []
    store.onChange(reason => reasons.push(reason))
    store.record(upgradeSnapshot(), 'upgrade')
    expect(reasons).toEqual(['update'])
    expect(lines.some(l => l.startsWith('[interrupted-agents] upgrade interrupted 1 agent tab(s)'))).toBe(true)
    expect(store.list()[0].cause).toBe('upgrade')
  })

  it('a recovery record still emits recovery', () => {
    const store = new InterruptedAgentsStore(logger)
    const reasons: string[] = []
    store.onChange(reason => reasons.push(reason))
    store.record(buildInterruptedAgentSnapshot([{ terminalId: 'a', cwd: '/w', agentPreset: 'claude-cli', startedAt: null, sessionId: null, blockedDetection: 'none' }], { nameOf: () => null, now: 1 }))
    expect(reasons).toEqual(['recovery'])
  })

  it('upgrade entry: session-start (the restored tab launches a new claude) keeps it; pty-ended / dismissed / resumed remove it', () => {
    const store = new InterruptedAgentsStore(logger)
    store.record(upgradeSnapshot(), 'upgrade')
    expect(store.remove('a', 'session-start')).toBe(false)
    expect(store.has('a')).toBe(true)
    for (const cause of ['pty-ended', 'dismissed', 'resumed'] as const) {
      store.record(upgradeSnapshot(), 'upgrade')
      expect(store.remove('a', cause)).toBe(true)
      expect(store.has('a')).toBe(false)
    }
  })

  it('recovery entry: session-start still removes it (T0766 unchanged)', () => {
    const store = new InterruptedAgentsStore(logger)
    store.record(buildInterruptedAgentSnapshot([{ terminalId: 'a', cwd: '/w', agentPreset: 'claude-cli', startedAt: null, sessionId: null, blockedDetection: 'none' }], { nameOf: () => null, now: 1 }))
    expect(store.remove('a', 'session-start')).toBe(true)
  })
})

describe('main.ts wiring (source guard)', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8')

  it('the orphan cleanup keeps its order: note → kill tree → log → clear registry → remove pid / port', () => {
    const start = main.indexOf('// Orphan cleanup: PID file exists but process is already dead')
    const block = main.slice(start, main.indexOf('if (isServerRunning(userDataPath)) {', start))
    const order = [
      'const registry = readRegistry(userDataPath)',
      'upgradeInterruptionCheck?.noteOrphanCleanup(registry?.ptys ?? [], claudeSessionPersistence.entries())',
      'await killOrphanPtyProcesses(registry.ptys.map(entry => entry.pid))',
      'Cleaned ${registry.ptys.length} orphan PTY process(es) from registry',
      'clearRegistry(userDataPath)',
      'removePidFile(userDataPath)',
      'removePortFile(userDataPath)',
    ].map(text => block.indexOf(text))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('begin before the Terminal Server starts, finish after it, both before the windows', () => {
    const begin = main.indexOf('upgradeInterruptionCheck.begin()')
    const start = main.indexOf('await startTerminalServer()', begin)
    const finish = main.indexOf('await finishUpgradeInterruptionCheck()', start)
    const windows = main.indexOf('const migratedEntries = await windowRegistry.ensureInitialized()')
    expect(begin).toBeGreaterThan(0)
    expect(start).toBeGreaterThan(begin)
    expect(finish).toBeGreaterThan(start)
    expect(windows).toBeGreaterThan(finish)
  })

  it('the notice is a renderer-only ipcMain channel, handed out once', () => {
    expect(main).toContain("ipcMain.handle('terminal-server:query-upgrade-interruption', () => upgradeInterruptionCheck?.takeNotice() ?? null)")
    expect(main).not.toContain("registerHandler('terminal-server:query-upgrade-interruption'")
  })

  it('no userData path at import time in the module', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'upgrade-interruption.ts'), 'utf8')
    expect(mod).not.toMatch(/getPath\(/)
    expect(mod).not.toMatch(/from 'electron'/)
  })
})
