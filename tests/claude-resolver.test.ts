/**
 * Unit tests for electron/claude-resolver.ts (PLAN-027 #1, T0230)
 *
 * Covers:
 *   - Version regex parsing (release / pre-release / malformed)
 *   - Version classification (healthy / warning / too-old thresholds)
 *   - Semver comparison ordering
 *
 * Does NOT cover detectSystemClaude / probeClaudeHealth — those touch the
 * filesystem and child processes; integration coverage is T0233's job.
 *
 * Run: npx tsx tests/claude-resolver.test.ts
 */

import * as assert from 'assert'
import { __test__, type ClaudeHealthStatus } from '../electron/claude-resolver'

const { compareSemver, classifyVersion, VERSION_REGEX } = __test__

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ❌ ${name}`)
    console.log(`     ${(e as Error).message}`)
    failed++
  }
}

// === VERSION_REGEX ===
console.log('\nVERSION_REGEX:')

test('parses standard release', () => {
  const m = '2.1.113 (Claude Code)'.match(VERSION_REGEX)
  assert.ok(m)
  assert.strictEqual(m![1], '2.1.113')
})

test('parses prerelease tag', () => {
  const m = '2.1.111-beta.1 (Claude Code)'.match(VERSION_REGEX)
  assert.ok(m)
  assert.strictEqual(m![1], '2.1.111-beta.1')
})

test('parses with trailing junk', () => {
  const m = '2.0.5 (Claude Code) [bundled]'.match(VERSION_REGEX)
  assert.ok(m)
  assert.strictEqual(m![1], '2.0.5')
})

test('rejects malformed output', () => {
  assert.strictEqual('claude version 2.1.113'.match(VERSION_REGEX), null)
  assert.strictEqual('2.1 (Claude Code)'.match(VERSION_REGEX), null)
  assert.strictEqual(''.match(VERSION_REGEX), null)
})

test('rejects wrong product name', () => {
  assert.strictEqual('2.1.113 (Anthropic CLI)'.match(VERSION_REGEX), null)
})

// === compareSemver ===
console.log('\ncompareSemver:')

test('equal versions return 0', () => {
  assert.strictEqual(compareSemver('2.1.111', '2.1.111'), 0)
})

test('strips leading v prefix', () => {
  assert.strictEqual(compareSemver('v2.1.111', '2.1.111'), 0)
})

test('major version diff dominates', () => {
  assert.ok(compareSemver('3.0.0', '2.99.99') > 0)
  assert.ok(compareSemver('1.99.99', '2.0.0') < 0)
})

test('minor version diff', () => {
  assert.ok(compareSemver('2.2.0', '2.1.999') > 0)
})

test('patch version diff', () => {
  assert.ok(compareSemver('2.1.113', '2.1.111') > 0)
  assert.ok(compareSemver('2.1.110', '2.1.111') < 0)
})

test('ignores prerelease tags', () => {
  // Prerelease comparison is intentionally simplified; tag is stripped.
  assert.strictEqual(compareSemver('2.1.111-beta.1', '2.1.111'), 0)
})

// === classifyVersion ===
console.log('\nclassifyVersion:')

test('2.1.113 → healthy', () => {
  const got: ClaudeHealthStatus = classifyVersion('2.1.113')
  assert.strictEqual(got, 'healthy')
})

test('2.1.111 (boundary) → healthy', () => {
  assert.strictEqual(classifyVersion('2.1.111'), 'healthy')
})

test('2.1.110 → version-warning', () => {
  assert.strictEqual(classifyVersion('2.1.110'), 'version-warning')
})

test('2.0.0 (boundary) → version-warning', () => {
  assert.strictEqual(classifyVersion('2.0.0'), 'version-warning')
})

test('1.9.99 → version-too-old', () => {
  assert.strictEqual(classifyVersion('1.9.99'), 'version-too-old')
})

test('0.0.1 → version-too-old', () => {
  assert.strictEqual(classifyVersion('0.0.1'), 'version-too-old')
})

// === Summary ===
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
