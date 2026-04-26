import * as childProcess from 'child_process'
import path from 'path'
import { winToWsl } from '../src/utils/wsl-path'

export interface WslDistro {
  name: string
  version: 1 | 2
  state: 'Running' | 'Stopped'
}

interface ExecResult {
  stdout: Buffer
  stderr: Buffer
}

const DISTRO_NAME_PATTERN = /^[A-Za-z0-9._-]+$/
const INSTALL_PATH_PATTERN = /^(?:~\/|\/)(?!.*\.\.)(?!.*[;|&$`]).+$/
let execFileImpl: (...args: any[]) => unknown = childProcess.execFile

export function setExecFileImplForTests(execFile: (...args: any[]) => unknown): void {
  execFileImpl = execFile
}

export function resetExecFileImplForTests(): void {
  execFileImpl = childProcess.execFile
}

function execFileBuffered(file: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFileImpl(
      file,
      args,
      {
        encoding: 'buffer',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
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
  if (!DISTRO_NAME_PATTERN.test(distro)) {
    throw new Error(`Invalid WSL distro name: ${distro}`)
  }
  return distro
}

export function validateInstallPath(installPath: string): string {
  if (!INSTALL_PATH_PATTERN.test(installPath)) {
    throw new Error(`Invalid install path: ${installPath}`)
  }
  return installPath
}

export function validateWindowsAbsolutePath(filePath: string): string {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`Expected absolute Windows path: ${filePath}`)
  }
  return filePath
}

async function runWsl(distro: string, command: string[], options?: { allowFailure?: boolean }): Promise<ExecResult> {
  const validatedDistro = validateDistroName(distro)
  try {
    return await execFileBuffered('wsl', ['-d', validatedDistro, '--', ...command])
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

export async function list(): Promise<{ distros: WslDistro[]; default: string | null }> {
  const { stdout } = await execFileBuffered('wsl', ['-l', '-v'])
  return parseWslListOutput(stdout)
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
