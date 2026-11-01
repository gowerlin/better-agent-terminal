// T0737 (v0.7.2-pre.7 automated acceptance): BUG-179 / T0732 — `<userData>/Logs/bat-scripts.log` is
// rotated once when BAT starts (`rotateBatScriptsLog`, electron/bat-scripts-log-rotation.ts, called at
// the top of `app.whenReady` in electron/main.ts). T0732 only had unit tests; this spec starts the real
// source build and seeds the isolated instance's Logs directory before launch.
//
//   ① bat-scripts.log > 10 MiB → renamed to bat-scripts-<YYYYMMDD-HHMMSS>.log (same bytes); the
//      current file is gone or a new small one; the debug log has the `[bat-scripts-log] rotated` line
//   ② 3 older rotated files + a > 10 MiB current one → only the newest 3 rotated files are left
//      (by the stamp in the name); the oldest is deleted and logged
//   ③ exactly 10 MiB (not over the limit) → untouched (same size, same SHA-256), nothing rotated
//   ④ after ①, a helper run inside a tab of the same instance (`bat-terminal.mjs --set-role tower`)
//      → bat-scripts.log is created again and holds NDJSON lines from that helper
//   ⑤ the current file held open without sharing by another process (Windows) → BAT starts normally,
//      the debug log has exactly one failure line, the file is left as it was
//   ⑥ headless bat-server: not started here. `electron/remote/__tests__/headless-bat-scripts-log-rotation.test.ts`
//      starts the real `createHeadlessServer(...).start()` with a temp dataDir (T0737 runs it as a gate).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts: each scenario has
// its own `--runtime=e2e-t0737-…` userData, so the user's own `<appData>/BetterAgentTerminal/Logs` is never
// read or written. Big files are made with `truncate` (no real 10 MiB writes) and removed with the runtime.

