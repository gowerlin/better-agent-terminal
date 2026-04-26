#!/usr/bin/env node
/**
 * fetch-baseline-tarball.mjs — PLAN-031 Sprint 2 / T0316
 *
 * Build pre-step: download server bundle baseline tarballs from GitHub Release
 * into dist-baseline/ so electron-builder's `build.{win|mac|linux}.extraResources`
 * can pack them into the installer. First-run BAT extracts them under
 * userData/bat-server-bundles/ as the distributor (T0320) baseline lookup source.
 *
 * Baseline matrix (T0314 spec §3.1, C-narrow + Mac dual tarball):
 *   win   × x64   → [linux-x64]
 *   mac   × arm64 → [linux-x64, darwin-arm64]
 *   linux × x64   → [linux-x64]
 *   linux × arm64 → [linux-arm64]
 *
 * CLI:
 *   node scripts/fetch-baseline-tarball.mjs \
 *     [--host-os <win|mac|linux>] \
 *     [--host-arch <x64|arm64>] \
 *     [--version <semver>] \
 *     [--output-dir <path>] \
 *     [--source-url <url>] \
 *     [--dry-run]
 *
 * Defaults:
 *   --host-os    BUILD_HOST_OS env, else os.platform() mapped (darwin→mac, win32→win, *→linux)
 *   --host-arch  BUILD_HOST_ARCH env, else os.arch() (x64 / arm64)
 *   --version    package.json `version`
 *   --output-dir dist-baseline/
 *   --source-url https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v${version}
 *
 * Resilience:
 *   - Local cache by SHA: if tarball + sidecar exist and SHA matches, skip download.
 *   - Network retries: exponential backoff 500ms / 1500ms / 3000ms.
 *   - GitHub rate limit: HTTP 403 + X-RateLimit-Remaining: 0 → actionable hint
 *     (retry after X-RateLimit-Reset, or set GITHUB_TOKEN env).
 *
 * SHA inlined (not imported from src/lib/server-bundle-manifest.ts because
 * .mjs cannot consume TS source without a build step). Algorithm matches
 * T0317 createSha256Stream + compareSha256 (timing-safe + lowercase hex).
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

// ---------- baseline matrix ----------

const BASELINE_MATRIX = {
  win: { x64: ['linux-x64'] },
  mac: { arm64: ['linux-x64', 'darwin-arm64'] },
  linux: { x64: ['linux-x64'], arm64: ['linux-arm64'] },
}

const VALID_OS = ['win', 'mac', 'linux']
const VALID_ARCH = ['x64', 'arm64']

// ---------- CLI parse ----------

function parseArgs(argv) {
  const out = { dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--host-os') out.hostOS = argv[++i]
    else if (a === '--host-arch') out.hostArch = argv[++i]
    else if (a === '--version') out.version = argv[++i]
    else if (a === '--output-dir') out.outputDir = argv[++i]
    else if (a === '--source-url') out.sourceUrl = argv[++i]
    else if (a === '--help' || a === '-h') out.help = true
    else {
      console.error(`[fetch-baseline] unknown arg: ${a}`)
      process.exit(2)
    }
  }
  return out
}

function detectDefaultHostOS() {
  if (process.env.BUILD_HOST_OS) return process.env.BUILD_HOST_OS
  const p = os.platform()
  if (p === 'darwin') return 'mac'
  if (p === 'win32') return 'win'
  return 'linux'
}

function detectDefaultHostArch() {
  if (process.env.BUILD_HOST_ARCH) return process.env.BUILD_HOST_ARCH
  const a = os.arch()
  if (a === 'x64') return 'x64'
  if (a === 'arm64') return 'arm64'
  return null
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  return pkg.version
}

function printHelp() {
  console.log(`fetch-baseline-tarball.mjs — PLAN-031 baseline tarball pre-fetcher

Usage:
  node scripts/fetch-baseline-tarball.mjs [options]

Options:
  --host-os <win|mac|linux>      Build target host OS (default: detect)
  --host-arch <x64|arm64>        Build target host arch (default: detect)
  --version <semver>             BAT version (default: package.json)
  --output-dir <path>            Output dir (default: dist-baseline/)
  --source-url <url>             Override release URL prefix
  --dry-run                      Plan only, no download
  -h, --help                     This help

Env:
  BUILD_HOST_OS / BUILD_HOST_ARCH   Override default detection
  GITHUB_TOKEN                      Used as Bearer token to lift rate limit
`)
}

// ---------- SHA256 (inlined; T0317-equivalent semantics) ----------

function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

function compareSha256TimingSafe(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false
  if (expected.length !== 64 || actual.length !== 64) return false
  if (!/^[0-9a-f]{64}$/i.test(expected) || !/^[0-9a-f]{64}$/i.test(actual)) return false
  const a = Buffer.from(expected.toLowerCase(), 'hex')
  const b = Buffer.from(actual.toLowerCase(), 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// ---------- HTTP fetch with retry ----------

async function fetchWithRetry(url, { binary = false } = {}) {
  const attempts = [500, 1500, 3000]
  let lastErr
  for (let i = 0; i <= attempts.length; i++) {
    try {
      const headers = {}
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
      }
      const res = await fetch(url, { headers })
      if (res.status === 403) {
        const remaining = res.headers.get('x-ratelimit-remaining')
        const reset = res.headers.get('x-ratelimit-reset')
        if (remaining === '0') {
          const resetMsg = reset
            ? `retry after ${new Date(Number(reset) * 1000).toISOString()}`
            : 'retry later'
          throw new Error(
            `GitHub rate limit exhausted for ${url}. ${resetMsg}, or set GITHUB_TOKEN env to lift the limit.`,
          )
        }
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
      }
      if (binary) {
        const buf = Buffer.from(await res.arrayBuffer())
        return buf
      }
      return await res.text()
    } catch (err) {
      lastErr = err
      // Rate-limit errors should NOT retry — they will not recover within the 3s window
      if (err.message && err.message.includes('rate limit exhausted')) throw err
      if (i < attempts.length) {
        const delay = attempts[i]
        console.warn(`[fetch-baseline] attempt ${i + 1} failed (${err.message}), retry in ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastErr
}

// ---------- planning ----------

function planTarballs({ hostOS, hostArch, version, sourceUrl, outputDir }) {
  if (!VALID_OS.includes(hostOS)) {
    throw new Error(
      `host-os must be one of ${VALID_OS.join('|')}, got "${hostOS}". See spec §3.1 baseline matrix.`,
    )
  }
  if (!VALID_ARCH.includes(hostArch)) {
    throw new Error(
      `host-arch must be one of ${VALID_ARCH.join('|')}, got "${hostArch}". See spec §3.1 baseline matrix.`,
    )
  }
  const targets = BASELINE_MATRIX[hostOS] && BASELINE_MATRIX[hostOS][hostArch]
  if (!targets) {
    throw new Error(
      `baseline matrix does not recognise "${hostOS} × ${hostArch}". Spec §3.1 only covers: ` +
        `win×x64, mac×arm64, linux×x64, linux×arm64.`,
    )
  }
  const baseUrl =
    sourceUrl ||
    `https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v${version}`
  return targets.map((archTag) => {
    const tarballName = `bat-server-${archTag}-v${version}.tar.gz`
    const sidecarName = `${tarballName}.sha256`
    return {
      archTag,
      tarballName,
      sidecarName,
      tarballUrl: `${baseUrl}/${tarballName}`,
      sidecarUrl: `${baseUrl}/${sidecarName}`,
      tarballPath: path.join(outputDir, tarballName),
      sidecarPath: path.join(outputDir, sidecarName),
    }
  })
}

// ---------- fetch one tarball ----------

async function ensureTarball(item, { dryRun }) {
  const { tarballUrl, sidecarUrl, tarballPath, sidecarPath, tarballName } = item

  // Try local cache first
  if (fs.existsSync(tarballPath) && fs.existsSync(sidecarPath)) {
    try {
      const sidecar = fs.readFileSync(sidecarPath, 'utf8').trim().split(/\s+/)[0]
      const actual = await sha256OfFile(tarballPath)
      if (compareSha256TimingSafe(sidecar, actual)) {
        console.log(`[fetch-baseline] cache hit: ${tarballName} (sha matches local sidecar)`)
        return { from: 'cache', sha: actual }
      }
      console.warn(
        `[fetch-baseline] cache miss for ${tarballName}: local sha mismatch, will re-download`,
      )
    } catch (err) {
      console.warn(`[fetch-baseline] cache check failed for ${tarballName}: ${err.message}`)
    }
  }

  if (dryRun) {
    console.log(`[fetch-baseline] [dry-run] would download ${tarballUrl}`)
    console.log(`[fetch-baseline] [dry-run] would download ${sidecarUrl}`)
    return { from: 'dry-run', sha: null }
  }

  console.log(`[fetch-baseline] downloading ${tarballUrl}`)
  const tarballBuf = await fetchWithRetry(tarballUrl, { binary: true })
  console.log(`[fetch-baseline] downloading ${sidecarUrl}`)
  const sidecarText = await fetchWithRetry(sidecarUrl, { binary: false })

  const expected = sidecarText.trim().split(/\s+/)[0]
  const hash = crypto.createHash('sha256').update(tarballBuf).digest('hex')
  if (!compareSha256TimingSafe(expected, hash)) {
    throw new Error(
      `SHA256 mismatch for ${tarballName}: sidecar says ${expected}, computed ${hash}`,
    )
  }

  fs.writeFileSync(tarballPath, tarballBuf)
  fs.writeFileSync(sidecarPath, sidecarText.endsWith('\n') ? sidecarText : sidecarText + '\n')
  console.log(`[fetch-baseline] verified + wrote ${tarballName}`)
  return { from: 'download', sha: hash }
}

async function ensureManifest({ outputDir, baseUrl, dryRun }) {
  const manifestPath = path.join(outputDir, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    console.log(`[fetch-baseline] manifest.json already present, skipping`)
    return
  }
  const manifestUrl = `${baseUrl}/manifest.json`
  if (dryRun) {
    console.log(`[fetch-baseline] [dry-run] would download ${manifestUrl}`)
    return
  }
  console.log(`[fetch-baseline] downloading ${manifestUrl}`)
  const text = await fetchWithRetry(manifestUrl, { binary: false })
  fs.writeFileSync(manifestPath, text.endsWith('\n') ? text : text + '\n')
  console.log(`[fetch-baseline] wrote manifest.json`)
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const hostOS = args.hostOS || detectDefaultHostOS()
  const hostArch = args.hostArch || detectDefaultHostArch()
  if (!hostArch) {
    console.error(
      `[fetch-baseline] cannot detect host arch (os.arch()=${os.arch()}). ` +
        `Set --host-arch or BUILD_HOST_ARCH env.`,
    )
    process.exit(1)
  }
  const version = args.version || readPackageVersion()
  const outputDir = path.resolve(projectRoot, args.outputDir || 'dist-baseline')
  const baseUrl =
    args.sourceUrl ||
    `https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v${version}`

  let plan
  try {
    plan = planTarballs({ hostOS, hostArch, version, sourceUrl: baseUrl, outputDir })
  } catch (err) {
    console.error(`[fetch-baseline] ${err.message}`)
    process.exit(1)
  }

  console.log(
    `[fetch-baseline] host=${hostOS}×${hostArch} version=${version} → ${plan.length} tarball(s):`,
  )
  for (const item of plan) console.log(`  - ${item.tarballName}`)

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  for (const item of plan) {
    try {
      await ensureTarball(item, { dryRun: args.dryRun })
    } catch (err) {
      console.error(`[fetch-baseline] failed to obtain ${item.tarballName}: ${err.message}`)
      process.exit(1)
    }
  }

  try {
    await ensureManifest({ outputDir, baseUrl, dryRun: args.dryRun })
  } catch (err) {
    console.error(`[fetch-baseline] failed to obtain manifest.json: ${err.message}`)
    process.exit(1)
  }

  console.log(
    `[fetch-baseline] OK — host=${hostOS}×${hostArch}, ${plan.length} tarball(s) ready in ${path.relative(projectRoot, outputDir) || '.'}/`,
  )
}

main().catch((err) => {
  console.error(`[fetch-baseline] unexpected error: ${err && err.stack ? err.stack : err}`)
  process.exit(1)
})
