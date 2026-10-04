import type { ProfileEntry } from '../profile-manager'
import os from 'os'
import {
  containerToHost,
  hostToContainer,
  isValidMount,
  ownsDockerPath,
  startsWithPath,
  type DockerMount,
} from '../../src/utils/docker-path'
import { winToWsl, wslToWin } from '../../src/utils/wsl-path'
import {
  CLIENT_PATH_PURPOSES,
  type ClientPathUnreachableReason,
  type ResolvedClientPath,
} from '../../src/lib/client-paths'

export interface PathTranslator {
  /** Client-side absolute path -> server-side absolute path before IPC. */
  toServer(clientPath: string): string

  /** Server-side absolute path -> client-side absolute path after IPC. */
  toClient(serverPath: string): string

  /** Whether this translator claims ownership over a given path. */
  owns(path: string): boolean
}

export class IdentityTranslator implements PathTranslator {
  toServer(clientPath: string): string {
    return clientPath
  }

  toClient(serverPath: string): string {
    return serverPath
  }

  owns(_path: string): boolean {
    return true
  }
}

const WIN_DRIVE_PATTERN = /^[A-Za-z]:[\\/]/
const LONG_WIN_DRIVE_PATTERN = /^\\\\\?[\\][A-Za-z]:[\\/]/
const WSL_UNC_PREFIX_PATTERN = /^\\\\wsl(?:\$|\.localhost)\\([^\\]+)(?:\\|$)/i
const WSL_MOUNT_PATTERN = /^\/mnt\/[a-zA-Z](?:\/|$)/

export class WslPathTranslator implements PathTranslator {
  constructor(private readonly distro: string) {}

  toServer(clientPath: string): string {
    return winToWsl(clientPath, this.distro)
  }

  toClient(serverPath: string): string {
    return wslToWin(serverPath, this.distro)
  }

  owns(path: string): boolean {
    if (!path) {
      return false
    }

    if (WIN_DRIVE_PATTERN.test(path) || LONG_WIN_DRIVE_PATTERN.test(path) || WSL_MOUNT_PATTERN.test(path)) {
      return true
    }

    const uncMatch = path.match(WSL_UNC_PREFIX_PATTERN)
    if (uncMatch) {
      return uncMatch[1].toLowerCase() === this.distro.toLowerCase()
    }

    return path.startsWith('/')
  }
}

export class DockerPathTranslator implements PathTranslator {
  private readonly mounts: DockerMount[]

  constructor(mounts: DockerMount[]) {
    const invalid = mounts.find(m => !isValidMount(m))
    if (invalid) {
      throw new Error(
        `DockerPathTranslator: degenerate mount rejected ` +
        `(host=${JSON.stringify(invalid.host)}, container=${JSON.stringify(invalid.container)}); ` +
        `host/container must be non-empty and not root-only`,
      )
    }
    this.mounts = [...mounts].sort((a, b) => b.host.length - a.host.length)
  }

  toServer(clientPath: string): string {
    return hostToContainer(clientPath, this.mounts)
  }

  toClient(serverPath: string): string {
    return containerToHost(serverPath, this.mounts)
  }

  owns(path: string): boolean {
    return ownsDockerPath(path, this.mounts)
  }
}

const SSH_WIN_HOME_PATTERN = /^[A-Za-z]:[\\/]/

export class SshPathTranslator implements PathTranslator {
  constructor(
    private readonly clientHome: string,
    private readonly serverHome: string,
    private readonly clientIsWindows: boolean,
  ) {
    if (!clientHome || !serverHome) {
      throw new Error(
        `SshPathTranslator: clientHome / serverHome must be non-empty ` +
        `(clientHome=${JSON.stringify(clientHome)}, serverHome=${JSON.stringify(serverHome)})`,
      )
    }
  }

  toServer(clientPath: string): string {
    const normalizedPath = this.normalizeClient(clientPath)
    const normalizedHome = this.normalizeClient(this.clientHome)
    if (startsWithPath(normalizedPath, normalizedHome)) {
      const tail = normalizedPath.slice(normalizedHome.length)
      return this.serverHome + tail
    }
    return clientPath
  }

