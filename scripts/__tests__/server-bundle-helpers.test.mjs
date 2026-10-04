// @vitest-environment node
//
// T0433 (PLAN-036 P3 / K): helpers shipped in the server bundle.
//
// build-server-bundle.mjs cannot run its copy step on Windows (schema-only builds stop at
// pruneAnthropicPackages, T0391), and it runs main() at load, so it cannot be imported.
// Instead:
//   - copy step: parse `serverBundleHelperScripts` from the script, copy exactly those
//     files into an isolated <root>/scripts (the staging layout) and run both helpers from
//     there — `--version` resolves every static import, so a missing helper fails with
//     ERR_MODULE_NOT_FOUND (shown by the negative case)
//   - verify-helper-bundle.js: green on the repo; red, with the reason, on fixture trees
//     whose list misses an import / bat-notify / a file, or whose build no longer copies
//   - _bat-logger.mjs: BAT_HELPER_LOG_DIR (absolute) moves the log; unset or relative keeps
//     the userData path (local BAT unchanged)

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const scriptsDir = join(repoRoot, 'scripts')
const buildScript = join(scriptsDir, 'build-server-bundle.mjs')
const verifyScript = join(scriptsDir, 'verify-helper-bundle.js')

const tmpRoots = []
function makeTmp(label) {
  const dir = mkdtempSync(join(tmpdir(), `t0433-${label}-`))
  tmpRoots.push(dir)
  return dir
}
afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true })
})

function parseHelperList(source) {
  const m = source.match(/const\s+serverBundleHelperScripts\s*=\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error('serverBundleHelperScripts not found in build-server-bundle.mjs')
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('BAT_')))

function runNode(args, opts = {}) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', env: cleanEnv(), timeout: 20_000, ...opts })
}

/** <root>/package.json + <root>/scripts/<listed helpers> — the staging layout. */
function stageHelpers(names) {
  const root = makeTmp('staging')
  mkdirSync(join(root, 'scripts'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'bat-server-fixture', version: '9.9.9' }))
  for (const name of names) copyFileSync(join(scriptsDir, name), join(root, 'scripts', name))
  return root
}

describe('server bundle helper copy (T0433)', () => {
  const listed = parseHelperList(readFileSync(buildScript, 'utf8'))

  it('lists the four helpers and copies them in copyServerSources()', () => {
    expect(listed).toEqual(['bat-terminal.mjs', 'bat-notify.mjs', '_bat-cert.mjs', '_bat-logger.mjs'])
    const source = readFileSync(buildScript, 'utf8')
    expect(source).toMatch(/async function copyServerSources\(\) \{[\s\S]*?\n {2}await copyHelperScripts\(\)\n\}/)
    expect(source).toMatch(/const helperScriptsDir = path\.join\(stagingRoot, 'scripts'\)/)
  })

  it('the listed set runs on its own: both helpers start from <root>/scripts', () => {
    const root = stageHelpers(listed)
    for (const helper of ['bat-terminal.mjs', 'bat-notify.mjs']) {
      const r = runNode([join(root, 'scripts', helper), '--version'])
      expect(r.stderr).toBe('')
      expect(r.status).toBe(0)
      expect(r.stdout.trim()).toBe(`${helper} v9.9.9`)
    }
  })

  it('negative control: without _bat-cert.mjs the copied helper dies with ERR_MODULE_NOT_FOUND', () => {
    const root = stageHelpers(listed.filter((n) => n !== '_bat-cert.mjs'))
    const r = runNode([join(root, 'scripts', 'bat-terminal.mjs'), '--version'])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/ERR_MODULE_NOT_FOUND/)
  })
})

