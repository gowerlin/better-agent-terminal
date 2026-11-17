// @vitest-environment node
// T0878 / D299 — the renderer build must not contain elkjs (`EPL-2.0 OR GPL-3.0-or-later`, ~1.5 MB).
//
// mermaid 12's lazy ELK layout renderer imports elkjs; vite.config.ts aliases every `elkjs` specifier to
// src/lib/elkjs-stub.ts. These tests check:
//   1. the alias is in vite.config.ts and the stub rejects layout() (so mermaid draws its error diagram);
//   2. the installed mermaid imports elkjs only through the specifiers listed in MERMAID_ELKJS_SPECIFIERS.
//      A mermaid upgrade that changes them fails here until someone re-checks that the alias and the stub
//      still cover the new import (docs/agent-guide/build-toolchain.md "mermaid：不打包 elkjs");
//   3. with a build (`npx vite build`; skipped without dist/assets), no dist JS carries elkjs's signature
//      strings and every `elk-*.js` chunk is only mermaid's ELK renderer plus the stub.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIST_ASSETS = path.join(REPO, 'dist', 'assets')
const MERMAID_CHUNKS = path.join(REPO, 'node_modules', 'mermaid', 'dist', 'chunks', 'mermaid.core')

/** The alias in vite.config.ts (kept in sync by the first test). */
const ELKJS_ALIAS = /^elkjs(?:\/.*)?$/

/** Every elkjs specifier the installed mermaid (12.3.0) imports from its `module` entry's chunks. */
const MERMAID_ELKJS_SPECIFIERS = ['elkjs/lib/elk.bundled.js']

/** Strings that appear in elkjs's bundle (license header / Java package names) and never in mermaid's own code. */
const ELKJS_SIGNATURES = ['org.eclipse.elk', 'Eclipse Public License']

/** mermaid's own ELK renderer is ~36 KB minified; the elkjs bundle alone is ~1.4 MB. */
const ELK_CHUNK_MAX_BYTES = 200_000

const STUB_MESSAGE_START = 'The ELK layout is not included in Better Agent Terminal.'

function elkjsSpecifiersIn(dir) {
  const found = new Set()
  const importRe = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["'](elkjs(?:\/[^"']*)?)["']/g
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.mjs')) continue
    const text = fs.readFileSync(path.join(dir, name), 'utf8')
    for (const m of text.matchAll(importRe)) found.add(m[1])
  }
  return [...found].sort()
}

describe('elkjs is not bundled (T0878 / D299)', () => {
  it('vite.config.ts aliases every elkjs specifier to the stub', () => {
    const config = fs.readFileSync(path.join(REPO, 'vite.config.ts'), 'utf8')
    const aliasLine = `{ find: ${ELKJS_ALIAS.toString()}, replacement: path.resolve(__dirname, './src/lib/elkjs-stub.ts') },`
    expect(config.split(/\r?\n/).map(line => line.trim())).toContain(aliasLine)
    expect(fs.existsSync(path.join(REPO, 'src', 'lib', 'elkjs-stub.ts'))).toBe(true)
  })

  it('the stub rejects layout() with an explanation instead of laying out', async () => {
    const { default: ELK, ELK_NOT_BUNDLED_MESSAGE } = await import('../../src/lib/elkjs-stub.ts')
    expect(ELK_NOT_BUNDLED_MESSAGE.startsWith(STUB_MESSAGE_START)).toBe(true)
    const elk = new ELK()
    await expect(elk.layout({ id: 'root', children: [] })).rejects.toThrow(ELK_NOT_BUNDLED_MESSAGE)
    await expect(elk.knownLayoutAlgorithms()).rejects.toThrow(ELK_NOT_BUNDLED_MESSAGE)
    expect(() => elk.terminateWorker()).not.toThrow()
  })

  it('the installed mermaid imports elkjs only through the known specifiers', () => {
    const specifiers = elkjsSpecifiersIn(MERMAID_CHUNKS)
    expect(specifiers).toEqual(MERMAID_ELKJS_SPECIFIERS)
    for (const s of specifiers) expect(ELKJS_ALIAS.test(s)).toBe(true)
  })

  const distBuilt = fs.existsSync(DIST_ASSETS)

  it.skipIf(!distBuilt)('dist/assets has no elkjs code and the elk chunk is only the stub (needs `npx vite build`)', () => {
    const js = fs.readdirSync(DIST_ASSETS).filter(name => name.endsWith('.js'))
    expect(js.some(name => name.startsWith('mermaid.core-'))).toBe(true)

    const withSignature = js.filter(name => {
      const text = fs.readFileSync(path.join(DIST_ASSETS, name), 'utf8')
      return ELKJS_SIGNATURES.some(sig => text.includes(sig))
    })
    expect(withSignature).toEqual([])

    for (const name of js.filter(n => n.startsWith('elk-'))) {
      const file = path.join(DIST_ASSETS, name)
      expect(fs.statSync(file).size, `${name} size`).toBeLessThan(ELK_CHUNK_MAX_BYTES)
      expect(fs.readFileSync(file, 'utf8')).toContain(STUB_MESSAGE_START)
    }
  })
})
