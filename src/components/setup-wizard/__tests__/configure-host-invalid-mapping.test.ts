/**
 * T0506: `configure-host-invalid` (a typed host from T0502 or an
 * ~/.ssh/config alias from T0505 that fails the ssh-name whitelist) maps to
 * its own registry entry instead of the generic fallback. The message comes
 * from wizard.ssh.error.hostInvalid in all three locales.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import { configureSshHostStep } from '../steps/ssh/configure-host'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  resolveWizardError,
} from '../error-mapper'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
} from '../wizard-runner'

const ALIAS_MESSAGE =
  'SSH alias "-oProxyCommand=calc" cannot be used. Aliases may only use letters, digits, ".", "_" or "-" and must not start with "-".'
const HOST_MESSAGE =
  'SSH host "host name" is invalid. Use host, user@host or user@host:port with letters, digits, ".", "_" or "-".'

function resolve(message: string, errorCode?: string) {
  return resolveWizardError(
    { platform: 'ssh', stepId: 'configure-ssh-host', errorCode, error: new Error(message) },
    DEFAULT_WIZARD_ERROR_REGISTRY,
  )
}

function installListHosts(hosts: string[]): void {
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: { ssh: { listHosts: vi.fn(async () => hosts) } },
  }
}

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 'test' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    ...overrides,
  }
}

function waitForFailed(runner: WizardRunner): Promise<void> {
  return new Promise((done) => {
    const tick = () => {
      if (runner.getSnapshots()[0].status === WizardStepStatus.Failed) done()
      else setTimeout(tick, 5)
    }
    tick()
  })
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('ssh-configure-host-invalid mapping (T0506)', () => {
  it('errorCode configure-host-invalid hits the entry with the localized message and edit-config + cancel', () => {
    const mapped = resolve(ALIAS_MESSAGE, 'configure-host-invalid')
    expect(mapped.matchId).toBe('ssh-configure-host-invalid')
    expect(mapped.title).toBe(i18n.t('wizard.ssh.error.hostInvalid.title'))
    expect(mapped.title).toBe('Invalid SSH host')
    expect(mapped.body).toBe(i18n.t('wizard.ssh.error.hostInvalid.body'))
    expect(mapped.rawError).toBe(ALIAS_MESSAGE)
    expect(mapped.detailMode).toBe('hidden-by-default')
    expect(mapped.actions).toEqual([
      { kind: 'edit-config', targetStepId: 'configure-ssh-host' },
      { kind: 'cancel' },
    ])
  })

  it.each([
    ['alias', ALIAS_MESSAGE],
    ['typed host', HOST_MESSAGE],
  ])('without an errorCode the %s message still matches by pattern', (_label, message) => {
    expect(resolve(message).matchId).toBe('ssh-configure-host-invalid')
  })

  it('does not take over the empty-host error', () => {
    const mapped = resolve('SSH host is required (pick an alias from ~/.ssh/config or type host).', 'configure-host-empty')
    expect(mapped.matchId).toBe('ssh-configure-host-empty')
  })

  it('only applies to the ssh platform', () => {
    const mapped = resolveWizardError(
      { platform: 'wsl', stepId: 'configure-ssh-host', errorCode: 'configure-host-invalid', error: new Error(ALIAS_MESSAGE) },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(mapped.matchId).toBeNull()
  })

  it.each([
    ['zh-TW', 'SSH 主機名稱無效'],
    ['zh-CN', 'SSH 主机名无效'],
  ])('follows the UI language (%s)', async (lng, title) => {
    await i18n.changeLanguage(lng)
    const mapped = resolve(ALIAS_MESSAGE, 'configure-host-invalid')
    expect(mapped.title).toBe(title)
    expect(mapped.body).toContain('~/.ssh/config')
  })

  it('a rejected alias fails the step with the mapped entry, and retry asks again', async () => {
    installListHosts(['-oProxyCommand=calc', 'devbox'])
    const requestChoice = vi.fn()
      .mockResolvedValueOnce('-oProxyCommand=calc')
      .mockResolvedValueOnce('devbox')
    const ctx = makeCtx({ requestChoice })
    const runner = new WizardRunner([configureSshHostStep], ctx)
    const run = runner.run()

    await waitForFailed(runner)
    expect(runner.getSnapshots()[0].mappedError?.matchId).toBe('ssh-configure-host-invalid')
    expect(ctx.state).not.toHaveProperty('sshAlias')

    await runner.retryCurrentStep()
    await run
    expect(requestChoice).toHaveBeenCalledTimes(2)
    expect((ctx.state as { sshHost?: string }).sshHost).toBe('devbox')
  })

  it('a rejected typed host fails the step with the mapped entry', async () => {
    installListHosts([])
    const requestText = vi.fn().mockResolvedValueOnce('deploy@host name')
    const ctx = makeCtx({ requestText })
    const runner = new WizardRunner([configureSshHostStep], ctx)
    const run = runner.run()
    run.catch(() => undefined)

    await waitForFailed(runner)
    expect(runner.getSnapshots()[0].mappedError?.matchId).toBe('ssh-configure-host-invalid')
    await runner.cancel()
  })
})
