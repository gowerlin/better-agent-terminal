/**
 * T0725: replay of the CLI task tools into the Claude panel's task list.
 * Result texts are the CLI 2.1.316 formats (see the header of `claude-task-list.ts`).
 */
import { describe, expect, it } from 'vitest'
import {
  EMPTY_TASK_LIST,
  HISTORY_RESULT_MAX_CHARS,
  isTaskListToolName,
  parseTaskListResult,
  replayTaskList,
  taskListProgress,
  taskResultText,
  type TaskToolCallLike,
} from '../claude-task-list'

let seq = 0
const call = (toolName: string, input: Record<string, unknown>, result?: string, status = result === undefined ? 'running' : 'completed'): TaskToolCallLike =>
  ({ id: `toolu_${++seq}`, toolName, input, result, status })
const create = (id: string, subject: string, extra: Record<string, unknown> = {}) =>
  call('TaskCreate', { subject, description: `${subject} desc`, ...extra }, `Task #${id} created successfully: ${subject}`)
const update = (taskId: string, input: Record<string, unknown>, result = `Updated task #${taskId} ${Object.keys(input).join(', ')}`) =>
  call('TaskUpdate', { taskId, ...input }, result)
const summary = (items: ReadonlyArray<unknown>) => replayTaskList(items).list.items.map(i => `${i.id ?? '?'}:${i.status}:${i.subject}`)

describe('TaskCreate', () => {
  it('builds items in creation order with the id from the result text', () => {
    expect(summary([create('1', 'Write tests'), create('2', 'Fix bug')])).toEqual(['1:pending:Write tests', '2:pending:Fix bug'])
  })

  it('shows a running create without id, then keys it by the id once the result arrives', () => {
    const running = call('TaskCreate', { subject: 'Draft', description: 'd' })
    const before = replayTaskList([running]).list.items
    expect(before).toEqual([{ key: `call-${running.id}`, subject: 'Draft', status: 'pending' }])
    const done = { ...running, status: 'completed', result: 'Task #7 created successfully: Draft' }
    expect(replayTaskList([done]).list.items).toEqual([{ key: 'task-7', id: '7', subject: 'Draft', status: 'pending' }])
  })

  it('keeps activeForm from the input', () => {
    expect(replayTaskList([create('1', 'Run build', { activeForm: 'Running build' })]).list.items[0].activeForm).toBe('Running build')
  })

  it('reads a JSON block-array result', () => {
    const c = call('TaskCreate', { subject: 'A', description: 'd' }, JSON.stringify([{ type: 'text', text: 'Task #3 created successfully: A' }]))
    expect(summary([c])).toEqual(['3:pending:A'])
  })
})

describe('TaskUpdate', () => {
  it('changes status and subject from the input', () => {
    expect(summary([
      create('1', 'A'), create('2', 'B'),
      update('1', { status: 'in_progress' }),
      update('2', { status: 'completed', subject: 'B (renamed)' }),
    ])).toEqual(['1:in_progress:A', '2:completed:B (renamed)'])
  })

  it('applies while running (no result yet)', () => {
    expect(summary([create('1', 'A'), call('TaskUpdate', { taskId: '1', status: 'in_progress' })])).toEqual(['1:in_progress:A'])
  })

  it('deleted removes the item', () => {
    expect(summary([create('1', 'A'), create('2', 'B'), update('1', { status: 'deleted' })])).toEqual(['2:pending:B'])
  })

  it('a failure result (no is_error), an error status or a denied call changes nothing', () => {
    const base = [create('1', 'A')]
    expect(summary([...base, update('1', { status: 'completed' }, 'Task not found')])).toEqual(['1:pending:A'])
    expect(summary([...base, update('1', { status: 'completed' }, 'Blocked by TaskCompleted hook')])).toEqual(['1:pending:A'])
    expect(summary([...base, { ...update('1', { status: 'completed' }), status: 'error' }])).toEqual(['1:pending:A'])
    expect(summary([...base, { ...update('1', { status: 'completed' }), denied: true }])).toEqual(['1:pending:A'])
  })

  it('an unknown task id changes nothing', () => {
    expect(summary([create('1', 'A'), update('9', { status: 'completed' })])).toEqual(['1:pending:A'])
  })
})

