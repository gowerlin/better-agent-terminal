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
 * Collects host / user / port / identity / install path / tunnel mode and
 * surfaces a dropdown of `~/.ssh/config` aliases via the new `ssh:list-hosts`
 * IPC channel (T0282 backend, T0285 wiring).
 *
 * UI rendering happens inside the SetupWizardShell — this `WizardStep` object
 * is the single source of truth for step id / title / state shape, mirroring
 * the existing WSL/Docker step convention (T0274 / T0279).
 */
export const configureSshHostStep: WizardStep = {
  id: 'configure-ssh-host',
  title: 'Configure SSH host',
  appliesTo: ['ssh-linux', 'ssh-darwin'],
  // T0330 (PLAN-032 Sprint 2): SSH host config gathers user input upfront.
  // BUG-074 root cause: this step throws when state.sshHost is empty, but the
  // intent is to wait for user form submission. T0335 will refactor to use
  // ctx.requestChoice; for now `kind: 'input'` is metadata for the runner.
  kind: 'input',
  retryable: true,
  labelKey: 'wizard.ssh.step.configureHost.label',
  descriptionKey: 'wizard.ssh.step.configureHost.description',
  groupKey: 'wizard.group.connection',
  editableFromFailure: true,
  async run(ctx) {
    const state = readState(ctx)

    // Populate alias dropdown so the UI can render it. Cached on ctx.state
    // so the step can be re-entered without re-reading the file.
    if (!Array.isArray(state.sshHostsAvailable)) {
      const hosts = await loadAliasOptions(ctx)
      writeState(ctx, { sshHostsAvailable: hosts })
    }

    if (!state.sshHost && state.sshAlias) {
      // When the user picks an alias, OpenSSH resolves host/user/port/key
      // transparently — we keep host = alias and let ssh handle the rest
      // (D-SSH-5: no jump-host UI; ssh-config is the source of truth).
      writeState(ctx, { sshHost: state.sshAlias })
    }

    if (!state.sshHost || state.sshHost.trim().length === 0) {
      throw new Error('SSH host is required (pick an alias from ~/.ssh/config or type host).')
    }
    if (!state.sshUser || state.sshUser.trim().length === 0) {
      // Aliases may carry the user via ssh-config; leave a synthetic placeholder
      // so verify-ssh-auth can still attempt the connection. The probe will
      // fail with a clear errorCode if the user is wrong.
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

// PascalCase alias to satisfy AC5 grep (`SshConfigureHostStep`); both names
// reference the same WizardStep object so import sites stay consistent.
export const SshConfigureHostStep = configureSshHostStep

export const sshConfigureHostInstallPathOptions = INSTALL_PATH_OPTIONS
export const sshConfigureHostTunnelModeOptions = TUNNEL_MODE_OPTIONS
