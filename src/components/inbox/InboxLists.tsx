/**
 * PLAN-068 W5 / T0908: the CT contract v2 lists of the「待辦」(Inbox) tab (T0902 §1 / §2.1 / §2.2):
 *
 *   ⏸ 待你決定   `awaiting_user` — option buttons (`<代號> <說明>`) + 送出, or a free answer box;
 *                 ⏸ + 「暫停中」for the open work orders whose `waiting_user` names it
 *   🙋 待你執行   `user_actions` — `command` has only「複製」(🔴 BAT never runs it);「完成」/「失敗…」
 *                 T0936: references in `command` link; a `command` that is one existing file as a whole
 *                 (`soleFileRef`) shows as a link with「開啟」instead of「複製」(opens in the「檔案」tab)
 *   ⏰ 到期提醒   `reminders` due or due within 7 days
 *   最近已結      the last 10 items that left the two lists (memory only)
 *
 * An answer is one line (`U-n：<代號或自由文字>` / `A-n：完成` / `A-n：失敗 <說明>`, src/lib/tower-inbox.ts)
 * sent by `sendInboxAnswer` to the workspace's Tower (`answerTargets`: exactly one → sent; several →
 * the user picks; none → nothing to send to). Read-only otherwise: nothing here writes a CT file.
 * 🔴 Logs (in src/lib/inbox-answer.ts) carry ids and lengths only.
 *
 * PLAN-069 / T0922 (CT 6.2.0):
 *   - `recommended` → a「推薦」mark on that option, selected by default until the user picks one
 *     (CT's order kept, the「（推薦）」in the text kept); shown whenever the field matches
 *   - `dismiss` (only when `inbox_features` lists it; otherwise nothing below is drawn): per row
 *    「放棄…」/「略過…」with an optional one-line note (`U-n：放棄[ 文字]` / `A-n：略過[ 文字]`), a check
 *     box per row, and per list「放棄勾選（N）」/「全部放棄」(「略過…」) with one note and an in-page
 *     confirmation listing the ids. 🔴「全部」is expanded when sent to the ids listed then; one line
 *     per list (`U-1、U-3：放棄 …`), never a wildcard or a range.
 *
 * T0929 (layout only): an entry is the head line (check box, id, work order, tags), then the summary
 * on a full-width line of its own, then one line per option (or the answer box), then 送出 / 放棄…
 * on a line of their own; the 放棄 note opens below that line. `.inbox-options` / `.inbox-free` stay
 * the outer answer block (e2e t0913 selects the send button through them).
 *
 * T0937: an awaiting item with options ends its radio group with「其他（自由回答）」(never the default,
 * never 推薦; `options: []` / invalid options keep the plain answer box). Picking it opens a one-line box
 * below the list; 送出 sends `U-n：<文字>` through the same path. Text starting with the word 放棄 / 略過
 * shows a hint (CT reads it as giving up) but still sends. The 放棄 note is a reason only.
 * T0938: the plain answer box (`options: []` / invalid options) shows the same hint.
 *
 * T0938 (CT 6.3.0): an item with `multi` (`awaitingIsMulti`: `inbox_features: multi` + `multi: true` +
 * ≥ 2 options) is drawn as check boxes (`role="group"`, a「可複選」line above): every recommended code
 * (`recommendedCodes`) marked and checked by default;「其他」stays last and is exclusive with the checks
 * (picking it clears them, checking one clears it). 送出 sends `U-n：A、C` in `options` order
 * (`multiAnswerText`) or `U-n：<文字>`. Without `multi` the item is drawn exactly as before.
 *
 * T0930: the `workorder` / `ref` tags and the summary / title text show their existing file references
 * as links that open in the「檔案」tab (`InboxRefTag` / `InboxRefText`, existence check
 * `useInboxFileRefs` per list, recognition src/lib/inbox-file-refs.ts). Without `folder`: plain text.
 *
 * T0942 (D412, only a reminder — nothing is blocked): an answer that went out (`sent`, or `held` in
 * the Tower tab's「📨 待送」) marks its row「✓ 已送出：<line>（HH:MM）」(「已排入待送」when held), and a
 * batch line marks its toolbar and each of its rows. The row keeps what it was sent with (option,
 * checks,「其他」text, answer box; never reset to the 推薦 default, which applies only to a row never
 * sent) and its 送出 reads「重新送出」: another pick sends a new line, no confirmation. The records live
 * in `inbox-sent-store` (memory only, per folder + item id), so a tab switch / remount keeps them; they
 * are forgotten when the item leaves the list. Failed sends are shown as before, never marked.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  INBOX_LIST_RENDER_MAX,
  actionAnswerText,
  awaitingAnswerText,
  awaitingSourceLabelKey,
  dismissAnswerText,
  formatCtTime,
  formatSentClock,
  isDismissAnswer,
  multiAnswerText,
  userActionKindLabelKey,
  type AwaitingItem,
  type DueReminder,
  type UserAction,
} from '../../lib/tower-inbox'
import { sendInboxAnswer, type InboxAnswerOutcome } from '../../lib/inbox-answer'
import { InboxRefTag, InboxRefText, RefLink } from './InboxRefText'
import { commandFileRefs, itemFileRefs, useInboxFileRefs, type InboxRefLinks } from './useInboxFileRefs'
import { fileRefKey, soleFileRef } from '../../lib/inbox-file-refs'
import { openFileInFilesTab } from '../../state/openFileInFilesTab'
import { useNotifyHold, useNotifyHoldReason } from '../../stores/notify-hold-store'
import { notifyHoldReasonKey } from '../TerminalThumbnail'
import type { InboxAnswerTarget, RecentlyClosed } from '../../lib/inbox-model'
import {
  batchSentKey,
  recordInboxSent,
  useInboxSentMap,
  type InboxAwaitingSelection,
  type InboxSentRecord,
} from '../../stores/inbox-sent-store'

type Targets = { targets: InboxAnswerTarget[]; auto: InboxAnswerTarget | null }

/** Per item: the last answer's outcome, shown under it. */
type Status = InboxAnswerOutcome | { status: 'no-target' } | { status: 'sending' }

