// PLAN-031 / T0319 — pure helper tests for buildArchResult.
//
// We only test the pure wrapper here. The exec-based detectRemoteArch dispatch
// (electron/remote/arch-detect.ts) is exercised by integration smoke at runtime;
// over-mocking child_process here would buy noise rather than confidence.

import { describe, it, expect } from 'vitest'
import { buildArchResult, type DetectArchResult } from '../arch-detect-result'

function expectOk(
  result: DetectArchResult,
  arch: 'linux-x64' | 'linux-arm64' | 'darwin-arm64',
  rawUname: string,
): void {
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.arch).toBe(arch)
    expect(result.rawUname).toBe(rawUname)
  }
}

function expectError(
  result: DetectArchResult,
  errorCode: 'unsupported-arch' | 'detect-failed' | 'remote-unreachable' | 'no-state',
  errorContains?: string,
): void {
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.errorCode).toBe(errorCode)
    if (errorContains) {
      expect(result.error).toContain(errorContains)
    }
  }
}

describe('buildArchResult — happy paths', () => {
  it('WSL x86_64 → linux-x64', () => {
    expectOk(buildArchResult('x86_64', 'wsl-linux'), 'linux-x64', 'x86_64')
  })

  it('WSL aarch64 → linux-arm64', () => {
    expectOk(buildArchResult('aarch64', 'wsl-linux'), 'linux-arm64', 'aarch64')
  })

  it('Docker amd64 → linux-x64', () => {
    expectOk(buildArchResult('amd64', 'docker-linux'), 'linux-x64', 'amd64')
  })

  it('Docker arm64 → linux-arm64', () => {
    expectOk(buildArchResult('arm64', 'docker-linux'), 'linux-arm64', 'arm64')
  })

  it('SSH linux x86_64 → linux-x64', () => {
    expectOk(buildArchResult('x86_64', 'ssh-linux'), 'linux-x64', 'x86_64')
  })

  it('SSH darwin arm64 → darwin-arm64', () => {
    expectOk(buildArchResult('arm64', 'ssh-darwin'), 'darwin-arm64', 'arm64')
  })

  it('trims surrounding whitespace before normalize', () => {
    expectOk(buildArchResult('  x86_64\n', 'wsl-linux'), 'linux-x64', 'x86_64')
  })
})

describe('buildArchResult — unsupported-arch', () => {
  it('WSL i686 (32-bit) → unsupported-arch with raw uname in message', () => {
    const result = buildArchResult('i686', 'wsl-linux')
    expectError(result, 'unsupported-arch', 'i686')
    if (!result.ok) {
      expect(result.error).toContain('linux-x64')
      expect(result.error).toContain('linux-arm64')
      expect(result.error).toContain('darwin-arm64')
    }
  })

  it('empty rawUname for non-local target → unsupported-arch', () => {
    expectError(buildArchResult('', 'wsl-linux'), 'unsupported-arch')
  })

  it('multi-line noise input → unsupported-arch (full string is rejected as one token)', () => {
    expectError(
      buildArchResult('Linux 5.15.0\nx86_64', 'wsl-linux'),
      'unsupported-arch',
      'Linux 5.15.0',
    )
  })

  it('SSH-darwin with x86_64 → unsupported-arch (Intel Mac SSH server excluded by spec §1.3)', () => {
    expectError(buildArchResult('x86_64', 'ssh-darwin'), 'unsupported-arch', 'x86_64')
  })

  it('Docker-linux with i686 → unsupported-arch', () => {
    expectError(buildArchResult('i686', 'docker-linux'), 'unsupported-arch', 'i686')
  })
})

describe('buildArchResult — local target', () => {
  it('local target always returns no-state regardless of rawUname', () => {
    expectError(buildArchResult('x86_64', 'local'), 'no-state', 'Local profile')
    expectError(buildArchResult('', 'local'), 'no-state', 'Local profile')
  })
})
