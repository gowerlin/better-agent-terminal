import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
  type WizardStep,
} from '../src/components/setup-wizard/wizard-runner'
import { installServerBundleStep as wslInstallServerBundleStep } from '../src/components/setup-wizard/steps/wsl/install-server-bundle'
import { writeSystemdUnitStep as wslWriteSystemdUnitStep } from '../src/components/setup-wizard/steps/wsl/write-systemd-unit'
import { pickContainerStep as dockerPickContainerStep } from '../src/components/setup-wizard/steps/docker/pick-container'
import { installDockerServerBundleStep as dockerInstallServerBundleStep } from '../src/components/setup-wizard/steps/docker/install-server-bundle'
import { installSshServerBundleStep } from '../src/components/setup-wizard/steps/ssh/install-server-bundle'
import { startServerStep as sshStartServerStep } from '../src/components/setup-wizard/steps/ssh/start-server'

// PLAN-007 T0289 AC7 — cross-deployment uniform rollback contract.
//
// For each of WSL / Docker / SSH we run a minimal install-then-fail wizard
// flow and assert that:
//   1. the install step's rollback ran (deployment-specific cleanup IPC fired)
//   2. the synthetic write-profile step is never reached → profile not written
//   3. the per-deployment "remove install path" command is invoked
//
// The fixture intentionally keeps each flow minimal so the assertion focuses
// on the rollback contract rather than re-testing each deployment's full
// happy path (already covered by ssh-wizard-e2e / wsl-wizard-e2e /
// docker-wizard-e2e).

interface CrossFixture {
  name: string
  buildSteps: () => Promise<{
    runner: WizardRunner
    ctx: WizardContext
    operationLog: ReturnType<typeof createMockElectronApi>['operationLog']
    profiles: ReturnType<typeof createMockElectronApi>['profiles']
  }>
  // returns true iff the install path cleanup was invoked
  assertInstallPathCleanedUp: (
    operationLog: ReturnType<typeof createMockElectronApi>['operationLog'],
  ) => void
}

function makeFailingProfileWriteStep(label: string): WizardStep {
  return {
    id: `${label}-write-profile`,
    title: `${label} write profile (synthetic failing step)`,
    appliesTo: 'all',
    retryable: false,
    async run() {
      // Simulates connect-test or write-profile blowing up after install
      // succeeded. Real flows already exercise these failure points; here we
      // just need a deterministic post-install failure so rollback unwinds.
      throw new Error(`${label}-post-install-failure`)
    },
  }
}