  toClient(serverPath: string): string {
    if (startsWithPath(serverPath, this.serverHome)) {
      const tail = serverPath.slice(this.serverHome.length)
      if (this.clientIsWindows) {
        return this.clientHome + tail.replace(/\//g, '\\')
      }
      return this.clientHome + tail
    }
    return serverPath
  }

  owns(path: string): boolean {
    return startsWithPath(this.normalizeClient(path), this.normalizeClient(this.clientHome))
      || startsWithPath(path, this.serverHome)
  }

  private normalizeClient(path: string): string {
    if (this.clientIsWindows && SSH_WIN_HOME_PATTERN.test(path)) {
      return path[0].toLowerCase() + path.slice(1).replace(/\\/g, '/')
    }
    return path
  }
}

export interface ContractFixture {
  name: string
  clientPath: string
  serverPath: string
  shouldOwn: boolean
}

export interface ContractHarness {
  suite(name: string, fn: () => void): void
  test(name: string, fn: () => void): void
}

export function runContract(
  translatorName: string,
  factory: () => PathTranslator,
  fixtures: ContractFixture[],
  harness: ContractHarness,
): void {
  harness.suite(`${translatorName} contract`, () => {
    for (const fixture of fixtures) {
      harness.test(`${fixture.name}: toServer`, () => {
        const translator = factory()
        const actual = translator.toServer(fixture.clientPath)
        if (actual !== fixture.serverPath) {
          throw new Error(
            `expected toServer(${JSON.stringify(fixture.clientPath)}) to equal ` +
            `${JSON.stringify(fixture.serverPath)}, got ${JSON.stringify(actual)}`,
          )
        }
      })

      harness.test(`${fixture.name}: toClient`, () => {
        const translator = factory()
        const actual = translator.toClient(fixture.serverPath)
        if (actual !== fixture.clientPath) {
          throw new Error(
            `expected toClient(${JSON.stringify(fixture.serverPath)}) to equal ` +
            `${JSON.stringify(fixture.clientPath)}, got ${JSON.stringify(actual)}`,
          )
        }
      })

      harness.test(`${fixture.name}: owns`, () => {
        const translator = factory()
        const actual = translator.owns(fixture.clientPath)
        if (actual !== fixture.shouldOwn) {
          throw new Error(
            `expected owns(${JSON.stringify(fixture.clientPath)}) to equal ` +
            `${String(fixture.shouldOwn)}, got ${String(actual)}`,
          )
        }
      })
    }
  })
}

/**
 * T0437 (BUG-105): can the window's host read each client path, and under which path?
 * Rules only — nothing is probed on the remote host (the headless fs sandbox denies
 * paths outside the workspace roots anyway, T0421 §2):
 *   - Identity (local window): always, unchanged
 *   - WSL: only what `owns()` claims (drives, this distro's UNC); another distro's UNC
 *     or a network share is not reachable
 *   - Docker: only inside a bind mount
 *   - SSH: a `local-file` never is (T0421 Q1: the home mapping is a workspace-path
 *     convention, not proof the remote has that file)
 * `workspace-entry` paths are server files in client form (from `toClient`), so `toServer`
 * maps them back on every translator. `translator === null` (no usable translator for a
 * remote window) rejects everything.
 */
export function resolveClientPaths(
  translator: PathTranslator | null,
  paths: unknown,
  purpose: unknown,
): ResolvedClientPath[] {
  if (!Array.isArray(paths)) throw new Error('remote:resolve-client-paths: paths must be an array')
  if (!(CLIENT_PATH_PURPOSES as readonly unknown[]).includes(purpose)) {
    throw new Error(`remote:resolve-client-paths: unknown purpose ${JSON.stringify(purpose)}`)
  }
  return paths.map((input): ResolvedClientPath => {
    if (typeof input !== 'string' || !input) return unreachable(typeof input === 'string' ? input : '', 'invalid-path')
    if (!translator) return unreachable(input, 'no-translator')
    if (purpose === 'workspace-entry' || translator instanceof IdentityTranslator) {
      return { input, serverPath: translator.toServer(input), reachable: true }
    }
    if (translator instanceof SshPathTranslator) return unreachable(input, 'ssh-local-file')
    if (!translator.owns(input)) {
      return unreachable(input, translator instanceof DockerPathTranslator ? 'outside-docker-mounts' : 'outside-wsl-distro')
    }
    return { input, serverPath: translator.toServer(input), reachable: true }
  })
}

function unreachable(input: string, reason: ClientPathUnreachableReason): ResolvedClientPath {
  return { input, serverPath: null, reachable: false, reason }
}

/**
 * T0437: the translator a remote-profile window's client paths resolve with. The live
 * connection's (`liveTranslator`, what proxied invokes use) when this window's profile
 * owns the connection, otherwise one built from the profile. A profile that needs a
 * mapping (WSL / Docker / SSH) but only has Identity (the RemoteClient fallback before
 * auth or for an incomplete profile) gets null: a client path must not pass as reachable
 * unchanged.
 */
export function clientPathTranslatorForProfile(
  profile: ProfileEntry,
  liveTranslator: PathTranslator | null,
): PathTranslator | null {
  let translator = liveTranslator
  if (!translator) {
    try {
      translator = createTranslator(profile)
    } catch {
      return null
    }
  }
  const needsMapping = profile.targetOS !== undefined && profile.targetOS !== 'local'
  return needsMapping && translator instanceof IdentityTranslator ? null : translator
}

export function createTranslator(profile: ProfileEntry): PathTranslator {
  switch (profile.targetOS) {
    case 'local':
    case undefined:
      return new IdentityTranslator()

    case 'wsl-linux':
      if (!profile.wslDistro) {
        throw new Error(`[PathTranslator] wsl-linux profile ${profile.id} missing wslDistro`)
      }
      return new WslPathTranslator(profile.wslDistro)

    case 'docker-linux':
      if (!profile.dockerMounts || profile.dockerMounts.length === 0) {
        throw new Error(`[PathTranslator] docker-linux profile ${profile.id} missing dockerMounts`)
      }
      return new DockerPathTranslator(profile.dockerMounts)

    case 'ssh-linux':
    case 'ssh-darwin': {
      if (!profile.serverHome) {
        throw new Error(
          `[PathTranslator] ${profile.targetOS} profile ${profile.id} missing serverHome ` +
          `(populated by first connect's auth-result frame)`,
        )
      }
      return new SshPathTranslator(
        os.homedir(),
        profile.serverHome,
        process.platform === 'win32',
      )
    }

    default: {
      const _exhaustive: never = profile.targetOS
      throw new Error(`[PathTranslator] unknown targetOS: ${_exhaustive}`)
    }
  }
}
