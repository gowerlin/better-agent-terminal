import assert from 'node:assert/strict'
import { afterEach, before, after, test } from 'node:test'
import * as https from 'node:https'
import { X509Certificate } from 'node:crypto'
import { AddressInfo } from 'node:net'
import selfsigned from 'selfsigned'
import { buildSshWizardSteps } from '../src/components/setup-wizard/ssh-flow'
import { resetFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { WizardStepStatus } from '../src/components/setup-wizard/wizard-runner'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'
import { createTestWizardRunner } from './__helpers__/wizard-harness'

// T0287 AC2 — mock-based SSH wizard e2e. Uses a real `node:https` server with
// a `selfsigned` cert to validate the actual fetchFingerprintStep code path,
// and mocks the rest of the IPC surface via tests/__mocks__/electron-api.ts.
// T0682 (BUG-168 G4): the mocked verify tunnel (T0387) hands out this
// server's port as its local end, and the mocked wsl.fetchFingerprint runs
// main's fetchTlsFingerprint (T0381) against it.

const SSH_BASE_STATE = {
  sshHost: 'devbox',
  sshUser: 'alice',
  sshPort: 22,
  sshKeyPath: '~/.ssh/id_ed25519_bat',
  sshInstallPath: '~/.local/bat-server',
  sshTunnelMode: 'tunnel' as const,
  // Pre-set tarball path so install-server-bundle skips fs.readdir lookup.
  bundleTarballPath: 'C:\\fake\\bundles\\bat-server-linux-x64-v0.3.1.tar.gz',
}

let mockServer: https.Server | null = null
let mockServerPort = 0
let mockServerFingerprint = ''

before(async () => {
  // self-sign a cert for localhost; the fingerprint is read from the TLS
  // handshake (T0381: bat-server has no HTTP handler).
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 1, keySize: 2048 },
  )
  mockServerFingerprint = new X509Certificate(pems.cert).fingerprint256
  mockServer = https.createServer({ key: pems.private, cert: pems.cert }, (_req, res) => {
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve) => mockServer!.listen(0, '127.0.0.1', () => resolve()))
  mockServerPort = (mockServer!.address() as AddressInfo).port
})

after(async () => {
  if (mockServer) {
    await new Promise<void>((resolve) => mockServer!.close(() => resolve()))
    mockServer = null
  }
})

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window
  resetFetchFingerprintImplForTests()
})

