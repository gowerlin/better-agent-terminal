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
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WIZARD_ERROR_REGISTRY,
  resolveWizardError,
  targetOSToErrorPlatform,
  type WizardErrorContext,
  type WizardErrorMatch,
} from '../error-mapper'

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
    expect(result.actions).toEqual([])
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
    // messageKey is not in MESSAGE_DICT -> falls back via lookupMessage to
    // fallback dict entry, so title is the generic "步驟發生錯誤".
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