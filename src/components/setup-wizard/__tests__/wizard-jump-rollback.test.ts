/**
 * T0489: jumpToStep (the failure screen's "Edit settings") walks the rollback
 * chain before re-running from the target step — the failed step first, then
 * completed / skipped steps after the target in reverse order (the T0309 basic
 * version only reset the snapshots). The target step itself is not rolled
 * back, each rollback only undoes what this wizard run owns (T0444), and a
 * rollback that throws is surfaced as a warning without blocking the jump.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
  type WizardStep,
} from '../wizard-runner'
import { pickContainerStep } from '../steps/docker/pick-container'
import { installDockerServerBundleStep } from '../steps/docker/install-server-bundle'
import { startDockerServerStep } from '../steps/docker/start-server'
import { installServerBundleStep } from '../steps/wsl/install-server-bundle'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'Dev Box' },
    warnings: [],
    state: {},
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
}

async function waitForStatus(runner: WizardRunner, stepId: string, status: WizardStepStatus): Promise<void> {
  await vi.waitFor(() => {
    const snap = runner.getSnapshots().find((s) => s.id === stepId)
    if (snap?.status !== status) throw new Error(`${stepId} is ${snap?.status}, waiting for ${status}`)
  })
}

function statusesOf(runner: WizardRunner): Record<string, WizardStepStatus> {
  return Object.fromEntries(runner.getSnapshots().map((s) => [s.id, s.status]))
}

interface Recorder {
  runs: string[]
  rollbacks: string[]
}

/** Step that records run / rollback calls; `failures` = how many runs throw first. */
function recordingStep(id: string, rec: Recorder, options: { failures?: number; rollback?: boolean } = {}): WizardStep {
  let remainingFailures = options.failures ?? 0
  return {
    id,
    title: id,
    appliesTo: 'all',
    async run() {
      rec.runs.push(id)
      if (remainingFailures > 0) {
        remainingFailures -= 1
        throw new Error(`${id} broke`)
      }
    },
    ...(options.rollback === false
      ? {}
      : {
          async rollback() {
            rec.rollbacks.push(id)
          },
        }),
  }
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
  vi.restoreAllMocks()
})

