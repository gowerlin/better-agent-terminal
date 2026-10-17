// PLAN-047 W1 / T0583: worktree-isolated dispatch (`--isolation worktree`) and
// `--close-worker --worktree remove|archive`.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. All git work
// happens in a temp repo (never this repo: the fixture asserts its toplevel). The Worker agent is a
// custom CLI running a node script that records `process.cwd()` and the CT_* env — no LLM. The
// helper talks only to the isolated instance's RemoteServer; its log goes to a temp dir.
//
//   1. dispatch T0583 with --isolation worktree from <repo>/pkg → exit 0, stdout worktree / branch /
//      base; the Worker runs in <tmp>/.bat-worktrees/repo/T0583/pkg with CT_HOME = <repo>; branch
//      ct/T0583 exists; the main checkout did not move
//   2. a cwd outside any git repo → exit 7 `create: WORKTREE_FAILED`, no tab
//   3. --close-worker T0583 --worktree remove → the tab closes, the worktree goes, the branch stays
//   4. dispatch T0584 isolated, relaunch BAT, --close-worker T0584 --worktree archive → found from the
//      saved tab, worktree removed, branch renamed ct-archive/T0584

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0583')
const WS = 'e2e-t0583-ws'
const TOWER = 'e2e-t0583-tower'
const WORKER_AGENT = 'e2e-t0583-worker'

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }

