/**
 * T0517 (BUG-124): when the target sshd refuses port forwarding
 * (`AllowTcpForwarding no`), verification through the wizard's tunnel fails
 * with a TLS reset ("no TLS certificate"). The SSH verify steps ask main
 * whether ssh reported the refusal and, if so, rethrow with
 * `ssh-forwarding-denied`, which the error mapper turns into a message naming
 * the real cause (three languages). The original error stays in the raw
 * detail. All IPC is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import en from '../../../locales/en.json'
import zhTW from '../../../locales/zh-TW.json'
import zhCN from '../../../locales/zh-CN.json'
import { DEFAULT_WIZARD_ERROR_REGISTRY, resolveWizardError, type WizardContext } from '../wizard-runner'
import { sshConnectTestStep, sshFetchFingerprintStep } from '../steps/ssh/verify-remote'
import { resetFetchFingerprintImplForTests } from '../steps/wsl/fetch-fingerprint'

const FP = 'AB:'.repeat(31) + 'CD'
const REMOTE_PORT = 9876
const TUNNEL_PORT = 53111
const DENIED_LINE = 'channel 2: open failed: administratively prohibited: open failed'
const HANDSHAKE_ERROR = `TLS handshake with 127.0.0.1:${TUNNEL_PORT} failed: read ECONNRESET`

type Status = { forwardingDenied: boolean; detail: string | null }

function installApi(options: {
  status?: Status | (() => Promise<Status>) | null
  fetchFingerprint?: ReturnType<typeof vi.fn>
  testConnection?: ReturnType<typeof vi.fn>
} = {}) {
  const calls: string[] = []
  const openSessions = new Set<string>()
  const statusOption = options.status === undefined ? { forwardingDenied: true, detail: DENIED_LINE } : options.status
  const verifyTunnelStatus = vi.fn(async (sessionId: string) => {
    calls.push(`status:${sessionId}:${openSessions.has(sessionId) ? 'open' : 'closed'}`)
    return typeof statusOption === 'function' ? statusOption() : statusOption
  })
  const api = {
    openVerifyTunnel: vi.fn(async (request: { sessionId: string }): Promise<
      { ok: true; localPort: number } | { ok: false; errorCode: string; error: string }
    > => {
      openSessions.add(request.sessionId)
      return { ok: true, localPort: TUNNEL_PORT }
    }),
    closeVerifyTunnel: vi.fn(async (sessionId: string) => {
      calls.push(`close:${sessionId}`)
      openSessions.delete(sessionId)
      return { ok: true }
    }),
    readServerIdentity: vi.fn(async () => ({ ok: true, fingerprint: FP, token: 'remote-token' })),
    verifyTunnelStatus,
    fetchFingerprint: options.fetchFingerprint
      ?? vi.fn(async () => ({ ok: false, errorCode: 'fingerprint-handshake-failed', error: HANDSHAKE_ERROR })),
    testConnection: options.testConnection ?? vi.fn(async () => ({ ok: true, metadata: null })),
  }
  const ssh: Record<string, unknown> = {
    openVerifyTunnel: api.openVerifyTunnel,
    closeVerifyTunnel: api.closeVerifyTunnel,
    readServerIdentity: api.readServerIdentity,
  }
  if (options.status !== null) ssh.verifyTunnelStatus = verifyTunnelStatus
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      ssh,
      wsl: { fetchFingerprint: api.fetchFingerprint },
      remote: { testConnection: api.testConnection },
    },
  }
  return { api, calls, openSessions }
}

function makeSshCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 'devbox' },
    warnings: [],
    state: { sshHost: 'devbox.example', sshUser: 'alice', sshServerHome: '/home/alice' },
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
  resetFetchFingerprintImplForTests()
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('fetch-fingerprint through a refused tunnel (T0517 / BUG-124)', () => {
  it('rethrows as ssh-forwarding-denied, keeping ssh\'s line and the original error', async () => {
    const { api, calls, openSessions } = installApi()
    const ctx = makeSshCtx()
    const error = await catching(sshFetchFingerprintStep.run(ctx))

    expect(error?.code).toBe('ssh-forwarding-denied')
    expect(error?.message).toContain('alice@devbox.example')
    expect(error?.message).toContain('AllowTcpForwarding')
    expect(error?.message).toContain(DENIED_LINE)
    expect(error?.message).toContain(HANDSHAKE_ERROR)
    // asked while the tunnel was still open, then closed it (no leak)
    expect(calls[0]).toMatch(/^status:ssh-verify-.*:open$/)
    expect(calls[1]).toMatch(/^close:ssh-verify-/)
    expect(openSessions.size).toBe(0)
    expect(api.readServerIdentity).not.toHaveBeenCalled()
    expect(ctx.fingerprint).toBeUndefined()
  })

  it('no refusal → the original coded error is unchanged', async () => {
    const { api, openSessions } = installApi({ status: { forwardingDenied: false, detail: null } })
    const error = await catching(sshFetchFingerprintStep.run(makeSshCtx()))
    expect(error?.code).toBe('fingerprint-handshake-failed')
    expect(error?.message).toBe(HANDSHAKE_ERROR)
    expect(api.verifyTunnelStatus).toHaveBeenCalledTimes(1)
    expect(openSessions.size).toBe(0)
  })

  it('status lookup failing or missing (older preload) → original error', async () => {
    installApi({ status: () => Promise.reject(new Error('ipc gone')) })
    expect((await catching(sshFetchFingerprintStep.run(makeSshCtx())))?.code).toBe('fingerprint-handshake-failed')

    const { api } = installApi({ status: null })
    expect((await catching(sshFetchFingerprintStep.run(makeSshCtx())))?.code).toBe('fingerprint-handshake-failed')
    expect(api.verifyTunnelStatus).not.toHaveBeenCalled()
  })

  it('success path does not ask for the tunnel status', async () => {
    const { api } = installApi({ fetchFingerprint: vi.fn(async () => ({ ok: true, fingerprint: FP })) })
    const ctx = makeSshCtx()
    await sshFetchFingerprintStep.run(ctx)
    expect(ctx.fingerprint).toBe(FP)
    expect(api.verifyTunnelStatus).not.toHaveBeenCalled()
  })

  it('a tunnel that never opened is not looked up', async () => {
    const { api } = installApi()
    api.openVerifyTunnel.mockResolvedValueOnce({ ok: false, errorCode: 'ssh-tunnel-failed', error: 'Could not open the SSH tunnel' })
    const error = await catching(sshFetchFingerprintStep.run(makeSshCtx()))
    expect(error?.code).toBe('ssh-tunnel-failed')
    expect(api.verifyTunnelStatus).not.toHaveBeenCalled()
  })

  it('a fingerprint mismatch is not reinterpreted', async () => {
    const { api } = installApi({ fetchFingerprint: vi.fn(async () => ({ ok: true, fingerprint: FP })) })
    api.readServerIdentity.mockResolvedValueOnce({ ok: true, fingerprint: '12:'.repeat(31) + '34', token: 't' })
    const error = await catching(sshFetchFingerprintStep.run(makeSshCtx()))
    expect(error?.code).toBe('fingerprint-mismatch')
    expect(api.verifyTunnelStatus).not.toHaveBeenCalled()
  })
})

describe('connect-test through a refused tunnel (T0517 / BUG-124)', () => {
  it('rethrows as ssh-forwarding-denied and still closes the tunnel', async () => {
    const { calls, openSessions } = installApi({
      testConnection: vi.fn(async () => ({ ok: false, error: 'socket hang up' })),
    })
    const ctx = makeSshCtx({ fingerprint: FP, remoteToken: 'remote-token' })
    const error = await catching(sshConnectTestStep.run(ctx))
    expect(error?.code).toBe('ssh-forwarding-denied')
    expect(error?.message).toContain('socket hang up')
    expect(calls[0]).toMatch(/:open$/)
    expect(openSessions.size).toBe(0)
  })

  it('skipped connect-test (no fingerprint) never asks', async () => {
    const { api } = installApi()
    const ctx = makeSshCtx({ fingerprint: null })
    await sshConnectTestStep.run(ctx)
    expect(ctx.connectTestSkipped).toBe(true)
    expect(api.verifyTunnelStatus).not.toHaveBeenCalled()
  })
})

describe('ssh-forwarding-denied error mapping (T0517 / BUG-124)', () => {
  it('i18n title/body exist in en / zh-TW / zh-CN and name AllowTcpForwarding', () => {
    for (const locale of [en, zhTW, zhCN] as Array<typeof en>) {
      const entry = locale.wizard.ssh.error.forwardingDenied
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.body).toContain('AllowTcpForwarding')
    }
  })

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('maps at stage 1 for fetch-fingerprint and connect-test (%s), raw error kept', async (lng, locale) => {
    await i18n.changeLanguage(lng)
    for (const stepId of ['fetch-fingerprint', 'connect-test']) {
      const raw = `alice@devbox.example does not allow SSH port forwarding ... ssh: ${DENIED_LINE}. Original error: ${HANDSHAKE_ERROR}`
      const mapped = resolveWizardError(
        { platform: 'ssh', stepId, errorCode: 'ssh-forwarding-denied', error: new Error(raw) },
        DEFAULT_WIZARD_ERROR_REGISTRY,
      )
      expect(mapped.matchId).toBe('ssh-forwarding-denied')
      expect(mapped.title).toBe(locale.wizard.ssh.error.forwardingDenied.title)
      expect(mapped.body).toBe(locale.wizard.ssh.error.forwardingDenied.body)
      expect(mapped.rawError).toBe(raw)
      expect(mapped.detailMode).toBe('append-raw')
      expect(mapped.actions.map((action) => action.kind)).toEqual(['fixed-and-retry', 'cancel'])
    }
    await i18n.changeLanguage('en')
  })

  it('the plain handshake failure still maps to the generic TLS message', async () => {
    await i18n.changeLanguage('en')
    const mapped = resolveWizardError(
      { platform: 'ssh', stepId: 'fetch-fingerprint', errorCode: 'fingerprint-handshake-failed', error: new Error(HANDSHAKE_ERROR) },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.matchId).toBe('fingerprint-handshake-failed')
  })
})
