// PLAN-068 W2 / T0904: a fake Tower TUI for e2e — a raw-mode line editor like the input box of claude /
// codex (no login, no token). Every Enter submits the current line; Ctrl+C clears it; Backspace deletes;
// escape sequences (focus reports, arrows) are ignored. Usage:
//   node fake-line-editor.mjs <state dir>
// Writes `<dir>/submitted.jsonl` ({ at, line } per Enter, { at, ctrlC: true } per Ctrl+C), keeps
// `<dir>/line.json` = the current line, and `<dir>/ready` once it reads the terminal. Prints 120 lines of
// filler first so the tab has scrollback (the `reading` test scrolls it up).
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
if (!dir) {
  process.stderr.write('usage: fake-line-editor.mjs <state dir>\n')
  process.exit(2)
}
fs.mkdirSync(dir, { recursive: true })
const submitted = path.join(dir, 'submitted.jsonl')
const lineFile = path.join(dir, 'line.json')

for (let i = 0; i < 120; i++) process.stdout.write(`filler line ${i}\r\n`)

let line = ''
const draw = () => {
  process.stdout.write(`\r\x1b[K> ${line}`)
  // whole file or nothing for the test reading it (write a temp file, then rename)
  fs.writeFileSync(`${lineFile}.tmp`, JSON.stringify({ line }))
  try {
    fs.renameSync(`${lineFile}.tmp`, lineFile)
  } catch {
    fs.writeFileSync(lineFile, JSON.stringify({ line }))
  }
}
const submit = () => {
  fs.appendFileSync(submitted, JSON.stringify({ at: Date.now(), line }) + '\n')
  process.stdout.write(`\r\x1b[K> ${line}\r\ngot: ${line}\r\n`)
  line = ''
}

process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', (data) => {
  for (let i = 0; i < data.length; i++) {
    const ch = data[i]
    if (ch === '\r') {
      submit()
    } else if (ch === '\x03') {
      fs.appendFileSync(submitted, JSON.stringify({ at: Date.now(), ctrlC: true }) + '\n')
      line = ''
    } else if (ch === '\x7f' || ch === '\b') {
      line = line.slice(0, -1)
    } else if (ch === '\x1b') {
      // skip one escape sequence: ESC [ … final, ESC O x, or ESC x
      const next = data[i + 1]
      if (next === '[') {
        let j = i + 2
        while (j < data.length && !/[@-~]/.test(data[j])) j++
        i = j
      } else {
        i += 1
      }
    } else if (ch === '\x04') {
      process.exit(0)
    } else if (ch >= ' ') {
      line += ch
    }
  }
  draw()
})
draw()
fs.writeFileSync(path.join(dir, 'ready'), String(Date.now()))
