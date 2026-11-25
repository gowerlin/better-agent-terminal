// T0915: sends one command to a running e2e/manual/ct610-driver.ts and prints the JSON reply.
//
//   node e2e/manual/ct610-ctl.mjs <name> '<json op>'
//   node e2e/manual/ct610-ctl.mjs <name> @<file with the json op>
//
// <name> = the driver's CT610_NAME; the port / secret are read from
// <CT610_STATE_DIR or os.tmpdir()>/ct610-driver-<name>.json. Exit 0 = the op succeeded, 1 = it failed
// (reply printed), 2 = usage / driver not running. See e2e/manual/README.md for the op list.

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const [name, arg] = process.argv.slice(2)
if (!name || !arg || !/^[a-zA-Z0-9._-]+$/.test(name)) {
  console.error('usage: node e2e/manual/ct610-ctl.mjs <name> \'<json op>\' | @<file>')
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
const body = arg.startsWith('@') ? fs.readFileSync(arg.slice(1), 'utf8') : arg
JSON.parse(body) // fail early on bad JSON

const req = http.request({
  host: '127.0.0.1', port: state.port, method: 'POST', path: '/',
  headers: { 'content-type': 'application/json', 'x-ct610-secret': state.secret },
  timeout: 600_000,
}, res => {
  const chunks = []
  res.on('data', c => chunks.push(c))
  res.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8')
    process.stdout.write(`${text}\n`)
    let ok = false
    try { ok = JSON.parse(text).ok === true } catch { /* not json */ }
    process.exit(ok ? 0 : 1)
  })
})
req.on('error', err => { console.error(`request failed: ${err.message}`); process.exit(2) })
req.end(body)
