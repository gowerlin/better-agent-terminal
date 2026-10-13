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
//   - T0481 (BUG-119): _bat-cert.mjs / _bat-logger.mjs resolve userData from BAT_USER_DATA
//     (absolute) before the APP_NAME + BAT_RUNTIME guess; the explicit overrides
//     (BAT_SERVER_CERT_PATH / BAT_HELPER_LOG_DIR, headless) still win

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
    // \r?\n: a core.autocrlf=true checkout has CRLF sources (T0454).
    expect(source).toMatch(/async function copyServerSources\(\) \{[\s\S]*?\r?\n {2}await copyHelperScripts\(\)\r?\n\}/)
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

describe('helper userData resolution (T0481 / BUG-119)', () => {
  const certUrl = new URL('../_bat-cert.mjs', import.meta.url).href
  const loggerUrl = new URL('../_bat-logger.mjs', import.meta.url).href
  const probe = `import { loadTrustedFingerprint } from ${JSON.stringify(certUrl)}
` +
    `import { getLogPaths } from ${JSON.stringify(loggerUrl)}
` +
    `process.stdout.write(JSON.stringify({ cert: loadTrustedFingerprint(), log: getLogPaths() }))
`

  /** Where the legacy guess puts `<dirName>` for this platform, given runHelpers' env. */
  function legacyDir(home, dirName) {
    if (process.platform === 'win32') return join(home, 'AppData', dirName)
    if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', dirName)
    return join(home, '.config', dirName)
  }

  function writeCert(dir, fingerprint) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'server-cert.json'), JSON.stringify({ fingerprint }))
  }

  /** A home with the default instance's cert and runtime 3's cert at the legacy locations. */
  function makeHome() {
    const home = makeTmp('userdata-home')
    writeCert(legacyDir(home, 'BetterAgentTerminal'), 'DEFAULT')
    writeCert(legacyDir(home, 'BetterAgentTerminal-runtime-3'), 'LEGACY-RUNTIME-3')
    return home
  }

  function runHelpers(home, extraEnv) {
    const env = { ...cleanEnv(), HOME: home, USERPROFILE: home, APPDATA: join(home, 'AppData'), XDG_CONFIG_HOME: join(home, '.config'), ...extraEnv }
    const r = runNode(['--input-type=module', '-e', probe], { env })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    return JSON.parse(r.stdout)
  }

  it('--runtime=N (no BAT_RUNTIME): BAT_USER_DATA picks that instance, not the default one', () => {
    const home = makeHome()
    // The pre-T0480 runtime dir name: the guess could never find it.
    const userData = join(makeTmp('userdata'), 'better-agent-terminal-runtime-3')
    writeCert(userData, 'RUNTIME-3')
    const { cert, log } = runHelpers(home, { BAT_USER_DATA: userData })
    expect(cert).toEqual({ ok: true, fingerprint: 'RUNTIME-3', certPath: join(userData, 'server-cert.json') })
    expect(log).toEqual({ dir: join(userData, 'Logs'), file: join(userData, 'Logs', 'bat-scripts.log') })
  })

  it('BAT_RUNTIME only (BAT before T0481): the legacy APP_NAME + runtime guess', () => {
    const home = makeHome()
    const dir = legacyDir(home, 'BetterAgentTerminal-runtime-3')
    const { cert, log } = runHelpers(home, { BAT_RUNTIME: '3' })
    expect(cert).toEqual({ ok: true, fingerprint: 'LEGACY-RUNTIME-3', certPath: join(dir, 'server-cert.json') })
    expect(log.dir).toBe(join(dir, 'Logs'))
  })

  it('BAT_USER_DATA wins over BAT_RUNTIME; a relative BAT_USER_DATA is ignored', () => {
    const home = makeHome()
    const userData = makeTmp('userdata-abs')
    writeCert(userData, 'INJECTED')
    expect(runHelpers(home, { BAT_USER_DATA: userData, BAT_RUNTIME: '3' }).cert.fingerprint).toBe('INJECTED')
    const relative = runHelpers(home, { BAT_USER_DATA: 'relative/userdata' })
    expect(relative.cert.fingerprint).toBe('DEFAULT')
    expect(relative.log.dir).toBe(join(legacyDir(home, 'BetterAgentTerminal'), 'Logs'))
  })

  it('headless env: BAT_SERVER_CERT_PATH / BAT_HELPER_LOG_DIR still win over BAT_USER_DATA', () => {
    const home = makeHome()
    const dataDir = makeTmp('headless-data')
    writeCert(dataDir, 'HEADLESS')
    const userData = makeTmp('userdata-stray')
    writeCert(userData, 'STRAY')
    const { cert, log } = runHelpers(home, {
      BAT_SERVER_CERT_PATH: join(dataDir, 'server-cert.json'),
      BAT_HELPER_LOG_DIR: join(dataDir, 'Logs'),
      BAT_USER_DATA: userData,
    })
    expect(cert).toEqual({ ok: true, fingerprint: 'HEADLESS', certPath: join(dataDir, 'server-cert.json') })
    expect(log).toEqual({ dir: join(dataDir, 'Logs'), file: join(dataDir, 'Logs', 'bat-scripts.log') })
  })
})
