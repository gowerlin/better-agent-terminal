// @vitest-environment node
/**
 * PLAN-044 / T0566 (D148): the usage-limit auto continue on headless bat-server — the same
 * scheduler (electron/usage-limit-continue.ts) on the server's PtyManager, wire-level through the
 * T0388 harness with real node-pty. A node script in the PTY prints a codex limit sentence; no
 * agent runs, nothing spends a quota.
 *   - settings from `<dataDir>/settings.json` (on, delay 0): a yolo PTY (`CT_MODE=yolo`) → the
 *     client gets `terminal:usage-limit-status` (scheduled) and `terminal:usage-limit-continue`
 *     with the Settings text; a non-yolo PTY → hint `not-yolo` only
 *   - user input = a client's `pty:write`: `{ auto: true }` does not cancel, a plain write does
 *   - no client connected when due → not sent, logged
 *   - settings off (no settings.json) → no usage-limit event at all
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { logger } from '../../logger'
import { startHeadlessHarness, makeHeadlessDataDir, removeHeadlessDataDir, type HeadlessHarness } from './helpers/headless-harness'
import type { UsageLimitContinueEvent, UsageLimitStatusEvent } from '../../../src/lib/usage-limit'

const IS_WIN = process.platform === 'win32'
const SHELL = IS_WIN
  ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe')
  : (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh')
const NL = IS_WIN ? '\r\n' : '\n'
const CWD = os.tmpdir()

let seq = 0
const termId = (label: string) => `t0566-${label}-${process.pid}-${seq++}`

function clockIn(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000)
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

/** A script printing a codex-style limit message whose reset is `minutes` from now. */
function limitScript(dir: string, minutes: number): string {
  const file = path.join(dir, `limit-${seq++}.js`)
  fs.writeFileSync(file, `process.stdout.write("\\n\\u25a0 You've hit your usage limit. Visit https://chatgpt.com/settings/usage to purchase more credits or try again at ${clockIn(minutes)}.\\n")\n`)
  return file
}

const runLine = (script: string) => `"${process.execPath}" "${script}"${NL}`

function statusEvents(h: { events: Array<{ channel: string; args: unknown[] }> }, id: string): Array<UsageLimitStatusEvent['status']> {
  return h.events.filter(e => e.channel === 'terminal:usage-limit-status' && (e.args[0] as UsageLimitStatusEvent).id === id)
    .map(e => (e.args[0] as UsageLimitStatusEvent).status)
}

