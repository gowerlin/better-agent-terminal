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
 * T0472: a package directory can also exist while its install script never ran
 * (npm 12 `allowScripts`, `--ignore-scripts`, see T0471). Two such holes ship
 * broken installers under `build.npmRebuild: false`, so they are checked too:
 *   - the embedded claude `bin/claude.exe` must be the native executable, not the
 *     ~500-byte placeholder stub that @anthropic-ai/claude-code publishes;
 *   - better-sqlite3 must have its compiled `build/Release/better_sqlite3.node`.
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

// Hosts that build a desktop package (win x64, mac arm64, linux x64). darwin-x64 is not
// one: the mac build ships arm64 only (D136), so an Intel Mac host only warns (D137).
const DESKTOP_PACKAGE_HOSTS = ['win32-x64', 'linux-x64', 'darwin-arm64'];

// Desktop hosts are also those for which upstream ships a whisper binary. Other
// hosts — e.g. the linux-arm64 server-bundle runner — get a warning only: there the
// runtime loader leaves voice input disabled instead of crashing (BUG-116 fail-soft).
const WHISPER_ADDON_REQUIRED_HOSTS = DESKTOP_PACKAGE_HOSTS;

// T0472: the embedded claude / better-sqlite3 checks block on desktop package hosts
// only. Elsewhere (the linux-arm64 server-bundle runner, which never builds an
// installer and skips `@electron/rebuild`) they warn.
const EMBEDDED_RUNTIME_REQUIRED_HOSTS = DESKTOP_PACKAGE_HOSTS;

// install.cjs copies the host's native binary over `bin/claude.exe` on every
// platform (Unix ignores the extension): same rule as resolveEmbeddedClaudePath()
// in electron/claude-runtime-router.ts for the node-modules / electron-packaged layouts.
const EMBEDDED_CLAUDE_SEGMENTS = ['node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'];

// Text of the placeholder `bin/claude.exe` in the npm tarball
// (@anthropic-ai/claude-code 2.1.289: a 500-byte shell script).
const CLAUDE_STUB_MARKER = 'claude native binary not installed';

// Size is only a tie-breaker: a non-executable file this small is the stub even if
// its wording changes upstream. install.cjs treats < 4 KiB as stub-sized too.
const CLAUDE_STUB_MAX_BYTES = 4096;

const BETTER_SQLITE3_NODE_SEGMENTS = ['node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'];

const INSTALL_SCRIPTS_DOC = 'CLAUDE.md section "本機開發：npm 12 install scripts（T0471）"';

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

/** Executable format from a file's first bytes: 'pe' | 'elf' | 'macho' | null. */
function executableFormat(head) {
  if (head.length >= 2 && head[0] === 0x4d && head[1] === 0x5a) return 'pe'; // MZ
  if (head.length >= 4) {
    const magic = head.readUInt32BE(0);
    if (magic === 0x7f454c46) return 'elf';
    if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(magic)) return 'macho';
  }
  return null;
}

/** Executable format the host runs; null when there is no fixed answer. */
function hostExecutableFormat(platform) {
  switch (platform) {
    case 'win32':
      return 'pe';
    case 'darwin':
      return 'macho';
    case 'linux':
      return 'elf';
    default:
      return null;
  }
}

/**
 * What sits at the embedded claude path:
 *   native     — an executable in the host's format
 *   stub       — the npm placeholder (marker text, or a tiny non-executable)
 *   not-native — anything else, e.g. a binary built for another platform
 *   missing    — no file
 */
function classifyEmbeddedClaude(filePath, platform) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { status: 'missing', size: 0, format: null };
  }
  if (!stat.isFile()) return { status: 'missing', size: 0, format: null };

  const head = Buffer.alloc(Math.min(stat.size, CLAUDE_STUB_MAX_BYTES));
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, head, 0, head.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  const format = executableFormat(head);
  const expected = hostExecutableFormat(platform);
  if (format && (expected === null || format === expected)) {
    return { status: 'native', size: stat.size, format };
  }
  if (head.toString('latin1').includes(CLAUDE_STUB_MARKER) || (!format && stat.size < CLAUDE_STUB_MAX_BYTES)) {
    return { status: 'stub', size: stat.size, format };
  }
  return { status: 'not-native', size: stat.size, format };
}

