/**
 * T0444 (BUG-111): wizard rollback only undoes what this wizard run did.
 *
 * Matrix: each Docker step with a rollback × (created / started by this run,
 * or the user's own resource) × rollback, plus "flag missing" (older state or
 * ownership could not be determined) → rollback does nothing. Also covers
 * "Create new" never adopting an existing container name, and write-profile
 * deleting every profile it created across re-runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
} from '../wizard-runner'
import { pickContainerStep } from '../steps/docker/pick-container'
import { installDockerServerBundleStep } from '../steps/docker/install-server-bundle'
import { startDockerServerStep } from '../steps/docker/start-server'
import { DOCKER_OWNERSHIP_KEYS } from '../steps/docker/ownership'
import { writeProfileStep } from '../steps/wsl/write-profile'

const CREATED = DOCKER_OWNERSHIP_KEYS.containerCreated
const STARTED = DOCKER_OWNERSHIP_KEYS.containerStarted
const WAS_RUNNING = DOCKER_OWNERSHIP_KEYS.containerWasRunningBefore
const BUNDLE = DOCKER_OWNERSHIP_KEYS.bundleInstalled

interface FakeContainer {
  name: string
  running: boolean
}

interface DockerFakeOptions {
  containers?: FakeContainer[]
  startError?: string
  /** `docker run` creates the container, then fails (e.g. port already allocated). */
  startCreatesThenFails?: boolean
  health?: 'healthy' | 'unhealthy'
  inspectThrows?: boolean
}

function installDocker(options: DockerFakeOptions = {}) {
  const containers = new Map((options.containers ?? []).map((c) => [c.name, { ...c }]))
  const docker = {
    listContainers: vi.fn(async () =>
      Array.from(containers.values()).map((c) => ({
        id: `id-${c.name}`,
        name: c.name,
        image: 'img',
        state: c.running ? 'running' : 'exited',
        status: '',
      })),
    ),
    inspectContainer: vi.fn(async (name: string) => {
      if (options.inspectThrows) throw new Error('daemon hiccup')
      const c = containers.get(name)
      if (!c) throw new Error(`No such container: ${name}`)
      return { id: `id-${name}`, name, image: 'bat-server:latest', state: { status: c.running ? 'running' : 'exited', running: c.running, health: 'healthy' }, mounts: [], ports: [], env: [] }
    }),
    startContainer: vi.fn(async (name: string, opts?: { createIfMissing?: boolean }) => {
      if (opts?.createIfMissing) {
        if (containers.has(name)) {
          return { ok: false, error: `Conflict. The container name "/${name}" is already in use by container "abc".` }
        }
        if (options.startCreatesThenFails) {
          containers.set(name, { name, running: false })
          return { ok: false, token: 'tok-run', error: 'Bind for 127.0.0.1:19876 failed: port is already allocated' }
        }
        if (options.startError) return { ok: false, error: options.startError }
        containers.set(name, { name, running: true })
        return { ok: true, token: 'tok' }
      }
      if (options.startError) return { ok: false, error: options.startError }
      const c = containers.get(name)
      if (c) c.running = true
      return { ok: true, token: 'tok' }
    }),
    getContainerHealth: vi.fn(async () => ({ ok: true, health: options.health ?? 'healthy' })),
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

function makeCtx(state: Record<string, unknown> = {}, overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: 'Dev Box' },
    warnings: [],
    state,
    serverPort: 19876,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
  vi.restoreAllMocks()
})

// ── pick-container ───────────────────────────────────────────────────────────

