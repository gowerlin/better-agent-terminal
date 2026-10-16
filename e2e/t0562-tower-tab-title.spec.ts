// T0562 / D147: `bat-terminal.mjs --set-role tower` titles the tab `<agent> · Tower`.
//   - run INSIDE a plain shell tab (BAT_TERMINAL_ID of that tab, --agent claude) → `Claude CLI · Tower`
//   - a custom CLI tab (the PTY's agent preset) → `<registry name> · Tower`
//   - a tab the user named → kept (exit 0); no such tab → exit 3 NOT_FOUND
//   - after a reload the Tower titles are still there (saved in the window registry)
//   - the user renames a Tower tab, `--set-role tower` again inside it → the name is kept
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The custom CLI
// runs a node script that prints one line and exits — nothing starts an LLM. Helpers run from the
// test talk only to the isolated instance's RemoteServer; their logs go to a temp dir.

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0562')
const WS = 'e2e-t0562-ws'
const TOWER = 'e2e-t0562-tower'
const AGENT_TAB = 'e2e-t0562-agent-tab'
const NAMED = 'e2e-t0562-named'
const CUSTOM_AGENT = 'e2e-t0562-agent'
const CUSTOM_AGENT_NAME = 'T0562 agent'
const AGENT_SCRIPT = "process.stdout.write('t0562 agent ran\\n')\n"
const HELPER = path.join(REPO_ROOT, 'scripts', 'bat-terminal.mjs').split(path.sep).join('/')

interface HelperRun { code: number | null; stdout: string; stderr: string }
interface SavedTerminal { id: string; title?: string }

function runHelper(env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [HELPER, ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr) })
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

/** `set-role` events the helper running inside a tab logged (its BAT_USER_DATA = the isolated userData). */
function inTabSetRoleEvents(userData: string): Array<Record<string, unknown>> {
  const file = path.join(userData, 'Logs', 'bat-scripts.log')
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>)
    .filter(e => e.script === 'bat-terminal' && e.event === 'set-role')
}

/** Types the helper into tab `id`'s shell (the tab's own BAT_* env: BAT_TERMINAL_ID, port, token). */
async function setRoleInTab(win: Page, id: string, extra: string): Promise<void> {
  const line = `node "${HELPER}" --set-role tower ${extra}\r`
  await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line })
}

const thumbTitle = (view: Locator, title: string) => view.locator('.thumbnail-title', { hasText: title })

