import type { WizardChoiceOption, WizardContext, WizardStep } from '../../wizard-runner'

const INSTALL_PATH_OPTIONS = [
  { label: '~/.local/bat-server (recommended, no sudo)', value: '~/.local/bat-server', description: 'User-scope install, opt-in to /opt/bat-server later (T0286).' },
  { label: '/opt/bat-server (advanced, requires sudo)', value: '/opt/bat-server', description: 'System-scope install. v1 SSH wizard installs sudo path in T0286.' },
] satisfies WizardChoiceOption[]

/**
 * T0425 (BUG-098, D134): the SSH wizard only supports tunnel mode. The remote
 * bat-server always binds to localhost (`ssh-start-server.ts`) and BAT reaches
 * it through `ssh -L`; the former "direct" option could never connect and was
 * removed rather than opened up to external interfaces.
 */
export type SshTunnelMode = 'tunnel'

/**
 * Pin `state.sshTunnelMode` to `'tunnel'`. Any other value (missing, or a
 * legacy `'direct'` carried in from a prefilled / older wizard state) is
 * treated as tunnel; a legacy `'direct'` is logged so the change is visible.
 */
export function normalizeSshTunnelMode(ctx: WizardContext): SshTunnelMode {
  const current: unknown = (ctx.state as { sshTunnelMode?: unknown }).sshTunnelMode
  if (current === 'direct') {
    ctx.logger.warn('SSH direct mode is no longer supported; using an SSH tunnel instead.')
  }
  ;(ctx.state as { sshTunnelMode?: SshTunnelMode }).sshTunnelMode = 'tunnel'
  return 'tunnel'
}

interface ConfigureSshHostState {
  sshAlias?: string
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  sshInstallPath?: string
  sshTunnelMode?: SshTunnelMode
  sshHostsAvailable?: string[]
  /** T0500: set by resetForEdit; the next run asks for the host even if one is stored. */
  sshHostEditRequested?: boolean
  /** T0502: host / user / port came from the manual entry, not an alias. */
  sshHostManual?: boolean
}

/**
 * T0502: choice value for "Enter host manually…". NUL cannot occur in an
 * ~/.ssh/config alias, so it never collides with one.
 */
const MANUAL_HOST_VALUE = '\u0000manual-host'
const MANUAL_HOST_INVALID_KEY = 'wizard.ssh.manualHost.invalid'

/** CLAUDE.md external-input whitelist; a leading `-` would parse as an ssh option. */
const SSH_NAME_RE = /^[a-zA-Z0-9._-]+$/
const MANUAL_HOST_RE = /^(?:([^@]+)@)?([^@:]+)(?::(\d{1,5}))?$/

export interface ManualSshHost {
  host: string
  user?: string
  port?: number
}

function isSshName(value: string, maxLength: number): boolean {
  return value.length <= maxLength && SSH_NAME_RE.test(value) && !value.startsWith('-')
}

/**
 * T0502: parse a typed SSH target — `host`, `user@host`, `host:port` or
 * `user@host:port` (the profile keeps user and port in their own fields).
 * Host and user must pass the whitelist; IPv6 literals are not accepted.
 * Returns null for anything else.
 */
export function parseManualSshHost(raw: string): ManualSshHost | null {
  const match = MANUAL_HOST_RE.exec(raw.trim())
  if (!match) return null
  const [, user, host, portText] = match
  if (!isSshName(host, 253)) return null
  if (user !== undefined && !isSshName(user, 64)) return null
  if (portText === undefined) return { host, user }
  const port = Number(portText)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return { host, user, port }
}

function formatManualSshHost(state: ConfigureSshHostState): string {
  if (!state.sshHost) return ''
  const user = state.sshUser ? `${state.sshUser}@` : ''
  const port = typeof state.sshPort === 'number' ? `:${state.sshPort}` : ''
  return `${user}${state.sshHost}${port}`
}

/**
 * T0502: ask for a typed host. Returns false when the user cancels; throws
 * `configure-host-invalid` when the value fails validation (the Shell
 * already blocks that, so this guards other callers). A manual entry sets
 * host, user and port together and drops the alias.
 */
async function askManualHost(ctx: WizardContext): Promise<boolean> {
  const value = await ctx.requestText!({
    stepId: 'configure-ssh-host',
    title: 'Enter SSH host',
    titleKey: 'wizard.ssh.manualHost.title',
    description: 'Host name or IP address, optionally as user@host or user@host:port.',
    descriptionKey: 'wizard.ssh.manualHost.description',
    placeholder: 'user@example.com:22',
    initialValue: formatManualSshHost(readState(ctx)),
    validate: (input) => (parseManualSshHost(input) ? null : MANUAL_HOST_INVALID_KEY),
  })
  if (typeof value !== 'string') return false
  const parsed = parseManualSshHost(value)
  if (!parsed) {
    const err = new Error(
      `SSH host ${JSON.stringify(value)} is invalid. Use host, user@host or user@host:port with letters, digits, ".", "_" or "-".`,
    ) as Error & { code?: string }
    err.code = 'configure-host-invalid'
    throw err
  }
  const state = readState(ctx)
  delete state.sshAlias
  writeState(ctx, {
    sshHost: parsed.host,
    sshUser: parsed.user ?? '',
    sshPort: parsed.port,
    sshHostManual: true,
  })
  return true
}

