// PLAN-050 / T0641 (D167): claude-cli tabs get `--name=<name>`, end to end in an isolated BAT.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The workspace
// name holds Chinese, a space and an apostrophe; its claude-cli custom args are `--version`, so the
// embedded claude BAT starts prints its version and exits (no TUI, no prompt, nothing starts an LLM).
//
//   1. a restored claude-cli tab (the renderer path, startClaudeCliPty) → `[bat-mcp] tab … '--name=<ws>
//      · <short id>' … name=yes`
//   2. the Tower dispatches a claude-cli Worker (`--skill ct-exec --workorder T0641`) → `[bat-mcp]
//      dispatch … '--name=<ws> · Worker · T0641' … name=yes`
//   3. custom args that name the session → no `--name=`, `name=no (user-args)`; codex → none
//   4. encoding: the `--name=` argument exactly as BAT builds it for each shell family, typed into a
//      pwsh / cmd / Git Bash tab in front of a node script that writes its argv → arrives unchanged
//      (`·` U+00B7, Chinese, the apostrophe). cmd runs in this machine's code page (recorded; 950 on
//      a Traditional Chinese Windows).
//   Windows only (the three shells); elsewhere 4. runs bash only.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0641')
const WS = 'e2e-t0641-ws'
const WS_NAME = "測試工作區 Bob's"
const TOWER = 'e2e-t0641-tower'
const CLAUDE_TAB = 'e2e-t0641-claude'
const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'

interface StepResult { kind: string; code?: number | null; stdout?: string; stderr?: string }

