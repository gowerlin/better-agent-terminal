/**
 * T0419 (BUG-096): App.tsx initProfile must hand `remote.connect` the profile's
 * pinned fingerprint (5th argument) — second line of defence next to main's
 * own pinning in `remote:connect`. App has no render harness, so guard the
 * call site in source.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const appSource = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')

function remoteConnectCalls(source: string): string[][] {
  const calls: string[][] = []
  const marker = 'window.electronAPI.remote.connect('
  let from = 0
  for (let at = source.indexOf(marker, from); at !== -1; at = source.indexOf(marker, from)) {
    let depth = 1
    let i = at + marker.length
    const start = i
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === '(') depth++
      else if (source[i] === ')') depth--
    }
    const args = source.slice(start, i - 1).split(',').map(a => a.trim()).filter(Boolean)
    calls.push(args)
    from = i
  }
  return calls
}

describe('App.tsx remote.connect call sites', () => {
  const calls = remoteConnectCalls(appSource)

  it('has the initProfile connect call', () => {
    expect(calls.length).toBeGreaterThan(0)
  })

  it('every call passes the profile fingerprint as the 5th argument', () => {
    for (const args of calls) {
      expect(args).toHaveLength(5)
      expect(args[4]).toMatch(/\.remoteFingerprint$/)
    }
  })
})
