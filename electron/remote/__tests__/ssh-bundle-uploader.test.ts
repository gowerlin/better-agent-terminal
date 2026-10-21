// @vitest-environment node
/**
 * T0681 (BUG-168, D177): `uploadServerBundle` streaming, failure and input
 * guards, carried over from tests/ssh-bundle-uploader.test.ts. The install
 * root is absolute (T0552 / BUG-139: `~` and one-segment roots are rejected,
 * see ssh-bundle-layout-and-port.test.ts). ssh, the tarball stream and stat are
 * injected; nothing is spawned or read.
 */
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import type { ReadStream } from 'fs'
import { Readable, Writable } from 'stream'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import { uploadServerBundle, type UploaderDeps, type UploadOptions } from '../ssh-bundle-uploader'

type FakeProc = EventEmitter & { stdin: Writable; stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean }

/**
 * ssh mock: swallows stdin; once the tarball stream ends, `finish` decides how
 * the process exits. Records the argv of every spawn.
 */
function makeDeps(opts: {
  chunks: Buffer[]
  size: number
  finish?: (proc: FakeProc) => void
}): Required<UploaderDeps> & { calls: string[][] } {
  const calls: string[][] = []
  const stream = Readable.from(opts.chunks)
  const finish = opts.finish ?? ((proc) => proc.emit('exit', 0))
  return {
    calls,
    spawn: (_command, args) => {
      calls.push([...args])
      const proc = new EventEmitter() as FakeProc
      proc.stdin = new Writable({ write: (_chunk, _encoding, cb) => cb() })
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.kill = () => true
      stream.on('end', () => setImmediate(() => finish(proc)))
      return proc as unknown as ChildProcess
    },
    createReadStream: () => stream as unknown as ReadStream,
    stat: async () => ({ size: opts.size }),
  }
}

const base: UploadOptions = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  installPath: '/home/alice/.local/bat-server',
  tarballPath: 'C:\\Users\\demo\\bat-server-linux-x64.tar.gz',
}

describe('uploadServerBundle (T0681, from tests/ssh-bundle-uploader.test.ts)', () => {
  it('streams the whole tarball through one ssh exec; progress walks 0 → total', async () => {
    const chunks = [Buffer.alloc(100, 1), Buffer.alloc(150, 2), Buffer.alloc(50, 3)]
    const total = 300
    const deps = makeDeps({ chunks, size: total })
    const progress: Array<[number, number]> = []
    await uploadServerBundle(base, (sent, t) => progress.push([sent, t]), deps)

    expect(deps.calls).toHaveLength(1)
    expect(progress[0]).toEqual([0, total])
    expect(progress[progress.length - 1]).toEqual([total, total])
    for (let i = 1; i < progress.length; i += 1) {
      expect(progress[i][0]).toBeGreaterThanOrEqual(progress[i - 1][0])
    }
  })

  it('rejects with the ssh stderr when the remote command fails', async () => {
    const deps = makeDeps({
      chunks: [Buffer.alloc(50)],
      size: 50,
      finish: (proc) => {
        proc.stderr.emit('data', Buffer.from('tar: gzip: command not found\n'))
        proc.emit('exit', 127)
      },
    })
    await expect(uploadServerBundle(base, () => undefined, deps))
      .rejects.toThrow(/Server bundle upload failed: tar: gzip: command not found/)
  })

  it('keeps reporting the stat size as the total even when the stream is longer', async () => {
    const deps = makeDeps({ chunks: [Buffer.alloc(150)], size: 100 })
    const totals: number[] = []
    await uploadServerBundle(base, (_sent, t) => totals.push(t), deps)
    expect(totals.length).toBeGreaterThan(0)
    expect(new Set(totals)).toEqual(new Set([100]))
  })

  it('ssh argv carries -o BatchMode=yes (T0296 EC-003)', async () => {
    const deps = makeDeps({ chunks: [Buffer.alloc(10)], size: 10 })
    await uploadServerBundle(base, () => undefined, deps)
    const argv = deps.calls[0]
    const index = argv.indexOf('BatchMode=yes')
    expect(index).toBeGreaterThan(0)
    expect(argv[index - 1]).toBe('-o')
  })

  it.each([
    ['a single quote in installPath', { installPath: "/opt/bad'path/bat-server" }, /installPath contains forbidden character/],
    ['a \\r in installPath (T0296 EC-002)', { installPath: '/home/alice/.local/bat\rserver' }, /forbidden control char/],
    ['an sshHost starting with - (T0296 F-004)', { sshHost: '-oProxyCommand=evil.sh' }, /sshHost.*cannot start with '-'/],
  ])('rejects %s before spawning ssh', async (_label, override, message) => {
    const deps = makeDeps({ chunks: [Buffer.alloc(10)], size: 10 })
    await expect(uploadServerBundle({ ...base, ...override }, () => undefined, deps)).rejects.toThrow(message)
    expect(deps.calls).toHaveLength(0)
  })
})