test('AC2.1: SSH e2e happy path completes all 8 steps with mocked IPC + real HTTPS fingerprint', async () => {
  const harness = createMockElectronApi({
    serverPort: mockServerPort,
    remoteServerEnv: 'ssh',
    remoteServerPlatform: 'linux',
    remoteServerArch: 'x64',
    remoteServerHome: '/home/alice',
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createSshContext('Devbox', SSH_BASE_STATE)

  const runner = createTestWizardRunner(buildSshWizardSteps(), ctx)
  await runner.run()

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots.length, 8, 'expected 8 active steps')
  assert.ok(
    snapshots.every((snapshot) => snapshot.status === WizardStepStatus.Succeeded),
    `unexpected statuses: ${JSON.stringify(snapshots.map((s) => [s.id, s.status]))}`,
  )
  assert.equal(ctx.createdProfileId, 'devbox')
  assert.equal(ctx.fingerprint, mockServerFingerprint)
  // T0387 (BUG-093): verified through the tunnel to the remote server port,
  // closed after connect-test; the fingerprint matched server-cert.json.
  assert.equal(harness.operationLog.sshOpenTunnelCalls[0]?.remotePort, mockServerPort)
  assert.deepEqual(harness.operationLog.fetchFingerprintCalls, [{ port: mockServerPort, host: '127.0.0.1' }])
  assert.equal(harness.operationLog.remoteTestHosts[0]?.host, '127.0.0.1')
  assert.ok(harness.operationLog.sshCloseTunnelCalls.length > 0)
  assert.equal(harness.operationLog.sshReadIdentityCalls.length, 1)
  assert.equal(ctx.serverMetadata?.serverEnv, 'ssh')
  assert.equal(ctx.targetOS, 'ssh-linux')
})

test('AC2.2: ssh:upload-progress events fire and accumulate bytesSent on ctx.state', async () => {
  const harness = createMockElectronApi({
    serverPort: mockServerPort,
    remoteServerEnv: 'ssh',
    sshUploadProgressChunks: 5,
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createSshContext('Upload Probe', SSH_BASE_STATE)

  await createTestWizardRunner(buildSshWizardSteps(), ctx).run()

  const state = ctx.state as { uploadBytesSent?: number; uploadTotalBytes?: number }
  assert.ok(typeof state.uploadBytesSent === 'number', 'uploadBytesSent should be set')
  assert.ok(typeof state.uploadTotalBytes === 'number', 'uploadTotalBytes should be set')
  assert.equal(state.uploadBytesSent, state.uploadTotalBytes, 'final progress should match total')
  assert.equal(harness.operationLog.sshUploadCalls.length, 1)
  assert.match(harness.operationLog.sshUploadCalls[0].uploadId, /^ssh-upload-/)
})

test('AC2.3: SSH e2e records ssh.* call sequence and write-profile metadata', async () => {
  const harness = createMockElectronApi({
    serverPort: mockServerPort,
    remoteServerEnv: 'ssh',
    remoteServerHome: '/home/alice',
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createSshContext('Sequencer', SSH_BASE_STATE)

  await createTestWizardRunner(buildSshWizardSteps(), ctx).run()

  // Expected single-shot sequence on happy path.
  assert.equal(harness.operationLog.sshProbeCalls.length, 1)
  assert.equal(harness.operationLog.sshUploadCalls.length, 1)
  assert.equal(harness.operationLog.sshStartCalls.length, 1)
  assert.equal(harness.operationLog.sshStartCalls[0].targetOS, 'ssh-linux')
  // write-profile must persist SSH-specific metadata.
  const profile = harness.profiles.get(ctx.createdProfileId!) as Record<string, unknown>
  assert.equal(profile.targetOS, 'ssh-linux')
  assert.equal(profile.sshHost, 'devbox')
  assert.equal(profile.sshUser, 'alice')
  assert.equal(profile.useSshTunnel, true)
  assert.equal(profile.serverHome, '/home/alice')
})

test('AC2.4: start-server failure rolls back and prevents profile write', async () => {
  // Simulate the systemd unit failing to start. The runner should bubble the
  // error out (no Retry handler attached) and the profile should never exist.
  const harness = createMockElectronApi({
    serverPort: mockServerPort,
    remoteServerEnv: 'ssh',
    sshStartSequence: [
      {
        ok: false,
        method: 'failed',
        servicePath: '/home/alice/.config/systemd/user/bat-server.service',
        error: 'Failed to enable-linger: not authorized',
        errorCode: 'enable-failed',
      },
    ],
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createSshContext('Rollback', SSH_BASE_STATE)

  // The test runner cancels out of the wait-for-retry-or-skip loop on the
  // failure, so it propagates out (mirrors the user clicking "Cancel").
  const runner = createTestWizardRunner(buildSshWizardSteps(), ctx)
  await assert.rejects(() => runner.run(), /enable-failed/)

  assert.equal(ctx.createdProfileId, undefined, 'profile must not be created when start-server fails')
  assert.equal(harness.profiles.size, 0)
  // ssh:start-server was hit, but no fetch-fingerprint / connect-test / profile.
  assert.equal(harness.operationLog.sshStartCalls.length, 1)
  assert.equal(harness.operationLog.remoteTestHosts.length, 0)
})

test('AC2.5: SSH wizard preserves custom profile names through write-profile', async () => {
  const harness = createMockElectronApi({
    serverPort: mockServerPort,
    remoteServerEnv: 'ssh',
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createSshContext('Production Bastion', SSH_BASE_STATE)

  await createTestWizardRunner(buildSshWizardSteps(), ctx).run()

  assert.equal(ctx.createdProfileId, 'production-bastion')
  assert.ok(harness.profiles.has('production-bastion'))
})
