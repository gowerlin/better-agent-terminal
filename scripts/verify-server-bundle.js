#!/usr/bin/env node

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const projectRoot = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
const validTargets = ['linux-x64', 'linux-arm64', 'darwin-arm64']
const targetConfigs = {
  'linux-x64': {
    forbiddenPatterns: [
      'whisper',
      '@kutalia/whisper-node-addon',
      'node-pty-darwin',
      'node-pty-win32',
      'node-pty-linux-arm64',
      'claude-code-darwin',
      'claude-code-win32',
      'claude-code-linux-arm64',
    ],
  },
  'linux-arm64': {
    forbiddenPatterns: [
      'whisper',
      '@kutalia/whisper-node-addon',
      'node-pty-darwin',
      'node-pty-win32',
      'node-pty-linux-x64',
      'claude-code-darwin',
      'claude-code-win32',
      'claude-code-linux-x64',
    ],
  },
  'darwin-arm64': {
    forbiddenPatterns: [
      'whisper',
      '@kutalia/whisper-node-addon',
      'node-pty-linux',
      'node-pty-win32',
      'claude-code-linux',
      'claude-code-win32',
    ],
  },
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv) {
  let explicitTarget = null
  let explicitTarball = null

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/verify-server-bundle.js [--target <linux-x64|linux-arm64|darwin-arm64>] [tarball]')
      process.exit(0)
    }
    if (arg === '--target') {
      explicitTarget = argv[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--target=')) {
      explicitTarget = arg.slice('--target='.length)
      continue
    }
    if (!explicitTarball) {
      explicitTarball = path.resolve(arg)
      continue
    }
    fail(`[verify-server-bundle] ❌ Unknown argument: ${arg}`)
  }

  if (explicitTarget && !validTargets.includes(explicitTarget)) {
    fail(`[verify-server-bundle] ❌ Unsupported target "${explicitTarget}". Valid targets: ${validTargets.join(', ')}`)
  }

  return { explicitTarget, explicitTarball }
}

function resolveTarballs() {
  const { explicitTarget, explicitTarball } = parseArgs(process.argv.slice(2))

  if (explicitTarball) {
    return [explicitTarball]
  }

  if (explicitTarget) {
    return [
      path.join(projectRoot, 'dist-server', `bat-server-${explicitTarget}-v${pkg.version}.tar.gz`),
    ]
  }

  return validTargets.map((target) =>
    path.join(projectRoot, 'dist-server', `bat-server-${target}-v${pkg.version}.tar.gz`)
  )
}

function inferTargetFromTarball(tarball) {
  const name = path.basename(tarball)
  const match = /^bat-server-(linux-x64|linux-arm64|darwin-arm64)-v.+\.tar\.gz$/.exec(name)
  if (!match) {
    fail(`[verify-server-bundle] ❌ Unable to infer target from tarball name: ${name}`)
  }
  return match[1]
}

function listArchiveFiles(tarball) {
  try {
    return execFileSync('tar', ['-tzf', path.basename(tarball)], {
      cwd: path.dirname(tarball),
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 20,
    })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (error) {
    fail(`[verify-server-bundle] ❌ Failed to inspect tarball: ${error.message}`)
  }
}

// T0492: `tar -tv` lines for symlinks start with "l" and end in "<path> -> <target>"
// (GNU tar and bsdtar alike). Returns the links whose target is an absolute path:
// they point into the build machine (e.g. /Users/runner/work/...) and dangle anywhere else.
function findAbsoluteSymlinks(verboseLines) {
  const absolute = []
  for (const line of verboseLines) {
    if (!line.startsWith('l')) continue
    const arrow = line.lastIndexOf(' -> ')
    if (arrow === -1) continue
    const linkTarget = line.slice(arrow + 4).trim()
    if (linkTarget.startsWith('/') || /^[A-Za-z]:[\\/]/.test(linkTarget)) {
      absolute.push(line.trim())
    }
  }
  return absolute
}

function listArchiveVerbose(tarball) {
  try {
    return execFileSync('tar', ['-tvzf', path.basename(tarball)], {
      cwd: path.dirname(tarball),
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 40,
    })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (error) {
    fail(`[verify-server-bundle] ❌ Failed to inspect tarball: ${error.message}`)
  }
}

function extractArchive(tarball) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-server-verify-'))
  const extractDir = path.join(tempRoot, 'extract')
  const stagedTarball = path.join(tempRoot, path.basename(tarball))
  fs.mkdirSync(extractDir, { recursive: true })
  try {
    fs.copyFileSync(tarball, stagedTarball)
    execFileSync('tar', ['-xzf', path.basename(stagedTarball), '-C', 'extract'], {
      cwd: tempRoot,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 20,
    })
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true })
    fail(`[verify-server-bundle] ❌ Failed to extract tarball: ${error.message}`)
  }
  return tempRoot
}

