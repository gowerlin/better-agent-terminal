/**
 * T0725: the Claude panel draws the accumulated task list (TaskCreate / TaskUpdate / TaskList) on the
 * last Task* card of a run, for history / resume (`onHistory`) and live tool events alike. Task* are
 * not sub-agents: no active-task bar entry. TodoWrite keeps its own checklist.
 * Replay rules: src/lib/__tests__/claude-task-list.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'

/** Same permissive stand-in as snippet-prompt-no-path.test.tsx. */
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

type Listener = (sid: string, payload: unknown) => void
let listeners: Record<string, Listener | undefined> = {}
const capture = (name: string) => vi.fn((cb: Listener) => { listeners[name] = cb; return () => {} })

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  listeners = {}
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    debug: { log: vi.fn(), isDebugMode: false },
    claude: {
      getStatuslineExtras: vi.fn(async () => ({})),
      onHistory: capture('history'),
      onToolUse: capture('toolUse'),
      onToolResult: capture('toolResult'),
      onMessage: capture('message'),
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

let seq = 0
const tool = (sessionId: string, toolName: string, input: Record<string, unknown>, result?: string) => ({
  id: `toolu_${++seq}`, sessionId, toolName, input, status: result === undefined ? 'running' : 'completed', result, timestamp: 1_700_000_000_000 + seq,
})
const text = (sessionId: string, content: string) => ({ id: `m_${++seq}`, sessionId, role: 'assistant', content, timestamp: 1_700_000_000_000 + seq })

const checklists = (container: HTMLElement) => [...container.querySelectorAll('.claude-todo-checklist')].map(list =>
  [...list.querySelectorAll('.claude-todo-item')].map(el => `${el.className.replace('claude-todo-item claude-todo-', '')}:${el.querySelector('.claude-todo-text')?.textContent}`))

describe('ClaudeAgentPanel task list (T0725)', () => {
  test('history / resume: replays Task* and draws the list on the last card of each run', async () => {
    const sid = 't0725-history'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {
      listeners.history?.(sid, [
        text(sid, 'Planning'),
        tool(sid, 'TaskCreate', { subject: 'Write tests', description: 'd' }, 'Task #1 created successfully: Write tests'),
        tool(sid, 'TaskCreate', { subject: 'Fix bug', description: 'd' }, 'Task #2 created successfully: Fix bug'),
        text(sid, 'Working'),
        tool(sid, 'TaskUpdate', { taskId: '1', status: 'completed' }, 'Updated task #1 status'),
        tool(sid, 'TaskUpdate', { taskId: '2', status: 'in_progress' }, 'Updated task #2 status'),
      ])
    })
    expect(checklists(container)).toEqual([
      ['pending:Write tests', 'pending:Fix bug'],
      ['completed:Write tests', 'in_progress:Fix bug'],
    ])
    expect(container.textContent).toContain('Added: Write tests')
    expect(container.textContent).toContain('#2 → in progress')
    expect(container.textContent).toContain('1/2 done')
    expect(container.querySelector('.claude-active-task-item')).toBeNull()
  })

  test('live tool events: list follows TaskCreate result and TaskList snapshot', async () => {
    const sid = 't0725-live'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => { listeners.history?.(sid, [text(sid, 'start')]) })
    const create = tool(sid, 'TaskCreate', { subject: 'Draft', description: 'd' })
    await act(async () => { listeners.toolUse?.(sid, create) })
    expect(checklists(container)).toEqual([['pending:Draft']])
    await act(async () => { listeners.toolResult?.(sid, { id: create.id, status: 'completed', result: 'Task #5 created successfully: Draft' }) })
    await act(async () => { listeners.message?.(sid, text(sid, 'x')) })
    const list = tool(sid, 'TaskList', {}, '#5 [completed] Draft\n#6 [pending] Review')
    await act(async () => { listeners.toolUse?.(sid, list) })
    expect(checklists(container)).toEqual([['pending:Draft'], ['completed:Draft', 'pending:Review']])
    expect(container.querySelector('.claude-active-task-item')).toBeNull()
  })

  test('TodoWrite keeps its own checklist', async () => {
    const sid = 't0725-todo'
    const { container } = render(<ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} workspaceId="ws-1" />)
    await act(async () => {
      listeners.history?.(sid, [tool(sid, 'TodoWrite', { todos: [{ content: 'Old style', status: 'in_progress' }] }, 'ok')])
    })
    expect(checklists(container)).toEqual([['in_progress:Old style']])
    expect(container.textContent).toContain('Checklist')
  })
})
