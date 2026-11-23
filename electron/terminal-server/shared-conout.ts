/**
 * T0887 (PLAN-066, D307 / D308; research T0886): one conout Worker for the whole Terminal Server on Windows.
 *
 * `@lydell/node-pty` 1.1.0 gives every Windows PTY its own `worker_threads` Worker (`ConoutConnection`,
 * windowsConoutConnection.js) that drains the ConPTY output pipe off the main thread — about 14 MB per PTY, so a
 * Terminal Server with 10 PTYs holds ~170 MB. `WindowsPtyAgent` reads the class from the module's exports at every
 * spawn (`new windowsConoutConnection_1.ConoutConnection(term.conout)`), so replacing that export before the first
 * spawn makes every PTY use `SharedConoutConnection`: same interface (`onReady`, `connectSocket`, `dispose` with the
 * 1 s drain), but all relays run in one Worker (shared-conout-worker.cjs) that starts with the first PTY and ends
 * after the last one closes. The deadlock guard is unchanged: ConPTY's output is still drained by a Worker.
 *
 * 🔴 Only the Terminal Server installs it (server.ts); direct mode (pty-manager.ts) does not (D308 Q-B).
 * 🔴 Not win32 → `skipped:not-win32` before anything is read or required. Version ≠ 1.1.0, a class / agent of another
 * shape, or a missing Worker script → `skipped:<reason>` and node-pty is left exactly as it was.
 * 🔴 No Worker restart: a Worker that dies is logged; the PTYs it served lose their output the way they do today when
 * node-pty's own Worker dies, and the next PTY starts a new Worker.
 * Nothing happens at import time; this module does not import electron. Logs never contain PTY output.
 */
import * as fs from 'fs'
import * as path from 'path'
import { Worker } from 'worker_threads'

/** The only node-pty version the replacement was written and measured against (T0886). */
export const SHARED_CONOUT_NODE_PTY_VERSION = '1.1.0'
/** File name of the Worker script, next to this module's output (dist-electron/, or the PTY holder directory). */
export const SHARED_CONOUT_WORKER_FILE = 'shared-conout-worker.cjs'
/** node-pty's FLUSH_DATA_INTERVAL: after `dispose` the relay keeps draining this long before it closes. */
export const SHARED_CONOUT_FLUSH_DATA_INTERVAL_MS = 1000
/** windowsPtyAgent.js must read the class from the module exports at spawn time, or replacing the export does nothing. */
const AGENT_CONSTRUCTS_FROM_EXPORTS = 'new windowsConoutConnection_1.ConoutConnection('
const INSTALLED_MARK = '__batSharedConout'

export type SharedConoutResult = 'installed' | `skipped:${string}`

export interface SharedConoutOptions {
  /** Default `process.platform`. */
  platform?: NodeJS.Platform
  /** Default `<dir of this module>/shared-conout-worker.cjs` (the app.asar.unpacked copy when it exists). */
  workerScript?: string
  /** One line per event, without PTY output. Default: the server's stderr. */
  log?: (line: string) => void
  /** Starts the shared Worker (tests count / fake it). Default `new Worker(script)`. */
  createWorker?: (script: string) => SharedConoutWorker
}

