/**
 * PLAN-065 W2 / T0858 — Windows PTY holder packaging (D286).
 *
 * The holder is the official Node.js `node.exe` (OpenJS-signed), renamed `bat-pty-holder.exe`, running the same
 * `terminal-server.js` the app ships. The installer copies it out of the install directory (build/installer.nsh
 * `customInstall`) so that a later NSIS upgrade, which ends every process under $INSTDIR, does not end the
 * process holding the ConPTYs (T0856 Q1 / Q2). Nothing starts it yet: W3 (T0859) forks the Terminal Server from it.
 *
 * What this module does:
 *   - pins the Node version and the SHA-256 of each `node.exe` (PTY_HOLDER_NODE); the build downloads it only
 *     from nodejs.org and fails on any mismatch — SHASUMS256.txt is NOT read at build time (supply chain rule);
 *   - assembles `<resources>/pty-holder/` in the electron-builder afterPack hook (scripts/version-manifest.cjs),
 *     Windows builds only: `bat-pty-holder.exe`, `terminal-server.js` (the packaged copy), the win32 runtime files
 *     of `@lydell/node-pty`, and `holder-manifest.json` (key, Node version, arch, size + SHA-256 of every file);
 *   - checks a holder directory (scripts/verify-packaged-native.js `pty-holder`; W3 does the same at fork time);
 *   - the holder root rules the installer follows (PTY_HOLDER_ROOT_DIR_NAME, holderRootConflictsWithInstallDir).
 *
 * macOS / Linux builds: afterPackPtyHolder returns at once; nothing is downloaded or written.
 * Docs: docs/agent-guide/packaging-release-checks.md「Windows PTY holder 打包」.
 */

const crypto = require('crypto');
const fs = require('fs');
const { builtinModules } = require('module');
const path = require('path');

/**
 * Node runtime of the holder. Same major as the Node inside Electron 45 (24.x): node-pty is N-API (not bound to a
 * Node ABI, T0856 E1), and the Terminal Server code is tested on Node 24 (vitest / CI). Latest 24.x LTS patch at
 * the time of pinning (24.22.2, 2026-10-27; Electron 45.2.1 embeds 24.22.1).
 * Upgrade: docs/agent-guide/packaging-release-checks.md「Windows PTY holder 打包」› 升版步驟.
 * Values copied from https://nodejs.org/dist/v24.22.2/SHASUMS256.txt when pinning and checked against the downloaded
 * files (OpenJS Foundation Authenticode signature: Valid). Not frozen only so that tests can swap in a fake binary
 * in-process (scripts/__tests__/_pty-holder-fixture.cjs); nothing else may change it.
 */
const PTY_HOLDER_NODE = {
  version: '24.22.2',
  binaries: {
    x64: { path: 'win-x64/node.exe', size: 93922624, sha256: '1c331340fa6cac5e4294725959070a143fa0507195a78ad77eed7943f719aac9' },
    arm64: { path: 'win-arm64/node.exe', size: 82156872, sha256: 'e2d6e75a0bfe4c176316d7c732eb8def9d94570c759eaeab335473a015abb7ea' },
  },
};

/** The only download origin (nodejs.org official dist). */
const NODE_DIST_BASE_URL = 'https://nodejs.org/dist';

/** Name of the holder executable. 🔴 Never `BetterAgentTerminal.exe`: without PowerShell, NSIS ends processes by image name (T0856 Q1). */
const PTY_HOLDER_EXE_NAME = 'bat-pty-holder.exe';
/** `<resources>/<this>` in the package; the installer copies it to `<holder root>/<key>/`. */
const PTY_HOLDER_RESOURCES_DIR = 'pty-holder';
const PTY_HOLDER_MANIFEST_FILE = 'holder-manifest.json';
const PTY_HOLDER_ENTRY = 'terminal-server.js';
const PTY_HOLDER_MANIFEST_SCHEMA = 1;
/**
 * Holder root directory name (D2): per-user `%LOCALAPPDATA%\BAT-PtyHolder`, per-machine `%ProgramFiles%\BAT-PtyHolder`.
 * Not `BetterAgentTerminal…`: the default install directories are `…\BetterAgentTerminal`, and NSIS matches running
 * processes with `Path.StartsWith('$INSTDIR')` without a trailing `\` — `C:\Program Files\BetterAgentTerminal PTY Holder`
 * would be matched and ended. build/installer.nsh defines the same name (source guard in scripts/__tests__/pty-holder.test.mjs).
 */
