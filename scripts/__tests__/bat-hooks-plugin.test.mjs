// @vitest-environment node
/**
 * PLAN-068 W9 / T0910 (T0902 §7.3 / §7.6, R12): the `bat-hooks` Claude Code plugin and its marketplace.
 *
 * - `.claude-plugin/marketplace.json` (`better-agent-terminal`) lists `bat-hooks` at `./plugins/bat-hooks`
 * - `plugins/bat-hooks/hooks/hooks.json` = BAT's injected hook table (`BAT_CLAUDE_HOOKS`): same events,
 *   matchers, async, timeout; each command `node "${CLAUDE_PLUGIN_ROOT}/scripts/bat-hooks-launcher.mjs" <event>`
 *   (one string for bash and PowerShell); `PLUGIN_HOOK_LIST` = `BAT_HOOK_SET` while the lists match
 * - the launcher: runs only `<absolute BAT_HELPER_DIR>/bat-hook.mjs` that exists, only with
 *   BAT_REMOTE_PORT / BAT_REMOTE_TOKEN / BAT_TERMINAL_ID; passes `<event> --hook-list <n>` and stdin;
 *   exit 0 with no output in every case (T0590); a `BAT_HELPER_NODE` other than its own node runs it
 * - bat-hook.mjs `reportOrigin`: plugin → origin + set on every event; injected → on stop / session-start only
 * - 🔴 the plugin is not in the installer (`build.files` / `extraResources`)
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BAT_CLAUDE_HOOKS, BAT_HOOK_SET } from '../../electron/bat-mcp-launch'
import { HOOK_ORIGIN_INJECTED, HOOK_ORIGIN_PLUGIN, HOOK_EVENTS, reportOrigin } from '../bat-hook.mjs'
import { BAT_HOOK_SCRIPT, LAUNCHER_EVENTS, PLUGIN_HOOK_LIST, resolveLaunch } from '../../plugins/bat-hooks/scripts/bat-hooks-launcher.mjs'

const ROOT = resolve(__dirname, '..', '..')
const PLUGIN = join(ROOT, 'plugins', 'bat-hooks')
const LAUNCHER = join(PLUGIN, 'scripts', 'bat-hooks-launcher.mjs')
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const dirs = []
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })

function tempDir(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(d)
  return d
}

describe('marketplace + plugin manifest', () => {
  it('the marketplace is `better-agent-terminal` and lists bat-hooks at ./plugins/bat-hooks', () => {
    const market = readJson(join(ROOT, '.claude-plugin', 'marketplace.json'))
    expect(market.name).toBe('better-agent-terminal')
    expect(market.owner?.name).toBeTruthy()
    expect(market.plugins).toHaveLength(1)
    expect(market.plugins[0]).toMatchObject({ name: 'bat-hooks', source: './plugins/bat-hooks', version: '1.0.0' })
    const plugin = readJson(join(PLUGIN, '.claude-plugin', 'plugin.json'))
    expect(plugin).toMatchObject({ name: 'bat-hooks', version: '1.0.0' })
    // hooks come from the default hooks/hooks.json; no command / MCP server / agent of its own
    for (const key of ['hooks', 'mcpServers', 'commands', 'agents']) expect(plugin).not.toHaveProperty(key)
  })
})

describe('hooks.json mirrors BAT_CLAUDE_HOOKS', () => {
  const hooks = readJson(join(PLUGIN, 'hooks', 'hooks.json')).hooks

  it('same events, matchers, async; timeout 5; the launcher command', () => {
    const flat = []
    for (const [hookEvent, entries] of Object.entries(hooks)) {
      for (const entry of entries) {
        expect(entry.hooks).toHaveLength(1)
        const h = entry.hooks[0]
        expect(h.type).toBe('command')
        expect(h.timeout).toBe(5)
        const m = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/bat-hooks-launcher\.mjs" ([a-z-]+)$/.exec(h.command)
        expect(m, h.command).not.toBeNull()
        flat.push({ hookEvent, ...(entry.matcher ? { matcher: entry.matcher } : {}), event: m[1], ...(h.async ? { async: true } : {}) })
      }
    }
    // same set (JSON keys group a repeated hook event, e.g. the two Notification entries)
    const key = (h) => JSON.stringify([h.hookEvent, h.matcher ?? '', h.event, h.async === true])
    expect(flat.map(key).sort()).toEqual(BAT_CLAUDE_HOOKS.map(key).sort())
  })

  it('every event is one the launcher and bat-hook.mjs know; the list version equals BAT_HOOK_SET', () => {
    for (const h of BAT_CLAUDE_HOOKS) {
      expect(LAUNCHER_EVENTS).toContain(h.event)
      expect(HOOK_EVENTS).toContain(h.event)
    }
    expect([...LAUNCHER_EVENTS].sort()).toEqual([...HOOK_EVENTS].sort())
    // raise PLUGIN_HOOK_LIST (and the plugin version) together with BAT_HOOK_SET when the table changes
    expect(PLUGIN_HOOK_LIST).toBe(BAT_HOOK_SET)
  })
})

describe('🔴 the plugin is not in the installer', () => {
  it('build.files / extraResources / asarUnpack never name plugins/ or .claude-plugin', () => {
    const build = readJson(join(ROOT, 'package.json')).build
    const text = JSON.stringify({ files: build.files, extraResources: build.extraResources, asarUnpack: build.asarUnpack, win: build.win, mac: build.mac, linux: build.linux })
    expect(text).not.toMatch(/plugins\/bat-hooks|\.claude-plugin|bat-hooks-launcher/)
  })
})

describe('bat-hook.mjs reportOrigin (T0910)', () => {
  it('plugin: origin + set on every event; a bad --hook-list → plugin without set', () => {
    for (const event of HOOK_EVENTS) expect(reportOrigin(event, ['--hook-list', '2'])).toEqual({ origin: HOOK_ORIGIN_PLUGIN, set: 2 })
    for (const bad of ['0', '-1', 'two', '1001', '', '1.5', undefined]) {
      expect(reportOrigin('stop', bad === undefined ? ['--hook-list'] : ['--hook-list', bad])).toEqual({ origin: HOOK_ORIGIN_PLUGIN })
    }
  })

  it('injected: stop / session-start carry origin + BAT_HOOK_SET; 🔴 every other event sends neither (as before)', () => {
    expect(reportOrigin('stop')).toEqual({ origin: HOOK_ORIGIN_INJECTED, set: BAT_HOOK_SET })
    expect(reportOrigin('session-start', [])).toEqual({ origin: HOOK_ORIGIN_INJECTED, set: BAT_HOOK_SET })
    for (const event of HOOK_EVENTS.filter(e => e !== 'stop' && e !== 'session-start')) expect(reportOrigin(event, [])).toEqual({})
  })
})

describe('launcher resolveLaunch', () => {
  const helperDir = tempDir('t0910-helper-')
  writeFileSync(join(helperDir, BAT_HOOK_SCRIPT), '// stub\n')
  const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'batcap.x', BAT_TERMINAL_ID: 't1', BAT_HELPER_DIR: helperDir }

  it('inside a BAT tab: this BAT’s bat-hook.mjs with --hook-list', () => {
    expect(resolveLaunch('stop', env)).toEqual({ script: join(helperDir, 'bat-hook.mjs'), args: ['stop', '--hook-list', String(PLUGIN_HOOK_LIST)] })
  })

  it('null (exit 0, nothing run): any BAT_* missing, a relative / missing / NUL dir, no script, an unknown event', () => {
    for (const name of ['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_TERMINAL_ID', 'BAT_HELPER_DIR']) {
      const e = { ...env }
      delete e[name]
      expect(resolveLaunch('stop', e)).toBeNull()
    }
    expect(resolveLaunch('stop', { ...env, BAT_HELPER_DIR: 'scripts' })).toBeNull()
    expect(resolveLaunch('stop', { ...env, BAT_HELPER_DIR: join(helperDir, 'nope') })).toBeNull()
    expect(resolveLaunch('stop', { ...env, BAT_HELPER_DIR: `${helperDir}\0x` })).toBeNull()
    expect(resolveLaunch('stop', { ...env, BAT_HELPER_DIR: tmpdir() })).toBeNull()
    expect(resolveLaunch('rm-rf', env)).toBeNull()
    expect(resolveLaunch(undefined, env)).toBeNull()
  })

  it('BAT_HELPER_NODE: used when absolute, present and not this node; otherwise ignored', () => {
    const otherNode = join(helperDir, 'node-stub')
    writeFileSync(otherNode, '')
    expect(resolveLaunch('stop', { ...env, BAT_HELPER_NODE: otherNode }, '/usr/bin/node')).toMatchObject({ node: otherNode })
    expect(resolveLaunch('stop', { ...env, BAT_HELPER_NODE: process.execPath }, process.execPath)).not.toHaveProperty('node')
    expect(resolveLaunch('stop', { ...env, BAT_HELPER_NODE: 'node' })).not.toHaveProperty('node')
    expect(resolveLaunch('stop', { ...env, BAT_HELPER_NODE: join(helperDir, 'missing-node') })).not.toHaveProperty('node')
  })
})

function runLauncher(args, env, stdin = '') {
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('BAT_')))
  return new Promise((done) => {
    const started = Date.now()
    const child = spawn(process.execPath, [LAUNCHER, ...args], { env: { ...base, ...env }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('exit', (code) => done({ code, stdout, stderr, ms: Date.now() - started }))
    child.stdin.on('error', () => {})
    child.stdin.end(stdin)
  })
}

describe('launcher process (T0590 rules)', { timeout: 30_000 }, () => {
  const helperDir = tempDir('t0910-run-')
  const out = join(helperDir, 'out.json')
  // a stub bat-hook.mjs: records what it got, prints on stdout / stderr (must not reach claude), exits 0
  writeFileSync(join(helperDir, BAT_HOOK_SCRIPT), [
    "import { readFileSync, writeFileSync } from 'node:fs'",
    "let stdin = ''",
    "try { stdin = readFileSync(0, 'utf8') } catch {}",
    `writeFileSync(${JSON.stringify(out)}, JSON.stringify({ argv: process.argv.slice(2), stdin }))`,
    "process.exit(0)",
  ].join('\n'))
  const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'batcap.x', BAT_TERMINAL_ID: 't1', BAT_HELPER_DIR: helperDir }

  it('runs the BAT hook with <event> --hook-list <n> and the hook JSON on stdin; exit 0, no output', async () => {
    const run = await runLauncher(['user-prompt-submit'], env, '{"hook_event_name":"UserPromptSubmit"}')
    expect(run).toMatchObject({ code: 0, stdout: '', stderr: '' })
    expect(readJson(out)).toEqual({ argv: ['user-prompt-submit', '--hook-list', String(PLUGIN_HOOK_LIST)], stdin: '{"hook_event_name":"UserPromptSubmit"}' })
  })

  it('outside BAT, a bad dir or event: exit 0 at once, nothing run, no output', async () => {
    rmSync(out, { force: true })
    for (const [args, e] of [[['stop'], {}], [['stop'], { ...env, BAT_REMOTE_TOKEN: '' }], [['stop'], { ...env, BAT_HELPER_DIR: 'rel' }], [['bogus'], env], [[], env]]) {
      const run = await runLauncher(args, e)
      expect(run).toMatchObject({ code: 0, stdout: '', stderr: '' })
      expect(run.ms).toBeLessThan(2_500)
    }
    expect(() => readFileSync(out)).toThrow()
  })

  it('a throwing / hanging hook script still ends with exit 0 and no output', async () => {
    const bad = tempDir('t0910-bad-')
    mkdirSync(bad, { recursive: true })
    writeFileSync(join(bad, BAT_HOOK_SCRIPT), "throw new Error('boom')\n")
    expect(await runLauncher(['stop'], { ...env, BAT_HELPER_DIR: bad })).toMatchObject({ code: 0, stdout: '', stderr: '' })
    writeFileSync(join(bad, BAT_HOOK_SCRIPT), 'setInterval(() => {}, 1000)\n')
    const hang = await runLauncher(['stop'], { ...env, BAT_HELPER_DIR: bad })
    expect(hang).toMatchObject({ code: 0, stdout: '', stderr: '' })
    expect(hang.ms).toBeLessThan(5_000)
  })
})
