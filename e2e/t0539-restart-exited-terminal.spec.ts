// T0539 / BUG-137: ⏻ (restart) on a tab whose process is gone.
//
// Before T0539 `pty:restart` answered false when PtyManager had no instance for the id (after
// `pty:kill`, or after the shell exited on its own) and the renderer did not look at it, so the
// tab stayed at `[Process exited …]`. Now the renderer creates a new PTY with the same id (the
// way a new tab is created: workspace env, workspaceId, agentPreset) and re-runs a
// terminal-driven agent's launch command. A tab whose process is alive restarts as before.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The agent
// is a custom CLI running a node script that appends BAT_TERMINAL_ID + a workspace env var to a
// temp jsonl — nothing starts an LLM.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0539')
const WS = 'e2e-t0539-ws'
const SHELL_LIVE = 'e2e-t0539-shell-live'
const SHELL_KILLED = 'e2e-t0539-shell-killed'
const SHELL_EXITED = 'e2e-t0539-shell-exited'
const AGENT_TAB = 'e2e-t0539-agent'
const ECHO_AGENT = 'e2e-t0539-echo'
const WS_ENV_KEY = 'T0539_WS_ENV'
const WS_ENV_VALUE = 'ws-env-t0539'
const TITLES: Record<string, string> = {
  [SHELL_LIVE]: 'T0539 live',
  [SHELL_KILLED]: 'T0539 killed',
  [SHELL_EXITED]: 'T0539 exited',
  [AGENT_TAB]: 'T0539 agent',
}

// argv[2] = the jsonl file. One line per launch.
const DUMP_SCRIPT = [
  "import fs from 'node:fs'",
  `fs.appendFileSync(process.argv[2], JSON.stringify({ id: process.env.BAT_TERMINAL_ID ?? null, wsEnv: process.env.${WS_ENV_KEY} ?? null }) + '\\n')`,
  '',
].join('\n')

const ptyWrite = (win: Page, id: string, data: string): Promise<{ ok: boolean; reason?: string } | null> =>
  win.evaluate(([i, d]) => (window as AnyApi).electronAPI.pty.write(i, d), [id, data] as const)
const ptyKill = (win: Page, id: string): Promise<unknown> =>
  win.evaluate((i) => (window as AnyApi).electronAPI.pty.kill(i), id)
const ptyRestart = (win: Page, id: string): Promise<unknown> =>
  win.evaluate((i) => (window as AnyApi).electronAPI.pty.restart(i, ''), id)
const bufferOf = (win: Page, id: string): Promise<string> =>
  win.evaluate(async (i) => (await (window as AnyApi).electronAPI.pty.getBuffer(i))?.data ?? '', id)

async function clickRestart(win: Page, id: string): Promise<void> {
  await win.locator('.thumbnail', { hasText: TITLES[id] }).first().click().catch(() => undefined)
  const panel = win.locator('.terminal-wrapper.active .main-panel')
  await expect(panel.locator('.main-panel-title')).toContainText(TITLES[id], { timeout: 10_000 })
  await panel.getByTitle('Restart terminal').click()
  await win.getByRole('button', { name: 'Confirm Restart' }).click()
}

/** Types `node -e` that prints a marker + the workspace env var, waits for it in the replay buffer. */
async function expectShellAlive(win: Page, id: string, mark: string): Promise<void> {
  await expect.poll(async () => (await ptyWrite(win, id, ''))?.ok ?? null, { timeout: 15_000 }).toBe(true)
  await ptyWrite(win, id, `node -e "console.log('${mark}=' + process.env.${WS_ENV_KEY})"\r`)
  await expect.poll(() => bufferOf(win, id), { timeout: 15_000 }).toContain(`${mark}=${WS_ENV_VALUE}`)
}

