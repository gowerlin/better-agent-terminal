// PLAN-068 W2 / T0904: a fake Tower TUI for e2e — a raw-mode line editor like the input box of claude /
// codex (no login, no token). Every Enter submits the current line; Ctrl+C clears it; Backspace deletes;
// escape sequences (focus reports, arrows) are ignored. Usage:
//   node fake-line-editor.mjs <state dir>
// Writes `<dir>/submitted.jsonl` ({ at, line } per Enter, { at, ctrlC: true } per Ctrl+C), keeps
// `<dir>/line.json` = the current line, and `<dir>/ready` once it reads the terminal. Prints 120 lines of
// filler first so the tab has scrollback (the `reading` test scrolls it up).
// T0917: Ctrl+] (0x1d) toggles a fullscreen mode like claude's: the alt screen with SGR mouse tracking
// (wheel reports arrive as `ESC [ < 64/65 ; x ; y M` and are skipped like any escape sequence); the
// state goes to `<dir>/alt.json` ({ alt, wheelUp, wheelDown }).
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

// T0917: the fullscreen mode (alt screen + SGR mouse tracking, as claude's)
let alt = false
let wheelUp = 0
let wheelDown = 0
const writeAlt = () => fs.writeFileSync(path.join(dir, 'alt.json'), JSON.stringify({ alt, wheelUp, wheelDown }))
const toggleAlt = () => {
  alt = !alt
  if (alt) {
    process.stdout.write('\x1b[?1049h\x1b[?1000h\x1b[?1006h\x1b[2J\x1b[H')
    for (let i = 0; i < 10; i++) process.stdout.write(`fullscreen line ${i}\r\n`)
  } else {
    process.stdout.write('\x1b[?1006l\x1b[?1000l\x1b[?1049l')
  }
  writeAlt()
}

process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', (data) => {
  for (let i = 0; i < data.length; i++) {
    const ch = data[i]
    if (ch === '\x1d') {
      toggleAlt()
    } else if (ch === '\x1b' && data[i + 1] === '[' && data[i + 2] === '<') {
      // an SGR mouse report: count the wheel ones (64 up, 65 down; modifier bits ignored), skip it
      const m = /^\x1b\[<(\d+);\d+;\d+[Mm]/.exec(data.slice(i))
      if (m) {
        const button = Number(m[1]) & ~(4 | 8 | 16)
        if (button === 64) wheelUp++
        else if (button === 65) wheelDown++
        writeAlt()
        i += m[0].length - 1
      } else {
        let j = i + 2 // not a whole report in this chunk: skip it as any CSI sequence
        while (j < data.length && !/[@-~]/.test(data[j])) j++
        i = j
      }
    } else if (ch === '\r') {
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
