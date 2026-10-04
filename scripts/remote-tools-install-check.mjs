#!/usr/bin/env node

/**
 * T0414 (PLAN-037 G) — protocol-level install acceptance for the remote tools panel.
 * Runs the exact install path BAT uses (T0412), but from a script instead of the UI:
 *
 *   remote-tools:detect → normalizeRecipeEnv → buildInstallPlan / buildUpdatePlan
 *   → pty:create (cwd $HOME, /bin/bash, NO agentPreset)
 *   → pty:write wrapWithSentinel(plan.command, nonce) + '\r'
 *   → createSentinelMatcher(nonce) on pty:output → exit code
 *   → remote-tools:detect again
 *
 *   node scripts/remote-tools-install-check.mjs --target wsl:Ubuntu-24.04              # dry-run, every tool
 *   node scripts/remote-tools-install-check.mjs --target wsl:Ubuntu-24.04 --tool claude --yes
 *   node scripts/remote-tools-install-check.mjs --target wsl:Ubuntu-24.04 --tool claude --kind update --yes
 *   node scripts/remote-tools-install-check.mjs --target wsl:Ubuntu-24.04 --shell-check
 *
 * Exit code: 0 = every step ran and every install exited 0, 1 = an install failed / timed out
 * or a PTY was left behind, 2 = bad arguments / connection info could not be resolved.
 *
 * Ground rules (same as scripts/smoke-remote-headless.mjs, whose client this reuses):
 *   - dry-run is the default: without --yes nothing is written to any PTY and no PTY is created;
 *   - the install command is never typed by hand: it is `buildInstallPlan` / `buildUpdatePlan`
 *     wrapped by `wrapWithSentinel`, exactly what `src/lib/remote-tools/install-runner.ts` types;
 *   - besides the install command, only fixed diagnostic one-liners from this file are typed
 *     (DISABLE_* env names, `command -v`, PATH order, profile checksums, `codex login status`
 *     exit code). None of them prints a credential, a token or the full environment;
 *   - only PTYs created here (`t0414-<timestamp>-<rand>-<step>` ids) are touched, and each is
 *     killed on every exit path.
 *
 * `src/lib/remote-tools/*.ts` is loaded with Node's built-in type stripping (Node >= 23.6) plus
 * a resolve hook scoped to `src/` that adds the `.ts` extension the sources omit.
 */

import { randomBytes } from 'node:crypto'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs as parseNodeArgs } from 'node:util'

import {
  DEFAULT_HOST,
  PtyTracker,
  REMOTE_TOOLS_DETECT_TIMEOUT_MS,
  SMOKE_CHANNELS,
  SMOKE_EVENTS,
  SmokeClient,
  UsageError,
  normalizeFingerprint,
  parseServerUrl,
  parseTarget,
  ptyCreateOutcome,
  resolveUrlTarget,
  resolveWslTarget,
} from './smoke-remote-headless.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(REPO_ROOT, 'src')

/** Install order of the T0414 acceptance run (also the default --tool list). */
export const DEFAULT_TOOLS = Object.freeze(['claude', 'uv', 'codex', 'rg', 'gh'])
export const INSTALL_KINDS = Object.freeze(['install', 'update'])
export const DEFAULT_INSTALL_TIMEOUT_MS = 15 * 60_000
export const DEFAULT_STEP_TIMEOUT_MS = 20_000
export const PTY_ID_PREFIX = 't0414-'
/** The shell the install tab uses on a POSIX host (T0412 `selectInstallShell` keeps bash). */
export const INSTALL_SHELL = '/bin/bash'
/** The runner waits this long after `created` before typing (T0412 range 2 step 5). */
const LAUNCH_DELAY_MS = 500
const TOOL_ID_RX = /^[a-z0-9]+$/
const POSIX_PATH_RX = /^\/[A-Za-z0-9._/ -]*$/
const OUTPUT_TAIL_LINES = 25

/** Shell profile files an installer may append a PATH block to (checksums + appended lines only). */
export const PROFILE_FILES = Object.freeze(['.profile', '.bashrc', '.bash_profile', '.bash_login', '.zshrc', '.zprofile', '.zshenv', '.config/fish/conf.d', '.config/fish/config.fish'])

