/**
 * T0853 (PLAN-052 W4b, Q-1): the Docker (c′) wizard installs the server bundle
 * before the container exists, so its distributor draft carries the daemon
 * architecture (`docker:server-arch`) as `dockerServerArch`. detectRemoteArch
 * uses it without `docker exec`; without it (and for WSL / SSH) nothing changed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileEntry } from '../../profile-manager'
import { detectRemoteArch, resetExecFileImplForTests, setExecFileImplForTests } from '../arch-detect'

function profile(fields: Partial<ProfileEntry> & Record<string, unknown>): ProfileEntry {
  return { id: '__wizard_draft__', name: '__wizard_draft__', type: 'remote', createdAt: 0, updatedAt: 0, ...fields } as ProfileEntry
}

function installExec(stdout: string) {
  const calls: Array<{ file: string; args: string[] }> = []
  const impl = vi.fn((file: string, args: string[], _options: unknown, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    calls.push({ file, args })
    callback(null, stdout, '')
  })
  setExecFileImplForTests(impl as unknown as Parameters<typeof setExecFileImplForTests>[0])
  return calls
}

afterEach(() => {
  resetExecFileImplForTests()
})

describe('detectRemoteArch: Docker draft with dockerServerArch (T0853 Q-1)', () => {
  it('linux-x64 / linux-arm64 are used as is, without docker exec (the container may not exist)', async () => {
    const calls = installExec('x86_64\n')
    expect(await detectRemoteArch(profile({ targetOS: 'docker-linux', dockerContainer: 'bat-server-dev', dockerServerArch: 'linux-x64' })))
      .toEqual({ ok: true, arch: 'linux-x64', rawUname: 'linux-x64' })
    expect(await detectRemoteArch(profile({ targetOS: 'docker-linux', dockerContainer: 'bat-server-dev', dockerServerArch: 'linux-arm64' })))
      .toEqual({ ok: true, arch: 'linux-arm64', rawUname: 'linux-arm64' })
    expect(calls).toHaveLength(0)
  })

  it('any other value is detect-failed, without docker exec', async () => {
    const calls = installExec('x86_64\n')
    for (const value of ['darwin-arm64', 'x86_64', '', 42]) {
      const result = await detectRemoteArch(profile({ targetOS: 'docker-linux', dockerContainer: 'bat-server-dev', dockerServerArch: value }))
      expect(result).toMatchObject({ ok: false, errorCode: 'detect-failed' })
    }
    expect(calls).toHaveLength(0)
  })

  it('without dockerServerArch the container is asked as before (docker exec <container> uname -m)', async () => {
    const calls = installExec('aarch64\n')
    expect(await detectRemoteArch(profile({ targetOS: 'docker-linux', dockerContainer: 'bat-server-dev' })))
      .toEqual({ ok: true, arch: 'linux-arm64', rawUname: 'aarch64' })
    expect(calls).toEqual([{ file: 'docker', args: ['exec', 'bat-server-dev', 'uname', '-m'] }])
  })

  it('the container name is still checked first', async () => {
    const calls = installExec('x86_64\n')
    expect(await detectRemoteArch(profile({ targetOS: 'docker-linux', dockerContainer: 'bad name;', dockerServerArch: 'linux-x64' })))
      .toMatchObject({ ok: false, errorCode: 'detect-failed' })
    expect(calls).toHaveLength(0)
  })

  it('WSL and SSH ignore the field: same behaviour as before T0853', async () => {
    const calls = installExec('x86_64\n')
    expect(await detectRemoteArch(profile({ targetOS: 'wsl-linux', wslDistro: 'Ubuntu', dockerServerArch: 'linux-arm64' })))
      .toEqual({ ok: true, arch: 'linux-x64', rawUname: 'x86_64' })
    expect(calls).toEqual([{ file: 'wsl', args: ['-d', 'Ubuntu', '--', 'uname', '-m'] }])
    expect(await detectRemoteArch(profile({ targetOS: 'ssh-linux', sshServerArch: 'aarch64', dockerServerArch: 'linux-x64' })))
      .toEqual({ ok: true, arch: 'linux-arm64', rawUname: 'aarch64' })
    expect(calls).toHaveLength(1)
  })
})

describe('server-bundle:distribute draft validation (T0853 Q-1, source)', () => {
  it('main.ts accepts only the two linux arches and passes the field for docker-linux only', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const main = fs.readFileSync(path.join(__dirname, '..', '..', 'main.ts'), 'utf8')
    expect(main).toMatch(/draft\.dockerServerArch !== 'linux-x64' && draft\.dockerServerArch !== 'linux-arm64'/)
    expect(main).toMatch(/draft\.targetOS === 'docker-linux' && draft\.dockerServerArch \? \{ dockerServerArch: draft\.dockerServerArch \} : \{\}/)
  })
})
