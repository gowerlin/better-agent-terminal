import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSshWizardSteps, createSshWizardContext } from '../src/components/setup-wizard/ssh-flow'

// T0287 AC1 — buildSshWizardSteps unit tests. Asserts the spec-frozen step
// ordering (T0266 §6) and step IDs without spinning up the full wizard runner.

test('AC1.1: buildSshWizardSteps returns 8 steps in spec-frozen order', () => {
  const steps = buildSshWizardSteps()
  const ids = steps.map((step) => step.id)
  assert.deepEqual(ids, [
    'configure-ssh-host',
    'verify-ssh-auth',
    'install-server-bundle',
    'start-server',
    'fetch-fingerprint',
    'connect-test',
    'write-profile',
    'done',
  ])
  assert.equal(steps.length, 8)
})

test('AC1.2: SSH-specific steps target ssh-linux + ssh-darwin', () => {
  const steps = buildSshWizardSteps()
  const sshOnlyIds = ['configure-ssh-host', 'verify-ssh-auth', 'install-server-bundle', 'start-server']
  for (const id of sshOnlyIds) {
    const step = steps.find((s) => s.id === id)
    assert.ok(step, `step ${id} missing`)
    assert.deepEqual(step!.appliesTo, ['ssh-linux', 'ssh-darwin'])
  }
})

test('AC1.3: shared steps (fetch-fingerprint / connect-test / write-profile / done) are appliesTo=all', () => {
  const steps = buildSshWizardSteps()
  for (const id of ['fetch-fingerprint', 'connect-test', 'write-profile', 'done']) {
    const step = steps.find((s) => s.id === id)
    assert.ok(step, `step ${id} missing`)
    assert.equal(step!.appliesTo, 'all')
  }
})

test('AC1.4: createSshWizardContext seeds tunnel-mode + install path defaults', () => {
  const ctx = createSshWizardContext({ profileName: 'devbox' })
  assert.equal(ctx.targetOS, 'ssh-linux')
  assert.equal(ctx.profileDraft.name, 'devbox')
  assert.equal(ctx.state.sshTunnelMode, 'tunnel')
  assert.equal(ctx.state.sshInstallPath, '~/.local/bat-server')
  assert.equal(ctx.serverPort, 9876)
  assert.equal(ctx.serverInstallPath, '~/.local/bat-server')
  assert.deepEqual(ctx.warnings, [])
})

test('AC1.5: configure-ssh-host + start-server are retryable', () => {
  // Failure here should let the runner offer Retry/Skip rather than abort.
  const steps = buildSshWizardSteps()
  const configure = steps.find((s) => s.id === 'configure-ssh-host')!
  const verify = steps.find((s) => s.id === 'verify-ssh-auth')!
  const start = steps.find((s) => s.id === 'start-server')!
  assert.equal(configure.retryable, true)
  assert.equal(verify.retryable, true)
  assert.equal(start.retryable, true)
})
