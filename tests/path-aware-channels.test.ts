import assert from 'node:assert/strict'
import test from 'node:test'
import {
  translateInvokeArgs,
} from '../electron/remote/path-aware-channels'
import type { PathTranslator } from '../electron/remote/path-translator'

// Minimal prefix translator: /client/* <-> /server/* (mirrors prod behavior).
class PrefixTranslator implements PathTranslator {
  toServer(p: string): string { return p.replace(/^\/client/, '/server') }
  toClient(p: string): string { return p.replace(/^\/server/, '/client') }
  owns(p: string): boolean { return p.startsWith('/client') || p.startsWith('/server') }
}
const tr: PathTranslator = new PrefixTranslator()

// ── BUG-065 / T0301 — schema-driven translateInvokeArgs ─────────────────

test("schema 'first-string': args[0] translated, args[1+] left alone", () => {
  // fs:readdir is declared first-string in PATH_ARG_SCHEMA.
  const out = translateInvokeArgs('fs:readdir', ['/client/proj', { extra: '/client/keep' }], tr)
  assert.deepEqual(out, ['/server/proj', { extra: '/client/keep' }])
})

test("schema 'first-string': non-string args[0] returns args unchanged", () => {
  const arg = { weird: 'shape' }
  const out = translateInvokeArgs('fs:readFile', [arg, 'utf8'], tr)
  assert.equal(out[0], arg)
  assert.equal(out[1], 'utf8')
})

test("schema 'all-strings' (git:diff-files): every string arg gets translated", () => {
  const out = translateInvokeArgs(
    'git:diff-files',
    ['/client/a.txt', '/client/b.txt', 42, '/client/c.txt'],
    tr,
  )
  assert.deepEqual(out, ['/server/a.txt', '/server/b.txt', 42, '/server/c.txt'])
})

test("schema 'array-of-strings' (fs:reset-watch): args[0] is path[] translated element-wise", () => {
  const out = translateInvokeArgs(
    'fs:reset-watch',
    [['/client/a', '/client/b'], 'opts'],
    tr,
  )
  assert.deepEqual(out, [['/server/a', '/server/b'], 'opts'])
})

test("schema 'array-of-strings': non-array args[0] returns args unchanged", () => {
  const out = translateInvokeArgs('fs:reset-watch', ['/client/oops'], tr)
  assert.deepEqual(out, ['/client/oops'])
})

test("schema 'pty-create': only options.cwd is rewritten, sibling fields untouched", () => {
  const out = translateInvokeArgs(
    'pty:create',
    [{ cwd: '/client/repo', shell: 'bash', args: ['-l'] }],
    tr,
  )
  assert.deepEqual(out, [{ cwd: '/server/repo', shell: 'bash', args: ['-l'] }])
})

test("schema 'pty-restart': args[0] (id) untouched, args[1] (cwd) translated", () => {
  const out = translateInvokeArgs('pty:restart', ['term-1', '/client/repo', 'pwsh'], tr)
  assert.deepEqual(out, ['term-1', '/server/repo', 'pwsh'])
})

test('non-PATH_AWARE_CHANNELS channel returns args unchanged', () => {
  const out = translateInvokeArgs('claude:start-session', ['/client/proj'], tr)
  assert.deepEqual(out, ['/client/proj'])
})

// AC5 — back-compat: a path-aware channel without an explicit schema entry
// must default to 'first-string' so translation behavior never silently
// degrades when PATH_AWARE_CHANNELS gains a new entry.
test('back-compat: PATH_AWARE_CHANNELS entry without schema defaults to first-string', () => {
  // Stub a channel into PATH_AWARE_CHANNELS without touching PATH_ARG_SCHEMA,
  // simulating "future channel author forgot to add schema row".
  const mod = require('../electron/remote/path-aware-channels')
  mod.PATH_AWARE_CHANNELS.add('test:future-channel')
  try {
    const out = translateInvokeArgs('test:future-channel', ['/client/x', '/client/y'], tr)
    assert.deepEqual(out, ['/server/x', '/client/y'])
  } finally {
    mod.PATH_AWARE_CHANNELS.delete('test:future-channel')
  }
})
