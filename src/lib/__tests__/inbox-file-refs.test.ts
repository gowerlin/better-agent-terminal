/**
 * T0930: recognition and resolution of the Inbox's file references (src/lib/inbox-file-refs.ts).
 * All paths are made up.
 */
import { describe, expect, it } from 'vitest'
import {
  fileRefsOf,
  joinRoot,
  matchIdFile,
  parseCtId,
  refLookups,
  resolveRefPath,
  splitFileRefs,
  type TextPart,
} from '../inbox-file-refs'

const BS = String.fromCharCode(92) // a literal backslash

const refs = (text: string) => splitFileRefs(text).filter((p): p is Extract<TextPart, { kind: 'ref' }> => p.kind === 'ref')
const joined = (text: string) => splitFileRefs(text).map(p => p.text).join('')

describe('parseCtId', () => {
  it('recognizes work order, BUG, PLAN, EXP and decision ids', () => {
    expect(parseCtId('T0275')).toEqual({ id: 'T0275', idKind: 'workorder' })
    expect(parseCtId('LB-T0184')).toEqual({ id: 'LB-T0184', idKind: 'workorder' })
    expect(parseCtId('BUG-048')).toEqual({ id: 'BUG-048', idKind: 'bug' })
    expect(parseCtId('PLAN-069')).toEqual({ id: 'PLAN-069', idKind: 'plan' })
    expect(parseCtId('EXP-SAMPLE41-001')).toEqual({ id: 'EXP-SAMPLE41-001', idKind: 'exp' })
    expect(parseCtId(' D370 ')).toEqual({ id: 'D370', idKind: 'decision' })
  })

  it('leaves other values (local rules, short numbers, free text) alone', () => {
    for (const value of ['L138', 'R-G003', 'T12', 'D7', 'BUG-1', 'some text', 'T0275 Q-1', '']) {
      expect(parseCtId(value)).toBeNull()
    }
  })
})

describe('splitFileRefs', () => {
  it('keeps the text exactly', () => {
    const text = '見 `docs/sample/guide.md`、T0275 Q-1 與 https://example.test/a/b.md。'
    expect(joined(text)).toBe(text)
  })

  it('links a backtick path; the backticks stay text', () => {
    const parts = splitFileRefs('檢查 `scripts/verify-sample.js` 的結果')
    expect(parts).toEqual([
      { kind: 'text', text: '檢查 `' },
      { kind: 'ref', text: 'scripts/verify-sample.js', ref: { kind: 'path', path: 'scripts/verify-sample.js' } },
      { kind: 'text', text: '` 的結果' },
    ])
  })

  it('links a bare path, without trailing sentence punctuation', () => {
    expect(refs('結果在 sample-accept/results/M-9.md.').map(p => p.text)).toEqual(['sample-accept/results/M-9.md'])
    expect(refs('請看docs/a/b.md，然後').map(p => p.text)).toEqual(['docs/a/b.md'])
  })

  it('recognizes ids in a sentence, next to Chinese punctuation', () => {
    expect(refs('T0275 Q-1：要不要合併？見BUG-048、PLAN-069（D370）。').map(p => p.text)).toEqual(['T0275', 'BUG-048', 'PLAN-069', 'D370'])
    expect(refs('EXP-SAMPLE41-001 與 LB-T0184').map(p => p.ref)).toEqual([
      { kind: 'id', id: 'EXP-SAMPLE41-001', idKind: 'exp' },
      { kind: 'id', id: 'LB-T0184', idKind: 'workorder' },
    ])
  })

  it('links a backtick id', () => {
    expect(refs('看 `T0930` 的回報').map(p => p.ref)).toEqual([{ kind: 'id', id: 'T0930', idKind: 'workorder' }])
  })

  it('does not link URLs or anything inside them', () => {
    expect(refs('https://example.test/docs/T0275/a.md')).toEqual([])
    expect(refs('`https://example.test/docs/a.md`')).toEqual([])
    expect(refs('file:///C:/sample/a.md')).toEqual([])
  })

  it('accepts backslash and forward slash paths; the reference path uses /', () => {
    expect(refs(`開 \`docs${BS}sample${BS}a.md\``).map(p => p.ref)).toEqual([{ kind: 'path', path: 'docs/sample/a.md' }])
    expect(refs(`開 docs${BS}sample${BS}b.md 看`).map(p => p.ref)).toEqual([{ kind: 'path', path: 'docs/sample/b.md' }])
  })

  it('drops a :line suffix from the path but keeps it in the text', () => {
    const [part] = refs('`src/sample.ts:12`')
    expect(part.text).toBe('src/sample.ts:12')
    expect(part.ref).toEqual({ kind: 'path', path: 'src/sample.ts' })
  })

  it('ignores pieces without a slash or an extension, and UNC paths', () => {
    // T0935 (Q-1 A): `sample.md` moved to the file name tests below; it is a candidate now
    expect(refs('版本 v0.8.0 與 `npm run build` 與 docs/folder')).toEqual([])
    expect(refs(`${BS}${BS}host${BS}share${BS}a.md`)).toEqual([])
    expect(refs('.github/.gitignore')).toEqual([])
  })

  it('a non-ASCII file name only inside backticks', () => {
    expect(refs('看 `文件/說明.md`').map(p => p.ref)).toEqual([{ kind: 'path', path: '文件/說明.md' }])
    expect(refs('看 文件/說明.md')).toEqual([])
  })

  it('does not take an id out of a longer word or a path', () => {
    expect(refs('XT0275 和 T0275x 和 _ct-workorders/T0275-sample.md').map(p => p.text)).toEqual(['_ct-workorders/T0275-sample.md'])
  })

  it('fileRefsOf deduplicates', () => {
    expect(fileRefsOf(splitFileRefs('T0275、T0275 與 `T0275`'))).toEqual([{ kind: 'id', id: 'T0275', idKind: 'workorder' }])
  })
})

