/**
 * T0840 (PLAN-043 W3): apply the WSL environment fixes the user consented to in
 * the setup wizard's `plan-wsl-environment` step (T0831 〈調查結論〉2, D272).
 *
 *  - `wsl2-convert`  (P-1): `wsl --set-version <d> 2`.
 *  - `enable-systemd` (P-2): `/etc/wsl.conf` `[boot] systemd=true` (T0838 line
 *    editor: only that line changes), backup next to it, `wsl --terminate <d>`,
 *    then systemd must be PID 1.
 * P-4 (linger) stays where it was (write-systemd-unit → `enableLinger`); P-3
 * (root default user) is a notice only (Phase 3 / W7 creates users).
 *
 * Rules (work order T0840, CLAUDE.md Child Process Spawning):
 *  - Every fix is idempotent: re-detect first (already fine → `already`, no
 *    write, no terminate) and verify afterwards by re-reading the real state —
 *    exit codes are never trusted.
 *  - Contents (`/etc/wsl.conf`) go over stdin only, never argv, never the log.
 *    Before a write the existing file is copied to
 *    `/etc/wsl.conf.bat-backup-<YYYYMMDD-HHMMSS>` (`iniBackupPath`, system time).
 *  - `execFile` / `spawn` with array argv, fixed scripts, distro whitelisted
 *    before anything is spawned, every call with a timeout.
 *  - Nothing is ever undone automatically (D272): the result lists what changed
 *    and where the backup is; the wizard shows it on the done / cancel screen.
 *  - Abort (T0830 `signal`): reads / writes / terminate end their child process.
 *    `--set-version` is NOT given the signal: the conversion runs in the
 *    LxssManager service, so ending the `wsl.exe` client would not stop it
 *    (inference, T0831) — the wizard marks it uninterruptible and waits.
 *
 * Pure of electron: no electron import, no userData, nothing at import time.
 * Tests inject child_process through `WslEnvApplyDeps`.
 */
import * as childProcess from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { decodeIniBuffer, encodeIniText, getIniValue, iniBackupPath, setIniValue } from './ini-line-editor'
import { normalizeTextOutput, parseWslListOutput } from './wsl-detect'
import { assertValidDistro } from './wsl-validate'

import type {
  WslEnvApplyErrorCode,
  WslEnvApplyItemId,
  WslEnvApplyResult,
  WslEnvChange,
} from '../src/components/setup-wizard/wsl-env-plan'

export type { WslEnvApplyErrorCode, WslEnvApplyItemId, WslEnvApplyResult, WslEnvChange }

export const WSL_ENV_APPLY_ITEM_IDS: readonly WslEnvApplyItemId[] = ['wsl2-convert', 'enable-systemd']

