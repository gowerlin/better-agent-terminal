/**
 * T0839 (PLAN-043 W2): collect the WSL environment facts the setup wizard's
 * "detect → list → consent once" step plans from (T0831 〈調查結論〉2 / 3).
 * The plan itself is the pure `buildWslEnvPlan` in
 * `src/components/setup-wizard/wsl-env-plan.ts`, which also owns the types.
 *
 * 🔴 Read-only: queries only — never `--shutdown` / `--terminate` /
 * `--set-version`, never a write. Every probe is `execFile` with array argv
 * (no shell on the Windows side) and fixed scripts; the only external input,
 * the distro name, is whitelisted before anything is spawned. The whole run has
 * one 15 s budget (`WSL_FACTS_BUDGET_MS`); a probe gets what is left of it.
 * child_process goes through wsl-detect's `execFileBuffered`, so tests inject it
 * with `setExecFileImplForTests` (wsl-detect.ts).
 *
 * Side effect to know about: the in-distro probe runs a command in the selected
 * distro, which starts it when it is Stopped (the wizard's existing systemd /
 * $HOME probes do the same).
 *
 * Not imported by anything at import time: no electron, no userData.
 */
import { promises as fsPromises } from 'fs'
import os from 'os'
import path from 'path'
import type {
  WslConfigFacts,
  WslDistroConfFacts,
  WslDistroFact,
  WslFacts,
  WslPolicyFacts,
  WslSelectedDistroFacts,
  WslVersionFacts,
} from '../src/components/setup-wizard/wsl-env-plan'
import { decodeIniBuffer, getIniValue } from './ini-line-editor'
import {
  defaultWslConfigPath,
  execFileBuffered,
  normalizeTextOutput,
  parseWslListOutput,
  toNetworkMode,
  validateDistroName,
} from './wsl-detect'

/** T0839: one budget for every probe of a run (T0831: timeout 15 s). */
export const WSL_FACTS_BUDGET_MS = 15_000
/** A probe started with less than this left is skipped and the run is `timedOut`. */
const MIN_PROBE_MS = 250

export const WSL_POLICY_KEY = 'HKLM\\SOFTWARE\\Policies\\WSL'

/**
 * In-distro probe, run as the default user with `sh -c` (fixed text, no
 * interpolated input). Markers first; `/etc/wsl.conf` bytes follow the BEGIN
 * marker so its encoding survives for the INI decoder.
 */
export const DISTRO_PROBE_SCRIPT = [
  'u=$(id -un 2>/dev/null)',
  'echo "BAT_UID=$(id -u 2>/dev/null)"',
  'echo "BAT_USER=$u"',
  'echo "BAT_PID1=$(cat /proc/1/comm 2>/dev/null)"',
  'if [ -n "$u" ] && [ -e "/var/lib/systemd/linger/$u" ]; then echo "BAT_LINGER=yes"; else echo "BAT_LINGER=no"; fi',
  'if [ -f /etc/wsl.conf ]; then',
  '  if [ -r /etc/wsl.conf ]; then echo "BAT_WSLCONF=present"; echo "BAT_WSLCONF_BEGIN"; cat /etc/wsl.conf; else echo "BAT_WSLCONF=unreadable"; fi',
  'else echo "BAT_WSLCONF=absent"; fi',
].join('\n')

const WSLCONF_BEGIN = Buffer.from('BAT_WSLCONF_BEGIN\n')

export interface DetectWslFactsOptions {
  /** Distro to inspect; default = WSL's default distro. Whitelisted before use. */
  distro?: string
  /** T0840: setup wizard step abort; ends the running probe's child process. */
  signal?: AbortSignal
  // Test seams (production uses the real values).
  platform?: NodeJS.Platform
  release?: string
  systemRoot?: string
  wslConfigPath?: string
  now?: () => number
}

interface Budget {
  remaining(): number
  timedOut: boolean
  signal?: AbortSignal
}

function makeBudget(now: () => number, total: number, signal?: AbortSignal): Budget {
  const end = now() + total
  return {
    timedOut: false,
    ...(signal ? { signal } : {}),
    remaining() {
      return end - now()
    },
  }
}

type Probe = { ok: true; stdout: Buffer } | { ok: false; code: unknown; stdout: Buffer; skipped?: true }