/** T0942: how a line that goes out is recorded (`inbox-sent-store`). */
interface SentInfo {
  /** The store key: the item id, or `batchSentKey(kind)` for a batch line. */
  key: string
  /** The ids the line answers; a batch line also marks each of them. */
  ids: readonly string[]
  /** A ⏸ row's selection when sent (restored on remount). */
  selection?: InboxAwaitingSelection
}

/**
 * Sends answer lines for one Inbox: to `auto` directly; with several targets the user picks one
 * first (`pending`); with none, nothing is sent. T0942: a line that went out (`sent` / `held`) is
 * recorded under `scope` (the workspace folder) for the「已送出」mark.
 */
function useAnswerSender(targets: Targets, scope: string) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [pending, setPending] = useState<{ itemId: string; text: string; info: SentInfo } | null>(null)

  const deliver = async (itemId: string, text: string, info: SentInfo, target: InboxAnswerTarget): Promise<boolean> => {
    setStatuses(prev => ({ ...prev, [itemId]: { status: 'sending' } }))
    const outcome = await sendInboxAnswer(target, text)
    setStatuses(prev => ({ ...prev, [itemId]: outcome }))
    if (outcome.status !== 'sent' && outcome.status !== 'held') return false
    const at = Date.now()
    // T0966: a held line remembers its queue item, so the mark can say why it still waits
    const hold = outcome.status === 'held' && outcome.holdId && target.kind === 'tab'
      ? { hold: { terminalId: target.id, holdId: outcome.holdId } }
      : {}
    recordInboxSent(scope, info.key, { text, at, status: outcome.status, ids: info.ids, selection: info.selection, ...hold })
    // a batch line marks each of its rows too (no selection: the row's own choice is not what went out)
    if (info.ids.length > 1 || info.ids[0] !== info.key) {
      for (const id of info.ids) recordInboxSent(scope, id, { text, at, status: outcome.status, ids: [id], ...hold })
    }
    return true
  }

  const send = async (itemId: string, text: string, info: SentInfo): Promise<boolean> => {
    if (targets.auto) return deliver(itemId, text, info, targets.auto)
    if (targets.targets.length === 0) {
      setStatuses(prev => ({ ...prev, [itemId]: { status: 'no-target' } }))
      return false
    }
    setPending({ itemId, text, info })
    return false
  }

  const choose = async (target: InboxAnswerTarget | null) => {
    const current = pending
    setPending(null)
    if (current && target) await deliver(current.itemId, current.text, current.info, target)
  }

  return { statuses, pending, send, choose }
}

function StatusLine({ status }: { status: Status | undefined }) {
  const { t } = useTranslation()
  if (!status) return null
  const text = status.status === 'failed'
    ? t('inbox.answer.failed', { reason: status.reason })
    : t(`inbox.answer.${status.status}`)
  return <div className={`inbox-answer-status inbox-answer-${status.status}`} data-inbox-answer-status={status.status}>{text}</div>
}

/**
 * T0942: the live status and the「已送出」mark of a row / a batch toolbar. A `sent` / `held` outcome is
 * shown by the mark (it carries `data-inbox-answer-status` then); sending / failures keep their status
 * line, above an earlier mark. 🔴 The line is drawn as text only.
 */
function AnswerStatus({ status, sent, id }: { status: Status | undefined; sent: InboxSentRecord | undefined; id: string }) {
  const { t } = useTranslation()
  const live = status && status.status !== 'sent' && status.status !== 'held' ? status : undefined
  if (!sent) return <StatusLine status={status} />
  const values = { text: sent.text, time: formatSentClock(sent.at) }
  return (
    <>
      <StatusLine status={live} />
      <div
        className={`inbox-sent-marker inbox-sent-${sent.status}`}
        data-inbox-sent={id}
        data-inbox-sent-status={sent.status}
        {...(live ? {} : { 'data-inbox-answer-status': sent.status })}
        title={t(sent.status === 'held' ? 'inbox.answer.held' : 'inbox.answer.sent')}
      >
        {t(sent.status === 'held' ? 'inbox.answer.heldMarker' : 'inbox.answer.sentMarker', values)}
      </div>
      {sent.status === 'held' && sent.hold && <HeldAnswerReason hold={sent.hold} id={id} />}
    </>
  )
}

