// @vitest-environment node
//
// T0808 / BUG-208: tests that run a helper (bat-terminal / bat-notify / bat-mcp / bat-hook) must
// point its NDJSON log at a temp dir (BAT_HELPER_LOG_DIR / BAT_USER_DATA). Every helper run is
// logged, `--help` / `--version` included; without those two variables the helper falls back to
// the legacy userData guess and appends to the user's real bat-scripts.log (CLAUDE.md
// 「遠端 Tower 通知（PLAN-036 K）」). Before T0808 four runs did (T0806 measured 10 lines).
//
//   - runtime: runHelper() with an empty env (the `--help` case) logs into helperLogDir(), and
//     nothing reaches a fake home standing in for %APPDATA% / ~/.config / ~/Library
//   - source guard: every vitest-collected test file that spawns a helper names a temp log dir
//     (BAT_HELPER_LOG_DIR or helperLogEnv) or goes through runHelper(); a test file with its own
//     `run(args, env)` never passes an empty env literal
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { cleanupHelperLogDir, helperLogDir } from './_helper-test-env.mjs'
import { cleanupTempDirs, repoRoot, runHelper } from './_question-mock-remote.mjs'

const fakeHomes = []
afterAll(() => {
  cleanupTempDirs()
  cleanupHelperLogDir()
  for (const dir of fakeHomes) rmSync(dir, { recursive: true, force: true })
})

/** Every file under `dir` (recursive), as absolute paths. */
function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    return e.isDirectory() ? walk(full) : [full]
  })
}

describe('helper runs in tests log to a temp dir (T0808 / BUG-208)', () => {
  it('runHelper() with an empty env: the log lands in helperLogDir(), not under the home dirs', async () => {
    const home = mkdtempSync(join(tmpdir(), 'bat-t0808-home-'))
    fakeHomes.push(home)
    const keys = ['APPDATA', 'HOME', 'USERPROFILE', 'XDG_CONFIG_HOME']
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
    let runs
    try {
      process.env.APPDATA = join(home, 'AppData')
      process.env.HOME = home
      process.env.USERPROFILE = home
      process.env.XDG_CONFIG_HOME = join(home, '.config')
      runs = await Promise.all([
        runHelper('bat-terminal.mjs', ['--help'], {}),
        runHelper('bat-notify.mjs', ['--help'], {}),
      ])
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k]
        else process.env[k] = saved[k]
      }
    }
    for (const r of runs) expect(r.code).toBe(0)
    expect(walk(home).filter((f) => f.endsWith('bat-scripts.log'))).toEqual([])
    const events = readFileSync(join(helperLogDir(), 'Logs', 'bat-scripts.log'), 'utf8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l))
    expect(events.filter((e) => e.event === 'invoke').map((e) => e.script).sort()).toEqual(['bat-notify', 'bat-terminal'])
  }, 30000)

  // vitest-collected test files (vite.config.ts test.include) that may run a helper; tests/ only
  // at the top level (tests/e2e is Playwright).
  const SCANNED_DIRS = ['scripts/__tests__', 'electron/__tests__', 'electron/remote/__tests__', 'electron/remote-tools/__tests__']
  const HELPER = /\bbat-(?:terminal|notify|mcp|hook)\.mjs\b/
  // `spawn(process.execPath, [<first element>` — the script node runs. A quoted first element is
  // a flag (`-e`, `--input-type=module`): an inline probe, not a helper run.
  const NODE_SPAWN = /\b(?:spawn|spawnSync|execFile|execFileSync|fork)\(\s*process\.execPath\s*,\s*\[\s*([^,\]]+)/g
  // Helpers run inside a headless server's PTY (DRIVER_SOURCE): the PTY env carries the
  // server's BAT_HELPER_LOG_DIR (<dataDir>/Logs, buildHeadlessHelperEnv), a temp dir in tests.
  const PTY_ENV_RUNS = new Set([
    'electron/remote/__tests__/headless-blocked-state-e2e.test.ts',
    'electron/remote/__tests__/headless-close-worker-e2e.test.ts',
    'electron/remote/__tests__/headless-set-role-e2e.test.ts',
  ])

  /** Does node run a helper here: the first element names one, or is a variable declared as a helper path? */
  function runsHelper(source) {
    for (const m of source.matchAll(NODE_SPAWN)) {
      const first = m[1].trim()
      if (/^['"`]/.test(first)) continue
      if (HELPER.test(first) || /BAT_HELPER_DIR|REPO_SCRIPTS/.test(first)) return true
      if (!/^[A-Za-z_$][\w$]*$/.test(first)) continue
      const decl = new RegExp(`(?:const|let|var)\\s+${first.replace(/\$/g, '\\$')}\\b[^=\\n]*=([^\\n]*)`, 'g')
      for (const d of source.matchAll(decl)) if (HELPER.test(d[1])) return true
    }
    return false
  }

  function helperTestFiles() {
    const top = readdirSync(join(repoRoot, 'tests')).filter((n) => /\.test\.mjs$/.test(n)).map((n) => join(repoRoot, 'tests', n))
    return SCANNED_DIRS.flatMap((d) => walk(join(repoRoot, d))).concat(top)
      .filter((f) => /\.test\.(?:mjs|ts|tsx)$/.test(f))
      .map((f) => ({ rel: relative(repoRoot, f).replace(/\\/g, '/'), source: readFileSync(f, 'utf8') }))
      .filter(({ rel, source }) => rel !== 'scripts/__tests__/helper-test-log-dir.test.mjs' && runsHelper(source))
  }

  it('the scan finds the known helper tests (a broken scan would pass everything)', () => {
    const found = helperTestFiles().map((f) => f.rel)
    for (const known of [
      'scripts/__tests__/bat-mcp.test.mjs',
      'tests/bat-terminal-msys.test.mjs',
      'tests/bat-notify-submit.test.mjs',
      'electron/__tests__/terminal-blocked-state.test.ts',
      'electron/__tests__/bat-terminal-wait-started.test.ts',
      ...PTY_ENV_RUNS,
    ]) expect(found, known).toContain(known)
  })

  it('every test file that spawns a helper sets a temp log dir', () => {
    const missing = helperTestFiles()
      .filter(({ rel, source }) => !PTY_ENV_RUNS.has(rel) && !/BAT_HELPER_LOG_DIR|helperLogEnv\(/.test(source))
      .map((f) => f.rel)
    expect(missing).toEqual([])
  })

  it('a test file with its own run(args, env) never passes an empty env (the --help leak)', () => {
    const offenders = []
    for (const { rel, source } of helperTestFiles()) {
      if (!/function run\s*\([^)]*\benv\b/.test(source)) continue
      for (const m of source.matchAll(/\brun\(\s*\[[^\]]*\]\s*,\s*\{\s*\}\s*\)/g)) offenders.push(`${rel}: ${m[0]}`)
    }
    expect(offenders).toEqual([])
  })

  it('the shared runners add the temp log dir under the caller\'s env', () => {
    const mock = readFileSync(join(repoRoot, 'scripts/__tests__/_question-mock-remote.mjs'), 'utf8')
    expect(mock).toMatch(/env: \{ \.\.\.childEnv, \.\.\.helperLogEnv\(\), \.\.\.env \}/)
    const bundle = readFileSync(join(repoRoot, 'scripts/__tests__/server-bundle-helpers.test.mjs'), 'utf8')
    expect(bundle).toMatch(/env: \{ \.\.\.cleanEnv\(\), \.\.\.helperLogEnv\(\) \}/)
  })
})
