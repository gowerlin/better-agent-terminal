/**
 * T0412 (PLAN-037 E): runs one remote-tool install / update inside the remote profile
 * window (T0407 §4 "安裝"). Pure flow with injected effects; `useRemoteToolInstall`
 * wires it to the window's stores, PTY API and toasts.
 *
 *   detectHere() → rebuild the plan from this window's own report (never from a command
 *   string handed in) → workspace (or "BAT Tools" at the remote $HOME) → plain terminal
 *   tab (no agentPreset: `claude-cli*` injects DISABLE_UPDATES, which blocks
 *   `claude install`) → createPtyThenLaunch → type `wrapWithSentinel(cmd, nonce) + '\r'`
 *   only into a freshly created shell → sentinel exit code → re-detect → notices.
 *
 * Notices are i18n keys + params, so this module stays free of react / i18next.
 */
import type { CreatePtyOptions, PtyCreateResult } from '../../types'
import {
  REMOTE_TOOL_IDS,
  REMOTE_TOOL_INSTALL_KINDS,
  type RemoteToolId,
  type RemoteToolInstallKind,
  type RemoteToolsDetectResult,
} from '../../types/remote-tools'
import { unsupportedRemoteChannel } from '../remote-unsupported'
import { buildInstallPlan, buildUpdatePlan, isInstallPlan, normalizeRecipeEnv, type InstallPlan } from './recipes'
import { createSentinelMatcher, generateNonce as defaultGenerateNonce, stripAnsi, SENTINEL_NONCE_RE, wrapWithSentinel } from './sentinel'

/** Window event a `host: 'remote-window'` tools panel fires; this window's hook runs the install. */
export const REMOTE_TOOL_INSTALL_HERE_EVENT = 'remote-tool-install-here'

export interface RemoteToolInstallTarget {
  toolId: RemoteToolId
  kind: RemoteToolInstallKind
}

/** Panel `onInstall` for `host: 'remote-window'`: only tool + kind travel, the hook rebuilds the plan. */
export function requestRemoteToolInstallHere(plan: Pick<InstallPlan, 'toolId' | 'kind'>, target: Pick<Window, 'dispatchEvent'> = window): void {
  target.dispatchEvent(new CustomEvent<RemoteToolInstallTarget>(REMOTE_TOOL_INSTALL_HERE_EVENT, {
    detail: { toolId: plan.toolId, kind: plan.kind },
  }))
}

/** Tool + kind from untrusted input (event detail, IPC answer); null when either is not a known enum value. */
export function parseRemoteToolInstallTarget(value: unknown): RemoteToolInstallTarget | null {
  if (!value || typeof value !== 'object') return null
  const { toolId, kind } = value as { toolId?: unknown; kind?: unknown }
  if (typeof toolId !== 'string' || !(REMOTE_TOOL_IDS as readonly string[]).includes(toolId)) return null
  if (typeof kind !== 'string' || !(REMOTE_TOOL_INSTALL_KINDS as readonly string[]).includes(kind)) return null
  return { toolId: toolId as RemoteToolId, kind: kind as RemoteToolInstallKind }
}

// ─── Shell ───────────────────────────────────────────────────────────────────

/** Shells that run the recipes (`$?`, `out=$(mktemp)`, `&&`) and the sentinel printf as written. */
export const POSIX_SHELL_NAMES: readonly string[] = ['sh', 'bash', 'zsh', 'dash', 'ksh', 'mksh', 'ash', 'yash']
export const POSIX_FALLBACK_SHELL = '/bin/sh'

/**
 * The install tab's shell: the user's shell when it is POSIX-family; otherwise (fish, nushell,
 * xonsh, unknown) `/bin/sh`, which every Linux / macOS host has.
 */
export function selectInstallShell(shell: string | undefined): { shell: string; replaced?: string } {
  if (shell) {
    const base = shell.split(/[\\/]/).pop() ?? ''
    if (POSIX_SHELL_NAMES.includes(base)) return { shell }
    return { shell: POSIX_FALLBACK_SHELL, replaced: shell }
  }
  return { shell: POSIX_FALLBACK_SHELL }
}

