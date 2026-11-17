// T0877 / D298 — `foreign-platform-package` in scripts/verify-packaged-native.js: the judgement rules on fake
// packaged file lists (asar root relative, '/'-separated), per target platform, plus parity with the sources the
// judgement list names (package-lock.json `os` / `cpu`, codexTargetTriple in electron/codex-agent-manager.ts).
// The checks on fake electron-builder output trees are in verify-packaged-native.test.mjs (describe 'foreign-platform-package').

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const { CODEX_TARGET_TRIPLES, foreignPlatformEntries, platformPackageTarget } = require('../verify-packaged-native.js')

/** What a healthy package of each target ships (T0877 inventory of release/win-unpacked, plus the same set per platform). */
function healthyFiles(platform, arch) {
  const triple = CODEX_TARGET_TRIPLES[`${platform}-${arch}`]
  const exe = platform === 'win32' ? '.exe' : ''
  const whisperDir = platform === 'darwin' ? `mac-${arch}` : `${platform}-${arch}`
  return [
    'package.json',
    'dist-electron/main.js',
    'node_modules/ws/package.json',
    'node_modules/node-addon-api/package.json',
    'node_modules/@anthropic-ai/claude-code/package.json',
    'node_modules/@anthropic-ai/claude-code/bin/claude.exe',
    `node_modules/@anthropic-ai/claude-code-${platform}-${arch}/package.json`,
    `node_modules/@anthropic-ai/claude-code-${platform}-${arch}/claude${exe}`,
    'node_modules/@lydell/node-pty/package.json',
    `node_modules/@lydell/node-pty-${platform}-${arch}/package.json`,
    `node_modules/@lydell/node-pty-${platform}-${arch}/prebuilds/${platform}-${arch}/pty.node`,
    'node_modules/@openai/codex-sdk/package.json',
    `node_modules/@openai/codex-${platform}-${arch}/package.json`,
    `node_modules/@openai/codex-${platform}-${arch}/vendor/${triple}/bin/codex${exe}`,
    `node_modules/@openai/codex-${platform}-${arch}/vendor/${triple}/codex-resources/voice/bin/x`,
    'node_modules/@kutalia/whisper-node-addon/package.json',
    'node_modules/@kutalia/whisper-node-addon/dist/js/index.js',
    `node_modules/@kutalia/whisper-node-addon/dist/${whisperDir}/whisper.node`,
  ]
}

const TARGETS = [
  ['win32', 'x64'],
  ['linux', 'x64'],
  ['darwin', 'arm64'],
]

