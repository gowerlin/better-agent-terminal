// PLAN-068 W8 / T0913: runs BAT helper scripts INSIDE a BAT PTY (so they use the PTY's own capability and
// BAT_TERMINAL_ID), one job at a time — the generalised e2e/fixtures/notify-job-runner.mjs:
//   node helper-job-runner.mjs <jobs dir> [-- <foreground command> [args...]]
// Job `<jobs>/<terminal id>-<n>.json` = { script, args?, stdin? }: `script` is a helper file name in
// BAT_HELPER_DIR (e.g. `bat-notify.mjs`, `bat-hook.mjs`) or an absolute path (an older copy of a helper);
// `{env:NAME}` in args is replaced from the PTY env; `stdin` (optional) is written to the script's stdin
// (a claude hook's JSON). Result `<jobs>/<terminal id>-<n>.res.json` = { code, stdout, stderr, startedAt, endedAt }.
// Anything after <jobs dir> that does not follow `--` is ignored (a dispatched agent gets the prompt
// appended, e.g. `/ct-exec T0913`). With a foreground command (e.g. the fake Tower TUI, e2e/fixtures/fake-line-editor.mjs) it runs that on
// the PTY (stdio inherited: the TUI owns the terminal) and ends with it; the jobs run beside it, their
// output never reaches the terminal. No login, no token, nothing written outside <jobs dir>.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const jobs = process.argv[2]
const sep = process.argv.indexOf('--', 3)
const foreground = sep >= 0 ? process.argv.slice(sep + 1) : []
const env = process.env
const id = env.BAT_TERMINAL_ID
const fill = v => (typeof v === 'string' ? v.replace(/\{env:([A-Z0-9_]+)\}/g, (_, n) => env[n] || '') : v)

if (!jobs || !id) {
  process.stderr.write('usage: helper-job-runner.mjs <jobs dir> [-- <command> ...] (inside a BAT tab)\n')
  process.exit(2)
}

let n = 0
let busy = false
setInterval(() => {
  const file = path.join(jobs, `${id}-${n}.json`)
  if (busy || !fs.existsSync(file)) return
  busy = true
  const job = JSON.parse(fs.readFileSync(file, 'utf8'))
  const script = path.isAbsolute(job.script) ? job.script : path.join(env.BAT_HELPER_DIR, job.script)
  const startedAt = Date.now()
  const child = spawn(process.execPath, [script, ...(job.args ?? []).map(fill)], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', d => { stdout += d })
  child.stderr.on('data', d => { stderr += d })
  child.stdin.on('error', () => { /* the script may end before reading */ })
  child.stdin.end(typeof job.stdin === 'string' ? job.stdin : '')
  child.on('error', e => { stderr += `spawn failed: ${e.message}` })
  child.on('close', code => {
    const res = path.join(jobs, `${id}-${n}.res.json`)
    fs.writeFileSync(`${res}.tmp`, JSON.stringify({ code, stdout, stderr, startedAt, endedAt: Date.now() }))
    fs.renameSync(`${res}.tmp`, res)
    n += 1
    busy = false
  })
}, 100)

fs.writeFileSync(path.join(jobs, `${id}.ready`), String(Date.now()))
if (foreground.length > 0) {
  const fg = spawn(foreground[0], foreground.slice(1), { env, stdio: 'inherit', windowsHide: true })
  fg.on('exit', code => process.exit(code ?? 0))
  fg.on('error', e => {
    process.stderr.write(`foreground command failed: ${e.message}\n`)
    process.exit(1)
  })
} else {
  process.stdout.write('helper job runner ready\n')
}
