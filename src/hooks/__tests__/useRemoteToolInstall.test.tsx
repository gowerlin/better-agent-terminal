/**
 * T0412 (PLAN-037 E): useRemoteToolInstall against a mock electronAPI (PTY is an in-memory
 * event bus; nothing is spawned or installed). Real workspace / settings stores.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import { useRemoteToolInstall, translateInstallNotice, BAT_TOOLS_WORKSPACE_NAME } from '../useRemoteToolInstall'
import { requestRemoteToolInstallHere } from '../../lib/remote-tools/install-runner'
import { buildInstallPlan, isInstallPlan } from '../../lib/remote-tools/recipes'
import { wrapWithSentinel } from '../../lib/remote-tools/sentinel'
import { workspaceStore } from '../../stores/workspace-store'
import {
  REMOTE_AUTH_ENV_VARS,
  REMOTE_TOOL_IDS,
  type RemoteToolId,
  type RemoteToolReport,
  type RemoteToolsDetectResult,
  type RemoteToolsEnv,
  type RemoteToolsReport,
} from '../../types/remote-tools'

const NO_AUTH_ENV = Object.fromEntries(REMOTE_AUTH_ENV_VARS.map((name) => [name, false])) as RemoteToolsEnv['authEnv']

function makeReport(tools: Partial<Record<RemoteToolId, Partial<RemoteToolReport>>> = {}): RemoteToolsReport {
  return {
    schemaVersion: 1,
    env: { osFamily: 'linux', musl: false, pkgManager: 'apt', privilege: 'passwordless', isWsl: true, hasTimeout: true, authEnv: NO_AUTH_ENV },
    tools: REMOTE_TOOL_IDS.map((id) => ({ id, status: 'missing', login: 'n/a', serverVisible: false, ...tools[id] })),
    serverViewAvailable: true,
    warnings: [],
  }
}
const MISSING: RemoteToolsDetectResult = { ok: true, report: makeReport() }
const CLAUDE_OK: RemoteToolsDetectResult = { ok: true, report: makeReport({ claude: { status: 'ok', version: '2.1.290' } }) }

type OutputCb = (id: string, data: string) => void
interface Api {
  outputCbs: Set<OutputCb>
  creates: Array<Record<string, unknown>>
  writes: Array<[string, string]>
  kills: string[]
  detectHere: ReturnType<typeof vi.fn>
  shellPath: string
  /** Answer for the hidden $HOME probe; null = never answers. */
  home: string | null
}

let api: Api
let originalApi: unknown

function emit(id: string, data: string) {
  for (const cb of [...api.outputCbs]) cb(id, data)
}

function installApi(detects: RemoteToolsDetectResult[], over: Partial<Pick<Api, 'shellPath' | 'home'>> = {}) {
  const queue = [...detects]
  api = {
    outputCbs: new Set(),
    creates: [],
    writes: [],
    kills: [],
    detectHere: vi.fn(async () => (queue.length > 1 ? queue.shift()! : queue[0])),
    shellPath: '/bin/bash',
    home: '/home/gower',
    ...over,
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    remoteTools: { detect: vi.fn(), detectHere: api.detectHere },
    settings: { getShellPath: vi.fn(async () => api.shellPath) },
    workspace: { save: vi.fn(async () => undefined) },
    debug: { log: vi.fn() },
    pty: {
      create: vi.fn(async (opts: Record<string, unknown>) => {
        api.creates.push(opts)
        return { ok: true, created: true }
      }),
      write: vi.fn(async (id: string, data: string) => {
        api.writes.push([id, data])
        const probe = /__BAT_HOME_%s__%s__END__\\n' '([0-9a-f]{16})'/.exec(data)
        if (probe && api.home !== null) queueMicrotask(() => emit(id, `\r\n__BAT_HOME_${probe[1]}__${api.home}__END__\r\n`))
      }),
      kill: vi.fn(async (id: string) => { api.kills.push(id); return true }),
      onOutput: (cb: OutputCb) => { api.outputCbs.add(cb); return () => { api.outputCbs.delete(cb) } },
      onExit: () => () => undefined,
    },
  }
}

function clearWorkspaces() {
  for (const w of [...workspaceStore.getState().workspaces]) workspaceStore.removeWorkspace(w.id)
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
  clearWorkspaces()
})

afterEach(() => {
  clearWorkspaces()
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
})

const installLine = () => api.writes.find(([id]) => !id.startsWith('bat-home-probe-'))

