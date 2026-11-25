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
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  INBOX_LIST_RENDER_MAX,
  actionAnswerText,
  awaitingAnswerText,
  awaitingSourceLabelKey,
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

function AwaitingRow({ item, onAnswer, status, chooser }: {
  item: AwaitingItem & { waitingOrders: string[] }
  onAnswer: (text: string) => Promise<boolean>
  status: Status | undefined
  chooser: ReactNode
}) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<string | null>(null)
  const [free, setFree] = useState('')
  const sourceKey = awaitingSourceLabelKey(item.source)
  const busy = status?.status === 'sending'
  const submit = async (answer: string) => {
    if (!answer.trim()) return
    if (await onAnswer(awaitingAnswerText(item.id, answer))) {
      setChoice(null)
      setFree('')
    }
  }
  return (
    <li className="inbox-item inbox-entry" data-inbox-awaiting={item.id}>
      <div className="inbox-entry-head">
        <span className="inbox-item-id">{item.id}</span>
        {item.workorder && <span className="inbox-item-source">{item.workorder}</span>}
        {item.source && <span className="inbox-item-tag" title={item.source}>{sourceKey ? t(sourceKey) : item.source}</span>}
        {item.kind && <span className="inbox-item-tag">{item.kind}</span>}
        <span className="inbox-item-text inbox-entry-summary">{item.summary}</span>
      </div>
      {item.options ? (
        <div className="inbox-options" role="radiogroup" aria-label={item.id}>
          {item.options.map(option => (
            <label key={option.code} className="inbox-option" data-inbox-option={option.code}>
              <input
                type="radio"
                name={`inbox-${item.id}`}
                checked={choice === option.code}
                onChange={() => setChoice(option.code)}
              />
              <span className="inbox-option-code">{option.code}</span> {option.label}
            </label>
          ))}
          <button className="inbox-btn primary" disabled={!choice || busy} onClick={() => { if (choice) void submit(choice) }}>
            {t('inbox.answer.send')}
          </button>
        </div>
      ) : (
        <div className="inbox-free">
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
          <button className="inbox-btn primary" disabled={!free.trim() || busy} onClick={() => void submit(free)}>
            {t('inbox.answer.send')}
          </button>
        </div>
      )}
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

function ActionRow({ item, onAnswer, status, chooser }: {
  item: UserAction
  onAnswer: (text: string) => Promise<boolean>
  status: Status | undefined
  chooser: ReactNode
}) {
  const { t } = useTranslation()
  const [failing, setFailing] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const kindKey = userActionKindLabelKey(item.kind)
  const busy = status?.status === 'sending'
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
        <span className="inbox-item-id">{item.id}</span>
        {item.ref && <span className="inbox-item-source">{item.ref}</span>}
        {item.kind && <span className="inbox-item-tag" title={item.kind}>{kindKey ? t(kindKey) : item.kind}</span>}
        <span className="inbox-item-text inbox-entry-summary">{item.title}</span>
      </div>
      {item.command && (
        <div className="inbox-command">
          <code className="inbox-command-text" title={t('inbox.action.commandNote')}>{item.command}</code>
          <button className="inbox-btn" data-inbox-copy={item.id} onClick={() => void copy()}>
            {copied ? t('inbox.action.copied') : t('inbox.action.copy')}
          </button>
        </div>
      )}
      <div className="inbox-actions-row">
        <button className="inbox-btn primary" disabled={busy} data-inbox-done={item.id} onClick={() => void onAnswer(actionAnswerText(item.id, 'done'))}>
          {t('inbox.action.done')}
        </button>
        <button className="inbox-btn" disabled={busy} onClick={() => setFailing(v => !v)}>{t('inbox.action.failed')}</button>
      </div>
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
export function AwaitingList({ items, skipped, targets }: { items: Array<AwaitingItem & { waitingOrders: string[] }>; skipped: number; targets: Targets }) {
  const sender = useAnswerSender(targets)
  return (
    <>
      <ul className="inbox-list">
        {items.slice(0, INBOX_LIST_RENDER_MAX).map(item => (
          <AwaitingRow
            key={item.id}
            item={item}
            status={sender.statuses[item.id]}
            onAnswer={text => sender.send(item.id, text)}
            chooser={sender.pending?.itemId === item.id ? <TargetChooser targets={targets.targets} onChoose={sender.choose} /> : null}
          />
        ))}
      </ul>
      <MoreLine total={items.length} />
      <SkippedLine count={skipped} />
    </>
  )
}

/** The `user_actions` part of `🙋 待你執行`. */
export function ActionList({ items, skipped, targets }: { items: UserAction[]; skipped: number; targets: Targets }) {
  const sender = useAnswerSender(targets)
  return (
    <>
      <ul className="inbox-list">
        {items.slice(0, INBOX_LIST_RENDER_MAX).map(item => (
          <ActionRow
            key={item.id}
            item={item}
            status={sender.statuses[item.id]}
            onAnswer={text => sender.send(item.id, text)}
            chooser={sender.pending?.itemId === item.id ? <TargetChooser targets={targets.targets} onChoose={sender.choose} /> : null}
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
