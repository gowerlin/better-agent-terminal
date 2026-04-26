#!/usr/bin/env node

import { execFileSync } from 'child_process'

const DEFAULT_TAG = 'bat-server:latest'
const MAX_SIZE_BYTES = 300 * 1024 * 1024
const EXPECTED_HEALTHCHECK = {
  Interval: 30_000_000_000,
  Timeout: 5_000_000_000,
  StartPeriod: 10_000_000_000,
  Retries: 3,
}
const EXPECTED_COMMAND = 'curl -fk https://127.0.0.1:${BAT_PORT}/health || exit 1'

function run(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'pipe',
  }).trim()
}

function fail(message) {
  console.error(`[verify-docker-image] ${message}`)
  process.exit(1)
}

function showHelp() {
  console.log(`Usage: node scripts/verify-docker-image.mjs [image-tag]

Verifies:
- image size is below 300 MB
- HEALTHCHECK matches the Dockerfile contract
- /opt/bat-server/bin contains node and bat-server`)
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp()
    return
  }

  const tag = process.argv[2] || DEFAULT_TAG
  const sizeBytes = Number(run('docker', ['image', 'inspect', tag, '--format', '{{.Size}}']))
  if (!Number.isFinite(sizeBytes)) {
    fail(`Unable to read image size for ${tag}`)
  }
  if (sizeBytes >= MAX_SIZE_BYTES) {
    fail(`Image ${tag} is too large: ${sizeBytes} bytes (limit ${MAX_SIZE_BYTES})`)
  }

  const healthcheck = JSON.parse(run('docker', ['image', 'inspect', tag, '--format', '{{json .Config.Healthcheck}}']))
  if (!healthcheck) {
    fail(`Image ${tag} has no HEALTHCHECK`)
  }
  for (const [key, value] of Object.entries(EXPECTED_HEALTHCHECK)) {
    if (healthcheck[key] !== value) {
      fail(`HEALTHCHECK ${key} mismatch: expected ${value}, got ${healthcheck[key]}`)
    }
  }
  const healthCommand = Array.isArray(healthcheck.Test) ? healthcheck.Test.at(-1) : ''
  if (healthCommand !== EXPECTED_COMMAND) {
    fail(`HEALTHCHECK command mismatch: expected "${EXPECTED_COMMAND}", got "${healthCommand}"`)
  }

  const binListing = run('docker', ['run', '--rm', '--entrypoint', '/bin/sh', tag, '-lc', 'ls /opt/bat-server/bin'])
  const entries = new Set(binListing.split(/\r?\n/).filter(Boolean))
  for (const expected of ['node', 'bat-server']) {
    if (!entries.has(expected)) {
      fail(`Bundle validation failed: missing ${expected} in /opt/bat-server/bin`)
    }
  }

  console.log(`[verify-docker-image] Image ${tag} size: ${sizeBytes} bytes`)
  console.log(`[verify-docker-image] HEALTHCHECK verified`)
  console.log('[verify-docker-image] ✅ Docker image valid')
}

try {
  main()
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