describe('TaskList snapshot', () => {
  it('replaces the whole list', () => {
    const list = call('TaskList', {}, ['#1 [completed] A', '#4 [in_progress] D [blocked by #1, #2]', '#5 [pending] E (agent-1)'].join('\n'))
    expect(summary([create('1', 'A'), create('2', 'B'), list])).toEqual(['1:completed:A', '4:in_progress:D', '5:pending:E (agent-1)'])
  })

  it('keeps a known subject when the line adds an owner suffix', () => {
    const list = call('TaskList', {}, '#1 [pending] Write tests (main)')
    expect(summary([create('1', 'Write tests'), list])).toEqual(['1:pending:Write tests'])
  })

  it('"No tasks found" empties the list', () => {
    expect(summary([create('1', 'A'), call('TaskList', {}, 'No tasks found')])).toEqual([])
  })

  it('a history result cut at the limit updates listed tasks and keeps the rest', () => {
    const lines = ['#1 [completed] A', '#2 [in_progress] B', '#3 [pending] partial subj']
    const cut = lines.join('\n').padEnd(HISTORY_RESULT_MAX_CHARS, 'x').slice(0, HISTORY_RESULT_MAX_CHARS)
    expect(summary([create('1', 'A'), create('2', 'B'), create('3', 'C'), call('TaskList', {}, cut)]))
      .toEqual(['1:completed:A', '2:in_progress:B', '3:pending:C'])
  })
})

describe('parse failures never throw and never clear the list', () => {
  it.each([
    ['TaskCreate', { subject: 'X' }, 'something unexpected'],
    ['TaskList', {}, 'garbage\nmore garbage'],
    ['TaskList', {}, '{"not":"a list"}'],
    ['TaskList', {}, '[{"broken json'],
    ['TaskUpdate', { status: 'completed' }, 'Updated task #1 status'],
  ])('%s with %j / %j keeps the existing list', (toolName, input, result) => {
    expect(summary([create('1', 'A'), call(toolName, input as Record<string, unknown>, result)])).toEqual(['1:pending:A'])
  })

  it('odd inputs are ignored', () => {
    const odd = [null, 1, 'x', {}, { toolName: 'TaskCreate' }, { id: 'a', toolName: 'TaskUpdate', input: null, result: 42 }]
    expect(() => replayTaskList(odd)).not.toThrow()
    expect(replayTaskList(odd).list).toEqual(EMPTY_TASK_LIST)
  })
})

describe('replay', () => {
  it('ignores other tools, TodoWrite and Task / Agent sub-agent calls', () => {
    const items = [
      create('1', 'A'),
      call('TodoWrite', { todos: [{ content: 'x', status: 'pending' }] }, 'ok'),
      call('Task', { description: 'sub' }, 'done'),
      call('Agent', { description: 'sub' }, 'done'),
      call('TaskGet', { taskId: '1' }, 'Task #1: A'),
      { id: 'm1', role: 'assistant', content: 'hi' },
    ]
    expect(summary(items)).toEqual(['1:pending:A'])
    expect(isTaskListToolName('TaskGet')).toBe(false)
    expect(isTaskListToolName('TodoWrite')).toBe(false)
  })

  it('records a snapshot after each Task* call and continues from a base', () => {
    const a = create('1', 'A'), b = update('1', { status: 'completed' })
    const { snapshots, list } = replayTaskList([a, b])
    expect(snapshots.get(a.id)?.items[0].status).toBe('pending')
    expect(snapshots.get(b.id)?.items[0].status).toBe('completed')
    // Archive: replay the archived part into a base, then the rest on top → same as one replay.
    const c = create('2', 'B')
    expect(replayTaskList([c], replayTaskList([a, b]).list).list).toEqual(replayTaskList([a, b, c]).list)
    expect(taskListProgress(list)).toEqual({ completed: 1, total: 1 })
  })

  it('does not mutate the base list', () => {
    const base = replayTaskList([create('1', 'A')]).list
    const copy = JSON.parse(JSON.stringify(base))
    replayTaskList([update('1', { status: 'completed' }), update('1', { status: 'deleted' })], base)
    expect(base).toEqual(copy)
  })
})

describe('helpers', () => {
  it('parseTaskListResult', () => {
    expect(parseTaskListResult('No tasks found')).toEqual([])
    expect(parseTaskListResult('nothing')).toBeNull()
    expect(parseTaskListResult('#2 [weird] X')).toEqual([{ id: '2', status: 'pending', text: 'X' }])
  })

  it('taskResultText', () => {
    expect(taskResultText(undefined)).toBe('')
    expect(taskResultText('[not json')).toBe('[not json')
    expect(taskResultText(JSON.stringify([{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }]))).toBe('a\nb')
  })
})
