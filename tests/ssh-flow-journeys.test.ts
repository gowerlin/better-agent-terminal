import assert from 'node:assert/strict'
import { afterEach, before, after, test } from 'node:test'
import * as https from 'node:https'
import { AddressInfo } from 'node:net'
import selfsigned from 'selfsigned'
import { buildSshWizardSteps } from '../src/components/setup-wizard/ssh-flow'
import { resetFetchFingerprintImplForTests } from '../src/components/setup-wizard/steps/wsl/fetch-fingerprint'
import { WizardRunner, WizardStepStatus } from '../src/components/setup-wizard/wizard-runner'
import { SshPathTranslator } from '../electron/remote/path-translator'
import { createMockElectronApi, installMockWindow } from './__mocks__/electron-api'

// T0287 AC3 — three SSH user journeys (T0266 §7 Journey A/B + cross-OS macOS).
// Each journey runs the full wizard with mocked IPC; the journeys exercise
// distinct code paths (alias auto-resolve / permission-denied retry / cross-OS).

let mockServer: https.Server | null = null
let mockServerPort = 0

before(async () => {
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 1, keySize: 2048 },
  )
  mockServer = https.createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    if (req.url === '/fingerprint') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('FP:JOURNEY:01:02:03')
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

// ---------------------------------------------------------------------------
// Journey A — Power user with ssh-config alias `devbox` resolves end-to-end
// without any UI prompt re-typing. Validates listHosts dropdown -> alias
// auto-fill -> probe -> upload -> systemd start -> profile write.
// ---------------------------------------------------------------------------
test('Journey A: ssh-config alias devbox completes happy path with key-based auth', async () => {
  const harness = createMockElectronApi({
    serverPort: mockServerPort,
    remoteServerEnv: 'ssh',
    sshHosts: ['devbox', 'staging', 'prod-bastion'],
    remoteServerPlatform: 'linux',
    remoteServerArch: 'x64',
    remoteServerHome: '/home/alice',
  })
  installMockWindow(harness.electronAPI)

  // Power user picks alias from dropdown — configure-ssh-host writes
  // sshHost = sshAlias when sshHost is unset, mimicking the UI auto-fill.
  const ctx = harness.createSshContext('Devbox Alias', {
    sshAlias: 'devbox',
    sshUser: 'alice',
    sshKeyPath: '~/.ssh/id_ed25519',
    sshInstallPath: '~/.local/bat-server',
    sshTunnelMode: 'tunnel' as const,
    bundleTarballPath: 'C:\\fake\\bundles\\bat-server-linux-x64-v0.3.1.tar.gz',
  })

  await new WizardRunner(buildSshWizardSteps(), ctx).run()

  // Step 1: alias resolved
  assert.equal(ctx.state.sshAlias, 'devbox')
  assert.equal(ctx.state.sshHost, 'devbox', 'configure step must auto-fill host=alias')
  // Step 2: targetOS auto-set from probe
  assert.equal(ctx.targetOS, 'ssh-linux')
  // Step 2: serverHome populated from probe
  assert.equal(ctx.serverMetadata?.serverHome, '/home/alice')
  // Step 7: profile metadata persisted (schema strips alias/installPath; alias
  // is resolved at connect time via ssh-config — sshHost holds the alias).
  assert.equal(ctx.createdProfileId, 'devbox-alias')
  const profile = harness.profiles.get('devbox-alias') as Record<string, unknown>
  assert.equal(profile.sshHost, 'devbox')
  assert.equal(profile.targetOS, 'ssh-linux')
  assert.equal(profile.useSshTunnel, true)
})

