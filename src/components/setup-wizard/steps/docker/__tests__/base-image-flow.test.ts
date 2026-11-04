/**
 * T0853 (PLAN-052 W4b, D283 (c′)): the Docker wizard's base image flow —
 * base image field, install into the bundle volume, create on the base image,
 * re-run = upgrade, U3 baked images, offline import, cancel / failure rollback.
 * The T0852 main-side primitives are faked with a small stateful model of the
 * containers and volumes.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import i18n from '../../../../../i18n'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  resolveWizardError,
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
  type WizardTextRequest,
} from '../../../wizard-runner'
import { importServerBundleForRetry, SERVER_BUNDLE_UNAVAILABLE_CODE } from '../../../server-bundle-import'
import { DEFAULT_DOCKER_BASE_IMAGE, DOCKER_IMAGE_INVALID_KEY, isValidDockerImageRef } from '../base-image'
import {
  DOCKER_BUNDLE_INSTALL_KEY,
  DOCKER_CONTAINER_KIND_KEY,
  DOCKER_PULL_OPERATION_KEY,
  DOCKER_UPGRADE_CHOICE,
  DOCKER_UPGRADE_KEY,
  DOCKER_UPGRADE_SKIP_CHOICE,
  installDockerServerBundleStep,
  isBundleVolumeContainer,
} from '../install-server-bundle'
import { DOCKER_OWNERSHIP_KEYS } from '../ownership'
import { pickContainerStep } from '../pick-container'
import { startDockerServerStep } from '../start-server'

const APP_VERSION = '0.7.4-pre.8'
const NAME = 'bat-server-dev-box'
const BUNDLE = `${NAME}-bundle`.replace(NAME, `bat-server-${NAME}`)
const DATA = `bat-server-${NAME}-data`

interface FakeContainer {
  name: string
  running: boolean
  batCreated: boolean
  image: string
  bundleVolume?: string
}

interface FakeVolume {
  /** Version of the bundle at /opt/bat/server (undefined = empty volume). */
  bundle?: string
  /** Version kept at /opt/bat/server.bat-old. */
  old?: string
}

interface FakeOptions {
  containers?: FakeContainer[]
  volumes?: Record<string, FakeVolume>
  probe?: (options: { image: string; bundleVolume?: string }) => unknown
  distribute?: () => unknown
  health?: 'healthy' | 'unhealthy'
  baked?: (image: string) => boolean
  pull?: (image: string, options?: { operationId?: string }) => unknown
  /** Images `docker image inspect` finds locally (default: all). */
  localImages?: string[]
}

