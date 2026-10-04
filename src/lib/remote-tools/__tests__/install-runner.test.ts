/**
 * T0412 (PLAN-037 E): runRemoteToolInstall / probeRemoteHome with a fake PTY.
 * Nothing is installed anywhere: the "PTY" is an in-memory event source.
 */
import { describe, expect, test, vi } from 'vitest'
import type { CreatePtyOptions, PtyCreateResult } from '../../../types'
import {
  REMOTE_AUTH_ENV_VARS,
  REMOTE_TOOL_IDS,
  type RemoteToolId,
  type RemoteToolReport,
  type RemoteToolsDetectResult,
  type RemoteToolsEnv,
  type RemoteToolsReport,
} from '../../../types/remote-tools'
import { buildInstallPlan, buildUpdatePlan, isInstallPlan, type InstallPlan } from '../recipes'
import { createSentinelMatcher, wrapWithSentinel } from '../sentinel'
import {
  buildHomeProbeCommand,
  completionNotice,
  parseRemoteToolInstallTarget,
  POSIX_FALLBACK_SHELL,
  probeRemoteHome,
  REMOTE_TOOL_INSTALL_HERE_EVENT,
  requestRemoteToolInstallHere,
  runRemoteToolInstall,
  selectInstallShell,
  type InstallNotice,
  type InstallRunnerDeps,
} from '../install-runner'

const NONCE = '0123456789abcdef'
const NO_AUTH_ENV = Object.fromEntries(REMOTE_AUTH_ENV_VARS.map((name) => [name, false])) as RemoteToolsEnv['authEnv']

function makeReport(env: Partial<RemoteToolsEnv>, tools: Partial<Record<RemoteToolId, Partial<RemoteToolReport>>> = {}): RemoteToolsReport {
  return {
    schemaVersion: 1,
    env: { osFamily: 'linux', musl: false, pkgManager: 'apt', privilege: 'passwordless', isWsl: true, hasTimeout: true, authEnv: NO_AUTH_ENV, ...env },
    tools: REMOTE_TOOL_IDS.map((id) => ({ id, status: 'missing', login: 'n/a', serverVisible: false, ...tools[id] })),
    serverViewAvailable: true,
    warnings: [],
  }
}

const ok = (report: RemoteToolsReport): RemoteToolsDetectResult => ({ ok: true, report })
const WSL = makeReport({}, { git: { status: 'ok', path: '/usr/bin/git', version: '2.43.0' }, curl: { status: 'ok' } })
const WSL_CLAUDE_OK = makeReport({}, { claude: { status: 'ok', path: '/home/u/.local/bin/claude', version: '2.1.290' } })
const ALPINE_ROOT = makeReport({ musl: true, pkgManager: 'apk', privilege: 'root', isWsl: false })

function plan(result: ReturnType<typeof buildInstallPlan>): InstallPlan {
  if (!isInstallPlan(result)) throw new Error('expected a plan')
  return result
}

/** Fake window: PTY event bus + recorded calls. */
function harness(options: {
  detect?: RemoteToolsDetectResult[]
  detectError?: unknown
  createResult?: PtyCreateResult
  shell?: string | undefined
  workspace?: { id: string; folderPath: string } | null
} = {}) {
  const outputCbs = new Set<(id: string, data: string) => void>()
  const exitCbs = new Set<(id: string, code: number) => void>()
  const detects = [...(options.detect ?? [ok(WSL)])]
  const notices: InstallNotice[] = []
  const creates: CreatePtyOptions[] = []
  const writes: Array<[string, string]> = []
  const addTerminal = vi.fn((_workspaceId: string, _plan: InstallPlan) => 'term-1')
  const scheduled: Array<() => void> = []
  const deps: InstallRunnerDeps = {
    detectHere: vi.fn(async () => {
      if (options.detectError) throw options.detectError
      return detects.length > 1 ? detects.shift()! : detects[0]
    }),
    ensureWorkspace: vi.fn(async () => (options.workspace === undefined ? { id: 'ws-1', folderPath: '/home/u/proj' } : options.workspace)),
    resolveShell: vi.fn(async () => ('shell' in options ? options.shell : '/bin/bash')),
    addTerminal,
    createPty: vi.fn(async (opts: CreatePtyOptions, launch: () => void) => {
      creates.push(opts)
      const result = options.createResult ?? { ok: true, created: true }
      if (result.created) launch()
      return result
    }),
    write: (id, data) => { writes.push([id, data]) },
    onOutput: (cb) => { outputCbs.add(cb); return () => outputCbs.delete(cb) },
    onExit: (cb) => { exitCbs.add(cb); return () => exitCbs.delete(cb) },
    notify: (n) => { notices.push(n) },
    customEnv: () => ({ HTTPS_PROXY: 'http://proxy:3128' }),
    generateNonce: () => NONCE,
    schedule: (fn) => { scheduled.push(fn) },
  }
  return {
    deps,
    notices,
    creates,
    writes,
    addTerminal,
    flushScheduled: () => { while (scheduled.length) scheduled.shift()!() },
    output: (id: string, data: string) => { for (const cb of [...outputCbs]) cb(id, data) },
    exit: (id: string, code: number) => { for (const cb of [...exitCbs]) cb(id, code) },
    listenerCount: () => outputCbs.size + exitCbs.size,
  }
}

