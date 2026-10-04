// @vitest-environment node
/**
 * T0404 / BUG-103: auth metadata `serverEnv` is detected instead of hard-coded 'native'.
 *
 * - detectServerEnv: WSL_DISTRO_NAME / /proc/version "microsoft" (any case) ⇒ 'wsl';
 *   neither, non-Linux, or a failing probe ⇒ 'native'.
 * - buildAuthMetadata: 'wsl' carries wslDistro + serverHome; 'native' keeps its old shape.
 * - Over the wire (headless harness): the auth-result of a simulated WSL server.
 */
import * as os from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import { buildAuthMetadata, detectServerEnv } from '../remote-server'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const WSL_KERNEL = 'Linux version 6.6.87.2-microsoft-standard-WSL2 (root@...) #1 SMP'
const NATIVE_KERNEL = 'Linux version 6.8.0-45-generic (buildd@lcy02-amd64-075) #45-Ubuntu SMP'
const fail = () => { throw new Error('EACCES: /proc/version') }

describe('detectServerEnv', () => {
  it('WSL_DISTRO_NAME ⇒ wsl with the distro', () => {
    expect(detectServerEnv({ platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu-24.04' }, readProcVersion: () => NATIVE_KERNEL }))
      .toEqual({ serverEnv: 'wsl', wslDistro: 'Ubuntu-24.04' })
  })

  it('/proc/version mentioning Microsoft (any case) ⇒ wsl without a distro (systemd units may lack WSL_DISTRO_NAME)', () => {
    expect(detectServerEnv({ platform: 'linux', env: {}, readProcVersion: () => WSL_KERNEL })).toEqual({ serverEnv: 'wsl' })
    expect(detectServerEnv({ platform: 'linux', env: {}, readProcVersion: () => 'Linux version 4.4.0-19041-Microsoft' }))
      .toEqual({ serverEnv: 'wsl' })
    expect(detectServerEnv({ platform: 'linux', env: { WSL_DISTRO_NAME: '  ' }, readProcVersion: () => WSL_KERNEL }))
      .toEqual({ serverEnv: 'wsl' })
  })

  it('neither marker ⇒ native', () => {
    expect(detectServerEnv({ platform: 'linux', env: {}, readProcVersion: () => NATIVE_KERNEL })).toEqual({ serverEnv: 'native' })
  })

  it('/proc/version unreadable ⇒ native (never throws)', () => {
    expect(detectServerEnv({ platform: 'linux', env: {}, readProcVersion: fail })).toEqual({ serverEnv: 'native' })
  })

  it('non-Linux is native even with WSL markers around', () => {
    for (const platform of ['win32', 'darwin'] as const) {
      expect(detectServerEnv({ platform, env: { WSL_DISTRO_NAME: 'Ubuntu' }, readProcVersion: () => WSL_KERNEL }))
        .toEqual({ serverEnv: 'native' })
    }
  })

  it('the real process probe answers without throwing', () => {
    expect(['native', 'wsl']).toContain(detectServerEnv().serverEnv)
  })
})

describe('buildAuthMetadata', () => {
  it('wsl ⇒ serverEnv wsl + wslDistro + serverHome', () => {
    const meta = buildAuthMetadata({ serverEnv: 'wsl', wslDistro: 'Ubuntu-24.04' })
    expect(meta).toMatchObject({ serverEnv: 'wsl', wslDistro: 'Ubuntu-24.04', serverHome: os.homedir() })
    expect(meta.nodeVersion).toBe(process.versions.node)
  })

  it('wsl detected from /proc/version only ⇒ no wslDistro key', () => {
    const meta = buildAuthMetadata({ serverEnv: 'wsl' })
    expect(meta.serverEnv).toBe('wsl')
    expect('wslDistro' in meta).toBe(false)
  })

  it('native keeps the pre-T0404 shape (no wslDistro / serverHome)', () => {
    const meta = buildAuthMetadata({ serverEnv: 'native' })
    expect(meta.serverEnv).toBe('native')
    expect(Object.keys(meta).sort()).toEqual(['bundleVersion', 'nodeVersion', 'serverArch', 'serverEnv', 'serverPlatform'])
  })
})

describe('auth-result over the wire (headless harness)', () => {
  let harness: HeadlessHarness | null = null
  afterEach(async () => {
    await harness?.dispose()
    harness = null
  })

  it('a simulated WSL server answers serverEnv wsl + wslDistro', { timeout: 30_000 }, async () => {
    harness = await startHeadlessHarness({
      detectServerEnv: () => detectServerEnv({ platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu-24.04' }, readProcVersion: () => WSL_KERNEL }),
    })
    expect(harness.authResult).toMatchObject({ serverEnv: 'wsl', wslDistro: 'Ubuntu-24.04', serverHome: os.homedir() })
    const second = await harness.connect()
    expect(second.authResult).toMatchObject({ serverEnv: 'wsl', wslDistro: 'Ubuntu-24.04' })
  })

  it('a failing probe still authenticates, as native', { timeout: 30_000 }, async () => {
    harness = await startHeadlessHarness({
      detectServerEnv: () => detectServerEnv({ platform: 'linux', env: {}, readProcVersion: fail }),
    })
    expect(harness.authResult).toMatchObject({ serverEnv: 'native' })
  })
})
