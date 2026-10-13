#!/usr/bin/env node
/**
 * Post-package guard: verify the native binaries inside what electron-builder produced.
 *
 * Why this exists (BUG-116 / T0470): scripts/verify-native-modules.js only checks
 * node_modules/ on the CI host, before packaging. What actually ships can differ:
 *   - BUG-117 / T0474: the x64 mac .app carried arm64 binaries (one arm64 host packs
 *     every arch from the same node_modules), yet a whisper.node *existed* — false green.
 *   - BUG-118 / T0474: electron-builder drops node_modules `.exe` files for non-Windows
 *     targets, so mac / Linux packages had no `claude-code/bin/claude.exe`.
 *
 * mac (default), per `.app` of each requested arch (T0475):
 *   (a) `Contents/MacOS/<exe>` cputype is the baseline, and must match the requested arch;
 *   (b) every Mach-O under `Contents/Resources/app.asar.unpacked` must be the baseline
 *       cputype, or a fat binary that contains it (ELF / PE are not checked; see
 *       isCrossArchAllowed for the few directories that ship other archs on purpose);
 *   (c) the embedded claude, found with the runtime rule (packagedEmbeddedClaudeCandidates),
 *       must exist and be the baseline cputype;
 *   plus the whisper.node presence check from T0470.
 *
 * linux (T0475): the embedded claude in `<out>/linux-unpacked` (x64) must exist and be
 * an ELF for the requested arch.
 *
 * Usage (run after electron-builder, before uploading artifacts):
 *   node scripts/verify-packaged-native.js [--platform mac|linux] [--out <dir>] [--arch <list>]
 *
 *   --platform  mac (default) or linux
 *   --out       electron-builder output directory (default: <repo>/release, = build.directories.output)
 *   --arch      comma-separated archs to require (default: mac arm64 = build.mac.target arch (D136);
 *               linux x64 = the AppImage the CI linux job builds)
 *
 * Exit 0 when every check passes; exit 1 otherwise, listing what was checked.
 * A missing `.app` / unpacked directory for an arch is a failure, not a skip.
 *
 * Only reads file headers — nothing found in the package is executed.
 */

const fs = require('fs');
const path = require('path');

const WHISPER_ADDON_PACKAGE = '@kutalia/whisper-node-addon';
const WHISPER_ADDON_BINARY = 'whisper.node';

// package.json build.mac.target = dmg × [arm64] (D136 — Intel Mac dropped; D057 — never universal).
const DEFAULT_MAC_ARCHS = ['arm64'];
// The CI linux job builds one AppImage on ubuntu-24.04 (x64).
const DEFAULT_LINUX_ARCHS = ['x64'];

const PLATFORMS = ['mac', 'linux'];

// Mach-O header constants (<mach-o/loader.h>, <mach-o/fat.h>).
const MH_MAGIC = 0xfeedface;
const MH_MAGIC_64 = 0xfeedfacf;
const FAT_MAGIC = 0xcafebabe;
const FAT_MAGIC_64 = 0xcafebabf;
// A real fat binary holds a handful of archs; Java class files share 0xCAFEBABE and
// put their version (>= 45) where nfat_arch would be.
const FAT_MAX_ARCHS = 16;
const MACH_CPU_TYPES = { x64: 0x01000007, arm64: 0x0100000c };

// ELF e_machine values.
const ELF_MACHINES = { x64: 0x3e, arm64: 0xb7 };

const HEADER_BYTES = 4096;

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
 * Embedded claude candidates inside a packaged app's resources directory, most
 * preferred first. Same rule as `embeddedClaudeCandidates` for the `electron-packaged`
 * layout in electron/claude-runtime-router.ts (BUG-118 / T0475; a .js script cannot
 * import .ts — electron/__tests__/claude-runtime-router.test.ts asserts parity):
 * Windows keeps `claude-code/bin/claude.exe`; elsewhere the platform package binary
 * comes first, `bin/claude.exe` second.
 */
