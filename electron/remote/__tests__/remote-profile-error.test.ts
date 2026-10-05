/**
 * T0385 (BUG-094): opening a remote profile used to map every failure to
 * "not running or did not respond within 6 seconds". These cover the three
 * classes main.ts now distinguishes.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyConnectFailure,
  classifyInvokeFailure,
  describeRemoteProfileFailure,
  getRemoteProfileLimitStrings,
} from '../remote-profile-error'

const base = { host: 'localhost', port: 9877, label: 'WSL Ubuntu-24.04' }

describe('classifyConnectFailure', () => {
  it('treats refused / timeout / tunnel failures as unreachable', () => {
    expect(classifyConnectFailure({ ok: false, error: 'connect ECONNREFUSED 127.0.0.1:9877', errorCode: 'network' })).toBe('unreachable')
    expect(classifyConnectFailure({ ok: false, error: 'Connection timeout', errorCode: 'timeout' })).toBe('unreachable')
    expect(classifyConnectFailure({ ok: false, error: 'SSH tunnel unavailable: x', errorCode: 'network' })).toBe('unreachable')
    expect(classifyConnectFailure({ ok: false })).toBe('unreachable')
  })

  it('treats fingerprint mismatch and rejected token as trust failures', () => {
    expect(classifyConnectFailure({ ok: false, error: 'Server fingerprint does not match the pinned value', errorCode: 'fingerprint-mismatch' })).toBe('trust')
    expect(classifyConnectFailure({ ok: false, error: 'Invalid token', errorCode: 'auth-failed' })).toBe('trust')
  })
})

describe('classifyInvokeFailure', () => {
  it('treats a server-side handler error as a protocol failure', () => {
    expect(classifyInvokeFailure(new Error('No handler for channel: profile:load-snapshot'))).toBe('protocol')
    expect(classifyInvokeFailure('something exploded on the server')).toBe('protocol')
  })

  it('treats transport errors raised by RemoteClient.invoke as unreachable', () => {
    expect(classifyInvokeFailure(new Error('Remote invoke timeout: profile:load-snapshot'))).toBe('unreachable')
    expect(classifyInvokeFailure(new Error('Not connected to remote server'))).toBe('unreachable')
    expect(classifyInvokeFailure(new Error('Connection closed'))).toBe('unreachable')
    expect(classifyInvokeFailure(new Error('Disconnected'))).toBe('unreachable')
  })
})

describe('describeRemoteProfileFailure', () => {
  it('keeps the original "not running" wording for unreachable', () => {
    const d = describeRemoteProfileFailure({ ...base, reason: 'unreachable', error: 'Connection timeout' })
    expect(d.title).toBe('Remote profile unreachable')
    expect(d.detail).toContain('is not running or did not respond within 6 seconds')
    expect(d.detail).toContain('Error: Connection timeout')
  })

  it('points trust failures at fingerprint / token, not at a dead server', () => {
    const d = describeRemoteProfileFailure({ ...base, reason: 'trust', error: 'Invalid token' })
    expect(d.title).toBe('Remote profile not trusted')
    expect(d.detail).toMatch(/fingerprint/)
    expect(d.detail).toMatch(/token/)
    expect(d.detail).not.toContain('not running')
  })

  it('reports protocol failures as an incompatible server and includes the raw error', () => {
    const d = describeRemoteProfileFailure({ ...base, reason: 'protocol', error: 'No handler for channel: profile:load-snapshot' })
    expect(d.title).toBe('Remote server incompatible')
    expect(d.detail).toContain('localhost:9877')
    expect(d.detail).toMatch(/incompatible/)
    expect(d.detail).toContain('No handler for channel: profile:load-snapshot')
    expect(d.detail).not.toContain('not running')
  })

  it('omits the error suffix when no error text is available', () => {
    const d = describeRemoteProfileFailure({ ...base, reason: 'unreachable' })
    expect(d.detail).not.toContain('Error:')
  })
})

describe('limit (T0464, PLAN-039)', () => {
  const limit = { ...base, reason: 'limit' as const, limit: 8, error: 'Too many remote profiles connected at once (limit 8)' }

  it('has its own dialog, not "unreachable", with the cap and the idle grace filled in', () => {
    const d = describeRemoteProfileFailure(limit, { idleGraceMs: 15_000 })
    expect(d.title).toBe('Remote profile limit reached')
    expect(d.message).toBe('Cannot open remote profile "WSL Ubuntu-24.04"')
    expect(d.detail).toContain('8 remote profiles are already connected')
    expect(d.detail).toContain('15 seconds')
    expect(d.detail).not.toContain('not running')
    expect(d.detail).not.toMatch(/\{\{\w+\}\}/)
  })

  it('follows the UI language', () => {
    expect(describeRemoteProfileFailure(limit, { lang: 'zh-TW' }).message).toBe('無法開啟遠端配置「WSL Ubuntu-24.04」')
    expect(describeRemoteProfileFailure(limit, { lang: 'zh-CN' }).message).toBe('无法打开远程配置“WSL Ubuntu-24.04”')
    expect(describeRemoteProfileFailure(limit, { lang: 'ja' }).title).toBe('Remote profile limit reached')
    // The other reasons keep their English text whatever the language.
    expect(describeRemoteProfileFailure({ ...base, reason: 'trust' }, { lang: 'zh-TW' }).title).toBe('Remote profile not trusted')
  })

  it('does not choke on a label that looks like a placeholder', () => {
    const d = describeRemoteProfileFailure({ ...limit, label: '{{limit}} $& x' }, { lang: 'en' })
    expect(d.message).toBe('Cannot open remote profile "{{limit}} $& x"')
  })

  it.each([
    ['en', 'en.json'],
    ['zh-TW', 'zh-TW.json'],
    ['zh-CN', 'zh-CN.json'],
  ])('main-side strings for %s match src/locales/%s', (lang, file) => {
    const locale = JSON.parse(readFileSync(resolve(__dirname, '../../../src/locales', file), 'utf8'))
    expect(getRemoteProfileLimitStrings(lang)).toEqual(locale.remoteProfileLimit)
  })
})
