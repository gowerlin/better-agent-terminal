import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

export type GhResolveSource = 'custom' | 'path' | 'common-location' | 'where'

export interface GhResolveResult {
  found: boolean
  path?: string
  source?: GhResolveSource
  attemptedPaths: string[]
  error?: string
}

export interface GhResolveOptions {
  customPath?: string
}

const RESOLVE_TIMEOUT_MS = 3000
const WINDOWS_BIN_NAMES = ['gh.exe'] as const
const UNIX_BIN_NAMES = ['gh'] as const

function getHome(): string {
  return process.env.HOME || process.env.USERPROFILE || ''
}

function getBinaryNames(): readonly string[] {
  return process.platform === 'win32' ? WINDOWS_BIN_NAMES : UNIX_BIN_NAMES
}

function pushAttempt(attemptedPaths: string[], candidate: string): void {
  if (candidate && !attemptedPaths.includes(candidate)) {
    attemptedPaths.push(candidate)
  }
}

function isAbsolutePathLike(candidate: string): boolean {
  return path.isAbsolute(candidate) || /^[a-zA-Z]:[\\/]/.test(candidate)
}

function isSafeCustomPath(candidate: string): boolean {
  if (!candidate || !isAbsolutePathLike(candidate)) return false
  return /^[\w\s.():+\-\\/@]+$/.test(candidate)
}

function isExecutableFile(candidate: string): boolean {
  try {
    return (
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile() &&
      fs.accessSync(candidate, fs.constants.X_OK) === undefined
    )
  } catch {
    return false
  }
}

function scanPath(attemptedPaths: string[]): string | null {
  const rawPath = process.env.PATH
  if (!rawPath) return null

  for (const dir of rawPath.split(path.delimiter).filter(Boolean)) {
    for (const name of getBinaryNames()) {
      const candidate = path.join(dir, name)
      pushAttempt(attemptedPaths, candidate)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

function getCommonLocations(): string[] {
  const home = getHome()
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || (home ? path.join(home, 'AppData', 'Local') : '')
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    return [
      path.join(programFiles, 'GitHub CLI', 'gh.exe'),
      localAppData ? path.join(localAppData, 'Programs', 'GitHub CLI', 'gh.exe') : '',
      path.join(programFilesX86, 'GitHub CLI', 'gh.exe'),
    ].filter(Boolean)
  }
  if (process.platform === 'darwin') {
    return [
      '/usr/local/bin/gh',
      '/opt/homebrew/bin/gh',
      home ? path.join(home, '.local', 'bin', 'gh') : '',
    ].filter(Boolean)
  }
  return [
    '/usr/local/bin/gh',
    '/usr/bin/gh',
    home ? path.join(home, '.local', 'bin', 'gh') : '',
  ].filter(Boolean)
}

function scanCommonLocations(attemptedPaths: string[]): string | null {
  for (const candidate of getCommonLocations()) {
    pushAttempt(attemptedPaths, candidate)
    if (isExecutableFile(candidate)) return candidate
  }
  return null
}

function scanWhere(attemptedPaths: string[]): string | null {
  const command = process.platform === 'win32' ? 'where.exe' : 'which'
  try {
    const raw = execFileSync(command, ['gh'], {
      encoding: 'utf-8',
      timeout: RESOLVE_TIMEOUT_MS,
      windowsHide: true,
    })
    const candidates = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    for (const candidate of candidates) {
      pushAttempt(attemptedPaths, candidate)
      if (isExecutableFile(candidate)) return candidate
    }
  } catch {
    // where/which is the final fallback; ignore lookup failures.
  }
  return null
}

export async function resolveGhBinary(opts?: GhResolveOptions): Promise<GhResolveResult> {
  const attemptedPaths: string[] = []
  const customPath = opts?.customPath?.trim()

  if (customPath) {
    pushAttempt(attemptedPaths, customPath)
    if (!isSafeCustomPath(customPath)) {
      return {
        found: false,
        attemptedPaths,
        error: 'Custom gh path must be an absolute executable path without shell metacharacters.',
      }
    }
    if (isExecutableFile(customPath)) {
      return { found: true, path: customPath, source: 'custom', attemptedPaths }
    }
  }

  const pathHit = scanPath(attemptedPaths)
  if (pathHit) return { found: true, path: pathHit, source: 'path', attemptedPaths }

  const commonHit = scanCommonLocations(attemptedPaths)
  if (commonHit) return { found: true, path: commonHit, source: 'common-location', attemptedPaths }

  const whereHit = scanWhere(attemptedPaths)
  if (whereHit) return { found: true, path: whereHit, source: 'where', attemptedPaths }

  return {
    found: false,
    attemptedPaths,
    error: customPath ? 'Custom gh path was not usable and gh was not found automatically.' : 'GitHub CLI executable was not found.',
  }
}

export const __test__ = {
  isSafeCustomPath,
  isExecutableFile,
  getCommonLocations,
}
