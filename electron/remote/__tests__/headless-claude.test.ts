// @vitest-environment node
/**
 * T0401 (PLAN-036 P1-F): `claude:*` online on headless.
 *
 * Wire-level through the T0388 harness (in-process headless + wss client). No
 * real Claude API traffic: the SDK is mocked (captures the spawn options of the
 * model-list probe) and the embedded claude is a fake file in a temp install
 * root laid out like the server bundle (`node_modules/@anthropic-ai/claude-code/bin/claude`).
 *   - get-cli-path / detectRuntime / auth-status / get-supported-models answer
 *     without a login
 *   - spawn env: embedded (incl. system → embedded fallback) carries
 *     DISABLE_UPDATES=1, a system claude does not
 *   - runtime-degraded / runtime-warning reach the remote client (PROXIED_EVENTS)
 *   - codex channels stay unregistered; a codex preset is rejected clearly
 *   - message archive channels are not on headless (ALWAYS_LOCAL_CHANNELS)
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeRuntimeInfo } from '../../claude-resolver'
import { CODEX_UNSUPPORTED_MESSAGE } from '../../handlers/claude'
import { ALWAYS_LOCAL_CHANNELS, HEADLESS_UNSUPPORTED } from '../headless-channel-status'
import { resolveHeadlessEmbeddedLayout } from '../headless-entry'
import { PROXIED_EVENTS } from '../protocol'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const sdk = vi.hoisted(() => ({
  probeOptions: [] as Array<Record<string, unknown>>,
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: ({ options }: { options: Record<string, unknown> }) => {
    sdk.probeOptions.push(options)
    return {
      supportedModels: async () => [
        { value: 'sonnet', displayName: 'Sonnet', description: '', resolvedModel: 'claude-sonnet-5-5' },
        { value: 'claude-test-model', displayName: 'Test', description: 'sdk-only' },
      ],
      close: () => {},
    }
  },
  listSessions: async () => [],
  getSessionMessages: async () => [],
  getSubagentMessages: async () => [],
  listSubagents: async () => [],
  unstable_v2_createSession: () => { throw new Error('not used') },
  unstable_v2_resumeSession: () => { throw new Error('not used') },
}))

const system = vi.hoisted(() => ({ info: null as ClaudeRuntimeInfo | null }))

vi.mock('../../claude-resolver', async importOriginal => ({
  ...(await importOriginal<typeof import('../../claude-resolver')>()),
  detectSystemClaude: async () => system.info,
}))

const BIN_NAME = process.platform === 'win32' ? 'claude.exe' : 'claude'
const FAKE_SYSTEM_CLAUDE = path.join(os.tmpdir(), 'bat-t0401-system', 'claude')

let installRoot: string
let fakeEmbedded: string
let harness: HeadlessHarness

function writeRuntimeSettings(claudeRuntime: Record<string, unknown> | null): void {
  const file = path.join(harness.dataDir, 'settings.json')
  if (claudeRuntime === null) fs.rmSync(file, { force: true })
  else fs.writeFileSync(file, JSON.stringify({ claudeRuntime }), 'utf-8')
}

async function probeEnv(): Promise<{ env?: Record<string, string | undefined>; executable?: unknown }> {
  sdk.probeOptions.length = 0
  await harness.invoke('claude:get-supported-models', 'no-such-session')
  expect(sdk.probeOptions).toHaveLength(1)
  const options = sdk.probeOptions[0]
  return { env: options.env as Record<string, string | undefined> | undefined, executable: options.pathToClaudeCodeExecutable }
}

beforeAll(async () => {
  installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0401-install-'))
  const binDir = path.join(installRoot, 'node_modules', '@anthropic-ai', 'claude-code', 'bin')
  fs.mkdirSync(binDir, { recursive: true })
  fakeEmbedded = path.join(binDir, BIN_NAME)
  // A real executable that is not claude: every call (`--version`, `auth status`) exits
  // non-zero without printing a version, like a broken / logged-out runtime.
  if (process.platform === 'win32') {
    fs.copyFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe'), fakeEmbedded)
  } else {
    fs.writeFileSync(fakeEmbedded, '#!/bin/sh\nexit 1\n', { mode: 0o755 })
  }
  harness = await startHeadlessHarness({ installRoot, timeoutMs: 20_000 })
})

afterAll(async () => {
  await harness?.dispose()
  fs.rmSync(installRoot, { recursive: true, force: true })
})

beforeEach(() => {
  system.info = null
  writeRuntimeSettings(null)
})

describe('headless claude:* — no login needed', () => {
  it('claude:get-cli-path returns the bundle embedded claude', async () => {
    const cliPath = await harness.invoke('claude:get-cli-path')
    expect(cliPath).toBe(fakeEmbedded)
    expect(String(cliPath)).toMatch(/node_modules[\\/]@anthropic-ai[\\/]claude-code[\\/]bin[\\/]claude(\.exe)?$/)
  })

  it('claude:detectRuntime reports the embedded path and the system probe', async () => {
    const result = await harness.invoke('claude:detectRuntime') as {
      embedded: { path: string; version: string; healthStatus: string }
      system: unknown
    }
    expect(result.embedded.path).toBe(fakeEmbedded)
    // The fake binary prints no version, so the health probe reports spawn-failed.
    expect(result.embedded.healthStatus).toBe('spawn-failed')
    expect(result.system).toBeNull()
  })

  it('claude:auth-status answers null when the runtime cannot report a login', async () => {
    // Same contract as Electron: `claude auth status` failing (incl. its exit 1 when
    // logged out) → null, which the panel shows as "Not logged in".
    await expect(harness.invoke('claude:auth-status')).resolves.toBeNull()
  })

  it('claude:get-supported-models returns builtins plus SDK-only models', async () => {
    const models = await harness.invoke('claude:get-supported-models', 'no-such-session') as Array<{ value: string; source: string }>
    const values = models.map(m => m.value)
    expect(values).toContain('claude-opus-5-5')
    expect(values).toContain('claude-test-model')
    expect(values).not.toContain('sonnet') // alias resolving to a builtin is dropped (T0372)
  })

  it('stub channels answer the same stubs as Electron', async () => {
    await expect(harness.invoke('claude:auth-login')).resolves.toEqual({ success: false, error: 'Auth login is not available in this build' })
    await expect(harness.invoke('claude:account-list')).resolves.toEqual({ accounts: [], activeAccountId: null, switchWarningShown: true })
    await expect(harness.invoke('claude:account-import-current')).resolves.toBeNull()
    await expect(harness.invoke('claude:account-switch')).resolves.toBe(false)
    await expect(harness.invoke('claude:rewind-to-prompt')).resolves.toEqual({ error: 'Rewind is not available in this build' })
  })

  it('session-less channels answer for an unknown session', async () => {
    await expect(harness.invoke('claude:is-resting', 'no-such-session')).resolves.toBe(false)
    await expect(harness.invoke('claude:fetch-subagent-messages', 'no-such-session', 'tool-1')).resolves.toEqual([])
    await expect(harness.invoke('claude:scan-skills', installRoot)).resolves.toEqual(expect.any(Array))
    await expect(harness.invoke('claude:get-statusline-extras')).resolves.toEqual(expect.any(Object))
  })
})

describe('headless claude spawn env (DISABLE_UPDATES only for embedded)', () => {
  it('embedded: probe runs the bundle claude with DISABLE_UPDATES=1', async () => {
    const { env, executable } = await probeEnv()
    expect(executable).toBe(fakeEmbedded)
    expect(env?.DISABLE_UPDATES).toBe('1')
    expect(process.env.DISABLE_AUTOUPDATER).toBe('1') // ClaudeAgentManager, process-wide (BUG-059)
  })

  it('system: probe runs the system claude without DISABLE_UPDATES', async () => {
    system.info = { path: FAKE_SYSTEM_CLAUDE, version: '2.1.300', versionRaw: '2.1.300 (Claude Code)', healthStatus: 'healthy', source: 'path' }
    writeRuntimeSettings({ mode: 'system', fallbackToEmbedded: true })
    const { env, executable } = await probeEnv()
    expect(executable).toBe(FAKE_SYSTEM_CLAUDE)
    expect(env).toBeUndefined() // SDK inherits process.env untouched
  })

  it('system unavailable → embedded fallback carries DISABLE_UPDATES=1', async () => {
    writeRuntimeSettings({ mode: 'system', fallbackToEmbedded: true })
    const { env, executable } = await probeEnv()
    expect(executable).toBe(fakeEmbedded)
    expect(env?.DISABLE_UPDATES).toBe('1')
  })
})

describe('headless claude runtime events reach the remote client', () => {
  it('PROXIED_EVENTS carries the runtime and codex turn-end events', () => {
    for (const channel of ['claude:turn-end', 'claude:runtime-degraded', 'claude:runtime-warning']) {
      expect(PROXIED_EVENTS.has(channel), channel).toBe(true)
    }
  })

  it('get-cli-path emits claude:runtime-degraded, then claude:runtime-warning', async () => {
    writeRuntimeSettings({ mode: 'system', fallbackToEmbedded: true })
    await expect(harness.invoke('claude:get-cli-path')).resolves.toBe(fakeEmbedded)
    const fromTerminal = (args: unknown[]) => (args[0] as { sessionId?: string })?.sessionId === '__terminal__'
    const [degraded] = await harness.waitForEvent('claude:runtime-degraded', fromTerminal) as [{ sessionId: string; reason: string }]
    expect(degraded).toMatchObject({ sessionId: '__terminal__', reason: 'system-not-found' })

    system.info = { path: FAKE_SYSTEM_CLAUDE, version: '2.1.200', versionRaw: '2.1.200', healthStatus: 'version-warning', source: 'path' }
    await expect(harness.invoke('claude:get-cli-path')).resolves.toBe(FAKE_SYSTEM_CLAUDE)
    const [warning] = await harness.waitForEvent('claude:runtime-warning', fromTerminal) as [{ sessionId: string; version: string }]
    expect(warning).toMatchObject({ sessionId: '__terminal__', version: '2.1.200' })
  })
})

describe('headless claude:* — not supported / not proxied', () => {
  it('codex controls are not registered and say so', async () => {
    for (const channel of ['claude:set-codex-sandbox-mode', 'claude:set-codex-approval-policy']) {
      expect(HEADLESS_UNSUPPORTED[channel], channel).toBe('P1')
      await expect(harness.invoke(channel, 's1', 'read-only')).rejects.toThrow(`No handler for channel: ${channel}`)
    }
  })

  it('a codex preset is rejected with a clear error and not recorded as a codex session', async () => {
    await expect(harness.invoke('claude:start-session', 'codex-1', { cwd: installRoot, agentPreset: 'codex-agent' }))
      .rejects.toThrow(CODEX_UNSUPPORTED_MESSAGE)
    await expect(harness.invoke('claude:resume-session', 'codex-2', 'sdk-1', installRoot, undefined, undefined, undefined, undefined, undefined, 'codex-agent-worktree'))
      .rejects.toThrow(CODEX_UNSUPPORTED_MESSAGE)
    await expect(harness.invoke('claude:list-sessions', installRoot, 'codex-agent')).rejects.toThrow(CODEX_UNSUPPORTED_MESSAGE)
    // Not recorded as codex ⇒ per-session channels go to the claude manager, not the missing codex one.
    await expect(harness.invoke('claude:is-resting', 'codex-1')).resolves.toBe(false)
  })

  it('message archive is always-local and absent on headless', async () => {
    for (const channel of ['claude:archive-messages', 'claude:load-archived', 'claude:clear-archive']) {
      expect(ALWAYS_LOCAL_CHANNELS.has(channel), channel).toBe(true)
      await expect(harness.invoke(channel, 's1')).rejects.toThrow(`No handler for channel: ${channel}`)
    }
  })

  it('the only claude:* left in HEADLESS_UNSUPPORTED are the codex controls', () => {
    expect(Object.keys(HEADLESS_UNSUPPORTED).filter(c => c.startsWith('claude:')).sort())
      .toEqual(['claude:set-codex-approval-policy', 'claude:set-codex-sandbox-mode'])
  })
})

describe('resolveHeadlessEmbeddedLayout', () => {
  it('uses the server-bundle layout when the bundle binary exists', () => {
    expect(resolveHeadlessEmbeddedLayout('/opt/bat-server', () => true)).toEqual({ kind: 'server-bundle', installRoot: '/opt/bat-server' })
  })

  it('falls back to the module graph when it does not (running from the repo)', () => {
    expect(resolveHeadlessEmbeddedLayout('/repo', () => false)).toEqual({ kind: 'node-modules' })
  })
})
