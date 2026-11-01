// T0742 / BUG-107: a file dropped on a terminal tab types its real local path into the PTY. Electron
// 32+ removed the DOM `File.path` augmentation; T0435 exposed `webUtils.getPathForFile` as preload
// `shell.getPathForFile`, and the terminal drop (T0439, `droppedFilePaths` in src/lib/terminal-drop.ts)
// reads the path through it. Before T0435 the drop handlers read `file.path` (undefined in Electron 41)
// and preload had no `getPathForFile` (`git show c6c4e9e4^:electron/preload.ts`).
//
// One scenario: a real file (`setInputFiles`) is dropped on the active shell tab with a synthetic
// DragEvent carrying that File → the PTY's buffer shows the file's absolute path. The same File is
// checked for `File.path` — what the pre-T0435 code read — and it is undefined.
// A real Explorer drag is not something Playwright can do; that stays manual.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Plain shell
// terminal only — nothing here starts an LLM.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0742-drop')
const WS = 'e2e-t0742-drop-ws'
const TAB = 'e2e-t0742-drop-tab'

const bufferOf = (win: Page, id: string): Promise<string> =>
  win.evaluate(async (i) => (await (window as AnyApi).electronAPI.pty.getBuffer(i))?.data ?? '', id)

/** Rows joined (ConPTY wraps) and ANSI removed, for matching echoed input. */
const plain = (s: string) => s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '').replace(/\r?\n/g, '')

test('a file dropped on a terminal tab types its real path into the PTY', async () => {
  test.setTimeout(150_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0742-drop-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const dropped = path.join(tmp, 't0742-dropped.txt')
  fs.writeFileSync(dropped, 'T0742 BUG-107 drop\n')
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0742-drop', log)
    const { win } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0742 drop', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', title: 'T0742 drop', cwd: folder }],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const recovery = win.locator('.recovery-prompt-dialog')
    if (await recovery.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)) {
      await recovery.locator('.recovery-prompt-actions .btn-primary').click()
      log('answered the Recovery prompt after the reload (keep)')
    }
    const target = '.workspace-container.active .terminal-wrapper.active .terminal-panel'
    await expect(win.locator(target)).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => (await win.evaluate(([i]) => (window as AnyApi).electronAPI.pty.write(i, ''), [TAB] as const))?.ok ?? null, { timeout: 20_000 }).toBe(true)
    // Let the shell print its prompt, so the typed path is echoed after it.
    await expect.poll(async () => plain(await bufferOf(win, TAB)).length, { timeout: 20_000 }).toBeGreaterThan(0)
    await win.waitForTimeout(1_500)
    expect(plain(await bufferOf(win, TAB))).not.toContain(dropped)

    await win.evaluate(() => {
      const input = document.createElement('input')
      input.type = 'file'
      input.id = 't0742-drop-input'
      input.style.display = 'none'
      document.body.appendChild(input)
    })
    await win.setInputFiles('#t0742-drop-input', dropped)
    const seen = await win.evaluate((selector) => {
      const input = document.getElementById('t0742-drop-input') as HTMLInputElement
      const el = document.querySelector(selector)
      const file = input.files?.[0]
      if (!el || !file) throw new Error(`drop target ${selector} or file missing`)
      const result = {
        // what the pre-T0435 handlers read
        filePath: String((file as AnyApi).path),
        // what T0435 reads (preload webUtils.getPathForFile)
        getPathForFile: (window as AnyApi).electronAPI.shell.getPathForFile(file) as string,
      }
      const dt = new DataTransfer()
      dt.items.add(file)
      for (const type of ['dragenter', 'dragover', 'drop']) {
        el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }))
      }
      input.remove()
      return result
    }, target)
    log(`dropped File: File.path=${seen.filePath}; shell.getPathForFile=${seen.getPathForFile}`)
    expect(seen.filePath, 'Electron 41 has no File.path (what the pre-T0435 code read)').toBe('undefined')
    expect(seen.getPathForFile.toLowerCase()).toBe(dropped.toLowerCase())

    await expect.poll(async () => plain(await bufferOf(win, TAB)).toLowerCase(), { timeout: 15_000 }).toContain(dropped.toLowerCase())
    const line = plain(await bufferOf(win, TAB))
    const at = line.toLowerCase().lastIndexOf(dropped.toLowerCase())
    log(`PTY echo around the path: ${JSON.stringify(line.slice(Math.max(0, at - 20), at + dropped.length + 5))}`)
    await win.screenshot({ path: test.info().outputPath('terminal-after-drop.png') })
    // Leave nothing half-typed for the teardown: clear the input line.
    await win.evaluate(([i]) => (window as AnyApi).electronAPI.pty.write(i, '\x03'), [TAB] as const)
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
