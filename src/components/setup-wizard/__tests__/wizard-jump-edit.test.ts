/**
 * T0500: jumping back ("Edit settings") to an editable step makes it ask for
 * its input again. Before T0500 the step re-ran with the value it had stored
 * (containerMode, dockerMounts, sshHost) and skipped the prompt, so the user
 * could not actually change anything. The runner calls the target's
 * resetForEdit after the T0489 rollback chain; retry / skip never do.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
  type WizardStep,
} from '../wizard-runner'
import { buildDockerWizardSteps } from '../docker-flow'
import { buildSshWizardSteps } from '../ssh-flow'
import { buildWslWizardSteps } from '../wsl-flow'
import { pickContainerStep } from '../steps/docker/pick-container'
import { configureMountsStep } from '../steps/docker/configure-mounts'
import { configureSshHostStep } from '../steps/ssh/configure-host'
import { pickWslDistroStep } from '../steps/wsl/pick-wsl-distro'

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

/** Downstream step that fails its first `failures` runs (the failure screen the user jumps back from). */
function failingStep(id: string, failures = 1, log?: string[]): WizardStep {
  let remaining = failures
  return {
    id,
    title: id,
    appliesTo: 'all',
    async run() {
      log?.push(`run:${id}`)
      if (remaining > 0) {
        remaining -= 1
        throw new Error(`${id} broke`)
      }
    },
    async rollback() {
      log?.push(`rollback:${id}`)
    },
  }
}

/** requestChoice that answers from a queue and records every request. */
function choiceQueue(answers: Array<string | null>) {
  const requests: WizardChoiceRequest[] = []
  const requestChoice = vi.fn(async (request: WizardChoiceRequest) => {
    requests.push(request)
    return answers.length > 0 ? answers.shift()! : null
  })
  return { requestChoice, requests }
}

function installWindow(electronAPI: Record<string, unknown>): void {
  ;(globalThis as unknown as { window: unknown }).window = { electronAPI }
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
  vi.restoreAllMocks()
})

