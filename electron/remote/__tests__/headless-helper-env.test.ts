// @vitest-environment node
/**
 * T0433 (PLAN-036 P3 / K, T0420 方案 A'): headless PTYs get a helper env carrying their own
 * capability — never the server token — and the helpers work with it.
 *
 * Unit: `buildHeadlessHelperEnv` (keys, tower / worker binding, when nothing is issued).
 * Wire (T0388 harness: in-process server + wss + real node-pty): a PTY dumps its real env
 * to a file, then the real `bat-terminal.mjs` / `bat-notify.mjs` run with exactly that env:
 *   - env: BAT_REMOTE_PORT / BAT_REMOTE_TOKEN (= capability) / BAT_SERVER_CERT_PATH /
 *     BAT_HELPER_DIR / BAT_HELPER_LOG_DIR; no value contains the server token; inherited
 *     BAT_* scrubbed
 *   - tower PTY → bat-terminal creates a worker (created-externally); the worker's env holds
 *     a worker capability bound to the tower; bat-notify from it reaches the BAT client
 *   - codex not detected on the server → bat-terminal exits 1 with AGENT_UNAVAILABLE
 *   - PTY kill revokes the capability that was in its env
 *   - helper log lands in <dataDir>/Logs (BAT_HELPER_LOG_DIR), without the capability
 */
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { agentRegistry } from '../../agent-runtime/agent-registry'
import { PROBE_BEGIN_MARKER, PROBE_END_MARKER, type ProbeExecFile } from '../../remote-tools/probe-script'
import { buildHeadlessHelperEnv, type HeadlessHelperEndpoint } from '../headless-entry'
import { HelperCapabilityRegistry } from '../helper-capability'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const REPO_SCRIPTS = path.resolve(__dirname, '..', '..', '..', 'scripts')
const ECHO_AGENT = 't0433-echo-agent'
const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const HELPER_KEYS = ['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_SERVER_CERT_PATH', 'BAT_HELPER_DIR', 'BAT_HELPER_LOG_DIR']
const INHERITED_SECRET = 't0433-inherited-must-not-reach-the-pty'

// ── unit ──

