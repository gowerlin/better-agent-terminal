import type { ProfileEntry } from '../profile-manager'
import {
  containerToHost,
  hostToContainer,
  ownsDockerPath,
  type DockerMount,
} from '../../src/utils/docker-path'
import { winToWsl, wslToWin } from '../../src/utils/wsl-path'

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
    case 'ssh-darwin':
      throw new Error(
        `[PathTranslator] ${profile.targetOS} translator not implemented yet ` +
        `(pending T0282). Profile: ${profile.id}`,
      )

    default: {
      const _exhaustive: never = profile.targetOS
      throw new Error(`[PathTranslator] unknown targetOS: ${_exhaustive}`)
    }
  }
}
