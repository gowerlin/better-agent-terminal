/**
 * T0838 (PLAN-043 W1): line-preserving INI editor shared by `%USERPROFILE%\.wslconfig`
 * and a distro's `/etc/wsl.conf`.
 *
 * Pure module: no electron, no fs, no clock. The caller reads the file, decodes
 * it with `decodeIniBuffer`, edits the text with `setIniValue`, encodes it back
 * with `encodeIniText` (same encoding as read) and writes it. A result with
 * `ok: false` means "do not write": the caller must leave the file alone.
 *
 * Only the target line changes. Every other line — comments, blank lines,
 * unknown keys, key order, spacing, line endings — is kept byte for byte.
 *
 * WSL rules followed here (microsoft/WSL `src/shared/configfile/configfile.cpp`,
 * read 2026-11-04; the same parser reads `.wslconfig` and `/etc/wsl.conf`):
 *  - Section and key names compare case-insensitively (`strcasecmp` on
 *    `section.key`). A name starts with a letter, then letters / digits only.
 *  - Duplicate keys: the FIRST occurrence wins, later ones are ignored with a
 *    warning — across repeated `[section]` blocks too, since keys are matched as
 *    `section.key`. So this editor changes the first occurrence only and reports
 *    the later ones in `ignoredDuplicateLines` (left untouched). WSL's own
 *    update mode does the same ("Only match the first instance of the key").
 *  - Comments: only `#` is a comment in WSL; a `;` line is an invalid line WSL
 *    ignores. Either way neither is touched here (both are kept as comments).
 *    An unquoted `#` after a value starts a trailing comment, kept on replace.
 *  - Values may be `"quoted"`; `\` escapes and `\`-newline continuation exist.
 *    New values are restricted to characters that need no quoting / escaping.
 *  - A missing key goes after the last key of the section's first block (WSL's
 *    update mode inserts it before the next header); a missing section goes at
 *    the end of the file.
 *
 * Encoding (`.wslconfig` written by Windows PowerShell 5 `>` / `Out-File` is
 * UTF-16 LE with a BOM): detected from the bytes and reported, so the file is
 * written back the way it was read. Whether WSL itself reads every one of these
 * encodings is not verified here (inference: the CRT reads BOM-marked UTF-8 /
 * UTF-16 LE); this module only guarantees it does not change the encoding.
 */

export type IniEncoding = 'utf8' | 'utf8-bom' | 'utf16le-bom' | 'utf16le' | 'utf16be-bom'

export type IniDecodeResult =
  | { ok: true; text: string; encoding: IniEncoding }
  | { ok: false; reason: 'invalid-encoding'; message: string }

export type IniEditFailureReason =
  | 'invalid-section'
  | 'invalid-key'
  | 'invalid-value'
  | 'unparsable-line'
  | 'line-continuation'

export type IniEditResult =
  | {
      ok: true
      text: string
      /** false when the value was already set (text is the input, unchanged). */
      changed: boolean
      action: 'unchanged' | 'replaced' | 'added-key' | 'added-section'
      /** 1-based line of the written (or already correct) key in the new text. */
      line: number
      /** 1-based lines (in the new text) of later duplicates WSL ignores; not edited. */
      ignoredDuplicateLines: number[]
    }
  | { ok: false; reason: IniEditFailureReason; message: string; line?: number }

export type IniGetResult =
  | { ok: true; value: string | null; line: number | null }
  | { ok: false; reason: IniEditFailureReason; message: string; line?: number }