describe('splitFileRefs: file names without a slash (T0935)', () => {
  const name = (path: string) => ({ kind: 'path' as const, path })

  it('a bare file name is a candidate (moved from the T0930 test above)', () => {
    expect(refs('與 sample.md 與').map(p => p.ref)).toEqual([name('sample.md')])
  })

  it('a name in parentheses, starting with _', () => {
    const text = '回覆對方專案 (_reply-2026-11-26-topic.md)'
    expect(refs(text).map(p => p.text)).toEqual(['_reply-2026-11-26-topic.md'])
    expect(refs('看（_tower-state.md）').map(p => p.ref)).toEqual([name('_tower-state.md')])
    expect(joined(text)).toBe(text)
  })

  it('a name in backticks; the backticks stay text', () => {
    expect(splitFileRefs('改 `package.json` 的版號')).toEqual([
      { kind: 'text', text: '改 `' },
      { kind: 'ref', text: 'package.json', ref: name('package.json') },
      { kind: 'text', text: '` 的版號' },
    ])
    expect(refs('看 `說明.md`').map(p => p.ref)).toEqual([name('說明.md')])
  })

  it('a name in a sentence, without trailing sentence punctuation', () => {
    expect(refs('請先讀 README.md 再開工').map(p => p.text)).toEqual(['README.md'])
    expect(refs('Read README.md.').map(p => p.text)).toEqual(['README.md'])
  })

  it('next to Chinese text and full-width punctuation', () => {
    expect(refs('請看README.md，然後改CHANGELOG.md。').map(p => p.text)).toEqual(['README.md', 'CHANGELOG.md'])
    expect(refs('「notes.txt」、『plan.yaml』；sample.md：').map(p => p.text)).toEqual(['notes.txt', 'plan.yaml', 'sample.md'])
  })

  it('version numbers are not names', () => {
    expect(refs('版本 0.8.0、v1.2、v0.8.0-pre.7 與 1.2')).toEqual([])
    expect(refs('`0.8.0` 與 `v1.2`')).toEqual([])
  })

  it('a domain name is only a candidate (it links only when such a file exists)', () => {
    expect(refs('見 github.com 與 example.org').map(p => p.ref)).toEqual([name('github.com'), name('example.org')])
    // inside a URL nothing is taken
    expect(refs('https://github.com/sample/repo')).toEqual([])
  })

  it('incomplete names are not names', () => {
    expect(refs('只有 .md 或 file. 或 .gitignore 或 `.md` 或 `file.`')).toEqual([])
  })

  it('boundaries: not inside a longer word, an email, or with :line / @ / ~ after it', () => {
    expect(refs('a@sample.md 與 user@example.org')).toEqual([])
    expect(refs('README.md:12 與 README.md@x 與 README.md~')).toEqual([])
    expect(refs('a.md_b 與 x.md-y')).toEqual([])
  })

  it('an extension has 1–8 letters / digits', () => {
    expect(refs('a.abcdefgh 與 b.abcdefghi').map(p => p.text)).toEqual(['a.abcdefgh'])
  })

  it('a name led by an id stays the id (T0930 behavior)', () => {
    expect(refs('見 T0275-sample.md').map(p => p.ref)).toEqual([{ kind: 'id', id: 'T0275', idKind: 'workorder' }])
  })

  it('resolves against the root, then _ct-workorders/', () => {
    expect(refLookups('/work/sample-ws', name('_reply-2026-11-26-topic.md'))).toEqual([
      { kind: 'stat', abs: '/work/sample-ws/_reply-2026-11-26-topic.md', rel: '_reply-2026-11-26-topic.md' },
      { kind: 'stat', abs: '/work/sample-ws/_ct-workorders/_reply-2026-11-26-topic.md', rel: '_ct-workorders/_reply-2026-11-26-topic.md' },
    ])
  })
})

