// PLAN-068 W8 / T0913: the integration acceptance of PLAN-068 (W0–W6, W9) in one isolated BAT — the whole
// chain a contract-2 Tower goes through, with a fake Tower TUI (e2e/fixtures/fake-line-editor.mjs, a
// raw-mode line editor: no login, no token) and a real dispatched Worker:
//
//   ① version matrix (T0902 §6′): no declared Tower / `--set-role tower` (no contract) / `--bat-contract 1`
//      / `3` / `2`, each × `_tower-state.md` `bat_contract` missing / 1 / 2 / 3 → thumbnail badge (`CT↑` /
//      `BAT↑` / none), the Inbox gate (P-1 / P-2 / P-3) or the full Inbox; the `draft` protection only for
//      the matching Tower (the others: the Worker's `--submit` lands in the user's draft, as before);
//      T0788's dialog hold (a hook `permission-request`) for a contract-1 Tower and the contract-2 one alike
//   ② the CT contract v2 lists: the fake Tower writes `awaiting_user` / `user_actions` / `reminders` → the
//      three Inbox sections and `⏸N`; answers from the Inbox reach the Tower's input as one line
//      (`U-n：<code>`, `A-n：完成`, free text); with a draft in the Tower's input the answer and a Worker
//      notification wait (📨, reason `draft`) and follow the user's own Enter, in order; while the user
//      reads (scrolled up) an answer goes at once and a notification sent with「立即送出」does not move the
//      viewport (B0); CT removes an answered item → `⏸N` drops and「最近已結」lists it
//   ③ turn cards: the real `bat-hook.mjs stop` (claude's hook JSON on stdin, `last_assistant_message`)
//      INSIDE the Tower PTY → a card in「💬」(plain text, highlighted lines), `💬N`; expand = read; pin; a
//      Worker's stop message is dropped
//   ④ `--set-role --bat-contract <n>`: the `bat-contract:` and `hooks:` lines (`none (not-launched-by-bat)`,
//      `n/a (codex)`, `ok (injected, set 2)` after a hook report), `🪝✕` and the Inbox hooks hint
//   ⑥ old calls unchanged: `--set-role tower` without `--bat-contract` and `bat-notify --submit` print the
//      same stdout / exit code as the helpers of the commit before PLAN-068 W0 (fda8a4b4, `git show`)
//
// (⑤ the headless remote path: electron/remote/__tests__/headless-tower-inbox-e2e.test.ts.)
//
// The Worker is dispatched for real (`bat-terminal.mjs --notify-id <tower>`, the test's server token, as
// e2e/t0904); its agent is e2e/fixtures/helper-job-runner.mjs, which runs the helpers INSIDE the Worker PTY
// (worker capability bound to the Tower). The Tower tab runs the same runner with the fake TUI in front, so
// the hook reports use the Tower PTY's own capability.
//
// Windows only (pwsh tabs, like e2e/t0904); `npx vite build` first. Results also go to `$T0913_RESULTS` (JSON).
import { test, expect, type Page } from '@playwright/test'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0913')
const WS = 'e2e-t0913'
const WORKER_AGENT = 'e2e-t0913-worker'
const TOWER = 'e2e-t0913-tower'
const TOWER_TITLE = 'T0913 tower'
/** The last commit before PLAN-068 W0 (4eb3d988): its helpers are the "old calls" of ⑥. */
const PRE_PLAN068 = 'fda8a4b49f2de8194799d124a8dc5f290c47eee9'
const slash = (p: string) => p.split(path.sep).join('/')

/** In the renderer: the xterm Terminal of tab `id` (TerminalPanel's ref through React's fiber; as e2e/t0904). */
const XTERM_OF = `(id) => {
  for (const el of document.querySelectorAll('.xterm')) {
    let node = el
    let key
    while (node && !(key = Object.keys(node).find(k => k.startsWith('__reactFiber$')))) node = node.parentElement
    if (!node) continue
    let fiber = node[key]
    while (fiber && !(typeof fiber.type === 'function' && fiber.memoizedProps && fiber.memoizedProps.terminalId !== undefined)) fiber = fiber.return
    if (!fiber || fiber.memoizedProps.terminalId !== id) continue
    for (let h = fiber.memoizedState; h; h = h.next) {
      const v = h.memoizedState
      if (v && v.current && v.current.buffer && v.current.buffer.active && typeof v.current.cols === 'number') return { term: v.current, el }
    }
  }
  return null
}`

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }
function runHelper(script: string, env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
}