/** WSL config names: first char `isalpha`, the rest `isalnum` (configfile.cpp). */
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/
/** Values this editor writes: no quoting / escaping needed, no comment / control chars. */
const VALUE_PATTERN = /^[^\s"#\\\x00-\x1f\x7f]([^"#\\\x00-\x1f\x7f]*[^\s"#\\\x00-\x1f\x7f])?$/
const BACKUP_STAMP_PATTERN = /^\d{8}-\d{6}$/

interface RawLine {
  content: string
  eol: '' | '\n' | '\r\n'
}

type ParsedLine =
  | { kind: 'blank' }
  | { kind: 'comment' }
  | { kind: 'section'; name: string }
  | {
      kind: 'key'
      name: string
      /** indent + key + spacing + `=` + spacing */
      prefix: string
      /** raw value text, trailing spaces excluded, quotes included */
      rawValue: string
      /** trailing spaces + `# comment` (may be empty) */
      tail: string
      /** value with quotes removed and escapes resolved; null when the quote is unclosed */
      value: string | null
      quoted: boolean
    }

type ParseFailure = { ok: false; reason: IniEditFailureReason; message: string; line: number }

function splitLines(text: string): RawLine[] {
  const lines: RawLine[] = []
  let start = 0
  while (start < text.length) {
    const nl = text.indexOf('\n', start)
    if (nl === -1) {
      lines.push({ content: text.slice(start), eol: '' })
      break
    }
    const crlf = nl > start && text[nl - 1] === '\r'
    lines.push({ content: text.slice(start, crlf ? nl - 1 : nl), eol: crlf ? '\r\n' : '\n' })
    start = nl + 1
  }
  return lines
}

function joinLines(lines: RawLine[]): string {
  return lines.map((line) => line.content + line.eol).join('')
}

function isHSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t'
}

/** Split `value [# comment]` the way WSL does: `#` outside quotes ends the value. */
function splitValue(afterEquals: string): { rawValue: string; tail: string; value: string | null; quoted: boolean; continuation: boolean } {
  let inQuote = false
  let commentAt = -1
  let value = ''
  let sawQuote = false
  for (let i = 0; i < afterEquals.length; i++) {
    const ch = afterEquals[i]
    if (ch === '\\') {
      if (i === afterEquals.length - 1) {
        return { rawValue: afterEquals, tail: '', value: null, quoted: sawQuote, continuation: true }
      }
      value += afterEquals[i + 1]
      i++
      continue
    }
    if (ch === '"') {
      inQuote = !inQuote
      sawQuote = true
      continue
    }
    if (ch === '#' && !inQuote) {
      commentAt = i
      break
    }
    value += ch
  }
  const body = commentAt === -1 ? afterEquals : afterEquals.slice(0, commentAt)
  const rawValue = body.replace(/[ \t]+$/, '')
  const tail = afterEquals.slice(rawValue.length)
  const trimmedValue = inQuote ? null : value.replace(/[ \t]+$/, '')
  const quoted = /^".*"$/.test(rawValue) && rawValue.length >= 2
  return { rawValue, tail, value: quoted && trimmedValue !== null ? rawValue.slice(1, -1).replace(/\\(.)/g, '$1') : trimmedValue, quoted, continuation: false }
}

function parseLine(content: string, lineNo: number): ParsedLine | ParseFailure {
  const trimmed = content.trim()
  if (trimmed === '') return { kind: 'blank' }
  if (trimmed.startsWith('#') || trimmed.startsWith(';')) return { kind: 'comment' }
  if (trimmed.startsWith('[')) {
    const header = trimmed.match(/^\[([^\]]*)\]\s*(#.*)?$/)
    const name = header ? header[1].trim() : ''
    if (!header || !NAME_PATTERN.test(name)) {
      return { ok: false, reason: 'unparsable-line', message: `Line ${lineNo} is not a valid section header.`, line: lineNo }
    }
    return { kind: 'section', name }
  }
  const eq = content.indexOf('=')
  if (eq === -1) {
    return { ok: false, reason: 'unparsable-line', message: `Line ${lineNo} is neither a comment, a section header nor key=value.`, line: lineNo }
  }
  const name = content.slice(0, eq).trim()
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, reason: 'unparsable-line', message: `Line ${lineNo} has an invalid key name.`, line: lineNo }
  }
  let valueStart = eq + 1
  while (valueStart < content.length && isHSpace(content[valueStart])) valueStart++
  const split = splitValue(content.slice(valueStart))
  if (split.continuation) {
    // A trailing `\` joins the next line into this value in WSL; that next line
    // could be a section header, so the structure is not what it looks like.
    return { ok: false, reason: 'line-continuation', message: `Line ${lineNo} continues onto the next line.`, line: lineNo }
  }
  return {
    kind: 'key',
    name,
    prefix: content.slice(0, valueStart),
    rawValue: split.rawValue,
    tail: split.tail,
    value: split.value,
    quoted: split.quoted,
  }
}

