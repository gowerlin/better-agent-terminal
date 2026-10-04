import type { WizardContext, WizardStep } from '../../wizard-runner'
import type { SshTunnelMode } from './configure-host'
import { connectTestStep } from '../wsl/connect-test'
import { fetchFingerprintStep } from '../wsl/fetch-fingerprint'

/**
 * T0387 (BUG-093): SSH flavours of the shared `fetch-fingerprint` /
 * `connect-test` steps. The shared steps used to hit `localhost:<serverPort>`,
 * i.e. this BAT's own RemoteServer, because nothing forwarded to the remote
 * host during the wizard. Here they are pointed at the remote bat-server via
 * `ctx.verifyEndpoint`: main opens `ssh -L <local>:localhost:<serverPort>`
 * (OS-assigned local port, never a host RemoteServer port) and both steps talk
 * to `127.0.0.1:<local>`. Tunnel is the only mode (T0425 / BUG-098 removed
 * "direct"); a leftover `sshTunnelMode: 'direct'` in the state is ignored.
 *
 * The tunnel is closed when connect-test finishes (success, failure or skip
 * path), when fetch-fingerprint fails, and by either step's rollback (cancel /
 * failure rollback of completed steps); main also
 * closes it when the renderer goes away or BAT quits. Step ids, metadata and
 * `appliesTo` are inherited unchanged, and WSL / Docker keep using the shared
 * steps directly (no `verifyEndpoint`).
 *
 * The profile still stores the REMOTE port (`ctx.serverPort`); the tunnel's
 * local port only exists for the duration of the wizard.
 */

interface SshVerifyState {
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  sshTunnelMode?: SshTunnelMode
  sshServerHome?: string
  sshVerifySessionId?: string
}

const TUNNEL_HOST = '127.0.0.1'

function readState(ctx: WizardContext): SshVerifyState {
  return ctx.state as SshVerifyState
}

function sessionIdOf(state: SshVerifyState): string {
  if (!state.sshVerifySessionId) {
    state.sshVerifySessionId = `ssh-verify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
  return state.sshVerifySessionId
}

function codedError(message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

export async function ensureSshVerifyEndpoint(ctx: WizardContext): Promise<void> {
  const state = readState(ctx)
  const remotePort = ctx.serverPort
  if (typeof remotePort !== 'number') {
    throw new Error('Server port was not resolved before verifying the SSH server; re-run the start-server step.')
  }
  if (!state.sshHost || !state.sshUser) {
    throw new Error('SSH host and user must be configured before verifying the remote server.')
  }

  const result = await window.electronAPI.ssh.openVerifyTunnel({
    sessionId: sessionIdOf(state),
    sshHost: state.sshHost,
    sshUser: state.sshUser,
    sshPort: state.sshPort,
    sshKeyPath: state.sshKeyPath,
    remotePort,
  })
  if (!result.ok) {
    ctx.verifyEndpoint = undefined
    throw codedError(result.error, result.errorCode)
  }
  ctx.verifyEndpoint = { host: TUNNEL_HOST, port: result.localPort }
  ctx.logger.info(`SSH tunnel ready: ${TUNNEL_HOST}:${result.localPort} → ${state.sshUser}@${state.sshHost}:${remotePort}`)
}

export async function closeSshVerifyEndpoint(ctx: WizardContext): Promise<void> {
  ctx.verifyEndpoint = undefined
  const sessionId = readState(ctx).sshVerifySessionId
  if (!sessionId) return
  try {
    await window.electronAPI.ssh.closeVerifyTunnel(sessionId)
  } catch (error) {
    ctx.logger.warn(`Failed to close the SSH verification tunnel: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Cross-check the handshake fingerprint against the remote bat-server's
 * `server-cert.json` (read over ssh). Also picks up the server token, which
 * the SSH flow has no other source for. Unreadable → warn and keep the
 * handshake value; mismatch → fail (we reached some other server).
 */
async function crossCheckFingerprint(ctx: WizardContext): Promise<void> {
  const handshake = ctx.fingerprint
  if (!handshake) return
  const state = readState(ctx)
  if (!state.sshHost || !state.sshUser || !state.sshServerHome
    || (ctx.targetOS !== 'ssh-linux' && ctx.targetOS !== 'ssh-darwin')) {
    ctx.logger.warn('Remote server details are incomplete; using the TLS handshake fingerprint without cross-checking.')
    return
  }

  let identity: Awaited<ReturnType<typeof window.electronAPI.ssh.readServerIdentity>>
  try {
    identity = await window.electronAPI.ssh.readServerIdentity({
      sshHost: state.sshHost,
      sshUser: state.sshUser,
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
      targetOS: ctx.targetOS,
      serverHome: state.sshServerHome,
    })
  } catch (error) {
    identity = { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  if (!identity.ok) {
    ctx.logger.warn(`Could not read the remote bat-server certificate (${identity.error}); using the TLS handshake fingerprint only.`)
    return
  }

  if (identity.token) ctx.remoteToken = identity.token

  if (!identity.fingerprint) {
    ctx.logger.warn('Remote server-cert.json has no readable fingerprint; using the TLS handshake fingerprint only.')
    return
  }
  if (identity.fingerprint !== handshake.toUpperCase()) {
    // Never let a skip carry the wrong fingerprint into the profile.
    ctx.fingerprint = null
    throw codedError(
      `TLS fingerprint ${handshake} does not match the remote bat-server certificate ${identity.fingerprint} `
      + `on ${state.sshUser}@${state.sshHost}. The verification reached a different server `
      + '(for example this BAT\'s own remote server); check the SSH host and server port, then retry.',
      'fingerprint-mismatch',
    )
  }
  ctx.logger.info('✓ TLS fingerprint matches the remote server-cert.json')
}

export const sshFetchFingerprintStep: WizardStep = {
  ...fetchFingerprintStep,
  async run(ctx) {
    if (ctx.systemdServiceActive === false) {
      // Shared step records the skip (fingerprint = null); nothing to reach.
      await fetchFingerprintStep.run(ctx)
      return
    }
    try {
      await ensureSshVerifyEndpoint(ctx)
      await fetchFingerprintStep.run(ctx)
      await crossCheckFingerprint(ctx)
    } catch (error) {
      // Close on failure: cancelling from a failed step does not run that
      // step's rollback (the runner only rolls back completed steps), and a
      // retry reopens the tunnel anyway.
      await closeSshVerifyEndpoint(ctx)
      throw error
    }
  },
  async rollback(ctx) {
    await closeSshVerifyEndpoint(ctx)
  },
}

export const sshConnectTestStep: WizardStep = {
  ...connectTestStep,
  async run(ctx) {
    try {
      if (ctx.systemdServiceActive !== false && ctx.fingerprint) {
        // Reuses the fetch-fingerprint tunnel (main keys it by session), or
        // reopens it on retry after a previous close.
        await ensureSshVerifyEndpoint(ctx)
      }
      await connectTestStep.run(ctx)
    } finally {
      await closeSshVerifyEndpoint(ctx)
    }
  },
  async rollback(ctx) {
    await closeSshVerifyEndpoint(ctx)
  },
}
