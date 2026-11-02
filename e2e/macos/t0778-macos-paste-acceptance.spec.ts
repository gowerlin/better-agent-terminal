// T0778: BUG-128 (Finder-copied files + Command+V in a terminal tab, T0522) and the macOS half of
// BUG-130 (terminal image paste key, T0524) on a GitHub Actions macOS runner, against an *installed*
// BAT (the release dmg's .app, `BAT_E2E_EXECUTABLE`), not a source build.
//
// Run by .github/workflows/macos-acceptance.yml (workflow_dispatch only). Probes P1–P5 answer "can the
// runner do this at all"; scenarios ①–⑧ are the acceptance cases. Every probe / scenario is a row in
// `macos-report.md` / `.json` (written after each row, so a timeout still leaves a report) under
// `MACOS_REPORT_DIR`. A refusal by macOS privacy controls (TCC) is a result (`不可行`), never worked around.
//
// The terminal tab runs a node script that puts stdin in raw mode and prints each chunk it receives as
// hex: the bytes a CLI in that PTY would read (same technique as e2e/t0524-terminal-image-paste.spec.ts).

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, E2E_EXECUTABLE, launchIsolated, testLogger, type IsolatedInstance } from '../fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi } from '../fixtures/fake-anthropic-api'
import {
  applescript, describeCmd, jxa, posixQuote, readPasteboard, runCmd, stripAnsi, stripBracketedPaste, tccVerdict, writeScripts,
  type CmdResult, type Scripts,
} from './mac-os'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0778')
const WS = 'e2e-t0778-ws'
const TERM = 'e2e-t0778-term'
const FAKE_KEY = 'sk-t0778-fake-key-not-checked-0000000000'

const ECHO_SCRIPT = `
process.stdin.setRawMode(true)
process.stdin.resume()
console.log('T0778_ECHO_READY')
process.stdin.on('data', (d) => {
  if (d.toString('utf8').includes('QUIT0778')) { console.log('T0778_ECHO_BYE'); process.exit(0) }
  console.log('T0778_HEX:' + d.toString('hex') + ':END')
})
`

type Result = 'PASS' | 'FAIL' | 'PARTIAL' | '不可行' | 'SKIP' | 'ERROR'

interface Row {
  id: string
  title: string
  result: Result
  /** which key path: Playwright (CDP key events) and / or OS (System Events) */
  keys?: string
  /** clipboard source: script (JXA NSPasteboard / pbcopy / Electron) and / or Finder */
  clipboard?: string
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
    fs.writeFileSync(path.join(this.dir, 'macos-report.json'), JSON.stringify({ meta: this.meta, rows: this.rows }, null, 2))
    const md: string[] = ['# T0778 macOS acceptance report', '']
    for (const [k, v] of Object.entries(this.meta)) md.push(`- **${k}**: ${v}`)
    md.push('', '| ID | 結果 | 按鍵 | 剪貼簿 | 項目 |', '|---|---|---|---|---|')
    for (const r of this.rows) md.push(`| ${r.id} | ${r.result} | ${r.keys ?? ''} | ${r.clipboard ?? ''} | ${r.title} |`)
    md.push('')
    for (const r of this.rows) {
      md.push(`## ${r.id} — ${r.result}`, '', r.title, '')
      for (const e of r.evidence) md.push(`- ${e.replace(/\n/g, ' ')}`)
      md.push('')
    }
    fs.writeFileSync(path.join(this.dir, 'macos-report.md'), md.join('\n'))
  }
}

const hexChunks = (buf: string): string[] => [...buf.matchAll(/T0778_HEX:([0-9a-f]*):END/g)].map(m => m[1])
const decode = (chunks: string[]): string => stripBracketedPaste(Buffer.from(chunks.join(''), 'hex').toString('utf8'))
const show = (s: string): string => JSON.stringify(s)
/** ASCII file name for a row id (artifact paths). */
const slug = (id: string): string => ({ '①': 's1', '②': 's2', '③': 's3', '④': 's4', '⑤': 's5', '⑤b': 's5b', '⑥': 's6', '⑦': 's7', '⑧': 's8' } as Record<string, string>)[id] ?? id

