// PLAN-068 W1＋W2 / T0904 (T0902 §2.4; GitHub #23 / #24): Worker notifications into a Tower tab that
// declared the BAT ↔ CT contract 2 — measured in an isolated BAT with a fake Tower TUI (a raw-mode line
// editor, e2e/fixtures/fake-line-editor.mjs: no login, no token).
//
//   ① undeclared Tower (`--set-role tower`, no `--bat-contract`): #23 reproduced — the user's draft and the
//      Worker's `--submit` text are submitted together by the Worker's Enter (behaviour unchanged, R9′)
//   ② contract 2: the same draft → the notification waits (`📨` reason `draft`); the user's Enter sends the
//      draft alone, the notification follows with its own Enter
//   ③ contract 2, the 250 ms window: a key typed right after the text appears (the renderer types it on the
//      echo) is not submitted with it; the user's Enter inside the window does not send the text twice
//   ④ contract 2, `reading`: the xterm scrolled up (the real renderer signal) → the notification waits
//      ~60 s at most; it goes out while the user still reads, and the viewport does not move (B0)
//   ⑤ contract 2, `reading` released: scrolled back down → sent after the 10 s linger + 1 s quiet
//   ⑥ T0917 / BUG-221: fullscreen (alt screen + SGR mouse tracking, as claude): real wheel events up,
//      stopped 15 s → still held (no 10 s release); a key sends it after the 1 s quiet. ⑥b: wheeled back
//      down as far → the 10 s linger + 1 s quiet
//
// The Worker is dispatched for real (`bat-terminal.mjs --notify-id <tower>`, the test's server token, as
// e2e/t0787): its PTY holds a worker capability bound to the Tower; its agent (a custom CLI,
// e2e/fixtures/notify-job-runner.mjs) runs `bat-notify.mjs --submit` INSIDE that PTY.
//
// Windows only (pwsh tabs, like e2e/t0787); `npx vite build` first. Results also go to `$T0904_RESULTS` (JSON).
import { test, expect, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0904')
const WS = 'e2e-t0904'
const WORKER_AGENT = 'e2e-t0904-worker'
const TOWER = 'e2e-t0904-tower'
const slash = (p: string) => p.split(path.sep).join('/')

/** In the renderer: the xterm Terminal of tab `id` (TerminalPanel's ref through React's fiber; as e2e/t0787). */
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
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
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

/** T0917: `normal` / `alternate` — the tab's active xterm buffer. */
async function bufferType(win: Page, id: string): Promise<string | null> {
  return win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    return found ? found.term.buffer.active.type : null
  }, { id, src: XTERM_OF })
}

/** T0917: the tab's xterm on screen (for real mouse wheel events over it). */
async function xtermBox(win: Page, id: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    if (!found) return null
    const r = (found.el as HTMLElement).getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }, { id, src: XTERM_OF })
  if (!box || box.width <= 0 || box.height <= 0) throw new Error('the xterm is not on screen')
  return box
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

test.skip(process.platform !== 'win32', 'pwsh tabs and the job runner: Windows only (as e2e/t0787)')

