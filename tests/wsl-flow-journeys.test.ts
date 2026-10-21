import assert from 'node:assert/strict'
import i18next from 'i18next'
import { afterEach, test } from 'node:test'
import { buildWslWizardSteps } from '../src/components/setup-wizard/wsl-flow'
import { resetFetchFingerprintImplForTests, setFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'
import { createTestWizardRunner } from './__helpers__/wizard-harness'

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

test('Journey 1: happy path on mirrored mode writes profile metadata', async () => {
  const harness = createMockElectronApi({ networkMode: 'mirrored' })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('Ubuntu Happy Path')

  await createTestWizardRunner(buildWslWizardSteps(), ctx).run()

  assert.equal(ctx.networkMode, 'mirrored')
  assert.equal(ctx.serverMetadata?.serverEnv, 'wsl')
  assert.equal(ctx.createdProfileId, 'ubuntu-happy-path')
})

test('Journey 2: NAT mode adds downgrade guidance but still completes', async () => {
  const harness = createMockElectronApi({ networkMode: 'nat' })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('NAT Journey')

  await createTestWizardRunner(buildWslWizardSteps(), ctx).run()

  assert.equal(ctx.createdProfileId, 'nat-journey')
  // T0383 (BUG-089): NAT is informational (localhostForwarding); Mirrored is
  // only suggested once the connection test fails.
  assert.ok(ctx.warnings.includes(i18next.t('wizard.wsl.warning.networkNat')))
  assert.ok(ctx.warnings.some((warning) => warning.includes('localhostForwarding')))
})

test('Journey 3: running the wizard twice across distros keeps both profiles', async () => {
  const harness = createMockElectronApi({
    distros: [
      { name: 'Ubuntu', version: 2, state: 'Running' },
      { name: 'Debian', version: 2, state: 'Stopped' },
    ],
  })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const first = harness.createContext('Ubuntu A')
  first.requestChoice = async () => 'Ubuntu'
  await createTestWizardRunner(buildWslWizardSteps(), first).run()

  const second = harness.createContext('Debian B')
  second.requestChoice = async () => 'Debian'
  await createTestWizardRunner(buildWslWizardSteps(), second).run()

  assert.ok(harness.profiles.has('ubuntu-a'))
  assert.ok(harness.profiles.has('debian-b'))
  assert.equal(harness.profiles.size, 2)
})
