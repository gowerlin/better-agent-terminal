#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { chmod, copyFile, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { build } from 'esbuild'
import {
  cleanDir,
  copyRecursive,
  downloadFile,
  ensureDir,
  existsAndIsDirectory,
  existsAndIsFile,
  fetchText,
  listRelativeFiles,
  makeTempDir,
  removePath,
  run,
  writeExecutableScript,
  sha256File,
} from './_bat-server-helpers.mjs'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
const version = pkg.version
const distRoot = path.join(projectRoot, 'dist-server')
const stagingRoot = path.join(distRoot, 'staging')
const binDir = path.join(stagingRoot, 'bin')
const nodeModulesDir = path.join(stagingRoot, 'node_modules')
const remoteDir = path.join(stagingRoot, 'electron', 'remote')
const handlersDir = path.join(stagingRoot, 'handlers')
const VALID_TARGETS = ['linux-x64', 'linux-arm64', 'darwin-arm64']
const TARGET_CONFIG = {
  'linux-x64': {
    nodeArchiveExt: 'tar.xz',
    nodeArchiveBase: 'linux-x64',
    nodeBinarySubpath: ['bin', 'node'],
    runtimeBinaryName: 'node',
    readmeRuntimeLine: '- glibc lower bound: 2.35',
    nativePackages: [
      '@lydell/node-pty',
      '@lydell/node-pty-linux-x64',
      'better-sqlite3',
      'sharp',
      '@img/sharp-linux-x64',
      '@img/sharp-libvips-linux-x64',
      '@anthropic-ai/claude-code',
      '@anthropic-ai/claude-code-linux-x64',
      '@anthropic-ai/claude-agent-sdk',
      '@anthropic-ai/claude-agent-sdk-linux-x64',
    ],
    claudeCodeBinaryPackage: '@anthropic-ai/claude-code-linux-x64',
    claudeCodeBinaryName: 'claude',
  },
  'linux-arm64': {
    nodeArchiveExt: 'tar.xz',
    nodeArchiveBase: 'linux-arm64',
    nodeBinarySubpath: ['bin', 'node'],
    runtimeBinaryName: 'node',
    readmeRuntimeLine: '- glibc lower bound: 2.35',
    nativePackages: [
      '@lydell/node-pty',
      '@lydell/node-pty-linux-arm64',
      'better-sqlite3',
      'sharp',
      '@img/sharp-linux-arm64',
      '@img/sharp-libvips-linux-arm64',
      '@anthropic-ai/claude-code',
      '@anthropic-ai/claude-code-linux-arm64',
      '@anthropic-ai/claude-agent-sdk',
      '@anthropic-ai/claude-agent-sdk-linux-arm64',
    ],
    claudeCodeBinaryPackage: '@anthropic-ai/claude-code-linux-arm64',
    claudeCodeBinaryName: 'claude',
  },
  'darwin-arm64': {
    nodeArchiveExt: 'tar.gz',
    nodeArchiveBase: 'darwin-arm64',
    nodeBinarySubpath: ['bin', 'node'],
    runtimeBinaryName: 'node',
    readmeRuntimeLine: '- glibc lower bound: n/a (darwin)',
    nativePackages: [
      '@lydell/node-pty',
      '@lydell/node-pty-darwin-arm64',
      'better-sqlite3',
      'sharp',
      '@img/sharp-darwin-arm64',
      '@img/sharp-libvips-darwin-arm64',
      '@anthropic-ai/claude-code',
      '@anthropic-ai/claude-code-darwin-arm64',
      '@anthropic-ai/claude-agent-sdk',
      '@anthropic-ai/claude-agent-sdk-darwin-arm64',
    ],
    claudeCodeBinaryPackage: '@anthropic-ai/claude-code-darwin-arm64',
    claudeCodeBinaryName: 'claude',
  },
}
const externalPackages = [
  'electron',
  'better-sqlite3',
  'sharp',
  '@anthropic-ai/claude-code',
  '@anthropic-ai/claude-agent-sdk',
  '@kutalia/whisper-node-addon',
  '@lydell/node-pty',
  '@lydell/node-pty-linux-x64',
  '@lydell/node-pty-linux-arm64',
  '@lydell/node-pty-darwin-arm64',
  '@img/sharp-linux-x64',
  '@img/sharp-libvips-linux-x64',
  '@img/sharp-linux-arm64',
  '@img/sharp-libvips-linux-arm64',
  '@img/sharp-darwin-arm64',
  '@img/sharp-libvips-darwin-arm64',
  '@anthropic-ai/claude-code-linux-x64',
  '@anthropic-ai/claude-code-linux-arm64',
  '@anthropic-ai/claude-code-darwin-arm64',
  '@anthropic-ai/claude-agent-sdk-linux-x64',
  '@anthropic-ai/claude-agent-sdk-linux-arm64',
  '@anthropic-ai/claude-agent-sdk-darwin-arm64',
]
const target = parseTargetArg(process.argv.slice(2))
const targetConfig = TARGET_CONFIG[target]
const bundleName = `bat-server-${target}-v${version}.tar.gz`
const bundlePath = path.join(distRoot, bundleName)
const hardExcludedPatterns = ['whisper']

