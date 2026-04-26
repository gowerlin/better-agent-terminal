// Pure helpers for remote arch detection result construction (PLAN-031 / T0319).
//
// Stays in src/lib/ so vitest can import without electron deps. The electron-side
// dispatcher (electron/remote/arch-detect.ts) imports buildArchResult to wrap
// raw uname output (or cached SSH serverArch) into a DetectArchResult uniformly.

import { normalizeArch, type ServerBundleArch, type TargetOS } from './arch-normalize'

export type DetectArchErrorCode =
  | 'unsupported-arch'
  | 'detect-failed'
  | 'remote-unreachable'
  | 'no-state'

export type DetectArchResult =
  | { ok: true; arch: ServerBundleArch; rawUname: string }
  | { ok: false; error: string; errorCode: DetectArchErrorCode }

/**
 * Wrap raw `uname -m` output (or cached SSH serverArch) into a DetectArchResult.
 *
 * Behavior:
 *   - targetOS === 'local'   → 'no-state' (server bundle distribution n/a)
 *   - normalizeArch null     → 'unsupported-arch' with actionable message containing rawUname
 *   - normalizeArch ok       → { ok: true, arch, rawUname: trimmed }
 *
 * Pure function: no IO, no env reads, no exec. Safe to test in isolation.
 */
export function buildArchResult(rawUname: string, targetOS: TargetOS): DetectArchResult {
  if (targetOS === 'local') {
    return {
      ok: false,
      error: 'Local profile does not require remote arch detection',
      errorCode: 'no-state',
    }
  }
  const trimmed = rawUname.trim()
  const arch = normalizeArch(trimmed, targetOS)
  if (arch === null) {
    return {
      ok: false,
      error:
        `Server architecture "${trimmed}" is not supported. ` +
        'Supported: linux-x64 (x86_64), linux-arm64 (aarch64), darwin-arm64 (arm64 macOS).',
      errorCode: 'unsupported-arch',
    }
  }
  return { ok: true, arch, rawUname: trimmed }
}
