// T0553: titles of helper-created tabs. A Worker tab reads `<agent> · Worker · T####`, its badge
// shows only `✓` once it reported, a name the user gives it wins (and brings the T0538 badge with
// the work order back), a raw command tab shows the command's file name — nothing says "Remote:".
// A tab saved with the pre-T0553 `Remote: …` title gets the new title when BAT restores it.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The Worker
// agent is a custom CLI that runs a node script printing one line and exiting — nothing starts
// an LLM. The helpers talk only to the isolated instance's RemoteServer; their logs go to a temp dir.

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0553')
const WS_A = 'e2e-t0553-ws-a'
const TOWER_A = 'e2e-t0553-tower-a'
const LEGACY = 'e2e-t0553-legacy-worker'
const WORKER_AGENT = 'e2e-t0553-worker'
const WORKER_AGENT_NAME = 'T0553 worker'

const WORKER_SCRIPT = [
  "process.stdout.write('t0553 worker ran: ' + process.argv.slice(2).join(' ') + '\\n')",
  '',
].join('\n')

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }
interface SavedTerminal { id: string; title?: string; workspaceId?: string; towerTerminalId?: string; workorder?: string; workerReport?: { message: string } }

function runHelper(script: string, env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
}

async function savedTerminals(win: Page): Promise<SavedTerminal[]> {
  const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? (JSON.parse(raw) as { terminals: SavedTerminal[] }).terminals : []
}

async function helperEnv(app: ElectronApplication, userData: string, remotePort: number, tmp: string): Promise<NodeJS.ProcessEnv> {
  await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
  const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
  const token: string = record.encrypted
    ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
    : record.data
  const env: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
  return Object.assign(env, {
    BAT_REMOTE_PORT: String(remotePort),
    BAT_REMOTE_TOKEN: token,
    BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'),
    BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'),
    BAT_USER_DATA: tmp,
  })
}

const workerThumb = (view: Locator, workorder: string) => view.locator(`.thumbnail[data-workorder="${workorder}"]`)

test('helper-created tabs: <agent> · Worker · T####, ✓ after the report, user names win, old titles renewed', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0553-'))
  const folderA = path.join(tmp, 'a')
  fs.mkdirSync(folderA, { recursive: true })
  const workerScript = path.join(tmp, 'worker.mjs').split(path.sep).join('/')
  fs.writeFileSync(workerScript, WORKER_SCRIPT)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0553', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: WORKER_AGENT_NAME, icon: 'W', color: '#888888', command: 'node', args: [workerScript],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS_A, name: 'T0553-A', folderPath: folderA, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      terminals: [
        { id: TOWER_A, workspaceId: WS_A, type: 'terminal', title: 'Tower A', cwd: folderA },
        // saved by BAT before T0553
        { id: LEGACY, workspaceId: WS_A, type: 'terminal', title: "Remote: 'C:\\Users\\me\\.local\\bin\\claude.exe'", cwd: folderA, towerTerminalId: TOWER_A, workorder: 'T0700' },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const viewA = win.locator('.workspace-container.active')
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })

    // ── 1. the old title is renewed on restore ──
    await expect(workerThumb(viewA, 'T0700').locator('.thumbnail-title')).toContainText('Claude CLI · Worker · T0700')
    await expect(workerThumb(viewA, 'T0700').locator('.worker-badge')).toHaveCount(0)

    const env = await helperEnv(app, userData, inst.remotePort, tmp)

    // ── 2. a Worker: <agent> · Worker · T####, no badge before its report ──
    const dispatch = await runHelper('bat-terminal.mjs', env, ['--notify-id', TOWER_A, '--workspace', WS_A, '--skill', 'ct-exec', '--workorder', 'T0701'], folderA)
    log(`dispatch T0701: exit=${dispatch.code}\n${dispatch.stdout}${dispatch.stderr}`)
    expect(dispatch.code, dispatch.stderr).toBe(0)
    const workerId = dispatch.terminalId!
    const worker = workerThumb(viewA, 'T0701')
    await expect(worker.locator('.thumbnail-title')).toContainText(`${WORKER_AGENT_NAME} · Worker · T0701`, { timeout: 20_000 })
    await expect(worker.locator('.worker-badge')).toHaveCount(0)
    await expect(worker.locator('.remote-origin-badge')).toHaveCount(0)

    // ── 3. a raw command tab: the command's file name (no path, no quotes) ──
    const raw = await runHelper('bat-terminal.mjs', env, ['--workspace', WS_A, process.execPath, '-v'], folderA)
    log(`raw command: exit=${raw.code}\n${raw.stdout}${raw.stderr}`)
    expect(raw.code, raw.stderr).toBe(0)
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(4, { timeout: 20_000 })
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === raw.terminalId)?.title, { timeout: 15_000 }).toBe('node')
    await expect(viewA.locator('.thumbnail-title', { hasText: 'Remote' })).toHaveCount(0)

    // ── 4. the report: ✓ only ──
    const report = await runHelper('bat-notify.mjs', env, ['--source', 'T0701', '--target', TOWER_A, '--no-pty-write', 'T0701 完成'], tmp)
    expect(report.code, report.stderr).toBe(0)
    await expect(worker.locator('.worker-badge.reported')).toHaveText('✓', { timeout: 15_000 })
    await win.screenshot({ path: test.info().outputPath('worker-title-reported.png') })

    // ── 5. the user's name wins; the badge brings the work order back ──
    await worker.click()
    // every tab of the workspace has a main panel (hidden ones too): take the Worker's
    await viewA.locator('.main-panel-title', { hasText: `${WORKER_AGENT_NAME} · Worker · T0701` }).dblclick()
    const input = viewA.locator('.terminal-name-input')
    await expect(input).toBeVisible({ timeout: 5_000 })
    await input.fill('login fix')
    await input.press('Enter')
    await expect(worker.locator('.thumbnail-title')).toContainText('login fix', { timeout: 5_000 })
    await expect(worker.locator('.worker-badge.reported')).toHaveText('✓ T0701')

    // ── 6. after a reload: the name stays, the renewed title was saved ──
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === workerId)?.title, { timeout: 40_000 }).toBe('login fix')
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(4, { timeout: 30_000 })
    await expect(workerThumb(viewA, 'T0701').locator('.thumbnail-title')).toContainText('login fix')
    await expect(workerThumb(viewA, 'T0700').locator('.thumbnail-title')).toContainText('Claude CLI · Worker · T0700')
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === LEGACY)?.title, { timeout: 40_000 }).toBe('Claude CLI · Worker · T0700')
    await win.screenshot({ path: test.info().outputPath('worker-title-after-reload.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
