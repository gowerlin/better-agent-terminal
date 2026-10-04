// @vitest-environment node
/**
 * T0408 (PLAN-037 A): guards for the fixed probe scripts, login-shell
 * selection, invocation assembly and the injectable runner.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFile } from 'child_process'
import { build, type Plugin } from 'esbuild'
import { describe, expect, it, vi } from 'vitest'
import {
  LOGIN_PROBE_REEXEC,
  LOGIN_PROBE_SCRIPT,
  LOGIN_PROBE_TIMEOUT_MS,
  LOGIN_SHELL_FALLBACK,
  PROBE_BEGIN_MARKER,
  PROBE_END_MARKER,
  SERVER_PROBE_SCRIPT,
  SERVER_PROBE_TIMEOUT_MS,
  buildLoginProbeInvocation,
  buildServerProbeInvocation,
  runProbe,
  selectLoginShell,
  type ProbeExecFile,
} from '../probe-script'
import { detectRemoteTools, parseRemoteToolsReport } from '../parse'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const NEW_FILES = ['electron/remote-tools/probe-script.ts', 'electron/remote-tools/parse.ts', 'src/types/remote-tools.ts']
const SCRIPTS: ReadonlyArray<[string, string]> = [
  ['LOGIN_PROBE_SCRIPT', LOGIN_PROBE_SCRIPT],
  ['SERVER_PROBE_SCRIPT', SERVER_PROBE_SCRIPT],
]

function scriptLines(script: string): string[] {
  return script.split('\n')
}

describe('probe scripts: security guards (T0407 §6)', () => {
  it.each(SCRIPTS)('%s never asks for a token', (_name, script) => {
    expect(script).not.toContain('gh auth token')
    expect(script).not.toContain('auth token')
    expect(script).not.toContain('--show-token')
    expect(script).not.toMatch(/\btoken\b(?!=)/i)
  })

  it('probe-script.ts has no template literals (no ${...} splicing into the scripts)', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'electron/remote-tools/probe-script.ts'), 'utf8')
    const code = src.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l))
    expect(code.length).toBeGreaterThan(50)
    expect(code.filter(l => l.includes('`'))).toEqual([])
  })

  it('the scripts are fixed strings: identical on every import and no placeholder syntax', async () => {
    vi.resetModules()
    const again = await import('../probe-script')
    expect(again.LOGIN_PROBE_SCRIPT).toBe(LOGIN_PROBE_SCRIPT)
    expect(again.SERVER_PROBE_SCRIPT).toBe(SERVER_PROBE_SCRIPT)
    for (const [, script] of SCRIPTS) {
      expect(script).not.toMatch(/\{\{|%\(|<%/)
      expect(script).not.toContain('undefined')
      expect(script).not.toContain('[object ')
    }
  })

  it.each(SCRIPTS)('%s only expands a fixed set of shell variables', (_name, script) => {
    // Every ${...} must be a known env var with a default, never a value supplied from outside.
    const braced = [...script.matchAll(/\$\{([^}]*)\}/g)].map(m => m[1].split(':-')[0])
    const allowed = new Set(['WSL_DISTRO_NAME', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GH_CONFIG_DIR', 'XDG_CONFIG_HOME'])
    for (const name of braced) expect(allowed, name).toContain(name)
    // Command substitution is limited to probe-local commands.
    const substitutions = [...script.matchAll(/\$\(([^)]*)\)?/g)].map(m => m[1].trim().split(/\s+/)[0])
    for (const cmd of substitutions) expect(['command', 'uname', 'sed', 'sw_vers', 'id', 'bat_run'], cmd).toContain(cmd)
  })

  it('auth env vars are tested for presence only, never printed', () => {
    for (const line of scriptLines(LOGIN_PROBE_SCRIPT).filter(l => /(API_KEY|OAUTH_TOKEN|GH_TOKEN|GITHUB_TOKEN)\b/.test(l))) {
      expect(line).toMatch(/^if \[ -n "\$\{[A-Z_]+:-\}" \]; then bat_emit env\.auth\.[A-Z_]+ 1; else bat_emit env\.auth\.[A-Z_]+ 0; fi$/)
    }
  })

  it('credential files are only checked with [ -e ], never read', () => {
    const credLines = scriptLines(LOGIN_PROBE_SCRIPT).filter(l => /credentials\.json|auth\.json|hosts\.yml/.test(l))
    expect(credLines).toHaveLength(3)
    for (const line of credLines) expect(line).toMatch(/^if \[ -e "[^"]+" \]; then bat_emit tool\.(claude|codex|gh)\.cred 1; else bat_emit tool\.(claude|codex|gh)\.cred 0; fi$/)
    for (const [, script] of SCRIPTS) {
      expect(script).not.toMatch(/\bcat\b|\bsource\b|^\s*\.\s/m)
    }
  })

  it('login checks keep only the exit code', () => {
    const lines = scriptLines(LOGIN_PROBE_SCRIPT)
    const loginFn = lines.findIndex(l => l.startsWith('bat_login() {'))
    expect(lines[loginFn + 1].trim()).toBe('bat_run 8 "$@" >/dev/null 2>&1 </dev/null')
    expect(lines[loginFn + 2].trim()).toBe('bat_emit "tool.$bat_name.login" "$?"')
    const statusCalls = lines.filter(l => /auth status|login status/.test(l))
    expect(statusCalls).toHaveLength(3)
    for (const l of statusCalls) expect(l.trim()).toMatch(/^(claude|codex|gh)\) bat_login "\$bat_path" (auth status|login status)( --hostname github\.com)? ;;$/)
  })

  it('tools are only executed when found off /mnt (interop never runs)', () => {
    const lines = scriptLines(LOGIN_PROBE_SCRIPT)
    const versionLine = lines.findIndex(l => l.includes('"$bat_path" --version'))
    expect(lines.filter(l => l.includes('"$bat_path" --version'))).toHaveLength(1)
    expect(lines[versionLine - 1].trim()).toBe('if [ "$bat_state" = found ]; then')
    expect(LOGIN_PROBE_SCRIPT).toContain('case "$bat_path" in /mnt/[a-z]/*) bat_state=interop ;; esac')
  })

  it('the server probe runs nothing but command -v', () => {
    expect(SERVER_PROBE_SCRIPT).not.toContain('--version')
    expect(SERVER_PROBE_SCRIPT).not.toContain('bat_run')
    expect(SERVER_PROBE_SCRIPT).not.toContain('sudo')
    expect(SERVER_PROBE_SCRIPT).not.toContain('status')
  })

  it.each(SCRIPTS)('%s prints both markers exactly once', (_name, script) => {
    expect(script.split(PROBE_BEGIN_MARKER)).toHaveLength(2)
    expect(script.split(PROBE_END_MARKER)).toHaveLength(2)
    expect(script.indexOf(PROBE_BEGIN_MARKER)).toBeLessThan(script.indexOf(PROBE_END_MARKER))
  })
})

describe('new files do not reach electron', () => {
  it('bundling probe-script / parse / types resolves no electron import', { timeout: 30_000 }, async () => {
    const seen: string[] = []
    const guard: Plugin = {
      name: 't0408-electron-guard',
      setup(b) {
        b.onResolve({ filter: /^electron(\/.*)?$/ }, args => {
          seen.push(path.relative(PROJECT_ROOT, args.importer) + ' -> ' + args.path)
          return { path: args.path, external: true }
        })
      },
    }
    const result = await build({
      absWorkingDir: PROJECT_ROOT,
      entryPoints: NEW_FILES,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      outdir: path.join(os.tmpdir(), 't0408-electron-guard'),
      logLevel: 'silent',
      metafile: true,
      plugins: [guard],
    })
    expect(seen).toEqual([])
    expect(Object.keys(result.metafile.inputs)).toContain('electron/remote-tools/parse.ts')
  })

  it.each(NEW_FILES)('%s has no electron import in source', file => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8')
    expect(src).not.toMatch(/from\s+['"]electron['"]|require\(\s*['"]electron['"]\s*\)/)
  })
})

describe('selectLoginShell', () => {
  it.each([
    ['/bin/bash', '/bin/bash'],
    ['/usr/bin/zsh', '/usr/bin/zsh'],
    ['/bin/dash', '/bin/dash'],
    ['/bin/ksh', '/bin/ksh'],
    ['/opt/homebrew/bin/bash', '/opt/homebrew/bin/bash'],
    ['/bin/sh', '/bin/sh'],
  ])('accepts %s', (input, expected) => {
    expect(selectLoginShell(input)).toBe(expected)
  })

  it.each([
    [undefined],
    [null],
    [''],
    ['bash'], // not absolute
    ['/usr/bin/fish'], // not POSIX-family
    ['/usr/bin/pwsh'],
    ['/bin/bash -c id'],
    ['/bin/bash;id'],
    ['/bin/$(id)/bash'],
    ['/bin/ba sh'],
    ['C:\\Windows\\System32\\cmd.exe'],
    ['/bin/bash\n'],
    ['/bin/bash/'],
  ])('falls back to /bin/sh for %j', input => {
    expect(selectLoginShell(input as string | undefined | null)).toBe(LOGIN_SHELL_FALLBACK)
  })
})

describe('invocation assembly', () => {
  it('login view: <shell> -l -i -c <re-exec stub> argv0 <probe>, 20s timeout', () => {
    const inv = buildLoginProbeInvocation('/usr/bin/zsh')
    expect(inv.file).toBe('/usr/bin/zsh')
    expect(inv.args).toEqual(['-l', '-i', '-c', LOGIN_PROBE_REEXEC, 'bat-tools-probe', LOGIN_PROBE_SCRIPT])
    expect(inv.options).toMatchObject({ encoding: 'utf8', timeout: LOGIN_PROBE_TIMEOUT_MS })
    expect(LOGIN_PROBE_TIMEOUT_MS).toBe(20000)
    expect(LOGIN_PROBE_REEXEC).toBe('exec /bin/sh -c "$1"')
    expect(buildLoginProbeInvocation('/usr/bin/fish').file).toBe('/bin/sh')
  })

  it('server view: /bin/sh -c <server probe>', () => {
    const inv = buildServerProbeInvocation()
    expect(inv.file).toBe('/bin/sh')
    expect(inv.args).toEqual(['-c', SERVER_PROBE_SCRIPT])
    expect(inv.options.timeout).toBe(SERVER_PROBE_TIMEOUT_MS)
    expect(inv.options).not.toHaveProperty('shell')
  })
})

type Outcome = { error?: (Error & { code?: string | number; killed?: boolean }) | null; stdout?: string; stderr?: string }

function fakeExecFile(byView: { login: Outcome; server: Outcome }) {
  const calls: Array<{ file: string; args: string[]; stdinEnded: boolean }> = []
  const impl: ProbeExecFile = (file, args, _options, cb) => {
    const view = args[0] === '-l' ? 'login' : 'server'
    const call = { file, args, stdinEnded: false }
    calls.push(call)
    const o = byView[view]
    queueMicrotask(() => cb(o.error ?? null, o.stdout ?? '', o.stderr ?? ''))
    return { stdin: { end: () => { call.stdinEnded = true } } }
  }
  return { impl, calls }
}

const LOGIN_OK = ['noise', PROBE_BEGIN_MARKER, 'env.uname_s=Linux', 'tool.git.state=found', 'tool.git.path=/usr/bin/git', 'tool.git.version=git version 2.43.0', PROBE_END_MARKER].join('\n')
const SERVER_OK = [PROBE_BEGIN_MARKER, 'tool.git.state=found', 'tool.git.path=/usr/bin/git', PROBE_END_MARKER].join('\n')

function errorWith(fields: Record<string, unknown>): Error {
  return Object.assign(new Error(String(fields.message ?? 'failed')), fields)
}

describe('runProbe / detectRemoteTools with an injected execFile', () => {
  it('runs both views, closes stdin, and merges server visibility', async () => {
    const { impl, calls } = fakeExecFile({ login: { stdout: LOGIN_OK }, server: { stdout: SERVER_OK } })
    const r = await detectRemoteTools(impl, { shell: '/bin/bash' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.report.tools.find(t => t.id === 'git')).toMatchObject({ status: 'ok', serverVisible: true })
    expect(r.report.serverViewAvailable).toBe(true)
    expect(calls.map(c => c.file).sort()).toEqual(['/bin/bash', '/bin/sh'])
    expect(calls.every(c => c.stdinEnded)).toBe(true)
  })

  it('non-zero exit after a complete block is still a report (with a warning)', async () => {
    const { impl } = fakeExecFile({
      login: { stdout: LOGIN_OK, stderr: 'logout: oops', error: errorWith({ code: 1 }) },
      server: { stdout: SERVER_OK },
    })
    const r = await detectRemoteTools(impl)
    expect(r.ok && r.report.warnings).toContain('login view exited non-zero: logout: oops')
  })

  it('timeout without a block → timeout error', async () => {
    const { impl } = fakeExecFile({ login: { stdout: 'rc noise', error: errorWith({ killed: true, signal: 'SIGTERM' }) }, server: { stdout: SERVER_OK } })
    expect(await detectRemoteTools(impl)).toEqual({ ok: false, errorCode: 'timeout', error: 'probe timed out after 20000 ms' })
  })

  it('timeout after the block was printed still yields the report', async () => {
    const { impl } = fakeExecFile({ login: { stdout: LOGIN_OK, error: errorWith({ killed: true }) }, server: { stdout: SERVER_OK } })
    const r = await detectRemoteTools(impl)
    expect(r.ok).toBe(true)
    expect(r.ok && r.report.warnings).toContain('login view: probe timed out after 20000 ms')
  })

  it('ENOENT → spawn-failed', async () => {
    const { impl } = fakeExecFile({ login: { error: errorWith({ code: 'ENOENT', message: 'spawn /bin/bash ENOENT' }) }, server: { stdout: SERVER_OK } })
    expect(await detectRemoteTools(impl, { shell: '/bin/bash' })).toEqual({ ok: false, errorCode: 'spawn-failed', error: 'spawn /bin/bash ENOENT' })
  })

  it('a throwing execFile → spawn-failed', async () => {
    const impl: ProbeExecFile = () => {
      throw new Error('boom')
    }
    expect(await runProbe(impl, buildServerProbeInvocation())).toEqual({ ok: false, errorCode: 'spawn-failed', error: 'boom', stdout: '' })
  })

  it('clean exit without markers → no-markers', async () => {
    const { impl } = fakeExecFile({ login: { stdout: 'nothing here' }, server: { stdout: SERVER_OK } })
    const r = await detectRemoteTools(impl)
    expect(r).toMatchObject({ ok: false, errorCode: 'no-markers' })
  })

  it('server view failure only clears serverViewAvailable', async () => {
    const { impl } = fakeExecFile({ login: { stdout: LOGIN_OK }, server: { error: errorWith({ code: 'ENOENT', message: 'no /bin/sh' }) } })
    const r = await detectRemoteTools(impl)
    expect(r.ok && r.report.serverViewAvailable).toBe(false)
    expect(r.ok && r.report.warnings).toContain('server view: no /bin/sh')
  })
})

// Real POSIX sh, where available: the server probe only runs `command -v`.
describe.skipIf(process.platform === 'win32' || !fs.existsSync('/bin/sh'))('server probe under a real /bin/sh', () => {
  it('produces a parseable block', async () => {
    const run = await runProbe(execFile as unknown as ProbeExecFile, buildServerProbeInvocation())
    expect(run.ok).toBe(true)
    const r = parseRemoteToolsReport([PROBE_BEGIN_MARKER, PROBE_END_MARKER].join('\n'), run.stdout)
    expect(r?.serverViewAvailable).toBe(true)
    expect(r?.warnings).toEqual([])
  })
})
