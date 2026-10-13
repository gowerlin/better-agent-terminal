/**
 * T0331 (PLAN-032 Sprint 2): WizardErrorMapper unit tests.
 *
 * Coverage matrix:
 *  - Stage 1 errorCode hit (ssh permission-denied)
 *  - Stage 2 step-scoped regex hit (docker detect-env)
 *  - Stage 3 platform-wide regex hit (custom registry without stepIds)
 *  - Stage 4 fallback (no entry matches)
 *  - Resolver short-circuit (stage 1 win does not consult stage 2/3)
 *  - targetOSToErrorPlatform mapping for each WizardTargetOS value
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import i18n from '../../../i18n'
import en from '../../../locales/en.json'
import zhTW from '../../../locales/zh-TW.json'
import zhCN from '../../../locales/zh-CN.json'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  FALLBACK_MESSAGE_KEY,
  resolveWizardError,
  targetOSToErrorPlatform,
  type WizardErrorContext,
  type WizardErrorMatch,
} from '../error-mapper'

// T0507: messages resolve through i18next; the zh-TW assertions below lock the
// copy that the removed MESSAGE_DICT used to hard-code.
beforeAll(async () => {
  await i18n.changeLanguage('zh-TW')
})

afterAll(async () => {
  await i18n.changeLanguage('en')
})

function makeCtx(overrides: Partial<WizardErrorContext>): WizardErrorContext {
  return {
    platform: 'ssh',
    stepId: 'detect-env',
    error: new Error('default error'),
    ...overrides,
  }
}

describe('targetOSToErrorPlatform', () => {
  it('maps wsl-linux to wsl', () => {
    expect(targetOSToErrorPlatform('wsl-linux')).toBe('wsl')
  })
  it('maps docker-linux to docker', () => {
    expect(targetOSToErrorPlatform('docker-linux')).toBe('docker')
  })
  it('maps ssh-linux and ssh-darwin to ssh', () => {
    expect(targetOSToErrorPlatform('ssh-linux')).toBe('ssh')
    expect(targetOSToErrorPlatform('ssh-darwin')).toBe('ssh')
  })
  it('maps local to local', () => {
    expect(targetOSToErrorPlatform('local')).toBe('local')
  })
})

describe('resolveWizardError - DEFAULT_WIZARD_ERROR_REGISTRY', () => {
  it('Stage 1: exact errorCode match (ssh permission-denied)', () => {
    const result = resolveWizardError(
      makeCtx({
        platform: 'ssh',
        stepId: 'verify-ssh-auth',
        errorCode: 'permission-denied',
        error: new Error('Permission denied (publickey).'),
      }),
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(result.matchId).toBe('ssh-permission-denied')
    expect(result.title).toBe('SSH 認證失敗')
    expect(result.detailMode).toBe('hidden-by-default')
    expect(result.rawError).toBe('Permission denied (publickey).')
  })

  it('Stage 2: step-scoped regex match (docker detect-env)', () => {
    const result = resolveWizardError(
      makeCtx({
        platform: 'docker',
        stepId: 'detect-env',
        error: new Error('error during connect: open //./pipe/docker_engine: The system cannot find the file specified.'),
      }),
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(result.matchId).toBe('docker-daemon-unavailable')
    expect(result.title).toBe('未偵測到 Docker daemon')
    expect(result.detailMode).toBe('append-raw')
  })

  it('Stage 2 (WSL linger): step-scoped regex match', () => {
    const result = resolveWizardError(
      makeCtx({
        platform: 'wsl',
        stepId: 'write-systemd-unit',
        error: new Error('Could not enable linger: No such device or address'),
      }),
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(result.matchId).toBe('wsl-linger-failure')
    expect(result.title).toBe('無法自動啟用 systemd lingering')
  })

  it('Stage 4: fallback when nothing matches', () => {
    const rawMessage = 'Some unexpected error from the void'
    const result = resolveWizardError(
      makeCtx({
        platform: 'local',
        stepId: 'no-such-step',
        error: new Error(rawMessage),
      }),
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(result.matchId).toBeNull()
    expect(result.title).toBe('步驟發生錯誤')
    expect(result.body).toBe(rawMessage)
    expect(result.rawError).toBe(rawMessage)
    expect(result.detailMode).toBe('append-raw')
    // T0333: fallback now ships baseline retry/skip/cancel actions.
    expect(result.actions.map((a) => a.kind)).toEqual(['retry', 'skip', 'cancel'])
  })

  it('Stage 4: docker step regex but wrong stepId falls through to fallback', () => {
    // docker-daemon-unavailable is stepId-scoped to 'detect-env'; using a
    // different stepId should NOT match (no platform-wide entry exists for
    // this pattern), so we land on fallback.
    const result = resolveWizardError(
      makeCtx({
        platform: 'docker',
        stepId: 'install-server',
        error: new Error('error during connect: pipe/docker_engine'),
      }),
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(result.matchId).toBeNull()
    expect(result.title).toBe('步驟發生錯誤')
  })
})

describe('resolveWizardError - custom registry', () => {
  it('Stage 3: platform-wide regex match (entry without stepIds)', () => {
    const customRegistry: WizardErrorMatch[] = [
      {
        id: 'wsl-generic-network',
        platforms: ['wsl'],
        // No stepIds -> stage-3 candidate.
        patterns: [/network unreachable/i],
        messageKey: 'wsl.network.unreachable',
        detailMode: 'append-raw',
      },
    ]
    const result = resolveWizardError(
      makeCtx({
        platform: 'wsl',
        stepId: 'connect-test',
        error: new Error('curl: (7) Network unreachable'),
      }),
      customRegistry,
    )
    expect(result.matchId).toBe('wsl-generic-network')
    // messageKey has no locale entry -> lookupMessage falls back to
    // FALLBACK_MESSAGE_KEY, so title is the generic "步驟發生錯誤".
    expect(result.title).toBe('步驟發生錯誤')
  })

  it('Stage 3: platforms === all matches any platform', () => {
    const customRegistry: WizardErrorMatch[] = [
      {
        id: 'universal-timeout',
        platforms: 'all',
        patterns: [/etimedout/i],
        messageKey: 'universal.timeout',
      },
    ]
    const result = resolveWizardError(
      makeCtx({
        platform: 'docker',
        stepId: 'install-server',
        error: new Error('connect ETIMEDOUT 1.2.3.4:443'),
      }),
      customRegistry,
    )
    expect(result.matchId).toBe('universal-timeout')
  })

  it('Resolver short-circuits: stage 1 win prevents stage 2/3 evaluation', () => {
    let stage2Visited = 0
    const customRegistry: WizardErrorMatch[] = [
      {
        id: 'code-hit',
        platforms: ['ssh'],
        errorCodes: ['my-code'],
        messageKey: 'noop',
      },
      {
        id: 'regex-trap',
        platforms: ['ssh'],
        stepIds: ['verify-ssh-auth'],
        // RegExp with a side-effect via .exec instrumentation.
        patterns: [
          new Proxy(/.*/i, {
            get(target, prop, receiver) {
              if (prop === 'test') {
                stage2Visited += 1
              }
              return Reflect.get(target, prop, receiver)
            },
          }) as RegExp,
        ],
        messageKey: 'noop',
      },
    ]
    const result = resolveWizardError(
      makeCtx({
        platform: 'ssh',
        stepId: 'verify-ssh-auth',
        errorCode: 'my-code',
        error: new Error('whatever'),
      }),
      customRegistry,
    )
    expect(result.matchId).toBe('code-hit')
    expect(stage2Visited).toBe(0)
  })

  it('errorCode set but no entry has it: falls through to regex stages', () => {
    const customRegistry: WizardErrorMatch[] = [
      {
        id: 'regex-only',
        platforms: ['ssh'],
        stepIds: ['verify-ssh-auth'],
        patterns: [/host key verification failed/i],
        messageKey: 'ssh.host-key',
      },
    ]
    const result = resolveWizardError(
      makeCtx({
        platform: 'ssh',
        stepId: 'verify-ssh-auth',
        errorCode: 'unknown-code',
        error: new Error('Host key verification failed.'),
      }),
      customRegistry,
    )
    expect(result.matchId).toBe('regex-only')
  })

  it('detailMode defaults to append-raw when entry omits it', () => {
    const customRegistry: WizardErrorMatch[] = [
      {
        id: 'no-detail-mode',
        platforms: 'all',
        patterns: [/.+/],
        messageKey: 'whatever',
      },
    ]
    const result = resolveWizardError(
      makeCtx({ error: new Error('boom') }),
      customRegistry,
    )
    expect(result.matchId).toBe('no-detail-mode')
    expect(result.detailMode).toBe('append-raw')
  })
})

