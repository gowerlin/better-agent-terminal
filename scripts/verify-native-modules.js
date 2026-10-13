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
 * BUG-116 / T0468: a present package.json is not enough — the whisper addon's
 * `.node` for the host platform must exist too, resolved with the same rule the
 * runtime loader uses (electron/whisper-addon-loader.ts).
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

const WHISPER_ADDON_PACKAGE = '@kutalia/whisper-node-addon';

// Hosts that build a desktop package (win x64, mac x64 + arm64, linux x64) and
// for which upstream ships a whisper binary. Other hosts — e.g. the linux-arm64
// server-bundle runner — get a warning only: there the runtime loader leaves voice
// input disabled instead of crashing (BUG-116 fail-soft).
const WHISPER_ADDON_REQUIRED_HOSTS = ['win32-x64', 'linux-x64', 'darwin-x64', 'darwin-arm64'];

/**
 * `dist/` sub-directories that may hold `whisper.node`, in lookup order.
 * Keep in sync with `whisperAddonDirCandidates` in electron/whisper-addon-loader.ts
 * (a .js script cannot import .ts; electron/__tests__/whisper-addon-loader.test.ts
 * asserts the two stay identical).
 */
function whisperAddonDirCandidates(platform, arch) {
  switch (platform) {
    case 'win32':
      return [`win32-${arch}`];
    case 'linux':
      return [`linux-${arch}`];
    case 'darwin':
      return [`mac-${arch}`, `darwin-${arch}`];
    default:
      return [];
  }
}

function main() {
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

  // Host-platform whisper binary (BUG-116).
  const host = `${process.platform}-${process.arch}`;
  const whisperDist = path.join(projectRoot, 'node_modules', WHISPER_ADDON_PACKAGE, 'dist');
  const candidates = whisperAddonDirCandidates(process.platform, process.arch)
    .map((dir) => path.join(whisperDist, dir, 'whisper.node'));
  const found = candidates.find((p) => fs.existsSync(p));

  if (!found) {
    if (!WHISPER_ADDON_REQUIRED_HOSTS.includes(host)) {
      console.warn(`[verify-native-modules] ⚠️ No ${WHISPER_ADDON_PACKAGE} binary for host ${host}; voice input will be disabled on this platform (not a desktop package host, not fatal).`);
    } else {
      console.error('');
      console.error(`[verify-native-modules] ❌ ${WHISPER_ADDON_PACKAGE} is installed but has no native binary for host ${host}`);
      for (const p of candidates) {
        console.error(`      looked for: ${p}`);
      }
      console.error('');
      console.error('[verify-native-modules] An installer built now would ship without working voice input (BUG-116).');
      console.error('[verify-native-modules] Likely cause: an interrupted npm install / cleanup left the package partially extracted.');
      console.error(`[verify-native-modules] Fix: delete node_modules/${WHISPER_ADDON_PACKAGE} and run \`npm install\` (local) or \`npm ci\` (CI), then retry.`);
      console.error('');
      process.exit(1);
    }
  }

  const whisperNote = found ? `, whisper binary: ${path.relative(projectRoot, found)}` : '';
  console.log(`[verify-native-modules] ✅ All ${REQUIRED_NATIVE_MODULES.length} required native modules present${whisperNote}`);
}

module.exports = { whisperAddonDirCandidates, WHISPER_ADDON_REQUIRED_HOSTS };

// Runs on `node scripts/verify-native-modules.js` and on `require()` from
// scripts/build-version.js (side-effect import). Skipped under vitest so the
// rule can be imported for the loader parity test.
if (!process.env.VITEST) {
  main();
}
