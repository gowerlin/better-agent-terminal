// @vitest-environment node
// T0414 — scripts/remote-tools-install-check.mjs (PLAN-037 G install acceptance tool)

import { describe, expect, it } from 'vitest'

import * as recipes from '../../src/lib/remote-tools/recipes'
import * as sentinel from '../../src/lib/remote-tools/sentinel'
import * as types from '../../src/types/remote-tools'
import {
  CODEX_LOGIN_STATUS_EXPR,
  DEFAULT_TOOLS,
  ENV_PROBE_EXPR,
  INSTALL_SHELL,
  PTY_ID_PREFIX,
  SHELL_CHECK_EXPR,
  buildProbeLine,
  decodeProbePayload,
  diffProfileSnapshots,
  main,
  parseArgs,
  parseProfileSnapshot,
  probeRegex,
  profileTailExpr,
  runCheck,
} from '../remote-tools-install-check.mjs'

const modules = { recipes, sentinel, types }
const WSL = ['--target', 'wsl:Ubuntu-24.04']
const CONN = { label: 'wsl:test', url: 'wss://127.0.0.1:1', token: 'x', fingerprint: 'AA', cwd: '/home/u' }

function report(overrides = {}) {
  return {
    schemaVersion: 1,
    env: { osFamily: 'linux', osId: 'ubuntu', osVersion: '24.04', arch: 'x86_64', musl: false, pkgManager: 'apt', privilege: 'passwordless', isWsl: true, hasTimeout: true, authEnv: {} },
    tools: types.REMOTE_TOOL_IDS.map((id) => ({ id, status: 'missing', serverVisible: false, ...(overrides[id] ?? {}) })),
    serverViewAvailable: true,
    warnings: [],
  }
}

/**
 * Fake remote: answers probe lines with a base64 payload and the install sentinel with
 * `exitCode`. Records every invoke.
 */
function fakeClient({ exitCode = 0, payloads = {}, afterTools = {} } = {}) {
  const calls = []
  const listeners = new Set()
  const alive = new Set()
  let detects = 0
  const emit = (channel, args) => setTimeout(() => { for (const l of listeners) l(channel, args) }, 0)
  const client = {
    calls,
    onEvent(l) { listeners.add(l); return () => listeners.delete(l) },
    async connect() { return {} },
    async close() {},
    async invoke(channel, ...args) { return this.invokeWithTimeout(0, channel, ...args) },
    async invokeWithTimeout(_ms, channel, ...args) {
      calls.push({ channel, args })
      if (channel === 'remote-tools:detect') {
        detects += 1
        return { ok: true, report: report(detects > 1 ? afterTools : {}) }
      }
      if (channel === 'pty:create') {
        alive.add(args[0].id)
        emit('pty:output', [args[0].id, 'u@host:~$ '])
        return { ok: true, created: true }
      }
      if (channel === 'pty:kill') {
        alive.delete(args[0])
        emit('pty:exit', [args[0], 0])
        return true
      }
      if (channel === 'pty:write') {
        const [id, data] = args
        if (!alive.has(id)) return { ok: false, reason: 'pty-not-found' }
        const probe = /^printf '\\n__T0414_%s_%s__%s__END__\\n' '([0-9a-f]{16})' '([a-z0-9-]+)'/.exec(data)
        if (probe) {
          const b64 = Buffer.from(payloads[probe[2]] ?? '').toString('base64')
          emit('pty:output', [id, `${data}\r\n\x1b[0m\r\n__T0414_${probe[1]}_${probe[2]}__${b64}__END__\r\n`])
        }
        const done = /'([0-9a-f]{16})' "\$\?"\r$/.exec(data)
        if (done) emit('pty:output', [id, `installing…\r\n\r\n__BAT_TOOL_DONE_${done[1]}_${exitCode}__\r\n`])
        return { ok: true }
      }
      throw new Error(`unexpected channel ${channel}`)
    },
  }
  return client
}

