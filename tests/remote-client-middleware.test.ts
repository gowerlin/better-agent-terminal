import * as assert from 'assert'

import {
  normalizePathsInResult,
  PATH_AWARE_CHANNELS,
  PATH_RETURNING_CHANNELS,
  translateInvokeArgs,
  translateRemoteEventArgs,
} from '../electron/remote/path-aware-channels'
import { IdentityTranslator, type PathTranslator } from '../electron/remote/path-translator'

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

class PrefixTranslator implements PathTranslator {
  toServer(clientPath: string): string {
    return clientPath.replace(/^\/client/, '/server').replace(/^C:\\client/i, 'Z:\\server')
  }

  toClient(serverPath: string): string {
    return serverPath.replace(/^\/server/, '/client').replace(/^Z:\\server/i, 'C:\\client')
  }

  owns(path: string): boolean {
    return path.startsWith('/client') || path.startsWith('/server') || path.startsWith('C:\\client') || path.startsWith('Z:\\server')
  }
}

const translator = new PrefixTranslator()

describe('RemoteClient middleware helpers', () => {
  test('PATH_AWARE_CHANNELS contains real path-bearing IPC channels', () => {
    for (const channel of ['fs:readdir', 'git:getRoot', 'pty:create', 'pty:restart', 'image:read-as-data-url']) {
      assert.strictEqual(PATH_AWARE_CHANNELS.has(channel), true, `${channel} should be path-aware`)
    }
  })

  test('PATH_RETURNING_CHANNELS matches the narrow result shapes in codebase', () => {
    for (const channel of ['fs:readdir', 'fs:search', 'git:getRoot', 'pty:get-cwd']) {
      assert.strictEqual(PATH_RETURNING_CHANNELS.has(channel), true, `${channel} should be path-returning`)
    }
    assert.strictEqual(PATH_RETURNING_CHANNELS.has('git:status'), false, 'git:status returns relative file names, not absolute paths')
  })

  test('translateInvokeArgs rewrites fs path arguments', () => {
    const actual = translateInvokeArgs('fs:readdir', ['/client/project'], translator)
    assert.deepStrictEqual(actual, ['/server/project'])
  })

  test('translateInvokeArgs rewrites pty:create cwd without touching sibling fields', () => {
    const actual = translateInvokeArgs('pty:create', [{ cwd: '/client/repo', shell: 'bash', args: ['-l'] }], translator)
    assert.deepStrictEqual(actual, [{ cwd: '/server/repo', shell: 'bash', args: ['-l'] }])
  })

  test('translateInvokeArgs rewrites pty:restart cwd argument only', () => {
    const actual = translateInvokeArgs('pty:restart', ['term-1', '/client/repo', 'pwsh'], translator)
    assert.deepStrictEqual(actual, ['term-1', '/server/repo', 'pwsh'])
  })

  test('translateInvokeArgs leaves non-path channels unchanged', () => {
    const actual = translateInvokeArgs('claude:start-session', ['hello'], translator)
    assert.deepStrictEqual(actual, ['hello'])
  })

  test('normalizePathsInResult rewrites fs:readdir entry paths', () => {
    const actual = normalizePathsInResult('fs:readdir', [{ name: 'a', path: '/server/project/a', isDirectory: false }], translator)
    assert.deepStrictEqual(actual, [{ name: 'a', path: '/client/project/a', isDirectory: false }])
  })

  test('normalizePathsInResult rewrites git:getRoot string results', () => {
    const actual = normalizePathsInResult('git:getRoot', '/server/project', translator)
    assert.strictEqual(actual, '/client/project')
  })

  test('normalizePathsInResult leaves channels without known path shapes unchanged', () => {
    const result = [{ status: 'M', file: 'src/index.ts' }]
    const actual = normalizePathsInResult('git:status', result, translator)
    assert.deepStrictEqual(actual, result)
  })

  test('translateRemoteEventArgs rewrites fs:changed string payloads', () => {
    const actual = translateRemoteEventArgs('fs:changed', ['/server/project'], translator)
    assert.deepStrictEqual(actual, ['/client/project'])
  })

  test('translateRemoteEventArgs rewrites fs:changed object payloads defensively', () => {
    const actual = translateRemoteEventArgs('fs:changed', [{ path: '/server/project/file.txt', kind: 'change' }], translator)
    assert.deepStrictEqual(actual, [{ path: '/client/project/file.txt', kind: 'change' }])
  })

  test('translateRemoteEventArgs leaves unrelated events unchanged', () => {
    const payload = { path: '/server/project' }
    const actual = translateRemoteEventArgs('workspace:reload', [payload], translator)
    assert.deepStrictEqual(actual, [payload])
  })

  test('IdentityTranslator keeps legacy remote behavior as a no-op', () => {
    const identity = new IdentityTranslator()
    const actual = translateInvokeArgs('fs:readFile', ['C:\\client\\file.txt'], identity)
    assert.deepStrictEqual(actual, ['C:\\client\\file.txt'])
  })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