function installFake(options: FakeOptions = {}) {
  const containers = new Map((options.containers ?? []).map((c) => [c.name, { ...c }]))
  const volumes = new Map(Object.entries(options.volumes ?? {}).map(([k, v]) => [k, { ...v }]))
  const order: string[] = []
  const pullListeners = new Set<(event: { operationId?: string; layers: number; completed: number }) => void>()
  const bundleVersion = APP_VERSION

  const docker = {
    listContainers: vi.fn(async () => Array.from(containers.values()).map((c) => ({
      id: `id-${c.name}`, name: c.name, image: c.image, state: c.running ? 'running' : 'exited', status: '', batCreated: c.batCreated, publishedPort: 19876,
    }))),
    inspectContainer: vi.fn(async (name: string) => {
      const c = containers.get(name)
      if (!c) throw new Error(`No such container: ${name}`)
      return {
        id: `id-${name}`, name, image: c.image,
        state: { status: c.running ? 'running' : 'exited', running: c.running, health: 'healthy' },
        mounts: c.bundleVolume
          ? [{ type: 'volume', source: `/var/lib/docker/volumes/${c.bundleVolume}/_data`, destination: '/opt/bat' }]
          : [],
        ports: [],
      }
    }),
    startContainer: vi.fn(async (name: string, opts?: { createIfMissing?: boolean; image?: string }) => {
      order.push(`start:${name}${opts?.createIfMissing ? ':create' : ''}`)
      if (opts?.createIfMissing) {
        if (containers.has(name)) return { ok: false, error: `Conflict. The container name "/${name}" is already in use` }
        containers.set(name, { name, running: true, batCreated: true, image: opts.image ?? '' })
        return { ok: true }
      }
      const c = containers.get(name)
      if (c) c.running = true
      return { ok: true }
    }),
    restartContainer: vi.fn(async (name: string) => {
      order.push(`restart:${name}`)
      return { ok: true }
    }),
    stopContainer: vi.fn(async (name: string) => {
      order.push(`stop:${name}`)
      const c = containers.get(name)
      if (c) c.running = false
      return { ok: true }
    }),
    removeContainer: vi.fn(async (name: string) => {
      order.push(`rm:${name}`)
      if (!containers.has(name)) return { ok: false, error: `No such container: ${name}` }
      containers.delete(name)
      return { ok: true }
    }),
    readServerToken: vi.fn(async () => ({ ok: true, token: 'server-token' })),
    pickServerPort: vi.fn(async (opts?: { container?: string; previousPort?: number }) =>
      opts?.container ? { ok: true, port: 19876, reusedExistingPort: true } : { ok: true, port: opts?.previousPort ?? 19877 }),
    getContainerHealth: vi.fn(async () => ({ ok: true, health: options.health ?? 'healthy' })),
    execCommand: vi.fn(async () => ({ ok: true as const })),
    pullImage: vi.fn(async (image: string, opts?: { operationId?: string }) => {
      order.push(`pull:${image}`)
      for (const listener of pullListeners) {
        listener({ operationId: 'someone-else', layers: 9, completed: 9 })
        listener({ operationId: opts?.operationId, layers: 3, completed: 1 })
        listener({ operationId: opts?.operationId, layers: 3, completed: 3 })
      }
      return options.pull?.(image, opts) ?? { ok: true, status: 'downloaded' }
    }),
    onPullProgress: vi.fn((callback: (event: { operationId?: string; layers: number; completed: number }) => void) => {
      pullListeners.add(callback)
      return () => pullListeners.delete(callback)
    }),
    imageBakedBundle: vi.fn(async (image: string) => {
      order.push(`baked?:${image}`)
      if (options.localImages && !options.localImages.includes(image)) {
        return { ok: false, errorCode: 'docker-image-inspect-failed', error: `No such image: ${image}` }
      }
      const baked = options.baked ? options.baked(image) : image === 'bat-server:latest'
      return { ok: true, baked, reason: baked ? 'entrypoint' : 'none' }
    }),
    probeBundleCompat: vi.fn(async (opts: { image: string; bundleVolume?: string }) => {
      order.push(`probe:${opts.bundleVolume ? 'node' : 'image'}`)
      return options.probe?.(opts) ?? { ok: true, libc: 'glibc', glibcVersion: '2.36', nodeChecked: Boolean(opts.bundleVolume) }
    }),
    serverArch: vi.fn(async () => ({ ok: true, arch: 'linux-x64', rawArch: 'amd64' })),
    createVolume: vi.fn(async (name: string) => {
      order.push(`vol+:${name}`)
      if (volumes.has(name)) return { ok: true, volume: name, created: false, batLabelled: true }
      volumes.set(name, {})
      return { ok: true, volume: name, created: true, batLabelled: true }
    }),
    removeVolume: vi.fn(async (name: string) => {
      order.push(`vol-:${name}`)
      if ([...containers.values()].some((c) => c.bundleVolume === name)) return { ok: false, errorCode: 'docker-volume-failed', error: 'volume is in use' }
      return { ok: true, volume: name, removed: volumes.delete(name) }
    }),
    installBundleIntoVolume: vi.fn(async (opts: { bundleVolume: string; keepPrevious?: boolean }) => {
      order.push(`install:${opts.bundleVolume}:${opts.keepPrevious ? 'keep' : 'replace'}`)
      const volume = volumes.get(opts.bundleVolume)
      if (!volume) return { ok: false, errorCode: 'docker-install-failed', error: 'no such volume' }
      let previous: 'kept' | 'none' = 'none'
      if (volume.bundle && opts.keepPrevious) {
        volume.old = volume.bundle
        previous = 'kept'
      } else {
        delete volume.old
      }
      volume.bundle = bundleVersion
      return { ok: true, installPath: '/opt/bat/server', previous }
    }),
    restoreBundleInVolume: vi.fn(async (opts: { bundleVolume: string }) => {
      order.push(`restore:${opts.bundleVolume}`)
      const volume = volumes.get(opts.bundleVolume)
      if (!volume?.old) return { ok: true, outcome: 'missing' }
      volume.bundle = volume.old
      delete volume.old
      return { ok: true, outcome: 'restored' }
    }),
    discardPreviousBundleInVolume: vi.fn(async (opts: { bundleVolume: string }) => {
      order.push(`discard:${opts.bundleVolume}`)
      const volume = volumes.get(opts.bundleVolume)
      if (volume) delete volume.old
      return { ok: true }
    }),
    readBundleVersionInVolume: vi.fn(async (opts: { bundleVolume: string }) => ({ ok: true, version: volumes.get(opts.bundleVolume)?.bundle ?? null })),
    createBatContainer: vi.fn(async (name: string, opts: { image: string; bundleVolume: string }) => {
      order.push(`create:${name}:${opts.image}`)
      if (containers.has(name)) return { ok: false, error: `Conflict. The container name "/${name}" is already in use` }
      containers.set(name, { name, running: true, batCreated: true, image: opts.image, bundleVolume: opts.bundleVolume })
      return { ok: true }
    }),
  }
  const distribute = vi.fn(async (_opts: unknown) => {
    order.push('distribute')
    return options.distribute?.() ?? { ok: true, tarballPath: 'C:\\cache\\bat-server-linux-x64-v0.7.4-pre.8.tar.gz', sha256: 'x', sizeBytes: 1, source: 'cache', arch: 'linux-x64' }
  })
  const importLocal = vi.fn(async () => ({ ok: true }))
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      docker,
      remote: { serverBundle: { distribute, onDistributeProgress: vi.fn(() => () => undefined), importLocal } },
      update: { getVersion: vi.fn(async () => APP_VERSION) },
      wizard: { abortOperation: vi.fn(async () => ({ ok: true, found: true })) },
    },
  }
  return { docker, distribute, importLocal, containers, volumes, order }
}

