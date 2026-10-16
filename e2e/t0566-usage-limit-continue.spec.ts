// PLAN-044 / T0566 (D148): automatic continue after a usage limit resets.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Each agent is a
// custom CLI running a node script that (for a yolo tab) declares itself a yolo Tower with the
// in-tab helper (`bat-terminal.mjs --set-role tower --mode yolo`), prints a CLI limit message and
// records what reaches its stdin (raw mode) — nothing starts an LLM, no quota is spent. Settings:
// switch on, delay 0.
//
//   A. codex-style limit, reset = now (yolo)               → stdin gets 繼續, then Enter (\r)
//   B. claude limit + "continuing automatically" (yolo)    → nothing sent; badge cli-auto
//   C. claude "Your usage limit has reset / Press enter"   → stdin gets Enter only
//   D. codex-style limit in a non-yolo tab                 → nothing sent; badge not-yolo
//   E. codex-style limit, reset in 3 min (yolo)            → badge scheduled; typing cancels it

import { test, expect, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0566')
const WS = 'e2e-t0566-ws'

const agentSource = [
  "const fs = require('fs')",
  "const path = require('path')",
  "const { execFileSync } = require('child_process')",
  'const [mode, inputLog, role] = process.argv.slice(2)',
  "if (role === 'yolo') {",
  '  try {',
  "    execFileSync(process.execPath, [path.join(process.env.BAT_HELPER_DIR, 'bat-terminal.mjs'), '--set-role', 'tower', '--mode', 'yolo'], { stdio: 'ignore', timeout: 20000, windowsHide: true })",
  "  } catch (e) { fs.appendFileSync(inputLog + '.err', String(e) + '\\n') }",
  '}',
  'const at = (min) => new Date(Date.now() + min * 60000)',
  "const codexClock = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`",
  "const claudeClock = (d) => `${d.getHours() % 12 || 12}${d.getMinutes() ? ':' + String(d.getMinutes()).padStart(2, '0') : ''}${d.getHours() < 12 ? 'am' : 'pm'}`",
  "const codex = (min) => `\\r\\n\\u25a0 You've hit your usage limit. Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus), or try again at ${codexClock(at(min))}.\\r\\n\\r\\n\\u203a Ask Codex to do anything\\r\\n`",
  "const claudeLimit = `\\r\\n  \\u23bf  You've hit your session limit \\u00b7 resets ${claudeClock(at(60))}\\r\\n`",
  'const messages = {',
  '  codex: codex(0),',
  "  'codex-wait': codex(3),",
  "  'claude-auto': claudeLimit + `\\r\\nUsage limit reached \\u00b7 continuing automatically at ${claudeClock(at(60))} \\u00b7 esc to cancel\\r\\n`,",
  "  'claude-stale': claudeLimit + '\\r\\nYour usage limit has reset\\r\\nPress enter to continue\\r\\n',",
  '}',
  'if (process.stdin.isTTY) process.stdin.setRawMode(true)',
  "process.stdin.on('data', d => fs.appendFileSync(inputLog, JSON.stringify(d.toString('utf8')) + '\\n'))",
  'process.stdout.write(messages[mode])',
  '',
].join('\n')

interface Scenario { key: string; id: string; agent: string; name: string; mode: string; role: 'yolo' | 'plain' }

const SCENARIOS: Scenario[] = [
  { key: 'A', mode: 'codex', role: 'yolo' },
  { key: 'B', mode: 'claude-auto', role: 'yolo' },
  { key: 'C', mode: 'claude-stale', role: 'yolo' },
  { key: 'D', mode: 'codex', role: 'plain' },
  { key: 'E', mode: 'codex-wait', role: 'yolo' },
].map(s => ({ ...s, role: s.role as 'yolo' | 'plain', id: `e2e-t0566-${s.key}`, agent: `e2e-t0566-agent-${s.key}`, name: `UL-${s.key} ${s.mode}` }))

const readInput = (file: string): string[] =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as string) : []

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

const badgeOf = (view: Locator, page: Page, s: Scenario): Locator =>
  view.locator('.thumbnail', { has: page.locator('.thumbnail-title', { hasText: `UL-${s.key} ` }) }).locator('.usage-limit-badge')

