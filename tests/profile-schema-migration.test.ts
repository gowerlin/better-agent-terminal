/**
 * PLAN-007 T0291 — Profile schema migration verification (capstone scenario suite).
 *
 * Six scenarios from the workorder spec §6 C-2 「load 自動補 + UI inline 提示」雙軌：
 *   1. legacy local (no targetOS) → auto-fill 'local', no warning
 *   2. legacy remote (no targetOS) → leave undefined, needsMigration = true → UI prompt fires
 *   3. user edits inline → migration completes → reload no longer flags needsMigration
 *   4. profile already on PLAN-007 schema → load is idempotent
 *   5. unknown targetOS enum value → no throw, unknownTargetOS = true → UI upgrade prompt
 *   6. corrupt entry (missing id/name) → validateProfileShape rejects → entry skipped
 *
 * Mock-based: no real fs / IPC. Run: npx tsx tests/profile-schema-migration.test.ts
 */

import * as assert from 'assert'
import {
  migrateProfile,
  inspectProfileMigration,
  validateProfileShape,
  type ProfileEntry,
} from '../electron/profile-manager'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'

let passed = 0
let failed = 0

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn()
    if (result instanceof Promise) {
      result.then(
        () => {
          console.log(`  ✅ ${name}`)
          passed++
        },
        (err) => {
          console.log(`  ❌ ${name}`)
          console.log(`     ${(err as Error).message}`)
          failed++
        },
      )
      return
    }
    console.log(`  ✅ ${name}`)
    passed++
  } catch (err) {
    console.log(`  ❌ ${name}`)
    console.log(`     ${(err as Error).message}`)
    failed++
  }
}