describe('parseArgs', () => {
  it('defaults to a dry-run install of every acceptance tool', () => {
    const opts = parseArgs(WSL, { knownTools: types.REMOTE_TOOL_IDS })
    expect(opts).toMatchObject({ yes: false, kind: 'install', tools: [...DEFAULT_TOOLS], shellCheck: false })
    expect(opts.target).toMatchObject({ kind: 'wsl', distro: 'Ubuntu-24.04', host: '127.0.0.1', port: null })
  })

  it('takes repeated --tool in order, deduplicated', () => {
    const opts = parseArgs([...WSL, '--tool', 'gh', '--tool', 'claude', '--tool', 'gh', '--yes'], { knownTools: types.REMOTE_TOOL_IDS })
    expect(opts.tools).toEqual(['gh', 'claude'])
    expect(opts.yes).toBe(true)
  })

  it.each([
    [['--tool', 'Claude']],
    [['--tool', 'claude;rm']],
    [['--tool', '__proto__']],
    [['--tool', 'docker']],
    [['--kind', 'remove']],
    [['--install-timeout-ms', '10']],
    [['--cwd', 'relative']],
    [['--cwd', '/home/../etc']],
    [['--port', '0']],
    [['--token-file', 'x']],
    [['--bogus']],
  ])('rejects %j', (extra) => {
    expect(() => parseArgs([...WSL, ...extra], { knownTools: types.REMOTE_TOOL_IDS })).toThrow()
  })

  it('needs exactly one target', () => {
    expect(() => parseArgs([])).toThrow(/exactly one/)
    expect(() => parseArgs([...WSL, '--url', 'wss://h:1'])).toThrow(/exactly one/)
  })

  it('--shell-check alone runs no tool step; --kind update is accepted', () => {
    expect(parseArgs([...WSL, '--shell-check']).tools).toEqual([])
    expect(parseArgs([...WSL, '--kind', 'update', '--tool', 'claude']).kind).toBe('update')
  })
})

describe('probe lines', () => {
  it('only the executed printf can match (the echo carries the format string)', () => {
    const nonce = '0123456789abcdef'
    const line = buildProbeLine(nonce, 'env', ENV_PROBE_EXPR)
    expect(probeRegex(nonce, 'env').test(line)).toBe(false)
    expect(probeRegex(nonce, 'env').exec(`__T0414_${nonce}_env__${Buffer.from('DISABLE_AUTOUPDATER=1').toString('base64')}__END__`)[1])
      .toBe(Buffer.from('DISABLE_AUTOUPDATER=1').toString('base64'))
    expect(decodeProbePayload(Buffer.from('a\nb').toString('base64'))).toBe('a\nb')
  })

  it('rejects malformed nonce / label', () => {
    expect(() => buildProbeLine('xyz', 'env', 'true')).toThrow()
    expect(() => buildProbeLine('0123456789abcdef', 'bad label', 'true')).toThrow()
  })

  it('diagnostics never dump the whole environment or read credentials', () => {
    for (const expr of [ENV_PROBE_EXPR, SHELL_CHECK_EXPR, CODEX_LOGIN_STATUS_EXPR]) {
      expect(expr).not.toMatch(/\benv\s*(;|$|\|\s*base64)/)
      expect(expr).not.toMatch(/credentials|auth\.json|hosts\.yml|TOKEN|printenv/)
    }
    expect(ENV_PROBE_EXPR).toMatch(/grep -E '\^DISABLE_\(UPDATES\|AUTOUPDATER\)='/)
    expect(CODEX_LOGIN_STATUS_EXPR).toMatch(/codex login status >\/dev\/null 2>&1/)
  })

  it('profile tails only for known files and integer lines', () => {
    expect(profileTailExpr('.bashrc', 117)).toBe('tail -n +118 "$HOME/.bashrc"')
    expect(() => profileTailExpr('../etc/passwd', 0)).toThrow()
    expect(() => profileTailExpr('.bashrc', -1)).toThrow()
  })
})

describe('profile snapshots', () => {
  it('reports created / modified / removed files with the old line count', () => {
    const before = parseProfileSnapshot('.profile|111|27\n.bashrc|222|117\n.zshrc|333|5\n')
    const after = parseProfileSnapshot('.profile|111|27\n.bashrc|999|121\n.zprofile|444|  3\n')
    expect(diffProfileSnapshots(before, after)).toEqual([
      { file: '.bashrc', kind: 'modified', fromLine: 117, linesBefore: 117, linesAfter: 121 },
      { file: '.zprofile', kind: 'created', fromLine: 0, linesBefore: 0, linesAfter: 3 },
      { file: '.zshrc', kind: 'removed', fromLine: 0, linesBefore: 5, linesAfter: 0 },
    ])
  })
})

