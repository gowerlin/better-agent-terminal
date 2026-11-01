// @vitest-environment node
/**
 * T0729 / BUG-177: `getSupportedModels` reads the model list without starting a turn.
 *
 * A string prompt (the old `''`) makes the CLI run one turn — a full request to the default model
 * and a session file under `~/.claude/projects/`. The probe now passes a streaming-input prompt
 * that never yields a message (`idleSdkPrompt`), reads `supportedModels()`, then ends the iterable
 * and `close()`s the query. The builtin merge, the runtime path, `cwd` and the spawn env are unchanged.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))

const sdk = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: sdk.query,
  listSessions: vi.fn(),
  getSessionMessages: vi.fn(),
  getSubagentMessages: vi.fn(),
  listSubagents: vi.fn(),
}))

import { ClaudeAgentManager, idleSdkPrompt } from '../claude-agent-manager'

type Probe = { prompt: unknown; options: Record<string, unknown> }
type Runtime = { source: 'embedded' | 'system'; path?: string }

const managers: ClaudeAgentManager[] = []

function manager(runtime: Runtime = { source: 'embedded', path: 'C:\\demo\\claude.exe' }): ClaudeAgentManager {
  const m = new ClaudeAgentManager({ emit: vi.fn(), getSettings: () => ({}) })
  ;(m as unknown as { resolveRuntimeForSession: () => Promise<Runtime> }).resolveRuntimeForSession = async () => runtime
  managers.push(m)
  return m
}

/** Reads the prompt the way the SDK does: pulls the next message, or reports that none came yet. */
async function nextOrPending(iter: AsyncIterator<unknown>, ms = 50): Promise<'pending' | IteratorResult<unknown>> {
  return Promise.race([iter.next(), new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), ms))])
}

function fakeQuery(models: unknown[] | Error) {
  const calls: Probe[] = []
  const close = vi.fn()
  sdk.query.mockImplementation((args: Probe) => {
    calls.push(args)
    return {
      supportedModels: vi.fn(async () => {
        if (models instanceof Error) throw models
        return models
      }),
      close,
    }
  })
  return { calls, close }
}

afterEach(() => {
  sdk.query.mockReset()
  managers.length = 0
})

describe('idleSdkPrompt (T0729)', () => {
  it('yields no message until released, then ends', async () => {
    const idle = idleSdkPrompt()
    const iter = idle.prompt[Symbol.asyncIterator]()
    expect(await nextOrPending(iter)).toBe('pending')
    idle.release()
    await expect(iter.next()).resolves.toEqual({ done: true, value: undefined })
  })
})

describe('getSupportedModels (T0729 / BUG-177)', () => {
  it('passes a prompt that sends no user message, then releases it and closes the query', async () => {
    const { calls, close } = fakeQuery([{ value: 'default', displayName: 'Default', description: '' }])
    const m = manager()
    const pending = m.getSupportedModels('s1')
    await vi.waitFor(() => expect(calls).toHaveLength(1))
    const prompt = calls[0].prompt
    expect(typeof prompt).not.toBe('string')
    const iter = (prompt as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    // While the list is read, the prompt offers nothing — no turn, no model request.
    const first = iter.next()
    await pending
    expect(close).toHaveBeenCalledTimes(1)
    // After the probe the iterable ended without ever producing a message.
    await expect(first).resolves.toEqual({ done: true, value: undefined })
  })

  it('keeps cwd, the runtime path and the spawn env of the old probe', async () => {
    const { calls } = fakeQuery([])
    await manager({ source: 'embedded', path: 'C:\\demo\\claude.exe' }).getSupportedModels('s1')
    const { options } = calls[0]
    expect(options.cwd).toBe('/')
    expect(options.pathToClaudeCodeExecutable).toBe('C:\\demo\\claude.exe')
    expect((options.env as Record<string, string>).DISABLE_UPDATES).toBe('1')
    expect(Object.keys(options).sort()).toEqual(['cwd', 'env', 'pathToClaudeCodeExecutable'])
  })

  it('merges the SDK list with the builtins exactly as before', async () => {
    fakeQuery([
      { value: 'default', displayName: 'Default', description: 'account default', resolvedModel: 'claude-opus-5-5' },
      { value: 'opus', displayName: 'Opus', description: '', resolvedModel: 'claude-opus-5-5' },
      { value: 'claude-opus-5-5', displayName: 'Opus 5.5', description: '' },
      { value: 'some-new-model', displayName: 'New', description: '' },
    ])
    const list = await manager().getSupportedModels('s1')
    const sdkRows = list.filter(r => r.source === 'sdk').map(r => r.value)
    expect(sdkRows).toEqual(['default', 'some-new-model'])
    expect(list.filter(r => r.source === 'builtin').length).toBeGreaterThan(0)
    expect(list.findIndex(r => r.source === 'sdk')).toBe(list.filter(r => r.source === 'builtin').length)
  })

  it('on failure: builtins only, and the prompt is still released and the query closed', async () => {
    const { calls, close } = fakeQuery(new Error('cli gone'))
    const list = await manager().getSupportedModels('s1')
    expect(list.length).toBeGreaterThan(0)
    expect(list.every(r => r.source === 'builtin')).toBe(true)
    expect(close).toHaveBeenCalledTimes(1)
    const iter = (calls[0].prompt as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await expect(iter.next()).resolves.toEqual({ done: true, value: undefined })
  })

  it('no longer passes a string prompt (source guard)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'claude-agent-manager.ts'), 'utf8')
    const body = src.slice(src.indexOf('async getSupportedModels('), src.indexOf('async getAccountInfo('))
    expect(body).toContain('prompt: idle.prompt')
    expect(body).not.toMatch(/prompt:\s*['"`]/)
  })
})
