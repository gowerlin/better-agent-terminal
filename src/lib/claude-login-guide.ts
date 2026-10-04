/**
 * T0402 (PLAN-036 P1-G): "not logged in" guidance for the Claude Agent panel.
 *
 * `claude:auth-login` is a stub on both hosts, so logging in means running the CLI's
 * own `auth login` in a terminal. The panel asks the workspace (same window — a remote
 * window's terminals live on the remote host) to open a terminal tab with the login
 * command typed in but not submitted, then re-checks `claude:auth-status`.
 */
import { detectShellFamily, quoteCommandPath, type ShellFamily } from '../utils/shell-quote'

export interface ClaudeAuthStatus {
  loggedIn: boolean
  email?: string
  subscriptionType?: string
  authMethod?: string
}

/** Window event the Claude panel fires; the matching WorkspaceView opens the terminal tab. */
export const CLAUDE_OPEN_LOGIN_TERMINAL_EVENT = 'claude-open-login-terminal'

export interface ClaudeOpenLoginTerminalDetail {
  workspaceId: string
}

/** Guide only on a definite "logged out"; null (cannot tell) keeps the plain error display. */
export function shouldShowClaudeLoginGuide(status: ClaudeAuthStatus | null | undefined): boolean {
  return status?.loggedIn === false
}

/** `<quoted cli path> auth login`; an empty path (no runtime resolved) falls back to `claude`. */
export function buildClaudeLoginCommand(cliPath: string, shell: ShellFamily): string {
  const exe = cliPath ? quoteCommandPath(cliPath, shell) : 'claude'
  return `${exe} auth login`
}

export interface OpenClaudeLoginTerminalDeps {
  /** Adds the terminal tab to the workspace and returns its id. */
  addTerminal(): string
  getShell(): Promise<string | undefined>
  getCliPath(): Promise<string>
  /** Spawns the shell; `launch` must run only once a fresh shell exists. */
  createShell(terminalId: string, shell: string | undefined, launch: () => void): Promise<unknown>
  write(terminalId: string, data: string): void
  /** Delay before typing so the shell prompt is up (default: setTimeout 500ms). */
  schedule?: (fn: () => void) => void
}

/**
 * Opens a terminal tab and types the login command into it. No trailing Enter: the user
 * reviews the command and submits it.
 */
export async function openClaudeLoginTerminal(deps: OpenClaudeLoginTerminalDeps): Promise<{ terminalId: string; command: string }> {
  const terminalId = deps.addTerminal()
  const [shell, cliPath] = await Promise.all([deps.getShell(), deps.getCliPath()])
  const command = buildClaudeLoginCommand(cliPath, detectShellFamily(shell ?? ''))
  const schedule = deps.schedule ?? ((fn: () => void) => { setTimeout(fn, 500) })
  await deps.createShell(terminalId, shell, () => {
    schedule(() => deps.write(terminalId, command))
  })
  return { terminalId, command }
}

// One `claude auth status` spawn serves every Claude panel mounting at once (restored
// workspaces); a forced check (error / "Check again") always spawns afresh.
const AUTH_STATUS_TTL_MS = 30_000
let cachedAuthStatus: { at: number; promise: Promise<ClaudeAuthStatus | null> } | null = null

export function getClaudeAuthStatus(
  fetchStatus: () => Promise<ClaudeAuthStatus | null>,
  { force = false, now = Date.now() }: { force?: boolean; now?: number } = {},
): Promise<ClaudeAuthStatus | null> {
  if (!force && cachedAuthStatus && now - cachedAuthStatus.at < AUTH_STATUS_TTL_MS) {
    return cachedAuthStatus.promise
  }
  const promise = fetchStatus().catch(() => null)
  cachedAuthStatus = { at: now, promise }
  return promise
}

/** Test hook. */
export function resetClaudeAuthStatusCache(): void {
  cachedAuthStatus = null
}