const USAGE = `Usage: node scripts/remote-tools-install-check.mjs (--target wsl:<distro> | --url wss://host:port --token-file <path> --fingerprint <sha256>) [options]

  --tool <id>             Tool to plan / install (repeatable; default: ${DEFAULT_TOOLS.join(', ')})
  --kind install|update   buildInstallPlan or buildUpdatePlan (default: install)
  --yes                   Really run the plan in a remote PTY (default: dry-run, prints the plan only)
  --shell-check           After the tools (or alone): open a fresh login PTY and report command -v,
                          PATH order of ~/.local/bin vs /mnt/*, and the \`codex login status\` exit code
  --host / --port         wsl target overrides (as in smoke-remote-headless)
  --cwd <posix path>      PTY working directory (default: wsl $HOME, else /tmp)
  --install-timeout-ms    Per-install timeout (default ${DEFAULT_INSTALL_TIMEOUT_MS})
  --json                  Machine-readable output
  -h, --help              Show this help`

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseMs(raw, flag, min) {
  const ms = /^\d+$/.test(String(raw)) ? Number.parseInt(String(raw), 10) : NaN
  if (!Number.isInteger(ms) || ms < min) throw new UsageError(`Invalid ${flag} value: ${raw}`)
  return ms
}

/**
 * `knownTools` is `REMOTE_TOOL_IDS` (src/types/remote-tools.ts); main passes it after loading the
 * TS modules, tests pass it directly.
 */
export function parseArgs(argv, { knownTools = DEFAULT_TOOLS } = {}) {
  let values
  try {
    ;({ values } = parseNodeArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        target: { type: 'string' },
        url: { type: 'string' },
        'token-file': { type: 'string' },
        fingerprint: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'string' },
        cwd: { type: 'string' },
        tool: { type: 'string', multiple: true },
        kind: { type: 'string' },
        yes: { type: 'boolean', default: false },
        'shell-check': { type: 'boolean', default: false },
        'install-timeout-ms': { type: 'string' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    }))
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }

  const opts = {
    help: values.help,
    json: values.json,
    yes: values.yes,
    shellCheck: values['shell-check'],
    kind: 'install',
    tools: [...DEFAULT_TOOLS],
    cwd: null,
    installTimeoutMs: DEFAULT_INSTALL_TIMEOUT_MS,
    target: null,
  }
  if (opts.help) return opts

  if (values.kind !== undefined) {
    if (!INSTALL_KINDS.includes(values.kind)) throw new UsageError(`Invalid --kind ${JSON.stringify(values.kind)} (install | update)`)
    opts.kind = values.kind
  }
  if (values.tool !== undefined) {
    const tools = []
    for (const id of values.tool) {
      if (!TOOL_ID_RX.test(id) || !knownTools.includes(id)) throw new UsageError(`Unknown --tool ${JSON.stringify(id)} (known: ${knownTools.join(', ')})`)
      if (!tools.includes(id)) tools.push(id)
    }
    opts.tools = tools
  } else if (opts.shellCheck) {
    // --shell-check alone: no tool step.
    opts.tools = []
  }
  if (values['install-timeout-ms'] !== undefined) opts.installTimeoutMs = parseMs(values['install-timeout-ms'], '--install-timeout-ms', 1000)
  if (values.cwd !== undefined) {
    if (!POSIX_PATH_RX.test(values.cwd) || values.cwd.split('/').includes('..')) {
      throw new UsageError(`--cwd must be an absolute POSIX path without special characters: ${JSON.stringify(values.cwd)}`)
    }
    opts.cwd = values.cwd
  }

  const hasTarget = values.target !== undefined
  const hasUrl = values.url !== undefined
  if (hasTarget === hasUrl) throw new UsageError('Specify exactly one of --target wsl:<distro> or --url wss://host:port')
  if (hasTarget) {
    if (values['token-file'] !== undefined || values.fingerprint !== undefined) {
      throw new UsageError('--token-file / --fingerprint only apply to --url (wsl targets read them from the distro)')
    }
    const host = values.host ?? DEFAULT_HOST
    if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new UsageError(`Invalid --host ${JSON.stringify(host)}`)
    let port = null
    if (values.port !== undefined) {
      port = /^\d+$/.test(values.port) ? Number.parseInt(values.port, 10) : NaN
      if (!(port >= 1 && port <= 65535)) throw new UsageError(`Invalid --port value: ${values.port}`)
    }
    opts.target = { ...parseTarget(values.target), host, port }
    return opts
  }
  if (values.host !== undefined || values.port !== undefined) throw new UsageError('--host / --port only apply to --target')
  if (!values['token-file']) throw new UsageError('--url requires --token-file')
  if (!values.fingerprint) throw new UsageError('--url requires --fingerprint')
  opts.target = { kind: 'url', url: parseServerUrl(values.url), tokenFile: values['token-file'], fingerprint: normalizeFingerprint(values.fingerprint) }
  return opts
}

