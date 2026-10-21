import { fetchTlsFingerprint } from '../../electron/tls-fingerprint'
import type { WizardContext } from '../../src/components/setup-wizard/wizard-runner'
import { createDockerWizardContext } from '../../src/components/setup-wizard/docker-flow'
import { createSshWizardContext } from '../../src/components/setup-wizard/ssh-flow'
import { createWslWizardContext } from '../../src/components/setup-wizard/wsl-flow'

type NetworkMode = 'mirrored' | 'nat' | 'unknown'

// T0287: SSH mock harness — drives ssh.{listHosts,probeAuth,uploadBundle,startServer}
// + remote.testConnection + profile.create/update against the mock-based e2e tests.
// Sequence-based responses let a single harness emulate the "first call fails,
// retry succeeds" pattern (Journey B permission-denied recovery).
type SshProbeResponse =
  | { ok: true; serverPlatform?: 'linux' | 'darwin'; serverArch?: string; serverHome?: string }
  | { ok: false; errorCode?: 'no-ssh' | 'permission-denied' | 'host-key' | 'connect-timeout' | 'unknown'; error?: string }

type SshStartResponse =
  | { ok: true; method: 'systemd' | 'launchd'; servicePath: string; checkOutput?: string }
  | { ok: false; method: 'failed'; servicePath: string; error: string; errorCode?: 'unit-write-failed' | 'enable-failed' | 'start-failed' | 'verify-failed' | 'unknown' }

interface MockOptions {
  platform?: 'win32' | 'darwin' | 'linux'
  distros?: Array<{ name: string; version: 1 | 2; state: 'Running' | 'Stopped' }>
  defaultDistro?: string | null
  systemdEnabled?: boolean
  networkMode?: NetworkMode
  remoteConnectionOk?: boolean
  remoteFingerprint?: string
  remoteToken?: string
  profileUpdateOk?: boolean
  serverPort?: number
  remoteServerEnv?: 'wsl' | 'docker' | 'ssh'
  dockerRemoteMounts?: Array<{ host: string; container: string }>
  dockerAvailable?: boolean
  dockerContainers?: Array<{ id: string; name: string; image: string; state: string; status: string }>
  dockerSelectFolders?: string[] | null
  dockerValidateErrors?: string[]
  dockerStartOk?: boolean
  dockerStartError?: string
  dockerLogs?: string
  dockerHealthSequence?: Array<'healthy' | 'unhealthy' | 'starting' | 'none'>
  // T0287 SSH options
  sshHosts?: string[]
  sshProbeSequence?: SshProbeResponse[]
  sshUploadOk?: boolean
  sshUploadError?: string
  sshUploadProgressChunks?: number
  sshStartSequence?: SshStartResponse[]
  remoteServerPlatform?: 'linux' | 'darwin'
  remoteServerArch?: 'x64' | 'arm64'
  remoteServerHome?: string
  bundleEntries?: Array<{ name: string; path: string }>
  // T0682 (BUG-168 G4) WSL options (T0378 / T0382 / T0384 / T0554)
  wslHome?: string
  wslInstallPrevious?: 'kept' | 'none' | 'unmanaged'
  wslUnitSnapshot?: { content: string | null; active: boolean; enabled: boolean }
  // T0682: update.getVersion (T0322) and server-bundle:distribute (T0321)
  appVersion?: string
  bundleDistributeSource?: 'cache' | 'baseline' | 'download'
  // T0682 SSH verify tunnel (T0387 / T0517). The local end defaults to the
  // harness serverPort, which SSH tests point at their own HTTPS server.
  sshVerifyTunnelLocalPort?: number
  sshForwardingDenied?: boolean
  /** Default: the fingerprint the harness last read in a handshake + remoteToken. */
  sshServerIdentity?: { ok: true; fingerprint: string | null; token: string | null } | { ok: false; error: string }
}

function slugifyProfileId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profile'
}

