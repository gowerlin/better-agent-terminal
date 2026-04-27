import type { WizardChoiceOption, WizardContext, WizardStep } from '../../wizard-runner'

const INSTALL_PATH_OPTIONS = [
  { label: '~/.local/bat-server (recommended, no sudo)', value: '~/.local/bat-server', description: 'User-scope install, opt-in to /opt/bat-server later (T0286).' },
  { label: '/opt/bat-server (advanced, requires sudo)', value: '/opt/bat-server', description: 'System-scope install. v1 SSH wizard installs sudo path in T0286.' },
] satisfies WizardChoiceOption[]

const TUNNEL_MODE_OPTIONS = [
  { label: 'Tunnel (recommended)', value: 'tunnel', description: 'BAT opens an ssh -L LocalForward to keep the BAT server bound to localhost on the remote host.' },
  { label: 'Direct (advanced)', value: 'direct', description: 'Server binds directly on the remote host. Requires firewall rules and is opt-in.' },
] satisfies WizardChoiceOption[]

interface ConfigureSshHostState {
  sshAlias?: string
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  sshInstallPath?: string
  sshTunnelMode?: 'tunnel' | 'direct'
  sshHostsAvailable?: string[]
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
    if (
      (!state.sshHost || state.sshHost.trim().length === 0)
      && typeof ctx.requestChoice === 'function'
    ) {
      const aliases = readState(ctx).sshHostsAvailable ?? []
      if (aliases.length > 0) {
        const choice = await ctx.requestChoice({
          stepId: 'configure-ssh-host',
          title: 'Select SSH host',
          description: 'Pick an alias from ~/.ssh/config to connect to.',
          options: aliases.map((alias) => ({ label: alias, value: alias })),
          allowSkip: false,
        })
        if (typeof choice === 'string' && choice.length > 0) {
          writeState(ctx, { sshAlias: choice, sshHost: choice })
        }
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
    if (state.sshTunnelMode !== 'tunnel' && state.sshTunnelMode !== 'direct') {
      writeState(ctx, { sshTunnelMode: 'tunnel' })
    }

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
  },
}

export const SshConfigureHostStep = configureSshHostStep

export const sshConfigureHostInstallPathOptions = INSTALL_PATH_OPTIONS
export const sshConfigureHostTunnelModeOptions = TUNNEL_MODE_OPTIONS