// ---------------------------------------------------------------------------
// TS module loading (src/lib/remote-tools/*.ts)
// ---------------------------------------------------------------------------

const SRC_URL_PREFIX = `${pathToFileURL(SRC_DIR).href}/`
let hooksRegistered = false

/** Resolve hook: inside `src/`, extensionless relative imports get `.ts`; `.ts` loads as TS. */
export function resolveSrcTypeScript(specifier, context, nextResolve) {
  const fromSrc = typeof context.parentURL === 'string' && context.parentURL.startsWith(SRC_URL_PREFIX)
  if (fromSrc && /^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    return { ...nextResolve(`${specifier}.ts`, context), format: 'module-typescript' }
  }
  const result = nextResolve(specifier, context)
  if (result.url.startsWith(SRC_URL_PREFIX) && result.url.endsWith('.ts')) return { ...result, format: 'module-typescript' }
  return result
}

export async function loadRemoteToolsModules() {
  if (!hooksRegistered) {
    registerHooks({ resolve: resolveSrcTypeScript })
    hooksRegistered = true
  }
  const url = (rel) => pathToFileURL(path.join(SRC_DIR, rel)).href
  const [recipes, sentinel, types] = await Promise.all([
    import(url('lib/remote-tools/recipes.ts')),
    import(url('lib/remote-tools/sentinel.ts')),
    import(url('types/remote-tools.ts')),
  ])
  return { recipes, sentinel, types }
}

// ---------------------------------------------------------------------------
// Fixed diagnostic one-liners (payload base64-encoded so the terminal cannot mangle it)
// ---------------------------------------------------------------------------

/**
 * `printf '\n__T0414_%s_%s__%s__END__\n' '<nonce>' '<label>' "$(<expr> | base64 -w0)"`.
 * The echoed command line only contains the format string, never `<nonce>_<label>__`, so only
 * the executed printf matches (same trick as the install sentinel).
 */
export function buildProbeLine(nonce, label, expr) {
  if (!/^[0-9a-f]{16}$/.test(nonce)) throw new TypeError('probe nonce must be 16 hex chars')
  if (!/^[a-z0-9-]+$/.test(label)) throw new TypeError('probe label must be [a-z0-9-]')
  return `printf '\\n__T0414_%s_%s__%s__END__\\n' '${nonce}' '${label}' "$( { ${expr} ; } 2>&1 | base64 -w0)"`
}

export function probeRegex(nonce, label) {
  return new RegExp(`__T0414_${nonce}_${label}__([A-Za-z0-9+/=]*)__END__`)
}

export function decodeProbePayload(b64) {
  return Buffer.from(b64, 'base64').toString('utf8')
}

/** Names only: never prints any other variable (the PTY env also carries BAT_REMOTE_TOKEN). */
export const ENV_PROBE_EXPR = `env | grep -E '^DISABLE_(UPDATES|AUTOUPDATER)=' | sort`

/** `<file>|<cksum>|<lines>` per existing profile file; only checksums and line counts. */
export const PROFILE_SNAPSHOT_EXPR =
  `for f in ${PROFILE_FILES.map((f) => `"$HOME/${f}"`).join(' ')}; do ` +
  `if [ -f "$f" ]; then printf '%s|%s|%s\\n' "\${f#$HOME/}" "$(cksum < "$f" | cut -d' ' -f1)" "$(wc -l < "$f")"; fi; done`

/** Lines after `fromLine` of one profile file (the block an installer appended). */
export function profileTailExpr(file, fromLine) {
  if (!PROFILE_FILES.includes(file)) throw new TypeError('not a known profile file')
  if (!Number.isInteger(fromLine) || fromLine < 0) throw new TypeError('fromLine must be a non-negative integer')
  return `tail -n +${fromLine + 1} "$HOME/${file}"`
}

