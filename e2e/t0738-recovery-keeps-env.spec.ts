// T0738 / BUG-131: a PTY rebuilt by Terminal Server recovery keeps its env (T0525). Before T0525 the
// heartbeat recovery re-created the shells without env: the workspace env vars were gone and the
// BAT_* helper env (BAT_TERMINAL_ID / BAT_WORKSPACE_ID / BAT_REMOTE_PORT / BAT_REMOTE_TOKEN) was
// missing, so a Worker in a rebuilt tab could not notify its Tower.
//
// One isolated instance, one seeded tab in a workspace with an env var. The tab runs a node script
// that prints the env it sees (the token only as set / not set). Then the isolated instance's own
// Terminal Server is killed (`taskkill /F`, no /T, pid from the isolated userData's pid file, the
// same way t0704 does it) → recovery → the rebuilt shell prints its env again; both must match.
// The ⏻ restart half of BUG-131 is covered by t0539 (workspace env after ⏻).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only.
// Never touches the user's BAT: the server pid comes from the isolated userData and its command line
// must be this repo's dist-electron/terminal-server.js.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  TERMINAL_SERVER_SCRIPT,
  closeIsolated,
  commandLineOf,
  launchIsolated,
  readPid,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0738-env')
const WS = 'e2e-t0738-env-ws'
const TAB = 'e2e-t0738-env-tab'
const WS_ENV_KEY = 'T0738_WS_ENV'
const WS_ENV_VALUE = 'ws-env-t0738'

// argv[2] = a marker; prints one line `T0738ENV <marker> <json>`.
const ENV_SCRIPT = [
  'const e = process.env',
  `const out = { ws: e.${WS_ENV_KEY} ?? null, id: e.BAT_TERMINAL_ID ?? null, wsId: e.BAT_WORKSPACE_ID ?? null,`,
  '  port: e.BAT_REMOTE_PORT ?? null, token: e.BAT_REMOTE_TOKEN ? "set" : "unset", session: e.BAT_SESSION ?? null }',
  "console.log('T0738ENV ' + process.argv[2] + ' ' + JSON.stringify(out))",
  '',
].join('\n')

interface EnvSeen { ws: string | null; id: string | null; wsId: string | null; port: string | null; token: string; session: string | null }

function registryPid(userData: string, id: string): number | null {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(userData, 'bat-pty-registry.json'), 'utf8')) as { ptys: { id: string; pid: number }[] }
    return reg.ptys.find(p => p.id === id)?.pid ?? null
  } catch {
    return null
  }
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function killLeftoverServer(pid: number | null): Promise<void> {
  if (pid === null || !isAlive(pid)) return
  const cmd = await commandLineOf(pid)
  if (!cmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())) {
    log(`Terminal Server pid ${pid} command line does not match this repo — left alone: ${cmd.trim()}`)
    return
  }
  log(`stopping leftover Terminal Server pid ${pid}`)
  await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
}

const bufferOf = (win: Page, id: string): Promise<string> =>
  win.evaluate(async (i) => (await (window as AnyApi).electronAPI.pty.getBuffer(i))?.data ?? '', id)

/** Runs the env script in the tab and returns what it printed for `marker`. */
async function envInTab(win: Page, script: string, marker: string): Promise<EnvSeen> {
  await expect.poll(async () => (await win.evaluate(([i]) => (window as AnyApi).electronAPI.pty.write(i, ''), [TAB] as const))?.ok ?? null,
    { timeout: 20_000 }).toBe(true)
  await win.evaluate(([i, d]) => (window as AnyApi).electronAPI.pty.write(i, d), [TAB, `node "${script}" ${marker}\r`] as const)
  const re = new RegExp(`T0738ENV ${marker} (\\{[^{}]*\\})`)
  let seen: EnvSeen | null = null
  await expect.poll(async () => {
    // ConPTY may wrap the line: join the buffer's rows before matching
    const m = re.exec((await bufferOf(win, TAB)).replace(/\r?\n/g, ''))
    if (!m) return false
    try { seen = JSON.parse(m[1]) as EnvSeen } catch { return false }
    return true
  }, { timeout: 30_000 }).toBe(true)
  return seen!
}

test.skip(process.platform !== 'win32', 'kills the isolated Terminal Server with taskkill (Windows)')

test('a tab rebuilt by Terminal Server recovery keeps the workspace env and its BAT_* helper env', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0738-env-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const script = path.join(tmp, 'env.cjs').split(path.sep).join('/')
  fs.writeFileSync(script, ENV_SCRIPT)
  let inst: IsolatedInstance | undefined
  const serverPids: number[] = []
  try {
    inst = await launchIsolated('t0738-env', log)
    const { win, userData } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{
        id: WS, name: 'T0738 env', folderPath: folder, createdAt: Date.now(),
        envVars: [{ key: WS_ENV_KEY, value: WS_ENV_VALUE, enabled: true }],
      }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', title: 'T0738 env', cwd: folder }],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => registryPid(userData, TAB), { timeout: 30_000 }).not.toBeNull()
    const server = readPid(userData)
    expect(server, 'isolated Terminal Server pid file').not.toBeNull()
    serverPids.push(server!)
    expect((await commandLineOf(server!)).toLowerCase(), 'the pid is this repo\'s Terminal Server').toContain(TERMINAL_SERVER_SCRIPT.toLowerCase())
    const shell = registryPid(userData, TAB)!
    log(`Terminal Server pid ${server}, ${TAB} shell pid ${shell}`)

    const before = await envInTab(win, script, 'before')
    log(`env before recovery: ${JSON.stringify(before)}`)
    expect(before.ws).toBe(WS_ENV_VALUE)
    expect(before.id).toBe(TAB)
    expect(before.wsId).toBe(WS)
    expect(before.port).toBe(String(inst.remotePort))
    expect(before.token).toBe('set')

    await run('taskkill', ['/F', '/PID', String(server)]) // the isolated server alone, as after a crash
    log(`killed isolated Terminal Server ${server} (no /T)`)
    await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain('[PtyManager] Terminal Server recovery complete')
    await expect.poll(() => { const p = readPid(userData); return p !== null && p !== server }, { timeout: 30_000 }).toBe(true)
    serverPids.push(readPid(userData)!)
    await expect.poll(() => { const p = registryPid(userData, TAB); return p !== null && p !== shell }, { timeout: 30_000 }).toBe(true)
    const newShell = registryPid(userData, TAB)!
    log(`after recovery: Terminal Server ${readPid(userData)}, ${TAB} shell ${newShell}`)

    const after = await envInTab(win, script, 'after')
    log(`env after recovery: ${JSON.stringify(after)}`)
    expect(after, 'the rebuilt shell sees the same env as before').toEqual(before)
    const timeline = readDebugLogs(userData).split('\n')
      .filter(l => /attempting recovery|recovery:|re-fork|server spawned PTY|recovery complete/.test(l))
    log(`timeline:\n${timeline.join('\n')}`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    for (const pid of serverPids) await killLeftoverServer(pid)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
