/**
 * PLAN-069 / T0922 (CT 6.2.0-pre.1 memory-protocol.md § 契約 v2 欄位):
 *
 *   - `inbox_features`: a string array; unknown values (`future-value`) ignored; not an array /
 *     missing = []
 *   - `awaiting_user[].recommended`: matched case-insensitively to the item's option codes; no match /
 *     no options / a free answer → no recommendation, the item is NOT skipped and nothing errors
 *   - the 放棄 / 略過 lines (`dismissAnswerText`) and the widened host check (`checkInboxAnswer`):
 *     batches only for 放棄 / 略過, no wildcard / range; single-id lines unchanged
 *
 * The fixture `fixtures/ct-tower-state-v620.md` is a copy of CT's
 * `skills/control-tower/scripts/tests/fixtures/frontmatter/good/tower-state-v620.md` (6.2.0-pre.1,
 * line endings normalised to LF); 「原文標記QZX」is CT's marker for "this text must never be logged".
 */
import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  INBOX_ANSWER_MAX_CHARS,
  INBOX_FEATURES,
  checkInboxAnswer,
  dismissAnswerText,
  inboxAnswerIds,
  inboxAnswerLogIds,
  isDismissAnswer,
  matchRecommended,
  parseAwaitingOptions,
  parseInboxFeatures,
  parseTowerInboxLists,
} from '../tower-inbox'
import { parseTowerStateInbox } from '../ct-tower-overview'

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'ct-tower-state-v620.md'), 'utf8')

describe('CT 6.2.0 fixture (tower-state-v620.md)', () => {
  const lists = parseTowerStateInbox(FIXTURE)!

  it('parses: known inbox_features only, unknown `future-value` ignored', () => {
    expect(lists).not.toBeNull()
    expect(lists.features).toEqual(['recommended', 'dismiss'])
  })

  it('recommended: flow / block options, case-insensitive code, kept as CT wrote the code', () => {
    const byId = new Map(lists.awaiting.map(item => [item.id, item]))
    expect([...byId.keys()]).toEqual(['U-3', 'U-4', 'U-5', 'U-6'])
    // flow options, exact code
    expect(byId.get('U-3')!.recommended).toBe('A')
    // block options, `recommended: "c1"` against the code `C1`
    expect(byId.get('U-4')!.options!.map(o => o.code)).toEqual(['C1', 'b'])
    expect(byId.get('U-4')!.recommended).toBe('C1')
    // free answer (`options: []`) and no `recommended` key → none, the items are kept
    expect(byId.get('U-5')!.options).toBeNull()
    expect('recommended' in byId.get('U-5')!).toBe(false)
    expect('recommended' in byId.get('U-6')!).toBe(false)
    expect(lists.skipped.awaiting).toBe(0)
  })

  it('keeps CT\'s order and the「（推薦）」in the option text (BAT does not reorder or strip)', () => {
    const u3 = lists.awaiting.find(item => item.id === 'U-3')!
    expect(u3.options!.map(o => o.code)).toEqual(['A', 'B', 'C'])
    expect(u3.options![0].label).toBe('接受為 DONE，續派下一張（推薦）')
  })

  it('user_actions are unchanged by the new fields', () => {
    expect(lists.actions.map(a => a.id)).toEqual(['A-3'])
  })
})

describe('parseInboxFeatures', () => {
  it('a string array; unknown values and non-strings ignored; no duplicates', () => {
    expect(INBOX_FEATURES).toEqual(['recommended', 'dismiss'])
    expect(parseInboxFeatures(['dismiss', 'future-value', 'recommended', 'dismiss', 3, null])).toEqual(['dismiss', 'recommended'])
    expect(parseInboxFeatures([' dismiss '])).toEqual(['dismiss'])
    expect(parseInboxFeatures(['DISMISS'])).toEqual([])
  })
  it('not an array / missing → [] (= CT 6.1.x)', () => {
    for (const raw of [undefined, null, 'dismiss', { dismiss: true }, 2, true]) expect(parseInboxFeatures(raw)).toEqual([])
    expect(parseTowerInboxLists({}).features).toEqual([])
    expect(parseTowerInboxLists({ inbox_features: 'dismiss' }).features).toEqual([])
    expect(parseTowerInboxLists(null).features).toEqual([])
  })
})