interface ParsedFile {
  bom: string
  lines: RawLine[]
  parsed: ParsedLine[]
  /** section (lower case) of each line; '' before the first header */
  sectionOf: string[]
}

function parseFile(text: string): ParsedFile | ParseFailure {
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : ''
  const lines = splitLines(bom ? text.slice(1) : text)
  const parsed: ParsedLine[] = []
  const sectionOf: string[] = []
  let section = ''
  for (let i = 0; i < lines.length; i++) {
    const result = parseLine(lines[i].content, i + 1)
    if ('ok' in result) return result
    if (result.kind === 'section') section = result.name.toLowerCase()
    parsed.push(result)
    sectionOf.push(section)
  }
  return { bom, lines, parsed, sectionOf }
}

function validateNames(section: string, key: string): ParseFailure | null {
  if (!NAME_PATTERN.test(section)) {
    return { ok: false, reason: 'invalid-section', message: 'Section name must be a letter followed by letters / digits.', line: 0 }
  }
  if (!NAME_PATTERN.test(key)) {
    return { ok: false, reason: 'invalid-key', message: 'Key name must be a letter followed by letters / digits.', line: 0 }
  }
  return null
}

function failure(result: ParseFailure): { ok: false; reason: IniEditFailureReason; message: string; line?: number } {
  return result.line > 0 ? result : { ok: false, reason: result.reason, message: result.message }
}

function findKeyLines(file: ParsedFile, section: string, key: string): number[] {
  const sectionLower = section.toLowerCase()
  const keyLower = key.toLowerCase()
  const found: number[] = []
  file.parsed.forEach((line, index) => {
    if (line.kind === 'key' && file.sectionOf[index] === sectionLower && line.name.toLowerCase() === keyLower) {
      found.push(index)
    }
  })
  return found
}

/** Line ending for inserted lines: the file's first line ending, else LF. */
function preferredEol(lines: RawLine[]): '\n' | '\r\n' {
  const first = lines.find((line) => line.eol !== '')
  return first?.eol === '\r\n' ? '\r\n' : '\n'
}

/**
 * Read `[section] key` the way WSL does (first occurrence wins). `value` is
 * null when the key is not declared.
 */
export function getIniValue(text: string, section: string, key: string): IniGetResult {
  const invalid = validateNames(section, key)
  if (invalid) return failure(invalid)
  const file = parseFile(text)
  if ('ok' in file) return failure(file)
  const [first] = findKeyLines(file, section, key)
  if (first === undefined) return { ok: true, value: null, line: null }
  const line = file.parsed[first] as Extract<ParsedLine, { kind: 'key' }>
  if (line.value === null) {
    return { ok: false, reason: 'unparsable-line', message: `Line ${first + 1} has an unclosed quote.`, line: first + 1 }
  }
  return { ok: true, value: line.value, line: first + 1 }
}

/**
 * Set `[section] key=value`, changing only the line that holds it (or adding
 * one line, plus a header when the section is missing).
 *
 * Fails — caller must not write — when the names / value are not writable as
 * plain INI, or the file has a line this editor cannot classify (a broken
 * header, a line without `=`, an unclosed quote on the target, a `\`
 * continuation): editing around a line we do not understand could put the key
 * somewhere WSL does not read it.
 */
