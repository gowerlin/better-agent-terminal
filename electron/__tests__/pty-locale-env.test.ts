// @vitest-environment node
/**
 * T0398 (BUG-102): resolvePtyLocaleEnv decision matrix.
 *
 * platform × inherited LANG × customEnv × `locale -a` result (incl. probe failure).
 * win32 / darwin must keep the pre-T0398 output (LANG + LC_ALL = en_US.UTF-8) whenever
 * customEnv sets no locale key.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-locale-env must not import electron (PLAN-036 T0389)')
})

import { createCachedLocaleLister, resolvePtyLocaleEnv, type LocaleLister } from '../pty-locale-env'
import { logger } from '../logger'

const PRE_T0398 = { LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' }
const WSL_UBUNTU_2404 = ['C', 'C.utf8', 'POSIX']
const DESKTOP_LINUX = ['C', 'C.utf8', 'en_US.utf8', 'POSIX', 'zh_TW.utf8']

const lister = (locales: string[] | null): LocaleLister => vi.fn(() => locales)
const failingLister: LocaleLister = () => null

describe.each(['win32', 'darwin'] as const)('%s', (platform) => {
  it.each([
    ['no inherited LANG', {}],
    ['inherited UTF-8 LANG', { LANG: 'zh_TW.UTF-8' }],
    ['inherited non-UTF-8 LANG', { LANG: 'C' }],
    ['inherited LC_ALL', { LC_ALL: 'C' }],
  ])('without customEnv locale keys = pre-T0398 output (%s)', (_label, inheritedEnv) => {
    const listLocales = lister(DESKTOP_LINUX)
    expect(resolvePtyLocaleEnv({ platform, inheritedEnv, customEnv: { FOO: 'bar' }, listLocales })).toEqual(PRE_T0398)
    expect(listLocales).not.toHaveBeenCalled()
  })

  it('customEnv LANG is kept and LC_ALL is not forced over it', () => {
    expect(resolvePtyLocaleEnv({ platform, inheritedEnv: {}, customEnv: { LANG: 'zh_TW.UTF-8' } })).toEqual({})
  })

  it('customEnv LC_ALL is kept; LANG still defaults', () => {
    expect(resolvePtyLocaleEnv({ platform, inheritedEnv: {}, customEnv: { LC_ALL: 'ja_JP.UTF-8' } }))
      .toEqual({ LANG: 'en_US.UTF-8' })
  })

  it('customEnv LC_CTYPE suppresses LC_ALL (it would override LC_CTYPE)', () => {
    expect(resolvePtyLocaleEnv({ platform, inheritedEnv: {}, customEnv: { LC_CTYPE: 'zh_TW.UTF-8' } }))
      .toEqual({ LANG: 'en_US.UTF-8' })
  })
})

describe('linux', () => {
  const platform = 'linux' as const

  it.each([
    ['WSL Ubuntu 24.04, no inherited LANG -> C.UTF-8', {}, WSL_UBUNTU_2404, 'C.UTF-8'],
    ['WSL Ubuntu 24.04, inherited en_US.UTF-8 (not installed) -> C.UTF-8', { LANG: 'en_US.UTF-8' }, WSL_UBUNTU_2404, 'C.UTF-8'],
    ['WSL Ubuntu 24.04, inherited C.UTF-8 kept', { LANG: 'C.UTF-8' }, WSL_UBUNTU_2404, 'C.UTF-8'],
    ['inherited UTF-8 LANG installed -> kept verbatim', { LANG: 'zh_TW.UTF-8' }, DESKTOP_LINUX, 'zh_TW.UTF-8'],
    ['inherited utf8 spelling matches UTF-8 listing', { LANG: 'zh_TW.utf8' }, ['zh_TW.UTF-8'], 'zh_TW.utf8'],
    ['inherited LANG matched case-insensitively', { LANG: 'ZH_tw.Utf-8' }, DESKTOP_LINUX, 'ZH_tw.Utf-8'],
    ['inherited non-UTF-8 LANG -> first candidate', { LANG: 'zh_TW.Big5' }, [...DESKTOP_LINUX, 'zh_TW.big5'], 'C.UTF-8'],
    ['inherited LANG=C -> first candidate', { LANG: 'C' }, DESKTOP_LINUX, 'C.UTF-8'],
    ['no C.UTF-8 installed -> en_US.UTF-8', {}, ['C', 'POSIX', 'en_US.utf8'], 'en_US.UTF-8'],
    ['neither candidate installed -> C.UTF-8', {}, ['C', 'POSIX'], 'C.UTF-8'],
    ['empty listing -> C.UTF-8', {}, [], 'C.UTF-8'],
  ])('%s', (_label, inheritedEnv, locales, lang) => {
    expect(resolvePtyLocaleEnv({ platform, inheritedEnv, customEnv: {}, listLocales: lister(locales) }))
      .toEqual({ LANG: lang })
  })

  it.each([
    ['no inherited LANG', {}],
    ['inherited UTF-8 LANG', { LANG: 'zh_TW.UTF-8' }],
  ])('probe failure -> C.UTF-8 (%s)', (_label, inheritedEnv) => {
    expect(resolvePtyLocaleEnv({ platform, inheritedEnv, customEnv: {}, listLocales: failingLister }))
      .toEqual({ LANG: 'C.UTF-8' })
  })

  it('never sets LC_ALL, so inherited LC_* stay in effect', () => {
    const env = resolvePtyLocaleEnv({
      platform, inheritedEnv: { LC_TIME: 'zh_TW.UTF-8' }, customEnv: {}, listLocales: lister(DESKTOP_LINUX),
    })
    expect(env).not.toHaveProperty('LC_ALL')
    expect(env).not.toHaveProperty('LC_TIME')
  })

  it('customEnv LANG wins and skips the probe', () => {
    const listLocales = lister(WSL_UBUNTU_2404)
    expect(resolvePtyLocaleEnv({ platform, inheritedEnv: {}, customEnv: { LANG: 'en_US.UTF-8' }, listLocales })).toEqual({})
    expect(listLocales).not.toHaveBeenCalled()
  })

  it.each([
    ['LC_ALL', { LC_ALL: 'zh_TW.UTF-8' }],
    ['LC_CTYPE', { LC_CTYPE: 'zh_TW.UTF-8' }],
  ])('customEnv %s is not overwritten (only LANG is returned)', (_label, customEnv) => {
    expect(resolvePtyLocaleEnv({ platform, inheritedEnv: {}, customEnv, listLocales: lister(WSL_UBUNTU_2404) }))
      .toEqual({ LANG: 'C.UTF-8' })
  })
})

describe('createCachedLocaleLister', () => {
  it('parses `locale -a` output and runs the probe once', () => {
    const run = vi.fn(() => 'C\nC.utf8\r\nPOSIX\n\n')
    const list = createCachedLocaleLister(run)
    expect(list()).toEqual(['C', 'C.utf8', 'POSIX'])
    expect(list()).toEqual(['C', 'C.utf8', 'POSIX'])
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('caches a failed probe as null and logs once', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const run = vi.fn((): string => { throw Object.assign(new Error('spawn locale ENOENT'), { code: 'ENOENT' }) })
    const list = createCachedLocaleLister(run)
    expect(list()).toBeNull()
    expect(list()).toBeNull()
    expect(run).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