test('usage limit: codex gets the text + Enter, claude stale only Enter, claude CLI auto / non-yolo nothing, typing cancels', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0566-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const script = path.join(tmp, 'agent.cjs').split(path.sep).join('/')
  fs.writeFileSync(script, agentSource)
  const inputLog = (s: Scenario) => path.join(tmp, `input-${s.key}.log`).split(path.sep).join('/')
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0566', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    // Settings: on, delay 0 (main re-reads it on settings:save)
    await win.evaluate(async () => {
      const api = (window as AnyApi).electronAPI
      const raw = await api.settings.load()
      const settings = raw ? JSON.parse(raw) : {}
      Object.assign(settings, { usageLimitAutoContinue: true, usageLimitContinueDelayMinutes: 0, usageLimitContinueText: '繼續' })
      await api.settings.save(JSON.stringify(settings))
    })
    for (const s of SCENARIOS) {
      expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
        id: s.agent, name: s.name, icon: s.key, color: '#888888', command: 'node', args: [script, s.mode, inputLog(s), s.role],
      })).toBeTruthy()
    }
    const seed = {
      workspaces: [{ id: WS, name: 'T0566', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: SCENARIOS.map(s => ({ id: s.id, workspaceId: WS, type: 'terminal', agentPreset: s.agent, title: s.name, cwd: folder })),
      activeTerminalId: SCENARIOS[0].id,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(SCENARIOS.length, { timeout: 30_000 })
    const [A, B, C, D, E] = SCENARIOS

    // ── A: codex, reset reached → 繼續 then Enter ──
    await expect.poll(() => readInput(inputLog(A)).join(''), { timeout: 60_000 }).toBe('繼續\r')
    expect(readInput(inputLog(A))).toEqual(['繼續', '\r'])
    // ── C: claude stale → Enter only ──
    await expect.poll(() => readInput(inputLog(C)).join(''), { timeout: 30_000 }).toBe('\r')
    // ── E: scheduled, shown on the thumbnail ──
    await expect(badgeOf(view, win, E)).toHaveAttribute('data-usage-limit', 'scheduled-text', { timeout: 30_000 })
    // ── B: the claude CLI continues by itself → hint only; D: not a yolo tab → hint only ──
    await expect(badgeOf(view, win, B)).toHaveAttribute('data-usage-limit', 'cli-auto', { timeout: 30_000 })
    await expect(badgeOf(view, win, D)).toHaveAttribute('data-usage-limit', 'not-yolo', { timeout: 30_000 })
    await win.screenshot({ path: test.info().outputPath('usage-limit-badges.png') })
    await win.waitForTimeout(3000)
    expect(readInput(inputLog(B))).toEqual([])
    expect(readInput(inputLog(D))).toEqual([])
    expect(readInput(inputLog(A))).toEqual(['繼續', '\r']) // sent once

    // ── E: typing in the tab while waiting cancels ──
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'x'), E.id)
    await expect(badgeOf(view, win, E)).toHaveCount(0, { timeout: 15_000 })
    await expect.poll(() => readDebugLogs(userData).includes(`[usage-limit] id=${E.id} → cancelled (user input while waiting`), { timeout: 15_000 }).toBe(true)
    expect(readInput(inputLog(E))).toEqual(['x'])

    const logs = readDebugLogs(userData)
    expect(logs).toContain(`[usage-limit] id=${A.id} → send requested: text "繼續" + Enter`)
    expect(logs).toMatch(new RegExp(`\\[usage-limit\\] id=${A.id} → sent text "繼續" \\+ Enter trace=\\S+ path=dom-keydown`))
    expect(logs).toMatch(new RegExp(`\\[usage-limit\\] id=${C.id} → sent Enter trace=\\S+ path=dom-keydown`))
    for (const s of SCENARIOS) {
      const err = `${inputLog(s)}.err`
      expect(fs.existsSync(err) ? fs.readFileSync(err, 'utf8') : '', `set-role in ${s.key}`).toBe('')
    }
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