/** What the shell prints for the sentinel printf (after the echoed command line). */
const sentinelOutput = (code: number) => `\r\n__BAT_TOOL_DONE_${NONCE}_${code}__\r\n$ `

describe('runRemoteToolInstall — plan', () => {
  test('rebuilds the install plan from detectHere() and types sentinel-wrapped command + \\r', async () => {
    const h = harness()
    const start = await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)
    expect(start.status).toBe('started')
    const expected = plan(buildInstallPlan('claude', WSL.env))
    if (start.status !== 'started') throw new Error('not started')
    expect(start.plan).toEqual(expected)
    expect(h.addTerminal).toHaveBeenCalledWith('ws-1', expected)
    expect(h.writes).toEqual([])  // typed only after the schedule delay
    h.flushScheduled()
    expect(h.writes).toEqual([['term-1', wrapWithSentinel(expected.command, NONCE) + '\r']])
  })

  test('kind update rebuilds buildUpdatePlan (claude update)', async () => {
    const h = harness({ detect: [ok(WSL_CLAUDE_OK)] })
    const start = await runRemoteToolInstall({ toolId: 'claude', kind: 'update' }, h.deps)
    if (start.status !== 'started') throw new Error('not started')
    expect(start.plan).toEqual(plan(buildUpdatePlan('claude', WSL_CLAUDE_OK.env)))
    h.flushScheduled()
    expect(h.writes[0][1]).toBe(wrapWithSentinel('claude update', NONCE) + '\r')
  })

  test('root host: plan comes from this report (no sudo), not from anything handed in', async () => {
    const h = harness({ detect: [ok(ALPINE_ROOT)] })
    const start = await runRemoteToolInstall({ toolId: 'git', kind: 'install' }, h.deps)
    if (start.status !== 'started') throw new Error('not started')
    expect(start.plan.command).toBe('apk add git')
    expect(start.plan.needsSudo).toBe(false)
  })

  test('pty:create carries no agentPreset and uses the workspace cwd, env and id', async () => {
    const h = harness()
    await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)
    expect(h.creates).toHaveLength(1)
    expect(h.creates[0]).not.toHaveProperty('agentPreset')
    expect(h.creates[0]).toEqual({
      id: 'term-1',
      cwd: '/home/u/proj',
      type: 'terminal',
      shell: '/bin/bash',
      customEnv: { HTTPS_PROXY: 'http://proxy:3128' },
      workspaceId: 'ws-1',
    })
  })

  test('unsupported plan ⇒ notice with the reason, no tab, no PTY', async () => {
    const h = harness()
    const start = await runRemoteToolInstall({ toolId: 'node', kind: 'install' }, h.deps)
    expect(start.status).toBe('unsupported')
    expect(h.notices).toEqual([{
      level: 'warning',
      key: 'remoteToolInstall.error.unsupported',
      params: { toolKey: 'remoteTools.tool.node.name', reasonKey: 'remoteTools.unsupported.no-recipe' },
    }])
    expect(h.addTerminal).not.toHaveBeenCalled()
    expect(h.creates).toEqual([])
    expect(h.deps.ensureWorkspace).not.toHaveBeenCalled()
  })

  test('update of a tool without an update recipe ⇒ unsupported', async () => {
    const h = harness()
    expect((await runRemoteToolInstall({ toolId: 'git', kind: 'update' }, h.deps)).status).toBe('unsupported')
  })

  test('sudo-missing ⇒ needs-root-no-sudo, nothing typed', async () => {
    const h = harness({ detect: [ok(makeReport({ privilege: 'sudo-missing' }))] })
    expect((await runRemoteToolInstall({ toolId: 'git', kind: 'install' }, h.deps)).status).toBe('unsupported')
    expect(h.notices[0].params?.reasonKey).toBe('remoteTools.unsupported.needs-root-no-sudo')
    expect(h.writes).toEqual([])
  })

  test('detect failure ⇒ notice with the error code, nothing else', async () => {
    const h = harness({ detect: [{ ok: false, errorCode: 'timeout', error: 'probe timed out' }] })
    expect((await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)).status).toBe('detect-failed')
    expect(h.notices).toEqual([{
      level: 'warning',
      key: 'remoteToolInstall.error.detectFailed',
      params: { toolKey: 'remoteTools.tool.claude.name', errorKey: 'remoteTools.error.timeout' },
    }])
    expect(h.creates).toEqual([])
  })

  test('old bat-server (No handler for channel) ⇒ server-too-old', async () => {
    const h = harness({ detectError: new Error("Error invoking remote method 'remote-tools:detect': Error: No handler for channel: remote-tools:detect") })
    expect((await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)).status).toBe('detect-failed')
    expect(h.notices[0].params?.errorKey).toBe('remoteTools.error.server-too-old')
  })

  test('tampered env (non-enum value) ⇒ invalid-report, no tab', async () => {
    const bad = makeReport({ pkgManager: 'apt; rm -rf ~' as never })
    const h = harness({ detect: [ok(bad)] })
    expect((await runRemoteToolInstall({ toolId: 'git', kind: 'install' }, h.deps)).status).toBe('invalid-report')
    expect(h.notices[0].key).toBe('remoteToolInstall.error.invalidReport')
    expect(JSON.stringify(h.notices)).not.toContain('rm -rf')
    expect(h.addTerminal).not.toHaveBeenCalled()
  })

  test('no workspace and none could be created ⇒ no-workspace, no tab', async () => {
    const h = harness({ workspace: null })
    expect((await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)).status).toBe('no-workspace')
    expect(h.notices[0].key).toBe('remoteToolInstall.error.noWorkspace')
    expect(h.addTerminal).not.toHaveBeenCalled()
  })
})

