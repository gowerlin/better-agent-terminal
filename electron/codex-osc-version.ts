/**
 * PLAN-047 M1b-2 / T0621 (D158, contract C-5): whether the codex a helper dispatch launches writes
 * OSC 7501 (`>= 0.163.0`, src/lib/codex-terminal-state.ts). Then the dispatched Worker is recorded
 * `blockedDetection: osc` at launch, so `agentStarted` reads `false` until its first OSC 7501 and
 * `--wait-started` can answer `unconfirmed`; otherwise it stays `none` (`started: unknown`, never
 * `unconfirmed`) until a sequence is actually seen.
 *
 * Dispatch only (`createAgentPromptCommandBuilder`); tabs the user opens are never probed. Runs on
 * the host that runs the PTY (Electron main / headless bat-server).
 *
 * The binary: the launch command's first word. `codex` = the first PATH directory holding a codex
 * (what the tab's shell runs, assuming its PATH is this process's); on Windows that directory must
 * hold `codex.exe` — an npm shim (`codex.cmd` / `.ps1` / `.bat`) cannot run without a shell, so it
 * stays unknown. An absolute path (a custom CLI) is probed as it is; anything else is unknown.
 *
 * `codex --version` through `execFile` (array args, no shell), timeout 5 s. Cached by path + mtime
 * (an in-place upgrade is probed again); only a parsed version is cached, a failure is probed again
 * next time. One log line per check: `[codex-version] path=<…> version=<x.y.z|unknown> (cached|probed)`.
 *
 * 🔴 No `electron` import (headless uses it).
 */
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as pathModule from 'path'
import { codexVersionWritesOsc } from '../src/lib/codex-terminal-state'

export const CODEX_VERSION_TIMEOUT_MS = 5_000

export type ExecFileLike = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean; encoding: 'utf8' },
  callback: (error: Error | null, stdout: string, stderr: string) => void,
) => unknown

export interface CodexOscVersionDeps {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  /** True for an existing regular file. */
  isFile?(p: string): boolean
  /** The file's mtime (ms), or null. */
  mtimeMs?(p: string): number | null
  execFile?: ExecFileLike
  logger?: { log(message: string): void }
}

function pathValue(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  if (platform !== 'win32') return env.PATH ?? ''
  const key = Object.keys(env).find(k => k.toLowerCase() === 'path')
  return key ? env[key] ?? '' : ''
}

const WINDOWS_CODEX_NAMES = ['codex.exe', 'codex.cmd', 'codex.bat', 'codex.ps1', 'codex.com']

/** The binary `baseCommand` (e.g. `codex -c features.daemon_auto_start=false`) runs, or why not known. */
export function resolveDispatchCodexBinary(
  baseCommand: string,
  deps: Required<Pick<CodexOscVersionDeps, 'platform' | 'env' | 'isFile'>>,
): { path: string } | { reason: string } {
  const word = baseCommand.trim().split(/\s+/)[0] ?? ''
  const p = deps.platform === 'win32' ? pathModule.win32 : pathModule.posix
  if (word !== 'codex') {
    if (!word || !p.isAbsolute(word)) return { reason: `launch command ${word ? `'${word}'` : '(empty)'} is not codex on PATH` }
    if (!deps.isFile(word)) return { reason: 'custom CLI not found' }
    if (deps.platform === 'win32' && !/\.exe$/i.test(word)) return { reason: 'custom CLI is not an .exe' }
    return { path: word }
  }
  const delimiter = deps.platform === 'win32' ? ';' : ':'
  for (const raw of pathValue(deps.env, deps.platform).split(delimiter)) {
    const dir = raw.trim().replace(/^"(.*)"$/, '$1')
    if (!dir) continue
    if (deps.platform === 'win32') {
      const present = WINDOWS_CODEX_NAMES.filter(name => deps.isFile(p.join(dir, name)))
      if (present.length === 0) continue
      if (present.includes('codex.exe')) return { path: p.join(dir, 'codex.exe') }
      return { reason: `first codex on PATH is ${p.join(dir, present[0])} (needs a shell)` }
    }
    const candidate = p.join(dir, 'codex')
    if (deps.isFile(candidate)) return { path: candidate }
  }
  return { reason: 'codex not on PATH' }
}

const VERSION_RE = /codex-cli\s+v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/i

/**
 * `(baseCommand) => Promise<boolean>`: true when the codex it launches writes OSC 7501. Never
 * throws, never rejects.
 */
export function createCodexOscVersionCheck(deps: CodexOscVersionDeps = {}): (baseCommand: string) => Promise<boolean> {
  const platform = deps.platform ?? process.platform
  const env = deps.env ?? process.env
  const isFile = deps.isFile ?? ((p: string) => {
    try { return fs.statSync(p).isFile() } catch { return false }
  })
  const mtimeMs = deps.mtimeMs ?? ((p: string) => {
    try { return fs.statSync(p).mtimeMs } catch { return null }
  })
  const run: ExecFileLike = deps.execFile ?? (execFile as unknown as ExecFileLike)
  const cache = new Map<string, string>()
  const log = (message: string) => deps.logger?.log(message)

  const probe = (bin: string): Promise<string | null> => new Promise(resolve => {
    try {
      run(bin, ['--version'], { timeout: CODEX_VERSION_TIMEOUT_MS, windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error) return resolve(null)
        resolve(VERSION_RE.exec(`${stdout ?? ''}\n${stderr ?? ''}`)?.[1] ?? null)
      })
    } catch {
      resolve(null) // a synchronous spawn failure (EFTYPE, EINVAL)
    }
  })

  return async (baseCommand: string): Promise<boolean> => {
    try {
      const resolved = resolveDispatchCodexBinary(baseCommand, { platform, env, isFile })
      if ('reason' in resolved) {
        log(`[codex-version] path=- version=unknown (${resolved.reason})`)
        return false
      }
      const mtime = mtimeMs(resolved.path)
      const key = `${resolved.path}\0${mtime ?? '-'}`
      let version = mtime !== null ? cache.get(key) ?? null : null
      const how = version !== null ? 'cached' : 'probed'
      if (version === null) {
        version = await probe(resolved.path)
        if (version !== null && mtime !== null) cache.set(key, version)
      }
      log(`[codex-version] path=${resolved.path} version=${version ?? 'unknown'} (${how})`)
      return version !== null && codexVersionWritesOsc(`codex-cli ${version}`) === true
    } catch (error) {
      log(`[codex-version] path=- version=unknown (${error instanceof Error ? error.message : String(error)})`)
      return false
    }
  }
}
