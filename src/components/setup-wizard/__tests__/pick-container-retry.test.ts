/**
 * T0502: pick-container writes containerMode / dockerContainer only after the
 * choice checks out. Before T0502 a first-run "Use existing" with no
 * containers stored containerMode = 'existing' and then failed; retry reused
 * the stored mode without asking, so it failed forever and only cancel was
 * left. Rollback ownership (T0444 / T0489 / T0500) is unchanged: a failed
 * re-run leaves the earlier mode and container in place for rollback.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
  type WizardStep,
} from '../wizard-runner'
import { pickContainerStep } from '../steps/docker/pick-container'

type ContainerEntry = { name: string; state: 'running' | 'exited' | 'created' }

function installDocker(containers: ContainerEntry[]) {
  const docker = {
    listContainers: vi.fn().mockResolvedValue(containers),
    removeContainer: vi.fn().mockResolvedValue({ ok: true }),
  }
  ;(globalThis as unknown as { window: unknown }).window = { electronAPI: { docker } }
  return docker
}

function choiceQueue(answers: Array<string | null>) {
  const requests: WizardChoiceRequest[] = []
  const requestChoice = vi.fn(async (request: WizardChoiceRequest) => {
    requests.push(request)
    return answers.length > 0 ? answers.shift()! : null
  })
  return { requestChoice, requests }
}

function dockerCtx(requestChoice: WizardContext['requestChoice']): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: 'Dev Box' },
    warnings: [],
    state: { containerMode: 'unknown' },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    requestChoice,
  }
}

async function waitForStatus(runner: WizardRunner, stepId: string, status: WizardStepStatus): Promise<void> {
  await vi.waitFor(() => {
    const snap = runner.getSnapshots().find((s) => s.id === stepId)
    if (snap?.status !== status) throw new Error(`${stepId} is ${snap?.status}, waiting for ${status}`)
  })
}

/**
 * Stand-in for start-server: claims the container as created by this run and
 * fails the first time. Its rollback leaves the claim in place, so the
 * pick-container rollback is the one that has to find the container.
 */
function creatingStartServer(): WizardStep {
  let failures = 1
  return {
    id: 'start-server',
    title: 'start-server',
    appliesTo: 'all',
    retryable: true,
    async run(ctx) {
      ctx.state.dockerContainerCreatedByWizard = ctx.state.dockerContainer
      if (failures > 0) {
        failures -= 1
        throw new Error('start-server broke')
      }
    },
    async rollback() {
      // leaves dockerContainerCreatedByWizard set
    },
  }
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
  vi.restoreAllMocks()
})

describe('pick-container: a failed choice is not stored (T0502)', () => {
  it('first run "Use existing" with no containers fails, retry asks again, "Create new" succeeds', async () => {
    installDocker([])
    const { requestChoice } = choiceQueue(['existing', 'new'])
    const ctx = dockerCtx(requestChoice)
    const runner = new WizardRunner([pickContainerStep], ctx)
    const run = runner.run()

    await waitForStatus(runner, 'pick-container', WizardStepStatus.Failed)
    expect(runner.getSnapshots()[0].error).toMatch(/No Docker containers found/)
    expect(ctx.state.containerMode).toBe('unknown')
    expect(ctx.state.dockerContainer).toBeUndefined()

    await runner.retryCurrentStep()
    await run

    expect(requestChoice).toHaveBeenCalledTimes(2)
    expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Succeeded)
    expect(ctx.state.containerMode).toBe('new')
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
    expect(ctx.state.dockerImage).toBe('bat-server:latest')
  })

  it('"Create new" with every candidate name taken fails without storing the mode; retry asks again', async () => {
    const taken: ContainerEntry[] = [{ name: 'bat-server-dev-box', state: 'running' }]
    for (let suffix = 2; suffix <= 99; suffix += 1) taken.push({ name: `bat-server-dev-box-${suffix}`, state: 'exited' })
    installDocker(taken)
    const { requestChoice } = choiceQueue(['new', 'existing'])
    const ctx = dockerCtx(requestChoice)
    const runner = new WizardRunner([pickContainerStep], ctx)
    const run = runner.run()

    await waitForStatus(runner, 'pick-container', WizardStepStatus.Failed)
    expect(ctx.state.containerMode).toBe('unknown')
    expect(ctx.state.dockerContainer).toBeUndefined()
    expect(ctx.state.dockerImage).toBeUndefined()

    await runner.retryCurrentStep()
    await run

    expect(requestChoice).toHaveBeenCalledTimes(2)
    expect(ctx.state.containerMode).toBe('existing')
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
  })

  it('a valid stored mode is still reused without asking (no regression)', async () => {
    installDocker([{ name: 'user-box', state: 'running' }])
    const { requestChoice } = choiceQueue([])
    const ctx = dockerCtx(requestChoice)
    ctx.state.containerMode = 'existing'

    await pickContainerStep.run(ctx)

    expect(requestChoice).not.toHaveBeenCalled()
    expect(ctx.state.containerMode).toBe('existing')
    expect(ctx.state.dockerContainer).toBe('user-box')
  })
})

describe('pick-container: rollback ownership after a failed re-run (T0502)', () => {
  it('jump back -> "Use existing" with no containers fails; cancel still removes the container this run created', async () => {
    const docker = installDocker([])
    const { requestChoice } = choiceQueue(['new', 'existing'])
    const ctx = dockerCtx(requestChoice)
    const runner = new WizardRunner([pickContainerStep, creatingStartServer()], ctx)
    const run = runner.run()
    run.catch(() => undefined)

    await waitForStatus(runner, 'start-server', WizardStepStatus.Failed)
    expect(ctx.state.dockerContainerCreatedByWizard).toBe('bat-server-dev-box')

    await runner.jumpToStep(0)
    await waitForStatus(runner, 'pick-container', WizardStepStatus.Failed)
    // The failed "existing" pick left the earlier mode / container in place.
    expect(ctx.state.containerMode).toBe('new')
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
    expect(ctx.state.pickContainerEditRequested).toBe(true)

    await runner.cancel()
    await expect(run).rejects.toThrow()

    expect(docker.removeContainer).toHaveBeenCalledWith('bat-server-dev-box')
    expect(ctx.state.dockerContainerCreatedByWizard).toBeUndefined()
  })

  it('jump back -> failed "existing" pick -> retry asks again -> "Create new" keeps its own container name', async () => {
    installDocker([])
    const { requestChoice } = choiceQueue(['new', 'existing', 'new'])
    const ctx = dockerCtx(requestChoice)
    const runner = new WizardRunner([pickContainerStep, creatingStartServer()], ctx)
    const run = runner.run()

    await waitForStatus(runner, 'start-server', WizardStepStatus.Failed)
    await runner.jumpToStep(0)
    await waitForStatus(runner, 'pick-container', WizardStepStatus.Failed)
    await runner.retryCurrentStep()
    await run

    expect(requestChoice).toHaveBeenCalledTimes(3)
    expect(ctx.state.containerMode).toBe('new')
    // The name this run created is ours, so it is reused, not renamed.
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
    expect(ctx.warnings).toEqual([])
    expect(ctx.state.pickContainerEditRequested).toBeUndefined()
  })
})