describe('pick-container: "Create new" never adopts an existing name (T0444)', () => {
  it('keeps the default name when it is free; rollback without a creation flag removes nothing', async () => {
    const { docker } = installDocker()
    const ctx = makeCtx({ containerMode: 'new' })

    await pickContainerStep.run(ctx)
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
    expect(ctx.warnings).toEqual([])

    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('default name taken by a user container → picks the next free name and warns; never removes the user container', async () => {
    const { docker, containers } = installDocker({ containers: [{ name: 'bat-server-dev-box', running: true }] })
    const ctx = makeCtx({ containerMode: 'new' })

    await pickContainerStep.run(ctx)
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box-2')
    expect(ctx.warnings).toEqual([
      'Docker container bat-server-dev-box already exists and was left untouched; BAT will create bat-server-dev-box-2 instead.',
    ])

    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(containers.has('bat-server-dev-box')).toBe(true)
  })

  it('a carried-over name that belongs to the user (e.g. from "Use existing") is replaced, not reused', async () => {
    const { docker } = installDocker({ containers: [{ name: 'postgres', running: true }] })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'postgres' })

    await pickContainerStep.run(ctx)
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
    expect(ctx.warnings[0]).toContain('postgres already exists')

    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('a free carried-over name is kept', async () => {
    installDocker()
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'my-bat' })
    await pickContainerStep.run(ctx)
    expect(ctx.state.dockerContainer).toBe('my-bat')
  })

  it('a name this run created itself is kept on re-run, and rollback removes it once', async () => {
    const { docker, containers } = installDocker({ containers: [{ name: 'bat-server-dev-box', running: true }] })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-server-dev-box', [CREATED]: 'bat-server-dev-box' })

    await pickContainerStep.run(ctx)
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
    expect(ctx.warnings).toEqual([])

    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).toHaveBeenCalledWith('bat-server-dev-box')
    expect(containers.has('bat-server-dev-box')).toBe(false)
    expect(ctx.state[CREATED]).toBeUndefined()

    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).toHaveBeenCalledTimes(1)
  })

  it('a creation flag for a different container does not authorise removing this one', async () => {
    const { docker } = installDocker({ containers: [{ name: 'other', running: true }] })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-server-dev-box', [CREATED]: 'other' })
    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('"Use existing" rollback never removes the container', async () => {
    const { docker } = installDocker({ containers: [{ name: 'mine', running: true }] })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine', [CREATED]: 'mine' })
    await pickContainerStep.run(ctx)
    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('fails when every candidate name is taken', async () => {
    const taken = [{ name: 'bat-server-dev-box', running: false }]
    for (let i = 2; i <= 99; i += 1) taken.push({ name: `bat-server-dev-box-${i}`, running: false })
    installDocker({ containers: taken })
    await expect(pickContainerStep.run(makeCtx({ containerMode: 'new' }))).rejects.toThrow(/already exist/)
  })
})

// ── start-server: new mode ───────────────────────────────────────────────────

describe('start-server "Create new": removes only the container this run created (T0444)', () => {
  it('created by this run → rollback removes it and clears the flag', async () => {
    const { docker, containers } = installDocker({ health: 'unhealthy' })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/unhealthy/)
    expect(ctx.state[CREATED]).toBe('bat-new')

    await startDockerServerStep.rollback!(ctx)
    expect(docker.removeContainer).toHaveBeenCalledWith('bat-new')
    expect(containers.has('bat-new')).toBe(false)
    expect(ctx.state[CREATED]).toBeUndefined()

    // pick-container's safety net runs next in a cancel: no-op now.
    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).toHaveBeenCalledTimes(1)
  })

  it('`docker run` created the container then failed (port in use) → still removed', async () => {
    const { docker, containers } = installDocker({ startCreatesThenFails: true })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/port is already allocated/)
    await startDockerServerStep.rollback!(ctx)
    expect(docker.removeContainer).toHaveBeenCalledWith('bat-new')
    expect(containers.has('bat-new')).toBe(false)
  })

  it('name already exists and is not ours → fails before `docker run`; rollback leaves it alone', async () => {
    const { docker, containers } = installDocker({ containers: [{ name: 'bat-new', running: true }] })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/already exists and was not created by this setup run/)
    expect(docker.startContainer).not.toHaveBeenCalled()
    expect(ctx.state[CREATED]).toBeUndefined()

    await startDockerServerStep.rollback!(ctx)
    await pickContainerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(containers.get('bat-new')?.running).toBe(true)
  })

  it('lost a race for the name (`is already in use`) → claim dropped, nothing removed', async () => {
    const { docker } = installDocker()
    // The name appears between the pre-check and `docker run`.
    docker.startContainer.mockResolvedValueOnce({ ok: false, error: 'Conflict. The container name "/bat-new" is already in use by container "zzz".' })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/already in use/)
    expect(ctx.state[CREATED]).toBeUndefined()

    await startDockerServerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('retry after this run already created it `docker start`s that container and keeps ownership (T0452)', async () => {
    const { docker } = installDocker({ containers: [{ name: 'bat-new', running: false }] })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new', [CREATED]: 'bat-new', remoteToken: 'tok-first' })

    await startDockerServerStep.run(ctx)
    expect(docker.startContainer).toHaveBeenCalledTimes(1)
    expect(docker.startContainer.mock.calls[0][1]).not.toHaveProperty('createIfMissing')
    expect(ctx.state[CREATED]).toBe('bat-new')
    // Our container serves the `--token` it was created with.
    expect(ctx.remoteToken).toBe('tok-first')

    await startDockerServerStep.rollback!(ctx)
    expect(docker.removeContainer).toHaveBeenCalledWith('bat-new')
  })

  it('flag missing (older state) → rollback removes nothing and warns', async () => {
    const { docker } = installDocker({ containers: [{ name: 'bat-new', running: true }] })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })

    await startDockerServerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(ctx.logger.warn).toHaveBeenCalledWith('Not removing Docker container bat-new: it was not created by this setup run.')
  })

  it('container already gone → claim released, no error', async () => {
    const { docker } = installDocker()
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new', [CREATED]: 'bat-new' })
    await startDockerServerStep.rollback!(ctx)
    expect(docker.removeContainer).toHaveBeenCalledTimes(1)
    expect(ctx.state[CREATED]).toBeUndefined()
    expect(ctx.logger.warn).not.toHaveBeenCalled()
  })
})