/**
 * T0966 (U-58: A): under a「已排入待送」mark, why the answer still waits — the same text as the Tower
 * thumbnail's 📨 menu (`notifyHoldReasonKey`: 你在輸入 / 你在閱讀 / 等你回答對話框 / 排隊). Shown only while
 * the answer's queue item is still in the tab's queue and the tab reports a reason (contract-2 Tower);
 * otherwise nothing — the mark stays as before. 🔴 Reads the renderer's notify-hold store only.
 */
function HeldAnswerReason({ hold, id }: { hold: { terminalId: string; holdId: string }; id: string }) {
  const { t } = useTranslation()
  const items = useNotifyHold(hold.terminalId)
  const reason = useNotifyHoldReason(hold.terminalId)
  if (!reason || !items.some(item => item.holdId === hold.holdId)) return null
  return (
    <div
      className="inbox-sent-hold-reason"
      data-inbox-sent-hold-reason={id}
      data-reason={reason}
      style={{ fontSize: 12, padding: '2px 6px 0 9px', color: 'var(--text-secondary)', whiteSpace: 'normal' }}
    >
      {t('inbox.answer.heldReason', { reason: t(notifyHoldReasonKey(reason)) })}
    </div>
  )
}

function TargetChooser({ targets, onChoose }: { targets: InboxAnswerTarget[]; onChoose: (target: InboxAnswerTarget | null) => void }) {
  const { t } = useTranslation()
  return (
    <div className="inbox-answer-chooser" data-inbox-target-chooser="">
      <span>{t('inbox.answer.chooseTarget')}</span>
      {targets.map(target => (
        <button key={target.id} className="inbox-btn" data-inbox-target={target.id} onClick={() => onChoose(target)}>
          {target.kind === 'panel' ? t('inbox.answer.panelTarget', { title: target.title }) : target.title}
        </button>
      ))}
      <button className="inbox-btn" onClick={() => onChoose(null)}>{t('common.cancel')}</button>
    </div>
  )
}

type DismissKind = 'awaiting' | 'action'

/** The key the batch toolbar's status / target chooser is kept under (never a `U-n` / `A-n`). */
const BATCH_KEY = '__batch__'

/**
 * PLAN-069: a row's「放棄…」/「略過…」: opens an optional one-line note with send / cancel (in the
 * page, no `window.confirm`), sends `U-n：放棄[ 文字]` / `A-n：略過[ 文字]`.
 *
 * T0929: the button and the note form are returned separately, so the button sits in the row's
 * button line and the form opens below that line (never inside it).
 */
function useDismissControl({ id, kind, busy, onAnswer }: {
  id: string
  kind: DismissKind
  busy: boolean
  onAnswer: (text: string) => Promise<boolean>
}): { button: ReactNode; form: ReactNode } {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const send = async () => {
    const text = dismissAnswerText([id], kind, note)
    if (text && await onAnswer(text)) {
      setOpen(false)
      setNote('')
    }
  }
  const noteLabel = t(kind === 'awaiting' ? 'inbox.dismiss.dismissNote' : 'inbox.dismiss.skipNote')
  return {
    button: (
      <button className="inbox-btn inbox-dismiss-btn" disabled={busy} data-inbox-dismiss={id} aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {t(kind === 'awaiting' ? 'inbox.dismiss.dismiss' : 'inbox.dismiss.skip')}
      </button>
    ),
    form: open && (
        <div className="inbox-free inbox-dismiss-form" data-inbox-dismiss-form={id}>
          <input
            className="inbox-free-input"
            type="text"
            maxLength={900}
            value={note}
            placeholder={noteLabel}
            aria-label={noteLabel}
            data-inbox-dismiss-note={id}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send() }}
          />
          <button className="inbox-btn primary" disabled={busy} data-inbox-dismiss-send={id} onClick={() => void send()}>
            {t(kind === 'awaiting' ? 'inbox.dismiss.sendDismiss' : 'inbox.dismiss.sendSkip')}
          </button>
          <button className="inbox-btn" data-inbox-dismiss-cancel={id} onClick={() => { setOpen(false); setNote('') }}>
            {t('common.cancel')}
          </button>
        </div>
    ),
  }
}

