// T0923: step helper for a running e2e/manual/ct610-driver.ts (CT acceptance with a real claude Tower).
//
//   node e2e/manual/ct-accept-act.mjs <cmd> <name> [args...]
//
// <name> = the driver's CT610_NAME (state file <CT610_STATE_DIR or os.tmpdir()>/ct610-driver-<name>.json).
// Built on the driver's `eval` / `insert` / `type` / `press` ops; nothing here writes outside the isolated app.
//
// Commands (exit 0 = done; see `wait` for its other exit codes):
//   seed <name> <wsName> <folder> [claudeArgs]  save one workspace (defaultAgent claude-cli, claude-cli args
//                                               default `--dangerously-skip-permissions`) + a shell tab, reload
//   ids <name>                         terminal ids of the mounted tabs (+ first screen line)
//   screen <name> <id> [appendFile]    the tab's visible xterm screen as text (canvas renderer: read from the
//                                      xterm buffer, found through the TerminalPanel React fiber)
//   att <name> <id>                    the host's attention of the tab (`pty.attentionSnapshot`)
//   send <name> <id> <file|text>       focus the tab, insert the text as one input, Enter
//   type <name> <id> <text>            focus the tab, type key by key (a hand-typed line), Enter
//   key <name> <id> <key> [n]          focus the tab, press a key n times (ArrowDown, Enter, Escape…)
//   wait <name> <id> <mode> [sec]      poll the attention every 2 s (default limit 900 s):
//                                        idle  — not busy and not blocked 3 polls in a row → 0; menu open → 4
//                                        menu  — `blockedReason: question` (AskUserQuestion open) → 0
//                                        turn  — wait for a turn to start, then its menu → 0 or its end → 6
//                                      permission prompt → 3, time limit → 5
//   inbox <name>                       summary of the 待辦 tab DOM (awaiting / actions / recent / holds / ⏸N);
//                                      (T0939) per awaiting row: radiogroup / group+multi / free, 可複選 hint,
//                                      option codes + input type, every 推薦 mark, checked codes, 其他 on/off
//   ctl <name> '<json op>'             any driver op
//   menu <name> <id>                   the open AskUserQuestion menu as JSON: numbered options, highlighted one
//   pick <name> <id> <label|last>      (T0928) move the menu highlight to the option whose text starts with <label>
//                                      (`last` = last option before the built-in free-text row), check, Enter
//   other <name> <id> <text>           (T0928) move to the built-in free-text row ("Type something." / Other),
//                                      type <text> key by key, Enter
//   fastesc <name> <id> [sec] [delayMs] (T0928, BUG-224) poll the attention every 20 ms (default limit 540 s);
//                                      on `question`, poll the screen every 10 ms until the menu is drawn, then
//                                      after <delayMs> (default 0) send Esc as the tab's own keyboard input
//                                      (`terminal.input('\x1b', true)`); delayMs -1 = send Esc as soon as
//                                      `question` is seen, without waiting for the menu; prints the timings as JSON
//
// Notes: `turn` / `idle` read the claude hook state, so the tab needs BAT hooks (`hooksStatus` ok). Before
// BAT 0.8.0-exp.2 (BUG-224, T0926), an AskUserQuestion closed with Esc very quickly could stay `question`
// blocked until the next keystroke (T0923 finding): with older builds wait a few seconds before pressing Esc.

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const [cmd, name, ...args] = process.argv.slice(2)
if (!cmd || !name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
  console.error('usage: node e2e/manual/ct-accept-act.mjs <cmd> <name> [args...] (see the header)')
  process.exit(2)
}
const stateFile = path.join(process.env.CT610_STATE_DIR?.trim() || os.tmpdir(), `ct610-driver-${name}.json`)
let state
try {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
} catch {
  console.error(`driver ${name} is not running (no ${stateFile})`)
  process.exit(2)
}

function ctl(op) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: state.port, method: 'POST', path: '/',
      headers: { 'content-type': 'application/json', 'x-ct610-secret': state.secret }, timeout: 600_000,
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const r = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (!r.ok) reject(new Error(r.error))
        else resolve(r.result)
      })
    })
    req.on('error', reject)
    req.end(JSON.stringify(op))
  })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const now = () => new Date().toTimeString().slice(0, 8)