describe('start-server "Create new" retry reuses only the container this run created (T0452)', () => {
  it('`docker run` created the container then failed → retry `docker start`s it with the same token and succeeds', async () => {
    const { docker, containers } = installDocker({ startCreatesThenFails: true })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/port is already allocated/)
    expect(ctx.state[CREATED]).toBe('bat-new')
    expect(ctx.state.remoteToken).toBe('tok-run')

    await startDockerServerStep.run(ctx)
    expect(docker.startContainer).toHaveBeenCalledTimes(2)
    expect(docker.startContainer.mock.calls[0][1]).toMatchObject({ createIfMissing: true })
    expect(docker.startContainer.mock.calls[1][1]).toEqual({ port: 19876 })
    expect(containers.get('bat-new')?.running).toBe(true)
    expect(ctx.remoteToken).toBe('tok-run')
    expect(ctx.state[CREATED]).toBe('bat-new')
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('created by this run but gone before the retry (e.g. `docker run` never created it) → `docker run` again', async () => {
    const { docker, containers } = installDocker()
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new', [CREATED]: 'bat-new' })

    await startDockerServerStep.run(ctx)
    expect(docker.startContainer).toHaveBeenCalledTimes(1)
    expect(docker.startContainer.mock.calls[0][1]).toMatchObject({ createIfMissing: true })
    expect(containers.get('bat-new')?.running).toBe(true)
    expect(ctx.state[CREATED]).toBe('bat-new')
  })

  it('gone before the retry, then the name is taken by someone else → claim dropped, nothing removed', async () => {
    const { docker } = installDocker()
    docker.startContainer.mockResolvedValueOnce({ ok: false, error: 'Conflict. The container name "/bat-new" is already in use by container "zzz".' })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new', [CREATED]: 'bat-new' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/already in use/)
    expect(ctx.state[CREATED]).toBeUndefined()

    await startDockerServerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('same-name container not created by this run → every retry still refuses it; never started or removed', async () => {
    const { docker, containers } = installDocker({ containers: [{ name: 'bat-new', running: false }] })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/already exists and was not created by this setup run/)
    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/already exists and was not created by this setup run/)
    expect(docker.startContainer).not.toHaveBeenCalled()
    expect(ctx.state[CREATED]).toBeUndefined()

    await startDockerServerStep.rollback!(ctx)
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(containers.get('bat-new')?.running).toBe(false)
  })

  it('a creation flag for a different container does not make a same-name container ours', async () => {
    const { docker } = installDocker({ containers: [{ name: 'bat-new', running: false }] })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new', [CREATED]: 'bat-other' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/already exists and was not created by this setup run/)
    expect(docker.startContainer).not.toHaveBeenCalled()
  })
})

// ── start-server: existing mode ──────────────────────────────────────────────

describe('start-server "Use existing": stops only a container this run started (T0444)', () => {
  it('was stopped before → started by this run → rollback stops it', async () => {
    const { docker, containers } = installDocker({ containers: [{ name: 'mine', running: false }], health: 'unhealthy' })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/unhealthy/)
    expect(ctx.state[WAS_RUNNING]).toBe(false)
    expect(ctx.state[STARTED]).toBe('mine')

    await startDockerServerStep.rollback!(ctx)
    expect(docker.stopContainer).toHaveBeenCalledWith('mine')
    expect(containers.get('mine')?.running).toBe(false)
    expect(ctx.state[STARTED]).toBeUndefined()
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('was already running → rollback leaves it running', async () => {
    const { docker, containers } = installDocker({ containers: [{ name: 'mine', running: true }], health: 'unhealthy' })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/unhealthy/)
    expect(ctx.state[WAS_RUNNING]).toBe(true)
    expect(ctx.state[STARTED]).toBeUndefined()

    await startDockerServerStep.rollback!(ctx)
    expect(docker.stopContainer).not.toHaveBeenCalled()
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(containers.get('mine')?.running).toBe(true)
    expect(ctx.logger.info).toHaveBeenCalledWith('Leaving Docker container mine running: it was running before setup.')
  })

  it('prior state unknown (inspect failed) → rollback does not stop and warns', async () => {
    const { docker } = installDocker({ containers: [{ name: 'mine', running: false }], inspectThrows: true })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' })

    await startDockerServerStep.run(ctx)
    expect(ctx.state[STARTED]).toBeUndefined()
    expect(ctx.state[WAS_RUNNING]).toBeUndefined()

    await startDockerServerStep.rollback!(ctx)
    expect(docker.stopContainer).not.toHaveBeenCalled()
    expect(ctx.logger.warn).toHaveBeenCalledWith('Not stopping Docker container mine: this setup run did not start it.')
  })

  it('flag missing (older state) → rollback does not stop', async () => {
    const { docker } = installDocker({ containers: [{ name: 'mine', running: true }] })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' })
    await startDockerServerStep.rollback!(ctx)
    expect(docker.stopContainer).not.toHaveBeenCalled()
  })

  it('retry keeps ownership: the container is running now only because the first attempt started it', async () => {
    const { docker } = installDocker({ containers: [{ name: 'mine', running: false }], health: 'unhealthy' })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/unhealthy/)
    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/unhealthy/)
    expect(ctx.state[STARTED]).toBe('mine')

    await startDockerServerStep.rollback!(ctx)
    expect(docker.stopContainer).toHaveBeenCalledWith('mine')
  })

  it('a start flag for a different container does not authorise stopping this one', async () => {
    const { docker } = installDocker({ containers: [{ name: 'mine', running: true }] })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine', [STARTED]: 'other' })
    await startDockerServerStep.rollback!(ctx)
    expect(docker.stopContainer).not.toHaveBeenCalled()
  })
})

