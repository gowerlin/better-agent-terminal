/**
 * T0441 / BUG-109: the `/snippet` context prompt carries the snippets themselves and never a
 * storage path or "edit the file" instruction (macOS path was hard-coded; BAT never reloads the file;
 * remote agents cannot reach the local store).
 */
import { describe, expect, test } from 'vitest'
import {
  SNIPPET_CONTENT_MAX_CHARS,
  SNIPPET_CONTEXT_MAX_CONTENT_CHARS,
  buildSnippetContextPrompt,
  type SnippetForContext,
} from '../snippet-context'

const sample: SnippetForContext[] = [
  { id: 1, title: 'Deploy', content: 'npm run deploy', format: 'plaintext', isFavorite: true, workspaceId: 'ws-1' },
  { id: 2, title: 'Notes', content: '# Heading\nbody', format: 'markdown', category: 'docs', tags: 'a,b' },
]

function noStoragePath(prompt: string) {
  expect(prompt).not.toMatch(/~\/Library/)
  expect(prompt).not.toMatch(/Application Support/)
  expect(prompt).not.toMatch(/snippets\.json/)
  expect(prompt).not.toMatch(/AppData|\.config/)
  expect(prompt).not.toMatch(/Write\/Edit tool|Use Read tool/)
}

describe('buildSnippetContextPrompt', () => {
  test('lists snippets with their content and metadata, and no storage path', () => {
    const prompt = buildSnippetContextPrompt({ snippets: sample, workspaceId: 'ws-1' })
    noStoragePath(prompt)
    expect(prompt).toContain('[BAT Snippets Context]')
    expect(prompt).toContain('Current workspaceId: "ws-1"')
    expect(prompt).toContain('2 snippet(s):')
    expect(prompt).toContain('- [1] Deploy (plaintext, workspace, favorite)\n```\nnpm run deploy\n```')
    expect(prompt).toContain('- [2] Notes (markdown, global, category: docs, tags: a,b)\n```\n# Heading\nbody\n```')
    expect(prompt).toContain('do not look for, read, or edit any snippets file or database')
    expect(prompt).toContain("the user applies it in BAT's Snippets panel")
    expect(prompt).toContain('How would you like to work with your snippets?')
  })

  test('query variant: names the query and drops the open question', () => {
    const prompt = buildSnippetContextPrompt({ snippets: [], query: 'deploy' })
    noStoragePath(prompt)
    expect(prompt).toContain('0 snippet(s) matching "deploy":')
    expect(prompt).toContain('No snippets exist yet.')
    expect(prompt).not.toContain('How would you like')
    expect(prompt).not.toContain('Current workspaceId')
  })

  test('fence outgrows backtick runs inside the content', () => {
    const prompt = buildSnippetContextPrompt({ snippets: [{ id: 3, title: 'Code', content: 'a\n```js\nx\n```\nb' }] })
    expect(prompt).toContain('- [3] Code (global)\n````\na\n```js\nx\n```\nb\n````')
  })

  test('long content is truncated per snippet and the total budget is enforced', () => {
    const long = 'x'.repeat(SNIPPET_CONTENT_MAX_CHARS + 50)
    const many = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `S${i + 1}`, content: long }))
    const prompt = buildSnippetContextPrompt({ snippets: many })
    expect(prompt).toContain(`(truncated: ${long.length} chars total)`)
    const shown = Math.floor(SNIPPET_CONTEXT_MAX_CONTENT_CHARS / SNIPPET_CONTENT_MAX_CHARS)
    expect(prompt).toContain(`(content of ${15 - shown} more snippet(s) omitted for length`)
    // every snippet is still listed by title
    for (const s of many) expect(prompt).toContain(`- [${s.id}] ${s.title} (global)`)
    expect(prompt.length).toBeLessThan(SNIPPET_CONTEXT_MAX_CONTENT_CHARS + 5000)
  })
})
