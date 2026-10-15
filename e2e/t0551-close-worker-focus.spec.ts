// BUG-140 / T0551: a `--close-worker` delay is cancelled only by what the user types into the
// Worker tab — not by xterm's own replies to the program (focus in / out reports, DSR / DA).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The Worker
// agent is a custom CLI running a node script that turns on focus reporting (DECSET 1004, like
// the claude CLI's TUI) and asks for the cursor position (DSR 6), then stays quiet — nothing
// starts an LLM. The helper talks only to the isolated instance's RemoteServer.
//
//   1. scheduled close with a delay; during it the user switches between the Worker and Tower
//      tabs and to the other workspace and back → xterm writes focus reports into the Worker PTY
//      (what reaches the script's stdin is recorded), the tab is still closed when the delay is up
//   2. a second Worker: typing a character during the delay still cancels

import { test, expect, type Locator, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0551')
const WS_A = 'e2e-t0551-ws-a'
const WS_B = 'e2e-t0551-ws-b'
const TOWER_A = 'e2e-t0551-tower-a'
const TOWER_B = 'e2e-t0551-tower-b'
const WORKER_AGENT = 'e2e-t0551-worker'
const READY = 'T0551-WORKER-READY'

// Focus reporting on + a cursor position query, one line, then quiet. Keeps the PTY open and
// appends what reaches its stdin (raw mode) to `inputLog`, one JSON string per chunk.
const workerSource = (inputLog: string): string => [
  "const fs = require('fs')",
  `const INPUT_LOG = ${JSON.stringify(inputLog)}`,
  'if (process.stdin.isTTY) process.stdin.setRawMode(true)',
  "process.stdin.on('data', d => fs.appendFileSync(INPUT_LOG, JSON.stringify(d.toString('latin1')) + '\\n'))",
  `process.stdout.write('\\x1b[?1004h\\x1b[6n${READY}\\r\\n')`,
  '',
].join('\n')

const readInputLog = (file: string): string[] =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as string) : []

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }

