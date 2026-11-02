// T0778: macOS helpers for the GitHub Actions macOS runner acceptance (e2e/macos/).
//
// Everything here only *uses* what the runner already allows. Nothing changes the TCC database or any
// privacy setting: when macOS refuses (Apple Events to Finder, System Events keystrokes, screen capture),
// the refusal is the probe result and is recorded as such.
//
// - clipboard writes from another process: `osascript -l JavaScript` (JXA ObjC bridge, NSPasteboard)
// - Finder copy: AppleScript `tell application "Finder"` (select) + System Events Command+C
// - OS-level keys: AppleScript System Events `keystroke … using … down`

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface CmdResult {
  /** exit code; null when the process was killed (timeout) or could not start */
  code: number | null
  stdout: string
  stderr: string
  ms: number
  timedOut: boolean
  error?: string
}

/** execFile that never rejects; output trimmed to 2000 chars per stream. */
export function runCmd(file: string, args: string[], timeoutMs = 30_000, input?: string): Promise<CmdResult> {
  const started = Date.now()
  return new Promise(resolve => {
    const child = execFile(file, args, { timeout: timeoutMs, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string; signal?: string }) | null
      const timedOut = !!e && (e.killed === true || e.signal === 'SIGTERM') && Date.now() - started >= timeoutMs - 50
      resolve({
        code: e ? (typeof e.code === 'number' ? e.code : null) : 0,
        stdout: String(stdout ?? '').trim().slice(0, 2000),
        stderr: String(stderr ?? '').trim().slice(0, 2000),
        ms: Date.now() - started,
        timedOut,
        error: e && typeof e.code !== 'number' ? `${e.code ?? ''} ${e.message}`.trim().slice(0, 400) : undefined,
      })
    })
    if (input !== undefined) {
      child.stdin?.end(input)
    }
  })
}

export function describeCmd(r: CmdResult): string {
  const parts = [`exit=${r.code ?? 'none'}`, `${r.ms}ms`]
  if (r.timedOut) parts.push('TIMEOUT')
  if (r.stdout) parts.push(`stdout=${JSON.stringify(r.stdout)}`)
  if (r.stderr) parts.push(`stderr=${JSON.stringify(r.stderr)}`)
  if (r.error) parts.push(`error=${JSON.stringify(r.error)}`)
  return parts.join(' ')
}

// ---------------------------------------------------------------- scripts

const JXA_WRITE_FILE_URLS = `
ObjC.import('AppKit')
function run(argv) {
  const pb = $.NSPasteboard.generalPasteboard
  pb.clearContents
  const urls = $.NSMutableArray.array
  for (const p of argv) urls.addObject($.NSURL.fileURLWithPath(p))
  const ok = pb.writeObjects(urls)
  // Run #1 (T0778): another process sometimes saw only the first item of a multi-URL write. Stay
  // alive until the pasteboard reports every item (and the file name list), then a little longer.
  const itemsAtWrite = Number(pb.pasteboardItems.count)
  let waitedMs = 0
  const names = () => { const v = ObjC.deepUnwrap(pb.propertyListForType('NSFilenamesPboardType')); return Array.isArray(v) ? v.length : 0 }
  while ((Number(pb.pasteboardItems.count) < argv.length || names() < argv.length) && waitedMs < 3000) { delay(0.1); waitedMs += 100 }
  delay(0.3)
  return JSON.stringify({ ok: !!ok, count: argv.length, itemsAtWrite: itemsAtWrite, items: Number(pb.pasteboardItems.count), filenames: names(), waitedMs: waitedMs })
}
`

const JXA_WRITE_PNG = `
ObjC.import('AppKit')
function run(argv) {
  const pb = $.NSPasteboard.generalPasteboard
  pb.clearContents
  const data = $.NSData.dataWithContentsOfFile(argv[0])
  const ok = pb.setDataForType(data, 'public.png')
  return JSON.stringify({ ok: !!ok, bytes: Number(data.length) })
}
`

const JXA_READ_TYPES = `
ObjC.import('AppKit')
function run() {
  const pb = $.NSPasteboard.generalPasteboard
  const types = ObjC.deepUnwrap(pb.types) || []
  const items = []
  const arr = pb.pasteboardItems
  const n = Number(arr.count)
  for (let i = 0; i < n; i++) items.push(ObjC.deepUnwrap(arr.objectAtIndex(i).types) || [])
  const filenames = ObjC.deepUnwrap(pb.propertyListForType('NSFilenamesPboardType'))
  const fileUrl = ObjC.deepUnwrap(pb.stringForType('public.file-url'))
  return JSON.stringify({ changeCount: Number(pb.changeCount), types: types, items: items, filenames: filenames === undefined ? null : filenames, fileUrl: fileUrl === undefined ? null : fileUrl })
}
`

