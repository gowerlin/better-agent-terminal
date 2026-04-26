import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { buildDockerWizardSteps } from '../src/components/setup-wizard/docker-flow'
import { resetFetchFingerprintImplForTests, setFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { WizardRunner, WizardStepStatus } from '../src/components/setup-wizard/wizard-runner'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

test('mode A happy path completes all 9 Docker steps against an existing container', async () => {
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerContainers: [{ id: 'abc123', name: 'bat-dev', image: 'bat-server:latest', state: 'exited', status: 'Exited (0)' }],
    dockerRemoteMounts: [{ host: 'C:\\projects\\bat', container: '/opt/bat-server' }],
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createDockerContext('Existing Docker')
  ctx.state.containerMode = 'existing'
  ctx.state.dockerContainer = 'bat-dev'
  ctx.state.dockerMounts = [{ host: 'C:\\projects\\bat', container: '/opt/bat-server' }]

  const runner = new WizardRunner(buildDockerWizardSteps(), ctx)
  await runner.run()

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots.length, 9)
  assert.ok(snapshots.every((snapshot) => snapshot.status === WizardStepStatus.Succeeded))
  assert.equal(ctx.profileDraft.name, 'Existing Docker')
  assert.equal(ctx.createdProfileId, 'existing-docker')
  assert.equal(ctx.state.containerMode, 'existing')
  assert.equal(ctx.state.dockerContainer, 'bat-dev')
  assert.deepEqual(ctx.profileDraft.dockerMounts, [{ host: 'C:\\projects\\bat', container: '/opt/bat-server' }])
  assert.equal(harness.operationLog.dockerStartCalls[0]?.name, 'bat-dev')
  assert.equal(harness.operationLog.dockerRemoveCalls.length, 0)
})

test('mode B happy path creates a managed container with unless-stopped and two mounts', async () => {
  const mounts = [
    { host: 'C:\\projects\\bat', container: '/workspace/bat' },
    { host: 'C:\\projects\\bmad', container: '/workspace/bmad' },
  ]
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerRemoteMounts: mounts,
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createDockerContext('Docker Fresh')
  ctx.state.containerMode = 'new'
  ctx.state.dockerMounts = mounts
  ctx.state.dockerContainer = 'bat-server-docker-fresh'

  await new WizardRunner(buildDockerWizardSteps(), ctx).run()

  assert.equal(ctx.createdProfileId, 'docker-fresh')
  assert.deepEqual(ctx.profileDraft.dockerMounts, mounts)
  assert.deepEqual(ctx.state.dockerMounts, mounts)
  assert.equal(harness.operationLog.dockerStartCalls.length, 1)
  assert.equal(harness.operationLog.dockerStartCalls[0]?.restartPolicy, 'unless-stopped')
  assert.deepEqual(harness.operationLog.dockerStartCalls[0]?.mounts, mounts)
})

test('mode B start-server failure rolls back container creation and skips profile persistence', async () => {
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerStartOk: false,
    dockerStartError: 'Docker image not found',
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createDockerContext('Rollback Docker')
  ctx.state.containerMode = 'new'
  ctx.state.dockerContainer = 'bat-server-rollback-docker'
  ctx.state.dockerMounts = [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }]

  const steps = buildDockerWizardSteps().map((step) => step.id === 'start-server' ? { ...step, retryable: false } : step)
  await assert.rejects(() => new WizardRunner(steps, ctx).run(), /Docker image not found/)
  assert.ok(harness.operationLog.dockerRemoveCalls.includes('bat-server-rollback-docker'))
  assert.equal(harness.operationLog.createdProfileIds.length, 0)
  assert.equal(ctx.createdProfileId, undefined)
})

test('mount validation failure stops at configure-mounts and rolls back the managed container name', async () => {
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerValidateErrors: ['Row 1: duplicate host path C:\\projects\\bat'],
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createDockerContext('Invalid Mounts')
  ctx.state.containerMode = 'new'
  ctx.state.dockerContainer = 'bat-server-invalid-mounts'
  ctx.state.dockerMounts = [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }]

  const steps = buildDockerWizardSteps().map((step) => step.id === 'configure-mounts' ? { ...step, retryable: false } : step)
  const runner = new WizardRunner(steps, ctx)
  await assert.rejects(() => runner.run(), /duplicate host path/)

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots[0]?.status, WizardStepStatus.Succeeded)
  assert.equal(snapshots[1]?.status, WizardStepStatus.RolledBack)
  assert.equal(snapshots[2]?.status, WizardStepStatus.Failed)
  assert.equal(harness.operationLog.dockerStartCalls.length, 0)
  assert.deepEqual(harness.operationLog.dockerRemoveCalls, ['bat-server-invalid-mounts'])
})

test('detect-env stops the Docker wizard when the daemon is unavailable', async () => {
  const harness = createMockElectronApi({ dockerAvailable: false, remoteServerEnv: 'docker' })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createDockerContext('No Docker')
  const steps = buildDockerWizardSteps().map((step) => step.id === 'detect-env' ? { ...step, retryable: false } : step)
  const runner = new WizardRunner(steps, ctx)

  await assert.rejects(() => runner.run(), /Docker daemon unavailable/)
  const snapshots = runner.getSnapshots()
  assert.equal(snapshots[0]?.status, WizardStepStatus.Failed)
})