// Renderer snippet: `found[terminalId]` = that tab's xterm Terminal (from the TerminalPanel fiber's refs).
const FIND = `
const found = {}
for (const x of document.querySelectorAll('.xterm')) {
  let el = x; let k
  while (el && !(k = Object.keys(el).find(n => n.startsWith('__reactFiber$')))) el = el.parentElement
  let f = k ? el[k] : null
  for (let i = 0; f && i < 40; i++, f = f.return) {
    const id = f.memoizedProps && f.memoizedProps.terminalId
    if (!id) continue
    let h = f.memoizedState
    for (let j = 0; h && j < 200; j++, h = h.next) {
      const v = h.memoizedState && h.memoizedState.current
      if (v && v.buffer && v.buffer.active && typeof v.focus === 'function') { found[id] = v; break }
    }
    if (found[id]) break
  }
}
`
const focusJs = id => `${FIND} const t = found[${JSON.stringify(id)}]; if (!t) return 'none'; t.focus(); return 'focused'`

// Renderer snippet: `screenOf(t)` = visible rows of a terminal as text.
const SCREEN = `const screenOf = t => { const b = t.buffer.active; const lines = []
  for (let y = 0; y < t.rows; y++) { const l = b.getLine(b.viewportY + y); lines.push(l ? l.translateToString(true) : '') }
  return lines.join('\\n') };`

// The AskUserQuestion menu as claude draws it: `❯ 1. A 一（推薦）`, `  2. B 二`, …, then its built-in free-text row
// (`Type something.` in claude 2.1.x; `Other` / `其他` accepted too) and `Chat about this` below a rule.
const FREE_TEXT_RE = /^(Type something|Other\b|其他)/i
function parseMenu(text) {
  const options = []
  for (const line of text.split('\n')) {
    const m = /^\s*(❯|>)?\s*(\d+)\.\s+(.*\S)\s*$/.exec(line)
    if (m) options.push({ n: Number(m[2]), text: m[3], highlighted: !!m[1] })
  }
  return { options, highlighted: options.find(o => o.highlighted)?.n ?? null }
}
async function screenText(id) {
  const r = await ctl({ op: 'eval', js: `${FIND} ${SCREEN} const t = found[${JSON.stringify(id)}]; return t ? screenOf(t) : null` })
  if (r === null) throw new Error(`terminal ${id} not found`)
  return r
}
async function moveTo(id, target) {
  for (let tries = 0; tries < 3; tries++) {
    const { highlighted } = parseMenu(await screenText(id))
    if (highlighted === null) throw new Error('no highlighted menu option on screen')
    if (highlighted === target) return
    const key = target > highlighted ? 'ArrowDown' : 'ArrowUp'
    await focus(id)
    for (let i = 0; i < Math.abs(target - highlighted); i++) { await ctl({ op: 'press', key }); await sleep(250) }
    await sleep(400)
  }
  throw new Error(`could not move the highlight to option ${target}`)
}

async function attention(id) {
  const r = await ctl({ op: 'eval', js: `return await window.electronAPI.pty.attentionSnapshot([${JSON.stringify(id)}])` })
  return r?.[0]?.attention ?? null
}

async function focus(id) {
  const r = await ctl({ op: 'eval', js: focusJs(id) })
  if (r !== 'focused') throw new Error(`terminal ${id} not found`)
}

async function wait(id, mode, limitSec) {
  const limit = Date.now() + limitSec * 1000
  const start = Date.now()
  let started = false
  let stable = 0
  while (Date.now() < limit) {
    const a = await attention(id)
    const busy = a?.busy === true
    const reason = a?.blockedReason
    if (reason === 'permission') { console.log(`[${now()}] permission ${JSON.stringify(a)}`); process.exit(3) }
    if (mode === 'menu' && reason === 'question') { console.log(`[${now()}] menu`); return }
    if (mode === 'turn') {
      if (reason === 'question') { console.log(`[${now()}] menu`); return }
      if (busy || reason) { started = true; stable = 0 } else if (started && ++stable >= 3) { console.log(`[${now()}] turn ended without menu`); process.exit(6) }
    }
    if (mode === 'idle') {
      if (reason === 'question') { console.log(`[${now()}] menu open`); process.exit(4) }
      if (busy || reason) { started = true; stable = 0 } else if ((started || Date.now() - start > 20_000) && ++stable >= 3) { console.log(`[${now()}] idle`); return }
    }
    await sleep(2000)
  }
  console.log(`[${now()}] timeout (${mode})`)
  process.exit(5)
}

