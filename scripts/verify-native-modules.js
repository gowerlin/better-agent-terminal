#!/usr/bin/env node
/**
 * Pre-build guard: verify that critical native-module packages are physically
 * present in node_modules/ before we allow vite build / electron-builder to run.
 *
 * Why this exists: squash merge only updates package-lock.json, it does NOT
 * sync node_modules/. Packaging without `npm install` after a squash merge
 * produced broken installers where features silently failed at runtime
 * (see BUG-056: @kutalia/whisper-node-addon missing → voice input dead on launch).
 *
 * Run locally via `npm run build`, `npm run build:release`, or directly:
 *   node scripts/verify-native-modules.js
 *
 * In CI the workflow calls this as its own step (see .github/workflows/pre-release.yml)
 * after `npm ci` + `@electron/rebuild` so packaging aborts before artifacts upload.
 */

const fs = require('fs');
const path = require('path');

// Packages whose absence has historically broken production installers.
// Keep this list tight — only modules that (a) are in `build.asarUnpack` and
// (b) are consumed at runtime. Expanding without need raises false-positive risk.
const REQUIRED_NATIVE_MODULES = [
  '@kutalia/whisper-node-addon',
  '@lydell/node-pty',
  'better-sqlite3',
];

const projectRoot = path.join(__dirname, '..');
const missing = [];

for (const mod of REQUIRED_NATIVE_MODULES) {
  const pkgPath = path.join(projectRoot, 'node_modules', mod, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    missing.push({ mod, pkgPath });
  }
}

if (missing.length > 0) {
  console.error('');
  console.error('[verify-native-modules] ❌ Required native modules missing from node_modules/');
  for (const { mod, pkgPath } of missing) {
    console.error(`  - ${mod}`);
    console.error(`      expected: ${pkgPath}`);
  }
  console.error('');
  console.error('[verify-native-modules] Likely cause: squash merge updated package-lock.json');
  console.error('[verify-native-modules] but node_modules/ is stale. See BUG-056.');
  console.error('');
  console.error('[verify-native-modules] Fix: run `npm install` (local) or `npm ci` (CI) and retry.');
  console.error('');
  process.exit(1);
}

console.log(`[verify-native-modules] ✅ All ${REQUIRED_NATIVE_MODULES.length} required native modules present`);
