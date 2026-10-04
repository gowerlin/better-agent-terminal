// @vitest-environment node
/**
 * T0411 (PLAN-037 B): electron/handlers/remote-tools.ts.
 *   - `remote-tools:detect` (both hosts): Windows → host-platform; probe env drops
 *     the scrubbed keys; login shell from `$SHELL`, else the passwd shell
 *   - `detectRemoteToolsForProfile` (main's local-only `remote:detect-tools`):
 *     profileId validation, connection failures, an old server, success — the
 *     RemoteClient is a mock; it is always disconnected.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  REMOTE_TOOLS_DETECT_CHANNEL,
  asRemoteToolsDetectResult,
  buildProbeEnv,
  detectRemoteToolsForProfile,
  registerRemoteToolsHandlers,
  resolveProbeShell,
  runRemoteToolsDetect,
  type RemoteToolsDetectClient,
  type RemoteToolsProfileTarget,
} from '../handlers/remote-tools'
import { isHeadlessScrubbedEnvKey } from '../remote/headless-entry'
import { PROBE_BEGIN_MARKER, PROBE_END_MARKER, type ProbeExecFile, type ProbeInvocation } from '../remote-tools/probe-script'
import type { RemoteToolsDetectResult } from '../../src/types/remote-tools'

const LOGIN_OK = [PROBE_BEGIN_MARKER, 'env.uname_s=Linux', 'tool.git.state=found', 'tool.git.path=/usr/bin/git', 'tool.git.version=git version 2.43.0', PROBE_END_MARKER].join('\n')
const SERVER_OK = [PROBE_BEGIN_MARKER, 'tool.git.state=found', 'tool.git.path=/usr/bin/git', PROBE_END_MARKER].join('\n')

function fakeExecFile() {
  const calls: Array<{ file: string; args: string[]; options: ProbeInvocation['options'] }> = []
  const impl: ProbeExecFile = (file, args, options, cb) => {
    calls.push({ file, args, options })
    queueMicrotask(() => cb(null, args[0] === '-l' ? LOGIN_OK : SERVER_OK, ''))
    return { stdin: { end: () => {} } }
  }
  return { impl, calls }
}

const HOST_ENV: NodeJS.ProcessEnv = {
  PATH: '/usr/bin:/bin',
  HOME: '/home/u',
  SHELL: '/bin/bash',
  BAT_REMOTE_TOKEN: 'secret-token',
  bat_helper_dir: '/opt/bat',
  BAT_TOWER_TERMINAL_ID: 'tower',
}

describe('remote-tools:detect (shared module)', () => {
  it('registers exactly remote-tools:detect', () => {
    const channels: string[] = []
    registerRemoteToolsHandlers(channel => { channels.push(channel) }, { isScrubbedEnvKey: () => false })
    expect(channels).toEqual([REMOTE_TOOLS_DETECT_CHANNEL])
    expect(REMOTE_TOOLS_DETECT_CHANNEL).toBe('remote-tools:detect')
  })

  it('Windows host → host-platform, no spawn', async () => {
    const { impl, calls } = fakeExecFile()
    const r = await runRemoteToolsDetect({ isScrubbedEnvKey: isHeadlessScrubbedEnvKey, platform: 'win32', execFile: impl })
    expect(r).toMatchObject({ ok: false, errorCode: 'host-platform' })
    expect(calls).toEqual([])
  })

  it('POSIX host → report; both probes get the scrubbed env (no BAT_*)', async () => {
    const { impl, calls } = fakeExecFile()
    const r = await runRemoteToolsDetect({
      isScrubbedEnvKey: isHeadlessScrubbedEnvKey,
      platform: 'linux',
      execFile: impl,
      getEnv: () => HOST_ENV,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.report.schemaVersion).toBe(1)
    expect(r.report.tools.find(t => t.id === 'git')).toMatchObject({ status: 'ok', version: '2.43.0', serverVisible: true })
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.options.env).toEqual({ PATH: '/usr/bin:/bin', HOME: '/home/u', SHELL: '/bin/bash' })
      expect(call.options.timeout).toBeGreaterThan(0)
    }
    expect(calls.map(c => c.file).sort()).toEqual(['/bin/bash', '/bin/sh'])
  })

  it('the registered handler runs the same detection', async () => {
    const { impl } = fakeExecFile()
    let handler: ((...args: unknown[]) => unknown) | undefined
    registerRemoteToolsHandlers((_channel, h) => { handler = h }, {
      isScrubbedEnvKey: isHeadlessScrubbedEnvKey, platform: 'darwin', execFile: impl, getEnv: () => HOST_ENV,
    })
    const r = await handler?.({}) as RemoteToolsDetectResult
    expect(r.ok).toBe(true)
  })

  it('login shell: $SHELL, else passwd shell, else selectLoginShell fallback', async () => {
    expect(resolveProbeShell({ SHELL: '/usr/bin/zsh' }, () => '/bin/bash')).toBe('/usr/bin/zsh')
    expect(resolveProbeShell({}, () => '/bin/ksh')).toBe('/bin/ksh')
    expect(resolveProbeShell({}, () => undefined)).toBeUndefined()

    const { impl, calls } = fakeExecFile()
    await runRemoteToolsDetect({
      isScrubbedEnvKey: isHeadlessScrubbedEnvKey, platform: 'linux', execFile: impl,
      getEnv: () => ({ PATH: '/bin', SHELL: '/bin/evil;rm' }),
    })
    // selectLoginShell rejects the candidate → /bin/sh for the login view too
    expect(calls.map(c => c.file)).toEqual(['/bin/sh', '/bin/sh'])
  })

  it('buildProbeEnv drops scrubbed keys and undefined values', () => {
    expect(buildProbeEnv({ A: '1', BAT_X: '2', B: undefined }, isHeadlessScrubbedEnvKey)).toEqual({ A: '1' })
  })
})

// ── local short connection ────────────────────────────────────────────────────

const REMOTE_PROFILE: RemoteToolsProfileTarget & { id: string } = {
  id: 'wsl-1',
  type: 'remote',
  remoteHost: '127.0.0.1',
  remotePort: 9877,
  remoteToken: 'tok',
  remoteFingerprint: 'AA:BB',
}

const OK_RESULT: RemoteToolsDetectResult = {
  ok: true,
  report: {
    schemaVersion: 1,
    env: {
      osFamily: 'linux', musl: false, pkgManager: 'apt', privilege: 'passwordless', isWsl: true, hasTimeout: true,
      authEnv: { ANTHROPIC_API_KEY: false, CLAUDE_CODE_OAUTH_TOKEN: false, OPENAI_API_KEY: false, GH_TOKEN: false, GITHUB_TOKEN: false },
    },
    tools: [],
    serverViewAvailable: true,
    warnings: [],
  },
}

function mockClient(opts: {
  connect?: () => Promise<{ ok: boolean; error?: string; errorCode?: string }>
  invoke?: () => Promise<unknown>
} = {}) {
  const client = {
    connect: vi.fn(opts.connect ?? (async () => ({ ok: true }))),
    invoke: vi.fn(opts.invoke ?? (async () => OK_RESULT)),
    disconnect: vi.fn(async () => {}),
  } satisfies RemoteToolsDetectClient
  return client
}

function deps(client: RemoteToolsDetectClient, profile: (RemoteToolsProfileTarget & { id: string }) | null = REMOTE_PROFILE) {
  return {
    getProfile: vi.fn(async (id: string) => (profile && profile.id === id ? profile : null)),
    createClient: vi.fn(() => client),
    detectLocal: vi.fn(async (): Promise<RemoteToolsDetectResult> => ({ ok: false, errorCode: 'host-platform', error: 'local' })),
  }
}

describe('detectRemoteToolsForProfile (remote:detect-tools)', () => {
  it('rejects a malformed profileId before any lookup', async () => {
    for (const bad of [undefined, 42, '', '../etc', 'a b', 'x;rm']) {
      const client = mockClient()
      const d = deps(client)
      expect(await detectRemoteToolsForProfile(bad, d)).toMatchObject({ ok: false, errorCode: 'invalid-profile' })
      expect(d.getProfile).not.toHaveBeenCalled()
      expect(d.createClient).not.toHaveBeenCalled()
    }
  })

  it('unknown profile → invalid-profile', async () => {
    const d = deps(mockClient())
    expect(await detectRemoteToolsForProfile('nope', d)).toMatchObject({ ok: false, errorCode: 'invalid-profile', error: 'Profile not found: nope' })
  })

  it('remote profile without a pinned fingerprint is refused without connecting', async () => {
    const d = deps(mockClient(), { ...REMOTE_PROFILE, remoteFingerprint: undefined })
    expect(await detectRemoteToolsForProfile('wsl-1', d)).toMatchObject({ ok: false, errorCode: 'invalid-profile' })
    expect(d.createClient).not.toHaveBeenCalled()
  })

  it('local profile → this host’s detection', async () => {
    const d = deps(mockClient(), { id: 'default', type: 'local' })
    expect(await detectRemoteToolsForProfile('default', d)).toEqual({ ok: false, errorCode: 'host-platform', error: 'local' })
    expect(d.detectLocal).toHaveBeenCalledOnce()
    expect(d.createClient).not.toHaveBeenCalled()
  })

  it('success: connects with the stored profile parameters, invokes, disconnects', async () => {
    const client = mockClient()
    const d = deps(client)
    expect(await detectRemoteToolsForProfile('wsl-1', d)).toEqual(OK_RESULT)
    expect(d.createClient).toHaveBeenCalledWith(REMOTE_PROFILE)
    expect(client.connect).toHaveBeenCalledWith('127.0.0.1', 9877, 'tok', undefined, 'AA:BB')
    expect(client.invoke).toHaveBeenCalledWith('remote-tools:detect', [], expect.any(Number))
    expect(client.disconnect).toHaveBeenCalledOnce()
  })

  it('server-side error results pass through', async () => {
    const client = mockClient({ invoke: async () => ({ ok: false, errorCode: 'timeout', error: 'probe timed out after 20000 ms' }) })
    expect(await detectRemoteToolsForProfile('wsl-1', deps(client))).toEqual({ ok: false, errorCode: 'timeout', error: 'probe timed out after 20000 ms' })
  })

  it('missing port defaults to 9876', async () => {
    const client = mockClient()
    await detectRemoteToolsForProfile('wsl-1', deps(client, { ...REMOTE_PROFILE, remotePort: undefined }))
    expect(client.connect).toHaveBeenCalledWith('127.0.0.1', 9876, 'tok', undefined, 'AA:BB')
  })

  it('connection failure → connect-failed (with the client error code); no invoke', async () => {
    const client = mockClient({ connect: async () => ({ ok: false, error: 'Fingerprint mismatch', errorCode: 'fingerprint-mismatch' }) })
    expect(await detectRemoteToolsForProfile('wsl-1', deps(client))).toEqual({
      ok: false, errorCode: 'connect-failed', error: 'Fingerprint mismatch [fingerprint-mismatch]',
    })
    expect(client.invoke).not.toHaveBeenCalled()
    expect(client.disconnect).toHaveBeenCalledOnce()
  })

  it('connect throwing → connect-failed', async () => {
    const client = mockClient({ connect: async () => { throw new Error('ssh tunnel failed') } })
    expect(await detectRemoteToolsForProfile('wsl-1', deps(client))).toEqual({ ok: false, errorCode: 'connect-failed', error: 'ssh tunnel failed' })
    expect(client.disconnect).toHaveBeenCalledOnce()
  })

  it('old server (No handler for channel) → server-too-old', async () => {
    const client = mockClient({ invoke: async () => { throw new Error('No handler for channel: remote-tools:detect') } })
    const r = await detectRemoteToolsForProfile('wsl-1', deps(client))
    expect(r).toMatchObject({ ok: false, errorCode: 'server-too-old' })
    expect(!r.ok && r.error).toContain('No handler for channel: remote-tools:detect')
    expect(client.disconnect).toHaveBeenCalledOnce()
  })

  it('other invoke failures and malformed answers → invoke-failed', async () => {
    const timeout = mockClient({ invoke: async () => { throw new Error('Remote invoke timeout: remote-tools:detect') } })
    expect(await detectRemoteToolsForProfile('wsl-1', deps(timeout))).toEqual({ ok: false, errorCode: 'invoke-failed', error: 'Remote invoke timeout: remote-tools:detect' })

    const otherNoHandler = mockClient({ invoke: async () => { throw new Error('No handler for channel: something-else') } })
    expect(await detectRemoteToolsForProfile('wsl-1', deps(otherNoHandler))).toMatchObject({ ok: false, errorCode: 'invoke-failed' })

    for (const answer of [null, 'x', { ok: true }, { ok: true, report: { schemaVersion: 2 } }, { ok: false }]) {
      const client = mockClient({ invoke: async () => answer })
      expect(await detectRemoteToolsForProfile('wsl-1', deps(client))).toMatchObject({ ok: false, errorCode: 'invoke-failed' })
      expect(client.disconnect).toHaveBeenCalledOnce()
    }
  })

  it('a throwing disconnect does not mask the result', async () => {
    const client = mockClient()
    client.disconnect.mockRejectedValueOnce(new Error('already closed'))
    expect(await detectRemoteToolsForProfile('wsl-1', deps(client))).toEqual(OK_RESULT)
  })
})

describe('asRemoteToolsDetectResult', () => {
  it('accepts schema v1 reports and well-formed errors only', () => {
    expect(asRemoteToolsDetectResult(OK_RESULT)).toBe(OK_RESULT)
    expect(asRemoteToolsDetectResult({ ok: false, errorCode: 'no-markers', error: 'e' })).toEqual({ ok: false, errorCode: 'no-markers', error: 'e' })
    expect(asRemoteToolsDetectResult({ ok: true, report: null })).toBeNull()
    expect(asRemoteToolsDetectResult({ ok: false, errorCode: 1, error: 'e' })).toBeNull()
  })
})