export const SHELL_CHECK_EXPR = [
  `for t in claude codex uv gh rg; do printf 'command-v %s=%s\\n' "$t" "$(command -v "$t")"; done`,
  `printf 'type-a codex=%s\\n' "$(type -ap codex | tr '\\n' ' ')"`,
  `printf 'path-index local-bin=%s\\n' "$(printf '%s\\n' "$PATH" | tr ':' '\\n' | grep -n -m1 -x -F "$HOME/.local/bin" | cut -d: -f1)"`,
  `printf 'path-index first-mnt=%s\\n' "$(printf '%s\\n' "$PATH" | tr ':' '\\n' | grep -n -m1 '^/mnt/' | cut -d: -f1)"`,
  `printf 'path-count=%s\\n' "$(printf '%s\\n' "$PATH" | tr ':' '\\n' | grep -c .)"`,
].join('; ')

/** Exit code only (stdout / stderr discarded); skipped when codex resolves to Windows interop. */
export const CODEX_LOGIN_STATUS_EXPR =
  `c=$(command -v codex); case "$c" in ''|/mnt/*) printf 'skipped codex=%s\\n' "$c" ;; ` +
  `*) timeout 30 codex login status >/dev/null 2>&1; printf 'codex=%s exit=%s\\n' "$c" "$?" ;; esac`

export function parseProfileSnapshot(text) {
  const map = new Map()
  for (const line of String(text).split('\n')) {
    const m = /^([^|]+)\|(\d+)\|\s*(\d+)$/.exec(line.trim())
    if (m) map.set(m[1], { cksum: m[2], lines: Number(m[3]) })
  }
  return map
}