const PTY_HOLDER_ROOT_DIR_NAME = 'BAT-PtyHolder';
/** `<nodeVersion>-<12 hex>` — also the directory name under the holder root. */
const PTY_HOLDER_KEY_RE = /^\d+\.\d+\.\d+-[0-9a-f]{12}$/;

/** Packages terminal-server.js may require (rollup externals that are not Node builtins). */
const PTY_HOLDER_EXTERNAL_PACKAGES = ['@lydell/node-pty'];
const NODE_PTY_PACKAGE = '@lydell/node-pty';
/** Files of the native package `@lydell/node-pty-win32-<arch>` the holder needs (not the 10 MB of .pdb). */
const NODE_PTY_NATIVE_FILES = ['package.json', 'conpty.node', 'conpty_console_list.node'];

const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

// electron-builder's Arch enum (builder-util/out/arch.js): ia32 0, x64 1, armv7l 2, arm64 3, universal 4.
const BUILDER_ARCH_NAMES = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };

function holderNodeBinary(arch) {
  const binary = PTY_HOLDER_NODE.binaries[arch];
  if (!binary) throw new Error(`PTY holder (T0858): no pinned node.exe for Windows arch "${arch}" (pinned: ${Object.keys(PTY_HOLDER_NODE.binaries).join(', ')})`);
  return binary;
}

/** https://nodejs.org/dist/v<version>/win-<arch>/node.exe */
function holderNodeDownloadUrl(arch, version = PTY_HOLDER_NODE.version) {
  return `${NODE_DIST_BASE_URL}/v${version}/${holderNodeBinary(arch).path}`;
}

