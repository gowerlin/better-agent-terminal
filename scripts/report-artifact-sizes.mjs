#!/usr/bin/env node
/**
 * T0546: print the size of what electron-builder produced, and what the unpacked app is
 * made of, to the job log. Data source for re-deciding the installer size cap (D094).
 * Read-only, and never fails the build on size: there is no threshold.
 *
 * Usage (after electron-builder, any platform):
 *   node scripts/report-artifact-sizes.mjs [--out <dir>] [--top <n>]
 *
 *   --out   electron-builder output directory (default: <repo>/release)
 *   --top   how many app.asar.unpacked packages to list (default: 12)
 *
 * Lists:
 *   - artifacts: top-level installers / archives in <out> (.exe .zip .dmg .AppImage …)
 *   - per unpacked app (win-unpacked, linux-unpacked, mac-<arch>/<name>.app): total size,
 *     app.asar, app.asar.unpacked (largest packages), each bat-server-baseline file, other
 *     resources, and the rest (Electron itself)
 *
 * Sizes are bytes on disk of the unpacked tree (not compressed); MiB = 1,048,576 bytes.
 */

import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MIB = 1024 * 1024
const ARTIFACT_EXTENSIONS = ['.exe', '.zip', '.dmg', '.AppImage', '.deb', '.rpm', '.snap', '.tar.gz', '.7z', '.nupkg']

export function formatMiB(bytes) {
  return `${(bytes / MIB).toFixed(1)} MiB`
}

function safeReaddir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/** Total bytes of regular files under `target` (a file or a directory); symlinks are not followed. */
export function diskUsage(target) {
  let total = 0
  const stack = [target]
  while (stack.length) {
    const current = stack.pop()
    let stat
    try {
      stat = statSync(current, { throwIfNoEntry: false })
    } catch {
      continue
    }
    if (!stat) continue
    if (stat.isFile()) {
      total += stat.size
      continue
    }
    if (!stat.isDirectory()) continue
    for (const entry of safeReaddir(current)) {
      if (entry.isSymbolicLink()) continue
      stack.push(path.join(current, entry.name))
    }
  }
  return total
}

/** Installers / archives directly in `outDir`, largest first. */
export function collectArtifacts(outDir) {
  return safeReaddir(outDir)
    .filter((e) => e.isFile() && ARTIFACT_EXTENSIONS.some((ext) => e.name.endsWith(ext)))
    .map((e) => ({ name: e.name, bytes: statSync(path.join(outDir, e.name)).size }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
}

/**
 * Unpacked apps electron-builder leaves next to the artifacts:
 * `win-unpacked` / `win-<arch>-unpacked`, `linux-unpacked` / `linux-<arch>-unpacked`
 * (resources in `<dir>/resources`) and `mac` / `mac-<arch>` holding `<name>.app`
 * (resources in `Contents/Resources`).
 */
export function collectUnpackedApps(outDir) {
  const apps = []
  for (const entry of safeReaddir(outDir)) {
    if (!entry.isDirectory()) continue
    const dir = path.join(outDir, entry.name)
    if (/^(win|linux)(-[a-z0-9]+)?-unpacked$/.test(entry.name)) {
      apps.push({ label: entry.name, root: dir, resources: path.join(dir, 'resources') })
    } else if (/^mac(-[a-z0-9]+)?$/.test(entry.name)) {
      for (const app of safeReaddir(dir)) {
        if (app.isDirectory() && app.name.endsWith('.app')) {
          const root = path.join(dir, app.name)
          apps.push({ label: `${entry.name}/${app.name}`, root, resources: path.join(root, 'Contents', 'Resources') })
        }
      }
    }
  }
  return apps.sort((a, b) => a.label.localeCompare(b.label))
}

/** `node_modules/<pkg>` and `node_modules/@scope/<pkg>` directories under `nodeModulesDir`. */
function packageDirs(nodeModulesDir) {
  const result = []
  for (const entry of safeReaddir(nodeModulesDir)) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('@')) {
      for (const scoped of safeReaddir(path.join(nodeModulesDir, entry.name))) {
        if (scoped.isDirectory()) result.push({ name: `${entry.name}/${scoped.name}`, dir: path.join(nodeModulesDir, entry.name, scoped.name) })
      }
    } else {
      result.push({ name: entry.name, dir: path.join(nodeModulesDir, entry.name) })
    }
  }
  return result
}

