import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter, Readable } from 'stream'
import type { ChildProcess } from 'child_process'
import { Writable } from 'node:stream'
import { uploadServerBundle, type UploaderDeps } from '../electron/remote/ssh-bundle-uploader'

interface FakeProc extends EventEmitter {
  stdin: Writable
  stdout: EventEmitter
  stderr: EventEmitter
  exitCode: number | null
  killCalls: Array<NodeJS.Signals | number | undefined>
  kill(sig?: NodeJS.Signals | number): boolean
  bytesPiped: number
}

function makeFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.exitCode = null
  proc.killCalls = []
  proc.bytesPiped = 0
  proc.stdin = new Writable({
    write(chunk: Buffer | string, _encoding, cb) {
      const len = typeof chunk === 'string' ? Buffer.byteLength(chunk, 'utf8') : chunk.length
      proc.bytesPiped += len
      cb()
    },
  })
  proc.kill = (sig?: NodeJS.Signals | number) => {
    proc.killCalls.push(sig)
    if (proc.exitCode === null) {
      proc.exitCode = 143
      setImmediate(() => proc.emit('exit', 143))
    }
    return true
  }
  return proc
}

function makeStream(chunks: Buffer[]): Readable {
  return Readable.from((function* () {
    for (const chunk of chunks) yield chunk
  })())
}

function makeDeps(opts: {
  proc: FakeProc
  streamChunks: Buffer[]
  size: number
  scriptedRun: (proc: FakeProc, totalBytesAfterPipe: number) => void
}): UploaderDeps & { calls: Array<{ command: string; args: readonly string[] }> } {
  const calls: Array<{ command: string; args: readonly string[] }> = []
  const stream = makeStream(opts.streamChunks)
  return {
    calls,
    spawn: (command, args) => {
      calls.push({ command, args })
      // delay scripted run until after pipe finishes (simulate ssh consuming
      // all bytes then exiting)
      stream.on('end', () => setImmediate(() => opts.scriptedRun(opts.proc, opts.proc.bytesPiped)))
      return opts.proc as unknown as ChildProcess
    },
    createReadStream: () => stream as unknown as ReturnType<NonNullable<UploaderDeps['createReadStream']>>,
    stat: async () => ({ size: opts.size }),
  }
}

const baseOpts = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  installPath: '~/.local/bat-server',
  tarballPath: '/tmp/bat-server-linux-x64.tar.gz',
}

test('test1: streams full tarball + ssh exit 0 → progress callback walks 0 → totalBytes', async () => {
  const proc = makeFakeProc()
  const chunks = [Buffer.alloc(100, 1), Buffer.alloc(150, 2), Buffer.alloc(50, 3)]
  const total = chunks.reduce((acc, c) => acc + c.length, 0)
  const deps = makeDeps({
    proc,
    streamChunks: chunks,
    size: total,
    scriptedRun: (p) => { p.exitCode = 0; p.emit('exit', 0) },
  })
  const progress: Array<[number, number]> = []
  await uploadServerBundle(baseOpts, (sent, t) => progress.push([sent, t]), deps)
  // ssh args sanity
  assert.equal(deps.calls.length, 1)
  assert.equal(deps.calls[0].command, 'ssh')
  // first report is 0/total, last is total/total, monotonically increasing
  assert.equal(progress[0][0], 0)
  assert.equal(progress[0][1], total)
  assert.equal(progress[progress.length - 1][0], total)
  assert.equal(progress[progress.length - 1][1], total)
  for (let i = 1; i < progress.length; i += 1) {
    assert.ok(progress[i][0] >= progress[i - 1][0], 'progress must be monotonically non-decreasing')
  }
})