describe('DEFAULT_WIZARD_ERROR_REGISTRY actions (T0333)', () => {
  it('docker-daemon-unavailable carries open-link + fixed-and-retry + cancel', () => {
    const entry = DEFAULT_WIZARD_ERROR_REGISTRY.find((e) => e.id === 'docker-daemon-unavailable')!
    expect(entry.actions?.map((a) => a.kind)).toEqual(['open-link', 'fixed-and-retry', 'cancel'])
    const link = entry.actions?.find((a) => a.kind === 'open-link') as { href: string } | undefined
    expect(link?.href).toMatch(/docker\.com/)
  })

  it('wsl-linger-failure carries fixed-and-retry + skip + cancel', () => {
    const entry = DEFAULT_WIZARD_ERROR_REGISTRY.find((e) => e.id === 'wsl-linger-failure')!
    expect(entry.actions?.map((a) => a.kind)).toEqual(['fixed-and-retry', 'skip', 'cancel'])
  })

  it('ssh-permission-denied carries edit-config (with targetStepId) + retry + cancel', () => {
    const entry = DEFAULT_WIZARD_ERROR_REGISTRY.find((e) => e.id === 'ssh-permission-denied')!
    expect(entry.actions?.map((a) => a.kind)).toEqual(['edit-config', 'retry', 'cancel'])
    const editAction = entry.actions?.find((a) => a.kind === 'edit-config') as { targetStepId?: string } | undefined
    expect(editAction?.targetStepId).toBe('configure-ssh-host')
  })
})

