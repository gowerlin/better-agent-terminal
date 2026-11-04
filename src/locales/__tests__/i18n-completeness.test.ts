/**
 * T0334 (PLAN-032 Sprint 2): i18n completeness guard for wizard action keys.
 *
 * Ensures the three locale files (en / zh-TW / zh-CN) ship the same set of
 * wizard.action.* keys so framework consumers (T0331 ErrorMapper actions,
 * T0333 SetupWizardShell action dispatch) never miss a translation entry
 * when adding a new recovery-action label.
 *
 * Scope: action labels only (D108 — framework hook only, no copy work).
 */
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import {
  INTEGRITY_KEYS,
  LOCATION_KEYS,
  NOTE_KEYS,
  UNSUPPORTED_REASONS,
} from '../../lib/remote-tools/recipes'
import {
  REMOTE_PRIVILEGES,
  REMOTE_TOOL_IDS,
  REMOTE_TOOL_LOGIN_STATES,
  REMOTE_TOOL_STATUSES,
  REMOTE_TOOL_TIERS,
  REMOTE_TOOLS_DETECT_ERROR_CODES,
} from '../../types/remote-tools'

const REQUIRED_WIZARD_ACTION_KEYS = [
  'wizard.action.retry',
  'wizard.action.skip',
  'wizard.action.cancel',
  'wizard.action.editConfig',
  'wizard.action.skipChoice',
  'wizard.action.fixedAndRetry',
  'wizard.action.showDetails',
] as const

function getNested(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment]
    }
    return undefined
  }, obj)
}

describe('wizard.action.* i18n completeness (T0334)', () => {
  it.each(REQUIRED_WIZARD_ACTION_KEYS)('en locale contains "%s"', (key) => {
    const value = getNested(en, key)
    expect(value, `missing "${key}" in en.json`).toBeTypeOf('string')
    expect((value as string).length).toBeGreaterThan(0)
  })

  it.each(REQUIRED_WIZARD_ACTION_KEYS)('zh-TW locale contains "%s"', (key) => {
    const value = getNested(zhTW, key)
    expect(value, `missing "${key}" in zh-TW.json`).toBeTypeOf('string')
    expect((value as string).length).toBeGreaterThan(0)
  })

  it.each(REQUIRED_WIZARD_ACTION_KEYS)('zh-CN locale contains "%s"', (key) => {
    const value = getNested(zhCN, key)
    expect(value, `missing "${key}" in zh-CN.json`).toBeTypeOf('string')
    expect((value as string).length).toBeGreaterThan(0)
  })

  it('three locale files share identical wizard.action key sets', () => {
    const enKeys = Object.keys((en as { wizard: { action: Record<string, string> } }).wizard.action).sort()
    const zhTwKeys = Object.keys((zhTW as { wizard: { action: Record<string, string> } }).wizard.action).sort()
    const zhCnKeys = Object.keys((zhCN as { wizard: { action: Record<string, string> } }).wizard.action).sort()
    expect(zhTwKeys).toEqual(enKeys)
    expect(zhCnKeys).toEqual(enKeys)
  })
})

/**
 * T0410 (PLAN-037 D): remoteTools.* — the three locales carry exactly the keys the tools panel
 * renders: the T0409 recipe key lists, one key per enum value, plus the panel / dialog copy.
 */
