/**
 * Unit tests for electron/path-guard.ts (PLAN-018 T0183)
 *
 * Run: npx tsx tests/path-guard.test.ts
 */

import * as assert from 'assert'
import * as path from 'path'
import * as os from 'os'

import {
  registerWorkspace,
  unregisterWorkspace,
  rebuildWorkspaceAllowlist,
  isPathAllowed,
  assertPathAllowed,
  getRegisteredWorkspaces,
  MAX_IMAGE_SIZE,
} from '../electron/path-guard'

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

// Helper: create deterministic workspace roots that resolve cleanly across platforms
const WS_A = path.resolve(os.tmpdir(), 'bat-pg-test-a')
const WS_B = path.resolve(os.tmpdir(), 'bat-pg-test-b')
const OUTSIDE = path.resolve(os.tmpdir(), 'bat-pg-test-outside')

console.log('\npath-guard: register / unregister')
test('registerWorkspace adds root and sub-paths pass', () => {
  rebuildWorkspaceAllowlist([])
  registerWorkspace(WS_A)
  assert.strictEqual(isPathAllowed(WS_A), true, 'root itself must be allowed')
  assert.strictEqual(isPathAllowed(path.join(WS_A, 'file.txt')), true)
  assert.strictEqual(isPathAllowed(path.join(WS_A, 'sub', 'deep', 'file.ts')), true)
})

test('registerWorkspace is idempotent', () => {
  rebuildWorkspaceAllowlist([])
  registerWorkspace(WS_A)
  registerWorkspace(WS_A)
  assert.strictEqual(getRegisteredWorkspaces().length, 1)
})

test('unregisterWorkspace removes the root', () => {
  rebuildWorkspaceAllowlist([])
  registerWorkspace(WS_A)
  unregisterWorkspace(WS_A)
  assert.strictEqual(isPathAllowed(WS_A), false)
  assert.strictEqual(isPathAllowed(path.join(WS_A, 'x')), false)
})

console.log('\npath-guard: traversal & separators')
test('`..` traversal out of workspace is blocked', () => {
  rebuildWorkspaceAllowlist([WS_A])
  // Note: path.resolve collapses `..` → if result escapes WS_A it must fail.
  const traversed = path.join(WS_A, '..', path.basename(OUTSIDE))
  assert.strictEqual(isPathAllowed(traversed), false)
})

test('absolute path outside any workspace is blocked', () => {
  rebuildWorkspaceAllowlist([WS_A])
  assert.strictEqual(isPathAllowed(OUTSIDE), false)
})

test('Similar-prefix sibling is not allowed (no string prefix bug)', () => {
  // e.g. /tmp/ws and /tmp/ws-evil — the latter must NOT match via startsWith
  rebuildWorkspaceAllowlist([WS_A])
  const sibling = WS_A + '-evil'
  assert.strictEqual(isPathAllowed(sibling), false)
  assert.strictEqual(isPathAllowed(path.join(sibling, 'secret')), false)
})

test('Multiple workspaces: only registered roots are allowed', () => {
  rebuildWorkspaceAllowlist([WS_A, WS_B])
  assert.strictEqual(isPathAllowed(path.join(WS_A, 'a.ts')), true)
  assert.strictEqual(isPathAllowed(path.join(WS_B, 'b.ts')), true)
  assert.strictEqual(isPathAllowed(OUTSIDE), false)
})

console.log('\npath-guard: edge cases')
test('Empty allowlist denies everything (fail-closed)', () => {
  rebuildWorkspaceAllowlist([])
  assert.strictEqual(isPathAllowed(WS_A), false)
  assert.strictEqual(isPathAllowed('/'), false)
  assert.strictEqual(isPathAllowed(os.homedir()), false)
})

test('Empty / invalid input is denied', () => {
  rebuildWorkspaceAllowlist([WS_A])
  assert.strictEqual(isPathAllowed(''), false)
  assert.strictEqual(isPathAllowed(undefined as unknown as string), false)
  assert.strictEqual(isPathAllowed(null as unknown as string), false)
})

test('assertPathAllowed throws with "Path access denied" message', () => {
  rebuildWorkspaceAllowlist([WS_A])
  assert.throws(
    () => assertPathAllowed(OUTSIDE),
    (err: Error) => /Path access denied/.test(err.message)
  )
})

test('assertPathAllowed does not throw for allowed paths', () => {
  rebuildWorkspaceAllowlist([WS_A])
  assert.doesNotThrow(() => assertPathAllowed(path.join(WS_A, 'ok')))
})

test('MAX_IMAGE_SIZE is 10 MB', () => {
  assert.strictEqual(MAX_IMAGE_SIZE, 10 * 1024 * 1024)
})

console.log(`\n─── path-guard tests: ${passed} passed, ${failed} failed ───\n`)
if (failed > 0) process.exit(1)