describe('runCheck', () => {
  it('dry-run only detects: no pty:create, no pty:write', async () => {
    const client = fakeClient()
    const result = await runCheck(CONN, { yes: false, kind: 'install', tools: [...DEFAULT_TOOLS], stepTimeoutMs: 1000 }, { modules, createClient: () => client, launchDelayMs: 0 })
    expect(client.calls.map((c) => c.channel)).toEqual(['remote-tools:detect'])
    expect(result.ok).toBe(true)
    expect(result.mode).toBe('dry-run')
    const env = recipes.normalizeRecipeEnv(report().env)
    for (const step of result.steps) {
      expect(step.plan.command).toBe(recipes.buildInstallPlan(step.toolId, env).command)
      expect(step.run).toBeUndefined()
    }
  })

  it('--yes types exactly wrapWithSentinel(plan.command) into a bash PTY without agentPreset, then re-detects and kills', async () => {
    const client = fakeClient({
      payloads: { env: 'DISABLE_AUTOUPDATER=1\n', profiles: '.profile|1|27\n.bashrc|2|117\n' },
      afterTools: { uv: { status: 'ok', path: '/home/u/.local/bin/uv', version: '0.9.0' } },
    })
    const result = await runCheck(CONN, { yes: true, kind: 'install', tools: ['uv'], installTimeoutMs: 2000, stepTimeoutMs: 1000 }, { modules, createClient: () => client, launchDelayMs: 0 })
    expect(result.error).toBeUndefined()
    const create = client.calls.find((c) => c.channel === 'pty:create')
    expect(create.args[0]).toEqual({ id: expect.stringMatching(new RegExp(`^${PTY_ID_PREFIX}\\d{14}-[0-9a-f]{6}-uv$`)), cwd: '/home/u', type: 'terminal', shell: INSTALL_SHELL })
    expect(create.args[0]).not.toHaveProperty('agentPreset')

    const step = result.steps[0]
    const plan = recipes.buildInstallPlan('uv', recipes.normalizeRecipeEnv(report().env))
    const nonce = /'([0-9a-f]{16})' "\$\?"$/.exec(step.run.typed)[1]
    expect(step.run.typed).toBe(sentinel.wrapWithSentinel(plan.command, nonce))
    expect(client.calls.some((c) => c.channel === 'pty:write' && c.args[1] === `${step.run.typed}\r`)).toBe(true)
    expect(step.run).toMatchObject({ exitCode: 0, timedOut: false, env: ['DISABLE_AUTOUPDATER=1'], profileChanges: [] })
    expect(step.before).toEqual({ status: 'missing', serverVisible: false })
    expect(step.after).toEqual({ status: 'ok', path: '/home/u/.local/bin/uv', version: '0.9.0', serverVisible: false })
    expect(client.calls.filter((c) => c.channel === 'pty:kill').map((c) => c.args[0])).toEqual([create.args[0].id])
    expect(result.leftovers).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('a non-zero exit fails the run but still re-detects and kills', async () => {
    const client = fakeClient({ exitCode: 100, payloads: { env: '', profiles: '' } })
    const result = await runCheck(CONN, { yes: true, kind: 'install', tools: ['rg'], installTimeoutMs: 2000, stepTimeoutMs: 1000 }, { modules, createClient: () => client, launchDelayMs: 0 })
    expect(result.steps[0].run.exitCode).toBe(100)
    expect(result.steps[0].after).toEqual({ status: 'missing', serverVisible: false })
    expect(client.calls.filter((c) => c.channel === 'pty:kill')).toHaveLength(1)
    expect(result.ok).toBe(false)
  })

  it('unsupported plans are recorded without opening a PTY', async () => {
    const client = fakeClient()
    const result = await runCheck(CONN, { yes: true, kind: 'update', tools: ['codex'], stepTimeoutMs: 1000 }, { modules, createClient: () => client, launchDelayMs: 0 })
    expect(result.steps[0].unsupported).toBe('no-recipe')
    expect(client.calls.some((c) => c.channel === 'pty:create')).toBe(false)
  })
})

describe('main', () => {
  it('bad arguments exit 2 before connecting', async () => {
    const out = []
    const code = await main(['--tool', 'claude'], { out: (s) => out.push(s), err: (s) => out.push(s) }, { modules })
    expect(code).toBe(2)
  })

  it('dry-run through main prints the plans and exits 0', async () => {
    const out = []
    const client = fakeClient()
    const code = await main([...WSL, '--tool', 'claude'], { out: (s) => out.push(s), err: (s) => out.push(s) }, { modules, conn: CONN, createClient: () => client })
    expect(code).toBe(0)
    expect(out.join('\n')).toContain('DRY-RUN install [claude]')
    expect(out.join('\n')).toContain('curl -fsSL https://claude.ai/install.sh | bash -s stable')
    expect(client.calls.map((c) => c.channel)).toEqual(['remote-tools:detect'])
  })
})
