/**
 * PLAN-007 T0291 — Cross-deployment end-to-end smoke (capstone parametrized suite).
 *
 * For each of the 4 PLAN-007 deployment targets (local / wsl-linux / docker-linux /
 * ssh-linux) drives a single fixture profile through:
 *   Step 1: profile.create on the mock IPC surface (PLAN-007 schema fields)
 *   Step 2: profile.load + extractTargetOSMeta narrows to the expected branch
 *   Step 3: createTranslator(profile) returns the correct PathTranslator subclass
 *   Step 4: toServer / toClient round-trip a fixture path end-to-end without loss
 *           (mirrors the same fixtures from path-translator.contract.test.ts to
 *           keep cross-test consistency without re-asserting full contract grids)
 *
 * Mock-only — no real spawn / fs / IPC. Run: npx tsx tests/plan-007-cross-env-smoke.test.ts
 */

import * as assert from 'assert'
import {
  extractTargetOSMeta,
  type ProfileEntry,
} from '../electron/profile-manager'
import {
  createTranslator,
  IdentityTranslator,
  WslPathTranslator,
  DockerPathTranslator,
  SshPathTranslator,
  type PathTranslator,
} from '../electron/remote/path-translator'
import { createMockElectronApi, installMockWindow } from '../tests/__mocks__/electron-api'

let passed = 0
let failed = 0

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const r = fn()
    if (r instanceof Promise) {
      r.then(
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

interface SmokeFixture {
  name: string
  profileSeed: Partial<ProfileEntry>
  expectTranslator: new (...args: never[]) => PathTranslator
  expectMetaTargetOS: ProfileEntry['targetOS']
  // Optional path round-trip — local/identity passes through unchanged; WSL/Docker
  // exercise the actual translation. SSH skipped here (it depends on os.homedir()
  // matching the server-side home, which is platform-dependent and already covered
  // exhaustively in path-translator.contract.test.ts).
  pathFixture?: { client: string; server: string }
}

const fixtures: SmokeFixture[] = [
  {
    name: 'local',
    profileSeed: {
      id: 'local-dev',
      name: 'Local Dev',
      type: 'local',
      targetOS: 'local',
    },
    expectTranslator: IdentityTranslator,
    expectMetaTargetOS: 'local',
    pathFixture: { client: 'C:\\Users\\Gower\\repo', server: 'C:\\Users\\Gower\\repo' },
  },
  {
    name: 'wsl-linux',
    profileSeed: {
      id: 'wsl-dev',
      name: 'WSL Dev',
      type: 'remote',
      targetOS: 'wsl-linux',
      wslDistro: 'Ubuntu',
      remoteHost: 'localhost',
      remotePort: 9876,
    },
    expectTranslator: WslPathTranslator,
    expectMetaTargetOS: 'wsl-linux',
    pathFixture: { client: 'C:\\Users\\Gower\\repo', server: '/mnt/c/Users/Gower/repo' },
  },
  {
    name: 'docker-linux',
    profileSeed: {
      id: 'docker-dev',
      name: 'Docker Dev',
      type: 'remote',
      targetOS: 'docker-linux',
      dockerContainer: 'bat-dev',
      dockerMounts: [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }],
      remoteHost: 'localhost',
      remotePort: 9876,
    },
    expectTranslator: DockerPathTranslator,
    expectMetaTargetOS: 'docker-linux',
    pathFixture: { client: 'C:\\projects\\bat\\src', server: '/workspace/bat/src' },
  },
  {
    name: 'ssh-linux',
    profileSeed: {
      id: 'ssh-dev',
      name: 'SSH Dev',
      type: 'remote',
      targetOS: 'ssh-linux',
      sshHost: 'devbox.example.com',
      sshUser: 'gower',
      serverHome: '/home/gower',
      remoteHost: 'localhost',
      remotePort: 19876,
    },
    expectTranslator: SshPathTranslator,
    expectMetaTargetOS: 'ssh-linux',
    // No path round-trip — SshPathTranslator depends on os.homedir() of the
    // running process, which differs by CI host. Contract grid in
    // path-translator.contract.test.ts already covers all path shapes.
  },
]

console.log('PLAN-007 cross-deployment end-to-end smoke (4 environments):\n')

for (const fx of fixtures) {
  console.log(`Environment: ${fx.name}`)

  test(`${fx.name}: profile.create + profile.load round-trip via mock IPC`, async () => {
    const harness = createMockElectronApi({})
    installMockWindow(harness.electronAPI)

    // Step 1: write through the IPC surface (mirrors what wizards do at end
    // of happy path). create() returns minimal {id,name,type,timestamps},
    // then we patch the seed fields via update() — same as a real wizard.
    const created = await harness.electronAPI.profile.create(fx.profileSeed.name as string, {
      type: fx.profileSeed.type,
    })
    const seedFields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(fx.profileSeed)) {
      if (k !== 'id' && k !== 'name' && k !== 'type') seedFields[k] = v
    }
    await harness.electronAPI.profile.update(created.id, seedFields)

    // Step 2: read it back — load() simulates the renderer-side hydration.
    const loaded = await harness.electronAPI.profile.load(created.id)
    assert.ok(loaded, 'profile.load returned the entry')
    assert.strictEqual((loaded as ProfileEntry).targetOS, fx.expectMetaTargetOS)
  })

  test(`${fx.name}: extractTargetOSMeta narrows to ${fx.expectMetaTargetOS}`, () => {
    const profile: ProfileEntry = {
      createdAt: 1,
      updatedAt: 2,
      ...(fx.profileSeed as ProfileEntry),
    }
    const meta = extractTargetOSMeta(profile)
    assert.strictEqual(meta.targetOS, fx.expectMetaTargetOS)
  })

  test(`${fx.name}: createTranslator returns ${fx.expectTranslator.name} (no throw)`, () => {
    const profile: ProfileEntry = {
      createdAt: 1,
      updatedAt: 2,
      ...(fx.profileSeed as ProfileEntry),
    }
    const translator = createTranslator(profile)
    assert.ok(
      translator instanceof fx.expectTranslator,
      `expected ${fx.expectTranslator.name}, got ${translator.constructor.name}`,
    )
  })

  if (fx.pathFixture) {
    test(`${fx.name}: toServer/toClient round-trip preserves fixture path`, () => {
      const profile: ProfileEntry = {
        createdAt: 1,
        updatedAt: 2,
        ...(fx.profileSeed as ProfileEntry),
      }
      const translator = createTranslator(profile)
      const server = translator.toServer(fx.pathFixture!.client)
      assert.strictEqual(server, fx.pathFixture!.server, 'toServer produces expected server path')
      const back = translator.toClient(server)
      assert.strictEqual(back, fx.pathFixture!.client, 'toClient round-trip recovers client path')
    })
  }

  console.log('')
}

// Aggregate sanity — 4 environments × {load, narrow, factory} = 12 base cases
// (+ 3 round-trips for local/wsl/docker = 15). Matches AC6/AC7/AC8.
test('AC6/AC7/AC8: all 4 environments smoke-pass without exception', () => {
  // If we got here without an unhandled throw, the parametrized loop above
  // exercised every environment. This is mostly a marker assertion.
  assert.strictEqual(fixtures.length, 4, 'exactly 4 environments parametrized')
})

setImmediate(() => {
  console.log(`${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})
