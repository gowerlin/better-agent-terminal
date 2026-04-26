import type { ChildProcess } from 'child_process'
import type { ReadStream } from 'fs'
import { logger } from '../logger'
import { buildBaseSshArgs, buildBaseSshSpawnEnv, escapeSingleQuotesStrict } from './ssh-args'

export interface UploadOptions {
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
  installPath: string
  tarballPath: string
  /** Optional pre-known total bytes; otherwise we fs.stat. */
  totalBytes?: number
}

export type UploadProgress = (bytesSent: number, totalBytes: number) => void

type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: { stdio?: unknown; windowsHide?: boolean; env?: NodeJS.ProcessEnv },
) => ChildProcess

type CreateReadStreamFn = (path: string) => ReadStream
type StatFn = (path: string) => Promise<{ size: number }>

/**
 * Test injection point. Production uses dynamic-imported `child_process` and
 * `fs` so no shell parsing happens (D042). Tests pass mocks so no real ssh
 * subprocess fires and no real file is opened (T0285 守則 #8).
 */
export interface UploaderDeps {
  spawn?: SpawnFn
  createReadStream?: CreateReadStreamFn
  stat?: StatFn
}

function buildSshArgs(opts: UploadOptions): string[] {
  // Single-quote rejection is preserved (test5 contract: installPath with `'`
  // must throw a /forbidden character/i message). escapeSingleQuotesStrict
  // additionally rejects `\r` / `\n` / NUL / other control chars (EC-002).
  if (opts.installPath.includes("'")) {
    throw new Error(`installPath contains forbidden character: ${opts.installPath}`)
  }
  const safePath = escapeSingleQuotesStrict(opts.installPath, 'installPath')
  const remoteCommand = `mkdir -p '${safePath}' && cd '${safePath}' && tar xz`
  // user@host validation (F-004) + BatchMode/ConnectTimeout/StrictHostKeyChecking
  // prefix (EC-003) live in buildBaseSshArgs.
  const args = buildBaseSshArgs(opts)
  args.push(remoteCommand)
  return args
}

export async function uploadServerBundle(
  opts: UploadOptions,
  onProgress: UploadProgress,
  deps: UploaderDeps = {},
): Promise<void> {
  const stat = deps.stat ?? (async (p: string) => (await import('fs/promises')).stat(p))
  const createReadStream = deps.createReadStream ?? ((p: string) => {
    // dynamic require to keep this file loadable in test runners without fs cycle
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('fs').createReadStream(p) as ReadStream
  })
  const spawn = deps.spawn ?? (await import('child_process')).spawn

  const totalBytes = opts.totalBytes ?? (await stat(opts.tarballPath)).size
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    throw new Error(`Invalid tarball size: ${totalBytes}`)
  }

  const args = buildSshArgs(opts)
  const proc = spawn('ssh', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, ...buildBaseSshSpawnEnv() },
  })

  let stderr = ''
  proc.stderr?.on('data', (chunk: Buffer | string) => {
    stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  })
  // We don't strictly need stdout, but draining prevents pipe back-pressure.
  proc.stdout?.on('data', () => { /* drain */ })

  const stream = createReadStream(opts.tarballPath)
  let bytesSent = 0
  let initialReport = false

  const exitPromise = new Promise<{ code: number | null; spawnError?: Error }>((resolve) => {
    let settled = false
    proc.on('error', (err: Error) => {
      if (settled) return
      settled = true
      resolve({ code: null, spawnError: err })
    })
    proc.on('exit', (code) => {
      if (settled) return
      settled = true
      resolve({ code: code ?? 1 })
    })
  })

  const streamPromise = new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer | string) => {
      const len = typeof chunk === 'string' ? Buffer.byteLength(chunk, 'utf8') : chunk.length
      bytesSent += len
      if (!initialReport) {
        initialReport = true
        try { onProgress(0, totalBytes) } catch { /* swallow callback errors */ }
      }
      try { onProgress(bytesSent, totalBytes) } catch { /* swallow */ }
    })
    stream.on('error', (err: Error) => reject(err))
    stream.on('end', () => resolve())
    if (proc.stdin) {
      stream.pipe(proc.stdin)
    } else {
      reject(new Error('ssh subprocess has no stdin pipe'))
    }
  })

  let streamError: Error | null = null
  try {
    await streamPromise
  } catch (err) {
    streamError = err instanceof Error ? err : new Error(String(err))
    try { proc.kill('SIGTERM') } catch { /* noop */ }
  }

  const exitResult = await exitPromise

  if (streamError) {
    throw new Error(`Tarball stream failed: ${streamError.message}`)
  }
  if (exitResult.spawnError) {
    throw new Error(`ssh spawn error: ${exitResult.spawnError.message}`)
  }
  if (exitResult.code !== 0) {
    const detail = stderr.trim() || `ssh exited with code ${exitResult.code}`
    logger.warn(`[ssh-bundle-uploader] upload failed: ${detail}`)
    throw new Error(`Server bundle upload failed: ${detail}`)
  }

  // final flush in case onProgress missed the closing chunk
  if (bytesSent !== totalBytes) {
    try { onProgress(bytesSent, totalBytes) } catch { /* swallow */ }
  }
}

export const __internals = {
  buildSshArgs,
}