function makeCtx(state: Record<string, unknown>, overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: 'Dev Box' },
    warnings: [],
    state: { dockerMounts: [{ host: 'C:\\work', container: '/workspace/work' }], ...state },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
}

function newCtx(state: Record<string, unknown> = {}, overrides: Partial<WizardContext> = {}): WizardContext {
  return makeCtx({ containerMode: 'new', dockerContainer: NAME, dockerImage: DEFAULT_DOCKER_BASE_IMAGE, ...state }, overrides)
}

function upgradeFake(extra: FakeOptions = {}, running = true) {
  return installFake({
    containers: [{ name: NAME, running, batCreated: true, image: DEFAULT_DOCKER_BASE_IMAGE, bundleVolume: BUNDLE }],
    volumes: { [BUNDLE]: { bundle: '0.7.3' }, [DATA]: {} },
    ...extra,
  })
}

function existingCtx(answer?: string): WizardContext {
  return makeCtx(
    { containerMode: 'existing', dockerContainer: NAME, dockerMounts: [] },
    answer === undefined ? {} : { requestChoice: vi.fn(async () => answer) },
  )
}

/** Run until `stepId` fails; returns the run promise (await it after cancel(): rollback runs there). */
async function runToFailure(runner: WizardRunner, stepId: string): Promise<{ run: Promise<unknown> }> {
  const run = runner.run().then(() => null, (error: unknown) => error)
  await vi.waitFor(() => {
    const snap = runner.getSnapshots().find((s) => s.id === stepId)
    if (snap?.status !== WizardStepStatus.Failed) throw new Error('not failed yet')
  })
  return { run }
}

