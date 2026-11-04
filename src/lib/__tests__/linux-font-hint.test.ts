/**
 * PLAN-064 / T0827: parsing fc-list runs, the log line, the "show the hint?" decision (language × result ×
 * dismissed) and the install command.
 */
import { describe, expect, it } from 'vitest'
import {
  countFcListLines,
  isChineseLanguage,
  LINUX_FONT_HINT_URL,
  linuxFontCheckFromRuns,
  linuxFontCheckLogLine,
  linuxFontHintItems,
  linuxFontInstallCommand,
  type LinuxFontCheck,
} from '../linux-font-hint'

const ran = (stdout: string) => ({ stdout, exitCode: 0 })

describe('linuxFontCheckFromRuns', () => {
  it('ok when both queries list something', () => {
    expect(linuxFontCheckFromRuns(ran('Noto Sans CJK TC\r\nNoto Serif CJK TC\n'), ran('Noto Color Emoji\n')))
      .toEqual({ state: 'ok', cjkFamilies: 2, emojiFamilies: 1 })
  })

  it('missing: each flag on its own; blank lines do not count', () => {
    expect(linuxFontCheckFromRuns(ran(''), ran('\n  \n'))).toEqual({ state: 'missing', cjk: true, emoji: true, cjkFamilies: 0, emojiFamilies: 0 })
    expect(linuxFontCheckFromRuns(ran(''), ran('Noto Color Emoji\n'))).toMatchObject({ state: 'missing', cjk: true, emoji: false })
    expect(linuxFontCheckFromRuns(ran('Noto Sans CJK SC\n'), ran(''))).toMatchObject({ state: 'missing', cjk: false, emoji: true })
  })

  it('unknown reasons: no-fc-list > timeout > failed; one bad run is enough', () => {
    expect(linuxFontCheckFromRuns({ stdout: '', spawnErrorCode: 'ENOENT', spawnError: 'spawn fc-list ENOENT' }, ran('x')))
      .toEqual({ state: 'unknown', reason: 'no-fc-list' })
    expect(linuxFontCheckFromRuns({ stdout: '', timedOut: true, exitCode: null }, { stdout: '', exitCode: 2 }))
      .toEqual({ state: 'unknown', reason: 'timeout' })
    expect(linuxFontCheckFromRuns(ran('x'), { stdout: '', exitCode: 1 })).toEqual({ state: 'unknown', reason: 'failed', detail: 'exit 1' })
    expect(linuxFontCheckFromRuns(ran('x'), { stdout: '', exitCode: null })).toEqual({ state: 'unknown', reason: 'failed', detail: 'signal' })
    expect(linuxFontCheckFromRuns({ stdout: '', spawnErrorCode: 'EACCES', spawnError: 'spawn fc-list EACCES' }, ran('x')))
      .toEqual({ state: 'unknown', reason: 'failed', detail: 'spawn fc-list EACCES' })
  })

  it('unparseable output → unknown(failed)', () => {
    expect(countFcListLines(undefined)).toBeNull()
    expect(countFcListLines(Buffer.from('x'))).toBeNull()
    expect(countFcListLines('a\u0000b')).toBeNull()
    expect(linuxFontCheckFromRuns({ stdout: 42, exitCode: 0 }, ran('x'))).toEqual({ state: 'unknown', reason: 'failed', detail: 'unparseable output' })
  })
})

describe('linuxFontCheckLogLine', () => {
  it('result, reason, counts, time — no font names', () => {
    expect(linuxFontCheckLogLine({ state: 'ok', cjkFamilies: 15, emojiFamilies: 1 }, 31.6)).toBe('[font-check] ok in 32 ms (cjk faces=15, emoji faces=1)')
    expect(linuxFontCheckLogLine({ state: 'missing', cjk: true, emoji: false, cjkFamilies: 0, emojiFamilies: 1 }, 10))
      .toBe('[font-check] missing cjk=true emoji=false in 10 ms (cjk faces=0, emoji faces=1)')
    expect(linuxFontCheckLogLine({ state: 'unknown', reason: 'timeout' }, 5003)).toBe('[font-check] unknown(timeout) in 5003 ms')
    expect(linuxFontCheckLogLine({ state: 'unknown', reason: 'failed', detail: 'exit 1' }, 3)).toBe('[font-check] unknown(failed) in 3 ms: exit 1')
  })
})

describe('linuxFontHintItems (language × result × dismissed)', () => {
  const both: LinuxFontCheck = { state: 'missing', cjk: true, emoji: true, cjkFamilies: 0, emojiFamilies: 0 }
  const cjkOnly: LinuxFontCheck = { state: 'missing', cjk: true, emoji: false, cjkFamilies: 0, emojiFamilies: 1 }
  const emojiOnly: LinuxFontCheck = { state: 'missing', cjk: false, emoji: true, cjkFamilies: 3, emojiFamilies: 0 }
  const ok: LinuxFontCheck = { state: 'ok', cjkFamilies: 3, emojiFamilies: 1 }

  it.each([
    ['zh-TW', both, { cjk: true, emoji: true }],
    ['zh-CN', both, { cjk: true, emoji: true }],
    ['en', both, { cjk: false, emoji: true }],
    ['zh-TW', cjkOnly, { cjk: true, emoji: false }],
    ['zh-CN', cjkOnly, { cjk: true, emoji: false }],
    ['en', cjkOnly, null],
    ['zh-TW', emojiOnly, { cjk: false, emoji: true }],
    ['en', emojiOnly, { cjk: false, emoji: true }],
    ['zh-TW', ok, null],
    ['en', ok, null],
  ] as const)('%s × %o → %o', (language, result, expected) => {
    expect(linuxFontHintItems({ result, language, dismissed: false })).toEqual(expected)
  })

  it('unknown never shows a hint, whatever the reason or language', () => {
    for (const reason of ['pending', 'not-linux', 'no-fc-list', 'timeout', 'failed'] as const) {
      for (const language of ['zh-TW', 'zh-CN', 'en']) {
        expect(linuxFontHintItems({ result: { state: 'unknown', reason }, language, dismissed: false })).toBeNull()
      }
    }
  })

  it('dismissed ("don\'t show again") → never', () => {
    expect(linuxFontHintItems({ result: both, language: 'zh-TW', dismissed: true })).toBeNull()
    expect(linuxFontHintItems({ result: emojiOnly, language: 'en', dismissed: true })).toBeNull()
  })

  it('isChineseLanguage', () => {
    expect(['zh-TW', 'zh-CN', 'zh', 'zh_TW'].map(isChineseLanguage)).toEqual([true, true, true, true])
    expect(['en', 'ja', '', undefined, null, 'zhx'].map(isChineseLanguage)).toEqual([false, false, false, false, false, false])
  })
})

describe('linuxFontInstallCommand', () => {
  it('lists the packages of the listed items', () => {
    expect(linuxFontInstallCommand({ cjk: true, emoji: true })).toBe('sudo apt update && sudo apt install -y fonts-noto-cjk fonts-noto-color-emoji')
    expect(linuxFontInstallCommand({ cjk: true, emoji: false })).toBe('sudo apt update && sudo apt install -y fonts-noto-cjk')
    expect(linuxFontInstallCommand({ cjk: false, emoji: true })).toBe('sudo apt update && sudo apt install -y fonts-noto-color-emoji')
  })

  it('links the site install page section', () => {
    expect(LINUX_FONT_HINT_URL).toBe('https://gowerlin.github.io/better-agent-terminal/install#linux-fonts')
  })
})
