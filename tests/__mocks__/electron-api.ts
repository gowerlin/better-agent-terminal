import type { WizardContext } from '../../src/components/setup-wizard/wizard-runner'
import { createDockerWizardContext } from '../../src/components/setup-wizard/docker-flow'
import { createWslWizardContext } from '../../src/components/setup-wizard/wsl-flow'

type NetworkMode = 'mirrored' | 'nat' | 'unknown'

interface MockOptions {
  distros?: Array<{ name: string; version: 1 | 2; state: 'Running' | 'Stopped' }>
  defaultDistro?: string | null
  systemdEnabled?: boolean
  networkMode?: NetworkMode
  remoteConnectionOk?: boolean
  remoteFingerprint?: string
  remoteToken?: string
  profileUpdateOk?: boolean
  serverPort?: number
  remoteServerEnv?: 'wsl' | 'docker'
  dockerRemoteMounts?: Array<{ host: string; container: string }>
  dockerAvailable?: boolean
  dockerContainers?: Array<{ id: string; name: string; image: string; state: string; status: string }>
  dockerSelectFolders?: string[] | null
  dockerValidateErrors?: string[]
  dockerHealthSequence?: Array<'healthy' | 'unhealthy' | 'starting' | 'none'>
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
    dockerStartCalls: [] as Array<{ name: string; createIfMissing: boolean; image?: string }>,
    dockerStopCalls: [] as Array<{ name: string; remove?: boolean }>,
    dockerRemoveCalls: [] as string[],
  }

  const distros = options.distros ?? [{ name: 'Ubuntu', version: 2 as const, state: 'Running' as const }]
  const defaultDistro = options.defaultDistro ?? distros[0]?.name ?? null
  const remoteFingerprint = options.remoteFingerprint ?? 'FP:AA:BB:CC'
  const remoteToken = options.remoteToken ?? 'secret-token'
  const serverPort = options.serverPort ?? 9876
  const dockerContainers = new Map((options.dockerContainers ?? []).map((container) => [container.name, { ...container }]))
  const dockerHealthSequence = [...(options.dockerHealthSequence ?? ['healthy'])]

  const electronAPI = {
    platform: 'win32' as const,
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
      readdir: async () => [
        {
          name: 'bat-server-linux-x64-v0.3.1.tar.gz',
          path: 'C:\\Users\\test\\AppData\\Roaming\\BAT\\bat-server-bundles\\bat-server-linux-x64-v0.3.1.tar.gz',
          isDirectory: false,
          pathKey: 'bundle',
        },
      ],
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
            serverPlatform: 'linux' as const,
            serverArch: 'x64' as const,
            serverEnv: (options.remoteServerEnv ?? 'wsl') as 'wsl' | 'docker',
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
      startContainer: async (name: string, startOptions?: { createIfMissing?: boolean; image?: string }) => {
        operationLog.dockerStartCalls.push({ name, createIfMissing: Boolean(startOptions?.createIfMissing), image: startOptions?.image })
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
      restartContainer: async () => ({ ok: true as const }),
      getContainerLogs: async () => ({ ok: true as const, logs: 'container logs' }),
      getContainerHealth: async () => ({ ok: true as const, health: dockerHealthSequence.shift() ?? 'healthy' }),
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
  }
}

export function installMockWindow(electronAPI: unknown): void {
  ;(globalThis as typeof globalThis & { window?: unknown }).window = { electronAPI }
}
