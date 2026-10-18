/**
 * T0427 (BUG-097 follow-up): the Docker start-server step warns — and only
 * warns — when an existing container predates the loopback-publish fix.
 * The container is still started, never removed or recreated.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import i18n from '../../../../../i18n'
import en from '../../../../../locales/en.json'
import zhCN from '../../../../../locales/zh-CN.json'
import zhTW from '../../../../../locales/zh-TW.json'
import { DOCKER_SERVER_PORT_KEY, startDockerServerStep } from '../start-server'
import { createDockerWizardContext } from '../../../docker-flow'
import { connectTestStep } from '../../wsl/connect-test'
import { writeProfileStep } from '../../wsl/write-profile'
import type { WizardContext } from '../../../wizard-runner'

type PickResult = Awaited<ReturnType<typeof window.electronAPI.docker.pickServerPort>>
type Exposure = { ok: boolean; exposed: boolean; hostIps: string[]; legacyImage: boolean }

function installElectronApi(startResult: { ok: boolean; token?: string; error?: string; exposure?: Exposure }) {
  const docker = {
    startContainer: vi.fn().mockResolvedValue(startResult),
    // T0649: an existing container keeps the port it publishes.
    pickServerPort: vi.fn(async (opts?: { container?: string }): Promise<PickResult> =>
      opts?.container ? { ok: true, port: 19876, reusedExistingPort: true } : { ok: true, port: 19877 }),
    listContainers: vi.fn().mockResolvedValue([]),
    getContainerHealth: vi.fn().mockResolvedValue({ ok: true, health: 'healthy' }),
    removeContainer: vi.fn().mockResolvedValue({ ok: true }),
    stopContainer: vi.fn().mockResolvedValue({ ok: true }),
  }
  ;(window as unknown as { electronAPI: { docker: typeof docker } }).electronAPI = { docker } as never
  return docker
}

function makeCtx(state: Record<string, unknown>): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: 'test' },
    warnings: [],
    state,
    serverPort: 19876,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  }
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('start-server step legacy container warning (T0427)', () => {
  it('passes the host port on the existing-container path', async () => {
    const docker = installElectronApi({ ok: true, token: 'tok' })
    await startDockerServerStep.run(makeCtx({ containerMode: 'existing', dockerContainer: 'bat-old' }))

    expect(docker.startContainer).toHaveBeenCalledWith('bat-old', { port: 19876 })
  })

  it('warns about a port published on every host interface and still starts', async () => {
    const docker = installElectronApi({
      ok: true,
      token: 'tok',
      exposure: { ok: true, exposed: true, hostIps: ['', '::'], legacyImage: false },
    })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'bat-old' })
    await startDockerServerStep.run(ctx)

    expect(ctx.warnings).toHaveLength(1)
    expect(ctx.warnings[0]).toContain('bat-old')
    expect(ctx.warnings[0]).toContain('0.0.0.0, ::')
    expect(ctx.warnings[0]).toContain('docker rm -f bat-old')
    expect(docker.getContainerHealth).toHaveBeenCalled()
    expect(docker.removeContainer).not.toHaveBeenCalled()
    expect(docker.stopContainer).not.toHaveBeenCalled()
  })

  it('warns about a legacy image before the health wait fails', async () => {
    const docker = installElectronApi({
      ok: true,
      token: 'tok',
      exposure: { ok: true, exposed: false, hostIps: [], legacyImage: true },
    })
    docker.getContainerHealth.mockResolvedValue({ ok: true, health: 'unhealthy' })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'bat-old' })

    await expect(startDockerServerStep.run(ctx)).rejects.toThrow(/unhealthy/)
    expect(ctx.warnings).toEqual([i18n.t('wizard.docker.warning.containerLegacyImage', { name: 'bat-old' })])
    expect(docker.removeContainer).not.toHaveBeenCalled()
  })

  it('stays silent when no exposure is reported', async () => {
    installElectronApi({ ok: true, token: 'tok' })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'bat-new' })
    await startDockerServerStep.run(ctx)

    expect(ctx.warnings).toEqual([])
  })

  it('has the warning copy in en / zh-TW / zh-CN', () => {
    for (const locale of [en, zhTW, zhCN] as Array<{ wizard: { docker: { warning: Record<string, string> } } }>) {
      expect(locale.wizard.docker.warning.containerPortExposed).toContain('{{hostIps}}')
      expect(locale.wizard.docker.warning.containerPortExposed).toContain('docker rm -f {{name}}')
      expect(locale.wizard.docker.warning.containerLegacyImage).toContain('{{name}}')
    }
  })
})

/**
 * T0649 (BUG-156): the host port is picked by main instead of a fixed 9876
 * (the host RemoteServer's default on the same 127.0.0.1), and the picked /
 * published port is what the connection test and the profile use.
 */