import { test, expect, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0737-rotation')
const MiB = 1024 * 1024
const LIMIT = 10 * MiB // BAT_SCRIPTS_LOG_ROTATE_BYTES (D198)
const CURRENT = 'bat-scripts.log'
const ROTATED = /^bat-scripts-(\d{8}-\d{6})(?:-(\d+))?\.log$/
const HELPER = path.join(REPO_ROOT, 'scripts', 'bat-terminal.mjs').split(path.sep).join('/')
const WS = 'e2e-t0737-rotation-ws'
const TAB = 'e2e-t0737-rotation-tab'

/** Where the isolated instance's userData will be (the runtime env keeps the inherited APPDATA). */
function expectedUserData(runtimeId: string): string {
  const appData = process.platform === 'win32'
    ? (process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'))
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'))
  return path.join(appData, `BetterAgentTerminal-runtime-${runtimeId}`)
}

/** A file of `size` bytes whose first line is `marker` (the rest is a truncate hole). */
function writeSized(file: string, size: number, marker: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${marker}\n`)
  fs.truncateSync(file, size)
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function firstLine(file: string): string {
  const fd = fs.openSync(file, 'r')
  try {
    const buf = Buffer.alloc(128)
    const n = fs.readSync(fd, buf, 0, buf.length, 0)
    return buf.subarray(0, n).toString('utf8').split('\n')[0]
  } finally {
    fs.closeSync(fd)
  }
}

function listLogs(logDir: string): Array<{ name: string; size: number }> {
  return fs.readdirSync(logDir).filter(n => n.startsWith('bat-scripts')).sort().map(name => ({ name, size: fs.statSync(path.join(logDir, name)).size }))
}

/** `[bat-scripts-log]` lines of this runtime's debug logs. */
function rotationLines(logDir: string): string[] {
  return fs.readdirSync(logDir).filter(n => /^debug-.*\.log$/.test(n))
    .flatMap(n => fs.readFileSync(path.join(logDir, n), 'utf8').split(/\r?\n/))
    .filter(l => l.includes('[bat-scripts-log]'))
    .map(l => l.replace(/^.*?\[bat-scripts-log\]/, '[bat-scripts-log]'))
}

/** Launches a fresh runtime whose `<userData>/Logs` is seeded by `seed(logDir)` first. */
async function launchSeeded(name: string, seed: (logDir: string) => void | Promise<void>): Promise<{ inst: IsolatedInstance; logDir: string }> {
  let logDir = ''
  const inst = await launchIsolated(name, log, {
    beforeLaunch: async (runtimeId) => {
      const userData = expectedUserData(runtimeId)
      expect(fs.existsSync(userData), `fresh runtime userData ${userData}`).toBe(false)
      logDir = path.join(userData, 'Logs')
      fs.mkdirSync(logDir, { recursive: true })
      await seed(logDir)
      log(`seeded ${logDir}: ${JSON.stringify(listLogs(logDir))}`)
    },
  })
  // Guard: the seeded directory is the one this instance uses (never the user's own Logs).
  expect(path.join(inst.userData, 'Logs').toLowerCase()).toBe(logDir.toLowerCase())
  // whenReady has run (the window exists); wait for the renderer to talk to main.
  await expect.poll(async () => (await inst.win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== undefined, { timeout: 30_000 }).toBe(true)
  return { inst, logDir }
}

async function runInTab(win: Page, id: string, line: string): Promise<void> {
  await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line: `${line}\r` })
}

test.describe.configure({ mode: 'serial' })

test('① + ④ bat-scripts.log > 10 MiB is rotated at startup; a helper in a tab then writes a new bat-scripts.log', async () => {
  test.setTimeout(180_000)
  const size = LIMIT + 1 * MiB
  const marker = '{"t0737":"old-current-file"}'
  let inst: IsolatedInstance | undefined
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0737-rot-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  try {
    const before = new Date()
    const launched = await launchSeeded('t0737-rot1', dir => writeSized(path.join(dir, CURRENT), size, marker))
    inst = launched.inst
    const { logDir } = launched
    const after = listLogs(logDir)
    const rotated = after.filter(f => ROTATED.test(f.name))
    const lines = rotationLines(logDir)
    log(`① after startup: ${JSON.stringify(after)}; debug log: ${JSON.stringify(lines)}`)
    expect(rotated).toHaveLength(1)
    expect(rotated[0].size).toBe(size)
    expect(firstLine(path.join(logDir, rotated[0].name))).toBe(marker)
    // The stamp is the local time of the rotation (between the seed and now).
    const stamp = ROTATED.exec(rotated[0].name)![1]
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
    expect(stamp >= fmt(new Date(before.getTime() - 1000))).toBe(true)
    expect(stamp <= fmt(new Date())).toBe(true)
    const current = after.find(f => f.name === CURRENT)
    expect(current === undefined || (current.size < MiB && !fs.readFileSync(path.join(logDir, CURRENT), 'utf8').includes('old-current-file'))).toBe(true)
    expect(lines.filter(l => l.startsWith(`[bat-scripts-log] rotated ${CURRENT} (${size} bytes > ${LIMIT}) -> ${rotated[0].name}`))).toHaveLength(1)
    expect(lines.filter(l => /failed/.test(l))).toEqual([])
    test.info().annotations.push({ type: 'result', description: `① PASS — ${CURRENT} ${size} B → ${rotated[0].name} (same size, first line kept); current file after startup: ${current ? `${current.size} B (new)` : 'absent'}; debug log ${JSON.stringify(lines)}` })

    // ── ④ a helper inside a tab of this instance writes the log again ──
    const { win } = inst
    const seed = {
      workspaces: [{ id: WS, name: 'e2e-t0737-rotation', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(async () => win.evaluate((id) => (window as AnyApi).electronAPI.pty.getCwd(id), TAB), { timeout: 30_000 }).not.toBeNull()
    await win.waitForTimeout(1_500) // let the shell print its prompt
    await runInTab(win, TAB, `node "${HELPER}" --set-role tower --agent claude`)
    const currentFile = path.join(logDir, CURRENT)
    type Ev = Record<string, unknown>
    let events: Ev[] = []
    await expect.poll(() => {
      if (!fs.existsSync(currentFile)) return 0
      events = fs.readFileSync(currentFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Ev)
      return events.filter(e => e.script === 'bat-terminal' && e.event === 'set-role').length
    }, { timeout: 30_000 }).toBeGreaterThan(0)
    await expect(win.locator('.workspace-container.active .thumbnail-title', { hasText: '· Tower' })).toHaveCount(1, { timeout: 30_000 })
    const helperEvents = events.filter(e => e.script === 'bat-terminal')
    const st = fs.statSync(currentFile)
    log(`④ ${CURRENT} after the helper: ${st.size} B, ${events.length} NDJSON lines (all parsed), bat-terminal events ${JSON.stringify(helperEvents.map(e => e.event))}, terminal id ${JSON.stringify(helperEvents[0]?.env && (helperEvents[0].env as Ev).BAT_TERMINAL_ID)}`)
    expect(st.size).toBeLessThan(MiB)
    expect(listLogs(logDir).filter(f => ROTATED.test(f.name)).map(f => f.name)).toEqual([rotated[0].name]) // no second rotation
    test.info().annotations.push({ type: 'result', description: `④ PASS — after the rotation, \`bat-terminal.mjs --set-role tower\` typed into tab ${TAB} wrote a new ${CURRENT} (${st.size} B, ${events.length} NDJSON lines, events ${JSON.stringify(helperEvents.map(e => e.event))}); the tab became "· Tower"` })
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  }
})