describe('runRemoteToolInstall — PTY', () => {
  test('created:false (an already-running shell) ⇒ nothing written, listeners removed', async () => {
    const h = harness({ createResult: { ok: true, created: false } })
    const start = await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)
    expect(start.status).toBe('pty-failed')
    h.flushScheduled()
    expect(h.writes).toEqual([])
    expect(h.notices.map(n => n.key)).toEqual(['remoteToolInstall.error.ptyFailed'])
    expect(h.listenerCount()).toBe(0)
  })

  test('pty:create failed (ok:false) ⇒ pty-failed even though launch ran, listeners removed', async () => {
    const h = harness({ createResult: { ok: false, created: true } })
    expect((await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)).status).toBe('pty-failed')
    expect(h.listenerCount()).toBe(0)
  })

  test('non-POSIX login shell ⇒ /bin/sh + hint', async () => {
    const h = harness({ shell: '/usr/bin/fish' })
    await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)
    expect(h.creates[0].shell).toBe(POSIX_FALLBACK_SHELL)
    expect(h.notices).toContainEqual({ level: 'info', key: 'remoteToolInstall.hint.posixShell', params: { shell: '/usr/bin/fish', fallback: '/bin/sh' } })
  })

  test('sentinel exit 0 ⇒ re-detect; tool ok ⇒ success + reopen hint', async () => {
    const h = harness({ detect: [ok(WSL), ok(WSL_CLAUDE_OK)] })
    const start = await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)
    if (start.status !== 'started') throw new Error('not started')
    h.flushScheduled()
    // the echoed command line carries only the printf format — never a match
    h.output('term-1', h.writes[0][1].replace('\r', '\r\n'))
    h.output('other-term', sentinelOutput(0))
    expect(h.deps.detectHere).toHaveBeenCalledTimes(1)
    h.output('term-1', sentinelOutput(0))
    await expect(start.done).resolves.toEqual({ kind: 'exit', exitCode: 0 })
    expect(h.deps.detectHere).toHaveBeenCalledTimes(2)
    expect(h.notices).toEqual([
      { level: 'success', key: 'remoteToolInstall.result.installed', params: { toolKey: 'remoteTools.tool.claude.name', version: '2.1.290' } },
      { level: 'info', key: 'remoteToolInstall.hint.reopenTabs' },
    ])
    expect(h.listenerCount()).toBe(0)
  })

  test('sentinel exit 0 but the tool is still missing (curl | sh exit 0) ⇒ "not detected"', async () => {
    const h = harness({ detect: [ok(WSL), ok(WSL)] })
    const start = await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)
    if (start.status !== 'started') throw new Error('not started')
    h.output('term-1', sentinelOutput(0))
    await start.done
    expect(h.notices).toEqual([
      { level: 'warning', key: 'remoteToolInstall.result.notDetected', params: { toolKey: 'remoteTools.tool.claude.name' } },
      { level: 'info', key: 'remoteToolInstall.hint.reopenTabs' },
    ])
  })

  test('sentinel non-zero ⇒ failure notice (tab kept), no re-detect, reopen hint', async () => {
    const h = harness()
    const start = await runRemoteToolInstall({ toolId: 'gh', kind: 'install' }, h.deps)
    if (start.status !== 'started') throw new Error('not started')
    // split across chunks with ANSI in between
    h.output('term-1', `\x1b[0m\r\n__BAT_TOOL_DONE_${NONCE.slice(0, 5)}`)
    h.output('term-1', `${NONCE.slice(5)}_10`)
    h.output('term-1', '0__\r\n')
    await expect(start.done).resolves.toEqual({ kind: 'exit', exitCode: 100 })
    expect(h.deps.detectHere).toHaveBeenCalledTimes(1)
    expect(h.notices).toEqual([
      { level: 'warning', key: 'remoteToolInstall.result.failed', params: { toolKey: 'remoteTools.tool.gh.name', code: '100' } },
      { level: 'info', key: 'remoteToolInstall.hint.reopenTabs' },
    ])
  })

  test('PTY exits before the sentinel ⇒ aborted notice, listeners removed', async () => {
    const h = harness()
    const start = await runRemoteToolInstall({ toolId: 'claude', kind: 'install' }, h.deps)
    if (start.status !== 'started') throw new Error('not started')
    h.exit('other-term', 0)
    h.exit('term-1', 130)
    await expect(start.done).resolves.toEqual({ kind: 'pty-exit', exitCode: 130 })
    expect(h.notices.map(n => n.key)).toEqual(['remoteToolInstall.result.aborted'])
    expect(h.listenerCount()).toBe(0)
    h.output('term-1', sentinelOutput(0))
    expect(h.deps.detectHere).toHaveBeenCalledTimes(1)
  })
})