/** PLAN-069: a row's check box for the batch toolbar. */
function DismissCheck({ id, checked, onCheck }: { id: string; checked: boolean; onCheck: (id: string, checked: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <input
      type="checkbox"
      className="inbox-check"
      checked={checked}
      data-inbox-check={id}
      aria-label={t('inbox.dismiss.check', { id })}
      onChange={e => onCheck(id, e.target.checked)}
    />
  )
}

/**
 * PLAN-069: the list's「放棄勾選（N）」/「全部放棄」(「略過…」) toolbar: one optional note, an in-page
 * confirmation listing the ids, then one line for the list. 🔴 The ids are taken when sent: the checked
 * ones still listed, or (「全部」) every id listed then — never a wildcard or a range.
 */
function DismissToolbar({ kind, listedIds, checked, busy, onSend, status, sent, chooser }: {
  kind: DismissKind
  listedIds: readonly string[]
  checked: ReadonlySet<string>
  busy: boolean
  /** T0942: `ids` = the ids the line answers (each row is marked「已送出」too). */
  onSend: (text: string, ids: readonly string[]) => Promise<boolean>
  status: Status | undefined
  /** T0942: the list's last batch line that went out. */
  sent: InboxSentRecord | undefined
  chooser: ReactNode
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'checked' | 'all' | null>(null)
  const [note, setNote] = useState('')
  const checkedIds = listedIds.filter(id => checked.has(id))
  const idsOf = (which: 'checked' | 'all') => (which === 'all' ? [...listedIds] : checkedIds)
  const awaiting = kind === 'awaiting'
  const send = async () => {
    if (!mode) return
    const ids = idsOf(mode)
    const text = dismissAnswerText(ids, kind, note)
    if (!text) { setMode(null); return }
    if (await onSend(text, ids)) {
      setMode(null)
      setNote('')
    }
  }
  const noteLabel = t(awaiting ? 'inbox.dismiss.dismissNote' : 'inbox.dismiss.skipNote')
  const shown = mode ? idsOf(mode) : []
  return (
    <div className="inbox-dismiss-toolbar" data-inbox-dismiss-toolbar={kind}>
      <div className="inbox-actions-row">
        <button className="inbox-btn" disabled={busy || checkedIds.length === 0} data-inbox-dismiss-checked={kind} onClick={() => setMode('checked')}>
          {t(awaiting ? 'inbox.dismiss.dismissChecked' : 'inbox.dismiss.skipChecked', { count: checkedIds.length })}
        </button>
        <button className="inbox-btn" disabled={busy || listedIds.length === 0} data-inbox-dismiss-all={kind} onClick={() => setMode('all')}>
          {t(awaiting ? 'inbox.dismiss.dismissAll' : 'inbox.dismiss.skipAll')}
        </button>
      </div>
      {mode && (
        <div className="inbox-dismiss-confirm" data-inbox-dismiss-confirm={shown.join(',')}>
          <div>{t(awaiting ? 'inbox.dismiss.confirmDismiss' : 'inbox.dismiss.confirmSkip', { ids: shown.join('、') })}</div>
          <div className="inbox-free">
            <input
              className="inbox-free-input"
              type="text"
              maxLength={900}
              value={note}
              placeholder={noteLabel}
              aria-label={noteLabel}
              data-inbox-dismiss-batch-note={kind}
              onChange={e => setNote(e.target.value)}
            />
            <button className="inbox-btn primary" disabled={busy || shown.length === 0} data-inbox-dismiss-batch-send={kind} onClick={() => void send()}>
              {t('inbox.dismiss.confirm')}
            </button>
            <button className="inbox-btn" data-inbox-dismiss-batch-cancel={kind} onClick={() => { setMode(null); setNote('') }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
      {chooser}
      <AnswerStatus status={status} sent={sent} id={batchSentKey(kind)} />
    </div>
  )
}

/** PLAN-069: the batch check boxes of one list (ids no longer listed are simply not sent). */
function useChecked() {
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  const onCheck = (id: string, on: boolean) => setChecked(prev => {
    const next = new Set(prev)
    if (on) next.add(id)
    else next.delete(id)
    return next
  })
  const clear = () => setChecked(new Set())
  return { checked, onCheck, clear }
}

/** "另有 N 筆" below a list cut at `INBOX_LIST_RENDER_MAX` (§3). */
function MoreLine({ total }: { total: number }) {
  const { t } = useTranslation()
  if (total <= INBOX_LIST_RENDER_MAX) return null
  return <div className="inbox-muted" data-inbox-more={total - INBOX_LIST_RENDER_MAX}>{t('inbox.more', { count: total - INBOX_LIST_RENDER_MAX })}</div>
}

function SkippedLine({ count }: { count: number }) {
  const { t } = useTranslation()
  if (count <= 0) return null
  return <div className="inbox-muted" data-inbox-skipped={count}>{t('inbox.skipped', { count })}</div>
}

function AwaitingRow({ item, onAnswer, status, sent, chooser, dismiss, checked, onCheck, links }: {
  item: AwaitingItem & { waitingOrders: string[] }
  /** T0930: the found file references (links in the tag and the summary). */
  links: InboxRefLinks
  /** T0942: `selection` = what the row showed when sent (recorded with the「已送出」mark). */
  onAnswer: (text: string, selection?: InboxAwaitingSelection) => Promise<boolean>
  status: Status | undefined
  /** T0942: the item's「已送出」record (this run, memory only). */
  sent: InboxSentRecord | undefined
  chooser: ReactNode
  /** PLAN-069: `inbox_features` lists `dismiss` → check box + 放棄…. */
  dismiss: boolean
  checked: boolean
  onCheck: (id: string, checked: boolean) => void
}) {
  const { t } = useTranslation()
  // T0942: a row mounted again starts from what it was sent with
  const saved = sent?.selection
  const [choice, setChoice] = useState<string | null>(() => saved?.choice ?? null)
  // T0937:「其他（自由回答）」picked (never the default, never marked 推薦)
  const [other, setOther] = useState(() => saved?.other ?? false)
  const [otherText, setOtherText] = useState(() => saved?.otherText ?? '')
  // PLAN-069: the recommended option is selected until the user picks one;
  // T0942: only while the row was never sent (a sent row shows what went out, or what the user picked since)
  const selected = other ? null : (choice ?? (sent ? null : item.recommended ?? null))
  // T0938: a multiple-choice item (`awaitingIsMulti`); null = untouched → the recommended codes are checked
  const multi = item.multi === true && !!item.options
  const [checks, setChecks] = useState<ReadonlySet<string> | null>(() => (saved?.checks ? new Set(saved.checks) : null))
  const checkedCodes: ReadonlySet<string> = other ? new Set() : (checks ?? new Set(sent ? [] : item.recommendedCodes ?? []))
  const [free, setFree] = useState(() => saved?.free ?? '')
  const sourceKey = awaitingSourceLabelKey(item.source)
  const busy = status?.status === 'sending'
  const dismissControl = useDismissControl({ id: item.id, kind: 'awaiting', busy, onAnswer: text => onAnswer(text) })
  // T0942: nothing is reset after sending; the shown default is pinned first, so it stays once the row is
  // marked sent (the 推薦 default no longer applies then)
  const sendLine = async (line: string) => {
    const pinned = other ? choice : selected
    const pinnedChecks = multi && !other ? [...checkedCodes] : null
    if (!other) {
      setChoice(pinned)
      if (pinnedChecks) setChecks(new Set(pinnedChecks))
    }
    await onAnswer(line, { choice: pinned, checks: pinnedChecks, other, otherText, free })
  }
  const submit = async (answer: string) => {
    if (!answer.trim()) return
    await sendLine(awaitingAnswerText(item.id, answer))
  }
  const pick = (code: string) => { setOther(false); setChoice(code) }
  // T0938: checking an option clears「其他」; picking「其他」clears every check (never a mixed answer)
  const toggle = (code: string, on: boolean) => {
    const next = new Set(checkedCodes)
    if (on) next.add(code)
    else next.delete(code)
    setOther(false)
    setChecks(next)
  }
  const pickOther = (on: boolean) => {
    if (on) setChecks(new Set())
    setOther(on)
  }
  const canSend = other ? !!otherText.trim() : multi ? checkedCodes.size > 0 : !!selected
  const sendChoice = () => {
    if (other) void submit(otherText)
    else if (multi) {
      const line = item.options ? multiAnswerText(item.id, checkedCodes, item.options) : null
      if (line) void sendLine(line)
    } else if (selected) void submit(selected)
  }
  // T0942: a sent row's 送出 sends a new line (no confirmation)
  const sendLabel = t(sent ? 'inbox.answer.resend' : 'inbox.answer.send')
  const recommendedMark = (code: string) => (
    <span className="inbox-option-recommended" data-inbox-recommended={code}>{t('inbox.recommended')}</span>
  )
  // T0937: the「其他」box below the option list (single and, T0938, multiple choice share it)
  const otherBox = (
    <>
      <input
        className="inbox-free-input"
        type="text"
        maxLength={900}
        value={otherText}
        placeholder={t('inbox.answer.freePlaceholder')}
        aria-label={t('inbox.answer.other')}
        data-inbox-other-input={item.id}
        autoFocus
        onChange={e => setOtherText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submit(otherText) }}
      />
      {/* CT reads an answer starting with the word 放棄 / 略過 as giving up (its rule, `isDismissAnswer`); a hint, never a block */}
      {isDismissAnswer(otherText) && (
        <div className="inbox-muted inbox-other-hint" data-inbox-other-hint={item.id}>{t('inbox.answer.otherDismissHint')}</div>
      )}
    </>
  )
  // T0929: 送出 and 放棄… share one line of their own, after the options / the answer box
  const buttons = (sendButton: ReactNode) => (
    <div className="inbox-actions-row inbox-entry-buttons" data-inbox-entry-buttons={item.id}>
      {sendButton}
      {dismiss && dismissControl.button}
    </div>
  )
  return (
    <li className="inbox-item inbox-entry" data-inbox-awaiting={item.id}>
      <div className="inbox-entry-head">
        {dismiss && <DismissCheck id={item.id} checked={checked} onCheck={onCheck} />}
        <span className="inbox-item-id">{item.id}</span>
        {item.workorder && <InboxRefTag value={item.workorder} links={links} />}
        {item.source && <span className="inbox-item-tag" title={item.source}>{sourceKey ? t(sourceKey) : item.source}</span>}
        {item.kind && <span className="inbox-item-tag">{item.kind}</span>}
      </div>
      {/* T0929: the summary is its own full-width block below the head line */}
      <div className="inbox-entry-summary" data-inbox-summary={item.id}><InboxRefText text={item.summary} links={links} /></div>
      {item.options && multi ? (
        // T0938: multiple choice — check boxes (`role="group"`), every recommended code checked by default
        <div className="inbox-answer-block inbox-options">
          <div className="inbox-muted inbox-multi-hint" data-inbox-multi-hint={item.id}>{t('inbox.answer.multiHint')}</div>
          <div className="inbox-option-list" role="group" aria-label={item.id} data-inbox-option-list={item.id} data-inbox-multi={item.id}>
            {item.options.map(option => (
              <label key={option.code} className="inbox-option" data-inbox-option={option.code}>
                <input
                  type="checkbox"
                  name={`inbox-${item.id}`}
                  checked={checkedCodes.has(option.code)}
                  onChange={e => toggle(option.code, e.target.checked)}
                />
                <span className="inbox-option-code">{option.code}</span> <span className="inbox-option-label">{option.label}</span>
                {item.recommendedCodes?.includes(option.code) && recommendedMark(option.code)}
              </label>
            ))}
            {/* T0937 / T0938: the last option is a free answer, exclusive with the checks */}
            <label className="inbox-option inbox-option-other" data-inbox-option-other={item.id}>
              <input
                type="checkbox"
                name={`inbox-${item.id}`}
                checked={other}
                onChange={e => pickOther(e.target.checked)}
              />
              <span className="inbox-option-label">{t('inbox.answer.other')}</span>
            </label>
          </div>
          {other && otherBox}
          {buttons(
            <button className="inbox-btn primary" disabled={!canSend || busy} onClick={sendChoice}>
              {sendLabel}
            </button>,
          )}
        </div>
      ) : item.options ? (
        <div className="inbox-answer-block inbox-options">
          <div className="inbox-option-list" role="radiogroup" aria-label={item.id} data-inbox-option-list={item.id}>
            {item.options.map(option => (
              <label key={option.code} className="inbox-option" data-inbox-option={option.code}>
                <input
                  type="radio"
                  name={`inbox-${item.id}`}
                  checked={selected === option.code}
                  onChange={() => pick(option.code)}
                />
                <span className="inbox-option-code">{option.code}</span> <span className="inbox-option-label">{option.label}</span>
                {item.recommended === option.code && recommendedMark(option.code)}
              </label>
            ))}
            {/* T0937: the last option is a free answer (`U-n：<文字>`); no `data-inbox-option` (not a CT code) */}
            <label className="inbox-option inbox-option-other" data-inbox-option-other={item.id}>
              <input
                type="radio"
                name={`inbox-${item.id}`}
                checked={other}
                onChange={() => setOther(true)}
              />
              <span className="inbox-option-label">{t('inbox.answer.other')}</span>
            </label>
          </div>
          {other && otherBox}
          {buttons(
            <button className="inbox-btn primary" disabled={!canSend || busy} onClick={sendChoice}>
              {sendLabel}
            </button>,
          )}
        </div>
      ) : (
        <div className="inbox-answer-block inbox-free">
          {item.optionsInvalid && <div className="inbox-muted">{t('inbox.answer.optionsInvalid')}</div>}
          <input
            className="inbox-free-input"
            type="text"
            maxLength={900}
            value={free}
            placeholder={t('inbox.answer.freePlaceholder')}
            aria-label={t('inbox.answer.freePlaceholder')}
            onChange={e => setFree(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submit(free) }}
          />
          {/* T0938 (T0937 follow-up): the same 放棄 / 略過 hint as the「其他」box; never a block */}
          {isDismissAnswer(free) && (
            <div className="inbox-muted inbox-other-hint" data-inbox-free-hint={item.id}>{t('inbox.answer.otherDismissHint')}</div>
          )}
          {buttons(
            <button className="inbox-btn primary" disabled={!free.trim() || busy} onClick={() => void submit(free)}>
              {sendLabel}
            </button>,
          )}
        </div>
      )}
      {dismiss && dismissControl.form}
      {item.waitingOrders.length > 0 && (
        <div className="inbox-paused" data-inbox-paused={item.waitingOrders.join(',')}>
          {t('inbox.paused', { orders: item.waitingOrders.join(', ') })}
        </div>
      )}
      {item.createdAt && <div className="inbox-muted inbox-entry-time">{formatCtTime(item.createdAt)}</div>}
      {chooser}
      <AnswerStatus status={status} sent={sent} id={item.id} />
    </li>
  )
}

function ActionRow({ item, onAnswer, status, sent, chooser, dismiss, checked, onCheck, links }: {
  item: UserAction
  /** T0930: the found file references (links in the tag and the title). */
  links: InboxRefLinks
  onAnswer: (text: string) => Promise<boolean>
  status: Status | undefined
  /** T0942: the item's「已送出」record (this run, memory only). */
  sent: InboxSentRecord | undefined
  chooser: ReactNode
  /** PLAN-069: `inbox_features` lists `dismiss` → check box + 略過…. */
  dismiss: boolean
  checked: boolean
  onCheck: (id: string, checked: boolean) => void
}) {
  const { t } = useTranslation()
  const [failing, setFailing] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const kindKey = userActionKindLabelKey(item.kind)
  const busy = status?.status === 'sending'
  const dismissControl = useDismissControl({ id: item.id, kind: 'action', busy, onAnswer })
  const sole = soleFileRef(item.command)
  const commandFile = sole ? links.get(fileRefKey(sole)) : undefined
  const copy = async () => {
    if (!item.command) return
    try {
      await navigator.clipboard.writeText(item.command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard refused: nothing copied */ }
  }
  return (
    <li className="inbox-item inbox-entry" data-inbox-action={item.id}>
      <div className="inbox-entry-head">
        {dismiss && <DismissCheck id={item.id} checked={checked} onCheck={onCheck} />}
        <span className="inbox-item-id">{item.id}</span>
        {item.ref && <InboxRefTag value={item.ref} links={links} />}
        {item.kind && <span className="inbox-item-tag" title={item.kind}>{kindKey ? t(kindKey) : item.kind}</span>}
      </div>
      {/* T0929: the title is its own full-width block below the head line */}
      <div className="inbox-entry-summary" data-inbox-summary={item.id}><InboxRefText text={item.title} links={links} /></div>
      {item.command && (commandFile
        ? (
          // T0936: the command is one existing file → a link and「開啟」(never「複製指令」, never run)
          <div className="inbox-command" data-inbox-command-file={item.id}>
            <code className="inbox-command-text" title={t('inbox.action.openNote')}>
              <RefLink text={item.command} target={commandFile} className="inbox-file-link" />
            </code>
            <button className="inbox-btn" data-inbox-open={item.id} title={commandFile.rel} onClick={() => openFileInFilesTab(commandFile.abs)}>
              {t('inbox.action.open')}
            </button>
          </div>
        )
        : (
          <div className="inbox-command">
            <code className="inbox-command-text" title={t('inbox.action.commandNote')}><InboxRefText text={item.command} links={links} /></code>
            <button className="inbox-btn" data-inbox-copy={item.id} onClick={() => void copy()}>
              {copied ? t('inbox.action.copied') : t('inbox.action.copy')}
            </button>
          </div>
        ))}
      <div className="inbox-actions-row inbox-entry-buttons" data-inbox-entry-buttons={item.id}>
        <button className="inbox-btn primary" disabled={busy} data-inbox-done={item.id} onClick={() => void onAnswer(actionAnswerText(item.id, 'done'))}>
          {t('inbox.action.done')}
        </button>
        <button className="inbox-btn" disabled={busy} onClick={() => setFailing(v => !v)}>{t('inbox.action.failed')}</button>
        {dismiss && dismissControl.button}
      </div>
      {dismiss && dismissControl.form}
      {failing && (
        <div className="inbox-free">
          <input
            className="inbox-free-input"
            type="text"
            maxLength={900}
            value={note}
            placeholder={t('inbox.action.failedPlaceholder')}
            aria-label={t('inbox.action.failedPlaceholder')}
            onChange={e => setNote(e.target.value)}
          />
          <button
            className="inbox-btn primary"
            disabled={busy}
            data-inbox-fail-send={item.id}
            onClick={async () => {
              if (await onAnswer(actionAnswerText(item.id, 'failed', note))) {
                setFailing(false)
                setNote('')
              }
            }}
          >
            {t(sent ? 'inbox.answer.resend' : 'inbox.answer.send')}
          </button>
        </div>
      )}
      {item.createdAt && <div className="inbox-muted inbox-entry-time">{formatCtTime(item.createdAt)}</div>}
      {chooser}
      <AnswerStatus status={status} sent={sent} id={item.id} />
    </li>
  )
}

/** The `⏸ 待你決定` list. */
export function AwaitingList({ items, skipped, targets, dismiss = false, folder = null }: {
  items: Array<AwaitingItem & { waitingOrders: string[] }>
  skipped: number
  targets: Targets
  /** PLAN-069: `inbox_features` lists `dismiss`. */
  dismiss?: boolean
  /** T0930: the workspace root the file references resolve against; none → plain text. */
  folder?: string | null
}) {
  const sender = useAnswerSender(targets, folder ?? '')
  const sentMap = useInboxSentMap(folder ?? '')
  const batch = useChecked()
  const listed = items.slice(0, INBOX_LIST_RENDER_MAX)
  const links = useInboxFileRefs(folder, listed.flatMap(item => itemFileRefs([item.workorder], [item.summary])))
  const chooserFor = (key: string) => sender.pending?.itemId === key ? <TargetChooser targets={targets.targets} onChoose={sender.choose} /> : null
  return (
    <>
      {dismiss && listed.length > 0 && (
        <DismissToolbar
          kind="awaiting"
          listedIds={listed.map(item => item.id)}
          checked={batch.checked}
          busy={sender.statuses[BATCH_KEY]?.status === 'sending'}
          onSend={async (text, ids) => { const ok = await sender.send(BATCH_KEY, text, { key: batchSentKey('awaiting'), ids }); if (ok) batch.clear(); return ok }}
          status={sender.statuses[BATCH_KEY]}
          sent={sentMap.get(batchSentKey('awaiting'))}
          chooser={chooserFor(BATCH_KEY)}
        />
      )}
      <ul className="inbox-list">
        {listed.map(item => (
          <AwaitingRow
            key={item.id}
            item={item}
            status={sender.statuses[item.id]}
            sent={sentMap.get(item.id)}
            onAnswer={(text, selection) => sender.send(item.id, text, { key: item.id, ids: [item.id], selection })}
            chooser={chooserFor(item.id)}
            dismiss={dismiss}
            checked={batch.checked.has(item.id)}
            onCheck={batch.onCheck}
            links={links}
          />
        ))}
      </ul>
      <MoreLine total={items.length} />
      <SkippedLine count={skipped} />
    </>
  )
}

/** The `user_actions` part of `🙋 待你執行`. */
export function ActionList({ items, skipped, targets, dismiss = false, folder = null }: {
  items: UserAction[]
  skipped: number
  targets: Targets
  /** PLAN-069: `inbox_features` lists `dismiss`. */
  dismiss?: boolean
  /** T0930: the workspace root the file references resolve against; none → plain text. */
  folder?: string | null
}) {
  const sender = useAnswerSender(targets, folder ?? '')
  const sentMap = useInboxSentMap(folder ?? '')
  const batch = useChecked()
  const listed = items.slice(0, INBOX_LIST_RENDER_MAX)
  // T0936: the command's references too (the whole command first when it is one file)
  const links = useInboxFileRefs(folder, listed.flatMap(item => [...itemFileRefs([item.ref], [item.title]), ...commandFileRefs(item.command)]))
  const chooserFor = (key: string) => sender.pending?.itemId === key ? <TargetChooser targets={targets.targets} onChoose={sender.choose} /> : null
  return (
    <>
      {dismiss && listed.length > 0 && (
        <DismissToolbar
          kind="action"
          listedIds={listed.map(item => item.id)}
          checked={batch.checked}
          busy={sender.statuses[BATCH_KEY]?.status === 'sending'}
          onSend={async (text, ids) => { const ok = await sender.send(BATCH_KEY, text, { key: batchSentKey('action'), ids }); if (ok) batch.clear(); return ok }}
          status={sender.statuses[BATCH_KEY]}
          sent={sentMap.get(batchSentKey('action'))}
          chooser={chooserFor(BATCH_KEY)}
        />
      )}
      <ul className="inbox-list">
        {listed.map(item => (
          <ActionRow
            key={item.id}
            item={item}
            status={sender.statuses[item.id]}
            sent={sentMap.get(item.id)}
            onAnswer={text => sender.send(item.id, text, { key: item.id, ids: [item.id] })}
            chooser={chooserFor(item.id)}
            dismiss={dismiss}
            checked={batch.checked.has(item.id)}
            onCheck={batch.onCheck}
            links={links}
          />
        ))}
      </ul>
      <MoreLine total={items.length} />
      <SkippedLine count={skipped} />
    </>
  )
}

/** The `⏰ 到期提醒` list. */
export function ReminderList({ items, skipped, folder = null }: {
  items: DueReminder[]
  skipped: number
  /** T0930: the workspace root the file references resolve against; none → plain text. */
  folder?: string | null
}) {
  const { t } = useTranslation()
  const listed = items.slice(0, INBOX_LIST_RENDER_MAX)
  const links = useInboxFileRefs(folder, listed.flatMap(item => itemFileRefs([item.ref], [item.title])))
  return (
    <>
      <ul className="inbox-list">
        {listed.map(item => {
          const when = item.days > 0
            ? t('inbox.remind.overdue', { count: item.days })
            : item.days === 0 ? t('inbox.remind.today') : t('inbox.remind.dueIn', { count: -item.days })
          return (
            <li key={item.id} className="inbox-item" data-inbox-reminder={item.id}>
              {item.ref && <InboxRefTag value={item.ref} links={links} />}
              <span className="inbox-item-text" title={formatCtTime(item.dueAt)}>
                <InboxRefText text={item.title} links={links} /> · {when}{item.lastAt ? ` ${t('inbox.remind.last', { at: formatCtTime(item.lastAt) })}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
      <MoreLine total={items.length} />
      <SkippedLine count={skipped} />
    </>
  )
}

/** 最近已結 (§2.1): folded by default; nothing when empty. */
export function RecentlyClosedList({ items }: { items: readonly RecentlyClosed[] }) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <details className="inbox-recent" data-inbox-recent={items.length}>
      <summary>{t('inbox.recentlyClosed', { count: items.length })}</summary>
      <ul className="inbox-list">
        {items.map(item => (
          <li key={`${item.id}:${item.closedAt}`} className="inbox-item inbox-recent-item">
            <span className="inbox-item-id">{item.id}</span>
            <span className="inbox-item-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