// ---------------------------------------------------------------------------
// Journey B — Permission-denied recovery. probe-auth fails the first time,
// the user supplies a key path (option [B] use existing key from the modal),
// and the wizard retries successfully without aborting the run.
// ---------------------------------------------------------------------------
test('Journey B: permission-denied followed by retry with new key succeeds', async () => {
  const harness = createMockElectronApi({
    serverPort: mockServerPort,
    remoteServerEnv: 'ssh',
    remoteServerPlatform: 'linux',
    remoteServerArch: 'x64',
    remoteServerHome: '/home/bob',
    // First probe rejects the default key, second probe succeeds with new key.
    sshProbeSequence: [
      { ok: false, errorCode: 'permission-denied', error: 'auth: publickey rejected' },
      { ok: true },
    ],
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createSshContext('First Time User', {
    sshHost: 'bastion.example.com',
    sshUser: 'bob',
    // Initially no key path — mimics the user typing user@host without a key.
    sshKeyPath: undefined,
    sshInstallPath: '~/.local/bat-server',
    sshTunnelMode: 'tunnel' as const,
    bundleTarballPath: 'C:\\fake\\bundles\\bat-server-linux-x64-v0.3.1.tar.gz',
  })

  let retryFired = false
  // The runner pauses on Failed and waits for retry/skip — simulate the user
  // selecting "use existing key" and clicking Retry.
  const runner = new WizardRunner(buildSshWizardSteps(), ctx, (snapshots) => {
    const failed = snapshots.find((s) => s.status === WizardStepStatus.Failed && s.id === 'verify-ssh-auth')
    if (failed && !retryFired) {
      retryFired = true
      // User picks option [B]: provides existing key.
      ;(ctx.state as Record<string, unknown>).sshKeyPath = '~/.ssh/id_ed25519_existing'
      setTimeout(() => void runner.retryCurrentStep(), 0)
    }
  })
  await runner.run()

  // verify-ssh-auth was hit twice (initial fail + retry success).
  assert.equal(harness.operationLog.sshProbeCalls.length, 2)
  assert.equal(harness.operationLog.sshProbeCalls[0].sshKeyPath, undefined)
  assert.equal(harness.operationLog.sshProbeCalls[1].sshKeyPath, '~/.ssh/id_ed25519_existing')
  // After recovery the wizard reaches done and writes a profile.
  assert.equal(ctx.createdProfileId, 'first-time-user')
  // ctx.state captured the last probe error code before the successful retry.
  const state = ctx.state as { sshLastProbeErrorCode?: string }
  assert.equal(state.sshLastProbeErrorCode, undefined, 'error code cleared after success')
  assert.ok(retryFired, 'retry hook must have fired in response to permission-denied')
})

// ---------------------------------------------------------------------------
// Journey C — Cross-OS first connect: Windows client → macOS arm64 server.
// Validates targetOS=ssh-darwin, launchd start, AND the SshPathTranslator
// home-prefix swap across operating systems (T0266 §6 cross-OS scenario).
// ---------------------------------------------------------------------------
test('Journey C: Windows client connects to macOS arm64 server end-to-end', async () => {
  const harness = createMockElectronApi({
    serverPort: mockServerPort,
    remoteServerEnv: 'ssh',
    remoteServerPlatform: 'darwin',
    remoteServerArch: 'arm64',
    remoteServerHome: '/Users/bob',
    bundleEntries: [
      {
        name: 'bat-server-darwin-arm64-v0.3.1.tar.gz',
        path: 'C:\\Users\\Alice\\AppData\\Roaming\\BAT\\bat-server-bundles\\bat-server-darwin-arm64-v0.3.1.tar.gz',
      },
    ],
  })
  installMockWindow(harness.electronAPI)

  const ctx = harness.createSshContext('Mac Server', {
    sshHost: 'mac-mini.local',
    sshUser: 'bob',
    sshKeyPath: 'C:\\Users\\Alice\\.ssh\\id_ed25519',
    sshInstallPath: '~/.local/bat-server',
    sshTunnelMode: 'tunnel' as const,
    sshServerArch: 'arm64',
    // Use explicit darwin tarball path to bypass install-bundle's linux-only
    // findBundleInDirectory regex (kept conservative for v1; T0287 AC9).
    bundleTarballPath: 'C:\\Users\\Alice\\AppData\\Roaming\\BAT\\bat-server-bundles\\bat-server-darwin-arm64-v0.3.1.tar.gz',
  })

  await new WizardRunner(buildSshWizardSteps(), ctx).run()

  // Probe auto-set targetOS to ssh-darwin
  assert.equal(ctx.targetOS, 'ssh-darwin')
  assert.equal(ctx.serverMetadata?.serverPlatform, 'darwin')
  assert.equal(ctx.serverMetadata?.serverArch, 'arm64')
  assert.equal(ctx.serverMetadata?.serverHome, '/Users/bob')
  // start-server got launchd path
  assert.equal(harness.operationLog.sshStartCalls[0].targetOS, 'ssh-darwin')
  assert.equal(harness.operationLog.sshStartCalls[0].serverHome, '/Users/bob')
  // Profile persisted with darwin targetOS
  const profile = harness.profiles.get('mac-server') as Record<string, unknown>
  assert.equal(profile.targetOS, 'ssh-darwin')
  assert.equal(profile.serverHome, '/Users/bob')

  // AC4: cross-OS path translation — Windows client home <-> mac /Users/bob
  const translator = new SshPathTranslator('C:\\Users\\Alice', '/Users/bob', true)
  const clientPath = 'C:\\Users\\Alice\\src\\foo.ts'
  const serverPath = '/Users/bob/src/foo.ts'
  assert.equal(translator.toServer(clientPath), serverPath, 'toServer should swap C:\\Users\\Alice -> /Users/bob')
  assert.equal(translator.toClient(serverPath), clientPath, 'toClient should swap /Users/bob -> C:\\Users\\Alice')
  assert.equal(translator.owns(clientPath), true)
})
