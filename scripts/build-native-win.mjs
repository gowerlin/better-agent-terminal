#!/usr/bin/env node
/**
 * `npm run build:native-win` — BUG-213 / T0866 (D291): build the Windows stdio-inheritance addon
 * (native/win-stdio-inherit, N-API, kernel32 only) with node-gyp.
 *
 * - win32-x64: `node-gyp rebuild` in native/win-stdio-inherit (node-gyp is a devDependency, run from node_modules,
 *   never through `npm rebuild` or an install script), then load the result in this Node and call disable() /
 *   restore() once. Needs MSVC (Visual Studio Build Tools, "Desktop development with C++") and Python, as any
 *   node-gyp build does; the GitHub Windows runners have both.
 * - win32 on another arch: exit 1 (only x64 is shipped).
 * - macOS / Linux: prints that there is nothing to build and exits 0 (the addon is Windows only).
 *
 * The result is not committed (native/win-stdio-inherit/build is git-ignored). Without it BAT still runs:
 * electron/win-stdio-inherit.ts fails open; Windows packaging requires it (verify-native-modules, afterPack).
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { ADDON_ARCHS, ADDON_SOURCE_DIR, builtAddonPath } = require('./win-stdio-inherit.cjs')

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const tag = '[build-native-win]'

if (process.platform !== 'win32') {
  console.log(`${tag} ${process.platform}: nothing to build (the stdio-inheritance addon is Windows only, BUG-213)`)
  process.exit(0)
}
if (!ADDON_ARCHS.includes(process.arch)) {
  console.error(`${tag} ❌ win32-${process.arch}: the addon is built for win32-${ADDON_ARCHS.join(', win32-')} only`)
  process.exit(1)
}

const nodeGyp = path.join(projectRoot, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js')
if (!fs.existsSync(nodeGyp)) {
  console.error(`${tag} ❌ ${nodeGyp} not found; run \`npm install\` (node-gyp is a devDependency)`)
  process.exit(1)
}

const sourceDir = path.join(projectRoot, ...ADDON_SOURCE_DIR.split('/'))
const started = Date.now()
try {
  execFileSync(process.execPath, [nodeGyp, 'rebuild', `--arch=${process.arch}`, '--release'], {
    cwd: sourceDir,
    stdio: 'inherit',
    timeout: 10 * 60 * 1000,
  })
} catch (err) {
  console.error(`${tag} ❌ node-gyp rebuild failed (${err.status ?? err.code ?? err.message})`)
  console.error(`${tag} needs MSVC (Visual Studio Build Tools, "Desktop development with C++") and Python`)
  process.exit(1)
}

const built = builtAddonPath(projectRoot)
if (!fs.existsSync(built)) {
  console.error(`${tag} ❌ node-gyp finished but ${built} is missing`)
  process.exit(1)
}

// smoke: the addon loads and both functions work (this Node already disabled stdio inheritance at startup,
// so disable() usually finds nothing; restore([]) restores nothing)
const mod = { exports: {} }
try {
  process.dlopen(mod, built)
  const saved = mod.exports.disable()
  if (!Array.isArray(saved) || saved.some((h) => typeof h !== 'bigint')) throw new Error('disable() did not return a BigInt array')
  const restored = mod.exports.restore(saved)
  if (restored !== saved.length) throw new Error(`restore() restored ${restored} of ${saved.length}`)
} catch (err) {
  console.error(`${tag} ❌ ${built} does not load or work: ${err.message}`)
  process.exit(1)
}

console.log(`${tag} ✅ ${path.relative(projectRoot, built)} (${fs.statSync(built).size} bytes, ${Date.now() - started} ms)`)
