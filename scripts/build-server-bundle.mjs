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
const bundleName = `bat-server-linux-x64-v${version}.tar.gz`
const bundlePath = path.join(distRoot, bundleName)
const hardExcludedPatterns = ['whisper', 'sharp-darwin', 'sharp-win32', 'node-pty-darwin', 'node-pty-win32']

const nativePackages = [
  '@lydell/node-pty',
  '@lydell/node-pty-linux-x64',
  'better-sqlite3',
  'sharp',
  '@img/sharp-linux-x64',
  '@img/sharp-libvips-linux-x64',
  '@anthropic-ai/claude-code',
  '@anthropic-ai/claude-code-linux-x64',
  '@anthropic-ai/claude-agent-sdk',
]

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

async function prepareDirs() {
  cleanDir(distRoot)
  ensureDir(binDir)
  ensureDir(nodeModulesDir)
  ensureDir(remoteDir)
  ensureDir(handlersDir)
}

async function bundleServerEntry() {
  log('2', 'Bundling electron/remote/server-entry.ts with esbuild')
  await build({
    entryPoints: [resolveProjectPath('electron', 'remote', 'server-entry.ts')],
    outfile: path.join(binDir, 'bat-server.js'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    sourcemap: 'inline',
    logLevel: 'info',
    external: [
      'electron',
      '@lydell/node-pty',
      '@lydell/node-pty-linux-x64',
      'better-sqlite3',
      '@img/sharp-linux-x64',
      '@img/sharp-libvips-linux-x64',
      'sharp',
      '@anthropic-ai/claude-code',
      '@anthropic-ai/claude-code-linux-x64',
      '@anthropic-ai/claude-agent-sdk',
      '@kutalia/whisper-node-addon',
    ],
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
  const tarballName = `node-v${nodeVersion}-linux-x64.tar.xz`
  const tempDir = await makeTempDir('bat-server-node-')
  const archivePath = path.join(tempDir, tarballName)
  const extractDir = path.join(tempDir, 'extract')
  ensureDir(extractDir)

  log('3', `Downloading Node v${nodeVersion} linux-x64 prebuilt`)
  await downloadFile(`https://nodejs.org/dist/v${nodeVersion}/${tarballName}`, archivePath)
  run('tar', ['-xJf', archivePath, '-C', extractDir])

  const nodeBinary = path.join(extractDir, `node-v${nodeVersion}-linux-x64`, 'bin', 'node')
  if (!existsAndIsFile(nodeBinary)) {
    throw new Error(`Expected extracted node binary at ${nodeBinary}`)
  }
  await copyFile(nodeBinary, path.join(binDir, 'node'))
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
    const hint = packageName.includes('linux-x64')
      ? 'Install the linux-x64 package in this worktree or rerun with BAT_SERVER_ALLOW_MISSING_NATIVE=1 for schema-only verification.'
      : 'Run npm install in this worktree and retry.'
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
  log('4', 'Copying linux-x64 runtime packages into staging/node_modules')
  const results = []
  for (const packageName of nativePackages) {
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
  const claudeLinuxRoot = path.join(nodeModulesDir, '@anthropic-ai', 'claude-code-linux-x64')
  const windowsBinary = path.join(claudeCodeRoot, 'bin', 'claude.exe')
  if (existsAndIsFile(windowsBinary)) {
    await unlink(windowsBinary)
  }

  const wrapperPath = path.join(claudeCodeRoot, 'bin', 'claude')
  await writeFile(
    wrapperPath,
    '#!/bin/sh\nexec "$(dirname "$0")/../../claude-code-linux-x64/claude" "$@"\n',
    'utf8'
  )
  await chmod(wrapperPath, 0o755)

  const claudePackageJsonPath = path.join(claudeCodeRoot, 'package.json')
  const claudePackageJson = JSON.parse(await readFile(claudePackageJsonPath, 'utf8'))
  claudePackageJson.bin = { claude: 'bin/claude' }
  await writeFile(claudePackageJsonPath, JSON.stringify(claudePackageJson, null, 2) + '\n', 'utf8')

  if (!existsAndIsFile(path.join(claudeLinuxRoot, 'claude'))) {
    throw new Error('Expected @anthropic-ai/claude-code-linux-x64/claude after pruning staged Anthropic packages')
  }
}

async function copyServerSources() {
  log('5', 'Copying server source directories into staging')
  await copyRecursive(resolveProjectPath('electron', 'remote'), remoteDir)
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
    '#!/bin/sh\nexec "$(dirname "$0")/node" "$(dirname "$0")/bat-server.js" "$@"\n'
  )

  const readmePath = path.join(stagingRoot, 'README.md')
  const initial = [
    `# BAT Server Bundle`,
    ``,
    `- version: ${version}`,
    `- target: linux-x64`,
    `- node version: ${nodeVersion}`,
    `- glibc lower bound: 2.35`,
    `- sha256: pending`,
    ``,
    `This archive was produced by scripts/build-server-bundle.mjs.`,
  ].join('\n')
  writeFileSync(readmePath, initial, 'utf8')
}

async function packBundle(nodeVersion) {
  log('7', `Packing ${bundleName}`)
  run('tar', ['-czf', bundlePath, '-C', distRoot, 'staging'])
  const sha = await sha256File(bundlePath)
  const readmePath = path.join(stagingRoot, 'README.md')
  const readme = await readFile(readmePath, 'utf8')
  writeFileSync(
    readmePath,
    readme.replace('- sha256: pending', `- sha256: ${sha}`),
    'utf8'
  )
  run('tar', ['-czf', bundlePath, '-C', distRoot, 'staging'])
  return {
    sha256: await sha256File(bundlePath),
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
