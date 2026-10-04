// BUG-083 / T0373 — choosing the newest Codex CLI.

import { describe, it, expect } from 'vitest'
import * as path from 'path'

import {
  parseCodexVersion,
  compareCodexVersions,
  pickNewestCodex,
  findCodexOnPathDirs,
  collectCodexCandidates,
  probeCodexVersion,
  type CodexCandidate,
  type CodexCandidateEnv,
} from '../codex-runtime-resolver'

const cand = (source: CodexCandidate['source'], version?: string, p = `/bin/${source}`): CodexCandidate =>
  ({ path: p, source, version, pathDirs: source === 'embedded' ? ['/helpers'] : [] })

describe('parseCodexVersion', () => {
  it('parses plain and suffixed versions', () => {
    expect(parseCodexVersion('codex-cli 0.160.0')).toBe('0.160.0')
    expect(parseCodexVersion('codex-cli 0.160.0\r\n')).toBe('0.160.0')
    expect(parseCodexVersion('codex-cli 0.161.0-alpha.3')).toBe('0.161.0-alpha.3')
    expect(parseCodexVersion('codex-cli v1.2.3-rc1')).toBe('1.2.3-rc1')
  })

  it('finds the version line among other output', () => {
    expect(parseCodexVersion('WARNING: something\ncodex-cli 0.142.5\n')).toBe('0.142.5')
  })

  it('returns undefined for unrelated output', () => {
    expect(parseCodexVersion('')).toBeUndefined()
    expect(parseCodexVersion('codex 0.160.0')).toBeUndefined()
    expect(parseCodexVersion('codex-cli dev')).toBeUndefined()
  })
})

describe('compareCodexVersions', () => {
  it('compares numerically, not lexically', () => {
    expect(compareCodexVersions('0.160.0', '0.99.0')).toBeGreaterThan(0)
    expect(compareCodexVersions('0.142.5', '0.160.0')).toBeLessThan(0)
    expect(compareCodexVersions('1.0.0', '0.999.999')).toBeGreaterThan(0)
    expect(compareCodexVersions('0.160.1', '0.160.0')).toBeGreaterThan(0)
    expect(compareCodexVersions('0.160.0', '0.160.0')).toBe(0)
  })

  it('sorts a pre-release below its release', () => {
    expect(compareCodexVersions('0.161.0-alpha.1', '0.161.0')).toBeLessThan(0)
    expect(compareCodexVersions('0.161.0', '0.161.0-alpha.1')).toBeGreaterThan(0)
    // ...but above the previous release
    expect(compareCodexVersions('0.161.0-alpha.1', '0.160.0')).toBeGreaterThan(0)
  })

  it('orders pre-release identifiers per semver', () => {
    expect(compareCodexVersions('0.161.0-alpha.2', '0.161.0-alpha.10')).toBeLessThan(0)
    expect(compareCodexVersions('0.161.0-alpha', '0.161.0-alpha.1')).toBeLessThan(0)
    expect(compareCodexVersions('0.161.0-alpha.1', '0.161.0-beta')).toBeLessThan(0)
    expect(compareCodexVersions('0.161.0-1', '0.161.0-alpha')).toBeLessThan(0)
    expect(compareCodexVersions('0.161.0-rc.1', '0.161.0-rc.1')).toBe(0)
  })

  it('sorts unparsable versions below valid ones', () => {
    expect(compareCodexVersions('garbage', '0.0.1')).toBeLessThan(0)
    expect(compareCodexVersions('0.0.1', 'garbage')).toBeGreaterThan(0)
    expect(compareCodexVersions('garbage', 'other')).toBe(0)
  })
})

describe('pickNewestCodex', () => {
  it('picks the highest version', () => {
    const picked = pickNewestCodex([cand('embedded', '0.160.0'), cand('desktop-app', '0.142.5'), cand('path', '0.161.0')])
    expect(picked?.source).toBe('path')
  })

  it('prefers embedded on a version tie, then installer > desktop-app > path', () => {
    expect(pickNewestCodex([cand('path', '0.160.0'), cand('installer', '0.160.0'), cand('embedded', '0.160.0')])?.source).toBe('embedded')
    expect(pickNewestCodex([cand('path', '0.160.0'), cand('desktop-app', '0.160.0'), cand('installer', '0.160.0')])?.source).toBe('installer')
    expect(pickNewestCodex([cand('path', '0.160.0'), cand('desktop-app', '0.160.0')])?.source).toBe('desktop-app')
  })

  it('keeps the earlier candidate on a full tie', () => {
    const picked = pickNewestCodex([cand('desktop-app', '0.160.0', '/a'), cand('desktop-app', '0.160.0', '/b')])
    expect(picked?.path).toBe('/a')
  })

  it('ignores candidates whose version could not be read', () => {
    const picked = pickNewestCodex([cand('embedded'), cand('installer', '0.142.5'), cand('path')])
    expect(picked?.source).toBe('installer')
  })

  it('a release beats its own pre-release from a preferred source', () => {
    expect(pickNewestCodex([cand('embedded', '0.161.0-alpha.1'), cand('path', '0.161.0')])?.source).toBe('path')
  })

  it('falls back to embedded when no version is known', () => {
    const picked = pickNewestCodex([cand('path'), cand('embedded'), cand('installer')])
    expect(picked?.source).toBe('embedded')
    expect(picked?.pathDirs).toEqual(['/helpers'])
  })

  it('falls back to the first candidate when no version is known and nothing is embedded', () => {
    expect(pickNewestCodex([cand('installer'), cand('path')])?.source).toBe('installer')
  })

  it('returns undefined for no candidates', () => {
    expect(pickNewestCodex([])).toBeUndefined()
  })
})

