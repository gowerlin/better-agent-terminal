/**
 * T0971 / BUG-237: the「塔台正以選單詢問此題：在這裡回答會先關掉選單」hint ids of the Inbox tab, asked from the
 * host that runs each Tower tab (proxied `tower-inbox:menu-hint`, read only): the hint shows exactly when that
 * host's `menuEscDecision` would close the menu for the answer — the window never compares `opened_at` itself.
 *
 *   - asked again when the menu, the Tower tabs, any attention or the "📨 待送" lists change; while a hint shows
 *     on the menu record alone (`via: 'menu'`: the user's key / click cleared `question`, the menu stayed —
 *     T0968 Q-2), also every `INBOX_MENU_HINT_REFRESH_MS` (the record can close without an attention change)
 *   - until a tab's host answers, nothing is shown for it (a stale `menu_open` never flashes the hint)
 *   - no `towerInbox.menuHint` (an older preload) → T0968 at once (`inboxMenuHintIds`); a host that rejects
 *     the call (a bat-server before T0971: `No handler for channel`) → T0968 for that tab
 *
 * Combining the answers is `inboxMenuHintIdsFromHost` (src/lib/inbox-model.ts).
 */
import { useEffect, useRef, useState } from 'react'
import {
  inboxMenuHintIds,
  inboxMenuHintIdsFromHost,
  type InboxAnswerTarget,
  type InboxMenuHintAnswer,
} from '../../lib/inbox-model'
import type { InboxMenuInfo } from '../../lib/tower-inbox'

/** While a hint shows on the menu record alone, ask again this often. */
export const INBOX_MENU_HINT_REFRESH_MS = 2_000

interface HintState {
  /** The menu + Tower tabs these answers belong to (other ones count as not answered). */
  key: string
  answers: Record<string, InboxMenuHintAnswer>
}

function menuKey(menu: InboxMenuInfo | undefined, tabIds: readonly string[]): string {
  return menu ? `${menu.ids.join(',')}@${menu.openedAt}|${tabIds.join(',')}` : ''
}

export function useInboxMenuHint(
  menu: InboxMenuInfo | undefined,
  targets: readonly InboxAnswerTarget[],
  blockedReasonOf: (id: string) => string | undefined,
  /** Changes whenever something the host's answer depends on may have changed (attention / held lists). */
  changeVersion: string,
  /** false = not needed by this caller (the tab badge): nothing is asked, [] returned. */
  enabled = true,
): readonly string[] {
  const api = typeof window !== 'undefined' ? window.electronAPI?.towerInbox?.menuHint : undefined
  const query = enabled ? api : undefined
  const tabIds = targets.filter(target => target.kind === 'tab').map(target => target.id)
  const key = menuKey(menu, tabIds)
  const [state, setState] = useState<HintState>({ key: '', answers: {} })
  const [tick, setTick] = useState(0)
  const generation = useRef(0)

  useEffect(() => {
    if (!query || !menu || tabIds.length === 0) return
    const gen = ++generation.current
    for (const id of tabIds) {
      let pending: Promise<unknown>
      try {
        pending = Promise.resolve(query(id, menu))
      } catch (err) {
        pending = Promise.reject(err)
      }
      pending.then(
        (result) => {
          const r = result as { ok?: unknown; ids?: unknown; via?: unknown } | null
          const answer: InboxMenuHintAnswer = r && r.ok === true && Array.isArray(r.ids)
            ? { ids: r.ids.filter((v): v is string => typeof v === 'string'), via: r.via === 'question' || r.via === 'menu' ? r.via : null }
            : { ids: [], via: null } // FORBIDDEN / INVALID_ARGS / unavailable: no Esc → no hint
          return answer
        },
        (): InboxMenuHintAnswer => 'unsupported',
      ).then((answer) => {
        if (generation.current !== gen) return
        setState(prev => ({ key, answers: { ...(prev.key === key ? prev.answers : {}), [id]: answer } }))
      })
    }
    // `menu` / `tabIds` are captured through `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, key, changeVersion, tick])

  const answers = state.key === key ? state.answers : {}
  const onRecordOnly = Object.values(answers).some(a => a !== 'unsupported' && a.via === 'menu' && a.ids.length > 0)
  useEffect(() => {
    if (!onRecordOnly) return
    const timer = setInterval(() => setTick(t => t + 1), INBOX_MENU_HINT_REFRESH_MS)
    return () => clearInterval(timer)
  }, [onRecordOnly])

  if (!enabled) return []
  if (!query) return inboxMenuHintIds(menu, targets, blockedReasonOf)
  return inboxMenuHintIdsFromHost(menu, targets, id => answers[id], blockedReasonOf)
}