/** Cache file name for one pinned binary (content-addressed by the pinned hash, so a new pin never reuses an old file). */
function holderNodeCacheName(arch) {
  const binary = holderNodeBinary(arch);
  return `node-v${PTY_HOLDER_NODE.version}-win-${arch}-${binary.sha256.slice(0, 16)}.exe`;
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function sha256FileSync(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** What is wrong with `file` as the pinned node.exe of `arch` (empty array = ok). */
async function holderNodeProblems(file, arch) {
  const binary = holderNodeBinary(arch);
  let size;
  try {
    size = fs.statSync(file).size;
  } catch (err) {
    return [`cannot read ${file}: ${err.message}`];
  }
  const problems = [];
  if (size !== binary.size) problems.push(`size ${size}, pinned ${binary.size}`);
  const actual = await sha256File(file);
  if (actual !== binary.sha256) problems.push(`SHA-256 ${actual}, pinned ${binary.sha256}`);
  return problems;
}

async function downloadToFile(url, target, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(target, buffer);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Path of a verified copy of the pinned node.exe for `arch`.
 *   1. `overridePath` (env BAT_PTY_HOLDER_NODE_EXE, offline builds): used only when it matches the pinned hash.
 *   2. `<cacheDir>/<holderNodeCacheName>` when it matches (a mismatching cache file is deleted and downloaded again).
 *   3. download from nodejs.org into the cache; any size / hash mismatch → throws (the build fails).
 * `deps`: { cacheDir, overridePath, fetchImpl, log } (tests replace fetch).
 */
async function ensureHolderNodeExe(arch, deps = {}) {
  const log = deps.log || (() => {});
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const overridePath = deps.overridePath ?? process.env.BAT_PTY_HOLDER_NODE_EXE ?? '';
  if (overridePath) {
    const problems = await holderNodeProblems(overridePath, arch);
    if (problems.length) throw new Error(`PTY holder (T0858): BAT_PTY_HOLDER_NODE_EXE=${overridePath} is not the pinned node v${PTY_HOLDER_NODE.version} win-${arch}: ${problems.join('; ')}`);
    log(`node.exe from BAT_PTY_HOLDER_NODE_EXE (${overridePath}), SHA-256 verified`);
    return overridePath;
  }
  const cacheDir = deps.cacheDir || defaultHolderCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  const cached = path.join(cacheDir, holderNodeCacheName(arch));
  if (fs.existsSync(cached)) {
    const problems = await holderNodeProblems(cached, arch);
    if (problems.length === 0) {
      log(`node.exe v${PTY_HOLDER_NODE.version} win-${arch} from cache, SHA-256 verified`);
      return cached;
    }
    log(`cached node.exe does not match the pin (${problems.join('; ')}); downloading again`);
    fs.rmSync(cached, { force: true });
  }
  if (typeof fetchImpl !== 'function') throw new Error('PTY holder (T0858): fetch is unavailable (Node 18+ required to download node.exe)');
  const url = holderNodeDownloadUrl(arch);
  const partial = `${cached}.download-${process.pid}`;
  log(`downloading ${url}`);
  try {
    await downloadToFile(url, partial, fetchImpl);
    const problems = await holderNodeProblems(partial, arch);
    if (problems.length) throw new Error(`downloaded ${url} does not match the pinned node v${PTY_HOLDER_NODE.version} win-${arch}: ${problems.join('; ')}`);
    fs.renameSync(partial, cached);
  } catch (err) {
    fs.rmSync(partial, { force: true });
    throw new Error(`PTY holder (T0858): ${err.message}`);
  }
  log(`node.exe v${PTY_HOLDER_NODE.version} win-${arch} downloaded, SHA-256 verified`);
  return cached;
}

/** `<repo>/node_modules/.cache/bat-pty-holder` (gitignored; `npm ci` clears it). */
function defaultHolderCacheDir() {
  return path.join(__dirname, '..', 'node_modules', '.cache', 'bat-pty-holder');
}

/** Non-builtin packages a bundled CommonJS file requires with a string literal (`require("x")`). */
function externalPackagesOf(source) {
  const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
  const found = new Set();
  for (const match of String(source).matchAll(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g)) {
    const spec = match[2];
    if (spec.startsWith('.') || spec.startsWith('/') || builtins.has(spec) || spec.startsWith('node:')) continue;
    const parts = spec.split('/');
    found.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
  }
  return [...found].sort();
}

function walkRelative(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkRelative(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Runtime files of the JS package `@lydell/node-pty`: package.json, LICENSE and every .js (no .d.ts / .map / README). */
function isNodePtyRuntimeFile(rel) {
  return rel === 'package.json' || rel === 'LICENSE' || rel.endsWith('.js');
}

/**
 * The files of a holder directory, `{ rel, src }`, taken from the packaged app (`<resources>/app.asar.unpacked`, the
 * copy BAT itself runs) plus the verified node.exe. Throws when terminal-server.js needs another package than
 * PTY_HOLDER_EXTERNAL_PACKAGES (a W1 / later change must then extend the holder, not ship it half).
 */
function holderSourceFiles(resourcesDir, arch, nodeExe) {
  const unpacked = path.join(resourcesDir, 'app.asar.unpacked');
  const entry = path.join(unpacked, 'dist-electron', PTY_HOLDER_ENTRY);
  if (!fs.existsSync(entry)) throw new Error(`PTY holder (T0858): ${entry} missing (build.asarUnpack must keep dist-electron/${PTY_HOLDER_ENTRY})`);
  const externals = externalPackagesOf(fs.readFileSync(entry, 'utf8'));
  const unexpected = externals.filter((name) => !PTY_HOLDER_EXTERNAL_PACKAGES.includes(name));
  if (unexpected.length) throw new Error(`PTY holder (T0858): ${PTY_HOLDER_ENTRY} requires ${unexpected.join(', ')}, which the holder does not carry (add it to PTY_HOLDER_EXTERNAL_PACKAGES and holderSourceFiles)`);

  const files = [
    { rel: PTY_HOLDER_EXE_NAME, src: nodeExe },
    { rel: PTY_HOLDER_ENTRY, src: entry },
  ];
  const ptyDir = path.join(unpacked, 'node_modules', NODE_PTY_PACKAGE);
  if (!fs.existsSync(ptyDir)) throw new Error(`PTY holder (T0858): ${ptyDir} missing (build.asarUnpack must keep ${NODE_PTY_PACKAGE})`);
  for (const rel of walkRelative(ptyDir).filter(isNodePtyRuntimeFile)) {
    files.push({ rel: `node_modules/${NODE_PTY_PACKAGE}/${rel}`, src: path.join(ptyDir, rel) });
  }
  const nativePackage = `${NODE_PTY_PACKAGE}-win32-${arch}`;
  const nativeDir = path.join(unpacked, 'node_modules', nativePackage);
  for (const rel of NODE_PTY_NATIVE_FILES) {
    const src = path.join(nativeDir, rel);
    if (!fs.existsSync(src)) throw new Error(`PTY holder (T0858): ${src} missing (${nativePackage} must be installed and covered by build.asarUnpack)`);
    files.push({ rel: `node_modules/${nativePackage}/${rel}`, src });
  }
  return files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

/**
 * Holder key = `<nodeVersion>-<first 12 hex of SHA-256 over the sorted "path\tsize\tsha256\n" lines>`.
 * Depends only on the content (not on the BAT version): BAT upgrades that change neither Node nor the holder files
 * reuse the same directory, and any change gives a new one (D9).
 */
function holderKey(nodeVersion, files) {
  const lines = [...files]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((f) => `${f.path}\t${f.size}\t${f.sha256}\n`)
    .join('');
  return `${nodeVersion}-${crypto.createHash('sha256').update(lines).digest('hex').slice(0, 12)}`;
}

/** Manifest object for `files` ({ path, size, sha256 }), in a fixed key order. */
function buildHolderManifest(files, { nodeVersion = PTY_HOLDER_NODE.version, arch }) {
  const sorted = [...files]
    .map(({ path: p, size, sha256 }) => ({ path: p, size, sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    schema: PTY_HOLDER_MANIFEST_SCHEMA,
    key: holderKey(nodeVersion, sorted),
    nodeVersion,
    arch,
    exe: PTY_HOLDER_EXE_NAME,
    entry: PTY_HOLDER_ENTRY,
    files: sorted,
  };
}

/**
 * File content. 🔴 Line 3 is always `  "key": "<key>",` — build/installer.nsh reads the key from that line, and
 * compares an installed manifest with the packaged one byte for byte (same content ⇒ same bytes: no timestamps,
 * no BAT version).
 */
function serializeHolderManifest(manifest) {
  return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Builds `<resourcesDir>/pty-holder/` (replacing an old one) and returns the manifest.
 * `nodeExe` must already be verified (ensureHolderNodeExe).
 */
function assemblePtyHolder(resourcesDir, arch, nodeExe) {
  const sources = holderSourceFiles(resourcesDir, arch, nodeExe);
  const holderDir = path.join(resourcesDir, PTY_HOLDER_RESOURCES_DIR);
  fs.rmSync(holderDir, { recursive: true, force: true });
  const entries = [];
  for (const { rel, src } of sources) {
    const target = path.join(holderDir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(src, target);
    entries.push({ path: rel, size: fs.statSync(target).size, sha256: sha256FileSync(target) });
  }
  const manifest = buildHolderManifest(entries, { arch });
  fs.writeFileSync(path.join(holderDir, PTY_HOLDER_MANIFEST_FILE), serializeHolderManifest(manifest), 'utf8');
  return { holderDir, manifest };
}

/** PE COFF Machine of a file (IMAGE_FILE_MACHINE_*), or null when it is not a PE image. */
function peMachineOf(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(4096);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    if (n < 0x40 || head.readUInt16LE(0) !== 0x5a4d) return null;
    const pe = head.readUInt32LE(0x3c);
    if (pe + 6 > n || head.readUInt32LE(pe) !== 0x00004550) return null;
    return head.readUInt16LE(pe + 4);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

const PE_MACHINES = { x64: 0x8664, arm64: 0xaa64 };

/**
 * What is wrong with a holder directory (empty array = ok): manifest missing / unparsable / wrong schema / wrong key
 * format or value, Node version or exe hash other than the pin, a listed file missing or with another size / hash,
 * an unlisted file, an exe named BetterAgentTerminal.exe or not a PE image of `arch`.
 */
function ptyHolderProblems(holderDir, arch) {
  const manifestPath = path.join(holderDir, PTY_HOLDER_MANIFEST_FILE);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return [`${manifestPath}: ${err.code === 'ENOENT' ? 'missing' : err.message}`];
  }
  const problems = [];
  if (manifest.schema !== PTY_HOLDER_MANIFEST_SCHEMA) problems.push(`manifest schema ${manifest.schema}, expected ${PTY_HOLDER_MANIFEST_SCHEMA}`);
  if (manifest.nodeVersion !== PTY_HOLDER_NODE.version) problems.push(`manifest nodeVersion ${manifest.nodeVersion}, pinned ${PTY_HOLDER_NODE.version}`);
  if (manifest.arch !== arch) problems.push(`manifest arch ${manifest.arch}, expected ${arch}`);
  if (manifest.exe !== PTY_HOLDER_EXE_NAME) problems.push(`manifest exe ${manifest.exe}, expected ${PTY_HOLDER_EXE_NAME}`);
  if (manifest.entry !== PTY_HOLDER_ENTRY) problems.push(`manifest entry ${manifest.entry}, expected ${PTY_HOLDER_ENTRY}`);
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!Array.isArray(manifest.files)) problems.push('manifest files is not an array');
  if (typeof manifest.key !== 'string' || !PTY_HOLDER_KEY_RE.test(manifest.key)) problems.push(`manifest key ${JSON.stringify(manifest.key)} is not <nodeVersion>-<12 hex>`);
  else if (manifest.key !== holderKey(String(manifest.nodeVersion), files)) problems.push(`manifest key ${manifest.key} does not match its files (${holderKey(String(manifest.nodeVersion), files)})`);
  const lines = fs.readFileSync(manifestPath, 'utf8').split('\n');
  if (lines[2] !== `  "key": ${JSON.stringify(manifest.key)},`) problems.push('manifest line 3 is not `  "key": "<key>",` (build/installer.nsh reads it)');

  const listed = new Set();
  for (const file of files) {
    listed.add(file.path);
    const full = path.join(holderDir, ...String(file.path).split('/'));
    if (!fs.existsSync(full)) {
      problems.push(`missing: ${file.path}`);
      continue;
    }
    const size = fs.statSync(full).size;
    if (size !== file.size) problems.push(`${file.path}: size ${size}, manifest ${file.size}`);
    const sha = sha256FileSync(full);
    if (sha !== file.sha256) problems.push(`${file.path}: SHA-256 ${sha}, manifest ${file.sha256}`);
  }
  for (const rel of fs.existsSync(holderDir) ? walkRelative(holderDir) : []) {
    if (rel !== PTY_HOLDER_MANIFEST_FILE && !listed.has(rel)) problems.push(`not in the manifest: ${rel}`);
  }
  for (const required of [PTY_HOLDER_EXE_NAME, PTY_HOLDER_ENTRY, `node_modules/${NODE_PTY_PACKAGE}/package.json`, ...NODE_PTY_NATIVE_FILES.map((f) => `node_modules/${NODE_PTY_PACKAGE}-win32-${arch}/${f}`)]) {
    if (!listed.has(required)) problems.push(`manifest does not list ${required}`);
  }
  for (const file of files) {
    if (/(^|\/)betteragentterminal\.exe$/i.test(String(file.path))) problems.push(`${file.path}: the holder must not ship BetterAgentTerminal.exe (NSIS ends it by image name)`);
  }
  const exe = files.find((f) => f.path === PTY_HOLDER_EXE_NAME);
  if (exe) {
    if (exe.sha256 !== PTY_HOLDER_NODE.binaries[arch]?.sha256) problems.push(`${PTY_HOLDER_EXE_NAME}: SHA-256 ${exe.sha256} is not the pinned node.exe v${PTY_HOLDER_NODE.version} win-${arch}`);
    const machine = peMachineOf(path.join(holderDir, PTY_HOLDER_EXE_NAME));
    if (machine === null) problems.push(`${PTY_HOLDER_EXE_NAME}: not a PE image`);
    else if (PE_MACHINES[arch] !== undefined && machine !== PE_MACHINES[arch]) problems.push(`${PTY_HOLDER_EXE_NAME}: PE machine 0x${machine.toString(16)}, expected 0x${PE_MACHINES[arch].toString(16)} for ${arch}`);
  }
  return problems;
}

/**
 * Holder root for an install scope (D2): per-user `<LOCALAPPDATA>\BAT-PtyHolder`, per-machine
 * `<ProgramFiles (64-bit)>\BAT-PtyHolder`. build/installer.nsh uses `$LOCALAPPDATA` / `$PROGRAMFILES64`.
 */
function holderRootFor(scope, env = process.env) {
  if (scope === 'per-machine') return path.win32.join(env.ProgramW6432 || env.ProgramFiles || 'C:\\Program Files', PTY_HOLDER_ROOT_DIR_NAME);
  if (scope === 'per-user') {
    if (!env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is not set');
    return path.win32.join(env.LOCALAPPDATA, PTY_HOLDER_ROOT_DIR_NAME);
  }
  throw new Error(`unknown install scope: ${scope}`);
}

/**
 * True when the holder root and the install directory overlap as plain string prefixes, either way, ignoring case.
 * NSIS ends processes whose path `StartsWith('$INSTDIR')` (no trailing `\`), so `C:\BAT` as install directory also
 * matches `C:\BAT-PtyHolder\…`: the installer then does not copy the holder (build/installer.nsh, same rule), and
 * W3 does not use one.
 */
function holderRootConflictsWithInstallDir(holderRoot, installDir) {
  const root = String(holderRoot).toLowerCase();
  const inst = String(installDir).toLowerCase();
  if (!root || !inst) return true;
  return root.startsWith(inst) || inst.startsWith(root);
}

/** electron-builder afterPack context → `x64` / `arm64` / … */
function builderArchName(arch) {
  return typeof arch === 'string' ? arch : BUILDER_ARCH_NAMES[arch] ?? String(arch);
}

/**
 * Part of the electron-builder afterPack hook (scripts/version-manifest.cjs). No-op unless a Windows build.
 * `deps` (tests): { cacheDir, overridePath, fetchImpl, log }.
 */
async function afterPackPtyHolder(context, deps = {}) {
  if (!context || context.electronPlatformName !== 'win32') return null;
  const arch = builderArchName(context.arch);
  const log = deps.log || ((line) => console.log(`  • afterPack (T0858): ${line}`));
  const resourcesDir = context.packager.getResourcesDir(context.appOutDir);
  holderSourceFiles(resourcesDir, arch, PTY_HOLDER_EXE_NAME); // fail before the ~90 MB download when the app files are missing
  const nodeExe = await ensureHolderNodeExe(arch, { ...deps, log });
  const { holderDir, manifest } = assemblePtyHolder(resourcesDir, arch, nodeExe);
  const problems = ptyHolderProblems(holderDir, arch);
  if (problems.length) throw new Error(`afterPack (T0858): PTY holder check failed:\n  ${problems.join('\n  ')}`);
  const total = manifest.files.reduce((sum, f) => sum + f.size, 0);
  log(`PTY holder ${manifest.key} in ${path.relative(context.appOutDir, holderDir)} (${manifest.files.length} files, ${total} bytes)`);
  return { holderDir, manifest };
}

module.exports = {
  PTY_HOLDER_NODE,
  NODE_DIST_BASE_URL,
  PTY_HOLDER_EXE_NAME,
  PTY_HOLDER_RESOURCES_DIR,
  PTY_HOLDER_MANIFEST_FILE,
  PTY_HOLDER_ENTRY,
  PTY_HOLDER_MANIFEST_SCHEMA,
  PTY_HOLDER_ROOT_DIR_NAME,
  PTY_HOLDER_KEY_RE,
  PTY_HOLDER_EXTERNAL_PACKAGES,
  NODE_PTY_NATIVE_FILES,
  holderNodeDownloadUrl,
  holderNodeCacheName,
  holderNodeProblems,
  ensureHolderNodeExe,
  defaultHolderCacheDir,
  externalPackagesOf,
  isNodePtyRuntimeFile,
  holderSourceFiles,
  holderKey,
  buildHolderManifest,
  serializeHolderManifest,
  assemblePtyHolder,
  peMachineOf,
  ptyHolderProblems,
  holderRootFor,
  holderRootConflictsWithInstallDir,
  builderArchName,
  afterPackPtyHolder,
};
