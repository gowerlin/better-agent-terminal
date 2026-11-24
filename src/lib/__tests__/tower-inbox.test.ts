/**
 * PLAN-068 W5 / T0908: the contract v2 lists (T0902 §3.3), CT times (`+0800` / `+08:00`), `source`
 * short labels, the answer lines, and the W5 additions to inbox-model / ct-tower-overview / the work
 * order parser (`waiting_user`).
 */
import { describe, expect, it } from 'vitest'
import {
  ACTION_ID,
  INBOX_ANSWER_MAX_CHARS,
  actionAnswerText,
  awaitingAnswerText,
  awaitingSourceLabelKey,
  checkInboxAnswer,
  dueReminders,
  formatCtTime,
  parseAwaitingOptions,
  parseCtTime,
  parseTowerInboxLists,
  parseWaitingUser,
  userActionKindLabelKey,
} from '../tower-inbox'
import {
  CLAUDE_PANEL_PRESETS,
  RECENTLY_CLOSED_MAX,
  inboxActionCount,
  inboxAnswerTargets,
  nextRecentlyClosed,
  panelTowerTerminalIds,
  workspaceHasPanelTowers,
} from '../inbox-model'
import { effectiveUserInbox, parseTowerConfigYaml, parseTowerStateInbox } from '../ct-tower-overview'
import { parseWorkOrder } from '../../types/control-tower'