test('--set-role tower: <agent> · Tower in the tab it runs in, user names kept, saved across reload', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0562-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const agentScript = path.join(tmp, 'agent.mjs').split(path.sep).join('/')
  fs.writeFileSync(agentScript, AGENT_SCRIPT)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0562', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: CUSTOM_AGENT, name: CUSTOM_AGENT_NAME, icon: 'A', color: '#888888', command: 'node', args: [agentScript],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0562', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder },
        { id: AGENT_TAB, workspaceId: WS, type: 'terminal', agentPreset: CUSTOM_AGENT, title: CUSTOM_AGENT_NAME, cwd: folder },
        { id: NAMED, workspaceId: WS, type: 'terminal', title: '我的分頁', cwd: folder },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(3, { timeout: 30_000 })
    await expect(view.locator('.thumbnail-title', { hasText: '· Tower' })).toHaveCount(0)

    // ── 1. inside the plain shell tab: BAT_TERMINAL_ID is that tab; --agent claude names it ──
    await expect.poll(async () => win.evaluate((id) => (window as AnyApi).electronAPI.pty.getCwd(id), TOWER), { timeout: 30_000 }).not.toBeNull()
    await setRoleInTab(win, TOWER, '--agent claude')
    await expect(thumbTitle(view, 'Claude CLI · Tower')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => inTabSetRoleEvents(userData).at(-1), { timeout: 15_000 }).toMatchObject({ terminalId: TOWER, role: 'tower', agent: 'claude', result: 'OK' })

    const env = await helperEnv(app, userData, inst.remotePort, tmp)

    // ── 2. a custom CLI tab: the PTY's agent preset wins over --agent ──
    const agentRun = await runHelper(env, ['--set-role', 'tower', '--terminal-id', AGENT_TAB, '--agent', 'codex'], folder)
    log(`set-role agent tab: exit=${agentRun.code}\n${agentRun.stdout}${agentRun.stderr}`)
    expect(agentRun.code, agentRun.stderr).toBe(0)
    expect(agentRun.stdout.trim()).toBe(`✓ Tower role set: ${AGENT_TAB}`)
    await expect(thumbTitle(view, `${CUSTOM_AGENT_NAME} · Tower`)).toHaveCount(1, { timeout: 15_000 })

    // ── 3. a tab the user named: exit 0, name kept ──
    const named = await runHelper(env, ['--set-role', 'tower', '--terminal-id', NAMED], folder)
    expect(named.code, named.stderr).toBe(0)
    await win.waitForTimeout(1000)
    await expect(thumbTitle(view, '我的分頁')).toHaveCount(1)

    // ── 4. no such tab: exit 3 NOT_FOUND ──
    const missing = await runHelper(env, ['--set-role', 'tower', '--terminal-id', 'e2e-t0562-nope'], folder)
    expect(missing.code).toBe(3)
    expect(missing.stderr).toContain('set-role: NOT_FOUND')
    await win.screenshot({ path: test.info().outputPath('tower-titles.png') })

    // ── 5. saved: still there after a reload ──
    await expect.poll(async () => {
      const saved = await savedTerminals(win)
      return [TOWER, AGENT_TAB, NAMED].map(id => saved.find(t => t.id === id)?.title)
    }, { timeout: 40_000 }).toEqual(['Claude CLI · Tower', `${CUSTOM_AGENT_NAME} · Tower`, '我的分頁'])
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(3, { timeout: 30_000 })
    await expect(thumbTitle(view, 'Claude CLI · Tower')).toHaveCount(1)
    await expect(thumbTitle(view, `${CUSTOM_AGENT_NAME} · Tower`)).toHaveCount(1)
    await expect(thumbTitle(view, '我的分頁')).toHaveCount(1)
    // the reloaded renderer finds the Terminal Server PTYs still running: keep them (the Tower shell)
    const recover = win.locator('.recovery-prompt-dialog .btn-primary')
    if (await recover.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false)) await recover.click()
    await expect(win.locator('.recovery-prompt-overlay')).toHaveCount(0, { timeout: 10_000 })
    await expect(thumbTitle(view, 'Claude CLI · Tower')).toHaveCount(1)

    // ── 6. the user renames the Tower tab; --set-role tower again inside it → the name is kept ──
    await thumbTitle(view, 'Claude CLI · Tower').click()
    await view.locator('.main-panel-title', { hasText: 'Claude CLI · Tower' }).dblclick()
    const input = view.locator('.terminal-name-input')
    await expect(input).toBeVisible({ timeout: 5_000 })
    await input.fill('CT 塔台')
    await input.press('Enter')
    await expect(thumbTitle(view, 'CT 塔台')).toHaveCount(1, { timeout: 5_000 })
    const before = inTabSetRoleEvents(userData).length
    await expect.poll(async () => win.evaluate((id) => (window as AnyApi).electronAPI.pty.getCwd(id), TOWER), { timeout: 30_000 }).not.toBeNull()
    await setRoleInTab(win, TOWER, '--agent claude')
    await expect.poll(() => inTabSetRoleEvents(userData).length, { timeout: 30_000 }).toBeGreaterThan(before)
    expect(inTabSetRoleEvents(userData).at(-1)).toMatchObject({ terminalId: TOWER, result: 'OK' })
    await win.waitForTimeout(1000)
    await expect(thumbTitle(view, 'CT 塔台')).toHaveCount(1)
    await expect(view.locator('.thumbnail-title', { hasText: 'Claude CLI · Tower' })).toHaveCount(0)
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === TOWER)?.title, { timeout: 40_000 }).toBe('CT 塔台')
    await win.screenshot({ path: test.info().outputPath('tower-title-user-name.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
