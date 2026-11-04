/**
 * T0843: the refusal toast of one send (`attachmentRefusalText`) with the real locale strings.
 * Upload failures start with the reason, grouped by reason, every file named once; T0437-only
 * refusals keep the T0437 sentence word for word; mixed sends get one sentence per part.
 */
import { describe, expect, test } from 'vitest'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { attachmentRefusalText, type AttachmentUploadFailure } from '../client-paths'

type Dict = Record<string, unknown>

/** i18next-like t(): nested key lookup + {{name}} interpolation (escapeValue is off in src/i18n.ts). */
function translator(dict: Dict) {
  return (key: string, params?: Record<string, string | number>): string => {
    const value = key.split('.').reduce<unknown>((node, part) => (node as Dict | undefined)?.[part], dict)
    if (typeof value !== 'string') throw new Error(`missing key ${key}`)
    return value.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(params?.[name] ?? `{{${name}}}`))
  }
}

const fail = (name: string, code: AttachmentUploadFailure['code']): AttachmentUploadFailure => ({ path: `C:\\u\\${name}`, name, code })

const occurrences = (text: string, needle: string) => text.split(needle).length - 1

const LOCALES = { en, 'zh-TW': zhTW, 'zh-CN': zhCN } as const

/** Expected texts per locale, keyed by case name. */
const EXPECTED: Record<keyof typeof LOCALES, Record<string, string>> = {
  en: {
    tooLarge: 'Not attached (over the 50 MiB per-file limit): a.zip',
    serverTooOld: 'Not attached (the BAT server on the remote host is too old to accept uploads; update it): a.txt',
    sameReason: 'Not attached (over the 50 MiB per-file limit): a.zip, b.iso',
    twoReasons: 'Not attached (over the 50 MiB per-file limit): a.zip, c.iso. Not attached (the connection to the remote host failed): b.log',
    rejectedOnly: 'Not on the remote host, not attached: x.txt, y.md',
    mixed: 'Not on the remote host, not attached: x.txt. Not attached (over the 50 MiB per-file limit): a.zip',
  },
  'zh-TW': {
    tooLarge: '未附加（超過單檔 50 MiB 上限）：a.zip',
    serverTooOld: '未附加（遠端主機的 BAT server 版本太舊、不接受上傳，請更新）：a.txt',
    sameReason: '未附加（超過單檔 50 MiB 上限）：a.zip、b.iso',
    twoReasons: '未附加（超過單檔 50 MiB 上限）：a.zip、c.iso。未附加（與遠端主機的連線失敗）：b.log',
    rejectedOnly: '此檔案不在遠端主機上，未附加：x.txt, y.md',
    mixed: '此檔案不在遠端主機上，未附加：x.txt。未附加（超過單檔 50 MiB 上限）：a.zip',
  },
  'zh-CN': {
    tooLarge: '未附加（超过单个文件 50 MiB 上限）：a.zip',
    serverTooOld: '未附加（远程主机的 BAT server 版本太旧、不接受上传，请更新）：a.txt',
    sameReason: '未附加（超过单个文件 50 MiB 上限）：a.zip、b.iso',
    twoReasons: '未附加（超过单个文件 50 MiB 上限）：a.zip、c.iso。未附加（与远程主机的连接失败）：b.log',
    rejectedOnly: '此文件不在远程主机上，未附加：x.txt, y.md',
    mixed: '此文件不在远程主机上，未附加：x.txt。未附加（超过单个文件 50 MiB 上限）：a.zip',
  },
}

const CASES = {
  tooLarge: { rejected: [], uploadFailed: [fail('a.zip', 'TOO_LARGE')] },
  serverTooOld: { rejected: [], uploadFailed: [fail('a.txt', 'SERVER_TOO_OLD')] },
  sameReason: { rejected: [], uploadFailed: [fail('a.zip', 'TOO_LARGE'), fail('b.iso', 'TOO_LARGE')] },
  twoReasons: { rejected: [], uploadFailed: [fail('a.zip', 'TOO_LARGE'), fail('b.log', 'TRANSPORT'), fail('c.iso', 'TOO_LARGE')] },
  rejectedOnly: { rejected: ['C:\\x\\x.txt', '/h/y.md'], uploadFailed: [] },
  mixed: { rejected: ['C:\\x\\x.txt'], uploadFailed: [fail('a.zip', 'TOO_LARGE')] },
} satisfies Record<string, Parameters<typeof attachmentRefusalText>[0]>

describe.each(Object.entries(LOCALES))('attachmentRefusalText (%s)', (locale, dict) => {
  const t = translator(dict as Dict)
  const expected = EXPECTED[locale as keyof typeof LOCALES]

  test('nothing refused → null', () => {
    expect(attachmentRefusalText({ rejected: [], uploadFailed: [] }, t)).toBeNull()
  })

  test.each(Object.entries(CASES))('%s', (name, resolution) => {
    const text = attachmentRefusalText(resolution, t)
    expect(text).toBe(expected[name])
    // Every file is named exactly once, whatever the locale.
    const names = [...resolution.rejected.map(p => p.split(/[\\/]/).pop() ?? p), ...resolution.uploadFailed.map(f => f.name)]
    for (const n of names) expect(occurrences(text ?? '', n), `${n} in "${text}"`).toBe(1)
  })

  test('T0437-only refusals: the T0437 sentence alone, word for word', () => {
    expect(attachmentRefusalText(CASES.rejectedOnly, t)).toBe(t('claude.attachmentNotOnRemoteHost', { files: 'x.txt, y.md' }))
  })

  test('upload failures start with the reason, not with the T0437 sentence', () => {
    const text = attachmentRefusalText(CASES.tooLarge, t) ?? ''
    const reason = t('claude.uploadError.tooLarge', { limit: 50 })
    expect(text.startsWith(t('claude.attachmentUploadFailed', { reason, files: '' }))).toBe(true)
    expect(text).not.toContain(t('claude.attachmentNotOnRemoteHost', { files: '' }))
  })

  test('every upload failure reason fits the sentence', () => {
    const codes: AttachmentUploadFailure['code'][] = ['TOO_LARGE', 'SEND_TOO_LARGE', 'TOO_MANY_FILES', 'QUOTA', 'NO_SPACE', 'SERVER_TOO_OLD', 'TRANSPORT', 'SOURCE_ERROR', 'HASH_MISMATCH']
    for (const code of codes) {
      const text = attachmentRefusalText({ rejected: [], uploadFailed: [fail('f.bin', code)] }, t) ?? ''
      expect(text).not.toMatch(/\{\{|\}\}/)
      expect(occurrences(text, 'f.bin')).toBe(1)
    }
  })
})
