// Parse the probe output of `./probe-script.ts` into a `RemoteToolsReport`
// (PLAN-037 / T0408; spec: T0407 §3).
//
// The output is untrusted (rc files print freely; a tampered host could print
// anything), so the parser:
//   - reads only the last complete BEGIN / END block; everything outside is noise
//   - accepts only whitelisted keys; other lines are dropped with a warning
//   - strips control / bidi characters from values and caps them at 256 chars
//   - maps every enum field from a fixed vocabulary, never passing raw text through
//
// Pure: no IO, no exec, no `electron`. `detectRemoteTools()` at the bottom composes
// the injected execFile runner with the parser.

import { HEALTHY_MIN as CLAUDE_HEALTHY_MIN, VERSION_REGEX as CLAUDE_VERSION_REGEX, compareSemver } from '../claude-resolver'
import { parseCodexVersion } from '../codex-runtime-resolver'
import {
  REMOTE_AUTH_ENV_VARS,
  REMOTE_PKG_MANAGERS,
  REMOTE_PRIVILEGES,
  REMOTE_TOOL_IDS,
  REMOTE_TOOLS_SCHEMA_VERSION,
  REMOTE_TOOLS_WITH_LOGIN,
  type RemoteAuthEnvVar,
  type RemoteOsFamily,
  type RemotePkgManager,
  type RemotePrivilege,
  type RemoteToolId,
  type RemoteToolLoginState,
  type RemoteToolReport,
  type RemoteToolStatus,
  type RemoteToolsDetectResult,
  type RemoteToolsEnv,
  type RemoteToolsReport,
} from '../../src/types/remote-tools'
import {
  PROBE_BEGIN_MARKER,
  PROBE_END_MARKER,
  buildLoginProbeInvocation,
  buildServerProbeInvocation,
  runProbe,
  type ProbeExecFile,
} from './probe-script'

export const MAX_VALUE_LENGTH = 256
/** Upper bound on lines read inside one block; a real probe prints well under 100. */
export const MAX_BLOCK_LINES = 512

const TOOL_FIELDS = ['state', 'path', 'version', 'login', 'cred'] as const
type ToolField = typeof TOOL_FIELDS[number]

const ENV_KEYS = ['wsl', 'timeout', 'uname_s', 'arch', 'os_id', 'os_id_like', 'os_version', 'musl', 'pkg', 'priv'] as const

function buildKeyWhitelist(): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const k of ENV_KEYS) keys.add('env.' + k)
  for (const v of REMOTE_AUTH_ENV_VARS) keys.add('env.auth.' + v)
  for (const id of REMOTE_TOOL_IDS) {
    for (const f of TOOL_FIELDS) keys.add('tool.' + id + '.' + f)
  }
  return keys
}

/** Every key the parser accepts. Anything else between the markers is dropped. */
export const PROBE_KEY_WHITELIST: ReadonlySet<string> = buildKeyWhitelist()

// C0 / DEL / C1 controls, zero-width and bidi overrides.
// eslint-disable-next-line no-control-regex
const UNPRINTABLE_RE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g

/** Keep printable characters only and cap at `MAX_VALUE_LENGTH`. */
export function sanitizeProbeValue(raw: string): { value: string; truncated: boolean } {
  const cleaned = raw.replace(UNPRINTABLE_RE, '').trim()
  const chars = Array.from(cleaned)
  if (chars.length <= MAX_VALUE_LENGTH) return { value: cleaned, truncated: false }
  return { value: chars.slice(0, MAX_VALUE_LENGTH).join(''), truncated: true }
}

export interface ProbeBlock {
  /** Whitelisted key → sanitized value (first occurrence wins). */
  values: Map<string, string>
  warnings: string[]
}

/**
 * Extract the last complete marker block. Returns `null` when there is none
 * (no BEGIN, or the output was cut before END).
 */
