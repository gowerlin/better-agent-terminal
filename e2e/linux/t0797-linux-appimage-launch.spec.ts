// T0797: does the released (or desktop-build) Linux AppImage start on Ubuntu 22.04 / 24.04, open its window
// and run a terminal tab? Runs against the AppImage itself (`BAT_E2E_EXECUTABLE`), started the way a user
// starts it (through the AppImage runtime + FUSE, Chromium sandbox on), not against a source build.
//
// Run by .github/workflows/linux-acceptance.yml (workflow_dispatch only) under `xvfb-run`. Levels:
//   L1  Playwright launch, default sandbox: window, terminal tab, keyboard `echo` marker, screenshot,
//       debug log, sandbox evidence, normal quit. Passing L1 = PASS.
//   L2  only when L1 could not launch: the same AppImage started with no Playwright / debugging flags,
//       alive after 20 s? debug log written? (tells "the app cannot start" from "Playwright cannot drive it")
//   L1b only when L1 could not launch: L1 again with `--no-sandbox`, only to keep checking the other items.
//       Never the first attempt; a run that needs it is WARN, not PASS.
// Every row lands in `linux-report.md` / `.json` under `LINUX_REPORT_DIR` (rewritten after each row).
// See docs/agent-guide/linux-ci-acceptance.md.

import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, E2E_EXECUTABLE, freePort, isolatedEnv, readPid, testLogger } from '../fixtures/electron-isolation'
import {
  describeCmd, plainLaunch, procCmdline, readDebugLogs, runCmd, sandboxView, stripAnsi, systemInfo,
  type DebugLogView, type SandboxView,
} from './linux-os'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0797')
const WS = 'e2e-t0797-ws'
const TERM = 'e2e-t0797-term'
const LAUNCH_TIMEOUT_MS = 120_000

type Result = 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP' | 'ERROR'
type Verdict = 'PASS' | 'WARN' | 'FAIL'

interface Row {
  id: string
  title: string
  result: Result
  evidence: string[]
}

class Report {
  rows: Row[] = []
  meta: Record<string, string> = {}
  constructor(private dir: string) {}

  add(row: Row): Row {
    this.rows.push(row)
    log(`${row.id} ${row.result} — ${row.title}`)
    for (const e of row.evidence) log(`  ${row.id}: ${e}`)
    this.flush()
    return row
  }

  flush(): void {
    fs.writeFileSync(path.join(this.dir, 'linux-report.json'), JSON.stringify({ meta: this.meta, rows: this.rows }, null, 2))
    const md: string[] = ['# T0797 Linux AppImage launch acceptance', '']
    for (const [k, v] of Object.entries(this.meta)) md.push(`- **${k}**: ${v}`)
    md.push('', '| ID | 結果 | 項目 |', '|---|---|---|')
    for (const r of this.rows) md.push(`| ${r.id} | ${r.result} | ${r.title} |`)
    md.push('')
    for (const r of this.rows) {
      md.push(`## ${r.id} — ${r.result}`, '', r.title, '')
      for (const e of r.evidence) md.push(`- ${e.replace(/\n/g, ' ')}`)
      md.push('')
    }
    fs.writeFileSync(path.join(this.dir, 'linux-report.md'), md.join('\n'))
  }
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err))
const clip = (s: string, n = 3000) => (s.length > n ? `${s.slice(0, n)}…` : s)

function describeLogs(v: DebugLogView, ev: string[]): void {
  ev.push(`debug log files: ${v.files.length ? v.files.map(f => path.basename(f)).join(', ') : 'none'}`)
  ev.push(`startup line: ${JSON.stringify(v.startupLine || '(missing)')}`)
  ev.push(`[CRASH] lines: ${v.crashLines.length}${v.crashLines.length ? ` ${JSON.stringify(v.crashLines.slice(0, 5))}` : ''}`)
  ev.push(`[ERROR] lines: ${v.errorCount}${v.errorSamples.length ? ` (first ${v.errorSamples.length}: ${JSON.stringify(v.errorSamples)})` : ''}`)
}