function resolveProjectPath(...parts) {
  return path.join(projectRoot, ...parts)
}

function log(step, message) {
  console.log(`[build-server-bundle] [${step}] ${message}`)
}

async function selectNodeVersion() {
  if (process.env.BAT_SERVER_NODE_VERSION) {
    return process.env.BAT_SERVER_NODE_VERSION.replace(/^v/, '')
  }
  const response = await fetch('https://nodejs.org/dist/index.json')
  if (!response.ok) {
    throw new Error(`Unable to query Node dist index (${response.status} ${response.statusText})`)
  }
  const releases = await response.json()
  const match = releases.find((entry) => typeof entry.version === 'string' && /^v24\./.test(entry.version))
  if (!match) {
    throw new Error('Unable to find a Node 24 release in nodejs.org/dist/index.json')
  }
  return match.version.slice(1)
}

function parseTargetArg(argv) {
  let resolvedTarget = 'linux-x64'

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/build-server-bundle.mjs [--target <linux-x64|linux-arm64|darwin-arm64>]')
      process.exit(0)
    }
    if (arg === '--target') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error(`Missing value for --target. Valid targets: ${VALID_TARGETS.join(', ')}`)
      }
      resolvedTarget = value
      index += 1
      continue
    }
    if (arg.startsWith('--target=')) {
      resolvedTarget = arg.slice('--target='.length)
      continue
    }
    throw new Error(`Unknown argument: ${arg}. Valid targets: ${VALID_TARGETS.join(', ')}`)
  }

  if (!VALID_TARGETS.includes(resolvedTarget)) {
    throw new Error(`Unsupported target "${resolvedTarget}". Valid targets: ${VALID_TARGETS.join(', ')}`)
  }
  return resolvedTarget
}

async function prepareDirs() {
  ensureDir(distRoot)
  cleanDir(stagingRoot)
  ensureDir(binDir)
  ensureDir(nodeModulesDir)
  ensureDir(remoteDir)
  ensureDir(handlersDir)
  await removePath(bundlePath)
}

async function bundleServerEntry() {
  log('2', `Bundling headless server entries with esbuild for ${target}`)
  await build({
    entryPoints: [
      resolveProjectPath('electron', 'remote', 'server-entry.ts'),
      resolveProjectPath('electron', 'remote', 'headless-entry.ts'),
      resolveProjectPath('electron', 'remote', 'lockfile.ts'),
      resolveProjectPath('electron', 'remote', 'dataDir.ts'),
    ],
    outdir: remoteDir,
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    sourcemap: 'inline',
    logLevel: 'info',
    external: externalPackages,
  })
}