test('② only the newest 3 rotated files are kept (by the stamp in the name)', async () => {
  test.setTimeout(120_000)
  const old = ['bat-scripts-20250101-000001.log', 'bat-scripts-20250102-000002.log', 'bat-scripts-20250103-000003.log']
  let inst: IsolatedInstance | undefined
  try {
    const launched = await launchSeeded('t0737-rot2', (dir) => {
      // Written newest-first so the file times disagree with the names: the names must decide.
      for (const name of [...old].reverse()) fs.writeFileSync(path.join(dir, name), `${name}\n`)
      writeSized(path.join(dir, CURRENT), LIMIT + 1, '{"t0737":"current-2"}')
    })
    inst = launched.inst
    const { logDir } = launched
    const after = listLogs(logDir)
    const rotated = after.filter(f => ROTATED.test(f.name)).map(f => f.name)
    const lines = rotationLines(logDir)
    log(`② after startup: ${JSON.stringify(after)}; debug log: ${JSON.stringify(lines)}`)
    const fresh = rotated.filter(n => !old.includes(n))
    expect(fresh).toHaveLength(1)
    expect(fs.statSync(path.join(logDir, fresh[0])).size).toBe(LIMIT + 1)
    expect(rotated.sort()).toEqual([old[1], old[2], fresh[0]].sort())
    expect(fs.existsSync(path.join(logDir, old[0]))).toBe(false)
    expect(lines).toContain(`[bat-scripts-log] removed old ${old[0]} (keeping newest 3)`)
    expect(lines.filter(l => l.startsWith('[bat-scripts-log] rotated'))).toHaveLength(1)
    expect(lines.filter(l => /failed/.test(l))).toEqual([])
    test.info().annotations.push({ type: 'result', description: `② PASS — seeded ${JSON.stringify(old)} + ${CURRENT} ${LIMIT + 1} B → kept ${JSON.stringify(rotated.sort())}, deleted ${old[0]}; debug log ${JSON.stringify(lines)}` })
  } finally {
    await closeIsolated(inst, log)
  }
})

test('③ exactly 10 MiB is not over the limit: left alone', async () => {
  test.setTimeout(120_000)
  let inst: IsolatedInstance | undefined
  let hash = ''
  try {
    const launched = await launchSeeded('t0737-rot3', (dir) => {
      writeSized(path.join(dir, CURRENT), LIMIT, '{"t0737":"at-the-limit"}')
      hash = sha256(path.join(dir, CURRENT))
    })
    inst = launched.inst
    const { logDir } = launched
    await inst.win.waitForTimeout(3_000)
    const after = listLogs(logDir)
    const lines = rotationLines(logDir)
    const nowHash = sha256(path.join(logDir, CURRENT))
    log(`③ after startup: ${JSON.stringify(after)}; sha256 before ${hash.slice(0, 16)}… after ${nowHash.slice(0, 16)}…; debug log: ${JSON.stringify(lines)}`)
    expect(after).toEqual([{ name: CURRENT, size: LIMIT }])
    expect(nowHash).toBe(hash)
    expect(lines).toEqual([])
    test.info().annotations.push({ type: 'result', description: `③ PASS — ${CURRENT} of exactly ${LIMIT} B: same size and SHA-256 after startup, no rotated file, no [bat-scripts-log] line` })
  } finally {
    await closeIsolated(inst, log)
  }
})

test('⑤ the current file held open without sharing (Windows): BAT starts, one failure line, file kept', async () => {
  test.skip(process.platform !== 'win32', 'exclusive open (FileShare.None) is the Windows failure mode')
  test.setTimeout(120_000)
  const size = LIMIT + 2 * MiB
  let inst: IsolatedInstance | undefined
  let holder: ChildProcess | undefined
  try {
    const launched = await launchSeeded('t0737-rot5', async (dir) => {
      const file = path.join(dir, CURRENT)
      writeSized(file, size, '{"t0737":"locked"}')
      // A PowerShell process opens the file with FileShare.None and keeps it open.
      const script = `$f = [System.IO.File]::Open('${file.replace(/'/g, "''")}', 'Open', 'ReadWrite', 'None'); [Console]::Out.WriteLine('locked'); [Console]::Out.Flush(); Start-Sleep -Seconds 120; $f.Close()`
      holder = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('lock holder did not report within 20 s')), 20_000)
        holder!.stdout!.on('data', d => { if (String(d).includes('locked')) { clearTimeout(timer); resolve() } })
        holder!.once('exit', code => { clearTimeout(timer); reject(new Error(`lock holder exited ${code}`)) })
      })
    })
    inst = launched.inst
    const { logDir } = launched
    // BAT is up: the window answers and the workspace store loads.
    const loaded = await inst.win.evaluate(async () => typeof (await (window as AnyApi).electronAPI.workspace.load()))
    const lines = rotationLines(logDir)
    holder?.kill()
    await new Promise(r => setTimeout(r, 1_000))
    const after = listLogs(logDir)
    log(`⑤ while locked: workspace.load() → ${loaded}; debug log: ${JSON.stringify(lines)}; files after releasing the lock: ${JSON.stringify(after)}`)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^\[bat-scripts-log\] (rename|stat) bat-scripts\.log .*failed, will retry next startup \((EBUSY|EPERM|EACCES)/)
    expect(after).toEqual([{ name: CURRENT, size }])
    test.info().annotations.push({ type: 'result', description: `⑤ PASS — ${CURRENT} held open with FileShare.None by another process: BAT started (workspace.load ok), debug log exactly ${JSON.stringify(lines)}, file kept (${size} B), nothing rotated` })
  } finally {
    try { holder?.kill() } catch { /* ignore */ }
    await closeIsolated(inst, log)
  }
})