// ── install-server-bundle ────────────────────────────────────────────────────

describe('install-server-bundle: never deletes a bundle it did not install (T0444)', () => {
  it('"Use existing": bundle comes from the image → rollback does not rm -rf inside the user container', async () => {
    const { docker } = installDocker({ containers: [{ name: 'mine', running: true }] })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' })

    await installDockerServerBundleStep.run(ctx)
    expect(ctx.state[BUNDLE]).toBe(false)
    expect(ctx.serverInstallPath).toBe('/opt/bat-server')

    await installDockerServerBundleStep.rollback!(ctx)
    expect(docker.execCommand).not.toHaveBeenCalled()
  })

  it('"Create new": rollback does nothing (the container itself is removed elsewhere)', async () => {
    const { docker } = installDocker()
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })
    await installDockerServerBundleStep.run(ctx)
    await installDockerServerBundleStep.rollback!(ctx)
    expect(docker.execCommand).not.toHaveBeenCalled()
  })

  it('flag missing (older state) → no rm -rf, warns', async () => {
    const { docker } = installDocker()
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' }, { serverInstallPath: '/opt/bat-server' })
    await installDockerServerBundleStep.rollback!(ctx)
    expect(docker.execCommand).not.toHaveBeenCalled()
    expect(ctx.logger.warn).toHaveBeenCalledWith('Not removing the BAT install path: this setup run did not record installing it.')
  })

  it('only an explicit "installed by this run" flag allows removing the install path', async () => {
    const { docker } = installDocker()
    const ctx = makeCtx(
      { containerMode: 'existing', dockerContainer: 'mine', [BUNDLE]: true },
      { serverInstallPath: '/opt/bat-server' },
    )
    await installDockerServerBundleStep.rollback!(ctx)
    expect(docker.execCommand).toHaveBeenCalledWith('mine', ['rm', '-rf', '/opt/bat-server'])
    expect(ctx.state[BUNDLE]).toBe(false)
    expect(ctx.serverInstallPath).toBeUndefined()
  })
})

