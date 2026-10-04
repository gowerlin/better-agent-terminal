/**
 * T0384 (BUG-092, D128): WSL keep-alive holder lifecycle — one
 * `wsl.exe -d <distro> -- sleep infinity` per wanted distro, backoff restart,
 * kill on quit, Windows only. spawn is injected; timers are faked.
 */
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WslKeepAlive } from '../wsl-keepalive'

class FakeChild extends EventEmitter {
  static nextPid = 1000
  pid = FakeChild.nextPid++
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  kill = vi.fn(() => {
    this.signalCode = 'SIGTERM'
    this.emit('exit', null, 'SIGTERM')
    return true
  })

  /** Simulate the holder dying on its own (distro shut down, wsl.exe crash). */
  die(code = 1): void {
    this.exitCode = code
    this.emit('exit', code, null)
  }
}

interface SpawnCall {
  command: string
  args: readonly string[]
  options: Record<string, unknown>
  child: FakeChild
}

let calls: SpawnCall[]
let logger: { log: ReturnType<typeof vi.fn<(message: string) => void>>; error: ReturnType<typeof vi.fn<(message: string) => void>> }

function fakeSpawn(command: string, args: readonly string[], options: Record<string, unknown>): ChildProcess {
  const child = new FakeChild()
  calls.push({ command, args, options, child })
  return child as unknown as ChildProcess
}

function make(overrides: Partial<ConstructorParameters<typeof WslKeepAlive>[0]> = {}): WslKeepAlive {
  return new WslKeepAlive({
    platform: 'win32',
    spawn: fakeSpawn as never,
    logger,
    backoffMs: [100, 200, 400],
    stableMs: 10_000,
    ...overrides,
  })
}

function spawnsFor(distro: string): SpawnCall[] {
  return calls.filter((c) => c.args[1] === distro)
}