const REMOTE_TOOLS_UI_KEYS = [
  'remoteTools.title',
  'remoteTools.installRequestFailed',
  'remoteTools.checking',
  'remoteTools.recheck',
  'remoteTools.install',
  'remoteTools.installViaNvm',
  'remoteTools.update',
  'remoteTools.docsLink',
  'remoteTools.login.button',
  'remoteTools.login.credentialFilePresent',
  'remoteTools.login.credentialFileAbsent',
  'remoteTools.nvm.version',
  'remoteTools.nvm.present',
  'remoteTools.server.visible',
  'remoteTools.server.hidden',
  'remoteTools.server.hiddenLoginOnly',
  'remoteTools.server.tooltip',
  'remoteTools.server.viewUnavailable',
  'remoteTools.env.wsl',
  'remoteTools.env.musl',
  'remoteTools.env.pkgManager',
  'remoteTools.env.pkgManagerNone',
  'remoteTools.env.authEnv',
  'remoteTools.hint.interopOnly',
  'remoteTools.hint.notOnPath',
  'remoteTools.hint.tooOld',
  'remoteTools.hint.versionError',
  'remoteTools.hint.versionErrorMissingLibrary',
  // T0756 (BUG-187): the fix command for libatomic.so.1.
  'remoteTools.hint.versionErrorMissingLibraryFix',
  'remoteTools.hint.versionErrorMissingLibraryFixAsRoot',
  'remoteTools.hint.versionErrorExitCode',
  'remoteTools.hint.curlMissing',
  'remoteTools.hint.nodeNotNvm',
  'remoteTools.error.detectFailed',
  'remoteTools.error.invalidReport',
  'remoteTools.confirm.titleInstall',
  'remoteTools.confirm.titleUpdate',
  'remoteTools.confirm.unofficial',
  'remoteTools.confirm.command',
  'remoteTools.confirm.copy',
  'remoteTools.confirm.copied',
  'remoteTools.confirm.prerequisites',
  'remoteTools.confirm.sudo',
  'remoteTools.confirm.sudoYes',
  'remoteTools.confirm.sudoNo',
  'remoteTools.confirm.location',
  'remoteTools.confirm.integrity',
  'remoteTools.confirm.integrityScriptNote',
  'remoteTools.confirm.integrityScriptPinnedNote',
  'remoteTools.confirm.sources',
  'remoteTools.confirm.docs',
  'remoteTools.confirm.viewScript',
  'remoteTools.confirm.runsHere',
  'remoteTools.confirm.runsInRemoteWindow',
  'remoteTools.confirm.sudoPasswordHint',
  'remoteTools.confirm.confirmInstall',
  'remoteTools.confirm.confirmUpdate',
] as const

const EXPECTED_REMOTE_TOOLS_KEYS = [
  ...REMOTE_TOOLS_UI_KEYS,
  ...INTEGRITY_KEYS,
  ...LOCATION_KEYS,
  ...NOTE_KEYS,
  ...UNSUPPORTED_REASONS.map((reason) => `remoteTools.unsupported.${reason}`),
  ...REMOTE_TOOL_TIERS.map((tier) => `remoteTools.tier.${tier}`),
  ...REMOTE_TOOL_IDS.map((id) => `remoteTools.tool.${id}.name`),
  ...REMOTE_TOOL_STATUSES.map((status) => `remoteTools.status.${status}`),
  // `n/a` is never rendered (no login, or the tool is not runnable).
  ...REMOTE_TOOL_LOGIN_STATES.filter((state) => state !== 'n/a').map((state) => `remoteTools.login.${state}`),
  ...REMOTE_PRIVILEGES.map((privilege) => `remoteTools.privilege.${privilege}`),
  ...REMOTE_TOOLS_DETECT_ERROR_CODES.map((code) => `remoteTools.error.${code}`),
].sort()

function flattenKeys(obj: unknown, prefix: string): string[] {
  if (!obj || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) => flattenKeys(value, `${prefix}.${key}`))
}

describe('remoteTools.* i18n completeness (T0410)', () => {
  it('expected key list has no duplicates', () => {
    expect(new Set(EXPECTED_REMOTE_TOOLS_KEYS).size).toBe(EXPECTED_REMOTE_TOOLS_KEYS.length)
  })

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s remoteTools keys match the expected set one-to-one', (_name, locale) => {
    const keys = flattenKeys((locale as { remoteTools?: unknown }).remoteTools, 'remoteTools').sort()
    expect(keys).toEqual(EXPECTED_REMOTE_TOOLS_KEYS)
    for (const key of keys) {
      const value = getNested(locale, key)
      expect(value, `"${key}" must be a non-empty string`).toBeTypeOf('string')
      expect((value as string).trim().length).toBeGreaterThan(0)
    }
  })
})