async function provisionNodeBinary() {
  const overrideBinary = process.env.BAT_SERVER_NODE_BINARY
  if (overrideBinary) {
    if (!existsAndIsFile(overrideBinary)) {
      throw new Error(`BAT_SERVER_NODE_BINARY points to a missing file: ${overrideBinary}`)
    }
    log('3', `Copying node binary from BAT_SERVER_NODE_BINARY=${overrideBinary}`)
    await copyFile(overrideBinary, path.join(binDir, 'node'))
    return {
      nodeVersion: run(overrideBinary, ['--version']).trim().replace(/^v/, ''),
      source: 'env',
    }
  }

  const nodeVersion = await selectNodeVersion()
  const tarballName = `node-v${nodeVersion}-${targetConfig.nodeArchiveBase}.${targetConfig.nodeArchiveExt}`
  const tempDir = await makeTempDir('bat-server-node-')
  const archivePath = path.join(tempDir, tarballName)
  const extractDir = path.join(tempDir, 'extract')
  ensureDir(extractDir)

  const baseUrl = `https://nodejs.org/dist/v${nodeVersion}`

  log('3', `Fetching SHASUMS256.txt for Node v${nodeVersion}`)
  const shasumsText = await fetchText(`${baseUrl}/SHASUMS256.txt`)
  const shasumsLine = shasumsText
    .split('\n')
    .find((line) => line.endsWith(`  ${tarballName}`))
  if (!shasumsLine) {
    throw new Error(
      `SHASUMS256.txt missing entry for ${tarballName} (Node v${nodeVersion}). ` +
        `Expected a line ending with "  ${tarballName}".`
    )
  }
  const expectedSha = shasumsLine.split(/\s+/)[0]
  if (!/^[a-f0-9]{64}$/.test(expectedSha)) {
    throw new Error(
      `SHASUMS256.txt line malformed for ${tarballName}: "${shasumsLine}" ` +
        `(expected 64-char lowercase hex sha256)`
    )
  }

  log('3', `Downloading Node v${nodeVersion} ${targetConfig.nodeArchiveBase} prebuilt`)
  await downloadFile(`${baseUrl}/${tarballName}`, archivePath)

  const actualSha = await sha256File(archivePath)
  if (actualSha !== expectedSha) {
    throw new Error(
      `Node binary checksum mismatch for ${tarballName}:\n` +
        `  expected: ${expectedSha}\n` +
        `  actual:   ${actualSha}\n` +
        `  source:   ${baseUrl}/SHASUMS256.txt`
    )
  }
  log('3', `SHASUMS256 verified for ${tarballName} (${actualSha.slice(0, 12)}…)`)

  const tarArgs = targetConfig.nodeArchiveExt === 'tar.xz'
    ? ['-xJf', tarballName, '-C', 'extract']
    : ['-xzf', tarballName, '-C', 'extract']
  run('tar', tarArgs, { cwd: tempDir })

  const nodeBinary = path.join(
    extractDir,
    `node-v${nodeVersion}-${targetConfig.nodeArchiveBase}`,
    ...targetConfig.nodeBinarySubpath
  )
  if (!existsAndIsFile(nodeBinary)) {
    throw new Error(`Expected extracted node binary at ${nodeBinary}`)
  }
  await copyFile(nodeBinary, path.join(binDir, targetConfig.runtimeBinaryName))
  await removePath(tempDir)
  return {
    nodeVersion,
    source: 'download',
  }
}

async function copyPackage(packageName) {
  const sourceDir = resolveProjectPath('node_modules', ...packageName.split('/'))
  const destDir = path.join(nodeModulesDir, ...packageName.split('/'))

  if (!existsAndIsDirectory(sourceDir)) {
    const allowMissing = process.env.BAT_SERVER_ALLOW_MISSING_NATIVE === '1'
    const hint = packageName.includes(target)
      ? `Install the ${target} package in this environment or rerun with BAT_SERVER_ALLOW_MISSING_NATIVE=1 for schema-only verification.`
      : `Run npm install for the ${target} target in CI or on a matching host and retry.`
    const message = `Missing required package: ${packageName} (${sourceDir}). ${hint}`
    if (allowMissing) {
      console.warn(`[build-server-bundle] [4] Skipping missing package because BAT_SERVER_ALLOW_MISSING_NATIVE=1: ${packageName}`)
      return { copied: false, packageName }
    }
    throw new Error(message)
  }

  await copyRecursive(sourceDir, destDir)
  return { copied: true, packageName }
}

async function copyNativeModules() {
  log('4', `Copying ${target} runtime packages into staging/node_modules`)
  const results = []
  for (const packageName of targetConfig.nativePackages) {
    results.push(await copyPackage(packageName))
  }

  const forbiddenMatches = []
  const stagedEntries = listRelativeFiles(nodeModulesDir)
  for (const pattern of hardExcludedPatterns) {
    if (stagedEntries.some((entry) => entry.toLowerCase().includes(pattern))) {
      forbiddenMatches.push(pattern)
    }
  }
  if (forbiddenMatches.length > 0) {
    throw new Error(`Forbidden package patterns leaked into staged node_modules: ${forbiddenMatches.join(', ')}`)
  }
  return results
}