describe('buildHeadlessHelperEnv (T0433)', () => {
  const endpoint: HeadlessHelperEndpoint = { port: 9877, certPath: '/data/server-cert.json', logDir: '/data/Logs' }
  const all = () => true

  it('tower PTY: issues a tower capability and returns exactly the helper keys', () => {
    const registry = new HelperCapabilityRegistry()
    const env = buildHeadlessHelperEnv({ id: 'tower-1', customEnv: {}, capabilities: registry, endpoint, helperDir: '/opt/bat/scripts', exists: all })
    expect(Object.keys(env).sort()).toEqual([...HELPER_KEYS].sort())
    expect(env).toMatchObject({
      BAT_REMOTE_PORT: '9877',
      BAT_SERVER_CERT_PATH: '/data/server-cert.json',
      BAT_HELPER_DIR: '/opt/bat/scripts',
      BAT_HELPER_LOG_DIR: '/data/Logs',
    })
    expect(registry.verify(env.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: 'tower-1', role: 'tower' })
  })

  it('worker PTY (BAT_TOWER_TERMINAL_ID): the capability is bound to that tower', () => {
    const registry = new HelperCapabilityRegistry()
    const env = buildHeadlessHelperEnv({ id: 'w-1', customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-1' }, capabilities: registry, endpoint, helperDir: '/s', exists: all })
    expect(registry.verify(env.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: 'w-1', towerId: 'tower-1', role: 'worker' })
  })

  it('issues nothing when the helpers could not work: no endpoint, no helper dir, helpers missing, refused id', () => {
    const registry = new HelperCapabilityRegistry()
    const base = { customEnv: {}, capabilities: registry, helperDir: '/s', exists: all }
    expect(buildHeadlessHelperEnv({ ...base, id: 'a', endpoint: null })).toEqual({})
    expect(buildHeadlessHelperEnv({ ...base, id: 'b', endpoint, helperDir: undefined })).toEqual({})
    expect(buildHeadlessHelperEnv({ ...base, id: 'c', endpoint, exists: p => !p.endsWith('bat-notify.mjs') })).toEqual({})
    expect(buildHeadlessHelperEnv({ ...base, id: 'bad id', endpoint })).toEqual({})
    expect(buildHeadlessHelperEnv({ ...base, id: 'd', endpoint, customEnv: { BAT_TOWER_TERMINAL_ID: '../x;rm' } })).toEqual({})
    expect(registry.size).toBe(0)
  })
})

// ── wire ──

const LOGIN_NO_CODEX = [
  PROBE_BEGIN_MARKER,
  'env.uname_s=Linux',
  'env.arch=x86_64',
  'env.os_id=ubuntu',
  'env.pkg=apt-get',
  'env.priv=passwordless',
  'tool.git.state=found',
  'tool.git.path=/usr/bin/git',
  'tool.git.version=git version 2.43.0',
  PROBE_END_MARKER,
].join('\n')
const SERVER_NO_CODEX = [PROBE_BEGIN_MARKER, 'tool.git.state=found', 'tool.git.path=/usr/bin/git', PROBE_END_MARKER].join('\n')
const fakeExecFile: ProbeExecFile = (_file, args, _options, cb) => {
  queueMicrotask(() => cb(null, args[0] === '-l' ? LOGIN_NO_CODEX : SERVER_NO_CODEX, ''))
  return { stdin: { end: () => {} } }
}

let seq = 0
const termId = (label: string) => `t0433-${label}-${process.pid}-${seq++}`

let tmpDir: string
let dumpScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness
let savedInherited: string | undefined

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0433-env-'))
  dumpScript = path.join(tmpDir, 'dump-env.cjs')
  fs.writeFileSync(
    dumpScript,
    "const fs = require('fs'); const out = process.argv[2];\n" +
      "fs.writeFileSync(out + '.tmp', JSON.stringify(process.env)); fs.renameSync(out + '.tmp', out);\n",
  )
  savedInherited = process.env.BAT_REMOTE_TOKEN
  process.env.BAT_REMOTE_TOKEN = INHERITED_SECRET
  agentRegistry.registerCustomCli({ id: ECHO_AGENT, name: 'T0433 echo', icon: 'x', color: '#000', command: 'echo' })
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry, remoteTools: { execFile: fakeExecFile, platform: 'linux' } })
})

afterAll(async () => {
  await harness?.dispose()
  agentRegistry.removeCustomCli(ECHO_AGENT)
  if (savedInherited === undefined) delete process.env.BAT_REMOTE_TOKEN
  else process.env.BAT_REMOTE_TOKEN = savedInherited
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

async function waitForFile(file: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`timed out waiting for ${file}`)
}

/** The env PTY `id` really runs with: its shell runs node, which writes process.env to a file. */
async function dumpPtyEnv(id: string): Promise<Record<string, string>> {
  const out = path.join(tmpDir, `${id}.json`)
  await harness.invoke('pty:write', id, `node "${dumpScript}" "${out}"\r`)
  return JSON.parse(await waitForFile(out)) as Record<string, string>
}

async function createPty(id: string, customEnv?: Record<string, string>): Promise<void> {
  const result = await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}), ...(customEnv ? { customEnv } : {}) })
  expect(result).toMatchObject({ ok: true, created: true })
}

function runHelper(script: string, args: string[], env: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(env.BAT_HELPER_DIR, script), ...args], { env, cwd: CWD, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => { stdout += String(d) })
    child.stderr.on('data', d => { stderr += String(d) })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
}

const batKeys = (env: Record<string, string>) => Object.keys(env).filter(k => k.toUpperCase().startsWith('BAT_')).sort()

