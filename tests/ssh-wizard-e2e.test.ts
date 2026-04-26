import assert from 'node:assert/strict'
import { afterEach, before, after, test } from 'node:test'
import * as https from 'node:https'
import { AddressInfo } from 'node:net'
import selfsigned from 'selfsigned'
import { buildSshWizardSteps } from '../src/components/setup-wizard/ssh-flow'
import { resetFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { WizardRunner, WizardStepStatus } from '../src/components/setup-wizard/wizard-runner'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'

// T0287 AC2 — mock-based SSH wizard e2e. Uses a real `node:https` server with
// a `selfsigned` cert to validate the actual fetchFingerprintStep code path,
// and mocks the rest of the IPC surface via tests/__mocks__/electron-api.ts.

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

before(async () => {
  // self-sign a cert for localhost so https.get with rejectUnauthorized:false
  // can fetch the fingerprint endpoint.
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 1, keySize: 2048 },
  )
  mockServer = https.createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    if (req.url === '/fingerprint') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('FP:11:22:33:44')
      return
    }
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

  const runner = new WizardRunner(buildSshWizardSteps(), ctx)
  await runner.run()

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots.length, 8, 'expected 8 active steps')
  assert.ok(
    snapshots.every((snapshot) => snapshot.status === WizardStepStatus.Succeeded),
    `unexpected statuses: ${JSON.stringify(snapshots.map((s) => [s.id, s.status]))}`,
  )
  assert.equal(ctx.createdProfileId, 'devbox')
  assert.equal(ctx.fingerprint, 'FP:11:22:33:44')
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

  await new WizardRunner(buildSshWizardSteps(), ctx).run()

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

  await new WizardRunner(buildSshWizardSteps(), ctx).run()

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

  // Cancel out of the runner's wait-for-retry-or-skip loop so the failure
  // propagates out (mirrors the user clicking "Cancel" in the shell).
  const runner = new WizardRunner(buildSshWizardSteps(), ctx, (snapshots) => {
    const failed = snapshots.find((s) => s.status === WizardStepStatus.Failed)
    if (failed) {
      void runner.cancel()
    }
  })
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

  await new WizardRunner(buildSshWizardSteps(), ctx).run()

  assert.equal(ctx.createdProfileId, 'production-bastion')
  assert.ok(harness.profiles.has('production-bastion'))
})
