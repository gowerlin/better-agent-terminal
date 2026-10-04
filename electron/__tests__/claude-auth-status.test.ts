/**
 * T0402: `claude:auth-status` — `claude auth status` exits 1 when logged out but still
 * prints `{"loggedIn": false, ...}`; that JSON is answered as-is instead of null.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const run = vi.hoisted(() => ({
  err: null as (Error & { code?: number | string }) | null,
  stdout: '',
  calls: [] as Array<{ file: string; args: string[] }>,
}))

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>()
  const execFile = (file: string, args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    run.calls.push({ file, args })
    cb(run.err, run.stdout, '')
  }
  return { ...actual, default: { ...actual, execFile }, execFile }
})

vi.mock('../claude-runtime-router', () => ({
  getRuntimeSettingsSnapshot: () => ({}),
  resolveClaudeRuntime: async () => ({ path: '/fake/claude', source: 'embedded' }),
}))

vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import { parseClaudeAuthStatus, registerClaudeHandlers } from '../handlers/claude'

type Handler = (ctx: unknown, ...args: unknown[]) => unknown

function authStatusHandler(): Handler {
  const handlers = new Map<string, Handler>()
  registerClaudeHandlers(((channel: string, fn: Handler) => { handlers.set(channel, fn) }) as never, {
    emit: () => {},
    homeDir: '/home/test',
    getClaudeManager: () => null,
  })
  const fn = handlers.get('claude:auth-status')
  if (!fn) throw new Error('claude:auth-status not registered')
  return fn
}

function exitError(code: number): Error & { code: number } {
  return Object.assign(new Error(`Command failed: claude auth status`), { code })
}

const LOGGED_OUT = { loggedIn: false, authMethod: 'none', apiProvider: 'firstParty' }
const LOGGED_IN = { loggedIn: true, email: 'a@example.com', authMethod: 'claude.ai', subscriptionType: 'max' }

beforeEach(() => {
  run.err = null
  run.stdout = ''
  run.calls.length = 0
})

describe('claude:auth-status', () => {
  it('exit≠0 + JSON stdout with loggedIn → that JSON (not null)', async () => {
    run.err = exitError(1)
    run.stdout = JSON.stringify(LOGGED_OUT, null, 2)
    await expect(authStatusHandler()({})).resolves.toEqual(LOGGED_OUT)
    expect(run.calls).toEqual([{ file: '/fake/claude', args: ['auth', 'status'] }])
  })

  it('exit≠0 + non-JSON stdout → null', async () => {
    run.err = exitError(1)
    run.stdout = 'error: unknown command'
    await expect(authStatusHandler()({})).resolves.toBeNull()
  })

  it('exit≠0 + empty stdout (spawn failure) → null', async () => {
    run.err = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
    await expect(authStatusHandler()({})).resolves.toBeNull()
  })

  it('exit 0 + JSON stdout → that JSON', async () => {
    run.stdout = JSON.stringify(LOGGED_IN)
    await expect(authStatusHandler()({})).resolves.toEqual(LOGGED_IN)
  })
})

describe('parseClaudeAuthStatus', () => {
  it('requires a JSON object with a boolean loggedIn', () => {
    expect(parseClaudeAuthStatus(JSON.stringify(LOGGED_OUT))).toEqual(LOGGED_OUT)
    expect(parseClaudeAuthStatus('{"authMethod":"none"}')).toBeNull()
    expect(parseClaudeAuthStatus('{"loggedIn":"false"}')).toBeNull()
    expect(parseClaudeAuthStatus('[{"loggedIn":false}]')).toBeNull()
    expect(parseClaudeAuthStatus('null')).toBeNull()
    expect(parseClaudeAuthStatus('')).toBeNull()
    expect(parseClaudeAuthStatus(undefined)).toBeNull()
  })
})