function runHelper(env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', 'bat-terminal.mjs'), ...args], { env, cwd, timeout: 60_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'core.longpaths=true', '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], {
    cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

const norm = (p: string) => path.resolve(p).toLowerCase()

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

async function savedTerminals(win: Page): Promise<Array<{ id: string; cwd?: string; ctWorktree?: { path: string; branch: string } }>> {
  const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? JSON.parse(raw).terminals : []
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

test('--isolation worktree runs the Worker in its own worktree; --close-worker --worktree cleans it', async () => {
  test.setTimeout(300_000)
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0583-')))
  const repo = path.join(tmp, 'repo')
  const plain = path.join(tmp, 'plain')
  const outDir = path.join(tmp, 'out')
  fs.mkdirSync(path.join(repo, 'pkg'), { recursive: true })
  fs.mkdirSync(plain)
  fs.mkdirSync(outDir)
  git(repo, 'init', '-q', '-b', 'main')
  const top = git(repo, 'rev-parse', '--show-toplevel')
  if (norm(top) !== norm(repo) || norm(top) === norm(REPO_ROOT)) throw new Error(`fixture repo is not isolated: ${top}`)
  fs.writeFileSync(path.join(repo, 'pkg', 'x.txt'), 'x\n')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'init')
  const head = git(repo, 'rev-parse', 'HEAD')

  // records where it ran: out/<work order>.json
  const workerScript = path.join(tmp, 'worker.cjs').split(path.sep).join('/')
  fs.writeFileSync(workerScript, [
    "const fs = require('fs')",
    "const wo = process.argv.slice(2).join(' ').split(/\\s+/).pop()",
    "const env = {}; for (const k of ['CT_HOME', 'CT_WORKTREE', 'CT_WORKTREE_BRANCH', 'CT_WORKTREE_BASE']) env[k] = process.env[k] ?? null",
    `fs.writeFileSync(${JSON.stringify(outDir.split(path.sep).join('/'))} + '/' + wo + '.json', JSON.stringify({ cwd: process.cwd(), env }))`,
    "process.stdout.write('t0583 worker ran: ' + wo + '\\n')",
    '',
  ].join('\n'))
  const readOut = (wo: string) => {
    const file = path.join(outDir, `${wo}.json`)
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as { cwd: string; env: Record<string, string | null> } : null
  }

  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0583', log)
    const { app, win, userData, remotePort } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0583 worker', icon: 'W', color: '#888888', command: 'node', args: [workerScript],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0583', folderPath: repo, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'Tower', cwd: repo }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    const env = await helperEnv(app, userData, remotePort, tmp)

    const dispatch = (workorder: string, cwd: string) =>
      runHelper(env, ['--notify-id', TOWER, '--workspace', WS, '--skill', 'ct-exec', '--workorder', workorder, '--isolation', 'worktree', '--cwd', cwd], cwd)

    // ── 1. isolated dispatch from a sub-directory ──
    const wt = path.join(tmp, '.bat-worktrees', 'repo', 'T0583')
    const first = await dispatch('T0583', path.join(repo, 'pkg'))
    log(`dispatch T0583: exit=${first.code}\n${first.stdout}${first.stderr}`)
    expect(first.code, first.stderr).toBe(0)
    expect(first.stdout).toContain(`  worktree: ${wt}`)
    expect(first.stdout).toContain('  branch: ct/T0583')
    expect(first.stdout).toContain(`  base: ${head}`)
    const worker = first.terminalId!
    await expect(view.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 20_000 })
    await expect.poll(() => readOut('T0583'), { timeout: 30_000 }).not.toBeNull()
    const ran = readOut('T0583')!
    log(`worker ran: ${JSON.stringify(ran)}`)
    expect(norm(ran.cwd)).toBe(norm(path.join(wt, 'pkg')))
    expect(norm(ran.env.CT_HOME!)).toBe(norm(repo))
    expect(norm(ran.env.CT_WORKTREE!)).toBe(norm(wt))
    expect(ran.env.CT_WORKTREE_BRANCH).toBe('ct/T0583')
    expect(ran.env.CT_WORKTREE_BASE).toBe(head)
    expect(git(repo, 'branch', '--list', 'ct/T0583')).toContain('ct/T0583')
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')
    expect(git(repo, 'status', '--porcelain')).toBe('')
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === worker)?.ctWorktree?.branch, { timeout: 15_000 }).toBe('ct/T0583')

    // ── 2. not a git repository → exit 7, no tab ──
    const failed = await dispatch('T0599', plain)
    log(`dispatch from a plain folder: exit=${failed.code}\n${failed.stdout}${failed.stderr}`)
    expect(failed.code).toBe(7)
    expect(failed.stderr).toContain('create: WORKTREE_FAILED')
    expect(failed.stderr).toContain('is not a git repository')
    await new Promise(r => setTimeout(r, 1_500))
    await expect(view.locator('.terminal-wrapper')).toHaveCount(2)

    // ── 3. close with --worktree remove ──
    const closed = await runHelper(env, ['--close-worker', 'T0583', '--notify-id', TOWER, '--worktree', 'remove'], tmp)
    log(`close T0583: exit=${closed.code}\n${closed.stdout}${closed.stderr}`)
    expect(closed.code, closed.stderr).toBe(0)
    expect(closed.stdout).toContain(`  worktree: remove ${wt} once the tab is closed`)
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => fs.existsSync(wt), { timeout: 30_000 }).toBe(false)
    expect(git(repo, 'branch', '--list', 'ct/T0583')).toContain('ct/T0583')
    expect(git(repo, 'worktree', 'list')).not.toContain('T0583')
    await expect.poll(() => readDebugLogs(userData), { timeout: 10_000 }).toContain(`→ removed ${wt} (branch ct/T0583); branch kept`)

    // ── 4. isolated Worker, relaunch, close with --worktree archive (saved tab) ──
    const wt2 = path.join(tmp, '.bat-worktrees', 'repo', 'T0584')
    const second = await dispatch('T0584', repo)
    expect(second.code, second.stderr).toBe(0)
    const worker2 = second.terminalId!
    await expect.poll(() => readOut('T0584'), { timeout: 30_000 }).not.toBeNull()
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === worker2)?.ctWorktree?.branch, { timeout: 15_000 }).toBe('ct/T0584')
    const { runtimeId } = inst
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    relaunched = await launchIsolated('t0583', log, { runtimeId })
    const { app: app2, win: win2, userData: userData2 } = relaunched
    await expect.poll(async () => (await savedTerminals(win2)).map(t => t.id), { timeout: 30_000 }).toEqual(expect.arrayContaining([TOWER, worker2]))
    const view2 = win2.locator('.workspace-container.active')
    await expect(view2.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    const env2 = await helperEnv(app2, userData2, relaunched.remotePort, tmp)
    const deadline = Date.now() + 60_000
    let archived: HelperRun
    for (;;) {
      archived = await runHelper(env2, ['--close-worker', 'T0584', '--notify-id', TOWER, '--worktree', 'archive'], tmp)
      if (archived.code !== 3 || Date.now() > deadline) break
      await new Promise(r => setTimeout(r, 1_000)) // the restored PTY is not up yet
    }
    log(`close T0584 after relaunch: exit=${archived.code}\n${archived.stdout}${archived.stderr}`)
    expect(archived.code, archived.stderr).toBe(0)
    expect(archived.stdout).toContain(`  worktree: archive ${wt2} once the tab is closed`)
    await expect(view2.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 60_000 })
    await expect.poll(() => fs.existsSync(wt2), { timeout: 30_000 }).toBe(false)
    expect(git(repo, 'branch', '--list', 'ct/T0584')).toBe('')
    expect(git(repo, 'branch', '--list', 'ct-archive/T0584')).toContain('ct-archive/T0584')
    expect(readDebugLogs(userData2)).toContain(`ownership from the saved tab (tower=${TOWER})`)
    await win2.screenshot({ path: test.info().outputPath('after-archive.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
