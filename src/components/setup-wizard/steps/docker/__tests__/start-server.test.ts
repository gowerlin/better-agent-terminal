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
import { startDockerServerStep } from '../start-server'
import type { WizardContext } from '../../../wizard-runner'

type Exposure = { ok: boolean; exposed: boolean; hostIps: string[]; legacyImage: boolean }

function installElectronApi(startResult: { ok: boolean; token?: string; error?: string; exposure?: Exposure }) {
  const docker = {
    startContainer: vi.fn().mockResolvedValue(startResult),
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
