/**
 * The `{ name, version }` package.json a packaged helper reads its version from (BUG-169 / T0691).
 *
 * bat-terminal.mjs / bat-notify.mjs / bat-mcp.mjs read `join(<helper dir>, '..', 'package.json')`
 * (`--version`, BAT MCP `serverInfo.version`) and fall back to 0.0.0. Two layouts put a file there:
 *   - the server bundle: scripts/build-server-bundle.mjs writes it at the bundle root;
 *   - the desktop app: the electron-builder `afterPack` hook below writes it at `<resources>/package.json`
 *     (win / linux `resources/`, mac `<App>.app/Contents/Resources/`), next to `resources/scripts`.
 *     `resources/scripts` itself only holds the runtime helpers (T0689), so the file cannot go there.
 *
 * Electron never loads `<resources>/package.json` as the app: it only tries `<resources>/app`,
 * `<resources>/app.asar` and `<resources>/default_app.asar` (lib/browser/init.ts, appSearchPaths).
 *
 * The hook takes the version electron-builder packages (`packager.appInfo.version`, i.e. the app
 * package.json after extraMetadata), so the CI `VERSION` env path (scripts/build-version.js rewrites
 * package.json before electron-builder runs) and the local `build` / `build:dir` agree with app.asar.
 * scripts/verify-packaged-native.js checks the result (`helper-version`).
 */

const fs = require('fs');
const path = require('path');

const VERSION_MANIFEST_FILE = 'package.json';
const VERSION_MANIFEST_KEYS = ['name', 'version'];

/** File content: only `name` and `version` (same format the server bundle has shipped since PLAN-031). */
function versionManifestContent(name, version) {
  return JSON.stringify({ name, version }, null, 2) + '\n';
}

/**
 * What is wrong with a version manifest's content: unparsable, other keys than name / version,
 * empty name, empty or 0.0.0 version, or a version other than `expectedVersion` (when given).
 * Empty array = ok.
 */
function versionManifestProblems(content, expectedVersion = null) {
  let manifest;
  try {
    manifest = JSON.parse(String(content));
  } catch (err) {
    return [`not valid JSON: ${err.message}`];
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) return ['not a JSON object'];
  const problems = [];
  const extra = Object.keys(manifest).filter((key) => !VERSION_MANIFEST_KEYS.includes(key));
  if (extra.length > 0) problems.push(`extra field(s): ${extra.join(', ')} (only ${VERSION_MANIFEST_KEYS.join(' / ')} allowed)`);
  if (typeof manifest.name !== 'string' || manifest.name === '') problems.push('name is missing or empty');
  if (typeof manifest.version !== 'string' || manifest.version === '') problems.push('version is missing or empty');
  else if (manifest.version === '0.0.0') problems.push('version is 0.0.0 (the helpers\' fallback)');
  else if (expectedVersion && manifest.version !== expectedVersion) problems.push(`version is ${manifest.version}, expected ${expectedVersion} (app.asar package.json)`);
  return problems;
}

/** Writes `<resourcesDir>/package.json`; returns its path. */
function writeVersionManifest(resourcesDir, name, version) {
  const target = path.join(resourcesDir, VERSION_MANIFEST_FILE);
  fs.writeFileSync(target, versionManifestContent(name, version), 'utf8');
  return target;
}

/** electron-builder `afterPack` hook (package.json build.afterPack). Runs before signing. */
async function afterPack(context) {
  const { packager, appOutDir } = context;
  const { name, version } = packager.appInfo;
  if (!name || !version) throw new Error(`afterPack (T0691): app name / version unavailable (name=${name}, version=${version})`);
  const target = writeVersionManifest(packager.getResourcesDir(appOutDir), name, version);
  console.log(`  • afterPack (T0691): wrote ${target} (${name} ${version})`);
}

module.exports = {
  VERSION_MANIFEST_FILE,
  VERSION_MANIFEST_KEYS,
  versionManifestContent,
  versionManifestProblems,
  writeVersionManifest,
  afterPack,
};
