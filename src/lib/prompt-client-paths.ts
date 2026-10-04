/**
 * T0440 (BUG-105, T0421 strategy C): client-form paths the user typed or pasted into a
 * Claude prompt of a remote window (`C:\…`, `\\wsl.localhost\…`, `\\wsl$\…`). They are only
 * pointed out, never rewritten — the prompt is sent exactly as typed (T0421: rewriting
 * free text mistranslates code samples, docs, `cmd.exe` / `wslpath` arguments, ...).
 *
 * Not reported: anything inside fenced code blocks, inline code or URLs.
 */
import type { ResolvedClientPath } from './client-paths'

/** Characters that end an unquoted path (whitespace, quotes, shell / markdown delimiters, CJK punctuation). */
const PATH_BODY = String.raw`[^\s"'\`<>|*?，。、；：！？「」『』（）【】]*`
const PATH_START = String.raw`(?:[A-Za-z]:\\|\\\\wsl(?:\.localhost|\$)\\)`

/** `"C:\Program Files\x"` keeps its spaces; otherwise the path ends at the first delimiter. */
const QUOTED_PATH = new RegExp(String.raw`(["'])(${PATH_START}[^"'\n]*)\1`, 'gi')
/** A drive letter must not continue a word (`abc:\`, `foo\C:\`). */
const UNQUOTED_PATH = new RegExp(String.raw`(?<![A-Za-z0-9_\\/])${PATH_START}${PATH_BODY}`, 'gi')

const FENCED_CODE = /(^|\n)[ \t]*(```|~~~)[\s\S]*?(?:\n[ \t]*\2[^\n]*(?=\n|$)|$)/g
const INLINE_CODE = /(`+)[^\n]*?\1/g
const URL = /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+/g

/** Trailing sentence punctuation is not part of the path (`see C:\a.txt.`). */
const TRAILING_PUNCTUATION = /[.,;:!)\]}]+$/

function blank(match: string): string {
  return match.replace(/[^\n]/g, ' ')
}

/** Text with code and URLs blanked out (same length, so nothing can join across a gap). */
export function stripNonProse(text: string): string {
  return text
    .replace(FENCED_CODE, blank)
    .replace(INLINE_CODE, blank)
    .replace(URL, blank)
}

/** Client-form paths in `text`, in order of appearance, without duplicates. */
export function findClientPathsInPrompt(text: string): string[] {
  if (!text) return []
  let prose = stripNonProse(text)
  const found: Array<{ index: number; path: string }> = []

  prose = prose.replace(QUOTED_PATH, (match, _quote: string, path: string, offset: number) => {
    found.push({ index: offset, path })
    return blank(match)
  })
  for (const m of prose.matchAll(UNQUOTED_PATH)) {
    const path = m[0].replace(TRAILING_PUNCTUATION, '')
    if (path) found.push({ index: m.index ?? 0, path })
  }

  const seen = new Set<string>()
  return found
    .sort((a, b) => a.index - b.index)
    .map(f => f.path)
    .filter(p => !seen.has(p) && seen.add(p))
}

export interface PromptPathHintItem {
  /** The path as typed. */
  path: string
  /** Where the remote host has it (`remote:resolve-client-paths`), null when unknown / unreachable. */
  serverPath: string | null
}

/** Pairs each path with its answer; a missing or mismatched answer gives no suggestion. */
export function pairPathSuggestions(paths: readonly string[], results: unknown): PromptPathHintItem[] {
  const answers = Array.isArray(results) ? results as Array<Partial<ResolvedClientPath> | null | undefined> : []
  return paths.map((path, i) => {
    const answer = answers[i]
    const serverPath = answer && answer.input === path && answer.reachable === true
      && typeof answer.serverPath === 'string' && answer.serverPath && answer.serverPath !== path
      ? answer.serverPath
      : null
    return { path, serverPath }
  })
}

/** Suggestions for the hint; an IPC failure only loses the suggestions, never the hint. */
export async function resolvePromptPathSuggestions(paths: readonly string[]): Promise<PromptPathHintItem[]> {
  let results: unknown = null
  try {
    results = await window.electronAPI.remote.resolveClientPaths([...paths], 'local-file')
  } catch (err) {
    window.electronAPI.debug?.log?.('[prompt-path-hint] remote:resolve-client-paths failed:', err instanceof Error ? err.message : String(err))
  }
  return pairPathSuggestions(paths, results)
}
