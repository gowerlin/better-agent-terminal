import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'events'
import * as net from 'net'
import type { ChildProcess } from 'child_process'
import { SshTunnel, type SshTunnelDeps, type SshTunnelOptions } from '../electron/remote/ssh-tunnel'
import { shutdownSshProcess } from '../electron/remote/ssh-process-lifecycle'

interface FakeProc extends EventEmitter {
  stderr: EventEmitter
  exitCode: number | null
  killCalls: Array<NodeJS.Signals | number | undefined>
  kill(sig?: NodeJS.Signals | number): boolean
}

function makeFakeProc(): FakeProc {
  const ee = new EventEmitter() as FakeProc
  ee.stderr = new EventEmitter()
  ee.exitCode = null
  ee.killCalls = []
  ee.kill = (sig?: NodeJS.Signals | number) => {
    ee.killCalls.push(sig)
    if (ee.exitCode === null) {
      ee.exitCode = 143
      // exit fires async, mirroring real ChildProcess behaviour
      setImmediate(() => ee.emit('exit', 143, sig ?? null))
    }
    return true
  }
  return ee
}

interface SpawnRecorder {
  calls: Array<{ command: string; args: readonly string[] }>
  proc: FakeProc
  spawn: NonNullable<SshTunnelDeps['spawn']>
}

function makeSpawnRecorder(proc: FakeProc = makeFakeProc()): SpawnRecorder {
  const calls: SpawnRecorder['calls'] = []
  const spawn: NonNullable<SshTunnelDeps['spawn']> = (command, args) => {
    calls.push({ command, args })
    return proc as unknown as ReturnType<NonNullable<SshTunnelDeps['spawn']>>
  }
  return { calls, proc, spawn }
}

function startEphemeralServer(): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer((sock) => sock.end())
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr === 'object') {
        resolve({
          port: addr.port,
          close: () => new Promise((r) => srv.close(() => r())),
        })
      } else {
        srv.close()
        reject(new Error('failed to bind ephemeral server'))
      }
    })
  })
}

const baseOpts: SshTunnelOptions = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  remotePort: 9876,
}

test('test1: start() resolves once tcp polling connects to the local port', async () => {
  const { port, close } = await startEphemeralServer()
  const recorder = makeSpawnRecorder()
  const tunnel = new SshTunnel(
    { ...baseOpts, localPort: port },
    {
      spawn: recorder.spawn,
      pollIntervalMs: 20,
      readyTimeoutMs: 2_000,
    },
  )
  try {
    const result = await tunnel.start()
    assert.equal(result.localPort, port)
    assert.equal(tunnel.isAlive(), true)
    assert.equal(recorder.calls.length, 1)
  } finally {
    await tunnel.stop()
    await close()
  }
})

test('test2: ssh exiting non-zero emits tunnel-down (not stop-induced)', async () => {
  // Make spawn return a proc that has already "died" via exit fired after start.
  const proc = makeFakeProc()
  const recorder = makeSpawnRecorder(proc)

  const tunnel = new SshTunnel(
    { ...baseOpts, localPort: 1 }, // port 1 is unreachable; we time out quickly
    {
      spawn: recorder.spawn,
      pollIntervalMs: 10,
      readyTimeoutMs: 80,
      // never connects
      createConnection: () => {
        const s = new net.Socket()
        setImmediate(() => s.emit('error', new Error('refused')))
        return s
      },
    },
  )

  let downFired = false
  tunnel.on('tunnel-down', () => { downFired = true })

  // Trigger an unsolicited ssh exit (code 255) BEFORE start() resolves/rejects.
  setImmediate(() => proc.emit('exit', 255, null))

  await assert.rejects(tunnel.start())
  // The exit listener fires synchronously on emit; downFired should be true.
  assert.equal(downFired, true, 'tunnel-down should fire on unsolicited exit')
})

test('test3: tcp polling timeout rejects start() and kills ssh', async () => {
  const proc = makeFakeProc()
  const recorder = makeSpawnRecorder(proc)
  const tunnel = new SshTunnel(
    { ...baseOpts, localPort: 1 },
    {
      spawn: recorder.spawn,
      pollIntervalMs: 25,
      readyTimeoutMs: 100,
      createConnection: () => {
        const s = new net.Socket()
        setImmediate(() => s.emit('error', new Error('refused')))
        return s
      },
    },
  )
  await assert.rejects(tunnel.start(), /timeout/)
  assert.equal(proc.killCalls.length >= 1, true, 'kill must be called on timeout')
  assert.equal(tunnel.isAlive(), false)
})

test('test4: spawn args contain the full frozen ssh option set', async () => {
  const recorder = makeSpawnRecorder()
  const tunnel = new SshTunnel(
    { ...baseOpts, localPort: 40000 },
    {
      spawn: recorder.spawn,
      pollIntervalMs: 5,
      readyTimeoutMs: 30,
      createConnection: () => {
        const s = new net.Socket()
        setImmediate(() => s.emit('connect'))
        return s
      },
    },
  )
  await tunnel.start()
  await tunnel.stop()

  const { command, args } = recorder.calls[0]
  assert.equal(command, 'ssh')
  // T0296: argv now starts with the shared connect prefix (BatchMode +
  // ConnectTimeout + StrictHostKeyChecking from EC-003 fix), then tunnel
  // extras, then `--` + user@host (F-004 fix).
  assert.deepEqual(args.slice(0, 6), [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'StrictHostKeyChecking=accept-new',
  ])
  assert.deepEqual(args.slice(6, 17), [
    '-N',
    '-L', '40000:localhost:9876',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'StreamLocalBindUnlink=yes',
  ])
  // `--` terminates ssh option parsing — F-004 defence in depth.
  assert.equal(args[args.length - 2], '--')
  // last arg is user@host
  assert.equal(args[args.length - 1], 'alice@devbox.example')
  assert.equal(args.length, 19)
})

