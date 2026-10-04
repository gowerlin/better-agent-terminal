/**
 * T0387 (BUG-093): the SSH wizard's fetch-fingerprint / connect-test reach the
 * REMOTE bat-server — through the wizard's SSH tunnel (tunnel mode) or the
 * remote host (direct mode) — never this BAT's own `localhost:<serverPort>`.
 * Every wizard exit path closes the tunnel; WSL / Docker keep the shared
 * steps' localhost behaviour. All SSH access is mocked IPC.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WizardRunner, type WizardContext, type WizardStep } from '../wizard-runner'
import { buildSshWizardSteps } from '../ssh-flow'
import { buildWslWizardSteps } from '../wsl-flow'
import { buildDockerWizardSteps } from '../docker-flow'
import { sshConnectTestStep, sshFetchFingerprintStep } from '../steps/ssh/verify-remote'
import { fetchFingerprintStep, resetFetchFingerprintImplForTests } from '../steps/wsl/fetch-fingerprint'
import { connectTestStep } from '../steps/wsl/connect-test'

const FP = 'AB:'.repeat(31) + 'CD'
const OTHER_FP = '12:'.repeat(31) + '34'
const REMOTE_PORT = 9876
const TUNNEL_PORT = 53111

interface Api {
  openVerifyTunnel: ReturnType<typeof vi.fn>
  closeVerifyTunnel: ReturnType<typeof vi.fn>
  readServerIdentity: ReturnType<typeof vi.fn>
  fetchFingerprint: ReturnType<typeof vi.fn>
  testConnection: ReturnType<typeof vi.fn>
  openSessions: Set<string>
}

function installApi(overrides: Partial<Omit<Api, 'openSessions'>> = {}): Api {
  const openSessions = new Set<string>()
  const api: Api = {
    openSessions,
    openVerifyTunnel: vi.fn(async (request: { sessionId: string }) => {
      openSessions.add(request.sessionId)
      return { ok: true, localPort: TUNNEL_PORT }
    }),
    closeVerifyTunnel: vi.fn(async (sessionId: string) => {
      openSessions.delete(sessionId)
      return { ok: true }
    }),
    readServerIdentity: vi.fn(async () => ({ ok: true, fingerprint: FP, token: 'remote-token' })),
    fetchFingerprint: vi.fn(async () => ({ ok: true, fingerprint: FP })),
    testConnection: vi.fn(async () => ({ ok: true, metadata: null })),
    ...overrides,
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      ssh: {
        openVerifyTunnel: api.openVerifyTunnel,
        closeVerifyTunnel: api.closeVerifyTunnel,
        readServerIdentity: api.readServerIdentity,
      },
      wsl: { fetchFingerprint: api.fetchFingerprint },
      remote: { testConnection: api.testConnection },
    },
  }
  return api
}

function makeSshCtx(overrides: Partial<WizardContext> = {}, state: Record<string, unknown> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 'devbox' },
    warnings: [],
    state: {
      sshHost: 'devbox.example',
      sshUser: 'alice',
      sshTunnelMode: 'tunnel',
      sshServerHome: '/home/alice',
      ...state,
    },
    serverPort: REMOTE_PORT,
    systemdServiceActive: true,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
}

async function catching(promise: Promise<unknown>): Promise<(Error & { code?: string }) | null> {
  try {
    await promise
    return null
  } catch (error) {
    return error as Error & { code?: string }
  }
}

beforeEach(() => {
  resetFetchFingerprintImplForTests()
})

afterEach(() => {
  vi.useRealTimers()
  resetFetchFingerprintImplForTests()
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('SSH flow wiring (T0387)', () => {
  it('uses the SSH verify steps under the frozen ids; WSL / Docker keep the shared steps', () => {
    const ssh = buildSshWizardSteps()
    expect(ssh.map((step) => step.id)).toEqual([
      'configure-ssh-host',
      'verify-ssh-auth',
      'install-server-bundle',
      'start-server',
      'fetch-fingerprint',
      'connect-test',
      'write-profile',
      'done',
    ])
    expect(ssh).toContain(sshFetchFingerprintStep)
    expect(ssh).toContain(sshConnectTestStep)
    expect(sshFetchFingerprintStep.appliesTo).toBe('all')
    expect(sshConnectTestStep.labelKey).toBe(connectTestStep.labelKey)
    for (const steps of [buildWslWizardSteps(), buildDockerWizardSteps()]) {
      expect(steps).toContain(fetchFingerprintStep)
      expect(steps).toContain(connectTestStep)
      expect(steps).not.toContain(sshFetchFingerprintStep)
      expect(steps).not.toContain(sshConnectTestStep)
    }
  })
})

describe('tunnel mode (T0387 / BUG-093)', () => {
  it('fetch-fingerprint opens a tunnel to the remote port and handshakes with its local end', async () => {
    const api = installApi()
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)

    expect(api.openVerifyTunnel).toHaveBeenCalledTimes(1)
    expect(api.openVerifyTunnel.mock.calls[0][0]).toMatchObject({
      sshHost: 'devbox.example',
      sshUser: 'alice',
      remotePort: REMOTE_PORT,
    })
    expect(api.fetchFingerprint).toHaveBeenCalledWith(TUNNEL_PORT, '127.0.0.1')
    // not this BAT's localhost:9876 / ctx.serverPort
    expect(api.fetchFingerprint).not.toHaveBeenCalledWith(REMOTE_PORT)
    expect(api.fetchFingerprint).not.toHaveBeenCalledWith(REMOTE_PORT, expect.anything())
    expect(ctx.fingerprint).toBe(FP)
    expect(ctx.verifyEndpoint).toEqual({ host: '127.0.0.1', port: TUNNEL_PORT })
    // profile semantics unchanged: serverPort stays the REMOTE port
    expect(ctx.serverPort).toBe(REMOTE_PORT)
  })

  it('connect-test goes through the same tunnel, then closes it', async () => {
    const api = installApi()
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)
    await sshConnectTestStep.run(ctx)

    expect(api.testConnection).toHaveBeenCalledWith('127.0.0.1', TUNNEL_PORT, 'remote-token', FP)
    expect(api.testConnection).not.toHaveBeenCalledWith('localhost', REMOTE_PORT, expect.anything(), expect.anything())
    const sessionIds = api.openVerifyTunnel.mock.calls.map((call) => (call[0] as { sessionId: string }).sessionId)
    expect(new Set(sessionIds).size).toBe(1)
    expect(api.closeVerifyTunnel).toHaveBeenCalledWith(sessionIds[0])
    expect(api.openSessions.size).toBe(0)
    expect(ctx.verifyEndpoint).toBeUndefined()
    expect(ctx.connectTestSkipped).toBe(false)
  })

  it('tunnel failure fails fetch-fingerprint with a readable, coded error and no handshake', async () => {
    const api = installApi({
      openVerifyTunnel: vi.fn(async () => ({
        ok: false,
        errorCode: 'ssh-tunnel-failed',
        error: 'Could not open the SSH tunnel to alice@devbox.example (remote port 9876): SSH authentication was rejected (Permission denied)',
      })),
    })
    const ctx = makeSshCtx()
    const error = await catching(sshFetchFingerprintStep.run(ctx))
    expect(error?.code).toBe('ssh-tunnel-failed')
    expect(error?.message).toContain('Permission denied')
    expect(api.fetchFingerprint).not.toHaveBeenCalled()
    expect(ctx.verifyEndpoint).toBeUndefined()
  })
})

describe('direct mode (T0387 / BUG-093)', () => {
  it('fetch-fingerprint and connect-test target the remote host, no tunnel', async () => {
    const api = installApi()
    const ctx = makeSshCtx({}, { sshTunnelMode: 'direct' })
    await sshFetchFingerprintStep.run(ctx)
    await sshConnectTestStep.run(ctx)

    expect(api.openVerifyTunnel).not.toHaveBeenCalled()
    expect(api.fetchFingerprint).toHaveBeenCalledWith(REMOTE_PORT, 'devbox.example')
    expect(api.testConnection).toHaveBeenCalledWith('devbox.example', REMOTE_PORT, 'remote-token', FP)
    expect(ctx.verifyEndpoint).toBeUndefined()
  })
})

describe('fingerprint cross-check (T0387)', () => {
  it('match → passes and takes the remote token', async () => {
    const api = installApi()
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)
    expect(api.readServerIdentity).toHaveBeenCalledWith({
      sshHost: 'devbox.example',
      sshUser: 'alice',
      sshPort: undefined,
      sshKeyPath: undefined,
      targetOS: 'ssh-linux',
      serverHome: '/home/alice',
    })
    expect(ctx.fingerprint).toBe(FP)
    expect(ctx.remoteToken).toBe('remote-token')
  })

  it('mismatch → fingerprint-mismatch failure and nothing left to pin', async () => {
    installApi({ readServerIdentity: vi.fn(async () => ({ ok: true, fingerprint: OTHER_FP, token: 't' })) })
    const ctx = makeSshCtx()
    const error = await catching(sshFetchFingerprintStep.run(ctx))
    expect(error?.code).toBe('fingerprint-mismatch')
    expect(error?.message).toContain(FP)
    expect(error?.message).toContain(OTHER_FP)
    expect(ctx.fingerprint).toBeNull()
  })

  it('remote certificate unreadable → warn and keep the handshake value', async () => {
    installApi({ readServerIdentity: vi.fn(async () => ({ ok: false, error: 'ssh exited with code 255' })) })
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)
    expect(ctx.fingerprint).toBe(FP)
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('ssh exited with code 255'))
  })

  it('remote certificate without a fingerprint → warn and keep the handshake value', async () => {
    installApi({ readServerIdentity: vi.fn(async () => ({ ok: true, fingerprint: null, token: null })) })
    const ctx = makeSshCtx({ remoteToken: undefined })
    await sshFetchFingerprintStep.run(ctx)
    expect(ctx.fingerprint).toBe(FP)
    expect(ctx.remoteToken).toBeUndefined()
    expect(ctx.logger.warn).toHaveBeenCalled()
  })

  it('identity IPC throwing is treated as unreadable, not a failure', async () => {
    installApi({ readServerIdentity: vi.fn(async () => { throw new Error('ipc gone') }) })
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)
    expect(ctx.fingerprint).toBe(FP)
  })
})

describe('tunnel is closed on every wizard exit path (T0387)', () => {
  it('connect-test failure still closes the tunnel', async () => {
    vi.useFakeTimers()
    const api = installApi({ testConnection: vi.fn(async () => ({ ok: false, error: 'auth failed' })) })
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)
    const pending = catching(sshConnectTestStep.run(ctx))
    await vi.runAllTimersAsync()
    expect((await pending)?.message).toBe('auth failed')
    expect(api.openSessions.size).toBe(0)
  })

  it('connect-test skip path (no fingerprint) still closes the tunnel', async () => {
    const api = installApi()
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)
    ctx.fingerprint = null
    await sshConnectTestStep.run(ctx)
    expect(ctx.connectTestSkipped).toBe(true)
    expect(api.testConnection).not.toHaveBeenCalled()
    expect(api.openSessions.size).toBe(0)
  })

  it('fetch-fingerprint rollback closes the tunnel', async () => {
    const api = installApi()
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)
    expect(api.openSessions.size).toBe(1)
    await sshFetchFingerprintStep.rollback?.(ctx)
    expect(api.openSessions.size).toBe(0)
    expect(ctx.verifyEndpoint).toBeUndefined()
  })

  it('completed wizard run leaves no tunnel open', async () => {
    const api = installApi()
    const ctx = makeSshCtx()
    await new WizardRunner([sshFetchFingerprintStep, sshConnectTestStep], ctx).run()
    expect(api.openVerifyTunnel).toHaveBeenCalled()
    expect(api.openSessions.size).toBe(0)
  })

  it('a later step failing (rollback) leaves no tunnel open', async () => {
    const api = installApi()
    const ctx = makeSshCtx()
    const failing: WizardStep = {
      id: 'write-profile',
      title: 'boom',
      appliesTo: 'all',
      retryable: false,
      async run() { throw new Error('boom') },
    }
    await expect(new WizardRunner([sshFetchFingerprintStep, sshConnectTestStep, failing], ctx).run()).rejects.toThrow('boom')
    expect(api.openSessions.size).toBe(0)
  })

  it('cancel while fetch-fingerprint has failed rolls back and closes the tunnel', async () => {
    const api = installApi({ readServerIdentity: vi.fn(async () => ({ ok: true, fingerprint: OTHER_FP, token: null })) })
    const ctx = makeSshCtx()
    let runner: WizardRunner | null = null
    const failed = new Promise<void>((resolve) => {
      runner = new WizardRunner([sshFetchFingerprintStep, sshConnectTestStep], ctx, (snapshots) => {
        if (snapshots[0]?.status === 'failed') resolve()
      })
    })
    const run = runner!.run().catch((error: Error) => error)
    await failed
    // closed by the failing step itself: the runner does not roll back the
    // failed step when cancelling from the retry/skip prompt
    expect(api.openSessions.size).toBe(0)
    await runner!.cancel()
    expect(((await run) as Error).message).toBe('Wizard cancelled')
    expect(api.openSessions.size).toBe(0)
  })

  it('fetch-fingerprint failure closes the tunnel and a retry reopens it', async () => {
    const readServerIdentity = vi.fn()
      .mockResolvedValueOnce({ ok: true, fingerprint: OTHER_FP, token: null })
      .mockResolvedValue({ ok: true, fingerprint: FP, token: 'remote-token' })
    const api = installApi({ readServerIdentity })
    const ctx = makeSshCtx()
    expect((await catching(sshFetchFingerprintStep.run(ctx)))?.code).toBe('fingerprint-mismatch')
    expect(api.openSessions.size).toBe(0)
    await sshFetchFingerprintStep.run(ctx)
    expect(api.openVerifyTunnel).toHaveBeenCalledTimes(2)
    expect(api.openSessions.size).toBe(1)
    expect(ctx.fingerprint).toBe(FP)
  })
})

describe('WSL / Docker regression (T0387)', () => {
  it('shared fetch-fingerprint without verifyEndpoint still asks main for ctx.serverPort only', async () => {
    const api = installApi()
    const ctx = makeSshCtx({ targetOS: 'wsl-linux', state: {}, serverPort: 9877 })
    await fetchFingerprintStep.run(ctx)
    expect(api.fetchFingerprint).toHaveBeenCalledTimes(1)
    expect(api.fetchFingerprint.mock.calls[0]).toEqual([9877])
    expect(api.openVerifyTunnel).not.toHaveBeenCalled()
  })

  it('shared connect-test without verifyEndpoint still connects to localhost:serverPort', async () => {
    const api = installApi()
    const ctx = makeSshCtx({ targetOS: 'docker-linux', state: {}, serverPort: 9900, fingerprint: FP, remoteToken: 'tok' })
    await connectTestStep.run(ctx)
    expect(api.testConnection).toHaveBeenCalledWith('localhost', 9900, 'tok', FP)
    expect(api.closeVerifyTunnel).not.toHaveBeenCalled()
  })
})
