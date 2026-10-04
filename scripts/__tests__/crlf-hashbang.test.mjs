// T0454 — scripts/*.mjs load through vitest regardless of line endings.
//
// With core.autocrlf=true and no .gitattributes, a fresh checkout has CRLF sources, so
// line 1 of a script is `#!/usr/bin/env node\r`. Vite's SSR transform only recognises a
// hashbang ending in `\n`, hoists the rewritten imports above the `#!`, and the importing
// test file fails to load with `SyntaxError: Invalid or unexpected token` (no stack).
// vite.config.ts neutralises the hashbang in vitest mode; these modules are written at
// runtime so the CRLF case is exercised in an LF checkout too.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

// Inside the repo: an os.tmpdir() path did not resolve (`Cannot find module '/@id/C:/…'`
// with the repo on D:), and node_modules is externalised (loaded by Node, not transformed).
const dir = mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.t0454-crlf-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function writeModule(name, eol) {
  const file = path.join(dir, name)
  const lines = [
    '#!/usr/bin/env node',
    "import path from 'node:path'",
    '',
    'export const sep = path.sep',
    '',
  ]
  writeFileSync(file, lines.join(eol))
  return file.replace(/\\/g, '/')
}

describe('hashbang + line endings under vitest (T0454)', () => {
  for (const [label, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) {
    it(`loads a ${label} module whose first line is a hashbang`, async () => {
      const mod = await import(/* @vite-ignore */ writeModule(`${label.toLowerCase()}.mjs`, eol))
      expect(mod.sep).toBe(path.sep)
    })
  }
})
