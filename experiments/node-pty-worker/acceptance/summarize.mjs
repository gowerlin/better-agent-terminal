// T0888: summarise experiments/node-pty-worker/results/t0888-*.csv (written by e2e/t0888-shared-conout-stress.spec.ts)
// into one Markdown table per scenario: median per (Label, Step) of TsPrivMB / TsThreads / Value, with the run count.
//   node experiments/node-pty-worker/acceptance/summarize.mjs [results dir]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'results')

function parseCsv(text) {
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    rows.push([...line.matchAll(/"([^"]*)"/g)].map(m => m[1]))
  }
  const [head, ...body] = rows
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

const median = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return ''; const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2 * 10) / 10 }

for (const file of fs.readdirSync(dir).filter(f => /^t0888-c\d\.csv$/.test(f)).sort()) {
  const rows = parseCsv(fs.readFileSync(path.join(dir, file), 'utf8'))
  const groups = new Map()
  for (const r of rows) {
    const key = `${r.Label}\u0000${r.Step}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  console.log(`\n### ${file}\n`)
  console.log('| Label | Step | n | Tabs | TS Private MB (median) | TS threads (median) | Value (median) | last Note |')
  console.log('|---|---|---|---|---|---|---|---|')
  for (const [key, rs] of groups) {
    const [label, step] = key.split('\u0000')
    const num = (k) => rs.filter(r => r[k] !== '').map(r => Number(r[k]))
    console.log(`| ${label} | ${step} | ${rs.length} | ${rs[0].Tabs} | ${median(num('TsPrivMB'))} | ${median(num('TsThreads'))} | ${median(rs.filter(r => r.Value !== '').map(r => Number(r.Value)))} | ${rs[rs.length - 1].Note} |`)
  }
}
