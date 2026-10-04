// T0393 (PLAN-036 P0-E) — Settings shell list follows the window's remote
// targetOS (shells run on the remote host); local windows keep the local list.

import { describe, it, expect } from 'vitest'

import { SHELL_OPTIONS, getShellOptionsForPlatform, shellPlatformForTargetOS } from '../../types'

const idsFor = (targetOS: string | null | undefined, localPlatform: 'win32' | 'darwin' | 'linux') =>
  getShellOptionsForPlatform(shellPlatformForTargetOS(targetOS, localPlatform)).map(o => o.id)

describe('shellPlatformForTargetOS', () => {
  it('maps remote Linux targets to linux', () => {
    expect(shellPlatformForTargetOS('wsl-linux', 'win32')).toBe('linux')
    expect(shellPlatformForTargetOS('ssh-linux', 'win32')).toBe('linux')
    expect(shellPlatformForTargetOS('docker-linux', 'darwin')).toBe('linux')
  })

  it('maps ssh-darwin to darwin', () => {
    expect(shellPlatformForTargetOS('ssh-darwin', 'win32')).toBe('darwin')
  })

  it('keeps the local platform for local windows and legacy remotes without targetOS', () => {
    expect(shellPlatformForTargetOS(undefined, 'win32')).toBe('win32')
    expect(shellPlatformForTargetOS(null, 'darwin')).toBe('darwin')
    expect(shellPlatformForTargetOS('local', 'linux')).toBe('linux')
    expect(shellPlatformForTargetOS('something-new', 'win32')).toBe('win32')
  })
})

describe('shell options per window', () => {
  it.each(['wsl-linux', 'ssh-linux'])('remote %s window on a Windows client lists bash / zsh, not pwsh / cmd', (targetOS) => {
    const ids = idsFor(targetOS, 'win32')
    expect(ids).toEqual(expect.arrayContaining(['auto', 'bash', 'zsh', 'sh', 'custom']))
    for (const winShell of ['pwsh', 'powershell', 'cmd', 'git-bash']) {
      expect(ids).not.toContain(winShell)
    }
  })

  it('local win32 window is unchanged (same as the original platform filter)', () => {
    const original = SHELL_OPTIONS.filter(opt => opt.platforms.includes('win32')).map(o => o.id)
    expect(idsFor(undefined, 'win32')).toEqual(original)
    expect(original).toEqual(['auto', 'pwsh', 'powershell', 'cmd', 'git-bash', 'custom'])
  })

  it('local darwin / linux windows are unchanged', () => {
    for (const platform of ['darwin', 'linux'] as const) {
      expect(idsFor(undefined, platform)).toEqual(SHELL_OPTIONS.filter(opt => opt.platforms.includes(platform)).map(o => o.id))
    }
  })
})