function fakeEnv(opts: {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  files: string[]
  dirs?: Record<string, string[]>
}): CodexCandidateEnv {
  const norm = (p: string) => (opts.platform === 'win32' ? p.toLowerCase() : p)
  const files = new Set(opts.files.map(norm))
  return {
    platform: opts.platform,
    env: opts.env,
    homedir: opts.platform === 'win32' ? 'C:\\Users\\me' : '/home/me',
    isExecutableFile: p => files.has(norm(p)),
    listDirs: dir => opts.dirs?.[dir] ?? [],
  }
}

describe('findCodexOnPathDirs', () => {
  it('accepts only codex.exe on Windows, skipping npm shims, in PATH order', () => {
    const deps = fakeEnv({
      platform: 'win32',
      env: { Path: 'C:\\Users\\me\\AppData\\Roaming\\npm;"C:\\Tools";C:\\proj\\node_modules\\.bin;;C:\\Other' },
      files: [
        'C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd',
        'C:\\Users\\me\\AppData\\Roaming\\npm\\codex',
        'C:\\Tools\\codex.exe',
        'C:\\proj\\node_modules\\.bin\\codex.exe',
        'C:\\Other\\codex.exe',
      ],
    })
    expect(findCodexOnPathDirs(deps)).toEqual(['C:\\Tools\\codex.exe', 'C:\\Other\\codex.exe'])
  })

  it('reads the PATH key case-insensitively on Windows', () => {
    const deps = fakeEnv({ platform: 'win32', env: { PATH: 'C:\\Tools' }, files: ['C:\\Tools\\codex.exe'] })
    expect(findCodexOnPathDirs(deps)).toEqual(['C:\\Tools\\codex.exe'])
  })

  it('accepts an extension-less codex on POSIX but not under node_modules/.bin', () => {
    const deps = fakeEnv({
      platform: 'linux',
      env: { PATH: '/repo/node_modules/.bin:/usr/local/bin:/usr/bin' },
      files: ['/repo/node_modules/.bin/codex', '/usr/local/bin/codex', '/usr/bin/codex'],
    })
    expect(findCodexOnPathDirs(deps)).toEqual(['/usr/local/bin/codex', '/usr/bin/codex'])
  })

  it('returns nothing without PATH', () => {
    expect(findCodexOnPathDirs(fakeEnv({ platform: 'linux', env: {}, files: [] }))).toEqual([])
  })
})

describe('collectCodexCandidates', () => {
  const lad = 'C:\\Users\\me\\AppData\\Local'
  const installer = `${lad}\\Programs\\OpenAI\\Codex\\bin\\codex.exe`
  const desktopRoot = `${lad}\\OpenAI\\Codex\\bin`
  const embedded = { binary: 'C:\\bat\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe', pathDirs: ['C:\\bat\\vendor\\x86_64-pc-windows-msvc\\codex-path'] }

  it('collects embedded, installer, every Desktop App build and PATH on Windows; dedupes PATH', () => {
    const deps = fakeEnv({
      platform: 'win32',
      // The installer adds its own bin dir to PATH (seen on the T0366 machine).
      env: { LOCALAPPDATA: lad, Path: `${lad}\\Programs\\OpenAI\\Codex\\bin;C:\\Tools` },
      files: [embedded.binary, installer, `${desktopRoot}\\bbb\\codex.exe`, `${desktopRoot}\\aaa\\codex.exe`, 'C:\\Tools\\codex.exe'],
      dirs: { [desktopRoot]: ['bbb', 'empty', 'aaa'] },
    })
    expect(collectCodexCandidates(embedded, deps)).toEqual([
      { path: embedded.binary, source: 'embedded', pathDirs: embedded.pathDirs },
      { path: installer, source: 'installer', pathDirs: [] },
      { path: `${desktopRoot}\\aaa\\codex.exe`, source: 'desktop-app', pathDirs: [] },
      { path: `${desktopRoot}\\bbb\\codex.exe`, source: 'desktop-app', pathDirs: [] },
      { path: 'C:\\Tools\\codex.exe', source: 'path', pathDirs: [] },
    ])
  })

  it('derives LOCALAPPDATA from the home dir when unset', () => {
    const deps = fakeEnv({ platform: 'win32', env: {}, files: [installer] })
    expect(collectCodexCandidates(undefined, deps)).toEqual([{ path: installer, source: 'installer', pathDirs: [] }])
  })

  it('only checks PATH and embedded off Windows', () => {
    const deps = fakeEnv({
      platform: 'darwin',
      env: { PATH: '/opt/homebrew/bin', LOCALAPPDATA: lad },
      files: ['/opt/homebrew/bin/codex', installer],
      dirs: { [desktopRoot]: ['aaa'] },
    })
    const bundled = { binary: '/bat/vendor/aarch64-apple-darwin/bin/codex', pathDirs: [] }
    expect(collectCodexCandidates(bundled, deps).map(c => c.source)).toEqual(['embedded', 'path'])
  })

  it('returns an empty list when nothing is installed', () => {
    expect(collectCodexCandidates(undefined, fakeEnv({ platform: 'win32', env: {}, files: [] }))).toEqual([])
  })
})

describe('probeCodexVersion', () => {
  it('returns undefined for a missing binary', async () => {
    expect(await probeCodexVersion(path.join(__dirname, 'no-such-codex-binary'))).toBeUndefined()
  })

  it('returns undefined for a file that is not a codex executable', async () => {
    expect(await probeCodexVersion(__filename)).toBeUndefined()
  })
})
