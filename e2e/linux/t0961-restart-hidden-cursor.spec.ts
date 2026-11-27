// BUG-233 / T0961 (D465): ⏻ on a tab whose program hid the cursor — the new shell's cursor must be visible.
//
// T0957 (`showLeftoverHiddenCursor`, src/lib/mouse-tracking-reset.ts) shows the cursor in the tab's own xterm once
// the new PTY is spawned. Windows cannot show the original bug (ConPTY's repaint sends `ESC[?25h` itself, T0959);
// a Linux PTY has no ConPTY, so this spec reproduces it on a build without T0957 and checks the fix on a build with it.
//
// Runs against a packaged Linux build (`BAT_E2E_EXECUTABLE`: an AppImage or `release/linux-unpacked/
// BetterAgentTerminal`), isolated runtime, one shell tab (no agent, no login). ⏻ is the real button + its confirm
// dialog (the renderer's `restartOrCreatePty` path); nothing writes xterm state directly. Rows in
// `t0961-report.md` / `.json` (`LINUX_REPORT_DIR`):
//   B4  control: ⏻ on an idle shell (cursor never hidden) → no `[mouse-tracking] cursor shown|state unknown` line,
//       the cursor stays visible
//   B1  `printf '\033[?1049h\033[?25l'; sleep …` hides the cursor and keeps running; ⏻ → after the new shell's
//       prompt the xterm cursor is visible (`_core.coreService.isCursorHidden === false`)
//   B2  … and xterm is on the normal buffer
//   B3  … and the debug log has `[mouse-tracking] cursor shown: new-pty-spawned terminal=<id>` (a build without
//       T0957 has no such line: expected there, recorded as FAIL with the evidence)
//   N1  (recorded only) whether the new shell's own output contains `ESC[?25h` / `ESC[?25l`, and its head
// Only reads /proc (cmdline) besides the app; kills only the `sleep` it started and this runtime's Terminal Server,
// each after checking its command line. See docs/agent-guide/terminal-context-menu.md「⏻ 重啟與殘留的滑鼠追蹤」.

import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { E2E_EXECUTABLE, freePort, isolatedEnv, readPid, testLogger } from '../fixtures/electron-isolation'
import { systemInfo } from './linux-os'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0961')
const WS = 'e2e-t0961-ws'
const TERM = 'e2e-t0961-a'
/** distinctive so the test finds (and at the end kills) only its own sleep */
const SLEEP_SECS = 3961
const HIDE_CURSOR = `printf '\\033[?1049h\\033[?25l'; sleep ${SLEEP_SECS}`
const PROMPT_RE = /\$\s*$/

type Result = 'PASS' | 'FAIL' | 'INFO'
interface Row { id: string; title: string; result: Result; evidence: string[] }

test.skip(process.platform !== 'linux', 'T0961: Linux only')
test.skip(!E2E_EXECUTABLE, 'T0961: BAT_E2E_EXECUTABLE must point to the packaged Linux build')

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function poll<T>(fn: () => T | Promise<T>, timeoutMs: number, intervalMs = 200): Promise<T | undefined> {
  const end = Date.now() + timeoutMs
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) return undefined
    await sleep(intervalMs)
  }
}
function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}
function cmdline(pid: number): string[] {
  try { return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').slice(0, -1) } catch { return [] }
}
function sleepPids(): number[] {
  return fs.readdirSync('/proc').filter(e => /^\d+$/.test(e)).map(Number)
    .filter(p => cmdline(p).join(' ') === `sleep ${SLEEP_SECS}`)
}
const plain = (raw: string): string => raw
  .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, '')
  .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/\u001b[@-_]/g, '')
/** for the report: escapes visible, home directory as ~ */
const shown = (raw: string, max = 600) => JSON.stringify(raw.slice(0, max).split(os.homedir()).join('~'))

