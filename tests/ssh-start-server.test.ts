import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'stream'
import type { ChildProcess } from 'child_process'
import {
  startServerOnRemote,
  type StarterDeps,
  type StartServerOptions,
  type StartServerPhase,
  __internals,
} from '../electron/remote/ssh-start-server'

const { renderSystemdUnit, renderLaunchdPlist, buildWriteUnitCommand, escapeSingleQuotes } = __internals

interface FakeProc extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  exitCode: number | null
  kill(sig?: NodeJS.Signals | number): boolean
}

function makeFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.exitCode = null
  proc.kill = () => true
  return proc
}

interface ScriptedExec {
  stdout?: string
  stderr?: string
  exitCode?: number
}

interface SpawnRecorder {
  calls: Array<{ command: string; args: readonly string[] }>
  spawn: NonNullable<StarterDeps['spawn']>
}

/**
 * Build a spawn mock that returns a sequence of scripted ssh exec results.
 * Each call to spawn pops the next script from the queue. After all scripts
 * are consumed, additional spawns throw — surfacing tests that under-script.
 */
function makeScriptedSpawn(scripts: ScriptedExec[]): SpawnRecorder {
  const calls: Array<{ command: string; args: readonly string[] }> = []
  let cursor = 0
  const spawn: NonNullable<StarterDeps['spawn']> = (command, args) => {
    calls.push({ command, args })
    if (cursor >= scripts.length) {
      throw new Error(`spawn called more times than scripted (idx=${cursor})`)
    }
    const script = scripts[cursor++]
    const proc = makeFakeProc()
    setImmediate(() => {
      if (script.stdout) proc.stdout.emit('data', Buffer.from(script.stdout, 'utf8'))
      if (script.stderr) proc.stderr.emit('data', Buffer.from(script.stderr, 'utf8'))
      proc.exitCode = script.exitCode ?? 0
      proc.emit('exit', proc.exitCode)
    })
    return proc as unknown as ChildProcess
  }
  return { calls, spawn }
}

const baseLinux: StartServerOptions = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  targetOS: 'ssh-linux',
  installPath: '~/.local/bat-server',
  serverPort: 51820,
  serverHome: '/home/alice',
}

const baseDarwin: StartServerOptions = {
  ...baseLinux,
  targetOS: 'ssh-darwin',
  serverHome: '/Users/alice',
}

test('test1: systemd unit content has all 7 required fields + 2 Environment vars (BIND/PORT)', () => {
  const unit = renderSystemdUnit(baseLinux)
  assert.match(unit, /^\[Unit\]/m)
  assert.match(unit, /^Description=BAT remote server/m)
  assert.match(unit, /^After=network\.target/m)
  assert.match(unit, /^Type=simple/m)
  assert.match(unit, /^ExecStart=~\/\.local\/bat-server\/bin\/bat-server/m)
  assert.match(unit, /^Restart=on-failure/m)
  assert.match(unit, /^RestartSec=5s/m)
  assert.match(unit, /^WantedBy=default\.target/m)
  assert.match(unit, /^Environment=BAT_REMOTE_BIND=localhost/m)
  assert.match(unit, /^Environment=BAT_REMOTE_PORT=51820/m)
})

test('test2: launchd plist content has all 6 required keys (Label/ProgramArguments/EnvironmentVariables/RunAtLoad/KeepAlive.Crashed=true/KeepAlive.SuccessfulExit=false)', () => {
  const plist = renderLaunchdPlist(baseDarwin)
  assert.match(plist, /<key>Label<\/key>\s*<string>com\.bat-server<\/string>/)
  assert.match(plist, /<key>ProgramArguments<\/key>/)
  assert.match(plist, /<string>~\/\.local\/bat-server\/bin\/bat-server<\/string>/)
  assert.match(plist, /<key>EnvironmentVariables<\/key>/)
  assert.match(plist, /<key>BAT_REMOTE_PORT<\/key>\s*<string>51820<\/string>/)
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/)
  // KeepAlive.Crashed=true and SuccessfulExit=false
  assert.match(plist, /<key>KeepAlive<\/key>[\s\S]*<key>Crashed<\/key>\s*<true\/>[\s\S]*<key>SuccessfulExit<\/key>\s*<false\/>/)
})

test('test3: systemd happy path runs 3 ssh execs in order (write → enable → verify)', async () => {
  const { spawn, calls } = makeScriptedSpawn([
    { exitCode: 0 },                                                   // write
    { exitCode: 0 },                                                   // enable
    { exitCode: 0, stdout: 'active\n51820\n' },                        // verify
  ])
  const phases: StartServerPhase[] = []
  const result = await startServerOnRemote(baseLinux, (phase) => phases.push(phase), { spawn })
  assert.equal(result.ok, true)
  assert.equal(result.method, 'systemd')
  assert.equal(calls.length, 3)
  // last arg is the remote command
  assert.match(String(calls[0].args[calls[0].args.length - 1]), /cat > '~\/\.config\/systemd\/user\/bat-server\.service' << 'EOF'/)
  assert.match(String(calls[1].args[calls[1].args.length - 1]), /loginctl enable-linger 'alice'.*systemctl --user enable --now bat-server/s)
  assert.match(String(calls[2].args[calls[2].args.length - 1]), /systemctl --user is-active bat-server/)
  // phase emit order
  assert.deepEqual(phases, ['writing-unit', 'enabling', 'starting', 'verifying'])
})

