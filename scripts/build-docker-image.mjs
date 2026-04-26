#!/usr/bin/env node

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
const version = pkg.version
const tarballName = `bat-server-linux-x64-v${version}.tar.gz`
const tarballPath = path.join(projectRoot, 'dist-server', tarballName)
const dockerfilePath = path.join(projectRoot, 'docker', 'Dockerfile')
const dockerignorePath = path.join(projectRoot, 'docker', '.dockerignore')
const imageTag = `bat-server:${version}`
const latestTag = 'bat-server:latest'

function log(message) {
  console.log(`[build-docker-image] ${message}`)
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    windowsHide: true,
  })
}

function ensureBundle() {
  if (existsSync(tarballPath)) return
  log(`Missing ${path.relative(projectRoot, tarballPath)}; building server bundle first`)
  execFileSync('npm', ['run', 'build:server-bundle'], {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (!existsSync(tarballPath)) {
    throw new Error(`Server bundle still missing after build: ${path.relative(projectRoot, tarballPath)}`)
  }
}

function createBuildContext() {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'bat-docker-build-'))
  const contextRoot = path.join(tempRoot, 'context')
  const distServerDir = path.join(contextRoot, 'dist-server')
  cpSync(path.join(projectRoot, 'docker'), contextRoot, { recursive: true })
  cpSync(path.join(projectRoot, 'dist-server'), distServerDir, {
    recursive: true,
    filter: (source) => source === path.join(projectRoot, 'dist-server') || source === tarballPath,
  })
  writeFileSync(
    path.join(contextRoot, '.dockerignore'),
    readFileSync(dockerignorePath, 'utf8'),
    'utf8'
  )
  return { tempRoot, contextRoot }
}

function printSummary() {
  const imageId = run('docker', ['image', 'inspect', imageTag, '--format', '{{.Id}}']).trim()
  const sizeBytes = Number(run('docker', ['image', 'inspect', imageTag, '--format', '{{.Size}}']).trim())
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2)
  log(`Image: ${imageTag}`)
  log(`ID: ${imageId}`)
  log(`Size: ${sizeBytes} bytes (${sizeMb} MB)`)
}

function showHelp() {
  console.log(`Usage: node scripts/build-docker-image.mjs

Builds the local BAT server Docker image for linux/amd64.
- Ensures dist-server/${tarballName} exists
- Builds ${imageTag} and ${latestTag}
- Prints image id and size`)
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp()
    return
  }

  ensureBundle()

  const tarballSizeMb = (statSync(tarballPath).size / (1024 * 1024)).toFixed(2)
  log(`Using ${path.relative(projectRoot, tarballPath)} (${tarballSizeMb} MB)`)

  const { tempRoot, contextRoot } = createBuildContext()
  try {
    execFileSync(
      'docker',
      [
        'build',
        '--platform',
        'linux/amd64',
        '-t',
        imageTag,
        '-t',
        latestTag,
        '-f',
        path.join(contextRoot, 'Dockerfile'),
        contextRoot,
      ],
      {
        cwd: projectRoot,
        stdio: 'inherit',
        windowsHide: true,
      }
    )
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }

  printSummary()
}

try {
  if (!existsSync(dockerfilePath)) {
    throw new Error(`Missing dockerfile: ${path.relative(projectRoot, dockerfilePath)}`)
  }
  if (!existsSync(dockerignorePath)) {
    throw new Error(`Missing docker ignore: ${path.relative(projectRoot, dockerignorePath)}`)
  }
  main()
} catch (error) {
  console.error(`[build-docker-image] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
