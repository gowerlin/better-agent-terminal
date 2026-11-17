/**
 * T0879 / D300: BAT does not ship elkjs (T0878 / D299), so a mermaid diagram that asks for the
 * ELK layout would render mermaid's generic error diagram. Before rendering, rewrite the ELK
 * layout to `dagre` and tell the caller so it can show a note next to the diagram.
 *
 * Only the text handed to mermaid changes; the user's file and the editor are never touched.
 *
 * Recognized ways to pick the layout (mermaid 12.3.0, see docs/agent-guide/build-toolchain.md):
 * 1. front matter `config.layout` (block mapping, `---` fences at column 0)
 * 2. `%%{init: {...}}%%` / `%%{initialize: {...}}%%` directive with a top-level `layout` key
 *    (directives override front matter, later directives override earlier ones)
 * The value counts as ELK when it is `elk` or `elk.<name>`.
 *
 * Not handled on purpose: `flowchart-elk` (renders with dagre under BAT's `initialize`, T0878),
 * a top-level front matter `layout:` (mermaid 12.3.0 ignores it, the diagram already uses dagre),
 * flow-style YAML (`config: {layout: elk}`). Anything that is not recognized for certain keeps the
 * original text, which is the T0878 behavior.
 *
 * Pure: no DOM, no mermaid import.
 */

export interface MermaidElkFallbackResult {
  text: string
  usedElk: boolean
}

export const MERMAID_ELK_FALLBACK_LAYOUT = 'dagre'

const ELK_LAYOUT = /^elk(?:\.[A-Za-z][A-Za-z0-9]*)?$/
// Same pattern as mermaid's `directiveRegex` (src/diagram-api/regexes.ts, mermaid 12.3.0).
const DIRECTIVE_SOURCE = String.raw`%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?`
const FENCE = /^---[ \t]*$/
const BLANK = /^[ \t]*$/
const COMMENT = /^[ \t]*#/
// `key:` at the start of a YAML block-mapping line (after the indentation), plain or quoted key.
const YAML_KEY = /^(?:"([^"\\]*)"|'([^']*)'|([^\s#'"{}[\],:&*!|>%@`?-][^:#]*?|-[^\s:#][^:#]*?))[ \t]*:(?:[ \t]+(.*))?$/
// A scalar layout value: plain or quoted, optionally followed by a comment.
const YAML_SCALAR = /^(?:"([^"\\]*)"|'([^']*)'|([^\s#'"{}[\],&*!|>%@`][^#]*?))(?:[ \t]+#.*)?[ \t]*$/

export function isElkLayout(value: unknown): boolean {
  return typeof value === 'string' && ELK_LAYOUT.test(value)
}

interface Replacement {
  start: number
  end: number
}

type LayoutSource =
  | { kind: 'none' }
  | { kind: 'unknown' }
  | { kind: 'value'; value: string; elkSpans: Replacement[] }

interface FrontMatterInfo {
  layout: LayoutSource
  // Offset of the text after the closing fence line (where mermaid starts looking for directives).
  bodyEnd: number
}

interface Line {
  text: string
  start: number
}

function splitLines(text: string): Line[] {
  const lines: Line[] = []
  const re = /\r\n|\r|\n/g
  let start = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    lines.push({ text: text.slice(start, m.index), start })
    start = m.index + m[0].length
  }
  lines.push({ text: text.slice(start), start })
  return lines
}

function leadingSpaces(line: string): number {
  let i = 0
  while (i < line.length && line[i] === ' ') i++
  return i
}

/** `config.layout` in the front matter, when the front matter is one mermaid reads. */
function readFrontMatter(text: string): FrontMatterInfo | null {
  const lines = splitLines(text)
  let open = 0
  while (open < lines.length && BLANK.test(lines[open].text)) open++
  if (open >= lines.length || !FENCE.test(lines[open].text)) return null
  // mermaid needs at least one line between the fences and a line break after the closing one.
  let close = -1
  for (let k = open + 2; k < lines.length - 1; k++) {
    if (FENCE.test(lines[k].text)) {
      close = k
      break
    }
  }
  if (close === -1) return null
  const bodyEnd = lines[close + 1].start
  return { layout: readConfigLayout(lines.slice(open + 1, close)), bodyEnd }
}

function readConfigLayout(body: Line[]): LayoutSource {
  let configIndex = -1
  for (let i = 0; i < body.length; i++) {
    const line = body[i].text
    if (BLANK.test(line) || COMMENT.test(line)) continue
    if (line[0] === ' ' || line[0] === '\t') continue // inside some top-level value
    const key = YAML_KEY.exec(line)
    if (!key) return { kind: 'unknown' }
    const name = key[1] ?? key[2] ?? key[3]
    if (name !== 'config') continue
    if (configIndex !== -1) return { kind: 'unknown' } // duplicate key: js-yaml throws
    const rest = key[4] ?? ''
    if (rest !== '' && !rest.startsWith('#')) return { kind: 'unknown' } // flow style or scalar
    configIndex = i
  }
  if (configIndex === -1) return { kind: 'none' }

  let childIndent = -1
  let found: LayoutSource = { kind: 'none' }
  for (let i = configIndex + 1; i < body.length; i++) {
    const line = body[i].text
    if (BLANK.test(line) || COMMENT.test(line)) continue
    if (line[0] !== ' ' && line[0] !== '\t') break // next top-level key
    const indent = leadingSpaces(line)
    if (line[indent] === '\t') return { kind: 'unknown' }
    if (childIndent === -1) childIndent = indent
    if (indent < childIndent) return { kind: 'unknown' }
    if (indent > childIndent) continue // nested under another config key
    const key = YAML_KEY.exec(line.slice(indent))
    if (!key) return { kind: 'unknown' }
    const name = key[1] ?? key[2] ?? key[3]
    if (name !== 'layout') continue
    if (found.kind !== 'none') return { kind: 'unknown' } // duplicate key
    const rawValue = key[4] ?? ''
    const scalar = YAML_SCALAR.exec(rawValue)
    if (!scalar) return { kind: 'unknown' }
    const value = scalar[1] ?? scalar[2] ?? scalar[3]
    const elkSpans: Replacement[] = []
    if (isElkLayout(value)) {
      const quoted = scalar[3] === undefined
      const valueOffset = line.length - rawValue.length + (quoted ? 1 : 0)
      const start = body[i].start + valueOffset
      elkSpans.push({ start, end: start + value.length })
    }
    found = { kind: 'value', value, elkSpans }
  }
  return found
}

