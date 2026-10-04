// @vitest-environment node
/**
 * T0411 (PLAN-037 B): `remote-tools:detect` online on headless.
 *
 * Wire-level through the T0388 harness (in-process headless + wss client). The
 * probe's execFile is a fake injected through `HeadlessServerOptions.remoteTools`
 * (the tests run on Windows, where the real probe cannot run), with
 * `platform: 'linux'` so the handler does not short-circuit to host-platform.
 *   - the client gets a schema v1 report over WS
 *   - the probe env carries none of the server's `BAT_*` (isHeadlessScrubbedEnvKey)
 *   - a server whose host is Windows answers host-platform
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { RemoteToolsDetectResult } from '../../../src/types/remote-tools'
import { HEADLESS_UNSUPPORTED } from '../headless-channel-status'
import { PROXIED_CHANNELS } from '../protocol'
import { PROBE_BEGIN_MARKER, PROBE_END_MARKER, type ProbeExecFile, type ProbeInvocation } from '../../remote-tools/probe-script'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const LOGIN_OK = [
  'bash: no job control in this shell',
  PROBE_BEGIN_MARKER,
  'env.uname_s=Linux',
  'env.arch=x86_64',
  'env.os_id=ubuntu',
  'env.pkg=apt-get',
  'env.priv=passwordless',
  'tool.git.state=found',
  'tool.git.path=/usr/bin/git',
  'tool.git.version=git version 2.43.0',
  PROBE_END_MARKER,
].join('\n')
const SERVER_OK = [PROBE_BEGIN_MARKER, 'tool.git.state=found', 'tool.git.path=/usr/bin/git', PROBE_END_MARKER].join('\n')

const calls: Array<{ file: string; args: string[]; options: ProbeInvocation['options'] }> = []
const fakeExecFile: ProbeExecFile = (file, args, options, cb) => {
  calls.push({ file, args, options })
  queueMicrotask(() => cb(null, args[0] === '-l' ? LOGIN_OK : SERVER_OK, ''))
  return { stdin: { end: () => {} } }
}

const SECRET_KEYS = ['BAT_REMOTE_TOKEN', 'BAT_HELPER_DIR', 'BAT_TOWER_TERMINAL_ID', 'bat_lowercase_secret']
const savedEnv: Record<string, string | undefined> = {}

let harness: HeadlessHarness

beforeAll(async () => {
  for (const key of SECRET_KEYS) {
    savedEnv[key] = process.env[key]
    process.env[key] = 'must-not-reach-the-probe'
  }
  harness = await startHeadlessHarness({ remoteTools: { execFile: fakeExecFile, platform: 'linux' } })
})

afterAll(async () => {
  await harness?.dispose()
  for (const key of SECRET_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

afterEach(() => {
  calls.length = 0
})

describe('remote-tools:detect on headless (T0411)', () => {
  it('is proxied and not listed unsupported', () => {
    expect(PROXIED_CHANNELS.has('remote-tools:detect')).toBe(true)
    expect(HEADLESS_UNSUPPORTED['remote-tools:detect']).toBeUndefined()
  })

  it('answers a schema v1 report over WS', async () => {
    const r = await harness.invoke('remote-tools:detect') as RemoteToolsDetectResult
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.report.schemaVersion).toBe(1)
    expect(r.report.env).toMatchObject({ osFamily: 'linux', pkgManager: 'apt', privilege: 'passwordless' })
    expect(r.report.tools.find(t => t.id === 'git')).toMatchObject({ status: 'ok', version: '2.43.0', serverVisible: true })
    expect(r.report.serverViewAvailable).toBe(true)
  })

  it('probe env carries no BAT_* from the server process', async () => {
    await harness.invoke('remote-tools:detect')
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      const env = call.options.env ?? {}
      expect(Object.keys(env).filter(k => k.toUpperCase().startsWith('BAT_'))).toEqual([])
      expect(Object.values(env)).not.toContain('must-not-reach-the-probe')
      // the rest of the server env is kept (PATH is what the server-view probe reports on)
      expect(Object.keys(env).length).toBeGreaterThan(0)
    }
  })

  it('a Windows host answers host-platform without spawning', async () => {
    const win = await startHeadlessHarness({ remoteTools: { execFile: fakeExecFile, platform: 'win32' } })
    try {
      const r = await win.invoke('remote-tools:detect') as RemoteToolsDetectResult
      expect(r).toMatchObject({ ok: false, errorCode: 'host-platform' })
      expect(calls).toEqual([])
    } finally {
      await win.dispose()
    }
  })
})