async function pruneAnthropicPackages() {
  const claudeCodeRoot = path.join(nodeModulesDir, '@anthropic-ai', 'claude-code')
  const claudeBinaryPackageRoot = path.join(nodeModulesDir, ...targetConfig.claudeCodeBinaryPackage.split('/'))
  const windowsBinary = path.join(claudeCodeRoot, 'bin', 'claude.exe')
  if (existsAndIsFile(windowsBinary)) {
    await unlink(windowsBinary)
  }

  const wrapperPath = path.join(claudeCodeRoot, 'bin', 'claude')
  await writeFile(
    wrapperPath,
    `#!/bin/sh\nexec "$(dirname "$0")/../../${targetConfig.claudeCodeBinaryPackage.split('/')[1]}/${targetConfig.claudeCodeBinaryName}" "$@"\n`,
    'utf8'
  )
  await chmod(wrapperPath, 0o755)

  const claudePackageJsonPath = path.join(claudeCodeRoot, 'package.json')
  const claudePackageJson = JSON.parse(await readFile(claudePackageJsonPath, 'utf8'))
  claudePackageJson.bin = { claude: 'bin/claude' }
  await writeFile(claudePackageJsonPath, JSON.stringify(claudePackageJson, null, 2) + '\n', 'utf8')

  if (!existsAndIsFile(path.join(claudeBinaryPackageRoot, targetConfig.claudeCodeBinaryName))) {
    throw new Error(`Expected ${targetConfig.claudeCodeBinaryPackage}/${targetConfig.claudeCodeBinaryName} after pruning staged Anthropic packages`)
  }
}

async function copyServerSources() {
  log('5', 'Copying server source directories into staging')
  await copyRecursive(resolveProjectPath('electron', 'remote'), remoteDir)
  await copyFile(resolveProjectPath('scripts', 'bat-server.mjs'), path.join(binDir, 'bat-server.mjs'))
  const handlersSource = resolveProjectPath('electron', 'handlers')
  if (existsAndIsDirectory(handlersSource)) {
    await copyRecursive(handlersSource, handlersDir)
    return { handlersCopied: true }
  }
  return { handlersCopied: false }
}

async function writeLauncherAndReadme(nodeVersion) {
  log('6', 'Writing launcher script and README')
  await writeExecutableScript(
    path.join(binDir, 'bat-server'),
    `#!/bin/sh\nexec "$(dirname "$0")/${targetConfig.runtimeBinaryName}" "$(dirname "$0")/bat-server.mjs" "$@"\n`
  )

  writeFileSync(
    path.join(stagingRoot, 'package.json'),
    JSON.stringify({ name: pkg.name, version }, null, 2) + '\n',
    'utf8'
  )

  const readmePath = path.join(stagingRoot, 'README.md')
  const initial = [
    `# BAT Server Bundle`,
    ``,
    `- version: ${version}`,
    `- target: ${target}`,
    `- node version: ${nodeVersion}`,
    targetConfig.readmeRuntimeLine,
    `- built at: ${new Date().toISOString()}`,
    ``,
    `This archive was produced by scripts/build-server-bundle.mjs.`,
    `See the GitHub Release notes (or build summary JSON) for the bundle checksum.`,
  ].join('\n')
  writeFileSync(readmePath, initial, 'utf8')
}

async function packBundle(nodeVersion) {
  log('7', `Packing ${bundleName}`)
  run('tar', ['-czf', bundleName, 'staging'], { cwd: distRoot })
  const sha = await sha256File(bundlePath)
  return {
    sha256: sha,
    nodeVersion,
  }
}

async function main() {
  await prepareDirs()
  await bundleServerEntry()
  const { nodeVersion, source } = await provisionNodeBinary()
  const copyResults = await copyNativeModules()
  await pruneAnthropicPackages()
  const { handlersCopied } = await copyServerSources()
  await writeLauncherAndReadme(nodeVersion)
  const { sha256 } = await packBundle(nodeVersion)

  const skippedPackages = copyResults.filter((item) => !item.copied).map((item) => item.packageName)
  const summary = {
    bundlePath: path.relative(projectRoot, bundlePath),
    target,
    nodeVersion,
    nodeSource: source,
    handlersCopied,
    skippedPackages,
    sha256,
  }
  console.log('[build-server-bundle] ✅ Bundle created')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(`[build-server-bundle] ❌ ${error.message}`)
  process.exit(1)
})