/** Files that are new or whose checksum changed between two snapshots. */
export function diffProfileSnapshots(before, after) {
  const changed = []
  for (const [file, now] of after) {
    const was = before.get(file)
    if (!was) changed.push({ file, kind: 'created', fromLine: 0, linesBefore: 0, linesAfter: now.lines })
    else if (was.cksum !== now.cksum) changed.push({ file, kind: 'modified', fromLine: was.lines, linesBefore: was.lines, linesAfter: now.lines })
  }
  for (const [file, was] of before) {
    if (!after.has(file)) changed.push({ file, kind: 'removed', fromLine: 0, linesBefore: was.lines, linesAfter: 0 })
  }
  return changed
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function makePtyId(step, now = new Date(), rand = randomBytes(3).toString('hex')) {
  const p = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  return `${PTY_ID_PREFIX}${stamp}-${rand}-${step}`
}

export function toolSnapshot(report, toolId) {
  const t = report?.tools?.find((x) => x && x.id === toolId)
  if (!t) return null
  const out = { status: t.status, serverVisible: t.serverVisible }
  if (t.path) out.path = t.path
  if (t.version) out.version = t.version
  if (t.login) out.login = t.login
  return out
}

function tailLines(text, n = OUTPUT_TAIL_LINES) {
  return String(text).replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).filter((l) => l.trim()).slice(-n)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs the check. `deps.modules` = `loadRemoteToolsModules()` result; `deps.createClient` lets
 * tests inject a fake; `deps.log` receives progress lines.
 */
export async function runCheck(conn, opts, deps) {
  const { modules, log = () => {}, createClient, launchDelayMs = LAUNCH_DELAY_MS } = deps
  const { recipes, sentinel } = modules
  const stepTimeoutMs = opts.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS
  const cwd = opts.cwd ?? conn.cwd ?? '/tmp'
  const client = (createClient ?? (() => new SmokeClient({ url: conn.url, token: conn.token, fingerprint: conn.fingerprint, timeoutMs: stepTimeoutMs, label: 'BAT install check (T0414)' })))()
  const ownIds = new Set()
  const tracker = new PtyTracker(ownIds)
  const rawListeners = new Map()
  const result = { target: conn.label, mode: opts.yes ? 'execute' : 'dry-run', kind: opts.kind, cwd, steps: [], shellCheck: null, leftovers: [] }

  client.onEvent((channel, args) => {
    tracker.handle(channel, args)
    const id = args[0]
    if (channel === SMOKE_EVENTS.PTY_OUTPUT && typeof id === 'string' && rawListeners.has(id)) rawListeners.get(id)(String(args[1] ?? ''))
  })

  const detect = async () => {
    const answer = await client.invokeWithTimeout(Math.max(stepTimeoutMs, REMOTE_TOOLS_DETECT_TIMEOUT_MS), SMOKE_CHANNELS.REMOTE_TOOLS_DETECT)
    if (!answer || answer.ok !== true) throw new Error(`remote-tools:detect → ${JSON.stringify(answer)?.slice(0, 200)}`)
    return answer.report
  }

  const openPty = async (step) => {
    const id = makePtyId(step)
    ownIds.add(id)
    const offset = tracker.mark(id)
    // No agentPreset: the claude-cli presets inject DISABLE_UPDATES, which blocks `claude install`.
    const created = await client.invoke(SMOKE_CHANNELS.PTY_CREATE, { id, cwd, type: 'terminal', shell: INSTALL_SHELL })
    const outcome = ptyCreateOutcome(created)
    if (!outcome.ok || outcome.created === false) throw new Error(`pty:create(${id}) → ${JSON.stringify(created)}`)
    await tracker.waitFor(() => tracker.since(id, offset).length > 0 || undefined, stepTimeoutMs, `first output of ${id}`)
    await sleep(launchDelayMs)
    return id
  }

  const write = async (id, data) => {
    const answer = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, id, data)
    if (!answer || answer.ok !== true) throw new Error(`pty:write(${id}) → ${JSON.stringify(answer)}`)
  }

  const probe = async (id, label, expr, timeoutMs = stepTimeoutMs) => {
    const nonce = sentinel.generateNonce()
    const offset = tracker.mark(id)
    await write(id, `${buildProbeLine(nonce, label, expr)}\r`)
    const match = await tracker.waitForOutput(id, probeRegex(nonce, label), offset, timeoutMs)
    return decodeProbePayload(match[1])
  }

  const closePty = async (id) => {
    try {
      await client.invoke(SMOKE_CHANNELS.PTY_KILL, id)
      const answer = await client.invoke(SMOKE_CHANNELS.PTY_WRITE, id, '\r')
      if (!(answer && answer.ok === false && answer.reason === 'pty-not-found')) result.leftovers.push(id)
    } catch (error) {
      result.leftovers.push(`${id} (${error instanceof Error ? error.message : String(error)})`)
    } finally {
      rawListeners.delete(id)
    }
  }

  try {
    await client.connect()
    let report = await detect()
    const env = recipes.normalizeRecipeEnv(report.env)
    result.env = { ...env, osId: report.env.osId, osVersion: report.env.osVersion, arch: report.env.arch, isWsl: report.env.isWsl }
    log(`env ${JSON.stringify(result.env)}`)

    for (const toolId of opts.tools) {
      const step = { toolId, kind: opts.kind, before: toolSnapshot(report, toolId) }
      result.steps.push(step)
      const plan = opts.kind === 'update' ? recipes.buildUpdatePlan(toolId, env) : recipes.buildInstallPlan(toolId, env)
      if (!recipes.isInstallPlan(plan)) {
        step.unsupported = plan.unsupported
        log(`${toolId}: unsupported (${plan.unsupported})`)
        continue
      }
      step.plan = { command: plan.command, needsSudo: plan.needsSudo, installPath: plan.installPath ?? null, scriptUrl: plan.scriptUrl ?? null }
      log(`${toolId}: plan ${plan.kind}${plan.needsSudo ? ' (sudo)' : ''} → ${plan.command}`)
      if (!opts.yes) continue

      const nonce = sentinel.generateNonce()
      const typed = sentinel.wrapWithSentinel(plan.command, nonce)
      step.run = { ptyId: null, typed, exitCode: null, durationMs: null, timedOut: false }
      let ptyId = null
      try {
        ptyId = await openPty(toolId)
        step.run.ptyId = ptyId
        step.run.env = (await probe(ptyId, 'env', ENV_PROBE_EXPR)).split('\n').filter(Boolean)
        const profilesBefore = parseProfileSnapshot(await probe(ptyId, 'profiles', PROFILE_SNAPSHOT_EXPR))

        const matcher = sentinel.createSentinelMatcher(nonce)
        let resolveExit
        const exited = new Promise((resolve) => { resolveExit = resolve })
        rawListeners.set(ptyId, (chunk) => {
          const code = matcher.feed(chunk)
          if (code !== null) resolveExit(code)
        })
        const offset = tracker.mark(ptyId)
        const startedAt = Date.now()
        await write(ptyId, `${typed}\r`)
        let timer
        const code = await Promise.race([
          exited,
          new Promise((resolve) => { timer = setTimeout(() => resolve(null), opts.installTimeoutMs) }),
        ])
        clearTimeout(timer)
        step.run.durationMs = Date.now() - startedAt
        step.run.outputTail = tailLines(tracker.since(ptyId, offset))
        if (code === null) {
          step.run.timedOut = true
          await write(ptyId, '\x03').catch(() => undefined)
          log(`${toolId}: TIMEOUT after ${step.run.durationMs} ms`)
        } else {
          step.run.exitCode = code
          log(`${toolId}: exit ${code} in ${step.run.durationMs} ms`)
          const profilesAfter = parseProfileSnapshot(await probe(ptyId, 'profiles', PROFILE_SNAPSHOT_EXPR))
          step.run.profileChanges = []
          for (const change of diffProfileSnapshots(profilesBefore, profilesAfter)) {
            const entry = { ...change }
            if (change.kind !== 'removed') entry.added = (await probe(ptyId, 'profile-tail', profileTailExpr(change.file, change.fromLine))).split('\n')
            step.run.profileChanges.push(entry)
          }
        }
      } catch (error) {
        step.run.error = error instanceof Error ? error.message : String(error)
        log(`${toolId}: ERROR ${step.run.error}`)
      } finally {
        if (ptyId) await closePty(ptyId)
      }
      report = await detect()
      step.after = toolSnapshot(report, toolId)
      log(`${toolId}: before ${JSON.stringify(step.before)} → after ${JSON.stringify(step.after)}`)
    }

    if (opts.shellCheck && opts.yes) {
      let ptyId = null
      result.shellCheck = {}
      try {
        // A brand-new login shell: ~/.profile only prepends ~/.local/bin when it exists at login.
        ptyId = await openPty('shell')
        result.shellCheck.ptyId = ptyId
        result.shellCheck.lines = (await probe(ptyId, 'shell', SHELL_CHECK_EXPR)).split('\n').filter(Boolean)
        result.shellCheck.codexLoginStatus = (await probe(ptyId, 'codex-login', CODEX_LOGIN_STATUS_EXPR, 45_000)).trim()
        result.shellCheck.env = (await probe(ptyId, 'env', ENV_PROBE_EXPR)).split('\n').filter(Boolean)
      } catch (error) {
        result.shellCheck.error = error instanceof Error ? error.message : String(error)
      } finally {
        if (ptyId) await closePty(ptyId)
      }
      log(`shell-check ${JSON.stringify(result.shellCheck)}`)
    } else if (opts.shellCheck) {
      result.shellCheck = { skipped: 'dry-run (needs --yes)' }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  } finally {
    await client.close().catch(() => undefined)
  }

  result.ok = !result.error && result.leftovers.length === 0 &&
    result.steps.every((s) => !s.run || (s.run.exitCode === 0 && !s.run.error)) &&
    !(result.shellCheck && result.shellCheck.error)
  return result
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export async function main(argv = process.argv.slice(2), io = { out: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) }, deps = {}) {
  let modules
  try {
    modules = deps.modules ?? await loadRemoteToolsModules()
  } catch (error) {
    io.err(`[install-check] cannot load src/lib/remote-tools (Node >= 23.6 with type stripping required): ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }

  let opts
  try {
    opts = parseArgs(argv, { knownTools: modules.types.REMOTE_TOOL_IDS })
  } catch (error) {
    io.err(`[install-check] ${error.message}`)
    io.err(USAGE)
    return 2
  }
  if (opts.help) {
    io.out(USAGE)
    return 0
  }

  let conn
  try {
    conn = deps.conn ?? (opts.target.kind === 'wsl' ? await resolveWslTarget(opts.target) : resolveUrlTarget(opts.target))
  } catch (error) {
    io.err(`[install-check] cannot resolve connection info: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }

  const startedAt = new Date().toISOString()
  if (!opts.json) io.out(`[install-check] ${opts.yes ? 'EXECUTE' : 'DRY-RUN'} ${opts.kind} [${opts.tools.join(', ')}]${opts.shellCheck ? ' + shell-check' : ''} on ${conn.label} → ${conn.url}`)
  const result = await runCheck(conn, opts, {
    modules,
    createClient: deps.createClient,
    launchDelayMs: deps.launchDelayMs,
    log: opts.json ? () => {} : (line) => io.out(`[install-check] ${line}`),
  })
  result.startedAt = startedAt
  result.finishedAt = new Date().toISOString()

  if (opts.json) {
    io.out(JSON.stringify(result, null, 2))
  } else {
    if (result.error) io.out(`[install-check] ERROR ${result.error}`)
    if (result.leftovers.length > 0) io.out(`[install-check] LEFTOVER PTY: ${result.leftovers.join(', ')}`)
    io.out(`[install-check] RESULT: ${result.ok ? 'OK' : 'FAILED'}`)
  }
  return result.ok ? 0 : 1
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then((code) => {
    process.exitCode = code
  })
}
