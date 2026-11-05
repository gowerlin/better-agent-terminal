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
 * an ELF for the requested arch. T0799 / BUG-202 `appimage-launcher`: `<executableName>` is the
 * sandbox launcher script (scripts/appimage-sandbox-launcher.cjs, installed by the afterPack hook)
 * and `<executableName>.bin` is an ELF for the requested arch (the Electron binary it execs).
 * T0800 / BUG-204 `whisper-runpath`: every shared object in the packaged whisper `dist/linux-<arch>/` has
 * RUNPATH exactly `$ORIGIN` and no DT_RPATH, and every bundled NEEDED (`libwhisper*` / `libggml*`) is a file
 * there (set by the afterPack hook with patchelf, scripts/linux-whisper-runpath.cjs).
 *
 * win (T0546): the embedded claude `claude-code/bin/claude.exe` in `<out>/win-unpacked` (x64)
 * must exist and be a PE image for the requested arch.
 * T0858 / PLAN-065 W2 `pty-holder`: `resources/pty-holder/` holds exactly the files its `holder-manifest.json`
 * lists, each with the listed size and SHA-256; the key matches the files; `bat-pty-holder.exe` is the pinned Node
 * `node.exe` (PE of the requested arch), never `BetterAgentTerminal.exe` (scripts/pty-holder.cjs ptyHolderProblems).
 * T0859: Node's LICENSE (`node-LICENSE`, the pinned size + SHA-256) must be listed and present.
 * mac / linux: `resources/pty-holder` must not exist (the holder is Windows only).
 * T0866 / BUG-213 `win-stdio-inherit`: `resources/native/bat_win_stdio_inherit.node` (copied by the afterPack hook,
 * scripts/win-stdio-inherit.cjs) exists, is a PE of the requested arch and — on a Windows host — loads in the packaged
 * executable under ELECTRON_RUN_AS_NODE with working disable() / restore(). mac / linux: `resources/native/` of it must
 * not exist.
 *
 * Every platform, the installer slimming of T0546 (verifyPackagedLayout):
 *   - C1  Windows: no second claude (`claude-code-win32-<arch>/claude.exe`); the router only
 *         uses `claude-code/bin/claude.exe` there (BUG-052)
 *   - C2a no `@anthropic-ai/claude-agent-sdk*` (the SDK-bundled claude never runs)
 *   - no  `resources/bat-server-baseline` (D146 / T0547: the setup wizard downloads the
 *         server bundle on demand; T0546 C3 only limited it to the D092 targets)
 *   - C4  every package the packaged `dist-electron` requires (string-literal require /
 *         require.resolve / `<createRequire>.resolve("<pkg>/package.json")`) plus the
 *         computed-path packages of dynamicRuntimePackages() is packaged, with the
 *         `dependencies` closure of each (packed only when it is in the production dependency
 *         tree: package.json dependencies, not peerDependencies — T0719 / BUG-176)
 *   - C5  the whisper addon's `dist/` only holds `js/` and this platform's directories
 *   - T0689 `resources/scripts` (the packaged BAT_HELPER_DIR) holds exactly the runtime helpers
 *         (`serverBundleHelperScripts` in scripts/build-server-bundle.mjs): none missing, nothing extra
 *   - T0691 `resources/package.json` (where the helpers read `--version` / BAT MCP `serverInfo.version`,
 *         BUG-169) holds only `name` / `version`, the version is not empty / 0.0.0 and equals the
 *         app.asar package.json version (written by the afterPack hook in scripts/version-manifest.cjs)
 *
 * Usage (run after electron-builder, before uploading artifacts):
 *   node scripts/verify-packaged-native.js [--platform mac|linux|win] [--out <dir>] [--arch <list>]
 *
 *   --platform  mac (default), linux or win
 *   --out       electron-builder output directory (default: <repo>/release, = build.directories.output)
 *   --arch      comma-separated archs to require (default: mac arm64 = build.mac.target arch (D136);
 *               linux x64 = the AppImage the CI linux job builds; win x64)
 *   --skip-load-check  win: skip the T0866 addon load check (the tests' fake packages have no executable)
 *
 * Exit 0 when every check passes; exit 1 otherwise, listing what was checked.
 * A missing `.app` / unpacked directory for an arch is a failure, not a skip.
 *
 * Only reads file headers and the app.asar index — nothing found in the package is executed, except the T0866
 * `win-stdio-inherit` load check (the packaged exe as Node, ELECTRON_RUN_AS_NODE=1, 30 s timeout, Windows host only).
 */

const fs = require('fs');
const { builtinModules } = require('module');
const path = require('path');
const { VERSION_MANIFEST_FILE, versionManifestProblems } = require('./version-manifest.cjs');
const { REAL_BINARY_SUFFIX, isLauncherFile } = require('./appimage-sandbox-launcher.cjs');
const { whisperDistDir, whisperRunpathProblems } = require('./linux-whisper-runpath.cjs');
const { PTY_HOLDER_RESOURCES_DIR, ptyHolderProblems } = require('./pty-holder.cjs');
const { execFileSync } = require('child_process');
const { ADDON_RESOURCES_DIR: WIN_STDIO_INHERIT_RESOURCES_DIR, packagedAddonPath: winStdioInheritPackagedPath } = require('./win-stdio-inherit.cjs');

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
      message: `${missingPackages.length} runtime package(s) missing from app.asar / app.asar.unpacked (node_modules whitelist in package.json build.files, T0546 C4; production dependency tree, T0719)`,
      details: missingPackages,
    });
  }
  return { packages: [...roots.keys()].sort(), checked: checked.size, problems };
}

