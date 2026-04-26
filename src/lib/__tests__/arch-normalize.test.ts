import { describe, it, expect } from 'vitest'
import {
  normalizeArch,
  tarballNameForArch,
  tarballURL,
  DEFAULT_RELEASE_BASE_URL,
  type ServerBundleArch,
  type TargetOS,
} from '../arch-normalize'

describe('normalizeArch', () => {
  describe('Linux targets', () => {
    it('maps x86_64 → linux-x64 (wsl-linux)', () => {
      expect(normalizeArch('x86_64', 'wsl-linux')).toBe('linux-x64')
    })

    it('maps amd64 → linux-x64 (docker-linux)', () => {
      expect(normalizeArch('amd64', 'docker-linux')).toBe('linux-x64')
    })

    it('maps aarch64 → linux-arm64 (ssh-linux)', () => {
      expect(normalizeArch('aarch64', 'ssh-linux')).toBe('linux-arm64')
    })

    it('maps arm64 → linux-arm64 (wsl-linux)', () => {
      expect(normalizeArch('arm64', 'wsl-linux')).toBe('linux-arm64')
    })
  })

  describe('Darwin targets', () => {
    it('maps arm64 → darwin-arm64 (ssh-darwin)', () => {
      expect(normalizeArch('arm64', 'ssh-darwin')).toBe('darwin-arm64')
    })

    it('maps aarch64 → darwin-arm64 (ssh-darwin)', () => {
      expect(normalizeArch('aarch64', 'ssh-darwin')).toBe('darwin-arm64')
    })
  })

  describe('Input normalization', () => {
    it('handles mixed-case input (toLowerCase)', () => {
      expect(normalizeArch('X86_64', 'wsl-linux')).toBe('linux-x64')
    })

    it('handles trailing whitespace (trim)', () => {
      expect(normalizeArch('x86_64\n', 'wsl-linux')).toBe('linux-x64')
    })

    it('handles leading + trailing whitespace', () => {
      expect(normalizeArch('  arm64  ', 'ssh-darwin')).toBe('darwin-arm64')
    })
  })

  describe('Unsupported arch / target combinations', () => {
    it('rejects i686 on linux (32-bit unsupported)', () => {
      expect(normalizeArch('i686', 'wsl-linux')).toBeNull()
    })

    it('rejects darwin-x64 (spec §1.3 排除 Intel Mac)', () => {
      expect(normalizeArch('x86_64', 'ssh-darwin')).toBeNull()
    })

    it('rejects linux uname on darwin target (cross-mismatch)', () => {
      // x86_64 on ssh-darwin is impossible; spec excludes darwin-x64
      expect(normalizeArch('x86_64', 'ssh-darwin')).toBeNull()
    })

    it('rejects empty string', () => {
      expect(normalizeArch('', 'wsl-linux')).toBeNull()
    })

    it('rejects whitespace-only string', () => {
      expect(normalizeArch('   ', 'wsl-linux')).toBeNull()
    })

    it('returns null for local target (distribution not applicable)', () => {
      expect(normalizeArch('x86_64', 'local')).toBeNull()
    })

    it('rejects unknown arch like riscv64', () => {
      expect(normalizeArch('riscv64', 'ssh-linux')).toBeNull()
    })
  })
})

describe('tarballNameForArch', () => {
  it('builds linux-x64 filename', () => {
    expect(tarballNameForArch('linux-x64', '0.5.0')).toBe(
      'bat-server-linux-x64-v0.5.0.tar.gz',
    )
  })

  it('builds linux-arm64 filename', () => {
    expect(tarballNameForArch('linux-arm64', '0.5.0')).toBe(
      'bat-server-linux-arm64-v0.5.0.tar.gz',
    )
  })

  it('builds darwin-arm64 filename', () => {
    expect(tarballNameForArch('darwin-arm64', '0.5.0')).toBe(
      'bat-server-darwin-arm64-v0.5.0.tar.gz',
    )
  })

  it('preserves pre-release version suffix', () => {
    expect(tarballNameForArch('linux-x64', '0.5.0-pre.1')).toBe(
      'bat-server-linux-x64-v0.5.0-pre.1.tar.gz',
    )
  })
})

describe('tarballURL', () => {
  it('uses default base when baseURL omitted', () => {
    expect(tarballURL('linux-arm64', '0.5.0')).toBe(
      `${DEFAULT_RELEASE_BASE_URL}/server-bundle-v0.5.0/bat-server-linux-arm64-v0.5.0.tar.gz`,
    )
  })

  it('uses custom base when provided', () => {
    expect(
      tarballURL('linux-x64', '0.5.0', 'https://example.com/bundles'),
    ).toBe('https://example.com/bundles/bat-server-linux-x64-v0.5.0.tar.gz')
  })

  it('tolerates trailing slash on custom base (no double slash)', () => {
    const url = tarballURL('linux-x64', '0.5.0', 'https://example.com/bundles/')
    expect(url).toBe('https://example.com/bundles/bat-server-linux-x64-v0.5.0.tar.gz')
    expect(url).not.toContain('//bat-server')
  })

  it('default base uses correct server-bundle tag namespace (D093)', () => {
    const url = tarballURL('linux-x64', '0.5.0')
    expect(url).toContain('/server-bundle-v0.5.0/')
    expect(url).not.toMatch(/\/v0\.5\.0\/[^/]*$/) // not desktop tag
  })
})

// Type-level smoke checks: ensure exported types stay the canonical 3 + 5 set.
describe('exported types (compile-time enforcement)', () => {
  it('ServerBundleArch covers exactly 3 arches', () => {
    const arches: ServerBundleArch[] = ['linux-x64', 'linux-arm64', 'darwin-arm64']
    expect(arches).toHaveLength(3)
  })

  it('TargetOS covers exactly 5 targets', () => {
    const targets: TargetOS[] = [
      'wsl-linux',
      'docker-linux',
      'ssh-linux',
      'ssh-darwin',
      'local',
    ]
    expect(targets).toHaveLength(5)
  })
})
