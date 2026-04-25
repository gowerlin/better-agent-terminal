#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const projectRoot = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
const defaultTarball = path.join(
  projectRoot,
  'dist-server',
  `bat-server-linux-x64-v${pkg.version}.tar.gz`
)
const tarball = process.argv[2] ? path.resolve(process.argv[2]) : defaultTarball
const forbiddenPatterns = ['whisper', '@kutalia/whisper-node-addon']

if (!fs.existsSync(tarball)) {
  console.error(`[verify-server-bundle] ❌ Tarball not found: ${tarball}`)
  process.exit(1)
}

let fileList
try {
  fileList = execFileSync('tar', ['-tzf', tarball], {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  })
} catch (error) {
  console.error(`[verify-server-bundle] ❌ Failed to inspect tarball: ${error.message}`)
  process.exit(1)
}

const files = fileList.split(/\r?\n/).filter(Boolean)
const violations = files.filter((file) =>
  forbiddenPatterns.some((pattern) => file.toLowerCase().includes(pattern.toLowerCase()))
)

if (violations.length > 0) {
  console.error('')
  console.error('[verify-server-bundle] ❌ Forbidden patterns found in bundle')
  for (const file of violations) {
    console.error(`  - ${file}`)
  }
  console.error('')
  process.exit(1)
}

console.log('[verify-server-bundle] ✅ No forbidden patterns. Bundle is clean.')