async function cancelAtFailure(runner: WizardRunner, stepId: string): Promise<void> {
  const { run } = await runToFailure(runner, stepId)
  await runner.cancel()
  await run
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('base image field (T0853 task 1)', () => {
  it('default is the U2 image; registry / digest refs are accepted, Alpine-style typos are not', () => {
    expect(DEFAULT_DOCKER_BASE_IMAGE).toBe('buildpack-deps:bookworm-scm')
    for (const ok of ['buildpack-deps:bookworm-scm', 'bat-server:latest', 'registry.example.com:5000/team/dev:1.2', `debian@sha256:${'a'.repeat(64)}`, 'localhost/dev']) {
      expect(isValidDockerImageRef(ok)).toBe(true)
    }
    for (const bad of ['', 'Ubuntu:22.04', '-v /:/host', 'a b', 'debian:12;id', 'x:'.padEnd(300, 'a')]) {
      expect(isValidDockerImageRef(bad)).toBe(false)
    }
  })

  it('"Create new" asks for the base image, pre-filled with the default; a custom image is stored', async () => {
    installFake()
    let textRequest: WizardTextRequest | undefined
    const ctx = makeCtx({ containerMode: 'unknown' }, {
      requestChoice: vi.fn(async (_r: WizardChoiceRequest) => 'new'),
      requestText: vi.fn(async (request: WizardTextRequest) => {
        textRequest = request
        return '  registry.example.com/team/dev:1.2  '
      }),
    })
    await pickContainerStep.run(ctx)
    expect(textRequest?.titleKey).toBe('wizard.docker.baseImage.title')
    expect(textRequest?.initialValue).toBe(DEFAULT_DOCKER_BASE_IMAGE)
    expect(textRequest?.validate?.('Ubuntu')).toBe(DOCKER_IMAGE_INVALID_KEY)
    expect(textRequest?.validate?.('ubuntu:24.04')).toBeNull()
    expect(ctx.state.containerMode).toBe('new')
    expect(ctx.state.dockerImage).toBe('registry.example.com/team/dev:1.2')
  })

  it('cancelling the field keeps the current image; "Use existing" never asks', async () => {
    installFake({ containers: [{ name: 'mine', running: true, batCreated: false, image: 'x' }] })
    const cancelled = makeCtx({ containerMode: 'unknown' }, {
      requestChoice: vi.fn(async () => 'new'),
      requestText: vi.fn(async () => null),
    })
    await pickContainerStep.run(cancelled)
    expect(cancelled.state.dockerImage).toBe(DEFAULT_DOCKER_BASE_IMAGE)

    const requestText = vi.fn(async () => 'debian:12')
    const existing = makeCtx({ containerMode: 'unknown' }, {
      requestChoice: vi.fn(async (r: WizardChoiceRequest) => (r.options.some((o) => o.value === 'existing') ? 'existing' : 'mine')),
      requestText,
    })
    await pickContainerStep.run(existing)
    expect(existing.state.containerMode).toBe('existing')
    expect(requestText).not.toHaveBeenCalled()
  })
})

describe('"Create new" on a base image (T0853 tasks 2 / 3)', () => {
  it('pull → baked? → probe → arch → distributor → volumes → install → node probe → create on the base image → healthy → token', async () => {
    const { docker, distribute, order, volumes } = installFake()
    const ctx = newCtx()
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await runner.run()

    expect(order).toEqual([
      `pull:${DEFAULT_DOCKER_BASE_IMAGE}`,
      `baked?:${DEFAULT_DOCKER_BASE_IMAGE}`,
      'probe:image',
      'distribute',
      `vol+:${BUNDLE}`,
      `vol+:${DATA}`,
      `install:${BUNDLE}:keep`,
      'probe:node',
      `create:${NAME}:${DEFAULT_DOCKER_BASE_IMAGE}`,
    ])
    // Q-1: the distributor gets the daemon arch; the container does not exist yet.
    expect(distribute).toHaveBeenCalledWith(expect.objectContaining({
      draftProfile: { targetOS: 'docker-linux', dockerContainer: NAME, dockerServerArch: 'linux-x64' },
      version: APP_VERSION,
    }))
    expect(docker.installBundleIntoVolume).toHaveBeenCalledWith(expect.objectContaining({
      image: DEFAULT_DOCKER_BASE_IMAGE, bundleVolume: BUNDLE, dataVolume: DATA, keepPrevious: true,
      tarballPath: 'C:\\cache\\bat-server-linux-x64-v0.7.4-pre.8.tar.gz',
    }))
    expect(docker.createBatContainer).toHaveBeenCalledWith(NAME, {
      image: DEFAULT_DOCKER_BASE_IMAGE,
      port: 19877,
      bundleVolume: BUNDLE,
      dataVolume: DATA,
      mounts: [{ host: 'C:\\work', container: '/workspace/work' }],
      restartPolicy: 'unless-stopped',
    })
    expect(docker.startContainer).not.toHaveBeenCalled()
    expect(ctx.remoteToken).toBe('server-token')
    expect(ctx.state[DOCKER_CONTAINER_KIND_KEY]).toBe('bundle-volume')
    expect(ctx.state.bundleSource).toBe('cache')
    expect(ctx.state[DOCKER_OWNERSHIP_KEYS.bundleVolumeCreated]).toBe(BUNDLE)
    expect(ctx.state[DOCKER_OWNERSHIP_KEYS.dataVolumeCreated]).toBe(DATA)
    expect(ctx.state[DOCKER_OWNERSHIP_KEYS.containerCreated]).toBe(NAME)
    expect(volumes.get(BUNDLE)?.bundle).toBe(APP_VERSION)
    // Nothing was kept, so finalize had nothing to discard.
    expect(docker.discardPreviousBundleInVolume).not.toHaveBeenCalled()
  })

  it('pull progress: only this pull\'s events are logged; the operation id is cleared afterwards', async () => {
    installFake()
    const ctx = newCtx()
    const runner = new WizardRunner([installDockerServerBundleStep], ctx)
    await runner.run()
    const infos = (ctx.logger.info as ReturnType<typeof vi.fn>).mock.calls.map(([line]) => String(line))
    expect(infos).toContain(`Pulling ${DEFAULT_DOCKER_BASE_IMAGE}: 1/3 layers`)
    expect(infos).toContain(`Pulling ${DEFAULT_DOCKER_BASE_IMAGE}: 3/3 layers`)
    expect(infos.some((line) => line.includes('9/9'))).toBe(false)
    expect(ctx.state[DOCKER_PULL_OPERATION_KEY]).toBeUndefined()
  })

  it('offline: a failed download offers "Import local tarball…"; after the import the retry installs (nothing created before)', async () => {
    let downloads = 0
    const { docker, importLocal } = installFake({
      distribute: () => (++downloads === 1
        ? { ok: false, errorCode: 'download-failed', error: 'offline', arch: 'linux-x64', version: APP_VERSION }
        : undefined),
    })
    const ctx = newCtx()
    const runner = new WizardRunner([installDockerServerBundleStep], ctx)
    await runToFailure(runner, 'install-server-bundle')

    const snap = runner.getSnapshots()[0]
    expect(snap.mappedError?.matchId).toBe('server-bundle-unavailable')
    expect(snap.mappedError?.actions.map((a) => a.kind)).toEqual(['import-server-bundle', 'retry', 'cancel'])
    expect(docker.createVolume).not.toHaveBeenCalled()

    const t = ((key: string) => key) as unknown as Parameters<typeof importServerBundleForRetry>[1]
    expect(await importServerBundleForRetry(ctx.state, t)).toMatchObject({ status: 'imported' })
    expect(importLocal).toHaveBeenCalledWith(expect.objectContaining({ arch: 'linux-x64', version: APP_VERSION }))

    await runner.retryCurrentStep()
    await vi.waitFor(() => expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Succeeded))
    expect(docker.installBundleIntoVolume).toHaveBeenCalledTimes(1)
    expect(resolveWizardError(
      { platform: 'docker', stepId: 'install-server-bundle', errorCode: SERVER_BUNDLE_UNAVAILABLE_CODE, error: new Error('x') },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    ).matchId).toBe('server-bundle-unavailable')
  })

  it('musl base image: the probe stops it before anything is created; the error offers "Change base image"', async () => {
    const { docker, distribute } = installFake({
      probe: () => ({ ok: false, errorCode: 'docker-compat-musl', error: 'musl', libc: 'musl' }),
    })
    const ctx = newCtx({ dockerImage: 'alpine:3.20' })
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await runToFailure(runner, 'install-server-bundle')

    const mapped = runner.getSnapshots()[0].mappedError
    expect(mapped?.matchId).toBe('docker-compat-musl')
    expect(mapped?.actions[0]).toMatchObject({ kind: 'edit-config', targetStepId: 'pick-container', labelKey: 'wizard.action.dockerChangeImage' })
    expect(distribute).not.toHaveBeenCalled()
    expect(docker.createVolume).not.toHaveBeenCalled()
    expect(docker.createBatContainer).not.toHaveBeenCalled()
    expect(docker.startContainer).not.toHaveBeenCalled()
  })

  it('every probe error code is mapped (three languages exist for each message key)', async () => {
    const locales = await Promise.all(['en', 'zh-TW', 'zh-CN'].map(async (l) => (await import(`../../../../../locales/${l}.json`)).default))
    for (const code of [
      'docker-image-invalid', 'docker-image-not-found', 'docker-pull-rate-limited', 'docker-pull-failed', 'docker-pull-timeout',
      'docker-image-inspect-failed', 'docker-compat-no-shell', 'docker-compat-missing-tools', 'docker-compat-musl',
      'docker-compat-glibc-too-old', 'docker-compat-bundle-missing', 'docker-compat-node-failed', 'docker-compat-probe-failed',
      'docker-arch-failed', 'docker-arch-unsupported', 'docker-server-not-linux', 'docker-volume-failed', 'docker-volume-not-owned',
      'server-bundle-install-failed', 'server-bundle-distribute-failed',
    ]) {
      const entry = DEFAULT_WIZARD_ERROR_REGISTRY.find((e) => e.errorCodes?.includes(code) && (e.platforms === 'all' || e.platforms.includes('docker')))
      expect(entry, code).toBeDefined()
      for (const locale of locales) {
        const node = entry!.messageKey.split('.').reduce((acc: Record<string, unknown> | undefined, key) => acc?.[key] as Record<string, unknown> | undefined, locale)
        expect(typeof node?.title, `${code} title`).toBe('string')
        expect(typeof node?.body, `${code} body`).toBe('string')
      }
    }
  })

  it('cancel after the container failed: the container and both volumes this run created are removed', async () => {
    const { docker, containers, volumes, order } = installFake({ health: 'unhealthy' })
    const ctx = newCtx()
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await cancelAtFailure(runner, 'start-server')

    expect(containers.has(NAME)).toBe(false)
    expect(volumes.has(BUNDLE)).toBe(false)
    expect(volumes.has(DATA)).toBe(false)
    expect(order.indexOf(`rm:${NAME}`)).toBeLessThan(order.indexOf(`vol-:${BUNDLE}`))
    expect(docker.restoreBundleInVolume).not.toHaveBeenCalled()
    expect(ctx.state[DOCKER_OWNERSHIP_KEYS.bundleVolumeCreated]).toBeUndefined()
    expect(ctx.state[DOCKER_BUNDLE_INSTALL_KEY]).toBeUndefined()
  })

  it('volumes that existed before (not ours) are reused and never removed; an older bundle in them is restored', async () => {
    const { docker, volumes } = installFake({ health: 'unhealthy', volumes: { [BUNDLE]: { bundle: '0.7.0' }, [DATA]: {} } })
    const ctx = newCtx()
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await cancelAtFailure(runner, 'start-server')

    expect(docker.removeVolume).not.toHaveBeenCalled()
    expect(volumes.get(BUNDLE)).toEqual({ bundle: '0.7.0' })
    expect(volumes.has(DATA)).toBe(true)
  })

  it('a retry after this run installed undoes its own install first (the original .bat-old is not lost)', async () => {
    let probes = 0
    const { volumes, order } = installFake({
      volumes: { [BUNDLE]: { bundle: '0.7.0' }, [DATA]: {} },
      probe: (opts) => (opts.bundleVolume && ++probes === 1 ? { ok: false, errorCode: 'docker-compat-node-failed', error: 'x' } : undefined),
    })
    const ctx = newCtx()
    const runner = new WizardRunner([installDockerServerBundleStep], ctx)
    await runToFailure(runner, 'install-server-bundle')
    await runner.retryCurrentStep()
    await vi.waitFor(() => expect(runner.getSnapshots()[0].status).toBe(WizardStepStatus.Succeeded))

    const installs = order.filter((entry) => entry.startsWith('install:') || entry.startsWith('restore:'))
    expect(installs).toEqual([`install:${BUNDLE}:keep`, `restore:${BUNDLE}`, `install:${BUNDLE}:keep`])
    // Finalize discarded the original only at the very end.
    expect(volumes.get(BUNDLE)).toEqual({ bundle: APP_VERSION })
  })
})

