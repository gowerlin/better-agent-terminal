/**
 * T0378 (BUG-086 / BUG-087 B): wsl-detect three-state WSL detection and
 * $HOME resolution. execFile is injected — no real wsl.exe is spawned.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  list,
  resetExecFileImplForTests,
  resolveHome,
  setExecFileImplForTests,
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