// T0506: the SSH host error (WizardErrorMapper `ssh-configure-host-invalid`)
// and the SSH profile details note resolve through i18next, so every locale
// needs them.
const T0506_KEYS = [
  'wizard.ssh.error.hostInvalid.title',
  'wizard.ssh.error.hostInvalid.body',
  'profiles.sshDetails.userFromConfig',
  'profiles.sshDetails.portFromConfig',
  'profiles.sshDetails.userAndPortFromConfig',
] as const

describe('SSH host error + details note i18n completeness (T0506)', () => {
  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s contains every key as a non-empty string', (_name, locale) => {
    for (const key of T0506_KEYS) {
      const value = getNested(locale, key)
      expect(value, `missing "${key}"`).toBeTypeOf('string')
      expect((value as string).trim().length).toBeGreaterThan(0)
    }
  })

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s ships the same wizard.ssh.error and profiles.sshDetails key sets as en', (_name, locale) => {
    for (const root of ['wizard.ssh.error', 'profiles.sshDetails']) {
      expect(flattenKeys(getNested(locale, root), root).sort()).toEqual(flattenKeys(getNested(en, root), root).sort())
    }
  })
})

// T0652 (BUG-158): remote setup screens (profile cards, Edit connection, setup
// wizard prompts / warnings / Docker port errors) resolve through i18next.
const T0652_KEYS = [
  'profiles.legacyTargetOsPrompt',
  'profiles.selectTargetOs',
  'profiles.connectionUrlPlaceholder',
  'profiles.addMenuSuggested',
  'profiles.fingerprint.expectedPlaceholder',
  'profiles.fingerprint.expectedTitle',
  'profiles.fingerprint.pinnedPlaceholder',
  'profiles.fingerprint.pinnedTitle',
  'profiles.fingerprint.pin',
  'profiles.fingerprint.pinTitle',
  'wizard.docker.pickContainer.title',
  'wizard.docker.pickContainer.new.label',
  'wizard.docker.pickContainer.existing.label',
  'wizard.docker.warning.existingNeedsBundle',
  'wizard.docker.warning.nameTaken',
  'wizard.docker.error.portInUse.title',
  'wizard.docker.error.portUnpublished.title',
  'wizard.wsl.pickDistro.title',
  'wizard.wsl.warning.wsl1Only',
  'wizard.wsl.warning.systemdDisabled',
  'wizard.wsl.warning.lingerFailed',
  'wizard.shared.warning.systemdFallback',
  'wizard.ssh.pickHost.title',
] as const

const T0652_ROOTS = [
  'profiles.fingerprint',
  'profiles.details',
  'wizard.docker.pickContainer',
  'wizard.docker.warning',
  'wizard.docker.error',
  'wizard.wsl.pickDistro',
  'wizard.ssh.pickHost',
  'wizard.shared.warning',
] as const

describe('remote setup screens i18n completeness (T0652)', () => {
  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s contains every key as a non-empty string', (_name, locale) => {
    for (const key of T0652_KEYS) {
      const value = getNested(locale, key)
      expect(value, `missing "${key}"`).toBeTypeOf('string')
      expect((value as string).trim().length).toBeGreaterThan(0)
    }
  })

  it.each([
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s ships the same key sets as en under each T0652 root', (_name, locale) => {
    for (const root of T0652_ROOTS) {
      expect(flattenKeys(getNested(locale, root), root).sort()).toEqual(flattenKeys(getNested(en, root), root).sort())
    }
  })

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s SSH permission-denied copy never mentions a password (BatchMode=yes)', (_name, locale) => {
    const body = getNested(locale, 'wizard.ssh.error.permissionDenied.body') as string
    expect(body).toMatch(/ssh-agent/)
    expect(body).not.toMatch(/password|密碼|密码/i)
  })
})

