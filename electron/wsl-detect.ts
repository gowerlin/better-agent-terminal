import * as childProcess from 'child_process'
import path from 'path'
import { winToWsl } from '../src/utils/wsl-path'
import { assertValidDistro, assertValidUnixPath } from './wsl-validate'

export interface WslDistro {
  name: string
  version: 1 | 2
  state: 'Running' | 'Stopped'
}

export type WslNetworkMode = 'mirrored' | 'nat' | 'unknown'

interface ExecResult {
  stdout: Buffer
  stderr: Buffer
}

let execFileImpl: (...args: any[]) => unknown = childProcess.execFile

export function setExecFileImplForTests(execFile: (...args: any[]) => unknown): void {
  execFileImpl = execFile
}

export function resetExecFileImplForTests(): void {
  execFileImpl = childProcess.execFile
}

// T0378: bounded probes (WSL cold start of a stopped distro can take seconds).
const PROBE_TIMEOUT_MS = 15_000
// T0378 (BUG-087 B): the distro user's $HOME must be a plain absolute path so
// it can be written verbatim into the systemd unit (systemd never expands `~`).
const HOME_PATH_PATTERN = /^\/[A-Za-z0-9._/-]*$/

function execFileBuffered(file: string, args: string[], options?: { timeoutMs?: number }): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFileImpl(
      file,
      args,
      {
        encoding: 'buffer',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        ...(options?.timeoutMs ? { timeout: options.timeoutMs } : {}),
      },
      (error: Error | null, stdout: Buffer | string, stderr: Buffer | string) => {
        const out = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? '')
        const err = Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? '')
        if (error) {
          ;(error as Error & { stdout?: Buffer; stderr?: Buffer }).stdout = out
          ;(error as Error & { stdout?: Buffer; stderr?: Buffer }).stderr = err
          reject(error)
          return
        }
        resolve({ stdout: out, stderr: err })
      },
    )
  })
}

function decodeUtf16leOutput(buffer: Buffer): string {
  const text = buffer.toString('utf16le')
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function normalizeTextOutput(buffer: Buffer): string {
  const hasUtf16Bom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe
  const looksUtf16 = hasUtf16Bom || buffer.some((byte, index) => index % 2 === 1 && byte === 0)
  if (looksUtf16) {
    return decodeUtf16leOutput(buffer).replace(/\0/g, '').trim()
  }
  return buffer.toString('utf8').replace(/\0/g, '').trim()
}

export function parseWslListOutput(buffer: Buffer): { distros: WslDistro[]; default: string | null } {
  const text = decodeUtf16leOutput(buffer)
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  const distros: WslDistro[] = []
  let defaultDistro: string | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimStart()
    if (line.startsWith('NAME') || line.startsWith('\u0000NAME')) {
      continue
    }

    const match = line.match(/^(\*)?\s*([^\s].*?)\s{2,}(Running|Stopped)\s{2,}([12])$/)
    if (!match) {
      continue
    }

    const [, marker, name, state, version] = match
    if (marker === '*') {
      defaultDistro = name.trim()
    }

    distros.push({
      name: name.trim(),
      state: state as WslDistro['state'],
      version: Number(version) as 1 | 2,
    })
  }

  return { distros, default: defaultDistro }
}

export function validateDistroName(distro: string): string {
  assertValidDistro(distro)
  return distro
}

export function validateInstallPath(installPath: string): string {
  assertValidUnixPath(installPath, true)
  return installPath
}

export function validateWindowsAbsolutePath(filePath: string): string {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`Expected absolute Windows path: ${filePath}`)
  }
  return filePath
}

async function runWsl(
  distro: string,
  command: string[],
  options?: { allowFailure?: boolean; timeoutMs?: number },
): Promise<ExecResult> {
  const validatedDistro = validateDistroName(distro)
  try {
    return await execFileBuffered('wsl', ['-d', validatedDistro, '--', ...command], { timeoutMs: options?.timeoutMs })
  } catch (error) {
    if (options?.allowFailure) {
      const execError = error as Error & { stdout?: Buffer; stderr?: Buffer }
      return {
        stdout: execError.stdout ?? Buffer.alloc(0),
        stderr: execError.stderr ?? Buffer.alloc(0),
      }
    }
    throw error
  }
}