function makeEntry(partial: Partial<ProfileEntry>): ProfileEntry {
  return {
    id: 'p',
    name: 'Profile',
    type: 'local',
    createdAt: 1_000_000,
    updatedAt: 2_000_000,
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// Scenario 1 — legacy local (no targetOS) → auto-migrate to 'local', no flags
// ---------------------------------------------------------------------------
console.log('\nScenario 1 — legacy local profile auto-migrates:')

test('AC2: legacy local entry gets targetOS = "local" after migrateProfile', () => {
  const before = makeEntry({ id: 'legacy-local', type: 'local', updatedAt: 2_000_000 })
  assert.strictEqual(before.targetOS, undefined, 'precondition: legacy local has no targetOS')
  const after = migrateProfile(before)
  assert.strictEqual(after.targetOS, 'local')
  // updatedAt MUST NOT shift (avoid polluting cross-machine sync timestamps)
  assert.strictEqual(after.updatedAt, 2_000_000)
})

test('AC2: post-migration local profile has no migration flags raised', () => {
  const after = migrateProfile(makeEntry({ id: 'l', type: 'local' }))
  const flags = inspectProfileMigration(after)
  assert.deepStrictEqual(flags, { needsMigration: false, unknownTargetOS: false })
})

// ---------------------------------------------------------------------------
// Scenario 2 — legacy remote (no targetOS) → needsMigration flag for UI prompt
// ---------------------------------------------------------------------------
console.log('\nScenario 2 — legacy remote raises needsMigration (UI inline prompt):')

test('AC3: legacy remote entry stays with targetOS=undefined after migrateProfile', () => {
  const before = makeEntry({
    id: 'legacy-remote',
    type: 'remote',
    remoteHost: '1.2.3.4',
    remotePort: 9876,
    remoteToken: 'tok',
  })
  const after = migrateProfile(before)
  assert.strictEqual(after.targetOS, undefined)
  // same reference is fine (no mutation needed)
  assert.strictEqual(after, before)
})

test('AC3: legacy remote raises needsMigration = true (UI inline prompt trigger)', () => {
  const flags = inspectProfileMigration(
    makeEntry({ id: 'legacy-remote', type: 'remote' }),
  )
  assert.deepStrictEqual(flags, { needsMigration: true, unknownTargetOS: false })
})

test('AC3: ProfilePanel-side mock prompt callback receives needsMigration entry id', async () => {
  const harness = createMockElectronApi({})
  installMockWindow(harness.electronAPI)
  const id = 'legacy-remote-mock'
  harness.profiles.set(id, {
    id,
    name: 'Legacy Remote',
    type: 'remote',
    remoteHost: '1.2.3.4',
    remotePort: 9876,
    createdAt: 1,
    updatedAt: 2,
  })
  const loaded = await harness.electronAPI.profile.load(id)
  assert.ok(loaded, 'profile.load returns the seeded entry')
  const flags = inspectProfileMigration(loaded as ProfileEntry)
  assert.strictEqual(flags.needsMigration, true)
  // Simulate ProfilePanel reading the flag and queueing an inline prompt:
  const promptQueue: string[] = []
  if (flags.needsMigration) promptQueue.push(id)
  assert.deepStrictEqual(promptQueue, [id])
})

// ---------------------------------------------------------------------------
// Scenario 3 — user edits inline → save → reload no longer raises flag
// ---------------------------------------------------------------------------
console.log('\nScenario 3 — inline edit completes migration roundtrip:')

test('AC4: user edits legacy remote → adds targetOS=wsl-linux → reload not flagged', async () => {
  const harness = createMockElectronApi({})
  installMockWindow(harness.electronAPI)
  const id = 'edit-roundtrip'
  harness.profiles.set(id, {
    id,
    name: 'WSL Dev',
    type: 'remote',
    remoteHost: 'localhost',
    remotePort: 9876,
    createdAt: 1,
    updatedAt: 2,
  })

  const before = await harness.electronAPI.profile.load(id)
  assert.strictEqual(inspectProfileMigration(before as ProfileEntry).needsMigration, true)

  // User clicks ProfilePanel inline prompt → wizard writes back targetOS + WSL fields
  const ok = await harness.electronAPI.profile.update(id, {
    targetOS: 'wsl-linux',
    wslDistro: 'Ubuntu-22.04',
  })
  assert.strictEqual(ok, true)

  const after = await harness.electronAPI.profile.load(id)
  assert.ok(after, 'profile.load returns updated entry')
  const afterFlags = inspectProfileMigration(after as ProfileEntry)
  assert.deepStrictEqual(afterFlags, { needsMigration: false, unknownTargetOS: false })
  assert.strictEqual((after as ProfileEntry).targetOS, 'wsl-linux')
  assert.strictEqual((after as ProfileEntry).wslDistro, 'Ubuntu-22.04')
})

// ---------------------------------------------------------------------------
// Scenario 4 — already-migrated profile is idempotent under load+migrate
// ---------------------------------------------------------------------------
console.log('\nScenario 4 — already-migrated profile is idempotent:')

test('AC4: already-migrated docker profile passes through migrateProfile unchanged', () => {
  const before = makeEntry({
    id: 'docker-current',
    type: 'remote',
    targetOS: 'docker-linux',
    dockerContainer: 'bat-dev',
    dockerMounts: [{ host: 'C:\\repo', container: '/workspace' }],
    updatedAt: 9_999_999,
  })
  const after = migrateProfile(before)
  // No clone — already-migrated entries return same reference
  assert.strictEqual(after, before)
  assert.strictEqual(after.updatedAt, 9_999_999)
  const flags = inspectProfileMigration(after)
  assert.deepStrictEqual(flags, { needsMigration: false, unknownTargetOS: false })
})

test('AC4: double-migrate is stable (idempotent across reloads)', () => {
  const e = makeEntry({ id: 'l2', type: 'local' })
  const a = migrateProfile(e)
  const b = migrateProfile(a)
  // Second migration MUST hit the targetOS-already-set early return → same ref
  assert.strictEqual(a, b)
  assert.strictEqual(a.targetOS, 'local')
})

// ---------------------------------------------------------------------------
// Scenario 5 — unknown targetOS (forward compat) → unknownTargetOS = true
// ---------------------------------------------------------------------------
console.log('\nScenario 5 — unknown targetOS (forward compat):')

test('AC5: unknown targetOS string raises unknownTargetOS = true, no throw', () => {
  // Cast through unknown — simulates a future BAT version writing a new enum
  // value that this older client does not yet recognize.
  const entry = makeEntry({
    id: 'future-os',
    type: 'remote',
    targetOS: 'plan9-amd64' as unknown as ProfileEntry['targetOS'],
  })
  assert.doesNotThrow(() => inspectProfileMigration(entry))
  const flags = inspectProfileMigration(entry)
  assert.deepStrictEqual(flags, { needsMigration: false, unknownTargetOS: true })
})

test('AC5: known targetOS values do NOT raise unknownTargetOS', () => {
  const known: Array<ProfileEntry['targetOS']> = [
    'local',
    'wsl-linux',
    'docker-linux',
    'ssh-linux',
    'ssh-darwin',
  ]
  for (const os of known) {
    const flags = inspectProfileMigration(makeEntry({ targetOS: os }))
    assert.strictEqual(flags.unknownTargetOS, false, `${os} must not raise unknownTargetOS`)
  }
})

test('AC5: migrateProfile leaves unknown targetOS untouched (no auto-rewrite)', () => {
  const entry = makeEntry({
    id: 'future-os-2',
    type: 'remote',
    targetOS: 'morphos-ppc' as unknown as ProfileEntry['targetOS'],
  })
  const after = migrateProfile(entry)
  assert.strictEqual(after.targetOS, 'morphos-ppc')
  assert.strictEqual(after, entry)
})

// ---------------------------------------------------------------------------
// Scenario 6 — corrupt JSON entry → validateProfileShape rejects (skip + warn)
// ---------------------------------------------------------------------------
console.log('\nScenario 6 — corrupt entry shape is rejected by validator:')

test('Scenario 6: missing id → validateProfileShape returns false', () => {
  assert.strictEqual(validateProfileShape({ name: 'orphan', type: 'local' }), false)
})

test('Scenario 6: missing name → validateProfileShape returns false', () => {
  assert.strictEqual(validateProfileShape({ id: 'x', type: 'local' }), false)
})

test('Scenario 6: empty id string → validateProfileShape returns false', () => {
  assert.strictEqual(validateProfileShape({ id: '', name: 'n', type: 'local' }), false)
})

test('Scenario 6: bad type discriminator → validateProfileShape returns false', () => {
  assert.strictEqual(validateProfileShape({ id: 'x', name: 'n', type: 'bogus' }), false)
})

test('Scenario 6: null / non-object / array all rejected', () => {
  assert.strictEqual(validateProfileShape(null), false)
  assert.strictEqual(validateProfileShape('not an object'), false)
  assert.strictEqual(validateProfileShape([]), false)
})

test('Scenario 6: well-formed entry passes', () => {
  assert.strictEqual(
    validateProfileShape({ id: 'p1', name: 'OK', type: 'local', createdAt: 1, updatedAt: 2 }),
    true,
  )
  assert.strictEqual(
    validateProfileShape({ id: 'p2', name: 'OK', type: 'remote', createdAt: 1, updatedAt: 2 }),
    true,
  )
})

test('Scenario 6: bulk filter — corrupt entries skipped, valid ones survive', () => {
  // Simulates how normalizeIndex would filter raw[] before mapping migrateProfile.
  const raw: Array<Record<string, unknown>> = [
    { id: 'good-1', name: 'A', type: 'local', createdAt: 1, updatedAt: 2 },
    { name: 'orphan', type: 'local' },                   // missing id
    { id: 'good-2', name: 'B', type: 'remote', createdAt: 3, updatedAt: 4 },
    null as unknown as Record<string, unknown>,           // null entry
    { id: 'bad-type', name: 'C', type: 'unknown' },      // bad discriminator
  ]
  const survived = raw.filter(validateProfileShape)
  assert.strictEqual(survived.length, 2)
  assert.deepStrictEqual(
    survived.map((e) => e.id),
    ['good-1', 'good-2'],
  )
})

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
// Run async tests serially (the only async cases are scenarios 2&3); use
// process.nextTick to let promise-based test() invocations settle, then exit.
setImmediate(() => {
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})