// ── whole Docker flow, cancel from a failure ─────────────────────────────────

describe('Docker flow cancel touches only what this run did (T0444 / BUG-111)', () => {
  async function cancelAtFailure(runner: WizardRunner, stepId: string): Promise<void> {
    const run = runner.run().then(() => null, (err: unknown) => err)
    await vi.waitFor(() => {
      const snap = runner.getSnapshots().find((s) => s.id === stepId)
      if (snap?.status !== WizardStepStatus.Failed) throw new Error('not failed yet')
    })
    await runner.cancel()
    await run
  }

  it('"Use existing" on a running user container: no stop, no rm, no rm -rf', async () => {
    const { docker, containers } = installDocker({ containers: [{ name: 'mine', running: true }], health: 'unhealthy' })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' })
    const runner = new WizardRunner([pickContainerStep, installDockerServerBundleStep, startDockerServerStep], ctx)

    await cancelAtFailure(runner, 'start-server')

    expect(docker.stopContainer).not.toHaveBeenCalled()
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(docker.execCommand).not.toHaveBeenCalled()
    expect(containers.get('mine')?.running).toBe(true)
  })

  it('"Create new" with the default name already taken: the user container survives, ours is removed', async () => {
    const { docker, containers } = installDocker({ containers: [{ name: 'bat-server-dev-box', running: true }], health: 'unhealthy' })
    const ctx = makeCtx({ containerMode: 'new' })
    const runner = new WizardRunner([pickContainerStep, installDockerServerBundleStep, startDockerServerStep], ctx)

    await cancelAtFailure(runner, 'start-server')

    expect(docker.removeContainer.mock.calls.map(([name]) => name)).toEqual(['bat-server-dev-box-2'])
    expect(containers.has('bat-server-dev-box')).toBe(true)
    expect(containers.has('bat-server-dev-box-2')).toBe(false)
    expect(docker.execCommand).not.toHaveBeenCalled()
  })
})

// ── write-profile ────────────────────────────────────────────────────────────