describe('completionNotice', () => {
  const target = { toolId: 'claude' as const, kind: 'install' as const }
  test.each([
    ['ok', 'success', 'remoteToolInstall.result.installed'],
    ['too-old', 'warning', 'remoteToolInstall.result.tooOld'],
    ['not-on-path', 'info', 'remoteToolInstall.result.notOnPath'],
    ['missing', 'warning', 'remoteToolInstall.result.notDetected'],
    ['interop-only', 'warning', 'remoteToolInstall.result.notDetected'],
    ['error', 'warning', 'remoteToolInstall.result.notDetected'],
  ] as const)('status %s ⇒ %s %s', (status, level, key) => {
    const notice = completionNotice(target, ok(makeReport({}, { claude: { status, path: '/home/u/.local/bin/claude' } })))
    expect(notice.level).toBe(level)
    expect(notice.key).toBe(key)
  })
  test('update kind ⇒ updated', () => {
    expect(completionNotice({ toolId: 'claude', kind: 'update' }, ok(WSL_CLAUDE_OK)).key).toBe('remoteToolInstall.result.updated')
  })
  test('re-detect failure ⇒ redetectFailed with the error code', () => {
    expect(completionNotice(target, { ok: false, errorCode: 'no-markers', error: 'x' })).toEqual({
      level: 'warning',
      key: 'remoteToolInstall.result.redetectFailed',
      params: { toolKey: 'remoteTools.tool.claude.name', errorKey: 'remoteTools.error.no-markers' },
    })
  })
})

describe('selectInstallShell', () => {
  test.each(['/bin/bash', '/usr/bin/zsh', '/bin/sh', '/bin/dash', '/bin/ksh', '/bin/ash', '/opt/homebrew/bin/bash'])('%s is kept', (shell) => {
    expect(selectInstallShell(shell)).toEqual({ shell })
  })
  test.each(['/usr/bin/fish', '/usr/local/bin/nu', '/usr/bin/xonsh', '/usr/bin/pwsh', 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'])('%s ⇒ /bin/sh', (shell) => {
    expect(selectInstallShell(shell)).toEqual({ shell: '/bin/sh', replaced: shell })
  })
  test('unknown shell ⇒ /bin/sh, no hint', () => {
    expect(selectInstallShell(undefined)).toEqual({ shell: '/bin/sh' })
  })
})