describe('WizardRunner.jumpToStep rollback chain (T0489)', () => {
  it('rolls back the failed step, then completed steps after the target in reverse; not the target or earlier steps', async () => {
    const rec: Recorder = { runs: [], rollbacks: [] }
    const steps = [
      recordingStep('detect', rec),
      recordingStep('pick', rec),
      recordingStep('install', rec),
      recordingStep('start', rec),
      recordingStep('verify', rec, { failures: 1 }),
      recordingStep('done', rec),
    ]
    const runner = new WizardRunner(steps, makeCtx())
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    await runner.jumpToStep(1)

    expect(rec.rollbacks).toEqual(['verify', 'start', 'install'])
    await run
    expect(rec.runs).toEqual(['detect', 'pick', 'install', 'start', 'verify', 'pick', 'install', 'start', 'verify', 'done'])
    expect(Object.values(statusesOf(runner)).every((s) => s === WizardStepStatus.Succeeded)).toBe(true)
  })

  it('resolves after the rollback chain with [target .. failed] reset to pending and errors cleared', async () => {
    let releaseRerun!: () => void
    const rerunGate = new Promise<void>((resolve) => { releaseRerun = resolve })
    let pickRuns = 0
    const rec: Recorder = { runs: [], rollbacks: [] }
    const steps: WizardStep[] = [
      {
        id: 'pick',
        title: 'pick',
        appliesTo: 'all',
        async run() {
          pickRuns += 1
          if (pickRuns === 2) await rerunGate
        },
      },
      recordingStep('install', rec),
      recordingStep('verify', rec, { failures: 1 }),
    ]
    const runner = new WizardRunner(steps, makeCtx())
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    await runner.jumpToStep(0)

    expect(rec.rollbacks).toEqual(['verify', 'install'])
    const snaps = runner.getSnapshots()
    expect(snaps.find((s) => s.id === 'install')?.status).toBe(WizardStepStatus.Pending)
    const verify = snaps.find((s) => s.id === 'verify')
    expect(verify?.status).toBe(WizardStepStatus.Pending)
    expect(verify?.error).toBeUndefined()
    expect(verify?.mappedError).toBeUndefined()
    await waitForStatus(runner, 'pick', WizardStepStatus.Running)
    releaseRerun()
    await run
  })

  it('a step skipped after the target is rolled back too (same chain as cancel)', async () => {
    const rec: Recorder = { runs: [], rollbacks: [] }
    const runner = new WizardRunner(
      [recordingStep('pick', rec), recordingStep('optional', rec, { failures: 1 }), recordingStep('verify', rec, { failures: 1 })],
      makeCtx(),
    )
    const run = runner.run()
    await waitForStatus(runner, 'optional', WizardStepStatus.Failed)
    await runner.skipCurrentStep()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    await runner.jumpToStep(0)

    expect(rec.rollbacks).toEqual(['verify', 'optional'])
    await run
    const optional = runner.getSnapshots().find((s) => s.id === 'optional')
    expect(optional).toMatchObject({ status: WizardStepStatus.Succeeded, skipped: false })
  })

  it('jumping to the failed step itself rolls nothing back (same as retry)', async () => {
    const rec: Recorder = { runs: [], rollbacks: [] }
    const runner = new WizardRunner([recordingStep('pick', rec), recordingStep('verify', rec, { failures: 1 })], makeCtx())
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    await runner.jumpToStep(1)
    await run

    expect(rec.rollbacks).toEqual([])
    expect(rec.runs).toEqual(['pick', 'verify', 'verify'])
  })

  it('steps without rollback() are simply reset and re-run', async () => {
    const rec: Recorder = { runs: [], rollbacks: [] }
    const runner = new WizardRunner(
      [recordingStep('pick', rec), recordingStep('probe', rec, { rollback: false }), recordingStep('verify', rec, { failures: 1, rollback: false })],
      makeCtx(),
    )
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)
    await runner.jumpToStep(0)
    await run
    expect(rec.rollbacks).toEqual([])
    expect(rec.runs).toEqual(['pick', 'probe', 'verify', 'pick', 'probe', 'verify'])
  })

  it('a rollback that throws is logged and shown as a warning; the rest of the chain and the jump still go ahead', async () => {
    const rec: Recorder = { runs: [], rollbacks: [] }
    const ctx = makeCtx()
    const stuck: WizardStep = {
      id: 'start',
      title: 'Start server',
      appliesTo: 'all',
      async run() { rec.runs.push('start') },
      async rollback() { throw new Error('unit is busy') },
    }
    const runner = new WizardRunner(
      [recordingStep('pick', rec), recordingStep('install', rec), stuck, recordingStep('verify', rec, { failures: 1 })],
      ctx,
    )
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(rec.rollbacks).toEqual(['verify', 'install'])
    expect(ctx.logger.warn).toHaveBeenCalledWith('Rollback failed for start while jumping back: unit is busy')
    expect(ctx.warnings).toEqual(['Could not undo "Start server" before going back: unit is busy'])
    expect(rec.runs).toEqual(['pick', 'install', 'start', 'verify', 'pick', 'install', 'start', 'verify'])
  })

  it('retry and skip are ignored while the jump-back rollback runs', async () => {
    let releaseRollback!: () => void
    const rollbackGate = new Promise<void>((resolve) => { releaseRollback = resolve })
    const rec: Recorder = { runs: [], rollbacks: [] }
    const slow: WizardStep = {
      id: 'install',
      title: 'install',
      appliesTo: 'all',
      async run() { rec.runs.push('install') },
      async rollback() {
        rec.rollbacks.push('install')
        await rollbackGate
      },
    }
    const runner = new WizardRunner([recordingStep('pick', rec), slow, recordingStep('verify', rec, { failures: 1 })], makeCtx())
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    const jumped = runner.jumpToStep(0)
    await vi.waitFor(() => expect(rec.rollbacks).toEqual(['verify', 'install']))
    await runner.skipCurrentStep()
    await runner.retryCurrentStep()
    expect(runner.getSnapshots().find((s) => s.id === 'verify')).toMatchObject({ status: WizardStepStatus.Failed, skipped: false })

    releaseRollback()
    await jumped
    await run
    expect(rec.runs).toEqual(['pick', 'install', 'verify', 'pick', 'install', 'verify'])
  })

  it('cancel during the jump-back rollback rolls back the remaining steps, target included, each once', async () => {
    let releaseRollback!: () => void
    const rollbackGate = new Promise<void>((resolve) => { releaseRollback = resolve })
    const rec: Recorder = { runs: [], rollbacks: [] }
    const slow: WizardStep = {
      id: 'install',
      title: 'install',
      appliesTo: 'all',
      async run() { rec.runs.push('install') },
      async rollback() {
        rec.rollbacks.push('install')
        await rollbackGate
      },
    }
    const runner = new WizardRunner(
      [recordingStep('detect', rec), recordingStep('pick', rec), slow, recordingStep('verify', rec, { failures: 1 })],
      makeCtx(),
    )
    const run = runner.run().then(() => null, (err: unknown) => err)
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    const jumped = runner.jumpToStep(1)
    await vi.waitFor(() => expect(rec.rollbacks).toEqual(['verify', 'install']))
    await runner.cancel()
    releaseRollback()
    await jumped

    expect(((await run) as Error).message).toBe('Wizard cancelled')
    expect(rec.rollbacks).toEqual(['verify', 'install', 'pick', 'detect'])
    expect(rec.runs).toEqual(['detect', 'pick', 'install', 'verify'])
    expect(statusesOf(runner)).toEqual({
      detect: WizardStepStatus.RolledBack,
      pick: WizardStepStatus.RolledBack,
      install: WizardStepStatus.Pending,
      verify: WizardStepStatus.Pending,
    })
  })

  it('does nothing (and warns) unless the current step is waiting on a failure decision', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const rec: Recorder = { runs: [], rollbacks: [] }
    const ctx = makeCtx()
    const runner = new WizardRunner(
      [recordingStep('pick', rec), { id: 'busy', title: 'busy', appliesTo: 'all', async run() { await gate } }],
      ctx,
    )
    const run = runner.run()
    await waitForStatus(runner, 'busy', WizardStepStatus.Running)

    await runner.jumpToStep(0)

    expect(ctx.logger.warn).toHaveBeenCalledWith('jumpToStep: step busy is not waiting on a failure decision')
    expect(rec.rollbacks).toEqual([])
    expect(statusesOf(runner)).toEqual({ pick: WizardStepStatus.Succeeded, busy: WizardStepStatus.Running })
    release()
    await run
    expect(rec.runs).toEqual(['pick'])
  })

  it('a non-retryable failure has already been rolled back; a late jump is ignored', async () => {
    const rec: Recorder = { runs: [], rollbacks: [] }
    const ctx = makeCtx()
    const runner = new WizardRunner(
      [recordingStep('pick', rec), { ...recordingStep('fatal', rec, { failures: 1 }), retryable: false }],
      ctx,
    )
    await expect(runner.run()).rejects.toThrow('fatal broke')
    expect(rec.rollbacks).toEqual(['fatal', 'pick'])

    await runner.jumpToStep(0)

    expect(rec.rollbacks).toEqual(['fatal', 'pick'])
    expect(rec.runs).toEqual(['pick', 'fatal'])
    expect(ctx.logger.warn).toHaveBeenCalledWith('jumpToStep: step fatal is not waiting on a failure decision')
  })

  it('retry and skip keep their behaviour: no rollback of the failed step', async () => {
    const rec: Recorder = { runs: [], rollbacks: [] }
    const retryRunner = new WizardRunner([recordingStep('pick', rec), recordingStep('verify', rec, { failures: 1 })], makeCtx())
    const retried = retryRunner.run()
    await waitForStatus(retryRunner, 'verify', WizardStepStatus.Failed)
    await retryRunner.retryCurrentStep()
    await retried
    expect(rec.rollbacks).toEqual([])
    expect(rec.runs).toEqual(['pick', 'verify', 'verify'])

    const skipRec: Recorder = { runs: [], rollbacks: [] }
    const skipRunner = new WizardRunner([recordingStep('pick', skipRec), recordingStep('verify', skipRec, { failures: 1 })], makeCtx())
    const skipped = skipRunner.run()
    await waitForStatus(skipRunner, 'verify', WizardStepStatus.Failed)
    await skipRunner.skipCurrentStep()
    await skipped
    expect(skipRec.rollbacks).toEqual([])
    expect(skipRunner.getSnapshots()[1]).toMatchObject({ status: WizardStepStatus.Succeeded, skipped: true })
  })
})

