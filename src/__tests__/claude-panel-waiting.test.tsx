/**
 * T0762 (D200 / D203): the Claude Agent panel feeds its permission / AskUserQuestion card into the
 * attention store, so the tab's thumbnail and workspace row show ⚠️ by the same rule as a PTY tab.
 *
 * - `claude:permission-request` → the tab waits (`permission`); `claude:permission-resolved`
 *   (answered here or in another window) → no longer
 * - `claude:ask-user` → `question`; `claude:ask-user-resolved` → no longer
 * - the query fails (`claude:error`) while a card is up → no longer (the card itself stays as before)
 * - a new request after that → waits again
 * - unmount → forgotten, no faded ⚠️; the permission flow itself (IPC calls) is untouched
 * Store rules: src/stores/__tests__/terminal-attention-store.panel.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { getMissedWait, getTerminalAttention, resetTerminalAttention } from '../stores/terminal-attention-store'
import { waitingForUser } from '../lib/terminal-attention'

/** Same permissive stand-in as claude-panel-task-list.test.tsx. */
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
const reason = (sid: string) => waitingForUser(getTerminalAttention(sid))?.reason ?? null

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  resetTerminalAttention()
  listeners = {}
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    debug: { log: vi.fn(), isDebugMode: false },
    claude: {
      getStatuslineExtras: vi.fn(async () => ({})),
      onPermissionRequest: capture('permissionRequest'),
      onPermissionResolved: capture('permissionResolved'),
      onAskUser: capture('askUser'),
      onAskUserResolved: capture('askUserResolved'),
      onError: capture('error'),
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  resetTerminalAttention()
})

const permission = (id: string) => ({ toolUseId: id, toolName: 'Bash', input: { command: 'mkdir x', description: 'probe' } })
const question = (id: string) => ({ toolUseId: id, questions: [{ question: 'Pick one?', header: 'Pick', options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }], multiSelect: false }] })

describe('ClaudeAgentPanel → the tab waits for the user (T0762)', () => {
  test('permission card → permission; resolved → none (unseen → faded)', async () => {
    const sid = 't0762-perm'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    expect(reason(sid)).toBeNull()
    emit('permissionRequest', sid, permission('toolu_1'))
    expect(container.querySelector('.claude-permission-card')).not.toBeNull()
    expect(reason(sid)).toBe('permission')
    emit('permissionRequest', 'other-session', permission('toolu_x')) // another tab's request: ignored
    emit('permissionResolved', sid, 'toolu_1')
    expect(container.querySelector('.claude-permission-card')).toBeNull()
    expect(reason(sid)).toBeNull()
    expect(getMissedWait(sid)?.reason).toBe('permission') // nobody looked at it (no focused window in the test)
  })

  test('AskUserQuestion card → question; resolved → none', async () => {
    const sid = 't0762-ask'
    render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    emit('askUser', sid, question('toolu_2'))
    expect(reason(sid)).toBe('question')
    emit('askUserResolved', sid, 'toolu_2')
    expect(reason(sid)).toBeNull()
  })

  test('the query fails while a card is up → no longer waits; the next request waits again', async () => {
    const sid = 't0762-error'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    emit('askUser', sid, question('toolu_3'))
    expect(reason(sid)).toBe('question')
    emit('error', sid, 'boom')
    expect(reason(sid)).toBeNull()
    expect(container.querySelector('.claude-ask-card')).not.toBeNull() // the card itself is untouched
    emit('permissionRequest', sid, permission('toolu_4'))
    expect(reason(sid)).toBe('permission')
  })

  test('unmount → forgotten, no faded ⚠️; no permission IPC was called', async () => {
    const sid = 't0762-unmount'
    const { unmount } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {})
    emit('permissionRequest', sid, permission('toolu_5'))
    expect(reason(sid)).toBe('permission')
    unmount()
    expect(getTerminalAttention(sid)).toBeNull()
    expect(getMissedWait(sid)).toBeNull()
    const claude = (window as unknown as { electronAPI: { claude: { resolvePermission: { mock: { calls: unknown[] } } } } }).electronAPI.claude
    expect(claude.resolvePermission.mock.calls).toHaveLength(0)
  })
})
