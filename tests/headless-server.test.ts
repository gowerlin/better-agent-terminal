import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import {
  FileCertificateProvider,
  type LoadedCertificateBundle,
} from '../electron/remote/certificate'
import { createHeadlessServer } from '../electron/remote/headless-entry'

let passed = 0
let failed = 0

function test(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✅ ${name}`)
      passed += 1
    })
    .catch((error) => {
      console.error(`  ❌ ${name}`)
      console.error(`     ${error instanceof Error ? error.message : String(error)}`)
      failed += 1
    })
}

function makeTempDataDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bat-headless-${label}-`))
}

class TestCertificateProvider extends FileCertificateProvider {
  renewCalls = 0

  override async renew(): Promise<LoadedCertificateBundle> {
    this.renewCalls += 1
    return super.renew()
  }
}

async function run(): Promise<void> {
  console.log('\n🧪 Headless server factory\n')

  await test('createHeadlessServer constructs without throwing', async () => {
    const dataDir = makeTempDataDir('construct')
    const server = await createHeadlessServer({ dataDir, port: 0, logger: console })
    const info = server.getInfo()
    assert.strictEqual(info.pid, process.pid)
    await server.stop()
  })

  await test('start() returns actual port, fingerprint, and bind address', async () => {
    const dataDir = makeTempDataDir('start')
    const server = await createHeadlessServer({ dataDir, port: 0, logger: console })
    const started = await server.start()
    assert.ok(started.port > 0)
    assert.ok(started.fingerprint.length > 10)
    assert.strictEqual(started.bindAddress, '127.0.0.1')
    await server.stop()
  })

  await test('token persistence reuses the same token hash for the same dataDir', async () => {
    const dataDir = makeTempDataDir('token')
    const serverA = await createHeadlessServer({ dataDir, port: 0, logger: console })
    const tokenHashA = serverA.getInfo().tokenHash
    await serverA.stop()

    const serverB = await createHeadlessServer({ dataDir, port: 0, logger: console })
    const tokenHashB = serverB.getInfo().tokenHash
    assert.strictEqual(tokenHashB, tokenHashA)
    await serverB.stop()
  })

  await test('lockfile fail-fast rejects a second instance while the first lock is alive', async () => {
    const dataDir = makeTempDataDir('lock')
    const serverA = await createHeadlessServer({ dataDir, port: 0, logger: console })
    await serverA.start()

    const serverB = await createHeadlessServer({ dataDir, port: 0, logger: console })
    await assert.rejects(
      () => serverB.start(),
      /Another bat-server instance is already using/
    )

    await serverA.stop()
    await serverB.stop()
  })

  await test('stop() removes the lockfile', async () => {
    const dataDir = makeTempDataDir('stop')
    const lockfilePath = path.join(dataDir, 'lockfile.pid')
    const server = await createHeadlessServer({ dataDir, port: 0, logger: console })
    await server.start()
    assert.ok(fs.existsSync(lockfilePath))
    await server.stop()
    assert.strictEqual(fs.existsSync(lockfilePath), false)
  })

  await test('rotateToken and renewCertificate delegate to the underlying server', async () => {
    const dataDir = makeTempDataDir('rotate')
    const certificateProvider = new TestCertificateProvider(dataDir)
    const server = await createHeadlessServer({
      dataDir,
      port: 0,
      certificateProvider,
      logger: console,
    })
    await server.start()

    const before = server.getInfo().tokenHash
    const rotated = await server.rotateToken({ gracePeriodMs: 1234 })
    const after = server.getInfo().tokenHash
    assert.notStrictEqual(rotated.token, rotated.oldToken)
    assert.notStrictEqual(after, before)
    assert.ok(rotated.oldValidUntil > Date.now())

    const renewed = await server.renewCertificate()
    assert.ok(renewed.fingerprint.length > 10)
    assert.ok(renewed.expiresAt > Date.now())
    assert.ok(certificateProvider.renewCalls >= 1)

    await server.stop()
  })

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

void run()
