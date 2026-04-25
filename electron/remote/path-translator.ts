import type { ProfileEntry } from '../profile-manager'

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
      throw new Error(
        `[PathTranslator] wsl-linux translator not implemented yet ` +
        `(pending T0273). Profile: ${profile.id}`,
      )

    case 'docker-linux':
      throw new Error(
        `[PathTranslator] docker-linux translator not implemented yet ` +
        `(pending T0277). Profile: ${profile.id}`,
      )

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