const INBOX_JS = `const q = s => [...document.querySelectorAll(s)];
const checked = id => q('[data-inbox-awaiting="' + id + '"] [data-inbox-option]').filter(l => l.querySelector('input').checked).map(l => l.dataset.inboxOption).join(',') || '-';
return {
  awaiting: q('[data-inbox-awaiting]').map(e => [e.dataset.inboxAwaiting,
    'kind=' + (e.querySelector('[data-inbox-option-list]')?.getAttribute('role') ?? 'free') + (e.querySelector('[data-inbox-multi]') ? '+multi' : ''),
    'hint=' + (e.querySelector('[data-inbox-multi-hint]')?.innerText ?? '-'),
    'options=' + (q('[data-inbox-awaiting="' + e.dataset.inboxAwaiting + '"] [data-inbox-option]').map(l => l.dataset.inboxOption + ':' + (l.querySelector('input')?.type ?? '?')).join(',') || '-'),
    'rec=' + (q('[data-inbox-awaiting="' + e.dataset.inboxAwaiting + '"] [data-inbox-recommended]').map(r => r.dataset.inboxRecommended).join(',') || '-'),
    'checked=' + checked(e.dataset.inboxAwaiting),
    'other=' + (e.querySelector('[data-inbox-option-other]') ? (e.querySelector('[data-inbox-option-other] input')?.checked ? 'on' : 'off') : '-'),
    'dismiss=' + !!e.querySelector('[data-inbox-dismiss]'), 'free=' + !!e.querySelector('.inbox-free-input'),
    'freeHint=' + !!e.querySelector('[data-inbox-free-hint],[data-inbox-other-hint]'),
    e.querySelector('.inbox-entry-summary')?.innerText ?? ''].join(' | ')),
  actions: q('[data-inbox-action]').map(e => [e.dataset.inboxAction, 'skip=' + !!e.querySelector('[data-inbox-dismiss]'), e.querySelector('.inbox-entry-summary')?.innerText ?? ''].join(' | ')),
  recent: q('.inbox-recent-item').map(e => e.innerText.split('\\n').join(' ')),
  toolbars: q('[data-inbox-dismiss-toolbar]').map(e => e.dataset.inboxDismissToolbar),
  statuses: q('[data-inbox-answer-status]').map(e => e.innerText),
  holds: q('[data-notify-hold]').map(e => e.dataset.notifyHold + ':' + (e.dataset.notifyHoldReason ?? '') + ':' + e.innerText),
  awaitingBadges: q('.inbox-awaiting-badge').map(e => e.dataset.inboxAwaitingCount),
}`

