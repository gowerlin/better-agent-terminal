/**
 * Unit tests for profile-manager.ts schema migration + extractTargetOSMeta.
 *
 * Covers PLAN-007 T0268 acceptance criteria:
 *   - Three migration scenarios (AC3 / AC5)
 *   - extractTargetOSMeta narrowing for all 5 targetOS values + undefined (AC2 / AC5)
 *
 * Both helpers are pure (no electron app/fs side effects), so we can import
 * them directly under plain `npx tsx` without mocking.
 *
 * Run: npx tsx tests/profile-manager-migration.test.ts
 */

import * as assert from 'assert'
import {
  migrateProfile,
  extractTargetOSMeta,
  type ProfileEntry,
  type TargetOS,
} from '../electron/profile-manager'

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

function makeEntry(partial: Partial<ProfileEntry>): ProfileEntry {
  return {
    id: 'test',
    name: 'Test',
    type: 'local',
    createdAt: 1_000_000,
    updatedAt: 2_000_000,
    ...partial,
  }
}

console.log('\nmigrateProfile (PLAN-007 spec §6 C-2 — passive migration):')

test('local profile without targetOS → auto-migrates to "local"', () => {
  const before = makeEntry({ id: 'p1', type: 'local', updatedAt: 2_000_000 })
  const after = migrateProfile(before)
  assert.strictEqual(after.targetOS, 'local')
  // updatedAt MUST NOT change (avoid polluting sync timestamps)
  assert.strictEqual(after.updatedAt, 2_000_000)
  // original entry not mutated
  assert.strictEqual(before.targetOS, undefined)
})

test('remote profile without targetOS → stays undefined (legacy IdentityTranslator path)', () => {
  const before = makeEntry({
    id: 'p2',
    type: 'remote',
    remoteHost: '1.2.3.4',
    remotePort: 9876,
    remoteToken: 'tok',
  })
  const after = migrateProfile(before)
  assert.strictEqual(after.targetOS, undefined)
  // remote profile must be returned unchanged (same reference is fine — no need to clone)
  assert.strictEqual(after, before)
})

test('local profile with targetOS already → idempotent (no change)', () => {
  const before = makeEntry({ id: 'p3', type: 'local', targetOS: 'local', updatedAt: 5_000_000 })
  const after = migrateProfile(before)
  assert.strictEqual(after.targetOS, 'local')
  assert.strictEqual(after.updatedAt, 5_000_000)
  assert.strictEqual(after, before)
})

test('remote profile with targetOS already → idempotent (no change)', () => {
  const before = makeEntry({
    id: 'p4',
    type: 'remote',
    targetOS: 'wsl-linux',
    wslDistro: 'Ubuntu-22.04',
    remoteHost: 'localhost',
  })
  const after = migrateProfile(before)
  assert.strictEqual(after.targetOS, 'wsl-linux')
  assert.strictEqual(after.wslDistro, 'Ubuntu-22.04')
  assert.strictEqual(after, before)
})

console.log('\nextractTargetOSMeta (typed metadata projection):')

test('targetOS=local → { targetOS: "local" }', () => {
  const meta = extractTargetOSMeta(makeEntry({ targetOS: 'local' }))
  assert.deepStrictEqual(meta, { targetOS: 'local' })
})

test('targetOS=wsl-linux → { targetOS, wslDistro }', () => {
  const meta = extractTargetOSMeta(makeEntry({ targetOS: 'wsl-linux', wslDistro: 'Debian' }))
  assert.deepStrictEqual(meta, { targetOS: 'wsl-linux', wslDistro: 'Debian' })
})

test('targetOS=wsl-linux without wslDistro → empty string fallback', () => {
  const meta = extractTargetOSMeta(makeEntry({ targetOS: 'wsl-linux' }))
  assert.deepStrictEqual(meta, { targetOS: 'wsl-linux', wslDistro: '' })
})

test('targetOS=docker-linux → { targetOS, dockerContainer, dockerHost? }', () => {
  const meta = extractTargetOSMeta(makeEntry({
    targetOS: 'docker-linux',
    dockerContainer: 'bat-dev',
    dockerHost: 'unix:///var/run/docker.sock',
  }))
  assert.deepStrictEqual(meta, {
    targetOS: 'docker-linux',
    dockerContainer: 'bat-dev',
    dockerHost: 'unix:///var/run/docker.sock',
  })
})

test('targetOS=ssh-linux → ssh metadata fields', () => {
  const meta = extractTargetOSMeta(makeEntry({
    targetOS: 'ssh-linux',
    sshHost: 'devbox.example.com',
    sshUser: 'gower',
    sshPort: 2222,
    sshKeyPath: '~/.ssh/id_ed25519',
    useSshTunnel: true,
    tunnelLocalPort: 19876,
  }))
  assert.deepStrictEqual(meta, {
    targetOS: 'ssh-linux',
    sshHost: 'devbox.example.com',
    sshUser: 'gower',
    sshPort: 2222,
    sshKeyPath: '~/.ssh/id_ed25519',
    useSshTunnel: true,
    tunnelLocalPort: 19876,
  })
})

test('targetOS=ssh-darwin → ssh metadata fields with darwin discriminator', () => {
  const meta = extractTargetOSMeta(makeEntry({
    targetOS: 'ssh-darwin',
    sshHost: 'mac-mini.local',
    sshUser: 'gower',
  }))
  // Narrow to discriminated branch — sshPort etc. omitted on entry, so undefined here
  if (meta.targetOS !== 'ssh-darwin') {
    throw new Error(`expected ssh-darwin, got ${meta.targetOS}`)
  }
  assert.strictEqual(meta.sshHost, 'mac-mini.local')
  assert.strictEqual(meta.sshUser, 'gower')
  assert.strictEqual(meta.sshPort, undefined)
  assert.strictEqual(meta.useSshTunnel, undefined)
})

test('targetOS=undefined (legacy) → { targetOS: undefined }', () => {
  const meta = extractTargetOSMeta(makeEntry({ targetOS: undefined }))
  assert.deepStrictEqual(meta, { targetOS: undefined })
})

console.log('\nType narrowing (compile-time spot-check, runtime trivia):')

test('exhaustive switch over TargetOS compiles', () => {
  const all: TargetOS[] = ['local', 'wsl-linux', 'docker-linux', 'ssh-linux', 'ssh-darwin']
  for (const os of all) {
    const meta = extractTargetOSMeta(makeEntry({ targetOS: os }))
    assert.strictEqual(meta.targetOS, os)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