const AS_FINDER_NAME = `
on run argv
  set a to (POSIX file (item 1 of argv)) as alias
  tell application "Finder" to get name of a
end run
`

const AS_FINDER_SELECT = `
on run argv
  set theItems to {}
  repeat with p in argv
    set end of theItems to ((POSIX file (contents of p)) as alias)
  end repeat
  tell application "Finder"
    activate
    reveal (item 1 of theItems)
    select theItems
  end tell
  delay 1
  return "selected " & (count of theItems)
end run
`

const AS_KEYSTROKE = `
on run argv
  set k to item 1 of argv
  set m to item 2 of argv
  tell application "System Events"
    if m is "command" then
      keystroke k using command down
    else
      keystroke k using control down
    end if
  end tell
  return "sent " & m & "+" & k
end run
`

const AS_FRONTMOST = `
tell application "System Events" to get name of first application process whose frontmost is true
`

const AS_SET_FRONTMOST = `
on run argv
  set thePid to (item 1 of argv) as integer
  tell application "System Events" to set frontmost of (first application process whose unix id is thePid) to true
  return "frontmost set"
end run
`

/** Writes the scripts into `dir` once; returns their paths. */
export function writeScripts(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
  const put = (name: string, body: string) => {
    const file = path.join(dir, name)
    fs.writeFileSync(file, body)
    return file
  }
  return {
    writeFileUrls: put('write-file-urls.js', JXA_WRITE_FILE_URLS),
    writePng: put('write-png.js', JXA_WRITE_PNG),
    readTypes: put('read-types.js', JXA_READ_TYPES),
    finderName: put('finder-name.applescript', AS_FINDER_NAME),
    finderSelect: put('finder-select.applescript', AS_FINDER_SELECT),
    keystroke: put('keystroke.applescript', AS_KEYSTROKE),
    frontmost: put('frontmost.applescript', AS_FRONTMOST),
    setFrontmost: put('set-frontmost.applescript', AS_SET_FRONTMOST),
  }
}

export type Scripts = ReturnType<typeof writeScripts>

export const jxa = (script: string, args: string[] = [], timeoutMs = 20_000) => runCmd('osascript', ['-l', 'JavaScript', script, ...args], timeoutMs)
export const applescript = (script: string, args: string[] = [], timeoutMs = 30_000) => runCmd('osascript', [script, ...args], timeoutMs)

export interface PasteboardView {
  changeCount: number
  types: string[]
  items: string[][]
  filenames: string[] | null
  fileUrl: string | null
}

export async function readPasteboard(s: Scripts): Promise<{ view: PasteboardView | null; raw: CmdResult }> {
  const raw = await jxa(s.readTypes)
  try {
    return { view: JSON.parse(raw.stdout) as PasteboardView, raw }
  } catch {
    return { view: null, raw }
  }
}

/**
 * Classifies an osascript failure. -1743 = not authorised to send Apple Events (Automation),
 * 1002 / -25211 / "not allowed to send keystrokes" / "assistive access" = Accessibility.
 */
export function tccVerdict(r: CmdResult): 'ok' | 'blocked-automation' | 'blocked-accessibility' | 'timeout' | 'error' {
  if (r.code === 0) return 'ok'
  if (r.timedOut) return 'timeout'
  const text = `${r.stderr} ${r.error ?? ''}`
  if (/-1743|not authori[sz]ed to send apple events/i.test(text)) return 'blocked-automation'
  if (/\(1002\)|-25211|-1719|not allowed to send keystrokes|assistive access|not allowed assistive/i.test(text)) return 'blocked-accessibility'
  return 'error'
}

/** POSIX shell quoting as BAT's `quoteArgForShell(…, 'posix')` (src/utils/shell-quote.ts). */
export function posixQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-/=:@]+$/.test(arg)) return arg
  return `'${arg.replace(/'/g, "'\\''")}'`
}

/** Bracketed-paste markers xterm adds when the program in the PTY enabled mode 2004. */
export function stripBracketedPaste(s: string): string {
  return s.split('\x1b[200~').join('').split('\x1b[201~').join('')
}

/** Minimal ANSI strip for reading TUI output (CSI, OSC, single ESC sequences). */
export function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
}
