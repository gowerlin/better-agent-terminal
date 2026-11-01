// T0742 / BUG-159 (sub-item): a codex tab the user opens with BAT MCP turned off gets `--no-daemon`
// (T0651), so it does not run on codex's shared app-server daemon, whose shell commands carry another
// tab's BAT_*. Only the injection is checked here: the daemon behaviour itself needs a non-elevated
// BAT and a logged-in codex and stays manual.
//
// Before T0651 a codex tab without the MCP args got nothing (`git show 5b1be0f5^:electron/bat-mcp-launch.ts`:
// Settings off → `{ injected: false, reason }`, no codex part at all), so its command line was plain `codex`.
//
// One scenario: Settings `batMcpEnabled: false`; a Codex CLI tab from the thumbnail "+" menu. The
// decision probes the codex on BAT's PATH (`codex --version`, must be >= 0.156.0; the real codex.exe).
// BAT gets PATH without node_modules/.bin (see APP_PATH). The tab's shell must not start the real
// codex (no login, no daemon), so the workspace env puts a directory first on the tab's PATH whose
// `codex.cmd` only prints its arguments. The test checks the
// launch decision in the debug log and the arguments the tab's command line handed to `codex`.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only
// (pwsh tab, codex.cmd shim). Nothing here starts a model or codex itself.

import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0742-no-daemon')
const WS = 'e2e-t0742-codex-ws'
const SHELL_TAB = 'e2e-t0742-codex-shell'
const ARGV_MARK = 'T0742ARGV'

const pathKey = Object.keys(process.env).find(k => k.toLowerCase() === 'path') ?? 'Path'
// `npx playwright` puts node_modules/.bin first on PATH; it holds the embedded codex's npm shim
// (`codex.cmd`), which BAT's probe cannot run without a shell (→ version unknown, no `--no-daemon`).
// BAT started normally (Start menu / installer) has no node_modules/.bin, so the app gets PATH without it.
const APP_PATH = (process.env[pathKey] ?? '').split(';').filter(d => !/node_modules[\\/]\.bin/i.test(d)).join(';')

/** The first codex.exe on the app's PATH (what BAT's version probe finds), or null. */
function codexOnPath(): string | null {
  for (const dir of APP_PATH.split(';')) {
    const d = dir.trim().replace(/^"(.*)"$/, '$1')
    if (!d) continue
    const names = ['codex.exe', 'codex.cmd', 'codex.bat', 'codex.ps1', 'codex.com'].filter(n => fs.existsSync(path.join(d, n)))
    if (names.length) return names.includes('codex.exe') ? path.join(d, 'codex.exe') : null
  }
  return null
}

function versionOf(bin: string): string | null {
  try {
    return /codex-cli\s+v?(\d+\.\d+\.\d+)/i.exec(execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 10_000, windowsHide: true }))?.[1] ?? null
  } catch {
    return null
  }
}

const atLeast = (v: string, min: string) => {
  const a = v.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

const bufferOf = (win: Page, id: string): Promise<string> =>
  win.evaluate(async (i) => (await (window as AnyApi).electronAPI.pty.getBuffer(i))?.data ?? '', id)

const plain = (s: string) => s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '').replace(/\r?\n/g, '')

const CODEX = process.platform === 'win32' ? codexOnPath() : null
const CODEX_VERSION = CODEX ? versionOf(CODEX) : null

test.skip(process.platform !== 'win32', 'pwsh tab + codex.cmd shim: Windows only')
test.skip(!CODEX || !CODEX_VERSION || !atLeast(CODEX_VERSION, '0.156.0'), `needs codex.exe >= 0.156.0 first on PATH (found ${CODEX ?? 'none'} ${CODEX_VERSION ?? ''})`)