async function loadAliasOptions(ctx: WizardContext): Promise<string[]> {
  try {
    const hosts = await window.electronAPI.ssh.listHosts()
    return hosts
  } catch (error) {
    ctx.logger.warn(`Failed to read ~/.ssh/config: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

function readState(ctx: WizardContext): ConfigureSshHostState {
  return ctx.state as ConfigureSshHostState
}

function writeState(ctx: WizardContext, patch: ConfigureSshHostState): void {
  Object.assign(ctx.state, patch)
}

/**
 * `configure-ssh-host` step (T0285 AC5/AC6).
 *
 * T0335 (BUG-074, PLAN-032 Sprint 3): empty-host throw deferred until the
 * user actively submits via ctx.requestChoice. The runner's input-step
 * wrap flips status to awaiting-input while the prompt is pending, so the
 * step no longer flashes "failed" the moment the wizard opens. Structured
 * throws carry `code = 'configure-host-empty'` for WizardErrorMapper.
 */
export const configureSshHostStep: WizardStep = {
  id: 'configure-ssh-host',
  title: 'Configure SSH host',
  appliesTo: ['ssh-linux', 'ssh-darwin'],
  kind: 'input',
  retryable: true,
  labelKey: 'wizard.ssh.step.configureHost.label',
  descriptionKey: 'wizard.ssh.step.configureHost.description',
  groupKey: 'wizard.group.connection',
  editableFromFailure: true,
  async run(ctx) {
    const state = readState(ctx)
    const editRequested = state.sshHostEditRequested === true

    if (!Array.isArray(state.sshHostsAvailable)) {
      const hosts = await loadAliasOptions(ctx)
      writeState(ctx, { sshHostsAvailable: hosts })
    }

    if (!state.sshHost && state.sshAlias) {
      writeState(ctx, { sshHost: state.sshAlias })
    }

    // T0335 (BUG-074): defer the empty-host throw until the user actively
    // submits via ctx.requestChoice. Picking an alias = submit; the
    // resolver runs again afterwards and only throws (with a structured
    // errorCode) if the host is still empty.
    // T0500: after a jump back, ask again even though a host is stored.
    // T0502: when the UI can take typed input (ctx.requestText), the alias
    // list gets an "Enter host manually…" option, and with no alias at all
    // the host is typed directly.
    const hostMissing = !state.sshHost || state.sshHost.trim().length === 0
    const canType = typeof ctx.requestText === 'function'
    if (
      (hostMissing || editRequested)
      && (typeof ctx.requestChoice === 'function' || canType)
    ) {
      const aliases = readState(ctx).sshHostsAvailable ?? []
      if (aliases.length > 0 && typeof ctx.requestChoice === 'function') {
        const options: WizardChoiceOption[] = aliases.map((alias) => ({ label: alias, value: alias }))
        if (canType) {
          options.push({ label: 'Enter host manually…', labelKey: 'wizard.ssh.manualHost.option', value: MANUAL_HOST_VALUE })
        }
        const choice = await ctx.requestChoice({
          stepId: 'configure-ssh-host',
          title: 'Select SSH host',
          description: 'Pick an alias from ~/.ssh/config to connect to.',
          options,
          allowSkip: false,
        })
        if (choice === MANUAL_HOST_VALUE) {
          await askManualHost(ctx)
        } else if (typeof choice === 'string' && choice.length > 0) {
          // T0502: user / port typed with an earlier manual host do not
          // belong to the alias.
          if (state.sshHostManual) {
            delete state.sshUser
            delete state.sshPort
            delete state.sshHostManual
          }
          writeState(ctx, { sshAlias: choice, sshHost: choice })
        }
      } else if (canType) {
        const entered = await askManualHost(ctx)
        if (!entered && !hostMissing) {
          ctx.logger.info(`No SSH host entered; keeping SSH host ${state.sshHost}.`)
        }
      } else if (!hostMissing) {
        ctx.logger.info(`No ~/.ssh/config aliases to choose from; keeping SSH host ${state.sshHost}.`)
      }
    }

    if (!state.sshHost || state.sshHost.trim().length === 0) {
      const err = new Error(
        'SSH host is required (pick an alias from ~/.ssh/config or type host).',
      ) as Error & { code?: string }
      err.code = 'configure-host-empty'
      throw err
    }
    if (!state.sshUser || state.sshUser.trim().length === 0) {
      writeState(ctx, { sshUser: state.sshAlias ? '' : '' })
    }

    if (typeof state.sshInstallPath !== 'string' || state.sshInstallPath.trim().length === 0) {
      writeState(ctx, { sshInstallPath: INSTALL_PATH_OPTIONS[0].value })
    }
    normalizeSshTunnelMode(ctx)

    ctx.serverInstallPath = state.sshInstallPath ?? INSTALL_PATH_OPTIONS[0].value
    ctx.profileDraft = {
      ...ctx.profileDraft,
      sshHost: state.sshHost,
      sshUser: state.sshUser,
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
      sshAlias: state.sshAlias,
      sshTunnelMode: state.sshTunnelMode,
    }
    delete state.sshHostEditRequested
  },
  // T0500: jumped back to (e.g. after verify-ssh-auth fails) -> re-read
  // ~/.ssh/config and offer the alias picker again. The stored host stays as
  // the fallback when there is nothing to pick from (it may not be an alias).
  // Cleared once the step succeeds, so a retry asks again.
  resetForEdit(ctx) {
    writeState(ctx, { sshHostsAvailable: undefined, sshHostEditRequested: true })
  },
}

export const SshConfigureHostStep = configureSshHostStep

export const sshConfigureHostInstallPathOptions = INSTALL_PATH_OPTIONS