export function extractProbeBlock(stdout: string): ProbeBlock | null {
  const lines = stdout.split(/\r?\n/).map(l => l.replace(/\r/g, ''))
  let begin = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === PROBE_BEGIN_MARKER) {
      begin = i
      break
    }
  }
  if (begin < 0) return null
  let end = -1
  for (let i = begin + 1; i < lines.length; i++) {
    if (lines[i].trim() === PROBE_END_MARKER) {
      end = i
      break
    }
  }
  if (end < 0) return null

  const values = new Map<string, string>()
  const warnings: string[] = []
  const body = lines.slice(begin + 1, end)
  if (body.length > MAX_BLOCK_LINES) warnings.push('probe block truncated to ' + MAX_BLOCK_LINES + ' lines')
  let dropped = 0
  for (const line of body.slice(0, MAX_BLOCK_LINES)) {
    if (line.trim() === '') continue
    const eq = line.indexOf('=')
    const key = eq > 0 ? line.slice(0, eq) : ''
    if (!PROBE_KEY_WHITELIST.has(key)) {
      dropped++
      continue
    }
    if (values.has(key)) continue
    const { value, truncated } = sanitizeProbeValue(line.slice(eq + 1))
    if (truncated) warnings.push('value of ' + key + ' truncated to ' + MAX_VALUE_LENGTH + ' chars')
    values.set(key, value)
  }
  if (dropped > 0) warnings.push('dropped ' + dropped + ' non-whitelisted line(s)')
  return { values, warnings }
}

// ── field mapping ─────────────────────────────────────────────────────────────

function pickEnum<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  return raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
}

function flag(raw: string | undefined): boolean {
  return raw === '1'
}

