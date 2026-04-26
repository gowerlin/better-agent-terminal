// Remote server architecture detection (PLAN-031 / T0319).
//
// Dispatches `uname -m` over the right channel per profile.targetOS:
//   wsl-linux    → execFile('wsl', ['-d', distro, '--', 'uname', '-m'])
//   docker-linux → execFile('docker', ['exec', container, 'uname', '-m'])
//   ssh-linux    → read profile.sshServerArch (cached by verify-auth, no re-fetch)
//   ssh-darwin   → same as ssh-linux
//   local        → not applicable
//
// Security: pulls execFile from node:child_process and feeds args as an array
// so no shell is spawned. Distro/container names are also regex-validated
// before the call to fail fast on garbage input.

import * as childProcess from 'child_process'
import type { ProfileEntry } from '../profile-manager'
import {
  buildArchResult,
  type DetectArchResult,
} from '../../src/lib/arch-detect-result'

export type { DetectArchResult, DetectArchErrorCode } from '../../src/lib/arch-detect-result'

// Distro / container names: alphanumerics + dot/underscore/hyphen only.
// Tighter than docker's actual rules (which allow more) on purpose — we'd
// rather reject an exotic name than risk smuggling shell metacharacters
// through an upstream layer.
const NAME_RE = /^[a-zA-Z0-9._-]+$/

const EXEC_TIMEOUT_MS = 5000

interface ExecResult {
  stdout: string
  stderr: string
}

interface ExecError extends Error {
  code?: string | number
  stderr?: string
  stdout?: string
}

// Test seam: tests can swap the execFile impl. Mirrors the pattern used by
// electron/docker-detect.ts and electron/wsl-detect.ts.
type ExecFileLike = typeof childProcess.execFile
let execFileImpl: ExecFileLike = childProcess.execFile

export function setExecFileImplForTests(impl: ExecFileLike): void {
  execFileImpl = impl
}
export function resetExecFileImplForTests(): void {
  execFileImpl = childProcess.execFile
}

function runExecFile(file: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFileImpl(
      file,
      args,
      { encoding: 'utf8', timeout: EXEC_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const out = typeof stdout === 'string' ? stdout : (stdout?.toString?.() ?? '')
        const errOut = typeof stderr === 'string' ? stderr : (stderr?.toString?.() ?? '')
        if (error) {
          const e = error as ExecError
          e.stdout = out
          e.stderr = errOut
          reject(e)
          return
        }
        resolve({ stdout: out, stderr: errOut })
      },
    )
  })
}

export async function detectRemoteArch(profile: ProfileEntry): Promise<DetectArchResult> {
  const targetOS = profile.targetOS

  if (!targetOS) {
    return {
      ok: false,
      error:
        'Profile has no targetOS set; legacy remote profiles must be migrated before arch detection.',
      errorCode: 'no-state',
    }
  }

  if (targetOS === 'local') {
    return buildArchResult('', 'local')
  }

  if (targetOS === 'wsl-linux') {
    const distro = profile.wslDistro
    if (!distro) {
      return {
        ok: false,
        error: 'Profile is missing wslDistro field — finish WSL setup wizard first.',
        errorCode: 'no-state',
      }
    }
    if (!NAME_RE.test(distro)) {
      return {
        ok: false,
        error: `Invalid distro name "${distro}" (must match ${NAME_RE.source}).`,
        errorCode: 'detect-failed',
      }
    }
    try {
      const { stdout } = await runExecFile('wsl', ['-d', distro, '--', 'uname', '-m'])
      return buildArchResult(stdout, targetOS)
    } catch (err) {
      const e = err as ExecError
      if (e?.code === 'ENOENT') {
        return {
          ok: false,
          error: 'wsl.exe not found on PATH — install WSL or check %PATH%.',
          errorCode: 'remote-unreachable',
        }
      }
      const stderr = (e?.stderr ?? '').trim()
      const summary = (stderr || e?.message || 'unknown error').slice(0, 200)
      return {
        ok: false,
        error: `WSL detect failed for distro "${distro}": ${summary}`,
        errorCode: 'detect-failed',
      }
    }
  }

  if (targetOS === 'docker-linux') {
    const container = profile.dockerContainer
    if (!container) {
      return {
        ok: false,
        error: 'Profile is missing dockerContainer field — finish Docker setup wizard first.',
        errorCode: 'no-state',
      }
    }
    if (!NAME_RE.test(container)) {
      return {
        ok: false,
        error: `Invalid container name "${container}" (must match ${NAME_RE.source}).`,
        errorCode: 'detect-failed',
      }
    }
    try {
      const { stdout } = await runExecFile('docker', ['exec', container, 'uname', '-m'])
      return buildArchResult(stdout, targetOS)
    } catch (err) {
      const e = err as ExecError
      if (e?.code === 'ENOENT') {
        return {
          ok: false,
          error: 'docker not found on PATH — install Docker Desktop or check %PATH%.',
          errorCode: 'remote-unreachable',
        }
      }
      const stderr = (e?.stderr ?? '').trim()
      if (stderr.includes('Cannot connect to the Docker daemon')) {
        return {
          ok: false,
          error: 'Cannot connect to the Docker daemon — start Docker Desktop and retry.',
          errorCode: 'remote-unreachable',
        }
      }
      if (stderr.includes('No such container')) {
        return {
          ok: false,
          error: `Container "${container}" not found or not running — docker start ${container}.`,
          errorCode: 'remote-unreachable',
        }
      }
      const summary = (stderr || e?.message || 'unknown error').slice(0, 200)
      return {
        ok: false,
        error: `Docker detect failed for container "${container}": ${summary}`,
        errorCode: 'detect-failed',
      }
    }
  }

  if (targetOS === 'ssh-linux' || targetOS === 'ssh-darwin') {
    const cached = profile.sshServerArch
    if (!cached || cached.trim() === '') {
      return {
        ok: false,
        error:
          'SSH profile has no cached serverArch — run the verify-auth step in the SSH setup wizard first.',
        errorCode: 'no-state',
      }
    }
    return buildArchResult(cached, targetOS)
  }

  // Exhaustiveness fallback (should not be reachable given current TargetOS union).
  return {
    ok: false,
    error: `Unsupported targetOS: ${String(targetOS)}`,
    errorCode: 'no-state',
  }
}
