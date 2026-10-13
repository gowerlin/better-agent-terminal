/**
 * T0505: picking an ~/.ssh/config alias stores `sshUser: ''` (ssh config
 * decides the user). Every later SSH step must accept that and pass the empty
 * user through to the main process, which runs `ssh -- <alias>`. A typed
 * `user@host:port` keeps working as before. All IPC is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WizardContext } from '../wizard-runner'
import { configureSshHostStep } from '../steps/ssh/configure-host'
import { verifySshAuthStep } from '../steps/ssh/verify-auth'
import { installSshServerBundleStep } from '../steps/ssh/install-server-bundle'
import { startServerStep } from '../steps/ssh/start-server'
import { ensureSshVerifyEndpoint } from '../steps/ssh/verify-remote'
import { describeSshTarget } from '../steps/ssh/ssh-target'

interface Mocks {
  listHosts: ReturnType<typeof vi.fn>
  probeAuth: ReturnType<typeof vi.fn>
  distribute: ReturnType<typeof vi.fn>
  uploadBundle: ReturnType<typeof vi.fn>
  uninstallBundle: ReturnType<typeof vi.fn>
  startServer: ReturnType<typeof vi.fn>
  stopServer: ReturnType<typeof vi.fn>
  openVerifyTunnel: ReturnType<typeof vi.fn>
}

let mocks: Mocks

function installApi(aliases: string[] = ['devbox', 'build-01']): void {
  mocks = {
    listHosts: vi.fn(async () => aliases),
    probeAuth: vi.fn(async () => ({ ok: true, serverPlatform: 'linux', serverArch: 'x86_64', serverHome: '/home/alice' })),
    distribute: vi.fn(async () => ({ ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' })),
    uploadBundle: vi.fn(async () => ({ ok: true })),
    uninstallBundle: vi.fn(async () => ({ ok: true })),
    startServer: vi.fn(async () => ({ ok: true, method: 'systemd', servicePath: '/home/alice/.config/systemd/user/bat-server.service' })),
    stopServer: vi.fn(async () => ({ ok: true })),
    openVerifyTunnel: vi.fn(async () => ({ ok: true, localPort: 53111 })),
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      update: { getVersion: vi.fn(async () => '0.6.0') },
      remote: {
        serverBundle: {
          distribute: mocks.distribute,
          onDistributeProgress: vi.fn(() => () => undefined),
        },
      },
      ssh: {
        listHosts: mocks.listHosts,
        probeAuth: mocks.probeAuth,
        uploadBundle: mocks.uploadBundle,
        onUploadProgress: vi.fn(() => () => undefined),
        uninstallBundle: mocks.uninstallBundle,
        startServer: mocks.startServer,
        stopServer: mocks.stopServer,
        onStartProgress: vi.fn(() => () => undefined),
        openVerifyTunnel: mocks.openVerifyTunnel,
      },
    },
  }
}

function makeCtx(choice: string | null, extra: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 'alias-box' },
    warnings: [],
    state: {},
    serverPort: 51820,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    requestChoice: vi.fn(async () => choice),
    ...extra,
  }
}

/** configure → verify-auth → install → start → tunnel, like the runner does. */
async function runSshSteps(ctx: WizardContext): Promise<void> {
  await configureSshHostStep.run(ctx)
  await verifySshAuthStep.run(ctx)
  await installSshServerBundleStep.run(ctx)
  await startServerStep.run(ctx)
  await ensureSshVerifyEndpoint(ctx)
}

