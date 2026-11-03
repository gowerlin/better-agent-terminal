/**
 * Linux: make the packaged whisper addon find its own shared libraries (BUG-204 / T0800, D245).
 *
 * `@kutalia/whisper-node-addon` ships `dist/linux-<arch>/whisper.node` next to the libraries it needs
 * (`libwhisper.so.1`, `libggml*.so`), but upstream links them with the RUNPATH of its own CI build directory
 * (`/home/runner/work/whisper-node-addon/.../build/Release`, sometimes with a trailing empty entry = the
 * current directory). The dynamic loader therefore never looks next to `whisper.node`, and both the packaged
 * app and a plain `require` from node_modules fail with
 * `libwhisper.so.1: cannot open shared object file: No such file or directory` (T0800 checked v1.1.0).
 *
 * Fix: the electron-builder `afterPack` hook (scripts/version-manifest.cjs) sets the RUNPATH of every
 * shared object in the packaged `dist/linux-*` directories to `$ORIGIN` with `patchelf`, so each library is
 * resolved from its own directory and then from the system paths (libvulkan / libgomp / libstdc++ stay
 * system libraries). Only the copy in the package is changed, never node_modules.
 *
 * Rules:
 *   - Linux builds only (`electronPlatformName === 'linux'`, every target); Windows / macOS untouched.
 *   - patchelf missing on a Linux build host -> the build fails with an install hint (never skipped silently).
 *   - No LD_LIBRARY_PATH: it would leak into every PTY shell and child process (D245).
 *   - The result is read back and checked here, and again after packaging by scripts/verify-packaged-native.js
 *     (`whisper-runpath`), both through readElfDynamic below (headers only, nothing is executed).
 * See docs/agent-guide/packaging-release-checks.md "Linux whisper addon: library search path".
 */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const WHISPER_ADDON_PACKAGE = '@kutalia/whisper-node-addon';
const WHISPER_RUNPATH = '$ORIGIN';
const PATCHELF = 'patchelf';
const PATCHELF_TIMEOUT_MS = 60_000;
/** Libraries the addon ships itself; a NEEDED entry matching this must be a file in the same directory. */
const BUNDLED_LIBRARY_RE = /^lib(whisper|ggml)/;

const PT_LOAD = 1;
const PT_DYNAMIC = 2;
const DT_NULL = 0;
const DT_NEEDED = 1;
const DT_STRTAB = 5;
const DT_SONAME = 14;
const DT_RPATH = 15;
const DT_RUNPATH = 29;

/**
 * The dynamic section of an ELF image: `{ needed, soname, runpath, rpath }` (null for an absent entry),
 * or null when `buf` is not an ELF file. Throws on a truncated / malformed ELF.
 * Reads the program headers (PT_DYNAMIC, PT_LOAD), i.e. what the dynamic loader uses.
 */