async function exitsZero(args: string[]): Promise<boolean> {
  try {
    await execFileBuffered('wsl', args, { timeoutMs: PROBE_TIMEOUT_MS })
    return true
  } catch {
    return false
  }
}

/**
 * T0378 (BUG-086): `wsl -l -v` exits non-zero both when WSL is missing and
 * when WSL is installed but no distro is registered yet. Tell the two apart by
 * exit code only — wsl.exe output is UTF-16LE and localized, so never match
 * its text. Either `wsl --status` or `wsl --version` exiting 0 means WSL
 * itself is present.
 */
export async function isWslInstalled(): Promise<boolean> {
  if (await exitsZero(['--status'])) return true
  return exitsZero(['--version'])
}

/**
 * Three states:
 *  - WSL missing                      -> throws (original `wsl -l -v` error)
 *  - WSL installed, no distro         -> `{ distros: [], default: null }`
 *  - WSL installed with distro(s)     -> parsed list
 */
export async function list(): Promise<{ distros: WslDistro[]; default: string | null }> {
  try {
    const { stdout } = await execFileBuffered('wsl', ['-l', '-v'])
    return parseWslListOutput(stdout)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT' && await isWslInstalled()) {
      return { distros: [], default: null }
    }
    throw error
  }
}

/**
 * T0378 (BUG-087 B): absolute $HOME of the distro's default user, e.g.
 * `/home/gower`. Fixed command, no interpolated input.
 */
export async function resolveHome(distro: string): Promise<string> {
  const validatedDistro = validateDistroName(distro)
  const { stdout } = await runWsl(validatedDistro, ['printenv', 'HOME'], { timeoutMs: PROBE_TIMEOUT_MS })
  const home = normalizeTextOutput(stdout).replace(/\/+$/, '')
  if (!home || !HOME_PATH_PATTERN.test(home) || home.includes('..')) {
    throw new Error(`Unable to resolve an absolute home directory in WSL distro ${validatedDistro}: ${JSON.stringify(home)}`)
  }
  assertValidUnixPath(home, false)
  return home
}

export async function systemdEnabled(distro: string): Promise<boolean> {
  const validatedDistro = validateDistroName(distro)
  const systemctlResult = await runWsl(
    validatedDistro,
    ['systemctl', '--user', 'is-system-running'],
    { allowFailure: true },
  )
  const systemctlText = normalizeTextOutput(systemctlResult.stdout)
  if (systemctlText.includes('running')) {
    return true
  }

  const confResult = await runWsl(validatedDistro, ['cat', '/etc/wsl.conf'], { allowFailure: true })
  const confText = normalizeTextOutput(confResult.stdout)
  return /^\s*systemd\s*=\s*true\s*$/im.test(confText)
}

export async function detectNetworkMode(distro: string): Promise<WslNetworkMode> {
  const validatedDistro = validateDistroName(distro)
  const routeResult = await runWsl(validatedDistro, ['ip', 'route', 'show', 'default'], { allowFailure: true })
  const routeText = normalizeTextOutput(routeResult.stdout)
  const routeLower = routeText.toLowerCase()
  if (!routeLower) {
    return 'unknown'
  }

  // Best-effort heuristic:
  // - a default route with an explicit gateway is typically WSL NAT
  // - a direct default route (no "via") is typically mirrored mode
  if (routeLower.includes(' via ')) {
    return 'nat'
  }
  if (routeLower.includes(' dev ')) {
    return 'mirrored'
  }
  return 'unknown'
}

export async function installBundle(
  distro: string,
  tarballPath: string,
  installPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const validatedDistro = validateDistroName(distro)
    const validatedInstallPath = validateInstallPath(installPath)
    const validatedTarballPath = validateWindowsAbsolutePath(tarballPath)
    const tarballWslPath = winToWsl(validatedTarballPath, validatedDistro)

    await runWsl(validatedDistro, ['mkdir', '-p', validatedInstallPath])
    await runWsl(validatedDistro, [
      'tar',
      '-xzf',
      tarballWslPath,
      '-C',
      validatedInstallPath,
      '--strip-components=1',
    ])

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function uninstallBundle(distro: string, installPath: string): Promise<void> {
  const validatedDistro = validateDistroName(distro)
  const validatedInstallPath = validateInstallPath(installPath)
  await runWsl(validatedDistro, ['rm', '-rf', validatedInstallPath])
}
