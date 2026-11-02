// T0789 (PLAN-061 前置研究): what the embedded claude CLI sends once a terminal answers its `OSC 7501 ; ?`
// probe (the Program Status Protocol), when, and with which side effects.
//
// PROBE ONLY (`T0789_PROBE=1`; `T0789_CASES=a,b,…` picks cases, default all): records, asserts only that no
// request left the machine. No BAT, no Electron, no build output: node-pty spawns the embedded claude directly
// and a real `@xterm/xterm` 5.5 instance (the version BAT ships) plays the terminal: PTY output → `term.write`,
// `term.onData` → PTY (so xterm answers DA1 / DSR / DECRQM exactly as in BAT). The probe reply is sent the way
// BAT would have to: an xterm OSC 7501 handler calling `term.input(reply, false)`.
//
// The model is `e2e/fixtures/fake-anthropic-api.ts` behind a small front server (a prompt containing
// `T0789-ERR` gets an HTTP 400), with a blocking proxy for everything else: real model cost 0. HOME /
// USERPROFILE / CLAUDE_CONFIG_DIR point at a temp dir; every hook event claude fires is timestamped by a tiny
// hook script (same clock as the PTY output), so OSC 7501 sequences can be lined up with the hooks BAT uses.
//
// Output: one JSON per case plus `summary.json` under `T0789_OUT` (default `<tmp>/ct-T0789`).
// Pass `--output <tmp dir>`: the repo's `e2e-results/` is shared with other runs and playwright empties it.
//
// Windows (T0789 finding): the system ConPTY drops OSC replies written to the PTY input and answers the
// CLI's DA1 query itself, so claude settles "no reply" and never sends a status there — the probe only shows
// the output side. The reply path works on a Linux PTY: run the same spec in WSL / Linux with the
// `@anthropic-ai/claude-code-linux-x64` binary of the same version (`T0789_CLAUDE=<path>/claude`), next to
// `@lydell/node-pty`, `@xterm/xterm@5.5.0` and `@playwright/test` installed there (copy that package's
// `package.json` to `node_modules/@anthropic-ai/claude-code/`: the logged version is read from there).

import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import type net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import * as ptyLib from '@lydell/node-pty'
import { Terminal } from '@xterm/xterm'
import { startBlockingProxy, startFakeAnthropicApi, type Scenario, type ScenarioContext } from './fixtures/fake-anthropic-api'

const REPO_ROOT = path.resolve(__dirname, '..')
// `T0789_CLAUDE` overrides (Linux / WSL run: the same CLI version from the `claude-code-linux-x64` package)
const EMBEDDED_CLAUDE = process.env.T0789_CLAUDE || path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const FAKE_KEY = 'sk-t0789-fake-key-not-checked-0000000000'
const OUT = process.env.T0789_OUT || path.join(os.tmpdir(), 'ct-T0789')
const DROP_ENV = /^(ANTHROPIC_|CLAUDE|BAT_|CT_|OPENAI_|CODEX_|TERM_PROGRAM|WT_SESSION|WT_PROFILE_ID|TMUX|STY)/i
const ESC = '\x1b'
const BEL = '\x07'
const ST = `${ESC}\\`
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const slash = (p: string) => p.replace(/\\/g, '/')
const log = (m: string) => { console.log(`[t0789] ${m}`); test.info().annotations.push({ type: 'evidence', description: m }) }

