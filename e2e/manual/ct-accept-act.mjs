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
//   inbox <name>                       summary of the 待辦 tab DOM (awaiting / actions / recent / holds / ⏸N)
//   ctl <name> '<json op>'             any driver op
//
// Notes: `turn` / `idle` read the claude hook state, so the tab needs BAT hooks (`hooksStatus` ok). After an
// AskUserQuestion is closed with Esc very quickly, a late PermissionRequest hook can leave the tab `question`
// blocked until the next keystroke (T0923 finding): wait a few seconds before pressing Esc.

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
  awaiting: q('[data-inbox-awaiting]').map(e => [e.dataset.inboxAwaiting, 'rec=' + (e.querySelector('[data-inbox-recommended]')?.dataset.inboxRecommended ?? '-'), 'checked=' + checked(e.dataset.inboxAwaiting), 'dismiss=' + !!e.querySelector('[data-inbox-dismiss]'), 'free=' + !!e.querySelector('.inbox-free-input'), e.querySelector('.inbox-entry-summary')?.innerText ?? ''].join(' | ')),
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
    default:
      console.error(`unknown command ${cmd}`)
      process.exit(2)
  }
}
main().catch(e => { console.error(`error: ${e.message}`); process.exit(1) })
