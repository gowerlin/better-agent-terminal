import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import { execFileSync } from 'child_process'

import { resolveGhBinary } from '../gh-resolver'

const childProcessMocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    accessSync: vi.fn(),
    constants: { X_OK: 1 },
  },
  existsSync: vi.fn(),
  statSync: vi.fn(),
  accessSync: vi.fn(),
  constants: { X_OK: 1 },
}))

vi.mock('child_process', () => ({
  default: { execFileSync: childProcessMocks.execFileSync },
  execFileSync: childProcessMocks.execFileSync,
}))

const existsSyncMock = vi.mocked(fs.existsSync)
const statSyncMock = vi.mocked(fs.statSync)
const accessSyncMock = vi.mocked(fs.accessSync)
const execFileSyncMock = vi.mocked(execFileSync)

const originalEnv = { ...process.env }
const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform })
}

function normalize(p: string): string {
  return path.normalize(p)
}

function mockExecutableFiles(files: string[]): void {
  const normalized = new Set(files.map(normalize))
  existsSyncMock.mockImplementation((candidate) => normalized.has(normalize(String(candidate))))
  statSyncMock.mockImplementation((candidate) => {
    if (!normalized.has(normalize(String(candidate)))) throw new Error('missing')
    return { isFile: () => true } as fs.Stats
  })
  accessSyncMock.mockImplementation((candidate) => {
    if (!normalized.has(normalize(String(candidate)))) throw new Error('not executable')
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env = { ...originalEnv }
  setPlatform('win32')
})

afterEach(() => {
  process.env = { ...originalEnv }
  setPlatform(originalPlatform)
})

describe('resolveGhBinary', () => {
  it('resolves gh.exe from PATH', async () => {
    const dir = 'C:\\Tools\\GitHub CLI'
    const gh = path.join(dir, 'gh.exe')
    process.env.PATH = dir
    mockExecutableFiles([gh])

    const result = await resolveGhBinary()

    expect(result).toMatchObject({ found: true, path: gh, source: 'path' })
    expect(result.attemptedPaths).toContain(gh)
  })

  it('uses a valid customPath before PATH', async () => {
    const custom = 'C:\\Pinned\\gh.exe'
    const pathHit = path.join('C:\\Tools', 'gh.exe')
    process.env.PATH = 'C:\\Tools'
    mockExecutableFiles([custom, pathHit])

    const result = await resolveGhBinary({ customPath: custom })

    expect(result).toMatchObject({ found: true, path: custom, source: 'custom' })
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('rejects unsafe customPath input', async () => {
    mockExecutableFiles([])

    const result = await resolveGhBinary({ customPath: 'gh.exe & whoami' })

    expect(result.found).toBe(false)
    expect(result.error).toContain('absolute executable path')
  })

  it('falls back when customPath does not exist', async () => {
    const pathHit = path.join('C:\\Tools', 'gh.exe')
    process.env.PATH = 'C:\\Tools'
    mockExecutableFiles([pathHit])

    const result = await resolveGhBinary({ customPath: 'C:\\Missing\\gh.exe' })

    expect(result).toMatchObject({ found: true, path: pathHit, source: 'path' })
    expect(result.attemptedPaths[0]).toBe('C:\\Missing\\gh.exe')
  })

  it('resolves common Windows install locations', async () => {
    process.env.PATH = ''
    process.env.ProgramFiles = 'C:\\Program Files'
    const common = path.join('C:\\Program Files', 'GitHub CLI', 'gh.exe')
    mockExecutableFiles([common])

    const result = await resolveGhBinary()

    expect(result).toMatchObject({ found: true, path: common, source: 'common-location' })
  })

  it('uses where.exe as the final Windows fallback', async () => {
    process.env.PATH = ''
    const whereHit = 'C:\\Users\\me\\AppData\\Local\\GitHubCLI\\gh.exe'
    mockExecutableFiles([whereHit])
    execFileSyncMock.mockReturnValue(`${whereHit}\r\n` as never)

    const result = await resolveGhBinary()

    expect(execFileSyncMock).toHaveBeenCalledWith('where.exe', ['gh'], expect.objectContaining({ timeout: 3000 }))
    expect(result).toMatchObject({ found: true, path: whereHit, source: 'where' })
  })

  it('returns attempted paths when gh cannot be found', async () => {
    process.env.PATH = 'C:\\Missing'
    mockExecutableFiles([])
    execFileSyncMock.mockImplementation(() => { throw new Error('not found') })

    const result = await resolveGhBinary()

    expect(result.found).toBe(false)
    expect(result.attemptedPaths).toContain(path.join('C:\\Missing', 'gh.exe'))
    expect(result.error).toContain('not found')
  })
})