function verdictOf(results: Result[]): Result {
  const ran = results.filter(r => r !== 'SKIP' && r !== '不可行')
  if (results.includes('ERROR')) return 'ERROR'
  if (ran.length === 0) return results.includes('不可行') ? '不可行' : 'SKIP'
  if (ran.every(r => r === 'PASS')) return 'PASS'
  if (ran.some(r => r === 'PASS')) return 'PARTIAL'
  return 'FAIL'
}

/** Executable `claude` files bundled in the .app (app.asar.unpacked), for scenario ⑧. */
function findEmbeddedClaude(executable: string): string[] {
  const base = path.join(path.dirname(executable), '..', 'Resources', 'app.asar.unpacked', 'node_modules', '@anthropic-ai')
  const found: string[] = []
  const walk = (dir: string, depth: number) => {
    if (depth > 4) return
    let entries: fs.Dirent[] = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p, depth + 1)
      else if (e.name === 'claude') {
        try { if (fs.statSync(p).mode & 0o111) found.push(p) } catch { /* ignore */ }
      }
    }
  }
  walk(base, 0)
  return found
}

test.skip(process.platform !== 'darwin', 'T0778: macOS runner only')
test.skip(!E2E_EXECUTABLE, 'T0778: BAT_E2E_EXECUTABLE must point to the installed .app executable')