describe('U3: an image with the BAT server baked in (T0853 task 5)', () => {
  it('a local-only image (built, never pushed) cannot be pulled: the local copy is used', async () => {
    const { docker } = installFake({
      pull: () => ({ ok: false, errorCode: 'docker-image-not-found', error: 'pull access denied for bat-server' }),
      localImages: ['bat-server:latest'],
    })
    const ctx = newCtx({ dockerImage: 'bat-server:latest' })
    await installDockerServerBundleStep.run(ctx)
    expect(ctx.state[DOCKER_CONTAINER_KIND_KEY]).toBe('baked')
    expect(docker.imageBakedBundle).toHaveBeenCalledTimes(2)
    expect(ctx.logger.warn).toHaveBeenCalledWith('Could not pull Docker image bat-server:latest (docker-image-not-found); using the local copy.')
  })

  it('pull fails and there is no local copy: docker-image-not-found, nothing created', async () => {
    const { docker } = installFake({
      pull: () => ({ ok: false, errorCode: 'docker-image-not-found', error: 'manifest unknown' }),
      localImages: [],
    })
    const ctx = newCtx({ dockerImage: 'registry.example.com/team/dev:9' })
    const runner = new WizardRunner([installDockerServerBundleStep], ctx)
    await runToFailure(runner, 'install-server-bundle')
    const mapped = runner.getSnapshots()[0].mappedError
    expect(mapped?.matchId).toBe('docker-image-not-usable')
    expect(mapped?.actions[0]).toMatchObject({ kind: 'edit-config', targetStepId: 'pick-container' })
    expect(docker.probeBundleCompat).not.toHaveBeenCalled()
    expect(docker.createVolume).not.toHaveBeenCalled()
  })

  it('an invalid image reference is not looked up locally', async () => {
    const { docker } = installFake({ pull: () => ({ ok: false, errorCode: 'docker-image-invalid', error: 'invalid' }) })
    await expect(installDockerServerBundleStep.run(newCtx({ dockerImage: 'Bad Image' }))).rejects.toMatchObject({ code: 'docker-image-invalid' })
    expect(docker.imageBakedBundle).not.toHaveBeenCalled()
  })

  it('bat-server:latest skips the install and is created as before (startContainer createIfMissing, data volume)', async () => {
    const { docker, distribute, order } = installFake()
    const ctx = newCtx({ dockerImage: 'bat-server:latest' })
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await runner.run()

    expect(order.slice(0, 2)).toEqual(['pull:bat-server:latest', 'baked?:bat-server:latest'])
    expect(docker.probeBundleCompat).not.toHaveBeenCalled()
    expect(distribute).not.toHaveBeenCalled()
    expect(docker.createVolume).not.toHaveBeenCalled()
    expect(docker.createBatContainer).not.toHaveBeenCalled()
    expect(docker.startContainer).toHaveBeenCalledWith(NAME, expect.objectContaining({
      createIfMissing: true, image: 'bat-server:latest', dataVolume: DATA,
    }))
    expect(ctx.state[DOCKER_CONTAINER_KIND_KEY]).toBe('baked')
    expect(ctx.serverInstallPath).toBe('/opt/bat-server')
    expect(ctx.state.bundleSource).toBe('image-baked')
  })
})

