/**
 * T0385 (BUG-094): classify why opening a remote profile failed, so the
 * dialog stops reporting every failure as "not running or did not respond".
 *
 * Pure module (no electron import) — main.ts builds the dialog from
 * `describeRemoteProfileFailure()`.
 */
import type { ConnectResult } from './remote-client'

/**
 * - `unreachable`: socket never came up (refused / timeout / network / tunnel)
 * - `trust`: reached the server but the pinned fingerprint or token was rejected
 * - `protocol`: connected and authenticated, but the remote call itself failed
 *   (e.g. `No handler for channel: …` from an older/incompatible bat-server)
 */
export type RemoteProfileFailureReason = 'unreachable' | 'trust' | 'protocol'

export interface RemoteProfileFailure {
  reason: RemoteProfileFailureReason
  host: string
  port: number
  label: string
  /** Original error text, surfaced verbatim in the dialog detail. */
  error?: string
}

/** Errors RemoteClient.invoke raises when the transport — not the server — failed. */
const TRANSPORT_INVOKE_ERRORS = [
  /^Not connected to remote server$/,
  /^Connection closed$/,
  /^Disconnected$/,
  /^Remote invoke timeout: /,
]

export function classifyConnectFailure(result: ConnectResult): RemoteProfileFailureReason {
  switch (result.errorCode) {
    case 'fingerprint-mismatch':
    case 'auth-failed':
      return 'trust'
    default:
      return 'unreachable'
  }
}

export function classifyInvokeFailure(err: unknown): RemoteProfileFailureReason {
  const message = err instanceof Error ? err.message : String(err)
  return TRANSPORT_INVOKE_ERRORS.some(re => re.test(message)) ? 'unreachable' : 'protocol'
}

export function describeRemoteProfileFailure(failure: RemoteProfileFailure): {
  title: string
  message: string
  detail: string
} {
  const { host, port, label, error } = failure
  const suffix = error ? `\n\nError: ${error}` : ''
  switch (failure.reason) {
    case 'trust':
      return {
        title: 'Remote profile not trusted',
        message: `Cannot authenticate to remote profile "${label}"`,
        detail:
          `The remote server at ${host}:${port} is reachable, but its certificate fingerprint ` +
          `or access token was rejected. Re-pair the profile (pin the expected fingerprint / ` +
          `update the token) and try again.${suffix}`,
      }
    case 'protocol':
      return {
        title: 'Remote server incompatible',
        message: `Remote profile "${label}" connected, but the server could not handle the request`,
        detail:
          `The remote server at ${host}:${port} is running and accepted the connection, but ` +
          `the request failed. The server version may be incompatible with this BAT version, ` +
          `or the feature is not supported by the server. Update the remote server bundle.${suffix}`,
      }
    case 'unreachable':
    default:
      return {
        title: 'Remote profile unreachable',
        message: `Cannot connect to remote profile "${label}"`,
        detail: `The remote server at ${host}:${port} is not running or did not respond within 6 seconds.${suffix}`,
      }
  }
}