// ── Ownership: the jump-back chain only reclaims what this run owns (T0444) ──

interface FakeContainer {
  name: string
  running: boolean
}

function installDocker(containersIn: FakeContainer[]) {
  const containers = new Map(containersIn.map((c) => [c.name, { ...c }]))
  const docker = {
    listContainers: vi.fn(async () =>
      Array.from(containers.values()).map((c) => ({ id: `id-${c.name}`, name: c.name, image: 'img', state: c.running ? 'running' : 'exited', status: '' })),
    ),
    inspectContainer: vi.fn(async (name: string) => {
      const c = containers.get(name)
      if (!c) throw new Error(`No such container: ${name}`)
      return { id: `id-${name}`, name, image: 'bat-server:latest', state: { status: c.running ? 'running' : 'exited', running: c.running, health: 'healthy' }, mounts: [], ports: [], env: [] }
    }),
    startContainer: vi.fn(async (name: string, opts?: { createIfMissing?: boolean }) => {
      if (opts?.createIfMissing) {
        if (containers.has(name)) return { ok: false, error: `Conflict. The container name "/${name}" is already in use by container "abc".` }
        containers.set(name, { name, running: true })
        return { ok: true, token: 'tok' }
      }
      const c = containers.get(name)
      if (c) c.running = true
      return { ok: true, token: 'tok' }
    }),
    getContainerHealth: vi.fn(async () => ({ ok: true, health: 'healthy' })),
    stopContainer: vi.fn(async (name: string) => {
      const c = containers.get(name)
      if (c) c.running = false
      return { ok: true }
    }),
    removeContainer: vi.fn(async (name: string) => {
      if (!containers.has(name)) return { ok: false, error: `Error response from daemon: No such container: ${name}` }
      containers.delete(name)
      return { ok: true }
    }),
    execCommand: vi.fn(async () => ({ ok: true as const })),
  }
  ;(globalThis as unknown as { window: unknown }).window = { electronAPI: { docker } }
  return { docker, containers }
}

