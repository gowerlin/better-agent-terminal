/**
 * BUG-174 / T0713: plain-text `file:///` link ranges in cells (wide characters, wrapped rows) and
 * OSC 8 links, checked against a real xterm 5.5.0 instance with the Unicode 11 widths TerminalPanel
 * uses. Also records how WebLinksAddon's http(s) links behave in the same cases.
 */
import { describe, expect, test, vi } from 'vitest'
import { Terminal, type ILink, type ILinkProvider } from '@xterm/xterm'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import {
  createLinkHoverTooltip,
  createOsc8LinkHandler,
  findFileLinks,
  FILE_URL_REGEX,
  isAllowedOsc8Uri,
  LINK_HOVER_MAX_CHARS,
  MAX_WRAPPED_ROWS,
  truncateLinkTarget,
  type FileLinkMatch,
} from '../terminal-file-links'

async function realXterm(text: string, cols = 120, options: ConstructorParameters<typeof Terminal>[0] = {}): Promise<Terminal> {
  const terminal = new Terminal({ allowProposedApi: true, cols, rows: 24, ...options })
  terminal.loadAddon(new Unicode11Addon())
  terminal.unicode.activeVersion = '11'
  await new Promise<void>(resolve => terminal.write(text, resolve))
  return terminal
}

const links = (terminal: Terminal, row: number) => findFileLinks(terminal.buffer.active, row)

/** The text the cells of `range` hold (wide characters once). */
function cellsText(terminal: Terminal, { range }: FileLinkMatch): string {
  let out = ''
  for (let y = range.start.y; y <= range.end.y; y++) {
    const line = terminal.buffer.active.getLine(y - 1)!
    const from = y === range.start.y ? range.start.x - 1 : 0
    const to = y === range.end.y ? range.end.x : line.length
    out += line.translateToString(false, from, to)
  }
  return out
}

/** The pre-T0713 provider: string indices used as cells, one row only. */
function legacyLinks(terminal: Terminal, row: number): FileLinkMatch[] {
  const text = terminal.buffer.active.getLine(row - 1)!.translateToString()
  const regex = new RegExp(FILE_URL_REGEX.source, 'g')
  const out: FileLinkMatch[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    out.push({ text: match[0], range: { start: { x: match.index + 1, y: row }, end: { x: match.index + match[0].length, y: row } } })
  }
  return out
}

// GitHub #20's example: 10 full-width characters in the path.
const ISSUE_URL = 'file:///Users/demo/project/00.待我處理/待決事項_20261030_範例_v1.0.md'

