// @vitest-environment node
/**
 * T0424 (PLAN-036): `pty:create` over the PTY cap answers a structured result.
 *
 * T0404's `PtyLimitError` used to escape the handler as a thrown error; across the remote
 * WebSocket (`invoke-error` carries `error: message` only) and Electron IPC the `code` was
 * lost, so the renderer could only show a blank terminal. The handler now returns
 * `{ ok: false, created: false, code: 'PTY_LIMIT_REACHED', limit }`; other errors still throw.
 * The wire-level check (real headless + wss) lives in headless-orphan-pty.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { registerPtyHandlers } from '../handlers/pty'
import type { SharedHandler } from '../handlers/types'
import { PtyLimitError, type PtyManager } from '../pty-manager'
import { normalizePathsInResult } from '../remote/path-aware-channels'
import { IdentityTranslator } from '../remote/path-translator'

function setup(manager: Partial<PtyManager> | null) {
  const handlers = new Map<string, SharedHandler>()
  registerPtyHandlers((channel, handler) => { handlers.set(channel, handler) }, {
    getPtyManager: () => manager as PtyManager | null,
  })
  const create = (options: unknown) => handlers.get('pty:create')!({} as never, options)
  return { create }
}

const OPTS = { id: 't1', cwd: '/tmp', type: 'terminal' }

describe('pty:create PTY limit (T0424)', () => {
  it('PtyLimitError → { ok: false, created: false, code, limit }', () => {
    const { create } = setup({ createWithResult: vi.fn(() => { throw new PtyLimitError(3) }) })
    expect(create(OPTS)).toEqual({ ok: false, created: false, code: 'PTY_LIMIT_REACHED', limit: 3 })
  })

  it('the result is plain JSON: code and limit survive serialization', () => {
    const { create } = setup({ createWithResult: vi.fn(() => { throw new PtyLimitError(64) }) })
    const wire = JSON.parse(JSON.stringify(create(OPTS)))
    expect(wire).toEqual({ ok: false, created: false, code: 'PTY_LIMIT_REACHED', limit: 64 })
    // RemoteClient passes pty:create results through untouched (no path fields).
    expect(normalizePathsInResult('pty:create', wire, new IdentityTranslator())).toEqual(wire)
  })

  it('other errors still throw', () => {
    const { create } = setup({ createWithResult: vi.fn(() => { throw new Error('spawn failed') }) })
    expect(() => create(OPTS)).toThrow('spawn failed')
  })

  it('success and the no-manager fallback are unchanged', () => {
    expect(setup({ createWithResult: vi.fn(() => ({ ok: true, created: true })) }).create(OPTS)).toEqual({ ok: true, created: true })
    expect(setup(null).create(OPTS)).toEqual({ ok: false, created: false })
  })
})