function packagedEmbeddedClaudeCandidates(resourcesPath, platform, arch, musl = false) {
  const anthropicDir = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@anthropic-ai');
  const wrapperBinary = path.join(anthropicDir, 'claude-code', 'bin', 'claude.exe');
  if (platform === 'win32') return [wrapperBinary];
  const platformPackage = `claude-code-${platform}-${arch}${platform === 'linux' && musl ? '-musl' : ''}`;
  return [path.join(anthropicDir, platformPackage, 'claude'), wrapperBinary];
}

/**
 * Directory electron-builder packs a mac `.app` into for an arch:
 * `<out>/mac` for the default arch (x64), `<out>/mac-<arch>` otherwise
 * (app-builder-lib `computeAppOutDir` + builder-util `getArchSuffix`).
 */
function macAppOutDirName(arch) {
  return arch === 'x64' ? 'mac' : `mac-${arch}`;
}

/** Same rule for Linux: `<out>/linux-unpacked` (x64), `<out>/linux-<arch>-unpacked` otherwise. */
function linuxAppOutDirName(arch) {
  return arch === 'x64' ? 'linux-unpacked' : `linux-${arch}-unpacked`;
}

function readHeader(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(HEADER_BYTES);
    const n = fs.readSync(fd, buf, 0, HEADER_BYTES, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Mach-O cputypes in a file header: one entry for a thin binary, one per slice for a
 * fat binary; null when the header is not Mach-O.
 */
function machOCpuTypes(head) {
  if (head.length < 8) return null;
  const be = head.readUInt32BE(0);
  if (be === FAT_MAGIC || be === FAT_MAGIC_64) {
    const count = head.readUInt32BE(4);
    const entrySize = be === FAT_MAGIC ? 20 : 32;
    if (count === 0 || count > FAT_MAX_ARCHS || head.length < 8 + count * entrySize) return null;
    const types = [];
    for (let i = 0; i < count; i++) types.push(head.readUInt32BE(8 + i * entrySize));
    return types;
  }
  if (be === MH_MAGIC || be === MH_MAGIC_64) return [head.readUInt32BE(4)];
  const le = head.readUInt32LE(0);
  if (le === MH_MAGIC || le === MH_MAGIC_64) return [head.readUInt32LE(4)];
  return null;
}

/** ELF e_machine from a file header; null when the header is not ELF. */
function elfMachine(head) {
  if (head.length < 20 || head.readUInt32BE(0) !== 0x7f454c46) return null;
  return head[5] === 2 ? head.readUInt16BE(18) : head.readUInt16LE(18);
}

function cpuTypeName(cputype) {
  const arch = Object.keys(MACH_CPU_TYPES).find((a) => MACH_CPU_TYPES[a] === cputype);
  return arch ? (arch === 'x64' ? 'x86_64' : arch) : `cputype 0x${cputype.toString(16)}`;
}

function describeCpuTypes(types) {
  return types.length === 1 ? cpuTypeName(types[0]) : `fat [${types.map(cpuTypeName).join(', ')}]`;
}

/** Files under `dir`, recursively; symlinks are not followed (their targets are scanned in place). */
function walkFiles(dir) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  return files.sort();
}

/**
 * Directories that ship binaries for another arch on purpose (relative to
 * `app.asar.unpacked`, '/'-separated). Only Mach-O needs listing — ELF / PE are never
 * checked. Today that is the whisper addon, which carries every platform's build in
 * `dist/<platform>-<arch>/` and loads only its own (electron/whisper-addon-loader.ts):
 * its other mac arch directories are allowed. Do not widen this to whole packages — a
 * foreign-arch platform package (`*-darwin-x64` in an arm64 app) is exactly BUG-117.
 */
function isCrossArchAllowed(relPath, baselineArch) {
  const prefix = `node_modules/${WHISPER_ADDON_PACKAGE}/dist/`;
  if (!relPath.startsWith(prefix)) return false;
  const distDir = relPath.slice(prefix.length).split('/')[0];
  const match = /^(mac|darwin)-(.+)$/.exec(distDir);
  return match !== null && match[2] !== baselineArch;
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
 * `Contents/MacOS/<exe>`: the file named after the bundle when it is Mach-O, else the
 * first Mach-O in the directory. Returns `{ path, cputypes }` or null.
 */
function macMainExecutable(appPath) {
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  let names;
  try {
    names = fs.readdirSync(macosDir).sort();
  } catch {
    return null;
  }
  const preferred = path.basename(appPath, '.app');
  const ordered = names.includes(preferred) ? [preferred, ...names.filter((n) => n !== preferred)] : names;
  for (const name of ordered) {
    const full = path.join(macosDir, name);
    try {
      if (!fs.statSync(full).isFile()) continue;
      const cputypes = machOCpuTypes(readHeader(full));
      if (cputypes) return { path: full, cputypes };
    } catch {
      // unreadable entry: try the next one
    }
  }
  return null;
}

function containsCpuType(types, cputype) {
  return types !== null && types.includes(cputype);
}

/** First existing embedded claude candidate and its Mach-O cputypes / ELF machine. */
function inspectEmbeddedClaude(tried) {
  const found = tried.find((p) => fs.existsSync(p)) ?? null;
  if (!found) return { found: null, tried, cputypes: null, elfMachine: null };
  const head = readHeader(found);
  return { found, tried, cputypes: machOCpuTypes(head), elfMachine: elfMachine(head) };
}

function verifyMacApp(appPath, arch) {
  const expected = MACH_CPU_TYPES[arch];
  const problems = [];
  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  const unpackedDir = path.join(resourcesPath, 'app.asar.unpacked');

  // whisper (T0470)
  const distDir = path.join(unpackedDir, 'node_modules', WHISPER_ADDON_PACKAGE, 'dist');
  const tried = macWhisperAddonDirCandidates(arch).map((dir) => path.join(distDir, dir, WHISPER_ADDON_BINARY));
  const found = tried.find((p) => fs.existsSync(p)) ?? null;
  if (!found) {
    problems.push({ id: 'whisper', message: `no ${WHISPER_ADDON_PACKAGE} binary`, details: tried.map((p) => `looked for: ${p}`) });
  }

  // (a) baseline
  const main = macMainExecutable(appPath);
  let baseline = null;
  if (!main) {
    problems.push({ id: 'baseline', message: 'no Mach-O main executable', details: [`looked in: ${path.join(appPath, 'Contents', 'MacOS')}`] });
  } else if (expected === undefined) {
    problems.push({ id: 'baseline', message: `unknown mac arch "${arch}" (known: ${Object.keys(MACH_CPU_TYPES).join(', ')})`, details: [] });
  } else if (!containsCpuType(main.cputypes, expected)) {
    problems.push({
      id: 'baseline',
      message: `main executable is ${describeCpuTypes(main.cputypes)}, expected ${cpuTypeName(expected)} for ${arch}`,
      details: [main.path],
    });
  } else {
    baseline = expected;
  }

  // (b) every Mach-O under app.asar.unpacked
  const foreign = [];
  let machOCount = 0;
  if (baseline !== null) {
    for (const file of walkFiles(unpackedDir)) {
      let cputypes;
      try {
        cputypes = machOCpuTypes(readHeader(file));
      } catch {
        continue;
      }
      if (!cputypes) continue;
      machOCount++;
      if (containsCpuType(cputypes, baseline)) continue;
      const rel = path.relative(unpackedDir, file).split(path.sep).join('/');
      if (isCrossArchAllowed(rel, arch)) continue;
      foreign.push({ path: file, cputypes });
    }
    if (foreign.length > 0) {
      problems.push({
        id: 'foreign-arch',
        message: `${foreign.length} Mach-O file(s) under app.asar.unpacked without ${cpuTypeName(baseline)}`,
        details: foreign.map((f) => `${describeCpuTypes(f.cputypes)}: ${f.path}`),
      });
    }
  }

  // (c) embedded claude
  const claude = inspectEmbeddedClaude(packagedEmbeddedClaudeCandidates(resourcesPath, 'darwin', arch));
  if (!claude.found) {
    problems.push({ id: 'embedded-claude', message: 'no embedded claude (BUG-118)', details: claude.tried.map((p) => `looked for: ${p}`) });
  } else if (expected !== undefined && !containsCpuType(claude.cputypes, expected)) {
    problems.push({
      id: 'embedded-claude',
      message: `embedded claude is ${claude.cputypes ? describeCpuTypes(claude.cputypes) : 'not a Mach-O binary'}, expected ${cpuTypeName(expected)}`,
      details: [claude.found],
    });
  }

  return {
    appPath,
    found,
    tried,
    baseline: main,
    machOCount,
    foreign,
    embeddedClaude: claude,
    problems,
    ok: problems.length === 0,
  };
}

/**
 * Check every requested mac arch. Returns `{ ok, archs }`; each arch entry carries the
 * apps found and, per app, the whisper binary found (or null) with every path tried,
 * the baseline, foreign-arch Mach-O files, the embedded claude, and `problems`.
 */
function verifyPackagedMac(outDir, archs = DEFAULT_MAC_ARCHS) {
  const results = archs.map((arch) => {
    const appOutDir = path.join(outDir, macAppOutDirName(arch));
    const apps = listApps(appOutDir).map((appPath) => verifyMacApp(appPath, arch));
    const ok = apps.length > 0 && apps.every((a) => a.ok);
    return { arch, appOutDir, apps, ok };
  });
  return { ok: results.every((r) => r.ok), archs: results };
}

/** Linux: the embedded claude in each requested arch's unpacked directory. */
function verifyPackagedLinux(outDir, archs = DEFAULT_LINUX_ARCHS) {
  const results = archs.map((arch) => {
    const appOutDir = path.join(outDir, linuxAppOutDirName(arch));
    const resourcesPath = path.join(appOutDir, 'resources');
    const problems = [];
    const expected = ELF_MACHINES[arch];
    let claude = null;
    if (!fs.existsSync(resourcesPath)) {
      problems.push({ id: 'app-out-dir', message: `no unpacked app found in ${appOutDir}`, details: [`looked for: ${resourcesPath}`] });
    } else {
      // CI builds on glibc ubuntu, so the packaged platform package is the non-musl one.
      claude = inspectEmbeddedClaude(packagedEmbeddedClaudeCandidates(resourcesPath, 'linux', arch, false));
      if (!claude.found) {
        problems.push({ id: 'embedded-claude', message: 'no embedded claude (BUG-118)', details: claude.tried.map((p) => `looked for: ${p}`) });
      } else if (expected === undefined) {
        problems.push({ id: 'embedded-claude', message: `unknown linux arch "${arch}" (known: ${Object.keys(ELF_MACHINES).join(', ')})`, details: [] });
      } else if (claude.elfMachine !== expected) {
        const actual = claude.elfMachine === null ? 'not an ELF binary' : `ELF e_machine 0x${claude.elfMachine.toString(16)}`;
        problems.push({
          id: 'embedded-claude',
          message: `embedded claude is ${actual}, expected ELF e_machine 0x${expected.toString(16)} for ${arch}`,
          details: [claude.found],
        });
      }
    }
    return { arch, appOutDir, embeddedClaude: claude, problems, ok: problems.length === 0 };
  });
  return { ok: results.every((r) => r.ok), archs: results };
}

function parseArgs(argv) {
  const opts = { platform: 'mac', outDir: path.join(__dirname, '..', 'release'), archs: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1]) {
      opts.outDir = path.resolve(argv[++i]);
    } else if (arg === '--arch' && argv[i + 1]) {
      opts.archs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
      if (opts.archs.length === 0) throw new Error('--arch needs at least one arch');
    } else if (arg === '--platform' && argv[i + 1]) {
      opts.platform = argv[++i];
      if (!PLATFORMS.includes(opts.platform)) throw new Error(`--platform must be one of ${PLATFORMS.join(', ')}`);
    } else {
      throw new Error(`unknown or incomplete argument: ${arg}`);
    }
  }
  if (opts.archs === null) opts.archs = opts.platform === 'linux' ? DEFAULT_LINUX_ARCHS : DEFAULT_MAC_ARCHS;
  return opts;
}

