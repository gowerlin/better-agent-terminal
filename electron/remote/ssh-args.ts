/**
 * Shared ssh-argv builder + identifier validators (T0296).
 *
 * Addresses three concerns across all 4 ssh call sites:
 *   - F-004: leading `-` in sshUser/sshHost would be re-parsed as ssh option (RCE).
 *   - EC-002: control chars (\\r/\\n/NUL/…) in single-quoted shell tokens break heredoc framing.
 *   - EC-003: every ssh invocation must hard-code BatchMode + ConnectTimeout + StrictHostKey.
 */

/** Reject empty/non-string, leading `-`, control char, or whitespace. Returns value on success. */
export function validateSshIdentifier(value: string, fieldName: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
  if (value.startsWith('-')) {
    throw new Error(
      `${fieldName} cannot start with '-' (would be parsed as ssh option): ${JSON.stringify(value)}`,
    )
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f ]/.test(value)) {
    throw new Error(
      `${fieldName} contains forbidden control char or whitespace: ${JSON.stringify(value)}`,
    )
  }
  return value
}

/** Bash single-quote escape (`'` → `'\''`) + reject control chars (EC-002). */
export function escapeSingleQuotesStrict(value: string, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`)
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(
      `${fieldName} contains forbidden control char: ${JSON.stringify(value)}`,
    )
  }
  return value.replace(/'/g, "'\\''")
}

/** Connection-level options shared by every ssh CLI call site in the codebase. */
export interface SshConnectOpts {
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
}

/**
 * Build shared connect-args prefix:
 *   ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new
 *       [-p port] [-i key] [extraOpts...] -- user@host
 *
 * `extraOpts` is spliced before `--` so SshTunnel can add `-N -L …` etc.
 * Caller appends remote command (if any) after the returned argv.
 */
export function buildBaseSshArgs(
  opts: SshConnectOpts,
  extraOpts: readonly string[] = [],
): string[] {
  const user = validateSshIdentifier(opts.sshUser, 'sshUser')
  const host = validateSshIdentifier(opts.sshHost, 'sshHost')
  const args: string[] = [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'StrictHostKeyChecking=accept-new',
  ]
  if (typeof opts.sshPort === 'number' && opts.sshPort !== 22) {
    args.push('-p', String(opts.sshPort))
  }
  if (typeof opts.sshKeyPath === 'string' && opts.sshKeyPath.trim().length > 0) {
    args.push('-i', validateSshIdentifier(opts.sshKeyPath, 'sshKeyPath'))
  }
  if (extraOpts.length > 0) {
    args.push(...extraOpts)
  }
  args.push('--', `${user}@${host}`)
  return args
}
