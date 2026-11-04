/**
 * T0851 (PLAN-052 W2): "Use existing" lists the containers (usable / created
 * by BAT / running first, unusable ones disabled with the reason), replaces
 * the docker-no-containers error with a prompt that offers "Create new
 * instead", and takes the container's own bind mounts instead of opening the
 * folder picker. Nothing here creates, starts or removes a container.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../../../i18n'
import type { WizardChoiceRequest, WizardContext } from '../../../wizard-runner'
import {
  DOCKER_CREATE_NEW_CHOICE,
  buildDockerContainerChoices,
  dockerContainerUnusableReason,
  pickContainerStep,
  type DockerContainerEntry,
} from '../pick-container'
import {
  DOCKER_MOUNTS_PICK_FOLDER,
  DOCKER_MOUNTS_USE_CONTAINER,
  bindMountsFromInspect,
  configureMountsStep,
  dockerBindSourceToHostPath,
} from '../configure-mounts'

function entry(name: string, extra: Partial<DockerContainerEntry> = {}): DockerContainerEntry {
  return { id: `${name}-id`, name, image: 'img', state: 'running', status: 'Up', ...extra }
}

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: 'Dev Box' },
    warnings: [],
    state: { containerMode: 'unknown', dockerMounts: [] },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
}

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

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('buildDockerContainerChoices (T0851)', () => {
  it('orders usable, created by BAT, running first; ties keep docker ps order', () => {
    const choices = buildDockerContainerChoices([
      entry('stopped-user', { state: 'exited', publishedPort: 20001 }),
      entry('unpublished', { publishedPort: null }),
      entry('running-user', { publishedPort: 20002 }),
      entry('bat-stopped', { state: 'exited', batCreated: true, publishedPort: 20003 }),
      entry('unknown-port'),
      entry('bat-running', { batCreated: true, publishedPort: 20004 }),
      entry('clashes', { batCreated: true, publishedPort: 9876 }),
    ], 9876)

    expect(choices.map((choice) => choice.value)).toEqual([
      'bat-running',
      'bat-stopped',
      'running-user',
      'unknown-port',
      'stopped-user',
      'clashes',
      'unpublished',
    ])
    expect(choices.filter((choice) => choice.disabled).map((choice) => choice.value)).toEqual(['clashes', 'unpublished'])
  })

  it('describes image · state · published port · created by BAT', () => {
    // Sorted: usable first, so the unpublished one is last.
    const [bat, unknown, unpublished] = buildDockerContainerChoices([
      entry('bat', { image: 'bat-server:latest', batCreated: true, publishedPort: 19877 }),
      entry('plain', { image: 'alpine', state: 'exited', publishedPort: null }),
      entry('legacy', { image: 'debian', state: 'paused' }),
    ], null)

    expect(bat).toMatchObject({ label: 'bat', value: 'bat', description: 'bat-server:latest · running · 127.0.0.1:19877 → 9876 · created by BAT' })
    expect(bat.disabled).toBeUndefined()
    expect(unpublished).toMatchObject({
      label: 'plain',
      description: 'alpine · stopped · 9876 not published',
      disabled: true,
      disabledReasonKey: 'wizard.docker.pickContainer.container.disabled.unpublished',
    })
    // Unknown port (inspect failed): no port part, left to start-server as before.
    expect(unknown).toMatchObject({ label: 'legacy', description: 'debian · paused' })
    expect(unknown.disabled).toBeUndefined()
  })

  it('unusable = not published, or published on the RemoteServer port (same two errors as start-server)', () => {
    expect(dockerContainerUnusableReason({ publishedPort: null }, 9876)).toBe('unpublished')
    expect(dockerContainerUnusableReason({ publishedPort: 9876 }, 9876)).toBe('port-in-use')
    expect(dockerContainerUnusableReason({ publishedPort: 9876 }, null)).toBeNull()
    expect(dockerContainerUnusableReason({ publishedPort: 19877 }, 9876)).toBeNull()
    expect(dockerContainerUnusableReason({ publishedPort: undefined }, 9876)).toBeNull()
    const [clash] = buildDockerContainerChoices([entry('c', { publishedPort: 9876 })], 9876)
    expect(clash).toMatchObject({
      disabled: true,
      disabledReasonKey: 'wizard.docker.pickContainer.container.disabled.portInUse',
      disabledReasonParams: { port: '9876' },
    })
  })

  it('empty list -> no options', () => {
    expect(buildDockerContainerChoices([], 9876)).toEqual([])
  })
})

describe('pick-container "Use existing" picker (T0851)', () => {
  function installDocker(containers: DockerContainerEntry[], serverPort: number | null = 9876) {
    const docker = { listContainers: vi.fn().mockResolvedValue(containers), removeContainer: vi.fn() }
    const remote = { serverStatus: vi.fn().mockResolvedValue({ running: serverPort !== null, port: serverPort }) }
    installWindow({ docker, remote })
    return { docker, remote }
  }

  it('asks which container; the RemoteServer port marks a clashing one disabled', async () => {
    const { remote } = installDocker([
      entry('clash', { publishedPort: 9876 }),
      entry('good', { publishedPort: 19877, batCreated: true }),
    ])
    const { requestChoice, requests } = choiceQueue(['existing', 'good'])
    const ctx = makeCtx({ requestChoice })

    await pickContainerStep.run(ctx)

    expect(remote.serverStatus).toHaveBeenCalled()
    expect(requests[1].title).toBe(i18n.t('wizard.docker.pickContainer.choose.title'))
    expect(requests[1].options.map((o) => [o.value, Boolean(o.disabled)])).toEqual([['good', false], ['clash', true]])
    expect(ctx.state.containerMode).toBe('existing')
    expect(ctx.state.dockerContainer).toBe('good')
  })

  it('an answer that is a disabled container is refused (the step validates what it gets back)', async () => {
    installDocker([entry('clash', { publishedPort: 9876 }), entry('good', { publishedPort: 19877 })])
    const { requestChoice } = choiceQueue(['existing', 'clash'])
    const ctx = makeCtx({ requestChoice })

    await expect(pickContainerStep.run(ctx)).rejects.toMatchObject({ code: 'docker-no-containers' })
    expect(ctx.state.containerMode).toBe('unknown')
    expect(ctx.state.dockerContainer).toBeUndefined()
  })

  it('all unusable -> explanation + "Create new instead" switches to a new container', async () => {
    installDocker([entry('plain', { publishedPort: null }), entry('clash', { publishedPort: 9876 })])
    const { requestChoice, requests } = choiceQueue(['existing', DOCKER_CREATE_NEW_CHOICE])
    const ctx = makeCtx({ requestChoice })

    await pickContainerStep.run(ctx)

    expect(requests[1].title).toBe(i18n.t('wizard.docker.pickContainer.none.title'))
    expect(requests[1].description).toBe(i18n.t('wizard.docker.pickContainer.none.allUnusable'))
    expect(requests[1].options.map((o) => [o.value, Boolean(o.disabled)])).toEqual([
      ['plain', true],
      ['clash', true],
      [DOCKER_CREATE_NEW_CHOICE, false],
    ])
    expect(ctx.state.containerMode).toBe('new')
    expect(ctx.state.dockerContainer).toBe('bat-server-dev-box')
    // T0853 (D283 U2): the default is a base image; the bundle goes into a volume.
    expect(ctx.state.dockerImage).toBe('buildpack-deps:bookworm-scm')
  })

  it('empty list -> the prompt says there are no containers; dismissing it is docker-no-containers', async () => {
    installDocker([])
    const { requestChoice, requests } = choiceQueue(['existing', null])
    const ctx = makeCtx({ requestChoice })

    await expect(pickContainerStep.run(ctx)).rejects.toMatchObject({ code: 'docker-no-containers' })
    expect(requests[1].description).toBe(i18n.t('wizard.docker.pickContainer.none.empty'))
    expect(requests[1].options.map((o) => o.value)).toEqual([DOCKER_CREATE_NEW_CHOICE])
  })

  it('without a prompt the first usable container is used, skipping unusable ones', async () => {
    installDocker([entry('plain', { publishedPort: null }), entry('good', { state: 'exited', publishedPort: 19877 })])
    const ctx = makeCtx({ state: { containerMode: 'existing' } })

    await pickContainerStep.run(ctx)

    expect(ctx.state.dockerContainer).toBe('good')
  })

  it('a stored mode and container are kept without asking (re-run / retry)', async () => {
    const { remote } = installDocker([entry('other', { publishedPort: 19877 })])
    const { requestChoice } = choiceQueue([])
    const ctx = makeCtx({ requestChoice, state: { containerMode: 'existing', dockerContainer: 'mine', dockerMounts: [{ host: '/h', container: '/c' }] } })

    await pickContainerStep.run(ctx)

    expect(requestChoice).not.toHaveBeenCalled()
    expect(remote.serverStatus).not.toHaveBeenCalled()
    expect(ctx.state.dockerContainer).toBe('mine')
    expect(ctx.state.dockerMounts).toEqual([{ host: '/h', container: '/c' }])
  })

  it('a jump back that picks another container drops the old container mounts', async () => {
    installDocker([entry('first', { publishedPort: 19877 }), entry('second', { publishedPort: 19878 })])
    const { requestChoice } = choiceQueue(['existing', 'second'])
    const ctx = makeCtx({
      requestChoice,
      state: { containerMode: 'existing', dockerContainer: 'first', dockerMounts: [{ host: '/h', container: '/c' }], pickContainerEditRequested: true },
      profileDraft: { name: 'Dev Box', dockerMounts: [{ host: '/h', container: '/c' }] },
    })

    await pickContainerStep.run(ctx)

    expect(ctx.state.dockerContainer).toBe('second')
    expect(ctx.state.dockerMounts).toEqual([])
    expect(ctx.profileDraft.dockerMounts).toBeUndefined()
  })

  it('a jump back that keeps the same container keeps its mounts', async () => {
    installDocker([entry('first', { publishedPort: 19877 })])
    const { requestChoice } = choiceQueue(['existing', 'first'])
    const mounts = [{ host: '/h', container: '/c' }]
    const ctx = makeCtx({
      requestChoice,
      state: { containerMode: 'existing', dockerContainer: 'first', dockerMounts: mounts, pickContainerEditRequested: true },
    })

    await pickContainerStep.run(ctx)

    expect(ctx.state.dockerMounts).toEqual(mounts)
  })
})

describe('configure-mounts takes an existing container bind mounts (T0851)', () => {
  function installMountsApi(opts: {
    mounts?: Array<{ source: string; destination: string; type: string }>
    inspectError?: Error
    validate?: (rows: Array<{ host: string; container: string }>) => { ok: boolean; errors: string[] }
    selectFolder?: string[] | null
    platform?: string
  }) {
    const docker = {
      inspectContainer: vi.fn(async () => {
        if (opts.inspectError) throw opts.inspectError
        return { id: 'x', name: 'mine', image: 'img', state: { status: 'running', running: true, health: 'none' }, mounts: opts.mounts ?? [], ports: [] }
      }),
      validateMounts: vi.fn(async (rows: Array<{ host: string; container: string }>) => opts.validate?.(rows) ?? { ok: true, errors: [] }),
    }
    const dialog = { selectFolder: vi.fn(async () => opts.selectFolder ?? null) }
    installWindow({ docker, dialog, platform: opts.platform ?? 'linux' })
    return { docker, dialog }
  }

  const existingState = () => ({ containerMode: 'existing', dockerContainer: 'mine', dockerMounts: [] })
  const BIND = [
    { type: 'bind', source: '/home/me/repo', destination: '/workspace/repo' },
    { type: 'volume', source: '/var/lib/docker/volumes/x/_data', destination: '/root/.local/share/bat-server' },
    { type: 'bind', source: '/var/run/docker.sock', destination: '/var/run/docker.sock' },
  ]

  it('asks to confirm the container mounts; "use" stores them without the folder picker', async () => {
    const { dialog } = installMountsApi({ mounts: BIND })
    const { requestChoice, requests } = choiceQueue([DOCKER_MOUNTS_USE_CONTAINER])
    const ctx = makeCtx({ requestChoice, state: existingState() })

    await configureMountsStep.run(ctx)

    expect(dialog.selectFolder).not.toHaveBeenCalled()
    expect(requests[0].stepId).toBe('configure-mounts')
    expect(requests[0].description).toContain('/home/me/repo → /workspace/repo')
    expect(ctx.state.dockerMounts).toEqual([{ host: '/home/me/repo', container: '/workspace/repo' }])
    expect(ctx.profileDraft.dockerMounts).toEqual([{ host: '/home/me/repo', container: '/workspace/repo' }])
  })

  it('"choose a folder instead" opens the folder picker as before', async () => {
    const { dialog } = installMountsApi({ mounts: BIND, selectFolder: ['/home/me/other'] })
    const { requestChoice } = choiceQueue([DOCKER_MOUNTS_PICK_FOLDER])
    const ctx = makeCtx({ requestChoice, state: existingState() })

    await configureMountsStep.run(ctx)

    expect(dialog.selectFolder).toHaveBeenCalledTimes(1)
    expect(ctx.state.dockerMounts).toEqual([{ host: '/home/me/other', container: '/workspace/other' }])
  })

  it('no bind mounts -> folder picker, no prompt', async () => {
    const { dialog } = installMountsApi({ mounts: [BIND[1]], selectFolder: ['/home/me/repo'] })
    const { requestChoice } = choiceQueue([])
    const ctx = makeCtx({ requestChoice, state: existingState() })

    await configureMountsStep.run(ctx)

    expect(requestChoice).not.toHaveBeenCalled()
    expect(dialog.selectFolder).toHaveBeenCalledTimes(1)
  })

  it('inspect failure -> folder picker (logged, not an error)', async () => {
    const { dialog } = installMountsApi({ inspectError: new Error('boom'), selectFolder: ['/home/me/repo'] })
    const ctx = makeCtx({ requestChoice: choiceQueue([]).requestChoice, state: existingState() })

    await configureMountsStep.run(ctx)

    expect(dialog.selectFolder).toHaveBeenCalledTimes(1)
    expect(ctx.logger.warn).toHaveBeenCalled()
  })

  it('container mounts not on this machine -> warning + folder picker', async () => {
    let call = 0
    const { dialog } = installMountsApi({
      mounts: BIND,
      selectFolder: ['/home/me/repo'],
      validate: () => (call++ === 0 ? { ok: false, errors: ['Row 1: Host path does not exist: /home/me/repo'] } : { ok: true, errors: [] }),
    })
    const { requestChoice } = choiceQueue([])
    const ctx = makeCtx({ requestChoice, state: existingState() })

    await configureMountsStep.run(ctx)

    expect(requestChoice).not.toHaveBeenCalled()
    expect(dialog.selectFolder).toHaveBeenCalledTimes(1)
    expect(ctx.warnings).toEqual([i18n.t('wizard.docker.warning.containerMountsUnusable', { name: 'mine' })])
  })

  it('without a prompt the container mounts are used', async () => {
    const { dialog } = installMountsApi({ mounts: BIND })
    const ctx = makeCtx({ state: existingState() })

    await configureMountsStep.run(ctx)

    expect(dialog.selectFolder).not.toHaveBeenCalled()
    expect(ctx.state.dockerMounts).toEqual([{ host: '/home/me/repo', container: '/workspace/repo' }])
  })

  it('"Create new" never reads container mounts', async () => {
    const { docker, dialog } = installMountsApi({ mounts: BIND, selectFolder: ['/home/me/repo'] })
    const ctx = makeCtx({ state: { containerMode: 'new', dockerContainer: 'bat-server-dev-box', dockerMounts: [] } })

    await configureMountsStep.run(ctx)

    expect(docker.inspectContainer).not.toHaveBeenCalled()
    expect(dialog.selectFolder).toHaveBeenCalledTimes(1)
  })

  it('stored mounts are kept (re-run / retry) without inspecting', async () => {
    const { docker } = installMountsApi({ mounts: BIND })
    const ctx = makeCtx({ state: { ...existingState(), dockerMounts: [{ host: '/h', container: '/c' }] } })

    await configureMountsStep.run(ctx)

    expect(docker.inspectContainer).not.toHaveBeenCalled()
    expect(ctx.state.dockerMounts).toEqual([{ host: '/h', container: '/c' }])
  })
})

describe('bind mount helpers (T0851)', () => {
  it('keeps only bind mounts with an absolute destination, no sockets', () => {
    expect(bindMountsFromInspect([
      { type: 'bind', source: '/a', destination: '/workspace/a' },
      { type: 'volume', source: '/v', destination: '/data' },
      { type: 'bind', source: '/var/run/docker.sock', destination: '/var/run/docker.sock' },
      { type: 'bind', source: '', destination: '/x' },
      { type: 'bind', source: '/b', destination: 'relative' },
      { type: 'tmpfs', source: '', destination: '/tmp' },
    ], 'linux')).toEqual([{ host: '/a', container: '/workspace/a' }])
    expect(bindMountsFromInspect(undefined, 'linux')).toEqual([])
  })

  it('maps Docker Desktop host paths back to this machine', () => {
    expect(dockerBindSourceToHostPath('/run/desktop/mnt/host/c/projects/bat', 'win32')).toBe('C:\\projects\\bat')
    expect(dockerBindSourceToHostPath('/host_mnt/d/work', 'win32')).toBe('D:\\work')
    expect(dockerBindSourceToHostPath('/run/desktop/mnt/host/c', 'win32')).toBe('C:\\')
    expect(dockerBindSourceToHostPath('C:\\projects\\bat', 'win32')).toBe('C:\\projects\\bat')
    expect(dockerBindSourceToHostPath('/host_mnt/Users/me/repo', 'darwin')).toBe('/Users/me/repo')
    expect(dockerBindSourceToHostPath('/home/me/repo', 'linux')).toBe('/home/me/repo')
    expect(dockerBindSourceToHostPath('/host_mnt/c/x', 'linux')).toBe('/host_mnt/c/x')
  })
})
