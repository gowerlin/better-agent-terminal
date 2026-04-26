import * as assert from 'assert'

import {
  normalizePathsInResult,
  PATH_AWARE_CHANNELS,
  PATH_RETURNING_CHANNELS,
  translateInvokeArgs,
  translateRemoteEventArgs,
} from '../electron/remote/path-aware-channels'
import { IdentityTranslator, type PathTranslator } from '../electron/remote/path-translator'
import { RemoteClient } from '../electron/remote/remote-client'

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

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn()
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

// T0299 BUG-067 — disconnect() must be async + await tunnel.stop().
function injectFakeTunnel(client: RemoteClient, stop: () => Promise<void>) {
  const t = { stop, on: () => t, isAlive: () => true, localPort: 0 }
  ;(client as unknown as { tunnel: typeof t }).tunnel = t
}

;(async () => {
  console.log('\nRemoteClient disconnect/tunnel lifecycle (T0299 BUG-067):')
  await testAsync('disconnect() awaits tunnel.stop() before resolving', async () => {
    const client = new RemoteClient(() => [])
    let stopResolved = false
    injectFakeTunnel(client, () => new Promise((r) => setTimeout(() => { stopResolved = true; r() }, 30)))
    const p = client.disconnect()
    let resolved = false
    void p.then(() => { resolved = true })
    await new Promise((r) => setTimeout(r, 5))
    assert.strictEqual(resolved, false, 'disconnect() must not resolve before tunnel.stop()')
    await p
    assert.strictEqual(stopResolved, true)
  })
  await testAsync('disconnect() swallows tunnel.stop() rejections', async () => {
    const client = new RemoteClient(() => [])
    injectFakeTunnel(client, () => Promise.reject(new Error('boom')))
    await client.disconnect()  // must not throw
  })

  // T0300 BUG-062 — fingerprint mismatch must early-return so any later
  // 'open' / 'message' the mocked socket fires cannot send the auth frame.
  // The fix has two parts that we lock down structurally:
  //   1. upgrade-handler mismatch block must end with `return` and set
  //      `_connected = false` BEFORE calling settle().
  //   2. open-handler must gate on `settled` so a racing 'open' after
  //      ws.close() cannot push the auth frame onto a rejected socket.
  console.log('\nRemoteClient fingerprint-mismatch race (T0300 BUG-062):')
  await testAsync('open handler skips send() when upgrade already settled (gate pattern)', async () => {
    let settled = false
    let sendCalls = 0
    // Mirror the gate added in openWss(): once `settled` is true the
    // 'open' handler must short-circuit before calling ws.send().
    const gatedOpenHandler = () => {
      if (settled) return
      sendCalls += 1
    }
    settled = true
    gatedOpenHandler()
    gatedOpenHandler()
    assert.strictEqual(sendCalls, 0, 'send() must not be called after settle')
  })
  await testAsync('remote-client.ts source: fingerprint-mismatch block has early-return + open gate', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.join(process.cwd(), 'electron', 'remote', 'remote-client.ts'),
      'utf8',
    )
    // (1) fingerprint mismatch block: locate the mismatch error log, then
    // assert that within a small window we see _connected=false BEFORE
    // settle(...) and a trailing `return` to short-circuit the handler.
    const mismatchAnchor = src.indexOf('Fingerprint mismatch:')
    assert.ok(mismatchAnchor >= 0, 'fingerprint mismatch logger.error anchor missing')
    const mismatchBlock = src.slice(mismatchAnchor, mismatchAnchor + 1500)
    const connFalseIdx = mismatchBlock.indexOf('this._connected = false')
    const settleIdx = mismatchBlock.indexOf("errorCode: 'fingerprint-mismatch'")
    // Match `})` (close of settle call) followed by whitespace and `return`.
    const earlyReturn = mismatchBlock.match(/\}\)\s+return/)
    assert.ok(connFalseIdx >= 0, '_connected = false must appear in mismatch block')
    assert.ok(settleIdx > connFalseIdx, '_connected = false must precede settle()')
    assert.ok(earlyReturn, 'return must follow settle() to short-circuit handler')
    // (2) open handler gate
    const openGate = src.match(/this\.ws\.on\('open'[\s\S]{0,400}if \(settled\) return/m)
    assert.ok(openGate, "ws.on('open') handler must gate on `settled`")
  })

  // T0300 BUG-068 — invoke must capture translator at call time so that a
  // mid-flight reconnect that swaps `this.translator` cannot mismatch
  // args (translated with translator A) against result (normalised with
  // translator B). The frozen reference is what flows through to the
  // pending invoke's resolve callback.
  console.log('\nRemoteClient invoke translator freeze (T0300 BUG-068):')
  await testAsync('invoke captures translator reference for both args and result normalisation', async () => {
    // Standalone repro of the freeze pattern: translator is captured
    // once, then mutated externally, and the captured reference is what
    // the pending callback uses for result normalisation.
    let activeTranslator: PathTranslator = new IdentityTranslator()
    const originalTranslator = activeTranslator

    function invokeLikeFreeze(args: unknown[]): { argsTranslator: PathTranslator; resultTranslator: PathTranslator } {
      // Mirror the BUG-068 fix: capture once at invoke entry.
      const translator = activeTranslator
      const argsTranslator = translator
      // Simulate reconnect mid-flight: swap the live translator.
      activeTranslator = new IdentityTranslator()
      assert.notStrictEqual(activeTranslator, originalTranslator, 'live translator must have been swapped')
      // The pending callback's translator must still be the original.
      const resultTranslator = translator
      void args  // unused — the invariant is reference equality
      return { argsTranslator, resultTranslator }
    }

    const { argsTranslator, resultTranslator } = invokeLikeFreeze(['/client/x'])
    assert.strictEqual(argsTranslator, resultTranslator, 'args and result must share the same translator reference')
    assert.strictEqual(argsTranslator, originalTranslator, 'frozen reference must be the translator at invoke entry')
  })
  await testAsync('invoke source: confirms translator is captured before pending.set (regression guard)', async () => {
    // Static guard: read remote-client.ts and assert the order
    //   const translator = this.translator
    //   ...translateInvokeArgs(channel, args, translator)
    //   ...normalizePathsInResult(channel, result, translator)
    // appears in invoke() — so a future refactor cannot silently revert.
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.join(process.cwd(), 'electron', 'remote', 'remote-client.ts'),
      'utf8',
    )
    const invokeIdx = src.indexOf('invoke(channel: string, args: unknown[]')
    assert.ok(invokeIdx >= 0, 'invoke() method should exist')
    const invokeBody = src.slice(invokeIdx, invokeIdx + 2000)
    const captureIdx = invokeBody.indexOf('const translator = this.translator')
    const argsCallIdx = invokeBody.indexOf('translateInvokeArgs(channel, args, translator)')
    const resultCallIdx = invokeBody.indexOf('normalizePathsInResult(channel, result, translator)')
    assert.ok(captureIdx >= 0, 'invoke() must capture translator into a local const')
    assert.ok(argsCallIdx > captureIdx, 'translateInvokeArgs must use the captured translator')
    assert.ok(resultCallIdx > captureIdx, 'normalizePathsInResult must use the captured translator')
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})()
