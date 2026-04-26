import type { WizardContext, WizardStep } from '../../wizard-runner'

interface StartServerState {
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  sshInstallPath?: string
  sshServerHome?: string
  sshStartPhase?: 'writing-unit' | 'enabling' | 'starting' | 'verifying'
  sshStartCheckOutput?: string
  sshStartServicePath?: string
  sshStartLastError?: string
  sshStartLastErrorCode?: string
}

function makeStartId(): string {
  return `ssh-start-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const PHASE_LABELS: Record<NonNullable<StartServerState['sshStartPhase']>, string> = {
  'writing-unit': 'Writing service unit',
  'enabling': 'Reloading + enabling service',
  'starting': 'Starting bat-server',
  'verifying': 'Verifying service is active',
}

/**
 * Build the user-facing remediation hint for a structured `errorCode` from
 * `startServerOnRemote`. Kept exported so the UI shell can render the same
 * copy without coupling to the step's internal flow.
 */
export function startServerErrorHint(
  errorCode: string | undefined,
  rawError: string | undefined,
  targetOS: 'ssh-linux' | 'ssh-darwin',
): string {
  switch (errorCode) {
    case 'unit-write-failed':
      return targetOS === 'ssh-linux'
        ? [
            'Could not write the systemd unit file.',
            'Likely causes: disk quota exhausted, or `~/.config/systemd/user` is read-only.',
            rawError ? `Server reported: ${rawError}` : '',
          ].filter(Boolean).join('\n')
        : [
            'Could not write the launchd plist.',
            'Likely causes: disk quota exhausted, or `~/Library/LaunchAgents` is read-only.',
            rawError ? `Server reported: ${rawError}` : '',
          ].filter(Boolean).join('\n')

    case 'enable-failed':
      return targetOS === 'ssh-linux'
        ? [
            '`loginctl enable-linger` or `systemctl --user enable` failed.',
            'On hardened distros this needs `polkit` or root: try',
            '  sudo loginctl enable-linger <user>',
            'manually, then click Retry.',
            rawError ? `Server reported: ${rawError}` : '',
          ].filter(Boolean).join('\n')
        : [
            '`launchctl load -w` failed.',
            'Likely causes: another user owns the plist, or SIP rejected the load.',
            rawError ? `Server reported: ${rawError}` : '',
          ].filter(Boolean).join('\n')

    case 'start-failed':
      return targetOS === 'ssh-linux'
        ? [
            'The unit was registered but bat-server crashed on startup.',
            'Run `journalctl --user -u bat-server -n 50` over SSH and share the output.',
            rawError ? `Server reported: ${rawError}` : '',
          ].filter(Boolean).join('\n')
        : [
            'The plist was registered but bat-server crashed on startup.',
            'Run `tail -n 50 ~/Library/Logs/com.bat-server.log` over SSH (if logging is wired) and share the output.',
            rawError ? `Server reported: ${rawError}` : '',
          ].filter(Boolean).join('\n')

    case 'verify-failed':
      return targetOS === 'ssh-linux'
        ? [
            'Service appears to have started but verification did not see a listening socket.',
            'Run `systemctl --user status bat-server` over SSH to inspect the live state.',
            rawError ? `Server reported: ${rawError}` : '',
          ].filter(Boolean).join('\n')
        : [
            'Service appears to have started but `pgrep -x bat-server` did not find it.',
            'Run `launchctl list | grep com.bat-server` over SSH to inspect the live state.',
            rawError ? `Server reported: ${rawError}` : '',
          ].filter(Boolean).join('\n')

    default:
      return rawError ?? 'Failed to start bat-server on the remote host.'
  }
}

/**
 * `start-server` step (T0286 AC4/AC5/AC7/AC9).
 *
 * Calls `ssh:start-server` to lay down a systemd `--user` unit (linux) or
 * launchd LaunchAgent plist (darwin), enable+start it, then verify the
 * service is actually listening. Progress is rendered phase-by-phase via
 * `ssh:start-progress` events. On failure, surfaces a structured `errorCode`
 * so the shell can render targeted remediation copy.
 */
export const startServerStep: WizardStep = {
  id: 'start-server',
  title: 'Start bat-server (SSH)',
  appliesTo: ['ssh-linux', 'ssh-darwin'],
  retryable: true,
  async run(ctx: WizardContext) {
    const state = ctx.state as StartServerState
    if (!state.sshHost || !state.sshUser) {
      throw new Error('SSH host and user must be configured before starting the server.')
    }
    if (!state.sshInstallPath) {
      throw new Error('Install path must be selected before starting the server.')
    }
    if (!state.sshServerHome) {
      throw new Error('Server $HOME must be probed (verify-ssh-auth) before starting the server.')
    }
    if (ctx.targetOS !== 'ssh-linux' && ctx.targetOS !== 'ssh-darwin') {
      throw new Error(`start-server step is not applicable to targetOS=${ctx.targetOS}`)
    }

    const startId = makeStartId()
    const port = ctx.serverPort ?? 51820

    const unsubscribe = window.electronAPI.ssh.onStartProgress((payload) => {
      if (payload.startId !== startId) return
      state.sshStartPhase = payload.phase
      const label = PHASE_LABELS[payload.phase]
      ctx.logger.info(`⏳ ${label}…`)
    })

    try {
      ctx.logger.info(`Starting bat-server on ${state.sshUser}@${state.sshHost} (${ctx.targetOS})`)
      const result = await window.electronAPI.ssh.startServer({
        startId,
        options: {
          sshHost: state.sshHost,
          sshUser: state.sshUser,
          sshPort: state.sshPort,
          sshKeyPath: state.sshKeyPath,
          targetOS: ctx.targetOS,
          installPath: state.sshInstallPath,
          serverPort: port,
          serverHome: state.sshServerHome,
        },
      })

      if (!result.ok) {
        const hint = startServerErrorHint(result.errorCode, result.error, ctx.targetOS)
        state.sshStartLastError = hint
        state.sshStartLastErrorCode = result.errorCode
        throw new Error(`${result.errorCode ?? 'unknown'}: ${hint}`)
      }

      state.sshStartServicePath = result.servicePath
      state.sshStartCheckOutput = result.checkOutput
      state.sshStartLastError = undefined
      state.sshStartLastErrorCode = undefined
      ctx.systemdServiceActive = ctx.targetOS === 'ssh-linux' ? true : ctx.systemdServiceActive
      ctx.logger.info(`✓ bat-server is running (${result.method}) — unit: ${result.servicePath}`)
      if (result.checkOutput) {
        ctx.logger.info(`✓ verification: ${result.checkOutput.slice(0, 200)}`)
      }
    } finally {
      unsubscribe()
    }
  },
  // PLAN-007 T0289 — RFC C-3 best-effort rollback. Tears down the unit/plist
  // we registered: systemd `disable --now` + remove unit (linux), or
  // `launchctl unload` + remove plist (darwin). Failures warn-log only.
  async rollback(ctx) {
    const state = ctx.state as StartServerState
    if (!state.sshHost || !state.sshUser || !state.sshServerHome) {
      return
    }
    if (ctx.targetOS !== 'ssh-linux' && ctx.targetOS !== 'ssh-darwin') {
      return
    }
    const result = await window.electronAPI.ssh.stopServer({
      sshHost: state.sshHost,
      sshUser: state.sshUser,
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
      targetOS: ctx.targetOS,
      serverHome: state.sshServerHome,
    })
    if (!result.ok) {
      ctx.logger.warn(`Failed to stop bat-server over SSH (${ctx.targetOS}): ${result.error}`)
      return
    }
    ctx.systemdServiceActive = false
    state.sshStartServicePath = undefined
  },
}

export const SshStartServerStep = startServerStep

export const __sshStartServerCopy = {
  PHASE_LABELS,
}
