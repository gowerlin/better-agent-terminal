import type { WizardContext, WizardStep } from '../../wizard-runner'

interface VerifyAuthState {
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  sshAlias?: string
  sshLastProbeError?: string
  sshLastProbeErrorCode?: string
}

function readState(ctx: WizardContext): VerifyAuthState {
  return ctx.state as VerifyAuthState
}

const KEYGEN_HINT = "ssh-keygen -t ed25519 -C 'bat-setup' -f ~/.ssh/id_ed25519_bat"

function permissionDeniedHint(): string {
  return [
    'SSH server rejected our key.',
    `Generate a new key with:  ${KEYGEN_HINT}`,
    'Then copy ~/.ssh/id_ed25519_bat.pub to the remote host (e.g. via ssh-copy-id) and retry.',
    'If you already have a key, point Identity file at it and retry.',
  ].join('\n')
}

function noSshHint(): string {
  if (process.platform === 'win32') {
    return 'Install OpenSSH client: Settings → Apps → Optional Features → Add → OpenSSH Client.'
  }
  if (process.platform === 'darwin') {
    return 'OpenSSH client should be pre-installed on macOS. Check `which ssh` in Terminal.'
  }
  return 'Install OpenSSH client: `sudo apt install openssh-client` (Debian/Ubuntu) or your distro equivalent.'
}

function hostKeyHint(): string {
  return [
    'Host key verification failed.',
    "Run `ssh <host>` once in your terminal to manually accept the new host key.",
    'After accepting, return to this wizard and click Retry.',
  ].join('\n')
}

/**
 * `verify-ssh-auth` step (T0285 AC5/AC7).
 *
 * Calls `ssh:probe-auth` to verify reachability, identity, and parses the
 * server's `uname -sm` + `$HOME` to auto-fill `targetOS` (linux/darwin) and
 * `serverHome` on the wizard context. Failure modes surface guidance via
 * ctx.warnings and structured error fields the UI shell can render.
 */
export const verifySshAuthStep: WizardStep = {
  id: 'verify-ssh-auth',
  title: 'Verify SSH authentication',
  appliesTo: ['ssh-linux', 'ssh-darwin'],
  retryable: true,
  labelKey: 'wizard.ssh.step.verifyAuth.label',
  descriptionKey: 'wizard.ssh.step.verifyAuth.description',
  groupKey: 'wizard.group.connection',
  editableFromFailure: false,
  async run(ctx) {
    const state = readState(ctx)
    if (!state.sshHost || !state.sshUser) {
      throw new Error('SSH host and user must be configured before verifying authentication.')
    }

    ctx.logger.info(`Probing ${state.sshUser}@${state.sshHost}${state.sshPort ? ':' + state.sshPort : ''}…`)
    const result = await window.electronAPI.ssh.probeAuth({
      sshHost: state.sshHost,
      sshUser: state.sshUser,
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
    })

    if (!result.ok) {
      const code = result.errorCode ?? 'unknown'
      let hint = ''
      if (code === 'no-ssh') hint = noSshHint()
      else if (code === 'permission-denied') hint = permissionDeniedHint()
      else if (code === 'host-key') hint = hostKeyHint()
      else if (code === 'connect-timeout') hint = 'Connection timed out. Check the host is reachable and the firewall allows port 22 (or your custom SSH port).'
      else hint = result.error ?? 'SSH probe failed.'

      Object.assign(ctx.state, {
        sshLastProbeError: hint,
        sshLastProbeErrorCode: code,
      })
      throw new Error(`${code}: ${hint}`)
    }

    // Auto-fill targetOS based on the remote uname result. Spec frozen in
    // T0266 §7 mandates the wizard adapt the targetOS so downstream steps
    // (write-systemd-unit / install-server-bundle) pick the right tarball.
    if (result.serverPlatform === 'linux') ctx.targetOS = 'ssh-linux'
    if (result.serverPlatform === 'darwin') ctx.targetOS = 'ssh-darwin'

    // Compose a partial serverMetadata. fetch-fingerprint / connect-test will
    // overwrite this with the authoritative bundle metadata once the server
    // boots (T0286 lands the systemd glue).
    ctx.serverMetadata = {
      serverPlatform: (result.serverPlatform ?? 'linux') as 'linux' | 'darwin',
      serverArch: (result.serverArch === 'arm64' ? 'arm64' : 'x64') as 'x64' | 'arm64',
      serverEnv: 'ssh',
      serverHome: result.serverHome,
      nodeVersion: 'pending',
      bundleVersion: 'pending',
    }

    Object.assign(ctx.state, {
      sshLastProbeError: undefined,
      sshLastProbeErrorCode: undefined,
      sshServerHome: result.serverHome,
      sshServerArch: result.serverArch,
    })
    ctx.logger.info(`✓ Server platform: ${result.serverPlatform} ${result.serverArch}`)
    ctx.logger.info(`✓ Server home: ${result.serverHome ?? '(unknown)'}`)
  },
}

export const SshVerifyAuthStep = verifySshAuthStep

export const __sshVerifyAuthHints = {
  noSshHint,
  permissionDeniedHint,
  hostKeyHint,
  KEYGEN_HINT,
}