// T0660 (BUG-161): wizard step errors (error registry entries, incl. the
// `body_win32` / `body_darwin` context variants), recovery warnings, the
// cancel notice, WSL distro option descriptions and the thumbnail Supervisor
// menu resolve through i18next.
const T0660_KEYS = [
  'wizard.cancelled',
  'wizard.shared.warning.finalizeFailed',
  'wizard.shared.warning.jumpRollbackFailed',
  'wizard.shared.error.preconditionMissing.title',
  'wizard.docker.error.startFailed.body',
  'wizard.wsl.error.requiresWsl2.title',
  'wizard.wsl.pickDistro.optionDescription',
  'wizard.wsl.pickDistro.state.Running',
  'wizard.wsl.pickDistro.state.Stopped',
  'wizard.ssh.error.clientMissing.body_win32',
  'wizard.ssh.error.clientMissing.body_darwin',
  'wizard.ssh.error.verifyFailed.body_darwin',
  'workspace.setSupervisor',
  'workspace.removeSupervisor',
  'profiles.addMenuSuggested',
  'common.close',
] as const

const T0660_ROOTS = [
  'wizard.shared.error',
  'wizard.shared.warning',
  'wizard.docker.error',
  'wizard.wsl.error',
  'wizard.wsl.pickDistro',
  'wizard.ssh.error',
] as const

describe('wizard step errors / thumbnail menu i18n completeness (T0660)', () => {
  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s contains every key as a non-empty string', (_name, locale) => {
    for (const key of T0660_KEYS) {
      const value = getNested(locale, key)
      expect(value, `missing "${key}"`).toBeTypeOf('string')
      expect((value as string).trim().length).toBeGreaterThan(0)
    }
  })

  it.each([
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s ships the same key sets as en under each T0660 root, all translated', (_name, locale) => {
    for (const root of T0660_ROOTS) {
      const keys = flattenKeys(getNested(en, root), root)
      expect(flattenKeys(getNested(locale, root), root).sort()).toEqual(keys.sort())
    }
    expect(getNested(locale, 'workspace.setSupervisor')).not.toBe(getNested(en, 'workspace.setSupervisor'))
    expect(getNested(locale, 'wizard.shared.error.preconditionMissing.body')).not.toBe(
      getNested(en, 'wizard.shared.error.preconditionMissing.body'),
    )
  })

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s recovery warnings keep the {{step}} / {{error}} placeholders', (_name, locale) => {
    for (const key of ['wizard.shared.warning.finalizeFailed', 'wizard.shared.warning.jumpRollbackFailed']) {
      const value = getNested(locale, key) as string
      expect(value).toContain('{{step}}')
      expect(value).toContain('{{error}}')
    }
  })
})

