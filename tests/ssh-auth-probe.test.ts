import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { probeSshAuth, type SshProbeDeps } from '../electron/remote/ssh-auth-probe'

interface FakeProc extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  exitCode: number | null
  killCalls: Array<NodeJS.Signals | number | undefined>
  kill(sig?: NodeJS.Signals | number): boolean
}

function makeFakeProc(): FakeProc {
  const ee = new EventEmitter() as FakeProc
  ee.stdout = new EventEmitter()
  ee.stderr = new EventEmitter()
  ee.exitCode = null
  ee.killCalls = []
  ee.kill = (sig?: NodeJS.Signals | number) => {
    ee.killCalls.push(sig)
    if (ee.exitCode === null) {
      ee.exitCode = 143
      setImmediate(() => ee.emit('exit', 143, sig ?? null))
    }
    return true
  }
  return ee
}

function makeSpawn(scriptedRuns: Array<(proc: FakeProc) => void>): {
  calls: Array<{ command: string; args: readonly string[] }>
  spawn: NonNullable<SshProbeDeps['spawn']>
} {
  const calls: Array<{ command: string; args: readonly string[] }> = []
  let runIdx = 0
  const spawn: NonNullable<SshProbeDeps['spawn']> = (command, args) => {
    calls.push({ command, args })
    const proc = makeFakeProc()
    const run = scriptedRuns[Math.min(runIdx, scriptedRuns.length - 1)]
    runIdx += 1
    setImmediate(() => run(proc))
    return proc as unknown as ChildProcess
  }
  return { calls, spawn }
}

const baseOpts = { sshHost: 'devbox.example', sshUser: 'alice' }

test('test1: no ssh executable on PATH → errorCode no-ssh', async () => {
  const result = await probeSshAuth(baseOpts, {
    lookupSsh: async () => null,
    spawn: () => { throw new Error('spawn must not be called when ssh missing') },
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'no-ssh')
  assert.match(result.error ?? '', /ssh executable/i)
})

test('test2: stdout BAT_AUTH_OK + Linux x86_64 + HOME=/home/alice → ok with parsed metadata', async () => {
  const { spawn } = makeSpawn([(proc) => {
    proc.stdout.emit('data', Buffer.from('BAT_AUTH_OK\nLinux x86_64\nHOME=/home/alice\n', 'utf8'))
    proc.exitCode = 0
    proc.emit('exit', 0)
  }])
  const result = await probeSshAuth(baseOpts, {
    lookupSsh: async () => '/usr/bin/ssh',
    spawn,
  })
  assert.equal(result.ok, true)
  assert.equal(result.serverPlatform, 'linux')
  assert.equal(result.serverArch, 'x86_64')
  assert.equal(result.serverHome, '/home/alice')
  assert.equal(result.sshExecPath, '/usr/bin/ssh')
})

test('test3: darwin arm64 stdout → serverPlatform darwin / serverArch arm64', async () => {
  const { spawn } = makeSpawn([(proc) => {
    proc.stdout.emit('data', Buffer.from('BAT_AUTH_OK\nDarwin arm64\nHOME=/Users/bob\n', 'utf8'))
    proc.exitCode = 0
    proc.emit('exit', 0)
  }])
  const result = await probeSshAuth(baseOpts, {
    lookupSsh: async () => '/opt/homebrew/bin/ssh',
    spawn,
  })
  assert.equal(result.ok, true)
  assert.equal(result.serverPlatform, 'darwin')
  assert.equal(result.serverArch, 'arm64')
  assert.equal(result.serverHome, '/Users/bob')
})

test('test4: stderr Permission denied → errorCode permission-denied', async () => {
  const { spawn } = makeSpawn([(proc) => {
    proc.stderr.emit('data', Buffer.from('alice@devbox.example: Permission denied (publickey).\n', 'utf8'))
    proc.exitCode = 255
    proc.emit('exit', 255)
  }])
  const result = await probeSshAuth(baseOpts, {
    lookupSsh: async () => '/usr/bin/ssh',
    spawn,
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'permission-denied')
})

test('test5: stderr Host key verification failed → errorCode host-key', async () => {
  const { spawn } = makeSpawn([(proc) => {
    proc.stderr.emit('data', Buffer.from('Host key verification failed.\n', 'utf8'))
    proc.exitCode = 255
    proc.emit('exit', 255)
  }])
  const result = await probeSshAuth(baseOpts, {
    lookupSsh: async () => '/usr/bin/ssh',
    spawn,
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'host-key')
})

test('test6: probe timeout (no exit fires within budget) → errorCode connect-timeout', async () => {
  const { spawn } = makeSpawn([(_proc) => {
    /* never resolve — let timer fire */
  }])
  const result = await probeSshAuth(baseOpts, {
    lookupSsh: async () => '/usr/bin/ssh',
    spawn,
    timeoutMs: 30,
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'connect-timeout')
})

test('test7: stdout missing BAT_AUTH_OK marker → errorCode unknown', async () => {
  const { spawn } = makeSpawn([(proc) => {
    proc.stdout.emit('data', Buffer.from('Linux x86_64\nHOME=/home/x\n', 'utf8'))
    proc.exitCode = 0
    proc.emit('exit', 0)
  }])
  const result = await probeSshAuth(baseOpts, {
    lookupSsh: async () => '/usr/bin/ssh',
    spawn,
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'unknown')
  assert.match(result.error ?? '', /BAT_AUTH_OK/i)
})

test('test8: spawn with sshPort=2222 emits -p 2222 arg, sshKeyPath emits -i', async () => {
  const { spawn, calls } = makeSpawn([(proc) => {
    proc.stdout.emit('data', Buffer.from('BAT_AUTH_OK\nLinux x86_64\nHOME=/h\n', 'utf8'))
    proc.exitCode = 0
    proc.emit('exit', 0)
  }])
  await probeSshAuth(
    { ...baseOpts, sshPort: 2222, sshKeyPath: '/home/me/.ssh/id_ed25519' },
    { lookupSsh: async () => '/usr/bin/ssh', spawn },
  )
  const args = calls[0].args
  assert.ok(args.includes('-p'))
  assert.ok(args.includes('2222'))
  assert.ok(args.includes('-i'))
  assert.ok(args.includes('/home/me/.ssh/id_ed25519'))
  assert.ok(args.includes('alice@devbox.example'))
})

test('test9 (T0296 EC-003): probe argv contains BatchMode=yes', async () => {
  const { spawn, calls } = makeSpawn([(proc) => {
    proc.stdout.emit('data', Buffer.from('BAT_AUTH_OK\nLinux x86_64\nHOME=/h\n', 'utf8'))
    proc.exitCode = 0
    proc.emit('exit', 0)
  }])
  await probeSshAuth(baseOpts, { lookupSsh: async () => '/usr/bin/ssh', spawn })
  const args = calls[0].args
  const idx = args.indexOf('BatchMode=yes')
  assert.ok(idx > 0, 'BatchMode=yes must be present in probe argv')
  assert.equal(args[idx - 1], '-o')
})

test('test10 (T0296 F-004): sshHost with leading - rejected upfront (throws before spawn)', async () => {
  await assert.rejects(
    () => probeSshAuth(
      { sshHost: '-oProxyCommand=evil.sh', sshUser: 'alice' },
      {
        lookupSsh: async () => '/usr/bin/ssh',
        spawn: () => { throw new Error('spawn must not be called when host is invalid') },
      },
    ),
    /sshHost.*cannot start with '-'/,
  )
})