function printProblems(label, problems) {
  for (const problem of problems) {
    console.error(`[verify-packaged-native] ❌ ${label}: ${problem.message}`);
    for (const line of problem.details) {
      console.error(`      ${line}`);
    }
  }
}

function reportMac(result, opts) {
  for (const r of result.archs) {
    for (const app of r.apps) {
      if (!app.ok) continue;
      console.log(`[verify-packaged-native] ✅ ${r.arch}: ${path.basename(app.appPath)} — main ${describeCpuTypes(app.baseline.cputypes)}, ${app.machOCount} Mach-O under app.asar.unpacked, embedded claude ${app.embeddedClaude.found}, whisper ${app.found}`);
    }
  }
  if (result.ok) {
    console.log(`[verify-packaged-native] ✅ every mac .app passed (${opts.archs.join(', ')})`);
    return true;
  }
  console.error('');
  for (const r of result.archs) {
    if (r.ok) continue;
    if (r.apps.length === 0) {
      console.error(`[verify-packaged-native] ❌ ${r.arch}: no .app found in ${r.appOutDir}`);
      continue;
    }
    for (const app of r.apps) {
      printProblems(`${r.arch}: ${path.basename(app.appPath)}`, app.problems);
    }
  }
  console.error('');
  console.error('[verify-packaged-native] The dmg for these archs would ship broken native components (BUG-116 / BUG-117 / BUG-118).');
  console.error(`[verify-packaged-native] No .app: check that \`electron-builder --mac\` ran and build.mac.target still lists these archs (${opts.archs.join(', ')}).`);
  console.error(`[verify-packaged-native] No whisper binary: check node_modules/${WHISPER_ADDON_PACKAGE}/dist/ for mac-<arch>/ (or darwin-<arch>/) and that build.asarUnpack still covers ${WHISPER_ADDON_PACKAGE}.`);
  console.error('[verify-packaged-native] Foreign-arch Mach-O: the CI host installed / rebuilt node_modules for another arch than this .app (BUG-117).');
  console.error('[verify-packaged-native] No embedded claude: check that @anthropic-ai/claude-code-darwin-<arch> is installed and build.asarUnpack still covers @anthropic-ai/claude-code-* (BUG-118).');
  console.error('');
  return false;
}

