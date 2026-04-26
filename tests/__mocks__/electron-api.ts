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
}

function slugifyProfileId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profile'
}

export function createMockElectronApi(options: MockOptions = {}) {
  const profiles = new Map<string, Record<string, unknown>>()
  const operationLog = {
    installCalls: [] as Array<{ distro: string; tarballPath: string; installPath: string }>,
    uninstallCalls: [] as Array<{ distro: string; installPath: string }>,
    removeUnitCalls: [] as string[],
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
    // T0287 SSH operation log
    sshProbeCalls: [] as Array<{ sshHost: string; sshUser: string; sshPort?: number; sshKeyPath?: string }>,
    sshUploadCalls: [] as Array<{ uploadId: string; sshHost: string; installPath: string; tarballPath: string }>,
    sshStartCalls: [] as Array<{ startId: string; sshHost: string; targetOS: string; serverPort?: number; serverHome: string }>,
    // T0289 PLAN-007 rollback IPC log (RFC C-3 best-effort cleanup hooks)
    sshUninstallCalls: [] as Array<{ sshHost: string; sshUser: string; installPath: string }>,
    sshStopServerCalls: [] as Array<{ sshHost: string; sshUser: string; targetOS: 'ssh-linux' | 'ssh-darwin'; serverHome: string }>,
    dockerExecCalls: [] as Array<{ name: string; command: string[] }>,
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
      detectNetworkMode: async () => options.networkMode ?? 'mirrored',
      installBundle: async (distro: string, tarballPath: string, installPath: string) => {
        operationLog.installCalls.push({ distro, tarballPath, installPath })
        return { ok: true as const }
      },
      uninstallBundle: async (distro: string, installPath: string) => {
        operationLog.uninstallCalls.push({ distro, installPath })
        return { ok: true as const }
      },
    },
    wslSystemd: {
      writeUnit: async () => ({ ok: true as const }),
      enableLinger: async () => ({ ok: true }),
      startService: async () => ({ ok: true as const, token: remoteToken }),
      removeUnit: async (_distro: string, serviceName: string) => {
        operationLog.removeUnitCalls.push(serviceName)
        return { ok: true as const }
      },
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
