import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildWslWizardSteps, createWslWizardContext } from '../src/components/setup-wizard/wsl-flow'
import { setFetchFingerprintImplForTests, resetFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { wslWizardSteps } from '../src/components/setup-wizard/steps/wsl'
import { WizardRunner, WizardStepStatus, type WizardContext, type WizardStep } from '../src/components/setup-wizard/wizard-runner'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'
import { createTestWizardRunner } from './__helpers__/wizard-harness'

function makeContext(): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: {},
    warnings: [],
    state: {},
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  }
}

test('WizardRunner rolls back completed steps in reverse order', async () => {
  const calls: string[] = []
  const steps: WizardStep[] = [
    {
      id: 'one',
      title: 'Step one',
      appliesTo: 'all',
      async run() {
        calls.push('run:one')
      },
      async rollback() {
        calls.push('rollback:one')
      },
    },
    {
      id: 'two',
      title: 'Step two',
      appliesTo: 'all',
      async run() {
        calls.push('run:two')
      },
      async rollback() {
        calls.push('rollback:two')
      },
    },
    {
      id: 'three',
      title: 'Step three',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:three')
        throw new Error('boom')
      },
    },
  ]

  const runner = new WizardRunner(steps, makeContext())

  await assert.rejects(() => runner.run(), /boom/)
  assert.deepEqual(calls, ['run:one', 'run:two', 'run:three', 'rollback:two', 'rollback:one'])

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots[0].status, WizardStepStatus.RolledBack)
  assert.equal(snapshots[1].status, WizardStepStatus.RolledBack)
  assert.equal(snapshots[2].status, WizardStepStatus.Failed)
})

test('WSL wizard happy path completes all 9 steps and accumulates context', async () => {
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  // T0682 (BUG-168 G4): the shared mock tracks the current IPC; the inline
  // copy here had drifted (no wsl.resolveHome / update.getVersion / ...).
  const harness = createMockElectronApi()
  installMockWindow(harness.electronAPI)

  const ctx: WizardContext = {
    ...makeContext(),
    profileDraft: { name: 'Ubuntu Dev' },
  }

  const runner = createTestWizardRunner(wslWizardSteps, ctx)
  await runner.run()

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots.length, 9)
  assert.ok(snapshots.every((snapshot) => snapshot.status === WizardStepStatus.Succeeded))
  assert.equal(ctx.wslDistro, 'Ubuntu')
  // T0378 (BUG-087 B): systemd never expands `~`, so the install path is
  // built from the distro user's absolute $HOME.
  assert.equal(ctx.wslHome, '/home/test')
  assert.equal(ctx.serverInstallPath, '/home/test/.local/bat-server')
  assert.equal(harness.operationLog.writeUnitCalls[0]?.unit.execStart, '/home/test/.local/bat-server/bin/bat-server')
  assert.equal(ctx.remoteToken, 'secret-token')
  assert.equal(ctx.fingerprint, 'FP:AA:BB:CC')
  assert.equal(ctx.createdProfileId, 'ubuntu-dev')
  assert.equal(ctx.serverMetadata?.serverEnv, 'wsl')

  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

test('buildWslWizardSteps() integrates with WizardRunner end-to-end', async () => {
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const harness = createMockElectronApi()
  installMockWindow(harness.electronAPI)

  const ctx = createWslWizardContext({ profileName: 'Ubuntu Dev' })
  const runner = createTestWizardRunner(buildWslWizardSteps(), ctx)
  await runner.run()

  assert.equal(runner.getSnapshots().length, 9)
  assert.equal(ctx.networkMode, 'mirrored')
  assert.equal(ctx.createdProfileId, 'ubuntu-dev')

  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

// T0300 BUG-066 — run() must reset runPromise on rejection so the same
// instance can be retried by calling run() again, without returning the
// previous (already-rejected) promise.
test('WizardRunner run() can be retried on the same instance after failure', async () => {
  let runCalls = 0
  let throwOnce = true
  const steps: WizardStep[] = [
    {
      id: 'flaky',
      title: 'Flaky step',
      appliesTo: 'all',
      retryable: false,
      async run() {
        runCalls += 1
        if (throwOnce) {
          throwOnce = false
          throw new Error('first attempt failed')
        }
      },
    },
  ]

  const runner = new WizardRunner(steps, makeContext())

  await assert.rejects(() => runner.run(), /first attempt failed/)
  // BUG-066: previously this resolved/rejected with the cached failed
  // promise without re-entering runInternal; now it must run again.
  await runner.run()

  assert.equal(runCalls, 2, 'second run() must trigger a fresh runInternal flow')
})

test('WizardRunner run() can be retried after consecutive failures (third try succeeds)', async () => {
  let runCalls = 0
  const steps: WizardStep[] = [
    {
      id: 'flaky',
      title: 'Flaky step',
      appliesTo: 'all',
      retryable: false,
      async run() {
        runCalls += 1
        if (runCalls < 3) {
          throw new Error(`attempt ${runCalls} failed`)
        }
      },
    },
  ]

  const runner = new WizardRunner(steps, makeContext())

  await assert.rejects(() => runner.run(), /attempt 1 failed/)
  await assert.rejects(() => runner.run(), /attempt 2 failed/)
  await runner.run()

  assert.equal(runCalls, 3, 'each run() must trigger its own runInternal pass')
})
