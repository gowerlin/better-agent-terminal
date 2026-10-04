/**
 * T0384 (BUG-092, D128): keep WSL distros that back a BAT profile running.
 *
 * WSL shuts a distro down ~15s (`instanceIdleTimeout`) after its last
 * `wsl.exe` connection closes; since WSL 2.6.1 an active systemd user service
 * (bat-server) does not count as activity (WSL#13416). BAT therefore holds one
 * long-lived `wsl.exe -d <distro> -- sleep infinity` per distro for as long as
 * BAT itself runs. The machine-wide `.wslconfig` is never touched.
 *
 * Wanted distros come from two sources:
 *   - `sync()`: distros of the persisted WSL profiles (startup + profile edits)
 *   - `pin()`:  the setup wizard, before the profile is written
 * A holder runs while its distro is in either set. Windows only; no-op elsewhere.
 */
import * as childProcess from 'child_process'
import type { ChildProcess, SpawnOptions } from 'child_process'
import { logger } from './logger'
import { assertValidDistro } from './wsl-validate'

type SpawnLike = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess

interface KeepAliveLogger {
  log: (message: string) => void
  error: (message: string) => void
}

export interface WslKeepAliveOptions {
  platform?: NodeJS.Platform
  spawn?: SpawnLike
  logger?: KeepAliveLogger
  /** Delay before restart attempt N (1-based index into the list). Length = attempt cap. */
  backoffMs?: readonly number[]
  /** A holder that ran at least this long resets the attempt counter on exit. */
  stableMs?: number
}

// Restarts after unexpected exits: 2s, 5s, 15s, 30s, 60s, then give up until
// the next pin()/sync() (e.g. WSL missing or distro unregistered — no log spam).
const DEFAULT_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000] as const
const DEFAULT_STABLE_MS = 60_000

interface Holder {
  child: ChildProcess | null
  startedAt: number
  attempts: number
  restartTimer: ReturnType<typeof setTimeout> | null
  gaveUp: boolean
}

export class WslKeepAlive {
  private readonly platform: NodeJS.Platform
  private readonly spawnImpl: SpawnLike
  private readonly log: KeepAliveLogger
  private readonly backoffMs: readonly number[]
  private readonly stableMs: number

  private readonly holders = new Map<string, Holder>()
  private profileDistros = new Set<string>()
  private readonly pinned = new Set<string>()
  private disposed = false

  constructor(options: WslKeepAliveOptions = {}) {
    this.platform = options.platform ?? process.platform
    this.spawnImpl = options.spawn ?? (childProcess.spawn as SpawnLike)
    this.log = options.logger ?? logger
    this.backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS
    this.stableMs = options.stableMs ?? DEFAULT_STABLE_MS
  }

  private get enabled(): boolean {
    return this.platform === 'win32' && !this.disposed
  }