test('T0904: Worker notifications into a contract-2 Tower — #23 draft, the 250 ms window, reading (fake TUI, no token)', async () => {
  test.setTimeout(600_000)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0904-'))
  const folder = path.join(tmp, 'w')
  const jobsDir = path.join(tmp, 'jobs')
  const tuiDir = path.join(tmp, 'tui')
  for (const dir of [folder, jobsDir, tuiDir]) fs.mkdirSync(dir, { recursive: true })
  const tuiScript = slash(path.join(REPO_ROOT, 'e2e', 'fixtures', 'fake-line-editor.mjs'))
  const runnerScript = slash(path.join(REPO_ROOT, 'e2e', 'fixtures', 'notify-job-runner.mjs'))
  const results: Record<string, unknown> = {}

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0904', log)
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
    /** The TUI's current input line; null while the file is being replaced (polled again). */
    const currentLine = (): string | null => {
      try {
        return JSON.parse(fs.readFileSync(path.join(tuiDir, 'line.json'), 'utf8')).line as string
      } catch {
        return null
      }
    }

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0904 worker', icon: 'W', color: '#888888', command: 'node', args: [runnerScript, slash(jobsDir)],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: WS, folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS, activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'T0904 tower', cwd: folder }],
      activeTerminalId: TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TOWER), { timeout: 30_000 }).not.toBeNull()
    await win.waitForTimeout(2_000)

    // ── the fake Tower TUI in the Tower tab ──
    await write(TOWER, `node "${tuiScript}" "${slash(tuiDir)}"\r`)
    await expect.poll(() => fs.existsSync(path.join(tuiDir, 'ready')), { timeout: 30_000, message: 'fake TUI ready' }).toBe(true)
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
    const dispatched = await runHelper('bat-terminal.mjs', helperEnv, ['--notify-id', TOWER, '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0904'], folder)
    expect(dispatched.code, dispatched.stderr).toBe(0)
    const W = dispatched.terminalId!
    await expect.poll(() => fs.existsSync(path.join(jobsDir, `${W}.ready`)), { timeout: 30_000 }).toBe(true)
    expect(debugLog()).toContain(`[helper-cap] issued: terminal=${W} role=worker tower=${TOWER}`)
    // the Tower tab back in front (the dispatch made the Worker tab active)
    await win.locator('.workspace-container.active .thumbnail').filter({ has: win.locator('.thumbnail-title', { hasText: 'T0904 tower' }) }).first().click()
    await win.waitForTimeout(1_000)

    let jobN = 0
    /** One `bat-notify --submit` from the Worker; resolves with its result once it exited. */
    const notify = async (message: string) => {
      const n = jobN++
      fs.writeFileSync(path.join(jobsDir, `${W}-${n}.json`), JSON.stringify({ args: ['--source', 'T0904', '--target', '{env:BAT_TOWER_TERMINAL_ID}', '--submit', message] }))
      const res = path.join(jobsDir, `${W}-${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 60_000 }).toBe(true)
      return JSON.parse(fs.readFileSync(res, 'utf8')) as { code: number; stdout: string; stderr: string; startedAt: number; endedAt: number }
    }
    const declare = async (contract: number | null) => {
      const args = ['--set-role', 'tower', '--terminal-id', TOWER, ...(contract !== null ? ['--bat-contract', String(contract)] : [])]
      const r = await runHelper('bat-terminal.mjs', helperEnv, args, folder)
      expect(r.code, r.stderr).toBe(0)
      await win.waitForTimeout(500)
    }
    /** The renderer types `key` into the Tower as soon as `marker` shows on its screen (inside the 250 ms window). */
    const typeOnEcho = (marker: string, key: string) => win.evaluate(({ id, marker, key }) => {
      const api = (window as AnyApi).electronAPI
      const off = api.pty.onOutput((tid: string, data: string) => {
        if (tid !== id || !data.includes(marker)) return
        off()
        api.pty.write(id, key)
      })
    }, { id: TOWER, marker, key })

    // ① undeclared Tower: #23 as it is today (R9′: unchanged)
    await declare(null)
    await write(TOWER, 'draft-one ')
    await expect.poll(currentLine, { timeout: 10_000 }).toBe('draft-one ')
    const r1 = await notify('T0904 one')
    expect(r1.code, r1.stderr).toBe(0)
    await expect.poll(lines, { timeout: 15_000, message: '① submitted' }).toContain('draft-one T0904 one')
    results.undeclaredDraft = lines()
    log(`① undeclared: submitted ${JSON.stringify(lines())}`)

    // ② contract 2: the draft is kept apart
    await declare(2)
    let mark = debugLog().length
    await write(TOWER, 'draft-two')
    await expect.poll(currentLine, { timeout: 10_000 }).toBe('draft-two')
    const before2 = lines().length
    const r2 = await notify('T0904 two')
    expect(r2.code, `② bat-notify exit code unchanged: ${r2.stderr}`).toBe(0)
    expect(r2.stdout).toContain('✓ Notified')
    await win.waitForTimeout(4_000)
    expect(lines().length, '② nothing submitted while the draft is there').toBe(before2)
    await expect.poll(currentLine, { timeout: 2_000, message: '② the draft is untouched' }).toBe('draft-two')
    expect(debugLog().slice(mark)).toMatch(new RegExp(`\\[notify-hold\\] held terminal=${TOWER} source=${W} .*reason=draft part=text`))
    await expect(win.locator('.notify-hold-badge[data-notify-hold-reason="draft"]')).toBeVisible()
    await write(TOWER, '\r') // the user sends their own message
    await expect.poll(() => lines().slice(before2), { timeout: 15_000, message: '② draft, then the notification' }).toEqual(['draft-two', 'T0904 two'])
    const sub2 = submitted().filter(s => s.line !== undefined).slice(before2)
    results.contractDraft = { lines: lines().slice(before2), gapMs: sub2[1].at - sub2[0].at }
    expect(sub2[1].at - sub2[0].at, '② at least the 1 s quiet after the user\'s Enter').toBeGreaterThanOrEqual(900)
    await expect(win.locator('.notify-hold-badge')).toHaveCount(0)

    // ③a the 250 ms window, a key typed on the echo of the text
    const before3 = lines().length
    await typeOnEcho('T0904 three', 'z')
    const r3 = await notify('T0904 three')
    expect(r3.code).toBe(0)
    await expect.poll(() => lines().slice(before3), { timeout: 15_000, message: '③a the notification alone' }).toEqual(['T0904 three'])
    await expect.poll(currentLine, { timeout: 5_000, message: '③a the key stays in the input (after the Enter)' }).toBe('z')
    results.windowTyping = { lines: lines().slice(before3), lineAfter: currentLine() }
    await write(TOWER, '\x03')
    await expect.poll(currentLine, { timeout: 5_000 }).toBe('')

    // ③b the 250 ms window, the user's Enter on the echo: the text goes once, then the user's (empty) Enter
    const before3b = lines().length
    await typeOnEcho('T0904 four', '\r')
    const r3b = await notify('T0904 four')
    expect(r3b.code).toBe(0)
    await expect.poll(() => lines().slice(before3b), { timeout: 15_000, message: '③b the text once, then the user\'s Enter' }).toEqual(['T0904 four', ''])
    results.windowEnter = lines().slice(before3b)

    // ④ reading: scrolled up for real (the renderer's signal) → at most ~60 s, the viewport stays (B0)
    mark = debugLog().length
    await scrollTower(win, TOWER, -30)
    await expect.poll(() => debugLog().slice(mark).includes(`[tower-reading] terminal=${TOWER} reading=true`), { timeout: 10_000, message: '④ reading reported' }).toBe(true)
    const scrolled = await viewport(win, TOWER)
    expect(scrolled!.viewportY).toBeLessThan(scrolled!.baseY)
    const before4 = lines().length
    const r4 = await notify('T0904 five')
    expect(r4.code).toBe(0)
    await win.waitForTimeout(30_000)
    expect(lines().length, '④ still held after 30 s of reading').toBe(before4)
    await expect.poll(() => lines().slice(before4), { timeout: 45_000, message: '④ sent at the 60 s limit' }).toEqual(['T0904 five'])
    const sent4 = submitted().filter(s => s.line !== undefined)[before4].at
    results.readingLimit = { heldMs: sent4 - r4.endedAt, viewportBefore: scrolled, viewportAfter: await viewport(win, TOWER) }
    expect(sent4 - r4.endedAt, '④ about 60 s').toBeGreaterThanOrEqual(55_000)
    expect(sent4 - r4.endedAt, '④ not much more than 60 s + quiet').toBeLessThan(70_000)
    expect((await viewport(win, TOWER))!.viewportY, '④ B0: the viewport did not jump to the bottom').toBe(scrolled!.viewportY)
    expect(debugLog().slice(mark)).toContain(`[notify-hold] reading limit terminal=${TOWER}`)

    // ⑤ reading released: back at the bottom → 10 s linger + 1 s quiet
    await scrollTower(win, TOWER, 'bottom')
    await win.waitForTimeout(12_000)
    mark = debugLog().length
    await scrollTower(win, TOWER, -30)
    await expect.poll(() => debugLog().slice(mark).includes(`[tower-reading] terminal=${TOWER} reading=true`), { timeout: 10_000 }).toBe(true)
    const before5 = lines().length
    const r5 = await notify('T0904 six')
    expect(r5.code).toBe(0)
    await win.waitForTimeout(3_000)
    expect(lines().length).toBe(before5)
    const releasedAt = Date.now()
    await scrollTower(win, TOWER, 'bottom')
    await expect.poll(() => lines().slice(before5), { timeout: 30_000, message: '⑤ sent after the linger' }).toEqual(['T0904 six'])
    const sent5 = submitted().filter(s => s.line !== undefined)[before5].at
    results.readingRelease = { afterScrollDownMs: sent5 - releasedAt }
    expect(sent5 - releasedAt, '⑤ the 10 s linger').toBeGreaterThanOrEqual(9_000)
    expect(sent5 - releasedAt, '⑤ linger + quiet').toBeLessThan(16_000)

    // ⑥ T0917 / BUG-221: fullscreen (the alt screen + SGR mouse tracking, as claude 2.1.331). Real wheel
    // events up, stopped 15 s → the notification is still held; a key (→, not typing: S1) sends it.
    const altState = (): { alt: boolean; wheelUp: number; wheelDown: number } | null => {
      try {
        return JSON.parse(fs.readFileSync(path.join(tuiDir, 'alt.json'), 'utf8'))
      } catch {
        return null
      }
    }
    const towerLog = (from: number) => debugLog().slice(from).split('\n').filter(l => l.includes(`terminal=${TOWER}`)).join('\n')
    await write(TOWER, '\x1d')
    await expect.poll(async () => (await bufferType(win, TOWER)), { timeout: 10_000, message: '⑥ fullscreen on' }).toBe('alternate')
    await win.waitForTimeout(1_000)
    const box = await xtermBox(win, TOWER)
    await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const wheel = async (deltaY: number, times: number) => {
      for (let i = 0; i < times; i++) {
        await win.mouse.wheel(0, deltaY)
        await win.waitForTimeout(100)
      }
    }
    mark = debugLog().length
    await wheel(-200, 3)
    await expect.poll(() => altState()?.wheelUp ?? 0, { timeout: 10_000, message: '⑥ the TUI got wheel-up reports' }).toBeGreaterThan(0)
    await expect.poll(() => towerLog(mark).includes('alt scrolled-up=true'), { timeout: 10_000, message: '⑥ alt scrolled up' }).toBe(true)
    expect(towerLog(mark)).toContain('[tower-reading] terminal=' + TOWER + ' reading=true')
    await win.waitForTimeout(15_000)
    expect(towerLog(mark), '⑥ still reading 15 s after the last wheel').not.toContain('reading=false')
    const before6 = lines().length
    const r6 = await notify('T0904 seven')
    expect(r6.code).toBe(0)
    await win.waitForTimeout(5_000)
    expect(lines().length, '⑥ held ~20 s after the last wheel').toBe(before6)
    expect(debugLog().slice(mark)).toMatch(new RegExp(`\\[notify-hold\\] held terminal=${TOWER} source=${W} .*reason=reading part=text`))
    await win.evaluate(({ id, src }) => {
      // eslint-disable-next-line no-new-func
      (new Function(`return (${src})`)())(id)?.term.focus()
    }, { id: TOWER, src: XTERM_OF })
    const keyAt = Date.now()
    await win.keyboard.press('ArrowRight')
    await expect.poll(() => lines().slice(before6), { timeout: 15_000, message: '⑥ sent after the key' }).toEqual(['T0904 seven'])
    const sent6 = submitted().filter(s => s.line !== undefined)[before6].at
    expect(towerLog(mark)).toContain('alt scrolled-up=false cause=key')
    expect(sent6 - keyAt, '⑥ the key released it (quiet 1 s, no 10 s linger)').toBeLessThan(5_000)

    // ⑥b fullscreen, scrolled back down as far as up → the 10 s linger + 1 s quiet
    await win.waitForTimeout(2_000)
    mark = debugLog().length
    await wheel(-200, 3)
    await expect.poll(() => towerLog(mark).includes('alt scrolled-up=true'), { timeout: 10_000 }).toBe(true)
    const before6b = lines().length
    const r6b = await notify('T0904 eight')
    expect(r6b.code).toBe(0)
    await win.waitForTimeout(3_000)
    expect(lines().length).toBe(before6b)
    const wheelStart = Date.now()
    await wheel(200, 3)
    const backAt = Date.now() // the linger runs from the last wheel (each `mouse.wheel` waits for its event)
    await expect.poll(() => towerLog(mark).includes('alt scrolled-up=false cause=scrolled-back'), { timeout: 10_000, message: '⑥b scrolled back' }).toBe(true)
    await expect.poll(() => lines().slice(before6b), { timeout: 30_000, message: '⑥b sent after the linger' }).toEqual(['T0904 eight'])
    const sent6b = submitted().filter(s => s.line !== undefined)[before6b].at
    results.altScreen = { afterKeyMs: sent6 - keyAt, afterScrollBackMs: sent6b - backAt, wheelDownMs: backAt - wheelStart, tui: altState() }
    expect(sent6b - backAt, '⑥b the 10 s linger').toBeGreaterThanOrEqual(9_000)
    expect(sent6b - backAt, '⑥b linger + quiet').toBeLessThan(16_000)
    await write(TOWER, '\x1d') // fullscreen off
    await expect.poll(async () => (await bufferType(win, TOWER)), { timeout: 10_000 }).toBe('normal')

    // logs: never the text
    expect(debugLog()).not.toMatch(/\[notify-hold\][^\n]*(T0904 (one|two|three|four|five|six|seven|eight)|draft-(one|two))/)
    expect(debugLog()).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    log(`results ${JSON.stringify(results)}`)
  } finally {
    if (process.env.T0904_RESULTS) fs.writeFileSync(process.env.T0904_RESULTS, JSON.stringify(results, null, 2))
    if (inst) await closeIsolated(inst, log)
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }) } catch (e) { log(`could not remove ${tmp}: ${e instanceof Error ? e.message : String(e)}`) }
  }
})
