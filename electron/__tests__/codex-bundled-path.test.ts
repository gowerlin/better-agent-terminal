import { describe, it, expect } from 'vitest'
import * as path from 'path'

import { resolveBundledCodexLayout, prependPathDirs } from '../codex-bundled-path'

const ROOT = path.join('pkg', '@openai', 'codex-win32-x64')
const TRIPLE = 'x86_64-pc-windows-msvc'
const EXE = 'codex.exe'
const vendor = (...parts: string[]) => path.join(ROOT, 'vendor', TRIPLE, ...parts)

function fakeFs(...present: string[]): (p: string) => boolean {
  const set = new Set(present)
  return (p: string) => set.has(p)
}

describe('resolveBundledCodexLayout', () => {
  it('resolves the >= 0.160 layout with codex-path helper dir', () => {
    const exists = fakeFs(vendor('bin', EXE), vendor('codex-package.json'), vendor('codex-path'))
    expect(resolveBundledCodexLayout(ROOT, TRIPLE, EXE, exists)).toEqual({
      binary: vendor('bin', EXE),
      pathDirs: [vendor('codex-path')],
    })
  })

  it('resolves the >= 0.160 layout without codex-path', () => {
    const exists = fakeFs(vendor('bin', EXE), vendor('codex-package.json'))
    expect(resolveBundledCodexLayout(ROOT, TRIPLE, EXE, exists)).toEqual({
      binary: vendor('bin', EXE),
      pathDirs: [],
    })
  })

  it('resolves the legacy (<= 0.124) layout', () => {
    const exists = fakeFs(vendor('codex', EXE))
    expect(resolveBundledCodexLayout(ROOT, TRIPLE, EXE, exists)).toEqual({
      binary: vendor('codex', EXE),
      pathDirs: [],
    })
  })

  it('returns legacy helper dir (path/) when present', () => {
    const exists = fakeFs(vendor('codex', EXE), vendor('path'))
    expect(resolveBundledCodexLayout(ROOT, TRIPLE, EXE, exists)?.pathDirs).toEqual([vendor('path')])
  })

  it('prefers the new layout when both are present', () => {
    const exists = fakeFs(vendor('bin', EXE), vendor('codex-package.json'), vendor('codex', EXE))
    expect(resolveBundledCodexLayout(ROOT, TRIPLE, EXE, exists)?.binary).toBe(vendor('bin', EXE))
  })

  it('ignores bin/<exe> without codex-package.json (matches SDK)', () => {
    const exists = fakeFs(vendor('bin', EXE), vendor('codex', EXE))
    expect(resolveBundledCodexLayout(ROOT, TRIPLE, EXE, exists)?.binary).toBe(vendor('codex', EXE))
  })

  it('returns undefined when neither layout exists', () => {
    expect(resolveBundledCodexLayout(ROOT, TRIPLE, EXE, fakeFs())).toBeUndefined()
    expect(resolveBundledCodexLayout(ROOT, TRIPLE, EXE, fakeFs(vendor('codex-package.json')))).toBeUndefined()
  })
})

describe('prependPathDirs', () => {
  it('prepends on posix and de-duplicates', () => {
    const env = { PATH: '/usr/bin:/helper:/bin', HOME: '/home/u' }
    expect(prependPathDirs(env, ['/helper'], 'linux')).toEqual({ PATH: '/helper:/usr/bin:/bin', HOME: '/home/u' })
  })

  it('does not mutate the input env', () => {
    const env = { PATH: '/usr/bin' }
    prependPathDirs(env, ['/helper'], 'darwin')
    expect(env).toEqual({ PATH: '/usr/bin' })
  })

  it('collapses Windows PATH keys onto `Path`', () => {
    const env = { Path: 'C:\\Windows', PATH: 'C:\\Other', USERPROFILE: 'C:\\Users\\u' }
    expect(prependPathDirs(env, ['C:\\helper'], 'win32')).toEqual({
      Path: 'C:\\helper;C:\\Windows',
      USERPROFILE: 'C:\\Users\\u',
    })
  })

  it('creates PATH when missing', () => {
    expect(prependPathDirs({}, ['/helper'], 'linux')).toEqual({ PATH: '/helper' })
    expect(prependPathDirs({}, ['C:\\helper'], 'win32')).toEqual({ PATH: 'C:\\helper' })
  })

  it('returns an unchanged copy when there are no dirs', () => {
    const env = { PATH: '/usr/bin' }
    const out = prependPathDirs(env, [], 'linux')
    expect(out).toEqual(env)
    expect(out).not.toBe(env)
  })
})
