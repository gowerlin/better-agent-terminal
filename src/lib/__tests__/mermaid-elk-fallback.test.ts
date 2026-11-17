import { describe, expect, it } from 'vitest'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { applyMermaidElkFallback, isElkLayout } from '../mermaid-elk-fallback'

// T0879 / D300: rewrite an ELK layout request to dagre; everything else stays byte-for-byte.

const FLOW = 'flowchart LR\n  A[Start] --> B{Check}\n  B -->|yes| C[Done]'

function expectRewritten(input: string, expected: string) {
  const result = applyMermaidElkFallback(input)
  expect(result).toEqual({ text: expected, usedElk: true })
}

function expectUnchanged(input: string) {
  const result = applyMermaidElkFallback(input)
  expect(result.usedElk).toBe(false)
  expect(result.text).toBe(input)
}

describe('isElkLayout', () => {
  it('accepts elk and elk.<name>', () => {
    for (const v of ['elk', 'elk.stress', 'elk.force', 'elk.mrtree', 'elk.sporeOverlap', 'elk.box', 'elk.rectpacking', 'elk.layered']) {
      expect(isElkLayout(v)).toBe(true)
    }
  })
  it('rejects everything else', () => {
    for (const v of ['dagre', 'ELK', 'Elk', 'elkx', 'elk.', 'elk..force', 'elk force', ' elk', 'cose-bilkent', '', undefined, null, 1, {}]) {
      expect(isElkLayout(v)).toBe(false)
    }
  })
})

describe('front matter config.layout', () => {
  it('rewrites the plain value', () => {
    expectRewritten(
      `---\nconfig:\n  layout: elk\n---\n${FLOW}`,
      `---\nconfig:\n  layout: dagre\n---\n${FLOW}`,
    )
  })

  it('keeps quotes, comments, other keys and indentation', () => {
    expectRewritten(
      `---\ntitle: "Flow: demo"\nconfig:\n    theme: forest\n    layout: "elk"   # wanted ELK\n    look: classic\n---\n${FLOW}`,
      `---\ntitle: "Flow: demo"\nconfig:\n    theme: forest\n    layout: "dagre"   # wanted ELK\n    look: classic\n---\n${FLOW}`,
    )
    expectRewritten(
      `---\nconfig:\n  layout: 'elk.force'\n  flowchart:\n    curve: linear\n---\n${FLOW}`,
      `---\nconfig:\n  layout: 'dagre'\n  flowchart:\n    curve: linear\n---\n${FLOW}`,
    )
  })

  it('accepts elk.* variants', () => {
    for (const v of ['elk.stress', 'elk.mrtree', 'elk.rectpacking']) {
      expectRewritten(`---\nconfig:\n  layout: ${v}\n---\n${FLOW}`, `---\nconfig:\n  layout: dagre\n---\n${FLOW}`)
    }
  })

  it('handles CRLF and lone CR line breaks', () => {
    const crlf = `---\r\nconfig:\r\n  layout: elk\r\n---\r\n${FLOW.replace(/\n/g, '\r\n')}`
    expectRewritten(crlf, crlf.replace('layout: elk', 'layout: dagre'))
    const cr = `---\rconfig:\r  layout: elk\r---\r${FLOW.replace(/\n/g, '\r')}`
    expectRewritten(cr, cr.replace('layout: elk', 'layout: dagre'))
  })

  it('allows blank lines before the front matter, trailing spaces on fences and comments in it', () => {
    const input = `\n  \n---  \n# settings\nconfig:\n  # layout below\n  layout: elk\n\n---\t\n${FLOW}`
    expectRewritten(input, input.replace('layout: elk', 'layout: dagre'))
  })

  it('leaves config.layout values that are not ELK alone', () => {
    expectUnchanged(`---\nconfig:\n  layout: dagre\n---\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  layout: ELK\n---\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  layout: elkish\n---\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  theme: dark\n---\n${FLOW}`)
  })

  it('does not touch a layout key nested under another config key', () => {
    expectUnchanged(`---\nconfig:\n  flowchart:\n    layout: elk\n---\n${FLOW}`)
  })

  it('does not touch a top-level layout key (mermaid 12.3.0 ignores it)', () => {
    expectUnchanged(`---\nlayout: elk\n---\n${FLOW}`)
    expectUnchanged(`---\ntitle: t\nlayout: elk\nconfig:\n  theme: dark\n---\n${FLOW}`)
  })

  it('keeps the text when the YAML is not a shape it recognizes for certain', () => {
    // flow-style mapping
    expectUnchanged(`---\nconfig: {layout: elk}\n---\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  {layout: elk}\n---\n${FLOW}`)
    // duplicate keys (js-yaml rejects them, so mermaid errors either way)
    expectUnchanged(`---\nconfig:\n  layout: elk\nconfig:\n  theme: dark\n---\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  layout: elk\n  layout: elk\n---\n${FLOW}`)
    // tab indentation, tags, anchors, escaped strings
    expectUnchanged(`---\nconfig:\n\tlayout: elk\n---\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  layout: !!str elk\n---\n${FLOW}`)
    expectUnchanged(`---\nconfig: &c\n  layout: elk\n---\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  layout: "el\\u006b"\n---\n${FLOW}`)
  })

  it('needs fences mermaid accepts', () => {
    // indented front matter, missing closing fence, closing fence at the very end, empty body
    expectUnchanged(`  ---\n  config:\n    layout: elk\n  ---\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  layout: elk\n${FLOW}`)
    expectUnchanged(`---\nconfig:\n  layout: elk\n---`)
    expectUnchanged(`${FLOW}\n---\nconfig:\n  layout: elk\n---\n`)
  })
})