describe('"Use existing" on a container BAT created = upgrade (T0853 task 4, Q-3)', () => {
  it('recognises only a BAT container with its bundle volume on /opt/bat', () => {
    const mounts = [{ type: 'volume', source: `/var/lib/docker/volumes/${BUNDLE}/_data`, destination: '/opt/bat' }]
    expect(isBundleVolumeContainer(NAME, { mounts }, true)).toBe(true)
    expect(isBundleVolumeContainer(NAME, { mounts }, false)).toBe(false)
    expect(isBundleVolumeContainer(NAME, { mounts: [{ ...mounts[0], type: 'bind' }] }, true)).toBe(false)
    expect(isBundleVolumeContainer(NAME, { mounts: [{ ...mounts[0], source: '/var/lib/docker/volumes/other/_data' }] }, true)).toBe(false)
    expect(isBundleVolumeContainer(NAME, { mounts: [] }, true)).toBe(false)
  })

  it('confirmed upgrade: new bundle kept-swap → node probe → restart (no recreate) → finalize discards the old one', async () => {
    const { docker, distribute, volumes, order } = upgradeFake()
    const ctx = existingCtx(DOCKER_UPGRADE_CHOICE)
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await runner.run()

    const request = (ctx.requestChoice as ReturnType<typeof vi.fn>).mock.calls[0][0] as WizardChoiceRequest
    expect(request.options.map((o) => o.value)).toEqual([DOCKER_UPGRADE_CHOICE, DOCKER_UPGRADE_SKIP_CHOICE])
    expect(request.options[0].labelKey).toBe('wizard.docker.upgrade.confirm')
    expect(distribute).toHaveBeenCalledWith(expect.objectContaining({
      draftProfile: { targetOS: 'docker-linux', dockerContainer: NAME, dockerServerArch: 'linux-x64' },
    }))
    expect(docker.installBundleIntoVolume).toHaveBeenCalledWith(expect.objectContaining({ bundleVolume: BUNDLE, keepPrevious: true }))
    expect(docker.installBundleIntoVolume.mock.calls[0][0]).not.toHaveProperty('dataVolume')
    expect(order).toEqual([
      'distribute',
      `install:${BUNDLE}:keep`,
      'probe:node',
      `restart:${NAME}`,
      `discard:${BUNDLE}`,
    ])
    expect(docker.pullImage).not.toHaveBeenCalled()
    expect(docker.createBatContainer).not.toHaveBeenCalled()
    expect(docker.startContainer).not.toHaveBeenCalled()
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(ctx.state[DOCKER_UPGRADE_KEY]).toBe('installed')
    expect(volumes.get(BUNDLE)).toEqual({ bundle: APP_VERSION })
    expect(ctx.remoteToken).toBe('server-token')
  })

  it('a stopped BAT container is started (not restarted) on the new bundle; cancel stops it again', async () => {
    const { docker, order } = upgradeFake({ health: 'unhealthy' }, false)
    const ctx = existingCtx(DOCKER_UPGRADE_CHOICE)
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    const { run } = await runToFailure(runner, 'start-server')
    expect(docker.restartContainer).not.toHaveBeenCalled()
    expect(docker.startContainer).toHaveBeenCalledWith(NAME, { port: 19876 })
    await runner.cancel()
    await run
    expect(order.slice(-2)).toEqual([`stop:${NAME}`, `restore:${BUNDLE}`])
    expect(docker.restartContainer).not.toHaveBeenCalled()
  })

  it('same version: nothing installed, no question, no restart', async () => {
    const { docker, distribute } = upgradeFake({ volumes: { [BUNDLE]: { bundle: APP_VERSION } } })
    const ctx = existingCtx(DOCKER_UPGRADE_CHOICE)
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await runner.run()
    expect(ctx.requestChoice).not.toHaveBeenCalled()
    expect(distribute).not.toHaveBeenCalled()
    expect(docker.installBundleIntoVolume).not.toHaveBeenCalled()
    expect(docker.restartContainer).not.toHaveBeenCalled()
    expect(ctx.state[DOCKER_UPGRADE_KEY]).toBe('current')
    expect(ctx.serverInstallPath).toBe('/opt/bat/server')
  })

  it('a snapshot build compares on its base version (stripSnapshotSuffix)', async () => {
    const { docker } = upgradeFake({ volumes: { [BUNDLE]: { bundle: APP_VERSION } } })
    ;(window as unknown as { electronAPI: { update: { getVersion: () => Promise<string> } } }).electronAPI.update.getVersion = async () => `${APP_VERSION}.local.261104161500`
    const ctx = existingCtx(DOCKER_UPGRADE_CHOICE)
    await installDockerServerBundleStep.run(ctx)
    expect(ctx.state[DOCKER_UPGRADE_KEY]).toBe('current')
    expect(docker.installBundleIntoVolume).not.toHaveBeenCalled()
  })

  it('declined ("Not now"): nothing installed or restarted; connects to the current server as "Use existing" did', async () => {
    const { docker, distribute } = upgradeFake()
    const ctx = existingCtx(DOCKER_UPGRADE_SKIP_CHOICE)
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await runner.run()
    expect(ctx.requestChoice).toHaveBeenCalledTimes(1)
    expect(distribute).not.toHaveBeenCalled()
    expect(docker.installBundleIntoVolume).not.toHaveBeenCalled()
    expect(docker.restartContainer).not.toHaveBeenCalled()
    expect(docker.startContainer).toHaveBeenCalledWith(NAME, { port: 19876 })
    expect(ctx.state[DOCKER_UPGRADE_KEY]).toBe('skipped')
  })

  it('unknown installed version: still asks (description says the version is unknown)', async () => {
    upgradeFake({ volumes: { [BUNDLE]: {} } })
    const ctx = existingCtx(DOCKER_UPGRADE_SKIP_CHOICE)
    await installDockerServerBundleStep.run(ctx)
    const request = (ctx.requestChoice as ReturnType<typeof vi.fn>).mock.calls[0][0] as WizardChoiceRequest
    expect(request.description).toBe(i18n.t('wizard.docker.upgrade.descriptionUnknown', { name: NAME, to: APP_VERSION }))
    expect(request.description).toContain(APP_VERSION)
  })

  it('upgrade fails after the restart → cancel restores the old bundle and restarts on it; container untouched otherwise', async () => {
    const { docker, containers, volumes, order } = upgradeFake({ health: 'unhealthy' })
    const ctx = existingCtx(DOCKER_UPGRADE_CHOICE)
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    const { run } = await runToFailure(runner, 'start-server')
    expect(ctx.state[DOCKER_OWNERSHIP_KEYS.restartedForUpgrade]).toBe(NAME)
    await runner.cancel()
    await run

    expect(order.slice(-2)).toEqual([`restore:${BUNDLE}`, `restart:${NAME}`])
    expect(volumes.get(BUNDLE)).toEqual({ bundle: '0.7.3' })
    expect(docker.stopContainer).not.toHaveBeenCalled()
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(docker.removeVolume).not.toHaveBeenCalled()
    expect(containers.get(NAME)?.running).toBe(true)
  })

  it('upgrade fails before the restart (node probe) → cancel restores, no restart', async () => {
    const { docker, volumes } = upgradeFake({
      probe: (opts) => (opts.bundleVolume ? { ok: false, errorCode: 'docker-compat-node-failed', error: 'x' } : undefined),
    })
    const ctx = existingCtx(DOCKER_UPGRADE_CHOICE)
    const runner = new WizardRunner([installDockerServerBundleStep, startDockerServerStep], ctx)
    await cancelAtFailure(runner, 'install-server-bundle')
    expect(docker.restoreBundleInVolume).toHaveBeenCalledTimes(1)
    expect(docker.restartContainer).not.toHaveBeenCalled()
    expect(volumes.get(BUNDLE)).toEqual({ bundle: '0.7.3' })
  })

  it('any other existing container behaves as before T0853 (no pull, no install, warning)', async () => {
    const { docker } = installFake({ containers: [{ name: 'mine', running: true, batCreated: false, image: 'bat-server:latest' }] })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'mine' })
    await installDockerServerBundleStep.run(ctx)
    expect(docker.pullImage).not.toHaveBeenCalled()
    expect(docker.readBundleVersionInVolume).not.toHaveBeenCalled()
    expect(ctx.serverInstallPath).toBe('/opt/bat-server')
    expect(ctx.warnings).toEqual([i18n.t('wizard.docker.warning.existingNeedsBundle', { name: 'mine' })])
  })
})
