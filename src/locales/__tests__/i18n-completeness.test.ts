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
