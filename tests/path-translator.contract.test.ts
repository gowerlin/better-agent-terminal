/**
 * Contract tests for PathTranslator + createTranslator factory (PLAN-007 T0269).
 *
 * Run: npx tsx tests/path-translator.contract.test.ts
 */

import * as assert from 'assert'
import {
  createTranslator,
  IdentityTranslator,
  runContract,
  type ContractFixture,
} from '../electron/remote/path-translator'
import type { ProfileEntry, TargetOS } from '../electron/profile-manager'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (error) {
    console.log(`  ❌ ${name}`)
    console.log(`     ${(error as Error).message}`)
    failed++
  }
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}:`)
  fn()
}

function makeProfile(partial: Partial<ProfileEntry>): ProfileEntry {
  return {
    id: 'profile-1',
    name: 'Test Profile',
    type: 'remote',
    createdAt: 1_000_000,
    updatedAt: 1_000_001,
    ...partial,
  }
}

const identityFixtures: ContractFixture[] = [
  {
    name: 'Windows drive letter',
    clientPath: 'C:\\Users\\Gower\\repo',
    serverPath: 'C:\\Users\\Gower\\repo',
    shouldOwn: true,
  },
  {
    name: 'Windows UNC',
    clientPath: '\\\\server\\share\\file.txt',
    serverPath: '\\\\server\\share\\file.txt',
    shouldOwn: true,
  },
  {
    name: 'POSIX absolute',
    clientPath: '/home/gower/repo',
    serverPath: '/home/gower/repo',
    shouldOwn: true,
  },
  {
    name: 'POSIX with spaces',
    clientPath: '/home/gower/my project/file.txt',
    serverPath: '/home/gower/my project/file.txt',
    shouldOwn: true,
  },
  {
    name: 'Trailing slash',
    clientPath: '/home/gower/',
    serverPath: '/home/gower/',
    shouldOwn: true,
  },
  {
    name: 'Mixed slashes (Win)',
    clientPath: 'C:/Users/Gower\\repo',
    serverPath: 'C:/Users/Gower\\repo',
    shouldOwn: true,
  },
  {
    name: 'Chinese path',
    clientPath: 'D:\\專案\\資料夾\\檔案.txt',
    serverPath: 'D:\\專案\\資料夾\\檔案.txt',
    shouldOwn: true,
  },
  {
    name: 'Long path (>260)',
    clientPath: `C:\\${'a\\'.repeat(150)}end`,
    serverPath: `C:\\${'a\\'.repeat(150)}end`,
    shouldOwn: true,
  },
  {
    name: 'Empty string',
    clientPath: '',
    serverPath: '',
    shouldOwn: true,
  },
  {
    name: 'POSIX root',
    clientPath: '/',
    serverPath: '/',
    shouldOwn: true,
  },
  {
    name: 'Windows root',
    clientPath: 'C:\\',
    serverPath: 'C:\\',
    shouldOwn: true,
  },
  {
    name: 'Relative path (graceful fallback)',
    clientPath: './relative',
    serverPath: './relative',
    shouldOwn: true,
  },
  {
    name: 'Node-style POSIX on Windows',
    clientPath: '/c/Users/Gower',
    serverPath: '/c/Users/Gower',
    shouldOwn: true,
  },
]

runContract('IdentityTranslator', () => new IdentityTranslator(), identityFixtures, {
  suite: describe,
  test,
})

describe('IdentityTranslator specifics', () => {
  test('toServer and toClient are the same identity mapping', () => {
    const translator = new IdentityTranslator()
    const sample = 'C:\\Users\\Gower\\same.txt'
    assert.strictEqual(translator.toServer(sample), sample)
    assert.strictEqual(translator.toClient(sample), sample)
    assert.strictEqual(translator.toServer(sample), translator.toClient(sample))
  })

  test('owns(any path) is always true', () => {
    const translator = new IdentityTranslator()
    for (const sample of ['abc', '', '/tmp/file', 'C:\\temp\\file.txt']) {
      assert.strictEqual(translator.owns(sample), true)
    }
  })
})

describe('createTranslator factory', () => {
  test('targetOS=local returns IdentityTranslator', () => {
    const translator = createTranslator(makeProfile({ type: 'local', targetOS: 'local' }))
    assert.ok(translator instanceof IdentityTranslator)
  })

  test('legacy remote profile without targetOS returns IdentityTranslator', () => {
    const translator = createTranslator(makeProfile({
      id: 'legacy-remote',
      type: 'remote',
      remoteHost: '127.0.0.1',
      remotePort: 9876,
    }))
    assert.ok(translator instanceof IdentityTranslator)
  })

  for (const [os, ticket] of [
    ['wsl-linux', 'T0273'],
    ['docker-linux', 'T0277'],
    ['ssh-linux', 'T0282'],
    ['ssh-darwin', 'T0282'],
  ] as const) {
    test(`${os} throws an explicit pending implementation error`, () => {
      const profile = makeProfile({ id: `profile-${os}`, targetOS: os })
      assert.throws(
        () => createTranslator(profile),
        (error: unknown) => {
          const message = (error as Error).message
          return (
            message.includes(os) &&
            message.includes(profile.id) &&
            message.includes(ticket)
          )
        },
      )
    })
  }
})

describe('TargetOS exhaustiveness spot-check', () => {
  test('known targetOS values are covered', () => {
    const all: Array<TargetOS | undefined> = [
      'local',
      'wsl-linux',
      'docker-linux',
      'ssh-linux',
      'ssh-darwin',
      undefined,
    ]
    assert.strictEqual(all.length, 6)
  })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
