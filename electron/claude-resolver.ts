/**
 * System `claude` binary detection + version parsing + health probe.
 *
 * PLAN-027 Phase 1 #1 (T0230) — provides infrastructure for the system/embedded
 * runtime selection feature without touching the agent-manager spawn sites
 * (T0231 / #2 owns the routing change).
 *
 * Detection strategy (T0229 R2, updated by T0235 for BUG-053):
 *   1. customPath override → health probe only (user owns path choice)
 *   2. PATH env scan (cross-platform; Windows scans `.exe` only, no shims)
 *   3. Platform-specific common locations fallback
 *
 * Health probe (T0229 R3 Level B):
 *   spawn(binary, ['--version'], 5s timeout) → parse `X.Y.Z (Claude Code)`
 *   → semver compat: >= 2.1.111 healthy / >= 2.0.0 warning / older too-old.
 */

import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type ClaudeHealthStatus =
  | 'healthy'           // >= 2.1.111 (full feature parity with embedded)
  | 'version-warning'   // >= 2.0.0 < 2.1.111 (SDK loads, but no Opus 4.7 / xhigh)
  | 'version-too-old'   // < 2.0.0 (SDK may reject)
  | 'spawn-failed'      // ENOENT / timeout / parse failure

export type ClaudeRuntimeSource = 'path' | 'common-location' | 'custom'

export interface ClaudeRuntimeInfo {
  path: string
  version: string
  versionRaw: string
  healthStatus: ClaudeHealthStatus
  source: ClaudeRuntimeSource
}

export interface ClaudeHealthProbeResult {
  version: string
  versionRaw: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const HOME = process.env.HOME || process.env.USERPROFILE || ''
const HEALTHY_MIN = '2.1.111'
const TOO_OLD_MAX = '2.0.0'
const PROBE_TIMEOUT_MS = 5000

// Regex anchored at start; captures `X.Y.Z` or `X.Y.Z-prerelease`
const VERSION_REGEX = /^(\d+\.\d+\.\d+(?:-[\w.]+)?)\s+\(Claude Code\)/

// ----------------------------------------------------------------------------
// Version helpers
// ----------------------------------------------------------------------------

/**
 * Compare two semver strings (ignoring prerelease tags).
 * Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('-')[0].split('.').map(Number)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function classifyVersion(version: string): ClaudeHealthStatus {
  if (compareSemver(version, HEALTHY_MIN) >= 0) return 'healthy'
  if (compareSemver(version, TOO_OLD_MAX) >= 0) return 'version-warning'
  return 'version-too-old'
}

// ----------------------------------------------------------------------------
// PATH / fallback discovery
// ----------------------------------------------------------------------------

/**
 * Windows binary names for PATH / common-location scans.
 *
 * BUG-053 (T0235): scans now only accept `claude.exe` (native binary).
 * `.cmd` / `.bat` shims are no longer auto-detected:
 *   - Node 20+ spawn() refuses `.cmd` shims by default (CVE-2024-27980 EINVAL).
 *   - claude v2.x ships a native `.exe` through the anthropic installer and
 *     `app.asar.unpacked/.../bin/claude.exe`; no shim is needed.
 *   - Legacy `npm install -g` users can still point `customPath` at the `.exe`
 *     inside `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\`.
 *
 * customPath is user-owned and may point at an `.exe`, but callers must pass
 * it through `isSafeClaudeCustomPath()` before using it in shell-rendered flows.
 */
const WINDOWS_BIN_NAMES = ['claude.exe'] as const
const UNIX_BIN_NAMES = ['claude'] as const

function getBinaryNames(): readonly string[] {
  return process.platform === 'win32' ? WINDOWS_BIN_NAMES : UNIX_BIN_NAMES
}

function isAbsoluteClaudeCustomPath(candidate: string): boolean {
  return (
    candidate.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(candidate) ||
    /^\\\\[^\\/]+\\[^\\/]+/.test(candidate)
  )
}

export function isSafeClaudeCustomPath(candidate: string): boolean {
  if (!candidate || candidate.length > 4096) return false
  if (/[\x00-\x1F\x7F]/.test(candidate)) return false
  if (!isAbsoluteClaudeCustomPath(candidate)) return false
  return /^[A-Za-z0-9 ._\-:()+/\\@]+$/.test(candidate)
}

/**
 * Scan process.env.PATH for a claude binary.
 * On Windows, prefer `.exe` over `.cmd` / `.bat` even if both exist in the same dir.
 */
function findClaudeInPath(): string | null {
  const rawPath = process.env.PATH
  if (!rawPath) return null
  const dirs = rawPath.split(path.delimiter).filter(Boolean)
  const names = getBinaryNames()
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name)
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate
        }
      } catch { /* skip permission / FS errors */ }
    }
  }
  return null
}

