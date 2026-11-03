// @vitest-environment node
/**
 * T0802 / D247: the whisper availability check runs in a short-lived child process (fake execFile here):
 * args / env / timeout, every way the child can end, the startup schedule, the real load winning, IPC.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn) },
}))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import {
  buildVoiceProbeEnv,
  createVoiceAvailability,
  registerVoiceAvailabilityHandlers,
  VOICE_AVAILABILITY_DELAY_MS,
  VOICE_AVAILABILITY_TIMEOUT_MS,
  VOICE_PROBE_SCRIPT,
  type VoiceAvailabilityDeps,
  type VoiceProbeExecFile,
} from '../voice-availability'
import { LINUX_PROBE_LIBRARIES, VOICE_PROBE_MARKER } from '../../src/lib/voice-availability'
import { VOICE_IPC_CHANNELS } from '../../src/types/voice-ipc'

type Cb = Parameters<VoiceProbeExecFile>[3]
type ExecError = Parameters<Cb>[0]

interface Call { file: string; args: string[]; options: Parameters<VoiceProbeExecFile>[2]; cb: Cb }

function fakeExec(): { exec: VoiceProbeExecFile; calls: Call[] } {
  const calls: Call[] = []
  const exec: VoiceProbeExecFile = (file, args, options, cb) => { calls.push({ file, args, options, cb }); return {} }
  return { exec, calls }
}

const line = (o: unknown) => `${VOICE_PROBE_MARKER}${JSON.stringify(o)}\n`
const err = (props: Partial<NonNullable<ExecError>>): ExecError => Object.assign(new Error('child failed'), props)

function deps(over: Partial<VoiceAvailabilityDeps> = {}): VoiceAvailabilityDeps & { logs: string[] } {
  const logs: string[] = []
  let t = 1000
  return {
    platform: 'linux',
    execPath: '/opt/BAT/BetterAgentTerminal.bin',
    env: { PATH: '/usr/bin', HOME: '/home/tester' },
    homeDir: '/home/tester',
    locateAddon: () => ({ ok: true, addonPath: '/opt/BAT/resources/app.asar.unpacked/x/whisper.node' }),
    execFile: fakeExec().exec,
    now: () => (t += 10),
    setTimer: vi.fn(),
    log: (l: string) => logs.push(l),
    logs,
    ...over,
  }
}

const flush = () => new Promise(r => setTimeout(r, 0))

describe('buildVoiceProbeEnv', () => {
  it('🔴 drops BAT_* / CT_* / tokens / NODE_OPTIONS / ELECTRON_*, adds only ELECTRON_RUN_AS_NODE', () => {
    const env = buildVoiceProbeEnv({
      PATH: '/usr/bin', HOME: '/home/tester', LD_LIBRARY_PATH: '/opt/lib', SystemRoot: 'C:\\Windows',
      BAT_REMOTE_TOKEN: 'fake-cap', BAT_REMOTE_PORT: '1', bat_session: 'x', CT_MODE: 'yolo',
      GITHUB_TOKEN: 'fake-token', ANTHROPIC_API_KEY: 'fake-key', MY_SECRET: 's', DB_PASSWORD: 'p', AWS_SECRET_ACCESS_KEY: 'k',
      NODE_OPTIONS: '--require x', ELECTRON_RUN_AS_NODE: '', ELECTRON_ENABLE_LOGGING: '1', UNDEF: undefined,
    })
    expect(env).toEqual({
      PATH: '/usr/bin', HOME: '/home/tester', LD_LIBRARY_PATH: '/opt/lib', SystemRoot: 'C:\\Windows', ELECTRON_RUN_AS_NODE: '1',
    })
  })

  it('🔴 never adds LD_LIBRARY_PATH', () => {
    expect(buildVoiceProbeEnv({ PATH: '/usr/bin' })).not.toHaveProperty('LD_LIBRARY_PATH')
  })
})

describe('createVoiceAvailability', () => {
  it('starts as unknown(pending) and spawns nothing until check / the timer', () => {
    const f = fakeExec()
    const d = deps({ execFile: f.exec })
    const c = createVoiceAvailability(d)
    expect(c.get()).toEqual({ state: 'unknown', reason: 'pending' })
    c.schedule()
    expect(f.calls).toHaveLength(0)
    expect(d.setTimer).toHaveBeenCalledTimes(1)
    expect(vi.mocked(d.setTimer!).mock.calls[0][1]).toBe(VOICE_AVAILABILITY_DELAY_MS)
    c.schedule(1)
    expect(d.setTimer).toHaveBeenCalledTimes(1) // once per BAT start
    vi.mocked(d.setTimer!).mock.calls[0][0]()
    expect(f.calls).toHaveLength(1)
  })

  it('runs the binary in Node mode: -e script, addon path, Linux libraries; timeout, windowsHide, filtered env', async () => {
    const f = fakeExec()
    const c = createVoiceAvailability(deps({ execFile: f.exec, env: { PATH: '/usr/bin', BAT_REMOTE_TOKEN: 't' } }))
    void c.check()
    const call = f.calls[0]
    expect(call.file).toBe('/opt/BAT/BetterAgentTerminal.bin')
    expect(call.args).toEqual(['-e', VOICE_PROBE_SCRIPT, '/opt/BAT/resources/app.asar.unpacked/x/whisper.node', ...LINUX_PROBE_LIBRARIES])
    expect(call.options).toMatchObject({ timeout: VOICE_AVAILABILITY_TIMEOUT_MS, windowsHide: true, encoding: 'utf8' })
    expect(call.options.env).toEqual({ PATH: '/usr/bin', ELECTRON_RUN_AS_NODE: '1' })
    call.cb(null, line({ ok: true, message: '', missing: [] }), '')
  })

  it('no library list on win32 / darwin', () => {
    for (const platform of ['win32', 'darwin']) {
      const f = fakeExec()
      void createVoiceAvailability(deps({ platform, execFile: f.exec })).check()
      expect(f.calls[0].args).toHaveLength(3)
    }
  })

  it('success → available, one log line, listeners told', async () => {
    const f = fakeExec()
    const d = deps({ execFile: f.exec })
    const c = createVoiceAvailability(d)
    const seen: unknown[] = []
    c.subscribe(a => seen.push(a))
    const p = c.check()
    f.calls[0].cb(null, line({ ok: true, message: '', missing: [] }), '')
    expect(await p).toEqual({ state: 'available', source: 'probe' })
    expect(c.get()).toEqual({ state: 'available', source: 'probe' })
    expect(seen).toEqual([{ state: 'available', source: 'probe' }])
    expect(d.logs).toEqual(['[voice] availability: available in 10 ms (probe)'])
  })

  it('load failure → unavailable (glibc-too-old) and the home dir is not logged', async () => {
    const f = fakeExec()
    const d = deps({ execFile: f.exec })
    const c = createVoiceAvailability(d)
    const p = c.check()
    f.calls[0].cb(null, line({ ok: false, message: "/lib/libc.so.6: version `GLIBC_2.38' not found (required by /home/tester/x.so)", missing: [] }), '')
    expect(await p).toMatchObject({ state: 'unavailable', code: 'glibc-too-old', requiredGlibc: '2.38', detail: expect.stringContaining('~/x.so') })
    expect(d.logs[0]).toMatch(/^\[voice\] availability: unavailable\(glibc-too-old\) in \d+ ms glibc>=2\.38: /)
    expect(d.logs.join('\n')).not.toContain('/home/tester')
  })

  it('🔴 timeout / crash / spawn failure / no result → unknown', async () => {
    const cases: Array<[ExecError, string, unknown]> = [
      [err({ killed: true, signal: 'SIGTERM', code: null }), '', { state: 'unknown', reason: 'timeout' }],
      [err({ killed: false, signal: 'SIGSEGV', code: null }), '', { state: 'unknown', reason: 'crashed', detail: 'signal SIGSEGV' }],
      [err({ code: 1 }), 'oops', { state: 'unknown', reason: 'crashed', detail: 'exit code 1' }],
      [err({ code: 'ENOENT', message: 'spawn x ENOENT' }), '', { state: 'unknown', reason: 'spawn-failed', detail: 'spawn x ENOENT' }],
      [null, 'nothing useful', { state: 'unknown', reason: 'no-result' }],
    ]
    for (const [e, stdout, expected] of cases) {
      const f = fakeExec()
      const c = createVoiceAvailability(deps({ execFile: f.exec }))
      const p = c.check()
      f.calls[0].cb(e, stdout, '')
      expect(await p).toEqual(expected)
    }
  })

  it('a result line before a crash still counts', async () => {
    const f = fakeExec()
    const c = createVoiceAvailability(deps({ execFile: f.exec }))
    const p = c.check()
    f.calls[0].cb(err({ signal: 'SIGSEGV', code: null }), line({ ok: false, message: 'libgomp.so.1: cannot open shared object file: No such file or directory', missing: ['libgomp.so.1', 'libvulkan.so.1'] }), '')
    expect(await p).toMatchObject({ state: 'unavailable', code: 'missing-library', libraries: ['libgomp.so.1', 'libvulkan.so.1'] })
  })

  it('a synchronous spawn throw → unknown(spawn-failed)', async () => {
    const c = createVoiceAvailability(deps({ execFile: () => { throw new Error('EINVAL') } }))
    expect(await c.check()).toEqual({ state: 'unknown', reason: 'spawn-failed', detail: 'EINVAL' })
  })

  it('addon not found → unavailable(load-failed) without spawning', async () => {
    const f = fakeExec()
    const c = createVoiceAvailability(deps({ execFile: f.exec, locateAddon: () => ({ ok: false, error: new Error('no whisper.node for linux-arm64') }) }))
    expect(await c.check()).toMatchObject({ state: 'unavailable', code: 'load-failed', detail: 'no whisper.node for linux-arm64' })
    expect(f.calls).toHaveLength(0)
  })

  it('checks running at the same time share one child', async () => {
    const f = fakeExec()
    const c = createVoiceAvailability(deps({ execFile: f.exec }))
    const p1 = c.check()
    const p2 = c.check()
    expect(f.calls).toHaveLength(1)
    f.calls[0].cb(null, line({ ok: true, message: '', missing: [] }), '')
    expect(await p1).toBe(await p2)
    await flush()
    void c.check()
    expect(f.calls).toHaveLength(2)
  })

  it('the real load succeeding wins over an unavailable check, now and later', async () => {
    const f = fakeExec()
    const d = deps({ execFile: f.exec })
    const c = createVoiceAvailability(d)
    const p = c.check()
    f.calls[0].cb(null, line({ ok: false, message: 'weird', missing: [] }), '')
    expect((await p).state).toBe('unavailable')
    c.noteRealLoadSucceeded()
    expect(c.get()).toEqual({ state: 'available', source: 'load' })
    expect(d.logs.some(l => l.includes('real load succeeded'))).toBe(true)
    const p2 = c.check()
    f.calls[1].cb(null, line({ ok: false, message: 'weird', missing: [] }), '')
    expect(await p2).toEqual({ state: 'available', source: 'load' })
  })

  it('noteRealLoadSucceeded when already available changes nothing', () => {
    const c = createVoiceAvailability(deps())
    const seen: unknown[] = []
    c.subscribe(a => seen.push(a))
    c.noteRealLoadSucceeded()
    c.noteRealLoadSucceeded()
    expect(seen).toEqual([{ state: 'available', source: 'load' }])
  })
})

describe('VOICE_PROBE_SCRIPT', () => {
  it('only requires the addon, prints the marker line and exits; dlopens the libraries only after a failure', () => {
    expect(VOICE_PROBE_SCRIPT).toContain('require(target)')
    expect(VOICE_PROBE_SCRIPT).toContain(VOICE_PROBE_MARKER)
    expect(VOICE_PROBE_SCRIPT).toContain('process.exit(0)')
    expect(VOICE_PROBE_SCRIPT).toMatch(/if \(!r\.ok\) for \(const lib of libs\)/)
    expect(VOICE_PROBE_SCRIPT).not.toMatch(/process\.env/)
    expect(() => new Function('require', 'process', VOICE_PROBE_SCRIPT)).not.toThrow() // parses
  })
})

describe('registerVoiceAvailabilityHandlers', () => {
  beforeEach(() => handlers.clear())

  it('registers get / recheck and pushes changes to every live window', async () => {
    const send = vi.fn()
    const dead = { isDestroyed: () => true, webContents: { send: vi.fn() } }
    const live = { isDestroyed: () => false, webContents: { send } }
    registerVoiceAvailabilityHandlers(() => [live, dead] as never)
    expect(handlers.has(VOICE_IPC_CHANNELS.getAvailability)).toBe(true)
    expect(handlers.has(VOICE_IPC_CHANNELS.recheckAvailability)).toBe(true)
    expect(await handlers.get(VOICE_IPC_CHANNELS.getAvailability)!({})).toEqual({ state: 'unknown', reason: 'pending' })
    const { getVoiceAvailability } = await import('../voice-availability')
    getVoiceAvailability().noteRealLoadSucceeded()
    expect(send).toHaveBeenCalledWith(VOICE_IPC_CHANNELS.availabilityChanged, { state: 'available', source: 'load' })
    expect(dead.webContents.send).not.toHaveBeenCalled()
  })
})