describe('init / initialize directives', () => {
  it('rewrites a top-level layout in init and initialize', () => {
    expectRewritten(
      `%%{init: {"layout": "elk"}}%%\n${FLOW}`,
      `%%{init: {"layout": "dagre"}}%%\n${FLOW}`,
    )
    expectRewritten(
      `%%{initialize: {"theme": "dark", "layout": "elk.force"}}%%\n${FLOW}`,
      `%%{initialize: {"theme": "dark", "layout": "dagre"}}%%\n${FLOW}`,
    )
  })

  it('keeps single quotes, spacing and nested objects', () => {
    expectRewritten(
      `%%{ init : { 'flowchart': { 'curve': 'basis', 'layout': 'elk' }, 'layout' : 'elk' } }%%\n${FLOW}`,
      `%%{ init : { 'flowchart': { 'curve': 'basis', 'layout': 'elk' }, 'layout' : 'dagre' } }%%\n${FLOW}`,
    )
  })

  it('handles directives over several lines and CRLF', () => {
    const input = `%%{init: {\r\n  "theme": "dark",\r\n  "layout": "elk"\r\n}}%%\r\n${FLOW.replace(/\n/g, '\r\n')}`
    expectRewritten(input, input.replace('"layout": "elk"', '"layout": "dagre"'))
  })

  it('works after a front matter block', () => {
    const input = `---\ntitle: Demo\n---\n%%{init: {"layout": "elk"}}%%\n${FLOW}`
    expectRewritten(input, input.replace('"elk"', '"dagre"'))
  })

  it('follows mermaid precedence: directive over front matter, later directive over earlier', () => {
    // front matter elk, directive dagre -> mermaid uses dagre, nothing to do
    expectUnchanged(`---\nconfig:\n  layout: elk\n---\n%%{init: {"layout": "dagre"}}%%\n${FLOW}`)
    // front matter dagre, directive elk -> rewrite the directive
    expectRewritten(
      `---\nconfig:\n  layout: dagre\n---\n%%{init: {"layout": "elk"}}%%\n${FLOW}`,
      `---\nconfig:\n  layout: dagre\n---\n%%{init: {"layout": "dagre"}}%%\n${FLOW}`,
    )
    // both elk -> both rewritten
    expectRewritten(
      `---\nconfig:\n  layout: elk\n---\n%%{init: {"layout": "elk.box"}}%%\n${FLOW}`,
      `---\nconfig:\n  layout: dagre\n---\n%%{init: {"layout": "dagre"}}%%\n${FLOW}`,
    )
    // later directive wins
    expectUnchanged(`%%{init: {"layout": "elk"}}%%\n%%{init: {"layout": "dagre"}}%%\n${FLOW}`)
    expectRewritten(
      `%%{init: {"layout": "dagre"}}%%\n%%{init: {"layout": "elk"}}%%\n${FLOW}`,
      `%%{init: {"layout": "dagre"}}%%\n%%{init: {"layout": "dagre"}}%%\n${FLOW}`,
    )
    // directive without layout does not override the front matter
    expectRewritten(
      `---\nconfig:\n  layout: elk\n---\n%%{init: {"theme": "dark"}}%%\n${FLOW}`,
      `---\nconfig:\n  layout: dagre\n---\n%%{init: {"theme": "dark"}}%%\n${FLOW}`,
    )
  })

  it('does not touch layout nested in the directive or under its config key', () => {
    expectUnchanged(`%%{init: {"flowchart": {"layout": "elk"}}}%%\n${FLOW}`)
    expectUnchanged(`%%{init: {"config": {"layout": "elk"}}}%%\n${FLOW}`)
  })

  it('ignores other directive types', () => {
    expectUnchanged(`%%{wrap}%%\n${FLOW}`)
    expectUnchanged(`%%{config: {"layout": "elk"}}%%\n${FLOW}`)
    expectUnchanged(`%%{Init: {"layout": "elk"}}%%\n${FLOW}`)
  })

  it('keeps the text when a directive cannot be read for certain', () => {
    expectUnchanged(`%%{init: {"layout": "elk",}}%%\n${FLOW}`) // invalid JSON
    expectUnchanged(`%%{init: elk}%%\n${FLOW}`)
    expectUnchanged(`%%{init: ["layout", "elk"]}%%\n${FLOW}`)
    expectUnchanged(`%%{reinit: {"layout": "elk"}}%%\n${FLOW}`)
    expectUnchanged(`%%{init: {"lay\\u006fut": "elk"}}%%\n${FLOW}`)
    // one unreadable directive makes mermaid drop all of them, so nothing is rewritten
    expectUnchanged(`%%{init: {"layout": "elk"}}%%\n%%{init: {bad}}%%\n${FLOW}`)
  })
})