interface CommonCandidate {
  dir: string
}

function getCommonLocations(): CommonCandidate[] {
  if (process.platform === 'darwin') {
    return [
      { dir: '/opt/homebrew/bin' },
      { dir: '/usr/local/bin' },
      { dir: path.join(HOME, '.local', 'bin') },
      { dir: path.join(HOME, '.claude', 'local') },
    ]
  }
  if (process.platform === 'linux') {
    return [
      { dir: path.join(HOME, '.local', 'bin') },
      { dir: '/usr/local/bin' },
      { dir: '/usr/bin' },
      { dir: path.join(HOME, '.claude', 'local') },
    ]
  }
  // Windows — anthropic installer locations
  const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local')
  return [
    { dir: path.join(LOCALAPPDATA, 'Programs', 'claude-code') },
    { dir: path.join(HOME, '.claude', 'local') },
    { dir: path.join(HOME, 'AppData', 'Roaming', 'npm') },
  ]
}

function findClaudeInCommonLocations(): string | null {
  const names = getBinaryNames()
  for (const { dir } of getCommonLocations()) {
    for (const name of names) {
      const candidate = path.join(dir, name)
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate
        }
      } catch { /* skip */ }
    }
  }
  return null
}

// ----------------------------------------------------------------------------
// Health probe
// ----------------------------------------------------------------------------

/**
 * Spawn `<binary> --version` with a 5s timeout and parse the output.
 * Returns null on any failure (spawn error, non-zero exit, timeout, parse miss).
 */
export function probeClaudeHealth(binaryPath: string): Promise<ClaudeHealthProbeResult | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: ClaudeHealthProbeResult | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(binaryPath, ['--version'], {
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
      })
    } catch {
      finish(null)
      return
    }

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

    child.on('error', () => finish(null))

    child.on('close', (code) => {
      // Accept exit 0; some shims may write to stderr, fall back to it
      const raw = (stdout || stderr || '').trim()
      if (code !== 0 && !raw) {
        finish(null)
        return
      }
      const match = raw.match(VERSION_REGEX)
      if (!match) {
        finish(null)
        return
      }
      finish({ version: match[1], versionRaw: raw })
    })
  })
}

// ----------------------------------------------------------------------------
// Top-level detection
// ----------------------------------------------------------------------------

/**
 * Detect a usable system `claude` binary and probe its health.
 *
 * Returns null only when no candidate is found at all. When a candidate is
 * found but the health probe fails, returns an entry with `healthStatus:
 * 'spawn-failed'` so callers can surface a meaningful error.
 */
export async function detectSystemClaude(customPath?: string): Promise<ClaudeRuntimeInfo | null> {
  let binaryPath: string | null = null
  let source: ClaudeRuntimeSource = 'path'

  if (customPath && customPath.trim()) {
    const trimmed = customPath.trim()
    try {
      if (!fs.existsSync(trimmed) || !fs.statSync(trimmed).isFile()) return null
    } catch {
      return null
    }
    binaryPath = trimmed
    source = 'custom'
  } else {
    binaryPath = findClaudeInPath()
    if (binaryPath) {
      source = 'path'
    } else {
      binaryPath = findClaudeInCommonLocations()
      if (binaryPath) source = 'common-location'
    }
  }

  if (!binaryPath) return null

  const probe = await probeClaudeHealth(binaryPath)
  if (!probe) {
    return {
      path: binaryPath,
      version: '',
      versionRaw: '',
      healthStatus: 'spawn-failed',
      source,
    }
  }

  return {
    path: binaryPath,
    version: probe.version,
    versionRaw: probe.versionRaw,
    healthStatus: classifyVersion(probe.version),
    source,
  }
}

// ----------------------------------------------------------------------------
// Test-only exports
// ----------------------------------------------------------------------------

export const __test__ = {
  compareSemver,
  classifyVersion,
  isAbsoluteClaudeCustomPath,
  VERSION_REGEX,
}