// Renderer snippet: `found[terminalId]` = that tab's xterm Terminal (from the TerminalPanel fiber's refs, as T0955 / T0959).
const FIND = `
const found = {}
for (const x of document.querySelectorAll('.xterm')) {
  let el = x; let k
  while (el && !(k = Object.keys(el).find(n => n.startsWith('__reactFiber$')))) el = el.parentElement
  let f = k ? el[k] : null
  for (let i = 0; f && i < 40; i++, f = f.return) {
    const id = f.memoizedProps && f.memoizedProps.terminalId
    if (!id) continue
    let h = f.memoizedState
    for (let j = 0; h && j < 200; j++, h = h.next) {
      const v = h.memoizedState && h.memoizedState.current
      if (v && v.buffer && v.buffer.active && typeof v.focus === 'function') { found[id] = v; break }
    }
    if (found[id]) break
  }
}
`
interface TermState { type: string; cursorHidden: boolean | null }

test('T0961 ⏻ shows a cursor the old program hid (BUG-233)', async () => {
  test.setTimeout(8 * 60_000)
  const reportDir = process.env.LINUX_REPORT_DIR || test.info().outputPath('report')
  fs.mkdirSync(reportDir, { recursive: true })
  const rows: Row[] = []
  const meta: Record<string, string> = { executable: path.basename(E2E_EXECUTABLE), kernel: os.release(), startedAt: new Date().toISOString() }
  const flush = () => {
    fs.writeFileSync(path.join(reportDir, 't0961-report.json'), JSON.stringify({ meta, rows }, null, 2))
    const md = ['# T0961 ⏻ and a cursor the old program hid (BUG-233)', '', ...Object.entries(meta).map(([k, v]) => `- **${k}**: ${v}`), '', '| ID | 結果 | 項目 |', '|---|---|---|']
    for (const r of rows) md.push(`| ${r.id} | ${r.result} | ${r.title} |`)
    for (const r of rows) md.push('', `## ${r.id} — ${r.result}`, '', r.title, '', ...r.evidence.map(e => `- ${e.replace(/\n/g, ' ')}`))
    fs.writeFileSync(path.join(reportDir, 't0961-report.md'), md.join('\n') + '\n')
  }
  const add = (row: Row) => { rows.push(row); log(`${row.id} ${row.result} — ${row.title}`); for (const e of row.evidence) log(`  ${e}`); flush() }

  meta.os = (await systemInfo()).os
  const runtimeId = `e2e-t0961-${Date.now()}`
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 't0961-ws-')))
  const env = isolatedEnv(await freePort())
  const app: ElectronApplication = await electron.launch({ executablePath: E2E_EXECUTABLE, args: [`--runtime=${runtimeId}`], env, chromiumSandbox: true, timeout: 120_000 })
  let win!: Page
  let userData = ''
  try {
    userData = await app.evaluate(({ app: a }) => a.getPath('userData'))
    expect(path.basename(userData)).toContain(`-runtime-${runtimeId}`)
    win = await app.firstWindow()
    await expect.poll(() => win.url(), { timeout: 60_000 }).not.toMatch(/^(about:blank)?$/)
    await win.waitForLoadState('domcontentloaded')
    meta.app = await app.evaluate(({ app: a }) => `${a.getVersion()} (Electron ${process.versions.electron})`)
    meta.shell = process.env.SHELL ?? '(unset)'

    // one shell tab, seeded like t0806 / T0959
    await expect.poll(async () => win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()).then(v => v !== null), { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0961 linux', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TERM, workspaceId: WS, type: 'terminal', title: 'T0961 A', cwd: folder }],
      activeTerminalId: TERM,
    }
    expect(await win.evaluate(async (d) => (window as AnyApi).electronAPI.workspace.save(d), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await win.locator('.workspace-container.active .terminal-wrapper').first().waitFor({ timeout: 30_000 })
    await win.evaluate(() => {
      const w = window as AnyApi
      if (w.__t0961?.installed) return
      w.__t0961 = { installed: true, out: {} as Record<string, string> }
      w.electronAPI.pty.onOutput((id: string, data: string) => { w.__t0961.out[id] = (w.__t0961.out[id] ?? '') + data })
    })

    const outputOf = (): Promise<string> => win.evaluate(i => (window as AnyApi).__t0961?.out?.[i] ?? '', TERM)
    const termState = (): Promise<TermState | null> => win.evaluate(`(async () => { ${FIND} const t = found[${JSON.stringify(TERM)}]; if (!t) return null;
      return { type: t.buffer.active.type, cursorHidden: t._core?.coreService?.isCursorHidden ?? null } })()`) as Promise<TermState | null>
    const write = (text: string) => win.evaluate(([i, t]) => (window as AnyApi).electronAPI.pty.write(i, t), [TERM, text])
    const waitPrompt = async (from: number, ms = 60_000) => !!(await poll(async () => PROMPT_RE.test(plain((await outputOf()).slice(from))), ms))
    const debugLog = (): string => {
      const dir = path.join(userData, 'Logs')
      try { return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') } catch { return '' }
    }
    const cursorLines = () => debugLog().split('\n').filter(l => new RegExp(`\\[mouse-tracking\\] cursor (shown|state unknown): new-pty-spawned terminal=${TERM}`).test(l))
      .map(l => l.replace(/^.*\[mouse-tracking\]/, '[mouse-tracking]'))
    const clickRestart = async () => {
      await win.locator('.main-panel button.action-btn.danger:visible', { hasText: '⏻' }).first().click()
      await win.locator('.dialog-btn.confirm.danger').click()
    }
    const shot = async (name: string) => { try { await win.screenshot({ path: path.join(reportDir, name) }); return name } catch { return `${name} (failed)` } }

    const firstPrompt = await waitPrompt(0)
    await expect.poll(termState, { timeout: 30_000 }).not.toBeNull()
    await sleep(500)

    // ── B4: control — ⏻ on an idle shell ──
    {
      const ev: string[] = []
      const before = await termState()
      const linesBefore = cursorLines().length
      const mark = (await outputOf()).length
      await clickRestart()
      const prompt = await waitPrompt(mark)
      await sleep(1_500)
      const after = await termState()
      const newLines = cursorLines().slice(linesBefore)
      ev.push(`first shell prompt seen: ${firstPrompt}; before ⏻ ${JSON.stringify(before)}; after ⏻ ${JSON.stringify(after)}; new shell prompt: ${prompt}`)
      ev.push(`cursor log lines for this ⏻: ${newLines.length ? JSON.stringify(newLines) : 'none'}`)
      add({
        id: 'B4',
        title: 'control: ⏻ on an idle shell (cursor never hidden) — no `cursor shown` / `cursor state unknown` line, cursor stays visible',
        result: before?.cursorHidden === false && prompt && newLines.length === 0 && after?.cursorHidden === false ? 'PASS' : 'FAIL',
        evidence: ev,
      })
    }

    // ── B1–B3, N1: the program hides the cursor and keeps running; ⏻ ──
    {
      const setup: string[] = []
      let mark = (await outputOf()).length
      await write(`${HIDE_CURSOR}\r`)
      const hidden = await poll(async () => { const s = await termState(); return s?.cursorHidden === true && s.type === 'alternate' ? s : undefined }, 15_000)
      const sleeping = await poll(() => sleepPids()[0], 10_000)
      setup.push(`setup \`${HIDE_CURSOR}\`: xterm ${JSON.stringify(hidden ?? await termState())} (expected alternate + isCursorHidden=true); sleep pid ${sleeping ?? 'not found'}`)
      setup.push(`screenshots: ${await shot('t0961-hidden-before-restart.png')}`)
      const setupOk = !!hidden && !!sleeping
      const linesBefore = cursorLines().length
      mark = (await outputOf()).length
      await clickRestart()
      const prompt = await waitPrompt(mark)
      await sleep(1_500)
      const st = await termState()
      const after = (await outputOf()).slice(mark)
      const newLines = cursorLines().slice(linesBefore)
      const shownLines = newLines.filter(l => /cursor shown: new-pty-spawned/.test(l))
      const altLeft = debugLog().split('\n').filter(l => l.includes(`[mouse-tracking] alt screen left: new-pty-spawned terminal=${TERM}`)).length
      setup.push(`after ⏻: new shell prompt ${prompt}; xterm ${JSON.stringify(st)}; old sleep ${sleeping} alive ${sleeping ? isAlive(sleeping) : 'n/a'}`)
      setup.push(`screenshots: ${await shot('t0961-after-restart.png')}`)
      // the new shell takes input
      const m2 = (await outputOf()).length
      await write('echo T0961OK$((6*7))\r')
      const echoed = !!(await poll(async () => plain((await outputOf()).slice(m2)).includes('T0961OK42'), 15_000))
      setup.push(`new shell answers \`echo T0961OK$((6*7))\` → T0961OK42: ${echoed}`)

      add({
        id: 'B1',
        title: 'hidden cursor + running program, ⏻ → the new shell\'s cursor is visible (xterm isCursorHidden=false)',
        result: setupOk && prompt && st?.cursorHidden === false ? 'PASS' : 'FAIL',
        evidence: [...setup, ...(setupOk ? [] : ['setup did not hide the cursor in the alternate screen or the sleep was not found: B1–B3 cannot pass'])],
      })
      add({
        id: 'B2',
        title: '… and xterm is on the normal buffer',
        result: setupOk && prompt && st?.type === 'normal' ? 'PASS' : 'FAIL',
        evidence: [`xterm buffer after ⏻: ${st?.type ?? 'unknown'}; \`alt screen left: new-pty-spawned\` log lines: ${altLeft}`],
      })
      add({
        id: 'B3',
        title: '… and the debug log has `[mouse-tracking] cursor shown: new-pty-spawned terminal=<id>` (absent on builds without T0957)',
        result: setupOk && shownLines.length > 0 ? 'PASS' : 'FAIL',
        evidence: [`cursor log lines for this ⏻: ${newLines.length ? JSON.stringify(newLines) : 'none'}`],
      })
      add({
        id: 'N1',
        title: 'recorded only: does the new shell / PTY send `ESC[?25h` itself (ConPTY does, T0959)?',
        result: 'INFO',
        evidence: [
          `new shell output after ⏻ contains ESC[?25h: ${after.includes('\u001b[?25h')}; ESC[?25l: ${after.includes('\u001b[?25l')}; ESC[?1049l: ${after.includes('\u001b[?1049l')}; ${after.length} chars`,
          `head of the new shell's raw output: ${shown(after)}`,
        ],
      })
    }
  } finally {
    try {
      await app.evaluate(({ dialog }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: true }) // Quit + stop Terminal Server
      })
    } catch { /* already gone */ }
    try { await Promise.race([app.close(), new Promise(r => setTimeout(r, 15_000))]) } catch { /* already closed */ }
    try { app.process().kill('SIGKILL') } catch { /* gone */ }
    for (const pid of sleepPids()) try { process.kill(pid, 'SIGKILL') } catch { /* gone */ }
    const sp = userData ? readPid(userData) : null
    if (sp && isAlive(sp) && cmdline(sp).join(' ').includes('terminal-server.js')) try { process.kill(sp, 'SIGKILL') } catch { /* gone */ }
    if (userData && path.basename(userData).includes(`-runtime-${runtimeId}`)) {
      try { fs.copyFileSync(path.join(userData, 'Logs', fs.readdirSync(path.join(userData, 'Logs')).filter(f => f.startsWith('debug-')).sort().at(-1)!), path.join(reportDir, 't0961-debug.log')) } catch { /* no log */ }
      fs.rmSync(userData, { recursive: true, force: true })
    }
    fs.rmSync(folder, { recursive: true, force: true })
    meta.finishedAt = new Date().toISOString()
    flush()
  }
  expect(rows.filter(r => r.result !== 'INFO').map(r => `${r.id}=${r.result}`)).toEqual(['B4=PASS', 'B1=PASS', 'B2=PASS', 'B3=PASS'])
})