async function probe(budget: Budget, file: string, args: string[]): Promise<Probe> {
  const left = budget.remaining()
  if (budget.signal?.aborted) return { ok: false, code: 'ABORT_ERR', stdout: Buffer.alloc(0), skipped: true }
  if (left < MIN_PROBE_MS) {
    budget.timedOut = true
    return { ok: false, code: 'budget', stdout: Buffer.alloc(0), skipped: true }
  }
  try {
    const { stdout } = await execFileBuffered(file, args, {
      timeoutMs: Math.floor(left),
      ...(budget.signal ? { signal: budget.signal } : {}),
    })
    return { ok: true, stdout }
  } catch (error) {
    const err = error as Error & { code?: unknown; killed?: boolean; signal?: unknown; stdout?: Buffer }
    if (err.killed || err.signal === 'SIGTERM') budget.timedOut = true
    return { ok: false, code: err.code, stdout: Buffer.isBuffer(err.stdout) ? err.stdout : Buffer.alloc(0) }
  }
}

/** `os.release()` on Windows is `10.0.<build>`. */
export function parseWindowsBuild(release: string, platform: NodeJS.Platform): number | null {
  if (platform !== 'win32') return null
  const build = Number(release.split('.')[2])
  return Number.isInteger(build) && build > 0 ? build : null
}

/**
 * `wsl --version` (UTF-16LE, localized labels). The WSL package version is on
 * the first line; take the first dotted number there, never match the label.
 */
export function parseWslVersionOutput(buffer: Buffer): string | null {
  const firstLine = normalizeTextOutput(buffer).split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0)
  const match = firstLine?.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/)
  return match ? match[1] : null
}

/** `reg.exe query <key>` output → value map (names are not localized). */
export function parseRegQueryValues(text: string): Record<string, number | string> {
  const values: Record<string, number | string> = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s+(\S+)\s+(REG_[A-Z_]+)\s*(.*)$/)
    if (!match) continue
    const [, name, type, raw] = match
    const data = raw.trim()
    if (type === 'REG_DWORD' || type === 'REG_QWORD') {
      const value = Number.parseInt(data, data.toLowerCase().startsWith('0x') ? 16 : 10)
      if (Number.isFinite(value)) values[name] = value
    } else {
      values[name] = data
    }
  }
  return values
}

function lookup(values: Record<string, number | string>, name: string): number | string | undefined {
  const key = Object.keys(values).find((k) => k.toLowerCase() === name.toLowerCase())
  return key === undefined ? undefined : values[key]
}

function policyBool(values: Record<string, number | string>, name: string): boolean | null {
  const value = lookup(values, name)
  return typeof value === 'number' ? value !== 0 : null
}

export function policyFactsFromValues(status: WslPolicyFacts['status'], values: Record<string, number | string>): WslPolicyFacts {
  const mode = lookup(values, 'DefaultNetworkingMode')
  return {
    status,
    values,
    allowWsl: policyBool(values, 'AllowWSL'),
    allowWsl1: policyBool(values, 'AllowWSL1'),
    allowInboxWsl: policyBool(values, 'AllowInboxWSL'),
    allowNetworkingModeUserSetting: policyBool(values, 'AllowNetworkingModeUserSetting'),
    defaultNetworkingMode: typeof mode === 'number' ? mode : null,
  }
}

async function detectPolicy(budget: Budget, platform: NodeJS.Platform, systemRoot: string): Promise<WslPolicyFacts> {
  if (platform !== 'win32') return policyFactsFromValues('unknown', {})
  // Absolute System32 path: PATH (e.g. Git Bash) may carry another `reg`.
  const regExe = path.win32.join(systemRoot, 'System32', 'reg.exe')
  const result = await probe(budget, regExe, ['query', WSL_POLICY_KEY])
  if (result.ok) return policyFactsFromValues('present', parseRegQueryValues(normalizeTextOutput(result.stdout)))
  // reg.exe exits 1 when the key does not exist (no WSL policy at all).
  return policyFactsFromValues(result.code === 1 ? 'absent' : 'unknown', {})
}