describe('headless PTY helper env (T0433)', () => {
  let towerId: string
  let towerEnv: Record<string, string>

  it('tower PTY: helper env with its own capability; no server token, no inherited BAT_*', async () => {
    towerId = termId('tower')
    await createPty(towerId)
    towerEnv = await dumpPtyEnv(towerId)

    // `env | grep ^BAT_ | cut -d= -f1` in a remote tab (keys only)
    expect(batKeys(towerEnv)).toEqual(
      [...HELPER_KEYS, 'BAT_SESSION', 'BAT_TERMINAL_ID', 'BAT_WORKSPACE_ID'].sort(),
    )
    expect(towerEnv.BAT_TERMINAL_ID).toBe(towerId)
    expect(towerEnv.BAT_REMOTE_PORT).toBe(String(harness.port))
    expect(towerEnv.BAT_HELPER_DIR).toBe(REPO_SCRIPTS)
    expect(towerEnv.BAT_SERVER_CERT_PATH).toBe(path.join(harness.dataDir, 'server-cert.json'))
    expect(fs.existsSync(towerEnv.BAT_SERVER_CERT_PATH)).toBe(true)
    expect(towerEnv.BAT_HELPER_LOG_DIR).toBe(path.join(harness.dataDir, 'Logs'))

    // 🔴 the server token is in no env value; the inherited BAT_REMOTE_TOKEN was scrubbed
    expect(Object.values(towerEnv).some(v => v.includes(harness.token))).toBe(false)
    expect(Object.values(towerEnv)).not.toContain(INHERITED_SECRET)
    expect(towerEnv.BAT_REMOTE_TOKEN).not.toBe(harness.token)
    expect(registry.verify(towerEnv.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: towerId, role: 'tower' })
  }, 40_000)

  it('real bat-terminal with the tower env creates a worker whose env holds a worker capability; bat-notify from it reaches the BAT client', async () => {
    const run = await runHelper('bat-terminal.mjs', ['--agent', ECHO_AGENT, '--prompt', 'T0433MARK', '--notify-id', towerId, '--workspace', 'client-ws-1', '--cwd', CWD], towerEnv)
    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)
    const [created] = await harness.waitForEvent('terminal:created-externally', args => (args[0] as { workspaceId?: string })?.workspaceId === 'client-ws-1', 10_000)
    const workerId = (created as { id: string }).id

    const workerEnv = await dumpPtyEnv(workerId)
    expect(workerEnv.BAT_TOWER_TERMINAL_ID).toBe(towerId)
    expect(Object.values(workerEnv).some(v => v.includes(harness.token))).toBe(false)
    expect(registry.verify(workerEnv.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: workerId, towerId, role: 'worker' })

    const notify = await runHelper('bat-notify.mjs', ['--source', workerId, '--target', towerId, 'T0433 完成'], workerEnv)
    expect(notify.code).toBe(0)
    const [notified] = await harness.waitForEvent('terminal:notified', args => (args[0] as { source?: string })?.source === workerId, 10_000)
    expect(notified).toMatchObject({ targetId: towerId, message: 'T0433 完成' })

    // PTY exit revokes the capability that was in its env
    await harness.invoke('pty:kill', workerId)
    expect(registry.verify(workerEnv.BAT_REMOTE_TOKEN)).toBeNull()
  }, 60_000)

  it('codex not detected on the server: bat-terminal exits 1 with AGENT_UNAVAILABLE and nothing is created', async () => {
    const before = harness.events.filter(e => e.channel === 'terminal:created-externally').length
    const run = await runHelper('bat-terminal.mjs', ['--agent', 'codex-cli', '--prompt', 'x', '--notify-id', towerId, '--cwd', CWD], towerEnv)
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/AGENT_UNAVAILABLE/)
    expect(run.stderr).toMatch(/codex is not available on this server/)
    expect(run.stdout).not.toMatch(/Terminal created/)
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(harness.events.filter(e => e.channel === 'terminal:created-externally').length).toBe(before)
  }, 30_000)

  it('the helpers log under <dataDir>/Logs, without any capability', () => {
    const log = fs.readFileSync(path.join(harness.dataDir, 'Logs', 'bat-scripts.log'), 'utf8')
    expect(log).toContain('"script":"bat-terminal"')
    expect(log).toContain('"script":"bat-notify"')
    expect(log).not.toContain(towerEnv.BAT_REMOTE_TOKEN)
    expect(log).not.toContain(harness.token)
  })

  it('killing the tower PTY revokes its capability', async () => {
    await harness.invoke('pty:kill', towerId)
    expect(registry.verify(towerEnv.BAT_REMOTE_TOKEN)).toBeNull()
  })
})