async function main() {
  switch (cmd) {
    case 'seed': {
      const [wsName, folder, claudeArgs = '--dangerously-skip-permissions'] = args
      if (!wsName || !folder) throw new Error('seed <name> <wsName> <folder> [claudeArgs]')
      const ws = `ws-${wsName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
      const seed = {
        workspaces: [{ id: ws, name: wsName, folderPath: folder, createdAt: Date.now(), defaultAgent: 'claude-cli', agentCustomArgs: { 'claude-cli': claudeArgs } }],
        activeWorkspaceId: ws, activeGroup: null,
        terminals: [{ id: `${ws}-shell`, workspaceId: ws, type: 'terminal', title: 'New Terminal', cwd: folder }],
        activeTerminalId: `${ws}-shell`,
      }
      const saved = await ctl({ op: 'eval', js: `await new Promise(r => setTimeout(r, 1500)); return await window.electronAPI.workspace.save(${JSON.stringify(JSON.stringify(seed))})` })
      if (saved !== true) throw new Error(`workspace.save returned ${JSON.stringify(saved)}`)
      console.log(await ctl({ op: 'reload' }))
      break
    }
    case 'ids': {
      const r = await ctl({ op: 'eval', js: `${FIND} return Object.entries(found).map(([id, t]) => { const l = t.buffer.active.getLine(t.buffer.active.viewportY); return { id, cols: t.cols, rows: t.rows, first: l ? l.translateToString(true).slice(0, 80) : '' } })` })
      console.log(JSON.stringify(r, null, 1))
      break
    }
    case 'screen': {
      const r = await ctl({ op: 'eval', js: `${FIND} const t = found[${JSON.stringify(args[0])}]; if (!t) return null
        const b = t.buffer.active; const lines = []
        for (let y = 0; y < t.rows; y++) { const l = b.getLine(b.viewportY + y); lines.push(l ? l.translateToString(true) : '') }
        return { cols: t.cols, rows: t.rows, type: b.type, text: lines.join('\\n') }` })
      if (!r) { console.error(`terminal ${args[0]} not found`); process.exit(1) }
      const text = r.text.replace(/\s+$/gm, '').replace(/\n{3,}/g, '\n\n')
      if (args[1]) {
        fs.mkdirSync(path.dirname(args[1]), { recursive: true })
        fs.appendFileSync(args[1], `\n===== screen ${new Date().toISOString()} (${r.cols}x${r.rows} ${r.type}) =====\n${text}\n`, 'utf8')
      }
      console.log(text)
      break
    }
    case 'att':
      console.log(JSON.stringify(await attention(args[0])))
      break
    case 'send': {
      const raw = fs.existsSync(args[1]) ? fs.readFileSync(args[1], 'utf8') : String(args[1] ?? '')
      const text = raw.replace(/\r?\n+$/, '')
      await focus(args[0])
      await ctl({ op: 'insert', text })
      await sleep(800)
      await ctl({ op: 'press', key: 'Enter' })
      console.log(`[${now()}] sent len=${text.length}`)
      break
    }
    case 'type': {
      await focus(args[0])
      await ctl({ op: 'type', text: String(args[1] ?? ''), delay: 60 })
      await sleep(1000)
      await ctl({ op: 'press', key: 'Enter' })
      console.log(`[${now()}] typed len=${String(args[1] ?? '').length}`)
      break
    }
    case 'key': {
      await focus(args[0])
      const n = Number(args[2] ?? 1)
      for (let i = 0; i < n; i++) { await ctl({ op: 'press', key: args[1] }); await sleep(250) }
      console.log(`[${now()}] key ${args[1]} x${n}`)
      break
    }
    case 'wait':
      await wait(args[0], args[1] ?? 'idle', Number(args[2] ?? 900))
      break
    case 'inbox':
      console.log(JSON.stringify(await ctl({ op: 'eval', js: INBOX_JS }), null, 1))
      break
    case 'ctl':
      console.log(JSON.stringify(await ctl(JSON.parse(args[0])), null, 1))
      break
    case 'menu':
      console.log(JSON.stringify(parseMenu(await screenText(args[0])), null, 1))
      break
    case 'pick': {
      const [id, label] = args
      if (!id || !label) throw new Error('pick <name> <id> <label|last>')
      const { options } = parseMenu(await screenText(id))
      const choices = options.filter(o => !FREE_TEXT_RE.test(o.text) && !/^Chat about this/i.test(o.text))
      const target = label === 'last' ? choices[choices.length - 1] : choices.find(o => o.text.startsWith(label))
      if (!target) throw new Error(`no option ${label} in ${JSON.stringify(options.map(o => `${o.n}. ${o.text}`))}`)
      await moveTo(id, target.n)
      await focus(id)
      await ctl({ op: 'press', key: 'Enter' })
      console.log(`[${now()}] picked ${target.n}. ${target.text}`)
      break
    }
    case 'other': {
      const [id, text] = args
      if (!id || !text) throw new Error('other <name> <id> <text>')
      const { options } = parseMenu(await screenText(id))
      const row = options.find(o => FREE_TEXT_RE.test(o.text))
      if (!row) throw new Error(`no free-text row in ${JSON.stringify(options.map(o => `${o.n}. ${o.text}`))}`)
      await moveTo(id, row.n)
      await focus(id)
      await ctl({ op: 'type', text, delay: 60 })
      await sleep(1000)
      await ctl({ op: 'press', key: 'Enter' })
      console.log(`[${now()}] other ${row.n}. typed len=${text.length}`)
      break
    }
    case 'fastesc': {
      const [id, sec = '540', delay = '0'] = args
      const js = `${FIND} ${SCREEN}
        const t = found[${JSON.stringify(id)}]; if (!t) return { error: 'terminal not found' }
        const sleep = ms => new Promise(r => setTimeout(r, ms))
        const t0 = performance.now(); const limit = ${Number(sec) * 1000}
        while (performance.now() - t0 < limit) {
          const a = (await window.electronAPI.pty.attentionSnapshot([${JSON.stringify(id)}]))?.[0]?.attention
          if (a && a.blockedReason === 'permission') return { permission: true }
          if (a && a.blockedReason === 'question') {
            const tq = performance.now(); let tm = null
            while (${Number(delay)} >= 0 && performance.now() - tq < 3000) {
              if (/Enter to select|Esc to cancel|Type something/.test(screenOf(t))) { tm = performance.now(); break }
              await sleep(10)
            }
            if (${Number(delay)} > 0) await sleep(${Number(delay)})
            t.input('\\x1b', true)
            const te = performance.now()
            return { questionAtMs: Math.round(tq - t0), menuDrawnAfterQuestionMs: tm === null ? null : Math.round(tm - tq),
              escAfterMenuMs: tm === null ? null : Math.round(te - tm), escWallClock: new Date().toISOString() }
          }
          await sleep(20)
        }
        return { timeout: true }`
      const r = await ctl({ op: 'eval', js })
      console.log(JSON.stringify(r))
      if (r?.permission) process.exit(3)
      if (r?.timeout || r?.error) process.exit(5)
      break
    }
    default:
      console.error(`unknown command ${cmd}`)
      process.exit(2)
  }
}
main().catch(e => { console.error(`error: ${e.message}`); process.exit(1) })
