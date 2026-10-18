// @vitest-environment node
/**
 * PLAN-050 / T0641 (C-3): `createClaudeNameSupportCheck` — does the claude a claude-cli launch runs
 * know `--name` (>= 2.1.76).
 *   - embedded (and system → embedded fallback): never probed
 *   - system: `<path> --version` via execFile (array args, 5 s timeout), cached by path + mtime,
 *     only parsed versions cached; < 2.1.76 → claude-too-old, unreadable → version-unknown
 *   - the runtime not resolvable → version-unknown; never rejects
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('claude-version-check must not import electron')
})

import {
  CLAUDE_NAME_MIN_VERSION,
  CLAUDE_VERSION_TIMEOUT_MS,
  claudeVersionSupportsName,
  createClaudeNameSupportCheck,
  type ClaudeNameRuntime,
} from '../claude-version-check'
import type { ExecFileLike } from '../codex-osc-version'

function fakeExec(outputs: Record<string, string | Error>) {
  const calls: Array<{ file: string; args: string[]; timeout: number; windowsHide: boolean }> = []
  const run: ExecFileLike = (file, args, options, callback) => {
    calls.push({ file, args, timeout: options.timeout, windowsHide: options.windowsHide })
    const out = outputs[file]
    if (out instanceof Error || out === undefined) callback(out ?? new Error('ENOENT'), '', '')
    else callback(null, out, '')
    return undefined
  }
  return { run, calls }
}

describe('createClaudeNameSupportCheck', () => {
  it('embedded / fallback-to-embedded: inject, never probed', async () => {
    for (const source of ['embedded', 'system-fallback-to-embedded'] as const) {
      const { run, calls } = fakeExec({})
      const check = createClaudeNameSupportCheck({ resolveRuntime: async () => ({ source, path: 'C:\\BAT\\claude.exe' }), execFile: run })
      expect(await check()).toEqual({ inject: true, runtime: 'embedded' })
      expect(calls).toEqual([])
    }
  })

  it('system >= 2.1.76: inject; execFile <path> --version, 5 s timeout, hidden', async () => {
    const { run, calls } = fakeExec({ '/usr/bin/claude': '2.1.302 (Claude Code)\n' })
    const logs: string[] = []
    const check = createClaudeNameSupportCheck({
      resolveRuntime: async () => ({ source: 'system', path: '/usr/bin/claude' }),
      execFile: run,
      mtimeMs: () => 1,
      logger: { log: m => logs.push(m) },
    })
    expect(await check()).toEqual({ inject: true, runtime: 'system', version: '2.1.302' })
    expect(calls).toEqual([{ file: '/usr/bin/claude', args: ['--version'], timeout: CLAUDE_VERSION_TIMEOUT_MS, windowsHide: true }])
    expect(CLAUDE_VERSION_TIMEOUT_MS).toBe(5_000)
    expect(logs).toEqual(['[claude-version] path=/usr/bin/claude version=2.1.302 (probed) → name=yes'])
  })

  it('system < 2.1.76 → claude-too-old; exactly 2.1.76 → inject', async () => {
    const versions: Record<string, string> = { '/a': '2.1.75 (Claude Code)', '/b': '2.1.76 (Claude Code)', '/c': '1.0.128 (Claude Code)' }
    const { run } = fakeExec(versions)
    let path = '/a'
    const check = createClaudeNameSupportCheck({ resolveRuntime: async () => ({ source: 'system', path }), execFile: run, mtimeMs: () => 1 })
    expect(await check()).toEqual({ inject: false, reason: 'claude-too-old', version: '2.1.75' })
    path = '/b'
    expect(await check()).toEqual({ inject: true, runtime: 'system', version: '2.1.76' })
    path = '/c'
    expect(await check()).toMatchObject({ inject: false, reason: 'claude-too-old' })
    expect(CLAUDE_NAME_MIN_VERSION).toBe('2.1.76')
    expect(claudeVersionSupportsName('2.1.300')).toBe(true)
    expect(claudeVersionSupportsName('2.2.0-beta.1')).toBe(true)
    expect(claudeVersionSupportsName('2.0.99')).toBe(false)
  })

  it('unreadable version → version-unknown (spawn error, unparsable output, no path, sync throw)', async () => {
    const { run } = fakeExec({ '/err': new Error('ENOENT'), '/garbage': 'v24.1.0\n' })
    let path = '/err'
    const logs: string[] = []
    const check = createClaudeNameSupportCheck({ resolveRuntime: async () => ({ source: 'system', path }), execFile: run, mtimeMs: () => 1, logger: { log: m => logs.push(m) } })
    expect(await check()).toEqual({ inject: false, reason: 'version-unknown' })
    path = '/garbage'
    expect(await check()).toEqual({ inject: false, reason: 'version-unknown' })
    path = ''
    expect(await check()).toEqual({ inject: false, reason: 'version-unknown' })
    expect(logs).toContain('[claude-version] path=/err version=unknown (probed) → name=no (version-unknown)')
    const throwing = createClaudeNameSupportCheck({
      resolveRuntime: async () => ({ source: 'system', path: '/x' }),
      execFile: () => { throw new Error('EINVAL') },
      mtimeMs: () => 1,
    })
    expect(await throwing()).toEqual({ inject: false, reason: 'version-unknown' })
  })

  it('the runtime cannot be resolved → version-unknown (no throw)', async () => {
    const logs: string[] = []
    const check = createClaudeNameSupportCheck({ resolveRuntime: async () => { throw new Error('System claude unavailable: system-not-found') }, logger: { log: m => logs.push(m) } })
    await expect(check()).resolves.toEqual({ inject: false, reason: 'version-unknown' })
    expect(logs[0]).toMatch(/^\[claude-version\] path=- version=unknown \(runtime: System claude unavailable/)
  })

  it('cache: path + mtime; a changed mtime is probed again; failures are not cached', async () => {
    const outputs: Record<string, string | Error> = { '/c': '2.1.300 (Claude Code)' }
    const { run, calls } = fakeExec(outputs)
    let mtime: number | null = 10
    const logs: string[] = []
    const runtime: ClaudeNameRuntime = { source: 'system', path: '/c' }
    const check = createClaudeNameSupportCheck({ resolveRuntime: async () => runtime, execFile: run, mtimeMs: () => mtime, logger: { log: m => logs.push(m) } })
    await check()
    await check()
    expect(calls).toHaveLength(1)
    expect(logs[1]).toBe('[claude-version] path=/c version=2.1.300 (cached) → name=yes')
    mtime = 11
    outputs['/c'] = '2.1.50 (Claude Code)'
    expect(await check()).toMatchObject({ inject: false, reason: 'claude-too-old' })
    expect(calls).toHaveLength(2)
    // no mtime → probed every time, nothing cached
    mtime = null
    await check()
    await check()
    expect(calls).toHaveLength(4)
    // a failure is probed again
    mtime = 12
    outputs['/c'] = new Error('timeout')
    await check()
    outputs['/c'] = '2.1.300 (Claude Code)'
    expect(await check()).toMatchObject({ inject: true })
    expect(calls).toHaveLength(6)
  })
})
