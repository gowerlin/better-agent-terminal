// BUG-152 / T0599 (D154): a Worker tab a helper dispatches does not take the keyboard focus.
//
// Before T0599 `addExternalTerminal` focused a tab that landed in the active workspace (BUG-135 /
// T0532), so whatever the user was typing into the Tower tab went to the new Worker tab. Since
// T0599 a tab whose `terminal:created-externally` came from a helper (capability connection,
// `dispatchedByHelper`) is added — list, thumbnail, title — without changing the focused tab.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The helper
// runs INSIDE the Tower tab with that tab's own env (its `batcap.` capability), like a Tower does;
// the Worker agent is a custom CLI running `echo` — nothing here starts an LLM. The user's typing
// is real keyboard input (Playwright) into whatever has the focus.

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0599')
const WS = 'e2e-t0599-ws'
const TOWER = 'e2e-t0599-tower'
const ECHO_AGENT = 'e2e-t0599-echo-agent'
const MARKER = 'T0599-WORKER-RAN'
const TYPED = 'T0599TYPED'

interface HelperResult { code: number | null; stdout: string; stderr: string; token?: string }

/**
 * `node runner.cjs <spec.json>`: runs `node $BAT_HELPER_DIR/bat-terminal.mjs ...args` with this
 * tab's env (`$BAT_TERMINAL_ID` in args replaced) and writes the result to `spec.out` via a temp
 * file + rename, so the test never reads half a file.
 */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const env = process.env
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const args = spec.args.map(a => String(a).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || ''))
const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-terminal.mjs'), ...args], { env, encoding: 'utf8', timeout: 30000, windowsHide: true })
const out = { code: run.status, stdout: run.stdout, stderr: run.stderr, token: (env.BAT_REMOTE_TOKEN || '').slice(0, 7) }
fs.writeFileSync(spec.out + '.tmp', JSON.stringify(out))
fs.renameSync(spec.out + '.tmp', spec.out)
`

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

// eslint-disable-next-line no-control-regex
const plain = (s: string) => s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')

test('helper dispatch from the Tower tab: the focus and the typing stay in the Tower tab', async () => {
  test.setTimeout(180_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0599-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)
  const resultFile = slash(path.join(tmp, 'dispatch.json'))
  const spec = slash(path.join(tmp, 'dispatch-spec.json'))
  fs.writeFileSync(spec, JSON.stringify({
    out: resultFile,
    args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--agent', ECHO_AGENT, '--skill', 'ct-exec', '--workorder', 'T0599', '--mode', 'yolo'],
  }))

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0599', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: ECHO_AGENT, name: 'T0599 echo', icon: 'E', color: '#888888', command: 'echo', args: [MARKER],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0599', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'Tower', cwd: folder }],
      activeTerminalId: TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TOWER), { timeout: 30_000 }).not.toBeNull()
    // give the shell time to print its prompt before the first typed line
    await win.waitForTimeout(2_000)

    // every tab's output, and the id of the tab `terminal:created-externally` adds
    await win.evaluate(() => {
      const w = window as AnyApi
      const api = w.electronAPI
      w.__t0599Out = {} as Record<string, string>
      api.pty.onOutput((id: string, data: string) => { w.__t0599Out[id] = (w.__t0599Out[id] ?? '') + data })
      w.__t0599Created = new Promise<{ id: string; dispatchedByHelper?: boolean }>((resolve) => {
        const off = api.pty.onCreatedExternally((info: { id: string; dispatchedByHelper?: boolean }) => { off(); resolve(info) })
      })
    })
    const output = async (id: string) => plain(await win.evaluate((tid) => (window as AnyApi).__t0599Out[tid] ?? '', id))

    // The user is in the Tower tab
    const towerInput = view.locator('.terminal-wrapper.active .xterm-helper-textarea')
    await towerInput.focus()
    const focusIsInActiveTab = () => win.evaluate(() => {
      const active = document.querySelector('.workspace-container.active .terminal-wrapper.active')
      return !!active && !!document.activeElement && active.contains(document.activeElement)
    })
    expect(await focusIsInActiveTab()).toBe(true)

    // The Tower dispatches a Worker from inside its own tab (its capability, not the server token)
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TOWER, line: `node "${runner}" "${spec}"\r` })
    const created = await win.evaluate(() => (window as AnyApi).__t0599Created) as { id: string; dispatchedByHelper?: boolean }
    log(`created-externally: ${JSON.stringify(created)}`)
    expect(created.dispatchedByHelper).toBe(true)
    const worker = created.id

    // The Worker tab is in the list; the Tower tab is still the one shown, with the keyboard focus
    await expect(view.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    await expect(view.locator('.terminal-wrapper.active')).toHaveCount(1)
    // xterm focuses on a requestAnimationFrame after a tab becomes active — let those run
    await win.waitForTimeout(500)
    expect(await focusIsInActiveTab()).toBe(true)
    // the tab shown is the Tower's (the first wrapper; the Worker's was appended after it)
    expect(await win.evaluate(() => {
      const wrappers = [...document.querySelectorAll('.workspace-container.active .terminal-wrapper')]
      return wrappers.findIndex(w => w.classList.contains('active'))
    })).toBe(0)

    await expect.poll(() => fs.existsSync(resultFile), { timeout: 60_000 }).toBe(true)
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8')) as HelperResult
    log(`dispatch: exit=${result.code} token=${result.token}…\n${result.stdout}${result.stderr}`)
    expect(result.code, result.stderr).toBe(0)
    expect(result.token).toBe('batcap.')
    expect(/Terminal created: (\S+)/.exec(result.stdout)?.[1]).toBe(worker)

    // The Worker ran its launch command (pwsh's echo prints each argument on a line of its own)
    const ran = (text: string) => {
      const lines = text.split(/\r?\n/).map(l => l.trim())
      return lines.includes(`${MARKER} /ct-exec T0599`) || (lines.includes(MARKER) && lines.includes('/ct-exec T0599'))
    }
    try {
      await expect.poll(async () => ran(await output(worker)), { timeout: 30_000 }).toBe(true)
    } finally {
      log(`worker output:\n${await output(worker)}`)
    }

    // What the user types now goes to the Tower PTY only
    expect(await focusIsInActiveTab()).toBe(true)
    await win.keyboard.type(`echo ${TYPED}`)
    await win.keyboard.press('Enter')
    try {
      await expect.poll(async () => (await output(TOWER)).split(/\r?\n/).some(l => l.trim() === TYPED), { timeout: 20_000 }).toBe(true)
    } finally {
      log(`tower output:\n${await output(TOWER)}`)
    }
    expect(await output(worker)).not.toContain(TYPED)

    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[T0130] External terminal added: id=${worker}`)
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
