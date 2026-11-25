// PLAN-068 W2 / T0904: the agent of a dispatched e2e Worker — runs `bat-notify.mjs` INSIDE the Worker PTY
// (so it uses the PTY's worker capability, bound to its Tower), one job at a time:
//   node notify-job-runner.mjs <jobs dir>
// Job `<jobs>/<terminal id>-<n>.json` = { args: [...] } (`{env:NAME}` is replaced from the PTY env);
// result `<jobs>/<terminal id>-<n>.res.json` = { code, stdout, stderr, startedAt, endedAt }.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const jobs = process.argv[2]
const env = process.env
const id = env.BAT_TERMINAL_ID
const fill = v => (typeof v === 'string' ? v.replace(/\{env:([A-Z0-9_]+)\}/g, (_, n) => env[n] || '') : v)

let n = 0
let busy = false
fs.writeFileSync(path.join(jobs, `${id}.ready`), String(Date.now()))
process.stdout.write('notify job runner ready\n')
setInterval(() => {
  const file = path.join(jobs, `${id}-${n}.json`)
  if (busy || !fs.existsSync(file)) return
  busy = true
  const job = JSON.parse(fs.readFileSync(file, 'utf8'))
  const startedAt = Date.now()
  const child = spawn(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-notify.mjs'), ...job.args.map(fill)], { env, windowsHide: true })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', d => { stdout += d })
  child.stderr.on('data', d => { stderr += d })
  child.on('close', code => {
    const res = path.join(jobs, `${id}-${n}.res.json`)
    fs.writeFileSync(`${res}.tmp`, JSON.stringify({ code, stdout, stderr, startedAt, endedAt: Date.now() }))
    fs.renameSync(`${res}.tmp`, res)
    n += 1
    busy = false
  })
}, 100)