describe('diagrams that must stay exactly as they are', () => {
  it('no layout at all', () => {
    expectUnchanged(FLOW)
    expectUnchanged(`---\ntitle: Plain\n---\n${FLOW}`)
    expectUnchanged('sequenceDiagram\n  Alice->>Bob: Hi')
    expectUnchanged('')
  })

  it('flowchart-elk is left to mermaid', () => {
    expectUnchanged('flowchart-elk TD\n  A --> B')
    expectUnchanged('---\ntitle: x\n---\nflowchart-elk TD\n  A --> B')
  })

  it('elk mentioned in labels or comments', () => {
    expectUnchanged('flowchart LR\n  A["layout: elk"] --> B[elk]')
    expectUnchanged('flowchart LR\n  %% layout: elk\n  A --> B')
    expectUnchanged('flowchart LR\n  %% config:\n  %%   layout: elk\n  A --> B')
    expectUnchanged('flowchart LR\n  A[config:\n  layout: elk] --> B')
  })

  it('front matter-like text later in the diagram', () => {
    expectUnchanged(`${FLOW}\n%% ---\n%% config:\n%%   layout: elk\n%% ---`)
  })
})

describe('i18n', () => {
  it('has the note in every locale', () => {
    for (const locale of [en, zhTW, zhCN]) {
      const value = (locale.sidebar as Record<string, string>).mermaidElkFallback
      expect(typeof value).toBe('string')
      expect(value).toMatch(/ELK/)
    }
  })
})
