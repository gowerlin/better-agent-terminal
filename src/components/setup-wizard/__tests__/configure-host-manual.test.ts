/**
 * T0502: configure-ssh-host takes a typed host through ctx.requestText.
 * Before T0502 the only input was the ~/.ssh/config alias picker, so with no
 * alias the step could only fail with "pick an alias ... or type host" and
 * there was nowhere to type. Now:
 *   - no alias            -> text prompt directly
 *   - aliases + requestText -> alias list plus "Enter host manually…"
 *   - no requestText      -> unchanged (alias list only)
 * A typed value is `host`, `user@host`, `host:port` or `user@host:port`,
 * whitelisted against /^[a-zA-Z0-9._-]+$/ (no leading `-`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardChoiceRequest,
  type WizardContext,
  type WizardStep,
  type WizardTextRequest,
} from '../wizard-runner'
import { configureSshHostStep, parseManualSshHost } from '../steps/ssh/configure-host'
import { DEFAULT_WIZARD_ERROR_REGISTRY, resolveWizardError } from '../error-mapper'
import en from '../../../locales/en.json'
import zhTW from '../../../locales/zh-TW.json'
import zhCN from '../../../locales/zh-CN.json'

function installSsh(hostLists: string[][]) {
  const ssh = { listHosts: vi.fn(async () => (hostLists.length > 1 ? hostLists.shift()! : hostLists[0])) }
  ;(globalThis as unknown as { window: unknown }).window = { electronAPI: { ssh } }
  return ssh
}

function queue<R, T>(answers: Array<T | null>) {
  const requests: R[] = []
  const fn = vi.fn(async (request: R) => {
    requests.push(request)
    return answers.length > 0 ? answers.shift()! : null
  })
  return { fn, requests }
}

function sshCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 'Dev Box' },
    warnings: [],
    state: { sshTunnelMode: 'tunnel' },
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

function failingStep(id: string): WizardStep {
  let failures = 1
  return {
    id,
    title: id,
    appliesTo: 'all',
    async run() {
      if (failures > 0) {
        failures -= 1
        throw new Error(`${id} broke`)
      }
    },
  }
}

const MANUAL_OPTION_KEY = 'wizard.ssh.manualHost.option'

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
  vi.restoreAllMocks()
})

describe('parseManualSshHost (T0502)', () => {
  it.each([
    ['build.example.com', { host: 'build.example.com', user: undefined }],
    ['  build.example.com  ', { host: 'build.example.com', user: undefined }],
    ['deploy@build.example.com', { host: 'build.example.com', user: 'deploy' }],
    ['build-01:2222', { host: 'build-01', user: undefined, port: 2222 }],
    ['deploy_user@10.0.0.5:22', { host: '10.0.0.5', user: 'deploy_user', port: 22 }],
  ])('accepts %j', (raw, expected) => {
    expect(parseManualSshHost(raw)).toEqual(expected)
  })

  it.each([
    '',
    '   ',
    'build example.com',
    '-oProxyCommand=calc',
    'deploy@-oProxyCommand=calc',
    '-deploy@host',
    'host;rm',
    'host$(id)',
    'a@b@c',
    '@host',
    'user@',
    'host:',
    'host:0',
    'host:65536',
    'host:123456',
    'host:22:22',
    '[::1]',
    'fe80::1',
    'host\nother',
    `${'a'.repeat(254)}`,
    `${'u'.repeat(65)}@host`,
  ])('rejects %j', (raw) => {
    expect(parseManualSshHost(raw)).toBeNull()
  })
})

describe('configure-ssh-host: no alias -> typed host (T0502)', () => {
  it('asks for a typed host, stores host / user / port and passes through awaiting-input', async () => {
    installSsh([[]])
    const choice = queue<WizardChoiceRequest, string>([])
    const text = queue<WizardTextRequest, string>(['deploy@build.example.com:2222'])
    const ctx = sshCtx({ requestChoice: choice.fn, requestText: text.fn })
    const statuses: WizardStepStatus[] = []
    const runner = new WizardRunner([configureSshHostStep], ctx, (snaps) => statuses.push(snaps[0].status))

    await runner.run()

    expect(choice.fn).not.toHaveBeenCalled()
    expect(text.fn).toHaveBeenCalledTimes(1)
    expect(text.requests[0]).toMatchObject({
      stepId: 'configure-ssh-host',
      titleKey: 'wizard.ssh.manualHost.title',
      descriptionKey: 'wizard.ssh.manualHost.description',
      initialValue: '',
    })
    expect(statuses).toContain(WizardStepStatus.AwaitingInput)
    expect(statuses[statuses.length - 1]).toBe(WizardStepStatus.Succeeded)
    expect(ctx.state).toMatchObject({ sshHost: 'build.example.com', sshUser: 'deploy', sshPort: 2222, sshHostManual: true })
    expect(ctx.state.sshAlias).toBeUndefined()
    expect(ctx.profileDraft).toMatchObject({ sshHost: 'build.example.com', sshUser: 'deploy', sshPort: 2222, sshAlias: undefined })
    // The runner restores the unwrapped function after the step.
    expect(ctx.requestText).toBe(text.fn)
  })

  it('a bare host leaves user empty and port at the default', async () => {
    installSsh([[]])
    const text = queue<WizardTextRequest, string>(['10.0.0.5'])
    const ctx = sshCtx({ requestText: text.fn })

    await new WizardRunner([configureSshHostStep], ctx).run()

    expect(ctx.state).toMatchObject({ sshHost: '10.0.0.5', sshUser: '' })
    expect(ctx.state.sshPort).toBeUndefined()
  })

  it('validate() hands the Shell an i18n error key for invalid input and null for valid input', async () => {
    installSsh([[]])
    const text = queue<WizardTextRequest, string>(['build.example.com'])
    const ctx = sshCtx({ requestText: text.fn })

    await new WizardRunner([configureSshHostStep], ctx).run()

    const validate = text.requests[0].validate!
    expect(validate('deploy@build.example.com:22')).toBeNull()
    expect(validate('-oProxyCommand=calc')).toBe('wizard.ssh.manualHost.invalid')
    expect(validate('host;rm -rf ~')).toBe('wizard.ssh.manualHost.invalid')
  })

  it('an invalid value that reaches the step is rejected (configure-host-invalid) and nothing is stored; retry asks again', async () => {
    installSsh([[]])
    const text = queue<WizardTextRequest, string>(['-oProxyCommand=calc', 'build.example.com'])
    const ctx = sshCtx({ requestText: text.fn })
    const runner = new WizardRunner([configureSshHostStep], ctx)
    const run = runner.run()

    await waitForStatus(runner, 'configure-ssh-host', WizardStepStatus.Failed)
    const failed = runner.getSnapshots()[0]
    expect(failed.error).toMatch(/is invalid/)
    expect(ctx.state.sshHost).toBeUndefined()
    expect(ctx.profileDraft.sshHost).toBeUndefined()

    await runner.retryCurrentStep()
    await run

    expect(text.fn).toHaveBeenCalledTimes(2)
    expect(ctx.state.sshHost).toBe('build.example.com')
  })

  it('the rejection carries code configure-host-invalid', async () => {
    installSsh([[]])
    const text = queue<WizardTextRequest, string>(['deploy@host name'])
    const ctx = sshCtx({ requestText: text.fn })

    await expect(configureSshHostStep.run(ctx)).rejects.toMatchObject({ code: 'configure-host-invalid' })
    expect(ctx.state.sshHost).toBeUndefined()
  })

  it('cancelling the prompt fails with the mapped configure-host-empty error', async () => {
    installSsh([[]])
    const text = queue<WizardTextRequest, string>([null])
    const ctx = sshCtx({ requestText: text.fn })
    const runner = new WizardRunner([configureSshHostStep], ctx)
    const run = runner.run()
    run.catch(() => undefined)

    await waitForStatus(runner, 'configure-ssh-host', WizardStepStatus.Failed)
    expect(runner.getSnapshots()[0].mappedError?.matchId).toBe('ssh-configure-host-empty')
    await runner.cancel()
  })

  it('the empty-host error names typing as an option, which the UI now offers', () => {
    const mapped = resolveWizardError(
      {
        platform: 'ssh',
        stepId: 'configure-ssh-host',
        errorCode: 'configure-host-empty',
        error: new Error('SSH host is required (pick an alias from ~/.ssh/config or type host).'),
      },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.body).toMatch(/手動輸入/)
  })
})

describe('configure-ssh-host: aliases present (T0502)', () => {
  it('with requestText the alias list ends with "Enter host manually…"; picking an alias behaves as before', async () => {
    installSsh([['alpha', 'beta']])
    const choice = queue<WizardChoiceRequest, string>(['beta'])
    const text = queue<WizardTextRequest, string>([])
    const ctx = sshCtx({ requestChoice: choice.fn, requestText: text.fn })

    await new WizardRunner([configureSshHostStep], ctx).run()

    const options = choice.requests[0].options
    expect(options.slice(0, 2).map((o) => o.value)).toEqual(['alpha', 'beta'])
    expect(options).toHaveLength(3)
    expect(options[2].labelKey).toBe(MANUAL_OPTION_KEY)
    expect(text.fn).not.toHaveBeenCalled()
    expect(ctx.state).toMatchObject({ sshAlias: 'beta', sshHost: 'beta', sshUser: '' })
    expect(ctx.state.sshPort).toBeUndefined()
    expect(ctx.profileDraft.sshHost).toBe('beta')
  })

  it('without requestText the options are exactly the aliases (unchanged)', async () => {
    installSsh([['alpha', 'beta']])
    const choice = queue<WizardChoiceRequest, string>(['alpha'])
    const ctx = sshCtx({ requestChoice: choice.fn })

    await new WizardRunner([configureSshHostStep], ctx).run()

    expect(choice.requests[0].options.map((o) => o.value)).toEqual(['alpha', 'beta'])
    expect(ctx.state.sshHost).toBe('alpha')
  })

  it('choosing "Enter host manually…" opens the text prompt and stores the typed host', async () => {
    installSsh([['alpha']])
    const choice = queue<WizardChoiceRequest, string>([])
    choice.fn.mockImplementationOnce(async (request: WizardChoiceRequest) => {
      choice.requests.push(request)
      return request.options.find((o) => o.labelKey === MANUAL_OPTION_KEY)!.value
    })
    const text = queue<WizardTextRequest, string>(['ops@10.1.2.3:2200'])
    const ctx = sshCtx({ requestChoice: choice.fn, requestText: text.fn })

    await new WizardRunner([configureSshHostStep], ctx).run()

    expect(text.fn).toHaveBeenCalledTimes(1)
    expect(ctx.state).toMatchObject({ sshHost: '10.1.2.3', sshUser: 'ops', sshPort: 2200 })
    expect(ctx.state.sshAlias).toBeUndefined()
  })
})

describe('configure-ssh-host: jump back still re-asks (T0500 + T0502)', () => {
  it('typed host, then jump back to a new alias: alias replaces it and the typed user / port are dropped', async () => {
    installSsh([[], ['new-box']])
    const choice = queue<WizardChoiceRequest, string>(['new-box'])
    const text = queue<WizardTextRequest, string>(['deploy@build.example.com:2222'])
    const ctx = sshCtx({ requestChoice: choice.fn, requestText: text.fn })
    const runner = new WizardRunner([configureSshHostStep, failingStep('verify-ssh-auth')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'verify-ssh-auth', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(choice.requests[0].options.map((o) => o.value).slice(0, 1)).toEqual(['new-box'])
    expect(ctx.state).toMatchObject({ sshAlias: 'new-box', sshHost: 'new-box', sshUser: '' })
    expect(ctx.state.sshPort).toBeUndefined()
    expect(ctx.state.sshHostManual).toBeUndefined()
    expect(ctx.state.sshHostEditRequested).toBeUndefined()
    expect(ctx.profileDraft).toMatchObject({ sshHost: 'new-box', sshPort: undefined })
  })

  it('no aliases: jump back shows the stored host for editing and stores the new value', async () => {
    installSsh([[]])
    const text = queue<WizardTextRequest, string>(['deploy@build.example.com:2222', 'deploy@build2.example.com'])
    const ctx = sshCtx({ requestText: text.fn })
    const runner = new WizardRunner([configureSshHostStep, failingStep('verify-ssh-auth')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'verify-ssh-auth', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(text.fn).toHaveBeenCalledTimes(2)
    expect(text.requests[1].initialValue).toBe('deploy@build.example.com:2222')
    expect(ctx.state).toMatchObject({ sshHost: 'build2.example.com', sshUser: 'deploy' })
    expect(ctx.state.sshPort).toBeUndefined()
    expect(ctx.state.sshHostEditRequested).toBeUndefined()
  })

  it('no aliases: cancelling the prompt after a jump back keeps the stored host', async () => {
    installSsh([[]])
    const text = queue<WizardTextRequest, string>(['build.example.com', null])
    const ctx = sshCtx({ requestText: text.fn })
    const runner = new WizardRunner([configureSshHostStep, failingStep('verify-ssh-auth')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'verify-ssh-auth', WizardStepStatus.Failed)

    await runner.jumpToStep(0)
    await run

    expect(ctx.state.sshHost).toBe('build.example.com')
    expect(ctx.logger.info).toHaveBeenCalledWith('No SSH host entered; keeping SSH host build.example.com.')
  })

  it('retry of a later step does not re-ask', async () => {
    installSsh([[]])
    const text = queue<WizardTextRequest, string>(['build.example.com'])
    const ctx = sshCtx({ requestText: text.fn })
    const runner = new WizardRunner([configureSshHostStep, failingStep('verify-ssh-auth')], ctx)
    const run = runner.run()
    await waitForStatus(runner, 'verify-ssh-auth', WizardStepStatus.Failed)

    await runner.retryCurrentStep()
    await run

    expect(text.fn).toHaveBeenCalledTimes(1)
  })
})

describe('manual host i18n keys (T0502)', () => {
  const KEYS = [
    ['wizard', 'ssh', 'manualHost', 'option'],
    ['wizard', 'ssh', 'manualHost', 'title'],
    ['wizard', 'ssh', 'manualHost', 'description'],
    ['wizard', 'ssh', 'manualHost', 'invalid'],
    ['wizard', 'action', 'submitText'],
    ['wizard', 'action', 'cancelText'],
  ]

  it.each([['en', en], ['zh-TW', zhTW], ['zh-CN', zhCN]] as const)('%s has every key', (_lang, locale) => {
    for (const path of KEYS) {
      const value = path.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], locale)
      expect(typeof value === 'string' && value.length > 0, path.join('.')).toBe(true)
    }
  })
})
