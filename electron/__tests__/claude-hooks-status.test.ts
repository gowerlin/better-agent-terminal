// @vitest-environment node
/**
 * PLAN-068 W9 / T0910 (T0902 §7.1 / §7.2 / §3.1′): BAT's claude hooks status per tab.
 *
 * - `computeHooksStatus`: a report wins (injected over plugin; plugin older than BAT → plugin-outdated);
 *   codex → n/a; a launch record's reason; no record → not-launched-by-bat (Tower) / no-report
 *   (claude-cli preset); null for a plain shell
 * - the `hooks:` line grammar CT parses (`hooksStatusLine`)
 * - launch decisions → reason codes (`hooksLaunchReasonOf` / `createBatMcpLaunchArgs` records), R13
 *   (Settings off → `settings-off`, nothing injected), the command line unchanged
 * - PtyManager: `getHooksStatus`, `waitForHookReport`, `terminal:hooks-status` sent only for a Tower
 *   that declared a contract and only on a change; ⏻ restart / exit / recovery
 * - `setTerminalRole` + `--bat-contract`: `hooksStatus` in the answer, the 2 s wait (fake timers),
 *   codex `n/a` without waiting, the `--agent` hint; without `batContract` synchronous and unchanged
 * The PtyManager runs against a fake node-pty (pattern of terminal-role-contract.test.ts).
 */
import { EventEmitter } from 'events'
import { createRequire } from 'module'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('claude-hooks-status / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import {
  BAT_HOOK_SET,
  ClaudeHooksRecords,
  computeHooksStatus,
  HOOKS_NONE_REASONS,
  HOOKS_STATUS_CHANNEL,
  HOOKS_STATUS_WAIT_MS,
  hooksStatusKey,
  hooksStatusLine,
  type HooksStatus,
} from '../claude-hooks-status'
import { BAT_HOOK_SET as LAUNCH_HOOK_SET, buildBatMcpLaunchArgs, createBatMcpLaunchArgs, hooksLaunchReasonOf, type BatMcpHost } from '../bat-mcp-launch'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { SetTerminalRoleDeps } from '../terminal-role'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}

void EventEmitter
const ptySpawn = vi.fn(() => new FakePty())
const CWD = os.tmpdir()
const TAB = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
let PtyManager: typeof PtyManagerType
let setTerminalRole: typeof import('../terminal-role').setTerminalRole

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  ;({ setTerminalRole } = await import('../terminal-role'))
})

let dir: string
const managers: PtyManagerType[] = []

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0910-hooks-'))
})