// =====================================================================
// T0507: every registry message and action label is an i18n key present in
// all three locales, and the resolver follows the UI language.
// =====================================================================

const LOCALES = { en, 'zh-TW': zhTW, 'zh-CN': zhCN } as const
type Lng = keyof typeof LOCALES
const LNGS = Object.keys(LOCALES) as Lng[]

function getNested(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment]
    }
    return undefined
  }, obj)
}

function expectNonEmptyString(lng: Lng, key: string): string {
  const value = getNested(LOCALES[lng], key)
  expect(value, `missing "${key}" in ${lng}.json`).toBeTypeOf('string')
  expect((value as string).length, `empty "${key}" in ${lng}.json`).toBeGreaterThan(0)
  return value as string
}

describe('DEFAULT_WIZARD_ERROR_REGISTRY i18n completeness (T0507)', () => {
  const entries = DEFAULT_WIZARD_ERROR_REGISTRY.map((e) => [e.id, e] as const)

  it.each(entries)('%s: title and body exist in en / zh-TW / zh-CN', (_id, entry) => {
    for (const lng of LNGS) {
      expectNonEmptyString(lng, `${entry.messageKey}.title`)
      expectNonEmptyString(lng, `${entry.messageKey}.body`)
    }
  })

  it.each(entries)('%s: every action label is an i18n key present in all locales', (_id, entry) => {
    for (const action of entry.actions ?? []) {
      // Literal labels never follow the UI language; registry entries must use labelKey.
      expect(action.label, `${entry.id} ${action.kind} has a literal label`).toBeUndefined()
      if (action.labelKey === undefined) continue
      for (const lng of LNGS) expectNonEmptyString(lng, action.labelKey)
    }
  })

  it('fallback title exists in en / zh-TW / zh-CN', () => {
    for (const lng of LNGS) expectNonEmptyString(lng, `${FALLBACK_MESSAGE_KEY}.title`)
  })
})

describe('resolveWizardError follows the UI language (T0507)', () => {
  afterAll(async () => {
    await i18n.changeLanguage('zh-TW')
  })

  const permissionDenied = makeCtx({
    platform: 'ssh',
    stepId: 'verify-ssh-auth',
    errorCode: 'permission-denied',
    error: new Error('Permission denied (publickey).'),
  })

  it.each([
    ['en', 'SSH authentication failed', 'Step failed'],
    ['zh-TW', 'SSH 認證失敗', '步驟發生錯誤'],
    ['zh-CN', 'SSH 认证失败', '步骤发生错误'],
  ] as const)('%s: mapped title and fallback title', async (lng, mappedTitle, fallbackTitle) => {
    await i18n.changeLanguage(lng)
    expect(resolveWizardError(permissionDenied, DEFAULT_WIZARD_ERROR_REGISTRY).title).toBe(mappedTitle)
    const fallback = resolveWizardError(
      makeCtx({ platform: 'local', stepId: 'no-such-step', error: new Error('boom') }),
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(fallback.title).toBe(fallbackTitle)
    expect(fallback.body).toBe('boom')
  })

  it.each(LNGS)('%s: every entry resolves its own locale title and body', async (lng) => {
    await i18n.changeLanguage(lng)
    for (const entry of DEFAULT_WIZARD_ERROR_REGISTRY) {
      const result = resolveWizardError(
        {
          platform: entry.platforms === 'all' ? 'local' : entry.platforms[0],
          stepId: entry.stepIds?.[0] ?? 'any-step',
          errorCode: entry.errorCodes?.[0],
          error: new Error('raw'),
        },
        [entry],
      )
      expect(result.matchId).toBe(entry.id)
      expect(result.title).toBe(getNested(LOCALES[lng], `${entry.messageKey}.title`))
      expect(result.body).toBe(getNested(LOCALES[lng], `${entry.messageKey}.body`))
    }
  })
})