describe('write-profile rollback deletes every profile this run created (T0444)', () => {
  let created: string[]
  let deleted: string[]
  let profile: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    created = []
    deleted = []
    let n = 0
    profile = {
      create: vi.fn(async () => {
        n += 1
        const id = `docker-${n}`
        created.push(id)
        return { id }
      }),
      update: vi.fn(async () => false),
      delete: vi.fn(async (id: string) => {
        deleted.push(id)
        return true
      }),
    }
    ;(globalThis as unknown as { window: unknown }).window = { electronAPI: { profile } }
  })

  function profileCtx(): WizardContext {
    return makeCtx({ dockerContainer: 'bat-new' }, { remoteToken: 'tok' })
  }

  it('create ok + update failed, re-run, fails again → both profiles are deleted', async () => {
    const ctx = profileCtx()
    await expect(writeProfileStep.run(ctx)).rejects.toThrow(/Failed to persist Docker profile metadata/)
    await expect(writeProfileStep.run(ctx)).rejects.toThrow(/Failed to persist Docker profile metadata/)
    expect(ctx.createdProfileIds).toEqual(['docker-1', 'docker-2'])
    expect(ctx.createdProfileId).toBe('docker-2')

    await writeProfileStep.rollback!(ctx)
    expect(deleted).toEqual(['docker-1', 'docker-2'])
    expect(ctx.createdProfileIds).toBeUndefined()
    expect(ctx.createdProfileId).toBeUndefined()

    await writeProfileStep.rollback!(ctx)
    expect(profile.delete).toHaveBeenCalledTimes(2)
  })

  it('re-run that succeeds keeps the latest id as createdProfileId; rollback still removes the orphan too', async () => {
    const ctx = profileCtx()
    await expect(writeProfileStep.run(ctx)).rejects.toThrow()
    profile.update.mockResolvedValueOnce(true)
    await writeProfileStep.run(ctx)
    expect(ctx.createdProfileId).toBe('docker-2')

    await writeProfileStep.rollback!(ctx)
    expect(deleted).toEqual(['docker-1', 'docker-2'])
  })

  it('fails once, retry succeeds → the orphan is deleted at once and only the written profile remains (T0452)', async () => {
    const ctx = profileCtx()
    await expect(writeProfileStep.run(ctx)).rejects.toThrow()
    profile.update.mockResolvedValueOnce(true)
    await writeProfileStep.run(ctx)

    expect(created).toEqual(['docker-1', 'docker-2'])
    expect(deleted).toEqual(['docker-1'])
    expect(ctx.createdProfileId).toBe('docker-2')
    expect(ctx.createdProfileIds).toEqual(['docker-2'])
  })

  it('first-try success deletes nothing (T0452)', async () => {
    const ctx = profileCtx()
    profile.update.mockResolvedValueOnce(true)
    await writeProfileStep.run(ctx)

    expect(profile.delete).not.toHaveBeenCalled()
    expect(ctx.createdProfileIds).toEqual(['docker-1'])
  })

  it('success-path cleanup that throws keeps the orphan recorded for rollback and warns (T0452)', async () => {
    const ctx = profileCtx()
    await expect(writeProfileStep.run(ctx)).rejects.toThrow()
    profile.update.mockResolvedValueOnce(true)
    profile.delete.mockImplementationOnce(async () => { throw new Error('disk full') })
    await writeProfileStep.run(ctx)

    expect(ctx.createdProfileIds).toEqual(['docker-1', 'docker-2'])
    expect(ctx.createdProfileId).toBe('docker-2')
    expect(ctx.logger.warn).toHaveBeenCalledWith('Failed to delete superseded remote profile docker-1: disk full')

    await writeProfileStep.rollback!(ctx)
    expect(deleted).toEqual(['docker-1', 'docker-2'])
  })

  it('a delete that throws keeps that id for a later rollback and warns', async () => {
    const ctx = profileCtx()
    await expect(writeProfileStep.run(ctx)).rejects.toThrow()
    await expect(writeProfileStep.run(ctx)).rejects.toThrow()
    profile.delete.mockImplementationOnce(async () => { throw new Error('disk full') })

    await writeProfileStep.rollback!(ctx)
    expect(ctx.createdProfileIds).toEqual(['docker-1'])
    expect(ctx.createdProfileId).toBe('docker-1')
    expect(ctx.logger.warn).toHaveBeenCalledWith('Failed to delete remote profile docker-1: disk full')

    await writeProfileStep.rollback!(ctx)
    expect(deleted).toEqual(['docker-2', 'docker-1'])
    expect(ctx.createdProfileIds).toBeUndefined()
  })

  it('older ctx with only createdProfileId still deletes it', async () => {
    const ctx = profileCtx()
    ctx.createdProfileId = 'legacy'
    await writeProfileStep.rollback!(ctx)
    expect(deleted).toEqual(['legacy'])
    expect(ctx.createdProfileId).toBeUndefined()
  })

  it('nothing created → rollback does nothing', async () => {
    await writeProfileStep.rollback!(profileCtx())
    expect(profile.delete).not.toHaveBeenCalled()
  })
})