describe('install target parsing / panel event', () => {
  test('only known enum values pass', () => {
    expect(parseRemoteToolInstallTarget({ toolId: 'claude', kind: 'update' })).toEqual({ toolId: 'claude', kind: 'update' })
    expect(parseRemoteToolInstallTarget({ toolId: 'claude', kind: 'install', command: 'rm -rf /' })).toEqual({ toolId: 'claude', kind: 'install' })
    for (const bad of [null, 'claude', {}, { toolId: 'evil', kind: 'install' }, { toolId: 'claude', kind: 'remove' }, { toolId: 'Claude', kind: 'install' }, { toolId: '__proto__', kind: 'install' }]) {
      expect(parseRemoteToolInstallTarget(bad)).toBeNull()
    }
  })

  test('requestRemoteToolInstallHere dispatches only tool + kind', () => {
    const target = new EventTarget()
    const seen: unknown[] = []
    target.addEventListener(REMOTE_TOOL_INSTALL_HERE_EVENT, (e) => seen.push((e as CustomEvent).detail))
    requestRemoteToolInstallHere(plan(buildInstallPlan('claude', WSL.env)), target as unknown as Window)
    expect(seen).toEqual([{ toolId: 'claude', kind: 'install' }])
  })
})

describe('probeRemoteHome', () => {
  function homeHarness(createResult: PtyCreateResult = { ok: true, created: true }) {
    const cbs = new Set<(id: string, data: string) => void>()
    const writes: Array<[string, string]> = []
    const kills: string[] = []
    const creates: CreatePtyOptions[] = []
    let timerFn: (() => void) | null = null
    return {
      deps: {
        createPty: vi.fn(async (o: CreatePtyOptions) => { creates.push(o); return createResult }),
        write: (id: string, data: string) => { writes.push([id, data]) },
        kill: (id: string) => { kills.push(id) },
        onOutput: (cb: (id: string, data: string) => void) => { cbs.add(cb); return () => cbs.delete(cb) },
        generateNonce: () => NONCE,
        setTimer: (fn: () => void) => { timerFn = fn; return 1 },
        clearTimer: () => { timerFn = null },
      },
      writes, kills, creates,
      output: (id: string, data: string) => { for (const cb of [...cbs]) cb(id, data) },
      fireTimeout: () => timerFn?.(),
      listeners: () => cbs.size,
    }
  }
  const id = `bat-home-probe-${NONCE}`

  test('hidden /bin/sh PTY at /, fixed printf, parses $HOME, kills the PTY', async () => {
    const h = homeHarness()
    const pending = probeRemoteHome(h.deps)
    await vi.waitFor(() => expect(h.writes).toHaveLength(1))
    expect(h.creates).toEqual([{ id, cwd: '/', type: 'terminal', shell: '/bin/sh' }])
    expect(h.writes[0]).toEqual([id, buildHomeProbeCommand(NONCE) + '\r'])
    h.output(id, h.writes[0][1].replace('\r', '\r\n'))  // echo: format only
    h.output(id, `\r\n__BAT_HOME_${NONCE}__/home/gower__END__\r\n`)
    await expect(pending).resolves.toBe('/home/gower')
    expect(h.kills).toEqual([id])
    expect(h.listeners()).toBe(0)
  })

  test.each([
    ['relative', 'home/gower'],
    ['dot-dot', '/home/../etc'],
    ['shell metachar', '/home/$(id)'],
  ])('rejects a %s path', async (_label, home) => {
    const h = homeHarness()
    const pending = probeRemoteHome(h.deps)
    await vi.waitFor(() => expect(h.writes).toHaveLength(1))
    h.output(id, `__BAT_HOME_${NONCE}__${home}__END__`)
    h.fireTimeout()
    await expect(pending).resolves.toBeNull()
  })

  test('timeout ⇒ null, PTY killed', async () => {
    const h = homeHarness()
    const pending = probeRemoteHome(h.deps)
    await vi.waitFor(() => expect(h.writes).toHaveLength(1))
    h.fireTimeout()
    await expect(pending).resolves.toBeNull()
    expect(h.kills).toEqual([id])
  })

  test('PTY not freshly created ⇒ null, nothing typed', async () => {
    const h = homeHarness({ ok: true, created: false })
    await expect(probeRemoteHome(h.deps)).resolves.toBeNull()
    expect(h.writes).toEqual([])
    expect(h.kills).toEqual([id])
  })
})

describe('sentinel wiring sanity', () => {
  test('the line typed into the PTY completes the matcher only on real output', () => {
    const line = wrapWithSentinel('claude update', NONCE)
    const m = createSentinelMatcher(NONCE)
    expect(m.feed(line)).toBeNull()
    expect(m.feed(sentinelOutput(0))).toBe(0)
  })
})
