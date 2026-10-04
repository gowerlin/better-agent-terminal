// @vitest-environment node
/**
 * T0388 (PLAN-036): electron-free guard for the headless server bundle.
 *
 * In the server bundle `electron` is external and no package backs it, so any
 * module in the headless import graph that imports `electron` at top level
 * (directly or transitively) makes bat-server die with MODULE_NOT_FOUND at
 * startup. Inside the repo `require('electron')` returns a path string and
 * does not throw, so ordinary unit tests cannot see this — only a bundle-level
 * check can.
 *
 * Bundles the real entry points with the real settings parsed from
 * scripts/build-server-bundle.mjs, intercepts every `electron` resolve and
 * fails unless it is one of the known lazy, try/catch-guarded call sites.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { build, type Plugin } from 'esbuild'
import { afterAll, describe, expect, it } from 'vitest'
import {
  PROJECT_ROOT,
  loadServerBundleEsbuildConfig,
  type ServerBundleEsbuildConfig,
} from './helpers/server-bundle-config'

/**
 * The only places headless code may reach for `electron`: lazy `require()`
 * inside try/catch, falling back when it is absent (T0386 §2, re-checked
 * 2026-10-05). Adding an entry needs the same shape — never a top-level import.
 */
const ALLOWED_LAZY_ELECTRON_IMPORTERS: ReadonlyMap<string, string> = new Map([
  ['electron/remote/remote-server.ts', 'resolveBundleVersion(): app.getVersion() → package.json fallback'],
  ['electron/remote/secrets.ts', 'tryLoadElectronSafeStorage(): safeStorage → plaintext fallback'],
])

interface ElectronResolve {
  /** Repo-relative, forward slashes. */
  importer: string
  kind: string
  specifier: string
}

interface ElectronViolation extends ElectronResolve {
  reason: string
}

function toRepoPath(file: string): string {
  return path.relative(PROJECT_ROOT, file).split(path.sep).join('/')
}

async function collectElectronResolves(config: ServerBundleEsbuildConfig, entryPoints = config.entryPoints) {
  const resolves: ElectronResolve[] = []
  const guard: Plugin = {
    name: 't0388-electron-free-guard',
    setup(b) {
      b.onResolve({ filter: /^electron(\/.*)?$/ }, args => {
        resolves.push({ importer: toRepoPath(args.importer), kind: args.kind, specifier: args.path })
        return { path: args.path, external: true }
      })
    },
  }
  const result = await build({
    absWorkingDir: PROJECT_ROOT, // metafile input keys become repo-relative
    entryPoints,
    bundle: true,
    platform: config.platform as 'node',
    target: config.target,
    format: config.format as 'cjs',
    write: false,
    outdir: path.join(os.tmpdir(), 't0388-electron-free-guard'),
    logLevel: 'silent',
    metafile: true,
    // `electron` is taken out of the externals only so the plugin sees it;
    // the plugin marks it external again.
    external: config.external.filter(name => name !== 'electron'),
    plugins: [guard],
  })
  return { resolves, inputs: Object.keys(result.metafile.inputs) }
}

function findElectronViolations(resolves: ElectronResolve[]): ElectronViolation[] {
  return resolves.flatMap(r => {
    if (!ALLOWED_LAZY_ELECTRON_IMPORTERS.has(r.importer)) {
      return [{ ...r, reason: 'importer is not an allowed lazy electron call site' }]
    }
    if (r.kind !== 'require-call') {
      return [{ ...r, reason: `allowed importer, but ${r.kind} is not a lazy require()` }]
    }
    return []
  })
}

function formatViolations(violations: ElectronViolation[]): string {
  return violations.map(v => `${v.importer}: ${v.kind} '${v.specifier}' — ${v.reason}`).join('\n')
}

const config = loadServerBundleEsbuildConfig()
const tempDirs: string[] = []

afterAll(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('server bundle config (parsed from scripts/build-server-bundle.mjs)', () => {
  it('parses the real entry points and externals', () => {
    expect(config.external).toContain('electron')
    expect(config.entryPoints.map(toRepoPath)).toContain('electron/remote/server-entry.ts')
    for (const entry of config.entryPoints) expect(fs.existsSync(entry), entry).toBe(true)
  })
})

describe('headless server bundle is electron-free', () => {
  it('reaches electron only through the allowed lazy require() call sites', { timeout: 30_000 }, async () => {
    const { resolves, inputs } = await collectElectronResolves(config)
    // Sanity: the graph really contains the headless entry and its handlers.
    expect(inputs).toContain('electron/remote/headless-entry.ts')
    expect(inputs).toContain('electron/remote/headless-handlers.ts')

    const violations = findElectronViolations(resolves)
    expect(violations, `electron reached from the headless bundle:\n${formatViolations(violations)}`).toEqual([])
  })

  it('allowed call sites are still guarded by try/catch', () => {
    for (const importer of ALLOWED_LAZY_ELECTRON_IMPORTERS.keys()) {
      const lines = fs.readFileSync(path.join(PROJECT_ROOT, importer), 'utf8').split(/\r?\n/)
      const sites = lines.flatMap((line, i) => (/require\(\s*['"]electron['"]\s*\)/.test(line) ? [i] : []))
      expect(sites.length, `${importer}: no require('electron') left — drop it from the allowlist`).toBeGreaterThan(0)
      for (const i of sites) {
        const preceding = lines.slice(Math.max(0, i - 3), i).filter(l => l.trim() !== '')
        expect(
          preceding.some(l => /\btry\s*\{\s*$/.test(l)),
          `${importer}:${i + 1} require('electron') is not directly inside a try block`,
        ).toBe(true)
      }
    }
  })

  it('flags a top-level electron import (negative self-check)', { timeout: 30_000 }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0388-electron-guard-'))
    tempDirs.push(dir)
    const fixture = path.join(dir, 'imports-electron.ts')
    fs.writeFileSync(fixture, "import { app } from 'electron'\nexport const userData = () => app.getPath('userData')\n")

    const { resolves } = await collectElectronResolves(config, [fixture])
    const violations = findElectronViolations(resolves)
    expect(violations).toHaveLength(1)
    expect(violations[0].kind).toBe('import-statement')
  })
})