describe('findFileLinks: wide characters', () => {
  test('the issue path: the range covers every cell, the end is the last cell of the URL', async () => {
    const terminal = await realXterm(ISSUE_URL)
    const [link, ...rest] = links(terminal, 1)
    expect(rest).toEqual([])
    expect(link.text).toBe(ISSUE_URL)
    expect(link.range).toEqual({ start: { x: 1, y: 1 }, end: { x: ISSUE_URL.length + 10, y: 1 } })
    expect(cellsText(terminal, link)).toBe(ISSUE_URL)
    // The pre-T0713 range stopped 10 cells short: `_v1.0.md` was outside it.
    expect(legacyLinks(terminal, 1)[0].range.end.x).toBe(ISSUE_URL.length)
  })

  test('full-width text before the URL moves the start to the right cell', async () => {
    const terminal = await realXterm('已修改 file:///Users/demo/notes.md 完成')
    const [link] = links(terminal, 1)
    expect(link.text).toBe('file:///Users/demo/notes.md')
    // 3 wide characters + a space = 7 cells
    expect(link.range).toEqual({ start: { x: 8, y: 1 }, end: { x: 7 + 'file:///Users/demo/notes.md'.length, y: 1 } })
    expect(cellsText(terminal, link)).toBe(link.text)
  })

  test('a wide character as the last character of the URL ends on its second cell', async () => {
    const url = 'file:///Users/demo/報告'
    const terminal = await realXterm(`  ${url}`)
    const [link] = links(terminal, 1)
    expect(link.range.end).toEqual({ x: 2 + url.length + 2, y: 1 })
    expect(cellsText(terminal, link)).toBe(url)
  })

  test('pure ASCII: identical to the pre-T0713 provider', async () => {
    for (const text of [
      'file:///Users/demo/a.md',
      'see file:///Users/demo/a.md, then file:///C:/Users/demo/b.txt)',
      "open 'file:///tmp/x y' or \"file:///tmp/z\" [file:///tmp/w] <file:///tmp/v>;",
      'no link here',
    ]) {
      const terminal = await realXterm(text)
      expect(links(terminal, 1)).toEqual(legacyLinks(terminal, 1))
    }
  })

  test('two links on one row, wide characters between them', async () => {
    const terminal = await realXterm('檔案 file:///Users/demo/甲.md 與 file:///Users/demo/乙.md')
    const found = links(terminal, 1)
    expect(found.map(l => l.text)).toEqual(['file:///Users/demo/甲.md', 'file:///Users/demo/乙.md'])
    for (const link of found) expect(cellsText(terminal, link)).toBe(link.text)
    expect(found[0].range.start.x).toBe(6)
  })

  test('emoji and combining characters do not break the scan', async () => {
    const url = 'file:///Users/demo/😀/cafe\u0301/👨‍👩‍👧.md'
    const terminal = await realXterm(`前 ${url} 後`)
    const [link] = links(terminal, 1)
    expect(link.text).toBe(url)
    expect(link.range.start).toEqual({ x: 4, y: 1 })
    expect(cellsText(terminal, link)).toBe(url)
  })

  test('rows without content, rows past the buffer', async () => {
    const terminal = await realXterm('')
    expect(links(terminal, 1)).toEqual([])
    expect(links(terminal, 999)).toEqual([])
  })
})

describe('findFileLinks: wrapped rows', () => {
  test('a URL over 3 rows is one link, the same from every row', async () => {
    const url = `file:///Users/demo/${'a'.repeat(30)}/${'目錄'.repeat(10)}/${'b'.repeat(20)}.md`
    const terminal = await realXterm(`> ${url} done`, 40)
    // 2 + 114 cells: the URL ends on row 3, ` done` wraps onto row 4
    for (const y of [2, 3, 4]) expect(terminal.buffer.active.getLine(y - 1)!.isWrapped).toBe(true)
    const fromRow1 = links(terminal, 1)
    expect(fromRow1).toHaveLength(1)
    expect(fromRow1[0].text).toBe(url)
    expect(fromRow1[0].range).toEqual({ start: { x: 3, y: 1 }, end: { x: 36, y: 3 } })
    expect(cellsText(terminal, fromRow1[0])).toBe(url)
    for (const y of [2, 3]) expect(links(terminal, y)).toEqual(fromRow1)
    expect(links(terminal, 4)).toEqual([])
  })

  test('a wide character wrapped early (empty last cell) stays inside the link', async () => {
    // 19 + 21 = 40 cells; `待` needs cells 41-42 of a 41-column row, so it wraps and cell 41 stays empty.
    const url = `file:///Users/demo/${'a'.repeat(21)}待辦/x.md`
    const terminal = await realXterm(url, 41)
    const row2 = terminal.buffer.active.getLine(1)!
    expect(row2.isWrapped).toBe(true)
    expect(row2.getCell(0)!.getChars()).toBe('待')
    const [link] = links(terminal, 2)
    expect(link.text).toBe(url)
    expect(link.range).toEqual({ start: { x: 1, y: 1 }, end: { x: '待辦/x.md'.length + 2, y: 2 } })
    expect(links(terminal, 1)).toEqual([link])
  })

  test('only links touching the queried row come back', async () => {
    const first = 'file:///Users/demo/c.md'
    const terminal = await realXterm(`${first} ${'x'.repeat(30)} file:///Users/demo/z.md`, 40)
    expect(links(terminal, 1).map(l => l.text)).toEqual([first])
    expect(links(terminal, 2).map(l => l.text)).toEqual(['file:///Users/demo/z.md'])
  })

  test(`joining stops after ${MAX_WRAPPED_ROWS} rows each way`, async () => {
    const url = `file:///Users/demo/${'d'.repeat(20 * 100)}`
    const terminal = await realXterm(url, 20, { rows: 150, scrollback: 0 })
    // the start is within reach: the range ends MAX_WRAPPED_ROWS rows below the queried row
    expect(links(terminal, 10).map(l => l.range)).toEqual([{ start: { x: 1, y: 1 }, end: { x: 20, y: 10 + MAX_WRAPPED_ROWS } }])
    // the start is out of reach: the joined text has no `file:///`, so no link
    expect(links(terminal, 60)).toEqual([])
  })
})

