/**
 * T0660 (BUG-161): step errors that used to reach the UI as their raw English
 * message now carry a stable `code` (+ i18n params) that the error registry
 * maps to translated copy. The message itself stays English (logs, raw
 * detail); the runner's recovery warnings and the Shell's error box follow
 * the UI language; choice option descriptions are shown.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  PRECONDITION_MISSING_CODE,
  readWizardErrorParams,
  resolveWizardError,
  wizardError,
  type WizardErrorPlatform,
} from '../error-mapper'
import { SetupWizardShell } from '../SetupWizardShell'
import { WizardRunner, type WizardContext, type WizardStep } from '../wizard-runner'
import { installDockerServerBundleStep } from '../steps/docker/install-server-bundle'
import { pickContainerStep } from '../steps/docker/pick-container'
import { startServerStep } from '../steps/ssh/start-server'
import { verifySshAuthStep } from '../steps/ssh/verify-auth'
import { pickWslDistroStep } from '../steps/wsl/pick-wsl-distro'
import { wslSystemdCheckStep } from '../steps/wsl/wsl-systemd-check'

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'test' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    ...overrides,
  }
}

function installElectronApi(api: Record<string, unknown>) {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
}

async function thrown(run: () => Promise<unknown>): Promise<Error & { code?: string }> {
  try {
    await run()
  } catch (error) {
    return error as Error & { code?: string }
  }
  throw new Error('expected a throw')
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW')
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await i18n.changeLanguage('en')
})

describe('wizardError (T0660)', () => {
  it('keeps the English message and carries code + params', () => {
    const error = wizardError('Docker container c1 reported unhealthy.', 'docker-container-unhealthy', { name: 'c1' })
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Docker container c1 reported unhealthy.')
    expect(error.code).toBe('docker-container-unhealthy')
    expect(readWizardErrorParams(error)).toEqual({ name: 'c1' })
    expect(readWizardErrorParams(new Error('x'))).toBeUndefined()
  })
})

// Every code a step throws since T0660 (plus the codes steps already carried
// without an entry) resolves to a registry entry on the platform that throws it.
const STEP_CODES: Array<[WizardErrorPlatform, string, string]> = [
  ['wsl', 'pick-wsl-distro', PRECONDITION_MISSING_CODE],
  ['ssh', 'start-server', PRECONDITION_MISSING_CODE],
  ['docker', 'start-server', PRECONDITION_MISSING_CODE],
  ['wsl', 'write-profile', 'wizard-profile-save-failed'],
  ['docker', 'write-profile', 'wizard-profile-save-failed'],
  ['ssh', 'connect-test', 'connect-test-failed'],
  ['wsl', 'install-server-bundle', 'server-bundle-install-failed'],
  ['ssh', 'install-server-bundle', 'server-bundle-distribute-failed'],
  ['docker', 'pick-container', 'docker-no-containers'],
  ['docker', 'pick-container', 'docker-container-names-exhausted'],
  ['docker', 'configure-mounts', 'docker-mounts-none'],
  ['docker', 'configure-mounts', 'docker-mounts-invalid'],
  ['docker', 'install-server-bundle', 'docker-inspect-failed'],
  ['docker', 'start-server', 'docker-container-not-owned'],
  ['docker', 'start-server', 'docker-start-failed'],
  ['docker', 'start-server', 'docker-health-unavailable'],
  ['docker', 'start-server', 'docker-container-unhealthy'],
  ['docker', 'start-server', 'docker-health-timeout'],
  ['wsl', 'detect-env', 'wsl-not-on-windows'],
  ['wsl', 'detect-env', 'wsl-not-installed'],
  ['wsl', 'pick-wsl-distro', 'wsl-requires-wsl2'],
  ['wsl', 'install-server-bundle', 'wsl-home-unresolved'],
  ['wsl', 'write-systemd-unit', 'wsl-unit-snapshot-failed'],
  ['wsl', 'write-systemd-unit', 'wsl-unit-write-failed'],
  ['wsl', 'write-systemd-unit', 'wsl-service-start-failed'],
  ['ssh', 'verify-ssh-auth', 'no-ssh'],
  ['ssh', 'verify-ssh-auth', 'host-key'],
  ['ssh', 'verify-ssh-auth', 'connect-timeout'],
  ['ssh', 'install-server-bundle', 'ssh-remote-path-invalid'],
  ['ssh', 'start-server', 'unit-write-failed'],
  ['ssh', 'start-server', 'enable-failed'],
  ['ssh', 'start-server', 'start-failed'],
  ['ssh', 'start-server', 'verify-failed'],
  ['ssh', 'fetch-fingerprint', 'ssh-tunnel-failed'],
  ['ssh', 'connect-test', 'ssh-tunnel-invalid-input'],
  ['ssh', 'fetch-fingerprint', 'fingerprint-mismatch'],
]

describe('step error codes map to translated copy (T0660)', () => {
  it.each(STEP_CODES)('%s %s %s has a registry entry', (platform, stepId, code) => {
    const mapped = resolveWizardError({ platform, stepId, errorCode: code, error: new Error('raw English') }, DEFAULT_WIZARD_ERROR_REGISTRY)
    expect(mapped.matchId).not.toBeNull()
    expect(mapped.rawError).toBe('raw English')
    expect(mapped.body).not.toBe('raw English')
  })

  it('interpolates params into the zh-TW title / body', () => {
    const mapped = resolveWizardError(
      {
        platform: 'docker',
        stepId: 'start-server',
        errorCode: 'docker-start-failed',
        params: { name: 'bat-server-x' },
        error: new Error('Error response from daemon: boom'),
      },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.title).toBe('無法啟動 Docker 容器')
    expect(mapped.body).toContain('Docker 無法啟動容器 bat-server-x。')
    expect(mapped.rawError).toBe('Error response from daemon: boom')
  })

  it('`context` selects the macOS / Windows variant and falls back to the plain body', () => {
    const resolve = (code: string, params?: Record<string, string>) => resolveWizardError(
      { platform: 'ssh', stepId: 'start-server', errorCode: code, params, error: new Error('x') },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    ).body
    expect(resolve('verify-failed', { context: 'darwin' })).toContain('launchctl list')
    expect(resolve('verify-failed')).toContain('systemctl --user status bat-server')
    expect(resolve('no-ssh', { context: 'win32' })).toContain('OpenSSH 用戶端')
    expect(resolve('no-ssh', { context: 'win32' })).toContain('選用功能')
    expect(resolve('no-ssh', { context: 'linux' })).toContain('sudo apt install openssh-client')
  })
})

describe('steps throw coded errors with unchanged English messages (T0660)', () => {
  it('wsl-systemd-check without a distro: precondition code', async () => {
    const error = await thrown(() => wslSystemdCheckStep.run(makeCtx()))
    expect(error.message).toBe('Select a WSL distro before checking systemd.')
    expect(error.code).toBe(PRECONDITION_MISSING_CODE)
  })

  it('pick-wsl-distro with only WSL 1 distros: wsl-requires-wsl2', async () => {
    installElectronApi({ wsl: { list: vi.fn().mockResolvedValue({ distros: [{ name: 'Old', version: 1, state: 'Stopped' }] }) } })
    const error = await thrown(() => pickWslDistroStep.run(makeCtx()))
    expect(error.message).toBe('BAT requires WSL2. Upgrade an existing distro to version 2 and retry.')
    expect(error.code).toBe('wsl-requires-wsl2')
  })

  it('pick-wsl-distro option descriptions follow the UI language', async () => {
    installElectronApi({
      wsl: {
        list: vi.fn().mockResolvedValue({
          distros: [
            { name: 'Ubuntu', version: 2, state: 'Running' },
            { name: 'Debian', version: 2, state: 'Stopped' },
          ],
        }),
      },
    })
    const requestChoice = vi.fn().mockResolvedValue('Debian')
    await pickWslDistroStep.run(makeCtx({ requestChoice }))
    expect(requestChoice.mock.calls[0][0].options.map((o: { description?: string }) => o.description)).toEqual([
      '執行中 • WSL2',
      '已停止 • WSL2',
    ])
  })

  it('pick-container "Use existing" without containers: docker-no-containers', async () => {
    installElectronApi({ docker: { listContainers: vi.fn().mockResolvedValue([]) } })
    const error = await thrown(() => pickContainerStep.run(makeCtx({
      targetOS: 'docker-linux',
      requestChoice: vi.fn().mockResolvedValue('existing'),
    })))
    expect(error.message).toBe('No Docker containers found. Create one first or switch to "Create new".')
    expect(error.code).toBe('docker-no-containers')
  })

  it('docker install-server-bundle inspect failure carries the container name', async () => {
    installElectronApi({ docker: { inspectContainer: vi.fn().mockResolvedValue({ image: '' }) } })
    const error = await thrown(() => installDockerServerBundleStep.run(makeCtx({
      targetOS: 'docker-linux',
      state: { containerMode: 'existing', dockerContainer: 'mine' },
    })))
    expect(error.message).toBe('Unable to inspect Docker container mine.')
    expect(error.code).toBe('docker-inspect-failed')
    expect(readWizardErrorParams(error)).toEqual({ name: 'mine' })
  })

  it('verify-ssh-auth no-ssh carries this computer\'s platform as context', async () => {
    installElectronApi({ ssh: { probeAuth: vi.fn().mockResolvedValue({ ok: false, errorCode: 'no-ssh' }) } })
    const error = await thrown(() => verifySshAuthStep.run(makeCtx({ targetOS: 'ssh-linux', state: { sshHost: 'h' } })))
    expect(error.code).toBe('no-ssh')
    expect(error.message.startsWith('no-ssh: ')).toBe(true)
    expect(readWizardErrorParams(error)).toEqual({ context: process.platform })
  })

  it('ssh start-server failure carries the main-process code; macOS adds context darwin', async () => {
    installElectronApi({
      ssh: {
        onStartProgress: vi.fn().mockReturnValue(() => undefined),
        startServer: vi.fn().mockResolvedValue({ ok: false, errorCode: 'verify-failed', error: 'nothing on port' }),
      },
    })
    const state = { sshHost: 'h', sshInstallPath: '~/.local/bat-server', sshServerHome: '/home/u' }
    const darwin = await thrown(() => startServerStep.run(makeCtx({ targetOS: 'ssh-darwin', state: { ...state } })))
    expect(darwin.code).toBe('verify-failed')
    expect(darwin.message).toMatch(/^verify-failed: Service appears to have started/)
    expect(readWizardErrorParams(darwin)).toEqual({ context: 'darwin' })
    const linux = await thrown(() => startServerStep.run(makeCtx({ targetOS: 'ssh-linux', state: { ...state } })))
    expect(readWizardErrorParams(linux)).toBeUndefined()
  })
})

describe('runner (T0660)', () => {
  it('passes the error params to the mapped error', async () => {
    const step: WizardStep = {
      id: 'start-server',
      title: 'Start Docker container',
      appliesTo: 'all',
      retryable: true,
      async run() {
        throw wizardError('Timed out waiting for Docker container c9 to become healthy.', 'docker-health-timeout', { name: 'c9' })
      },
    }
    let mappedBody = ''
    const runner = new WizardRunner([step], makeCtx({ targetOS: 'docker-linux' }), (snapshots) => {
      if (snapshots[0].mappedError) mappedBody = snapshots[0].mappedError.body
    })
    const run = runner.run().catch((error) => error)
    await waitFor(() => expect(mappedBody).not.toBe(''))
    expect(mappedBody).toContain('Docker 容器 c9 在 45 秒內沒有回報 healthy')
    await runner.cancel()
    expect(((await run) as Error).message).toBe('Wizard cancelled')
  })

  it('finalize warning names the step by its translated label', async () => {
    const step: WizardStep = {
      id: 'install-server-bundle',
      title: 'Install BAT server bundle',
      labelKey: 'wizard.wsl.step.installBundle.label',
      appliesTo: 'all',
      async run() {},
      async finalize() {
        throw new Error('rm failed')
      },
    }
    const ctx = makeCtx()
    await new WizardRunner([step], ctx).run()
    expect(ctx.warnings).toEqual([
      `「${i18n.t('wizard.wsl.step.installBundle.label')}」之後的清理沒有完成：rm failed`,
    ])
  })
})

describe('<SetupWizardShell> (T0660)', () => {
  it('shows option descriptions under their buttons without changing the button name', async () => {
    const step: WizardStep = {
      id: 'pick-container',
      title: 'pick',
      appliesTo: 'all',
      kind: 'input',
      async run(ctx) {
        await ctx.requestChoice!({
          stepId: 'pick-container',
          title: 'Pick',
          options: [
            { label: 'Create new', value: 'new', description: 'BAT creates a container.' },
            { label: 'Use existing', value: 'existing' },
          ],
        })
      },
    }
    render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)
    const button = await screen.findByRole('button', { name: 'Create new' })
    const description = screen.getByText('BAT creates a container.')
    expect(button.getAttribute('aria-describedby')).toBe(description.id)
    expect(description.classList.contains('bat-wizard-prompt-description')).toBe(true)
    expect(screen.getByRole('button', { name: 'Use existing' }).hasAttribute('aria-describedby')).toBe(false)
  })

  it('a mapped failure shows its translated title in the Stepper row; cancel shows wizard.cancelled', async () => {
    const step: WizardStep = {
      id: 'pick-wsl-distro',
      title: 'Select WSL distro',
      appliesTo: 'all',
      retryable: true,
      async run() {
        throw wizardError('BAT requires WSL2. Upgrade an existing distro to version 2 and retry.', 'wsl-requires-wsl2')
      },
    }
    const { container } = render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)
    await waitFor(() => {
      expect(container.querySelector('.bat-stepper-error-message')?.textContent).toBe('需要 WSL2')
    })
    expect(screen.queryByText('BAT requires WSL2. Upgrade an existing distro to version 2 and retry.')).toBeNull()
    fireEvent.click(container.querySelector('[data-action-kind="cancel"]') as HTMLButtonElement)
    expect(await screen.findByText(i18n.t('wizard.cancelled'))).toBeInTheDocument()
    expect(screen.queryByText('Wizard cancelled')).toBeNull()
  })

  it('a non-retryable coded failure shows translated copy in the error box', async () => {
    const step: WizardStep = {
      id: 'write-profile',
      title: 'Write profile',
      appliesTo: 'all',
      retryable: false,
      async run() {
        throw wizardError('Failed to persist WSL profile metadata.', 'wizard-profile-save-failed')
      },
    }
    const { container } = render(<SetupWizardShell steps={[step]} ctx={makeCtx()} />)
    await waitFor(() => expect(container.querySelector('.bat-wizard-error-box')).not.toBeNull())
    const box = container.querySelector('.bat-wizard-error-box') as HTMLElement
    expect(box.textContent).toContain('無法儲存遠端配置')
    expect(box.textContent).not.toContain('Failed to persist WSL profile metadata.')
  })
})
