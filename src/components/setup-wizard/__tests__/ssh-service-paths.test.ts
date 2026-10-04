/**
 * T0379 (BUG-088): the SSH wizard resolves the default `~/.local/bat-server`
 * against the probed remote $HOME before uploading (the upload single-quotes
 * the path, so bash would create a directory literally named `~`) and hands
 * the absolute path to `ssh:start-server`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WizardContext } from '../wizard-runner'
import { installSshServerBundleStep } from '../steps/ssh/install-server-bundle'
import { startServerStep } from '../steps/ssh/start-server'
import { resolveSshInstallPath, resolveSshServerHome } from '../steps/ssh/remote-home'

let uploadBundleMock: ReturnType<typeof vi.fn>
let uninstallBundleMock: ReturnType<typeof vi.fn>
let startServerMock: ReturnType<typeof vi.fn>
let distributeMock: ReturnType<typeof vi.fn>

function makeCtx(state: Record<string, unknown> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 'ssh-paths' },
    warnings: [],
    state: {
      sshHost: 'devbox.example',
      sshUser: 'alice',
      sshInstallPath: '~/.local/bat-server',
      sshServerHome: '/home/alice',
      sshServerArch: 'x86_64',
      ...state,
    },
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    serverPort: 51820,
  }
}

beforeEach(() => {
  uploadBundleMock = vi.fn(async () => ({ ok: true }))
  uninstallBundleMock = vi.fn(async () => ({ ok: true }))
  startServerMock = vi.fn(async () => ({ ok: true, method: 'systemd', servicePath: '/home/alice/.config/systemd/user/bat-server.service' }))
  distributeMock = vi.fn(async () => ({ ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' }))
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      update: { getVersion: vi.fn(async () => '0.5.9') },
      remote: {
        serverBundle: {
          distribute: distributeMock,
          onDistributeProgress: vi.fn(() => () => undefined),
        },
      },
      ssh: {
        uploadBundle: uploadBundleMock,
        onUploadProgress: vi.fn(() => () => undefined),
        uninstallBundle: uninstallBundleMock,
        startServer: startServerMock,
        onStartProgress: vi.fn(() => () => undefined),
      },
    },
  }
})

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('resolveSshInstallPath (T0379)', () => {
  it('expands ~/ against the remote home', () => {
    expect(resolveSshInstallPath('~/.local/bat-server', '/home/alice')).toBe('/home/alice/.local/bat-server')
    expect(resolveSshInstallPath('~/.local/bat-server', '/Users/alice/')).toBe('/Users/alice/.local/bat-server')
    expect(resolveSshInstallPath('~', '/home/alice')).toBe('/home/alice')
  })

  it('leaves absolute paths unchanged', () => {
    expect(resolveSshInstallPath('/opt/bat-server', '/home/alice')).toBe('/opt/bat-server')
  })

  it('rejects ~user/ and relative paths', () => {
    expect(() => resolveSshInstallPath('~bob/bat-server', '/home/alice')).toThrow(/absolute or start with ~\//)
    expect(() => resolveSshInstallPath('bat-server', '/home/alice')).toThrow(/absolute or start with ~\//)
  })

  it.each([undefined, '', 'home/alice', '~', '/home/al ice', "/home/a'b", '/home/../root'])(
    'rejects invalid remote home %j',
    (home) => {
      expect(() => resolveSshServerHome(home)).toThrow(/Server \$HOME/)
      expect(() => resolveSshInstallPath('~/.local/bat-server', home)).toThrow(/Server \$HOME/)
    },
  )
})

describe('install-server-bundle (SSH) — absolute upload target (T0379)', () => {
  it('uploads to <home>/.local/bat-server and records the absolute path', async () => {
    const ctx = makeCtx()
    await installSshServerBundleStep.run(ctx)
    expect(uploadBundleMock).toHaveBeenCalledTimes(1)
    expect(uploadBundleMock.mock.calls[0][0].options.installPath).toBe('/home/alice/.local/bat-server')
    expect(ctx.serverInstallPath).toBe('/home/alice/.local/bat-server')
    // user's choice is kept as-is so configure-host still shows the selected option
    expect(ctx.state.sshInstallPath).toBe('~/.local/bat-server')
  })

  it('keeps /opt/bat-server unchanged', async () => {
    const ctx = makeCtx({ sshInstallPath: '/opt/bat-server' })
    await installSshServerBundleStep.run(ctx)
    expect(uploadBundleMock.mock.calls[0][0].options.installPath).toBe('/opt/bat-server')
  })

  it('fails before downloading or uploading when the remote home is unknown', async () => {
    const ctx = makeCtx({ sshServerHome: undefined })
    await expect(installSshServerBundleStep.run(ctx)).rejects.toThrow(/Server \$HOME/)
    expect(distributeMock).not.toHaveBeenCalled()
    expect(uploadBundleMock).not.toHaveBeenCalled()
  })

  it('rollback removes the absolute path the upload created', async () => {
    const ctx = makeCtx()
    await installSshServerBundleStep.run(ctx)
    await installSshServerBundleStep.rollback?.(ctx)
    expect(uninstallBundleMock.mock.calls[0][0].installPath).toBe('/home/alice/.local/bat-server')
  })
})

describe('start-server (SSH) — absolute installPath over IPC (T0379)', () => {
  it('passes the resolved absolute install path and serverHome', async () => {
    const ctx = makeCtx()
    await startServerStep.run(ctx)
    const options = startServerMock.mock.calls[0][0].options
    expect(options.installPath).toBe('/home/alice/.local/bat-server')
    expect(options.serverHome).toBe('/home/alice')
  })

  it('rejects an invalid remote home without calling ssh:start-server', async () => {
    const ctx = makeCtx({ sshServerHome: 'relative/home' })
    await expect(startServerStep.run(ctx)).rejects.toThrow(/Server \$HOME/)
    expect(startServerMock).not.toHaveBeenCalled()
  })
})
