/**
 * Unit tests for electron/claude-runtime-router.ts (PLAN-027 #4, T0233).
 *
 * Covers:
 *   - resolveClaudeRuntime fallback branching (T-R1..T-R8)
 *   - Per-session event deduplication (T-R9..T-R11)
 *
 * Uses dependency injection (ResolveClaudeRuntimeDeps) instead of module-level
 * mocking — keeps tests runnable under plain `npx tsx` without vitest/jest.
 *
 * Run: npx tsx tests/claude-runtime-router.test.ts
 */

import * as assert from 'assert'
import type { ClaudeRuntimeInfo } from '../electron/claude-resolver'
import {
  resolveClaudeRuntime,
  shouldEmitRuntimeEvent,
  clearRuntimeEventHistory,
  SystemClaudeUnavailableError,
  type ResolveClaudeRuntimeDeps,
  type ResolvedRuntime,
} from '../electron/claude-runtime-router'

const STUB_EMBEDDED = '/stub/embedded/claude.exe'

function embeddedStub(): string {
  return STUB_EMBEDDED
}

function makeInfo(partial: Partial<ClaudeRuntimeInfo>): ClaudeRuntimeInfo {
  return {
    path: '/usr/local/bin/claude',
    version: '2.1.113',
    versionRaw: '2.1.113 (Claude Code)',
    healthStatus: 'healthy',
    source: 'path',
    ...partial,
  }
}

function deps(
  detect: ResolveClaudeRuntimeDeps['detectSystemClaude'],
): ResolveClaudeRuntimeDeps {
  return {
    detectSystemClaude: detect,
    resolveEmbeddedClaudePath: embeddedStub,
  }
}

