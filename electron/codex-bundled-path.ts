import * as pathModule from 'path'

// Pure helpers for locating the Codex native binary inside a per-platform
// package (@openai/codex-<platform>-<arch>) and for building the spawn env.
// Mirrors @openai/codex-sdk 0.160 `resolveNativePackage()` / `prependPathDirs()`
// (dist/index.js) so BAT's codexPathOverride path behaves like the SDK default.

export interface BundledCodexLayout {
  binary: string
  /** Helper dirs (e.g. rg) the SDK prepends to the child PATH; only existing dirs. */
  pathDirs: string[]
}

/**
 * Given the platform package root (dir containing its package.json), return the
 * native binary and helper PATH dirs. Supports both layouts:
 *   - >= 0.160: vendor/<triple>/bin/<exe> + vendor/<triple>/codex-package.json,
 *               helpers in vendor/<triple>/codex-path/
 *   - legacy:   vendor/<triple>/codex/<exe>, helpers in vendor/<triple>/path/
 */
export function resolveBundledCodexLayout(
  pkgRoot: string,
  triple: string,
  exe: string,
  exists: (p: string) => boolean,
): BundledCodexLayout | undefined {
  const packageRoot = pathModule.join(pkgRoot, 'vendor', triple)

  const binary = pathModule.join(packageRoot, 'bin', exe)
  if (exists(binary) && exists(pathModule.join(packageRoot, 'codex-package.json'))) {
    const helperDir = pathModule.join(packageRoot, 'codex-path')
    return { binary, pathDirs: exists(helperDir) ? [helperDir] : [] }
  }

  const legacyBinary = pathModule.join(packageRoot, 'codex', exe)
  if (exists(legacyBinary)) {
    const helperDir = pathModule.join(packageRoot, 'path')
    return { binary: legacyBinary, pathDirs: exists(helperDir) ? [helperDir] : [] }
  }

  return undefined
}

/**
 * Return a copy of `env` with `pathDirs` prepended to PATH. On Windows the PATH
 * key is case-insensitive: keep a single key (prefer `Path`) and drop the rest,
 * matching the SDK's own behaviour.
 */
export function prependPathDirs(
  env: Record<string, string>,
  pathDirs: string[],
  platform: NodeJS.Platform = process.platform,
): Record<string, string> {
  const out = { ...env }
  if (pathDirs.length === 0) return out

  let pathKey = 'PATH'
  if (platform === 'win32') {
    const matching = Object.keys(out).filter(key => key.toLowerCase() === 'path')
    pathKey = matching.includes('Path') ? 'Path' : matching[matching.length - 1] ?? 'PATH'
    for (const key of matching) {
      if (key !== pathKey) delete out[key]
    }
  }

  const delimiter = platform === 'win32' ? ';' : ':'
  const existing = (out[pathKey] ?? '')
    .split(delimiter)
    .filter(entry => entry.length > 0 && !pathDirs.includes(entry))
  out[pathKey] = [...pathDirs, ...existing].join(delimiter)
  return out
}
