// T0546 (C4) — the node_modules whitelist in package.json build.files must cover everything the
// main process loads at runtime.
//
// electron-builder only takes the *exclusion* patterns of build.files for node_modules
// (app-builder-lib getNodeModuleFileMatcher), so the whitelist is one negated extglob:
// `!node_modules/!(<kept names>){,/**}`. These tests run package.json through electron-builder's
// own matchers (app-builder-lib fileMatcher / macroExpander) for each target:
//
//   1. every package required by the built dist-electron graph (string-literal require /
//      require.resolve / `<createRequire>.resolve("<pkg>/package.json")`, scanned with the same
//      scanner as scripts/verify-packaged-native.js), every computed-path package
//      (dynamicRuntimePackages) and every vite.config.ts rollup external, plus the
//      package-lock `dependencies` closure of each, survives the filter;
//   2. the blind spot — a require whose argument is not a string literal (template literal,
//      variable, createRequire) — is found in the electron/ *sources*: every file with such a
//      site must be registered in DYNAMIC_REQUIRE_SITES with the packages it loads, and those
//      packages must be in dynamicRuntimePackages(). A new dynamic site fails here until it is
//      registered and whitelisted;
//   3. what T0546 removes stays removed (renderer-only packages, the SDK-bundled claude, the
//      second Windows claude.exe, other platforms' whisper builds), and the app files matcher
//      still packs only dist / dist-electron / assets / package.json.
//
// Part 1 needs a build (`npx vite build`); without dist-electron/main.js it is skipped and the
// vite externals + dynamic packages are still checked. The packaged artifact itself is checked
// in CI by `verify-packaged-native.js --platform <win|mac|linux>` (runtime-require).

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = require('../../package.json')
const lock = require('../../package-lock.json')
const { DIST_ELECTRON_ENTRIES, allowedWhisperDistDirs, dynamicRuntimePackages, scanExternalRequires } = require('../verify-packaged-native.js')
const { getMainFileMatchers, getNodeModuleFileMatcher } = require(path.join(REPO, 'node_modules', 'app-builder-lib', 'out', 'fileMatcher.js'))
const { expandMacro } = require(path.join(REPO, 'node_modules', 'app-builder-lib', 'out', 'util', 'macroExpander.js'))

/** `os` = electron-builder's ${os} macro (platform buildConfigurationKey); platform = Node name. */
const TARGETS = [
  { os: 'win', platform: 'win32', arch: 'x64' },
  { os: 'mac', platform: 'darwin', arch: 'arm64' },
  { os: 'linux', platform: 'linux', arch: 'x64' },
]

/**
 * Files in electron/ that load a package through a non-literal require (see header, part 2),
 * with the packages they load (${platform} / ${arch} = the target's Node platform / arch).
 */
const DYNAMIC_REQUIRE_SITES = {
  // resolveClaudeCodePackageJson: createRequire(...).resolve('@anthropic-ai/claude-code/package.json')
  'electron/claude-runtime-router.ts': ['@anthropic-ai/claude-code'],
  // resolveBundledCodexPath: `@openai/codex-${process.platform}-${process.arch}`
  'electron/codex-agent-manager.ts': ['@openai/codex-${platform}-${arch}'],
  // loadWhisperAddon: `${WHISPER_ADDON_PACKAGE}/package.json`, then the addon by absolute path
  'electron/whisper-addon-loader.ts': ['@kutalia/whisper-node-addon'],
}

