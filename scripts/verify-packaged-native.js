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
 * win (T0546): the embedded claude `claude-code/bin/claude.exe` in `<out>/win-unpacked` (x64)
 * must exist and be a PE image for the requested arch.
 *
 * Every platform, the installer slimming of T0546 (verifyPackagedLayout):
 *   - C1  Windows: no second claude (`claude-code-win32-<arch>/claude.exe`); the router only
 *         uses `claude-code/bin/claude.exe` there (BUG-052)
 *   - C2a no `@anthropic-ai/claude-agent-sdk*` (the SDK-bundled claude never runs)
 *   - C3  `resources/bat-server-baseline` only holds the D092 targets of this host
 *   - C4  every package the packaged `dist-electron` requires (string-literal require /
 *         require.resolve / `<createRequire>.resolve("<pkg>/package.json")`) plus the
 *         computed-path packages of dynamicRuntimePackages() is packaged, with the
 *         `dependencies` closure of each
 *   - C5  the whisper addon's `dist/` only holds `js/` and this platform's directories
 *
 * Usage (run after electron-builder, before uploading artifacts):
 *   node scripts/verify-packaged-native.js [--platform mac|linux|win] [--out <dir>] [--arch <list>]
 *
 *   --platform  mac (default), linux or win
 *   --out       electron-builder output directory (default: <repo>/release, = build.directories.output)
 *   --arch      comma-separated archs to require (default: mac arm64 = build.mac.target arch (D136);
 *               linux x64 = the AppImage the CI linux job builds; win x64)
 *
 * Exit 0 when every check passes; exit 1 otherwise, listing what was checked.
 * A missing `.app` / unpacked directory for an arch is a failure, not a skip.
 *
 * Only reads file headers and the app.asar index — nothing found in the package is executed.
 */

const fs = require('fs');
const { builtinModules } = require('module');
const path = require('path');

const WHISPER_ADDON_PACKAGE = '@kutalia/whisper-node-addon';
const WHISPER_ADDON_BINARY = 'whisper.node';

// package.json build.mac.target = dmg × [arm64] (D136 — Intel Mac dropped; D057 — never universal).
const DEFAULT_MAC_ARCHS = ['arm64'];
// The CI linux job builds one AppImage on ubuntu-24.04 (x64).
const DEFAULT_LINUX_ARCHS = ['x64'];
// The CI windows job builds nsis + zip on windows-latest (x64).
const DEFAULT_WIN_ARCHS = ['x64'];

const PLATFORMS = ['mac', 'linux', 'win'];

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

// PE COFF Machine values (IMAGE_FILE_MACHINE_AMD64 / IMAGE_FILE_MACHINE_ARM64).
const PE_MACHINES = { x64: 0x8664, arm64: 0xaa64 };

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
 * Whisper `dist/` sub-directories a package for this platform may ship (T0546 C5): the
 * shared `js/` plus the runtime lookup dirs (`whisperAddonDirCandidates` in
 * electron/whisper-addon-loader.ts). package.json `build.<platform>.files` drops the rest.
 * `platform` is the Node name (win32 / darwin / linux).
 */
function allowedWhisperDistDirs(platform, arch) {
  if (platform === 'darwin') return ['js', ...macWhisperAddonDirCandidates(arch)];
  return ['js', `${platform}-${arch}`];
}

/**
 * Server bundle baselines a host ships in `resources/bat-server-baseline` (D092 per-host
 * matrix; T0546 C3 dropped the stray linux-arm64 from the x64 AppImage). Must match the
 * package.json `build.<platform>.extraResources` filters.
 */
function expectedBaselineTargets(platform, arch) {
  if (platform === 'darwin') return ['linux-x64', 'darwin-arm64'];
  if (platform === 'linux') return [`linux-${arch}`];
  return ['linux-x64'];
}

/**
 * Packages the main process loads through a computed path, which a scan of string-literal
 * `require()` cannot see (the T0546 C4 blind spot). Each entry corresponds to a dynamic
 * require site in electron/ — scripts/__tests__/asar-runtime-deps.test.mjs fails when such
 * a site appears in electron/ without being registered there and covered here.
 */