export function setIniValue(text: string, section: string, key: string, value: string): IniEditResult {
  const invalid = validateNames(section, key)
  if (invalid) return failure(invalid)
  if (!VALUE_PATTERN.test(value)) {
    return {
      ok: false,
      reason: 'invalid-value',
      message: 'Value must be non-empty, without surrounding spaces, quotes, `#`, `\\` or control characters.',
    }
  }
  const file = parseFile(text)
  if ('ok' in file) return failure(file)

  const keyLines = findKeyLines(file, section, key)
  const { lines, parsed } = file

  if (keyLines.length > 0) {
    const index = keyLines[0]
    const line = parsed[index] as Extract<ParsedLine, { kind: 'key' }>
    if (line.value === null) {
      return { ok: false, reason: 'unparsable-line', message: `Line ${index + 1} has an unclosed quote.`, line: index + 1 }
    }
    const duplicates = keyLines.slice(1).map((i) => i + 1)
    if (line.value === value) {
      return { ok: true, text, changed: false, action: 'unchanged', line: index + 1, ignoredDuplicateLines: duplicates }
    }
    const newValue = line.quoted ? `"${value}"` : value
    lines[index] = { content: line.prefix + newValue + line.tail, eol: lines[index].eol }
    return { ok: true, text: file.bom + joinLines(lines), changed: true, action: 'replaced', line: index + 1, ignoredDuplicateLines: duplicates }
  }

  const eol = preferredEol(lines)
  const endsWithEol = lines.length === 0 || lines[lines.length - 1].eol !== ''
  const sectionLower = section.toLowerCase()
  const headerIndex = parsed.findIndex((line, i) => line.kind === 'section' && file.sectionOf[i] === sectionLower)

  if (headerIndex !== -1) {
    // After the last key of the section's first block; right after the header if it has none.
    let insertAfter = headerIndex
    for (let i = headerIndex + 1; i < parsed.length; i++) {
      const line = parsed[i]
      if (line.kind === 'section') break
      if (line.kind === 'key') insertAfter = i
    }
    const anchor = parsed[insertAfter]
    const indent = anchor.kind === 'key' ? (lines[insertAfter].content.match(/^[ \t]*/)?.[0] ?? '') : ''
    const newLine: RawLine = { content: `${indent}${key}=${value}`, eol: lines[insertAfter].eol }
    if (lines[insertAfter].eol === '') {
      // Inserting after the file's last line, which has no line ending.
      lines[insertAfter] = { ...lines[insertAfter], eol }
    }
    lines.splice(insertAfter + 1, 0, newLine)
    return { ok: true, text: file.bom + joinLines(lines), changed: true, action: 'added-key', line: insertAfter + 2, ignoredDuplicateLines: [] }
  }

  // Missing section: append at the end of the file, separated by a blank line.
  if (lines.length > 0 && lines[lines.length - 1].eol === '') {
    lines[lines.length - 1] = { ...lines[lines.length - 1], eol }
  }
  if (lines.length > 0 && parsed[parsed.length - 1].kind !== 'blank') {
    lines.push({ content: '', eol })
  }
  lines.push({ content: `[${section}]`, eol })
  lines.push({ content: `${key}=${value}`, eol: endsWithEol ? eol : '' })
  return { ok: true, text: file.bom + joinLines(lines), changed: true, action: 'added-section', line: lines.length, ignoredDuplicateLines: [] }
}

function looksLikeUtf16le(buffer: Buffer): boolean {
  if (buffer.length < 2 || buffer.length % 2 !== 0) return false
  const sample = Math.min(buffer.length, 512)
  let oddZeros = 0
  let evenZeros = 0
  for (let i = 0; i < sample; i++) {
    if (buffer[i] === 0) {
      if (i % 2 === 1) oddZeros++
      else evenZeros++
    }
  }
  // ASCII-heavy INI text in UTF-16 LE: the high byte of most code units is 0.
  return evenZeros === 0 && oddZeros * 2 >= sample / 2
}

