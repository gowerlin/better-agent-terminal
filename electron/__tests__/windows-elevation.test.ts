// BUG-085 / T0377 — Windows elevation detection via `whoami /groups`.

import { describe, it, expect } from 'vitest'

import {
  HIGH_MANDATORY_LEVEL_SID,
  parseWhoamiGroupsElevated,
  getWhoamiPath,
  detectWindowsElevation,
  type ElevationDetectDeps,
} from '../windows-elevation'

const HIGH_OUTPUT = [
  'GROUP INFORMATION',
  '-----------------',
  '',
  'Group Name                                  Type             SID          Attributes',
  '=========================================== ================ ============ ===============================================================',
  'Everyone                                    Well-known group S-1-1-0      Mandatory group, Enabled by default, Enabled group',
  'BUILTIN\\Administrators                      Alias            S-1-5-32-544 Mandatory group, Enabled by default, Enabled group, Group owner',
  'Mandatory Label\\High Mandatory Level        Label            S-1-16-12288',
].join('\r\n')

const MEDIUM_OUTPUT = [
  'Everyone                                    Well-known group S-1-1-0      Mandatory group, Enabled by default, Enabled group',
  'BUILTIN\\Administrators                      Alias            S-1-5-32-544 Group used for deny only',
  'Mandatory Label\\Medium Mandatory Level      Label            S-1-16-8192',
].join('\r\n')

type Callback = Parameters<NonNullable<ElevationDetectDeps['execFile']>>[3]

function fakeExecFile(result: { error?: Error; stdout?: string }, calls: Array<{ file: string; args: string[]; timeout?: number }> = []) {
  return (file: string, args: string[], options: { timeout?: number }, cb: Callback) => {
    calls.push({ file, args, timeout: options.timeout })
    cb(result.error ?? null, result.stdout ?? '', '')
  }
}

describe('parseWhoamiGroupsElevated', () => {
  it('detects High Mandatory Level', () => {
    expect(HIGH_MANDATORY_LEVEL_SID).toBe('S-1-16-12288')
    expect(parseWhoamiGroupsElevated(HIGH_OUTPUT)).toBe(true)
  })

  it('is false for Medium Mandatory Level', () => {
    expect(parseWhoamiGroupsElevated(MEDIUM_OUTPUT)).toBe(false)
  })

  it('is false for empty / missing output', () => {
    expect(parseWhoamiGroupsElevated('')).toBe(false)
    expect(parseWhoamiGroupsElevated(null)).toBe(false)
    expect(parseWhoamiGroupsElevated(undefined)).toBe(false)
  })

  it('relies on the SID, not the (localized) group name', () => {
    expect(parseWhoamiGroupsElevated('強制標籤\\高強制層級   標籤   S-1-16-12288')).toBe(true)
    expect(parseWhoamiGroupsElevated('Mandatory Label\\High Mandatory Level')).toBe(false)
  })

  it('does not match longer SIDs sharing the prefix', () => {
    expect(parseWhoamiGroupsElevated('Label S-1-16-122880')).toBe(false)
    expect(parseWhoamiGroupsElevated('Label S-1-16-12288-1')).toBe(false)
  })
})

describe('getWhoamiPath', () => {
  it('uses the absolute System32 path, never a bare `whoami`', () => {
    expect(getWhoamiPath('C:\\Windows')).toBe('C:\\Windows\\System32\\whoami.exe')
    expect(getWhoamiPath('D:\\WINNT')).toBe('D:\\WINNT\\System32\\whoami.exe')
  })
})

describe('detectWindowsElevation', () => {
  it('resolves false on non-Windows without spawning', async () => {
    const calls: Array<{ file: string; args: string[] }> = []
    await expect(detectWindowsElevation({ platform: 'darwin', execFile: fakeExecFile({ stdout: HIGH_OUTPUT }, calls) })).resolves.toBe(false)
    await expect(detectWindowsElevation({ platform: 'linux', execFile: fakeExecFile({ stdout: HIGH_OUTPUT }, calls) })).resolves.toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('runs System32 whoami /groups with a 5s timeout and parses High', async () => {
    const calls: Array<{ file: string; args: string[]; timeout?: number }> = []
    await expect(detectWindowsElevation({
      platform: 'win32',
      systemRoot: 'C:\\Windows',
      execFile: fakeExecFile({ stdout: HIGH_OUTPUT }, calls),
    })).resolves.toBe(true)
    expect(calls).toEqual([{ file: 'C:\\Windows\\System32\\whoami.exe', args: ['/groups'], timeout: 5000 }])
  })

  it('resolves false for Medium integrity output', async () => {
    await expect(detectWindowsElevation({ platform: 'win32', execFile: fakeExecFile({ stdout: MEDIUM_OUTPUT }) })).resolves.toBe(false)
  })

  it('resolves false on spawn error / timeout', async () => {
    const err = Object.assign(new Error('spawn ETIMEDOUT'), { killed: true })
    await expect(detectWindowsElevation({ platform: 'win32', execFile: fakeExecFile({ error: err, stdout: HIGH_OUTPUT }) })).resolves.toBe(false)
  })

  it('resolves false when execFile throws synchronously', async () => {
    const throwing = () => { throw new Error('EINVAL') }
    await expect(detectWindowsElevation({ platform: 'win32', execFile: throwing })).resolves.toBe(false)
  })
})
