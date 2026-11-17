// T0879 / D300: an ELK layout request is rendered with dagre and gets a one-line note.
// mermaid itself is mocked; the marked -> DOMPurify path is the real one.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const { run, runInputs } = vi.hoisted(() => {
  const runInputs: string[] = []
  const run = vi.fn(async ({ nodes }: { nodes: ArrayLike<HTMLElement> }) => {
    for (const node of Array.from(nodes)) {
      runInputs.push(node.textContent ?? '')
    }
  })
  return { run, runInputs }
})

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run } }))

import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import { MarkdownPreview } from '../FileTreeMarkdown'

const ELK = '```mermaid\n---\nconfig:\n  layout: elk\n---\nflowchart LR\n  A --> B\n```'
const PLAIN = '```mermaid\nflowchart LR\n  A --> B\n```'

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  run.mockClear()
  runInputs.length = 0
})

describe('MarkdownPreview ELK fallback (T0879)', () => {
  it('hands mermaid the dagre text and adds the note after the diagram', async () => {
    const { container } = render(<MarkdownPreview content={`${ELK}\n\n${PLAIN}`} />)
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))

    const diagrams = container.querySelectorAll('.mermaid')
    expect(diagrams).toHaveLength(2)
    expect(diagrams[0].getAttribute('data-mermaid-elk-fallback')).toBe('true')
    expect(diagrams[1].hasAttribute('data-mermaid-elk-fallback')).toBe(false)

    expect(runInputs[0]).toContain('layout: dagre')
    expect(runInputs[0]).not.toContain('elk')
    expect(runInputs[1]).toBe('flowchart LR\n  A --> B')

    const notes = container.querySelectorAll('.mermaid-elk-note')
    expect(notes).toHaveLength(1)
    expect(notes[0].previousElementSibling).toBe(diagrams[0])
    expect(notes[0].textContent).toBe(en.sidebar.mermaidElkFallback)
    expect(notes[0].children).toHaveLength(0)
  })

  it('renders a diagram without ELK exactly as before (no attribute, no note)', async () => {
    const { container } = render(<MarkdownPreview content={PLAIN} />)
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    expect(container.querySelector('.file-preview-markdown')?.innerHTML).toBe(
      '<div class="mermaid" id="' + container.querySelector('.mermaid')?.id + '">flowchart LR\n  A --&gt; B</div>',
    )
    expect(container.querySelector('.mermaid-elk-note')).toBeNull()
  })

  it('updates the note text when the language changes', async () => {
    const { container } = render(<MarkdownPreview content={ELK} />)
    await waitFor(() => expect(container.querySelector('.mermaid-elk-note')).not.toBeNull())
    await act(async () => {
      await i18n.changeLanguage('zh-TW')
    })
    expect(container.querySelectorAll('.mermaid-elk-note')).toHaveLength(1)
    expect(container.querySelector('.mermaid-elk-note')?.textContent).toBe(zhTW.sidebar.mermaidElkFallback)
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })
})