/** Copies the BAT debug logs (only `Logs/debug-*.log`, never the rest of userData) into the report. */
function copyLogs(v: DebugLogView, reportDir: string, prefix: string): void {
  for (const f of v.files) {
    try { fs.copyFileSync(f, path.join(reportDir, `${prefix}-${path.basename(f)}`)) } catch { /* ignore */ }
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Kills a Terminal Server left behind by a run, only when its command line is BAT's terminal-server.js. */
async function reapTerminalServer(pid: number | null, ev: string[]): Promise<void> {
  if (pid === null) { ev.push('Terminal Server pid file: none'); return }
  for (let i = 0; i < 20 && isAlive(pid); i++) await new Promise(r => setTimeout(r, 250))
  if (!isAlive(pid)) { ev.push(`Terminal Server pid ${pid} exited with the app`); return }
  const cmd = procCmdline(pid).join(' ')
  if (cmd.includes('terminal-server.js')) {
    ev.push(`Terminal Server pid ${pid} still alive after quit — killed`)
    try { process.kill(pid, 'SIGKILL') } catch { /* ignore */ }
  } else {
    ev.push(`Terminal Server pid ${pid} still alive, command line does not look like BAT's — left alone: ${JSON.stringify(cmd.slice(0, 200))}`)
  }
}

function removeRuntimeUserData(userData: string, runtimeId: string): void {
  if (!userData || !path.basename(userData).includes(`-runtime-${runtimeId}`)) return
  fs.rmSync(userData, { recursive: true, force: true })
}

interface LaunchOutcome {
  launched: boolean
  result: Result
}

type RejectionListener = (reason: unknown, promise: Promise<unknown>) => void
const PLAYWRIGHT_LAUNCH_FAILED = 'Process failed to launch!'

/**
 * `electron.launch`, without letting a launch failure stop the test (T0798).
 *
 * Playwright 1.59 (`playwright-core` server/electron/electron.js) waits for several stderr lines with
 * `waitForLine`; when the app exits before printing them, every one of those promises rejects with
 * "Process failed to launch!". The awaited one reaches our catch, but `waitForXserverError` and
 * `chromeMatchPromise` reject unhandled, and the Playwright worker treats any unhandled rejection as fatal:
 * it fails the test and stops it, so L2, L1b and the verdict never ran (run 41492924250, ubuntu-24.04, report
 * with no rows). While the launch is in flight (and 1 s after a failure, for the sibling rejections), this
 * swallows exactly that error and hands every other rejection to the worker's own listeners.
 */
async function launchElectron(options: Parameters<typeof electron.launch>[0]): Promise<ElectronApplication> {
  const original = process.listeners('unhandledRejection') as RejectionListener[]
  let swallowed = 0
  const filter: RejectionListener = (reason, promise) => {
    if (reason instanceof Error && reason.message === PLAYWRIGHT_LAUNCH_FAILED) { swallowed++; return }
    for (const l of original) l(reason, promise)
  }
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', filter)
  let failed = false
  try {
    return await electron.launch(options)
  } catch (err) {
    failed = true
    throw err
  } finally {
    if (failed) await new Promise(r => setTimeout(r, 1000))
    process.removeListener('unhandledRejection', filter)
    for (const l of original) process.on('unhandledRejection', l)
    if (swallowed) log(`launch: ignored ${swallowed} unhandled "${PLAYWRIGHT_LAUNCH_FAILED}" rejection(s) from Playwright's launch helpers`)
  }
}

test.skip(process.platform !== 'linux', 'T0797: Linux runner only')
test.skip(!E2E_EXECUTABLE, 'T0797: BAT_E2E_EXECUTABLE must point to the AppImage under test')

test('T0797 Linux AppImage launch acceptance', async () => {
  test.setTimeout(15 * 60_000)
  const reportDir = process.env.LINUX_REPORT_DIR || test.info().outputPath('report')
  fs.mkdirSync(reportDir, { recursive: true })
  const report = new Report(reportDir)
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 't0797-')))

  const sys = await systemInfo()
  let size = ''
  try { size = `${fs.statSync(E2E_EXECUTABLE).size} bytes` } catch (err) { size = errText(err) }
  report.meta = {
    executable: `${path.basename(E2E_EXECUTABLE)} (${size})`,
    os: sys.os,
    kernel: sys.kernel,
    glibc: sys.glibc,
    'apparmor_restrict_unprivileged_userns': sys.apparmorRestrictUserns,
    'unprivileged_userns_clone': sys.unprivilegedUsernsClone,
    'max_user_namespaces': sys.maxUserNamespaces,
    '/dev/fuse': String(sys.devFuse),
    libfuse2: sys.libfuse2,
    DISPLAY: sys.display,
    runner: `${process.platform}-${process.arch} node ${process.version}`,
    startedAt: new Date().toISOString(),
  }
  report.flush()

  /** L1 / L1b: Playwright launch of the AppImage with `extraArgs`. */
  async function playwrightRun(id: string, title: string, extraArgs: string[]): Promise<LaunchOutcome> {
    const ev: string[] = []
    const runtimeId = `e2e-t0797-${id.toLowerCase()}-${Date.now()}`
    const folder = path.join(tmp, `${id}-ws`)
    fs.mkdirSync(folder, { recursive: true })
    const env = isolatedEnv(await freePort())
    const args = [`--runtime=${runtimeId}`, ...extraArgs]
    // 🔴 Playwright adds `--no-sandbox` to every Electron launch on Linux unless `chromiumSandbox: true`
    // (playwright-core server/electron/electron.js; T0797 local WSL run #1 got it without asking).
    const chromiumSandbox = !extraArgs.includes('--no-sandbox')
    ev.push(`args: ${JSON.stringify(args)}, chromiumSandbox: ${chromiumSandbox} (Playwright adds its own --inspect / --remote-debugging-port)`)
    const t0 = Date.now()
    let app: ElectronApplication
    try {
      app = await launchElectron({ executablePath: E2E_EXECUTABLE, args, env, chromiumSandbox, timeout: LAUNCH_TIMEOUT_MS })
    } catch (err) {
      ev.push(`launch failed after ${Date.now() - t0} ms: ${clip(errText(err))}`)
      report.add({ id, title, result: 'FAIL', evidence: ev })
      return { launched: false, result: 'FAIL' }
    }
    let stderrTail = ''
    app.process().stderr?.on('data', (d: Buffer) => { stderrTail = (stderrTail + d.toString('utf8')).slice(-6000) })

    let userData = ''
    let serverPid: number | null = null
    let result: Result = 'FAIL'
    const closeLog: string[] = []
    try {
      userData = await app.evaluate(({ app: a }) => a.getPath('userData'))
      if (!path.basename(userData).includes(`-runtime-${runtimeId}`)) throw new Error(`unexpected userData ${userData}`)
      const win: Page = await app.firstWindow()
      await expect.poll(() => win.url(), { timeout: 60_000 }).not.toMatch(/^(about:blank)?$/)
      await win.waitForLoadState('domcontentloaded')
      const launchMs = Date.now() - t0
      ev.push(`window loaded after ${launchMs} ms`)

      const meta = await app.evaluate(({ app: a, BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0]
        return {
          version: a.getVersion(),
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node,
          pid: process.pid,
          visible: w?.isVisible() ?? false,
          bounds: w ? JSON.stringify(w.getBounds()) : '',
          noSandboxSwitch: a.commandLine.hasSwitch('no-sandbox'),
          metrics: a.getAppMetrics().map(m => ({ pid: m.pid, type: String(m.type) })),
        }
      })
      if (!report.meta.appVersion) {
        report.meta.appVersion = meta.version
        report.meta.electron = `${meta.electron} (Chromium ${meta.chrome}, Node ${meta.node})`
      }
      ev.push(`app ${meta.version}, Electron ${meta.electron}; window visible=${meta.visible} bounds=${meta.bounds}`)
      // Chromium rewrites its process title, so /proc/<pid>/cmdline can be one space-joined string.
      const mainCmd = procCmdline(meta.pid).join(' ')
      ev.push(`main process command line has --no-sandbox: ${/(^|\s)--no-sandbox(\s|$)/.test(mainCmd)}; app.commandLine no-sandbox switch: ${meta.noSandboxSwitch}`)
      ev.push(`main process: ${JSON.stringify(mainCmd.slice(0, 400))}`)
      const base = sandboxView(meta.pid, 'Browser')
      ev.push(`main process baseline: NSpid=${base.nspid} Seccomp=${base.seccomp}`)
      const views: SandboxView[] = meta.metrics.filter(m => m.type !== 'Browser').map(m => sandboxView(m.pid, m.type))
      ev.push(`child processes (sandboxed = own PID namespace, i.e. NSpid has two values): ${JSON.stringify(views)}`)
      const renderers = views.filter(v => v.type === 'Tab')
      const rendererSandboxed = renderers.length > 0 && renderers.every(v => v.sandboxed)
      ev.push(`renderer sandbox active: ${renderers.length ? rendererSandboxed : 'unknown (no Tab process listed)'}`)

      // A workspace with one terminal tab, as a returning user has it (a first launch shows the empty view, T0531).
      await expect.poll(async () => win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()).then(v => v !== null), { timeout: 30_000 }).toBe(true)
      const seed = {
        workspaces: [{ id: WS, name: 'T0797 linux', folderPath: folder, createdAt: Date.now() }],
        activeWorkspaceId: WS,
        activeGroup: null,
        terminals: [{ id: TERM, workspaceId: WS, type: 'terminal', title: 'T0797 terminal' }],
        activeTerminalId: TERM,
      }
      expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
      await win.reload()
      await win.waitForLoadState('domcontentloaded')
      await win.evaluate((termId) => {
        const w = window as AnyApi
        w.__t0797 = ''
        w.electronAPI.pty.onOutput((pid: string, data: string) => { if (pid === termId) w.__t0797 += data })
      }, TERM)
      const ptyOut = async () => stripAnsi(await win.evaluate(() => (window as AnyApi).__t0797 as string))
      const xterm = win.locator('.terminal-panel .xterm').first()
      const xtermVisible = await expect(xterm).toBeVisible({ timeout: 30_000 }).then(() => true, () => false)
      ev.push(`terminal tab (xterm) visible: ${xtermVisible} (${Date.now() - t0} ms after launch)`)

      // Keyboard input: the command echoes `echo T0797_$((6*7))_<rand>`; only the shell's output has `_42_`.
      const rand = crypto.randomBytes(4).toString('hex')
      const marker = `T0797_42_${rand}`
      let markerVia = 'none'
      if (xtermVisible) {
        await expect.poll(async () => (await ptyOut()).length > 0, { timeout: 20_000 }).toBe(true).catch(() => { /* shell may be silent */ })
        await xterm.click()
        await win.keyboard.type(`echo T0797_$((6*7))_${rand}`)
        await win.keyboard.press('Enter')
        if (await expect.poll(async () => (await ptyOut()).includes(marker), { timeout: 20_000 }).toBe(true).then(() => true, () => false)) {
          markerVia = 'keyboard'
        } else {
          // tells "keyboard input does not reach the PTY" from "the shell does not run"
          await win.evaluate(([termId, c]) => (window as AnyApi).electronAPI.pty.write(termId, c), [TERM, `echo T0797_$((6*7))_${rand}\r`])
          if (await expect.poll(async () => (await ptyOut()).includes(marker), { timeout: 20_000 }).toBe(true).then(() => true, () => false)) markerVia = 'pty.write only'
        }
      }
      ev.push(`marker ${marker} in the PTY output: ${markerVia}${markerVia === 'none' ? '' : ` (${Date.now() - t0} ms after launch)`}`)
      if (markerVia !== 'keyboard') ev.push(`PTY output tail: ${JSON.stringify((await ptyOut()).slice(-600))}`)
      const thumbText = (await win.locator('.thumbnail-preview').allInnerTexts().catch(() => [] as string[])).join('\n')
      ev.push(`marker in BAT's thumbnail preview text: ${thumbText.includes(marker)}`)
      await win.screenshot({ path: path.join(reportDir, `${id}-window.png`) }).then(() => ev.push(`screenshot: ${id}-window.png`), (err) => ev.push(`screenshot failed: ${errText(err)}`))

      serverPid = readPid(userData)
      await win.evaluate((termId) => (window as AnyApi).electronAPI.pty.kill(termId), TERM).catch(() => { /* gone */ })

      const closeT0 = Date.now()
      await closeIsolated({ app, runtimeId, userData }, (m) => { closeLog.push(m); log(m) }, { keepUserData: true })
      const closedNormally = !closeLog.some(m => m.includes('did not finish'))
      ev.push(`quit (dialog answered "Quit" + stop Terminal Server): ${closedNormally ? 'normal' : 'app.close() timed out, process killed'} in ${Date.now() - closeT0} ms`)
      await reapTerminalServer(serverPid, ev)

      const logs = readDebugLogs(userData)
      describeLogs(logs, ev)
      copyLogs(logs, reportDir, id)
      const argvNoSandbox = /argv=.*--no-sandbox/.test(logs.startupLine)
      ev.push(`--no-sandbox in the logged argv: ${argvNoSandbox}`)

      const core = meta.visible && xtermVisible && markerVia === 'keyboard'
      // A sandbox launch whose renderer still runs unsandboxed means something turned it off: not a PASS.
      const sandboxOk = !chromiumSandbox || renderers.length === 0 || rendererSandboxed
      if (!sandboxOk) ev.push('renderer is not sandboxed although the launch did not ask for --no-sandbox')
      const clean = logs.files.length > 0 && logs.crashLines.length === 0 && closedNormally && sandboxOk
      result = core && clean ? 'PASS' : core || markerVia !== 'none' ? 'PARTIAL' : 'FAIL'
    } catch (err) {
      ev.push(`error: ${clip(errText(err))}`)
      result = 'ERROR'
      await closeIsolated({ app, runtimeId, userData }, (m) => { closeLog.push(m); log(m) }, { keepUserData: true }).catch(() => { /* ignore */ })
      await reapTerminalServer(serverPid ?? (userData ? readPid(userData) : null), ev)
      if (userData) {
        const logs = readDebugLogs(userData)
        describeLogs(logs, ev)
        copyLogs(logs, reportDir, id)
      }
    } finally {
      if (stderrTail.trim()) ev.push(`app stderr tail: ${JSON.stringify(stderrTail.slice(-1500))}`)
      removeRuntimeUserData(userData, runtimeId)
    }
    report.add({ id, title, result, evidence: ev })
    return { launched: true, result }
  }

  /** L2: the AppImage with no Playwright, as a user starts it from a terminal. */
  async function plainRun(): Promise<Result> {
    const ev: string[] = []
    const runtimeId = `e2e-t0797-plain-${Date.now()}`
    const env = isolatedEnv(await freePort())
    const appData = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
    const userData = path.join(appData, `BetterAgentTerminal-runtime-${runtimeId}`)
    const r = await plainLaunch(E2E_EXECUTABLE, [`--runtime=${runtimeId}`], env)
    ev.push(`alive after 20 s: ${r.aliveAfterHold}; ended: ${r.ended}; exit code=${r.exitCode} signal=${r.exitSignal}; ${r.ms} ms`)
    if (r.outputTail.trim()) ev.push(`stdout/stderr tail: ${JSON.stringify(r.outputTail.slice(-1500))}`)
    await reapTerminalServer(readPid(userData), ev)
    const logs = readDebugLogs(userData)
    describeLogs(logs, ev)
    copyLogs(logs, reportDir, 'L2')
    removeRuntimeUserData(userData, runtimeId)
    const result: Result = r.aliveAfterHold && logs.files.length > 0 && logs.crashLines.length === 0 ? 'PASS' : 'FAIL'
    report.add({ id: 'L2', title: '最低檢查：不經 Playwright 啟動 AppImage，20 s 後仍在、debug log 已建立且沒有 [CRASH]', result, evidence: ev })
    return result
  }

  let verdict: Verdict = 'FAIL'
  try {
    const l1 = await playwrightRun('L1', '① Playwright 啟動 AppImage（預設 sandbox，不加 --no-sandbox）：視窗、終端分頁鍵盤輸入 echo 標記、截圖、debug log、正常結束', [])
    if (l1.result === 'PASS') {
      verdict = 'PASS'
    } else if (l1.launched) {
      verdict = l1.result === 'PARTIAL' ? 'WARN' : 'FAIL'
    } else {
      await plainRun()
      const l1b = await playwrightRun('L1b', '① 重跑並加 --no-sandbox（只為了繼續驗其他項目；需要它即不是 PASS）', ['--no-sandbox'])
      verdict = l1b.result === 'PASS' || l1b.result === 'PARTIAL' ? 'WARN' : 'FAIL'
    }
  } finally {
    report.meta.verdict = verdict
    report.meta.finishedAt = new Date().toISOString()
    report.flush()
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  const ps = await runCmd('pgrep', ['-af', 'terminal-server.js'])
  if (ps.stdout) log(`terminal-server processes still running: ${describeCmd(ps)}`)

  if (verdict === 'WARN') console.log(`::warning::T0797 Linux AppImage launch: WARN on ${report.meta.os} (see linux-report.md)`)
  expect(verdict, `overall verdict on ${report.meta.os} (see linux-report.md)`).not.toBe('FAIL')
})
