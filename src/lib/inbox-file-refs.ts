/**
 * T0930: file references in the「待辦」(Inbox) tab — which pieces of an item's text (and of its
 * `workorder` / `ref` tag) name a file, and where that file may be. Pure: no DOM, no electron, no fs.
 *
 * Recognized (docs/agent-guide/tower-inbox.md「參考檔案連結」):
 *   - CT ids: `T####` (with the work order prefix, `LB-T0184`), `BUG-###`, `PLAN-###`, `EXP-<TOPIC>-###`
 *     → a file named `<ID>-….md` (or `<ID>.md`) in `_ct-workorders/`, then in its `_archive/` folder;
 *     `D###` → `_ct-workorders/_decision-log.md` (the file only, not the entry)
 *   - paths: a piece with `/` or `\` whose last segment has an extension, inside backticks or bare in
 *     the sentence; a `:line[:col]` suffix is ignored when resolving. Relative paths are tried against
 *     the workspace root, then `_ct-workorders/`; an absolute path only when it is under the root.
 *   - file names (T0935): a piece without `/` or `\` ending in an extension of 1–8 letters / digits with
 *     at least one letter (`_reply-2026-11-26-topic.md`, `package.json`; not `0.8.0`, `v1.2`), inside
 *     backticks or bare in the sentence. Same `kind: 'path'` reference, so it is tried against the
 *     workspace root, then `_ct-workorders/`, and links only when the file exists (a domain name such
 *     as `example.org` therefore stays text unless a file of that name is there).
 *   - never: URLs (any `scheme:`), UNC (`\\host\…`, `//host/…`), `~`, any `..` segment, a path outside
 *     the workspace root.
 *
 * Whether a candidate exists is decided by the caller (`src/components/inbox/useInboxFileRefs.ts`,
 * read-only `fs:stat` / `fs:readdir`); an unresolved reference stays plain text.
 */

export type CtIdKind = 'workorder' | 'bug' | 'plan' | 'exp' | 'decision'

export type FileRef =
  | { kind: 'id'; id: string; idKind: CtIdKind }
  /** `path`: as written, `\` turned into `/`, a `:line[:col]` suffix removed. */
  | { kind: 'path'; path: string }

export type TextPart =
  | { kind: 'text'; text: string }
  | { kind: 'ref'; text: string; ref: FileRef }

/** One place a reference's file may be, in the order to try. */
export type RefLookup =
  /** The file at `abs` (`rel` = the same path relative to the workspace root). */
  | { kind: 'stat'; abs: string; rel: string }
  /** A file in folder `dir` (`relDir` relative to the root) whose name starts with `<id>-` or is `<id>.md`. */
  | { kind: 'dir'; dir: string; relDir: string; id: string }

/** A resolved reference: the file to open and its path relative to the workspace root. */
export interface ResolvedRef { abs: string; rel: string }

/** Upper bound of distinct references one list checks (T0930: no unbounded fs calls). */
export const INBOX_FILE_REF_MAX = 40

export const CT_DIR = '_ct-workorders'
export const DECISION_LOG = '_decision-log.md'

const ARCHIVE_DIR: Record<Exclude<CtIdKind, 'decision'>, string> = {
  workorder: '_archive/workorders',
  bug: '_archive/bugs',
  plan: '_archive/plans',
  // EXP records are archived with the work orders (observed layout)
  exp: '_archive/workorders',
}

const ID_SOURCES: Array<[CtIdKind, string]> = [
  ['bug', String.raw`BUG-\d{3,}`],
  ['plan', String.raw`PLAN-\d{3,}`],
  ['exp', String.raw`EXP-[A-Z0-9]+-\d{3,}`],
  ['workorder', String.raw`(?:[A-Z]{2,4}-)?T\d{4,}`],
  ['decision', String.raw`D\d{3,}`],
]

const EXACT_ID = ID_SOURCES.map(([kind, source]) => [kind, new RegExp(`^${source}$`)] as const)

/** `value` (trimmed) is exactly a CT id → its kind; otherwise null (local rule numbers, free text…). */
export function parseCtId(value: string): { id: string; idKind: CtIdKind } | null {
  const id = value.trim()
  for (const [idKind, re] of EXACT_ID) if (re.test(id)) return { id, idKind }
  return null
}

const LINE_SUFFIX = /:\d+(?::\d+)?$/
const EXTENSION = /\.[A-Za-z0-9]{1,10}$/

