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
// BUG-097 (T0418): TLS-handshake probe via the bundled node; keep in sync with docker/Dockerfile.
const EXPECTED_COMMAND =
  `/opt/bat-server/bin/node -e 'const s=require("tls").connect({host:"127.0.0.1",port:Number(process.env.BAT_SERVER_PORT),rejectUnauthorized:false},()=>{s.end();process.exit(0)});s.setTimeout(4000,()=>process.exit(1));s.on("error",()=>process.exit(1))' || exit 1`
const EXPECTED_ENTRYPOINT = ['/usr/bin/tini', '--', '/opt/bat-server/bin/bat-server', '--bind-interface', 'all']

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
- ENTRYPOINT binds bat-server to all container interfaces
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

  const entrypoint = JSON.parse(run('docker', ['image', 'inspect', tag, '--format', '{{json .Config.Entrypoint}}']))
  if (JSON.stringify(entrypoint) !== JSON.stringify(EXPECTED_ENTRYPOINT)) {
    fail(`ENTRYPOINT mismatch: expected ${JSON.stringify(EXPECTED_ENTRYPOINT)}, got ${JSON.stringify(entrypoint)}`)
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