// T0840 (PLAN-043 W3): the WSL environment plan (T0839 `wsl-env-plan.ts` keys,
// `wizard.wsl.plan.*`), the apply step / changes box (`wizard.wsl.apply.*`), the
// two new steps and the new error entries ship in all three locales.
const T0840_KEYS = [
  'wizard.wsl.step.planEnv.label',
  'wizard.wsl.step.planEnv.description',
  'wizard.wsl.step.applyEnv.label',
  'wizard.wsl.step.applyEnv.description',
  'wizard.wsl.step.systemdCheck.description',
  'wizard.wsl.plan.title',
  'wizard.wsl.plan.confirm',
  'wizard.wsl.plan.requiredMissing',
  'wizard.wsl.plan.summaryTerminate',
  'wizard.wsl.plan.summaryShutdownAll',
  'wizard.wsl.plan.runningDistros',
  'wizard.wsl.plan.runningNone',
  'wizard.wsl.plan.scope.machine',
  'wizard.wsl.plan.scope.distro',
  'wizard.wsl.plan.scope.user',
  'wizard.wsl.plan.tag.required',
  'wizard.wsl.plan.tag.optional',
  'wizard.wsl.plan.tag.fixed',
  'wizard.wsl.plan.effect.elevation',
  'wizard.wsl.plan.effect.reboot',
  'wizard.wsl.plan.effect.shutdownAllDistros',
  'wizard.wsl.plan.effect.terminateDistro',
  'wizard.wsl.plan.effect.longRunning',
  'wizard.wsl.plan.warning.optionalSkipped',
  'wizard.wsl.plan.action.chooseAgain',
  'wizard.wsl.apply.uninterruptible.convert',
  'wizard.wsl.apply.action.skipMayFail',
  'wizard.wsl.apply.warning.optionalFailed',
  'wizard.wsl.apply.changes.header',
  'wizard.wsl.apply.changes.wsl2Convert',
  'wizard.wsl.apply.changes.file',
  'wizard.wsl.apply.changes.backup',
  'wizard.wsl.apply.changes.newFile',
  'wizard.wsl.apply.changes.note',
  'wizard.wsl.error.policyBlocked.title',
  'wizard.wsl.error.envRequiredDeclined.title',
  'wizard.wsl.error.envItemUnavailable.title',
  'wizard.wsl.error.envApplyFailed.title',
  'wizard.wsl.error.systemdDisabled.title',
] as const

const T0840_ROOTS = ['wizard.wsl.plan', 'wizard.wsl.apply', 'wizard.wsl.step'] as const

/** Every `${KEY}.<path>` literal in wsl-env-plan.ts (KEY = 'wizard.wsl.plan'). */
function wslEnvPlanKeys(): string[] {
  const source = readFileSync(path.join(__dirname, '..', '..', 'components', 'setup-wizard', 'wsl-env-plan.ts'), 'utf8')
  return [...source.matchAll(/`\$\{KEY\}\.([A-Za-z0-9.]+)`/g)].map((m) => `wizard.wsl.plan.${m[1]}`)
}

describe('WSL environment plan / apply i18n completeness (T0840)', () => {
  it('finds the plan keys in wsl-env-plan.ts', () => {
    expect(wslEnvPlanKeys().length).toBeGreaterThanOrEqual(10)
  })

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s contains every key (incl. every key wsl-env-plan.ts emits)', (_name, locale) => {
    for (const key of [...T0840_KEYS, ...wslEnvPlanKeys()]) {
      const value = getNested(locale, key)
      expect(value, `missing "${key}"`).toBeTypeOf('string')
      expect((value as string).trim().length).toBeGreaterThan(0)
    }
  })

  it.each([
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s ships the same key sets as en under each T0840 root, translated', (_name, locale) => {
    for (const root of T0840_ROOTS) {
      expect(flattenKeys(getNested(locale, root), root).sort()).toEqual(flattenKeys(getNested(en, root), root).sort())
    }
    expect(getNested(locale, 'wizard.wsl.plan.confirm')).not.toBe(getNested(en, 'wizard.wsl.plan.confirm'))
  })

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
    ['zh-CN', zhCN],
  ] as const)('%s keeps the interpolation placeholders', (_name, locale) => {
    expect(getNested(locale, 'wizard.wsl.plan.item.enableSystemd.label')).toContain('{{distro}}')
    expect(getNested(locale, 'wizard.wsl.plan.notice.wslTooOld')).toContain('{{version}}')
    expect(getNested(locale, 'wizard.wsl.plan.notice.wslTooOld')).toContain('{{minimum}}')
    expect(getNested(locale, 'wizard.wsl.plan.runningDistros')).toContain('{{list}}')
    expect(getNested(locale, 'wizard.wsl.apply.changes.backup')).toContain('{{path}}')
  })
})
