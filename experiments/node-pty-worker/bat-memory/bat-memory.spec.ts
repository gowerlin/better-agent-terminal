// T0887: BAT Terminal Server memory with N idle pwsh tabs, base (v0.8.x, node-pty's Worker per PTY) vs this branch (one
// shared conout Worker, electron/terminal-server/shared-conout.ts). Copied from branch ct/T0885
// experiments/rust-eval/bat-baseline/bat-baseline.spec.ts (idle part only, the original is left untouched); tree-usage.ps1
// is the ct/T0886 copy with the creation-time fix (a child must be created after its parent).
//
// Source build (dist-electron of the checkout this file sits in) + isolated runtime / userData via
// e2e/fixtures/electron-isolation.ts; never the installed BAT or the user's userData. Read-only: this spec ends no
// process itself (closeIsolated does its usual teardown).
//
// Per N (1 / 5 / 10), RUNS times: prep launch seeds a workspace with N tabs and closes keeping the runtime userData; the
// measured launch restores them, waits for every pwsh prompt, settles SETTLE_MS, then reads the Terminal Server's own
// Private Bytes (pid from bat-pty-server.pid) and the whole tree. Rows go to experiments/node-pty-worker/results/bat-memory.csv
// with Label = $T0887_LABEL (e.g. base / shared).
import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launchIsolated, closeIsolated, testLogger, type IsolatedInstance } from '../../../e2e/fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any
const log = testLogger('t0887')
const RUNS = Number(process.env.T0887_RUNS || 3)
const LABEL = process.env.T0887_LABEL || 'unlabelled'
const TABS = (process.env.T0887_TABS || '1,5,10').split(',').map(Number)
const SETTLE_MS = 10_000
const TREE = path.join(__dirname, 'tree-usage.ps1')
const OUT = process.env.T0887_OUT || path.join(__dirname, '..', 'results', 'bat-memory.csv')
const PROMPT = /PS [^\r\n]*>/
const WS = 'ws-t0887'

interface Usage { fwPrivMB: number; fwWsMB: number; fwProcs: number; shellPrivMB: number; shellProcs: number; fwNames: string; per: { Pid: number; Name: string; PrivMB: number; WsMB: number; Shell: boolean }[] }

function treeUsage(pid: number): Promise<Usage> {
  return new Promise((resolve, reject) => {
    execFile('pwsh', ['-NoProfile', '-NonInteractive', '-File', TREE, '-RootPid', String(pid)], { timeout: 60_000, windowsHide: true }, (err, stdout) => {
      if (err) reject(err)
      else resolve(JSON.parse(stdout.trim()) as Usage)
    })
  })
}

/** Thread count of one process (Get-Process, read-only). */
function threadCount(pid: number): Promise<number> {
  return new Promise((resolve) => {
    execFile('pwsh', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${pid}).Threads.Count`], { timeout: 30_000, windowsHide: true }, (err, stdout) => {
      resolve(err ? -1 : Number(stdout.trim()))
    })
  })
}

const COLS = ['Label', 'Tabs', 'Run', 'AllPromptsMs', 'TerminalServerPrivMB', 'TerminalServerWsMB', 'TerminalServerThreads', 'MainPrivMB', 'FwPrivMB', 'FwProcs', 'ShellPrivMB', 'ShellProcs', 'FwNames', 'At']
function appendRow(row: Record<string, string | number>) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  if (!fs.existsSync(OUT)) fs.writeFileSync(OUT, COLS.map(c => `"${c}"`).join(',') + '\n')
  fs.appendFileSync(OUT, COLS.map(c => `"${row[c] ?? ''}"`).join(',') + '\n')
}

function nowIso(): string {
  const d = new Date(); const off = -d.getTimezoneOffset(); const sign = off >= 0 ? '+' : '-'
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
  const local = new Date(d.getTime() + off * 60_000).toISOString().slice(0, 19)
  return `${local}${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
}

async function prepare(tabs: number, folder: string): Promise<{ runtimeId: string; ids: string[] }> {
  const inst = await launchIsolated(`t0887-n${tabs}`, log)
  const ids = Array.from({ length: tabs }, (_, i) => `t0887-tab-${i}`)
  try {
    const { win } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0887', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: ids.map(id => ({ id, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder })),
      activeTerminalId: ids[0],
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(tabs, { timeout: 60_000 })
    await win.waitForTimeout(2000)
  } finally {
    await closeIsolated(inst, log, { keepUserData: true })
  }
  return { runtimeId: inst.runtimeId, ids }
}

async function bufferText(inst: IsolatedInstance, id: string): Promise<string> {
  const buf = await inst.win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id).catch(() => null)
  if (!buf) return ''
  const data = typeof buf === 'string' ? buf : (buf.data ?? '')
  return typeof data === 'string' ? data : JSON.stringify(data)
}

async function scenario(tabs: number) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0887-'))
  for (let run = 1; run <= RUNS; run++) {
    const { runtimeId, ids } = await prepare(tabs, folder)
    const t0 = Date.now()
    const inst = await launchIsolated(`t0887-n${tabs}`, log, { runtimeId })
    try {
      const prompted = new Map<string, number>()
      const deadline = Date.now() + 90_000
      while (prompted.size < ids.length && Date.now() < deadline) {
        for (const id of ids) {
          if (prompted.has(id)) continue
          if (PROMPT.test(await bufferText(inst, id))) prompted.set(id, Date.now())
        }
        await new Promise(r => setTimeout(r, 50))
      }
      expect(prompted.size, 'all restored tabs reached the pwsh prompt').toBe(ids.length)
      const allPrompts = Math.max(...prompted.values()) - t0
      const mainPid = await inst.app.evaluate(() => process.pid)
      await inst.win.waitForTimeout(SETTLE_MS)
      const u = await treeUsage(mainPid)
      const serverPid = (() => { try { return Number(fs.readFileSync(path.join(inst.userData, 'bat-pty-server.pid'), 'utf8').trim()) } catch { return 0 } })()
      const serverUsage = serverPid ? await treeUsage(serverPid) : null
      const serverSelf = serverUsage?.per.find(p => p.Pid === serverPid)
      const row = {
        Label: LABEL, Tabs: tabs, Run: run, AllPromptsMs: allPrompts,
        TerminalServerPrivMB: serverSelf?.PrivMB ?? '', TerminalServerWsMB: serverSelf?.WsMB ?? '',
        TerminalServerThreads: serverPid ? await threadCount(serverPid) : '',
        MainPrivMB: u.per[0]?.PrivMB ?? '', FwPrivMB: u.fwPrivMB, FwProcs: u.fwProcs,
        ShellPrivMB: u.shellPrivMB, ShellProcs: u.shellProcs, FwNames: u.fwNames,
        At: nowIso(),
      }
      appendRow(row)
      log(JSON.stringify(row))
    } finally {
      await closeIsolated(inst, log)
    }
  }
  fs.rmSync(folder, { recursive: true, force: true })
}

test.describe.configure({ mode: 'serial' })
for (const tabs of TABS) {
  test(`${LABEL}: idle tabs = ${tabs}`, async () => { await scenario(tabs) })
}