beforeEach(() => installApi())

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('SSH wizard alias without a user (T0505)', () => {
  it('alias path passes verify-ssh-auth, install, start and the verify tunnel with an empty user', async () => {
    const ctx = makeCtx('devbox')
    await runSshSteps(ctx)

    expect(ctx.state).toMatchObject({ sshAlias: 'devbox', sshHost: 'devbox', sshUser: '' })
    expect(ctx.profileDraft).toMatchObject({ sshHost: 'devbox', sshUser: '', sshAlias: 'devbox' })

    const connect = { sshHost: 'devbox', sshUser: '', sshPort: undefined, sshKeyPath: undefined }
    expect(mocks.probeAuth).toHaveBeenCalledWith(connect)
    expect(mocks.distribute).toHaveBeenCalledWith(expect.objectContaining({
      draftProfile: expect.objectContaining({ sshHost: 'devbox', sshUser: '', sshServerArch: 'x86_64' }),
    }))
    expect(mocks.uploadBundle).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ ...connect, installPath: '/home/alice/.local/bat-server' }),
    }))
    expect(mocks.startServer).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ ...connect, serverHome: '/home/alice' }),
    }))
    expect(mocks.openVerifyTunnel).toHaveBeenCalledWith(expect.objectContaining({ ...connect, remotePort: 51820 }))
    expect(ctx.verifyEndpoint).toEqual({ host: '127.0.0.1', port: 53111 })
  })

  it('logs the bare alias, never "@alias"', async () => {
    const ctx = makeCtx('devbox')
    await runSshSteps(ctx)
    const lines = (ctx.logger.info as ReturnType<typeof vi.fn>).mock.calls.map((call) => String(call[0]))
    expect(lines.some((line) => line.includes('Probing devbox'))).toBe(true)
    expect(lines.some((line) => line.includes('@devbox'))).toBe(false)
  })

  it('rollback after an alias install / start passes the empty user to the teardown IPC', async () => {
    const ctx = makeCtx('devbox')
    await runSshSteps(ctx)
    await startServerStep.rollback!(ctx)
    await installSshServerBundleStep.rollback!(ctx)
    expect(mocks.stopServer).toHaveBeenCalledWith(expect.objectContaining({ sshHost: 'devbox', sshUser: '' }))
    expect(mocks.uninstallBundle).toHaveBeenCalledWith(expect.objectContaining({ sshHost: 'devbox', sshUser: '' }))
  })

  it('a stored profile state with sshUser "" and no alias list still runs (no re-prompt)', async () => {
    installApi([])
    const ctx = makeCtx(null)
    ctx.state = { sshHost: 'devbox', sshUser: '' }
    await runSshSteps(ctx)
    expect(ctx.requestChoice).not.toHaveBeenCalled()
    expect(mocks.probeAuth).toHaveBeenCalledWith(expect.objectContaining({ sshHost: 'devbox', sshUser: '' }))
  })

  it('a missing host still fails verify-ssh-auth before any IPC', async () => {
    const ctx = makeCtx(null)
    await expect(verifySshAuthStep.run(ctx)).rejects.toThrow(/SSH host must be configured/)
    expect(mocks.probeAuth).not.toHaveBeenCalled()
  })

  it.each(['-oProxyCommand=calc', '!negated', 'has space', 'a@b', 'host;rm', 'host$(id)'])(
    'rejects alias %j without writing it',
    async (alias) => {
      installApi([alias])
      const ctx = makeCtx(alias)
      await expect(configureSshHostStep.run(ctx)).rejects.toMatchObject({ code: 'configure-host-invalid' })
      expect(ctx.state).not.toHaveProperty('sshAlias')
      expect((ctx.state as { sshHost?: string }).sshHost).toBeUndefined()
    },
  )
})

describe('typed user@host:port is unchanged (T0505)', () => {
  it('passes user and port through every step', async () => {
    const ctx = makeCtx('\u0000manual-host', {
      requestText: vi.fn(async () => 'deploy@build.example.com:2222'),
    })
    await runSshSteps(ctx)

    expect(ctx.state).toMatchObject({ sshHost: 'build.example.com', sshUser: 'deploy', sshPort: 2222 })
    const connect = { sshHost: 'build.example.com', sshUser: 'deploy', sshPort: 2222, sshKeyPath: undefined }
    expect(mocks.probeAuth).toHaveBeenCalledWith(connect)
    expect(mocks.uploadBundle).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining(connect) }))
    expect(mocks.startServer).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining(connect) }))
    expect(mocks.openVerifyTunnel).toHaveBeenCalledWith(expect.objectContaining(connect))
    const lines = (ctx.logger.info as ReturnType<typeof vi.fn>).mock.calls.map((call) => String(call[0]))
    expect(lines.some((line) => line.includes('Probing deploy@build.example.com:2222'))).toBe(true)
  })
})

describe('describeSshTarget (renderer, T0505)', () => {
  it('formats with and without a user', () => {
    expect(describeSshTarget('alice', 'devbox')).toBe('alice@devbox')
    expect(describeSshTarget('', 'devbox')).toBe('devbox')
    expect(describeSshTarget(undefined, 'devbox')).toBe('devbox')
  })
})
