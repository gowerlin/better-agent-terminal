#!/usr/bin/env node
/**
 * Pre-build guard: refuse to bundle the renderer if anything under src/
 * imports a Node.js builtin (either as `import 'fs'` or `import 'node:fs'`).
 *
 * Why this exists: BUG-069 shipped v0.4.1 NSIS with a single
 * `import * as https from 'node:https'` in setup-wizard fetch-fingerprint.ts.
 * vite-plugin-electron-renderer rewrote it into a virtual chunk containing
 * `const avoid_parse_require = require;`, which eager-loaded into the main
 * bundle and crashed at startup with `Uncaught ReferenceError: require is
 * not defined` on every NSIS launch (BUG-069 / D090).
 *
 * Project does not currently have ESLint installed, so the equivalent of the
 * `no-restricted-imports` rule is implemented here as a static scan, in line
 * with the existing verify-native-modules.js / verify-helper-bundle.js
 * pattern. Build aborts before vite / electron-builder run.
 *
 * Scope:
 *   - scans src/**\/*.{ts,tsx,js,jsx,mjs,cjs}
 *   - blocks `import ... from 'node:*'` (any subpath after the prefix)
 *   - blocks bare-specifier imports listed in BLOCKED_BARE below
 *   - applies to static `import` and dynamic `import('...')` only — no `require()`
 *   - electron/, scripts/, tools/ are NOT scanned (main process / build tooling
 *     is allowed to use Node builtins).
 *
 * Allow-list escape hatch: a per-file inline comment
 *   // verify-renderer-imports-allow
 * placed within the first 5 lines of a file disables this check for that file.
 * Use sparingly — adding the comment requires a follow-up workorder to either
 * relocate the file out of src/ or migrate it to IPC.
 *
 * Run: `node scripts/verify-renderer-imports.js` or `npm run verify:renderer-imports`
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

// Bare-specifier Node builtins that must never reach the renderer bundle.
// `node:*` prefix is blocked separately via regex.
const BLOCKED_BARE = new Set([
  'fs',
  'path',
  'os',
  'child_process',
  'http',
  'https',
  'crypto',
  'stream',
  'net',
  'url',
  'buffer',
  'dns',
  'tls',
  'zlib',
  'util',
  'querystring',
]);

// Match: import ... from '<spec>'  |  import '<spec>'  |  import('<spec>')
// Captures the specifier in group 1.
const STATIC_IMPORT_RE = /\bimport\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const ALLOW_COMMENT = 'verify-renderer-imports-allow';

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// Test files run under vitest (Node), not vite renderer build, so importing
// Node builtins from them is safe and should not trip this check.
const TEST_FILE_RE = /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'dist-electron') continue;
      if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
      yield* walk(full);
    } else if (entry.isFile() && SOURCE_EXT.has(path.extname(entry.name))) {
      if (TEST_FILE_RE.test(entry.name)) continue;
      yield full;
    }
  }
}

function hasAllowEscape(content) {
  const head = content.split('\n').slice(0, 5).join('\n');
  return head.includes(ALLOW_COMMENT);
}

function classify(spec) {
  if (spec.startsWith('node:')) return 'node-prefix';
  if (BLOCKED_BARE.has(spec)) return 'bare-builtin';
  return null;
}

function extractImports(content) {
  const found = [];
  const seen = new Set();
  for (const re of [STATIC_IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const spec = m[1];
      const kind = classify(spec);
      if (!kind) continue;
      const line = content.slice(0, m.index).split('\n').length;
      const key = `${spec}@${line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ spec, kind, line });
    }
  }
  return found;
}

if (!fs.existsSync(srcDir)) {
  console.log('[verify-renderer-imports] No src/ directory, skipping.');
  process.exit(0);
}

const violations = [];
let scanned = 0;
let allowed = 0;

for (const file of walk(srcDir)) {
  scanned += 1;
  const content = fs.readFileSync(file, 'utf8');
  if (hasAllowEscape(content)) {
    allowed += 1;
    continue;
  }
  const hits = extractImports(content);
  for (const hit of hits) {
    violations.push({
      file: path.relative(projectRoot, file).replace(/\\/g, '/'),
      ...hit,
    });
  }
}

if (violations.length > 0) {
  console.error('');
  console.error('[verify-renderer-imports] Renderer cannot import Node.js builtins (D090).');
  console.error('');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line}  ->  import "${v.spec}"  (${v.kind})`);
  }
  console.error('');
  console.error('[verify-renderer-imports] Why this fails the build:');
  console.error('  vite-plugin-electron-renderer rewrites Node builtin imports into virtual');
  console.error('  chunks containing `const avoid_parse_require = require;`. In a packaged');
  console.error('  NSIS build with nodeIntegration:false, that crashes at startup with:');
  console.error('      Uncaught ReferenceError: require is not defined');
  console.error('  See BUG-069 / D090.');
  console.error('');
  console.error('[verify-renderer-imports] Fix options:');
  console.error('  (A) Move the work to electron/ (main process) and expose it via IPC');
  console.error('      through electron/preload.ts -- see wsl.fetchFingerprint (T0304).');
  console.error('  (B) If the file is build-time tooling, relocate it out of src/');
  console.error('      (e.g. into scripts/ or tools/).');
  console.error('  (C) Last resort, add `// verify-renderer-imports-allow` within the first');
  console.error('      5 lines of the file AND open a follow-up workorder. Do not abuse.');
  console.error('');
  process.exit(1);
}

console.log(`[verify-renderer-imports] OK -- scanned ${scanned} files under src/ (${allowed} allow-listed), no banned Node imports`);
