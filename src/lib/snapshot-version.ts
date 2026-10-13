// Local snapshot version suffix (D125 / T0376): scripts/build-version.js
// formatSnapshotVersion() turns 0.5.9 into 0.5.9-local.261004204034 and
// 0.5.9-pre.4 into 0.5.9-pre.4.local.261004204034.
//
// A snapshot never has a server-bundle release of its own, so everything that
// names a server bundle by version uses the base version instead:
//   - scripts/fetch-baseline-tarball.mjs (build time, BUG-115 / T0488)
//   - electron/remote/server-bundle-distributor.ts (runtime download fallback, T0492)
//
// Single SoT for the rule. scripts/build-version.js (plain Node CJS) requires
// this file directly through Node 24's built-in type stripping, so keep it to
// erasable TypeScript only (annotations; no enum / namespace / parameter
// properties) and free of imports.

const SNAPSHOT_SUFFIX_RE = /[-.]local\.\d{12}$/

/** Inverse of formatSnapshotVersion: 0.5.9-pre.4.local.261004204034 -> 0.5.9-pre.4. Anything else is returned unchanged. */
export function stripSnapshotSuffix(version: string): string {
  return String(version).replace(SNAPSHOT_SUFFIX_RE, '')
}
