import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import hljs from 'highlight.js/lib/core'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { applyMermaidElkFallback } from '../lib/mermaid-elk-fallback'

// Markdown rendering using marked + DOMPurify (sanitized) + highlight.js, with mermaid post-processing.
// Extracted from FileTree.tsx (PLAN-023 階段 3).

marked.setOptions({
  gfm: true,
  breaks: false,
})

const renderer = new marked.Renderer()

// data-* attributes pass DOMPurify by default (ALLOW_DATA_ATTR), so the sanitize config is unchanged.
const ELK_FALLBACK_ATTR = 'data-mermaid-elk-fallback'
const ELK_NOTE_CLASS = 'mermaid-elk-note'

renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  // Mermaid blocks: render as div with class "mermaid" for post-render processing
  if (lang === 'mermaid') {
    // T0879 / D300: BAT does not ship elkjs (T0878), so an ELK layout request is rewritten to
    // dagre and marked for a note. Diagrams without one produce exactly the same HTML as before.
    const fallback = applyMermaidElkFallback(text)
    if (fallback.usedElk) {
      return `<div class="mermaid" ${ELK_FALLBACK_ATTR}="true">${fallback.text}</div>`
    }
    return `<div class="mermaid">${text}</div>`
  }
  let highlighted: string
  try {
    highlighted = lang
      ? hljs.highlight(text, { language: lang }).value
      : hljs.highlightAuto(text).value
  } catch {
    highlighted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  return `<pre><code class="hljs${lang ? ` language-${lang}` : ''}">${highlighted}</code></pre>`
}

renderer.link = function ({ href, text }: { href: string; text: string }) {
  // Links open in external browser, not inside Electron
  return `<a href="${href}" data-external-link="true">${text}</a>`
}

renderer.image = function ({ href, text }: { href: string; text: string }) {
  // Support local file paths
  const src = href.startsWith('/') ? `file://${href}` : href
  return `<img alt="${text || ''}" src="${src}" style="max-width:100%"/>`
}

marked.use({ renderer })

// All markdown content is sanitized via DOMPurify before being injected into the DOM.
function renderMarkdown(text: string): string {
  const rawHtml = marked.parse(text) as string
  return DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['input'],  // Allow checkboxes for task lists
    ADD_ATTR: ['checked', 'disabled', 'type', 'data-external-link'],
  })
}

// Mermaid rendering: dynamically import mermaid only when needed
let mermaidInstance: typeof import('mermaid')['default'] | null = null

async function getMermaid() {
  if (!mermaidInstance) {
    mermaidInstance = (await import('mermaid')).default
    mermaidInstance.initialize({
      startOnLoad: false,
      // mermaid 12 defaults to the ELK layout and the `neo` look; keep the mermaid 11 appearance (T0876).
      layout: 'dagre',
      look: 'classic',
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#1e1e1e',
        primaryColor: '#3498db',
        primaryTextColor: '#e0e0e0',
        lineColor: '#666',
      },
    })
  }
  return mermaidInstance
}

// One line under a diagram whose ELK layout was replaced (T0879). Text only, via textContent.
function addElkFallbackNotes(container: HTMLElement, note: string) {
  container.querySelectorAll(`.mermaid[${ELK_FALLBACK_ATTR}]`).forEach(div => {
    const next = div.nextElementSibling
    if (next?.classList.contains(ELK_NOTE_CLASS)) {
      next.textContent = note
      return
    }
    const p = document.createElement('p')
    p.className = ELK_NOTE_CLASS
    p.textContent = note
    div.after(p)
  })
}

async function renderMermaidBlocks(container: HTMLElement, elkNote: string) {
  const mermaidDivs = container.querySelectorAll('.mermaid')
  if (mermaidDivs.length === 0) return

  addElkFallbackNotes(container, elkNote)

  const mermaid = await getMermaid()
  mermaidDivs.forEach((div, i) => {
    div.id = `mermaid-${Date.now()}-${i}`
  })
  try {
    await mermaid.run({ nodes: mermaidDivs as unknown as ArrayLike<HTMLElement> })
  } catch {
    mermaidDivs.forEach(div => {
      if (!div.querySelector('svg')) {
        div.classList.add('mermaid-error')
      }
    })
  }
}

export function MarkdownPreview({ content }: Readonly<{ content: string }>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const elkNote = t('sidebar.mermaidElkFallback')
  const elkNoteRef = useRef(elkNote)
  elkNoteRef.current = elkNote
  // Sanitized via DOMPurify in renderMarkdown — safe to inject.
  const html = renderMarkdown(content)

  useEffect(() => {
    if (containerRef.current) {
      renderMermaidBlocks(containerRef.current, elkNoteRef.current)
    }
  }, [html])

  // Language change: update the notes in place without re-running mermaid.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.querySelectorAll(`.${ELK_NOTE_CLASS}`).forEach(n => {
        n.textContent = elkNote
      })
    }
  }, [elkNote])

  return (
    <div
      ref={containerRef}
      className="file-preview-markdown"
      // eslint-disable-next-line react/no-danger -- content already sanitized via DOMPurify
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const target = e.target as HTMLElement
        const link = target.closest('a[data-external-link]') as HTMLAnchorElement | null
        if (link) {
          e.preventDefault()
          window.electronAPI.shell.openExternal(link.href)
        }
      }}
    />
  )
}