describe('OSC 8 link handler', () => {
  const deps = () => ({ openExternal: vi.fn(), log: vi.fn(), showHover: vi.fn(), hideHover: vi.fn() })
  const event = {} as MouseEvent
  const range = { start: { x: 1, y: 1 }, end: { x: 1, y: 1 } }

  test('http / https / file open through openExternal', () => {
    const d = deps()
    const handler = createOsc8LinkHandler(d)
    expect(handler.allowNonHttpProtocols).toBe(true)
    for (const uri of ['http://example.com/a', 'https://example.com/b?c=1', 'file:///Users/demo/待辦.md', 'FILE:///C:/Users/demo/a.txt']) {
      handler.activate(event, uri, range)
    }
    expect(d.openExternal.mock.calls.map(c => c[0])).toEqual([
      'http://example.com/a', 'https://example.com/b?c=1', 'file:///Users/demo/待辦.md', 'FILE:///C:/Users/demo/a.txt',
    ])
    expect(d.log).not.toHaveBeenCalled()
  })

  test('other schemes are refused and logged with scheme and length only', () => {
    const d = deps()
    const handler = createOsc8LinkHandler(d)
    const refused = ['javascript:alert(1)', 'vbscript:msgbox', 'vscode://file/Users/demo/a', 'mailto:demo@example.com', ' file:///Users/demo/a', 'not a url', 'data:text/html,<b>x</b>']
    for (const uri of refused) handler.activate(event, uri, range)
    expect(d.openExternal).not.toHaveBeenCalled()
    expect(d.log.mock.calls.map(c => c[0])).toEqual([
      '[terminal-links] refused OSC 8 link scheme=javascript: length=19',
      '[terminal-links] refused OSC 8 link scheme=vbscript: length=15',
      '[terminal-links] refused OSC 8 link scheme=vscode: length=26',
      '[terminal-links] refused OSC 8 link scheme=mailto: length=23',
      '[terminal-links] refused OSC 8 link scheme=file: length=21',
      '[terminal-links] refused OSC 8 link scheme=(unparseable) length=9',
      '[terminal-links] refused OSC 8 link scheme=data: length=23',
    ])
    expect(isAllowedOsc8Uri(undefined as unknown as string)).toBe(false)
  })

  test('hover shows the real target (long ones truncated), leave hides it', () => {
    const d = deps()
    const handler = createOsc8LinkHandler(d)
    handler.hover!(event, 'file:///Users/demo/a.md', range)
    expect(d.showHover).toHaveBeenCalledWith(event, 'file:///Users/demo/a.md')
    const long = `https://example.com/${'x'.repeat(500)}/end`
    handler.hover!(event, long, range)
    const shown = d.showHover.mock.calls[1][1] as string
    expect(shown).toHaveLength(LINK_HOVER_MAX_CHARS)
    expect(shown.startsWith('https://example.com/')).toBe(true)
    expect(shown.endsWith('/end')).toBe(true)
    handler.leave!(event, long, range)
    expect(d.hideHover).toHaveBeenCalledTimes(1)
    expect(truncateLinkTarget('short')).toBe('short')
  })

  test('through xterm: an OSC 8 file link whose text differs from its target', async () => {
    const d = deps()
    const uri = 'file:///Users/demo/project/待辦.md'
    const osc = (target: string, text: string) => `\x1b]8;;${target}\x1b\\${text}\x1b]8;;\x1b\\`
    const terminal = await realXterm(`see ${osc(uri, 'README')} and ${osc('javascript:alert(1)', 'click')}`, 80, { linkHandler: createOsc8LinkHandler(d) })
    const oscProvider = (terminal as unknown as { _core: { _linkProviderService: { linkProviders: ILinkProvider[] } } })._core._linkProviderService.linkProviders[0]
    const found = await new Promise<ILink[] | undefined>(resolve => oscProvider.provideLinks(1, resolve))
    expect(found!.map(l => [l.text, l.range.start.x, l.range.end.x])).toEqual([[uri, 5, 10], ['javascript:alert(1)', 16, 20]])
    found![0].hover!(event, found![0].text)
    expect(d.showHover).toHaveBeenCalledWith(event, uri)
    for (const link of found!) link.activate(event, link.text)
    expect(d.openExternal.mock.calls).toEqual([[uri]])
    expect(d.log).toHaveBeenCalledWith('[terminal-links] refused OSC 8 link scheme=javascript: length=19')
  })

  test('without a linkHandler (pre-T0713) xterm drops the file: OSC 8 link', async () => {
    const terminal = await realXterm('\x1b]8;;file:///Users/demo/a.md\x1b\\README\x1b]8;;\x1b\\', 80)
    const oscProvider = (terminal as unknown as { _core: { _linkProviderService: { linkProviders: ILinkProvider[] } } })._core._linkProviderService.linkProviders[0]
    const found = await new Promise<ILink[] | undefined>(resolve => oscProvider.provideLinks(1, resolve))
    expect(found).toEqual([])
  })

  test('hover tooltip: an xterm-hover element in the host, text only, removed on hide', () => {
    const host = document.createElement('div')
    const tooltip = createLinkHoverTooltip(() => host)
    tooltip.showHover({ clientX: 10, clientY: 10 } as MouseEvent, '<b>file:///Users/demo/a.md</b>')
    const el = host.querySelector('.terminal-link-hover')!
    expect(el.classList.contains('xterm-hover')).toBe(true)
    expect(el.textContent).toBe('<b>file:///Users/demo/a.md</b>')
    expect(el.querySelector('b')).toBeNull()
    tooltip.showHover({ clientX: 20, clientY: 20 } as MouseEvent, 'https://example.com')
    expect(host.querySelectorAll('.terminal-link-hover')).toHaveLength(1)
    tooltip.hideHover()
    expect(host.querySelector('.terminal-link-hover')).toBeNull()
    createLinkHoverTooltip(() => undefined).showHover({ clientX: 0, clientY: 0 } as MouseEvent, 'x')
  })
})

