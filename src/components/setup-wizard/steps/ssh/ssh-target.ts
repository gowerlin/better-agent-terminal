/**
 * T0505: `sshUser` is optional across the SSH wizard. An ~/.ssh/config alias
 * (or a typed host without `user@`) stores `sshUser: ''`; the main process
 * then runs `ssh -- <host>` and the ssh config decides the user. Only the host
 * is required before talking to the remote.
 */

/** Log / message form: `user@host`, or `host` when ssh config picks the user. */
export function describeSshTarget(sshUser: string | undefined, sshHost: string): string {
  return sshUser ? `${sshUser}@${sshHost}` : sshHost
}
