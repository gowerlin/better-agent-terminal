import assert from 'node:assert/strict'
import i18next from 'i18next'
import { afterEach, test } from 'node:test'
import { buildWslWizardSteps } from '../src/components/setup-wizard/wsl-flow'
import { resetFetchFingerprintImplForTests, setFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { WizardStepStatus } from '../src/components/setup-wizard/wizard-runner'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'
import { createTestWizardRunner } from './__helpers__/wizard-harness'

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

test('WSL e2e happy path completes all 9 steps with mocked IPC', async () => {
  const harness = createMockElectronApi()
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('Ubuntu Dev')

  const runner = createTestWizardRunner(buildWslWizardSteps(), ctx)
  await runner.run()

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots.length, 9)
  assert.ok(snapshots.every((snapshot) => snapshot.status === WizardStepStatus.Succeeded))
  assert.equal(ctx.createdProfileId, 'ubuntu-dev')
  assert.equal(ctx.networkMode, 'mirrored')
  assert.equal(ctx.serverMetadata?.serverEnv, 'wsl')
})

test('WSL e2e preserves custom profile names during profile creation', async () => {
  const harness = createMockElectronApi()
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('My Linux Pairing')

  await createTestWizardRunner(buildWslWizardSteps(), ctx).run()

  assert.equal(ctx.createdProfileId, 'my-linux-pairing')
  assert.ok(harness.profiles.has('my-linux-pairing'))
})

test('WSL e2e supports multi-distro selection when the user picks a non-default distro', async () => {
  const harness = createMockElectronApi({
    distros: [
      { name: 'Ubuntu', version: 2, state: 'Running' },
      { name: 'Debian', version: 2, state: 'Stopped' },
    ],
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('Debian Dev')
  ctx.requestChoice = async () => 'Debian'

  await createTestWizardRunner(buildWslWizardSteps(), ctx).run()

  assert.equal(ctx.wslDistro, 'Debian')
  assert.equal(ctx.createdProfileId, 'debian-dev')
})

test('WSL e2e records NAT-mode warnings before connect-test', async () => {
  const harness = createMockElectronApi({ networkMode: 'nat' })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('NAT Profile')

  await createTestWizardRunner(buildWslWizardSteps(), ctx).run()

  assert.equal(ctx.networkMode, 'nat')
  assert.ok(ctx.warnings.some((warning) => warning.includes('NAT networking')))
  // T0383 (BUG-089): the NAT connect-failure hint is added only when
  // connect-test fails; here it passed.
  assert.ok(!ctx.warnings.includes(i18next.t('wizard.wsl.warning.connectFailedNat')))
})

test('WSL e2e rolls back bundle + profile state when profile persistence fails', async () => {
  const harness = createMockElectronApi({ profileUpdateOk: false })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('Rollback Profile')

  await assert.rejects(() => createTestWizardRunner(buildWslWizardSteps(), ctx).run(), /Failed to persist WSL profile metadata/)
  assert.equal(harness.operationLog.uninstallCalls.length, 1)
  assert.equal(harness.operationLog.removeUnitCalls.length, 1)
  assert.deepEqual(harness.operationLog.deletedProfileIds, ['rollback-profile'])
  assert.equal(harness.profiles.size, 0)
})