const fixtures: CrossFixture[] = [
  {
    name: 'wsl-linux',
    buildSteps: async () => {
      const harness = createMockElectronApi({})
      installMockWindow(harness.electronAPI)

      const ctx = harness.createContext('Ubuntu Dev')
      ctx.targetOS = 'wsl-linux'
      ctx.wslDistro = 'Ubuntu'
      ctx.wslSystemdEnabled = true
      ctx.serverPort = 9876
      ctx.state.serverPort = 9876

      const steps: WizardStep[] = [
        wslInstallServerBundleStep,
        wslWriteSystemdUnitStep,
        makeFailingProfileWriteStep('wsl'),
      ]
      const runner = new WizardRunner(steps, ctx)
      return { runner, ctx, operationLog: harness.operationLog, profiles: harness.profiles }
    },
    assertInstallPathCleanedUp: (operationLog) => {
      const cleaned = operationLog.uninstallCalls.some(
        (c) => c.distro === 'Ubuntu' && c.installPath === '~/.local/bat-server',
      )
      assert.equal(cleaned, true, 'wsl.uninstallBundle should be invoked with the install path')
      const unitRemoved = operationLog.removeUnitCalls.includes('bat-server.service')
      assert.equal(unitRemoved, true, 'wslSystemd.removeUnit should be invoked for bat-server.service')
    },
  },
  {
    name: 'docker-linux',
    buildSteps: async () => {
      const harness = createMockElectronApi({
        dockerContainers: [
          { id: 'c-1', name: 'my-existing', image: 'debian:bookworm-slim', state: 'running', status: 'Up' },
        ],
      })
      installMockWindow(harness.electronAPI)

      const ctx = harness.createDockerContext('Docker Dev')
      ctx.targetOS = 'docker-linux'
      // Force "existing" mode so install-server-bundle rollback exec-cleans the
      // install path inside the user's container.
      ctx.state.containerMode = 'existing'
      ctx.state.dockerContainer = 'my-existing'
      ctx.serverPort = 9876
      ctx.state.serverPort = 9876

      const steps: WizardStep[] = [
        dockerPickContainerStep,
        dockerInstallServerBundleStep,
        makeFailingProfileWriteStep('docker'),
      ]
      const runner = new WizardRunner(steps, ctx)
      return { runner, ctx, operationLog: harness.operationLog, profiles: harness.profiles }
    },
    assertInstallPathCleanedUp: (operationLog) => {
      // pick-container rollback only acts in "new" mode, so for "existing" we
      // expect zero remove calls there. install-server-bundle rollback should
      // be the one cleaning /opt/bat-server via execCommand.
      const dockerExecCalls = operationLog.dockerExecCalls ?? []
      const cleaned = dockerExecCalls.some(
        (c) =>
          c.name === 'my-existing' &&
          c.command[0] === 'rm' &&
          c.command.includes('-rf') &&
          c.command.includes('/opt/bat-server'),
      )
      assert.equal(cleaned, true, 'docker.execCommand should run rm -rf on the install path')
    },
  },
  {
    name: 'ssh-linux',
    buildSteps: async () => {
      const harness = createMockElectronApi({
        remoteServerPlatform: 'linux',
        remoteServerArch: 'x64',
      })
      installMockWindow(harness.electronAPI)

      const ctx = harness.createSshContext('SSH Linux Dev', {
        sshHost: '10.0.0.42',
        sshUser: 'devuser',
        sshKeyPath: '/home/test/.ssh/id_rsa',
        sshInstallPath: '/home/devuser/bat-server',
        sshServerHome: '/home/devuser',
        sshServerArch: 'x86_64',
      })
      ctx.targetOS = 'ssh-linux'
      ctx.serverPort = 9876
      ctx.state.serverPort = 9876

      const steps: WizardStep[] = [
        installSshServerBundleStep,
        sshStartServerStep,
        makeFailingProfileWriteStep('ssh-linux'),
      ]
      const runner = new WizardRunner(steps, ctx)
      return { runner, ctx, operationLog: harness.operationLog, profiles: harness.profiles }
    },
    assertInstallPathCleanedUp: (operationLog) => {
      const uninstall = operationLog.sshUninstallCalls ?? []
      const cleaned = uninstall.some(
        (c) => c.sshHost === '10.0.0.42' && c.installPath === '/home/devuser/bat-server',
      )
      assert.equal(cleaned, true, 'ssh.uninstallBundle should be invoked with the install path')
      const stop = operationLog.sshStopServerCalls ?? []
      const stopped = stop.some(
        (c) => c.sshHost === '10.0.0.42' && c.targetOS === 'ssh-linux',
      )
      assert.equal(stopped, true, 'ssh.stopServer should be invoked for the linux unit')
    },
  },
]

for (const fixture of fixtures) {
  test(`T0289 AC7: ${fixture.name} install-then-fail rollback chain triggers cleanup`, async () => {
    const { runner, ctx, operationLog, profiles } = await fixture.buildSteps()

    await assert.rejects(() => runner.run(), /post-install-failure/)

    fixture.assertInstallPathCleanedUp(operationLog)

    // No profile should be written: the failing step short-circuits the chain
    // before any write-profile step runs.
    assert.equal(profiles.size, 0, 'no profile should be persisted on rollback')
    assert.equal(operationLog.createdProfileIds.length, 0, 'no profile id should be created')
    assert.equal(ctx.createdProfileId, undefined, 'createdProfileId should remain unset')

    // The synthetic failing step should appear as Failed and at least one
    // earlier step should be RolledBack — proving the chain unwound.
    const snapshots = runner.getSnapshots()
    const failed = snapshots.find((s) => s.status === WizardStepStatus.Failed)
    const rolledBack = snapshots.filter((s) => s.status === WizardStepStatus.RolledBack)
    assert.ok(failed, `${fixture.name}: failing step should be marked Failed`)
    assert.ok(rolledBack.length > 0, `${fixture.name}: at least one step should be RolledBack`)
  })
}
