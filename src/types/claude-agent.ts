export interface ClaudeMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  parentToolUseId?: string
  timestamp: number
}

export interface ClaudeToolCall {
  id: string
  sessionId: string
  toolName: string
  input: Record<string, unknown>
  status: 'running' | 'completed' | 'error'
  result?: string
  description?: string
  denyReason?: string
  denied?: boolean
  isDeferred?: boolean
  parentToolUseId?: string
  /** Agent / Task running as a background task (T0759 / BUG-190): set by the main process. */
  isBackground?: boolean
  timestamp: number
}

export interface ClaudeSessionState {
  sessionId: string
  messages: (ClaudeMessage | ClaudeToolCall)[]
  isStreaming: boolean
  totalCost?: number
  totalTokens?: number
}

// Discriminator helper
/**
 * T0769 / BUG-192: a message that could not go into the open query (its input had closed) and
 * waits for that query to end (`claude:queued-messages`). `messageId` / `content` = the user
 * message main broadcast for it.
 * T0815 (PLAN-058 W0): also a message sent while a turn runs (`waitsFor: 'turn'`: the CLI runs it
 * after that turn, or folds it in once a waiting card is answered); `'query'` (or absent, older
 * hosts) = it waits for the query to end.
 */
export interface ClaudeQueuedMessage {
  id: string
  messageId?: string
  content: string
  waitsFor?: 'turn' | 'query'
}

/** T0815: which "待送" note a queued message shows (i18n key under `claude.`). */
export function queuedNoteKey(q: Pick<ClaudeQueuedMessage, 'waitsFor'>, cardWaiting: boolean): string {
  if (cardWaiting) return 'queuedUntilAnswered'
  return q.waitsFor === 'turn' ? 'queuedUntilTurnDone' : 'queuedUntilBackgroundDone'
}

/**
 * T0815: whether the panel still shows the turn as running after a `result`: the host says sent
 * messages still need a turn (`pendingTurns`, absent on older hosts → stop as before).
 */
export function keepsStreamingAfterResult(resultData: unknown): boolean {
  const n = (resultData as { pendingTurns?: unknown } | undefined)?.pendingTurns
  return typeof n === 'number' && n > 0
}

/**
 * T0769: where each queued message's note goes — under the latest user message it belongs to
 * (same id, else same content), each user message at most once; the rest go after the list.
 */
export function placeQueuedMessages(
  messages: ReadonlyArray<ClaudeMessage | ClaudeToolCall>,
  queued: ReadonlyArray<ClaudeQueuedMessage>,
): { byMessageId: Map<string, ClaudeQueuedMessage[]>; unplaced: ClaudeQueuedMessage[] } {
  const byMessageId = new Map<string, ClaudeQueuedMessage[]>()
  const unplaced: ClaudeQueuedMessage[] = []
  const used = new Set<string>()
  const users = messages.filter(m => !isToolCall(m) && m.role === 'user') as ClaudeMessage[]
  for (const q of queued) {
    let target = q.messageId ? users.find(m => m.id === q.messageId && !used.has(m.id)) : undefined
    if (!target) {
      for (let i = users.length - 1; i >= 0; i--) {
        if (!used.has(users[i].id) && users[i].content === q.content) { target = users[i]; break }
      }
    }
    if (!target) { unplaced.push(q); continue }
    used.add(target.id)
    byMessageId.set(target.id, [...(byMessageId.get(target.id) ?? []), q])
  }
  return { byMessageId, unplaced }
}

// Discriminator helper
export function isToolCall(item: ClaudeMessage | ClaudeToolCall): item is ClaudeToolCall {
  return 'toolName' in item
}