describe('parseCtTime / formatCtTime', () => {
  const utc = Date.UTC(2026, 10, 24, 19, 10, 23) // 2026-11-25T03:10:23+08:00
  it('accepts +08:00, +0800 and Z', () => {
    expect(parseCtTime('2026-11-25T03:10:23+08:00')).toBe(utc)
    expect(parseCtTime('2026-11-25T03:10:23+0800')).toBe(utc)
    expect(parseCtTime('2026-11-24T19:10:23Z')).toBe(utc)
    expect(parseCtTime('2026-11-25 03:10:23 +0800')).toBe(utc)
    expect(parseCtTime('2026-11-24T14:10:23-05:00')).toBe(utc)
  })
  it('date only and no offset are local', () => {
    expect(parseCtTime('2026-12-02')).toBe(new Date(2026, 11, 2).getTime())
    expect(parseCtTime('2026-12-02T08:30')).toBe(new Date(2026, 11, 2, 8, 30).getTime())
  })
  it('rejects anything else (shown as written)', () => {
    for (const bad of ['', 'yesterday', '2026-13-01', '2026-02-30', '2026-11-25T25:00:00Z', '2026-11-25T03:10:23+08:99', '11/25/2026']) {
      expect(parseCtTime(bad)).toBeNull()
      if (bad) expect(formatCtTime(bad)).toBe(bad)
    }
    expect(parseCtTime(undefined)).toBeNull()
  })
  it('formats parsed values locally', () => {
    expect(formatCtTime('2026-12-02')).toBe('2026-12-02')
    const d = new Date(utc)
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(formatCtTime('2026-11-25T03:10:23+0800')).toBe(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`)
  })
})

describe('source / kind labels', () => {
  it('known full names have a short label; unknown ones are shown as written', () => {
    for (const source of ['breakpoint-A', 'breakpoint-B-1', 'breakpoint-B-2', 'breakpoint-C', 'breakpoint-E', 'worker-question', 'tower-question']) {
      expect(awaitingSourceLabelKey(source)).toBe(`inbox.source.${source}`)
    }
    expect(awaitingSourceLabelKey('breakpoint-Z')).toBeNull()
    expect(awaitingSourceLabelKey(undefined)).toBeNull()
    expect(userActionKindLabelKey('verify')).toBe('inbox.actionKind.verify')
    expect(userActionKindLabelKey('deploy')).toBeNull()
  })
})

describe('parseAwaitingOptions (§3.2 1″ ①)', () => {
  it('<代號> <說明> → buttons, codes as written', () => {
    expect(parseAwaitingOptions(['A 收件匣', 'b2 回合 卡片'])).toEqual({ options: [{ code: 'A', label: '收件匣' }, { code: 'b2', label: '回合 卡片' }], invalid: false })
  })
  it('any bad option, a duplicate code (case-insensitive), a non-list → free answer', () => {
    expect(parseAwaitingOptions(['A 收件匣', '回合卡片'])).toEqual({ options: null, invalid: true })
    expect(parseAwaitingOptions(['ABCD 太長'])).toEqual({ options: null, invalid: true })
    expect(parseAwaitingOptions(['A one', 'a two'])).toEqual({ options: null, invalid: true })
    expect(parseAwaitingOptions(['A one', 3])).toEqual({ options: null, invalid: true })
    expect(parseAwaitingOptions('A one')).toEqual({ options: null, invalid: true })
    expect(parseAwaitingOptions(['A-1 x'])).toEqual({ options: null, invalid: true })
  })
  it('none / empty → free answer, not invalid', () => {
    expect(parseAwaitingOptions(undefined)).toEqual({ options: null, invalid: false })
    expect(parseAwaitingOptions([])).toEqual({ options: null, invalid: false })
  })
})

describe('parseTowerInboxLists (§3.3)', () => {
  const fm = {
    next_ids: { user: 'U-6', action: 'A-3', plan: 'PLAN-9' },
    awaiting_user: [
      { id: 'U-5', summary: '要不要升 0.8.1？', created_at: '2026-11-25T05:00:00+0800' },
      { id: 'U-3', workorder: 'T0901', kind: 'decision', source: 'breakpoint-A', summary: 'T0901 二選一', options: ['A 收件匣', 'B 回合卡片'], created_at: '2026-11-25T03:10:23+08:00', extra: 'ignored' },
      { id: 'U-4', summary: '沒有時間', source: 'mystery-source' },
      { id: 'U-3', summary: 'duplicate' },
      { id: 'X-1', summary: 'bad id' },
      { id: 'U-7' },
      'not a map',
      { id: 'U-8', summary: '   ' },
    ],
    user_actions: [
      { id: 'A-2', title: 'v0.8.0-pre.2 NSIS 重裝驗收', ref: 'D324', kind: 'verify', command: 'pwsh -File e2e/manual/x.ps1', created_at: '2026-11-25T03:02:00+08:00' },
      { id: 'A-1', title: 't'.repeat(121) },
      { id: 'A-4', title: 'long command dropped', command: 'x'.repeat(301) },
      { id: 'B-1', title: 'bad id' },
    ],
    reminders: [
      { id: 'weekly-log-review', title: '每週日誌清查', ref: 'PLAN-067', last_at: '2026-11-18', due_at: '2026-12-02' },
      { id: 'bad-due', title: 'x', due_at: 'someday' },
      { id: 'Upper', title: 'bad id', due_at: '2026-12-02' },
      { id: 'no-title', due_at: '2026-12-02' },
    ],
    unknown_key: [1, 2],
  }
  const lists = parseTowerInboxLists(fm)

  it('keeps good items, skips and counts bad ones, ignores unknown keys', () => {
    expect(lists.awaiting.map(i => i.id)).toEqual(['U-3', 'U-5', 'U-4'])
    expect(lists.skipped).toEqual({ awaiting: 5, actions: 2, reminders: 3 })
    expect(lists.actions.map(i => i.id)).toEqual(['A-2', 'A-4'])
    expect(lists.reminders.map(i => i.id)).toEqual(['weekly-log-review'])
    expect(lists.present).toEqual({ awaiting: true, actions: true, reminders: true })
    expect(lists.nextUser).toBe('U-6')
    expect(lists.nextAction).toBe('A-3')
  })
  it('fields as written; options parsed; unknown source kept', () => {
    const u3 = lists.awaiting[0]
    expect(u3).toEqual({
      id: 'U-3', workorder: 'T0901', kind: 'decision', source: 'breakpoint-A', summary: 'T0901 二選一',
      options: [{ code: 'A', label: '收件匣' }, { code: 'B', label: '回合卡片' }], optionsInvalid: false,
      createdAt: '2026-11-25T03:10:23+08:00',
    })
    expect(lists.awaiting[2].source).toBe('mystery-source')
    expect(lists.actions[0]).toMatchObject({ ref: 'D324', kind: 'verify', command: 'pwsh -File e2e/manual/x.ps1' })
    expect(lists.actions[1].command).toBeUndefined()
  })
  it('a list that is not a list / missing keys', () => {
    const empty = parseTowerInboxLists({ awaiting_user: 'nope', user_actions: null })
    expect(empty.awaiting).toEqual([])
    expect(empty.present).toEqual({ awaiting: true, actions: true, reminders: false })
    expect(parseTowerInboxLists(null).present).toEqual({ awaiting: false, actions: false, reminders: false })
    expect(ACTION_ID.test('A-12')).toBe(true)
  })
})

describe('dueReminders (§2.3: due, or within 7 days)', () => {
  const now = new Date(2026, 11, 4, 12, 0).getTime() // local 2026-12-04 12:00
  const r = (id: string, dueAt: string) => ({ id, title: id, dueAt, due: parseCtTime(dueAt)! })
  it('filters and orders by due', () => {
    const due = dueReminders([r('later', '2026-12-20'), r('soon', '2026-12-10'), r('today', '2026-12-04'), r('old', '2026-12-02'), r('edge', '2026-12-11T11:59')], now)
    expect(due.map(d => [d.id, d.days])).toEqual([['old', 2], ['today', 0], ['soon', -6], ['edge', -7]])
  })
})

describe('answers', () => {
  it('builds the contract lines (full-width colon, one line)', () => {
    expect(awaitingAnswerText('U-3', 'B')).toBe('U-3：B')
    expect(awaitingAnswerText('U-5', ' 先不要\n下週再說 ')).toBe('U-5：先不要 下週再說')
    expect(actionAnswerText('A-2', 'done')).toBe('A-2：完成')
    expect(actionAnswerText('A-2', 'failed', '安裝程式\r\n跳錯')).toBe('A-2：失敗 安裝程式 跳錯')
    expect(actionAnswerText('A-2', 'failed')).toBe('A-2：失敗')
  })
  it('checkInboxAnswer (the host check)', () => {
    expect(checkInboxAnswer('U-3：B')).toBe('ok')
    expect(checkInboxAnswer('A-2:完成')).toBe('ok')
    expect(checkInboxAnswer(3)).toBe('not-string')
    expect(checkInboxAnswer('')).toBe('empty')
    expect(checkInboxAnswer('U-3：B\n')).toBe('multiline')
    expect(checkInboxAnswer(`U-3：${'x'.repeat(INBOX_ANSWER_MAX_CHARS)}`)).toBe('too-long')
    expect(checkInboxAnswer('hello')).toBe('bad-prefix')
    expect(checkInboxAnswer('U-3： ')).toBe('bad-prefix')
    expect(checkInboxAnswer(' U-3：B')).toBe('bad-prefix')
  })
})

describe('waiting_user', () => {
  it('parseWaitingUser', () => {
    expect(parseWaitingUser('U-3')).toBe('U-3')
    expect(parseWaitingUser(' U-3 ')).toBe('U-3')
    expect(parseWaitingUser('A-3')).toBeNull()
    expect(parseWaitingUser(3)).toBeNull()
  })
  it('parseWorkOrder sets waitingUser only when well-formed', () => {
    const doc = (extra: string) => `---\nschema_version: 1\nschema_kind: workorder\nid: T0901\ntitle: "x"\nstatus: IN_PROGRESS\n${extra}---\n\n# T0901\n`
    expect(parseWorkOrder('T0901-x.md', doc('waiting_user: "U-3"\n')).waitingUser).toBe('U-3')
    expect(parseWorkOrder('T0901-x.md', doc('waiting_user: "maybe"\n')).waitingUser).toBeUndefined()
    expect('waitingUser' in parseWorkOrder('T0901-x.md', doc(''))).toBe(false)
  })
})

describe('ct-tower-overview W5 additions', () => {
  it('parseTowerStateInbox: only a tower-state summary', () => {
    const state = `---\nschema_kind: tower-state\nsummary_version: 1\nbat_contract: 2\nawaiting_user:\n  - id: "U-1"\n    summary: "x"\n---\n# x\n`
    expect(parseTowerStateInbox(state)?.awaiting.map(i => i.id)).toEqual(['U-1'])
    expect(parseTowerStateInbox('# no frontmatter')).toBeNull()
    expect(parseTowerStateInbox('---\nschema_kind: other\nsummary_version: 1\n---\n')).toBeNull()
    expect(parseTowerStateInbox('---\n: : bad\n---\n')).toBeNull()
  })
  it('effectiveUserInbox: the first layer that sets it; off / false / no → off', () => {
    const layer = (text: string) => parseTowerConfigYaml(text).values
    expect(effectiveUserInbox(null, null)).toBe('on')
    expect(effectiveUserInbox(layer('user_inbox: off\n'), layer('user_inbox: on\n'))).toBe('off')
    expect(effectiveUserInbox(layer('other: 1\n'), layer('control-tower:\n  user_inbox: false\n'))).toBe('off')
    expect(effectiveUserInbox(layer('user_inbox: on\n'), layer('user_inbox: off\n'))).toBe('on')
  })
})

describe('inbox-model W5 additions', () => {
  it('panel Towers: T0909 definition', () => {
    expect(CLAUDE_PANEL_PRESETS).toEqual(['claude-code', 'claude-code-worktree'])
    expect(workspaceHasPanelTowers(2, 0)).toBe(true)
    expect(workspaceHasPanelTowers(2, 1)).toBe(false)
    expect(workspaceHasPanelTowers(1, 0)).toBe(false)
    expect(workspaceHasPanelTowers(null, 0)).toBe(false)
    const tabs = [{ id: 'a', agentPreset: 'claude-code' }, { id: 'b', agentPreset: 'codex-agent' }, { id: 'c', agentPreset: 'claude-code-worktree' }, { id: 'd' }]
    expect(panelTowerTerminalIds(tabs, 2, 0)).toEqual(['a', 'c'])
    expect(panelTowerTerminalIds(tabs, 2, 1)).toEqual([])
  })
  it('answer targets: declared contract-2 Towers only; panels only without declared Towers', () => {
    const panels = [{ id: 'p1', title: 'Panel 1' }]
    const one = inboxAnswerTargets([{ id: 't1', title: 'T1', towerContract: 2 }, { id: 't0', title: 'old', towerContract: null }], panels, 2)
    expect(one.targets).toEqual([{ kind: 'tab', id: 't1', title: 'T1' }])
    expect(one.auto).toEqual({ kind: 'tab', id: 't1', title: 'T1' })
    const two = inboxAnswerTargets([{ id: 't1', title: 'T1', towerContract: 2 }, { id: 't2', title: 'T2', towerContract: 2 }], panels, 2)
    expect(two.targets.map(t => t.id)).toEqual(['t1', 't2'])
    expect(two.auto).toBeNull()
    expect(inboxAnswerTargets([], panels, 2)).toEqual({ targets: [{ kind: 'panel', id: 'p1', title: 'Panel 1' }], auto: { kind: 'panel', id: 'p1', title: 'Panel 1' } })
    expect(inboxAnswerTargets([], panels, 1)).toEqual({ targets: [], auto: null })
    expect(inboxAnswerTargets([{ id: 't0', title: 'old', towerContract: 1 }], panels, 2)).toEqual({ targets: [], auto: null })
  })
  it('recently closed: gone items first, at most 10, a returning id taken off', () => {
    const before = { awaiting: [{ id: 'U-1', summary: 's1' }, { id: 'U-2', summary: 's2' }], actions: [{ id: 'A-1', title: 'a1' }] }
    const after = { awaiting: [{ id: 'U-2' }], actions: [] }
    const closed = nextRecentlyClosed([], before, after, 5)
    expect(closed).toEqual([{ id: 'U-1', text: 's1', closedAt: 5 }, { id: 'A-1', text: 'a1', closedAt: 5 }])
    expect(nextRecentlyClosed(closed, { awaiting: [{ id: 'U-2', summary: 's2' }], actions: [] }, after, 6)).toBe(closed)
    expect(nextRecentlyClosed(closed, { awaiting: [], actions: [] }, { awaiting: [{ id: 'U-1' }], actions: [] }, 7).map(c => c.id)).toEqual(['A-1'])
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `U-${i}`, summary: `s${i}` }))
    expect(nextRecentlyClosed([], { awaiting: many, actions: [] }, { awaiting: [], actions: [] }, 1)).toHaveLength(RECENTLY_CLOSED_MAX)
  })
  it('the title number adds the CT lists', () => {
    expect(inboxActionCount({ workerItems: 1, pendingBugs: 2 })).toBe(3)
    expect(inboxActionCount({ workerItems: 1, pendingBugs: 2, awaiting: 3, actions: 1, reminders: 1 })).toBe(8)
  })
})