/** A path as written: `/` or `\` in it and an extension on its last segment (after a `:line` suffix). */
function asPath(raw: string): string | null {
  if (!raw || /\s/.test(raw)) return null
  if (!/[\\/]/.test(raw)) return null
  const path = raw.replace(/\\/g, '/').replace(LINE_SUFFIX, '')
  const last = path.split('/').pop() ?? ''
  // a dot file without a second dot (`.gitignore`) has no extension
  if (!EXTENSION.test(last) || (last.startsWith('.') && last.indexOf('.', 1) < 0)) return null
  return path
}

/** T0935: a file name's extension — 1–8 letters / digits, at least one letter (`0.8.0`, `v1.2` have none). */
const NAME_EXTENSION = /\.(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{1,8}$/

/**
 * T0935: a file name as written — no `/` or `\`, an extension (`NAME_EXTENSION`). Bare in a sentence
 * only ASCII word characters, `.` and `-` (starting with a word character, `_` included); inside
 * backticks (`loose`) any characters a file name may have, not starting with `.`, `-` or `~`.
 */
function asName(raw: string, loose = false): string | null {
  if (!raw || /[\s\\/:*?"<>|]/.test(raw)) return null
  if (!(loose ? /^[^.\-~]/ : /^\w[\w.\-]*$/).test(raw)) return null
  return NAME_EXTENSION.test(raw) ? raw : null
}

/** A backtick span's content that is one reference as a whole. */
function wholeRef(content: string): FileRef | null {
  const id = parseCtId(content)
  if (id) return { kind: 'id', ...id }
  if (URL_START.test(content.trim())) return null
  const path = asPath(content.trim()) ?? asName(content.trim(), true)
  return path ? { kind: 'path', path } : null
}

const URL_START = /^[A-Za-z][A-Za-z0-9+.-]+:/
const URL_SOURCE = String.raw`[A-Za-z][A-Za-z0-9+.\-]+:\/\/[^\s\`]*`
const PATH_SOURCE = String.raw`(?:[A-Za-z]:)?[\w.\-@~]*(?:[\/\\][\w.\-@~]+)+`
const ID_SOURCE = ID_SOURCES.map(([, source]) => source).join('|')
/**
 * T0935: a word with a dot, for a file name; tried after the id so `T0275-x.md` stays the id it was.
 * Not followed by `:` `@` `~` either (`README.md:12` is not a name); `.` / `-` at its end are cut off
 * as sentence punctuation in `splitBare`.
 */
const NAME_SOURCE = String.raw`\w[\w\-]*\.[\w.\-]*(?![:@~])`
/** Bare text: a URL (kept as text), a path, an id or a file name; boundaries are ASCII word / path characters only. */
const BARE = new RegExp(
  String.raw`(?<![\w.\-\/\\:@~])(?:(${URL_SOURCE})|(${PATH_SOURCE})|(${ID_SOURCE})|(${NAME_SOURCE}))(?![\w\/\\])`,
  'g',
)

function pushText(parts: TextPart[], text: string): void {
  if (!text) return
  const last = parts[parts.length - 1]
  if (last?.kind === 'text') last.text += text
  else parts.push({ kind: 'text', text })
}

function splitBare(text: string, parts: TextPart[]): void {
  let at = 0
  BARE.lastIndex = 0
  for (let m = BARE.exec(text); m; m = BARE.exec(text)) {
    const start = m.index
    let piece = m[0]
    let ref: FileRef | null = null
    if (m[2] !== undefined) {
      // a sentence's own punctuation after a path (`docs/a.md.`) is not part of it
      piece = piece.replace(/[.\-]+$/, '')
      const path = asPath(piece)
      if (path) ref = { kind: 'path', path }
      // `C:` alone etc.: nothing to link
    } else if (m[3] !== undefined) {
      const id = parseCtId(piece)
      if (id) ref = { kind: 'id', ...id }
    } else if (m[4] !== undefined) {
      piece = piece.replace(/[.\-]+$/, '')
      const name = asName(piece)
      if (name) ref = { kind: 'path', path: name }
    }
    if (!ref) continue
    pushText(parts, text.slice(at, start))
    parts.push({ kind: 'ref', text: piece, ref })
    at = start + piece.length
    BARE.lastIndex = Math.max(BARE.lastIndex, at)
  }
  pushText(parts, text.slice(at))
}

/**
 * `text` as text and reference parts, concatenating back to `text` exactly (the summary is never
 * changed). Backtick spans that are one reference link their content; the backticks stay text.
 */
export function splitFileRefs(text: string): TextPart[] {
  const parts: TextPart[] = []
  if (!text) return parts
  const ticks = /`([^`\n]+)`/g
  let at = 0
  for (let m = ticks.exec(text); m; m = ticks.exec(text)) {
    const ref = wholeRef(m[1])
    if (!ref) continue
    splitBare(text.slice(at, m.index), parts)
    pushText(parts, '`')
    parts.push({ kind: 'ref', text: m[1], ref })
    pushText(parts, '`')
    at = m.index + m[0].length
  }
  splitBare(text.slice(at), parts)
  return parts
}