let passed = 0
let failed = 0

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ❌ ${name}`)
    console.log(`     ${(e as Error).message}`)
    failed++
  }
}

async function main() {
  // === resolveClaudeRuntime: embedded mode ===
  console.log('\nresolveClaudeRuntime (embedded mode):')

  await test('T-R1: mode embedded → embedded path, no detector call', async () => {
    let detectCalls = 0
    const result = await resolveClaudeRuntime(
      { mode: 'embedded', fallbackToEmbedded: true },
      deps(async () => {
        detectCalls++
        return null
      }),
    )
    assert.strictEqual(result.path, STUB_EMBEDDED)
    assert.strictEqual(result.source, 'embedded')
    assert.strictEqual(result.healthStatus, 'healthy')
    assert.strictEqual(result.degraded, undefined)
    assert.strictEqual(detectCalls, 0, 'detectSystemClaude should not be called')
  })

  // === resolveClaudeRuntime: system healthy ===
  console.log('\nresolveClaudeRuntime (system healthy):')

  await test('T-R2: system + healthy → system path, source system', async () => {
    const info = makeInfo({
      path: '/opt/claude/claude.exe',
      version: '2.1.113',
      healthStatus: 'healthy',
    })
    const result: ResolvedRuntime = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      deps(async () => info),
    )
    assert.strictEqual(result.path, '/opt/claude/claude.exe')
    assert.strictEqual(result.source, 'system')
    assert.strictEqual(result.healthStatus, 'healthy')
    assert.strictEqual(result.systemVersion, '2.1.113')
    assert.strictEqual(result.degraded, undefined)
  })

  // === resolveClaudeRuntime: fallback branches ===
  console.log('\nresolveClaudeRuntime (fallback branches):')

  await test('T-R3: system + null + fallback → embedded, degraded system-not-found', async () => {
    const result = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      deps(async () => null),
    )
    assert.strictEqual(result.path, STUB_EMBEDDED)
    assert.strictEqual(result.source, 'system-fallback-to-embedded')
    assert.strictEqual(result.healthStatus, 'healthy')
    assert.ok(result.degraded, 'degraded should be set')
    assert.strictEqual(result.degraded!.reason, 'system-not-found')
  })

  await test('T-R4: system + version-too-old + fallback → embedded, degraded system-too-old', async () => {
    const info = makeInfo({
      version: '1.9.99',
      healthStatus: 'version-too-old',
    })
    const result = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      deps(async () => info),
    )
    assert.strictEqual(result.path, STUB_EMBEDDED)
    assert.strictEqual(result.source, 'system-fallback-to-embedded')
    assert.ok(result.degraded)
    assert.strictEqual(result.degraded!.reason, 'system-too-old')
    assert.ok(
      result.degraded!.detail?.includes('1.9.99'),
      'detail should include version',
    )
  })

  await test('T-R5: system + spawn-failed + fallback → embedded, degraded system-unhealthy', async () => {
    const info = makeInfo({
      version: '',
      healthStatus: 'spawn-failed',
    })
    const result = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      deps(async () => info),
    )
    assert.strictEqual(result.path, STUB_EMBEDDED)
    assert.strictEqual(result.source, 'system-fallback-to-embedded')
    assert.ok(result.degraded)
    assert.strictEqual(result.degraded!.reason, 'system-unhealthy')
  })

  await test('T-R6: system + detect throws + fallback → embedded, degraded detect-threw', async () => {
    const result = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      deps(async () => {
        throw new Error('boom — EACCES or similar')
      }),
    )
    assert.strictEqual(result.path, STUB_EMBEDDED)
    assert.strictEqual(result.source, 'system-fallback-to-embedded')
    assert.ok(result.degraded)
    assert.strictEqual(result.degraded!.reason, 'detect-threw')
    assert.ok(
      result.degraded!.detail?.includes('boom'),
      'detail should include thrown error message',
    )
  })

  // === resolveClaudeRuntime: no-fallback throws ===
  console.log('\nresolveClaudeRuntime (fallback disabled → throws):')

  await test('T-R7: system + failure + fallback=false → throws SystemClaudeUnavailableError', async () => {
    // Failure from null detector
    let thrown: unknown = null
    try {
      await resolveClaudeRuntime(
        { mode: 'system', fallbackToEmbedded: false },
        deps(async () => null),
      )
    } catch (err) {
      thrown = err
    }
    assert.ok(thrown instanceof SystemClaudeUnavailableError, 'should throw SystemClaudeUnavailableError')
    assert.strictEqual((thrown as SystemClaudeUnavailableError).reason, 'system-not-found')

    // Failure from detect throwing
    thrown = null
    try {
      await resolveClaudeRuntime(
        { mode: 'system', fallbackToEmbedded: false },
        deps(async () => {
          throw new Error('detect boom')
        }),
      )
    } catch (err) {
      thrown = err
    }
    assert.ok(thrown instanceof SystemClaudeUnavailableError)
    assert.strictEqual((thrown as SystemClaudeUnavailableError).reason, 'detect-threw')

    // Failure from version-too-old
    thrown = null
    try {
      await resolveClaudeRuntime(
        { mode: 'system', fallbackToEmbedded: false },
        deps(async () =>
          makeInfo({ version: '1.0.0', healthStatus: 'version-too-old' }),
        ),
      )
    } catch (err) {
      thrown = err
    }
    assert.ok(thrown instanceof SystemClaudeUnavailableError)
    assert.strictEqual((thrown as SystemClaudeUnavailableError).reason, 'system-too-old')
  })

  // === resolveClaudeRuntime: version-warning does NOT fallback ===
  console.log('\nresolveClaudeRuntime (version-warning stays on system):')

  await test('T-R8: system + version-warning → system path + warning status, no fallback', async () => {
    const info = makeInfo({
      path: '/opt/old-claude/claude',
      version: '2.0.5',
      healthStatus: 'version-warning',
    })
    const result = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      deps(async () => info),
    )
    assert.strictEqual(result.path, '/opt/old-claude/claude')
    assert.strictEqual(result.source, 'system')
    assert.strictEqual(result.healthStatus, 'version-warning')
    assert.strictEqual(result.systemVersion, '2.0.5')
    assert.strictEqual(result.degraded, undefined)
  })

  // === Event deduplication ===
  console.log('\nshouldEmitRuntimeEvent / clearRuntimeEventHistory:')

  await test('T-R9: first call true, second same (session, type) false', () => {
    const sid = 'test-session-r9'
    clearRuntimeEventHistory(sid)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'degraded'), true)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'degraded'), false)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'degraded'), false)
    clearRuntimeEventHistory(sid)
  })

  await test('T-R10: same session, degraded vs warning are independent', () => {
    const sid = 'test-session-r10'
    clearRuntimeEventHistory(sid)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'degraded'), true)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'warning'), true)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'degraded'), false)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'warning'), false)
    clearRuntimeEventHistory(sid)
  })

  await test('T-R11: clearRuntimeEventHistory resets session state', () => {
    const sid = 'test-session-r11'
    clearRuntimeEventHistory(sid)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'degraded'), true)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'degraded'), false)
    clearRuntimeEventHistory(sid)
    assert.strictEqual(shouldEmitRuntimeEvent(sid, 'degraded'), true, 'after clear, should re-emit')
    // Also confirm different sessions do not leak into each other
    assert.strictEqual(shouldEmitRuntimeEvent('other-session', 'degraded'), true)
    clearRuntimeEventHistory(sid)
    clearRuntimeEventHistory('other-session')
  })

  // === Summary ===
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