// ── fake model scenarios (`[[T0727:<name>]]` tags) ──
const ask = (q: string) => ({ tool: { name: 'AskUserQuestion', input: { questions: [{
  question: q, header: 'T0789', multiSelect: false,
  options: [{ label: 'Alpha', description: 'the first option' }, { label: 'Beta', description: 'the second option' }],
}] } } })
/** Tools offered in the newest request (the todo step picks TodoWrite or TaskCreate from it). */
let offeredTools: () => string[] = () => []
/** Scenario kinds; the tag is `t0789-<kind>-<case letter>` so a gate / release never leaks into the next case. */
const KINDS: Record<string, (c: ScenarioContext, suffix: string) => ReturnType<Scenario>> = {
  text: (c) => c.step === 0 ? { text: ['T0789 ', 'plain ', 'reply ', 'one ', 'two ', 'three'], deltaDelayMs: 250 } : null,
  perm: (c) => c.step === 0
    ? { tool: { name: 'Bash', input: { command: 'curl -s --max-time 3 http://127.0.0.1:9/t0789', description: 'T0789 permission probe (closed local port)' } } }
    : c.step === 1 ? { text: ['perm ', 'done'] } : null,
  ask: (c) => c.step === 0 ? ask('T0789 which option?') : c.step === 1 ? { text: ['ask ', 'done'] } : null,
  // held by a gate until the case presses Esc
  long: (c) => c.step === 0 ? { text: ['never'] } : null,
  // a task list with 1 of 2 done, then a slow reply (claude's `progress` = share of completed list items)
  todo: (c) => {
    const tools = offeredTools()
    if (c.step === 0 && tools.includes('TodoWrite')) {
      return { tool: { name: 'TodoWrite', input: { todos: [
        { content: 'T0789 first item', status: 'completed', activeForm: 'Doing the first item' },
        { content: 'T0789 second item', status: 'in_progress', activeForm: 'Doing the second item' },
      ] } } }
    }
    if (c.step === 0 && tools.includes('TaskCreate')) return { tool: { name: 'TaskCreate', input: { subject: 'T0789 first item', description: 'probe item one' } } }
    if (c.step === 1 && !tools.includes('TodoWrite') && tools.includes('TaskCreate')) return { tool: { name: 'TaskCreate', input: { subject: 'T0789 second item', description: 'probe item two' } } }
    if (c.step === 2 && !tools.includes('TodoWrite') && tools.includes('TaskUpdate')) return { tool: { name: 'TaskUpdate', input: { taskId: '1', status: 'completed' } } }
    if (c.step <= 3) return { text: ['todo ', 'step ', 'slow ', 'reply ', 'one ', 'two ', 'three ', 'four'], deltaDelayMs: 400 }
    return null
  },
  bg: (c, suffix) => c.step === 0
    ? { tool: { name: 'Agent', input: { description: 'T0789 background helper task', subagent_type: 'general-purpose', run_in_background: true,
      prompt: `[[T0727:t0789-bgwork-${suffix}]] background work for the T0789 probe` } } }
    : c.step === 1 ? { text: ['bg ', 'launched'] } : null,
  // the background agent's own conversation: held by a gate so it stays running
  bgwork: (c) => c.step === 0 ? { text: ['bg ', 'work ', 'finished'] } : null,
}
const SCENARIOS = new Proxy({} as Record<string, Scenario>, {
  get: (_t, name) => {
    if (typeof name !== 'string') return undefined
    const m = /^t0789-([a-z]+)-([a-z0-9]+)$/.exec(name)
    const kind = m ? KINDS[m[1]] : undefined
    return kind ? (c: ScenarioContext) => kind(c, m![2]) : undefined
  },
})

// ── hook recorder: `<ms> <event> <tool_name|notification_type>` per line; silent, exit 0 ──
const HOOK_SCRIPT = (logFile: string) => `
const fs = require('fs')
const t = Date.now()
let raw = ''
process.stdin.on('data', d => { raw += d })
const done = () => {
  let extra = ''
  try { const j = JSON.parse(raw); extra = j.tool_name || j.notification_type || j.source || '' } catch {}
  try { fs.appendFileSync(${JSON.stringify(logFile)}, t + ' ' + process.argv[2] + ' ' + extra + '\\n') } catch {}
  process.exit(0)
}
process.stdin.on('end', done)
setTimeout(done, 1500)
`
const HOOK_EVENTS: Array<[string, string?]> = [
  ['SessionStart'], ['UserPromptSubmit'], ['PreToolUse'], ['PermissionRequest'], ['PostToolUse'], ['PostToolBatch'],
  ['Notification'], ['Stop'], ['SubagentStart'], ['SubagentStop'], ['StopFailure'], ['SessionEnd'],
]