afterEach(() => {
  vi.useRealTimers()
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function makeManager(records = new ClaudeHooksRecords()) {
  const emit = vi.fn()
  const manager = new PtyManager({ emit, dataDir: dir, hooksRecords: records })
  managers.push(manager)
  const statusEvents = () => emit.mock.calls.filter(([channel]) => channel === HOOKS_STATUS_CHANNEL).map(([, payload]) => payload as { id: string; hooksStatus: HooksStatus | null })
  return { manager, records, emit, statusEvents }
}

function roleDeps(manager: PtyManagerType, isKnownAgent: (id: string) => boolean = () => false) {
  const deps: SetTerminalRoleDeps = {
    getPtyManager: () => manager,
    emit: () => 1,
    logger: { log: vi.fn() },
    isKnownAgent,
    agentName: () => undefined,
    mirrorToBatScripts: vi.fn(),
  }
  return deps
}

describe('computeHooksStatus (T0910, T0902 §7.2)', () => {
  const none = (reason: string) => ({ state: 'none', reason })

  it('a report wins: injected over plugin; injected without a set → BAT_HOOK_SET', () => {
    expect(computeHooksStatus({ tower: true, reports: { injected: true, plugin: false, injectedSet: 2 } })).toEqual({ state: 'ok', origin: 'injected', set: 2 })
    expect(computeHooksStatus({ tower: true, reports: { injected: true, plugin: true, injectedSet: 2, pluginSet: 1 } })).toEqual({ state: 'ok', origin: 'injected', set: 2 })
    expect(computeHooksStatus({ tower: true, reports: { injected: true, plugin: false } })).toEqual({ state: 'ok', origin: 'injected', set: BAT_HOOK_SET })
    // even over a launch decision that said none / codex: the reports prove the hooks run
    expect(computeHooksStatus({ tower: true, launch: { kind: 'claude', reason: 'settings-off', at: 1 }, reports: { injected: false, plugin: true, pluginSet: 2 } })).toEqual({ state: 'ok', origin: 'plugin', set: 2 })
  })

  it('plugin only: older list → plugin-outdated; same or newer → plain ok; no set → the oldest list (1)', () => {
    expect(computeHooksStatus({ tower: true, reports: { injected: false, plugin: true, pluginSet: 1 } })).toEqual({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' })
    expect(computeHooksStatus({ tower: true, reports: { injected: false, plugin: true, pluginSet: 2 } })).toEqual({ state: 'ok', origin: 'plugin', set: 2 })
    expect(computeHooksStatus({ tower: true, reports: { injected: false, plugin: true, pluginSet: 3 } })).toEqual({ state: 'ok', origin: 'plugin', set: 3 })
    expect(computeHooksStatus({ tower: true, reports: { injected: false, plugin: true } })).toEqual({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' })
    expect(computeHooksStatus({ tower: true, reports: { injected: false, plugin: true, pluginSet: 2 }, batHookSet: 3 })).toEqual({ state: 'ok', origin: 'plugin', set: 2, reason: 'plugin-outdated' })
  })

  it('codex (launch record, preset or --agent hint) → n/a', () => {
    expect(computeHooksStatus({ tower: true, launch: { kind: 'codex', at: 1 }, reports: null })).toEqual({ state: 'n/a', reason: 'codex' })
    expect(computeHooksStatus({ tower: true, agentPreset: 'codex-cli', reports: null })).toEqual({ state: 'n/a', reason: 'codex' })
    expect(computeHooksStatus({ tower: true, hint: 'codex', reports: null })).toEqual({ state: 'n/a', reason: 'codex' })
  })

  it('no report: the launch reason; injected → no-report; no record → no-report (claude-cli preset) / not-launched-by-bat', () => {
    for (const reason of ['settings-off', 'user-settings-arg', 'claude-hooks-disabled', 'managed-hooks-only', 'no-endpoint', 'script-missing', 'unrepresentable-path'] as const) {
      expect(computeHooksStatus({ tower: true, launch: { kind: 'claude', reason, at: 1 }, reports: null })).toEqual(none(reason))
    }
    expect(computeHooksStatus({ tower: true, launch: { kind: 'claude', at: 1 }, reports: null })).toEqual(none('no-report'))
    expect(computeHooksStatus({ tower: false, agentPreset: 'claude-cli', reports: null })).toEqual(none('no-report'))
    expect(computeHooksStatus({ tower: true, reports: null })).toEqual(none('not-launched-by-bat'))
    expect(computeHooksStatus({ tower: false, hint: 'claude', reports: null })).toEqual(none('not-launched-by-bat'))
  })

  it('a plain shell that is not a Tower → null', () => {
    expect(computeHooksStatus({ tower: false, reports: null })).toBeNull()
    expect(computeHooksStatus({ tower: false, agentPreset: 'gemini-cli', reports: null })).toBeNull()
  })

  it('every none reason is one of the nine codes CT knows', () => {
    expect([...HOOKS_NONE_REASONS].sort()).toEqual(['claude-hooks-disabled', 'managed-hooks-only', 'no-endpoint', 'no-report', 'not-launched-by-bat', 'script-missing', 'settings-off', 'unrepresentable-path', 'user-settings-arg'])
    expect(BAT_HOOK_SET).toBe(LAUNCH_HOOK_SET)
    expect(HOOKS_STATUS_WAIT_MS).toBe(2000)
  })
})

describe('the hooks: line (contract §3.1′, CT 6.1.0 parses it)', () => {
  it('grammar, exactly', () => {
    expect(hooksStatusLine({ state: 'ok', origin: 'injected', set: 2 })).toBe('  hooks: ok (injected, set 2)')
    expect(hooksStatusLine({ state: 'ok', origin: 'plugin', set: 2 })).toBe('  hooks: ok (plugin, set 2)')
    expect(hooksStatusLine({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' })).toBe('  hooks: ok (plugin, set 1, plugin-outdated)')
    for (const reason of HOOKS_NONE_REASONS) expect(hooksStatusLine({ state: 'none', reason })).toBe(`  hooks: none (${reason})`)
    expect(hooksStatusLine({ state: 'n/a', reason: 'codex' })).toBe('  hooks: n/a (codex)')
  })

  it('hooksStatusKey tells statuses apart', () => {
    const keys = new Set([
      hooksStatusKey(null),
      hooksStatusKey({ state: 'ok', origin: 'injected', set: 2 }),
      hooksStatusKey({ state: 'ok', origin: 'plugin', set: 2 }),
      hooksStatusKey({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' }),
      hooksStatusKey({ state: 'none', reason: 'no-report' }),
      hooksStatusKey({ state: 'n/a', reason: 'codex' }),
    ])
    expect(keys.size).toBe(6)
  })
})

describe('ClaudeHooksRecords', () => {
  it('bounded (oldest first), relaunch replaces; hints set / cleared', () => {
    const records = new ClaudeHooksRecords(2)
    records.setLaunch('a', { kind: 'claude', at: 1 })
    records.setLaunch('b', { kind: 'codex', at: 2 })
    records.setLaunch('a', { kind: 'claude', reason: 'settings-off', at: 3 })
    records.setLaunch('c', { kind: 'claude', at: 4 })
    expect(records.getLaunch('b')).toBeUndefined()
    expect(records.getLaunch('a')).toEqual({ kind: 'claude', reason: 'settings-off', at: 3 })
    records.deleteLaunch('a')
    expect(records.getLaunch('a')).toBeUndefined()
    records.setHint('t', 'codex')
    expect(records.getHint('t')).toBe('codex')
    records.setHint('t', null)
    expect(records.getHint('t')).toBeUndefined()
  })
})

describe('launch decision → reason code (T0910, T0902 §7.1)', () => {
  let helperDir: string
  let dataDir: string
  beforeEach(() => {
    helperDir = path.join(dir, 'scripts')
    dataDir = path.join(dir, 'userData')
    fs.mkdirSync(helperDir, { recursive: true })
    fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '// shim\n')
    fs.writeFileSync(path.join(helperDir, 'bat-hook.mjs'), '// hook\n')
  })
  const host = (overrides: Partial<BatMcpHost> = {}, settings: Record<string, unknown> | null = {}): BatMcpHost => ({
    dataDir: () => dataDir,
    helperDir: () => helperDir,
    nodeCommand: () => 'node',
    endpointReady: () => true,
    readSettings: () => settings,
    platform: 'linux',
    claudeSettingsFiles: () => [],
    ...overrides,
  })
  const claude = { agentId: 'claude-cli', shellFamily: 'posix' as const }

  it('each launch reason', () => {
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host(), claude))).toBeUndefined()
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host({}, { batMcpEnabled: false }), claude))).toBe('settings-off')
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host({}, { batMcpEnabled: false }), { ...claude, sessionName: 'ws · Tower', claudeNameSupport: { inject: true, runtime: 'embedded' } }))).toBe('settings-off')
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host(), { ...claude, extraArgs: '--settings x.json' }))).toBe('user-settings-arg')
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host({ endpointReady: () => false }), claude))).toBe('no-endpoint')
    fs.rmSync(path.join(helperDir, 'bat-hook.mjs'))
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host(), claude))).toBe('script-missing')
    fs.writeFileSync(path.join(helperDir, 'bat-hook.mjs'), '// hook\n')
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host({ helperDir: () => undefined }), claude))).toBe('script-missing')
    const quoted = path.join(dir, "it's", 'scripts')
    fs.mkdirSync(quoted, { recursive: true })
    fs.writeFileSync(path.join(quoted, 'bat-hook.mjs'), '// hook\n')
    fs.writeFileSync(path.join(quoted, 'bat-mcp.mjs'), '// shim\n')
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host({ helperDir: () => quoted }), claude))).toBe('unrepresentable-path')
  })

  it("claude's own settings: disableAllHooks → claude-hooks-disabled; managed allowManagedHooksOnly → managed-hooks-only", () => {
    const user = path.join(dir, 'user-settings.json')
    const managed = path.join(dir, 'managed-settings.json')
    fs.writeFileSync(user, JSON.stringify({ disableAllHooks: true }))
    fs.writeFileSync(managed, JSON.stringify({ allowManagedHooksOnly: true }))
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host({ claudeSettingsFiles: () => [{ file: user, managed: false }] }), claude))).toBe('claude-hooks-disabled')
    expect(hooksLaunchReasonOf(buildBatMcpLaunchArgs(host({ claudeSettingsFiles: () => [{ file: managed, managed: true }] }), claude))).toBe('managed-hooks-only')
  })

  it('createBatMcpLaunchArgs records claude / codex per terminal; another agent forgets it; the args are unchanged', () => {
    const records = new ClaudeHooksRecords()
    const plain = buildBatMcpLaunchArgs(host(), claude)
    const launch = createBatMcpLaunchArgs(host({ hooksRecords: records }), 'tab')
    expect(launch({ ...claude, terminalId: 't1' })).toEqual(plain)
    expect(records.getLaunch('t1')).toEqual({ kind: 'claude', at: expect.any(Number) })
    launch({ ...claude, terminalId: 't1', extraArgs: '--settings=a.json' })
    expect(records.getLaunch('t1')).toMatchObject({ kind: 'claude', reason: 'user-settings-arg' })
    launch({ agentId: 'codex-cli', shellFamily: 'posix', terminalId: 't1' })
    expect(records.getLaunch('t1')).toMatchObject({ kind: 'codex' })
    launch({ agentId: 'gemini-cli', shellFamily: 'posix', terminalId: 't1' })
    expect(records.getLaunch('t1')).toBeUndefined()
    // R13: Settings off → nothing injected for the hooks, recorded settings-off
    const off = createBatMcpLaunchArgs(host({ hooksRecords: records }, { batMcpEnabled: false }), 'tab')
    expect(off({ ...claude, terminalId: 't2' })).toMatchObject({ injected: false, reason: 'turned off in Settings' })
    expect(records.getLaunch('t2')).toMatchObject({ kind: 'claude', reason: 'settings-off' })
    // no terminal id → nothing recorded
    launch({ ...claude })
    expect(records.getLaunch('undefined')).toBeUndefined()
  })
})