describe('start-server host port (T0649 / BUG-156)', () => {
  it('the Docker wizard context presets no port', () => {
    const ctx = createDockerWizardContext({ profileName: 'Dev' })
    expect(ctx.serverPort).toBeUndefined()
    expect(ctx.state.serverPort).toBeUndefined()
  })

  it('"Create new": docker run publishes the picked port, not 9876', async () => {
    const docker = installElectronApi({ ok: true, token: 'tok' })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })
    ctx.serverPort = undefined
    await startDockerServerStep.run(ctx)

    expect(docker.pickServerPort).toHaveBeenCalledWith({ preferredPort: undefined, previousPort: undefined })
    expect(docker.startContainer).toHaveBeenCalledWith('bat-new', expect.objectContaining({ createIfMissing: true, port: 19877 }))
    expect(ctx.serverPort).toBe(19877)
    expect(ctx.state[DOCKER_SERVER_PORT_KEY]).toBe(19877)
  })

  it('"Create new": a retry hands the earlier port to main, and a user-set port is passed as preferred', async () => {
    const docker = installElectronApi({ ok: true, token: 'tok' })
    await startDockerServerStep.run(makeCtx({ containerMode: 'new', dockerContainer: 'bat-new', [DOCKER_SERVER_PORT_KEY]: 19880, serverPort: 20000 }))

    expect(docker.pickServerPort).toHaveBeenCalledWith({ preferredPort: 20000, previousPort: 19880 })
  })

  it('"Use existing": keeps the port the container publishes', async () => {
    const docker = installElectronApi({ ok: true, token: 'tok' })
    docker.pickServerPort.mockResolvedValueOnce({ ok: true, port: 20001, reusedExistingPort: true })
    const ctx = makeCtx({ containerMode: 'existing', dockerContainer: 'bat-old' })
    await startDockerServerStep.run(ctx)

    expect(docker.pickServerPort).toHaveBeenCalledWith({ container: 'bat-old' })
    expect(docker.startContainer).toHaveBeenCalledWith('bat-old', { port: 20001 })
    expect(ctx.serverPort).toBe(20001)
  })

  it('a failed pick stops before anything is claimed or started', async () => {
    const docker = installElectronApi({ ok: true, token: 'tok' })
    docker.pickServerPort.mockResolvedValueOnce({
      ok: false,
      errorCode: 'docker-port-in-use',
      error: 'No free port between 9877 and 9976 on this machine (127.0.0.1) for the Docker container.',
    })
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })

    const error = await startDockerServerStep.run(ctx).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/No free port between 9877 and 9976/)
    expect((error as { code?: string }).code).toBe('docker-port-in-use')
    expect(docker.startContainer).not.toHaveBeenCalled()
    expect(ctx.state.dockerContainerCreatedByWizard).toBeUndefined()
  })

  it('connect-test and the written profile use the picked port', async () => {
    const docker = installElectronApi({ ok: true, token: 'tok' })
    const remote = { testConnection: vi.fn().mockResolvedValue({ ok: true, metadata: null }) }
    const profile = {
      create: vi.fn().mockResolvedValue({ id: 'p1' }),
      update: vi.fn().mockResolvedValue(true),
    }
    ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = { docker, remote, profile }
    const ctx = makeCtx({ containerMode: 'new', dockerContainer: 'bat-new' })
    ctx.serverPort = undefined
    ctx.fingerprint = 'fp'

    await startDockerServerStep.run(ctx)
    await connectTestStep.run(ctx)
    await writeProfileStep.run(ctx)

    expect(remote.testConnection).toHaveBeenCalledWith('localhost', 19877, 'tok', 'fp')
    expect(profile.create).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ remotePort: 19877 }))
    expect(profile.update).toHaveBeenCalledWith('p1', expect.objectContaining({ targetOS: 'docker-linux', remotePort: 19877 }))
  })
})
