/**
 * PLAN-068 W5 / T0908: the CT contract v2 lists of the「待辦」(Inbox) tab (T0902 §1 / §2.1 / §2.2):
 *
 *   ⏸ 待你決定   `awaiting_user` — option buttons (`<代號> <說明>`) + 送出, or a free answer box;
 *                 ⏸ + 「暫停中」for the open work orders whose `waiting_user` names it
 *   🙋 待你執行   `user_actions` — `command` has only「複製」(🔴 BAT never runs it);「完成」/「失敗…」
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
  userActionKindLabelKey,
  type AwaitingItem,
  type DueReminder,
  type UserAction,
} from '../../lib/tower-inbox'
import { sendInboxAnswer, type InboxAnswerOutcome } from '../../lib/inbox-answer'
import type { InboxAnswerTarget, RecentlyClosed } from '../../lib/inbox-model'

type Targets = { targets: InboxAnswerTarget[]; auto: InboxAnswerTarget | null }

/** Per item: the last answer's outcome, shown under it. */
type Status = InboxAnswerOutcome | { status: 'no-target' } | { status: 'sending' }

/**
 * Sends answer lines for one Inbox: to `auto` directly; with several targets the user picks one
 * first (`pending`); with none, nothing is sent.
 */
function useAnswerSender(targets: Targets) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [pending, setPending] = useState<{ itemId: string; text: string } | null>(null)

  const deliver = async (itemId: string, text: string, target: InboxAnswerTarget): Promise<boolean> => {
    setStatuses(prev => ({ ...prev, [itemId]: { status: 'sending' } }))
    const outcome = await sendInboxAnswer(target, text)
    setStatuses(prev => ({ ...prev, [itemId]: outcome }))
    return outcome.status === 'sent' || outcome.status === 'held'
  }

  const send = async (itemId: string, text: string): Promise<boolean> => {
    if (targets.auto) return deliver(itemId, text, targets.auto)
    if (targets.targets.length === 0) {
      setStatuses(prev => ({ ...prev, [itemId]: { status: 'no-target' } }))
      return false
    }
    setPending({ itemId, text })
    return false
  }

  const choose = async (target: InboxAnswerTarget | null) => {
    const current = pending
    setPending(null)
    if (current && target) await deliver(current.itemId, current.text, target)
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
function DismissToolbar({ kind, listedIds, checked, busy, onSend, status, chooser }: {
  kind: DismissKind
  listedIds: readonly string[]
  checked: ReadonlySet<string>
  busy: boolean
  onSend: (text: string) => Promise<boolean>
  status: Status | undefined
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
    const text = dismissAnswerText(idsOf(mode), kind, note)
    if (!text) { setMode(null); return }
    if (await onSend(text)) {
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
      <StatusLine status={status} />
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

function AwaitingRow({ item, onAnswer, status, chooser, dismiss, checked, onCheck }: {
  item: AwaitingItem & { waitingOrders: string[] }
  onAnswer: (text: string) => Promise<boolean>
  status: Status | undefined
  chooser: ReactNode
  /** PLAN-069: `inbox_features` lists `dismiss` → check box + 放棄…. */
  dismiss: boolean
  checked: boolean
  onCheck: (id: string, checked: boolean) => void
}) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<string | null>(null)
  // PLAN-069: the recommended option is selected until the user picks one
  const selected = choice ?? item.recommended ?? null
  const [free, setFree] = useState('')
  const sourceKey = awaitingSourceLabelKey(item.source)
  const busy = status?.status === 'sending'
  const dismissControl = useDismissControl({ id: item.id, kind: 'awaiting', busy, onAnswer })
  const submit = async (answer: string) => {
    if (!answer.trim()) return
    if (await onAnswer(awaitingAnswerText(item.id, answer))) {
      setChoice(null)
      setFree('')
    }
  }
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
        {item.workorder && <span className="inbox-item-source">{item.workorder}</span>}
        {item.source && <span className="inbox-item-tag" title={item.source}>{sourceKey ? t(sourceKey) : item.source}</span>}
        {item.kind && <span className="inbox-item-tag">{item.kind}</span>}
      </div>
      {/* T0929: the summary is its own full-width block below the head line */}
      <div className="inbox-entry-summary" data-inbox-summary={item.id}>{item.summary}</div>
      {item.options ? (
        <div className="inbox-answer-block inbox-options">
          <div className="inbox-option-list" role="radiogroup" aria-label={item.id} data-inbox-option-list={item.id}>
            {item.options.map(option => (
              <label key={option.code} className="inbox-option" data-inbox-option={option.code}>
                <input
                  type="radio"
                  name={`inbox-${item.id}`}
                  checked={selected === option.code}
                  onChange={() => setChoice(option.code)}
                />
                <span className="inbox-option-code">{option.code}</span> <span className="inbox-option-label">{option.label}</span>
                {item.recommended === option.code && (
                  <span className="inbox-option-recommended" data-inbox-recommended={option.code}>{t('inbox.recommended')}</span>
                )}
              </label>
            ))}
          </div>
          {buttons(
            <button className="inbox-btn primary" disabled={!selected || busy} onClick={() => { if (selected) void submit(selected) }}>
              {t('inbox.answer.send')}
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
          {buttons(
            <button className="inbox-btn primary" disabled={!free.trim() || busy} onClick={() => void submit(free)}>
              {t('inbox.answer.send')}
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
      <StatusLine status={status} />
    </li>
  )
}

function ActionRow({ item, onAnswer, status, chooser, dismiss, checked, onCheck }: {
  item: UserAction
  onAnswer: (text: string) => Promise<boolean>
  status: Status | undefined
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
        {item.ref && <span className="inbox-item-source">{item.ref}</span>}
        {item.kind && <span className="inbox-item-tag" title={item.kind}>{kindKey ? t(kindKey) : item.kind}</span>}
      </div>
      {/* T0929: the title is its own full-width block below the head line */}
      <div className="inbox-entry-summary" data-inbox-summary={item.id}>{item.title}</div>
      {item.command && (
        <div className="inbox-command">
          <code className="inbox-command-text" title={t('inbox.action.commandNote')}>{item.command}</code>
          <button className="inbox-btn" data-inbox-copy={item.id} onClick={() => void copy()}>
            {copied ? t('inbox.action.copied') : t('inbox.action.copy')}
          </button>
        </div>
      )}
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
            {t('inbox.answer.send')}
          </button>
        </div>
      )}
      {item.createdAt && <div className="inbox-muted inbox-entry-time">{formatCtTime(item.createdAt)}</div>}
      {chooser}
      <StatusLine status={status} />
    </li>
  )
}

/** The `⏸ 待你決定` list. */
export function AwaitingList({ items, skipped, targets, dismiss = false }: {
  items: Array<AwaitingItem & { waitingOrders: string[] }>
  skipped: number
  targets: Targets
  /** PLAN-069: `inbox_features` lists `dismiss`. */
  dismiss?: boolean
}) {
  const sender = useAnswerSender(targets)
  const batch = useChecked()
  const listed = items.slice(0, INBOX_LIST_RENDER_MAX)
  const chooserFor = (key: string) => sender.pending?.itemId === key ? <TargetChooser targets={targets.targets} onChoose={sender.choose} /> : null
  return (
    <>
      {dismiss && listed.length > 0 && (
        <DismissToolbar
          kind="awaiting"
          listedIds={listed.map(item => item.id)}
          checked={batch.checked}
          busy={sender.statuses[BATCH_KEY]?.status === 'sending'}
          onSend={async text => { const ok = await sender.send(BATCH_KEY, text); if (ok) batch.clear(); return ok }}
          status={sender.statuses[BATCH_KEY]}
          chooser={chooserFor(BATCH_KEY)}
        />
      )}
      <ul className="inbox-list">
        {listed.map(item => (
          <AwaitingRow
            key={item.id}
            item={item}
            status={sender.statuses[item.id]}
            onAnswer={text => sender.send(item.id, text)}
            chooser={chooserFor(item.id)}
            dismiss={dismiss}
            checked={batch.checked.has(item.id)}
            onCheck={batch.onCheck}
          />
        ))}
      </ul>
      <MoreLine total={items.length} />
      <SkippedLine count={skipped} />
    </>
  )
}

/** The `user_actions` part of `🙋 待你執行`. */
export function ActionList({ items, skipped, targets, dismiss = false }: {
  items: UserAction[]
  skipped: number
  targets: Targets
  /** PLAN-069: `inbox_features` lists `dismiss`. */
  dismiss?: boolean
}) {
  const sender = useAnswerSender(targets)
  const batch = useChecked()
  const listed = items.slice(0, INBOX_LIST_RENDER_MAX)
  const chooserFor = (key: string) => sender.pending?.itemId === key ? <TargetChooser targets={targets.targets} onChoose={sender.choose} /> : null
  return (
    <>
      {dismiss && listed.length > 0 && (
        <DismissToolbar
          kind="action"
          listedIds={listed.map(item => item.id)}
          checked={batch.checked}
          busy={sender.statuses[BATCH_KEY]?.status === 'sending'}
          onSend={async text => { const ok = await sender.send(BATCH_KEY, text); if (ok) batch.clear(); return ok }}
          status={sender.statuses[BATCH_KEY]}
          chooser={chooserFor(BATCH_KEY)}
        />
      )}
      <ul className="inbox-list">
        {listed.map(item => (
          <ActionRow
            key={item.id}
            item={item}
            status={sender.statuses[item.id]}
            onAnswer={text => sender.send(item.id, text)}
            chooser={chooserFor(item.id)}
            dismiss={dismiss}
            checked={batch.checked.has(item.id)}
            onCheck={batch.onCheck}
          />
        ))}
      </ul>
      <MoreLine total={items.length} />
      <SkippedLine count={skipped} />
    </>
  )
}

/** The `⏰ 到期提醒` list. */
export function ReminderList({ items, skipped }: { items: DueReminder[]; skipped: number }) {
  const { t } = useTranslation()
  return (
    <>
      <ul className="inbox-list">
        {items.slice(0, INBOX_LIST_RENDER_MAX).map(item => {
          const when = item.days > 0
            ? t('inbox.remind.overdue', { count: item.days })
            : item.days === 0 ? t('inbox.remind.today') : t('inbox.remind.dueIn', { count: -item.days })
          return (
            <li key={item.id} className="inbox-item" data-inbox-reminder={item.id}>
              {item.ref && <span className="inbox-item-source">{item.ref}</span>}
              <span className="inbox-item-text" title={formatCtTime(item.dueAt)}>
                {item.title} · {when}{item.lastAt ? ` ${t('inbox.remind.last', { at: formatCtTime(item.lastAt) })}` : ''}
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
