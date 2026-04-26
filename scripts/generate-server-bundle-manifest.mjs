#!/usr/bin/env node
/**
 * Generate server bundle manifest.json for GitHub Release publish.
 *
 * 工單：T0315（PLAN-031 Sprint 2）
 * Spec：_ct-workorders/_spec-server-bundle-distribution.md §9
 *
 * CLI:
 *   node scripts/generate-server-bundle-manifest.mjs \
 *     --input-dir <path>     # contains 3 tarballs + 3 sidecars
 *     --version <semver>     # e.g., 0.5.0
 *     --build-date <iso8601> # e.g., 2026-04-27T00:00:00Z
 *     --output <path>        # e.g., manifest.json
 */

import { readFileSync, statSync, writeFileSync, readdirSync } from 'fs'
import path from 'path'

const SCHEMA_VERSION = '1'
const ARCHES = ['linux-x64', 'linux-arm64', 'darwin-arm64']
const TARBALL_RE = /^bat-server-(linux-x64|linux-arm64|darwin-arm64)-v(.+)\.tar\.gz$/

function fail(msg) {
  console.error(`[generate-manifest] ❌ ${msg}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { 'input-dir': null, version: null, 'build-date': null, output: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/generate-server-bundle-manifest.mjs ' +
          '--input-dir <path> --version <semver> --build-date <iso8601> --output <path>'
      )
      process.exit(0)
    }
    let key = null
    let value = null
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=')
      key = arg.slice(2, eq)
      value = arg.slice(eq + 1)
    } else if (arg.startsWith('--')) {
      key = arg.slice(2)
      value = argv[i + 1]
      i += 1
    } else {
      fail(`Unknown positional argument: ${arg}`)
    }
    if (!(key in args)) fail(`Unknown flag: --${key}`)
    if (value === undefined || value === '') fail(`Missing value for --${key}`)
    args[key] = value
  }
  for (const k of Object.keys(args)) {
    if (!args[k]) fail(`Required flag missing: --${k}`)
  }
  return args
}

function parseSidecar(content) {
  // 標準 sha256sum 格式：<64-hex>  <filename>\n（雙空格分隔）
  const trimmed = content.trim()
  if (!trimmed) return { error: 'sidecar empty' }
  const parts = trimmed.split(/\s+/)
  if (parts.length < 1) return { error: 'sidecar has no hash' }
  const hash = parts[0]
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return { error: `sidecar hash not 64-char lowercase hex: "${hash}"` }
  }
  return { hash }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const inputDir = path.resolve(args['input-dir'])
  const version = args.version
  const buildDate = args['build-date']
  const outputPath = path.resolve(args.output)

  // 驗 buildDate 是合法 ISO 8601（寬鬆：能被 Date 解析）
  if (Number.isNaN(Date.parse(buildDate))) {
    fail(`--build-date is not a valid ISO 8601 timestamp: "${buildDate}"`)
  }

  // 列 inputDir 內所有 .tar.gz
  let entries
  try {
    entries = readdirSync(inputDir)
  } catch (e) {
    fail(`Cannot read --input-dir "${inputDir}": ${e.message}`)
  }

  /** @type {Record<string, { filename: string; sha256: string; size: number }>} */
  const tarballs = {}

  for (const entry of entries) {
    const m = TARBALL_RE.exec(entry)
    if (!m) continue
    const arch = m[1]
    const tarVersion = m[2]
    if (tarVersion !== version) {
      fail(
        `Tarball version mismatch: file="${entry}" parsed-version="${tarVersion}" --version="${version}". ` +
          `All tarballs must match --version.`
      )
    }
    if (tarballs[arch]) {
      fail(`Duplicate tarball for arch "${arch}": ${tarballs[arch].filename} and ${entry}`)
    }
    const tarballPath = path.join(inputDir, entry)
    const sidecarPath = `${tarballPath}.sha256`
    let sidecarContent
    try {
      sidecarContent = readFileSync(sidecarPath, 'utf8')
    } catch (e) {
      fail(`Missing sha256 sidecar for ${entry} (expected ${path.basename(sidecarPath)}): ${e.message}`)
    }
    const parsed = parseSidecar(sidecarContent)
    if (parsed.error) {
      fail(`Invalid sha256 sidecar for ${entry}: ${parsed.error}`)
    }
    let size
    try {
      size = statSync(tarballPath).size
    } catch (e) {
      fail(`Cannot stat tarball ${entry}: ${e.message}`)
    }
    tarballs[arch] = { filename: entry, sha256: parsed.hash, size }
  }

  // 驗 3 arch 齊全
  const missing = ARCHES.filter((a) => !tarballs[a])
  if (missing.length > 0) {
    fail(
      `Missing tarball(s) for arch: ${missing.join(', ')}. ` +
        `Expected pattern: bat-server-<arch>-v${version}.tar.gz in ${inputDir}`
    )
  }

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    version,
    buildDate,
    tarballs: {
      'linux-x64': tarballs['linux-x64'],
      'linux-arm64': tarballs['linux-arm64'],
      'darwin-arm64': tarballs['darwin-arm64'],
    },
  }

  try {
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  } catch (e) {
    fail(`Cannot write --output "${outputPath}": ${e.message}`)
  }

  const totalSize = Object.values(manifest.tarballs).reduce((sum, t) => sum + t.size, 0)
  console.log(
    `[generate-manifest] ✓ Manifest generated: ${path.relative(process.cwd(), outputPath)}, ` +
      `${ARCHES.length} tarballs, total ${totalSize} bytes`
  )
}

main()