/** `.wslconfig` facts from its bytes (T0838 decoder + parser; read-only). */
export function wslConfigFactsFromBuffer(buffer: Buffer): WslConfigFacts {
  const decoded = decodeIniBuffer(buffer)
  if (!decoded.ok) return { status: 'invalid-encoding', encoding: null, networkingMode: null, instanceIdleTimeout: null }
  const mode = getIniValue(decoded.text, 'wsl2', 'networkingMode')
  const idle = getIniValue(decoded.text, 'general', 'instanceIdleTimeout')
  if (!mode.ok || !idle.ok) return { status: 'unparsable', encoding: decoded.encoding, networkingMode: null, instanceIdleTimeout: null }
  return {
    status: 'ok',
    encoding: decoded.encoding,
    networkingMode: mode.value === null ? null : toNetworkMode(mode.value),
    instanceIdleTimeout: idle.value,
  }
}

async function detectWslConfig(configPath: string): Promise<WslConfigFacts> {
  try {
    return wslConfigFactsFromBuffer(await fsPromises.readFile(configPath))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return {
      status: code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'unreadable',
      encoding: null,
      networkingMode: null,
      instanceIdleTimeout: null,
    }
  }
}

/** `/etc/wsl.conf` facts from its bytes. */
export function distroConfFactsFromBuffer(buffer: Buffer): WslDistroConfFacts {
  const decoded = decodeIniBuffer(buffer)
  if (!decoded.ok) return { status: 'invalid-encoding', bootSystemd: null, userDefault: null }
  const systemd = getIniValue(decoded.text, 'boot', 'systemd')
  const user = getIniValue(decoded.text, 'user', 'default')
  if (!systemd.ok || !user.ok) return { status: 'unparsable', bootSystemd: null, userDefault: null }
  return { status: 'ok', bootSystemd: systemd.value, userDefault: user.value }
}

const EMPTY_CONF: WslDistroConfFacts = { status: 'missing', bootSystemd: null, userDefault: null }

/** Parse `DISTRO_PROBE_SCRIPT` stdout. */
export function parseDistroProbeOutput(stdout: Buffer): Omit<WslSelectedDistroFacts, 'name' | 'version' | 'state' | 'probe'> {
  const begin = stdout.indexOf(WSLCONF_BEGIN)
  const head = (begin === -1 ? stdout : stdout.subarray(0, begin)).toString('utf8')
  const markers = new Map<string, string>()
  for (const line of head.split(/\r?\n/)) {
    const match = line.match(/^BAT_([A-Z0-9_]+)=(.*)$/)
    if (match && !markers.has(match[1])) markers.set(match[1], match[2].trim())
  }
  const uidText = markers.get('UID') ?? ''
  const uid = /^\d+$/.test(uidText) ? Number(uidText) : null
  const pid1 = markers.get('PID1') || null
  const confMarker = markers.get('WSLCONF')
  let wslConf: WslDistroConfFacts = EMPTY_CONF
  if (confMarker === 'unreadable') wslConf = { status: 'unreadable', bootSystemd: null, userDefault: null }
  else if (confMarker === 'present' && begin !== -1) wslConf = distroConfFactsFromBuffer(stdout.subarray(begin + WSLCONF_BEGIN.length))
  const linger = markers.get('LINGER')
  return {
    user: markers.get('USER') || null,
    uid,
    pid1,
    systemdRunning: pid1 === null ? null : pid1 === 'systemd',
    wslConf,
    linger: linger === 'yes' ? true : linger === 'no' ? false : null,
  }
}

function skippedDistro(name: string, distro: WslDistroFact | undefined): WslSelectedDistroFacts {
  return {
    name,
    version: distro?.version ?? null,
    state: distro?.state ?? null,
    probe: 'skipped',
    user: null,
    uid: null,
    pid1: null,
    systemdRunning: null,
    wslConf: EMPTY_CONF,
    linger: null,
  }
}

