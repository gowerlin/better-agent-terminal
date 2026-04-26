import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildWslWizardSteps, createWslWizardContext } from '../src/components/setup-wizard/wsl-flow'
import { setFetchFingerprintImplForTests, resetFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { wslWizardSteps } from '../src/components/setup-wizard/steps/wsl'
import { WizardRunner, WizardStepStatus, type WizardContext, type WizardStep } from '../src/components/setup-wizard/wizard-runner'

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

  const electronAPI = {
    platform: 'win32',
    wsl: {
      list: async () => ({
        distros: [{ name: 'Ubuntu', version: 2 as const, state: 'Running' as const }],
        default: 'Ubuntu',
      }),
      systemdEnabled: async () => true,
      detectNetworkMode: async () => 'mirrored' as const,
      installBundle: async () => ({ ok: true as const }),
      uninstallBundle: async () => ({ ok: true as const }),
    },
    wslSystemd: {
      writeUnit: async () => ({ ok: true as const }),
      enableLinger: async () => ({ ok: true }),
      startService: async () => ({ ok: true as const, token: 'secret-token' }),
      removeUnit: async () => ({ ok: true as const }),
    },
    app: {
      getUserDataPath: async () => 'C:\\Users\\test\\AppData\\Roaming\\BAT',
    },
    fs: {
      readdir: async () => [
        {
          name: 'bat-server-linux-x64-v0.3.1.tar.gz',
          path: 'C:\\Users\\test\\AppData\\Roaming\\BAT\\bat-server-bundles\\bat-server-linux-x64-v0.3.1.tar.gz',
          isDirectory: false,
          pathKey: 'bundle',
        },
      ],
    },
    remote: {
      testConnection: async () => ({
        ok: true,
        fingerprint: 'FP:AA:BB:CC',
        metadata: {
          serverPlatform: 'linux' as const,
          serverArch: 'x64' as const,
          serverEnv: 'wsl' as const,
          nodeVersion: '24.0.0',
          bundleVersion: '0.3.1',
        },
      }),
    },
    profile: {
      create: async () => ({
        id: 'wsl-ubuntu',
        name: 'Ubuntu Dev',
        type: 'remote' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      update: async () => true,
      delete: async () => true,
    },
  }

  ;(globalThis as typeof globalThis & { window?: unknown }).window = { electronAPI }

  const ctx: WizardContext = {
    ...makeContext(),
    profileDraft: { name: 'Ubuntu Dev' },
  }

  const runner = new WizardRunner(wslWizardSteps, ctx)
  await runner.run()

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots.length, 9)
  assert.ok(snapshots.every((snapshot) => snapshot.status === WizardStepStatus.Succeeded))
  assert.equal(ctx.wslDistro, 'Ubuntu')
  assert.equal(ctx.serverInstallPath, '~/.local/bat-server')
  assert.equal(ctx.remoteToken, 'secret-token')
  assert.equal(ctx.fingerprint, 'FP:AA:BB:CC')
  assert.equal(ctx.createdProfileId, 'wsl-ubuntu')
  assert.equal(ctx.serverMetadata?.serverEnv, 'wsl')

  resetFetchFingerprintImplForTests()
})

test('buildWslWizardSteps() integrates with WizardRunner end-to-end', async () => {
  setFetchFingerprintImplForTests(async () => 'FP:AA:BB:CC')

  const electronAPI = {
    platform: 'win32',
    wsl: {
      list: async () => ({
        distros: [{ name: 'Ubuntu', version: 2 as const, state: 'Running' as const }],
        default: 'Ubuntu',
      }),
      systemdEnabled: async () => true,
      detectNetworkMode: async () => 'mirrored' as const,
      installBundle: async () => ({ ok: true as const }),
      uninstallBundle: async () => ({ ok: true as const }),
    },
    wslSystemd: {
      writeUnit: async () => ({ ok: true as const }),
      enableLinger: async () => ({ ok: true }),
      startService: async () => ({ ok: true as const, token: 'secret-token' }),
      removeUnit: async () => ({ ok: true as const }),
    },
    app: {
      getUserDataPath: async () => 'C:\\Users\\test\\AppData\\Roaming\\BAT',
    },
    fs: {
      readdir: async () => [
        {
          name: 'bat-server-linux-x64-v0.3.1.tar.gz',
          path: 'C:\\Users\\test\\AppData\\Roaming\\BAT\\bat-server-bundles\\bat-server-linux-x64-v0.3.1.tar.gz',
          isDirectory: false,
          pathKey: 'bundle',
        },
      ],
    },
    remote: {
      testConnection: async () => ({
        ok: true,
        fingerprint: 'FP:AA:BB:CC',
        metadata: {
          serverPlatform: 'linux' as const,
          serverArch: 'x64' as const,
          serverEnv: 'wsl' as const,
          nodeVersion: '24.0.0',
          bundleVersion: '0.3.1',
        },
      }),
    },
    profile: {
      create: async () => ({
        id: 'wsl-ubuntu',
        name: 'Ubuntu Dev',
        type: 'remote' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      update: async () => true,
      delete: async () => true,
    },
  }

  ;(globalThis as typeof globalThis & { window?: unknown }).window = { electronAPI }

  const ctx = createWslWizardContext({ profileName: 'Ubuntu Dev' })
  const runner = new WizardRunner(buildWslWizardSteps(), ctx)
  await runner.run()

  assert.equal(runner.getSnapshots().length, 9)
  assert.equal(ctx.networkMode, 'mirrored')
  assert.equal(ctx.createdProfileId, 'wsl-ubuntu')

  resetFetchFingerprintImplForTests()
})