const DYNAMIC_SITE_PATTERNS = [
  /\bcreateRequire\s*\(/,
  /\brequire(?:\.resolve)?\s*\(\s*[^'"\s)]/,
  /\bimport\s*\(\s*[^'"\s)]/,
  /\bprocess\.dlopen\s*\(/,
]

/** electron-builder normalizes top-level `files` strings into one FileSet (app-builder-lib config normalizeFiles). */
function builderConfig() {
  return { ...pkg.build, files: [{ filter: [...pkg.build.files] }] }
}

function macroExpander(target) {
  return (pattern) => expandMacro(pattern, target.arch, { productName: pkg.build.productName }, { os: target.os, '/*': '{,/**/*}' })
}

/** The node_modules filter electron-builder builds for `target`; paths are '/'-separated, relative to the app. */
function nodeModulesFilter(target) {
  const config = builderConfig()
  const matcher = getNodeModuleFileMatcher(REPO, REPO, macroExpander(target), config[target.os], { config, debugLogger: { isEnabled: false } })
  const filter = matcher.createFilter()
  return (rel, isDirectory = false) =>
    filter(path.join(REPO, ...rel.split('/')), { moduleFullFilePath: rel.split('/').join(path.sep), isDirectory: () => isDirectory })
}

function mainMatchers(target) {
  const config = builderConfig()
  const packager = { info: { projectDir: REPO, buildResourcesDir: 'build', isPrepackedAppAsar: false, config, debugLogger: { isEnabled: false } } }
  return getMainFileMatchers(REPO, path.join(REPO, 'out-app'), macroExpander(target), config[target.os], packager, path.join(REPO, 'release'), false)
}

/** Package names in the package-lock `dependencies` closure of `names` (nested copies resolved first). */
function dependencyClosure(names) {
  const packages = lock.packages
  const resolve = (from, name) => {
    let base = from
    for (;;) {
      const key = `${base ? `${base}/` : ''}node_modules/${name}`
      if (packages[key]) return key
      if (!base) return null
      const i = base.lastIndexOf('/node_modules/')
      base = i < 0 ? '' : base.slice(0, i)
    }
  }
  const seen = new Set()
  const result = new Set(names)
  const queue = names.map((name) => `node_modules/${name}`)
  while (queue.length) {
    const key = queue.pop()
    if (seen.has(key) || !packages[key]) continue
    seen.add(key)
    for (const dep of Object.keys(packages[key].dependencies || {})) {
      const depKey = resolve(key, dep)
      if (!depKey) continue
      result.add(dep)
      queue.push(depKey)
    }
  }
  return [...result].sort()
}

function viteExternals() {
  const source = fs.readFileSync(path.join(REPO, 'vite.config.ts'), 'utf8')
  const names = new Set()
  for (const block of source.matchAll(/external:\s*\[([\s\S]*?)\]/g)) {
    for (const m of block[1].matchAll(/'([^']+)'/g)) names.add(m[1])
  }
  return [...names].sort()
}

function sourceFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const distBuilt = fs.existsSync(path.join(REPO, 'dist-electron', 'main.js'))
const scanned = distBuilt
  ? scanExternalRequires((rel) => {
    try {
      return fs.readFileSync(path.join(REPO, ...rel.split('/')), 'utf8')
    } catch {
      return null
    }
  }, DIST_ELECTRON_ENTRIES)
  : null

describe('package.json build config shape (T0546)', () => {
  it('no build.<platform>.files: platform-level files replace the app matcher and pack the whole repo', () => {
    // Found while implementing T0546: string patterns in build.win.files become a separate,
    // exclusion-only matcher that electron-builder completes with `**/*` — app.asar then held
    // src/, .claude/, dist-baseline/ … (508 MiB). Per-platform rules use ${os} / ${arch} macros
    // in the top-level build.files instead.
    for (const key of ['win', 'mac', 'linux']) expect(pkg.build[key].files).toBeUndefined()
  })

  it.each(TARGETS)('$os: the app matcher packs only dist / dist-electron / assets / package.json', (target) => {
    const matchers = mainMatchers(target)
    expect(matchers).toHaveLength(1)
    const filter = matchers[0].createFilter()
    const packs = (rel) => filter(path.join(REPO, ...rel.split('/')), { isDirectory: () => false })
    for (const rel of ['dist/index.html', 'dist-electron/main.js', 'dist-electron/terminal-server.js', 'assets/icon.png', 'package.json']) {
      expect(packs(rel), rel).toBe(true)
    }
    for (const rel of ['src/App.tsx', 'electron/main.ts', 'dist-baseline/bat-server-linux-x64-v1.0.0.tar.gz', '_ct-workorders/T0546-installer-slim-stage1.md', 'scripts/verify-packaged-native.js', 'e2e/fixtures/electron-isolation.ts']) {
      expect(packs(rel), rel).toBe(false)
    }
  })
})

describe('dynamic require sites in electron/ are registered (T0546 C4 blind spot)', () => {
  it('every file with a non-literal require / createRequire / dlopen is listed in DYNAMIC_REQUIRE_SITES', () => {
    const found = {}
    for (const file of sourceFiles(path.join(REPO, 'electron'))) {
      const rel = path.relative(REPO, file).split(path.sep).join('/')
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
        if (DYNAMIC_SITE_PATTERNS.some((re) => re.test(line))) (found[rel] ??= []).push(`${i + 1}: ${line.trim()}`)
      })
    }
    expect(Object.keys(found).sort(), JSON.stringify(found, null, 2)).toEqual(Object.keys(DYNAMIC_REQUIRE_SITES).sort())
  })

  it.each(TARGETS)('$os: every registered package is in dynamicRuntimePackages()', (target) => {
    const expected = Object.values(DYNAMIC_REQUIRE_SITES).flat()
      .map((name) => name.replace('${platform}', target.platform).replace('${arch}', target.arch))
    expect(dynamicRuntimePackages(target.platform, target.arch).sort()).toEqual([...new Set(expected)].sort())
  })
})

describe.each(TARGETS)('node_modules whitelist for $os $arch', (target) => {
  const keeps = nodeModulesFilter(target)
  const kept = (name) => keeps(`node_modules/${name}/package.json`)

  function expectCovered(roots) {
    const missing = dependencyClosure(roots).filter((name) => !kept(name))
    expect(missing, `not covered by the node_modules whitelist in package.json build.files: ${missing.join(', ')}`).toEqual([])
  }

  it('covers the vite rollup externals, the computed-path packages and their platform binaries', () => {
    // bufferutil / utf-8-validate are optional peers of ws and are not installed.
    const externals = viteExternals().filter((name) => name !== 'bufferutil' && name !== 'utf-8-validate')
    expect(externals).toEqual(['@kutalia/whisper-node-addon', '@lydell/node-pty', 'ws'])
    expectCovered([
      ...externals,
      ...dynamicRuntimePackages(target.platform, target.arch),
      `@anthropic-ai/claude-code-${target.platform}-${target.arch}`,
      `@lydell/node-pty-${target.platform}-${target.arch}`,
    ])
  })

  it.skipIf(!distBuilt)('covers every package the built dist-electron requires, with its dependencies (needs `npx vite build`)', () => {
    const names = [...scanned.packages.keys()]
    expect(names).toEqual(expect.arrayContaining(['ws', '@lydell/node-pty']))
    expectCovered(names)
  })

  it('drops what the main process never loads (renderer libraries, the SDK-bundled claude)', () => {
    for (const name of ['mermaid', 'highlight.js', 'react', 'react-dom', '@xterm/xterm', 'i18next', 'marked', 'dompurify', 'simple-git', 'selfsigned',
      '@anthropic-ai/claude-agent-sdk', `@anthropic-ai/claude-agent-sdk-${target.platform}-${target.arch}`, '@anthropic-ai/sdk', '@modelcontextprotocol/sdk', 'zod']) {
      expect(kept(name), name).toBe(false)
    }
  })

  it('Windows keeps only claude-code/bin/claude.exe (C1)', () => {
    expect(keeps('node_modules/@anthropic-ai/claude-code/bin/claude.exe')).toBe(true)
    expect(keeps(`node_modules/@anthropic-ai/claude-code-win32-${target.arch}/claude.exe`)).toBe(false)
    expect(keeps(`node_modules/@anthropic-ai/claude-code-win32-${target.arch}/package.json`)).toBe(true)
  })

  it('whisper keeps js/ and this platform only (C5)', () => {
    const allowed = allowedWhisperDistDirs(target.platform, target.arch)
    const installed = fs.readdirSync(path.join(REPO, 'node_modules', '@kutalia', 'whisper-node-addon', 'dist'))
    // darwin-<arch> is the loader's fallback dir; the pattern keeps it on every platform
    // (no per-platform condition in a glob). The addon ships none today; a future one would
    // be caught in CI by verify-packaged-native's whisper-platforms check.
    const dirs = [...new Set([...installed, 'mac-arm64', 'mac-x64', 'linux-x64', 'linux-arm64', 'win32-x64', 'win32-arm64', ...allowed])]
    for (const dir of dirs) {
      expect(keeps(`node_modules/@kutalia/whisper-node-addon/dist/${dir}/whisper.node`), dir).toBe(allowed.includes(dir))
    }
    expect(keeps('node_modules/@kutalia/whisper-node-addon/package.json')).toBe(true)
  })
})
