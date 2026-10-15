import type { WizardContext, WizardStep } from '../../wizard-runner'
import { resolveSshInstallPath } from './remote-home'
import { describeSshTarget } from './ssh-target'

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
  /**
   * T0426 (BUG-099): false while run() has not reached the remote yet, true
   * once `ssh:start-server` was called. Rollback skips on false so a failure
   * before any remote change never tears down a service from an earlier setup.
   */
  sshStartServerTouchedRemote?: boolean
  /**
   * T0554 (BUG-141): the service before this run touched it (`unit` = the unit
   * / plist was backed up to `<file>.bat-prev`). Taken by the first attempt;
   * rollback restores it, finalize deletes the backup.
   */
  sshServicePrevious?: { unit: boolean; active: boolean; enabled: boolean }
  /** T0554: read from install-server-bundle's state (`kept` = bundle restore pending). */
  sshBundleInstall?: { previous: 'kept' | 'none' | 'unmanaged' }
  sshServiceStartAfterBundleRestore?: boolean
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
  labelKey: 'wizard.ssh.step.startServer.label',
  descriptionKey: 'wizard.ssh.step.startServer.description',
  groupKey: 'wizard.group.deployment',
  editableFromFailure: false,
  async run(ctx: WizardContext) {
    const state = ctx.state as StartServerState
    // T0554: sticky across retries (an earlier attempt may have written the unit).
    if (state.sshStartServerTouchedRemote !== true) state.sshStartServerTouchedRemote = false
    // T0505: the user may be empty (ssh config decides it).
    if (!state.sshHost) {
      throw new Error('SSH host must be configured before starting the server.')
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

    // T0379 / BUG-088: hand the main process an absolute path (same rule the
    // install step used for the upload). ssh-start-server re-validates it.
    const installPath = resolveSshInstallPath(state.sshInstallPath, state.sshServerHome)

    const startId = makeStartId()
    const port = ctx.serverPort ?? 51820

    const unsubscribe = window.electronAPI.ssh.onStartProgress((payload) => {
      if (payload.startId !== startId) return
      state.sshStartPhase = payload.phase
      const label = PHASE_LABELS[payload.phase]
      ctx.logger.info(`⏳ ${label}…`)
    })

    try {
      ctx.logger.info(`Starting bat-server on ${describeSshTarget(state.sshUser, state.sshHost)} (${ctx.targetOS})`)
      state.sshStartServerTouchedRemote = true
      const result = await window.electronAPI.ssh.startServer({
        startId,
        options: {
          sshHost: state.sshHost,
          sshUser: state.sshUser ?? '',
          sshPort: state.sshPort,
          sshKeyPath: state.sshKeyPath,
          targetOS: ctx.targetOS,
          installPath,
          serverPort: port,
          serverHome: state.sshServerHome,
          // T0554: back up the unit / plist once per run (a retry keeps the first backup).
          backupPrevious: state.sshServicePrevious === undefined,
        },
      })
      if (result.previous && state.sshServicePrevious === undefined) {
        state.sshServicePrevious = result.previous
      }

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
  // T0426: also runs for a failed start-server when the wizard is cancelled
  // (`ssh:stop-server` is idempotent); skipped if run() never reached the remote.
  // T0554 (BUG-141): an upgrade puts the previous unit / plist back instead and
  // leaves the service running when it was running before (started by
  // install-server-bundle's rollback when the previous bundle is restored too).
  async rollback(ctx) {
    const state = ctx.state as StartServerState
    if (state.sshStartServerTouchedRemote === false) {
      return
    }
    if (!state.sshHost || !state.sshServerHome) {
      return
    }
    if (ctx.targetOS !== 'ssh-linux' && ctx.targetOS !== 'ssh-darwin') {
      return
    }
    const previous = state.sshServicePrevious
    const connection = {
      sshHost: state.sshHost,
      sshUser: state.sshUser ?? '',
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
      targetOS: ctx.targetOS,
      serverHome: state.sshServerHome,
    }
    if (previous?.unit) {
      const bundleRestorePending = state.sshBundleInstall?.previous === 'kept'
      const result = await window.electronAPI.ssh.stopServer({
        ...connection,
        action: 'restore-previous',
        restore: { enabled: previous.enabled, start: previous.active && !bundleRestorePending },
      })
      if (!result.ok) {
        ctx.logger.warn(`Failed to restore the previous bat-server service over SSH (${ctx.targetOS}): ${result.error}`)
        return
      }
      if (previous.active && bundleRestorePending) state.sshServiceStartAfterBundleRestore = true
      ctx.logger.info(`Restored the previous bat-server service (${ctx.targetOS})`)
    } else {
      const result = await window.electronAPI.ssh.stopServer(connection)
      if (!result.ok) {
        ctx.logger.warn(`Failed to stop bat-server over SSH (${ctx.targetOS}): ${result.error}`)
        return
      }
    }
    delete state.sshServicePrevious
    state.sshStartServerTouchedRemote = false
    ctx.systemdServiceActive = false
    state.sshStartServicePath = undefined
  },
  // T0554: setup finished; drop the `<file>.bat-prev` backup.
  async finalize(ctx) {
    const state = ctx.state as StartServerState
    if (!state.sshServicePrevious?.unit || !state.sshHost || !state.sshServerHome) return
    if (ctx.targetOS !== 'ssh-linux' && ctx.targetOS !== 'ssh-darwin') return
    const result = await window.electronAPI.ssh.stopServer({
      sshHost: state.sshHost,
      sshUser: state.sshUser ?? '',
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
      targetOS: ctx.targetOS,
      serverHome: state.sshServerHome,
      action: 'discard-backup',
    })
    if (!result.ok) throw new Error(`Failed to remove the bat-server unit backup over SSH: ${result.error}`)
    delete state.sshServicePrevious
  },
}

export const SshStartServerStep = startServerStep

export const __sshStartServerCopy = {
  PHASE_LABELS,
}