/** Files under `dir` relative to it, '/'-separated (empty when it does not exist). */
function relativeFiles(dir) {
  return walkFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/'));
}

const SERVER_BUNDLE_SCRIPT = path.join(__dirname, 'build-server-bundle.mjs');

/**
 * T0689: the runtime helpers `resources/scripts` must hold, read from `serverBundleHelperScripts`
 * in scripts/build-server-bundle.mjs (the build script runs main() at load and cannot be
 * required). scripts/verify-helper-bundle.js keeps package.json build.extraResources equal to it.
 */
function runtimeHelperScripts(source = fs.readFileSync(SERVER_BUNDLE_SCRIPT, 'utf8')) {
  const listMatch = source.match(/const\s+serverBundleHelperScripts\s*=\s*\[([\s\S]*?)\]/);
  if (!listMatch) throw new Error('`const serverBundleHelperScripts = [...]` not found in scripts/build-server-bundle.mjs');
  return [...listMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

/**
 * T0689: `resources/scripts` (the packaged BAT_HELPER_DIR) holds exactly the runtime helpers:
 * one missing breaks the helpers in the installed app (BUG-058), an extra file is a build / dev
 * script the installer should not ship.
 */
function verifyHelperScripts(resourcesPath, expected) {
  const scriptsDir = path.join(resourcesPath, 'scripts');
  const present = relativeFiles(scriptsDir).sort();
  const missing = expected.filter((name) => !present.includes(name));
  const extra = present.filter((name) => !expected.includes(name));
  const problems = [];
  if (missing.length > 0 || extra.length > 0) {
    problems.push({
      id: 'helper-scripts',
      message: `${scriptsDir} is not exactly the runtime helpers (T0689; expected: ${expected.join(', ')})`,
      details: [...missing.map((name) => `missing: ${name}`), ...extra.map((name) => `extra: ${name}`)],
    });
  }
  return { present, problems };
}

/** `version` of the packaged app (app.asar package.json), or null when it cannot be read. */
function asarAppVersion(asar) {
  const manifest = asar ? readAsarFile(asar, 'package.json') : null;
  if (manifest === null) return null;
  try {
    const { version } = JSON.parse(String(manifest));
    return typeof version === 'string' && version !== '' ? version : null;
  } catch {
    return null;
  }
}

/**
 * T0691 / BUG-169: `<resources>/package.json`, the version source of the packaged helpers
 * (`join(<scripts>, '..', 'package.json')`), exists and holds only a real `name` / `version`;
 * the version equals `expectedVersion` when one is known.
 */
function verifyHelperVersion(resourcesPath, expectedVersion = null) {
  const manifestPath = path.join(resourcesPath, VERSION_MANIFEST_FILE);
  let content = null;
  try {
    content = fs.readFileSync(manifestPath, 'utf8');
  } catch {
    // reported below
  }
  const details = content === null ? ['missing (the afterPack hook did not run)'] : versionManifestProblems(content, expectedVersion);
  const problems = details.length > 0
    ? [{ id: 'helper-version', message: `${manifestPath} is not the helpers' version file (T0691 / BUG-169; the helpers would report 0.0.0)`, details }]
    : [];
  let version = null;
  if (problems.length === 0) version = JSON.parse(content).version;
  return { path: manifestPath, version, expectedVersion, problems };
}

/**
 * T0546 layout checks shared by every platform. `platform` is the Node name
 * (win32 / darwin / linux). `helperScripts` defaults to runtimeHelperScripts() (T0689);
 * `expectedVersion` (T0691) defaults to the app.asar package.json version.
 * Returns { problems, runtime, baselines, helperScripts, helperVersion }.
 */
function verifyPackagedLayout(resourcesPath, platform, arch, { helperScripts, expectedVersion } = {}) {
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

  // D146 / T0547: no server bundle baseline at all (was T0546 C3: D092 targets only)
  const baselineDir = path.join(resourcesPath, 'bat-server-baseline');
  let baselines = null;
  try {
    baselines = fs.readdirSync(baselineDir).sort();
  } catch {
    // absent: expected
  }
  if (baselines !== null) {
    problems.push({
      id: 'server-bundle-baseline',
      message: 'installer ships resources/bat-server-baseline (D146 / T0547: the server bundle is downloaded on demand)',
      details: baselines.length > 0 ? baselines.map((name) => path.join(baselineDir, name)) : [`${baselineDir} (empty directory)`],
    });
  }

  // C4
  let runtime = null;
  if (asar) {
    runtime = verifyRuntimePackages(asar, platform, arch);
    problems.push(...runtime.problems);
  }

  // T0689: resources/scripts = the runtime helpers, nothing else
  let helpers = { present: [], problems: [] };
  try {
    helpers = verifyHelperScripts(resourcesPath, helperScripts ?? runtimeHelperScripts());
  } catch (err) {
    helpers.problems.push({ id: 'helper-scripts', message: 'cannot read the runtime helper list (T0689)', details: [err.message] });
  }
  problems.push(...helpers.problems);

  // T0691: resources/package.json = the helpers' version, equal to the packaged app's
  const helperVersion = verifyHelperVersion(resourcesPath, expectedVersion ?? asarAppVersion(asar));
  problems.push(...helperVersion.problems);

  // T0858: the PTY holder is Windows only (verifyPtyHolder checks it there)
  if (platform !== 'win32' && fs.existsSync(path.join(resourcesPath, PTY_HOLDER_RESOURCES_DIR))) {
    problems.push({ id: 'pty-holder', message: `resources/${PTY_HOLDER_RESOURCES_DIR} packaged for ${platform} (T0858: Windows only)`, details: [path.join(resourcesPath, PTY_HOLDER_RESOURCES_DIR)] });
  }

  // T0866: the stdio-inheritance addon is Windows only (verifyWinStdioInherit checks it there)
  if (platform !== 'win32' && fs.existsSync(winStdioInheritPackagedPath(resourcesPath))) {
    problems.push({ id: 'win-stdio-inherit', message: `resources/${WIN_STDIO_INHERIT_RESOURCES_DIR} stdio-inheritance addon packaged for ${platform} (T0866: Windows only)`, details: [winStdioInheritPackagedPath(resourcesPath)] });
  }

  return { problems, runtime, baselines: baselines ?? [], helperScripts: helpers.present, helperVersion };
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

/** package.json build.executableName (the Linux / Windows executable name). */
function packagedExecutableName() {
  return require('../package.json').build.executableName;
}

/**
 * T0799 / BUG-202: `<appOutDir>/<executableName>` must be the AppImage sandbox launcher and
 * `<executableName>.bin` an ELF of `expectedMachine`. Returns the problems (empty = ok).
 */
function verifyAppImageLauncher(appOutDir, executableName, expectedMachine) {
  const launcher = path.join(appOutDir, executableName);
  const real = launcher + REAL_BINARY_SUFFIX;
  const details = [];
  if (!fs.existsSync(launcher)) details.push(`missing: ${launcher}`);
  else if (!isLauncherFile(launcher)) details.push(`not the sandbox launcher script: ${launcher} (the afterPack hook did not install it)`);
  if (!fs.existsSync(real)) {
    details.push(`missing: ${real}`);
  } else {
    const machine = elfMachine(readHeader(real));
    if (machine === null) details.push(`not an ELF binary: ${real}`);
    else if (expectedMachine !== undefined && machine !== expectedMachine) details.push(`${real} is ELF e_machine 0x${machine.toString(16)}, expected 0x${expectedMachine.toString(16)}`);
  }
  return details.length ? [{ id: 'appimage-launcher', message: 'AppImage sandbox launcher not installed (BUG-202 / T0799)', details }] : [];
}

/**
 * T0800 / BUG-204: the packaged whisper `dist/linux-<arch>/` loads its own libraries (RUNPATH `$ORIGIN`, set by
 * the afterPack hook). Returns the problems (empty = ok).
 */
function verifyWhisperRunpath(resourcesPath, arch) {
  const dir = path.join(whisperDistDir(resourcesPath), `linux-${arch}`);
  const details = fs.existsSync(dir) ? whisperRunpathProblems(dir) : [`missing: ${dir}`];
  return details.length ? [{ id: 'whisper-runpath', message: 'whisper addon libraries are not found from their own directory (BUG-204 / T0800)', details }] : [];
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
      problems.push(...verifyAppImageLauncher(appOutDir, packagedExecutableName(), expected));
      problems.push(...verifyWhisperRunpath(resourcesPath, arch));
    }
    return { arch, appOutDir, embeddedClaude: claude, layout, problems, ok: problems.length === 0 };
  });
  return { ok: results.every((r) => r.ok), archs: results };
}