test('T0778 macOS paste acceptance (BUG-128 / BUG-130)', async () => {
  test.setTimeout(20 * 60_000)
  const reportDir = process.env.MACOS_REPORT_DIR || test.info().outputPath('report')
  fs.mkdirSync(reportDir, { recursive: true })
  const report = new Report(reportDir)

  // RUNNER_TEMP (under the runner's home) when set: a normal Finder-visible folder. realpath: /var → /private/var,
  // so the paths written to the clipboard are the ones BAT types.
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 't0778-')))
  const folder = path.join(tmp, 'ws')
  const filesDir = path.join(tmp, 'files')
  const zdot = path.join(tmp, 'zdot')
  for (const d of [folder, filesDir, zdot]) fs.mkdirSync(d, { recursive: true })
  const fileA = path.join(filesDir, 'alpha.txt')
  const fileB = path.join(filesDir, 'beta.txt')
  const fileSpace = path.join(filesDir, 'with space.txt')
  for (const f of [fileA, fileB, fileSpace]) fs.writeFileSync(f, `T0778 ${path.basename(f)}\n`)
  // A fresh zsh with no .zshrc shows the zsh-newuser-install menu, which would eat the typed command.
  fs.writeFileSync(path.join(zdot, '.zshrc'), "PROMPT='t0778%% '\n")
  const echoScript = path.join(tmp, 'echo-stdin.js')
  fs.writeFileSync(echoScript, ECHO_SCRIPT)
  const scripts: Scripts = writeScripts(path.join(tmp, 'scripts'))

  const sw = await runCmd('sw_vers', [])
  const mgr = await runCmd('launchctl', ['managername'])
  report.meta = {
    executable: E2E_EXECUTABLE,
    macOS: sw.stdout.replace(/\s+/g, ' '),
    launchctlManager: mgr.stdout || describeCmd(mgr),
    arch: `${process.platform}-${process.arch}`,
    startedAt: new Date().toISOString(),
  }

  let inst: IsolatedInstance | undefined
  try {
    // ------------------------------------------------------------------ P1 launch + screenshot
    try {
      inst = await launchIsolated('t0778-mac', log, { env: { ZDOTDIR: zdot, BASH_SILENCE_DEPRECATION_WARNING: '1' } })
    } catch (err) {
      report.add({ id: 'P1', title: 'runner 上啟動安裝版隔離實例並截圖', result: 'FAIL', evidence: [`launch failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 1500)] })
      throw err
    }
    const { app, win } = inst
    const appMeta = await app.evaluate(({ app: a, BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      return { version: a.getVersion(), electron: process.versions.electron, visible: w?.isVisible() ?? false, bounds: w ? JSON.stringify(w.getBounds()) : '', focused: BrowserWindow.getFocusedWindow() !== null, pid: process.pid }
    })
    report.meta.appVersion = appMeta.version
    report.meta.electron = appMeta.electron
    report.flush()

    await expect.poll(async () => win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()).then(v => v !== null), { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0778 mac paste', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TERM, workspaceId: WS, type: 'terminal', title: 'T0778 terminal' }],
      activeTerminalId: TERM,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await win.evaluate((id) => {
      const w = window as AnyApi
      w.__t0778 = ''
      w.electronAPI.pty.onOutput((pid: string, data: string) => { if (pid === id) w.__t0778 += data })
    }, TERM)
    const xterm = win.locator('.terminal-panel .xterm').first()
    let xtermVisible = true
    await expect(xterm).toBeVisible({ timeout: 30_000 }).catch(() => { xtermVisible = false })
    const ptyOut = () => win.evaluate(() => (window as AnyApi).__t0778 as string)

    let echoReady = false
    if (xtermVisible) {
      const cmd = `${posixQuote(process.execPath)} ${posixQuote(echoScript)}\r`
      echoReady = await expect.poll(async () => {
        const out = await ptyOut()
        if (out.includes('T0778_ECHO_READY')) return true
        await win.evaluate(([id, c]) => (window as AnyApi).electronAPI.pty.write(id, c), [TERM, cmd])
        return false
      }, { timeout: 60_000, intervals: [4_000] }).toBe(true).then(() => true, () => false)
    }
    const pwShot = await win.screenshot({ path: path.join(reportDir, 'p1-window.png') }).then(() => 'ok', (e: Error) => `failed: ${e.message}`)
    const screen = await runCmd('screencapture', ['-x', path.join(reportDir, 'p1-screen.png')], 20_000)
    const screenSize = fs.existsSync(path.join(reportDir, 'p1-screen.png')) ? fs.statSync(path.join(reportDir, 'p1-screen.png')).size : 0
    const p1Evidence = [
      `app ${appMeta.version} (Electron ${appMeta.electron}) pid=${appMeta.pid}; window visible=${appMeta.visible} bounds=${appMeta.bounds} focusedWindow=${appMeta.focused}`,
      `xterm visible=${xtermVisible}; hex echo in the PTY ready=${echoReady}`,
      `Playwright window screenshot (CDP, no TCC needed): ${pwShot} → p1-window.png`,
      `OS screencapture -x: ${describeCmd(screen)}; file ${screenSize} bytes → p1-screen.png (a desktop-only image means Screen Recording is not granted)`,
      `launchctl managername: ${report.meta.launchctlManager}`,
    ]
    if (!echoReady) p1Evidence.push(`PTY output tail: ${show(stripAnsi(await ptyOut()).slice(-600))}`)
    report.add({ id: 'P1', title: 'runner 上啟動安裝版隔離實例並截圖（圖形環境）', result: xtermVisible && echoReady && pwShot === 'ok' ? 'PASS' : 'FAIL', evidence: p1Evidence })
    if (!xtermVisible || !echoReady) return

    // ------------------------------------------------------------------ shared helpers
    const batView = async (): Promise<string> => {
      const main = await app.evaluate(({ clipboard }) => ({
        formats: clipboard.availableFormats(),
        NSFilenamesPboardType: clipboard.read('NSFilenamesPboardType').slice(0, 500),
        publicFileUrl: clipboard.read('public.file-url').slice(0, 300),
        hasImage: !clipboard.readImage().isEmpty(),
      }))
      const readFilePaths = await win.evaluate(async () => (window as AnyApi).electronAPI.clipboard.readFilePaths()).catch((e: Error) => `threw ${e.message}`)
      return JSON.stringify({ ...main, readFilePaths })
    }
    const pasteboard = async (): Promise<string> => {
      const { view, raw } = await readPasteboard(scripts)
      return view ? JSON.stringify(view) : `read failed: ${describeCmd(raw)}`
    }

    /** Puts BAT in front with the terminal focused; evidence of what macOS reports as frontmost. */
    const focusBat = async (): Promise<string> => {
      await app.evaluate(({ app: a, BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0]
        a.focus({ steal: true })
        w?.show()
        w?.focus()
        w?.moveTop()
      })
      await new Promise(r => setTimeout(r, 500))
      let front = await applescript(scripts.frontmost, [], 15_000)
      if (front.code === 0 && !/BetterAgentTerminal|Electron/i.test(front.stdout)) {
        await applescript(scripts.setFrontmost, [String(appMeta.pid)], 15_000)
        await new Promise(r => setTimeout(r, 500))
        front = await applescript(scripts.frontmost, [], 15_000)
      }
      await xterm.click()
      const focused = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow() !== null)
      return `frontmost: ${front.code === 0 ? front.stdout : describeCmd(front)}; Electron focused window: ${focused}`
    }

    /** Runs `act`, then returns what the PTY read afterwards (decoded; '' when nothing arrived in 8 s). */
    const collect = async (act: () => Promise<unknown>): Promise<{ got: string; chunks: string[] }> => {
      const before = hexChunks(await ptyOut()).length
      await act()
      await expect.poll(async () => hexChunks(await ptyOut()).length, { timeout: 8_000 }).toBeGreaterThan(before).catch(() => { /* nothing arrived */ })
      await new Promise(r => setTimeout(r, 700))
      const chunks = hexChunks(await ptyOut()).slice(before)
      return { got: decode(chunks), chunks }
    }

    let osKeys: 'unknown' | 'ok' | 'blocked' = 'unknown'
    let osKeysEvidence = ''

    interface Attempt { label: string; result: Result; evidence: string }
    /** One key press against the current clipboard. via 'os' = System Events keystroke. */
    const press = async (key: 'command' | 'control', via: 'pw' | 'os', expected: string, clipLabel: string): Promise<Attempt> => {
      const label = `${key === 'command' ? 'Command+V' : 'Control+V'} via ${via === 'pw' ? 'Playwright' : 'OS (System Events)'} / ${clipLabel}`
      if (via === 'os' && osKeys === 'blocked') return { label, result: '不可行', evidence: `OS keystrokes blocked earlier: ${osKeysEvidence}` }
      if (via === 'pw') {
        await xterm.click()
        const { got, chunks } = await collect(() => win.keyboard.press(key === 'command' ? 'Meta+v' : 'Control+v'))
        return { label, result: got === expected ? 'PASS' : 'FAIL', evidence: `got ${show(got)} (chunks ${chunks.length}) expected ${show(expected)}` }
      }
      const front = await focusBat()
      let ks: CmdResult | undefined
      const { got, chunks } = await collect(async () => { ks = await applescript(scripts.keystroke, ['v', key], 30_000) })
      const verdict = tccVerdict(ks!)
      if (verdict !== 'ok') {
        if (verdict === 'blocked-accessibility' || verdict === 'blocked-automation' || verdict === 'timeout') {
          osKeys = 'blocked'
          osKeysEvidence = `${verdict}: ${describeCmd(ks!)}`
          return { label, result: '不可行', evidence: `${front}; keystroke ${osKeysEvidence}` }
        }
        return { label, result: 'ERROR', evidence: `${front}; keystroke ${verdict}: ${describeCmd(ks!)}` }
      }
      osKeys = 'ok'
      return { label, result: got === expected ? 'PASS' : 'FAIL', evidence: `${front}; keystroke ${describeCmd(ks!)}; got ${show(got)} (chunks ${chunks.length}) expected ${show(expected)}` }
    }

    const setFilesByScript = async (paths: string[]): Promise<string> => {
      const w = await jxa(scripts.writeFileUrls, paths)
      return `JXA NSPasteboard writeObjects(NSURL×${paths.length}): ${describeCmd(w)}`
    }

    let finderOk = false
    const setFilesByFinder = async (paths: string[]): Promise<{ ok: boolean; evidence: string }> => {
      const sel = await applescript(scripts.finderSelect, paths, 40_000)
      if (sel.code !== 0) return { ok: false, evidence: `Finder select: ${tccVerdict(sel)} ${describeCmd(sel)}` }
      const ks = await applescript(scripts.keystroke, ['c', 'command'], 30_000)
      if (ks.code !== 0) return { ok: false, evidence: `Finder select ok; System Events Command+C: ${tccVerdict(ks)} ${describeCmd(ks)}` }
      await new Promise(r => setTimeout(r, 800))
      const pb = await pasteboard()
      const ok = paths.every(p => pb.includes(p) || pb.includes(encodeURI(p)))
      return { ok, evidence: `Finder select + Command+C ok; pasteboard ${pb}` }
    }

    const quoted = (paths: string[]) => paths.map(posixQuote).join(' ')

    // ------------------------------------------------------------------ P2 clipboard by script
    {
      const ev: string[] = []
      let ok = true
      for (const [label, paths] of [['single', [fileA]], ['multi', [fileA, fileB]]] as const) {
        ev.push(`${label}: ${await setFilesByScript([...paths])}`)
        ev.push(`${label}: pasteboard ${await pasteboard()}`)
        const bv = await batView()
        ev.push(`${label}: BAT main/renderer view ${bv}`)
        if (!paths.every(p => bv.includes(p))) ok = false
      }
      report.add({ id: 'P2', title: '腳本（JXA NSPasteboard，NSURL 檔案 URL）寫剪貼簿：單檔、多檔', result: ok ? 'PASS' : 'FAIL', clipboard: 'script', evidence: ev })
    }

    // ------------------------------------------------------------------ P2b Finder copy
    {
      const ev: string[] = []
      let result: Result = 'FAIL'
      const name = await applescript(scripts.finderName, [fileA], 40_000)
      const v = tccVerdict(name)
      ev.push(`tell application "Finder" get name: ${v} ${describeCmd(name)}`)
      if (v === 'ok') {
        const r = await setFilesByFinder([fileA])
        ev.push(r.evidence)
        finderOk = r.ok
        result = r.ok ? 'PASS' : /blocked|timeout/.test(r.evidence) ? '不可行' : 'FAIL'
      } else {
        result = v === 'error' ? 'FAIL' : '不可行'
      }
      report.add({ id: 'P2b', title: 'AppleScript 叫 Finder 選取＋Command+C（真的 Finder 複製）', result, clipboard: 'Finder', evidence: ev })
    }

    // ------------------------------------------------------------------ scenarios
    /**
     * Puts `paths` on the clipboard (script or Finder) and checks, with an independent pasteboard
     * read, that the file name list holds exactly those paths before any key is pressed. A clipboard
     * that is not right is a setup problem, not a BAT result (run #1: a script write kept 1 of 2 items).
     */
    const prepareFiles = async (paths: string[], source: 'script' | 'Finder'): Promise<{ ok: boolean; evidence: string }> => {
      const notes: string[] = []
      for (let tryNo = 1; tryNo <= 2; tryNo++) {
        notes.push(source === 'script' ? await setFilesByScript(paths) : (await setFilesByFinder(paths)).evidence.slice(0, 200))
        const { view, raw } = await readPasteboard(scripts)
        const names = view?.filenames ?? []
        const ok = names.length === paths.length && paths.every(p => names.includes(p))
        notes.push(`check #${tryNo}: items=${view?.items.length ?? '?'} filenames=${JSON.stringify(names)}${view ? '' : ` (${describeCmd(raw)})`}`)
        if (ok) return { ok, evidence: notes.join('; ') }
      }
      return { ok: false, evidence: notes.join('; ') }
    }

    const fileScenario = async (id: string, title: string, key: 'command' | 'control', paths: string[], reps = 3) => {
      const expected = quoted(paths)
      const attempts: Attempt[] = []
      const ev: string[] = []
      for (const source of (finderOk ? ['script', 'Finder'] : ['script']) as Array<'script' | 'Finder'>) {
        for (const via of ['pw', 'os'] as const) {
          for (let i = 1; i <= reps; i++) {
            const setup = await prepareFiles(paths, source)
            if (i === 1 || !setup.ok) ev.push(`${source} / ${via} #${i} setup: ${setup.evidence}`)
            if (!setup.ok) {
              attempts.push({ label: `${key} via ${via} / ${source} #${i}`, result: 'ERROR', evidence: 'setup invalid: the clipboard did not hold exactly these files' })
              continue
            }
            attempts.push(await press(key, via, expected, `${source} #${i}`))
          }
        }
      }
      const shot = path.join(reportDir, `${slug(id)}.png`)
      await win.screenshot({ path: shot }).catch(() => { /* ignore */ })
      report.add({
        id, title, result: verdictOf(attempts.map(a => a.result)),
        keys: [...new Set(attempts.filter(a => a.result !== '不可行').map(a => (a.label.includes('Playwright') ? 'Playwright' : 'OS')))].join(' + '),
        clipboard: finderOk ? 'script + Finder' : 'script',
        evidence: [...ev, ...attempts.map(a => `${a.result} ${a.label}: ${a.evidence}`)],
      })
      return attempts
    }

    const textScenario = async (id: string, title: string, key: 'command' | 'control') => {
      const text = `T0778 text paste ${id}`
      const attempts: Attempt[] = []
      const ev: string[] = []
      for (const via of ['pw', 'os'] as const) {
        const cp = await runCmd('pbcopy', [], 10_000, text)
        ev.push(`pbcopy: ${describeCmd(cp)}; pasteboard ${await pasteboard()}`)
        attempts.push(await press(key, via, text, 'pbcopy text'))
      }
      report.add({
        id, title, result: verdictOf(attempts.map(a => a.result)),
        keys: [...new Set(attempts.filter(a => a.result !== '不可行').map(a => (a.label.includes('Playwright') ? 'Playwright' : 'OS')))].join(' + '),
        clipboard: 'script (pbcopy)',
        evidence: [...ev, ...attempts.map(a => `${a.result} ${a.label}: ${a.evidence}`)],
      })
      return attempts
    }

    const pngFile = path.join(tmp, 'image.png')
    fs.writeFileSync(pngFile, Buffer.from(await app.evaluate(({ nativeImage }) => {
      const w = 24
      const h = 16
      const bgra = Buffer.alloc(w * h * 4)
      for (let i = 0; i < w * h; i++) bgra.set([0x30, 0x60, 0xe0, 0xff], i * 4)
      return nativeImage.createFromBitmap(bgra, { width: w, height: h }).toPNG().toString('base64')
    }), 'base64'))
    const setImage = async (source: 'electron' | 'png'): Promise<string> => {
      if (source === 'electron') {
        await app.evaluate(({ clipboard, nativeImage }, file) => { clipboard.clear(); clipboard.writeImage(nativeImage.createFromPath(file)) }, pngFile)
        return `Electron clipboard.writeImage (BAT main): pasteboard ${await pasteboard()}`
      }
      const w = await jxa(scripts.writePng, [pngFile])
      return `JXA setData public.png (another process): ${describeCmd(w)}; pasteboard ${await pasteboard()}`
    }

    const imageScenario = async (id: string, title: string, key: 'command' | 'control') => {
      const attempts: Attempt[] = []
      const ev: string[] = []
      for (const [source, via] of [['electron', 'pw'], ['png', 'pw'], ['png', 'os']] as const) {
        ev.push(await setImage(source))
        ev.push(`BAT view ${await batView()}`)
        attempts.push(await press(key, via, '\x16', `image (${source})`))
      }
      await win.screenshot({ path: path.join(reportDir, `${slug(id)}.png`) }).catch(() => { /* ignore */ })
      report.add({
        id, title, result: verdictOf(attempts.map(a => a.result)),
        keys: [...new Set(attempts.filter(a => a.result !== '不可行').map(a => (a.label.includes('Playwright') ? 'Playwright' : 'OS')))].join(' + '),
        clipboard: 'script (Electron writeImage / JXA public.png)',
        evidence: [...ev, ...attempts.map(a => `${a.result} ${a.label}: ${a.evidence}`)],
      })
      return attempts
    }

    const guard = async <T>(id: string, title: string, fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn()
      } catch (err) {
        report.add({ id, title, result: 'ERROR', evidence: [`threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`.slice(0, 1500)] })
        return undefined
      }
    }

    const s1 = await guard('①', 'BUG-128 單檔 Command+V → 路徑', () => fileScenario('①', 'BUG-128 單檔 Command+V → 路徑', 'command', [fileA]))
    const s2 = await guard('②', 'BUG-128 多檔 Command+V → 以空白分隔的路徑', () => fileScenario('②', 'BUG-128 多檔 Command+V → 以空白分隔的路徑', 'command', [fileA, fileB]))
    await guard('③', 'BUG-128 路徑含空白 Command+V → 單引號包住', () => fileScenario('③', 'BUG-128 路徑含空白 Command+V → 單引號包住', 'command', [fileSpace]))
    const s4 = await guard('④', 'BUG-128 不回歸：純文字 Command+V 照常貼文字', () => textScenario('④', 'BUG-128 不回歸：純文字 Command+V 照常貼文字', 'command'))
    const s5 = await guard('⑤', 'BUG-130 有圖 Control+V → \\x16', () => imageScenario('⑤', 'BUG-130 有圖 Control+V → \\x16', 'control'))
    const s5b = await guard('⑤b', 'T0524 規格：有圖 Command+V → \\x16（與 Ctrl+V 同一路徑）', () => imageScenario('⑤b', 'T0524 規格：有圖 Command+V → \\x16（與 Ctrl+V 同一路徑）', 'command'))
    await guard('⑥', 'BUG-130 有檔案 Control+V → 貼路徑', () => fileScenario('⑥', 'BUG-130 有檔案 Control+V → 貼路徑', 'control', [fileA, fileSpace]))
    await guard('⑦', 'BUG-130 純文字 Control+V → 一般貼上', () => textScenario('⑦', 'BUG-130 純文字 Control+V → 一般貼上', 'control'))

    // ------------------------------------------------------------------ probe rows P3–P5 from the scenarios
    const pick = (atts: Attempt[] | undefined, pred: (a: Attempt) => boolean) => (atts ?? []).filter(pred)
    {
      const a = [...pick(s1, x => x.label.includes('Playwright') && x.label.includes('script')), ...pick(s2, x => x.label.includes('Playwright') && x.label.includes('script'))]
      report.add({ id: 'P3', title: 'Playwright 送 Meta+V（CDP 按鍵）→ PTY 收到完整路徑、不重複貼上', result: verdictOf(a.map(x => x.result)), keys: 'Playwright', clipboard: 'script', evidence: a.map(x => `${x.result} ${x.label}: ${x.evidence}`) })
    }
    {
      const a = [...pick(s1, x => x.label.includes('OS')), ...pick(s4, x => x.label.includes('OS')), ...pick(s5, x => x.label.includes('OS'))]
      report.add({ id: 'P4', title: 'osascript System Events keystroke（作業系統層按鍵）', result: (osKeys as string) === 'blocked' ? '不可行' : verdictOf(a.map(x => x.result)), keys: 'OS', evidence: [`OS keystroke state: ${osKeys}${osKeysEvidence ? ` (${osKeysEvidence})` : ''}`, ...a.map(x => `${x.result} ${x.label}: ${x.evidence}`)] })
    }
    {
      const a = [...(s5 ?? []), ...(s5b ?? [])]
      report.add({ id: 'P5', title: '剪貼簿放圖 → Control+V / Command+V → PTY 收到 \\x16', result: verdictOf(a.map(x => x.result)), keys: 'Playwright + OS', clipboard: 'script', evidence: a.map(x => `${x.result} ${x.label}: ${x.evidence}`) })
    }

    // ------------------------------------------------------------------ ⑧ embedded claude CLI + fake API (optional)
    await guard('⑧', '選做：內嵌 claude CLI＋假模型，Ctrl+V 出現圖片佔位', async () => {
      const ev: string[] = []
      const candidates = findEmbeddedClaude(E2E_EXECUTABLE)
      ev.push(`embedded claude candidates: ${JSON.stringify(candidates)}`)
      if (candidates.length === 0) {
        report.add({ id: '⑧', title: '選做：內嵌 claude CLI＋假模型，Ctrl+V 出現圖片佔位', result: 'PARTIAL', evidence: [...ev, 'no embedded claude found in app.asar.unpacked'] })
        return
      }
      const claude = candidates[0]
      const ver = await runCmd(claude, ['--version'], 30_000)
      ev.push(`claude --version: ${describeCmd(ver)}`)
      const home = path.join(tmp, 'claude-home')
      fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
      const projectEntry = { hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true, allowedTools: [] }
      fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({
        hasCompletedOnboarding: true, theme: 'dark', numStartups: 5, hasSeenAutoDefaultNudge: true,
        customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)], rejected: [] },
        projects: { [folder]: projectEntry },
      }))
      fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ permissions: { defaultMode: 'default' } }))
      const fake = await startFakeAnthropicApi({})
      const proxy = await startBlockingProxy()
      try {
        await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'QUIT0778'), TERM)
        await expect.poll(async () => (await ptyOut()).includes('T0778_ECHO_BYE'), { timeout: 10_000 }).toBe(true)
        await new Promise(r => setTimeout(r, 1000))
        const mark = (await ptyOut()).length
        const envArgs = [
          `HOME=${posixQuote(home)}`, `ANTHROPIC_BASE_URL=${fake.baseUrl}`, `ANTHROPIC_API_KEY=${FAKE_KEY}`,
          `HTTPS_PROXY=${proxy.url}`, `HTTP_PROXY=${proxy.url}`, 'NO_PROXY=127.0.0.1,localhost',
          'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1', 'DISABLE_AUTOUPDATER=1',
        ]
        await win.evaluate(([id, c]) => (window as AnyApi).electronAPI.pty.write(id, c), [TERM, `env -u CLAUDE_CONFIG_DIR ${envArgs.join(' ')} ${posixQuote(claude)}\r`])
        const since = async () => stripAnsi((await ptyOut()).slice(mark))
        const ready = await expect.poll(async () => /for shortcuts|\? for|Try "/i.test(await since()), { timeout: 90_000, intervals: [2_000] }).toBe(true).then(() => true, () => false)
        ev.push(`claude prompt ready=${ready}`)
        if (!ready) {
          ev.push(`output tail: ${show((await since()).slice(-800))}`)
          report.add({ id: '⑧', title: '選做：內嵌 claude CLI＋假模型，Ctrl+V 出現圖片佔位', result: 'PARTIAL', keys: 'Playwright', evidence: ev })
          return
        }
        ev.push(await setImage('png'))
        const info = await runCmd('osascript', ['-e', 'clipboard info'], 15_000)
        ev.push(`osascript clipboard info: ${describeCmd(info)}`)
        await xterm.click()
        // the CLI draws the space in "[Image #1]" with a cursor move, which stripAnsi drops (run #1)
        await win.keyboard.press('Control+v')
        const placeholder = await expect.poll(async () => /\[Image\s*#\d+\]/.test(await since()), { timeout: 25_000, intervals: [1_000] }).toBe(true).then(() => true, () => false)
        const text = await since()
        const m = /\[Image\s*#\d+\][^\n]{0,40}/.exec(text)
        ev.push(`image placeholder in the CLI input: ${placeholder}${m ? ` (${show(m[0])})` : ''}`)
        if (!placeholder) ev.push(`output tail: ${show(text.slice(-800))}`)
        await win.screenshot({ path: path.join(reportDir, 's8-claude.png') }).catch(() => { /* ignore */ })
        await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, '\x03'), TERM)
        await new Promise(r => setTimeout(r, 600))
        await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, '\x03'), TERM)
        await new Promise(r => setTimeout(r, 1500))
        ev.push(`fake API requests: ${fake.requests.length} ${JSON.stringify(fake.requests.map(q => `${q.method} ${q.url} model=${q.model} msgs=${q.messageCount}`))}`)
        ev.push(`blocking proxy attempts (outbound, must be 0 to the model API): ${proxy.attempts.length} ${JSON.stringify(proxy.attempts)}`)
        const outbound = proxy.attempts.filter(a => /anthropic\.com/i.test(a)).length
        const modelTurns = fake.requests.filter(q => q.messageCount > 0 && q.scenario !== null).length
        ev.push(`outbound to anthropic.com: ${outbound}; scripted model turns: ${modelTurns}`)
        report.add({ id: '⑧', title: '選做：內嵌 claude CLI＋假模型，Ctrl+V 出現圖片佔位', result: placeholder && outbound === 0 ? 'PASS' : placeholder ? 'PARTIAL' : 'FAIL', keys: 'Playwright', clipboard: 'script (JXA public.png)', evidence: ev })
      } finally {
        await fake.close()
        await proxy.close()
      }
    })

    // ------------------------------------------------------------------ debug log lines about paste
    try {
      const dir = path.join(inst.userData, 'Logs')
      const lines = fs.readdirSync(dir).filter(f => f.startsWith('debug-'))
        .flatMap(f => fs.readFileSync(path.join(dir, f), 'utf8').split('\n'))
        .filter(l => /terminal-paste|clipboard/i.test(l) && !/batcap\.|token/i.test(l))
      fs.writeFileSync(path.join(reportDir, 'debug-paste-lines.log'), lines.slice(-400).join('\n'))
    } catch (err) {
      log(`debug log excerpt failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  } finally {
    report.meta.finishedAt = new Date().toISOString()
    report.flush()
    if (inst) await inst.win.evaluate((id) => (window as AnyApi).electronAPI.pty.kill(id), TERM).catch(() => { /* gone */ })
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  // ⑧ is optional and does not fail the run
  const bad = report.rows.filter(r => r.id !== '⑧' && (r.result === 'FAIL' || r.result === 'ERROR')).map(r => `${r.id} ${r.result}`)
  expect(bad, 'rows that failed (see macos-report.md)').toEqual([])
})

