/**
 * T0769 / BUG-192 (D214 P-1): a message that could not go into the open query (a background Agent
 * keeps it open, but its input had already closed) waits for that query to end. The panel shows
 * 「等背景子代理結束後送出」 with a cancel button under that message; cancel = removed from main's
 * `messageQueue` (`claude:cancel-queued-message`). The list comes from `claude:queued-messages`.
 * Main side: electron/__tests__/claude-send-during-background-agent.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { placeQueuedMessages, type ClaudeMessage, type ClaudeToolCall } from '../types/claude-agent'

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

  test('a cancel that found nothing (already sent) leaves the list to main; an empty list clears it', async () => {
    cancelQueuedMessage.mockResolvedValueOnce({ cancelled: false, idle: false })
    const sid = 't0769-queued-late'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    emit('message', sid, user(sid, 'user-1', 'next'))
    emit('queuedMessages', sid, [{ id: 'queued-1', messageId: 'user-main-1', content: 'next' }]) // matched by content
    expect(container.querySelector('.claude-queued-note')!.previousElementSibling?.getAttribute('data-user-msg-id')).toBe('user-1')
    await act(async () => { fireEvent.click(container.querySelector('.claude-queued-cancel-btn')!) })
    expect(container.querySelector('.claude-queued-note')).not.toBeNull()
    emit('queuedMessages', sid, [])
    expect(container.querySelector('.claude-queued-note')).toBeNull()
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
    } finally {
      await i18n.changeLanguage('en')
    }
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