describe('recommended', () => {
  const options = parseAwaitingOptions(['A one', 'Bb two', 'c3 three']).options

  it('matchRecommended: case-insensitive, returns the code as written', () => {
    expect(matchRecommended('a', options)).toBe('A')
    expect(matchRecommended('BB', options)).toBe('Bb')
    expect(matchRecommended(' C3 ', options)).toBe('c3')
  })

  it('no match / not a string / empty / no options → undefined (no error)', () => {
    expect(matchRecommended('D', options)).toBeUndefined()
    expect(matchRecommended('', options)).toBeUndefined()
    expect(matchRecommended(1, options)).toBeUndefined()
    expect(matchRecommended(undefined, options)).toBeUndefined()
    expect(matchRecommended('A', null)).toBeUndefined()
    expect(matchRecommended('A', [])).toBeUndefined()
  })

  it('an item whose recommended does not match, whose options are empty or unusable is kept, without one', () => {
    const lists = parseTowerInboxLists({
      awaiting_user: [
        { id: 'U-1', summary: 's1', options: ['A x', 'B y'], recommended: 'Z' },
        { id: 'U-2', summary: 's2', options: [], recommended: 'A' },
        { id: 'U-3', summary: 's3', options: ['not-a-code-option'], recommended: 'A' },
        { id: 'U-4', summary: 's4', options: ['A x'], recommended: ['A'] },
        { id: 'U-5', summary: 's5', recommended: 'A' },
      ],
    })
    expect(lists.awaiting.map(item => item.id)).toEqual(['U-1', 'U-2', 'U-3', 'U-4', 'U-5'])
    expect(lists.awaiting.every(item => item.recommended === undefined)).toBe(true)
    expect(lists.skipped.awaiting).toBe(0)
  })
})

describe('放棄 / 略過 lines', () => {
  it('dismissAnswerText: one id or a batch, full-width colon, `、`, note on one line', () => {
    expect(dismissAnswerText(['U-1'], 'awaiting')).toBe('U-1：放棄')
    expect(dismissAnswerText(['U-1'], 'awaiting', '  ')).toBe('U-1：放棄')
    expect(dismissAnswerText(['U-1'], 'awaiting', '改走\n另一條路')).toBe('U-1：放棄 改走 另一條路')
    expect(dismissAnswerText(['A-2'], 'action')).toBe('A-2：略過')
    expect(dismissAnswerText(['A-2'], 'action', '沒機器')).toBe('A-2：略過 沒機器')
    expect(dismissAnswerText(['U-1', 'U-3', 'U-4'], 'awaiting', '不做了')).toBe('U-1、U-3、U-4：放棄 不做了')
    expect(dismissAnswerText(['A-2', 'A-3'], 'action')).toBe('A-2、A-3：略過')
    expect(dismissAnswerText([], 'awaiting')).toBeNull()
  })

  it('every line BAT builds passes the host check', () => {
    for (const text of [
      dismissAnswerText(['U-1'], 'awaiting')!,
      dismissAnswerText(['U-1', 'U-3'], 'awaiting', 'x\r\ny')!,
      dismissAnswerText(['A-2', 'A-3'], 'action')!,
    ]) expect(checkInboxAnswer(text)).toBe('ok')
  })

  it('isDismissAnswer: the first word rule (end, half / full-width space, ，,。；;)', () => {
    for (const ok of ['放棄', ' 放棄', '放棄 原因', '放棄　原因', '放棄，原因', '放棄,x', '放棄。', '放棄；x', '放棄;x', '略過', '略過 原因']) {
      expect(isDismissAnswer(ok)).toBe(true)
    }
    for (const no of ['放棄吧', '放棄了', '略過去', 'A', '不放棄', '', '放 棄']) expect(isDismissAnswer(no)).toBe(false)
  })
})

