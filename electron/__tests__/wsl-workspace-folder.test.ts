// @vitest-environment node
// T0393 (PLAN-036 P0-E) — WSL profile window: folder dialog default path
// (`\\wsl.localhost\<distro>\home\<user>`) and the /mnt/<drive> hint check.

import { describe, it, expect, vi } from 'vitest'

import {
  createWslFolderDefaultResolver,
  wslDistroForFolderDialog,
  wslHomeUncCandidates,
} from '../wsl-workspace-folder'
import { isWslWindowsDrivePath } from '../../src/utils/wsl-path'

const WSL_PROFILE = { type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04' }

describe('wslDistroForFolderDialog', () => {
  it('returns the distro of a WSL remote profile', () => {
    expect(wslDistroForFolderDialog(WSL_PROFILE)).toBe('Ubuntu-24.04')
  })

  it('returns null for local / non-WSL / missing profiles (original dialog behaviour)', () => {
    expect(wslDistroForFolderDialog(null)).toBeNull()
    expect(wslDistroForFolderDialog(undefined)).toBeNull()
    expect(wslDistroForFolderDialog({ type: 'local' })).toBeNull()
    expect(wslDistroForFolderDialog({ type: 'local', targetOS: 'wsl-linux', wslDistro: 'Ubuntu' })).toBeNull()
    expect(wslDistroForFolderDialog({ type: 'remote', targetOS: 'ssh-linux' })).toBeNull()
    expect(wslDistroForFolderDialog({ type: 'remote', targetOS: 'docker-linux' })).toBeNull()
    expect(wslDistroForFolderDialog({ type: 'remote' })).toBeNull()
    expect(wslDistroForFolderDialog({ type: 'remote', targetOS: 'wsl-linux', wslDistro: '' })).toBeNull()
  })

  it('rejects distro names outside the whitelist', () => {
    for (const wslDistro of ['Ubuntu 24.04', 'Ubuntu;calc', '..\\evil', 'a/b', '$(whoami)', '"Ubuntu"']) {
      expect(wslDistroForFolderDialog({ type: 'remote', targetOS: 'wsl-linux', wslDistro })).toBeNull()
    }
  })
})

describe('wslHomeUncCandidates', () => {
  it('builds \\\\wsl.localhost first, \\\\wsl$ as legacy fallback', () => {
    expect(wslHomeUncCandidates('Ubuntu-24.04', '/home/gower')).toEqual([
      '\\\\wsl.localhost\\Ubuntu-24.04\\home\\gower',
      '\\\\wsl$\\Ubuntu-24.04\\home\\gower',
    ])
  })

  it('handles root (/root) and nested homes', () => {
    expect(wslHomeUncCandidates('Debian', '/root')[0]).toBe('\\\\wsl.localhost\\Debian\\root')
    expect(wslHomeUncCandidates('Debian', '/srv/users/a.b')[0]).toBe('\\\\wsl.localhost\\Debian\\srv\\users\\a.b')
  })

  it('returns nothing for a non-whitelisted distro or an unsafe home', () => {
    expect(wslHomeUncCandidates('bad distro', '/home/u')).toEqual([])
    expect(wslHomeUncCandidates('Ubuntu', 'home/u')).toEqual([])
    expect(wslHomeUncCandidates('Ubuntu', '/home/../etc')).toEqual([])
    expect(wslHomeUncCandidates('Ubuntu', '/home/u u')).toEqual([])
    expect(wslHomeUncCandidates('Ubuntu', '')).toEqual([])
  })
})

describe('createWslFolderDefaultResolver', () => {
  it('resolves the \\\\wsl.localhost home and caches it per distro', async () => {
    const resolveHome = vi.fn(async () => '/home/gower')
    const isDirectory = vi.fn(async () => true)
    const resolve = createWslFolderDefaultResolver({ resolveHome, isDirectory })

    expect(await resolve('Ubuntu-24.04')).toBe('\\\\wsl.localhost\\Ubuntu-24.04\\home\\gower')
    expect(await resolve('Ubuntu-24.04')).toBe('\\\\wsl.localhost\\Ubuntu-24.04\\home\\gower')
    expect(resolveHome).toHaveBeenCalledTimes(1)
    expect(resolveHome).toHaveBeenCalledWith('Ubuntu-24.04')
  })

  it('falls back to \\\\wsl$ when \\\\wsl.localhost is unavailable', async () => {
    const isDirectory = vi.fn(async (p: string) => {
      if (p.startsWith('\\\\wsl.localhost\\')) throw new Error('ENOENT')
      return true
    })
    const resolve = createWslFolderDefaultResolver({ resolveHome: async () => '/home/u', isDirectory })
    expect(await resolve('Ubuntu')).toBe('\\\\wsl$\\Ubuntu\\home\\u')
  })

  it('returns null (caller keeps original default) when the home probe fails, and retries next time', async () => {
    const resolveHome = vi.fn()
      .mockRejectedValueOnce(new Error('wsl.exe failed'))
      .mockResolvedValueOnce('/home/u')
    const log = vi.fn()
    const resolve = createWslFolderDefaultResolver({ resolveHome, isDirectory: async () => true, log })
    expect(await resolve('Ubuntu')).toBeNull()
    expect(log).toHaveBeenCalled()
    expect(await resolve('Ubuntu')).toBe('\\\\wsl.localhost\\Ubuntu\\home\\u')
  })

  it('returns null when the home probe exceeds the timeout', async () => {
    const resolve = createWslFolderDefaultResolver({
      resolveHome: () => new Promise<string>(() => { /* never settles */ }),
      isDirectory: async () => true,
      homeTimeoutMs: 20,
    })
    expect(await resolve('Ubuntu')).toBeNull()
  })

  it('returns null when no UNC candidate is a directory (stat stalls or fails)', async () => {
    const resolve = createWslFolderDefaultResolver({
      resolveHome: async () => '/home/u',
      isDirectory: (p: string) => p.includes('wsl.localhost') ? new Promise<boolean>(() => { /* stall */ }) : Promise.resolve(false),
      statTimeoutMs: 20,
    })
    expect(await resolve('Ubuntu')).toBeNull()
  })

  it('never spawns for a non-whitelisted distro', async () => {
    const resolveHome = vi.fn(async () => '/home/u')
    const resolve = createWslFolderDefaultResolver({ resolveHome, isDirectory: async () => true })
    expect(await resolve('Ubuntu & calc')).toBeNull()
    expect(resolveHome).not.toHaveBeenCalled()
  })

  it('returns null for an unsafe home value', async () => {
    const resolve = createWslFolderDefaultResolver({ resolveHome: async () => '/home/../../etc', isDirectory: async () => true })
    expect(await resolve('Ubuntu')).toBeNull()
  })
})

describe('isWslWindowsDrivePath (/mnt/<drive> hint)', () => {
  const DISTRO = 'Ubuntu-24.04'

  it('flags Windows drive folders (→ /mnt/<drive>/…)', () => {
    expect(isWslWindowsDrivePath('C:\\Users\\gower\\repo', DISTRO)).toBe(true)
    expect(isWslWindowsDrivePath('d:\\work', DISTRO)).toBe(true)
    expect(isWslWindowsDrivePath('C:\\', DISTRO)).toBe(true)
    expect(isWslWindowsDrivePath('\\\\?\\C:\\very\\long\\path', DISTRO)).toBe(true)
    // Drive reached through the distro's own UNC share is still drvfs
    expect(isWslWindowsDrivePath('\\\\wsl.localhost\\Ubuntu-24.04\\mnt\\c\\Users', DISTRO)).toBe(true)
  })

  it('does not flag folders inside the distro', () => {
    expect(isWslWindowsDrivePath('\\\\wsl.localhost\\Ubuntu-24.04\\home\\gower\\repo', DISTRO)).toBe(false)
    expect(isWslWindowsDrivePath('\\\\wsl$\\Ubuntu-24.04\\home\\gower', DISTRO)).toBe(false)
    expect(isWslWindowsDrivePath('\\\\wsl.localhost\\Ubuntu-24.04\\mnt\\wslg', DISTRO)).toBe(false)
    expect(isWslWindowsDrivePath('\\\\wsl.localhost\\Ubuntu-24.04\\mnt', DISTRO)).toBe(false)
  })

  it('does not flag other distros or network shares (no /mnt translation)', () => {
    expect(isWslWindowsDrivePath('\\\\wsl.localhost\\Debian\\mnt\\c\\x', DISTRO)).toBe(false)
    expect(isWslWindowsDrivePath('\\\\server\\share\\repo', DISTRO)).toBe(false)
  })
})
