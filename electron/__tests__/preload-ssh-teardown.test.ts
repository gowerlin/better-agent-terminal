/**
 * T0426 / BUG-100: preload exposes `ssh.stopServer` / `ssh.uninstallBundle`
 * (declared in electron.d.ts since T0289) on the `ssh:*` IPC channels.
 */
import { describe, expect, test, vi } from 'vitest'

const { invoke, exposeInMainWorld } = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({ ok: true })),
  exposeInMainWorld: vi.fn(),
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
  webUtils: { getPathForFile: vi.fn() },
}))

describe('preload ssh rollback teardown', () => {
  test('stopServer / uninstallBundle invoke ssh:stop-server / ssh:uninstall-bundle', async () => {
    await import('../preload')
    const call = exposeInMainWorld.mock.calls.find(([key]) => key === 'electronAPI')
    expect(call).toBeDefined()
    const api = call![1] as {
      ssh: {
        stopServer: (r: unknown) => Promise<unknown>
        uninstallBundle: (r: unknown) => Promise<unknown>
      }
    }

    const stop = { sshHost: 'devbox.example', sshUser: 'alice', targetOS: 'ssh-linux', serverHome: '/home/alice' }
    await expect(api.ssh.stopServer(stop)).resolves.toEqual({ ok: true })
    expect(invoke).toHaveBeenLastCalledWith('ssh:stop-server', stop)

    const remove = { sshHost: 'devbox.example', sshUser: 'alice', installPath: '/home/alice/.local/bat-server' }
    await expect(api.ssh.uninstallBundle(remove)).resolves.toEqual({ ok: true })
    expect(invoke).toHaveBeenLastCalledWith('ssh:uninstall-bundle', remove)
  })
})