function swapBytes(buffer: Buffer): Buffer {
  const out = Buffer.alloc(buffer.length)
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    out[i] = buffer[i + 1]
    out[i + 1] = buffer[i]
  }
  return out
}

/**
 * Decode file bytes and report the encoding to write back with. The returned
 * text never carries the BOM (it is part of `encoding`). Invalid UTF-8 / an
 * odd-length UTF-16 file fails: the caller must not write.
 */
export function decodeIniBuffer(buffer: Buffer): IniDecodeResult {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return decodeUtf8(buffer.subarray(3), 'utf8-bom')
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return decodeUtf16(buffer.subarray(2), 'utf16le-bom', false)
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return decodeUtf16(buffer.subarray(2), 'utf16be-bom', true)
  }
  if (looksLikeUtf16le(buffer)) {
    return decodeUtf16(buffer, 'utf16le', false)
  }
  return decodeUtf8(buffer, 'utf8')
}

function decodeUtf8(bytes: Buffer, encoding: IniEncoding): IniDecodeResult {
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding }
  } catch {
    return { ok: false, reason: 'invalid-encoding', message: 'File is not valid UTF-8.' }
  }
}

function decodeUtf16(bytes: Buffer, encoding: IniEncoding, bigEndian: boolean): IniDecodeResult {
  if (bytes.length % 2 !== 0) {
    return { ok: false, reason: 'invalid-encoding', message: 'UTF-16 file has an odd number of bytes.' }
  }
  try {
    const le = bigEndian ? swapBytes(bytes) : bytes
    return { ok: true, text: new TextDecoder('utf-16le', { fatal: true }).decode(le), encoding }
  } catch {
    return { ok: false, reason: 'invalid-encoding', message: 'File is not valid UTF-16.' }
  }
}

/** Encode text (without BOM) back to the encoding `decodeIniBuffer` reported. */
export function encodeIniText(text: string, encoding: IniEncoding): Buffer {
  const body = text.startsWith('\uFEFF') ? text.slice(1) : text
  switch (encoding) {
    case 'utf8':
      return Buffer.from(body, 'utf8')
    case 'utf8-bom':
      return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(body, 'utf8')])
    case 'utf16le':
      return Buffer.from(body, 'utf16le')
    case 'utf16le-bom':
      return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(body, 'utf16le')])
    case 'utf16be-bom':
      return Buffer.concat([Buffer.from([0xfe, 0xff]), swapBytes(Buffer.from(body, 'utf16le'))])
  }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

/**
 * `YYYYMMDD-HHMMSS` from a caller-supplied time, in the time zone of the Date's
 * local fields (the caller's system time). This module never reads the clock.
 */
export function formatIniBackupStamp(at: Date): string {
  if (Number.isNaN(at.getTime())) throw new Error('Invalid backup time.')
  return (
    `${pad(at.getFullYear(), 4)}${pad(at.getMonth() + 1, 2)}${pad(at.getDate(), 2)}-` +
    `${pad(at.getHours(), 2)}${pad(at.getMinutes(), 2)}${pad(at.getSeconds(), 2)}`
  )
}

/**
 * Backup path rule: `<original path>.bat-backup-<YYYYMMDD-HHMMSS>`, next to the
 * original (works for both `C:\Users\<u>\.wslconfig` and `/etc/wsl.conf`).
 * `at` is a Date or an already formatted stamp. Two backups in the same second
 * get the same name: the caller decides whether to refuse or overwrite.
 */
export function iniBackupPath(originalPath: string, at: Date | string): string {
  if (!originalPath || /[\\/]$/.test(originalPath) || /[\0\r\n]/.test(originalPath)) {
    throw new Error('Backup needs the path of a file.')
  }
  const stamp = typeof at === 'string' ? at : formatIniBackupStamp(at)
  if (!BACKUP_STAMP_PATTERN.test(stamp)) throw new Error('Backup stamp must be YYYYMMDD-HHMMSS.')
  return `${originalPath}.bat-backup-${stamp}`
}
