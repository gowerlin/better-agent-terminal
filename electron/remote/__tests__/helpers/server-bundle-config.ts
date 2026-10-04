/**
 * T0388: read the server-bundle esbuild settings out of
 * `scripts/build-server-bundle.mjs` instead of copying them.
 *
 * Copying drifts: a hand-copied externals list missed 6 entries in the Tower's
 * 2026-10-04 manual deploy. The script runs `main()` and parses argv at module
 * load, so it cannot be imported; parse its source. Any shape change that
 * breaks a step here throws — the guard must fail loudly rather than test a
 * stale config. (T0391's `scripts/dev-deploy-headless.mjs` parses the same
 * source; consolidate the two parsers if either is reworked.)
 */
import * as fs from 'fs'
import * as path from 'path'

export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..')
export const BUILD_SERVER_BUNDLE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'build-server-bundle.mjs')

export interface ServerBundleEsbuildConfig {
  /** Absolute paths. */
  entryPoints: string[]
  external: string[]
  platform: string
  target: string
  format: string
}

function fail(what: string): never {
  throw new Error(`build-server-bundle.mjs: ${what} — update electron/remote/__tests__/helpers/server-bundle-config.ts`)
}

function quoted(text: string): string[] {
  return [...text.matchAll(/'([^']+)'/g)].map(m => m[1])
}

function optionLiteral(block: string, key: string): string {
  const m = block.match(new RegExp(`\\b${key}\\s*:\\s*'([^']+)'`))
  return m ? m[1] : fail(`\`${key}: '...'\` not found in bundleServerEntry()`)
}

export function parseServerBundleEsbuildConfig(source: string, projectRoot = PROJECT_ROOT): ServerBundleEsbuildConfig {
  const externalsMatch = source.match(/const\s+externalPackages\s*=\s*\[([\s\S]*?)\]/)
  if (!externalsMatch) fail('`const externalPackages = [...]` not found')
  const external = quoted(externalsMatch[1])
  if (external.length === 0) fail('externalPackages is empty')

  const fnMatch = source.match(/async\s+function\s+bundleServerEntry\s*\(\s*\)\s*\{([\s\S]*?)\n\}/)
  if (!fnMatch) fail('bundleServerEntry() not found')
  const block = fnMatch[1]
  if (!/\bexternal\s*:\s*externalPackages\b/.test(block)) fail('build() no longer passes `external: externalPackages`')

  const entryMatch = block.match(/entryPoints\s*:\s*\[([\s\S]*?)\]/)
  if (!entryMatch) fail('entryPoints not found in bundleServerEntry()')
  const entryPoints = [...entryMatch[1].matchAll(/resolveProjectPath\(([^)]*)\)/g)]
    .map(m => path.join(projectRoot, ...quoted(m[1])))
  if (entryPoints.length === 0) fail('no resolveProjectPath(...) entryPoints parsed')

  return {
    entryPoints,
    external,
    platform: optionLiteral(block, 'platform'),
    target: optionLiteral(block, 'target'),
    format: optionLiteral(block, 'format'),
  }
}

export function loadServerBundleEsbuildConfig(): ServerBundleEsbuildConfig {
  return parseServerBundleEsbuildConfig(fs.readFileSync(BUILD_SERVER_BUNDLE_SCRIPT, 'utf8'))
}
