/**
 * BUG-232 / T0956: the wiring of the T0951 hold into the two paths (what the PTY receives is
 * launch-hold-login-install.test.ts):
 *
 *   - useRemoteToolInstall: `pty:create` carries `holdInputUntilLaunch: true`, the install line goes
 *     out by `pty.launchCommand` (the window's own PTY API); a host before T0951 → `pty.write`
 *   - WorkspaceView's login tab: the hold options from claude-login-guide.ts go into `pty:create`
 *     and the command goes through `sendLaunchCommand`; the 11 agent launch paths are untouched
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRemoteToolInstall } from '../../hooks/useRemoteToolInstall'
import { requestRemoteToolInstallHere } from '../remote-tools/install-runner'
import { buildInstallPlan, isInstallPlan } from '../remote-tools/recipes'
import { wrapWithSentinel } from '../remote-tools/sentinel'
import { workspaceStore } from '../../stores/workspace-store'
import { REMOTE_AUTH_ENV_VARS, REMOTE_TOOL_IDS, type RemoteToolsDetectResult, type RemoteToolsEnv } from '../../types/remote-tools'

const NO_AUTH_ENV = Object.fromEntries(REMOTE_AUTH_ENV_VARS.map((name) => [name, false])) as RemoteToolsEnv['authEnv']
const MISSING: RemoteToolsDetectResult = {
  ok: true,
  report: {
    schemaVersion: 1,
    env: { osFamily: 'linux', musl: false, pkgManager: 'apt', privilege: 'passwordless', isWsl: true, hasTimeout: true, authEnv: NO_AUTH_ENV },
    tools: REMOTE_TOOL_IDS.map((id) => ({ id, status: 'missing', login: 'n/a', serverVisible: false })),
    serverViewAvailable: true,
    warnings: [],
  },
}

interface Calls {
  creates: Array<Record<string, unknown>>
  writes: Array<[string, string]>
  launches: Array<[string, string | null]>
}

let originalApi: unknown

function installApi(oldHost: boolean): Calls {
  const calls: Calls = { creates: [], writes: [], launches: [] }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    remoteTools: { detect: vi.fn(), detectHere: vi.fn(async () => MISSING) },
    settings: { getShellPath: vi.fn(async () => '/bin/bash') },
    workspace: { save: vi.fn(async () => undefined) },
    debug: { log: vi.fn() },
    pty: {
      create: vi.fn(async (opts: Record<string, unknown>) => { calls.creates.push(opts); return { ok: true, created: true } }),
      write: vi.fn(async (id: string, data: string) => { calls.writes.push([id, data]) }),
      launchCommand: vi.fn(async (id: string, command: string | null) => {
        if (oldHost) throw new Error('No handler for channel: pty:launch-command')
        calls.launches.push([id, command])
        return { ok: true }
      }),
      kill: vi.fn(async () => true),
      onOutput: () => () => undefined,
      onExit: () => () => undefined,
    },
  }
  return calls
}

function clearWorkspaces() {
  for (const w of [...workspaceStore.getState().workspaces]) workspaceStore.removeWorkspace(w.id)
}

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
  clearWorkspaces()
})

afterEach(() => {
  clearWorkspaces()
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
})

function requestClaudeInstall() {
  const plan = buildInstallPlan('claude', MISSING.ok ? MISSING.report.env : (undefined as never))
  if (!isInstallPlan(plan)) throw new Error('plan')
  requestRemoteToolInstallHere(plan)
  return plan
}

describe('useRemoteToolInstall: the install tab asks for the T0951 hold', () => {
  it('pty:create carries holdInputUntilLaunch; the sentinel-wrapped line + \\r goes out by pty:launch-command', async () => {
    const calls = installApi(false)
    workspaceStore.addWorkspace('proj', '/home/demo/proj')
    renderHook(() => useRemoteToolInstall({ addToast: vi.fn() }))
    const plan = requestClaudeInstall()

    await waitFor(() => expect(calls.launches).toHaveLength(1), { timeout: 3000 })
    const [termId, line] = calls.launches[0]
    const nonce = /' '([0-9a-f]{16})' "\$\?"/.exec(line ?? '')![1]
    expect(line).toBe(wrapWithSentinel(plan.command, nonce) + '\r')
    expect(calls.creates).toHaveLength(1)
    expect(calls.creates[0]).toMatchObject({ id: termId, cwd: '/home/demo/proj', holdInputUntilLaunch: true })
    expect(calls.creates[0]).not.toHaveProperty('agentPreset')
    expect(calls.writes).toEqual([])
  })

  it('a host before T0951 (`No handler`) → the line by pty:write, as before', async () => {
    const calls = installApi(true)
    workspaceStore.addWorkspace('proj', '/home/demo/proj')
    renderHook(() => useRemoteToolInstall({ addToast: vi.fn() }))
    const plan = requestClaudeInstall()

    await waitFor(() => expect(calls.writes).toHaveLength(1), { timeout: 3000 })
    const [, line] = calls.writes[0]
    const nonce = /' '([0-9a-f]{16})' "\$\?"/.exec(line)![1]
    expect(line).toBe(wrapWithSentinel(plan.command, nonce) + '\r')
    expect(calls.launches).toEqual([])
  })
})

describe('WorkspaceView login tab wiring (source guard)', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../components/WorkspaceView.tsx'), 'utf8')
  const login = source.slice(source.indexOf('handleOpenLoginTerminal = '), source.indexOf('CLAUDE_OPEN_LOGIN_TERMINAL_EVENT, handleOpenLoginTerminal)'))

  it('passes sendLaunchCommand and spreads the hold options of claude-login-guide.ts into pty:create', () => {
    expect(login).toContain('openClaudeLoginTerminal({')
    expect(login).toMatch(/createShell: \(terminalId, shell, launch, launchHold\) => createPtyThenLaunch\(\{/)
    expect(login).toContain('...launchHold,')
    expect(login).toMatch(/^\s*sendLaunchCommand,$/m)
  })

  it('the login command is still typed without Enter (claude-login-guide.ts)', () => {
    const guide = fs.readFileSync(path.join(__dirname, '../claude-login-guide.ts'), 'utf8')
    expect(guide).toContain('if (send) send(terminalId, command)')
    expect(guide).toContain("send ? { holdInputUntilLaunch: true } : {}")
  })
})
