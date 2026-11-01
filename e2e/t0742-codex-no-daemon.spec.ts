// T0742 / BUG-159 (sub-item): a codex tab the user opens with BAT MCP turned off gets `--no-daemon`
// (T0651), so it does not run on codex's shared app-server daemon, whose shell commands carry another
// tab's BAT_*. Only the injection is checked here: the daemon behaviour itself needs a non-elevated
// BAT and a logged-in codex and stays manual.
//
// Before T0651 a codex tab without the MCP args got nothing (`git show 5b1be0f5^:electron/bat-mcp-launch.ts`:
// Settings off → `{ injected: false, reason }`, no codex part at all), so its command line was plain `codex`.
//
// Settings `batMcpEnabled: false`; a Codex CLI tab from the thumbnail "+" menu. The decision probes
// the codex on BAT's PATH (`codex --version`, must be >= 0.156.0). Two scenarios, BAT's PATH differs:
//   - codex.exe: BAT gets PATH without node_modules/.bin (see APP_PATH); the first codex is the real
//     codex.exe (skipped when the machine has none).
//   - npm shim (T0758 / BUG-189): a directory laid out like `npm i -g @openai/codex` goes first on
//     BAT's PATH: `codex.cmd` / `codex.ps1` (npm's own shim text) → node_modules\@openai\codex\bin\codex.js,
//     with the platform package nested under it (a junction to the repo's embedded
//     @openai/codex-win32-x64). Before T0758 the probe stopped at the shim (`version=unknown`, no
//     `--no-daemon`); now it reads the shim and probes the nested codex.exe.
// The tab's shell must not start the real codex (no login, no daemon), so the workspace env puts a
// directory first on the tab's PATH whose `codex.cmd` only prints its arguments. The test checks the
// launch decision in the debug log and the arguments the tab's command line handed to `codex`.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only
// (pwsh tab, codex.cmd shim). Nothing here starts a model or codex itself.

import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

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

