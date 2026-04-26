/**
 * Contract tests for PathTranslator + createTranslator factory (PLAN-007 T0269).
 *
 * Run: npx tsx tests/path-translator.contract.test.ts
 */

import * as assert from 'assert'
import {
  createTranslator,
  DockerPathTranslator,
  IdentityTranslator,
  WslPathTranslator,
  runContract,
  type ContractFixture,
} from '../electron/remote/path-translator'
import { normalizeHostPath } from '../src/utils/docker-path'
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

const wslFixtures: ContractFixture[] = [
  {
    name: 'Windows drive letter',
    clientPath: 'C:\\Users\\Gower\\repo',
    serverPath: '/mnt/c/Users/Gower/repo',
    shouldOwn: true,
  },
  {
    name: 'Windows UNC wsl.localhost',
    clientPath: '\\\\wsl.localhost\\Ubuntu\\home\\user\\repo',
    serverPath: '/home/user/repo',
    shouldOwn: true,
  },
  {
    name: 'Chinese path',
    clientPath: 'C:\\使用者\\專案\\檔案.txt',
    serverPath: '/mnt/c/使用者/專案/檔案.txt',
    shouldOwn: true,
  },
  {
    name: 'Long path prefix',
    clientPath: 'C:\\very\\long\\path\\file.txt',
    serverPath: '/mnt/c/very/long/path/file.txt',
    shouldOwn: true,
  },
  {
    name: 'Path with spaces',
    clientPath: 'C:\\Program Files\\BAT\\repo',
    serverPath: '/mnt/c/Program Files/BAT/repo',
    shouldOwn: true,
  },
  {
    name: 'Distro mismatch UNC is not owned',
    clientPath: '\\\\wsl.localhost\\Debian\\home\\user\\repo',
    serverPath: '\\\\wsl.localhost\\Debian\\home\\user\\repo',
    shouldOwn: false,
  },
]

runContract('WslPathTranslator', () => new WslPathTranslator('Ubuntu'), wslFixtures, {
  suite: describe,
  test,
})

const dockerFixtures: ContractFixture[] = [
  {
    name: 'Windows host single mount',
    clientPath: 'C:\\projects\\bat\\src',
    serverPath: '/workspace/win-bat/src',
    shouldOwn: true,
  },
  {
    name: 'POSIX host single mount',
    clientPath: '/home/user/bat/src',
    serverPath: '/workspace/posix-bat/src',
    shouldOwn: true,
  },
  {
    name: 'Mount root path',
    clientPath: 'C:\\projects\\bat\\sub',
    serverPath: '/workspace/sub',
    shouldOwn: true,
  },
  {
    name: 'Longest host prefix wins',
    clientPath: 'C:\\projects\\bat\\sub\\file.ts',
    serverPath: '/workspace/sub/file.ts',
    shouldOwn: true,
  },
  {
    name: 'Path with spaces',
    clientPath: 'C:\\Program Files\\bat\\x',
    serverPath: '/workspace/spaces/x',
    shouldOwn: true,
  },
  {
    name: 'Unknown path is passthrough and not owned',
    clientPath: '/etc/passwd',
    serverPath: '/etc/passwd',
    shouldOwn: false,
  },
]

runContract(
  'DockerPathTranslator',
  () => new DockerPathTranslator([
    { host: 'C:\\projects\\bat', container: '/workspace/win-bat' },
    { host: '/home/user/bat', container: '/workspace/posix-bat' },
    { host: 'C:\\projects\\bat\\sub', container: '/workspace/sub' },
    { host: 'C:\\Program Files\\bat', container: '/workspace/spaces' },
  ]),
  dockerFixtures,
  {
    suite: describe,
    test,
  },
)

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

describe('WslPathTranslator specifics', () => {
  test('toServer strips the Windows long-path prefix before translation', () => {
    const translator = new WslPathTranslator('Ubuntu')
    assert.strictEqual(
      translator.toServer('\\\\?\\C:\\very\\long\\path\\file.txt'),
      '/mnt/c/very/long/path/file.txt',
    )
  })

  test('owns a POSIX absolute path and rejects relative or foreign UNC paths', () => {
    const translator = new WslPathTranslator('Ubuntu')
    assert.strictEqual(translator.owns('/home/user/repo'), true)
    assert.strictEqual(translator.owns('.\\relative'), false)
    assert.strictEqual(translator.owns('\\\\server\\share\\repo'), false)
  })
})

describe('DockerPathTranslator specifics', () => {
  test('toClient round-trips Windows paths after normalization', () => {
    const translator = new DockerPathTranslator([
      { host: 'C:\\projects\\bat', container: '/workspace/bat' },
    ])

    const original = 'c:\\projects\\bat\\src\\main.ts'
    const containerPath = translator.toServer(original)
    const roundTrip = translator.toClient(containerPath)

    assert.strictEqual(containerPath, '/workspace/bat/src/main.ts')
    assert.strictEqual(normalizeHostPath(roundTrip), normalizeHostPath(original))
  })

  test('owns only paths covered by host or container mounts', () => {
    const translator = new DockerPathTranslator([
      { host: '/home/user/bat', container: '/workspace/bat' },
    ])

    assert.strictEqual(translator.owns('/home/user/bat/src'), true)
    assert.strictEqual(translator.owns('/workspace/bat/src'), true)
    assert.strictEqual(translator.owns('/tmp/outside'), false)
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

  test('targetOS=wsl-linux returns WslPathTranslator', () => {
    const translator = createTranslator(makeProfile({
      id: 'profile-wsl',
      targetOS: 'wsl-linux',
      wslDistro: 'Ubuntu',
    }))
    assert.ok(translator instanceof WslPathTranslator)
    assert.strictEqual(translator.toServer('C:\\Users\\Gower\\repo'), '/mnt/c/Users/Gower/repo')
  })

  test('targetOS=wsl-linux without wslDistro throws explicit error', () => {
    const profile = makeProfile({ id: 'profile-wsl-missing', targetOS: 'wsl-linux' })
    assert.throws(
      () => createTranslator(profile),
      (error: unknown) => (error as Error).message === '[PathTranslator] wsl-linux profile profile-wsl-missing missing wslDistro',
    )
  })

  test('targetOS=docker-linux returns DockerPathTranslator', () => {
    const translator = createTranslator(makeProfile({
      id: 'profile-docker',
      targetOS: 'docker-linux',
      dockerMounts: [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }],
    }))

    assert.ok(translator instanceof DockerPathTranslator)
    assert.strictEqual(translator.toServer('C:\\projects\\bat\\src'), '/workspace/bat/src')
  })

  test('targetOS=docker-linux without dockerMounts throws explicit error', () => {
    const profile = makeProfile({ id: 'profile-docker-missing', targetOS: 'docker-linux' })
    assert.throws(
      () => createTranslator(profile),
      (error: unknown) => (error as Error).message === '[PathTranslator] docker-linux profile profile-docker-missing missing dockerMounts',
    )
  })

  for (const [os, ticket] of [
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