/**
 * T0858 / PLAN-065 W2: `<resources>/pty-holder/` matches its manifest and pins (scripts/pty-holder.cjs).
 * Returns the problems (empty = ok).
 */
function verifyPtyHolder(resourcesPath, arch) {
  const dir = path.join(resourcesPath, PTY_HOLDER_RESOURCES_DIR);
  const details = fs.existsSync(dir) ? ptyHolderProblems(dir, arch) : [`missing: ${dir} (the afterPack hook did not assemble it)`];
  return details.length ? [{ id: 'pty-holder', message: 'Windows PTY holder is missing or does not match its manifest (T0858 / PLAN-065 W2)', details }] : [];
}

// Loaded by the packaged exe as Node: both functions must work (this check runs under Node, which disabled stdio
// inheritance at startup, so disable() usually returns []); prints one JSON line.
const WIN_STDIO_INHERIT_LOAD_SCRIPT = [
  'const m = { exports: {} }',
  'process.dlopen(m, process.argv[1])',
  'const saved = m.exports.disable()',
  "if (!Array.isArray(saved) || saved.some((h) => typeof h !== 'bigint')) throw new Error('disable() did not return a BigInt array')",
  'const restored = m.exports.restore(saved)',
  'process.stdout.write(JSON.stringify({ ok: restored === saved.length, disabled: saved.length, restored }))',
].join('\n');