// T0758: the repo's embedded npm codex (what the npm-shim scenario links to)
const REPO_NODE_MODULES = path.join(REPO_ROOT, 'node_modules')
const EMBEDDED_PLATFORM_PKG = path.join(REPO_NODE_MODULES, '@openai', 'codex-win32-x64')
const EMBEDDED_EXE = path.join(EMBEDDED_PLATFORM_PKG, 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe')
const EMBEDDED_VERSION = process.platform === 'win32' && process.arch === 'x64' && fs.existsSync(EMBEDDED_EXE) ? versionOf(EMBEDDED_EXE) : null

/** npm 11's cmd-shim / ps1 shim for `npm i -g @openai/codex` (T0758 查證: written by `npm i -g --prefix`). */
const NPM_GLOBAL_CMD = [
  '@ECHO off', 'GOTO start', ':find_dp0', 'SET dp0=%~dp0', 'EXIT /b', ':start', 'SETLOCAL', 'CALL :find_dp0', '',
  'IF EXIST "%dp0%\\node.exe" (', '  SET "_prog=%dp0%\\node.exe"', ') ELSE (', '  SET "_prog=node"', ')', '',
  'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*',
].join('\r\n')
const NPM_GLOBAL_PS1 = [
  '#!/usr/bin/env pwsh', '$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent', '$exe=".exe"',
  'if (Test-Path "$basedir/node$exe") {', '  & "$basedir/node$exe"  "$basedir/node_modules/@openai/codex/bin/codex.js" $args',
  '} else {', '  & "node$exe"  "$basedir/node_modules/@openai/codex/bin/codex.js" $args', '}', 'exit $LASTEXITCODE',
].join('\n')

/**
 * `<dir>` laid out like `npm i -g --prefix <dir> @openai/codex`: the shims, the package's codex.js /
 * package.json (copied), its nested platform package (a junction to the repo's). Returns the codex.exe
 * the probe must find and a cleanup that removes the junction itself, never what it points at.
 */
function npmGlobalInstall(dir: string): { exe: string; cleanup: () => void } {
  const pkg = path.join(dir, 'node_modules', '@openai', 'codex')
  fs.mkdirSync(path.join(pkg, 'bin'), { recursive: true })
  fs.copyFileSync(path.join(REPO_NODE_MODULES, '@openai', 'codex', 'bin', 'codex.js'), path.join(pkg, 'bin', 'codex.js'))
  fs.copyFileSync(path.join(REPO_NODE_MODULES, '@openai', 'codex', 'package.json'), path.join(pkg, 'package.json'))
  fs.writeFileSync(path.join(dir, 'codex.cmd'), NPM_GLOBAL_CMD)
  fs.writeFileSync(path.join(dir, 'codex.ps1'), NPM_GLOBAL_PS1)
  const link = path.join(pkg, 'node_modules', '@openai', 'codex-win32-x64')
  fs.mkdirSync(path.dirname(link), { recursive: true })
  fs.symlinkSync(EMBEDDED_PLATFORM_PKG, link, 'junction')
  return {
    exe: path.join(link, 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
    cleanup: () => {
      if (fs.existsSync(link)) fs.unlinkSync(link) // the junction only
      if (!fs.existsSync(EMBEDDED_EXE)) throw new Error(`the embedded codex is gone after removing the junction: ${EMBEDDED_EXE}`)
    },
  }
}

test.skip(process.platform !== 'win32', 'pwsh tab + codex.cmd shim: Windows only')

test('a codex tab opened with BAT MCP off gets --no-daemon on its command line', async () => {
  test.skip(!CODEX || !CODEX_VERSION || !atLeast(CODEX_VERSION, '0.156.0'), `needs codex.exe >= 0.156.0 first on PATH (found ${CODEX ?? 'none'} ${CODEX_VERSION ?? ''})`)
  await codexTabGetsNoDaemon('t0742-no-daemon', () => ({ appPath: APP_PATH, probePath: CODEX!, version: CODEX_VERSION! }))
})

test('T0758 / BUG-189: the first codex on the app PATH is an npm shim → probed through it, --no-daemon', async () => {
  test.skip(!EMBEDDED_VERSION || !atLeast(EMBEDDED_VERSION, '0.156.0'), `needs the embedded npm codex >= 0.156.0 (x64; found ${EMBEDDED_VERSION ?? 'none'})`)
  let cleanup: (() => void) | undefined
  try {
    await codexTabGetsNoDaemon('t0758-npm-shim', (tmp) => {
      const npmDir = path.join(tmp, 'npm')
      const install = npmGlobalInstall(npmDir)
      cleanup = install.cleanup
      return { appPath: `${npmDir};${APP_PATH}`, probePath: install.exe, version: EMBEDDED_VERSION!, via: path.join(npmDir, 'codex.cmd') }
    })
  } finally {
    cleanup?.()
  }
})

/**
 * Isolated BAT with `setup(tmp).appPath` as PATH; a Codex CLI tab with BAT MCP off. The probe line must
 * name `probePath` (and `via`, the npm shim) with `version`; the tab's command line must carry `--no-daemon`.
 */
async function codexTabGetsNoDaemon(name: string, setup: (tmp: string) => { appPath: string; probePath: string; version: string; via?: string }): Promise<void> {
  test.setTimeout(150_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0742-codex-'))
  const folder = path.join(tmp, 'ws')
  const shimDir = path.join(tmp, 'shim')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(shimDir, { recursive: true })
  fs.writeFileSync(path.join(shimDir, 'codex.cmd'), `@echo ${ARGV_MARK} %*\r\n`)
  let inst: IsolatedInstance | undefined
  try {
    const { appPath, probePath, version, via } = setup(tmp)
    log(`BAT's PATH starts with ${appPath.split(';')[0]}; expected probe ${probePath} ${version}${via ? ` via ${via}` : ''}; tab PATH starts with the shim dir ${shimDir}`)
    inst = await launchIsolated(name, log, { env: { [pathKey]: appPath } })
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
        envVars: [{ key: pathKey, value: `${shimDir};${appPath}`, enabled: true }],
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
    expect(probe.some(l => l.toLowerCase().includes(`path=${probePath.toLowerCase()} `) && l.includes(`version=${version}`)
      && (!via || l.toLowerCase().includes(`via=${via.toLowerCase()}`)))).toBe(true)

    // The tab's command line: the shim prints what `codex` was called with.
    let argv = ''
    await expect.poll(async () => {
      const m = new RegExp(`${ARGV_MARK} ([^\\r\\n]*?)(?=PS |$)`).exec(plain(await bufferOf(win, tabId)).replace(new RegExp(`.*(${ARGV_MARK} )`), '$1'))
      argv = m?.[1]?.trim() ?? ''
      return argv
    }, { timeout: 20_000 }).not.toBe('')
    log(`codex was called with: ${argv}`)
    expect(argv.split(/\s+/)).toContain('--no-daemon')
    await win.screenshot({ path: test.info().outputPath(`${name}-codex-tab.png`) })
  } finally {
    await closeIsolated(inst, log)
    // the npm-shim scenario's junction goes first, so rmSync never walks into the repo's node_modules
    const junction = path.join(tmp, 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64')
    if (fs.existsSync(junction)) fs.unlinkSync(junction)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
