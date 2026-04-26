import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { buildDockerWizardSteps } from '../src/components/setup-wizard/docker-flow'
import { resetFetchFingerprintImplForTests, setFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { WizardRunner } from '../src/components/setup-wizard/wizard-runner'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

test('Journey 1: Docker Desktop happy path records fingerprint, metadata, and lifecycle calls', async () => {
  const mounts = [
    { host: 'C:\\projects\\bat', container: '/workspace/bat' },
    { host: 'C:\\projects\\bmad', container: '/workspace/bmad' },
  ]
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerRemoteMounts: mounts,
    dockerLogs: 'server boot ok',
    dockerHealthSequence: ['starting', 'healthy'],
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:DD:EE:FF')

  const ctx = harness.createDockerContext('Desktop Journey')
  ctx.state.containerMode = 'new'
  ctx.state.dockerMounts = mounts

  await new WizardRunner(buildDockerWizardSteps(), ctx).run()
  const containerName = String(ctx.state.dockerContainer)

  const restartResult = await harness.electronAPI.docker.restartContainer(containerName)
  const logsResult = await harness.electronAPI.docker.getContainerLogs(containerName, { tail: 20 })

  assert.equal(restartResult.ok, true)
  assert.equal(logsResult.ok, true)
  assert.equal(logsResult.logs, 'server boot ok')
  assert.equal(ctx.fingerprint, 'FP:DD:EE:FF')
  assert.equal(ctx.serverMetadata?.serverEnv, 'docker')
  assert.deepEqual(ctx.serverMetadata?.dockerMounts, mounts)
  assert.equal(harness.operationLog.dockerStartCalls[0]?.restartPolicy, 'unless-stopped')
  assert.ok(harness.operationLog.dockerRestartCalls.includes(containerName))
  assert.deepEqual(harness.operationLog.dockerLogsCalls[0], { name: containerName, tail: 20, follow: undefined })
  assert.ok(harness.operationLog.dockerHealthCalls.length >= 2)
})

test('Journey 2: Docker Engine on Linux preserves POSIX mount paths for mode A containers', async () => {
  const mounts = [{ host: '/home/test/bat', container: '/workspace/bat' }]
  const harness = createMockElectronApi({
    platform: 'linux',
    remoteServerEnv: 'docker',
    dockerContainers: [{ id: 'linux123', name: 'bat-linux', image: 'bat-server:latest', state: 'running', status: 'Up 1 minute' }],
    dockerRemoteMounts: mounts,
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:11:22:33')

  const ctx = harness.createDockerContext('Linux Engine')
  ctx.state.containerMode = 'existing'
  ctx.state.dockerContainer = 'bat-linux'
  ctx.state.dockerMounts = mounts

  await new WizardRunner(buildDockerWizardSteps(), ctx).run()

  assert.equal(window.electronAPI.platform, 'linux')
  assert.equal(ctx.serverMetadata?.serverEnv, 'docker')
  assert.deepEqual(ctx.serverMetadata?.dockerMounts, mounts)
  assert.equal(ctx.profileDraft.dockerMounts?.[0]?.host, '/home/test/bat')
  assert.equal(harness.operationLog.dockerStartCalls[0]?.name, 'bat-linux')
})

test('Journey 3: mount switching can rebuild the managed container and update the profile', async () => {
  const firstMounts = [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }]
  const secondMounts = [
    { host: 'D:\\repos\\bat', container: '/workspace/bat' },
    { host: 'D:\\repos\\docs', container: '/workspace/docs' },
  ]
  const harness = createMockElectronApi({
    remoteServerEnv: 'docker',
    dockerRemoteMounts: secondMounts,
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:44:55:66')

  const first = harness.createDockerContext('Docker Rebuild')
  first.state.containerMode = 'new'
  first.state.dockerMounts = firstMounts
  await new WizardRunner(buildDockerWizardSteps(), first).run()

  const containerName = String(first.state.dockerContainer)
  await harness.electronAPI.docker.removeContainer(containerName)

  const second = harness.createDockerContext('Docker Rebuild')
  second.state.containerMode = 'new'
  second.state.dockerContainer = containerName
  second.state.dockerMounts = secondMounts
  await new WizardRunner(buildDockerWizardSteps(), second).run()

  assert.ok(harness.operationLog.dockerRemoveCalls.includes(containerName))
  assert.equal(harness.operationLog.dockerStartCalls.length, 2)
  assert.deepEqual(harness.operationLog.dockerStartCalls[1]?.mounts, secondMounts)
  assert.equal(second.createdProfileId, 'docker-rebuild')
  assert.deepEqual(harness.profiles.get('docker-rebuild')?.dockerMounts, secondMounts)
})