/** `node runner.cjs <spec.json>`: helper steps with this tab's env; results to `spec.out`. */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const env = process.env
const sub = s => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '')
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const results = []
;(async () => {
  for (const step of spec.steps) {
    if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs))
    const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: 60000, windowsHide: true })
    results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr })
  }
  fs.writeFileSync(spec.out + '.tmp', JSON.stringify(results, null, 2))
  fs.renameSync(spec.out + '.tmp', spec.out)
})()
`

/** `node dump.cjs <out> ...args`: the args as node received them, UTF-8 JSON. */
const DUMP = `require('fs').writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)), 'utf8')\n`

function readJson<T>(file: string): T | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as T : undefined
}

/** The `--name=…` word (with its quotes) at the end of BAT's launch args. */
function nameWord(args: string): string {
  const i = args.lastIndexOf('--name=')
  expect(i, args).toBeGreaterThan(-1)
  return args.slice(args[i - 1] === "'" || args[i - 1] === '"' ? i - 1 : i)
}

test('claude-cli session names: tab / dispatched Worker / user args, and the name through pwsh / cmd / bash', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0641-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  const dump = slash(path.join(tmp, 'dump.cjs'))
  fs.writeFileSync(runner, RUNNER)
  fs.writeFileSync(dump, DUMP)

  const debugLog = (userData: string) => {
    const dir = path.join(userData, 'Logs')
    return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  }
  const waitCwd = async (win: Page, id: string) =>
    expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), id), { timeout: 30_000 }).not.toBeNull()

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0641', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{
        id: WS, name: WS_NAME, folderPath: folder, createdAt: Date.now(),
        // T0529: the workspace's claude-cli args — claude prints its version and exits
        agentCustomArgs: { 'claude-cli': '--version' },
      }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder },
        { id: CLAUDE_TAB, workspaceId: WS, type: 'terminal', title: 'Claude CLI', agentPreset: 'claude-cli', cwd: folder },
      ],
      activeTerminalId: TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await waitCwd(win, TOWER)

    // ── 1. the restored claude-cli tab (renderer path) ──
    const tabName = `${WS_NAME} · e2et06`
    await expect.poll(() => debugLog(userData).includes(`[bat-mcp] tab agent=claude-cli terminal=${CLAUDE_TAB} → injected:`), { timeout: 30_000 }).toBe(true)
    const tabLine = debugLog(userData).split('\n').find(l => l.includes(`[bat-mcp] tab agent=claude-cli terminal=${CLAUDE_TAB} → injected:`))!
    log(`tab: ${tabLine}`)
    expect(tabLine).toMatch(/; name=yes$/)
    expect(tabLine).toContain(`--name=${tabName.replace(/'/g, "''")}'`)

    // ── 2. a dispatched claude Worker ──
    const out = slash(path.join(tmp, 'tower.json'))
    const spec = slash(path.join(tmp, 'tower-spec.json'))
    fs.writeFileSync(spec, JSON.stringify({ out, steps: [
      { script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0641', '--agent', 'claude-cli', '--mode', 'yolo'] },
    ] }))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TOWER, line: `node "${runner}" "${spec}"\r` })
    await expect.poll(() => fs.existsSync(out), { timeout: 90_000 }).toBe(true)
    const [role, dispatched] = readJson<StepResult[]>(out)!
    expect(role.code, role.stderr).toBe(0)
    expect(dispatched.code, dispatched.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatched.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    await expect.poll(() => debugLog(userData).includes(`[bat-mcp] dispatch agent=claude-cli terminal=${worker} → injected:`), { timeout: 30_000 }).toBe(true)
    const workerLine = debugLog(userData).split('\n').find(l => l.includes(`[bat-mcp] dispatch agent=claude-cli terminal=${worker} → injected:`))!
    log(`worker: ${workerLine}`)
    expect(workerLine).toMatch(/; name=yes$/)
    expect(workerLine).toContain(`--name=${`${WS_NAME} · Worker · T0641`.replace(/'/g, "''")}'`)

    // ── 3. user args / codex ──
    const user = await win.evaluate(async () => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', 'pwsh', '--version --name mine', 'e2e-t0641-user', 'x · user01'))
    expect(user).not.toContain('--name=')
    const codex = await win.evaluate(async () => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('codex-cli', 'pwsh', '', 'e2e-t0641-codex', 'x · codex1'))
    expect(codex).not.toContain('--name')
    await expect.poll(() => debugLog(userData).includes('[bat-mcp] tab agent=claude-cli terminal=e2e-t0641-user → injected:'), { timeout: 10_000 }).toBe(true)
    expect(debugLog(userData).split('\n').find(l => l.includes('terminal=e2e-t0641-user'))).toMatch(/; name=no \(user-args\)$/)

    // ── 4. the name through each shell, as BAT quotes it ──
    const name = `${WS_NAME} · Worker · T0641`
    const shells: Array<{ id: string; family: 'pwsh' | 'cmd' | 'posix'; shell?: string }> = process.platform === 'win32'
      ? [
          { id: 'e2e-t0641-pwsh', family: 'pwsh' },
          { id: 'e2e-t0641-cmd', family: 'cmd', shell: 'cmd.exe' },
          ...(fs.existsSync(GIT_BASH) ? [{ id: 'e2e-t0641-bash', family: 'posix' as const, shell: GIT_BASH }] : []),
        ]
      : [{ id: 'e2e-t0641-bash', family: 'posix', shell: '/bin/bash' }]
    for (const s of shells) {
      expect(await win.evaluate(({ id, cwd, shell }) => (window as AnyApi).electronAPI.pty.create({ id, cwd, type: 'terminal', ...(shell ? { shell } : {}) }), { id: s.id, cwd: folder, shell: s.shell })).toBeTruthy()
      await waitCwd(win, s.id)
      await win.waitForTimeout(2_500) // the prompt (Git Bash --login is slow)
      const args = await win.evaluate(({ family, id, sessionName }) => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', family, '', id, sessionName), { family: s.family, id: s.id, sessionName: name })
      const word = nameWord(args)
      const argvFile = slash(path.join(tmp, `argv-${s.family}.json`))
      if (s.family === 'cmd') {
        const cpFile = slash(path.join(tmp, 'chcp.txt'))
        await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: s.id, line: `chcp > "${cpFile}"\r` })
        await expect.poll(() => fs.existsSync(cpFile) && fs.statSync(cpFile).size > 0, { timeout: 15_000 }).toBe(true)
        log(`cmd code page: ${/(\d+)/.exec(fs.readFileSync(cpFile, 'latin1'))?.[1] ?? 'unknown'}`)
      }
      await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: s.id, line: `node "${dump}" "${argvFile}" ${word}\r` })
      await expect.poll(() => fs.existsSync(argvFile), { timeout: 30_000 }).toBe(true)
      const argv = readJson<string[]>(argvFile)!
      log(`${s.family}: typed ${word} → argv ${JSON.stringify(argv)}`)
      expect(argv, s.family).toEqual([`--name=${name}`])
    }
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