function runHelper(env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', 'bat-terminal.mjs'), ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

async function registryTerminalIds(win: Page): Promise<string[]> {
  const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? (JSON.parse(raw) as { terminals: { id: string }[] }).terminals.map(t => t.id) : []
}

// T0553: the work order badge only shows once a Worker reported; the thumbnail carries `data-workorder`
const workerThumb = (view: Locator, workorder: string): Locator =>
  view.locator(`.thumbnail[data-workorder="${workorder}"]`)

test('focus reports and terminal replies do not cancel a delayed --close-worker; typing does', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0551-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  fs.mkdirSync(folderA, { recursive: true })
  fs.mkdirSync(folderB, { recursive: true })
  const workerScript = path.join(tmp, 'worker.cjs').split(path.sep).join('/')
  const inputLog = path.join(tmp, 'worker-input.log')
  fs.writeFileSync(workerScript, workerSource(inputLog))
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0551', log)
    const { app, win, userData, remotePort } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0551 worker', icon: 'W', color: '#888888', command: 'node', args: [workerScript],
    })).toBeTruthy()
    const seed = {
      workspaces: [
        { id: WS_A, name: 'T0551-A', folderPath: folderA, createdAt: Date.now(), defaultAgent: WORKER_AGENT },
        { id: WS_B, name: 'T0551-B', folderPath: folderB, createdAt: Date.now(), defaultAgent: WORKER_AGENT },
      ],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      terminals: [
        { id: TOWER_A, workspaceId: WS_A, type: 'terminal', title: 'Tower A', cwd: folderA },
        { id: TOWER_B, workspaceId: WS_B, type: 'terminal', title: 'Tower B', cwd: folderB },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-item', { hasText: 'T0551-B' })).toBeVisible({ timeout: 30_000 })
    const viewA = win.locator('.workspace-container.active')
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })

    await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
    const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
    const token: string = record.encrypted
      ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
      : record.data
    const env: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
    Object.assign(env, {
      BAT_REMOTE_PORT: String(remotePort),
      BAT_REMOTE_TOKEN: token,
      BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'),
      BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'),
      BAT_USER_DATA: tmp,
    })

    const dispatch = async (workorder: string) => {
      const run = await runHelper(env, ['--notify-id', TOWER_A, '--workspace', WS_A, '--skill', 'ct-exec', '--workorder', workorder], folderA)
      log(`dispatch ${workorder}: exit=${run.code}\n${run.stdout}${run.stderr}`)
      expect(run.code, run.stderr).toBe(0)
      expect(run.terminalId).toBeTruthy()
      await expect.poll(() => registryTerminalIds(win), { timeout: 20_000 }).toContain(run.terminalId)
      return run.terminalId!
    }
    const closeWorker = (workorder: string, delayMs: number) =>
      runHelper(env, ['--close-worker', workorder, '--notify-id', TOWER_A, '--delay-ms', String(delayMs)], tmp)

    // ── 1) focus switching during the delay ──
    const worker = await dispatch('T0551')
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 20_000 })
    await expect(viewA).toContainText(READY, { timeout: 30_000 })
    await workerThumb(viewA, 'T0551').click()
    await new Promise(r => setTimeout(r, 6_000)) // the Worker goes quiet (CLOSE_WORKER_IDLE_MS)
    log(`Worker stdin before the close request: ${JSON.stringify(readInputLog(inputLog))}`)

    const delayed = await closeWorker('T0551', 8000)
    log(`delayed close: exit=${delayed.code}\n${delayed.stdout}${delayed.stderr}`)
    expect(delayed.code, delayed.stderr).toBe(0)
    const inputBefore = readInputLog(inputLog).length
    for (let i = 0; i < 2; i++) {
      await viewA.locator('.thumbnail', { hasText: 'Tower A' }).click()
      await new Promise(r => setTimeout(r, 400))
      await workerThumb(viewA, 'T0551').click()
      await new Promise(r => setTimeout(r, 400))
    }
    await win.locator('.workspace-item', { hasText: 'T0551-B' }).click()
    await new Promise(r => setTimeout(r, 600))
    await win.locator('.workspace-item', { hasText: 'T0551-A' }).click()
    await new Promise(r => setTimeout(r, 600))
    // the root cause of BUG-140: switching focus makes xterm write focus reports into the PTY
    // (before T0551 the main process took them for the user typing and cancelled the close)
    await expect.poll(() => readInputLog(inputLog).length > inputBefore, { timeout: 10_000 }).toBe(true)
    const during = readInputLog(inputLog).slice(inputBefore)
    log(`Worker stdin during the delay (${during.length} chunks): ${JSON.stringify(during)}`)
    expect(during.join('')).toMatch(/^(?:\x1b\[[IO])+$/)

    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => registryTerminalIds(win), { timeout: 15_000 }).not.toContain(worker)
    expect(readDebugLogs(userData)).toContain(`[close-worker] tower=${TOWER_A} workorder=T0551 id=${worker} → close requested`)
    expect(readDebugLogs(userData)).not.toContain(`id=${worker} → cancelled`)

    // ── 2) a second Worker: typing during the delay still cancels ──
    const worker2 = await dispatch('T0552')
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 20_000 })
    await workerThumb(viewA, 'T0552').click()
    await new Promise(r => setTimeout(r, 6_000))
    const delayed2 = await closeWorker('T0552', 4000)
    expect(delayed2.code, delayed2.stderr).toBe(0)
    await viewA.locator('.terminal-wrapper.active .xterm-helper-textarea').focus()
    await win.keyboard.type('x')
    await new Promise(r => setTimeout(r, 6_000))
    expect(await registryTerminalIds(win)).toContain(worker2)
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2)
    expect(readDebugLogs(userData)).toContain(`[close-worker] tower=${TOWER_A} workorder=T0552 id=${worker2} → cancelled (user input during the delay)`)
    await win.screenshot({ path: test.info().outputPath('after-t0551.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