/** WebLinksAddon's provider (http/https), captured from its activate(). */
function webLinks(terminal: Terminal, row: number): Promise<ILink[] | undefined> {
  let provider: ILinkProvider | undefined
  const fake = Object.create(terminal) as Terminal
  fake.registerLinkProvider = (p: ILinkProvider) => { provider = p; return { dispose() {} } }
  new WebLinksAddon(() => {}).activate(fake)
  return new Promise(resolve => provider!.provideLinks(row, resolve))
}

describe('WebLinksAddon http(s) (recorded for T0713, not changed)', () => {
  test('wide characters before and inside the URL', async () => {
    const url = 'https://example.com/文件/說明_v1.html'
    const terminal = await realXterm(`請看 ${url} 謝謝`)
    const [link] = (await webLinks(terminal, 1))!
    expect(link.text).toBe(url)
    expect(link.range).toEqual({ start: { x: 6, y: 1 }, end: { x: 5 + url.length + 4, y: 1 } })
  })

  test('a wrapped URL is one link from every row', async () => {
    const url = `https://example.com/${'a'.repeat(30)}/${'頁'.repeat(15)}/end`
    const terminal = await realXterm(`> ${url}`, 40)
    const fromRow1 = (await webLinks(terminal, 1))!
    expect(fromRow1).toHaveLength(1)
    expect(fromRow1[0].text).toBe(url)
    expect(fromRow1[0].range.start).toEqual({ x: 3, y: 1 })
    expect(fromRow1[0].range.end.y).toBe(3)
    for (const y of [2, 3]) {
      const found = (await webLinks(terminal, y))!
      expect(found.map(l => l.range)).toEqual([fromRow1[0].range])
    }
  })
})
