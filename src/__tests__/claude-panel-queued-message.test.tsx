/**
 * T0769 / BUG-192 (D214 P-1): a message that could not go into the open query (a background Agent
 * keeps it open, but its input had already closed) waits for that query to end. The panel shows
 * 「等背景子代理結束後送出」 with a cancel button under that message; cancel = removed from main's
 * `messageQueue` (`claude:cancel-queued-message`). The list comes from `claude:queued-messages`.
 * Main side: electron/__tests__/claude-send-during-background-agent.test.ts.
 *
 * T0815 (PLAN-058 W0, D259): a message sent while a turn runs is listed too (`waitsFor: 'turn'`,
 * 「目前回合結束後送出」; with a permission / AskUserQuestion card waiting 「請先回答上方問題，回答後送出」);
 * a cancel that finds it already started (`cancelled: false`) drops the note and says so; a `result`
 * with `pendingTurns > 0` keeps the turn shown as running. Main side: claude-send-during-turn.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { keepsStreamingAfterResult, placeQueuedMessages, queuedNoteKey, type ClaudeMessage, type ClaudeToolCall } from '../types/claude-agent'

/** Same permissive stand-in as claude-panel-waiting.test.tsx. */
function permissiveApi(overrides: Record<string, Record<string, unknown>>): unknown {
  const leaf = (name: string) => vi.fn((..._args: unknown[]) => (name.startsWith('on') ? () => {} : Promise.resolve(undefined)))
  const namespace = (ns: string) => {
    const cache: Record<string, unknown> = { ...(overrides[ns] ?? {}) }
    return new Proxy(cache, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined
        if (!(prop in target)) target[prop] = leaf(prop)
        return target[prop]
      },
    })
  }
  const namespaces: Record<string, unknown> = {}
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