describe('WizardRunner calls resetForEdit on the jump target (T0500)', () => {
  function editableStep(id: string, log: string[], options: { throwOnReset?: boolean } = {}): WizardStep {
    return {
      id,
      title: id,
      appliesTo: 'all',
      editableFromFailure: true,
      async run() {
        log.push(`run:${id}`)
      },
      async rollback() {
        log.push(`rollback:${id}`)
      },
      resetForEdit() {
        log.push(`reset:${id}`)
        if (options.throwOnReset) throw new Error('reset broke')
      },
    }
  }

  it('resets only the target, after the rollback chain and before it re-runs', async () => {
    const log: string[] = []
    const runner = new WizardRunner(
      [editableStep('host', log), editableStep('mounts', log), failingStep('verify', 1, log)],
      makeCtx(),
    )
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(log).toEqual([
      'run:host', 'run:mounts', 'run:verify',
      // T0489 chain: failed step, then completed steps after the target (mounts
      // is rolled back, not reset), then T0500 reset of the target.
      'rollback:verify', 'rollback:mounts', 'reset:host',
      'run:host', 'run:mounts', 'run:verify',
    ])
  })

  it('resets the target when the jump targets the failed step itself', async () => {
    const log: string[] = []
    let fail = true
    const step: WizardStep = {
      ...editableStep('host', log),
      async run() {
        log.push('run:host')
        if (fail) {
          fail = false
          throw new Error('host empty')
        }
      },
    }
    const runner = new WizardRunner([step], makeCtx())
    const run = runner.run()
    await waitForStatus(runner, 'host', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(log).toEqual(['run:host', 'reset:host', 'run:host'])
  })

  it('retry and skip never call resetForEdit', async () => {
    const log: string[] = []
    const runner = new WizardRunner(
      [editableStep('host', log), failingStep('verify', 1, log), failingStep('optional', 1, log)],
      makeCtx(),
    )
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)
    await runner.retryCurrentStep()
    await waitForStatus(runner, 'optional', WizardStepStatus.Failed)
    await runner.skipCurrentStep()
    await run

    expect(log.filter((entry) => entry.startsWith('reset:'))).toEqual([])
  })

  it('a resetForEdit that throws is logged and does not block the jump', async () => {
    const log: string[] = []
    const ctx = makeCtx()
    const runner = new WizardRunner([editableStep('host', log, { throwOnReset: true }), failingStep('verify', 1, log)], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'verify', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(ctx.logger.warn).toHaveBeenCalledWith('resetForEdit failed for host: reset broke')
    expect(log.slice(-2)).toEqual(['run:host', 'run:verify'])
    expect(runner.getSnapshots().every((s) => s.status === WizardStepStatus.Succeeded)).toBe(true)
  })
})

describe('Docker pick-container asks for the mode again after a jump back (T0500)', () => {
  function installDocker(containers: Array<{ name: string; state: 'running' | 'exited' | 'created' }>) {
    const docker = {
      listContainers: vi.fn().mockResolvedValue(containers),
      removeContainer: vi.fn().mockResolvedValue({ ok: true }),
    }
    installWindow({ docker })
    return docker
  }

  function dockerCtx(requestChoice: WizardContext['requestChoice']): WizardContext {
    return makeCtx({ targetOS: 'docker-linux', state: { containerMode: 'unknown' }, requestChoice })
  }

  it('jump back re-asks; switching new -> existing uses an existing container, not the new name', async () => {
    installDocker([{ name: 'user-box', state: 'running' }])
    const { requestChoice } = choiceQueue(['new', 'existing'])
    const ctx = dockerCtx(requestChoice)
    const runner = new WizardRunner([pickContainerStep, failingStep('start-server')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'start-server', WizardStepStatus.Failed)
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')

    await runner.jumpToStep(0)
    await run

    expect(requestChoice).toHaveBeenCalledTimes(2)
    expect(ctx.state.containerMode).toBe('existing')
    expect(ctx.state.dockerContainer).toBe('user-box')
    expect(ctx.state.pickContainerEditRequested).toBeUndefined()
  })

  it('switching existing -> new does not adopt the user container name (no "left untouched" warning)', async () => {
    installDocker([{ name: 'user-box', state: 'running' }])
    const { requestChoice } = choiceQueue(['existing', 'new'])
    const ctx = dockerCtx(requestChoice)
    const runner = new WizardRunner([pickContainerStep, failingStep('start-server')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'start-server', WizardStepStatus.Failed)
    expect(ctx.state.dockerContainer).toBe('user-box')

    await runner.jumpToStep(0)
    await run

    expect(ctx.state.containerMode).toBe('new')
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
    expect(ctx.warnings).toEqual([])
  })

  it('retry of a later step does not re-ask', async () => {
    installDocker([])
    const { requestChoice } = choiceQueue(['new'])
    const ctx = dockerCtx(requestChoice)
    const runner = new WizardRunner([pickContainerStep, failingStep('start-server')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'start-server', WizardStepStatus.Failed)

    await runner.retryCurrentStep()
    await run

    expect(requestChoice).toHaveBeenCalledTimes(1)
  })

  it('keeps asking on retry until the re-run succeeds', async () => {
    installDocker([])
    // jump back -> "Use existing" with no containers fails -> retry asks again.
    const { requestChoice } = choiceQueue(['new', 'existing', 'new'])
    const ctx = dockerCtx(requestChoice)
    const runner = new WizardRunner([pickContainerStep, failingStep('start-server')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'start-server', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await waitForStatus(runner, 'pick-container', WizardStepStatus.Failed)
    await runner.retryCurrentStep()
    await run

    expect(requestChoice).toHaveBeenCalledTimes(3)
    expect(ctx.state.containerMode).toBe('new')
    expect(ctx.state.pickContainerEditRequested).toBeUndefined()
  })

  it('resetForEdit keeps the stored mode and container so its rollback still finds a container this run created', async () => {
    const docker = installDocker([])
    const ctx = dockerCtx(undefined)
    ctx.state.containerMode = 'new'
    ctx.state.dockerContainer = 'bat-server-dev-box'
    ctx.state.dockerContainerCreatedByWizard = 'bat-server-dev-box'

    await pickContainerStep.resetForEdit!(ctx)
    await pickContainerStep.rollback!(ctx)

    expect(ctx.state.containerMode).toBe('new')
    expect(docker.removeContainer).toHaveBeenCalledWith('bat-server-dev-box')
  })

  it('without requestChoice the stored mode is kept after a jump back', async () => {
    installDocker([{ name: 'user-box', state: 'running' }])
    const ctx = dockerCtx(undefined)
    ctx.state.containerMode = 'new'
    ctx.state.pickContainerEditRequested = true

    await pickContainerStep.run(ctx)

    expect(ctx.state.containerMode).toBe('new')
  })
})

describe('Docker configure-mounts opens the folder picker again after a jump back (T0500)', () => {
  function installMounts(selections: Array<string[] | null>) {
    const dialog = { selectFolder: vi.fn(async () => (selections.length > 0 ? selections.shift()! : null)) }
    const docker = { validateMounts: vi.fn().mockResolvedValue({ ok: true, errors: [] }) }
    installWindow({ dialog, docker })
    return { dialog, docker }
  }

  it('jump back re-opens the picker and replaces the mounts', async () => {
    const { dialog } = installMounts([['C:\\work\\alpha'], ['C:\\work\\beta']])
    const ctx = makeCtx({ targetOS: 'docker-linux', state: { dockerMounts: [] } })
    const runner = new WizardRunner([configureMountsStep, failingStep('install-server-bundle')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'install-server-bundle', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(dialog.selectFolder).toHaveBeenCalledTimes(2)
    const mounts = [{ host: 'C:\\work\\beta', container: '/workspace/beta' }]
    expect(ctx.state.dockerMounts).toEqual(mounts)
    expect(ctx.profileDraft.dockerMounts).toEqual(mounts)
    expect(ctx.state.dockerMountsEditRequested).toBeUndefined()
  })

  it('closing the picker after a jump back keeps the previous mounts', async () => {
    const { dialog } = installMounts([['C:\\work\\alpha'], null])
    const ctx = makeCtx({ targetOS: 'docker-linux', state: { dockerMounts: [] } })
    const runner = new WizardRunner([configureMountsStep, failingStep('install-server-bundle')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'install-server-bundle', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(dialog.selectFolder).toHaveBeenCalledTimes(2)
    expect(ctx.state.dockerMounts).toEqual([{ host: 'C:\\work\\alpha', container: '/workspace/alpha' }])
    expect(runner.getSnapshots().every((s) => s.status === WizardStepStatus.Succeeded)).toBe(true)
  })

  it('retry of a later step does not re-open the picker', async () => {
    const { dialog } = installMounts([['C:\\work\\alpha']])
    const ctx = makeCtx({ targetOS: 'docker-linux', state: { dockerMounts: [] } })
    const runner = new WizardRunner([configureMountsStep, failingStep('install-server-bundle')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'install-server-bundle', WizardStepStatus.Failed)

    await runner.retryCurrentStep()
    await run

    expect(dialog.selectFolder).toHaveBeenCalledTimes(1)
  })
})

describe('SSH configure-ssh-host offers the alias picker again after a jump back (T0500)', () => {
  function installSsh(hostLists: string[][]) {
    const ssh = { listHosts: vi.fn(async () => (hostLists.length > 1 ? hostLists.shift()! : hostLists[0])) }
    installWindow({ ssh })
    return ssh
  }

  function sshCtx(requestChoice: WizardContext['requestChoice']): WizardContext {
    return makeCtx({ targetOS: 'ssh-linux', state: { sshTunnelMode: 'tunnel' }, requestChoice })
  }

  it('jump back re-reads ~/.ssh/config and stores the newly picked alias', async () => {
    const ssh = installSsh([['old-box'], ['old-box', 'new-box']])
    const { requestChoice, requests } = choiceQueue(['old-box', 'new-box'])
    const ctx = sshCtx(requestChoice)
    const runner = new WizardRunner([configureSshHostStep, failingStep('verify-ssh-auth')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'verify-ssh-auth', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(ssh.listHosts).toHaveBeenCalledTimes(2)
    expect(requests[1].options.map((o) => o.value)).toEqual(['old-box', 'new-box'])
    expect(ctx.state.sshHost).toBe('new-box')
    expect(ctx.state.sshAlias).toBe('new-box')
    expect(ctx.profileDraft.sshHost).toBe('new-box')
    expect(ctx.state.sshHostEditRequested).toBeUndefined()
  })

  it('with no aliases left to pick from, the stored host is kept instead of failing', async () => {
    installSsh([['old-box'], []])
    const { requestChoice } = choiceQueue(['old-box'])
    const ctx = sshCtx(requestChoice)
    const runner = new WizardRunner([configureSshHostStep, failingStep('verify-ssh-auth')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'verify-ssh-auth', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(requestChoice).toHaveBeenCalledTimes(1)
    expect(ctx.state.sshHost).toBe('old-box')
    expect(ctx.logger.info).toHaveBeenCalledWith('No ~/.ssh/config aliases to choose from; keeping SSH host old-box.')
  })

  it('retry of a later step does not re-ask', async () => {
    const ssh = installSsh([['old-box']])
    const { requestChoice } = choiceQueue(['old-box'])
    const ctx = sshCtx(requestChoice)
    const runner = new WizardRunner([configureSshHostStep, failingStep('verify-ssh-auth')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'verify-ssh-auth', WizardStepStatus.Failed)

    await runner.retryCurrentStep()
    await run

    expect(requestChoice).toHaveBeenCalledTimes(1)
    expect(ssh.listHosts).toHaveBeenCalledTimes(1)
  })
})

describe('WSL pick-wsl-distro already asks again after a jump back (T0500)', () => {
  it('re-lists distros and re-asks without a resetForEdit hook', async () => {
    const wsl = {
      list: vi.fn().mockResolvedValue({
        distros: [
          { name: 'Ubuntu', version: 2, state: 'Running' },
          { name: 'Debian', version: 2, state: 'Stopped' },
        ],
        default: 'Ubuntu',
      }),
    }
    installWindow({ wsl })
    const { requestChoice } = choiceQueue(['Ubuntu', 'Debian'])
    const ctx = makeCtx({ requestChoice })
    const runner = new WizardRunner([pickWslDistroStep, failingStep('install-server-bundle')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'install-server-bundle', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(requestChoice).toHaveBeenCalledTimes(2)
    expect(ctx.wslDistro).toBe('Debian')
  })
})

describe('every editable step can be edited after a jump back (T0500 inventory)', () => {
  // Steps that re-ask on every run and so need no resetForEdit hook.
  const ASKS_ON_EVERY_RUN = new Set(['pick-wsl-distro'])

  it('editableFromFailure steps define resetForEdit unless they always ask', () => {
    const steps = [...buildWslWizardSteps(), ...buildDockerWizardSteps(), ...buildSshWizardSteps()]
    const editable = [...new Set(steps.filter((s) => s.editableFromFailure))]
    expect(editable.map((s) => s.id).sort()).toEqual(
      ['configure-mounts', 'configure-ssh-host', 'pick-container', 'pick-wsl-distro'],
    )
    for (const step of editable) {
      expect(typeof step.resetForEdit === 'function' || ASKS_ON_EVERY_RUN.has(step.id), step.id).toBe(true)
    }
  })
})
