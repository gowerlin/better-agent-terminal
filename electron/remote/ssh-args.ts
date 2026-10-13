/**
 * Shared ssh-argv builder + identifier validators (T0296).
 *
 * Addresses three concerns across all 4 ssh call sites:
 *   - F-004: leading `-` in sshUser/sshHost would be re-parsed as ssh option (RCE).
 *   - EC-002: control chars (\\r/\\n/NUL/…) in single-quoted shell tokens break heredoc framing.
 *   - EC-003: every ssh invocation must hard-code BatchMode + ConnectTimeout + StrictHostKey.
 *
 * T0505: `sshUser` is optional. Without it the target is the bare host
 * (`-- <alias>`), so ~/.ssh/config decides the user (and, for an alias, the
 * HostName / Port / IdentityFile / ProxyJump) exactly as `ssh <alias>` would.
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

/**
 * T0505: host-only targets (an ~/.ssh/config alias, or a typed host without
 * `user@`) must pass a closed charset: the CLAUDE.md external-input whitelist
 * plus `:` for IPv6 literals (same set as the teardown host whitelist), no
 * leading `-`. `@` is outside the set, so the host cannot carry a user.
 */
const HOST_ONLY_TARGET_RE = /^(?!-)[A-Za-z0-9._:-]{1,253}$/

/**
 * T0505: an empty / missing user means "let ssh decide" and normalizes to ''.
 * Anything else goes through `validateSshIdentifier`.
 */
export function normalizeOptionalSshUser(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    throw new Error('sshUser must be a string')
  }
  return validateSshIdentifier(value, 'sshUser')
}

/**
 * Validated ssh destination: `user@host`, or the bare host when no user is
 * set (T0505). Callers place it after `--` so it can never parse as an option.
 */
export function buildSshTarget(sshUser: unknown, sshHost: string): string {
  const user = normalizeOptionalSshUser(sshUser)
  const host = validateSshIdentifier(sshHost, 'sshHost')
  if (user) return `${user}@${host}`
  if (!HOST_ONLY_TARGET_RE.test(host)) {
    throw new Error(
      `sshHost without sshUser must be a host name or ~/.ssh/config alias using only letters, digits, ".", "_", "-" or ":": ${JSON.stringify(host)}`,
    )
  }
  return host
}

/** Log / message form of the destination: `user@host` or `host` (no validation). */
export function describeSshTarget(sshUser: string | undefined, sshHost: string): string {
  return sshUser ? `${sshUser}@${sshHost}` : sshHost
}

/** Connection-level options shared by every ssh CLI call site in the codebase. */
export interface SshConnectOpts {
  sshHost: string
  /** Empty / missing: ssh takes the user from ~/.ssh/config (T0505). */
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
}

/**
 * Build shared connect-args prefix:
 *   ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new
 *       [-p port] [-i key] [extraOpts...] -- user@host   (`-- host` without a user, T0505)
 *
 * `extraOpts` is spliced before `--` so SshTunnel can add `-N -L …` etc.
 * Caller appends remote command (if any) after the returned argv.
 */
export function buildBaseSshArgs(
  opts: SshConnectOpts,
  extraOpts: readonly string[] = [],
): string[] {
  const target = buildSshTarget(opts.sshUser, opts.sshHost)
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
  args.push('--', target)
  return args
}

/**
 * Forces ssh stderr/stdout to English (POSIX C locale) so classifyStderr can
 * pattern-match on canonical phrases (BUG-064 / T0301). Caller merges this
 * into spawn options.env, e.g. `{ ...process.env, ...buildBaseSshSpawnEnv() }`.
 *
 * Set on every ssh CLI invocation so non-en system locales don't fall through
 * to 'unknown' errorCode.
 */
export function buildBaseSshSpawnEnv(): Record<string, string> {
  return {
    LANG: 'C',
    LC_MESSAGES: 'C',
    LC_ALL: 'C',
  }
}