test('test4: launchd happy path runs 3 ssh execs in order (write → load → verify)', async () => {
  const { spawn, calls } = makeScriptedSpawn([
    { exitCode: 0 },
    { exitCode: 0 },
    { exitCode: 0, stdout: 'com.bat-server\n12345\n' },
  ])
  const result = await startServerOnRemote(baseDarwin, undefined, { spawn })
  assert.equal(result.ok, true)
  assert.equal(result.method, 'launchd')
  assert.equal(calls.length, 3)
  assert.match(String(calls[0].args[calls[0].args.length - 1]), /cat > '~\/Library\/LaunchAgents\/com\.bat-server\.plist' << 'EOF'/)
  assert.match(String(calls[1].args[calls[1].args.length - 1]), /launchctl load -w '~\/Library\/LaunchAgents\/com\.bat-server\.plist'/)
  assert.match(String(calls[2].args[calls[2].args.length - 1]), /launchctl list \| grep com\.bat-server && pgrep -x bat-server/)
})

test('test5: unit-write failure aborts before stage 2 — only 1 ssh exec, errorCode=unit-write-failed', async () => {
  const { spawn, calls } = makeScriptedSpawn([
    { exitCode: 1, stderr: 'mkdir: cannot create directory: Read-only file system\n' },
  ])
  const result = await startServerOnRemote(baseLinux, undefined, { spawn })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'unit-write-failed')
  assert.equal(result.method, 'failed')
  assert.equal(calls.length, 1) // proves no stage 2
  assert.match(result.error ?? '', /Read-only file system/)
})

test('test6: enable failure aborts before stage 3 — only 2 ssh execs, errorCode=enable-failed', async () => {
  const { spawn, calls } = makeScriptedSpawn([
    { exitCode: 0 },
    { exitCode: 1, stderr: 'Failed to enable-linger: not authorized\n' },
  ])
  const result = await startServerOnRemote(baseLinux, undefined, { spawn })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'enable-failed')
  assert.equal(calls.length, 2) // proves no stage 3
  assert.match(result.error ?? '', /not authorized/)
})

test('test7: single-quote injection guard — installPath/sshUser/serverHome containing apostrophe escapes safely', async () => {
  // Pure helper test — no spawn needed
  assert.equal(escapeSingleQuotes("O'Brien"), "O'\\''Brien")
  assert.equal(escapeSingleQuotes("a'b'c"), "a'\\''b'\\''c")
  assert.equal(escapeSingleQuotes("plain"), "plain")
  assert.throws(() => escapeSingleQuotes("evil\nuser"), /forbidden newline/)

  // End-to-end: an installPath like `/opt/O'Brien/bat-server` must produce a
  // remote command that is still single-quote balanced.
  const trickyOpts: StartServerOptions = { ...baseLinux, installPath: "/opt/O'Brien/bat-server" }
  const { spawn, calls } = makeScriptedSpawn([
    { exitCode: 0 },
    { exitCode: 0 },
    { exitCode: 0, stdout: 'active\n' },
  ])
  await startServerOnRemote(trickyOpts, undefined, { spawn })
  const writeCmd = String(calls[0].args[calls[0].args.length - 1])
  // installPath shows up inside ExecStart= line of the unit content (safe —
  // unit body is between heredoc EOF markers, no shell interpretation).
  assert.match(writeCmd, /ExecStart=\/opt\/O'Brien\/bat-server\/bin\/bat-server/)
  // sshUser='alice' (no quote) appears in stage-2 enable-linger args; we only
  // assert no stray unbalanced single-quote in the remote-command argument.
  // Quick parity check: count of `'` in the stage-2 arg should be even.
  const enableCmd = String(calls[1].args[calls[1].args.length - 1])
  const quoteCount = (enableCmd.match(/'/g) ?? []).length
  assert.equal(quoteCount % 2, 0, `enable cmd has unbalanced quotes: ${enableCmd}`)
})

test('test8: serverPort flows through to unit BAT_REMOTE_PORT and plist EnvironmentVariables', () => {
  const customPortLinux = renderSystemdUnit({ ...baseLinux, serverPort: 9999 })
  assert.match(customPortLinux, /^Environment=BAT_REMOTE_PORT=9999/m)

  const customPortDarwin = renderLaunchdPlist({ ...baseDarwin, serverPort: 9999 })
  assert.match(customPortDarwin, /<key>BAT_REMOTE_PORT<\/key>\s*<string>9999<\/string>/)

  // default port (when undefined) is 51820
  const defaultPort = renderSystemdUnit({ ...baseLinux, serverPort: undefined })
  assert.match(defaultPort, /^Environment=BAT_REMOTE_PORT=51820/m)
})

test('test9 (bonus): heredoc EOF wrapper uses single-quoted form (D-T0286-#10)', () => {
  const cmd = buildWriteUnitCommand('~/.config/systemd/user', '~/.config/systemd/user/bat-server.service', 'unit body')
  assert.match(cmd, /<< 'EOF'\nunit body\nEOF$/)
  assert.match(cmd, /^mkdir -p '~\/\.config\/systemd\/user'/)
})

test('test10 (bonus): verify failure surfaces verify-failed errorCode + checkOutput populated', async () => {
  const { spawn } = makeScriptedSpawn([
    { exitCode: 0 },
    { exitCode: 0 },
    { exitCode: 1, stdout: 'inactive\n', stderr: 'Unit bat-server is not active\n' },
  ])
  const result = await startServerOnRemote(baseLinux, undefined, { spawn })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'verify-failed')
  assert.match(result.checkOutput ?? '', /inactive|not active/)
})
