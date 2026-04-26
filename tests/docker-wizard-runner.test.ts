import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { buildDockerWizardSteps } from '../src/components/setup-wizard/docker-flow'
import { configureMountsStep } from '../src/components/setup-wizard/steps/docker/configure-mounts'
import { detectEnvStep } from '../src/components/setup-wizard/steps/wsl/detect-env'
import { resetFetchFingerprintImplForTests, setFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { WizardRunner, WizardStepStatus } from '../src/components/setup-wizard/wizard-runner'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

test('Docker wizard mode B happy path creates a new managed container', async () => {
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerRemoteMounts: [{ host: 'C:\\Users\\test\\project', container: '/workspace/project' }],
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createDockerContext('Docker Dev')
  ctx.state.dockerMounts = [{ host: 'C:\\Users\\test\\project', container: '/workspace/project' }]
  ctx.state.containerMode = 'new'

  const runner = new WizardRunner(buildDockerWizardSteps(), ctx)
  await runner.run()

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots.length, 9)
  assert.ok(snapshots.every((snapshot) => snapshot.status === WizardStepStatus.Succeeded))
  assert.equal(ctx.createdProfileId, 'docker-dev')
  assert.equal(ctx.state.dockerContainer, 'bat-server-docker-dev')
  assert.equal(ctx.serverMetadata?.serverEnv, 'docker')
  assert.equal(harness.operationLog.dockerStartCalls.length, 1)
})

test('Docker wizard mode A happy path reuses an existing container', async () => {
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerContainers: [{ id: 'abc123', name: 'bat-dev', image: 'bat-server:latest', state: 'exited', status: 'Exited (0)' }],
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createDockerContext('Existing Docker')
  ctx.state.containerMode = 'existing'
  ctx.state.dockerContainer = 'bat-dev'
  ctx.state.dockerMounts = [{ host: 'C:\\Users\\test\\project', container: '/workspace/project' }]

  await new WizardRunner(buildDockerWizardSteps(), ctx).run()

  assert.equal(ctx.createdProfileId, 'existing-docker')
  assert.equal(harness.operationLog.dockerStartCalls[0]?.name, 'bat-dev')
})

test('Docker wizard fails mount validation before container start', async () => {
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerValidateErrors: ['Row 1: duplicate host path C:\\Users\\test\\project'],
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createDockerContext('Invalid Mounts')
  ctx.state.containerMode = 'new'
  ctx.state.dockerMounts = [{ host: 'C:\\Users\\test\\project', container: '/workspace/project' }]

  await assert.rejects(() => configureMountsStep.run(ctx), /duplicate host path/)
  assert.equal(harness.operationLog.dockerStartCalls.length, 0)
})

test('Docker wizard rolls back managed container when profile persistence fails', async () => {
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    profileUpdateOk: false,
    dockerRemoteMounts: [{ host: 'C:\\Users\\test\\project', container: '/workspace/project' }],
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createDockerContext('Rollback Docker')
  ctx.state.containerMode = 'new'
  ctx.state.dockerMounts = [{ host: 'C:\\Users\\test\\project', container: '/workspace/project' }]

  await assert.rejects(() => new WizardRunner(buildDockerWizardSteps(), ctx).run(), /Failed to persist Docker profile metadata/)
  assert.ok(harness.operationLog.dockerRemoveCalls.includes('bat-server-rollback-docker'))
  assert.deepEqual(harness.operationLog.deletedProfileIds, ['rollback-docker'])
})

test('Docker wizard surfaces daemon-unavailable errors from detect-env', async () => {
  const harness = createMockElectronApi({ dockerAvailable: false, remoteServerEnv: 'docker' })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createDockerContext('No Docker')

  await assert.rejects(() => detectEnvStep.run(ctx), /Docker daemon unavailable/)
})
