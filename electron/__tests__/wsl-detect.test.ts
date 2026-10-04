/**
 * T0378 (BUG-086 / BUG-087 B): wsl-detect three-state WSL detection and
 * $HOME resolution. execFile is injected — no real wsl.exe is spawned.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  detectNetworkMode,
  list,
  parseWslConfigNetworkingMode,
  parseWslinfoNetworkingMode,
  readDeclaredNetworkMode,
  resetExecFileImplForTests,
  resolveHome,
  setExecFileImplForTests,
  windowsSupportsMirrored,
} from '../wsl-detect'

type Reply =
  | { ok: true; stdout?: string | Buffer }
  | { ok: false; code: number | string; stdout?: string | Buffer }

interface Call {
  file: string
  args: string[]
  options: Record<string, unknown>
}

function utf16(text: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
}

function installExec(route: (args: string[]) => Reply): Call[] {
  const calls: Call[] = []
  setExecFileImplForTests((file: string, args: string[], options: Record<string, unknown>, callback: (...cbArgs: unknown[]) => void) => {
    calls.push({ file, args, options })
    const reply = route(args)
    const stdout = reply.stdout === undefined ? Buffer.alloc(0) : Buffer.isBuffer(reply.stdout) ? reply.stdout : Buffer.from(reply.stdout)
    if (reply.ok) {
      callback(null, stdout, Buffer.alloc(0))
    } else {
      const error = Object.assign(new Error(`Command failed: ${file} ${args.join(' ')}`), { code: reply.code })
      callback(error, stdout, Buffer.alloc(0))
    }
    return undefined
  })
  return calls
}

const key = (args: string[]) => args.join(' ')

afterEach(() => {
  resetExecFileImplForTests()
})

describe('wsl-detect list() three states (T0378 / BUG-086)', () => {
  it('WSL installed with distros -> parsed list, no extra probe', async () => {
    const calls = installExec((args) => {
      if (key(args) === '-l -v') {
        return { ok: true, stdout: utf16('  NAME            STATE           VERSION\r\n* Ubuntu-24.04    Running         2\r\n') }
      }
      return { ok: false, code: 1 }
    })

    const result = await list()
    expect(result.distros).toEqual([{ name: 'Ubuntu-24.04', state: 'Running', version: 2 }])
    expect(result.default).toBe('Ubuntu-24.04')
    expect(calls.map((c) => key(c.args))).toEqual(['-l -v'])
  })

  it('WSL installed but no distro (`wsl -l -v` exit -1, `wsl --status` exit 0) -> empty list', async () => {
    const calls = installExec((args) => {
      if (key(args) === '-l -v') return { ok: false, code: -1, stdout: utf16('localized no-distro text') }
      if (key(args) === '--status') return { ok: true }
      return { ok: false, code: 1 }
    })

    await expect(list()).resolves.toEqual({ distros: [], default: null })
    expect(calls.map((c) => key(c.args))).toEqual(['-l -v', '--status'])
    // probe is bounded
    expect(calls[1].options.timeout).toBeGreaterThan(0)
  })

  it('falls back to `wsl --version` when `--status` is unsupported', async () => {
    installExec((args) => {
      if (key(args) === '--version') return { ok: true }
      return { ok: false, code: -1 }
    })

    await expect(list()).resolves.toEqual({ distros: [], default: null })
  })

  it('WSL not installed (both probes non-zero) -> rethrows the original error', async () => {
    installExec(() => ({ ok: false, code: 1 }))
    await expect(list()).rejects.toThrow(/Command failed: wsl -l -v/)
  })

  it('wsl.exe missing (ENOENT) -> rethrows without probing', async () => {
    const calls = installExec(() => ({ ok: false, code: 'ENOENT' }))
    await expect(list()).rejects.toThrow(/wsl -l -v/)
    expect(calls).toHaveLength(1)
  })
})

describe('wsl-detect resolveHome() (T0378 / BUG-087 B)', () => {
  it('returns the absolute $HOME via a fixed command with no interpolated input', async () => {
    const calls = installExec(() => ({ ok: true, stdout: '/home/gower\n' }))
    await expect(resolveHome('Ubuntu-24.04')).resolves.toBe('/home/gower')
    expect(calls[0].file).toBe('wsl')
    expect(calls[0].args).toEqual(['-d', 'Ubuntu-24.04', '--', 'printenv', 'HOME'])
    expect(calls[0].options.timeout).toBeGreaterThan(0)
  })

  it('strips a trailing slash', async () => {
    installExec(() => ({ ok: true, stdout: '/root/' }))
    await expect(resolveHome('Ubuntu')).resolves.toBe('/root')
  })

  it('rejects a non-absolute result', async () => {
    installExec(() => ({ ok: true, stdout: '~' }))
    await expect(resolveHome('Ubuntu')).rejects.toThrow(/absolute home directory/)
  })

  it('rejects empty output and paths with shell metacharacters', async () => {
    installExec(() => ({ ok: true, stdout: '' }))
    await expect(resolveHome('Ubuntu')).rejects.toThrow(/absolute home directory/)
    installExec(() => ({ ok: true, stdout: '/home/a;rm -rf' }))
    await expect(resolveHome('Ubuntu')).rejects.toThrow(/absolute home directory/)
  })

  it('propagates a wsl failure', async () => {
    installExec(() => ({ ok: false, code: 1 }))
    await expect(resolveHome('Ubuntu')).rejects.toThrow(/Command failed/)
  })

  it('rejects an invalid distro name before spawning', async () => {
    const calls = installExec(() => ({ ok: true, stdout: '/home/x' }))
    await expect(resolveHome('bad distro;')).rejects.toThrow(/Invalid WSL distro name/)
    expect(calls).toHaveLength(0)
  })
})

describe('wsl-detect networking mode (T0383 / BUG-089)', () => {
  describe('parseWslinfoNetworkingMode()', () => {
    it('parses plain UTF-8 output with LF / CRLF', () => {
      expect(parseWslinfoNetworkingMode(Buffer.from('mirrored\n'))).toBe('mirrored')
      expect(parseWslinfoNetworkingMode(Buffer.from('nat\r\n'))).toBe('nat')
    })

    it('parses UTF-16LE output (with or without BOM) case-insensitively', () => {
      expect(parseWslinfoNetworkingMode(utf16('Mirrored\r\n'))).toBe('mirrored')
      expect(parseWslinfoNetworkingMode(Buffer.from('NAT\n', 'utf16le'))).toBe('nat')
    })

    it('keeps the other documented modes', () => {
      expect(parseWslinfoNetworkingMode(Buffer.from('virtioproxy\n'))).toBe('virtioproxy')
      expect(parseWslinfoNetworkingMode(Buffer.from('none\n'))).toBe('none')
    })

    it('ignores stray diagnostic lines around the mode', () => {
      expect(parseWslinfoNetworkingMode(Buffer.from('wsl: some notice\nmirrored\n'))).toBe('mirrored')
    })

    it('maps empty or unrecognised output to unknown', () => {
      expect(parseWslinfoNetworkingMode(Buffer.alloc(0))).toBe('unknown')
      expect(parseWslinfoNetworkingMode(Buffer.from('bridged\n'))).toBe('unknown')
      expect(parseWslinfoNetworkingMode(Buffer.from('wslinfo: command not found\n'))).toBe('unknown')
    })
  })

  describe('parseWslConfigNetworkingMode()', () => {
    it('reads [wsl2] networkingMode with case-insensitive section, key and value', () => {
      expect(parseWslConfigNetworkingMode('[wsl2]\nnetworkingMode=Mirrored\n')).toBe('mirrored')
      expect(parseWslConfigNetworkingMode('[WSL2]\r\nNETWORKINGMODE = nat\r\n')).toBe('nat')
    })

    it('matches the user .wslconfig from BUG-089', () => {
      const text = '[wsl2]\r\nnetworkingMode=Mirrored\r\n[experimental]\r\nhostAddressLoopback=true\r\nbestEffortDnsParsing=true\r\n'
      expect(parseWslConfigNetworkingMode(text)).toBe('mirrored')
    })

    it('returns null without a [wsl2] section or key', () => {
      expect(parseWslConfigNetworkingMode('')).toBeNull()
      expect(parseWslConfigNetworkingMode('[experimental]\nnetworkingMode=mirrored\n')).toBeNull()
      expect(parseWslConfigNetworkingMode('[wsl2]\nmemory=8GB\n')).toBeNull()
      expect(parseWslConfigNetworkingMode('networkingMode=mirrored\n')).toBeNull()
    })

    it('ignores comment lines and trailing comments', () => {
      expect(parseWslConfigNetworkingMode('[wsl2]\n# networkingMode=nat\nnetworkingMode=mirrored # enable\n')).toBe('mirrored')
      expect(parseWslConfigNetworkingMode('[wsl2]\n; networkingMode=mirrored\n')).toBeNull()
    })

    it('strips quotes, lets the last entry win and maps unknown values to unknown', () => {
      expect(parseWslConfigNetworkingMode('[wsl2]\nnetworkingMode="mirrored"\n')).toBe('mirrored')
      expect(parseWslConfigNetworkingMode('[wsl2]\nnetworkingMode=nat\nnetworkingMode=mirrored\n')).toBe('mirrored')
      expect(parseWslConfigNetworkingMode('[wsl2]\nnetworkingMode=bridged\n')).toBe('unknown')
    })

    it('tolerates a UTF-8 BOM', () => {
      expect(parseWslConfigNetworkingMode('﻿[wsl2]\nnetworkingMode=mirrored\n')).toBe('mirrored')
    })
  })

  describe('readDeclaredNetworkMode()', () => {
    let dir: string
    beforeEach(() => {
      dir = mkdtempSync(path.join(tmpdir(), 't0383-wslconfig-'))
    })
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true })
    })

    it('reads UTF-8 and UTF-16LE files', async () => {
      const file = path.join(dir, '.wslconfig')
      writeFileSync(file, '[wsl2]\nnetworkingMode=Mirrored\n')
      await expect(readDeclaredNetworkMode(file)).resolves.toBe('mirrored')
      writeFileSync(file, utf16('[wsl2]\r\nnetworkingMode=NAT\r\n'))
      await expect(readDeclaredNetworkMode(file)).resolves.toBe('nat')
    })

    it('returns null for a missing file', async () => {
      await expect(readDeclaredNetworkMode(path.join(dir, 'missing'))).resolves.toBeNull()
    })
  })

  describe('windowsSupportsMirrored()', () => {
    it('needs Windows 11 22H2 (build 22621)+', () => {
      expect(windowsSupportsMirrored('10.0.22621', 'win32')).toBe(true)
      expect(windowsSupportsMirrored('10.0.28000', 'win32')).toBe(true)
      expect(windowsSupportsMirrored('10.0.22000', 'win32')).toBe(false)
      expect(windowsSupportsMirrored('10.0.19045', 'win32')).toBe(false)
    })

    it('is null off Windows or for an unparsable release', () => {
      expect(windowsSupportsMirrored('6.8.0', 'linux')).toBeNull()
      expect(windowsSupportsMirrored('10.0', 'win32')).toBeNull()
    })
  })

  describe('detectNetworkMode()', () => {
    let dir: string
    let savedUserProfile: string | undefined
    beforeEach(() => {
      dir = mkdtempSync(path.join(tmpdir(), 't0383-profile-'))
      savedUserProfile = process.env.USERPROFILE
      process.env.USERPROFILE = dir
    })
    afterEach(() => {
      if (savedUserProfile === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = savedUserProfile
      rmSync(dir, { recursive: true, force: true })
    })

    it('runs `wslinfo --networking-mode` with fixed argv (no route heuristic)', async () => {
      writeFileSync(path.join(dir, '.wslconfig'), '[wsl2]\nnetworkingMode=Mirrored\n')
      const calls = installExec(() => ({ ok: true, stdout: 'mirrored\n' }))

      const info = await detectNetworkMode('Ubuntu-24.04')

      expect(info.actual).toBe('mirrored')
      expect(info.declared).toBe('mirrored')
      expect(calls).toHaveLength(1)
      expect(calls[0].file).toBe('wsl')
      expect(calls[0].args).toEqual(['-d', 'Ubuntu-24.04', '--', 'wslinfo', '--networking-mode'])
      expect(calls[0].options.timeout).toBeGreaterThan(0)
    })

    it('reports declared=mirrored / actual=nat when the setting has not taken effect', async () => {
      writeFileSync(path.join(dir, '.wslconfig'), '[wsl2]\nnetworkingMode=mirrored\n')
      installExec(() => ({ ok: true, stdout: 'nat\n' }))
      await expect(detectNetworkMode('Ubuntu')).resolves.toMatchObject({ actual: 'nat', declared: 'mirrored' })
    })

    it('falls back to unknown when wslinfo is missing (WSL < 2.0.4); declared=null without .wslconfig', async () => {
      installExec(() => ({ ok: false, code: 1 }))
      await expect(detectNetworkMode('Ubuntu')).resolves.toMatchObject({ actual: 'unknown', declared: null })
    })

    it('rejects an invalid distro name before spawning', async () => {
      const calls = installExec(() => ({ ok: true, stdout: 'nat\n' }))
      await expect(detectNetworkMode('bad distro;')).rejects.toThrow(/Invalid WSL distro name/)
      expect(calls).toHaveLength(0)
    })
  })
})
