import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBaseSshArgs,
  escapeSingleQuotesStrict,
  validateSshIdentifier,
  type SshConnectOpts,
} from '../electron/remote/ssh-args'

const baseConn: SshConnectOpts = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
}

// ── validateSshIdentifier ────────────────────────────────────────────────

test('validateSshIdentifier: empty / non-string throws', () => {
  assert.throws(() => validateSshIdentifier('', 'sshUser'), /must be a non-empty string/)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.throws(() => validateSshIdentifier(undefined as any, 'sshHost'), /must be a non-empty string/)
})

test('validateSshIdentifier: F-004 — leading dash rejected (option injection)', () => {
  assert.throws(
    () => validateSshIdentifier('-oProxyCommand=evil.sh', 'sshHost'),
    /cannot start with '-'.*ssh option/,
  )
  // Even single `-` rejected.
  assert.throws(() => validateSshIdentifier('-', 'sshUser'), /cannot start with '-'/)
})

test('validateSshIdentifier: control chars + whitespace rejected', () => {
  assert.throws(() => validateSshIdentifier('alice\nbob', 'sshUser'), /forbidden control char or whitespace/)
  assert.throws(() => validateSshIdentifier('alice\rbob', 'sshUser'), /forbidden control char or whitespace/)
  assert.throws(() => validateSshIdentifier('alice\x00bob', 'sshUser'), /forbidden control char or whitespace/)
  assert.throws(() => validateSshIdentifier('alice bob', 'sshUser'), /forbidden control char or whitespace/)
  assert.throws(() => validateSshIdentifier('host\x7f', 'sshHost'), /forbidden control char or whitespace/)
})

test('validateSshIdentifier: normal user/host pass through unchanged', () => {
  assert.equal(validateSshIdentifier('alice', 'sshUser'), 'alice')
  assert.equal(validateSshIdentifier('devbox.example.com', 'sshHost'), 'devbox.example.com')
  assert.equal(validateSshIdentifier('192.168.1.10', 'sshHost'), '192.168.1.10')
  // common key-path style — `/` `.` `_` `~` are all allowed
  assert.equal(
    validateSshIdentifier('/home/alice/.ssh/id_ed25519', 'sshKeyPath'),
    '/home/alice/.ssh/id_ed25519',
  )
})

// ── escapeSingleQuotesStrict ─────────────────────────────────────────────

test('escapeSingleQuotesStrict: EC-002 — \\r / \\n / NUL / DEL / other control chars rejected', () => {
  assert.throws(() => escapeSingleQuotesStrict('/opt/bat\rserver', 'installPath'), /forbidden control char/)
  assert.throws(() => escapeSingleQuotesStrict('line1\nline2', 'installPath'), /forbidden control char/)
  assert.throws(() => escapeSingleQuotesStrict('a\x00b', 'value'), /forbidden control char/)
  assert.throws(() => escapeSingleQuotesStrict('a\x7fb', 'value'), /forbidden control char/)
  assert.throws(() => escapeSingleQuotesStrict('a\x1bb', 'value'), /forbidden control char/)
})

test('escapeSingleQuotesStrict: single-quote escaped to closing/quoting bash form', () => {
  assert.equal(escapeSingleQuotesStrict("O'Brien", 'value'), "O'\\''Brien")
  assert.equal(escapeSingleQuotesStrict("a'b'c", 'value'), "a'\\''b'\\''c")
})

test('escapeSingleQuotesStrict: plain values returned unchanged', () => {
  assert.equal(escapeSingleQuotesStrict('plain', 'value'), 'plain')
  assert.equal(escapeSingleQuotesStrict('~/.local/bat-server', 'installPath'), '~/.local/bat-server')
  assert.equal(escapeSingleQuotesStrict('', 'value'), '') // empty allowed (validation lives in identifier helper)
})

// ── buildBaseSshArgs ─────────────────────────────────────────────────────

test('buildBaseSshArgs: EC-003 — base prefix always contains BatchMode + ConnectTimeout + StrictHostKey + --', () => {
  const args = buildBaseSshArgs(baseConn)
  // base ssh hardening flags
  const idxBatch = args.indexOf('BatchMode=yes')
  assert.ok(idxBatch > 0 && args[idxBatch - 1] === '-o')
  const idxTimeout = args.indexOf('ConnectTimeout=10')
  assert.ok(idxTimeout > 0 && args[idxTimeout - 1] === '-o')
  const idxStrict = args.indexOf('StrictHostKeyChecking=accept-new')
  assert.ok(idxStrict > 0 && args[idxStrict - 1] === '-o')
  // `--` immediately precedes user@host (F-004 defence in depth)
  assert.equal(args[args.length - 2], '--')
  assert.equal(args[args.length - 1], 'alice@devbox.example')
})

test('buildBaseSshArgs: sshPort handling — 22 implicit, non-22 emits -p', () => {
  assert.equal(buildBaseSshArgs({ ...baseConn, sshPort: 22 }).includes('-p'), false)
  const custom = buildBaseSshArgs({ ...baseConn, sshPort: 2222 })
  const idx = custom.indexOf('-p')
  assert.ok(idx >= 0 && custom[idx + 1] === '2222')
})

test('buildBaseSshArgs: sshKeyPath populated → -i <path> emitted', () => {
  const args = buildBaseSshArgs({ ...baseConn, sshKeyPath: '/home/alice/.ssh/id_ed25519' })
  const idx = args.indexOf('-i')
  assert.ok(idx >= 0 && args[idx + 1] === '/home/alice/.ssh/id_ed25519')
})

test('buildBaseSshArgs: F-004 — sshHost / sshUser with leading - throws', () => {
  assert.throws(
    () => buildBaseSshArgs({ sshHost: '-oProxyCommand=evil.sh', sshUser: 'alice' }),
    /sshHost.*cannot start with '-'/,
  )
  assert.throws(
    () => buildBaseSshArgs({ sshHost: 'devbox.example', sshUser: '-evil' }),
    /sshUser.*cannot start with '-'/,
  )
})

test('buildBaseSshArgs: extraOpts spliced before -- so option parsing still applies', () => {
  const args = buildBaseSshArgs(baseConn, [
    '-N',
    '-L', '40000:localhost:9876',
    '-o', 'ServerAliveInterval=30',
  ])
  // extras must appear before `--`
  const idxL = args.indexOf('-L')
  const idxDashDash = args.indexOf('--')
  assert.ok(idxL >= 0 && idxL < idxDashDash, '-L must precede --')
  // and after the base prefix
  const idxStrict = args.indexOf('StrictHostKeyChecking=accept-new')
  assert.ok(idxStrict < idxL, 'extras come after the base prefix')
  assert.equal(args[args.length - 1], 'alice@devbox.example')
})

test('buildBaseSshArgs: sshKeyPath also runs through validateSshIdentifier', () => {
  // EC-002 / F-004 cross-cutting: an attacker-supplied keyPath that starts
  // with `-` (e.g. `-oProxyCommand=evil`) must throw.
  assert.throws(
    () => buildBaseSshArgs({ ...baseConn, sshKeyPath: '-oProxyCommand=evil' }),
    /sshKeyPath.*cannot start with '-'/,
  )
})
