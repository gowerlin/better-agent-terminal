// @vitest-environment node
/**
 * T0449 (T0445 #5 / #8): RemoteServer auth throttling keeps capability (helper) auths apart
 * from server-token auths, on a real headless server (T0388 harness) over loopback.
 *
 *   #5 failed capability auths never ban the IP (the BAT client on loopback / an SSH tunnel
 *      keeps working); a revoked capability is answered `Capability revoked`, not counted
 *   #8 a successful capability auth does not reset the server-token failure count
 *   unchanged: 5 server-token failures still ban (loopback included)
 */
import { randomBytes } from 'crypto'
import WebSocket from 'ws'
import { afterEach, describe, expect, it } from 'vitest'
import { AUTH_FAIL_THRESHOLD } from '../remote-server'
import { HELPER_CAPABILITY_TOKEN_PREFIX, HelperCapabilityRegistry } from '../helper-capability'
import type { RemoteFrame } from '../protocol'
import { connectHeadlessClient, startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

let harness: HeadlessHarness | null = null
let registry: HelperCapabilityRegistry

afterEach(async () => {
  await harness?.dispose()
  harness = null
})

async function start(opts: { token?: string } = {}): Promise<HeadlessHarness> {
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry, ...opts })
  return harness
}

/** One auth attempt on a fresh loopback connection; resolves with the auth-result `error` (undefined = accepted). */
async function attemptAuth(h: HeadlessHarness, token: string): Promise<string | undefined> {
  const ws = new WebSocket(`wss://127.0.0.1:${h.port}`, { rejectUnauthorized: false })
  ws.on('error', () => {})
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('auth attempt timed out')), 5_000)
      ws.on('message', raw => {
        let frame: RemoteFrame
        try { frame = JSON.parse(raw.toString()) } catch { return }
        if (frame.type !== 'auth-result') return
        clearTimeout(timer)
        resolve(frame.error)
      })
      ws.once('open', () => ws.send(JSON.stringify({ type: 'auth', id: 'auth-1', token, args: ['T0449'] })))
      ws.once('close', () => { clearTimeout(timer); reject(new Error('closed before auth-result')) })
    })
  } finally {
    ws.terminate()
  }
}

const wrongCapability = () => HELPER_CAPABILITY_TOKEN_PREFIX + randomBytes(32).toString('base64url')
const wrongServerToken = () => randomBytes(16).toString('hex')

async function expectServerTokenAccepted(h: HeadlessHarness): Promise<void> {
  const client = await connectHeadlessClient({ port: h.port, token: h.token, fingerprint: h.fingerprint })
  await client.close()
}

describe('T0445 #5 — capability auth failures never ban', () => {
  it('10 wrong capability tokens from loopback: each "Invalid token", then the server token still authenticates', async () => {
    const h = await start()
    for (let i = 0; i < 10; i++) {
      expect(await attemptAuth(h, wrongCapability())).toBe('Invalid token')
    }
    await expectServerTokenAccepted(h)
    // A live capability is still accepted too.
    expect(await attemptAuth(h, registry.issue('t0449-tower'))).toBeUndefined()
  })

  it('a revoked capability is answered "Capability revoked" and not counted (10 times, server token still works)', async () => {
    const h = await start()
    const token = registry.issue('t0449-worker', { towerId: 't0449-tower' })
    registry.revokeTerminal('t0449-worker')
    for (let i = 0; i < 10; i++) {
      expect(await attemptAuth(h, token)).toBe('Capability revoked')
    }
    await expectServerTokenAccepted(h)
  })

  it('capability failures do not count toward a server-token ban either', async () => {
    const h = await start()
    for (let i = 0; i < AUTH_FAIL_THRESHOLD - 1; i++) {
      expect(await attemptAuth(h, wrongServerToken())).toBe('Invalid token')
    }
    for (let i = 0; i < 10; i++) {
      expect(await attemptAuth(h, wrongCapability())).toBe('Invalid token')
    }
    await expectServerTokenAccepted(h)
  })
})

describe('T0445 #8 — a capability success does not clear the server-token failure count', () => {
  it('4 server-token failures + 1 capability success + 1 server-token failure ⇒ banned', async () => {
    const h = await start()
    const capability = registry.issue('t0449-tower')
    for (let i = 0; i < AUTH_FAIL_THRESHOLD - 1; i++) {
      expect(await attemptAuth(h, wrongServerToken())).toBe('Invalid token')
    }
    expect(await attemptAuth(h, capability)).toBeUndefined()
    expect(await attemptAuth(h, wrongServerToken())).toBe('Invalid token')
    expect(await attemptAuth(h, h.token)).toBe('Too many failed attempts')
    expect(await attemptAuth(h, capability)).toBe('Too many failed attempts')
  })
})

describe('server-token throttle unchanged', () => {
  it(`${AUTH_FAIL_THRESHOLD} server-token failures from loopback still ban`, async () => {
    const h = await start()
    for (let i = 0; i < AUTH_FAIL_THRESHOLD; i++) {
      expect(await attemptAuth(h, wrongServerToken())).toBe('Invalid token')
    }
    expect(await attemptAuth(h, h.token)).toBe('Too many failed attempts')
  })

  it('a server token that itself has the capability prefix: prefixed guesses count toward the ban', async () => {
    const h = await start({ token: HELPER_CAPABILITY_TOKEN_PREFIX + randomBytes(16).toString('hex') })
    for (let i = 0; i < AUTH_FAIL_THRESHOLD; i++) {
      expect(await attemptAuth(h, wrongCapability())).toBe('Invalid token')
    }
    expect(await attemptAuth(h, h.token)).toBe('Too many failed attempts')
  })
})
