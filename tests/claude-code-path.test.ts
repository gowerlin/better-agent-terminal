/**
 * Unit tests for claude-code CLI path resolution (BUG-047 / T0221).
 *
 * The real `resolveClaudeCodePath()` lives in electron/claude-agent-manager.ts
 * and depends on Electron's `app.isPackaged` + `process.resourcesPath`, which
 * are not available under a plain Node test runner. We therefore test the
 * **dev-mode resolution logic** that the Electron function falls back to:
 *
 *   package.json resolve → dirname → bin/<binary>  → must exist on disk
 *
 * This assertion catches the class of regression reported in BUG-047, where
 * the SDK drops a file the code assumes exists (originally `cli.js`, now the
 * `bin/` binary), silently returning an empty path.
 *
 * Run: npx tsx tests/claude-code-path.test.ts
 */

import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ❌ ${name}`)
    console.log(`     ${(e as Error).message}`)
    failed++
  }
}

function resolveClaudeCodePathDev(): string {
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  try {
    const pkgPath = require.resolve('@anthropic-ai/claude-code/package.json')
    return path.join(path.dirname(pkgPath), 'bin', binaryName)
  } catch {
    return ''
  }
}

console.log('\nclaude-code CLI path resolution (BUG-047 / T0221):')

test('package.json resolves (prerequisite for dev-mode branch)', () => {
  const pkgPath = require.resolve('@anthropic-ai/claude-code/package.json')
  assert.ok(pkgPath, 'package.json path must resolve')
  assert.ok(fs.existsSync(pkgPath), `package.json must exist on disk: ${pkgPath}`)
})

test('resolved bin path is truthy', () => {
  const p = resolveClaudeCodePathDev()
  assert.ok(p, 'resolveClaudeCodePath must not return empty string in dev')
})

test('resolved bin path exists on disk (guards SDK silently dropping file)', () => {
  const p = resolveClaudeCodePathDev()
  assert.ok(
    fs.existsSync(p),
    `Expected CLI binary to exist at: ${p}. If this fails after an SDK upgrade, the resolve target was removed — see BUG-047.`,
  )
})

test('resolved bin path matches platform binary name', () => {
  const p = resolveClaudeCodePathDev()
  const expected = process.platform === 'win32' ? 'claude.exe' : 'claude'
  assert.ok(p.endsWith(path.sep + expected), `expected path to end with ${expected}, got: ${p}`)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
