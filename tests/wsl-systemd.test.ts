import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { afterEach, test } from 'node:test'
import {
  enableLinger,
  removeUnit,
  renderSystemdUnit,
  resetExecFileImplForTests,
  resetSpawnImplForTests,
  setExecFileImplForTests,
  setSpawnImplForTests,
  startService,
  writeUnit,
} from '../electron/wsl-systemd'

afterEach(() => {
  resetExecFileImplForTests()
  resetSpawnImplForTests()
})

test('renderSystemdUnit renders required sections and restart policy', () => {
  const unit = renderSystemdUnit({
    execStart: '~/.local/bat-server/bin/bat-server',
    environment: {
      BAT_SERVER_PORT: '9876',
      BAT_SERVER_DATA_DIR: '~/.local/share/bat-server',
    },
  })

  assert.match(unit, /\[Unit\]/)
  assert.match(unit, /\[Service\]/)
  assert.match(unit, /\[Install\]/)
  assert.match(unit, /Restart=on-failure/)
  assert.match(unit, /RestartSec=2s/)
})

test('renderSystemdUnit escapes quotes and newlines in environment values', () => {
  const unit = renderSystemdUnit({
    execStart: '~/.local/bat-server/bin/bat-server',
    environment: {
      BAT_LABEL: 'hello "quoted"\nline',
    },
  })

  assert.match(unit, /BAT_LABEL=hello \\"quoted\\"\\nline/)
})

test('writeUnit writes via wsl tee stdin pipe', async () => {
  const execCalls: Array<{ file: string; args: string[] }> = []
  setExecFileImplForTests((file, args, _options, callback) => {
    execCalls.push({ file, args })
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      null,
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  let written = ''
  let spawnArgs: string[] = []
  setSpawnImplForTests((_file, args) => {
    spawnArgs = [...(args ?? [])]
    const child = new PassThrough() as PassThrough & {
      stdin: PassThrough
      stdout: PassThrough
      stderr: PassThrough
      on: (event: string, listener: (...args: unknown[]) => void) => typeof child
      emit: (event: string, ...args: unknown[]) => boolean
    }
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.stdin.on('data', (chunk) => {
      written += chunk.toString('utf8')
    })
    process.nextTick(() => child.emit('close', 0))
    return child as never
  })

  await writeUnit('Ubuntu', {
    execStart: '~/.local/bat-server/bin/bat-server',
    environment: { BAT_SERVER_PORT: '9876' },
  })

  assert.deepEqual(execCalls[0].args, ['-d', 'Ubuntu', '--', 'mkdir', '-p', '~/.config/systemd/user'])
  assert.deepEqual(spawnArgs, ['-d', 'Ubuntu', '--', 'tee', '~/.config/systemd/user/bat-server.service'])
  assert.match(written, /ExecStart="~\/\.local\/bat-server\/bin\/bat-server"/)
})

test('enableLinger returns ok=true on successful loginctl', async () => {
  setExecFileImplForTests((_file, _args, _options, callback) => {
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      null,
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  assert.deepEqual(await enableLinger('Ubuntu'), { ok: true })
})

test('enableLinger returns ok=false when loginctl reports an error', async () => {
  setExecFileImplForTests((_file, _args, _options, callback) => {
    const error = Object.assign(new Error('loginctl failed'), {
      stdout: Buffer.alloc(0),
      stderr: Buffer.from('permission denied'),
    })
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(error, error.stdout, error.stderr)
    return {} as never
  })

  assert.deepEqual(await enableLinger('Ubuntu'), { ok: false, error: 'permission denied' })
})

test('startService runs daemon-reload, enable-now, status poll, and returns the persisted token', async () => {
  const calls: string[][] = []
  let statusAttempts = 0
  setExecFileImplForTests((_file, args, _options, callback) => {
    const command = [...args]
    calls.push(command)
    const joined = command.join(' ')

    if (joined.includes('systemctl --user is-active')) {
      statusAttempts += 1
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
        null,
        Buffer.from(statusAttempts === 1 ? 'activating\n' : 'active\n'),
        Buffer.alloc(0),
      )
      return {} as never
    }

    if (joined.includes('cat ~/.local/share/bat-server/server-token.json')) {
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
        null,
        Buffer.from(JSON.stringify({ v: 1, encrypted: false, data: 'secret-token' })),
        Buffer.alloc(0),
      )
      return {} as never
    }

    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      null,
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  const result = await startService('Ubuntu', 'bat-server.service')
  assert.deepEqual(result, { ok: true, token: 'secret-token' })
  assert.ok(calls.some((args) => args.join(' ').includes('systemctl --user daemon-reload')))
  assert.ok(calls.some((args) => args.join(' ').includes('systemctl --user enable --now bat-server.service')))
  assert.ok(calls.some((args) => args.join(' ').includes('systemctl --user is-active bat-server.service')))
})

test('startService returns ok=false when service never becomes active', async () => {
  setExecFileImplForTests((_file, args, _options, callback) => {
    const joined = [...args].join(' ')
    if (joined.includes('systemctl --user is-active')) {
      ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
        null,
        Buffer.from('activating\n'),
        Buffer.alloc(0),
      )
      return {} as never
    }
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(
      null,
      Buffer.alloc(0),
      Buffer.alloc(0),
    )
    return {} as never
  })

  const result = await startService('Ubuntu', 'bat-server.service', { timeoutMs: 1 })
  assert.equal(result.ok, false)
  assert.match((result as { error: string }).error, /Timed out/)
})

test('removeUnit disables service, removes file, and reloads systemd', async () => {
  const calls: string[][] = []
  setExecFileImplForTests((_file, args, _options, callback) => {
    calls.push([...(args as string[])])
    const error = Object.assign(new Error('ignored'), {
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
    })
    ;(callback as (error: Error | null, stdout: Buffer, stderr: Buffer) => void)(error, error.stdout, error.stderr)
    return {} as never
  })

  await removeUnit('Ubuntu', 'bat-server.service')

  assert.ok(calls.some((args) => args.join(' ').includes('systemctl --user disable --now bat-server.service')))
  assert.ok(calls.some((args) => args.join(' ').includes('rm -f ~/.config/systemd/user/bat-server.service')))
  assert.ok(calls.some((args) => args.join(' ').includes('systemctl --user daemon-reload')))
})

test('validation rejects invalid distro and service name before spawning', async () => {
  await assert.rejects(() => startService('Ubuntu; rm -rf /', 'bat-server.service'), /Invalid WSL distro name/)
  await assert.rejects(() => startService('Ubuntu', 'bat-server'), /Invalid service name/)
})
