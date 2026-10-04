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
  'remoteTools.checking',
  'remoteTools.recheck',
  'remoteTools.install',
  'remoteTools.update',
  'remoteTools.docsLink',
  'remoteTools.login.button',
  'remoteTools.login.credentialFilePresent',
  'remoteTools.login.credentialFileAbsent',
  'remoteTools.server.visible',
  'remoteTools.server.hidden',
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
  'remoteTools.hint.curlMissing',
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
