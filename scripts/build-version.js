const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

// Version resolution (D125 / T0376). Priority:
//   1. VERSION env — set by CI (pre-release.yml / release.yml) and by
//      .vscode/scripts/release.ps1 -Version. Behaviour must stay identical.
//   2. package.json `version` — the repo's version SoT (synced after every release).
//   3. Snapshot `<pkg version>-local.<yyMMddHHmmss>` — only when explicitly
//      requested via BAT_VERSION_SNAPSHOT=1. Sorts *below* the next real release.
// Git tags are never a version source (the repo carries v0.x / v2.2.x / v4.0.x
// tag lines); a v* tag on HEAD that disagrees with package.json only warns.
function resolveVersion({ env = {}, pkgVersion, tags = [], now = new Date() } = {}) {
  const warnings = [];

  if (env.VERSION) {
    return { version: env.VERSION.replace(/^v/, ''), source: 'env', warnings };
  }

  const base = pkgVersion ? String(pkgVersion).replace(/^v/, '') : '';
  if (!base) {
    throw new Error('package.json has no "version"; set the VERSION env explicitly');
  }

  const tagVersions = tags.filter((t) => /^v\d/.test(t)).map((t) => t.replace(/^v/, ''));
  if (tagVersions.length > 0 && !tagVersions.includes(base)) {
    warnings.push(
      `HEAD is tagged ${tags.join(', ')} but package.json version is ${base}; using package.json. ` +
      `Sync it with: npm version --no-git-tag-version --allow-same-version <version>`
    );
  }

  if (env.BAT_VERSION_SNAPSHOT === '1') {
    return { version: formatSnapshotVersion(base, now), source: 'snapshot', warnings };
  }

  return { version: base, source: 'package.json', warnings };
}

// 0.5.9 -> 0.5.9-local.261004204034, 0.5.9-pre.4 -> 0.5.9-pre.4.local.261004204034
// (semver keeps a single prerelease segment, so an existing one is extended with '.').
function formatSnapshotVersion(baseVersion, now) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = [
    now.getFullYear() % 100,
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ].map(pad).join('');
  const separator = baseVersion.includes('-') ? '.' : '-';
  return `${baseVersion}${separator}local.${stamp}`;
}

// v* tags pointing exactly at HEAD (no nearest-tag fallback).
function readHeadTags() {
  try {
    return execFileSync('git', ['tag', '--points-at', 'HEAD', '--list', 'v*'], {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function getVersion() {
  // CI path: VERSION env wins, git is not consulted at all.
  const tags = process.env.VERSION ? [] : readHeadTags();
  const pkgVersion = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')).version;
  return resolveVersion({ env: process.env, pkgVersion, tags, now: new Date() });
}

// Update package.json version. Returns the original file content when it was
// rewritten (so a local build can restore it), or null when nothing changed.
function updatePackageVersion(version) {
  const original = fs.readFileSync(PACKAGE_PATH, 'utf8');
  const packageJson = JSON.parse(original);

  const oldVersion = packageJson.version;
  if (oldVersion === version) {
    console.log(`Version unchanged: ${version} (package.json not modified)`);
    return null;
  }

  packageJson.version = version;
  fs.writeFileSync(PACKAGE_PATH, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`Version updated: ${oldVersion} -> ${version}`);
  return original;
}

// Run build
function runBuild() {
  // In CI, only compile (electron-builder runs separately)
  const command = process.env.CI ? 'npm run compile' : 'npm run build';
  console.log(`Running ${command}...\n`);
  execSync(command, {
    stdio: 'inherit',
    cwd: ROOT
  });
}

function main() {
  // --resolve-only: print the resolved version as JSON and exit (used by
  // .vscode/scripts/release.ps1). No guards, no writes, no build.
  if (process.argv.includes('--resolve-only')) {
    process.stdout.write(JSON.stringify(getVersion()) + '\n');
    return;
  }

  // Fail-fast guard: abort before bumping version / packaging if node_modules/
  // is missing critical native modules (see BUG-056, T0243).
  require('./verify-native-modules');

  // Fail-fast guard: abort if extraResources.filter drifts away from the helper
  // import graph (see BUG-058, T0247, T0248).
  require('./verify-helper-bundle');

  // Fail-fast guard: abort if anything under src/ imports a Node.js builtin
  // (see BUG-069, T0304, D090).
  require('./verify-renderer-imports');

  const { version, source, warnings } = getVersion();
  warnings.forEach((w) => console.warn(`WARNING: ${w}`));
  console.log(`Using version from ${source}: ${version}`);
  console.log(`\nBuilding version: ${version}\n`);

  const original = updatePackageVersion(version);
  try {
    runBuild();
  } finally {
    // CI packages in a later step (electron-builder reads package.json), so the
    // bumped version must stay. Locally `npm run build` already packaged — restore.
    if (original !== null && !process.env.CI) {
      fs.writeFileSync(PACKAGE_PATH, original);
      console.log('package.json version restored');
    }
  }

  console.log(`\nBuild completed: v${version}`);
}

if (require.main === module) {
  main();
}

module.exports = { resolveVersion, formatSnapshotVersion };
