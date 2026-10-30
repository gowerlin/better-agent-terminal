/**
 * BUG-174 / T0713: terminal links that WebLinksAddon does not cover.
 *
 * - Plain-text `file:///` links: the range is computed in buffer cells, not string indices, so
 *   wide (CJK) characters before or inside the URL no longer shorten it, and a URL wrapped onto
 *   the following rows (`isWrapped`) is one link whose range spans those rows.
 * - OSC 8 hyperlinks: the `linkHandler` opens only http: / https: / file: and shows the real
 *   target on hover (the visible text of an OSC 8 link can differ from where it points).
 *
 * The range code reads the buffer only through the public xterm API, so tests run it against a
 * real xterm 5.5.0 instance.
 */
import type { IBuffer, IBufferCell, IBufferRange, ILinkHandler } from '@xterm/xterm'

/** Unchanged from the pre-T0713 provider in TerminalPanel (same characters end the URL). */
export const FILE_URL_REGEX = /file:\/\/\/[^\s'"\])}>,;`]+/g

/** Rows joined above and below the queried row when following `isWrapped`. */
export const MAX_WRAPPED_ROWS = 20

export interface FileLinkMatch {
  text: string
  /** 1-based, end inclusive (a wide character's end is its second cell). */
  range: IBufferRange
}

/** Where one string code unit of the joined text sits: 0-based row / first cell, and the cell count. */
interface CellRef {
  y: number
  x: number
  width: number
}

/**
 * Text of the wrapped run around `y` (0-based), one entry in `cells` per code unit. Empty cells
 * read as a space, the second half of a wide character is skipped, and the empty last cell left
 * behind when a wide character wrapped early is skipped too.
 */
function wrappedRunText(buffer: IBuffer, y: number): { text: string; cells: CellRef[] } | undefined {
  if (!buffer.getLine(y)) return undefined
  let top = y
  while (top > y - MAX_WRAPPED_ROWS && buffer.getLine(top)?.isWrapped && buffer.getLine(top - 1)) top--
  let bottom = y
  while (bottom < y + MAX_WRAPPED_ROWS && buffer.getLine(bottom + 1)?.isWrapped) bottom++

  let text = ''
  const cells: CellRef[] = []
  const cell: IBufferCell = buffer.getNullCell()
  for (let row = top; row <= bottom; row++) {
    const line = buffer.getLine(row)
    if (!line) break
    for (let x = 0; x < line.length; x++) {
      line.getCell(x, cell)
      const width = cell.getWidth()
      if (width === 0) continue
      const chars = cell.getChars()
      if (chars === '' && x === line.length - 1 && row < bottom) {
        const next = buffer.getLine(row + 1)
        if (next?.isWrapped && next.getCell(0)?.getWidth() === 2) continue
      }
      const value = chars || ' '
      text += value
      for (let i = 0; i < value.length; i++) cells.push({ y: row, x, width })
    }
  }
  return { text, cells }
}

/**
 * Plain-text `file:///` links on buffer row `bufferLineNumber` (1-based, as xterm's
 * `provideLinks` passes it). The match runs over the whole wrapped run, so every row of a wrapped
 * URL returns the same link; links of the run that do not touch this row are left out.
 */
export function findFileLinks(buffer: IBuffer, bufferLineNumber: number): FileLinkMatch[] {
  const y = bufferLineNumber - 1
  const run = wrappedRunText(buffer, y)
  if (!run) return []
  const regex = new RegExp(FILE_URL_REGEX.source, 'g')
  const links: FileLinkMatch[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(run.text)) !== null) {
    const first = run.cells[match.index]
    const last = run.cells[match.index + match[0].length - 1]
    if (!first || !last) continue
    if (first.y > y || last.y < y) continue
    links.push({
      text: match[0],
      range: {
        start: { x: first.x + 1, y: first.y + 1 },
        end: { x: last.x + last.width, y: last.y + 1 },
      },
    })
  }
  return links
}

/** Schemes an OSC 8 link may open; everything else is refused. */
export const OSC8_ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'file:'])

/** The scheme, or `undefined` when the URI does not parse. */
export function uriScheme(uri: string): string | undefined {
  try {
    return new URL(uri).protocol
  } catch {
    return undefined
  }
}

/**
 * True for an http: / https: / file: URI. Like `isAllowedExternalUrl` in the main process, the
 * raw string must start with the scheme too (URL parsing strips leading whitespace / controls).
 */
export function isAllowedOsc8Uri(uri: string): boolean {
  if (typeof uri !== 'string') return false
  const scheme = uriScheme(uri)
  return scheme !== undefined
    && OSC8_ALLOWED_PROTOCOLS.has(scheme)
    && uri.slice(0, scheme.length).toLowerCase() === scheme
}

/** Longest target shown in the hover tooltip; longer ones keep both ends. */
export const LINK_HOVER_MAX_CHARS = 200

export function truncateLinkTarget(uri: string, max = LINK_HOVER_MAX_CHARS): string {
  if (uri.length <= max) return uri
  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)
  return `${uri.slice(0, head)}…${uri.slice(uri.length - tail)}`
}

export interface Osc8LinkHandlerDeps {
  openExternal: (uri: string) => void
  log: (message: string) => void
  showHover: (event: MouseEvent, target: string) => void
  hideHover: () => void
}

/**
 * The `linkHandler` option. `allowNonHttpProtocols` lets file: links through xterm's own filter;
 * the scheme check here is the one that decides. The log carries the scheme and length only.
 */
export function createOsc8LinkHandler(deps: Osc8LinkHandlerDeps): ILinkHandler {
  return {
    allowNonHttpProtocols: true,
    activate(_event, uri) {
      if (!isAllowedOsc8Uri(uri)) {
        deps.log(`[terminal-links] refused OSC 8 link scheme=${uriScheme(uri) ?? '(unparseable)'} length=${uri.length}`)
        return
      }
      deps.openExternal(uri)
    },
    hover(event, uri) {
      deps.showHover(event, truncateLinkTarget(uri))
    },
    leave() {
      deps.hideHover()
    },
  }
}

/**
 * Tooltip inside the terminal element. The `xterm-hover` class keeps mouse events on it from
 * reaching the terminal (xterm's `ILinkHandler.hover` contract).
 */
export function createLinkHoverTooltip(host: () => HTMLElement | undefined): Pick<Osc8LinkHandlerDeps, 'showHover' | 'hideHover'> & { dispose(): void } {
  let tooltip: HTMLDivElement | undefined
  const hideHover = () => {
    tooltip?.remove()
    tooltip = undefined
  }
  return {
    showHover(event, target) {
      const element = host()
      if (!element) return
      if (!tooltip) {
        tooltip = document.createElement('div')
        tooltip.className = 'xterm-hover terminal-link-hover'
      }
      tooltip.textContent = target
      if (tooltip.parentElement !== element) element.appendChild(tooltip)
      // Below the pointer, flipped above / pulled left when it would leave the terminal.
      const rect = element.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      let left = pointerX
      let top = pointerY + 16
      if (left + tooltip.offsetWidth > rect.width) left = rect.width - tooltip.offsetWidth
      if (top + tooltip.offsetHeight > rect.height) top = pointerY - tooltip.offsetHeight - 4
      tooltip.style.left = `${Math.max(0, left)}px`
      tooltip.style.top = `${Math.max(0, top)}px`
    },
    hideHover,
    dispose: hideHover,
  }
}