type Listener = (sid: string, ...payload: unknown[]) => void
let listeners: Record<string, Listener | undefined> = {}
const capture = (name: string) => vi.fn((cb: Listener) => { listeners[name] = cb; return () => {} })
const emit = (name: string, ...args: unknown[]) => act(() => { listeners[name]!(...(args as [string, ...unknown[]])) })
let cancelQueuedMessage: ReturnType<typeof vi.fn>

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  listeners = {}
  cancelQueuedMessage = vi.fn(async () => ({ cancelled: true, idle: true }))
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    debug: { log: vi.fn(), isDebugMode: false },
    claude: {
      getStatuslineExtras: vi.fn(async () => ({})),
      onMessage: capture('message'),
      onQueuedMessages: capture('queuedMessages'),
      onResult: capture('result'),
      onPermissionRequest: capture('permissionRequest'),
      cancelQueuedMessage,
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const user = (sid: string, id: string, content: string, timestamp = Date.now()): ClaudeMessage => ({ id, sessionId: sid, role: 'user', content, timestamp })

describe('ClaudeAgentPanel: queued message note (T0769 / D214 P-1)', () => {
  test('shown under its message with a cancel button; cancel → IPC, note gone', async () => {
    const sid = 't0769-queued'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    emit('message', sid, user(sid, 'user-1', 'first', Date.now() - 60_000))
    emit('message', sid, user(sid, 'user-2', 'next'))
    expect(container.querySelector('.claude-queued-note')).toBeNull()

    emit('queuedMessages', 'other-session', [{ id: 'queued-x', content: 'next' }]) // another tab: ignored
    expect(container.querySelector('.claude-queued-note')).toBeNull()
    emit('queuedMessages', sid, [{ id: 'queued-1', messageId: 'user-2', content: 'next' }])
    const note = container.querySelector('.claude-queued-note')
    expect(note).not.toBeNull()
    expect(note!.textContent).toContain('Will be sent after the background agent finishes.')
    // directly under the message it belongs to
    expect(note!.previousElementSibling?.getAttribute('data-user-msg-id')).toBe('user-2')

    await act(async () => { fireEvent.click(note!.querySelector('.claude-queued-cancel-btn')!) })
    expect(cancelQueuedMessage).toHaveBeenCalledWith(sid, 'queued-1')
    expect(container.querySelector('.claude-queued-note')).toBeNull()
  })

  test('T0815: a cancel that found it already started drops the note and says so; an empty list clears it', async () => {
    cancelQueuedMessage.mockResolvedValueOnce({ cancelled: false, idle: false })
    const sid = 't0769-queued-late'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    emit('message', sid, user(sid, 'user-1', 'next'))
    emit('queuedMessages', sid, [{ id: 'queued-1', messageId: 'user-main-1', content: 'next' }]) // matched by content
    expect(container.querySelector('.claude-queued-note')!.previousElementSibling?.getAttribute('data-user-msg-id')).toBe('user-1')
    await act(async () => { fireEvent.click(container.querySelector('.claude-queued-cancel-btn')!) })
    expect(container.querySelector('.claude-queued-note')).toBeNull()
    expect(container.textContent).toContain('That message has already started and cannot be cancelled.')
    emit('queuedMessages', sid, [{ id: 'queued-2', content: 'again' }])
    expect(container.querySelector('.claude-queued-note')).not.toBeNull()
    emit('queuedMessages', sid, [])
    expect(container.querySelector('.claude-queued-note')).toBeNull()
  })

  test('T0815: sent during a turn → after the current turn; a waiting card → answer it first', async () => {
    const sid = 't0815-turn'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    emit('message', sid, user(sid, 'user-1', 'second'))
    emit('queuedMessages', sid, [{ id: 'u-1', messageId: 'user-1', content: 'second', waitsFor: 'turn' }])
    const note = () => container.querySelector('.claude-queued-note')!
    expect(note().textContent).toContain('Will be sent after the current turn.')
    expect(note().getAttribute('data-waits-for')).toBe('turn')
    emit('permissionRequest', sid, { toolUseId: 'toolu_1', toolName: 'Bash', input: { command: 'mkdir x' } })
    expect(note().textContent).toContain('Answer the question above first; it will be sent after that.')
    emit('queuedMessages', sid, [{ id: 'u-1', messageId: 'user-1', content: 'second', waitsFor: 'query' }])
    expect(note().textContent).toContain('Answer the question above first')
  })

  test('T0815: a result with pendingTurns keeps the turn running; the last one ends it', async () => {
    const sid = 't0815-result'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    const input = container.querySelector('textarea.claude-input') as HTMLTextAreaElement
    const running = () => input.getAttribute('placeholder')?.startsWith('Press Esc to pause') ?? false
    await act(async () => { input.value = 'first'; fireEvent.input(input) })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await act(async () => {})
    expect(running()).toBe(true)
    emit('result', sid, { subtype: 'success', pendingTurns: 1 })
    expect(running()).toBe(true)
    emit('result', sid, { subtype: 'success', pendingTurns: 0 })
    expect(running()).toBe(false)
    await act(async () => { input.value = 'again'; fireEvent.input(input) })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await act(async () => {})
    expect(running()).toBe(true)
    emit('result', sid, { subtype: 'success' }) // an older host: no pendingTurns → ends as before
    expect(running()).toBe(false)
  })

  test('zh-TW wording', async () => {
    await i18n.changeLanguage('zh-TW')
    try {
      const sid = 't0769-queued-zh'
      const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
      await act(async () => {})
      emit('queuedMessages', sid, [{ id: 'queued-1', content: 'not shown yet' }])
      const note = container.querySelector('.claude-queued-note')!
      expect(note.textContent).toContain('等背景子代理結束後送出。')
      expect(note.querySelector('.claude-queued-cancel-btn')!.textContent).toBe('取消')
      emit('queuedMessages', sid, [{ id: 'queued-1', content: 'not shown yet', waitsFor: 'turn' }])
      expect(container.querySelector('.claude-queued-note')!.textContent).toContain('目前回合結束後送出。')
    } finally {
      await i18n.changeLanguage('en')
    }
  })
})

describe('queuedNoteKey / keepsStreamingAfterResult (T0815)', () => {
  test('note key: a waiting card wins; turn vs query (absent = query, older hosts)', () => {
    expect(queuedNoteKey({ waitsFor: 'turn' }, false)).toBe('queuedUntilTurnDone')
    expect(queuedNoteKey({ waitsFor: 'query' }, false)).toBe('queuedUntilBackgroundDone')
    expect(queuedNoteKey({}, false)).toBe('queuedUntilBackgroundDone')
    expect(queuedNoteKey({ waitsFor: 'turn' }, true)).toBe('queuedUntilAnswered')
    expect(queuedNoteKey({ waitsFor: 'query' }, true)).toBe('queuedUntilAnswered')
  })
  test('keeps streaming only for a positive number', () => {
    expect(keepsStreamingAfterResult({ pendingTurns: 2 })).toBe(true)
    expect(keepsStreamingAfterResult({ pendingTurns: 0 })).toBe(false)
    expect(keepsStreamingAfterResult({ pendingTurns: '1' })).toBe(false)
    expect(keepsStreamingAfterResult({})).toBe(false)
    expect(keepsStreamingAfterResult(undefined)).toBe(false)
  })
})

describe('placeQueuedMessages (T0769)', () => {
  const sid = 's'
  const tool: ClaudeToolCall = { id: 't', sessionId: sid, toolName: 'Agent', input: {}, status: 'running', timestamp: 1 }
  test('by id first, else the latest user message with the same content; each message once; the rest unplaced', () => {
    const msgs = [user(sid, 'u1', 'same', 1), tool, user(sid, 'u2', 'same', 2), user(sid, 'u3', 'other', 3)]
    const { byMessageId, unplaced } = placeQueuedMessages(msgs, [
      { id: 'q1', messageId: 'u3', content: 'whatever' },
      { id: 'q2', content: 'same' },
      { id: 'q3', content: 'same' },
      { id: 'q4', content: 'same' },
      { id: 'q5', messageId: 'missing', content: 'nowhere' },
    ])
    expect(byMessageId.get('u3')?.map(q => q.id)).toEqual(['q1'])
    expect(byMessageId.get('u2')?.map(q => q.id)).toEqual(['q2'])
    expect(byMessageId.get('u1')?.map(q => q.id)).toEqual(['q3'])
    expect(unplaced.map(q => q.id)).toEqual(['q4', 'q5'])
  })
})