async function detectSelectedDistro(budget: Budget, name: string, distro: WslDistroFact | undefined): Promise<WslSelectedDistroFacts> {
  if (!distro) return skippedDistro(name, undefined)
  try {
    // The default distro name comes from `wsl -l -v`: whitelist it like user input.
    validateDistroName(name)
  } catch {
    return skippedDistro(name, distro)
  }
  const result = await probe(budget, 'wsl', ['-d', name, '--exec', 'sh', '-c', DISTRO_PROBE_SCRIPT, 'sh'])
  if (!result.ok) {
    return { ...skippedDistro(name, distro), probe: result.skipped ? 'skipped' : 'failed' }
  }
  const parsed = parseDistroProbeOutput(result.stdout)
  // No uid marker at all = the script did not run as expected.
  return { name, version: distro.version, state: distro.state, probe: parsed.uid === null ? 'failed' : 'ok', ...parsed }
}

export async function detectWslFacts(options: DetectWslFactsOptions = {}): Promise<WslFacts> {
  const now = options.now ?? (() => performance.now())
  const startedAt = now()
  const platform = options.platform ?? process.platform
  // Validate before any spawn (CLAUDE.md Child Process Spawning).
  const requested = options.distro === undefined ? undefined : validateDistroName(options.distro)
  const budget = makeBudget(now, WSL_FACTS_BUDGET_MS, options.signal)

  const base = {
    v: 1 as const,
    platform,
    windowsBuild: parseWindowsBuild(options.release ?? os.release(), platform),
  }

  if (platform !== 'win32') {
    return {
      ...base,
      wslInstalled: false,
      version: { available: false, wsl: null },
      distros: [],
      defaultDistro: null,
      running: [],
      selected: null,
      policy: policyFactsFromValues('unknown', {}),
      wslConfig: { status: 'missing', encoding: null, networkingMode: null, instanceIdleTimeout: null },
      timedOut: false,
      durationMs: Math.round(now() - startedAt),
    }
  }

  const systemRoot = options.systemRoot ?? process.env.SystemRoot ?? 'C:\\Windows'
  const [versionResult, listResult, policy, wslConfig] = await Promise.all([
    probe(budget, 'wsl', ['--version']),
    probe(budget, 'wsl', ['-l', '-v']),
    detectPolicy(budget, platform, systemRoot),
    detectWslConfig(options.wslConfigPath ?? defaultWslConfigPath()),
  ])

  const version: WslVersionFacts = versionResult.ok
    ? { available: true, wsl: parseWslVersionOutput(versionResult.stdout) }
    : { available: false, wsl: null }
  const listed = listResult.ok ? parseWslListOutput(listResult.stdout) : { distros: [], default: null }

  // Same three-state rule as wsl-detect `isWslInstalled` / `list` (exit codes only).
  let wslInstalled = versionResult.ok || listResult.ok
  if (!wslInstalled && !listResult.ok && listResult.code !== 'ENOENT') {
    wslInstalled = (await probe(budget, 'wsl', ['--status'])).ok
  }

  const selectedName = requested ?? listed.default ?? undefined
  const selected = wslInstalled && selectedName
    ? await detectSelectedDistro(budget, selectedName, listed.distros.find((d) => d.name.toLowerCase() === selectedName.toLowerCase()))
    : null

  return {
    ...base,
    wslInstalled,
    version,
    distros: listed.distros,
    defaultDistro: listed.default,
    running: listed.distros.filter((d) => d.state === 'Running').map((d) => d.name),
    selected,
    policy,
    wslConfig,
    timedOut: budget.timedOut,
    durationMs: Math.round(now() - startedAt),
  }
}

/** One debug-log line: counts and states only — no user name, no file contents. */
export function summarizeWslFacts(facts: WslFacts): string {
  const sel = facts.selected
  return [
    `installed=${facts.wslInstalled}`,
    `version=${facts.version.wsl ?? (facts.version.available ? 'unparsed' : 'unavailable')}`,
    `build=${facts.windowsBuild ?? 'n/a'}`,
    `distros=${facts.distros.length}`,
    `running=${facts.running.length}`,
    `policy=${facts.policy.status}`,
    `wslconfig=${facts.wslConfig.status}`,
    sel
      ? `selected=v${sel.version ?? '?'}/${sel.probe}/uid=${sel.uid ?? '?'}/pid1=${sel.pid1 ?? '?'}/wslconf=${sel.wslConf.status}/linger=${sel.linger ?? '?'}`
      : 'selected=none',
    `timedOut=${facts.timedOut}`,
    `ms=${facts.durationMs}`,
  ].join(' ')
}
