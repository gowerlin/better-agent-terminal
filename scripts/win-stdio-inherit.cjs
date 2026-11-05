/**
 * BUG-213 / T0866 (D291): the Windows stdio-inheritance addon (native/win-stdio-inherit), build / package side.
 *
 * One place for the file names and directories used by:
 *   - scripts/build-native-win.mjs (`npm run build:native-win`): node-gyp builds `<repo>/native/win-stdio-inherit/build/Release/<ADDON_FILE>`;
 *   - the electron-builder afterPack hook (scripts/version-manifest.cjs → afterPackWinStdioInherit): Windows packages get
 *     `<resources>/native/<ADDON_FILE>` (outside app.asar, so `process.dlopen` can load it); a missing build fails the package;
 *   - scripts/verify-native-modules.js (win32 hosts require the built addon) and scripts/verify-packaged-native.js
 *     (`win-stdio-inherit`: present, PE of the arch, loads under ELECTRON_RUN_AS_NODE).
 * The runtime side (electron/win-stdio-inherit.ts) repeats ADDON_FILE / the two directories;
 * electron/__tests__/win-stdio-inherit.test.ts checks both files give the same answers.
 *
 * 🔴 No prebuilt `.node` in the repo, no install script, no postinstall (D291): the addon is built only by the npm script.
 * Only win32-x64 is built and shipped (the Windows package is x64 only).
 */

const fs = require('fs');
const path = require('path');

const ADDON_FILE = 'bat_win_stdio_inherit.node';
/** Source directory (binding.gyp), relative to the repo root. */
const ADDON_SOURCE_DIR = 'native/win-stdio-inherit';
/** Where node-gyp puts the build, relative to ADDON_SOURCE_DIR. */
const ADDON_BUILD_SUBDIR = 'build/Release';
/** `<resources>/<this>/<ADDON_FILE>` in a Windows package. */
const ADDON_RESOURCES_DIR = 'native';
/** The only Windows arch the addon is built for. */
const ADDON_ARCHS = ['x64'];

function builtAddonPath(projectRoot) {
  return path.join(projectRoot, ...ADDON_SOURCE_DIR.split('/'), ...ADDON_BUILD_SUBDIR.split('/'), ADDON_FILE);
}

function packagedAddonPath(resourcesPath) {
  return path.join(resourcesPath, ADDON_RESOURCES_DIR, ADDON_FILE);
}

/** electron-builder Arch enum (0 ia32, 1 x64, 2 armv7l, 3 arm64, 4 universal) → name. */
function builderArchName(arch) {
  if (typeof arch === 'string') return arch;
  return ({ 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' })[arch] || String(arch);
}

function projectDirOf(context) {
  const packager = context && context.packager;
  return (packager && packager.info && packager.info.projectDir) || (packager && packager.projectDir) || process.cwd();
}

/**
 * afterPack (Windows only): copy the built addon to `<resources>/native/`. macOS / Linux return null without touching
 * anything. A missing build or another arch than x64 throws (the package would otherwise ship without the BUG-213 fix).
 */
function afterPackWinStdioInherit(context, deps = {}) {
  if (!context || context.electronPlatformName !== 'win32') return null;
  const arch = builderArchName(context.arch);
  const log = deps.log || ((line) => console.log(`  • afterPack (T0866): ${line}`));
  if (!ADDON_ARCHS.includes(arch)) {
    throw new Error(`afterPack (T0866): the stdio-inheritance addon is built for ${ADDON_ARCHS.join(', ')} only, not ${arch} (BUG-213)`);
  }
  const source = deps.source || builtAddonPath(projectDirOf(context));
  if (!fs.existsSync(source)) {
    throw new Error(`afterPack (T0866): ${source} is missing; run \`npm run build:native-win\` before packaging for Windows (BUG-213)`);
  }
  const target = packagedAddonPath(context.packager.getResourcesDir(context.appOutDir));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  log(`stdio-inheritance addon → ${path.relative(context.appOutDir, target)} (${fs.statSync(target).size} bytes)`);
  return target;
}

module.exports = {
  ADDON_FILE,
  ADDON_SOURCE_DIR,
  ADDON_BUILD_SUBDIR,
  ADDON_RESOURCES_DIR,
  ADDON_ARCHS,
  builtAddonPath,
  packagedAddonPath,
  builderArchName,
  afterPackWinStdioInherit,
};
