import * as assert from 'assert'
import {
  containerToHost,
  hostToContainer,
  normalizeHostPath,
  ownsDockerPath,
  type DockerMount,
} from '../src/utils/docker-path'

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

function assertRoundTrip(path: string, mounts: DockerMount[]): void {
  const containerPath = hostToContainer(path, mounts)
  const roundTrip = containerToHost(containerPath, mounts)
  assert.strictEqual(normalizeHostPath(roundTrip), normalizeHostPath(path))
}

describe('hostToContainer', () => {
  const windowsMounts: DockerMount[] = [
    { host: 'C:\\projects\\bat', container: '/workspace/bat' },
    { host: 'C:\\projects\\bat\\sub', container: '/workspace/sub' },
    { host: 'C:\\Program Files\\bat', container: '/workspace/bat' },
    { host: 'C:\\使用者\\bat', container: '/workspace/bat' },
  ]

  test('basic Windows drive path', () => {
    assert.strictEqual(hostToContainer('C:\\projects\\bat\\src', windowsMounts), '/workspace/bat/src')
  })

  test('case-insensitive Windows drive path', () => {
    assert.strictEqual(hostToContainer('c:\\projects\\bat\\src', windowsMounts), '/workspace/bat/src')
  })

  test('longest host prefix wins with multiple mounts', () => {
    assert.strictEqual(hostToContainer('C:\\projects\\bat\\sub\\file.ts', windowsMounts), '/workspace/sub/file.ts')
  })

  test('mount root path translates directly to container root', () => {
    assert.strictEqual(hostToContainer('C:\\projects\\bat', windowsMounts), '/workspace/bat')
  })

  test('path with spaces', () => {
    assert.strictEqual(hostToContainer('C:\\Program Files\\bat', windowsMounts), '/workspace/bat')
  })

  test('Chinese Windows path', () => {
    assert.strictEqual(hostToContainer('C:\\使用者\\bat', windowsMounts), '/workspace/bat')
  })

  test('POSIX host path', () => {
    assert.strictEqual(
      hostToContainer('/home/user/bat/src', [{ host: '/home/user/bat', container: '/workspace/bat' }]),
      '/workspace/bat/src',
    )
  })

  test('unknown path passes through', () => {
    assert.strictEqual(hostToContainer('/etc/passwd', windowsMounts), '/etc/passwd')
  })
})

describe('containerToHost', () => {
  test('Windows host path restores backslashes', () => {
    assert.strictEqual(
      containerToHost('/workspace/bat/src', [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }]),
      'C:\\projects\\bat\\src',
    )
  })

  test('POSIX host path preserves forward slashes', () => {
    assert.strictEqual(
      containerToHost('/workspace/bat/src', [{ host: '/home/user/bat', container: '/workspace/bat' }]),
      '/home/user/bat/src',
    )
  })

  test('longest host prefix wins on reverse translation', () => {
    assert.strictEqual(
      containerToHost('/workspace/sub/file.ts', [
        { host: 'C:\\projects\\bat', container: '/workspace/bat' },
        { host: 'C:\\projects\\bat\\sub', container: '/workspace/sub' },
      ]),
      'C:\\projects\\bat\\sub\\file.ts',
    )
  })

  test('container root path maps to host root', () => {
    assert.strictEqual(
      containerToHost('/workspace/bat', [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }]),
      'C:\\projects\\bat',
    )
  })

  test('path with spaces and Chinese characters', () => {
    assert.strictEqual(
      containerToHost('/workspace/bat/中文 檔案.txt', [{ host: 'C:\\Program Files\\bat', container: '/workspace/bat' }]),
      'C:\\Program Files\\bat\\中文 檔案.txt',
    )
  })

  test('unknown container path passes through', () => {
    assert.strictEqual(
      containerToHost('/etc/passwd', [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }]),
      '/etc/passwd',
    )
  })
})

describe('round-trip', () => {
  test('Windows paths round-trip after normalization', () => {
    assertRoundTrip('C:\\projects\\bat\\src\\main.ts', [
      { host: 'C:\\projects\\bat', container: '/workspace/bat' },
    ])
  })

  test('POSIX paths round-trip exactly', () => {
    const mounts = [{ host: '/home/user/bat', container: '/workspace/bat' }]
    const original = '/home/user/bat/src/main.ts'
    const containerPath = hostToContainer(original, mounts)
    const roundTrip = containerToHost(containerPath, mounts)
    assert.strictEqual(roundTrip, original)
  })
})

describe('normalizeHostPath', () => {
  test('normalizes backslashes and lowercases drive letter', () => {
    assert.strictEqual(normalizeHostPath('C:\\foo\\bar'), 'c:/foo/bar')
  })

  test('is idempotent for normalized Windows paths', () => {
    assert.strictEqual(normalizeHostPath('c:/foo/bar'), 'c:/foo/bar')
  })

  test('leaves POSIX paths unchanged', () => {
    assert.strictEqual(normalizeHostPath('/posix/path'), '/posix/path')
  })

  test('leaves empty string unchanged', () => {
    assert.strictEqual(normalizeHostPath(''), '')
  })
})

describe('ownsDockerPath', () => {
  const mounts = [{ host: 'C:\\projects\\bat', container: '/workspace/bat' }]

  test('owns host-prefixed paths', () => {
    assert.strictEqual(ownsDockerPath('c:\\projects\\bat\\src', mounts), true)
  })

  test('owns container-prefixed paths', () => {
    assert.strictEqual(ownsDockerPath('/workspace/bat/src', mounts), true)
  })

  test('does not own unrelated paths', () => {
    assert.strictEqual(ownsDockerPath('/tmp/outside', mounts), false)
  })

  test('empty mounts never own paths', () => {
    assert.strictEqual(ownsDockerPath('C:\\projects\\bat\\src', []), false)
  })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