async function viewport(win: Page, id: string): Promise<{ viewportY: number; baseY: number } | null> {
  return win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    if (!found) return null
    const b = found.term.buffer.active
    return { viewportY: b.viewportY, baseY: b.baseY }
  }, { id, src: XTERM_OF })
}

async function scrollTower(win: Page, id: string, lines: number | 'bottom'): Promise<void> {
  await win.evaluate(({ id, src, lines }) => {
    // eslint-disable-next-line no-new-func
    const t = (new Function(`return (${src})`)())(id)?.term
    if (!t) throw new Error('no xterm')
    if (lines === 'bottom') t.scrollToBottom()
    else t.scrollLines(lines)
  }, { id, src: XTERM_OF, lines })
}

/** The helpers of commit `sha` (top-level scripts/*.mjs) into `dir`, for the "old call" comparison. */
function extractHelpers(sha: string, dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
  const names = execFileSync('git', ['-C', REPO_ROOT, 'ls-tree', '--name-only', sha, 'scripts/'], { encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(s => /^scripts\/[^/]+\.mjs$/.test(s))
  for (const name of names) {
    const body = execFileSync('git', ['-C', REPO_ROOT, 'show', `${sha}:${name}`], { maxBuffer: 64 * 1024 * 1024 })
    fs.writeFileSync(path.join(dir, path.basename(name)), body)
  }
}

/** `_tower-state.md` of the fake Tower (CT contract v2 summary, T0902 §3.3); null contract = no `bat_contract`. */
function towerState(contract: number | null, lists = ''): string {
  return [
    '---',
    'schema_kind: tower-state',
    'summary_version: 1',
    ...(contract !== null ? [`bat_contract: ${contract}`] : []),
    'todo:',
    '  - "T0913 tower todo"',
    lists.trimEnd(),
    '---',
    '# Tower (T0913 e2e)',
    '',
  ].filter(line => line !== '').join('\n') + '\n'
}

const LISTS = (withU1: boolean) => [
  'next_ids:',
  '  user: "U-3"',
  '  action: "A-2"',
  'awaiting_user:',
  ...(withU1 ? [
    '  - id: "U-1"',
    '    workorder: "T0913"',
    '    kind: "decision"',
    '    source: "breakpoint-A"',
    '    summary: "T0913 decide: inbox or cards"',
    '    options: ["A inbox first", "B cards first"]',
    '    created_at: "2026-11-25T06:00:00+0800"',
  ] : []),
  '  - id: "U-2"',
  '    summary: "T0913 free answer wanted"',
  '    created_at: "2026-11-25T06:01:00+08:00"',
  'user_actions:',
  '  - id: "A-1"',
  '    title: "T0913 run the acceptance"',
  '    kind: "verify"',
  '    command: "pwsh -File e2e/manual/demo.ps1"',
  'reminders:',
  '  - id: "weekly-log-review"',
  '    title: "T0913 weekly log review"',
  '    due_at: "2000-01-01"',
].join('\n')

test.skip(process.platform !== 'win32', 'pwsh tabs and the job runner: Windows only (as e2e/t0904)')

test('T0913: PLAN-068 integration — version matrix, Inbox lists and answers, turn cards, hooks lines, old calls (fake TUI, no token)', async () => {
  test.setTimeout(900_000)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0913-'))
  const folder = path.join(tmp, 'w')
  const ctDir = path.join(folder, '_ct-workorders')
  const stateFile = path.join(ctDir, '_tower-state.md')
  const jobsDir = path.join(tmp, 'jobs')
  const tuiDir = path.join(tmp, 'tui')
  const oldHelpers = path.join(tmp, 'old-helpers')
  for (const dir of [ctDir, jobsDir, tuiDir]) fs.mkdirSync(dir, { recursive: true })
  extractHelpers(PRE_PLAN068, oldHelpers)
  const runnerScript = slash(path.join(REPO_ROOT, 'e2e', 'fixtures', 'helper-job-runner.mjs'))
  const tuiScript = slash(path.join(REPO_ROOT, 'e2e', 'fixtures', 'fake-line-editor.mjs'))
  const newTerminalHelper = path.join(REPO_ROOT, 'scripts', 'bat-terminal.mjs')
  const oldTerminalHelper = path.join(oldHelpers, 'bat-terminal.mjs')
  const results: Record<string, unknown> = {}

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0913', log)
    const { app, win, userData, remotePort } = inst
    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    const write = (id: string, data: string) => win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
    const submitted = (): Array<{ at: number; line?: string; ctrlC?: boolean }> => {
      const f = path.join(tuiDir, 'submitted.jsonl')
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
    }
    const lines = () => submitted().filter(s => s.line !== undefined).map(s => s.line!)
    const currentLine = (): string | null => {
      try {
        return JSON.parse(fs.readFileSync(path.join(tuiDir, 'line.json'), 'utf8')).line as string
      } catch {
        return null
      }
    }

    // ── workspace: one Tower tab (pwsh) in a folder with `_ct-workorders/` ──
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0913 worker', icon: 'W', color: '#888888', command: 'node', args: [runnerScript, slash(jobsDir)],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: WS, folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS, activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: TOWER_TITLE, cwd: folder }],
      activeTerminalId: TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TOWER), { timeout: 30_000 }).not.toBeNull()
    await win.waitForTimeout(2_000)

    // the fake Tower TUI in front, the job runner (hook reports with the Tower PTY's capability) beside it
    await write(TOWER, `node "${runnerScript}" "${slash(jobsDir)}" -- node "${tuiScript}" "${slash(tuiDir)}"\r`)
    await expect.poll(() => fs.existsSync(path.join(tuiDir, 'ready')) && fs.existsSync(path.join(jobsDir, `${TOWER}.ready`)), { timeout: 30_000, message: 'fake TUI ready' }).toBe(true)
    await win.waitForTimeout(1_000)

    // ── the Worker: dispatched for real; its PTY holds a worker capability bound to the Tower ──
    await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
    const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
    const token: string = record.encrypted
      ? await app.evaluate(async ({ safeStorage }, data) => (await safeStorage.decryptStringAsync(Buffer.from(data, 'base64'))).result, record.data as string)
      : record.data
    const helperEnv: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) helperEnv[k] = v
    Object.assign(helperEnv, {
      BAT_REMOTE_PORT: String(remotePort), BAT_REMOTE_TOKEN: token,
      BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'), BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'), BAT_USER_DATA: tmp,
    })
    const dispatched = await runHelper(newTerminalHelper, helperEnv, ['--notify-id', TOWER, '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0913'], folder)
    expect(dispatched.code, dispatched.stderr).toBe(0)
    const W = dispatched.terminalId!
    await expect.poll(() => fs.existsSync(path.join(jobsDir, `${W}.ready`)), { timeout: 30_000 }).toBe(true)
    expect(debugLog()).toContain(`[helper-cap] issued: terminal=${W} role=worker tower=${TOWER}`)

    const towerThumb = win.locator('.workspace-container.active .thumbnail').filter({ has: win.locator('.thumbnail-title', { hasText: TOWER_TITLE }) }).first()
    await towerThumb.click()
    await win.waitForTimeout(1_000)

    // ── jobs inside the PTYs ──
    const jobN = new Map<string, number>()
    const job = async (id: string, spec: { script: string; args?: string[]; stdin?: string }) => {
      const n = jobN.get(id) ?? 0
      jobN.set(id, n + 1)
      fs.writeFileSync(path.join(jobsDir, `${id}-${n}.json`), JSON.stringify(spec))
      const res = path.join(jobsDir, `${id}-${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 60_000, message: `job ${id}-${n}` }).toBe(true)
      return JSON.parse(fs.readFileSync(res, 'utf8')) as { code: number; stdout: string; stderr: string; startedAt: number; endedAt: number }
    }
    /** One `bat-notify --submit` from the Worker (`helpers` = an older copy of the helper directory). */
    const notify = (message: string, helpers?: string) => job(W, {
      script: helpers ? path.join(helpers, 'bat-notify.mjs') : 'bat-notify.mjs',
      args: ['--source', 'T0913', '--target', '{env:BAT_TOWER_TERMINAL_ID}', '--submit', message],
    })
    /** A claude hook of tab `id`, run for real (`bat-hook.mjs <event>`, claude's JSON on stdin). */
    const hook = (id: string, event: string, input: Record<string, unknown>) => job(id, { script: 'bat-hook.mjs', args: [event], stdin: JSON.stringify(input) })
    const declare = async (args: string[], helper = newTerminalHelper) => {
      const r = await runHelper(helper, helperEnv, ['--set-role', 'tower', '--terminal-id', TOWER, ...args], folder)
      await win.waitForTimeout(500)
      return r
    }

    // ── the Inbox (right sidebar) ──
    await win.evaluate(() => window.dispatchEvent(new CustomEvent('bat:open-dock-panel', { detail: { panel: 'inbox' } })))
    const inbox = win.locator('.inbox-panel').first()
    await expect(inbox).toBeVisible({ timeout: 15_000 })
    const setState = async (content: string | null) => {
      if (content === null) fs.rmSync(stateFile, { force: true })
      else fs.writeFileSync(stateFile, content)
      await inbox.locator('.inbox-refresh').click()
    }
    /** The Inbox after `_tower-state.md` with `bat_contract` = `state` (null = no file): 'match' or the gate code. */
    const expectInbox = async (state: number | null, expected: 'match' | 'P-1' | 'P-2' | 'P-3', label: string) => {
      await setState(state === null ? null : towerState(state))
      if (expected === 'match') {
        await expect(inbox.locator('[data-inbox-verdict]'), `${label}: state ${state} → match`).toHaveAttribute('data-inbox-verdict', 'match', { timeout: 15_000 })
        await expect(inbox.locator('.inbox-gate')).toHaveCount(0)
        await expect(inbox.locator('[data-inbox-section="decide"]')).toBeVisible()
      } else {
        await expect(inbox.locator('.inbox-gate'), `${label}: state ${state} → ${expected}`).toHaveAttribute('data-inbox-gate', expected, { timeout: 15_000 })
        await expect(inbox.locator('[data-inbox-section]')).toHaveCount(0)
      }
      // the tab title: `!` exactly when the selected Tower does not match
      const badge = win.locator('.inbox-tab-badge').first()
      if (expected === 'match') await expect(win.locator('.inbox-tab-badge.mismatch')).toHaveCount(0)
      else await expect(badge).toHaveAttribute('data-inbox-badge', '!')
    }
    const contractBadge = towerThumb.locator('.tower-contract-badge')
    const matrix: Record<string, Record<string, string>> = {}
    const runMatrix = async (label: string, expected: Array<[number | null, 'match' | 'P-1' | 'P-2' | 'P-3']>) => {
      matrix[label] = {}
      for (const [state, want] of expected) {
        await expectInbox(state, want, label)
        matrix[label][String(state ?? 'missing')] = want
      }
      log(`① ${label}: ${JSON.stringify(matrix[label])}`)
    }

    /** A draft in the Tower's input + the Worker's `--submit`: kept apart only for the matching Tower. */
    const draftCheck = async (label: string, protectedTower: boolean) => {
      const before = lines().length
      const draft = `d-${label} `
      await write(TOWER, draft)
      await expect.poll(currentLine, { timeout: 10_000 }).toBe(draft)
      const r = await notify(`T0913 ${label}`)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout).toContain('✓ Notified')
      if (!protectedTower) {
        // as before PLAN-068 (#23): the Worker's Enter submits the draft with the text
        await expect.poll(() => lines().slice(before), { timeout: 15_000, message: `${label}: merged as before` }).toEqual([`${draft}T0913 ${label}`])
        return
      }
      await win.waitForTimeout(3_000)
      expect(lines().length, `${label}: nothing submitted while the draft is there`).toBe(before)
      expect(currentLine()).toBe(draft)
      await expect(towerThumb.locator('.notify-hold-badge[data-notify-hold-reason="draft"]')).toBeVisible()
      await write(TOWER, '\r')
      await expect.poll(() => lines().slice(before), { timeout: 15_000, message: `${label}: draft, then the notification` }).toEqual([draft, `T0913 ${label}`])
      await expect(towerThumb.locator('.notify-hold-badge')).toHaveCount(0)
    }

    /** T0788 (not gated): the Tower at a permission dialog (hook) → the notification waits for the user's answer. */
    const dialogHoldCheck = async (label: string) => {
      const before = lines().length
      const mark = debugLog().length
      const h = await hook(TOWER, 'permission-request', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' })
      expect(h.code).toBe(0)
      expect(h.stdout).toBe('')
      await expect.poll(() => debugLog().slice(mark).includes(`terminal=${TOWER}`) && /→ blocked reason=permission/.test(debugLog().slice(mark)), { timeout: 15_000, message: `${label}: blocked` }).toBe(true)
      const r = await notify(`T0913 ${label}`)
      expect(r.code, r.stderr).toBe(0)
      await win.waitForTimeout(3_000)
      expect(lines().length, `${label}: held at the dialog`).toBe(before)
      expect(debugLog().slice(mark)).toMatch(new RegExp(`\\[notify-hold\\] held terminal=${TOWER} source=${W} .*reason=permission`))
      await expect(towerThumb.locator('.notify-hold-badge')).toBeVisible()
      await write(TOWER, '\r') // the user answers the dialog (here: an empty line of the TUI)
      await expect.poll(() => lines().slice(before), { timeout: 15_000, message: `${label}: sent after the answer` }).toEqual(['', `T0913 ${label}`])
    }

    // ═══ ① no declared Tower: the state file alone decides (§6′ rows "沒有已宣告塔台") ═══
    await runMatrix('no declared Tower', [[null, 'P-1'], [1, 'P-1'], [3, 'P-2']])
    await expect(inbox.locator('.inbox-gate .inbox-muted')).toHaveCount(0) // (state file present)
    await setState(null)
    await expect(inbox.locator('.inbox-gate .inbox-muted'), 'state missing note').toBeVisible({ timeout: 10_000 })
    await expectInbox(2, 'match', 'no declared Tower')
    matrix['no declared Tower']['2'] = 'match'
    await expect(contractBadge).toHaveCount(0)
    await draftCheck('notower', false)

    // ═══ ⑥ + ① `--set-role tower` without `--bat-contract`: old helper and new helper print the same ═══
    const oldRole = await declare([], oldTerminalHelper)
    const newRole = await declare([])
    results.oldCallSetRole = { old: oldRole, new: newRole }
    expect(oldRole.code, oldRole.stderr).toBe(0)
    expect(newRole.code, newRole.stderr).toBe(0)
    expect(newRole.stdout, '⑥ set-role stdout unchanged').toBe(oldRole.stdout)
    expect(newRole.stderr).toBe(oldRole.stderr)
    expect(newRole.stdout).toBe(`✓ Tower role set: ${TOWER}\n`)
    await expect(contractBadge).toHaveAttribute('data-tower-contract', 'ct-outdated', { timeout: 10_000 })
    await expect(contractBadge).toHaveText('CT↑')
    await runMatrix('undeclared', [[null, 'P-1'], [1, 'P-1'], [2, 'P-1'], [3, 'P-1']])
    await draftCheck('undeclared', false)
    // ⑥ bat-notify: the old helper and the new one, same exit code and stdout (no draft: sent at once)
    {
      const before = lines().length
      const oldN = await notify('T0913 old-helper', oldHelpers)
      const newN = await notify('T0913 new-helper')
      results.oldCallNotify = { old: oldN, new: newN }
      expect(oldN.code).toBe(0)
      expect(newN.code).toBe(oldN.code)
      expect(newN.stdout, '⑥ bat-notify stdout unchanged').toBe(oldN.stdout.replace('T0913 old-helper', 'T0913 new-helper'))
      await expect.poll(() => lines().slice(before), { timeout: 15_000 }).toEqual(['T0913 old-helper', 'T0913 new-helper'])
    }

    // ═══ ① + ④ `--bat-contract 1` ═══
    const r1 = await declare(['--bat-contract', '1'])
    expect(r1.code, r1.stderr).toBe(0)
    expect(r1.stdout).toBe(`✓ Tower role set: ${TOWER}\n  bat-contract: 2\n  hooks: none (not-launched-by-bat)\n`)
    await expect(contractBadge).toHaveAttribute('data-tower-contract', 'ct-outdated', { timeout: 10_000 })
    await expect(towerThumb.locator('.tower-hooks-badge'), '🪝✕ only for the matching Tower').toHaveCount(0)
    await runMatrix('contract 1', [[null, 'P-1'], [1, 'P-1'], [2, 'P-1'], [3, 'P-1']])
    await draftCheck('contract1', false)

    // ═══ ① + ④ `--bat-contract 3` ═══
    const r3 = await declare(['--bat-contract', '3'])
    expect(r3.code, r3.stderr).toBe(0)
    expect(r3.stdout).toBe(`✓ Tower role set: ${TOWER}\n  bat-contract: 2 (requested 3: unsupported)\n  hooks: none (not-launched-by-bat)\n`)
    await expect(contractBadge).toHaveAttribute('data-tower-contract', 'bat-outdated', { timeout: 10_000 })
    await expect(contractBadge).toHaveText('BAT↑')
    await runMatrix('contract 3', [[null, 'P-2'], [1, 'P-2'], [2, 'P-2'], [3, 'P-2']])
    await draftCheck('contract3', false)

    // ═══ ④ `--bat-contract 2 --agent codex` → `hooks: n/a (codex)`, no 🪝✕ ═══
    const rc = await declare(['--bat-contract', '2', '--agent', 'codex'])
    expect(rc.code, rc.stderr).toBe(0)
    expect(rc.stdout).toBe(`✓ Tower role set: ${TOWER}\n  bat-contract: 2\n  hooks: n/a (codex)\n`)
    await expect(contractBadge).toHaveCount(0, { timeout: 10_000 })
    await expect(towerThumb.locator('.tower-hooks-badge')).toHaveCount(0)

    // ═══ ① + ④ `--bat-contract 2` ═══
    const r2 = await declare(['--bat-contract', '2'])
    expect(r2.code, r2.stderr).toBe(0)
    expect(r2.stdout).toBe(`✓ Tower role set: ${TOWER}\n  bat-contract: 2\n  hooks: none (not-launched-by-bat)\n`)
    results.setRoleLines = { contract1: r1.stdout, contract3: r3.stdout, codex: rc.stdout, contract2: r2.stdout }
    await expect(contractBadge).toHaveCount(0)
    await expect(towerThumb.locator('.tower-hooks-badge[data-hooks-status="not-launched-by-bat"]'), '🪝✕').toBeVisible({ timeout: 10_000 })
    await expect(towerThumb.locator('.tower-hooks-badge')).toHaveText('🪝✕')
    await runMatrix('contract 2', [[null, 'P-3'], [1, 'P-3'], [3, 'P-2'], [2, 'match']])
    await expect(inbox.locator('.inbox-hooks-hint[data-inbox-hooks="not-launched-by-bat"]'), 'Inbox hooks hint').toBeVisible()
    await draftCheck('contract2', true)
    // ⑥ bat-notify held (draft): old and new helper exit 0 with the same stdout; both follow the user's Enter
    {
      const before = lines().length
      await write(TOWER, 'd-old-new ')
      await expect.poll(currentLine, { timeout: 10_000 }).toBe('d-old-new ')
      const oldN = await notify('T0913 old-held', oldHelpers)
      const newN = await notify('T0913 new-held')
      results.oldCallNotifyHeld = { old: oldN, new: newN }
      expect(oldN.code).toBe(0)
      expect(newN.code).toBe(0)
      expect(newN.stdout).toBe(oldN.stdout.replace('T0913 old-held', 'T0913 new-held'))
      await win.waitForTimeout(2_000)
      expect(lines().length).toBe(before)
      await write(TOWER, '\r')
      await expect.poll(() => lines().slice(before), { timeout: 20_000 }).toEqual(['d-old-new ', 'T0913 old-held', 'T0913 new-held'])
    }

    // ═══ ② the contract v2 lists → three sections, ⏸N, answers ═══
    await setState(towerState(2, LISTS(true)))
    await expect(inbox.locator('[data-inbox-awaiting="U-1"]')).toBeVisible({ timeout: 15_000 })
    await expect(inbox.locator('[data-inbox-awaiting="U-2"]')).toBeVisible()
    await expect(inbox.locator('[data-inbox-action="A-1"]')).toBeVisible()
    await expect(inbox.locator('[data-inbox-reminder="weekly-log-review"]')).toBeVisible()
    await expect(inbox.locator('[data-inbox-action="A-1"] .inbox-command-text')).toHaveText('pwsh -File e2e/manual/demo.ps1')
    await expect(towerThumb.locator('.inbox-awaiting-badge'), '⏸N on the Tower').toHaveAttribute('data-inbox-awaiting-count', '2', { timeout: 10_000 })
    await expect(win.locator('.inbox-tab-badge').first()).toHaveAttribute('data-inbox-badge', /^[0-9]+$/)
    results.inboxBadge = await win.locator('.inbox-tab-badge').first().getAttribute('data-inbox-badge')

    // U-1: a choice → `U-1：A` in the Tower's input, submitted
    {
      const before = lines().length
      const mark = debugLog().length
      const row = inbox.locator('[data-inbox-awaiting="U-1"]')
      await row.locator('[data-inbox-option="A"] input').check()
      await row.locator('.inbox-options .inbox-btn.primary').click()
      await expect.poll(() => lines().slice(before), { timeout: 15_000, message: '② U-1 answered' }).toEqual(['U-1：A'])
      await expect(row.locator('[data-inbox-answer-status]')).toHaveAttribute('data-inbox-answer-status', 'sent')
      expect(debugLog().slice(mark)).toMatch(new RegExp(`\\[tower-inbox\\] answer terminal=${TOWER} id=U-1 len=5 → sending`))
    }

    // A-1 with a draft in the Tower's input: the answer and a Worker notification wait, then follow the user's Enter
    {
      const before = lines().length
      await write(TOWER, 'draft-c ')
      await expect.poll(currentLine, { timeout: 10_000 }).toBe('draft-c ')
      const row = inbox.locator('[data-inbox-action="A-1"]')
      await row.locator('[data-inbox-done="A-1"]').click()
      await expect(row.locator('[data-inbox-answer-status]')).toHaveAttribute('data-inbox-answer-status', 'held', { timeout: 10_000 })
      const r = await notify('T0913 notify-c')
      expect(r.code, r.stderr).toBe(0)
      await win.waitForTimeout(3_000)
      expect(lines().length, '② nothing submitted while the draft is there').toBe(before)
      expect(currentLine(), '② the notification is not mixed into the draft').toBe('draft-c ')
      await expect(towerThumb.locator('.notify-hold-badge[data-notify-hold-reason="draft"]')).toBeVisible()
      await expect(towerThumb.locator('.notify-hold-badge')).toHaveAttribute('data-notify-hold', '2')
      await write(TOWER, '\r')
      await expect.poll(() => lines().slice(before), { timeout: 20_000, message: '② draft, answer, notification' }).toEqual(['draft-c ', 'A-1：完成', 'T0913 notify-c'])
      results.answerWithDraft = lines().slice(before)
    }

    // reading (scrolled up): an answer goes at once (`reading` does not hold answers), a notification
    // waits and「立即送出」sends it; the viewport does not move (B0)
    {
      let mark = debugLog().length
      await scrollTower(win, TOWER, -30)
      await expect.poll(() => debugLog().slice(mark).includes(`[tower-reading] terminal=${TOWER} reading=true`), { timeout: 10_000, message: '② reading reported' }).toBe(true)
      const scrolled = await viewport(win, TOWER)
      expect(scrolled!.viewportY).toBeLessThan(scrolled!.baseY)
      const before = lines().length
      const row = inbox.locator('[data-inbox-awaiting="U-2"]')
      await row.locator('.inbox-free-input').fill('ship it')
      await row.locator('.inbox-free .inbox-btn.primary').click()
      await expect.poll(() => lines().slice(before), { timeout: 15_000, message: '② the answer is not held by reading' }).toEqual(['U-2：ship it'])
      expect((await viewport(win, TOWER))!.viewportY, '② B0: the answer did not scroll').toBe(scrolled!.viewportY)
      mark = debugLog().length
      const r = await notify('T0913 notify-reading')
      expect(r.code).toBe(0)
      await expect(towerThumb.locator('.notify-hold-badge[data-notify-hold-reason="reading"]')).toBeVisible({ timeout: 10_000 })
      expect(lines().length).toBe(before + 1)
      await towerThumb.locator('.notify-hold-badge').click()
      await win.locator('[data-action="send-held-notifications-now"]').click()
      await expect.poll(() => lines().slice(before + 1), { timeout: 15_000, message: '② sent now' }).toEqual(['T0913 notify-reading'])
      expect((await viewport(win, TOWER))!.viewportY, '② B0: the notification did not scroll').toBe(scrolled!.viewportY)
      expect(debugLog().slice(mark)).toContain(`[notify-hold] send-now terminal=${TOWER}`)
      results.readingViewport = { scrolled, after: await viewport(win, TOWER) }
      await scrollTower(win, TOWER, 'bottom')
    }

    // CT removes the answered U-1 → ⏸N drops, 「最近已結」lists it
    await setState(towerState(2, LISTS(false)))
    await expect(inbox.locator('[data-inbox-awaiting="U-1"]')).toHaveCount(0, { timeout: 15_000 })
    await expect(towerThumb.locator('.inbox-awaiting-badge')).toHaveAttribute('data-inbox-awaiting-count', '1', { timeout: 10_000 })
    await expect(inbox.locator('[data-inbox-recent]')).toHaveCount(1)
    await expect(inbox.locator('.inbox-recent-item .inbox-item-id')).toContainText(['U-1'])

    // ═══ ③ turn cards: the real Stop hook inside the Tower PTY ═══
    const CARD_TEXT = ['Turn summary T0913-CARD-ONE', '⏸ 待你決定：U-2 needs a word', '<b>not bold</b>', 'end of turn'].join('\n')
    {
      const mark = debugLog().length
      const h = await hook(TOWER, 'stop', { hook_event_name: 'Stop', last_assistant_message: CARD_TEXT })
      expect(h.code).toBe(0)
      expect(h.stdout).toBe('')
      await expect(towerThumb.locator('.tower-cards-badge'), '💬1').toHaveAttribute('data-tower-cards-unread', '1', { timeout: 15_000 })
      expect(debugLog().slice(mark)).toMatch(new RegExp(`\\[tower-cards\\] terminal=${TOWER} card added source=hook bytes=\\d+`))
      // the hook report → `hooks: ok`, 🪝✕ goes
      await expect(towerThumb.locator('.tower-hooks-badge')).toHaveCount(0, { timeout: 10_000 })
      const card = inbox.locator('[data-tower-card]').first()
      await expect(card).toHaveAttribute('data-tower-card-read', 'false', { timeout: 10_000 })
      await expect(card.locator('.tower-card-preview')).toContainText('Turn summary T0913-CARD-ONE')
      await expect(card.locator('[data-tower-card-highlight="true"]').first()).toContainText('U-2 needs a word')
      await card.locator('.tower-card-toggle').click()
      await expect(card).toHaveAttribute('data-tower-card-read', 'true', { timeout: 10_000 })
      await expect(card.locator('.tower-card-body')).toContainText('<b>not bold</b>')
      await expect(card.locator('.tower-card-body b'), 'plain text, never HTML').toHaveCount(0)
      await expect(towerThumb.locator('.tower-cards-badge')).toHaveCount(0, { timeout: 10_000 })
      await card.locator('.tower-card-pin').click()
      await expect(card).toHaveAttribute('data-tower-card-pinned', 'true', { timeout: 10_000 })
      // a second turn: unread again on the thumbnail; the pinned card stays on top
      await hook(TOWER, 'stop', { hook_event_name: 'Stop', last_assistant_message: 'Turn two T0913-CARD-TWO' })
      await expect(towerThumb.locator('.tower-cards-badge')).toHaveAttribute('data-tower-cards-unread', '1', { timeout: 15_000 })
      await expect(inbox.locator('[data-tower-card]')).toHaveCount(2)
      await expect(inbox.locator('[data-tower-card]').first()).toHaveAttribute('data-tower-card-pinned', 'true')
      // a Worker's stop message: dropped, no card
      const mw = debugLog().length
      await hook(W, 'stop', { hook_event_name: 'Stop', last_assistant_message: 'T0913-WORKER-CARD must not be kept' })
      await expect.poll(() => debugLog().slice(mw).includes(`[tower-cards] terminal=${W} dropped: not a contract-2 Tower`), { timeout: 15_000 }).toBe(true)
      const workerCards = await win.evaluate((id) => (window as AnyApi).electronAPI.towerCards.list([id]), W)
      expect(workerCards.ok).toBe(true)
      expect(workerCards.entries.flatMap((e: { cards: unknown[] }) => e.cards)).toEqual([])
      results.cards = await win.evaluate((id) => (window as AnyApi).electronAPI.towerCards.list([id]), TOWER)
    }

    // ═══ ④ after a hook report: `hooks: ok (injected, set 2)` ═══
    const rOk = await declare(['--bat-contract', '2'])
    expect(rOk.code, rOk.stderr).toBe(0)
    expect(rOk.stdout).toBe(`✓ Tower role set: ${TOWER}\n  bat-contract: 2\n  hooks: ok (injected, set 2)\n`)
    await expect(inbox.locator('.inbox-hooks-hint')).toHaveCount(0)
    results.setRoleLines = { ...(results.setRoleLines as object), afterReport: rOk.stdout }

    // ═══ ① T0788's dialog hold: the matching Tower, then a contract-1 Tower (not gated) ═══
    await dialogHoldCheck('dialog-contract2')
    const back1 = await declare(['--bat-contract', '1'])
    expect(back1.code).toBe(0)
    await expect(contractBadge).toHaveAttribute('data-tower-contract', 'ct-outdated', { timeout: 10_000 })
    await dialogHoldCheck('dialog-contract1')
    // a declaration that no longer matches: the Inbox is gated again, the cards stay hidden (T0909)
    await expect(inbox.locator('.inbox-gate')).toHaveAttribute('data-inbox-gate', 'P-1', { timeout: 10_000 })
    await expect(towerThumb.locator('.tower-cards-badge')).toHaveCount(0)

    // logs: never the texts
    const all = debugLog()
    for (const text of ['T0913-CARD-ONE', 'T0913-WORKER-CARD', 'ship it', 'draft-c', 'T0913 notify-c', 'inbox first']) {
      expect(all.split('\n').filter(l => /\[(tower-cards|tower-inbox|notify-hold|hooks)\]/.test(l) && l.includes(text)), `no "${text}" in the logs`).toEqual([])
    }
    expect(all).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    results.matrix = matrix
    log(`results ${JSON.stringify(results)}`)
  } finally {
    if (process.env.T0913_RESULTS) fs.writeFileSync(process.env.T0913_RESULTS, JSON.stringify(results, null, 2))
    if (inst) await closeIsolated(inst, log)
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }) } catch (e) { log(`could not remove ${tmp}: ${e instanceof Error ? e.message : String(e)}`) }
  }
})