describe('verify-helper-bundle.js server bundle check (T0433)', () => {
  // The real build script, in a fixture whose package.json has no platform baseline
  // entries (the T0316 dist-baseline check runs first and needs a fetched baseline).
  it('passes with the real build-server-bundle.mjs', () => {
    const r = fixture(readFileSync(buildScript, 'utf8'))
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/server bundle ships 4 helper\(s\) with a closed import set/)
  })

  const GOOD_LIST = "['bat-terminal.mjs', 'bat-notify.mjs', '_bat-cert.mjs', '_bat-logger.mjs']"
  const buildSource = (list, { copies = true } = {}) =>
    `const serverBundleHelperScripts = ${list}\nasync function main() {\n  await copyServerSources()\n}\nasync function copyServerSources() {\n${copies ? '  await copyHelperScripts()\n' : ''}}\n`

  /** Fixture project: package.json (extraResources scripts/*.mjs), the real helpers, a fake build script. */
  function fixture(buildScriptSource, { drop = [] } = {}) {
    const root = makeTmp('verify')
    mkdirSync(join(root, 'scripts'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ build: { extraResources: [{ from: 'scripts', to: 'scripts', filter: ['*.mjs'] }] } }))
    copyFileSync(verifyScript, join(root, 'scripts', 'verify-helper-bundle.js'))
    // _bat-server-helpers.mjs: imported by the real build script (extraResources import check)
    for (const name of ['bat-terminal.mjs', 'bat-notify.mjs', '_bat-cert.mjs', '_bat-logger.mjs', '_bat-server-helpers.mjs']) {
      if (!drop.includes(name)) copyFileSync(join(scriptsDir, name), join(root, 'scripts', name))
    }
    writeFileSync(join(root, 'scripts', 'build-server-bundle.mjs'), buildScriptSource)
    return runNode([join(root, 'scripts', 'verify-helper-bundle.js')], { cwd: root })
  }

  it('fixture sanity: the full list passes', () => {
    const r = fixture(buildSource(GOOD_LIST))
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })

  it('fails when a listed helper imports a file the list misses', () => {
    const r = fixture(buildSource("['bat-terminal.mjs', 'bat-notify.mjs', '_bat-logger.mjs']"))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/scripts\/bat-terminal\.mjs imports '\.\/_bat-cert\.mjs', but serverBundleHelperScripts does not list it/)
  })

  it('fails when bat-notify.mjs is not shipped', () => {
    const r = fixture(buildSource("['bat-terminal.mjs', '_bat-cert.mjs', '_bat-logger.mjs']"))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/serverBundleHelperScripts is missing bat-notify\.mjs/)
  })

  it('fails when a listed helper does not exist', () => {
    const r = fixture(buildSource(GOOD_LIST), { drop: ['_bat-logger.mjs'] })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/lists _bat-logger\.mjs, but scripts\/_bat-logger\.mjs does not exist/)
  })

  it('fails when the build no longer copies the helpers or the list is gone', () => {
    const noCopy = fixture(buildSource(GOOD_LIST, { copies: false }))
    expect(noCopy.status).toBe(1)
    expect(noCopy.stderr).toMatch(/no longer calls copyHelperScripts\(\)/)
    const noList = fixture('async function main() {}\n')
    expect(noList.status).toBe(1)
    expect(noList.stderr).toMatch(/`const serverBundleHelperScripts = \[\.\.\.\]` not found/)
  })
})

describe('_bat-logger.mjs BAT_HELPER_LOG_DIR (T0433)', () => {
  const loggerUrl = new URL('../_bat-logger.mjs', import.meta.url).href
  const probe = `import { getLogPaths, logEvent } from ${JSON.stringify(loggerUrl)}\n` +
    `logEvent('t0433-test', 'probe', { ok: true })\nprocess.stdout.write(JSON.stringify(getLogPaths()))\n`

  function runLogger(extraEnv) {
    const home = makeTmp('home')
    const env = { ...cleanEnv(), HOME: home, USERPROFILE: home, APPDATA: join(home, 'AppData'), XDG_CONFIG_HOME: join(home, '.config'), ...extraEnv }
    const r = runNode(['--input-type=module', '-e', probe], { env })
    expect(r.status).toBe(0)
    return { paths: JSON.parse(r.stdout), home }
  }

  it('an absolute BAT_HELPER_LOG_DIR receives bat-scripts.log', () => {
    const logDir = join(makeTmp('logs'), 'Logs')
    const { paths } = runLogger({ BAT_HELPER_LOG_DIR: logDir })
    expect(paths).toEqual({ dir: logDir, file: join(logDir, 'bat-scripts.log') })
    expect(readFileSync(join(logDir, 'bat-scripts.log'), 'utf8')).toContain('"script":"t0433-test"')
  })

  it('unset or relative keeps the userData path (local BAT unchanged)', () => {
    for (const extra of [{}, { BAT_HELPER_LOG_DIR: 'relative/logs' }]) {
      const { paths, home } = runLogger(extra)
      expect(paths.dir.startsWith(home)).toBe(true)
      expect(paths.dir).toMatch(/BetterAgentTerminal[\\/]Logs$/)
      expect(existsSync(paths.file)).toBe(true)
      expect(existsSync(join(repoRoot, 'relative'))).toBe(false)
    }
  })
})