describe('useRemoteToolInstall — panel in this window (range 3)', () => {
  it('opens a plain tab in the active workspace and types the sentinel-wrapped plan + \\r', async () => {
    installApi([MISSING, CLAUDE_OK])
    const ws = workspaceStore.addWorkspace('proj', '/home/gower/proj')
    const addToast = vi.fn()
    renderHook(() => useRemoteToolInstall({ addToast }))

    const plan = buildInstallPlan('claude', MISSING.ok ? MISSING.report.env : (undefined as never))
    if (!isInstallPlan(plan)) throw new Error('plan')
    requestRemoteToolInstallHere(plan)

    await waitFor(() => expect(installLine()).toBeDefined(), { timeout: 3000 })
    const [termId, line] = installLine()!
    const nonce = /' '([0-9a-f]{16})' "\$\?"/.exec(line)![1]
    expect(line).toBe(wrapWithSentinel(plan.command, nonce) + '\r')

    // 🔴 no agentPreset on the tab or on pty:create
    const terminal = workspaceStore.getState().terminals.find(t => t.id === termId)!
    expect(terminal.workspaceId).toBe(ws.id)
    expect(terminal.agentPreset).toBeUndefined()
    expect(terminal.title).toBe('Install Claude Code')
    expect(api.creates).toHaveLength(1)
    expect(api.creates[0]).not.toHaveProperty('agentPreset')
    expect(api.creates[0]).toMatchObject({ id: termId, cwd: '/home/gower/proj', shell: '/bin/bash', workspaceId: ws.id })
    expect(workspaceStore.getState().focusedTerminalId).toBe(termId)

    emit(termId, `\r\n__BAT_TOOL_DONE_${nonce}_0__\r\n`)
    await waitFor(() => expect(addToast).toHaveBeenCalledTimes(2))
    expect(addToast.mock.calls[0]).toEqual(['Claude Code is installed and detected.', 'success', 10_000])
    expect(addToast.mock.calls[1]).toEqual(['Terminal tabs that were already open must be reopened to see ~/.local/bin.', 'info', 10_000])
    expect(api.detectHere).toHaveBeenCalledTimes(2)
  })

  it('exit 0 but still missing ⇒ "not detected" toast', async () => {
    installApi([MISSING, MISSING])
    workspaceStore.addWorkspace('proj', '/home/gower/proj')
    const addToast = vi.fn()
    renderHook(() => useRemoteToolInstall({ addToast }))
    window.dispatchEvent(new CustomEvent('remote-tool-install-here', { detail: { toolId: 'claude', kind: 'install' } }))
    await waitFor(() => expect(installLine()).toBeDefined(), { timeout: 3000 })
    const [termId, line] = installLine()!
    const nonce = /' '([0-9a-f]{16})' "\$\?"/.exec(line)![1]
    emit(termId, `__BAT_TOOL_DONE_${nonce}_0__`)
    await waitFor(() => expect(addToast).toHaveBeenCalledTimes(2))
    expect(addToast.mock.calls[0]).toEqual(['The command finished, but Claude Code was not detected. Check the terminal output.', 'warning', 10_000])
  })

  it('an event detail with unknown enums is ignored', async () => {
    installApi([MISSING])
    workspaceStore.addWorkspace('proj', '/home/gower/proj')
    renderHook(() => useRemoteToolInstall({ addToast: vi.fn() }))
    window.dispatchEvent(new CustomEvent('remote-tool-install-here', { detail: { toolId: 'claude; reboot', kind: 'install' } }))
    await new Promise(r => setTimeout(r, 50))
    expect(api.detectHere).not.toHaveBeenCalled()
    expect(api.creates).toEqual([])
  })

  it('no workspace ⇒ probes the remote $HOME and creates "BAT Tools" there', async () => {
    installApi([MISSING])
    renderHook(() => useRemoteToolInstall({ addToast: vi.fn() }))
    window.dispatchEvent(new CustomEvent('remote-tool-install-here', { detail: { toolId: 'git', kind: 'install' } }))
    await waitFor(() => expect(installLine()).toBeDefined(), { timeout: 3000 })

    const probe = api.creates[0]
    expect(probe).toMatchObject({ cwd: '/', shell: '/bin/sh' })
    expect(String(probe.id)).toMatch(/^bat-home-probe-[0-9a-f]{16}$/)
    expect(api.kills).toEqual([probe.id])

    const workspaces = workspaceStore.getState().workspaces
    expect(workspaces).toHaveLength(1)
    expect(workspaces[0]).toMatchObject({ name: BAT_TOOLS_WORKSPACE_NAME, folderPath: '/home/gower' })
    expect(workspaceStore.getState().activeWorkspaceId).toBe(workspaces[0].id)
    expect(api.creates[1]).toMatchObject({ cwd: '/home/gower', workspaceId: workspaces[0].id })
    expect(api.creates[1]).not.toHaveProperty('agentPreset')
  })

  it('fish login shell ⇒ install tab runs /bin/sh', async () => {
    installApi([MISSING], { shellPath: '/usr/bin/fish' })
    workspaceStore.addWorkspace('proj', '/home/gower/proj')
    const addToast = vi.fn()
    renderHook(() => useRemoteToolInstall({ addToast }))
    window.dispatchEvent(new CustomEvent('remote-tool-install-here', { detail: { toolId: 'claude', kind: 'install' } }))
    await waitFor(() => expect(api.creates).toHaveLength(1), { timeout: 3000 })
    expect(api.creates[0].shell).toBe('/bin/sh')
    expect(addToast).toHaveBeenCalledWith('The install tab uses /bin/sh because /usr/bin/fish is not a POSIX shell.', 'info', 10_000)
  })
})

describe('translateInstallNotice', () => {
  it('translates *Key params and passes the rest through', () => {
    const t = (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}`
    expect(translateInstallNotice({ level: 'warning', key: 'k', params: { toolKey: 'tool.name', code: '2' } }, t))
      .toBe('k{"tool":"tool.name","code":"2"}')
  })
})