type ReplyMode = 'none' | 'bel' | 'st' | 'wrong' | 'late'
interface CaseDef { name: string; reply: ReplyMode; env?: Record<string, string>; disableAllHooks?: boolean; steps: string[] }
const CASES: CaseDef[] = [
  // `err` last but one: claude merges the failed prompt into the next user message, so every later turn would fail too
  { name: 'a-reply-bel-full', reply: 'bel', steps: ['text', 'perm', 'ask', 'todo', 'long', 'bg', 'unsolicited', 'err', 'exit'] },
  { name: 'b-no-reply-full', reply: 'none', steps: ['text', 'perm', 'ask', 'todo', 'long', 'bg', 'unsolicited', 'err', 'exit'] },
  { name: 'c-reply-st', reply: 'st', steps: ['text', 'exit'] },
  { name: 'd-reply-wrong', reply: 'wrong', steps: ['text', 'exit'] },
  { name: 'e-reply-late', reply: 'late', steps: ['text', 'exit'] },
  { name: 'f-reply-disable-title', reply: 'bel', env: { CLAUDE_CODE_DISABLE_TERMINAL_TITLE: '1' }, steps: ['text', 'perm', 'exit'] },
  { name: 'g-reply-disable-hooks', reply: 'bel', disableAllHooks: true, steps: ['text', 'perm', 'ask', 'exit'] },
]

interface Seq { t: number; kind: 'osc' | 'dcs' | 'apc'; code: string; len: number; data: string }
interface Status { t: number; raw: string; len: number; fields: Record<string, string>; title?: { len: number; head: string }; msg?: { len: number; head: string } }

function parseStatus(t: number, data: string): Status {
  const fields: Record<string, string> = {}
  for (const part of data.split(':')) { const i = part.indexOf('='); if (i > 0) fields[part.slice(0, i)] = part.slice(i + 1) }
  const dec = (b64?: string) => {
    if (b64 === undefined) return undefined
    const s = Buffer.from(b64, 'base64').toString('utf8')
    return { len: [...s].length, head: [...s].slice(0, 20).join('') }
  }
  const short = { ...fields }
  if (short.title) short.title = `<b64 ${short.title.length}>`
  if (short.msg) short.msg = `<b64 ${short.msg.length}>`
  return { t, raw: Object.entries(short).map(([k, v]) => `${k}=${v}`).join(':'), len: data.length, fields: short, title: dec(fields.title), msg: dec(fields.msg) }
}

/** Every OSC / DCS / APC in the raw PTY stream, timestamped by the chunk that completed it. */
function extractSequences(raw: string, chunkEnds: Array<{ end: number; t: number }>): Seq[] {
  const out: Seq[] = []
  const timeAt = (offset: number) => (chunkEnds.find(c => c.end >= offset) ?? chunkEnds.at(-1))?.t ?? 0
  const re = /\x1b([\]P_])([\s\S]*?)(?:\x07|\x1b\\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    const kind = m[1] === ']' ? 'osc' : m[1] === 'P' ? 'dcs' : 'apc'
    const body = m[2]
    const code = kind === 'osc' ? (/^(\d+)/.exec(body)?.[1] ?? '?') : body.slice(0, 2)
    out.push({ t: timeAt(m.index + m[0].length), kind, code, len: body.length, data: kind === 'osc' ? body.slice(code.length + 1) : body })
  }
  return out
}

function killTree(pid: number): Promise<void> {
  return new Promise(r => execFile('taskkill', ['/F', '/T', '/PID', String(pid)], { timeout: 10_000 }, () => r()))
}

