// Build-time stand-in for `elkjs` (T0878 / D299). Do not import this file directly.
//
// mermaid 12 lazy-loads its ELK layout renderer, which does
// `import ELK from "elkjs/lib/elk.bundled.js"` (node_modules/mermaid/dist/chunks/mermaid.core/elk-*.mjs).
// elkjs is licensed `EPL-2.0 OR GPL-3.0-or-later` and is ~1.5 MB, so BAT does not ship it:
// vite.config.ts aliases every `elkjs` import to this module. BAT renders with `layout: 'dagre'`
// (src/components/FileTreeMarkdown.tsx), so this module is only reached when a diagram itself asks for ELK
// (`layout: elk` front matter or `flowchart-elk`). mermaid then catches the rejected layout and draws its
// error diagram for that one diagram; the other diagrams on the page render normally.

export const ELK_NOT_BUNDLED_MESSAGE =
  'The ELK layout is not included in Better Agent Terminal. Use the default layout (dagre) instead of `layout: elk` or `flowchart-elk`.'

function notBundled(): Promise<never> {
  return Promise.reject(new Error(ELK_NOT_BUNDLED_MESSAGE))
}

export default class ELK {
  layout(_graph?: unknown, _options?: unknown): Promise<never> {
    return notBundled()
  }

  knownLayoutAlgorithms(): Promise<never> {
    return notBundled()
  }

  knownLayoutOptions(): Promise<never> {
    return notBundled()
  }

  knownLayoutCategories(): Promise<never> {
    return notBundled()
  }

  terminateWorker(): void {}
}