describe('headless usage-limit auto continue (T0566)', () => {
  let dataDir: string
  let h: HeadlessHarness
  let logs: string[]

  beforeAll(async () => {
    dataDir = makeHeadlessDataDir('t0566')
    fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ usageLimitAutoContinue: true, usageLimitContinueDelayMinutes: 0, usageLimitContinueText: '繼續' }))
    logs = []
    vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')) })
    h = await startHeadlessHarness({ dataDir })
  })

  afterAll(async () => {
    await h?.dispose()
    removeHeadlessDataDir(dataDir)
    vi.restoreAllMocks()
  })

  it('a yolo PTY → scheduled, then terminal:usage-limit-continue with the Settings text; non-yolo → hint only', async () => {
    const yolo = termId('yolo')
    const plain = termId('plain')
    expect(await h.invoke('pty:create', { id: yolo, cwd: CWD, type: 'terminal', shell: SHELL, customEnv: { CT_MODE: 'yolo' } })).toMatchObject({ ok: true })
    expect(await h.invoke('pty:create', { id: plain, cwd: CWD, type: 'terminal', shell: SHELL })).toMatchObject({ ok: true })
    expect(await h.invoke('pty:write', yolo, runLine(limitScript(dataDir, 0)))).toEqual({ ok: true })
    expect(await h.invoke('pty:write', plain, runLine(limitScript(dataDir, 0)))).toEqual({ ok: true })

    const [continued] = await h.waitForEvent('terminal:usage-limit-continue', args => (args[0] as UsageLimitContinueEvent).id === yolo, 30_000)
    expect(continued).toMatchObject({ id: yolo, action: 'text', text: '繼續', agent: 'codex' })
    expect(statusEvents(h, yolo)[0]).toMatchObject({ state: 'scheduled', agent: 'codex', action: 'text' })
    await vi.waitFor(() => expect(statusEvents(h, plain).at(-1)).toMatchObject({ state: 'hint', hint: 'not-yolo' }), { timeout: 15_000, interval: 100 })
    expect(h.events.some(e => e.channel === 'terminal:usage-limit-continue' && (e.args[0] as UsageLimitContinueEvent).id === plain)).toBe(false)
    await h.invoke('pty:kill', yolo)
    await h.invoke('pty:kill', plain)
  }, 60_000)

  it('a client write cancels the wait; an { auto: true } write does not', async () => {
    const id = termId('cancel')
    expect(await h.invoke('pty:create', { id, cwd: CWD, type: 'terminal', shell: SHELL, customEnv: { CT_MODE: 'yolo' } })).toMatchObject({ ok: true })
    expect(await h.invoke('pty:write', id, runLine(limitScript(dataDir, 30)))).toEqual({ ok: true })
    await vi.waitFor(() => expect(statusEvents(h, id).at(-1)).toMatchObject({ state: 'scheduled' }), { timeout: 20_000, interval: 100 })

    expect(await h.invoke('pty:write', id, ' ', { auto: true })).toEqual({ ok: true })
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(statusEvents(h, id).at(-1)).toMatchObject({ state: 'scheduled' })

    expect(await h.invoke('pty:write', id, 'x')).toEqual({ ok: true })
    await vi.waitFor(() => expect(statusEvents(h, id).at(-1)).toBeNull(), { timeout: 5_000, interval: 50 })
    expect(logs.some(l => l.includes(`[usage-limit] id=${id} → cancelled (user input while waiting`))).toBe(true)
    await h.invoke('pty:kill', id)
  }, 60_000)

  it('no client connected when due → not sent, logged', async () => {
    // a server of its own: its only client disconnects within the quiet time
    const lonelyDir = makeHeadlessDataDir('t0566-lonely')
    fs.writeFileSync(path.join(lonelyDir, 'settings.json'), JSON.stringify({ usageLimitAutoContinue: true, usageLimitContinueDelayMinutes: 0 }))
    const lonely = await startHeadlessHarness({ dataDir: lonelyDir })
    try {
      const lid = termId('lonely')
      expect(await lonely.invoke('pty:create', { id: lid, cwd: CWD, type: 'terminal', shell: SHELL, customEnv: { CT_MODE: 'yolo' } })).toMatchObject({ ok: true })
      const before = lonely.events.length
      expect(await lonely.invoke('pty:write', lid, runLine(limitScript(lonelyDir, 0)))).toEqual({ ok: true })
      await vi.waitFor(() => {
        const out = lonely.events.slice(before).filter(e => e.channel === 'pty:output' && e.args[0] === lid).map(e => String(e.args[1])).join('')
        expect(out).toContain('hit your usage limit')
      }, { timeout: 15_000, interval: 50 })
      await lonely.close() // within the 5 s quiet time: nobody is connected when it is due
      await vi.waitFor(() => expect(logs.some(l => l.includes(`[usage-limit] id=${lid} → not sent (no client connected)`))).toBe(true), { timeout: 20_000, interval: 100 })
      await lonely.server.stop()
    } finally {
      await lonely.dispose().catch(() => {})
      removeHeadlessDataDir(lonelyDir)
    }
  }, 60_000)
})

describe('headless usage-limit off by default', () => {
  it('no settings.json → no usage-limit event', async () => {
    const h = await startHeadlessHarness()
    try {
      const id = termId('off')
      expect(await h.invoke('pty:create', { id, cwd: CWD, type: 'terminal', shell: SHELL, customEnv: { CT_MODE: 'yolo' } })).toMatchObject({ ok: true })
      expect(await h.invoke('pty:write', id, runLine(limitScript(h.dataDir, 0)))).toEqual({ ok: true })
      await vi.waitFor(() => {
        const out = h.events.filter(e => e.channel === 'pty:output' && e.args[0] === id).map(e => String(e.args[1])).join('')
        expect(out).toContain('hit your usage limit')
      }, { timeout: 15_000, interval: 50 })
      await new Promise(resolve => setTimeout(resolve, 7000))
      expect(h.events.filter(e => e.channel.startsWith('terminal:usage-limit'))).toEqual([])
    } finally {
      await h.dispose()
    }
  }, 60_000)
})
