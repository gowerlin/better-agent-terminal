import * as assert from 'assert'

import type { ProfileEntry } from '../electron/profile-manager'
import type { AuthResult, AuthResultMetadata } from '../electron/remote/protocol'
import { RemoteClient } from '../electron/remote/remote-client'
import { IdentityTranslator } from '../electron/remote/path-translator'

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
    name: 'Remote Profile',
    type: 'remote',
    remoteHost: '127.0.0.1',
    remotePort: 9876,
    remoteToken: 'secret',
    createdAt: 1,
    updatedAt: 2,
    ...partial,
  }
}

function applyAuthResultForTest(client: RemoteClient, result: AuthResult): void {
  ;(client as unknown as { applyAuthResult: (value: AuthResult) => void }).applyAuthResult(result)
}

function currentTranslator(client: RemoteClient): unknown {
  return (client as unknown as { translator: unknown }).translator
}

describe('Auth result metadata', () => {
  test('AuthResult accepts legacy boolean true', () => {
    const legacy: AuthResult = true
    assert.strictEqual(legacy, true)
  })

  test('AuthResult accepts metadata object payload', () => {
    const metadata: AuthResultMetadata = {
      serverPlatform: 'linux',
      serverArch: 'x64',
      serverEnv: 'native',
      nodeVersion: '24.0.0',
      bundleVersion: '0.3.1',
    }
    const result: AuthResult = metadata
    assert.strictEqual(typeof result, 'object')
    assert.strictEqual((result as AuthResultMetadata).serverPlatform, 'linux')
  })

  test('RemoteClient stores metadata when auth-result carries an object', () => {
    const metadata: AuthResultMetadata = {
      serverPlatform: 'linux',
      serverArch: 'x64',
      serverEnv: 'native',
      nodeVersion: '24.0.0',
      bundleVersion: '0.3.1',
    }
    const client = new RemoteClient(() => [], makeProfile({ targetOS: 'local' }))
    applyAuthResultForTest(client, metadata)
    assert.deepStrictEqual(client.serverMetadata, metadata)
  })

  test('RemoteClient falls back to IdentityTranslator for legacy boolean auth-result', () => {
    const client = new RemoteClient(() => [], makeProfile({ targetOS: 'local' }))
    applyAuthResultForTest(client, true)
    assert.strictEqual(client.serverMetadata, null)
    assert.ok(currentTranslator(client) instanceof IdentityTranslator)
  })

  test('RemoteClient keeps IdentityTranslator when profile targetOS is undefined', () => {
    const metadata: AuthResultMetadata = {
      serverPlatform: 'linux',
      serverArch: 'x64',
      nodeVersion: '24.0.0',
      bundleVersion: '0.3.1',
    }
    const client = new RemoteClient(() => [], makeProfile({ targetOS: undefined }))
    applyAuthResultForTest(client, metadata)
    assert.ok(currentTranslator(client) instanceof IdentityTranslator)
  })

  test('RemoteClient catches pending translator implementations and falls back to Identity', () => {
    const metadata: AuthResultMetadata = {
      serverPlatform: 'linux',
      serverArch: 'x64',
      serverEnv: 'native',
      nodeVersion: '24.0.0',
      bundleVersion: '0.3.1',
    }
    const client = new RemoteClient(() => [], makeProfile({ targetOS: 'wsl-linux', wslDistro: 'Ubuntu' }))
    applyAuthResultForTest(client, metadata)
    assert.deepStrictEqual(client.serverMetadata, metadata)
    assert.ok(currentTranslator(client) instanceof IdentityTranslator)
  })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