/** The part of `worker_threads.Worker` this module uses. */
export interface SharedConoutWorker {
  postMessage(message: unknown): void
  terminate(): Promise<number>
  on(event: 'message', listener: (message: WorkerMessage) => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
}

/** What the Worker posts back. */
export type WorkerMessage = { type: 'ready' | 'closed'; id: number }

interface SharedWorker {
  worker: SharedConoutWorker
  conns: Map<number, SharedConoutConnectionLike>
  nextId: number
  /** true once this module ended the Worker (its exit is then expected) */
  ending: boolean
}

interface SharedConoutConnectionLike {
  fireReady(): void
}

/** Minimal stand-in for node-pty's EventEmitter2 (`event` registers a listener and returns `{ dispose }`). */
class ReadyEmitter {
  private listeners: Array<() => void> = []
  readonly event = (listener: () => void): { dispose: () => void } => {
    this.listeners.push(listener)
    return {
      dispose: () => {
        const i = this.listeners.indexOf(listener)
        if (i >= 0) this.listeners.splice(i, 1)
      },
    }
  }
  fire(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

function defaultLog(line: string): void {
  try {
    process.stderr.write(`${line}\n`)
  } catch {
    // the server's stderr may be closed; logging must never break a PTY
  }
}

/** `…\app.asar\dist-electron\x` → `…\app.asar.unpacked\dist-electron\x` when that file exists (a Worker reads real files). */
export function unpackedScriptPath(file: string, exists: (p: string) => boolean = fs.existsSync): string {
  const unpacked = file.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2')
  return unpacked !== file && exists(unpacked) ? unpacked : file
}

export type EndedPtyInputResult = 'released' | `skipped:${string}`

/**
 * T0889 (BUG-214): node-pty 1.1.0 never destroys a Windows PTY's conin socket (`WindowsPtyAgent.inSocket`, a write-only
 * `net.Socket` over the conin pipe handle): neither `kill()` nor the exit path touches it, so every tab the Terminal
 * Server closed left one active handle and one open conin handle behind until the server ended (T0889 measured 500
 * after C2; the same in the per-PTY Worker build). Call this only after the exit of a PTY that BAT itself ended
 * (kill / restart / shutdown): its process tree is gone and `Terminal._close()` already made `write` a no-op, so the
 * socket can no longer be used. Not for a PTY that exited by itself (F4: closing conin could end its conhost while
 * other console processes still use it). Not win32, or not node-pty's Windows shape → skipped, nothing touched.
 */
export function releaseEndedPtyInput(proc: unknown, platform: NodeJS.Platform = process.platform): EndedPtyInputResult {
  if (platform !== 'win32') return 'skipped:not-win32'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let socket: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket = (proc as any)?._agent?.inSocket
  } catch {
    return 'skipped:shape'
  }
  if (!socket || typeof socket.destroy !== 'function') return 'skipped:shape'
  if (socket.destroyed === true) return 'skipped:already'
  try {
    socket.destroy()
  } catch {
    return 'skipped:destroy-failed'
  }
  return 'released'
}

/**
 * Replaces node-pty's `ConoutConnection` with the shared-Worker version. `nodePtyDir` is the package directory of
 * `@lydell/node-pty` (or a function returning it, called only on win32). Call once, before the first spawn; calling
 * again after a successful install returns `installed` without changing anything.
 */
export function installSharedConout(nodePtyDir: string | (() => string), options: SharedConoutOptions = {}): SharedConoutResult {
  const platform = options.platform ?? process.platform
  if (platform !== 'win32') return 'skipped:not-win32'
  const log = options.log ?? defaultLog
  const createWorker = options.createWorker ?? ((script: string): SharedConoutWorker => new Worker(script))

  let dir: string
  let version: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let conoutModule: any
  let agentSource: string
  try {
    dir = typeof nodePtyDir === 'function' ? nodePtyDir() : nodePtyDir
    version = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version
    agentSource = fs.readFileSync(path.join(dir, 'windowsPtyAgent.js'), 'utf8')
  } catch {
    return 'skipped:load-failed'
  }
  if (version !== SHARED_CONOUT_NODE_PTY_VERSION) return `skipped:version-${String(version)}`
  if (!agentSource.includes(AGENT_CONSTRUCTS_FROM_EXPORTS)) return 'skipped:agent-shape'
  try {
    // same file windowsPtyAgent.js requires ('./windowsConoutConnection'), so the same module object
    conoutModule = require(path.join(dir, 'windowsConoutConnection.js'))
  } catch {
    return 'skipped:load-failed'
  }
  const Original = conoutModule?.ConoutConnection
  if (typeof Original !== 'function') return 'skipped:shape'
  if (Original[INSTALLED_MARK] === true) return 'installed'
  const proto = Original.prototype
  const onReady = Object.getOwnPropertyDescriptor(proto, 'onReady')
  if (!onReady || typeof onReady.get !== 'function' || typeof proto.dispose !== 'function' || typeof proto.connectSocket !== 'function') {
    return 'skipped:shape'
  }

  const workerScript = unpackedScriptPath(options.workerScript ?? path.join(__dirname, SHARED_CONOUT_WORKER_FILE))
  if (!fs.existsSync(workerScript)) return 'skipped:worker-missing'

  let shared: SharedWorker | null = null

  const endShared = (s: SharedWorker): void => {
    if (shared === s) shared = null
    if (s.ending) return
    s.ending = true
    void s.worker.terminate().catch(() => {})
  }

  const getShared = (): SharedWorker => {
    if (shared) return shared
    const worker = createWorker(workerScript)
    const s: SharedWorker = { worker, conns: new Map(), nextId: 1, ending: false }
    worker.on('message', (message: WorkerMessage) => {
      if (!message || typeof message !== 'object') return
      if (message.type === 'ready') {
        s.conns.get(message.id)?.fireReady()
      } else if (message.type === 'closed') {
        s.conns.delete(message.id)
        if (s.conns.size === 0) endShared(s)
      }
    })
    worker.on('error', (err: Error) => {
      log(`[shared-conout] worker error (${(err as NodeJS.ErrnoException)?.code ?? err?.name ?? 'unknown'}); ${s.conns.size} PTY(s) lose their output`)
    })
    worker.on('exit', (code: number) => {
      if (shared === s) shared = null
      if (!s.ending) log(`[shared-conout] worker exited unexpectedly (code ${code}); ${s.conns.size} PTY(s) lose their output, the next PTY starts a new worker`)
      s.conns.clear()
    })
    shared = s
    return s
  }

  const post = (s: SharedWorker, message: unknown): void => {
    try {
      s.worker.postMessage(message)
    } catch {
      // the Worker already ended (exit is logged); nothing more to do for this PTY
    }
  }

  class SharedConoutConnection {
    static readonly [INSTALLED_MARK] = true
    private readonly shared: SharedWorker
    private readonly id: number
    private readonly ready = new ReadyEmitter()
    private isDisposed = false
    private drainTimeout: ReturnType<typeof setTimeout> | undefined

    constructor(private readonly conoutPipeName: string) {
      this.shared = getShared()
      this.id = this.shared.nextId++
      this.shared.conns.set(this.id, { fireReady: () => this.ready.fire() })
      post(this.shared, { type: 'open', id: this.id, conoutPipeName })
    }

    get onReady(): (listener: () => void) => { dispose: () => void } {
      return this.ready.event
    }

    dispose(): void {
      if (this.isDisposed) return
      this.isDisposed = true
      // drain the conout pipe for FLUSH_DATA_INTERVAL before closing the relay (node-pty's _drainDataAndClose)
      if (this.drainTimeout) clearTimeout(this.drainTimeout)
      this.drainTimeout = setTimeout(() => post(this.shared, { type: 'close', id: this.id }), SHARED_CONOUT_FLUSH_DATA_INTERVAL_MS)
    }

    connectSocket(socket: { connect: (pipe: string) => unknown }): void {
      socket.connect(`${this.conoutPipeName}-worker`)
    }
  }

  conoutModule.ConoutConnection = SharedConoutConnection
  return 'installed'
}