/** Size breakdown of one unpacked app. */
export function summarizeApp(app, top = 12) {
  const total = diskUsage(app.root)
  const resourcesTotal = diskUsage(app.resources)
  const asar = diskUsage(path.join(app.resources, 'app.asar'))
  const unpackedDir = path.join(app.resources, 'app.asar.unpacked')
  const unpacked = diskUsage(unpackedDir)
  const packages = packageDirs(path.join(unpackedDir, 'node_modules'))
    .map((p) => ({ name: p.name, bytes: diskUsage(p.dir) }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
  const baselineDir = path.join(app.resources, 'bat-server-baseline')
  const baselines = safeReaddir(baselineDir)
    .filter((e) => e.isFile())
    .map((e) => ({ name: e.name, bytes: statSync(path.join(baselineDir, e.name)).size }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
  const baselineTotal = baselines.reduce((sum, b) => sum + b.bytes, 0)
  return {
    label: app.label,
    total,
    asar,
    unpacked,
    unpackedPackages: packages.slice(0, top),
    unpackedPackageCount: packages.length,
    baselines,
    otherResources: Math.max(0, resourcesTotal - asar - unpacked - baselineTotal),
    rest: Math.max(0, total - resourcesTotal),
  }
}

export function buildReport(outDir, top = 12) {
  return {
    outDir,
    artifacts: collectArtifacts(outDir),
    apps: collectUnpackedApps(outDir).map((app) => summarizeApp(app, top)),
  }
}

export function formatReport(report) {
  const lines = [`[report-artifact-sizes] ${report.outDir}`]
  if (report.artifacts.length === 0) {
    lines.push('  artifacts: none')
  } else {
    lines.push('  artifacts:')
    for (const a of report.artifacts) lines.push(`    ${formatMiB(a.bytes).padStart(12)}  ${a.name}`)
  }
  for (const app of report.apps) {
    lines.push(`  ${app.label}: ${formatMiB(app.total)} unpacked`)
    lines.push(`    ${formatMiB(app.asar).padStart(12)}  app.asar`)
    lines.push(`    ${formatMiB(app.unpacked).padStart(12)}  app.asar.unpacked (${app.unpackedPackageCount} packages)`)
    for (const p of app.unpackedPackages) lines.push(`    ${formatMiB(p.bytes).padStart(12)}    node_modules/${p.name}`)
    for (const b of app.baselines) lines.push(`    ${formatMiB(b.bytes).padStart(12)}  bat-server-baseline/${b.name}`)
    lines.push(`    ${formatMiB(app.otherResources).padStart(12)}  other resources`)
    lines.push(`    ${formatMiB(app.rest).padStart(12)}  Electron and the rest`)
  }
  if (report.apps.length === 0) lines.push('  unpacked apps: none')
  return lines.join('\n')
}

export function parseArgs(argv, repoRoot) {
  const opts = { outDir: path.join(repoRoot, 'release'), top: 12 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--out' && argv[i + 1]) {
      opts.outDir = path.resolve(argv[++i])
    } else if (arg === '--top' && argv[i + 1]) {
      opts.top = Number(argv[++i])
      if (!Number.isInteger(opts.top) || opts.top < 0) throw new Error('--top needs a non-negative integer')
    } else {
      throw new Error(`unknown or incomplete argument: ${arg}`)
    }
  }
  return opts
}

function main() {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  let opts
  try {
    opts = parseArgs(process.argv.slice(2), repoRoot)
  } catch (err) {
    console.error(`[report-artifact-sizes] ${err.message}`)
    console.error('[report-artifact-sizes] usage: node scripts/report-artifact-sizes.mjs [--out <dir>] [--top <n>]')
    process.exit(1)
  }
  console.log(formatReport(buildReport(opts.outDir, opts.top)))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