describe('checkInboxAnswer — PLAN-069 batches', () => {
  it('multi-id + 放棄 / 略過 accepted (`、` `,` `，`, spaces around them, either colon, mixed U / A)', () => {
    for (const ok of [
      'U-1、U-3：放棄',
      'U-1、U-3、U-4：放棄 改方向',
      'U-1,U-3:放棄',
      'U-1 ， U-3 ：放棄，不合時宜',
      'A-2、A-3：略過',
      'A-2、A-3：  略過 沒環境',
      'U-1、A-2：放棄',
      'U-1、U-3：略過',
    ]) expect(checkInboxAnswer(ok)).toBe('ok')
  })

  it('multi-id + an option code / free text → bad-batch', () => {
    for (const bad of ['U-1、U-3：A', 'U-1、U-3：先不要', 'U-1、U-3：放棄吧', 'A-2、A-3：完成', 'A-2、A-3：失敗 x', 'U-1、U-3：']) {
      expect(checkInboxAnswer(bad)).toBe('bad-batch')
    }
  })

  it('wildcards and ranges are refused', () => {
    for (const bad of ['U-*：放棄', 'U-1～U-5：放棄', 'U-1-5：放棄', 'U-1..U-3：放棄', 'U-1、U-*：放棄', '*：放棄', 'U-1、：放棄', 'U-1、、U-2：放棄']) {
      expect(checkInboxAnswer(bad)).not.toBe('ok')
    }
  })

  it('one line and 1,000 characters, as before', () => {
    expect(checkInboxAnswer('U-1、U-3：放棄\nU-4：放棄')).toBe('multiline')
    expect(checkInboxAnswer(`U-1、U-3：放棄 ${'x'.repeat(INBOX_ANSWER_MAX_CHARS)}`)).toBe('too-long')
    const max = `U-1、U-3：放棄 ${'x'.repeat(INBOX_ANSWER_MAX_CHARS - 'U-1、U-3：放棄 '.length)}`
    expect(max.length).toBe(INBOX_ANSWER_MAX_CHARS)
    expect(checkInboxAnswer(max)).toBe('ok')
  })

  it('single-id lines unchanged (incl. 放棄 / 略過 as text)', () => {
    expect(checkInboxAnswer('U-3：B')).toBe('ok')
    expect(checkInboxAnswer('U-3：放棄')).toBe('ok')
    expect(checkInboxAnswer('A-2：略過 x')).toBe('ok')
    expect(checkInboxAnswer('U-3 ：B')).toBe('bad-prefix')
    expect(checkInboxAnswer(' U-1、U-3：放棄')).toBe('bad-prefix')
  })
})

describe('log fragments (ids and counts only)', () => {
  it('inboxAnswerIds / inboxAnswerLogIds', () => {
    expect(inboxAnswerIds('U-3：B')).toEqual(['U-3'])
    expect(inboxAnswerIds('U-1、U-3、U-4：放棄 原文標記QZX')).toEqual(['U-1', 'U-3', 'U-4'])
    expect(inboxAnswerIds('hello')).toEqual([])
    expect(inboxAnswerLogIds('U-3：B')).toBe('id=U-3')
    expect(inboxAnswerLogIds('A-2、A-3：略過 原文標記QZX')).toBe('id=A-2 ids=2')
    expect(inboxAnswerLogIds('nothing')).toBe('id=?')
    // the text after the colon (an option code here) never reaches the fragment
    expect(inboxAnswerLogIds('U-1、U-3：放棄 原文標記QZX')).not.toContain('QZX')
  })
})