export function createMockElectronApi(options: MockOptions = {}) {
  const profiles = new Map<string, Record<string, unknown>>()
  const operationLog = {
    installCalls: [] as Array<{ distro: string; tarballPath: string; installPath: string; keepPrevious?: boolean }>,
    uninstallCalls: [] as Array<{ distro: string; installPath: string }>,
    removeUnitCalls: [] as string[],
    // T0682 (BUG-168 G4): WSL IPC added after T0383.
    resolveHomeCalls: [] as string[],
    restoreBundleCalls: [] as Array<{ distro: string; installPath: string }>,
    discardPreviousBundleCalls: [] as Array<{ distro: string; installPath: string }>,
    wslPickPortCalls: [] as Array<{ preferredPort?: number; existing?: { distro: string; unitPath: string; serviceName: string } }>,
    keepAliveCalls: [] as string[],
    releaseKeepAliveCalls: [] as string[],
    writeUnitCalls: [] as Array<{ distro: string; unit: { path?: string; content?: string; execStart?: string; description?: string; environment?: Record<string, string> } }>,
    snapshotUnitCalls: [] as Array<{ distro: string; serviceName: string; path: string }>,
    restoreUnitCalls: [] as Array<{ distro: string; serviceName: string; path: string; content: string; enabled: boolean; start: boolean }>,
    restartServiceCalls: [] as Array<{ distro: string; serviceName: string }>,
    bundleDistributeCalls: [] as Array<{ draftProfile?: Record<string, unknown>; version?: string }>,
    createdProfileIds: [] as string[],
    deletedProfileIds: [] as string[],
    remoteTestHosts: [] as Array<{ host: string; port: number }>,
    dockerStartCalls: [] as Array<{
      name: string
      createIfMissing: boolean
      image?: string
      mounts?: Array<{ host: string; container: string }>
      port?: number
      restartPolicy?: string
      token?: string
      dataVolume?: string
    }>,
    dockerStopCalls: [] as Array<{ name: string; remove?: boolean }>,
    dockerRemoveCalls: [] as string[],
    dockerRestartCalls: [] as string[],
    dockerLogsCalls: [] as Array<{ name: string; tail?: number; follow?: boolean }>,
    dockerHealthCalls: [] as string[],
    // T0682 (BUG-168 G4): docker:pick-server-port requests (T0649).
    dockerPickPortCalls: [] as Array<{ preferredPort?: number; previousPort?: number; container?: string }>,
    // T0287 SSH operation log
    sshProbeCalls: [] as Array<{ sshHost: string; sshUser: string; sshPort?: number; sshKeyPath?: string }>,
    sshUploadCalls: [] as Array<{ uploadId: string; sshHost: string; installPath: string; tarballPath: string }>,
    sshStartCalls: [] as Array<{ startId: string; sshHost: string; targetOS: string; serverPort?: number; serverHome: string }>,
    // T0289 PLAN-007 rollback IPC log (RFC C-3 best-effort cleanup hooks)
    sshUninstallCalls: [] as Array<{ sshHost: string; sshUser: string; installPath: string }>,
    sshStopServerCalls: [] as Array<{ sshHost: string; sshUser: string; targetOS: 'ssh-linux' | 'ssh-darwin'; serverHome: string }>,
    dockerExecCalls: [] as Array<{ name: string; command: string[] }>,
    // T0682 (BUG-168 G4): SSH verification (T0387 / T0517) and the fingerprint
    // handshake (T0381).
    sshOpenTunnelCalls: [] as Array<{ sessionId: string; sshHost: string; sshUser: string; remotePort: number }>,
    sshCloseTunnelCalls: [] as string[],
    sshTunnelStatusCalls: [] as string[],
    sshReadIdentityCalls: [] as Array<{ sshHost: string; targetOS: 'ssh-linux' | 'ssh-darwin'; serverHome: string }>,
    fetchFingerprintCalls: [] as Array<{ port: number; host?: string }>,
  }

  const distros = options.distros ?? [{ name: 'Ubuntu', version: 2 as const, state: 'Running' as const }]
  const defaultDistro = options.defaultDistro ?? distros[0]?.name ?? null
  const remoteFingerprint = options.remoteFingerprint ?? 'FP:AA:BB:CC'
  const remoteToken = options.remoteToken ?? 'secret-token'
  const serverPort = options.serverPort ?? 9876
  const platform = options.platform ?? 'win32'
  const dockerContainers = new Map((options.dockerContainers ?? []).map((container) => [container.name, { ...container }]))
  const dockerHealthSequence = [...(options.dockerHealthSequence ?? ['healthy'])]
  // T0287 SSH sequence state — shifted on each call so tests can model
  // "first probe fails permission-denied, second probe succeeds" patterns.
  const sshProbeSequence: SshProbeResponse[] = [...(options.sshProbeSequence ?? [])]
  const sshStartSequence: SshStartResponse[] = [...(options.sshStartSequence ?? [])]
  const sshHosts = options.sshHosts ?? []
  const remoteServerPlatform = options.remoteServerPlatform ?? 'linux'
  const remoteServerArch = options.remoteServerArch ?? 'x64'
  const remoteServerHome = options.remoteServerHome ?? '/home/test'
  const bundleEntries = options.bundleEntries ?? [
    {
      name: 'bat-server-linux-x64-v0.3.1.tar.gz',
      path: 'C:\\Users\\test\\AppData\\Roaming\\BAT\\bat-server-bundles\\bat-server-linux-x64-v0.3.1.tar.gz',
    },
  ]
  // Listeners installed by step run() bodies. Tests can inspect the harness
  // to assert the right ssh:upload-progress / ssh:start-progress flows fired.
  const wslHome = options.wslHome ?? '/home/test'
  const appVersion = options.appVersion ?? '0.3.1'
  // T0682: ports this harness handed out as a verify tunnel's local end. Only
  // those get a real TLS handshake (the test's own server); anything else,
  // e.g. 9876 where this machine's BAT may listen, is reported unreachable.
  const verifyTunnelPorts = new Set<number>()
  let lastHandshakeFingerprint: string | null = null
  const sshUploadProgressListeners = new Set<(payload: { uploadId: string; bytesSent: number; totalBytes: number }) => void>()
  const sshStartProgressListeners = new Set<(payload: { startId: string; phase: 'writing-unit' | 'enabling' | 'starting' | 'verifying' }) => void>()

  const electronAPI = {
    platform,
    dialog: {
      selectFolder: async () => options.dockerSelectFolders ?? ['C:\\Users\\test\\project'],
      selectImages: async () => [],
      selectFiles: async () => [],
      confirm: async () => true,
    },
    wsl: {
      list: async () => ({ distros, default: defaultDistro }),
      systemdEnabled: async () => options.systemdEnabled ?? true,
      // T0383 (BUG-089): { actual, declared, mirroredSupported } shape.
      detectNetworkMode: async () => ({ actual: options.networkMode ?? 'mirrored', declared: null, mirroredSupported: true }),
      // T0682 (BUG-168 G4): T0378 resolves the distro user's absolute $HOME.
      resolveHome: async (distro: string) => {
        operationLog.resolveHomeCalls.push(distro)
        return wslHome
      },
      installBundle: async (distro: string, tarballPath: string, installPath: string, installOptions?: { keepPrevious?: boolean }) => {
        operationLog.installCalls.push({ distro, tarballPath, installPath, keepPrevious: installOptions?.keepPrevious })
        return { ok: true as const, previous: options.wslInstallPrevious ?? ('none' as const) }
      },
      uninstallBundle: async (distro: string, installPath: string) => {
        operationLog.uninstallCalls.push({ distro, installPath })
        return { ok: true as const }
      },
      restoreBundle: async (distro: string, installPath: string) => {
        operationLog.restoreBundleCalls.push({ distro, installPath })
        return { ok: true as const, outcome: 'restored' as const }
      },
      discardPreviousBundle: async (distro: string, installPath: string) => {
        operationLog.discardPreviousBundleCalls.push({ distro, installPath })
        return { ok: true as const }
      },
      // T0382 (BUG-091): a user override is validated as-is; otherwise the
      // harness port stands in for the free port main would pick.
      pickServerPort: async (preferredPort?: number, existing?: { distro: string; unitPath: string; serviceName: string }) => {
        operationLog.wslPickPortCalls.push({ preferredPort, existing })
        return { ok: true as const, port: preferredPort ?? serverPort }
      },
      keepAlive: async (distro: string) => {
        operationLog.keepAliveCalls.push(distro)
        return { ok: true as const }
      },
      releaseKeepAlive: async (distro: string) => {
        operationLog.releaseKeepAliveCalls.push(distro)
        return { ok: true as const }
      },
      // T0682 (BUG-168 G4): main's handler is fetchTlsFingerprint (T0381);
      // tests that do not stub fetch-fingerprint reach it through the SSH
      // verify tunnel, whose local end is the test's own HTTPS server.
      fetchFingerprint: async (port: number, host?: string) => {
        operationLog.fetchFingerprintCalls.push({ port, host })
        if (!verifyTunnelPorts.has(port)) {
          return {
            ok: false as const,
            errorCode: 'fingerprint-unreachable' as const,
            error: `Cannot reach ${host ?? '127.0.0.1'}:${port}: no test TLS server on this port (stub fetch-fingerprint or open a verify tunnel)`,
          }
        }
        const result = await fetchTlsFingerprint(port, host === undefined ? {} : { host })
        if (result.ok) lastHandshakeFingerprint = result.fingerprint
        return result
      },
    },
    wslSystemd: {
      writeUnit: async (distro: string, unit: { path?: string; content?: string; execStart?: string; description?: string; environment?: Record<string, string> }) => {
        operationLog.writeUnitCalls.push({ distro, unit })
        return { ok: true as const }
      },
      enableLinger: async () => ({ ok: true }),
      startService: async () => ({ ok: true as const, token: remoteToken }),
      removeUnit: async (_distro: string, serviceName: string) => {
        operationLog.removeUnitCalls.push(serviceName)
        return { ok: true as const }
      },
      // T0682 (BUG-168 G4): T0554 snapshot / restore of the previous unit.
      // Default: no unit before setup (first install).
      snapshotUnit: async (distro: string, serviceName: string, snapshotOptions: { path: string }) => {
        operationLog.snapshotUnitCalls.push({ distro, serviceName, path: snapshotOptions.path })
        return { ok: true as const, ...(options.wslUnitSnapshot ?? { content: null, active: false, enabled: false }) }
      },
      restoreUnit: async (distro: string, serviceName: string, restoreOptions: { path: string; content: string; enabled: boolean; start: boolean }) => {
        operationLog.restoreUnitCalls.push({ distro, serviceName, ...restoreOptions })
        return { ok: true as const }
      },
      restartService: async (distro: string, serviceName: string) => {
        operationLog.restartServiceCalls.push({ distro, serviceName })
        return { ok: true as const }
      },
    },
    // T0682 (BUG-168 G4): install-server-bundle asks for the app version (T0322).
    update: {
      getVersion: async () => appVersion,
    },
    app: {
      getUserDataPath: async () => 'C:\\Users\\test\\AppData\\Roaming\\BAT',
    },
    fs: {
      readdir: async () => bundleEntries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        isDirectory: false,
        pathKey: 'bundle',
      })),
    },
    ssh: {
      listHosts: async () => [...sshHosts],
      probeAuth: async (opts: { sshHost: string; sshUser: string; sshPort?: number; sshKeyPath?: string }) => {
        operationLog.sshProbeCalls.push({ ...opts })
        const next = sshProbeSequence.shift()
        if (next) {
          if (!next.ok) {
            return {
              ok: false,
              errorCode: next.errorCode ?? 'unknown',
              error: next.error ?? `Probe failed: ${next.errorCode ?? 'unknown'}`,
            }
          }
          return {
            ok: true,
            serverPlatform: next.serverPlatform ?? remoteServerPlatform,
            serverArch: next.serverArch ?? remoteServerArch,
            serverHome: next.serverHome ?? remoteServerHome,
            sshExecPath: '/usr/bin/ssh',
          }
        }
        return {
          ok: true,
          serverPlatform: remoteServerPlatform,
          serverArch: remoteServerArch,
          serverHome: remoteServerHome,
          sshExecPath: '/usr/bin/ssh',
        }
      },
      uploadBundle: async (request: {
        uploadId: string
        options: {
          sshHost: string
          sshUser: string
          sshPort?: number
          sshKeyPath?: string
          installPath: string
          tarballPath: string
        }
      }) => {
        operationLog.sshUploadCalls.push({
          uploadId: request.uploadId,
          sshHost: request.options.sshHost,
          installPath: request.options.installPath,
          tarballPath: request.options.tarballPath,
        })
        const totalBytes = 1_500_000
        const chunks = options.sshUploadProgressChunks ?? 3
        for (let i = 1; i <= chunks; i += 1) {
          const bytesSent = Math.round((totalBytes / chunks) * i)
          for (const listener of sshUploadProgressListeners) {
            listener({ uploadId: request.uploadId, bytesSent, totalBytes })
          }
        }
        if (options.sshUploadOk === false) {
          return { ok: false as const, error: options.sshUploadError ?? 'tar pipe broken (mock)' }
        }
        return { ok: true as const }
      },
      onUploadProgress: (callback: (payload: { uploadId: string; bytesSent: number; totalBytes: number }) => void) => {
        sshUploadProgressListeners.add(callback)
        return () => { sshUploadProgressListeners.delete(callback) }
      },
      startServer: async (request: {
        startId: string
        options: {
          sshHost: string
          sshUser: string
          sshPort?: number
          sshKeyPath?: string
          targetOS: 'ssh-linux' | 'ssh-darwin'
          installPath: string
          serverPort?: number
          serverHome: string
        }
      }) => {
        operationLog.sshStartCalls.push({
          startId: request.startId,
          sshHost: request.options.sshHost,
          targetOS: request.options.targetOS,
          serverPort: request.options.serverPort,
          serverHome: request.options.serverHome,
        })
        // Always emit phase progress so the step's onStartProgress wiring is
        // exercised in tests, regardless of success or failure outcome.
        for (const phase of ['writing-unit', 'enabling', 'starting', 'verifying'] as const) {
          for (const listener of sshStartProgressListeners) {
            listener({ startId: request.startId, phase })
          }
        }
        const next = sshStartSequence.shift()
        if (next) {
          if (next.ok) {
            return {
              ok: true,
              method: next.method,
              servicePath: next.servicePath,
              checkOutput: next.checkOutput,
            }
          }
          return {
            ok: false,
            method: 'failed' as const,
            servicePath: next.servicePath,
            error: next.error,
            errorCode: next.errorCode ?? 'unknown',
          }
        }
        const isLinux = request.options.targetOS === 'ssh-linux'
        return {
          ok: true,
          method: (isLinux ? 'systemd' : 'launchd') as 'systemd' | 'launchd',
          servicePath: isLinux
            ? `${request.options.serverHome}/.config/systemd/user/bat-server.service`
            : `${request.options.serverHome}/Library/LaunchAgents/com.bat-server.plist`,
          checkOutput: 'Active: active (running)',
        }
      },
      onStartProgress: (callback: (payload: { startId: string; phase: 'writing-unit' | 'enabling' | 'starting' | 'verifying' }) => void) => {
        sshStartProgressListeners.add(callback)
        return () => { sshStartProgressListeners.delete(callback) }
      },
      // T0289 PLAN-007 — best-effort rollback IPC mocks (always succeed unless
      // a future test wires a failure sequence in via options).
      uninstallBundle: async (request: {
        sshHost: string
        sshUser: string
        sshPort?: number
        sshKeyPath?: string
        installPath: string
      }) => {
        operationLog.sshUninstallCalls.push({
          sshHost: request.sshHost,
          sshUser: request.sshUser,
          installPath: request.installPath,
        })
        return { ok: true as const }
      },
      stopServer: async (request: {
        sshHost: string
        sshUser: string
        sshPort?: number
        sshKeyPath?: string
        targetOS: 'ssh-linux' | 'ssh-darwin'
        serverHome: string
      }) => {
        operationLog.sshStopServerCalls.push({
          sshHost: request.sshHost,
          sshUser: request.sshUser,
          targetOS: request.targetOS,
          serverHome: request.serverHome,
        })
        return { ok: true as const }
      },
      // T0682 (BUG-168 G4): T0387 verifies the remote server through an
      // `ssh -L` tunnel. Main hands out an OS-assigned local port; here it is
      // the harness serverPort (the test's HTTPS server) unless overridden.
      openVerifyTunnel: async (request: { sessionId: string; sshHost: string; sshUser: string; sshPort?: number; sshKeyPath?: string; remotePort: number }) => {
        operationLog.sshOpenTunnelCalls.push({
          sessionId: request.sessionId,
          sshHost: request.sshHost,
          sshUser: request.sshUser,
          remotePort: request.remotePort,
        })
        const localPort = options.sshVerifyTunnelLocalPort ?? serverPort
        verifyTunnelPorts.add(localPort)
        return { ok: true as const, localPort }
      },
      closeVerifyTunnel: async (sessionId: string) => {
        operationLog.sshCloseTunnelCalls.push(sessionId)
        return { ok: true as const }
      },
      verifyTunnelStatus: async (sessionId: string) => {
        operationLog.sshTunnelStatusCalls.push(sessionId)
        return options.sshForwardingDenied
          ? { forwardingDenied: true, detail: 'channel 2: open failed: administratively prohibited: open failed' }
          : { forwardingDenied: false, detail: null }
      },
      // The remote server-cert.json belongs to the server the handshake
      // reached, so by default it carries the same fingerprint.
      readServerIdentity: async (request: { sshHost: string; sshUser: string; sshPort?: number; sshKeyPath?: string; targetOS: 'ssh-linux' | 'ssh-darwin'; serverHome: string }) => {
        operationLog.sshReadIdentityCalls.push({ sshHost: request.sshHost, targetOS: request.targetOS, serverHome: request.serverHome })
        return options.sshServerIdentity ?? { ok: true as const, fingerprint: lastHandshakeFingerprint, token: remoteToken }
      },
    },
    remote: {
      testConnection: async (host: string, port: number) => {
        operationLog.remoteTestHosts.push({ host, port })
        if (options.remoteConnectionOk === false) {
          return {
            ok: false,
            error: 'Connection test failed',
            fingerprint: remoteFingerprint,
          }
        }

        return {
          ok: true,
          fingerprint: remoteFingerprint,
          metadata: {
            serverPlatform: remoteServerPlatform as 'linux' | 'darwin',
            serverArch: remoteServerArch as 'x64' | 'arm64',
            serverEnv: (options.remoteServerEnv ?? 'wsl') as 'wsl' | 'docker' | 'ssh',
            serverHome: options.remoteServerEnv === 'ssh' ? remoteServerHome : undefined,
            dockerMounts: options.remoteServerEnv === 'docker'
              ? (options.dockerRemoteMounts ?? [{ host: 'C:\\Users\\test\\project', container: '/workspace/project' }])
              : undefined,
            nodeVersion: '24.0.0',
            bundleVersion: '0.3.1',
          },
        }
      },
      // T0682 (BUG-168 G4): install-server-bundle gets its tarball from the
      // distributor (T0321); the harness serves the first bundle entry as a
      // cache hit, so nothing is downloaded and no progress is emitted.
      serverBundle: {
        distribute: async (distributeOptions: {
          profileId?: string
          draftProfile?: { targetOS: string; sshServerArch?: string } & Record<string, unknown>
          version?: string
        }) => {
          operationLog.bundleDistributeCalls.push({ draftProfile: distributeOptions.draftProfile, version: distributeOptions.version })
          const arch = distributeOptions.draftProfile?.targetOS === 'ssh-darwin'
            ? 'darwin-arm64' as const
            : (remoteServerArch === 'arm64' ? 'linux-arm64' as const : 'linux-x64' as const)
          return {
            ok: true as const,
            tarballPath: bundleEntries[0]?.path ?? '',
            sha256: '0'.repeat(64),
            sizeBytes: 1_500_000,
            source: options.bundleDistributeSource ?? ('cache' as const),
            arch,
          }
        },
        onDistributeProgress: (_callback: (event: { phase: 'manifest' | 'tarball'; bytesDownloaded: number; bytesTotal: number; percent: number }) => void) => () => {},
      },
    },
    docker: {
      status: async () => options.dockerAvailable === false
        ? { available: false as const, error: 'Docker daemon unavailable' }
        : { available: true as const, version: 'Docker version 27.0.0' },
      listContainers: async () => Array.from(dockerContainers.values()),
      inspectContainer: async (name: string) => {
        const container = dockerContainers.get(name)
        if (!container) {
          throw new Error(`Container not found: ${name}`)
        }
        return {
          id: container.id,
          name: container.name,
          image: container.image,
          state: { status: container.state, running: container.state === 'running', health: 'healthy' as const },
          mounts: options.dockerRemoteMounts?.map((mount) => ({ source: mount.host, destination: mount.container })) ?? [],
          ports: ['9876/tcp'],
          env: [],
        }
      },
      validateMounts: async () => options.dockerValidateErrors?.length
        ? { ok: false as const, errors: options.dockerValidateErrors }
        : { ok: true as const, errors: [] },
      startContainer: async (
        name: string,
        startOptions?: {
          createIfMissing?: boolean
          image?: string
          mounts?: Array<{ host: string; container: string }>
          port?: number
          restartPolicy?: string
          token?: string
          dataVolume?: string
        },
      ) => {
        operationLog.dockerStartCalls.push({
          name,
          createIfMissing: Boolean(startOptions?.createIfMissing),
          image: startOptions?.image,
          mounts: startOptions?.mounts,
          port: startOptions?.port,
          restartPolicy: startOptions?.restartPolicy,
          token: startOptions?.token,
          dataVolume: startOptions?.dataVolume,
        })
        if (options.dockerStartOk === false) {
          return { ok: false as const, error: options.dockerStartError ?? 'Docker image not found' }
        }
        if (startOptions?.createIfMissing) {
          dockerContainers.set(name, {
            id: `container-${name}`,
            name,
            image: startOptions.image ?? 'bat-server:latest',
            state: 'running',
            status: 'Up 1 second',
          })
        }
        return { ok: true as const, token: remoteToken }
      },
      // T0682 (BUG-168 G4): T0649 resolves the host port before start. A new
      // container gets the override / earlier pick / harness port; an existing
      // one keeps the port it publishes (inspectContainer reports 9876/tcp).
      pickServerPort: async (pickOptions?: { preferredPort?: number; previousPort?: number; container?: string }) => {
        operationLog.dockerPickPortCalls.push({ ...pickOptions })
        if (pickOptions?.container) {
          return { ok: true as const, port: serverPort, reusedExistingPort: true }
        }
        return { ok: true as const, port: pickOptions?.preferredPort ?? pickOptions?.previousPort ?? serverPort }
      },
      stopContainer: async (name: string, stopOptions?: { remove?: boolean }) => {
        operationLog.dockerStopCalls.push({ name, remove: stopOptions?.remove })
        if (stopOptions?.remove) dockerContainers.delete(name)
        return { ok: true as const }
      },
      removeContainer: async (name: string) => {
        operationLog.dockerRemoveCalls.push(name)
        dockerContainers.delete(name)
        return { ok: true as const }
      },
      restartContainer: async (name: string) => {
        operationLog.dockerRestartCalls.push(name)
        return { ok: true as const }
      },
      getContainerLogs: async (name: string, logOptions?: { tail?: number; follow?: boolean }) => {
        operationLog.dockerLogsCalls.push({ name, tail: logOptions?.tail, follow: logOptions?.follow })
        return { ok: true as const, logs: options.dockerLogs ?? 'container logs' }
      },
      getContainerHealth: async (name: string) => {
        operationLog.dockerHealthCalls.push(name)
        return { ok: true as const, health: dockerHealthSequence.shift() ?? 'healthy' }
      },
      // T0289 PLAN-007 — best-effort rollback for docker install-server-bundle
      // on existing containers. Records command verbatim so the cross-test can
      // assert `rm -rf <installPath>` shape.
      execCommand: async (name: string, command: string[]) => {
        operationLog.dockerExecCalls.push({ name, command: [...command] })
        return { ok: true as const }
      },
    },
    profile: {
      create: async (name: string, config?: Record<string, unknown>) => {
        const id = slugifyProfileId(name)
        const profile = {
          id,
          name,
          type: (config?.type as 'local' | 'remote' | undefined) ?? 'remote',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        profiles.set(id, { ...profile, ...config })
        operationLog.createdProfileIds.push(id)
        return profile
      },
      update: async (profileId: string, updates: Record<string, unknown>) => {
        if (options.profileUpdateOk === false) {
          return false
        }
        const current = profiles.get(profileId)
        if (!current) {
          return false
        }
        profiles.set(profileId, { ...current, ...updates, updatedAt: Date.now() })
        return true
      },
      delete: async (profileId: string) => {
        operationLog.deletedProfileIds.push(profileId)
        return profiles.delete(profileId)
      },
      listLocal: async () => ({
        profiles: Array.from(profiles.values()) as Array<Record<string, unknown>>,
        activeProfileIds: [],
      }),
      // T0291 PLAN-007 capstone — single-entry load lets migration tests
      // pre-seed legacy / current / unknown schema entries via the harness's
      // `profiles` map and assert load-time behavior without going through
      // the full createMockElectronApi flow. Returns null for unknown ids
      // (matches profile-manager.ts contract: "first run" / "deleted").
      load: async (profileId: string) => {
        const entry = profiles.get(profileId)
        return entry ? ({ ...entry } as Record<string, unknown>) : null
      },
    },
  }

  return {
    electronAPI,
    operationLog,
    profiles,
    createContext(profileName = ''): WizardContext {
      const ctx = createWslWizardContext({ profileName })
      ctx.serverPort = serverPort
      ctx.state.serverPort = serverPort
      return ctx
    },
    createDockerContext(profileName = ''): WizardContext {
      const ctx = createDockerWizardContext({ profileName })
      ctx.serverPort = serverPort
      ctx.state.serverPort = serverPort
      return ctx
    },
    createSshContext(profileName = '', initialState: Record<string, unknown> = {}): WizardContext {
      const ctx = createSshWizardContext({ profileName })
      ctx.serverPort = serverPort
      ctx.state.serverPort = serverPort
      // Pre-populate token + ctx fields so connect-test/write-profile can run
      // without requiring a live remote handshake.
      ctx.remoteToken = remoteToken
      // Tests can seed state.sshHost / sshUser / sshKeyPath / bundleTarballPath
      // / sshAlias here to skip step-level prompts.
      Object.assign(ctx.state, initialState)
      return ctx
    },
  }
}

export function installMockWindow(electronAPI: unknown): void {
  ;(globalThis as typeof globalThis & { window?: unknown }).window = { electronAPI }
}