function optionalText(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  // os-release values may be quoted: ID="opensuse-leap"
  const unquoted = raw.replace(/^(["'])(.*)\1$/, '$2').trim()
  return unquoted === '' ? undefined : unquoted
}

function osFamilyOf(unameS: string | undefined): RemoteOsFamily {
  if (unameS === 'Linux') return 'linux'
  if (unameS === 'Darwin') return 'darwin'
  return 'unknown'
}

const PKG_FROM_PROBE: ReadonlyMap<string, RemotePkgManager> = new Map([
  ['apt-get', 'apt'],
  ['dnf', 'dnf'],
  ['yum', 'yum'],
  ['apk', 'apk'],
  ['brew', 'brew'],
  ['none', 'none'],
])

function parseEnv(values: Map<string, string>): RemoteToolsEnv {
  const authEnv = {} as Record<RemoteAuthEnvVar, boolean>
  for (const v of REMOTE_AUTH_ENV_VARS) authEnv[v] = flag(values.get('env.auth.' + v))
  return {
    osFamily: osFamilyOf(values.get('env.uname_s')),
    osId: optionalText(values.get('env.os_id')),
    osIdLike: optionalText(values.get('env.os_id_like')),
    osVersion: optionalText(values.get('env.os_version')),
    arch: optionalText(values.get('env.arch')),
    musl: flag(values.get('env.musl')),
    pkgManager: pickEnum<RemotePkgManager>(PKG_FROM_PROBE.get(values.get('env.pkg') ?? ''), REMOTE_PKG_MANAGERS, 'none'),
    // Unknown privilege → assume a password prompt (the conservative choice for install recipes).
    privilege: pickEnum<RemotePrivilege>(values.get('env.priv'), REMOTE_PRIVILEGES, 'password-required'),
    isWsl: flag(values.get('env.wsl')),
    hasTimeout: flag(values.get('env.timeout')),
    authEnv,
  }
}

const GENERIC_SEMVER_RE = /(\d+\.\d+\.\d+)/
const LOOSE_VERSION_RE = /(\d+\.\d+(?:\.\d+)?)/

/** Parse a `--version` first line per tool; `undefined` when it does not match. */
export function parseToolVersion(id: RemoteToolId, raw: string): string | undefined {
  switch (id) {
    case 'claude':
      return CLAUDE_VERSION_REGEX.exec(raw.trim())?.[1]
    case 'codex':
      return parseCodexVersion(raw)
    case 'git':
    case 'gh':
      return GENERIC_SEMVER_RE.exec(raw)?.[1]
    default:
      return LOOSE_VERSION_RE.exec(raw)?.[1]
  }
}

/** Exit code of the login check → state. 124 / 137 / 143 = `timeout` killed it. */
export function loginStateFromExitCode(raw: string | undefined): RemoteToolLoginState {
  if (raw === '0') return 'loggedIn'
  if (raw === '1') return 'loggedOut'
  return 'unknown'
}

function hasLogin(id: RemoteToolId): boolean {
  return (REMOTE_TOOLS_WITH_LOGIN as readonly string[]).includes(id)
}

interface ToolProbeFields {
  state?: string
  path?: string
  version?: string
  login?: string
  cred?: string
}

function toolFields(values: Map<string, string>, id: RemoteToolId): ToolProbeFields {
  const out: ToolProbeFields = {}
  for (const f of TOOL_FIELDS) {
    const v = values.get('tool.' + id + '.' + f)
    if (v !== undefined) out[f as ToolField] = v
  }
  return out
}

function parseTool(id: RemoteToolId, fields: ToolProbeFields): Omit<RemoteToolReport, 'serverVisible'> {
  const path = optionalText(fields.path)
  let status: RemoteToolStatus
  let version: string | undefined
  switch (fields.state) {
    case 'found': {
      const raw = fields.version ?? ''
      if (raw.trim() === '') {
        status = 'error'
      } else {
        version = parseToolVersion(id, raw)
        status = id === 'claude' && version !== undefined && compareSemver(version, CLAUDE_HEALTHY_MIN) < 0 ? 'too-old' : 'ok'
      }
      break
    }
    case 'interop':
      status = 'interop-only'
      break
    case 'offpath':
      status = 'not-on-path'
      break
    default:
      status = 'missing'
  }

  const tool: Omit<RemoteToolReport, 'serverVisible'> = { id, status }
  if (path !== undefined && status !== 'missing') tool.path = path
  if (version !== undefined) tool.version = version
  if (hasLogin(id)) {
    // Login was only checked for a runnable binary; otherwise there is nothing to ask.
    tool.login = status === 'ok' || status === 'too-old' ? loginStateFromExitCode(fields.login) : 'n/a'
    tool.credentialFilePresent = flag(fields.cred)
  } else {
    tool.login = 'n/a'
  }
  return tool
}

/** Server view: a tool is visible when the server PATH resolves it to a non-interop binary. */
function serverVisibility(block: ProbeBlock | null): Map<RemoteToolId, boolean> {
  const out = new Map<RemoteToolId, boolean>()
  for (const id of REMOTE_TOOL_IDS) out.set(id, block?.values.get('tool.' + id + '.state') === 'found')
  return out
}

/**
 * Build the report from the login-view stdout and (optionally) the server-view
 * stdout. Returns `null` when the login output has no complete marker block.
 * A missing or broken server block only clears `serverViewAvailable`.
 */
export function parseRemoteToolsReport(loginStdout: string, serverStdout?: string | null): RemoteToolsReport | null {
  const login = extractProbeBlock(loginStdout)
  if (!login) return null
  const server = typeof serverStdout === 'string' ? extractProbeBlock(serverStdout) : null
  const visible = serverVisibility(server)
  const warnings = [...login.warnings, ...(server?.warnings ?? []).map(w => 'server view: ' + w)]
  if (typeof serverStdout === 'string' && !server) warnings.push('server view: no complete probe block')

  return {
    schemaVersion: REMOTE_TOOLS_SCHEMA_VERSION,
    env: parseEnv(login.values),
    tools: REMOTE_TOOL_IDS.map(id => ({ ...parseTool(id, toolFields(login.values, id)), serverVisible: visible.get(id) ?? false })),
    serverViewAvailable: server !== null,
    warnings,
  }
}

// ── composition ───────────────────────────────────────────────────────────────

export interface DetectRemoteToolsOptions {
  /** Login shell candidate (e.g. the server's `$SHELL`); validated by `selectLoginShell`. */
  shell?: string | null
}

/**
 * Run the login-view and server-view probes through the injected execFile and
 * build the report. Wired to `child_process.execFile` by the handler (T0411).
 */
export async function detectRemoteTools(execFileImpl: ProbeExecFile, options: DetectRemoteToolsOptions = {}): Promise<RemoteToolsDetectResult> {
  const [login, server] = await Promise.all([
    runProbe(execFileImpl, buildLoginProbeInvocation(options.shell)),
    runProbe(execFileImpl, buildServerProbeInvocation()),
  ])
  // A complete block wins over a late failure (e.g. a logout script that hangs after the probe).
  const report = parseRemoteToolsReport(login.stdout, server.stdout)
  if (report) {
    if (!login.ok) report.warnings.push('login view: ' + login.error)
    else if (login.exitError) report.warnings.push('login view exited non-zero: ' + sanitizeProbeValue(login.exitError).value)
    if (!server.ok) report.warnings.push('server view: ' + server.error)
    return { ok: true, report }
  }
  if (!login.ok) return { ok: false, errorCode: login.errorCode, error: login.error }
  return { ok: false, errorCode: 'no-markers', error: 'login probe output had no complete ' + PROBE_BEGIN_MARKER + ' block' }
}