describe('foreignPlatformEntries (T0877)', () => {
  it.each(TARGETS)('%s %s: the healthy package passes', (platform, arch) => {
    expect(foreignPlatformEntries(healthyFiles(platform, arch), platform, arch)).toEqual([])
  })

  it.each(TARGETS)('%s %s: every other target\'s platform packages and codex vendor dirs are flagged', (platform, arch) => {
    for (const [otherPlatform, otherArch] of TARGETS.filter(([p, a]) => p !== platform || a !== arch)) {
      const other = `${otherPlatform}-${otherArch}`
      const intruders = healthyFiles(otherPlatform, otherArch).filter((f) => f.includes(other) || f.includes(CODEX_TARGET_TRIPLES[other]))
      const found = foreignPlatformEntries([...healthyFiles(platform, arch), ...intruders], platform, arch)
      expect(found.map((e) => e.path)).toEqual([
        `node_modules/@anthropic-ai/claude-code-${other}`,
        `node_modules/@lydell/node-pty-${other}`,
        `node_modules/@openai/codex-${other}`,
      ])
      expect(found.every((e) => e.target === other)).toBe(true)
    }
  })

  it('the T0873 case: linux node-pty + linux claude in a Windows x64 package', () => {
    const files = [
      ...healthyFiles('win32', 'x64'),
      'node_modules/@lydell/node-pty-linux-x64/package.json',
      'node_modules/@lydell/node-pty-linux-x64/pty.node',
      'node_modules/@anthropic-ai/claude-code-linux-x64/claude',
    ]
    expect(foreignPlatformEntries(files, 'win32', 'x64')).toEqual([
      { path: 'node_modules/@anthropic-ai/claude-code-linux-x64', target: 'linux-x64' },
      { path: 'node_modules/@lydell/node-pty-linux-x64', target: 'linux-x64' },
    ])
  })

  it('same platform, other arch is foreign (mac arm64 app with darwin-x64, win x64 with win32-arm64)', () => {
    expect(foreignPlatformEntries(['node_modules/@anthropic-ai/claude-code-darwin-x64/claude'], 'darwin', 'arm64'))
      .toEqual([{ path: 'node_modules/@anthropic-ai/claude-code-darwin-x64', target: 'darwin-x64' }])
    expect(foreignPlatformEntries(['node_modules/@openai/codex-win32-arm64/package.json'], 'win32', 'x64'))
      .toEqual([{ path: 'node_modules/@openai/codex-win32-arm64', target: 'win32-arm64' }])
  })

  it('a libc qualifier never makes a package foreign; it does not hide another platform either', () => {
    expect(foreignPlatformEntries(['node_modules/@anthropic-ai/claude-code-linux-x64-musl/claude'], 'linux', 'x64')).toEqual([])
    expect(foreignPlatformEntries(['node_modules/@anthropic-ai/claude-code-linux-x64-musl/claude'], 'win32', 'x64'))
      .toEqual([{ path: 'node_modules/@anthropic-ai/claude-code-linux-x64-musl', target: 'linux-x64' }])
    expect(foreignPlatformEntries(['node_modules/@rollup/rollup-win32-x64-msvc/x.node'], 'win32', 'x64')).toEqual([])
  })

  it('a nested node_modules package and a foreign-only codex vendor dir inside the right package are flagged', () => {
    expect(foreignPlatformEntries([
      'node_modules/some-dep/node_modules/@esbuild/darwin-arm64/bin/esbuild',
      'node_modules/@openai/codex-linux-x64/vendor/x86_64-apple-darwin/bin/codex',
    ], 'linux', 'x64')).toEqual([
      { path: 'node_modules/@openai/codex-linux-x64/vendor/x86_64-apple-darwin', target: 'darwin-x64' },
      { path: 'node_modules/some-dep/node_modules/@esbuild/darwin-arm64', target: 'darwin-arm64' },
    ])
  })

  it('prebuilds/<platform>-<arch>[+<arch>]: the target (or a multi-arch dir that includes it) passes, others fail', () => {
    const base = 'node_modules/some-addon/prebuilds'
    expect(foreignPlatformEntries([`${base}/darwin-x64+arm64/a.node`], 'darwin', 'arm64')).toEqual([])
    expect(foreignPlatformEntries([`${base}/win32-x64/a.node`, `${base}/linux-arm64/a.node`, `${base}/darwin-x64+arm64/a.node`], 'win32', 'x64'))
      .toEqual([
        { path: `${base}/darwin-x64+arm64`, target: 'darwin-x64+arm64' },
        { path: `${base}/linux-arm64`, target: 'linux-arm64' },
      ])
  })

  it('names that are not platform + arch are not judged (whisper dist/ is C5, not this check)', () => {
    const files = [
      'node_modules/@openai/codex-sdk/package.json',
      'node_modules/@anthropic-ai/claude-code/package.json',
      'node_modules/linux-utils/package.json',
      'node_modules/foo-x64/package.json',
      'node_modules/@openai/codex-win32-x64/vendor/unknown-triple/bin/codex.exe',
      'node_modules/@kutalia/whisper-node-addon/dist/linux-x64/libwhisper.so',
      'dist/assets/darwin-arm64.svg',
    ]
    expect(foreignPlatformEntries(files, 'win32', 'x64')).toEqual([])
  })
})

describe('judgement list sources (T0877)', () => {
  it('package-lock.json: every package with os / cpu whose name parses targets exactly that os / cpu', () => {
    const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'))
    const checked = []
    for (const [key, meta] of Object.entries(lock.packages)) {
      if (!key || !meta.os || !meta.cpu) continue
      const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length)
      const target = platformPackageTarget(name)
      if (target === null) continue
      expect(meta.os, name).toContain(target.platform)
      expect(meta.cpu, name).toContain(target.arch)
      checked.push(name)
    }
    expect(checked.length).toBeGreaterThan(0)
  })

  it('package-lock.json: every platform package of the scopes build.files keeps (@anthropic-ai, @lydell, @openai) parses', () => {
    const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'))
    const kept = Object.entries(lock.packages)
      .filter(([key, meta]) => key && meta.os && meta.cpu && /node_modules\/@(anthropic-ai|lydell|openai)\//.test(key))
      .map(([key]) => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length))
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.filter((name) => platformPackageTarget(name) === null)).toEqual([])
  })

  it('CODEX_TARGET_TRIPLES = codexTargetTriple() in electron/codex-agent-manager.ts', () => {
    const source = readFileSync(path.join(ROOT, 'electron', 'codex-agent-manager.ts'), 'utf8')
    const body = source.slice(source.indexOf('function codexTargetTriple'), source.indexOf('function findBundledCodex'))
    const fromSource = Object.fromEntries(
      [...body.matchAll(/platform === '([^']+)' && arch === '([^']+)'\) return '([^']+)'/g)].map((m) => [`${m[1]}-${m[2]}`, m[3]]),
    )
    expect(Object.keys(fromSource).length).toBeGreaterThan(0)
    expect(CODEX_TARGET_TRIPLES).toEqual(fromSource)
  })
})