/**
 * T0472: embedded claude + better-sqlite3 binaries. Returns the problems found and
 * whether they block this host (desktop package hosts) or only warn.
 */
function verifyEmbeddedRuntime(projectRoot, platform, arch) {
  const host = `${platform}-${arch}`;
  const problems = [];

  const claudePath = path.join(projectRoot, ...EMBEDDED_CLAUDE_SEGMENTS);
  const claude = classifyEmbeddedClaude(claudePath, platform);
  if (claude.status !== 'native') {
    const found = {
      missing: 'file not found',
      stub: `${claude.size} bytes, the npm placeholder stub ("Error: ${CLAUDE_STUB_MARKER}.")`,
      'not-native': `${claude.size} bytes, ${claude.format ? `a ${claude.format} executable` : 'not an executable'}; host ${host} needs ${hostExecutableFormat(platform) || 'a native executable'}`,
    }[claude.status];
    problems.push({
      id: 'embedded-claude',
      status: claude.status,
      summary: `Embedded claude (@anthropic-ai/claude-code) is not the native binary for host ${host}`,
      details: [`path: ${claudePath}`, `found: ${found}`],
      cause: 'An installer built now would ship a claude that cannot start. Likely cause: the @anthropic-ai/claude-code postinstall did not run (npm 12 allowScripts, --ignore-scripts) or --omit=optional skipped its platform package.',
      fix: [
        'node node_modules/@anthropic-ai/claude-code/install.cjs',
        'node_modules/@anthropic-ai/claude-code/bin/claude.exe --version   (expect "<version> (Claude Code)")',
      ],
    });
  }

  const sqlitePath = path.join(projectRoot, ...BETTER_SQLITE3_NODE_SEGMENTS);
  if (!fs.existsSync(sqlitePath)) {
    problems.push({
      id: 'better-sqlite3',
      status: 'missing',
      summary: `better-sqlite3 is installed but its native module was never built (host ${host})`,
      details: [`expected: ${sqlitePath}`],
      cause: 'An installer built now would ship without a working database. Likely cause: the better-sqlite3 install script did not run (npm 12 allowScripts, --ignore-scripts).',
      fix: ['npx electron-rebuild -f -w better-sqlite3   (local; CI runs `npm ci` + `npx --yes @electron/rebuild`)'],
    });
  }

  return { host, problems, blocking: problems.length > 0 && EMBEDDED_RUNTIME_REQUIRED_HOSTS.includes(host) };
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

  // Embedded claude + better-sqlite3 binaries (T0472).
  const runtime = verifyEmbeddedRuntime(projectRoot, process.platform, process.arch);
  if (runtime.blocking) {
    console.error('');
    for (const problem of runtime.problems) {
      console.error(`[verify-native-modules] ❌ ${problem.summary}`);
      for (const line of problem.details) {
        console.error(`      ${line}`);
      }
      console.error(`[verify-native-modules] ${problem.cause}`);
      console.error('[verify-native-modules] Fix (repo root):');
      for (const line of problem.fix) {
        console.error(`      ${line}`);
      }
      console.error('');
    }
    console.error(`[verify-native-modules] See ${INSTALL_SCRIPTS_DOC}.`);
    console.error('');
    process.exit(1);
  }
  for (const problem of runtime.problems) {
    console.warn(`[verify-native-modules] ⚠️ ${problem.summary} (${problem.details.join('; ')}); not a desktop package host, not fatal.`);
  }

  const whisperNote = found ? `, whisper binary: ${path.relative(projectRoot, found)}` : '';
  const runtimeNote = runtime.problems.length === 0 ? ', embedded claude: native, better-sqlite3: .node present' : '';
  console.log(`[verify-native-modules] ✅ All ${REQUIRED_NATIVE_MODULES.length} required native modules present${whisperNote}${runtimeNote}`);
}

module.exports = {
  whisperAddonDirCandidates,
  WHISPER_ADDON_REQUIRED_HOSTS,
  EMBEDDED_RUNTIME_REQUIRED_HOSTS,
  CLAUDE_STUB_MARKER,
  classifyEmbeddedClaude,
  executableFormat,
  verifyEmbeddedRuntime,
};

// Runs on `node scripts/verify-native-modules.js` and on `require()` from
// scripts/build-version.js (side-effect import). Skipped under vitest so the
// rule can be imported for the loader parity test.
if (!process.env.VITEST) {
  main();
}