function reportLinux(result, opts) {
  for (const r of result.archs) {
    if (r.ok) console.log(`[verify-packaged-native] ✅ linux ${r.arch}: embedded claude ${r.embeddedClaude.found} (ELF e_machine 0x${r.embeddedClaude.elfMachine.toString(16)})`);
  }
  if (result.ok) {
    console.log(`[verify-packaged-native] ✅ every linux package passed (${opts.archs.join(', ')})`);
    return true;
  }
  console.error('');
  for (const r of result.archs) {
    printProblems(`linux ${r.arch}`, r.problems);
  }
  console.error('');
  console.error('[verify-packaged-native] The AppImage for these archs would ship without a working embedded claude (BUG-118).');
  console.error('[verify-packaged-native] Check that `electron-builder --linux` ran, @anthropic-ai/claude-code-linux-<arch> is installed, and build.asarUnpack still covers @anthropic-ai/claude-code-*.');
  console.error('');
  return false;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[verify-packaged-native] ❌ ${err.message}`);
    console.error('[verify-packaged-native] usage: node scripts/verify-packaged-native.js [--platform mac|linux] [--out <dir>] [--arch <list>]');
    process.exit(1);
  }

  const ok = opts.platform === 'linux'
    ? reportLinux(verifyPackagedLinux(opts.outDir, opts.archs), opts)
    : reportMac(verifyPackagedMac(opts.outDir, opts.archs), opts);
  if (!ok) process.exit(1);
}

module.exports = {
  DEFAULT_MAC_ARCHS,
  DEFAULT_LINUX_ARCHS,
  MACH_CPU_TYPES,
  ELF_MACHINES,
  macWhisperAddonDirCandidates,
  macAppOutDirName,
  linuxAppOutDirName,
  packagedEmbeddedClaudeCandidates,
  machOCpuTypes,
  elfMachine,
  isCrossArchAllowed,
  verifyPackagedMac,
  verifyPackagedLinux,
  parseArgs,
};

if (require.main === module) {
  main();
}