/** A stable key per reference (for caching and deduplication). */
export function fileRefKey(ref: FileRef): string {
  return ref.kind === 'id' ? `id:${ref.id}` : `path:${ref.path}`
}

/** The references of the parts (in order, without duplicates). */
export function fileRefsOf(parts: readonly TextPart[]): FileRef[] {
  const seen = new Set<string>()
  const refs: FileRef[] = []
  for (const part of parts) {
    if (part.kind !== 'ref') continue
    const key = fileRefKey(part.ref)
    if (seen.has(key)) continue
    seen.add(key)
    refs.push(part.ref)
  }
  return refs
}

function trimRoot(root: string): string {
  return root.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** `root` + `/` + `rel` (the root keeps its own spelling, as the Control Tower panel's paths do). */
export function joinRoot(root: string, rel: string): string {
  return `${root.replace(/[\\/]+$/, '')}/${rel}`
}

/**
 * Root-relative candidates for a written path, in order; null when it must never be linked (URL,
 * UNC, `~`, `..`, outside the root, no root).
 */
export function resolveRefPath(root: string | null | undefined, written: string): string[] | null {
  if (!root) return null
  const path = written.replace(/\\/g, '/').replace(LINE_SUFFIX, '')
  if (!path || path.startsWith('//') || path.startsWith('~')) return null
  const drive = /^[A-Za-z]:\//.test(path)
  if (!drive && URL_START.test(path)) return null
  const segments = path.split('/')
  if (segments.some(segment => segment === '..')) return null
  const clean = (list: string[]) => list.filter(segment => segment !== '' && segment !== '.').join('/')
  if (drive || path.startsWith('/')) {
    const base = trimRoot(root)
    if (!base) return null
    const caseless = /^[A-Za-z]:/.test(base)
    const norm = (value: string) => (caseless ? value.toLowerCase() : value)
    if (!norm(path).startsWith(`${norm(base)}/`)) return null
    const rel = clean(path.slice(base.length + 1).split('/'))
    return rel ? [rel] : null
  }
  if (/^[A-Za-z]:/.test(path)) return null // drive-relative (`C:foo`)
  const rel = clean(segments)
  if (!rel) return null
  return rel.startsWith(`${CT_DIR}/`) ? [rel] : [rel, `${CT_DIR}/${rel}`]
}

/** Where `ref`'s file may be, in order; empty when it can never be linked. */
export function refLookups(root: string | null | undefined, ref: FileRef): RefLookup[] {
  if (!root) return []
  if (ref.kind === 'path') {
    return (resolveRefPath(root, ref.path) ?? []).map(rel => ({ kind: 'stat', abs: joinRoot(root, rel), rel }))
  }
  if (ref.idKind === 'decision') {
    const rel = `${CT_DIR}/${DECISION_LOG}`
    return [{ kind: 'stat', abs: joinRoot(root, rel), rel }]
  }
  return [CT_DIR, `${CT_DIR}/${ARCHIVE_DIR[ref.idKind]}`].map(relDir => ({
    kind: 'dir',
    dir: joinRoot(root, relDir),
    relDir,
    id: ref.id,
  }))
}

/** The file of `id` among a folder's file names: `<id>.md` or `<id>-….md` (first by name). */
export function matchIdFile(id: string, names: readonly string[]): string | null {
  const hits = names.filter(name => name.endsWith('.md') && (name === `${id}.md` || name.startsWith(`${id}-`)))
  if (hits.length === 0) return null
  return [...hits].sort()[0]
}