beforeEach(() => {
  vi.useFakeTimers()
  calls = []
  logger = { log: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('WslKeepAlive (T0384 / BUG-092)', () => {
  it('spawns one hidden `wsl.exe -d <distro> -- sleep infinity` per profile distro', () => {
    const ka = make()
    ka.sync(['Ubuntu-24.04'])

    expect(calls).toHaveLength(1)
    expect(calls[0].command).toBe('wsl.exe')
    expect(calls[0].args).toEqual(['-d', 'Ubuntu-24.04', '--', 'sleep', 'infinity'])
    expect(calls[0].options).toMatchObject({ windowsHide: true, stdio: 'ignore' })
    expect(ka.activeDistros()).toEqual(['Ubuntu-24.04'])
  })

  it('never holds the same distro twice (duplicate profiles, repeated sync, pin on top of a profile)', () => {
    const ka = make()
    ka.sync(['Ubuntu-24.04', 'Ubuntu-24.04'])
    ka.sync(['Ubuntu-24.04'])
    ka.pin('Ubuntu-24.04')
    ka.pin('Ubuntu-24.04')

    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(1)
  })

  it('stops the holder when the last profile using the distro is deleted', () => {
    const ka = make()
    ka.sync(['Ubuntu-24.04', 'Debian'])
    const ubuntu = spawnsFor('Ubuntu-24.04')[0].child

    ka.sync(['Debian'])

    expect(ubuntu.kill).toHaveBeenCalledTimes(1)
    expect(ka.activeDistros()).toEqual(['Debian'])
    // A deliberate stop must not trigger a backoff restart.
    vi.advanceTimersByTime(60_000)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(1)
  })

  it('keeps a wizard-pinned distro across profile syncs and stops it on unpin', () => {
    const ka = make()
    ka.pin('Ubuntu-24.04')
    ka.sync([])
    expect(ka.activeDistros()).toEqual(['Ubuntu-24.04'])

    ka.unpin('Ubuntu-24.04')
    expect(spawnsFor('Ubuntu-24.04')[0].child.kill).toHaveBeenCalledTimes(1)
    expect(ka.activeDistros()).toEqual([])
  })

  it('unpin keeps the holder while a profile still uses the distro', () => {
    const ka = make()
    ka.pin('Ubuntu-24.04')
    ka.sync(['Ubuntu-24.04'])
    ka.unpin('Ubuntu-24.04')

    expect(spawnsFor('Ubuntu-24.04')[0].child.kill).not.toHaveBeenCalled()
    expect(ka.activeDistros()).toEqual(['Ubuntu-24.04'])
  })

  it('restarts an unexpectedly ended holder with backoff, then gives up at the cap', () => {
    const ka = make()
    ka.sync(['Ubuntu-24.04'])

    spawnsFor('Ubuntu-24.04')[0].child.die()
    expect(ka.activeDistros()).toEqual([])
    vi.advanceTimersByTime(99)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(2)

    spawnsFor('Ubuntu-24.04')[1].child.die()
    vi.advanceTimersByTime(200)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(3)

    spawnsFor('Ubuntu-24.04')[2].child.die()
    vi.advanceTimersByTime(400)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(4)

    // Fourth fast failure exceeds the 3-entry backoff list → give up, no spam.
    spawnsFor('Ubuntu-24.04')[3].child.die()
    vi.advanceTimersByTime(600_000)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(4)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('giving up on Ubuntu-24.04'))

    // A later profile change / wizard pin is a fresh reason to try again.
    ka.sync(['Ubuntu-24.04'])
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(5)
  })

  it('treats a spawn error event (wsl.exe missing) like an exit and backs off', () => {
    const ka = make()
    ka.sync(['Ubuntu-24.04'])
    const child = spawnsFor('Ubuntu-24.04')[0].child
    child.emit('error', Object.assign(new Error('spawn wsl.exe ENOENT'), { code: 'ENOENT' }))
    child.emit('exit', -2, null) // must not double-schedule

    vi.advanceTimersByTime(100)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(2)
    vi.advanceTimersByTime(10_000)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(2)
  })

  it('resets the attempt counter after a holder ran longer than stableMs', () => {
    const ka = make()
    ka.sync(['Ubuntu-24.04'])
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(10_000) // each run lasts stableMs → counts as healthy
      spawnsFor('Ubuntu-24.04')[i].child.die()
      vi.advanceTimersByTime(100) // always the first backoff step
    }
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(7)
    expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('giving up'))
  })

  it('does not restart a holder whose distro is no longer wanted when the backoff fires', () => {
    const ka = make()
    ka.sync(['Ubuntu-24.04'])
    spawnsFor('Ubuntu-24.04')[0].child.die()
    ka.sync([])
    vi.advanceTimersByTime(10_000)
    expect(spawnsFor('Ubuntu-24.04')).toHaveLength(1)
  })

  it('stopAll kills every holder, cancels pending restarts and refuses new holders', () => {
    const ka = make()
    ka.sync(['Ubuntu-24.04', 'Debian'])
    ka.pin('Alpine')
    spawnsFor('Debian')[0].child.die() // Debian is waiting on a backoff timer

    ka.stopAll()

    expect(spawnsFor('Ubuntu-24.04')[0].child.kill).toHaveBeenCalledTimes(1)
    expect(spawnsFor('Alpine')[0].child.kill).toHaveBeenCalledTimes(1)
    expect(ka.activeDistros()).toEqual([])
    vi.advanceTimersByTime(600_000)
    ka.sync(['Ubuntu-24.04'])
    ka.pin('Ubuntu-24.04')
    expect(calls).toHaveLength(3)
    ka.stopAll() // idempotent
  })

  it('is a no-op off Windows', () => {
    const ka = make({ platform: 'linux' })
    ka.sync(['Ubuntu-24.04'])
    ka.pin('Ubuntu-24.04')
    expect(calls).toHaveLength(0)
    expect(ka.activeDistros()).toEqual([])
  })

  it('rejects distro names outside the whitelist', () => {
    const ka = make()
    expect(() => ka.pin('Ubuntu; rm -rf /')).toThrow(/Invalid WSL distro name/)
    expect(() => ka.pin('')).toThrow(/Invalid WSL distro name/)
    ka.sync(['bad name', '$(whoami)', 'Ubuntu-24.04'])

    expect(calls.map((c) => c.args[1])).toEqual(['Ubuntu-24.04'])
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid WSL distro name'))
  })

  it('backs off when spawn itself throws', () => {
    let throws = true
    const ka = make({
      spawn: ((command: string, args: readonly string[], options: Record<string, unknown>) => {
        if (throws) throw new Error('EPERM')
        return fakeSpawn(command, args, options)
      }) as never,
    })
    ka.sync(['Ubuntu-24.04'])
    expect(ka.activeDistros()).toEqual([])
    throws = false
    vi.advanceTimersByTime(100)
    expect(ka.activeDistros()).toEqual(['Ubuntu-24.04'])
  })
})