test('test5: sshKeyPath is forwarded as -i; absent path emits no -i', () => {
  const withKey = SshTunnel.buildSpawnArgs(
    { ...baseOpts, sshKeyPath: '/home/alice/.ssh/id_ed25519' },
    50000,
  )
  assert.equal(withKey.includes('-i'), true)
  const idx = withKey.indexOf('-i')
  assert.equal(withKey[idx + 1], '/home/alice/.ssh/id_ed25519')

  const withoutKey = SshTunnel.buildSpawnArgs(baseOpts, 50000)
  assert.equal(withoutKey.includes('-i'), false)
})

test('test6: sshPort 22 is implicit; non-22 emits explicit -p', () => {
  const default22 = SshTunnel.buildSpawnArgs({ ...baseOpts, sshPort: 22 }, 50001)
  assert.equal(default22.includes('-p'), false)

  const custom = SshTunnel.buildSpawnArgs({ ...baseOpts, sshPort: 2222 }, 50001)
  const idx = custom.indexOf('-p')
  assert.equal(custom[idx + 1], '2222')
})

test('test6b (T0296 EC-003): buildSpawnArgs always emits BatchMode=yes', () => {
  const args = SshTunnel.buildSpawnArgs(baseOpts, 50000)
  const idx = args.indexOf('BatchMode=yes')
  assert.ok(idx > 0, 'BatchMode=yes must be present')
  assert.equal(args[idx - 1], '-o')
})

test('test6c (T0296 F-004): sshHost with leading - throws on buildSpawnArgs', () => {
  assert.throws(
    () => SshTunnel.buildSpawnArgs(
      { ...baseOpts, sshHost: '-oProxyCommand=evil.sh' },
      50000,
    ),
    /sshHost.*cannot start with '-'/,
  )
})

test('test7: stop() makes isAlive() return false and suppresses tunnel-down', async () => {
  const recorder = makeSpawnRecorder()
  const tunnel = new SshTunnel(
    { ...baseOpts, localPort: 40001 },
    {
      spawn: recorder.spawn,
      pollIntervalMs: 5,
      readyTimeoutMs: 30,
      createConnection: () => {
        const s = new net.Socket()
        setImmediate(() => s.emit('connect'))
        return s
      },
    },
  )
  await tunnel.start()
  let downFired = false
  tunnel.on('tunnel-down', () => { downFired = true })
  await tunnel.stop()
  // exit fires async via fake kill — wait one tick
  await new Promise((r) => setImmediate(r))
  assert.equal(tunnel.isAlive(), false)
  assert.equal(downFired, false, 'stop() must not emit tunnel-down')
})

test('test8: dynamic localPort selection yields a real free port', async () => {
  const recorder = makeSpawnRecorder()
  const tunnel = new SshTunnel(
    baseOpts, // no localPort → must be picked
    {
      spawn: recorder.spawn,
      pollIntervalMs: 5,
      readyTimeoutMs: 30,
      createConnection: () => {
        const s = new net.Socket()
        setImmediate(() => s.emit('connect'))
        return s
      },
    },
  )
  const { localPort } = await tunnel.start()
  assert.equal(localPort > 0 && localPort < 65536, true)
  // and the spawn args should reflect the picked port verbatim
  const args = recorder.calls[0].args
  const lIdx = args.indexOf('-L')
  assert.equal(args[lIdx + 1], `${localPort}:localhost:${baseOpts.remotePort}`)
  await tunnel.stop()
})

// T0299 BUG-063: stop() routes through shutdownSshProcess (SIGTERM → SIGKILL
// escalation). Proc ignores SIGTERM, exits only after SIGKILL — stop() must
// await that exit before resolving.
test('test9 (T0299 BUG-063): stop() awaits shutdownSshProcess (SIGKILL escalation)', async () => {
  const proc = new (class extends EventEmitter {
    exitCode: number | null = null
    signalCode: NodeJS.Signals | null = null
    pid = 4242
    stderr = new EventEmitter()
    killCalls: NodeJS.Signals[] = []
    kill(sig?: NodeJS.Signals | number): boolean {
      this.killCalls.push(sig as NodeJS.Signals)
      if (sig === 'SIGKILL' && this.exitCode === null) {
        setTimeout(() => { this.exitCode = 137; this.signalCode = 'SIGKILL'; this.emit('exit', 137, 'SIGKILL') }, 25)
      }
      return true
    }
  })()
  const recorder = makeSpawnRecorder(proc as unknown as FakeProc)
  const tunnel = new SshTunnel({ ...baseOpts, localPort: 40050 }, {
    spawn: recorder.spawn,
    pollIntervalMs: 5,
    readyTimeoutMs: 30,
    createConnection: () => { const s = new net.Socket(); setImmediate(() => s.emit('connect')); return s },
  })
  await tunnel.start()
  let stopResolved = false
  const p = tunnel.stop().then(() => { stopResolved = true })
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(stopResolved, false, 'stop() must not resolve before SIGKILL exit fires')
  await p
  assert.deepEqual(proc.killCalls, ['SIGTERM', 'SIGKILL'])
  assert.equal(tunnel.isAlive(), false)
})

// Keep the import linked even if the tunnel refactors away from named-import:
void shutdownSshProcess
const _t: ChildProcess | null = null
void _t