describe('PtyManager hooks status (T0910)', () => {
  it('getHooksStatus from the launch record, the reports and the preset; null when not running', () => {
    const { manager, records } = makeManager()
    manager.create({ id: 'c1', ...TAB, agentPreset: 'claude-cli' })
    expect(manager.getHooksStatus('c1')).toEqual({ state: 'none', reason: 'no-report' })
    records.setLaunch('c1', { kind: 'claude', reason: 'settings-off', at: 1 })
    expect(manager.getHooksStatus('c1')).toEqual({ state: 'none', reason: 'settings-off' })
    expect(manager.acceptHookOrigin('c1', 'plugin', 1)).toBe(true)
    expect(manager.getHooksStatus('c1')).toEqual({ state: 'ok', origin: 'plugin', set: 1, reason: 'plugin-outdated' })
    // injected arrives: wins, plugin reports dropped from then on (T0905)
    expect(manager.acceptHookOrigin('c1', 'injected', 2)).toBe(true)
    expect(manager.acceptHookOrigin('c1', 'plugin', 2)).toBe(false)
    expect(manager.getHooksStatus('c1')).toEqual({ state: 'ok', origin: 'injected', set: 2 })
    manager.create({ id: 'sh', ...TAB })
    expect(manager.getHooksStatus('sh')).toBeNull()
    expect(manager.getHooksStatus('missing')).toBeNull()
  })

  it('waitForHookReport: true at once when reported, true on a report, false on timeout / exit', async () => {
    vi.useFakeTimers()
    const { manager } = makeManager()
    manager.create({ id: 'w', ...TAB })
    const pending = manager.waitForHookReport('w', 2000)
    let settled: boolean | undefined
    void pending.then(v => { settled = v })
    await vi.advanceTimersByTimeAsync(500)
    expect(settled).toBeUndefined()
    manager.acceptHookOrigin('w', undefined, undefined)
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(true)
    expect(await manager.waitForHookReport('w', 2000)).toBe(true)
    manager.create({ id: 'x', ...TAB })
    const timeout = manager.waitForHookReport('x', 2000)
    await vi.advanceTimersByTimeAsync(2000)
    expect(await timeout).toBe(false)
    const killed = manager.waitForHookReport('x', 2000)
    manager.kill('x')
    expect(await killed).toBe(false)
    expect(await manager.waitForHookReport('nope', 10)).toBe(false)
  })

  it('terminal:hooks-status only for a Tower that declared a contract, only on a change; restart / exit', () => {
    const { manager, statusEvents } = makeManager()
    manager.create({ id: 'tw', ...TAB, agentPreset: 'claude-cli' })
    manager.acceptHookOrigin('tw', undefined, 2)
    expect(statusEvents()).toEqual([]) // not a Tower
    manager.setTerminalRole('tw', 'tower', 'yolo')
    expect(statusEvents()).toEqual([]) // a Tower without a contract
    manager.setTerminalRole('tw', 'tower', 'yolo', 2)
    expect(statusEvents()).toEqual([{ id: 'tw', hooksStatus: { state: 'ok', origin: 'injected', set: 2 } }])
    manager.setTerminalRole('tw', 'tower', 'yolo', 2)
    manager.acceptHookOrigin('tw', undefined, 2)
    expect(statusEvents()).toHaveLength(1) // unchanged
    // ⏻ restart: the reports went with the old process
    manager.restart('tw', CWD, '/bin/sh')
    expect(statusEvents().at(-1)).toEqual({ id: 'tw', hooksStatus: { state: 'none', reason: 'no-report' } })
    manager.acceptHookOrigin('tw', undefined, 2)
    expect(statusEvents().at(-1)).toEqual({ id: 'tw', hooksStatus: { state: 'ok', origin: 'injected', set: 2 } })
    const json = JSON.stringify(statusEvents())
    expect(json).not.toMatch(/token|batcap|\/bin\/sh/)
  })
})