/**
 * T0866 / BUG-213: `<resources>/native/bat_win_stdio_inherit.node` is a PE of `arch` and (Windows host) loads in the
 * packaged executable. The load check runs only with `loadCheck` (the CLI sets it; library callers such as the tests do
 * not, so they execute nothing). `run` is for tests (default: execFileSync of `<appOutDir>/<executableName>.exe`).
 */
function verifyWinStdioInherit(appOutDir, resourcesPath, arch, { loadCheck = false, hostPlatform = process.platform, run } = {}) {
  const file = winStdioInheritPackagedPath(resourcesPath);
  const fail = (details) => [{ id: 'win-stdio-inherit', message: 'Windows stdio-inheritance addon is missing or does not load (T0866 / BUG-213)', details }];
  if (!fs.existsSync(file)) return { problems: fail([`missing: ${file} (the afterPack hook copies native/win-stdio-inherit/build/Release; run \`npm run build:native-win\` before packaging)`]), loaded: false };
  const machine = peMachine(readHeader(file));
  if (machine !== PE_MACHINES[arch]) {
    return { problems: fail([`${file}: ${machine === null ? 'not a PE image' : `PE machine 0x${machine.toString(16)}`}, expected 0x${(PE_MACHINES[arch] ?? 0).toString(16)} for ${arch}`]), loaded: false };
  }
  if (!loadCheck || hostPlatform !== 'win32') return { problems: [], loaded: false };
  const exe = path.join(appOutDir, `${packagedExecutableName()}.exe`);
  const exec = run || ((command, args) => execFileSync(command, args, {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    timeout: 30_000,
    windowsHide: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
  let out;
  try {
    out = String(exec(exe, ['-e', WIN_STDIO_INHERIT_LOAD_SCRIPT, file]));
  } catch (err) {
    const stderr = err && err.stderr ? String(err.stderr).trim().split(/\r?\n/).slice(-3).join(' | ') : '';
    return { problems: fail([`${exe} (ELECTRON_RUN_AS_NODE) could not load ${file}: ${err && err.message ? err.message.split('\n')[0] : err}${stderr ? ` — ${stderr}` : ''}`]), loaded: false };
  }
  let result = null;
  try {
    result = JSON.parse(out.trim().split(/\r?\n/).pop());
  } catch {
    result = null;
  }
  if (!result || result.ok !== true) return { problems: fail([`load check printed ${JSON.stringify(out.trim().slice(0, 200))}`]), loaded: false };
  return { problems: [], loaded: true };
}

/** Windows (T0546): the embedded claude (PE of the requested arch), plus the T0546 layout and the T0858 PTY holder. */
function verifyPackagedWin(outDir, archs = DEFAULT_WIN_ARCHS, { stdioInheritLoadCheck = false } = {}) {
  const results = archs.map((arch) => {
    const appOutDir = path.join(outDir, winAppOutDirName(arch));
    const resourcesPath = path.join(appOutDir, 'resources');
    const problems = [];
    const expected = PE_MACHINES[arch];
    let claude = null;
    let machine = null;
    let layout = null;
    let stdioInherit = null;
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
      problems.push(...verifyPtyHolder(resourcesPath, arch));
      stdioInherit = verifyWinStdioInherit(appOutDir, resourcesPath, arch, { loadCheck: stdioInheritLoadCheck });
      problems.push(...stdioInherit.problems);
    }
    return { arch, appOutDir, embeddedClaude: claude, peMachine: machine, layout, stdioInherit, problems, ok: problems.length === 0 };
  });
  return { ok: results.every((r) => r.ok), archs: results };
}

function parseArgs(argv) {
  const opts = { platform: 'mac', outDir: path.join(__dirname, '..', 'release'), archs: null };
  let skipLoadCheck = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1]) {
      opts.outDir = path.resolve(argv[++i]);
    } else if (arg === '--arch' && argv[i + 1]) {
      opts.archs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
      if (opts.archs.length === 0) throw new Error('--arch needs at least one arch');
    } else if (arg === '--skip-load-check') {
      skipLoadCheck = true; // T0866: the tests' fake packages have no executable to run
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
  if (skipLoadCheck) opts.skipLoadCheck = true;
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
  const version = layout.helperVersion?.version ? `, helper version ${layout.helperVersion.version}` : '';
  return `, no server bundle baseline${runtime}, ${layout.helperScripts.length} runtime helper(s) in resources/scripts${version}`;
}

function printLayoutHints() {
  console.error('[verify-packaged-native] T0546 runtime-require: add the package (and its dependencies) to the node_modules whitelist in package.json build.files.');
  console.error('[verify-packaged-native] T0719 runtime-require: electron-builder only packs the production dependency tree (package.json dependencies, never peerDependencies); a package reachable only as a peer must be added to package.json dependencies. Check locally with scripts/__tests__/asar-runtime-deps.test.mjs (after `npx vite build`).');
  console.error('[verify-packaged-native] T0546 sdk-binary / duplicate-claude / whisper-platforms: an exclusion in package.json build.files was lost. T0547 server-bundle-baseline: remove the bat-server-baseline extraResources entry (D146).');
  console.error('[verify-packaged-native] T0689 helper-scripts: package.json build.extraResources (from: scripts) filter must list exactly serverBundleHelperScripts; run `npm run verify:helpers`.');
  console.error('[verify-packaged-native] T0691 helper-version: package.json build.afterPack must stay ./scripts/version-manifest.cjs (it writes resources/package.json = { name, version } of the packaged app).');
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
    if (r.ok) console.log(`[verify-packaged-native] ✅ linux ${r.arch}: embedded claude ${r.embeddedClaude.found} (ELF e_machine 0x${r.embeddedClaude.elfMachine.toString(16)})${describeLayout(r.layout)}, AppImage sandbox launcher installed, whisper RUNPATH $ORIGIN`);
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
  console.error('[verify-packaged-native] T0799 appimage-launcher: package.json build.afterPack must stay ./scripts/version-manifest.cjs and build.linux.target must include AppImage (the hook installs the launcher only then).');
  console.error('[verify-packaged-native] T0800 whisper-runpath: the afterPack hook (scripts/linux-whisper-runpath.cjs) sets RUNPATH $ORIGIN with patchelf; check that it ran and that build.asarUnpack still covers @kutalia/whisper-node-addon.');
  printLayoutHints();
  return false;
}

function reportWin(result, opts) {
  for (const r of result.archs) {
    if (r.ok) console.log(`[verify-packaged-native] ✅ win ${r.arch}: embedded claude ${r.embeddedClaude.found} (PE machine 0x${r.peMachine.toString(16)})${describeLayout(r.layout)}, PTY holder matches its manifest, stdio-inheritance addon ${r.stdioInherit && r.stdioInherit.loaded ? 'loads' : 'present (load not checked on this host)'}`);
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
  console.error('[verify-packaged-native] T0858 pty-holder: package.json build.afterPack must stay ./scripts/version-manifest.cjs (it assembles resources/pty-holder with scripts/pty-holder.cjs); a node.exe hash mismatch means PTY_HOLDER_NODE was changed without its pins.');
  console.error('[verify-packaged-native] T0866 win-stdio-inherit: run `npm run build:native-win` before electron-builder (the afterPack hook copies native/win-stdio-inherit/build/Release/bat_win_stdio_inherit.node to resources/native).');
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
  else if (opts.platform === 'win') ok = reportWin(verifyPackagedWin(opts.outDir, opts.archs, { stdioInheritLoadCheck: !opts.skipLoadCheck }), opts);
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
  runtimeHelperScripts,
  verifyHelperScripts,
  verifyHelperVersion,
  verifyPackagedLayout,
  verifyPackagedMac,
  verifyPackagedLinux,
  verifyAppImageLauncher,
  verifyWhisperRunpath,
  verifyPtyHolder,
  verifyWinStdioInherit,
  WIN_STDIO_INHERIT_LOAD_SCRIPT,
  verifyPackagedWin,
  parseArgs,
};

if (require.main === module) {
  main();
}
