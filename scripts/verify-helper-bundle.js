#!/usr/bin/env node
/**
 * Pre-build guard for the helper scripts the installer and the server bundle ship.
 *
 * Why this exists: BUG-058 shipped a packaged installer where
 * bat-terminal.mjs / bat-notify.mjs imported _bat-logger.mjs and
 * _bat-cert.mjs, but `extraResources[0].filter` was an explicit whitelist
 * `["bat-terminal.mjs", "bat-notify.mjs"]` that omitted the helpers.
 * At runtime the packaged app failed with ERR_MODULE_NOT_FOUND.
 *
 * T0247 switched the filter to `["*.mjs"]`, which also shipped every build / dev
 * script in scripts/. T0689 went back to an explicit whitelist, guarded here:
 *   - the `scripts` entry of build.extraResources lists literal file names only
 *     (a wildcard would pull the dev scripts back in)
 *   - every listed file exists, and the list is closed under static relative
 *     .mjs imports (the BUG-058 failure)
 *   - the list equals `serverBundleHelperScripts` (scripts/build-server-bundle.mjs):
 *     local PTYs (BAT_HELPER_DIR = <resources>/scripts) and headless PTYs
 *     (<installRoot>/scripts) run the same runtime helpers
 * scripts/verify-packaged-native.js checks the packaged resources/scripts again (T0689).
 *
 * Scope (intentionally narrow; see T0248 "Not in scope"):
 *   - top-level .mjs files only (no recursion into scripts/hooks/ etc.)
 *   - static `import ... from './name.mjs'` only (no dynamic import())
 *   - pure Node + regex (no @babel/parser or other new deps)
 *
 * Run: `node scripts/verify-helper-bundle.js` or `npm run verify:helpers`
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

// Match static relative imports of `.mjs` files, e.g.
//   import { foo } from './_bat-logger.mjs'
//   import './helper.mjs'
// Package / built-in imports are intentionally excluded — we only care about
// relative helpers that must be physically bundled alongside the importer.
const importPattern = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"](\.\/[^'"]+\.mjs)['"]/gm;

function extractRelativeMjsImports(fileContent) {
  const targets = new Set();
  let match;
  importPattern.lastIndex = 0;
  while ((match = importPattern.exec(fileContent)) !== null) {
    const rel = match[1];
    const base = rel.replace(/^\.\//, '');
    if (base.includes('/')) continue;
    targets.add(base);
  }
  return targets;
}

// ---------- D146 / T0547: no server bundle baseline in the installer ----------
//
// T0316 (PLAN-031) packed a per-host baseline tarball into every installer through
// build.<platform>.extraResources (from dist-baseline/ to bat-server-baseline/) and this
// check required dist-baseline/ to hold it. D146 dropped the baseline: the setup wizard
// downloads `server-bundle-v<version>` on demand, or imports a local tarball. A baseline
// entry that comes back (top-level or per platform) would silently add 159-298 MiB per
// installer, so the build stops instead.

const SERVER_BUNDLE_GLOB_RE = /^bat-server-[^/]*\.tar\.gz(?:\.sha256)?$/;

function isBaselineEntry(entry) {
  if (typeof entry === 'string') return /(^|\/)(dist-baseline|bat-server-baseline)(\/|$)/.test(entry);
  if (!entry || typeof entry !== 'object') return false;
  if (/(^|\/)(dist-baseline|bat-server-baseline)(\/|$)/.test(String(entry.from || ''))) return true;
  if (/(^|\/)bat-server-baseline(\/|$)/.test(String(entry.to || ''))) return true;
  const filters = Array.isArray(entry.filter) ? entry.filter : [];
  return filters.some((g) => SERVER_BUNDLE_GLOB_RE.test(String(g)));
}

function checkNoServerBundleBaseline() {
  const buildSection = pkg.build || {};
  const issues = [];
  const sections = [['build', buildSection]];
  for (const platform of ['win', 'mac', 'linux']) {
    if (buildSection[platform]) sections.push([`build.${platform}`, buildSection[platform]]);
  }
  for (const [name, section] of sections) {
    for (const key of ['extraResources', 'extraFiles']) {
      const entries = Array.isArray(section[key]) ? section[key] : [];
      for (const entry of entries) {
        if (isBaselineEntry(entry)) issues.push(`${name}.${key}: ${JSON.stringify(entry)}`);
      }
    }
  }

  if (issues.length > 0) {
    console.error('');
    console.error('[verify-helper-bundle] D146 / T0547: installers must not ship a server bundle baseline');
    console.error('');
    for (const issue of issues) console.error(`  - ${issue}`);
    console.error('');
    console.error('[verify-helper-bundle] Fix: remove the entry. The setup wizard downloads server-bundle-v<version>');
    console.error('      on demand (or imports a local tarball); see docs/server-bundle-distribution.md.');
    console.error('');
    process.exit(1);
  }
  console.log('[verify-helper-bundle] OK: no server bundle baseline in the installer config (D146).');
}

checkNoServerBundleBaseline();

// ---------- T0433: helpers shipped inside the server bundle ----------
//
// scripts/build-server-bundle.mjs copies `serverBundleHelperScripts` into
// <installRoot>/scripts/ — the BAT_HELPER_DIR of every headless PTY (PLAN-036
// P3 / K). Same failure as BUG-058, other packager: a helper whose relative
// .mjs import is not listed dies with ERR_MODULE_NOT_FOUND on the remote host.
// Checked here (source parse; the build script runs main() at load and cannot
// be imported):
//   - the list exists and holds bat-terminal.mjs + bat-notify.mjs + bat-mcp.mjs (T0584) + bat-hook.mjs (T0590)
//   - every listed file exists in scripts/
//   - the list is closed under static relative .mjs imports
//   - the build actually copies it (copyHelperScripts() is called)

const SERVER_BUNDLE_SCRIPT = path.join(projectRoot, 'scripts', 'build-server-bundle.mjs');
const REQUIRED_SERVER_BUNDLE_HELPERS = ['bat-terminal.mjs', 'bat-notify.mjs', 'bat-mcp.mjs', 'bat-hook.mjs'];

function parseServerBundleHelperScripts(source) {
  const listMatch = source.match(/const\s+serverBundleHelperScripts\s*=\s*\[([\s\S]*?)\]/);
  if (!listMatch) return null;
  return [...listMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function checkServerBundleHelpers() {
  const scriptsDir = path.join(projectRoot, 'scripts');
  const issues = [];
  let source = null;
  try {
    source = fs.readFileSync(SERVER_BUNDLE_SCRIPT, 'utf8');
  } catch (err) {
    issues.push(`cannot read scripts/build-server-bundle.mjs: ${err.message}`);
  }

  const listed = source === null ? null : parseServerBundleHelperScripts(source);
  if (source !== null && listed === null) {
    issues.push('`const serverBundleHelperScripts = [...]` not found in scripts/build-server-bundle.mjs');
  }
  if (listed) {
    if (!/\n\s*await\s+copyHelperScripts\(\)/.test(source)) {
      issues.push('scripts/build-server-bundle.mjs no longer calls copyHelperScripts() — the helpers would not be copied');
    }
    for (const required of REQUIRED_SERVER_BUNDLE_HELPERS) {
      if (!listed.includes(required)) issues.push(`serverBundleHelperScripts is missing ${required}`);
    }
    const listedSet = new Set(listed);
    for (const name of listed) {
      const full = path.join(scriptsDir, name);
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
        issues.push(`serverBundleHelperScripts lists ${name}, but scripts/${name} does not exist`);
        continue;
      }
      for (const target of extractRelativeMjsImports(fs.readFileSync(full, 'utf8'))) {
        if (!listedSet.has(target)) {
          issues.push(`scripts/${name} imports './${target}', but serverBundleHelperScripts does not list it — add '${target}'`);
        }
      }
    }
  }

  if (issues.length > 0) {
    console.error('');
    console.error('[verify-helper-bundle] T0433 server bundle helper check failed');
    console.error('');
    for (const issue of issues) console.error(`  - ${issue}`);
    console.error('');
    console.error('[verify-helper-bundle] Background: T0433 / PLAN-036 — headless PTYs run these helpers from <installRoot>/scripts (BUG-058 analogue).');
    console.error('');
    process.exit(1);
  }
  return listed;
}

const serverBundleHelpers = checkServerBundleHelpers();

// ---------- T0689: the installer ships the runtime helpers only ----------
//
// build.extraResources `{ from: 'scripts', to: 'scripts', filter: [...] }` is what lands in
// <resources>/scripts, the BAT_HELPER_DIR of every local PTY (electron/main.ts
// localHelperDir; bat-mcp.mjs / bat-hook.mjs are found there too, electron/bat-mcp-launch.ts).
// The filter is a whitelist of literal names equal to serverBundleHelperScripts.

const WILDCARD_RE = /[*?[\]{}!]/;

function checkInstallerHelpers(serverBundleHelpers) {
  const scriptsDir = path.join(projectRoot, 'scripts');
  const buildSection = pkg.build || {};
  const extraResources = Array.isArray(buildSection.extraResources) ? buildSection.extraResources : [];
  const issues = [];
  const entries = extraResources.filter((entry) => entry && typeof entry === 'object' && entry.from === 'scripts');
  let filter = [];
  if (entries.length !== 1) {
    issues.push(`build.extraResources needs exactly one { from: 'scripts', to: 'scripts', filter: [...] } entry (found ${entries.length})`);
  } else {
    const entry = entries[0];
    if (entry.to !== 'scripts') {
      issues.push(`build.extraResources scripts entry has to: ${JSON.stringify(entry.to)}; BAT_HELPER_DIR is <resources>/scripts (to: 'scripts')`);
    }
    filter = Array.isArray(entry.filter) ? entry.filter.map(String) : [];
    if (filter.length === 0) issues.push('build.extraResources scripts entry has no filter list (every file in scripts/ would ship)');
  }

  for (const name of filter) {
    if (WILDCARD_RE.test(name) || name.includes('/') || name.includes('\\')) {
      issues.push(`filter entry ${JSON.stringify(name)} is not a literal file name in scripts/ (a pattern ships the build / dev scripts too)`);
      continue;
    }
    const full = path.join(scriptsDir, name);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      issues.push(`filter lists ${name}, but scripts/${name} does not exist`);
      continue;
    }
    if (!name.endsWith('.mjs')) continue;
    for (const target of extractRelativeMjsImports(fs.readFileSync(full, 'utf8'))) {
      if (!filter.includes(target)) {
        issues.push(`scripts/${name} imports './${target}', but the filter does not list it -> ERR_MODULE_NOT_FOUND in the installed app`);
      }
    }
  }

  const literal = filter.filter((name) => !WILDCARD_RE.test(name));
  const onlyInstaller = literal.filter((name) => !serverBundleHelpers.includes(name));
  const onlyServerBundle = serverBundleHelpers.filter((name) => !literal.includes(name));
  if (onlyInstaller.length > 0) {
    issues.push(`filter lists ${onlyInstaller.join(', ')}, which serverBundleHelperScripts does not`);
  }
  if (onlyServerBundle.length > 0) {
    issues.push(`serverBundleHelperScripts lists ${onlyServerBundle.join(', ')}, which the filter does not`);
  }

  if (issues.length > 0) {
    console.error('');
    console.error('[verify-helper-bundle] T0689 installer helper whitelist check failed');
    console.error('');
    for (const issue of issues) console.error(`  - ${issue}`);
    console.error('');
    console.error('[verify-helper-bundle] Fix: list each runtime helper by file name in BOTH package.json');
    console.error('      build.extraResources (from: scripts) filter AND serverBundleHelperScripts in');
    console.error('      scripts/build-server-bundle.mjs, then run `npm run verify:helpers`. Do not go back to "*.mjs":');
    console.error('      it ships every build / dev script in scripts/.');
    console.error('');
    console.error('[verify-helper-bundle] Background: BUG-058 / T0247 (helpers missing from the installer), T0689 (dev scripts in the installer).');
    console.error('');
    process.exit(1);
  }
  return filter.length;
}

const installerHelperCount = checkInstallerHelpers(serverBundleHelpers);

console.log(`[verify-helper-bundle] OK — the installer ships ${installerHelperCount} runtime helper(s) listed by name, the same set as the server bundle, with a closed import set`);
