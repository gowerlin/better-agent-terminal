/**
 * Unit tests for remote auth brute-force throttle and client backoff
 * (PLAN-018 T0184).
 *
 * Run: npx tsx tests/remote-throttle.test.ts
 */

import * as assert from 'assert'

import {
  AUTH_BAN_DURATION_MS,
  AUTH_FAIL_THRESHOLD,
  AUTH_FAIL_WINDOW_MS,
  type AuthFailureEntry,
  isIpBanned,
  normalizeIp,
  recordAuthFailure,
} from '../electron/remote/remote-server'

import {
  RECONNECT_BASE_MS,
  RECONNECT_JITTER_MS,
  RECONNECT_MAX_MS,
  computeReconnectDelay,
} from '../electron/remote/remote-client'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ❌ ${name}`)
    console.error(`     ${e instanceof Error ? e.message : String(e)}`)
    failed++
  }
}

console.log('\n🧪 Brute-force throttle\n')

test('normalizeIp strips ::ffff: prefix on IPv4-mapped IPv6', () => {
  assert.strictEqual(normalizeIp('::ffff:192.0.2.1'), '192.0.2.1')
  assert.strictEqual(normalizeIp('::FFFF:10.0.0.5'), '10.0.0.5')
})

test('normalizeIp passes plain IPv4 through unchanged', () => {
  assert.strictEqual(normalizeIp('127.0.0.1'), '127.0.0.1')
})

test('normalizeIp returns empty string on empty input', () => {
  assert.strictEqual(normalizeIp(''), '')
})

test('recordAuthFailure creates fresh entry on first failure', () => {
  const store = new Map<string, AuthFailureEntry>()
  const banned = recordAuthFailure(store, '1.1.1.1', 1000)
  assert.strictEqual(banned, false)
  const entry = store.get('1.1.1.1')
  assert.ok(entry)
  assert.strictEqual(entry!.count, 1)
  assert.strictEqual(entry!.firstFailAt, 1000)
  assert.strictEqual(entry!.bannedUntil, undefined)
})

test('recordAuthFailure bans IP after threshold within window', () => {
  const store = new Map<string, AuthFailureEntry>()
  const now = 1_000_000
  // N-1 failures → still not banned
  for (let i = 0; i < AUTH_FAIL_THRESHOLD - 1; i += 1) {
    assert.strictEqual(recordAuthFailure(store, '2.2.2.2', now + i * 100), false)
  }
  // Nth failure trips the ban
  const banned = recordAuthFailure(store, '2.2.2.2', now + 500)
  assert.strictEqual(banned, true)
  const entry = store.get('2.2.2.2')!
  assert.strictEqual(entry.count, AUTH_FAIL_THRESHOLD)
  assert.strictEqual(entry.bannedUntil, now + 500 + AUTH_BAN_DURATION_MS)
})

test('recordAuthFailure resets window after 60s lapse', () => {
  const store = new Map<string, AuthFailureEntry>()
  const t0 = 0
  recordAuthFailure(store, '3.3.3.3', t0)
  recordAuthFailure(store, '3.3.3.3', t0 + 10_000)
  // > 60s after the first failure → fresh window
  const banned = recordAuthFailure(
    store,
    '3.3.3.3',
    t0 + AUTH_FAIL_WINDOW_MS + 1
  )
  assert.strictEqual(banned, false)
  const entry = store.get('3.3.3.3')!
  assert.strictEqual(entry.count, 1)
  assert.strictEqual(entry.firstFailAt, t0 + AUTH_FAIL_WINDOW_MS + 1)
})

test('isIpBanned returns false when no entry exists', () => {
  const store = new Map<string, AuthFailureEntry>()
  assert.strictEqual(isIpBanned(store, '4.4.4.4', 100), false)
})

test('isIpBanned returns true during active ban', () => {
  const store = new Map<string, AuthFailureEntry>()
  const now = 10_000
  for (let i = 0; i < AUTH_FAIL_THRESHOLD; i += 1) {
    recordAuthFailure(store, '5.5.5.5', now)
  }
  assert.strictEqual(isIpBanned(store, '5.5.5.5', now + 1000), true)
})

test('isIpBanned clears expired ban and returns false', () => {
  const store = new Map<string, AuthFailureEntry>()
  const now = 10_000
  for (let i = 0; i < AUTH_FAIL_THRESHOLD; i += 1) {
    recordAuthFailure(store, '6.6.6.6', now)
  }
  const afterBan = now + AUTH_BAN_DURATION_MS + 1
  assert.strictEqual(isIpBanned(store, '6.6.6.6', afterBan), false)
  assert.strictEqual(store.has('6.6.6.6'), false, 'expired entry should be garbage-collected')
})

test('successful auth (delete entry) lets the next bad attempt restart the window', () => {
  const store = new Map<string, AuthFailureEntry>()
  const t = 5000
  recordAuthFailure(store, '7.7.7.7', t)
  recordAuthFailure(store, '7.7.7.7', t + 100)
  // Simulate successful auth cleanup
  store.delete('7.7.7.7')
  const banned = recordAuthFailure(store, '7.7.7.7', t + 200)
  assert.strictEqual(banned, false)
  assert.strictEqual(store.get('7.7.7.7')!.count, 1)
})

console.log('\n🧪 Exponential reconnect backoff\n')

test('computeReconnectDelay attempt 0 ≈ base + jitter', () => {
  const delay = computeReconnectDelay(0, () => 0)
  assert.strictEqual(delay, RECONNECT_BASE_MS)
  const maxed = computeReconnectDelay(0, () => 1)
  assert.strictEqual(maxed, RECONNECT_BASE_MS + RECONNECT_JITTER_MS)
})

test('computeReconnectDelay doubles per attempt until cap', () => {
  // attempt=1 → 2s base, attempt=2 → 4s, attempt=3 → 8s
  assert.strictEqual(computeReconnectDelay(1, () => 0), 2000)
  assert.strictEqual(computeReconnectDelay(2, () => 0), 4000)
  assert.strictEqual(computeReconnectDelay(3, () => 0), 8000)
  assert.strictEqual(computeReconnectDelay(4, () => 0), 16000)
})

test('computeReconnectDelay caps at RECONNECT_MAX_MS', () => {
  // 2^20 * 1000 ≫ 30s → must cap
  const delay = computeReconnectDelay(20, () => 0)
  assert.strictEqual(delay, RECONNECT_MAX_MS)
})

test('computeReconnectDelay adds jitter in [0, RECONNECT_JITTER_MS]', () => {
  const loDelay = computeReconnectDelay(2, () => 0)
  const hiDelay = computeReconnectDelay(2, () => 0.999999)
  assert.ok(hiDelay - loDelay >= 0)
  assert.ok(hiDelay - loDelay < RECONNECT_JITTER_MS + 1)
})

test('computeReconnectDelay clamps negative attempt to 0', () => {
  assert.strictEqual(computeReconnectDelay(-3, () => 0), RECONNECT_BASE_MS)
})

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