test('PROBE: claude OSC 7501 probe reply (no token)', async () => {
  test.skip(!process.env.T0789_PROBE, 'set T0789_PROBE=1 to run the T0789 probe')
  test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `no claude binary at ${EMBEDDED_CLAUDE} (set T0789_CLAUDE)`)
  test.setTimeout(1_800_000)
  fs.mkdirSync(OUT, { recursive: true })
  const pick = (process.env.T0789_CASES ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const cases = pick.length ? CASES.filter(c => pick.some(p => c.name.startsWith(p))) : CASES
  const claudeVersion = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'package.json'), 'utf8')).version
  const xtermVersion = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'node_modules', '@xterm', 'xterm', 'package.json'), 'utf8')).version

  const fake = await startFakeAnthropicApi(SCENARIOS, { deltaDelayMs: 60 })
  const proxy = await startBlockingProxy()
  // front: `T0789-ERR` → 400 (not retried); everything else → the fake API
  const front = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', d => chunks.push(d as Buffer))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      // only the newest user message counts: the failed prompt stays in the history of later turns
      let lastUser = ''
      try {
        const msgs = (JSON.parse(body.toString('utf8')).messages ?? []) as Array<{ role?: string; content?: unknown }>
        const last = msgs.filter(m => m.role === 'user').at(-1)
        lastUser = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '')
      } catch { /* not JSON */ }
      if ((req.url ?? '').startsWith('/v1/messages') && !(req.url ?? '').includes('count_tokens') && lastUser.includes('T0789-ERR')) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'T0789 synthetic invalid request' } }))
        return
      }
      const up = http.request({ host: '127.0.0.1', port: fake.port, method: req.method, path: req.url, headers: { ...req.headers, host: `127.0.0.1:${fake.port}` } }, ur => {
        res.writeHead(ur.statusCode ?? 502, ur.headers)
        ur.pipe(res)
      })
      up.on('error', () => { try { res.writeHead(502); res.end() } catch { /* gone */ } })
      up.end(body)
    })
  })
  await new Promise<void>(r => front.listen(0, '127.0.0.1', () => r()))
  const frontUrl = `http://127.0.0.1:${(front.address() as net.AddressInfo).port}`
  log(`embedded claude ${claudeVersion}; xterm ${xtermVersion}; front ${frontUrl}; proxy ${proxy.url}; cases ${cases.map(c => c.name).join(',')}`)
  offeredTools = () => fake.requests.filter(r => r.tools.length > 0).at(-1)?.tools ?? []

  const summary: Array<Record<string, unknown>> = []
  const tmpDirs: string[] = []
  try {
    for (const def of cases) {
      const sc = (kind: string) => `t0789-${kind}-${def.name.split('-')[0]}`
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0789-'))
      // Windows: under %ProgramData% (as T0727 / T0787): claude loads every ancestor's CLAUDE.md
      const root = fs.mkdtempSync(path.join(process.platform === 'win32' ? (process.env.ProgramData || 'C:\\ProgramData') : os.tmpdir(), 'bat-e2e-t0789-'))
      tmpDirs.push(tmp, root)
      const home = path.join(tmp, 'home')
      const configDir = path.join(home, '.claude')
      const folder = path.join(root, 'w')
      for (const d of [path.join(home, 'AppData', 'Roaming'), path.join(home, 'AppData', 'Local'), configDir, folder]) fs.mkdirSync(d, { recursive: true })
      const hookLog = path.join(tmp, 'hooks.log')
      const hookScript = path.join(tmp, 'hook.cjs')
      fs.writeFileSync(hookScript, HOOK_SCRIPT(hookLog))
      const projectEntry = { hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true, allowedTools: [] }
      const claudeJson = JSON.stringify({
        hasCompletedOnboarding: true, theme: 'dark', numStartups: 5, hasSeenAutoDefaultNudge: true, lastReleaseNotesSeen: claudeVersion,
        customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)], rejected: [] },
        projects: { [folder]: projectEntry, [slash(folder)]: projectEntry },
      })
      fs.writeFileSync(path.join(home, '.claude.json'), claudeJson)
      fs.writeFileSync(path.join(configDir, '.claude.json'), claudeJson)
      const hooks: Record<string, unknown[]> = {}
      for (const [ev] of HOOK_EVENTS) hooks[ev] = [{ hooks: [{ type: 'command', command: `node '${slash(hookScript)}' ${ev}`, timeout: 5 }] }]
      fs.writeFileSync(path.join(configDir, 'settings.json'), JSON.stringify({
        permissions: { defaultMode: 'default' }, hooks, ...(def.disableAllHooks ? { disableAllHooks: true } : {}),
      }, null, 2))

      const env: Record<string, string> = {}
      for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !DROP_ENV.test(k)) env[k] = v
      Object.assign(env, {
        TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'better-agent-terminal', TERM_PROGRAM_VERSION: '1.0',
        ANTHROPIC_BASE_URL: frontUrl, ANTHROPIC_API_KEY: FAKE_KEY,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
        USERPROFILE: home, HOME: home, CLAUDE_CONFIG_DIR: configDir, APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
        HTTPS_PROXY: proxy.url, HTTP_PROXY: proxy.url, NO_PROXY: '127.0.0.1,localhost',
        ...(def.env ?? {}),
      })

      // ── the terminal: real xterm 5.5, OSC 7501 handler answers the probe ──
      const term = new Terminal({ cols: 120, rows: 30, allowProposedApi: true, scrollback: 2000 })
      const p = ptyLib.spawn(EMBEDDED_CLAUDE, [], { name: 'xterm-256color', cols: 120, rows: 30, cwd: folder, env })
      const t0 = Date.now()
      let raw = ''
      const chunkEnds: Array<{ end: number; t: number }> = []
      const replies: Array<{ t: number; reply: string; probeData: string }> = []
      const inputs: Array<{ t: number; data: string }> = []
      const marks: Array<{ t: number; label: string }> = []
      const mark = (label: string) => { marks.push({ t: Date.now(), label }) }
      let exited: { t: number; code: number } | null = null
      const titles: Array<{ t: number; title: string }> = []
      term.onTitleChange(title => titles.push({ t: Date.now(), title }))
      term.onData(d => { inputs.push({ t: Date.now(), data: d.length > 40 ? `${d.slice(0, 40)}…` : d }); try { p.write(d) } catch { /* exited */ } })
      term.parser.registerOscHandler(7501, data => {
        if (!data.startsWith('?') || def.reply === 'none') return false
        const reply = def.reply === 'st' ? `${ESC}]7501;?${ST}` : def.reply === 'wrong' ? `${ESC}]7501;ok${BEL}` : `${ESC}]7501;?${BEL}`
        const send = () => { replies.push({ t: Date.now(), reply: JSON.stringify(reply), probeData: data }); term.input(reply, false) }
        if (def.reply === 'late') setTimeout(send, 2000)
        else send()
        return true
      })
      p.onData(d => { raw += d; chunkEnds.push({ end: raw.length, t: Date.now() }); term.write(d) })
      p.onExit(e => { exited = { t: Date.now(), code: e.exitCode } })

      const screen = () => {
        const b = term.buffer.active
        const lines: string[] = []
        for (let y = 0; y < term.rows; y++) lines.push(b.getLine(b.viewportY + y)?.translateToString(true) ?? '')
        return lines.join('\n')
      }
      const waitFor = async (what: string, fn: () => boolean, ms = 30_000) => {
        const end = Date.now() + ms
        while (Date.now() < end) { if (fn()) return true; await sleep(100) }
        log(`${def.name}: timeout waiting for ${what}; screen:\n${screen()}`)
        return false
      }
      const quiet = async (ms = 1200, max = 15_000) => {
        const end = Date.now() + max
        while (Date.now() < end) { if (Date.now() - (chunkEnds.at(-1)?.t ?? 0) >= ms) return; await sleep(100) }
      }
      const type = async (text: string) => { p.write(text); await sleep(500); p.write('\r') }
      const promptReady = () => /for shortcuts|\? for|❯|^>/m.test(screen())

      try {
        mark('spawn')
        await waitFor('prompt', promptReady, 45_000)
        await quiet(1500)
        mark('ready')
        for (const step of def.steps) {
          mark(`${step}:begin`)
          if (step === 'text') {
            await type(`[[T0727:${sc('text')}]] say something`)
            await fake.waitFor(sc('text'), 0, 30_000).catch(() => null)
            await quiet(2500, 30_000)
          } else if (step === 'perm') {
            await type(`[[T0727:${sc('perm')}]] run the probe command`)
            await waitFor('permission dialog', () => /Do you want to proceed|Yes, and/i.test(screen()))
            await sleep(1500); mark('perm:dialog-shown')
            p.write('\r'); mark('perm:answered')
            await fake.waitFor(sc('perm'), 1, 30_000).catch(() => null)
            await quiet(2500, 30_000)
          } else if (step === 'ask') {
            await type(`[[T0727:${sc('ask')}]] ask me`)
            await waitFor('ask dialog', () => /Alpha/.test(screen()) && /Beta/.test(screen()))
            await sleep(1500); mark('ask:dialog-shown')
            p.write('\r'); mark('ask:answered')
            const got = await fake.waitFor(sc('ask'), 1, 8_000).catch(() => null)
            if (!got) { await sleep(500); log(`${def.name}: ask needed a second Enter; screen:\n${screen()}`); p.write('\r'); mark('ask:answered-2'); await fake.waitFor(sc('ask'), 1, 20_000).catch(() => null) }
            await quiet(2500, 30_000)
          } else if (step === 'todo') {
            await type(`[[T0727:${sc('todo')}]] keep a task list`)
            await fake.waitFor(sc('todo'), 0, 30_000).catch(() => null)
            // a permission prompt for a task tool would stall the step: answer whatever shows up
            for (let i = 0; i < 6; i++) {
              await quiet(2000, 20_000)
              if (/Do you want to proceed|Yes, and/i.test(screen())) { mark('todo:dialog'); p.write('\r') } else break
            }
            mark(`todo:tools=${offeredTools().filter(t => /^(TodoWrite|Task(Create|Update|List|Get))$/.test(t)).join('+') || 'none'}`)
          } else if (step === 'long') {
            fake.gate(sc('long'))
            await type(`[[T0727:${sc('long')}]] wait forever`)
            await fake.waitFor(sc('long'), 0, 30_000).catch(() => null)
            await sleep(2500); mark('long:esc')
            p.write(ESC)
            await quiet(2500, 20_000)
            fake.release(sc('long'), 0)
          } else if (step === 'err') {
            await type(`[[T0727:${sc('err')}]] T0789-ERR please fail`)
            await quiet(3000, 40_000)
          } else if (step === 'bg') {
            fake.gate(sc('bgwork'))
            await type(`[[T0727:${sc('bg')}]] start a background helper`)
            const launched = await fake.waitFor(sc('bg'), 1, 30_000).catch(() => null)
            const worker = await fake.waitFor(sc('bgwork'), 0, 30_000).catch(() => null)
            mark(`bg:launched=${!!launched} worker-request=${!!worker}`)
            await quiet(2500, 30_000)
            mark('bg:release')
            fake.release(sc('bgwork'), 0)
            await sleep(4000)
            await quiet(2500, 30_000)
          } else if (step === 'unsolicited') {
            // what a BAT restart replay would do: the old `OSC 7501 ; ?` re-parsed → a second reply nobody asked for
            const before = screen()
            mark('unsolicited:reply')
            term.input(`${ESC}]7501;?${BEL}`, false)
            await sleep(2500)
            const after = screen()
            mark(`unsolicited:screen-${before === after ? 'unchanged' : 'changed'}${/7501/.test(after) ? '-shows-7501' : ''}`)
          } else if (step === 'exit') {
            await type('/exit')
            await waitFor('exit', () => exited !== null, 20_000)
          }
          mark(`${step}:end`)
        }
      } finally {
        if (!exited) {
          if (process.platform === 'win32') await killTree(p.pid)
          else { try { process.kill(-p.pid, 'SIGKILL') } catch { try { p.kill('SIGKILL') } catch { /* gone */ } } }
          await sleep(500)
        }
      }

      const seqs = extractSequences(raw, chunkEnds)
      const statuses = seqs.filter(s => s.kind === 'osc' && s.code === '7501').map(s => parseStatus(s.t, s.data))
      const hookLines = fs.existsSync(hookLog) ? fs.readFileSync(hookLog, 'utf8').trim().split('\n').filter(Boolean) : []
      const hookEvents = hookLines.map(l => { const [t, ev, ...rest] = l.split(' '); return { t: Number(t), event: ev, extra: rest.join(' ') } })
      const oscCounts: Record<string, number> = {}
      for (const s of seqs) oscCounts[`${s.kind}:${s.code}`] = (oscCounts[`${s.kind}:${s.code}`] ?? 0) + 1
      const rel = (t: number) => t - t0
      const timeline = [
        ...marks.map(m => ({ t: rel(m.t), what: `mark ${m.label}` })),
        ...statuses.map(s => ({ t: rel(s.t), what: `7501 ${s.raw}${s.msg ? ` msg(${s.msg.len})="${s.msg.head}"` : ''}${s.title ? ` title(${s.title.len})="${s.title.head}"` : ''}` })),
        ...hookEvents.map(h => ({ t: rel(h.t), what: `hook ${h.event} ${h.extra}` })),
        ...replies.map(r => ({ t: rel(r.t), what: `reply ${r.reply}` })),
      ].sort((a, b) => a.t - b.t)
      const result = {
        case: def.name, reply: def.reply, env: def.env ?? {}, disableAllHooks: !!def.disableAllHooks, claudeVersion, xtermVersion,
        exit: exited ? { code: (exited as { code: number }).code, at: rel((exited as { t: number }).t) } : null,
        rawLength: raw.length, probes: seqs.filter(s => s.kind === 'osc' && s.code === '7501' && s.data.startsWith('?')).length,
        statusCount: statuses.filter(s => s.fields.state !== undefined).length,
        maxStatusLen: Math.max(0, ...statuses.map(s => s.len)),
        oscCounts, titles: titles.map(x => ({ t: rel(x.t), title: x.title.slice(0, 40) })), replies: replies.map(r => ({ ...r, t: rel(r.t) })),
        da1Replies: inputs.filter(i => /^\x1b\[\?[\d;]*c$/.test(i.data)).map(i => rel(i.t)),
        timeline,
      }
      fs.writeFileSync(path.join(OUT, `${def.name}.json`), JSON.stringify(result, null, 2))
      fs.writeFileSync(path.join(OUT, `${def.name}.raw.txt`), JSON.stringify(raw))
      log(`${def.name}: exit=${JSON.stringify(result.exit)} probes=${result.probes} statuses=${result.statusCount} maxLen=${result.maxStatusLen} osc=${JSON.stringify(oscCounts)}`)
      for (const row of timeline) log(`${def.name}  +${String(row.t).padStart(6)}ms ${row.what}`)
      summary.push({ case: def.name, exit: result.exit, probes: result.probes, statuses: result.statusCount, maxStatusLen: result.maxStatusLen, oscCounts })
      term.dispose()
    }
    fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ claudeVersion, xtermVersion, platform: process.platform, summary, proxyAttempts: proxy.attempts, fakeRequests: fake.requests.length, toolsOffered: offeredTools() }, null, 2))
    log(`proxy attempts: ${JSON.stringify(proxy.attempts)}; fake API requests: ${fake.requests.length}`)
    expect(proxy.attempts.filter(a => /anthropic\.com/.test(a))).toEqual([])
  } finally {
    await fake.close()
    await proxy.close()
    await new Promise<void>(r => { front.closeAllConnections?.(); front.close(() => r()) })
    for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }) } catch { /* in use */ } }
  }
})