function readElfDynamic(buf) {
  if (buf.length < 16 || buf.readUInt32BE(0) !== 0x7f454c46) return null;
  const is64 = buf[4] === 2;
  if (buf[4] !== 1 && buf[4] !== 2) throw new Error(`unknown ELF class ${buf[4]}`);
  const le = buf[5] === 1;
  if (buf[5] !== 1 && buf[5] !== 2) throw new Error(`unknown ELF data encoding ${buf[5]}`);
  const check = (offset, size) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset + size > buf.length) throw new Error(`ELF truncated (offset ${offset}, ${size} byte(s), file ${buf.length})`);
  };
  const u16 = (o) => (check(o, 2), le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (check(o, 4), le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const u64 = (o) => (check(o, 8), Number(le ? buf.readBigUInt64LE(o) : buf.readBigUInt64BE(o)));
  const word = is64 ? u64 : u32;

  const phoff = is64 ? u64(0x20) : u32(0x1c);
  const phentsize = u16(is64 ? 0x36 : 0x2a);
  const phnum = u16(is64 ? 0x38 : 0x2c);
  const loads = [];
  let dynamic = null;
  for (let i = 0; i < phnum; i++) {
    const p = phoff + i * phentsize;
    const type = u32(p);
    const seg = is64
      ? { offset: u64(p + 8), vaddr: u64(p + 16), filesz: u64(p + 32) }
      : { offset: u32(p + 4), vaddr: u32(p + 8), filesz: u32(p + 16) };
    if (type === PT_LOAD) loads.push(seg);
    else if (type === PT_DYNAMIC) dynamic = seg;
  }
  const result = { needed: [], soname: null, runpath: null, rpath: null };
  if (!dynamic) return result;

  const entrySize = is64 ? 16 : 8;
  const entries = [];
  let strtab = null;
  for (let o = dynamic.offset; o + entrySize <= dynamic.offset + dynamic.filesz; o += entrySize) {
    const tag = word(o);
    const val = word(o + entrySize / 2);
    if (tag === DT_NULL) break;
    if (tag === DT_STRTAB) strtab = val;
    else entries.push({ tag, val });
  }
  if (strtab === null) throw new Error('ELF dynamic section has no DT_STRTAB');
  const seg = loads.find((s) => strtab >= s.vaddr && strtab < s.vaddr + s.filesz);
  if (!seg) throw new Error(`DT_STRTAB 0x${strtab.toString(16)} is not in a PT_LOAD segment`);
  const strtabOffset = seg.offset + (strtab - seg.vaddr);
  const str = (index) => {
    const start = strtabOffset + index;
    check(start, 1);
    const end = buf.indexOf(0, start);
    if (end < 0) throw new Error('unterminated string in the ELF string table');
    return buf.toString('utf8', start, end);
  };
  for (const { tag, val } of entries) {
    if (tag === DT_NEEDED) result.needed.push(str(val));
    else if (tag === DT_SONAME) result.soname = str(val);
    else if (tag === DT_RUNPATH) result.runpath = str(val);
    else if (tag === DT_RPATH) result.rpath = str(val);
  }
  return result;
}

/** readElfDynamic of a file on disk (null when it is not ELF). */
function readElfDynamicFile(file) {
  return readElfDynamic(fs.readFileSync(file));
}

function isElfFile(file) {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const head = Buffer.alloc(4);
      return fs.readSync(fd, head, 0, 4, 0) === 4 && head.readUInt32BE(0) === 0x7f454c46;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

/** `whisper.node`, or a shared library name (`libx.so`, `libx.so.1`, `libx.so.1.7.6`). */
function isWhisperSharedObjectName(name) {
  return name === 'whisper.node' || /^lib[^/\\]+\.so(\.\d+)*$/.test(name);
}

/**
 * The shared objects of one `dist/linux-<arch>` directory that need the RUNPATH: regular ELF files named
 * like isWhisperSharedObjectName (symlinks are skipped: their target is patched; `vulkan-shaders-gen` is a
 * build tool, not loaded). Sorted by name.
 */
function whisperSharedObjects(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && isWhisperSharedObjectName(e.name))
    .map((e) => path.join(dir, e.name))
    .filter(isElfFile)
    .sort();
}

/** `<resourcesDir>/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist` */
function whisperDistDir(resourcesDir) {
  return path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', ...WHISPER_ADDON_PACKAGE.split('/'), 'dist');
}

/** The packaged `dist/linux-*` directories (T0546 C5 leaves only the target arch's). */
function whisperLinuxDirs(resourcesDir) {
  const dist = whisperDistDir(resourcesDir);
  let entries;
  try {
    entries = fs.readdirSync(dist, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isDirectory() && /^linux-/.test(e.name)).map((e) => path.join(dist, e.name)).sort();
}

/**
 * What is wrong with one `dist/linux-<arch>` directory (empty array = ok): `whisper.node` missing, a shared
 * object whose RUNPATH is not exactly `$ORIGIN` or that still has a DT_RPATH, or a NEEDED bundled library
 * (`libwhisper*` / `libggml*`) that is not a file in the directory.
 */
function whisperRunpathProblems(dir) {
  const problems = [];
  if (!fs.existsSync(path.join(dir, 'whisper.node'))) problems.push(`missing: ${path.join(dir, 'whisper.node')}`);
  for (const file of whisperSharedObjects(dir)) {
    let dyn;
    try {
      dyn = readElfDynamicFile(file);
    } catch (err) {
      problems.push(`${file}: unreadable ELF (${err.message})`);
      continue;
    }
    if (dyn.runpath !== WHISPER_RUNPATH) problems.push(`${file}: RUNPATH is ${dyn.runpath === null ? 'absent' : JSON.stringify(dyn.runpath)}, expected "${WHISPER_RUNPATH}"`);
    if (dyn.rpath !== null) problems.push(`${file}: has DT_RPATH ${JSON.stringify(dyn.rpath)} (expected none)`);
    for (const lib of dyn.needed) {
      if (BUNDLED_LIBRARY_RE.test(lib) && !fs.existsSync(path.join(dir, lib))) problems.push(`${file}: NEEDED ${lib} is not in ${dir}`);
    }
  }
  return problems;
}

/** Replaces a hard-linked file with its own copy, so patching it never changes the other link (node_modules). */
function breakHardLink(file) {
  const st = fs.statSync(file);
  if (st.nlink <= 1) return;
  const tmp = `${file}.t0800-tmp`;
  fs.copyFileSync(file, tmp);
  fs.chmodSync(tmp, st.mode & 0o7777);
  fs.renameSync(tmp, file);
}

/** Throws with an install hint unless `patchelf --version` runs. Returns its first output line. */
function ensurePatchelf(execFileSync = childProcess.execFileSync) {
  try {
    return String(execFileSync(PATCHELF, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 })).trim().split('\n')[0];
  } catch (err) {
    const reason = err && err.code === 'ENOENT' ? 'not found on PATH' : `failed: ${err && err.message}`;
    throw new Error(
      `afterPack (T0800 / BUG-204): patchelf ${reason}. A Linux build sets the RUNPATH of the whisper addon's ` +
      `libraries with patchelf; install it on the build host (Debian / Ubuntu: sudo apt-get install -y patchelf). ` +
      'See docs/agent-guide/packaging-release-checks.md "Linux whisper addon: library search path".',
    );
  }
}

/**
 * Sets RUNPATH `$ORIGIN` on every shared object of each packaged `dist/linux-*` directory under `resourcesDir`
 * and checks the result. Throws when there is no such directory, patchelf is missing, or a check fails.
 * Returns `{ patchelf, dirs: [{ dir, files }] }`.
 */
function patchWhisperRunpath(resourcesDir, { execFileSync = childProcess.execFileSync } = {}) {
  const dirs = whisperLinuxDirs(resourcesDir);
  if (dirs.length === 0) {
    throw new Error(`afterPack (T0800 / BUG-204): no dist/linux-* directory in ${whisperDistDir(resourcesDir)} (is ${WHISPER_ADDON_PACKAGE} still in build.asarUnpack?)`);
  }
  const version = ensurePatchelf(execFileSync);
  const done = [];
  for (const dir of dirs) {
    const files = whisperSharedObjects(dir);
    for (const file of files) {
      breakHardLink(file);
      // execFile: no shell, so `$ORIGIN` reaches patchelf literally
      execFileSync(PATCHELF, ['--set-rpath', WHISPER_RUNPATH, file], { stdio: ['ignore', 'pipe', 'pipe'], timeout: PATCHELF_TIMEOUT_MS });
    }
    const problems = whisperRunpathProblems(dir);
    if (problems.length) throw new Error(`afterPack (T0800 / BUG-204): whisper RUNPATH check failed after patchelf:\n  ${problems.join('\n  ')}`);
    done.push({ dir, files });
  }
  return { patchelf: version, dirs: done };
}

/** Part of the electron-builder afterPack hook (scripts/version-manifest.cjs). No-op unless a Linux build. */
function afterPackWhisperRunpath(context, deps = {}) {
  if (!context || context.electronPlatformName !== 'linux') return null;
  const resourcesDir = context.packager.getResourcesDir(context.appOutDir);
  const result = patchWhisperRunpath(resourcesDir, deps);
  for (const { dir, files } of result.dirs) {
    console.log(`  • afterPack (T0800): whisper RUNPATH = ${WHISPER_RUNPATH} for ${files.length} file(s) in ${path.relative(context.appOutDir, dir)} (${result.patchelf})`);
  }
  return result;
}

module.exports = {
  WHISPER_ADDON_PACKAGE,
  WHISPER_RUNPATH,
  BUNDLED_LIBRARY_RE,
  readElfDynamic,
  readElfDynamicFile,
  isWhisperSharedObjectName,
  whisperSharedObjects,
  whisperDistDir,
  whisperLinuxDirs,
  whisperRunpathProblems,
  ensurePatchelf,
  patchWhisperRunpath,
  afterPackWhisperRunpath,
};
