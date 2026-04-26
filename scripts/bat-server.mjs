#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { parseArgs } from 'util'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

function resolveVersion() {
  const pkgPath = path.join(__dirname, '..', 'package.json')
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return pkg.version || '0.0.0'
  }

  const entry = loadServerEntry(false)
  return entry?.getHeadlessBundleVersion?.() || '0.0.0'
}

function printHelp() {
  console.log(`Usage: bat-server [options]

Options:
  --data-dir <path>
  --port <num>
  --bind-interface <localhost|tailscale|all|ip:...>
  --token <token>
  --version
  --help`)
}

function loadServerEntry(required = true) {
  const candidates = [
    process.env.BAT_SERVER_ENTRY,
    path.join(__dirname, '..', 'electron', 'remote', 'server-entry.js'),
    path.join(__dirname, '..', 'dist-server', 'staging', 'electron', 'remote', 'server-entry.js'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return require(candidate)
    }
  }

  if (required) {
    throw new Error(
      'Unable to locate bundled server-entry.js. Run build:server-bundle or set BAT_SERVER_ENTRY.'
    )
  }

  return null
}

function resolveDataDir(dataDirFlag, resolveDefaultDataDir) {
  if (dataDirFlag) return path.resolve(dataDirFlag)
  if (process.env.BAT_SERVER_DATA_DIR) {
    return path.resolve(process.env.BAT_SERVER_DATA_DIR)
  }
  return resolveDefaultDataDir()
}

function resolvePort(portFlag) {
  const raw = portFlag ?? process.env.BAT_SERVER_PORT ?? '54321'
  const port = Number.parseInt(raw, 10)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid --port value: ${raw}`)
  }
  return port
}

async function main() {
  const { values } = parseArgs({
    options: {
      'data-dir': { type: 'string' },
      port: { type: 'string' },
      'bind-interface': { type: 'string' },
      token: { type: 'string' },
      version: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
  })

  if (values.version) {
    console.log(resolveVersion())
    return
  }

  if (values.help) {
    printHelp()
    return
  }

  const serverEntry = loadServerEntry(true)
  const dataDir = resolveDataDir(values['data-dir'], serverEntry.resolveDefaultDataDir)
  const port = resolvePort(values.port)
  const bindInterface = values['bind-interface']
  let server = null
  let stopping = false

  const stop = async () => {
    if (!server || stopping) return
    stopping = true
    try {
      await server.stop()
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => void stop())
  process.on('SIGTERM', () => void stop())

  server = await serverEntry.createHeadlessServer({
    dataDir,
    port,
    bindInterface,
    token: values.token,
    logger: console,
  })

  const started = await server.start()
  console.log(
    `[bat-server] listening on ${started.bindAddress}:${started.port} ` +
      `(fingerprint: ${started.fingerprint.slice(0, 16)}...)`
  )
}

main().catch((error) => {
  console.error(`[bat-server] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