describe('setTerminalRole + --bat-contract: hooksStatus and the 2 s wait (T0910)', () => {
  it('already reported → synchronous answer with hooksStatus', () => {
    const { manager } = makeManager()
    manager.create({ id: 'tw', ...TAB, agentPreset: 'claude-cli' })
    manager.acceptHookOrigin('tw', undefined, 2)
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', batContract: 2 }, roleDeps(manager))).toEqual({
      ok: true, terminalId: 'tw', role: 'tower', towerContract: 2, batContract: 2, hooksStatus: { state: 'ok', origin: 'injected', set: 2 },
    })
  })

  it('no report yet → waits; a report within 2 s answers ok at once', async () => {
    vi.useFakeTimers()
    const { manager } = makeManager()
    manager.create({ id: 'tw', ...TAB, agentPreset: 'claude-cli' })
    const answer = setTerminalRole({ terminalId: 'tw', role: 'tower', batContract: 2 }, roleDeps(manager))
    expect(answer).toBeInstanceOf(Promise)
    let result: unknown
    void (answer as Promise<unknown>).then(v => { result = v })
    await vi.advanceTimersByTimeAsync(700)
    expect(result).toBeUndefined()
    manager.acceptHookOrigin('tw', 'injected', 2) // the async SessionStart arrives
    await vi.advanceTimersByTimeAsync(0)
    expect(result).toEqual({ ok: true, terminalId: 'tw', role: 'tower', towerContract: 2, batContract: 2, hooksStatus: { state: 'ok', origin: 'injected', set: 2 } })
  })

  it('no report in 2 s → the reason (plugin-less shell Tower: not-launched-by-bat)', async () => {
    vi.useFakeTimers()
    const { manager } = makeManager()
    manager.create({ id: 'tw', ...TAB })
    const answer = setTerminalRole({ terminalId: 'tw', role: 'tower', batContract: 2 }, roleDeps(manager)) as Promise<unknown>
    let result: unknown
    void answer.then(v => { result = v })
    await vi.advanceTimersByTimeAsync(HOOKS_STATUS_WAIT_MS - 1)
    expect(result).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(result).toMatchObject({ ok: true, hooksStatus: { state: 'none', reason: 'not-launched-by-bat' } })
  })

  it('codex (preset, or the --agent hint of a shell Tower) → n/a (codex) without waiting', () => {
    const { manager } = makeManager()
    manager.create({ id: 'cx', ...TAB, agentPreset: 'codex-cli' })
    expect(setTerminalRole({ terminalId: 'cx', role: 'tower', batContract: 2 }, roleDeps(manager))).toMatchObject({ hooksStatus: { state: 'n/a', reason: 'codex' } })
    manager.create({ id: 'sh', ...TAB })
    expect(setTerminalRole({ terminalId: 'sh', role: 'tower', batContract: 2, agent: 'codex' }, roleDeps(manager, id => id === 'codex-cli'))).toMatchObject({ hooksStatus: { state: 'n/a', reason: 'codex' } })
  })

  it('🔴 without batContract: synchronous, no hooksStatus, exactly the T0562 / T0565 answer', () => {
    const { manager } = makeManager()
    manager.create({ id: 'tw', ...TAB, agentPreset: 'claude-cli' })
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower' }, roleDeps(manager))).toEqual({ ok: true, terminalId: 'tw', role: 'tower' })
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', mode: 'ask' }, roleDeps(manager))).toEqual({ ok: true, terminalId: 'tw', role: 'tower', mode: 'ask' })
  })
})