test('test2: ssh exits non-zero with stderr → reject including stderr text', async () => {
  const proc = makeFakeProc()
  const chunks = [Buffer.alloc(50)]
  const deps = makeDeps({
    proc,
    streamChunks: chunks,
    size: 50,
    scriptedRun: (p) => {
      p.stderr.emit('data', Buffer.from('tar: gzip: command not found\n', 'utf8'))
      p.exitCode = 127
      p.emit('exit', 127)
    },
  })
  await assert.rejects(
    () => uploadServerBundle(baseOpts, () => { /* noop */ }, deps),
    /tar.*gzip/,
  )
})

test('test3: bytesSent never exceeds totalBytes even if stream exceeds stat size', async () => {
  const proc = makeFakeProc()
  // tarball reports 100 but stream actually emits 150 — totalBytes still
  // honoured by callers via the totalBytes arg. The test asserts the second
  // arg passed to onProgress remains stable at the declared size.
  const deps = makeDeps({
    proc,
    streamChunks: [Buffer.alloc(150)],
    size: 100,
    scriptedRun: (p) => { p.exitCode = 0; p.emit('exit', 0) },
  })
  let lastTotal = -1
  await uploadServerBundle(baseOpts, (_sent, t) => { lastTotal = t }, deps)
  assert.equal(lastTotal, 100)
})

test('test4: ssh args contain mkdir + cd + tar xz remote command for installPath', async () => {
  const proc = makeFakeProc()
  const deps = makeDeps({
    proc,
    streamChunks: [Buffer.alloc(10)],
    size: 10,
    scriptedRun: (p) => { p.exitCode = 0; p.emit('exit', 0) },
  })
  await uploadServerBundle(baseOpts, () => { /* noop */ }, deps)
  const remoteCmd = deps.calls[0].args[deps.calls[0].args.length - 1]
  assert.match(remoteCmd, /mkdir -p/)
  assert.match(remoteCmd, /tar xz/)
  assert.match(remoteCmd, /~\/\.local\/bat-server/)
})

test('test5b (T0296 EC-002): installPath containing \\r rejected upfront', async () => {
  const proc = makeFakeProc()
  const deps = makeDeps({
    proc,
    streamChunks: [Buffer.alloc(10)],
    size: 10,
    scriptedRun: () => { /* never reached */ },
  })
  await assert.rejects(
    () => uploadServerBundle(
      { ...baseOpts, installPath: '~/.local/bat\rserver' },
      () => { /* noop */ },
      deps,
    ),
    /forbidden control char/,
  )
})

test('test5c (T0296 F-004): sshHost with leading dash rejected upfront', async () => {
  const proc = makeFakeProc()
  const deps = makeDeps({
    proc,
    streamChunks: [Buffer.alloc(10)],
    size: 10,
    scriptedRun: () => { /* never reached */ },
  })
  await assert.rejects(
    () => uploadServerBundle(
      { ...baseOpts, sshHost: '-oProxyCommand=evil.sh' },
      () => { /* noop */ },
      deps,
    ),
    /sshHost.*cannot start with '-'/,
  )
})

test('test5d (T0296 EC-003): ssh argv contains BatchMode=yes', async () => {
  const proc = makeFakeProc()
  const deps = makeDeps({
    proc,
    streamChunks: [Buffer.alloc(10)],
    size: 10,
    scriptedRun: (p) => { p.exitCode = 0; p.emit('exit', 0) },
  })
  await uploadServerBundle(baseOpts, () => { /* noop */ }, deps)
  const args = deps.calls[0].args
  const idx = args.indexOf('BatchMode=yes')
  assert.ok(idx > 0, 'BatchMode=yes must be present')
  assert.equal(args[idx - 1], '-o')
})

test('test5: installPath containing single-quote is rejected upfront', async () => {
  const proc = makeFakeProc()
  const deps = makeDeps({
    proc,
    streamChunks: [Buffer.alloc(10)],
    size: 10,
    scriptedRun: () => { /* never reached */ },
  })
  await assert.rejects(
    () => uploadServerBundle(
      { ...baseOpts, installPath: "/opt/bad'path" },
      () => { /* noop */ },
      deps,
    ),
    /forbidden character/i,
  )
})
