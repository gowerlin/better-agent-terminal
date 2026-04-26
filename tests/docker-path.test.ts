import * as assert from 'assert'
import {
  containerToHost,
  hostToContainer,
  isValidMount,
  normalizeHostPath,
  ownsDockerPath,
  startsWithPath,
  type DockerMount,
} from '../src/utils/docker-path'
import { DockerPathTranslator } from '../electron/remote/path-translator'

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

describe('startsWithPath boundary helper (T0294)', () => {
  test('empty prefix returns false (degeneracy guard)', () => {
    assert.strictEqual(startsWithPath('/anything', ''), false)
  })

  test('exact match returns true', () => {
    assert.strictEqual(startsWithPath('/home/alice', '/home/alice'), true)
  })

  test('prefix followed by / returns true', () => {
    assert.strictEqual(startsWithPath('/home/alice/x', '/home/alice'), true)
  })

  test('prefix followed by \\ returns true', () => {
    assert.strictEqual(startsWithPath('C:\\Users\\Alice\\x', 'C:\\Users\\Alice'), true)
  })

  test('prefix-collision case rejected (F-001)', () => {
    // '/Users/al' is NOT a path prefix of '/Users/alice/x.txt'
    assert.strictEqual(startsWithPath('/Users/alice/x.txt', '/Users/al'), false)
  })

  test('non-prefix returns false', () => {
    assert.strictEqual(startsWithPath('/etc/passwd', '/home/alice'), false)
  })
})

describe('isValidMount (T0294 EC-001)', () => {
  test('rejects empty host', () => {
    assert.strictEqual(isValidMount({ host: '', container: '/c' }), false)
  })

  test('rejects empty container', () => {
    assert.strictEqual(isValidMount({ host: '/h', container: '' }), false)
  })

  test('rejects root-only host', () => {
    assert.strictEqual(isValidMount({ host: '/', container: '/c' }), false)
    assert.strictEqual(isValidMount({ host: '\\', container: '/c' }), false)
  })

  test('rejects root-only container', () => {
    assert.strictEqual(isValidMount({ host: '/h', container: '/' }), false)
    assert.strictEqual(isValidMount({ host: '/h', container: '\\' }), false)
  })

  test('accepts normal mount', () => {
    assert.strictEqual(isValidMount({ host: '/home/u', container: '/workspace' }), true)
  })
})

describe('docker-path boundary regressions (T0294 F-001 + EC-001)', () => {
  test('F-001: prefix-collision host mount does not over-match', () => {
    // '/home/u' must not match '/home/user/x'
    const mounts: DockerMount[] = [{ host: '/home/u', container: '/c/u' }]
    assert.strictEqual(ownsDockerPath('/home/user/x', mounts), false)
    assert.strictEqual(hostToContainer('/home/user/x', mounts), '/home/user/x')
  })

  test('F-001: exact match still translates', () => {
    const mounts: DockerMount[] = [{ host: '/home/u', container: '/c/u' }]
    assert.strictEqual(hostToContainer('/home/u', mounts), '/c/u')
    assert.strictEqual(hostToContainer('/home/u/x', mounts), '/c/u/x')
  })

  test('F-001: prefix-collision container mount does not over-match', () => {
    const mounts: DockerMount[] = [{ host: '/home/u', container: '/work' }]
    assert.strictEqual(ownsDockerPath('/working/area', mounts), false)
    assert.strictEqual(containerToHost('/working/area', mounts), '/working/area')
  })

  test('EC-001: degenerate root host mount filtered (passthrough)', () => {
    // AC7: hostToContainer with degenerate root-only mount is filtered out → passthrough
    assert.strictEqual(
      hostToContainer('/etc/passwd', [{ host: '/', container: '/c' }]),
      '/etc/passwd',
    )
    assert.strictEqual(
      ownsDockerPath('/etc/passwd', [{ host: '/', container: '/c' }]),
      false,
    )
  })

  test('EC-001: degenerate empty host mount filtered (passthrough)', () => {
    assert.strictEqual(
      hostToContainer('/etc/passwd', [{ host: '', container: '/c' }]),
      '/etc/passwd',
    )
  })

  test('EC-001: degenerate empty container mount filtered (passthrough)', () => {
    assert.strictEqual(
      containerToHost('/anything', [{ host: '/h', container: '' }]),
      '/anything',
    )
  })

  test('EC-001: DockerPathTranslator constructor throws on degenerate mount', () => {
    assert.throws(
      () => new DockerPathTranslator([{ host: '/', container: '/c' }]),
      /degenerate mount rejected/,
    )
    assert.throws(
      () => new DockerPathTranslator([{ host: '', container: '/c' }]),
      /degenerate mount rejected/,
    )
    assert.throws(
      () => new DockerPathTranslator([{ host: '/h', container: '' }]),
      /degenerate mount rejected/,
    )
  })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
