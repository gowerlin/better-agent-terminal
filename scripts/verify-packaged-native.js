#!/usr/bin/env node
/**
 * Post-package guard (mac): verify that every macOS `.app` electron-builder produced
 * ships the whisper native addon for its own arch inside `app.asar.unpacked`.
 *
 * Why this exists (BUG-116 / T0470): scripts/verify-native-modules.js only checks
 * node_modules/ for the CI host's arch (macos-latest = arm64). The mac job builds
 * x64 + arm64 dmgs from that one host (D057), so a missing x64 binary — or an
 * asarUnpack / packaging regression — would only surface on users' machines.
 *
 * Usage (run after `electron-builder --mac`, before uploading artifacts):
 *   node scripts/verify-packaged-native.js [--out <dir>] [--arch x64,arm64]
 *
 *   --out   electron-builder output directory (default: <repo>/release, = build.directories.output)
 *   --arch  comma-separated mac archs to require (default: x64,arm64, = build.mac.target arch)
 *
 * Exit 0 when every requested arch has a `.app` holding its whisper.node; exit 1 otherwise,
 * listing every path checked. A missing `.app` for an arch is a failure, not a skip.
 */

const fs = require('fs');
const path = require('path');

const WHISPER_ADDON_PACKAGE = '@kutalia/whisper-node-addon';
const WHISPER_ADDON_BINARY = 'whisper.node';

// package.json build.mac.target = dmg × [x64, arm64] (D057 — never universal).
const DEFAULT_MAC_ARCHS = ['x64', 'arm64'];

/**
 * macOS `dist/` sub-directories that may hold `whisper.node`, in lookup order.
 * Same rule as the darwin branch of `whisperAddonDirCandidates` in
 * electron/whisper-addon-loader.ts and scripts/verify-native-modules.js — keep the
 * three in sync (scripts/__tests__/verify-packaged-native.test.mjs asserts parity).
 */
function macWhisperAddonDirCandidates(arch) {
  return [`mac-${arch}`, `darwin-${arch}`];
}

/**
 * Directory electron-builder packs a mac `.app` into for an arch:
 * `<out>/mac` for the default arch (x64), `<out>/mac-<arch>` otherwise
 * (app-builder-lib `computeAppOutDir` + builder-util `getArchSuffix`).
 */
function macAppOutDirName(arch) {
  return arch === 'x64' ? 'mac' : `mac-${arch}`;
}

function listApps(appOutDir) {
  let entries;
  try {
    entries = fs.readdirSync(appOutDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && e.name.endsWith('.app'))
    .map((e) => path.join(appOutDir, e.name))
    .sort();
}

/**
 * Check every requested arch. Returns `{ ok, archs }`; each arch entry carries
 * the apps found and, per app, the binary found (or null) plus every path tried.
 */
function verifyPackagedMac(outDir, archs = DEFAULT_MAC_ARCHS) {
  const results = archs.map((arch) => {
    const appOutDir = path.join(outDir, macAppOutDirName(arch));
    const apps = listApps(appOutDir).map((appPath) => {
      const distDir = path.join(
        appPath, 'Contents', 'Resources', 'app.asar.unpacked',
        'node_modules', WHISPER_ADDON_PACKAGE, 'dist',
      );
      const tried = macWhisperAddonDirCandidates(arch).map((dir) => path.join(distDir, dir, WHISPER_ADDON_BINARY));
      const found = tried.find((p) => fs.existsSync(p)) ?? null;
      return { appPath, found, tried };
    });
    const ok = apps.length > 0 && apps.every((a) => a.found);
    return { arch, appOutDir, apps, ok };
  });
  return { ok: results.every((r) => r.ok), archs: results };
}

function parseArgs(argv) {
  const opts = { outDir: path.join(__dirname, '..', 'release'), archs: DEFAULT_MAC_ARCHS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1]) {
      opts.outDir = path.resolve(argv[++i]);
    } else if (arg === '--arch' && argv[i + 1]) {
      opts.archs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      throw new Error(`unknown or incomplete argument: ${arg}`);
    }
  }
  if (opts.archs.length === 0) throw new Error('--arch needs at least one arch');
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[verify-packaged-native] ❌ ${err.message}`);
    console.error('[verify-packaged-native] usage: node scripts/verify-packaged-native.js [--out <dir>] [--arch x64,arm64]');
    process.exit(1);
  }

  const result = verifyPackagedMac(opts.outDir, opts.archs);

  for (const r of result.archs) {
    for (const app of r.apps) {
      if (app.found) {
        console.log(`[verify-packaged-native] ✅ ${r.arch}: ${app.found}`);
      }
    }
  }

  if (result.ok) {
    console.log(`[verify-packaged-native] ✅ ${WHISPER_ADDON_PACKAGE} binary present in every mac .app (${opts.archs.join(', ')})`);
    return;
  }

  console.error('');
  for (const r of result.archs) {
    if (r.ok) continue;
    if (r.apps.length === 0) {
      console.error(`[verify-packaged-native] ❌ ${r.arch}: no .app found in ${r.appOutDir}`);
      continue;
    }
    for (const app of r.apps) {
      if (app.found) continue;
      console.error(`[verify-packaged-native] ❌ ${r.arch}: ${path.basename(app.appPath)} has no ${WHISPER_ADDON_PACKAGE} binary`);
      for (const p of app.tried) {
        console.error(`      looked for: ${p}`);
      }
    }
  }
  console.error('');
  console.error('[verify-packaged-native] The dmg for these archs would ship without working voice input (BUG-116).');
  console.error(`[verify-packaged-native] No .app: check that \`electron-builder --mac\` ran and build.mac.target still lists these archs (${opts.archs.join(', ')}).`);
  console.error(`[verify-packaged-native] No binary: check node_modules/${WHISPER_ADDON_PACKAGE}/dist/ for mac-<arch>/ (or darwin-<arch>/) and that build.asarUnpack still covers ${WHISPER_ADDON_PACKAGE}.`);
  console.error('');
  process.exit(1);
}

module.exports = {
  DEFAULT_MAC_ARCHS,
  macWhisperAddonDirCandidates,
  macAppOutDirName,
  verifyPackagedMac,
  parseArgs,
};

if (require.main === module) {
  main();
}