// ─── Remote $HOME (for the "BAT Tools" workspace) ────────────────────────────

const HOME_PREFIX = '__BAT_HOME_'
const HOME_RE_TAIL = '__(\\/[^\\r\\n]*?)__END__'
/** Absolute, printable, no `..` games; it becomes a workspace folder (= PTY cwd). */
const HOME_PATH_RE = /^\/[A-Za-z0-9._@+ \/-]{0,510}$/
const HOME_PROBE_TIMEOUT_MS = 8000
const HOME_TAIL_CHARS = 4096

export interface HomeProbeDeps {
  createPty(options: CreatePtyOptions): Promise<PtyCreateResult>
  write(id: string, data: string): void
  kill(id: string): void
  onOutput(cb: (id: string, data: string) => void): () => void
  generateNonce?: () => string
  timeoutMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

/** Fixed command; only the nonce (16 hex) is inserted. The echoed line holds the format, not `<nonce>__/`. */
export function buildHomeProbeCommand(nonce: string): string {
  if (!SENTINEL_NONCE_RE.test(nonce)) throw new TypeError('remote-tools home probe: bad nonce')
  return `printf '\\n${HOME_PREFIX}%s__%s__END__\\n' '${nonce}' "$HOME"`
}

/**
 * Asks the remote login shell for `$HOME` through a short-lived hidden PTY (no tab; killed
 * afterwards). The window has no other way to learn the remote home. Null on timeout, a PTY
 * that was not freshly created, or a path that fails `HOME_PATH_RE`.
 */
export async function probeRemoteHome(deps: HomeProbeDeps): Promise<string | null> {
  const nonce = (deps.generateNonce ?? defaultGenerateNonce)()
  const id = `bat-home-probe-${nonce}`
  const marker = new RegExp(`${HOME_PREFIX}${nonce}${HOME_RE_TAIL}`)
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  let tail = ''
  let settle: (home: string | null) => void = () => {}
  const result = new Promise<string | null>((resolve) => { settle = resolve })
  const unsubscribe = deps.onOutput((outId, data) => {
    if (outId !== id || typeof data !== 'string') return
    tail = (tail + data).slice(-HOME_TAIL_CHARS)
    const m = marker.exec(stripAnsi(tail))
    if (m) settle(HOME_PATH_RE.test(m[1]) && !m[1].split('/').includes('..') ? m[1] : null)
  })
  const timer = setTimer(() => settle(null), deps.timeoutMs ?? HOME_PROBE_TIMEOUT_MS)
  try {
    const created = await deps.createPty({ id, cwd: '/', type: 'terminal', shell: POSIX_FALLBACK_SHELL })
    if (!created.ok || !created.created) return null
    deps.write(id, buildHomeProbeCommand(nonce) + '\r')
    return await result
  } catch {
    return null
  } finally {
    clearTimer(timer)
    unsubscribe()
    try { deps.kill(id) } catch { /* best effort */ }
  }
}

// ─── Install ─────────────────────────────────────────────────────────────────

export type InstallNoticeLevel = 'success' | 'info' | 'warning'

export interface InstallNotice {
  level: InstallNoticeLevel
  /** i18n key (`remoteToolInstall.*`, or `remoteTools.unsupported.*` / `remoteTools.error.*`). */
  key: string
  params?: Record<string, string>
}

export interface InstallWorkspace {
  id: string
  folderPath: string
}

export interface InstallRunnerDeps {
  detectHere(): Promise<RemoteToolsDetectResult>
  /** The workspace that hosts the tab (made active); null = none and none could be created. */
  ensureWorkspace(): Promise<InstallWorkspace | null>
  /** The shell a new terminal of this window would use (settings), before the POSIX check. */
  resolveShell(): Promise<string | undefined>
  /** Adds a plain terminal tab (🔴 no agentPreset), focuses it, returns its id. */
  addTerminal(workspaceId: string, plan: InstallPlan): string
  /** `createPtyThenLaunch`: `launch` runs only when a shell was freshly spawned. */
  createPty(options: CreatePtyOptions, launch: () => void): Promise<PtyCreateResult>
  write(id: string, data: string): void
  onOutput(cb: (id: string, data: string) => void): () => void
  onExit(cb: (id: string, exitCode: number) => void): () => void
  notify(notice: InstallNotice): void
  customEnv?(workspaceId: string): Record<string, string>
  generateNonce?: () => string
  /** Delay before typing so the prompt is up (default: setTimeout 500ms, as the claude-cli launch). */
  schedule?: (fn: () => void) => void
  log?: (message: string) => void
}

export type InstallCompletion =
  | { kind: 'exit'; exitCode: number }
  | { kind: 'pty-exit'; exitCode: number }

export type InstallStart =
  | { status: 'started'; terminalId: string; plan: InstallPlan; done: Promise<InstallCompletion> }
  | { status: 'detect-failed' | 'unsupported' | 'invalid-report' | 'no-workspace' | 'pty-failed'; terminalId?: string }

function toolParams(toolId: RemoteToolId, extra?: Record<string, string>): Record<string, string> {
  return { toolKey: `remoteTools.tool.${toolId}.name`, ...extra }
}

async function detect(deps: InstallRunnerDeps): Promise<RemoteToolsDetectResult> {
  try {
    return await deps.detectHere()
  } catch (err) {
    // bat-server before T0411 rejects with `No handler for channel: remote-tools:detect`.
    if (unsupportedRemoteChannel(err) === 'remote-tools:detect') {
      return { ok: false, errorCode: 'server-too-old', error: err instanceof Error ? err.message : String(err) }
    }
    return { ok: false, errorCode: 'invoke-failed', error: err instanceof Error ? err.message : String(err) }
  }
}

/** Result notice from the re-detect after exit 0 (the report decides — `curl | sh` can exit 0 on failure). */
export function completionNotice(target: RemoteToolInstallTarget, redetect: RemoteToolsDetectResult): InstallNotice {
  if (!redetect.ok) {
    return { level: 'warning', key: 'remoteToolInstall.result.redetectFailed', params: toolParams(target.toolId, { errorKey: `remoteTools.error.${redetect.errorCode}` }) }
  }
  const tool = redetect.report.tools.find(t => t.id === target.toolId)
  switch (tool?.status) {
    case 'ok':
      return {
        level: 'success',
        key: target.kind === 'update' ? 'remoteToolInstall.result.updated' : 'remoteToolInstall.result.installed',
        params: toolParams(target.toolId, { version: tool.version ?? '' }),
      }
    case 'too-old':
      return { level: 'warning', key: 'remoteToolInstall.result.tooOld', params: toolParams(target.toolId, { version: tool.version ?? '' }) }
    case 'not-on-path':
      return { level: 'info', key: 'remoteToolInstall.result.notOnPath', params: toolParams(target.toolId, { path: tool.path ?? '' }) }
    default:
      // missing / interop-only / error / absent from the report: the installer did not land.
      return { level: 'warning', key: 'remoteToolInstall.result.notDetected', params: toolParams(target.toolId) }
  }
}

const REOPEN_HINT: InstallNotice = { level: 'info', key: 'remoteToolInstall.hint.reopenTabs' }

/**
 * Starts the install and returns once the command is typed (or the run stopped early).
 * `done` settles when the sentinel arrives (after the re-detect notice) or the PTY exits first.
 */
export async function runRemoteToolInstall(target: RemoteToolInstallTarget, deps: InstallRunnerDeps): Promise<InstallStart> {
  const log = deps.log ?? (() => {})
  const first = await detect(deps)
  if (!first.ok) {
    deps.notify({ level: 'warning', key: 'remoteToolInstall.error.detectFailed', params: toolParams(target.toolId, { errorKey: `remoteTools.error.${first.errorCode}` }) })
    return { status: 'detect-failed' }
  }

  let plan: InstallPlan
  try {
    const env = normalizeRecipeEnv(first.report.env)
    const built = target.kind === 'update' ? buildUpdatePlan(target.toolId, env) : buildInstallPlan(target.toolId, env)
    if (!isInstallPlan(built)) {
      deps.notify({ level: 'warning', key: 'remoteToolInstall.error.unsupported', params: toolParams(target.toolId, { reasonKey: `remoteTools.unsupported.${built.unsupported}` }) })
      return { status: 'unsupported' }
    }
    plan = built
  } catch {
    // Tampered / malformed env (normalizeRecipeEnv throws without echoing the value).
    deps.notify({ level: 'warning', key: 'remoteToolInstall.error.invalidReport', params: toolParams(target.toolId) })
    return { status: 'invalid-report' }
  }

  const workspace = await deps.ensureWorkspace()
  if (!workspace) {
    deps.notify({ level: 'warning', key: 'remoteToolInstall.error.noWorkspace', params: toolParams(target.toolId) })
    return { status: 'no-workspace' }
  }

  const { shell, replaced } = selectInstallShell(await deps.resolveShell())
  if (replaced) deps.notify({ level: 'info', key: 'remoteToolInstall.hint.posixShell', params: { shell: replaced, fallback: shell } })

  const nonce = (deps.generateNonce ?? defaultGenerateNonce)()
  const line = wrapWithSentinel(plan.command, nonce) + '\r'
  const matcher = createSentinelMatcher(nonce)
  const schedule = deps.schedule ?? ((fn: () => void) => { setTimeout(fn, 500) })

  // Everything async is resolved above: tab + pty:create go out in one synchronous block, so
  // WorkspaceView's own init for the tab (default shell, after an await) cannot create it first.
  const terminalId = deps.addTerminal(workspace.id, plan)
  let finish: (c: InstallCompletion) => void = () => {}
  const completion = new Promise<InstallCompletion>((resolve) => { finish = resolve })
  let settled = false
  const unsubscribers: Array<() => void> = []
  const cleanup = () => { while (unsubscribers.length) unsubscribers.pop()!() }
  const settle = (c: InstallCompletion) => {
    if (settled) return
    settled = true
    cleanup()
    finish(c)
  }
  unsubscribers.push(deps.onOutput((id, data) => {
    if (id !== terminalId || settled) return
    const code = matcher.feed(data)
    if (code !== null) settle({ kind: 'exit', exitCode: code })
  }))
  unsubscribers.push(deps.onExit((id, exitCode) => {
    if (id === terminalId) settle({ kind: 'pty-exit', exitCode })
  }))

  const created = await deps.createPty({
    id: terminalId,
    cwd: workspace.folderPath,
    type: 'terminal',
    shell,
    customEnv: deps.customEnv?.(workspace.id) ?? {},
    workspaceId: workspace.id,  // T0176: BAT_WORKSPACE_ID env injection
  }, () => {
    schedule(() => deps.write(terminalId, line))
  })
  if (!created.ok || !created.created) {
    // created:false = an already-running shell under this id; never type into it.
    settled = true
    cleanup()
    log(`[T0412] install ${plan.toolId}/${plan.kind} terminal=${terminalId}: pty ok=${created.ok} created=${created.created}, command not typed`)
    deps.notify({ level: 'warning', key: 'remoteToolInstall.error.ptyFailed', params: toolParams(plan.toolId) })
    return { status: 'pty-failed', terminalId }
  }
  log(`[T0412] install ${plan.toolId}/${plan.kind} terminal=${terminalId} shell=${shell}`)

  const done = completion.then(async (c) => {
    if (c.kind === 'pty-exit') {
      deps.notify({ level: 'warning', key: 'remoteToolInstall.result.aborted', params: toolParams(plan.toolId) })
      return c
    }
    if (c.exitCode === 0) {
      deps.notify(completionNotice(target, await detect(deps)))
    } else {
      deps.notify({ level: 'warning', key: 'remoteToolInstall.result.failed', params: toolParams(plan.toolId, { code: String(c.exitCode) }) })
    }
    deps.notify(REOPEN_HINT)
    return c
  })
  return { status: 'started', terminalId, plan, done }
}