describe('resolveRefPath', () => {
  const ROOT = '/work/sample-ws'
  const WIN = `D:${BS}work${BS}sample-ws`

  it('tries the root, then _ct-workorders/', () => {
    expect(resolveRefPath(ROOT, 'docs/a.md')).toEqual(['docs/a.md', '_ct-workorders/docs/a.md'])
    expect(resolveRefPath(ROOT, './docs/a.md')).toEqual(['docs/a.md', '_ct-workorders/docs/a.md'])
    expect(resolveRefPath(ROOT, '_ct-workorders/T0930-x.md')).toEqual(['_ct-workorders/T0930-x.md'])
  })

  it('accepts an absolute path under the root only', () => {
    expect(resolveRefPath(ROOT, '/work/sample-ws/docs/a.md')).toEqual(['docs/a.md'])
    expect(resolveRefPath(ROOT, '/work/other/docs/a.md')).toBeNull()
    expect(resolveRefPath(ROOT, '/work/sample-ws-2/a.md')).toBeNull()
    expect(resolveRefPath(WIN, 'd:/WORK/sample-ws/docs/a.md')).toEqual(['docs/a.md'])
    expect(resolveRefPath(WIN, `D:${BS}work${BS}other${BS}a.md`)).toBeNull()
  })

  it('never resolves .., URLs, UNC, ~ or without a root', () => {
    expect(resolveRefPath(ROOT, '../outside/a.md')).toBeNull()
    expect(resolveRefPath(ROOT, 'docs/../../a.md')).toBeNull()
    expect(resolveRefPath(ROOT, '/work/sample-ws/../x/a.md')).toBeNull()
    expect(resolveRefPath(ROOT, 'https://example.test/a.md')).toBeNull()
    expect(resolveRefPath(ROOT, '//host/share/a.md')).toBeNull()
    expect(resolveRefPath(ROOT, `${BS}${BS}host${BS}share${BS}a.md`)).toBeNull()
    expect(resolveRefPath(ROOT, '~/a.md')).toBeNull()
    expect(resolveRefPath(ROOT, 'C:a.md')).toBeNull()
    expect(resolveRefPath(null, 'docs/a.md')).toBeNull()
  })
})

describe('refLookups / matchIdFile', () => {
  const ROOT = '/work/sample-ws'

  it('a path: stat candidates joined to the root', () => {
    expect(refLookups(ROOT, { kind: 'path', path: 'docs/a.md' })).toEqual([
      { kind: 'stat', abs: '/work/sample-ws/docs/a.md', rel: 'docs/a.md' },
      { kind: 'stat', abs: '/work/sample-ws/_ct-workorders/docs/a.md', rel: '_ct-workorders/docs/a.md' },
    ])
    expect(joinRoot(`D:${BS}ws${BS}`, 'a.md')).toBe(`D:${BS}ws/a.md`)
  })

  it('an id: the hot folder, then its archive folder', () => {
    const dirs = (id: Parameters<typeof refLookups>[1]) => refLookups(ROOT, id).map(l => (l.kind === 'dir' ? l.relDir : l.rel))
    expect(dirs({ kind: 'id', id: 'T0275', idKind: 'workorder' })).toEqual(['_ct-workorders', '_ct-workorders/_archive/workorders'])
    expect(dirs({ kind: 'id', id: 'BUG-048', idKind: 'bug' })).toEqual(['_ct-workorders', '_ct-workorders/_archive/bugs'])
    expect(dirs({ kind: 'id', id: 'PLAN-069', idKind: 'plan' })).toEqual(['_ct-workorders', '_ct-workorders/_archive/plans'])
    expect(dirs({ kind: 'id', id: 'EXP-A-001', idKind: 'exp' })).toEqual(['_ct-workorders', '_ct-workorders/_archive/workorders'])
    expect(dirs({ kind: 'id', id: 'D370', idKind: 'decision' })).toEqual(['_ct-workorders/_decision-log.md'])
    expect(refLookups(null, { kind: 'id', id: 'T0275', idKind: 'workorder' })).toEqual([])
  })

  it('matchIdFile takes <id>-….md or <id>.md, not a longer id', () => {
    const names = ['T02751-other.md', 'T0275-sample.md', 'CP-T0275-x.md', 'T0275-sample.txt']
    expect(matchIdFile('T0275', names)).toBe('T0275-sample.md')
    expect(matchIdFile('T0275', ['T0275.md'])).toBe('T0275.md')
    expect(matchIdFile('CP-T0275', names)).toBe('CP-T0275-x.md')
    expect(matchIdFile('T0276', names)).toBeNull()
  })
})