function dynamicRuntimePackages(platform, arch) {
  return [
    // electron/claude-runtime-router.ts — resolveClaudeCodePackageJson
    '@anthropic-ai/claude-code',
    // electron/codex-agent-manager.ts — `@openai/codex-${process.platform}-${process.arch}`
    `@openai/codex-${platform}-${arch}`,
    // electron/whisper-addon-loader.ts — `${WHISPER_ADDON_PACKAGE}/package.json`
    WHISPER_ADDON_PACKAGE,
  ];
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

/** Same rule for Windows: `<out>/win-unpacked` (x64), `<out>/win-<arch>-unpacked` otherwise. */
function winAppOutDirName(arch) {
  return arch === 'x64' ? 'win-unpacked' : `win-${arch}-unpacked`;
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

/** PE COFF Machine from a file header; null when the header is not a PE image. */
function peMachine(head) {
  if (head.length < 0x40 || head[0] !== 0x4d || head[1] !== 0x5a) return null; // 'MZ'
  const peOffset = head.readUInt32LE(0x3c);
  if (peOffset + 6 > head.length || head.readUInt32BE(peOffset) !== 0x50450000) return null; // 'PE\0\0'
  return head.readUInt16LE(peOffset + 4);
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
 * (Since T0546 C5 the package drops those directories; verifyPackagedLayout flags them.)
 */
function isCrossArchAllowed(relPath, baselineArch) {
  const prefix = `node_modules/${WHISPER_ADDON_PACKAGE}/dist/`;
  if (!relPath.startsWith(prefix)) return false;
  const distDir = relPath.slice(prefix.length).split('/')[0];
  const match = /^(mac|darwin)-(.+)$/.exec(distDir);
  return match !== null && match[2] !== baselineArch;
}

// ---------------------------------------------------------------------------
// app.asar (T0546 C4). Format (@electron/asar): an 8-byte pickle holding the header size,
// then the header pickle (uint32 payload size, int32 string length, JSON), then file data.
// A file node is { size, offset, unpacked? }; unpacked files live in app.asar.unpacked/.
// ---------------------------------------------------------------------------

function readAsar(asarPath) {
  const fd = fs.openSync(asarPath, 'r');
  try {
    const sizeBuf = Buffer.alloc(8);
    fs.readSync(fd, sizeBuf, 0, 8, 0);
    const headerSize = sizeBuf.readUInt32LE(4);
    const headerBuf = Buffer.alloc(headerSize);
    fs.readSync(fd, headerBuf, 0, headerSize, 8);
    const jsonLength = headerBuf.readInt32LE(4);
    const header = JSON.parse(headerBuf.subarray(8, 8 + jsonLength).toString('utf8'));
    return { asarPath, unpackedDir: `${asarPath}.unpacked`, header, dataOffset: 8 + headerSize };
  } finally {
    fs.closeSync(fd);
  }
}

/** Node at a '/'-separated path inside the archive, or null. */
function asarNode(asar, relPath) {
  let node = asar.header;
  for (const part of relPath.split('/').filter(Boolean)) {
    if (!node.files || !Object.prototype.hasOwnProperty.call(node.files, part)) return null;
    node = node.files[part];
  }
  return node;
}

/** Every file path in the archive (packed and unpacked), '/'-separated. */
function asarFiles(asar) {
  const files = [];
  const walk = (node, prefix) => {
    for (const [name, child] of Object.entries(node.files || {})) {
      const rel = prefix ? `${prefix}/${name}` : name;
      if (child.files) walk(child, rel);
      else files.push(rel);
    }
  };
  walk(asar.header, '');
  return files;
}

/** Contents of a file in the archive (reading app.asar.unpacked for unpacked ones), or null. */
function readAsarFile(asar, relPath) {
  const node = asarNode(asar, relPath);
  if (!node || node.files || typeof node.size !== 'number') return null;
  if (node.unpacked) {
    try {
      return fs.readFileSync(path.join(asar.unpackedDir, ...relPath.split('/')));
    } catch {
      return null;
    }
  }
  const buf = Buffer.alloc(node.size);
  const fd = fs.openSync(asar.asarPath, 'r');
  try {
    fs.readSync(fd, buf, 0, node.size, asar.dataOffset + Number(node.offset));
  } finally {
    fs.closeSync(fd);
  }
  return buf;
}

const NODE_BUILTINS = new Set([...builtinModules, 'electron', 'original-fs']);
const PACKAGE_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
// String-literal forms only. `<createRequire(...)>.resolve("<pkg>/package.json")` is matched
// by its argument shape, because the receiver is minified. ESM `import ... from` is not
// matched: vite-plugin-electron emits CommonJS for dist-electron. Template literals and
// variables are the blind spot that dynamicRuntimePackages() covers.
const REQUIRE_PATTERNS = [
  /\brequire\(\s*(["'])([^"'`$\s]+)\1\s*\)/g,
  /\brequire\.resolve\(\s*(["'])([^"'`$\s]+)\1/g,
  /\bimport\(\s*(["'])([^"'`$\s]+)\1\s*\)/g,
  /\.resolve\(\s*(["'])([^"'`$\s]+\/package\.json)\1\s*\)/g,
];

/** Package name of a bare specifier (`@scope/name/sub` → `@scope/name`); null for builtins / non-packages. */
function packageNameOf(specifier) {
  if (specifier.startsWith('node:')) return null;
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  if (NODE_BUILTINS.has(name) || NODE_BUILTINS.has(specifier) || !PACKAGE_NAME.test(name)) return null;
  return name;
}

/**
 * External packages required by the dist-electron graph reachable from `entries`
 * ('/'-separated paths). `readFile(relPath)` returns the contents (string / Buffer) or
 * null; relative requires are followed (`./x` → `./x.js`). Returns
 * { packages: Map<name, Set<file>>, files: visited paths, missing: unreadable paths }.
 */
function scanExternalRequires(readFile, entries) {
  const packages = new Map();
  const visited = new Set();
  const missing = [];
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (visited.has(file) || missing.includes(file)) continue;
    const content = readFile(file);
    if (content == null) {
      missing.push(file);
      continue;
    }
    visited.add(file);
    const source = String(content);
    for (const pattern of REQUIRE_PATTERNS) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(source)) !== null) {
        const specifier = m[2];
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
          queue.push(/\.(c|m)?js$|\.json$/.test(target) ? target : `${target}.js`);
          continue;
        }
        const name = packageNameOf(specifier);
        if (!name) continue;
        if (!packages.has(name)) packages.set(name, new Set());
        packages.get(name).add(file);
      }
    }
  }
  return { packages, files: [...visited].sort(), missing };
}

const DIST_ELECTRON_ENTRIES = ['dist-electron/main.js', 'dist-electron/preload.js', 'dist-electron/terminal-server.js'];

/**
 * C4: every runtime package (scanned + dynamic) is packaged, with the `dependencies` of
 * each (nested node_modules first, then top level). Optional / peer dependencies are not
 * required (platform packages and ws's bufferutil are legitimately absent).
 */
function verifyRuntimePackages(asar, platform, arch) {
  const scan = scanExternalRequires((rel) => readAsarFile(asar, rel), DIST_ELECTRON_ENTRIES);
  const roots = new Map(scan.packages);
  for (const name of dynamicRuntimePackages(platform, arch)) {
    if (!roots.has(name)) roots.set(name, new Set(['(computed path)']));
  }
  const problems = [];
  const missingEntries = scan.missing.filter((rel) => DIST_ELECTRON_ENTRIES.includes(rel));
  if (missingEntries.length > 0) {
    problems.push({ id: 'runtime-require', message: 'dist-electron entry missing from app.asar', details: missingEntries });
  }
  const missingPackages = [];
  const checked = new Set();
  const visit = (pkgDir, name, requiredBy) => {
    if (checked.has(pkgDir)) return;
    checked.add(pkgDir);
    const manifest = readAsarFile(asar, `${pkgDir}/package.json`);
    if (manifest === null) {
      missingPackages.push(`${name} (required by ${requiredBy})`);
      return;
    }
    let deps = {};
    try {
      deps = JSON.parse(String(manifest)).dependencies || {};
    } catch {
      deps = {};
    }
    for (const dep of Object.keys(deps)) {
      const nested = `${pkgDir}/node_modules/${dep}`;
      visit(asarNode(asar, `${nested}/package.json`) ? nested : `node_modules/${dep}`, dep, name);
    }
  };
  for (const [name, by] of roots) visit(`node_modules/${name}`, name, [...by].join(', '));
  if (missingPackages.length > 0) {
    problems.push({
      id: 'runtime-require',
      message: `${missingPackages.length} runtime package(s) missing from app.asar / app.asar.unpacked (node_modules whitelist in package.json build.files, T0546 C4)`,
      details: missingPackages,
    });
  }
  return { packages: [...roots.keys()].sort(), checked: checked.size, problems };
}

/** Files under `dir` relative to it, '/'-separated (empty when it does not exist). */
function relativeFiles(dir) {
  return walkFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/'));
}

/**
 * T0546 layout checks shared by every platform. `platform` is the Node name
 * (win32 / darwin / linux). Returns { problems, runtime, baselines }.
 */
function verifyPackagedLayout(resourcesPath, platform, arch) {
  const problems = [];
  const asarPath = path.join(resourcesPath, 'app.asar');
  const unpackedDir = path.join(resourcesPath, 'app.asar.unpacked');
  let asar = null;
  try {
    asar = readAsar(asarPath);
  } catch (err) {
    problems.push({ id: 'runtime-require', message: 'cannot read app.asar', details: [`${asarPath}: ${err.message}`] });
  }
  const files = [...new Set([...(asar ? asarFiles(asar) : []), ...relativeFiles(unpackedDir)])].sort();

  // C2a
  const sdk = files.filter((f) => f.startsWith('node_modules/@anthropic-ai/claude-agent-sdk'));
  if (sdk.length > 0) {
    problems.push({ id: 'sdk-binary', message: `${sdk.length} @anthropic-ai/claude-agent-sdk* file(s) packaged (T0546 C2a)`, details: sdk.slice(0, 20) });
  }

  // C1
  if (platform === 'win32') {
    const dup = files.filter((f) => /^node_modules\/@anthropic-ai\/claude-code-win32-[^/]+\/claude\.exe$/.test(f));
    if (dup.length > 0) {
      problems.push({ id: 'duplicate-claude', message: 'second claude.exe packaged; Windows only runs claude-code/bin/claude.exe (T0546 C1)', details: dup });
    }
  }

  // C5
  const whisperPrefix = `node_modules/${WHISPER_ADDON_PACKAGE}/dist/`;
  const allowed = allowedWhisperDistDirs(platform, arch);
  const strayDirs = [...new Set(files
    .filter((f) => f.startsWith(whisperPrefix))
    .map((f) => f.slice(whisperPrefix.length).split('/')[0])
    .filter((dir) => !allowed.includes(dir)))];
  if (strayDirs.length > 0) {
    problems.push({ id: 'whisper-platforms', message: `whisper dist/ ships other platforms' builds (T0546 C5; allowed: ${allowed.join(', ')})`, details: strayDirs.map((d) => whisperPrefix + d) });
  }

  // C3 / D092
  const baselineDir = path.join(resourcesPath, 'bat-server-baseline');
  const expectedTargets = expectedBaselineTargets(platform, arch);
  const baselines = [];
  let baselineNames = [];
  try {
    baselineNames = fs.readdirSync(baselineDir).sort();
  } catch {
    // no baseline directory: nothing to check here (verify-helper-bundle.js guards the build)
  }
  for (const name of baselineNames) {
    const m = /^bat-server-(.+)-v.+\.tar\.gz$/.exec(name);
    if (m) baselines.push({ name, target: m[1] });
  }
  const unexpected = baselines.filter((b) => !expectedTargets.includes(b.target));
  if (unexpected.length > 0) {
    problems.push({ id: 'baseline', message: `server bundle baseline for another host (D092 / T0546 C3; expected: ${expectedTargets.join(', ')})`, details: unexpected.map((b) => path.join(baselineDir, b.name)) });
  }

  // C4
  let runtime = null;
  if (asar) {
    runtime = verifyRuntimePackages(asar, platform, arch);
    problems.push(...runtime.problems);
  }

  return { problems, runtime, baselines: baselines.map((b) => b.target) };
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

  // T0546
  const layout = verifyPackagedLayout(resourcesPath, 'darwin', arch);
  problems.push(...layout.problems);

  return {
    appPath,
    found,
    tried,
    baseline: main,
    machOCount,
    foreign,
    embeddedClaude: claude,
    layout,
    problems,
    ok: problems.length === 0,
  };
}

/**
 * Check every requested mac arch. Returns `{ ok, archs }`; each arch entry carries the
 * apps found and, per app, the whisper binary found (or null) with every path tried,
 * the baseline, foreign-arch Mach-O files, the embedded claude, the T0546 layout and
 * `problems`.
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

/** Linux: the embedded claude in each requested arch's unpacked directory, plus the T0546 layout. */
function verifyPackagedLinux(outDir, archs = DEFAULT_LINUX_ARCHS) {
  const results = archs.map((arch) => {
    const appOutDir = path.join(outDir, linuxAppOutDirName(arch));
    const resourcesPath = path.join(appOutDir, 'resources');
    const problems = [];
    const expected = ELF_MACHINES[arch];
    let claude = null;
    let layout = null;
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
      layout = verifyPackagedLayout(resourcesPath, 'linux', arch);
      problems.push(...layout.problems);
    }
    return { arch, appOutDir, embeddedClaude: claude, layout, problems, ok: problems.length === 0 };
  });
  return { ok: results.every((r) => r.ok), archs: results };
}

/** Windows (T0546): the embedded claude (PE of the requested arch), plus the T0546 layout. */
function verifyPackagedWin(outDir, archs = DEFAULT_WIN_ARCHS) {
  const results = archs.map((arch) => {
    const appOutDir = path.join(outDir, winAppOutDirName(arch));
    const resourcesPath = path.join(appOutDir, 'resources');
    const problems = [];
    const expected = PE_MACHINES[arch];
    let claude = null;
    let machine = null;
    let layout = null;
    if (!fs.existsSync(resourcesPath)) {
      problems.push({ id: 'app-out-dir', message: `no unpacked app found in ${appOutDir}`, details: [`looked for: ${resourcesPath}`] });
    } else {
      claude = inspectEmbeddedClaude(packagedEmbeddedClaudeCandidates(resourcesPath, 'win32', arch));
      if (!claude.found) {
        problems.push({ id: 'embedded-claude', message: 'no embedded claude (BUG-052)', details: claude.tried.map((p) => `looked for: ${p}`) });
      } else {
        machine = peMachine(readHeader(claude.found));
        if (expected === undefined) {
          problems.push({ id: 'embedded-claude', message: `unknown win arch "${arch}" (known: ${Object.keys(PE_MACHINES).join(', ')})`, details: [] });
        } else if (machine !== expected) {
          const actual = machine === null ? 'not a PE image' : `PE machine 0x${machine.toString(16)}`;
          problems.push({
            id: 'embedded-claude',
            message: `embedded claude is ${actual}, expected PE machine 0x${expected.toString(16)} for ${arch}`,
            details: [claude.found],
          });
        }
      }
      layout = verifyPackagedLayout(resourcesPath, 'win32', arch);
      problems.push(...layout.problems);
    }
    return { arch, appOutDir, embeddedClaude: claude, peMachine: machine, layout, problems, ok: problems.length === 0 };
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
  if (opts.archs === null) {
    opts.archs = opts.platform === 'linux' ? DEFAULT_LINUX_ARCHS : opts.platform === 'win' ? DEFAULT_WIN_ARCHS : DEFAULT_MAC_ARCHS;
  }
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

function describeLayout(layout) {
  if (!layout) return '';
  const runtime = layout.runtime ? `, ${layout.runtime.packages.length} runtime package(s) / ${layout.runtime.checked} with dependencies` : '';
  return `, baseline [${layout.baselines.join(', ')}]${runtime}`;
}

function printLayoutHints() {
  console.error('[verify-packaged-native] T0546 runtime-require: add the package (and its dependencies) to the node_modules whitelist in package.json build.files.');
  console.error('[verify-packaged-native] T0546 sdk-binary / duplicate-claude / whisper-platforms / baseline: an exclusion in package.json build.files, build.<platform>.files or extraResources was lost.');
  console.error('');
}

function reportMac(result, opts) {
  for (const r of result.archs) {
    for (const app of r.apps) {
      if (!app.ok) continue;
      console.log(`[verify-packaged-native] ✅ ${r.arch}: ${path.basename(app.appPath)} — main ${describeCpuTypes(app.baseline.cputypes)}, ${app.machOCount} Mach-O under app.asar.unpacked, embedded claude ${app.embeddedClaude.found}, whisper ${app.found}${describeLayout(app.layout)}`);
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
  printLayoutHints();
  return false;
}

function reportLinux(result, opts) {
  for (const r of result.archs) {
    if (r.ok) console.log(`[verify-packaged-native] ✅ linux ${r.arch}: embedded claude ${r.embeddedClaude.found} (ELF e_machine 0x${r.embeddedClaude.elfMachine.toString(16)})${describeLayout(r.layout)}`);
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
  console.error('[verify-packaged-native] The AppImage for these archs would ship without a working embedded claude (BUG-118) or unslimmed (T0546).');
  console.error('[verify-packaged-native] Check that `electron-builder --linux` ran, @anthropic-ai/claude-code-linux-<arch> is installed, and build.asarUnpack still covers @anthropic-ai/claude-code-*.');
  printLayoutHints();
  return false;
}

function reportWin(result, opts) {
  for (const r of result.archs) {
    if (r.ok) console.log(`[verify-packaged-native] ✅ win ${r.arch}: embedded claude ${r.embeddedClaude.found} (PE machine 0x${r.peMachine.toString(16)})${describeLayout(r.layout)}`);
  }
  if (result.ok) {
    console.log(`[verify-packaged-native] ✅ every windows package passed (${opts.archs.join(', ')})`);
    return true;
  }
  console.error('');
  for (const r of result.archs) {
    printProblems(`win ${r.arch}`, r.problems);
  }
  console.error('');
  console.error('[verify-packaged-native] The Windows installer for these archs would ship without a working embedded claude (BUG-052) or unslimmed (T0546).');
  console.error('[verify-packaged-native] Check that `electron-builder --win` ran and @anthropic-ai/claude-code/bin/claude.exe is the native binary, not the npm stub (T0472).');
  printLayoutHints();
  return false;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[verify-packaged-native] ❌ ${err.message}`);
    console.error('[verify-packaged-native] usage: node scripts/verify-packaged-native.js [--platform mac|linux|win] [--out <dir>] [--arch <list>]');
    process.exit(1);
  }

  let ok;
  if (opts.platform === 'linux') ok = reportLinux(verifyPackagedLinux(opts.outDir, opts.archs), opts);
  else if (opts.platform === 'win') ok = reportWin(verifyPackagedWin(opts.outDir, opts.archs), opts);
  else ok = reportMac(verifyPackagedMac(opts.outDir, opts.archs), opts);
  if (!ok) process.exit(1);
}

module.exports = {
  DEFAULT_MAC_ARCHS,
  DEFAULT_LINUX_ARCHS,
  DEFAULT_WIN_ARCHS,
  MACH_CPU_TYPES,
  ELF_MACHINES,
  PE_MACHINES,
  DIST_ELECTRON_ENTRIES,
  macWhisperAddonDirCandidates,
  allowedWhisperDistDirs,
  expectedBaselineTargets,
  dynamicRuntimePackages,
  macAppOutDirName,
  linuxAppOutDirName,
  winAppOutDirName,
  packagedEmbeddedClaudeCandidates,
  machOCpuTypes,
  elfMachine,
  peMachine,
  isCrossArchAllowed,
  readAsar,
  asarFiles,
  readAsarFile,
  packageNameOf,
  scanExternalRequires,
  verifyPackagedLayout,
  verifyPackagedMac,
  verifyPackagedLinux,
  verifyPackagedWin,
  parseArgs,
};

if (require.main === module) {
  main();
}