type ExecFileLike = (...args: any[]) => unknown
type SpawnLike = (
  command: string,
  args: readonly string[],
  options: childProcess.SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams

export interface WslEnvApplyDeps {
  execFile?: ExecFileLike
  spawn?: SpawnLike
  /** System time for the backup name (never typed in). */
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
}

export const WSL_CONF_PATH = '/etc/wsl.conf'
/** `wsl -l -v`, reads, backup, terminate. */
const QUICK_TIMEOUT_MS = 30_000
/** Converting a large distro can take a long time (T0831 P-1). */
export const SET_VERSION_TIMEOUT_MS = 60 * 60_000
/** Distro restart after `--terminate`: probe PID 1 this many times. */
const PID1_ATTEMPTS = 4
const PID1_RETRY_MS = 2_000
const BACKUP_PATH_PATTERN = /^\/etc\/wsl\.conf\.bat-backup-\d{8}-\d{6}$/

/** Read `/etc/wsl.conf` as root; marker line first, then the raw bytes (encoding survives). */
export const READ_WSL_CONF_SCRIPT = [
  'if [ -f /etc/wsl.conf ]; then',
  '  if [ -r /etc/wsl.conf ]; then echo "BAT_WSLCONF=present"; cat /etc/wsl.conf; else echo "BAT_WSLCONF=unreadable"; fi',
  'else echo "BAT_WSLCONF=absent"; fi',
].join('\n')

/** Write stdin to `/etc/wsl.conf` through a temp file in the same directory (no partial file). */
export const WRITE_WSL_CONF_SCRIPT = [
  'umask 022',
  't=/etc/wsl.conf.bat-tmp',
  'cat > "$t" && chmod 644 "$t" && mv -f "$t" /etc/wsl.conf',
].join('\n')

interface ExecResult {
  stdout: Buffer
  stderr: Buffer
}

class AbortedError extends Error {
  constructor() {
    super('WSL environment fix aborted')
    this.name = 'AbortError'
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return error instanceof AbortedError
    || (error instanceof Error && error.name === 'AbortError')
    || signal?.aborted === true
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AbortedError()
}

function describeExecError(error: unknown): string {
  const err = error as Error & { stdout?: Buffer; stderr?: Buffer; code?: unknown }
  const stderr = Buffer.isBuffer(err.stderr) ? normalizeTextOutput(err.stderr) : ''
  const stdout = Buffer.isBuffer(err.stdout) ? normalizeTextOutput(err.stdout) : ''
  const text = (stderr || stdout).split(/\r?\n/).slice(0, 3).join(' ').trim()
  const base = err instanceof Error ? err.message.split(/\r?\n/)[0] : String(error)
  return text ? `${base}: ${text}` : base
}

export class WslEnvApplier {
  private readonly execFileImpl: ExecFileLike
  private readonly spawnImpl: SpawnLike
  private readonly now: () => Date
  private readonly sleep: (ms: number) => Promise<void>
  private readonly log: (message: string) => void

  constructor(deps: WslEnvApplyDeps = {}) {
    this.execFileImpl = deps.execFile ?? childProcess.execFile
    this.spawnImpl = deps.spawn ?? (childProcess.spawn as SpawnLike)
    this.now = deps.now ?? (() => new Date())
    this.sleep = deps.sleep ?? defaultSleep
    this.log = deps.log ?? (() => undefined)
  }

  /** Apply one consented item. Never throws: failures come back as `ok: false`. */
  async apply(distro: string, item: unknown, options: { signal?: AbortSignal } = {}): Promise<WslEnvApplyResult> {
    try {
      assertValidDistro(distro)
    } catch (error) {
      return this.fail('wsl-env-apply-invalid', error instanceof Error ? error.message : String(error), [], false)
    }
    if (item !== 'wsl2-convert' && item !== 'enable-systemd') {
      return this.fail('wsl-env-apply-invalid', `Unknown WSL environment item: ${JSON.stringify(item)}`, [], false)
    }
    const startedAt = Date.now()
    const result = item === 'wsl2-convert'
      ? await this.convertToWsl2(distro, options.signal)
      : await this.enableSystemd(distro, options.signal)
    // Item, outcome, code, counts only — never file contents.
    this.log(
      `[wsl-env-apply] ${item} -> ${result.ok ? result.outcome : `${result.errorCode}${result.aborted ? ' (aborted)' : ''}`}`
      + ` changes=${result.changes.length} terminated=${result.terminated} ms=${Date.now() - startedAt}`,
    )
    return result
  }

  /** P-1. `--set-version` gets no signal on purpose (see the module comment). */
  async convertToWsl2(distro: string, signal?: AbortSignal): Promise<WslEnvApplyResult> {
    const changes: WslEnvChange[] = []
    try {
      throwIfAborted(signal)
      const before = await this.distroVersion(distro, signal)
      if (before === 2) return { ok: true, outcome: 'already', changes, terminated: false }
      if (before === null) {
        return this.fail('wsl-set-version-failed', `WSL distro ${distro} is not registered.`, changes, false)
      }
      let execError: unknown = null
      try {
        await this.exec('wsl', ['--set-version', distro, '2'], { timeoutMs: SET_VERSION_TIMEOUT_MS })
      } catch (error) {
        execError = error
      }
      // Judge by the real state, not the exit code. (No signal: always re-read.)
      const after = await this.distroVersion(distro)
      if (after === 2) {
        changes.push({ item: 'wsl2-convert', kind: 'wsl-version' })
        if (signal?.aborted) return this.fail('wsl-set-version-failed', 'Aborted after the conversion finished.', changes, true, true)
        return { ok: true, outcome: 'applied', changes, terminated: true }
      }
      return this.fail(
        'wsl-set-version-failed',
        execError ? describeExecError(execError) : `WSL distro ${distro} is still version ${after ?? 'unknown'}.`,
        changes,
        true,
      )
    } catch (error) {
      if (isAbort(error, signal)) return this.fail('wsl-set-version-failed', 'Aborted.', changes, false, true)
      return this.fail('wsl-set-version-failed', describeExecError(error), changes, false)
    }
  }

  /** P-2. */
  async enableSystemd(distro: string, signal?: AbortSignal): Promise<WslEnvApplyResult> {
    const changes: WslEnvChange[] = []
    let terminated = false
    let phase: 'read' | 'write' | 'terminate' | 'verify' = 'read'
    try {
      throwIfAborted(signal)
      const version = await this.distroVersion(distro, signal)
      if (version === null) {
        return this.fail('wsl-systemd-enable-failed', `WSL distro ${distro} is not registered.`, changes, false)
      }
      if (version === 2 && await this.systemdIsPid1(distro, signal)) {
        return { ok: true, outcome: 'already', changes, terminated: false }
      }

      throwIfAborted(signal)
      const conf = await this.readWslConf(distro, signal)
      if (conf.status === 'unreadable') {
        return this.fail('wsl-systemd-enable-failed', `${WSL_CONF_PATH} cannot be read.`, changes, false)
      }
      let text = ''
      let encoding: Parameters<typeof encodeIniText>[1] = 'utf8'
      if (conf.status === 'present') {
        const decoded = decodeIniBuffer(conf.bytes)
        if (!decoded.ok) return this.fail('wsl-systemd-enable-failed', `${WSL_CONF_PATH}: ${decoded.message}`, changes, false)
        text = decoded.text
        encoding = decoded.encoding
      }
      const edit = setIniValue(text, 'boot', 'systemd', 'true')
      if (!edit.ok) {
        // T0831 〈風險〉: never write a file we cannot parse.
        return this.fail('wsl-systemd-enable-failed', `${WSL_CONF_PATH}: ${edit.message}`, changes, false)
      }

      if (edit.changed) {
        phase = 'write'
        let backupPath: string | null = null
        if (conf.status === 'present') {
          backupPath = iniBackupPath(WSL_CONF_PATH, this.now())
          if (!BACKUP_PATH_PATTERN.test(backupPath)) throw new Error('Unexpected backup path.')
          throwIfAborted(signal)
          await this.exec('wsl', ['-d', distro, '-u', 'root', '--exec', 'cp', '-p', '--', WSL_CONF_PATH, backupPath], {
            timeoutMs: QUICK_TIMEOUT_MS,
            signal,
          })
        }
        throwIfAborted(signal)
        await this.writeWslConf(distro, encodeIniText(edit.text, encoding), signal)
        changes.push({ item: 'enable-systemd', kind: 'file', path: WSL_CONF_PATH, backupPath })
        // Verify the write by reading it back.
        const reread = await this.readWslConf(distro, signal)
        const decoded = reread.status === 'present' ? decodeIniBuffer(reread.bytes) : null
        const value = decoded?.ok ? getIniValue(decoded.text, 'boot', 'systemd') : null
        if (!value?.ok || value.value?.toLowerCase() !== 'true') {
          return this.fail('wsl-systemd-enable-failed', `${WSL_CONF_PATH} does not have [boot] systemd=true after writing it.`, changes, false)
        }
      }

      // WSL1 cannot run systemd; the declaration takes effect once it is WSL2.
      if (version === 1) return { ok: true, outcome: edit.changed ? 'applied' : 'already', changes, terminated }

      phase = 'terminate'
      throwIfAborted(signal)
      // T0840 measured (WSL 2.7.14, disposable distro): `--terminate` is enough
      // for `[boot] systemd` to take effect; `--shutdown` is not needed.
      await this.exec('wsl', ['--terminate', distro], { timeoutMs: QUICK_TIMEOUT_MS, signal })
      terminated = true

      phase = 'verify'
      for (let attempt = 1; attempt <= PID1_ATTEMPTS; attempt += 1) {
        throwIfAborted(signal)
        if (await this.systemdIsPid1(distro, signal)) return { ok: true, outcome: 'applied', changes, terminated }
        if (attempt < PID1_ATTEMPTS) await this.sleep(PID1_RETRY_MS)
      }
      return this.fail('wsl-systemd-enable-failed', `systemd is still not PID 1 in ${distro} after wsl --terminate.`, changes, terminated)
    } catch (error) {
      if (isAbort(error, signal)) return this.fail('wsl-systemd-enable-failed', 'Aborted.', changes, terminated, true)
      const code: WslEnvApplyErrorCode = phase === 'terminate' ? 'wsl-terminate-failed' : 'wsl-systemd-enable-failed'
      return this.fail(code, describeExecError(error), changes, terminated)
    }
  }

  private fail(
    errorCode: WslEnvApplyErrorCode,
    error: string,
    changes: WslEnvChange[],
    terminated: boolean,
    aborted = false,
  ): WslEnvApplyResult {
    return { ok: false, errorCode, error, changes, terminated, ...(aborted ? { aborted: true as const } : {}) }
  }

  private async distroVersion(distro: string, signal?: AbortSignal): Promise<1 | 2 | null> {
    const { stdout } = await this.exec('wsl', ['-l', '-v'], { timeoutMs: QUICK_TIMEOUT_MS, signal })
    const found = parseWslListOutput(stdout).distros.find((d) => d.name.toLowerCase() === distro.toLowerCase())
    return found ? found.version : null
  }

  private async systemdIsPid1(distro: string, signal?: AbortSignal): Promise<boolean> {
    try {
      const { stdout } = await this.exec('wsl', ['-d', distro, '--exec', 'cat', '/proc/1/comm'], { timeoutMs: QUICK_TIMEOUT_MS, signal })
      return normalizeTextOutput(stdout) === 'systemd'
    } catch (error) {
      if (isAbort(error, signal)) throw error
      return false
    }
  }

  private async readWslConf(
    distro: string,
    signal?: AbortSignal,
  ): Promise<{ status: 'present'; bytes: Buffer } | { status: 'absent' | 'unreadable' }> {
    const { stdout } = await this.exec('wsl', ['-d', distro, '-u', 'root', '--exec', 'sh', '-c', READ_WSL_CONF_SCRIPT, 'sh'], {
      timeoutMs: QUICK_TIMEOUT_MS,
      signal,
    })
    const newline = stdout.indexOf(0x0a)
    const marker = (newline < 0 ? stdout : stdout.subarray(0, newline)).toString('utf8').trim()
    if (marker === 'BAT_WSLCONF=present') return { status: 'present', bytes: stdout.subarray(newline + 1) }
    if (marker === 'BAT_WSLCONF=absent') return { status: 'absent' }
    if (marker === 'BAT_WSLCONF=unreadable') return { status: 'unreadable' }
    throw new Error('Unexpected output while reading /etc/wsl.conf.')
  }

  private writeWslConf(distro: string, content: Buffer, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = this.spawnImpl('wsl', ['-d', distro, '-u', 'root', '--exec', 'sh', '-c', WRITE_WSL_CONF_SCRIPT, 'sh'], {
        windowsHide: true,
        stdio: 'pipe',
        timeout: QUICK_TIMEOUT_MS,
        ...(signal ? { signal } : {}),
      })
      const stderr: Buffer[] = []
      child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) {
          resolve()
          return
        }
        if (signal?.aborted) {
          reject(new AbortedError())
          return
        }
        reject(new Error(normalizeTextOutput(Buffer.concat(stderr)) || `writing /etc/wsl.conf exited with code ${code}`))
      })
      child.stdin.on('error', () => undefined)
      child.stdin.end(content)
    })
  }

  private exec(file: string, args: string[], options: { timeoutMs: number; signal?: AbortSignal }): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      this.execFileImpl(
        file,
        args,
        {
          encoding: 'buffer',
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
          timeout: options.timeoutMs,
          ...(options.signal ? { signal: options.signal } : {}),
        },
        (error: Error | null, stdout: Buffer | string, stderr: Buffer | string) => {
          const out = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? '')
          const err = Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? '')
          if (error) {
            ;(error as Error & { stdout?: Buffer; stderr?: Buffer }).stdout = out
            ;(error as Error & { stdout?: Buffer; stderr?: Buffer }).stderr = err
            reject(error)
            return
          }
          resolve({ stdout: out, stderr: err })
        },
      )
    })
  }
}