function requirePath(rootDir, relativePath) {
  const fullPath = path.join(rootDir, relativePath)
  if (!fs.existsSync(fullPath)) {
    fail(`[verify-server-bundle] ❌ Missing required path: ${relativePath}`)
  }
  return fullPath
}

function verifyExecutable(filePath, relativePath) {
  if (process.platform === 'win32') {
    return
  }
  const mode = fs.statSync(filePath).mode & 0o777
  if ((mode & 0o111) === 0) {
    fail(`[verify-server-bundle] ❌ Expected executable permissions on ${relativePath}`)
  }
}

const tarballs = resolveTarballs()
// T0503: sharp / @img are build-time only (scripts/generate-icons.js); no target ships them.
// T0546 (C2b): no target ships the SDK-bundled claude (`claude-agent-sdk-<platform>`); the
// server runs claude-code's platform binary. The SDK js package (`claude-agent-sdk/`) stays.
const forbiddenPatterns = ['whisper', '@kutalia/whisper-node-addon', 'sharp', '@img/', 'claude-agent-sdk-']
for (const tarball of tarballs) {
  if (!fs.existsSync(tarball)) {
    fail(`[verify-server-bundle] ❌ Tarball not found: ${tarball}`)
  }

  const target = inferTargetFromTarball(tarball)
  const files = listArchiveFiles(tarball)
  const targetForbiddenPatterns = [...forbiddenPatterns, ...targetConfigs[target].forbiddenPatterns]
  const violations = files.filter((file) =>
    targetForbiddenPatterns.some((pattern) => file.toLowerCase().includes(pattern.toLowerCase()))
  )

  if (violations.length > 0) {
    console.error('')
    console.error(`[verify-server-bundle] ❌ Forbidden patterns found in bundle for ${target}`)
    for (const file of violations) {
      console.error(`  - ${file}`)
    }
    console.error('')
    process.exit(1)
  }

  const absoluteSymlinks = findAbsoluteSymlinks(listArchiveVerbose(tarball))
  if (absoluteSymlinks.length > 0) {
    console.error('')
    console.error(`[verify-server-bundle] ❌ Absolute-path symlinks found in bundle for ${target} (they dangle outside the build machine)`)
    for (const line of absoluteSymlinks) {
      console.error(`  - ${line}`)
    }
    console.error('')
    process.exit(1)
  }

  const extractRoot = extractArchive(tarball)
  try {
    const stagingRoot = path.join(extractRoot, 'extract', 'staging')
    const nodePath = requirePath(stagingRoot, path.join('bin', 'node'))
    verifyExecutable(nodePath, 'staging/bin/node')
    requirePath(stagingRoot, path.join('bin', 'bat-server'))
    requirePath(stagingRoot, path.join('bin', 'bat-server.mjs'))
    requirePath(stagingRoot, path.join('node_modules', '@lydell', 'node-pty', 'package.json'))
    // T0433 / T0584: the helpers a headless PTY runs from <installRoot>/scripts (BAT_HELPER_DIR)
    for (const helper of ['bat-terminal.mjs', 'bat-notify.mjs', 'bat-mcp.mjs', '_bat-cert.mjs', '_bat-logger.mjs']) {
      requirePath(stagingRoot, path.join('scripts', helper))
    }
  } finally {
    fs.rmSync(extractRoot, { recursive: true, force: true })
  }

  console.log(`[verify-server-bundle] ✅ ${path.basename(tarball)} passed`)
}