  /** Replace the profile-derived distro set. Invalid names are logged and skipped. */
  sync(distros: Iterable<string>): void {
    if (!this.enabled) return
    const next = new Set<string>()
    for (const distro of distros) {
      try {
        assertValidDistro(distro)
        next.add(distro)
      } catch (err) {
        this.log.error(`[wsl-keepalive] skip profile distro: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    this.profileDistros = next
    this.reconcile()
  }

  /** Hold `distro` regardless of profiles (setup wizard). Throws on an invalid name. */
  pin(distro: string): void {
    assertValidDistro(distro)
    if (!this.enabled) return
    this.pinned.add(distro)
    this.reconcile()
  }

  /** Drop the wizard pin; the holder stays if a profile still uses the distro. */
  unpin(distro: string): void {
    if (!this.enabled) return
    this.pinned.delete(distro)
    this.reconcile()
  }

  /** Distros with a running holder process. */
  activeDistros(): string[] {
    return [...this.holders.entries()].filter(([, h]) => h.child !== null).map(([d]) => d)
  }

  /** Kill every holder and refuse new ones (app quit). Safe to call repeatedly. */
  stopAll(): void {
    this.disposed = true
    for (const distro of [...this.holders.keys()]) {
      this.stop(distro)
    }
    this.pinned.clear()
    this.profileDistros.clear()
  }

  private wanted(distro: string): boolean {
    return this.profileDistros.has(distro) || this.pinned.has(distro)
  }

  private reconcile(): void {
    for (const distro of [...this.holders.keys()]) {
      if (!this.wanted(distro)) this.stop(distro)
    }
    for (const distro of new Set([...this.profileDistros, ...this.pinned])) {
      const holder = this.holders.get(distro)
      if (!holder) {
        this.start(distro)
      } else if (holder.gaveUp) {
        // An explicit pin / profile change is a fresh reason to try again.
        this.log.log(`[wsl-keepalive] retrying ${distro} after earlier give-up`)
        holder.gaveUp = false
        holder.attempts = 0
        this.spawnHolder(distro, holder)
      }
    }
  }

  private start(distro: string): void {
    const holder: Holder = { child: null, startedAt: 0, attempts: 0, restartTimer: null, gaveUp: false }
    this.holders.set(distro, holder)
    this.spawnHolder(distro, holder)
  }

  private stop(distro: string): void {
    const holder = this.holders.get(distro)
    if (!holder) return
    this.holders.delete(distro)
    if (holder.restartTimer) clearTimeout(holder.restartTimer)
    holder.restartTimer = null
    const child = holder.child
    holder.child = null
    if (child && child.exitCode === null && child.signalCode === null) {
      try {
        child.kill()
      } catch (err) {
        this.log.error(`[wsl-keepalive] kill ${distro} failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    this.log.log(`[wsl-keepalive] stopped holder for ${distro}`)
  }

  private spawnHolder(distro: string, holder: Holder): void {
    holder.restartTimer = null
    let child: ChildProcess
    try {
      child = this.spawnImpl('wsl.exe', ['-d', distro, '--', 'sleep', 'infinity'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    } catch (err) {
      this.log.error(`[wsl-keepalive] spawn for ${distro} threw: ${err instanceof Error ? err.message : String(err)}`)
      holder.startedAt = Date.now()
      this.scheduleRestart(distro, holder)
      return
    }
    holder.child = child
    holder.startedAt = Date.now()
    this.log.log(`[wsl-keepalive] holding ${distro} (pid=${child.pid ?? 'n/a'})`)

    // 'error' (e.g. ENOENT) may fire with or without a following 'exit'.
    let settled = false
    const onEnd = (reason: string) => {
      if (settled) return
      settled = true
      this.handleEnd(distro, child, reason)
    }
    child.once('error', (err) => onEnd(`error: ${err.message}`))
    child.once('exit', (code, signal) => onEnd(`exit code=${code} signal=${signal}`))
  }

  private handleEnd(distro: string, child: ChildProcess, reason: string): void {
    const holder = this.holders.get(distro)
    // Stopped on purpose (stop() already detached it) or superseded.
    if (!holder || holder.child !== child) return
    holder.child = null
    if (!this.enabled || !this.wanted(distro)) {
      this.holders.delete(distro)
      return
    }
    this.log.error(`[wsl-keepalive] holder for ${distro} ended unexpectedly (${reason})`)
    this.scheduleRestart(distro, holder)
  }

  private scheduleRestart(distro: string, holder: Holder): void {
    if (Date.now() - holder.startedAt >= this.stableMs) holder.attempts = 0
    if (holder.attempts >= this.backoffMs.length) {
      holder.gaveUp = true
      this.log.error(`[wsl-keepalive] giving up on ${distro} after ${holder.attempts} restart attempts; will retry on next profile change or wizard run`)
      return
    }
    const delay = this.backoffMs[holder.attempts]
    holder.attempts += 1
    this.log.log(`[wsl-keepalive] restarting holder for ${distro} in ${delay}ms (attempt ${holder.attempts}/${this.backoffMs.length})`)
    holder.restartTimer = setTimeout(() => {
      if (this.holders.get(distro) !== holder || !this.enabled || !this.wanted(distro)) return
      this.spawnHolder(distro, holder)
    }, delay)
  }
}