test('a codex tab opened with BAT MCP off gets --no-daemon on its command line', async () => {
  test.setTimeout(150_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0742-codex-'))
  const folder = path.join(tmp, 'ws')
  const shimDir = path.join(tmp, 'shim')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(shimDir, { recursive: true })
  fs.writeFileSync(path.join(shimDir, 'codex.cmd'), `@echo ${ARGV_MARK} %*\r\n`)
  let inst: IsolatedInstance | undefined
  try {
    log(`codex on BAT's PATH: ${CODEX} ${CODEX_VERSION}; tab PATH starts with the shim dir ${shimDir}`)
    inst = await launchIsolated('t0742-no-daemon', log, { env: { [pathKey]: APP_PATH } })
    const { win, userData } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    await win.evaluate(async () => {
      const api = (window as AnyApi).electronAPI
      const current = JSON.parse((await api.settings.load()) || '{}')
      await api.settings.save(JSON.stringify({ ...current, batMcpEnabled: false }))
    })
    const seed = {
      workspaces: [{
        id: WS, name: 'T0742 codex', folderPath: folder, createdAt: Date.now(),
        envVars: [{ key: pathKey, value: `${shimDir};${APP_PATH}`, enabled: true }],
      }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: SHELL_TAB, workspaceId: WS, type: 'terminal', title: 'T0742 shell', cwd: folder }],
      activeTerminalId: SHELL_TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload() // the renderer's Settings copy now has batMcpEnabled: false too
    await win.waitForLoadState('domcontentloaded')
    const recovery = win.locator('.recovery-prompt-dialog')
    if (await recovery.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)) {
      await recovery.locator('.recovery-prompt-actions .btn-primary').click()
      log('answered the Recovery prompt after the reload (keep)')
    }
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.thumbnail-add-btn')).toBeVisible({ timeout: 30_000 })
    expect(JSON.parse((await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())) || '{}').batMcpEnabled).toBe(false)

    const known = new Set(((JSON.parse(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) as { terminals: { id: string }[] }).terminals).map(t => t.id))
    await view.locator('.thumbnail-add-btn').click()
    const item = win.locator('.thumbnail-add-menu-item:not(.disabled)', { hasText: 'Codex CLI' }).first()
    await expect(item).toBeVisible({ timeout: 10_000 })
    await item.click()
    let tabId = ''
    await expect.poll(async () => {
      const entry = JSON.parse(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) as { terminals: { id: string; agentPreset?: string }[] }
      tabId = entry.terminals.find(t => !known.has(t.id) && t.agentPreset === 'codex-cli')?.id ?? ''
      return tabId
    }, { timeout: 15_000 }).not.toBe('')
    log(`Codex CLI tab ${tabId} added from the "+" menu`)

    // The decision (main): injected --no-daemon, MCP off.
    let decision = ''
    await expect.poll(() => {
      decision = readDebugLogs(userData).split('\n').find(l => l.includes('[bat-mcp] tab agent=codex-cli') && l.includes(`terminal=${tabId}`)) ?? ''
      return decision
    }, { timeout: 20_000 }).not.toBe('')
    const probe = readDebugLogs(userData).split('\n').filter(l => l.includes('[codex-version]'))
    log(`decision: ${decision.trim()}`)
    log(`probe: ${probe.map(l => l.trim()).join(' | ')}`)
    expect(decision).toContain('→ injected: --no-daemon')
    expect(decision).toMatch(/mcp=no \(/)
    expect(probe.some(l => l.toLowerCase().includes(CODEX!.toLowerCase()) && l.includes(`version=${CODEX_VERSION}`))).toBe(true)

    // The tab's command line: the shim prints what `codex` was called with.
    let argv = ''
    await expect.poll(async () => {
      const m = new RegExp(`${ARGV_MARK} ([^\\r\\n]*?)(?=PS |$)`).exec(plain(await bufferOf(win, tabId)).replace(new RegExp(`.*(${ARGV_MARK} )`), '$1'))
      argv = m?.[1]?.trim() ?? ''
      return argv
    }, { timeout: 20_000 }).not.toBe('')
    log(`codex was called with: ${argv}`)
    expect(argv.split(/\s+/)).toContain('--no-daemon')
    await win.screenshot({ path: test.info().outputPath('codex-tab.png') })
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
