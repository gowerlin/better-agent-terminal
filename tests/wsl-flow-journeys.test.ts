import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { buildWslWizardSteps } from '../src/components/setup-wizard/wsl-flow'
import { resetFetchFingerprintImplForTests, setFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { WizardRunner } from '../src/components/setup-wizard/wizard-runner'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

test('Journey 1: happy path on mirrored mode writes profile metadata', async () => {
  const harness = createMockElectronApi({ networkMode: 'mirrored' })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('Ubuntu Happy Path')

  await new WizardRunner(buildWslWizardSteps(), ctx).run()

  assert.equal(ctx.networkMode, 'mirrored')
  assert.equal(ctx.serverMetadata?.serverEnv, 'wsl')
  assert.equal(ctx.createdProfileId, 'ubuntu-happy-path')
})

test('Journey 2: NAT mode adds downgrade guidance but still completes', async () => {
  const harness = createMockElectronApi({ networkMode: 'nat' })
  installMockWindow(harness.electronAPI)
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const ctx = harness.createContext('NAT Journey')

  await new WizardRunner(buildWslWizardSteps(), ctx).run()

  assert.equal(ctx.createdProfileId, 'nat-journey')
  assert.ok(ctx.warnings.some((warning) => warning.includes('mirrored mode')))
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
  await new WizardRunner(buildWslWizardSteps(), first).run()

  const second = harness.createContext('Debian B')
  second.requestChoice = async () => 'Debian'
  await new WizardRunner(buildWslWizardSteps(), second).run()

  assert.ok(harness.profiles.has('ubuntu-a'))
  assert.ok(harness.profiles.has('debian-b'))
  assert.equal(harness.profiles.size, 2)
})
