// T0441 / BUG-109 — the `/snippet` context prompt sent to the agent.
//
// Snippets live in BAT's in-memory store (electron/snippet-db.ts, persisted to userData/snippets.json
// and loaded once at startup). The old prompt pointed the agent at a hard-coded macOS path and told it
// to edit that JSON file, which was wrong on every platform: the path only exists on macOS, BAT never
// reloads the file (an agent's edit is invisible until restart and overwritten by BAT's next save),
// and in a remote-profile window the agent runs on the remote host while `snippet:*` stays local
// (T0422 ALWAYS_LOCAL). So the prompt carries the snippets themselves, read-only, and never a path:
// the agent drafts changes and the user applies them in BAT's Snippets panel.

export interface SnippetForContext {
  id: number
  title: string
  content?: string
  format?: string
  category?: string
  tags?: string
  workspaceId?: string
  isFavorite?: boolean
}

/** Per-snippet content cap; longer content is cut and marked. */
export const SNIPPET_CONTENT_MAX_CHARS = 2000
/** Content budget for the whole prompt; snippets past it are listed by title only. */
export const SNIPPET_CONTEXT_MAX_CONTENT_CHARS = 20000

/** A backtick fence longer than any backtick run inside `content`. */
function fenceFor(content: string): string {
  const longest = Math.max(0, ...(content.match(/`+/g) ?? []).map(run => run.length))
  return '`'.repeat(Math.max(3, longest + 1))
}

function snippetHeader(s: SnippetForContext): string {
  const meta = [
    s.format,
    s.workspaceId ? 'workspace' : 'global',
    s.isFavorite ? 'favorite' : '',
    s.category ? `category: ${s.category}` : '',
    s.tags ? `tags: ${s.tags}` : '',
  ].filter(Boolean).join(', ')
  return `- [${s.id}] ${s.title} (${meta})`
}

export function buildSnippetContextPrompt(opts: {
  snippets: readonly SnippetForContext[]
  query?: string
  workspaceId?: string
}): string {
  const { snippets, query, workspaceId } = opts
  let budget = SNIPPET_CONTEXT_MAX_CONTENT_CHARS
  let omitted = 0
  const entries = snippets.map((s) => {
    const header = snippetHeader(s)
    const content = s.content ?? ''
    if (!content) return header
    if (budget <= 0) {
      omitted++
      return header
    }
    const limit = Math.min(SNIPPET_CONTENT_MAX_CHARS, budget)
    const shown = content.length > limit ? content.slice(0, limit) : content
    budget -= shown.length
    const truncated = shown.length < content.length ? `\n  (truncated: ${content.length} chars total)` : ''
    const fence = fenceFor(shown)
    return `${header}\n${fence}\n${shown}\n${fence}${truncated}`
  })

  return [
    `[BAT Snippets Context]`,
    `Snippets are stored and managed by BAT (Better Agent Terminal) on the user's own machine, which may not be where you run.`,
    `You have no access to the snippet storage: do not look for, read, or edit any snippets file or database.`,
    workspaceId ? `Current workspaceId: "${workspaceId}"` : '',
    ``,
    `${snippets.length} snippet(s)${query ? ` matching "${query}"` : ''}:`,
    entries.length === 0 ? 'No snippets exist yet.' : entries.join('\n'),
    omitted > 0 ? `(content of ${omitted} more snippet(s) omitted for length; ask the user to paste any you need)` : '',
    ``,
    `To create, update, or delete a snippet, give the user the exact change (title, content, format "plaintext"|"markdown", optional category / tags, and whether it is scoped to the current workspace or global); the user applies it in BAT's Snippets panel.`,
    query ? '' : `How would you like to work with your snippets?`,
  ].filter(Boolean).join('\n')
}
