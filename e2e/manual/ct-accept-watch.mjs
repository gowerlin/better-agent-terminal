// T0969: keep a copy of every write of one file (CT acceptance: `_tower-state.md` of a test project).
//
//   node e2e/manual/ct-accept-watch.mjs <file> <outDir> [intervalMs]
//
// Polls <file> every <intervalMs> (default 100) and, each time its content changes, writes the new content to
// <outDir>/<seq>-<HHMMSS>.md (seq = three digits, from 001) and prints one line `<seq> <HHMMSS> <bytes> [menu_open]`.
// A change is saved only when two reads 40 ms apart agree (no half-written copy). A missing file is not a write.
// Polling, not fs.watch: on Windows fs.watch can miss or merge quick writes (CT writes the state file right
// before it opens a menu, CT 6.4.0 `menu_open`). Runs until killed (Ctrl+C / TaskStop); only reads <file>.

import fs from 'node:fs'
import path from 'node:path'

const [file, outDir, intervalArg] = process.argv.slice(2)
const interval = Number(intervalArg ?? 100)
if (!file || !outDir || !Number.isFinite(interval) || interval < 20) {
  console.error('usage: node e2e/manual/ct-accept-watch.mjs <file> <outDir> [intervalMs>=20]')
  process.exit(2)
}
fs.mkdirSync(outDir, { recursive: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))
const read = () => { try { return fs.readFileSync(file) } catch { return null } }
const hhmmss = () => new Date().toTimeString().slice(0, 8).replace(/:/g, '')

let seq = fs.readdirSync(outDir).filter(f => /^\d{3}-\d{6}\.md$/.test(f)).length
let last = null
console.log(`watching ${file} → ${outDir} every ${interval} ms (existing copies: ${seq})`)
for (;;) {
  const a = read()
  if (a && (!last || !a.equals(last))) {
    await sleep(40)
    const b = read()
    if (b && b.equals(a)) {
      last = a
      seq += 1
      const name = `${String(seq).padStart(3, '0')}-${hhmmss()}.md`
      fs.writeFileSync(path.join(outDir, name), a)
      const menu = /^menu_open:/m.test(a.toString('utf8')) ? ' menu_open' : ''
      console.log(`${name.slice(0, 3)} ${name.slice(4, 10)} ${a.length}${menu}`)
      continue
    }
  }
  await sleep(interval)
}