function dockerCtx(state: Record<string, unknown>): WizardContext {
  return makeCtx({ targetOS: 'docker-linux', serverPort: 19876, state })
}

/** fetch-fingerprint stand-in: fails once, then succeeds. */
function flakyVerify(): WizardStep {
  let failed = false
  return {
    id: 'fetch-fingerprint',
    title: 'fetch-fingerprint',
    appliesTo: 'all',
    async run() {
      if (!failed) {
        failed = true
        throw new Error('unreachable')
      }
    },
  }
}

describe('jump back in the Docker flow touches only what this run did (T0489 / T0444)', () => {
  it('"Create new": the container this run created is removed before the re-run; the user container with the default name survives', async () => {
    const { docker, containers } = installDocker([{ name: 'bat-server-dev-box', running: true }])
    const ctx = dockerCtx({ containerMode: 'new' })
    const runner = new WizardRunner([pickContainerStep, installDockerServerBundleStep, startDockerServerStep, flakyVerify()], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'fetch-fingerprint', WizardStepStatus.Failed)
    expect(containers.has('bat-server-dev-box-2')).toBe(true)

    await runner.jumpToStep(0)

    expect(docker.removeContainer.mock.calls.map(([name]) => name)).toEqual(['bat-server-dev-box-2'])
    expect(containers.get('bat-server-dev-box')?.running).toBe(true)
    await run
    // The re-run creates our container again under the same free name.
    expect(containers.has('bat-server-dev-box-2')).toBe(true)
    expect(containers.get('bat-server-dev-box')?.running).toBe(true)
    expect(docker.execCommand).not.toHaveBeenCalled()
  })

  it('"Use existing" on a running user container: jump back neither stops nor removes it', async () => {
    const { docker, containers } = installDocker([{ name: 'mine', running: true }])
    const ctx = dockerCtx({ containerMode: 'existing', dockerContainer: 'mine' })
    const runner = new WizardRunner([pickContainerStep, installDockerServerBundleStep, startDockerServerStep, flakyVerify()], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'fetch-fingerprint', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(docker.stopContainer).not.toHaveBeenCalled()
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(docker.execCommand).not.toHaveBeenCalled()
    expect(containers.get('mine')?.running).toBe(true)
  })

  it('"Use existing" on a stopped container this run started: jump back stops it again before the re-run', async () => {
    const { docker, containers } = installDocker([{ name: 'mine', running: false }])
    const ctx = dockerCtx({ containerMode: 'existing', dockerContainer: 'mine' })
    const runner = new WizardRunner([pickContainerStep, installDockerServerBundleStep, startDockerServerStep, flakyVerify()], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'fetch-fingerprint', WizardStepStatus.Failed)

    await runner.jumpToStep(0)

    expect(docker.stopContainer).toHaveBeenCalledWith('mine')
    await run
    // Stopped before the re-run started it again; never removed.
    expect(docker.startContainer).toHaveBeenCalledTimes(2)
    expect(docker.stopContainer.mock.invocationCallOrder[0]).toBeLessThan(docker.startContainer.mock.invocationCallOrder[1])
    expect(containers.get('mine')?.running).toBe(true)
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })
})

describe('jump back in the WSL flow never deletes a bundle this run did not install (T0489)', () => {
  function installWsl(options: { distributeOk?: boolean } = {}) {
    const wsl = {
      resolveHome: vi.fn(async () => '/home/alice'),
      installBundle: vi.fn(async () => ({ ok: true })),
      uninstallBundle: vi.fn(async () => ({ ok: true })),
      detectNetworkMode: vi.fn(async () => ({ actual: 'mirrored', declared: 'mirrored', mirroredSupported: true })),
    }
    const distribute = vi.fn(async () =>
      options.distributeOk === false
        ? { ok: false, errorCode: 'download-failed', error: 'offline' }
        : { ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' },
    )
    ;(globalThis as unknown as { window: unknown }).window = {
      electronAPI: {
        update: { getVersion: vi.fn(async () => '0.6.0') },
        remote: { serverBundle: { distribute, onDistributeProgress: vi.fn(() => () => undefined) } },
        wsl,
      },
    }
    return { wsl, distribute }
  }

  function pickDistro(): WizardStep {
    return { id: 'pick-wsl-distro', title: 'pick', appliesTo: 'all', async run(ctx) { ctx.wslDistro = 'Ubuntu' } }
  }

  it('install fails before installing (download) → jump back does not rm -rf the default install path', async () => {
    const { wsl, distribute } = installWsl({ distributeOk: false })
    // createWslWizardContext presets this default; it must not gate rollback.
    const ctx = makeCtx({ serverInstallPath: '~/.local/bat-server' })
    const runner = new WizardRunner([pickDistro(), installServerBundleStep], ctx)
    const run = runner.run().then(() => null, (err: unknown) => err)
    await waitForStatus(runner, 'install-server-bundle', WizardStepStatus.Failed)

    distribute.mockResolvedValue({ ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' })
    await runner.jumpToStep(0)
    expect(await run).toBeNull()

    expect(wsl.uninstallBundle).not.toHaveBeenCalled()
    expect(wsl.installBundle).toHaveBeenCalledTimes(1)
  })

  it('bundle installed by this run, a later step fails → jump back removes it before the re-run', async () => {
    const { wsl } = installWsl()
    const ctx = makeCtx({ serverInstallPath: '~/.local/bat-server' })
    const runner = new WizardRunner([pickDistro(), installServerBundleStep, flakyVerify()], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'fetch-fingerprint', WizardStepStatus.Failed)

    await runner.jumpToStep(0)

    expect(wsl.uninstallBundle).toHaveBeenCalledWith('Ubuntu', '/home/alice/.local/bat-server')
    await run
    expect(wsl.installBundle).toHaveBeenCalledTimes(2)
    expect(ctx.serverInstallPath).toBe('/home/alice/.local/bat-server')
  })

  it('install fails during the install → its rollback still removes the partial bundle', async () => {
    const { wsl } = installWsl()
    wsl.installBundle.mockResolvedValueOnce({ ok: false, error: 'tar: unexpected EOF' } as never)
    const ctx = makeCtx({ wslDistro: 'Ubuntu', serverInstallPath: '/home/alice/.local/bat-server' })
    await expect(installServerBundleStep.run(ctx)).rejects.toThrow(/unexpected EOF/)
    await installServerBundleStep.rollback!(ctx)
    expect(wsl.uninstallBundle).toHaveBeenCalledWith('Ubuntu', '/home/alice/.local/bat-server')
  })
})
