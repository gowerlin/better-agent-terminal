#!/usr/bin/env node
/**
 * Pre-build guard: verify that every static `import './*.mjs'` inside
 * scripts/ helpers resolves to a filename that will be bundled by
 * electron-builder's `build.extraResources[].filter`.
 *
 * Why this exists: BUG-058 shipped a packaged installer where
 * bat-terminal.mjs / bat-notify.mjs imported _bat-logger.mjs and
 * _bat-cert.mjs, but `extraResources[0].filter` was an explicit whitelist
 * `["bat-terminal.mjs", "bat-notify.mjs"]` that omitted the helpers.
 * At runtime the packaged app failed with ERR_MODULE_NOT_FOUND.
 *
 * T0247 switched the filter to `["*.mjs"]`. This script prevents future
 * drift: if the filter regresses to an explicit list that misses an
 * import target — or a new helper is added that isn't covered — build
 * aborts before vite / electron-builder run.
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

const extraResources = (pkg.build && pkg.build.extraResources) || [];
if (!Array.isArray(extraResources) || extraResources.length === 0) {
  console.log('[verify-helper-bundle] No build.extraResources configured, skipping.');
  process.exit(0);
}

// Convert a simple glob pattern (only `*` wildcard, no `**` / `?` / brace)
// into a regex that matches a single top-level filename. This is deliberately
// minimal — extraResources filters here are either literal filenames or `*.ext`.
function globToRegex(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp('^' + escaped + '$');
}

function isCovered(basename, filterGlobs) {
  return filterGlobs.some((g) => globToRegex(g).test(basename));
}

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

const problems = [];

for (const entry of extraResources) {
  if (!entry || typeof entry !== 'object') continue;
  const fromDir = entry.from;
  const filterGlobs = Array.isArray(entry.filter) ? entry.filter : [];
  if (!fromDir || filterGlobs.length === 0) continue;

  const absFromDir = path.join(projectRoot, fromDir);
  if (!fs.existsSync(absFromDir) || !fs.statSync(absFromDir).isDirectory()) continue;

  const topLevelMjs = fs.readdirSync(absFromDir).filter((name) => {
    const full = path.join(absFromDir, name);
    return name.endsWith('.mjs') && fs.statSync(full).isFile();
  });

  if (topLevelMjs.length === 0) continue;

  for (const mjs of topLevelMjs) {
    if (!isCovered(mjs, filterGlobs)) {
      problems.push({ kind: 'source-not-covered', from: fromDir, file: mjs, filterGlobs });
    }

    const content = fs.readFileSync(path.join(absFromDir, mjs), 'utf8');
    const targets = extractRelativeMjsImports(content);
    for (const target of targets) {
      if (!isCovered(target, filterGlobs)) {
        problems.push({
          kind: 'import-not-covered',
          from: fromDir,
          importer: mjs,
          target,
          filterGlobs,
        });
      }
      if (!fs.existsSync(path.join(absFromDir, target))) {
        problems.push({
          kind: 'import-target-missing',
          from: fromDir,
          importer: mjs,
          target,
        });
      }
    }
  }
}

// ---------- T0316: server bundle baseline check ----------
//
// Per PLAN-031 spec §3.1, electron-builder build.{win,mac,linux}.extraResources
// declares which baseline tarballs should be packed into the installer. The
// fetch-baseline-tarball.mjs pre-step writes them to dist-baseline/. Here we
// verify that for each platform-specific extraResources entry that targets
// dist-baseline/, every declared baseline tarball glob has at least one
// matching file on disk together with its .sha256 sidecar.
//
// Filename pattern: bat-server-<archTag>-v<version>.tar.gz
//   archTag ∈ { linux-x64, linux-arm64, darwin-arm64 }
//
// Linux double-arch nuance: the linux block declares both linux-x64 + linux-arm64
// globs (electron-builder JSON cannot branch on --arch). The fetch script only
// drops the active arch into dist-baseline/, so we only require AT LEAST ONE
// baseline tarball glob to be satisfied for a platform — not all of them.

const SERVER_BUNDLE_GLOB_RE = /^bat-server-(linux-x64|linux-arm64|darwin-arm64)-v\*\.tar\.gz$/;

function checkServerBundleBaseline() {
  const buildSection = pkg.build || {};
  const platforms = ['win', 'mac', 'linux'];
  const issues = [];

  for (const platform of platforms) {
    const platformBuild = buildSection[platform];
    if (!platformBuild || !Array.isArray(platformBuild.extraResources)) continue;

    for (const entry of platformBuild.extraResources) {
      if (!entry || typeof entry !== 'object') continue;
      const fromDir = entry.from;
      const filterGlobs = Array.isArray(entry.filter) ? entry.filter : [];
      if (!fromDir || filterGlobs.length === 0) continue;

      const tarballGlobs = filterGlobs.filter((g) => SERVER_BUNDLE_GLOB_RE.test(g));
      if (tarballGlobs.length === 0) continue;

      const absFromDir = path.join(projectRoot, fromDir);
      const dirExists = fs.existsSync(absFromDir) && fs.statSync(absFromDir).isDirectory();
      const onDisk = dirExists ? fs.readdirSync(absFromDir) : [];

      let satisfiedCount = 0;
      const missingSidecars = [];

      for (const tarGlob of tarballGlobs) {
        const re = globToRegex(tarGlob);
        const tarballMatches = onDisk.filter((n) => re.test(n));
        if (tarballMatches.length === 0) continue;

        // sidecar must accompany every tarball match
        const sidecarMatches = onDisk.filter((n) => re.test(n.replace(/\.sha256$/, '')) && n.endsWith('.sha256'));
        for (const tar of tarballMatches) {
          if (!onDisk.includes(`${tar}.sha256`)) missingSidecars.push(`${tar}.sha256`);
        }
        if (tarballMatches.length > 0 && sidecarMatches.length === 0) {
          // count as satisfied for tarball but record sidecar gap separately
        }
        satisfiedCount++;
      }

      if (satisfiedCount === 0) {
        issues.push({
          platform,
          fromDir,
          tarballGlobs,
          dirExists,
        });
      }
      if (missingSidecars.length > 0) {
        issues.push({ platform, fromDir, missingSidecars });
      }
    }
  }

  if (issues.length > 0) {
    console.error('');
    console.error('[verify-helper-bundle] PLAN-031 server bundle baseline check failed');
    console.error('');
    for (const issue of issues) {
      if (issue.missingSidecars) {
        console.error(`  - ${issue.fromDir}/ is missing .sha256 sidecar(s) for ${issue.platform}: ${issue.missingSidecars.join(', ')}`);
      } else {
        const dirNote = issue.dirExists ? `${issue.fromDir}/ exists but contains no matching tarball` : `${issue.fromDir}/ does not exist`;
        console.error(`  - ${issue.platform}.extraResources expects ${issue.tarballGlobs.join(' / ')} but ${dirNote}`);
      }
    }
    console.error('');
    console.error('[verify-helper-bundle] Fix: run the baseline pre-fetch before build, e.g.');
    console.error('      node scripts/fetch-baseline-tarball.mjs --host-os <win|mac|linux> --host-arch <x64|arm64>');
    console.error('  or  npm run fetch:baseline');
    console.error('');
    console.error('[verify-helper-bundle] Background: T0316 / PLAN-031 — baseline tarballs must be packed into the installer.');
    console.error('');
    process.exit(1);
  }
}

checkServerBundleBaseline();

if (problems.length > 0) {
  console.error('');
  console.error('[verify-helper-bundle] extraResources.filter does not cover every helper import');
  console.error('');
  const suggestedAdds = new Set();
  for (const p of problems) {
    if (p.kind === 'source-not-covered') {
      console.error(`  - scripts/${p.file} is on disk but NOT matched by filter ${JSON.stringify(p.filterGlobs)}`);
      suggestedAdds.add(p.file);
    } else if (p.kind === 'import-not-covered') {
      console.error(`  - ${p.from}/${p.importer} imports './${p.target}', but that filename is NOT matched by filter ${JSON.stringify(p.filterGlobs)}`);
      console.error(`      -> at runtime the packaged app will fail with ERR_MODULE_NOT_FOUND`);
      suggestedAdds.add(p.target);
    } else if (p.kind === 'import-target-missing') {
      console.error(`  - ${p.from}/${p.importer} imports './${p.target}', but that file does not exist in ${p.from}/`);
    }
  }
  console.error('');
  console.error('[verify-helper-bundle] Fix options:');
  console.error('  (A) Restore the inclusive glob: set build.extraResources[].filter = ["*.mjs"]');
  if (suggestedAdds.size > 0) {
    const list = Array.from(suggestedAdds).map((f) => `"${f}"`).join(', ');
    console.error(`  (B) Or keep the explicit list but add: ${list}`);
  }
  console.error('');
  console.error('[verify-helper-bundle] Background: BUG-058 / T0247 — helpers missing from packaged installer.');
  console.error('');
  process.exit(1);
}

const total = extraResources.reduce((acc, entry) => {
  if (!entry || !entry.from) return acc;
  const abs = path.join(projectRoot, entry.from);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return acc;
  return acc + fs.readdirSync(abs).filter((n) => n.endsWith('.mjs')).length;
}, 0);

console.log(`[verify-helper-bundle] OK — all ${total} helper .mjs files in extraResources are reachable via filter`);