interface DirectiveLayout {
  value: unknown
  elkSpans: Replacement[]
}

/**
 * Top-level `layout` of each init/initialize directive, in order. `null` when the directives
 * cannot be read the way mermaid reads them.
 */
function readDirectives(text: string, offset: number): DirectiveLayout[] | null {
  // mermaid normalizes line breaks to `\n` first; keep offsets by replacing with same-length text.
  const source = text.slice(offset).replace(/\r\n/g, ' \n').replace(/\r/g, '\n')
  const re = new RegExp(DIRECTIVE_SOURCE, 'gi')
  const result: DirectiveLayout[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++
    const type = m[1] ?? m[2]
    if (!type || !/(?:init\b)|(?:initialize\b)/.test(type)) continue
    if (type !== 'init' && type !== 'initialize') return null
    if (m[4] === undefined) return null
    const body = m[4]
    let parsed: unknown
    try {
      parsed = JSON.parse(body.trim().replace(/'/g, '"'))
    } catch {
      return null
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    if (!Object.prototype.hasOwnProperty.call(parsed, 'layout')) continue
    const value = (parsed as Record<string, unknown>).layout
    const bodyStart = offset + m.index + m[0].indexOf(body)
    const elkSpans = isElkLayout(value) ? findLayoutValueSpans(body, bodyStart) : []
    if (isElkLayout(value) && elkSpans.length === 0) return null
    result.push({ value, elkSpans })
  }
  return result
}

/** Spans of the string values of top-level `layout` keys in a JSON object body (`'` or `"`). */
function findLayoutValueSpans(body: string, bodyStart: number): Replacement[] {
  const spans: Replacement[] = []
  let depth = 0
  let expectKey = false
  let lastKey: string | null = null
  let afterColon = false
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch === '"' || ch === "'") {
      // mermaid turns every `'` into `"`, so either quote ends the string.
      let j = i + 1
      while (j < body.length && body[j] !== '"' && body[j] !== "'") {
        j += body[j] === '\\' ? 2 : 1
      }
      const content = body.slice(i + 1, j)
      if (depth === 1) {
        if (expectKey) {
          lastKey = content
          expectKey = false
        } else if (afterColon && lastKey === 'layout' && isElkLayout(content)) {
          spans.push({ start: bodyStart + i + 1, end: bodyStart + j })
        }
      }
      afterColon = false
      i = j + 1
      continue
    }
    if (ch === '{' || ch === '[') {
      depth++
      expectKey = depth === 1 && ch === '{'
      afterColon = false
    } else if (ch === '}' || ch === ']') {
      depth--
      afterColon = false
    } else if (ch === ',' && depth === 1) {
      expectKey = true
      afterColon = false
    } else if (ch === ':' && depth === 1) {
      afterColon = true
    } else if (!/\s/.test(ch)) {
      afterColon = false
    }
    i++
  }
  return spans
}

interface Analysis {
  usedElk: boolean
  spans: Replacement[]
  effective: unknown
}

function analyze(text: string): Analysis | null {
  const frontMatter = readFrontMatter(text)
  const directives = readDirectives(text, frontMatter?.bodyEnd ?? 0)
  if (directives === null) return null
  const fm = frontMatter?.layout ?? { kind: 'none' as const }

  const fromDirectives = directives.length > 0 ? directives[directives.length - 1].value : undefined
  let effective: unknown
  if (fromDirectives !== undefined) {
    effective = fromDirectives
  } else if (fm.kind === 'value') {
    effective = fm.value
  } else if (fm.kind === 'unknown') {
    return null
  }

  const spans: Replacement[] = []
  if (fm.kind === 'value') spans.push(...fm.elkSpans)
  for (const d of directives) spans.push(...d.elkSpans)
  return { usedElk: isElkLayout(effective), spans, effective }
}

/**
 * Rewrite an ELK layout request to `dagre`. When nothing is recognized for certain the text is
 * returned unchanged with `usedElk: false`.
 */
export function applyMermaidElkFallback(text: string): MermaidElkFallbackResult {
  const unchanged = { text, usedElk: false }
  const analysis = analyze(text)
  if (!analysis || !analysis.usedElk || analysis.spans.length === 0) return unchanged

  const spans = [...analysis.spans].sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const span of spans) {
    if (span.start < cursor) return unchanged
    out += text.slice(cursor, span.start) + MERMAID_ELK_FALLBACK_LAYOUT
    cursor = span.end
  }
  out += text.slice(cursor)

  // Safety net: the rewritten text must read as dagre and contain no ELK request.
  const check = analyze(out)
  if (!check || check.usedElk || check.spans.length > 0 || check.effective !== MERMAID_ELK_FALLBACK_LAYOUT) {
    return unchanged
  }
  return { text: out, usedElk: true }
}
