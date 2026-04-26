import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  detectNetworkMode,
  installBundle,
  list,
  resetExecFileImplForTests,
  setExecFileImplForTests,
  systemdEnabled,
  validateDistroName,
  validateInstallPath,
} from '../electron/wsl-detect'

function utf16le(input: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(input, 'utf16le')])
}

afterEach(() => {
  resetExecFileImplForTests()
})

test('list() parses UTF-16LE distro output and default marker', async () => {
  setExecFileImplForTests((_file, _args, _options, callback) => {
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      null,
      utf16le('  NAME                   STATE           VERSION\r\n* Ubuntu                 Running         2\r\n  Debian                 Stopped         1\r\n'),
      Buffer.alloc(0),
    )
    return {} as never
  })

  const result = await list()
  assert.equal(result.default, 'Ubuntu')
  assert.deepEqual(result.distros, [
    { name: 'Ubuntu', state: 'Running', version: 2 },
    { name: 'Debian', state: 'Stopped', version: 1 },
  ])
})

test('list() returns an empty array when no distros are installed', async () => {
  setExecFileImplForTests((_file, _args, _options, callback) => {
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      null,
      utf16le('Windows Subsystem for Linux has no installed distributions.\r\n'),
      Buffer.alloc(0),
    )
    return {} as never
  })

  const result = await list()
  assert.deepEqual(result, { distros: [], default: null })
})

test('systemdEnabled() returns true when systemctl reports running', async () => {
  setExecFileImplForTests((_file, args, _options, callback) => {
    if (Array.isArray(args) && args.includes('systemctl')) {
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
        null,
        Buffer.from('running\n'),
        Buffer.alloc(0),
      )
      return {} as never
    }
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      new Error(`unexpected args: ${String(args)}`),
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  assert.equal(await systemdEnabled('Ubuntu'), true)
})

test('systemdEnabled() falls back to /etc/wsl.conf when systemctl is unavailable', async () => {
  setExecFileImplForTests((_file, args, _options, callback) => {
    const command = Array.isArray(args) ? args.join(' ') : ''
    if (command.includes('systemctl --user is-system-running')) {
      const error = Object.assign(new Error('systemctl unavailable'), {
        stdout: Buffer.from('offline\n'),
        stderr: Buffer.from(''),
      })
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(error, error.stdout, error.stderr)
      return {} as never
    }
    if (command.includes('cat /etc/wsl.conf')) {
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
        null,
        Buffer.from('[boot]\nsystemd=true\n'),
        Buffer.alloc(0),
      )
      return {} as never
    }
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      new Error(`unexpected args: ${command}`),
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  assert.equal(await systemdEnabled('Ubuntu'), true)
})

test('detectNetworkMode() reports NAT when ip route has an explicit gateway', async () => {
  setExecFileImplForTests((_file, args, _options, callback) => {
    const command = Array.isArray(args) ? args.join(' ') : ''
    if (command.includes('ip route show default')) {
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
        null,
        Buffer.from('default via 172.25.176.1 dev eth0 proto kernel\n'),
        Buffer.alloc(0),
      )
      return {} as never
    }
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      new Error(`unexpected args: ${command}`),
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  assert.equal(await detectNetworkMode('Ubuntu'), 'nat')
})

test('detectNetworkMode() reports mirrored when ip route is direct', async () => {
  setExecFileImplForTests((_file, args, _options, callback) => {
    const command = Array.isArray(args) ? args.join(' ') : ''
    if (command.includes('ip route show default')) {
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
        null,
        Buffer.from('default dev eth0 proto kernel scope link src 192.168.1.55\n'),
        Buffer.alloc(0),
      )
      return {} as never
    }
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      new Error(`unexpected args: ${command}`),
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  assert.equal(await detectNetworkMode('Ubuntu'), 'mirrored')
})

test('detectNetworkMode() falls back to unknown on empty route output', async () => {
  setExecFileImplForTests((_file, args, _options, callback) => {
    const command = Array.isArray(args) ? args.join(' ') : ''
    if (command.includes('ip route show default')) {
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
        null,
        Buffer.alloc(0),
        Buffer.alloc(0),
      )
      return {} as never
    }
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      new Error(`unexpected args: ${command}`),
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  assert.equal(await detectNetworkMode('Ubuntu'), 'unknown')
})

test('validateDistroName() rejects shell metacharacters', () => {
  assert.throws(() => validateDistroName('Ubuntu; rm -rf /'))
})

test('validateInstallPath() rejects traversal and shell metacharacters', () => {
  assert.throws(() => validateInstallPath('/tmp/../bat-server'))
  assert.throws(() => validateInstallPath('/tmp/bat-server && whoami'))
})

test('installBundle() rejects relative tarball paths before spawning WSL', async () => {
  setExecFileImplForTests(() => {
    throw new Error('execFile should not be called for invalid tarball paths')
  })

  await assert.deepEqual(await installBundle('Ubuntu', 'relative.tar.gz', '~/.local/bat-server'), {
    ok: false,
    error: 'Expected absolute Windows path: relative.tar.gz',
  })
})