test('⏻ restarts a tab whose process was killed or exited; a live tab restarts as before', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0539-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const dumpScript = path.join(tmp, 'launch-dump.mjs').split(path.sep).join('/')
  const dumpFile = path.join(tmp, 'launch.jsonl').split(path.sep).join('/')
  fs.writeFileSync(dumpScript, DUMP_SCRIPT)
  const launchesOf = (id: string): Array<{ id: string; wsEnv: string | null }> => {
    if (!fs.existsSync(dumpFile)) return []
    return fs.readFileSync(dumpFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter((l: { id: string }) => l.id === id)
  }
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0539', log)
    const { win } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: ECHO_AGENT, name: ECHO_AGENT, icon: 'E', color: '#888888', command: 'node', args: [dumpScript, dumpFile],
    })).toBeTruthy()
    await win.evaluate(async (patch) => {
      const a = (window as AnyApi).electronAPI
      const raw = await a.settings.load()
      await a.settings.save(JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), ...patch }))
    }, { createDefaultAgentTerminal: false, agentAutoCommand: true, defaultTerminalCount: 1, language: 'en' })
    const seed = {
      workspaces: [{
        id: WS, name: 'T0539', folderPath: folder, createdAt: Date.now(),
        envVars: [{ key: WS_ENV_KEY, value: WS_ENV_VALUE, enabled: true }],
      }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: SHELL_LIVE, workspaceId: WS, type: 'terminal', title: TITLES[SHELL_LIVE], cwd: folder },
        { id: SHELL_KILLED, workspaceId: WS, type: 'terminal', title: TITLES[SHELL_KILLED], cwd: folder },
        { id: SHELL_EXITED, workspaceId: WS, type: 'terminal', title: TITLES[SHELL_EXITED], cwd: folder },
        { id: AGENT_TAB, workspaceId: WS, type: 'terminal', title: TITLES[AGENT_TAB], cwd: folder, agentPreset: ECHO_AGENT },
      ],
      activeTerminalId: SHELL_LIVE,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.terminal-wrapper.active .main-panel')).toBeVisible({ timeout: 30_000 })
    for (const id of [SHELL_LIVE, SHELL_KILLED, SHELL_EXITED]) await expectShellAlive(win, id, `boot-${id}`)
    await expect.poll(() => launchesOf(AGENT_TAB).length, { timeout: 30_000 }).toBe(1)
    log('restored: three shells answer, the agent tab launched once')

    // ── live tab: unchanged ──
    await clickRestart(win, SHELL_LIVE)
    await expectShellAlive(win, SHELL_LIVE, 'live-after')
    log('live shell: ⏻ restarts it (restart path unchanged)')

    // ── ① killed ──
    expect(await ptyKill(win, SHELL_KILLED)).toBe(true)
    const killedWrite = await ptyWrite(win, SHELL_KILLED, '')
    const killedRestart = await ptyRestart(win, SHELL_KILLED)
    log(`① after pty:kill: pty:write → ${JSON.stringify(killedWrite)}, pty:restart → ${JSON.stringify(killedRestart)}`)
    expect(killedWrite?.ok).toBe(false)
    expect(killedRestart).toBe(false)
    await clickRestart(win, SHELL_KILLED)
    await expectShellAlive(win, SHELL_KILLED, 'killed-after')
    log('① killed shell: ⏻ starts a new shell with the workspace env')

    // ── ② shell exits on its own ──
    await ptyWrite(win, SHELL_EXITED, 'exit\r')
    await expect.poll(async () => (await ptyWrite(win, SHELL_EXITED, ''))?.ok ?? null, { timeout: 15_000 }).toBe(false)
    const exitedRestart = await ptyRestart(win, SHELL_EXITED)
    log(`② after exit: pty:restart → ${JSON.stringify(exitedRestart)}`)
    expect(exitedRestart).toBe(false)
    await clickRestart(win, SHELL_EXITED)
    await expectShellAlive(win, SHELL_EXITED, 'exited-after')
    log('② exited shell: ⏻ starts a new shell with the workspace env')

    // ── terminal-driven agent: live restart re-runs the launch command; so does a killed one ──
    await clickRestart(win, AGENT_TAB)
    await expect.poll(() => launchesOf(AGENT_TAB).length, { timeout: 30_000 }).toBe(2)
    expect(await ptyKill(win, AGENT_TAB)).toBe(true)
    await clickRestart(win, AGENT_TAB)
    await expect.poll(() => launchesOf(AGENT_TAB).length, { timeout: 30_000 }).toBe(3)
    for (const l of launchesOf(AGENT_TAB)) expect(l.wsEnv).toBe(WS_ENV_VALUE)
    log('agent tab: launch command re-run after a live restart and after a killed one')
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
