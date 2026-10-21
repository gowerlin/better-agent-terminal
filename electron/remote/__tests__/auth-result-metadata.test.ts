// @vitest-environment node
/**
 * T0270: `auth-result` may carry server metadata; RemoteClient stores it and
 * picks the path translator from the bound profile, falling back to Identity
 * when the profile cannot build one. Moved from tests/auth-result-metadata.test.ts
 * by T0680 (BUG-168): WSL has a real translator since T0273, so the fallback case
 * now uses a wsl-linux profile without `wslDistro`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileEntry } from '../../profile-manager'
import type { AuthResult, AuthResultMetadata } from '../protocol'
import { RemoteClient } from '../remote-client'
import { IdentityTranslator, WslPathTranslator } from '../path-translator'
import { logger } from '../../logger'

const METADATA: AuthResultMetadata = {
  serverPlatform: 'linux',
  serverArch: 'x64',
  serverEnv: 'native',
  nodeVersion: '24.0.0',
  bundleVersion: '0.3.1',
}

function makeProfile(partial: Partial<ProfileEntry>): ProfileEntry {
  return {
    id: 'profile-demo',
    name: 'Demo Remote',
    type: 'remote',
    remoteHost: '127.0.0.1',
    remotePort: 9876,
    remoteToken: 'demo-token',
    createdAt: 1,
    updatedAt: 2,
    ...partial,
  }
}

function applyAuthResult(client: RemoteClient, result: AuthResult): void {
  ;(client as unknown as { applyAuthResult: (value: AuthResult) => void }).applyAuthResult(result)
}

describe('auth-result metadata', () => {
  afterEach(() => vi.restoreAllMocks())

  it('AuthResult accepts the legacy boolean and the metadata object', () => {
    const legacy: AuthResult = true
    const withMetadata: AuthResult = METADATA
    expect(legacy).toBe(true)
    expect(typeof withMetadata).toBe('object')
    expect((withMetadata as AuthResultMetadata).serverPlatform).toBe('linux')
  })

  it('stores the metadata when auth-result carries an object', () => {
    const client = new RemoteClient(() => [], makeProfile({ targetOS: 'local' }))
    applyAuthResult(client, METADATA)
    expect(client.serverMetadata).toEqual(METADATA)
    expect(client.pathTranslator).toBeInstanceOf(IdentityTranslator)
  })

  it('a legacy boolean auth-result clears the metadata and uses Identity', () => {
    const client = new RemoteClient(() => [], makeProfile({ targetOS: 'local' }))
    applyAuthResult(client, METADATA)
    applyAuthResult(client, true)
    expect(client.serverMetadata).toBeNull()
    expect(client.pathTranslator).toBeInstanceOf(IdentityTranslator)
  })

  it('keeps Identity when the profile has no targetOS', () => {
    const { serverEnv: _serverEnv, ...withoutEnv } = METADATA
    const client = new RemoteClient(() => [], makeProfile({ targetOS: undefined }))
    applyAuthResult(client, withoutEnv)
    expect(client.pathTranslator).toBeInstanceOf(IdentityTranslator)
  })

  it('a wsl-linux profile with wslDistro gets the WSL translator (T0273)', () => {
    const client = new RemoteClient(() => [], makeProfile({ targetOS: 'wsl-linux', wslDistro: 'Ubuntu' }))
    applyAuthResult(client, METADATA)
    expect(client.serverMetadata).toEqual(METADATA)
    expect(client.pathTranslator).toBeInstanceOf(WslPathTranslator)
  })

  it('falls back to Identity when the profile cannot build its translator', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const client = new RemoteClient(() => [], makeProfile({ targetOS: 'wsl-linux', wslDistro: undefined }))
    applyAuthResult(client, METADATA)
    expect(client.serverMetadata).toEqual(METADATA)
    expect(client.pathTranslator).toBeInstanceOf(IdentityTranslator)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][1])).toContain('missing wslDistro')
  })
})
