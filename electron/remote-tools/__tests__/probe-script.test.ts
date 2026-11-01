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
    // T0753: two pattern expansions of the probe-local `bat_vout` (exit code trailer / version text).
    const allowed = new Set(['bat_vout##*__bat_rc=', 'bat_vout%__bat_rc=*', 'WSL_DISTRO_NAME', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GH_CONFIG_DIR', 'XDG_CONFIG_HOME', 'NVM_DIR'])
    for (const name of braced) expect(allowed, name).toContain(name)
    // Command substitution is limited to probe-local commands.
    const substitutions = [...script.matchAll(/\$\(([^)]*)\)?/g)].map(m => m[1].trim().split(/\s+/)[0])
    for (const cmd of substitutions) expect(['command', 'uname', 'sed', 'sw_vers', 'id', 'bat_run', 'printf', 'nvm'], cmd).toContain(cmd)
  })

  it('nvm (T0555): nvm.sh is the only sourced file, loaded in a timed child /bin/sh, login view only', () => {
    const lines = scriptLines(LOGIN_PROBE_SCRIPT)
    const sourcing = lines.filter(l => /(^|[\s'"(;])\.\s+"/.test(l))
    expect(sourcing).toHaveLength(1)
    expect(sourcing[0].trim()).toBe(
      'bat_nvm_out=$(bat_run 8 /bin/sh -c \'. "$NVM_DIR/nvm.sh" >/dev/null 2>&1; printf "%s\\n" "$(nvm --version 2>/dev/null)"; command -v node 2>/dev/null\' bat-nvm 2>/dev/null </dev/null)',
    )
    expect(lines.find(l => l.trim().startsWith('if [ -s "$bat_nvm_dir/nvm.sh" ]'))).toBeDefined()
    // Only a node under $NVM_DIR/versions/node/ is taken from nvm.
    expect(LOGIN_PROBE_SCRIPT).toContain('case "$bat_nvm_node" in "$bat_nvm_dir"/versions/node/*/bin/node) ;; *) bat_nvm_node=\'\' ;; esac')
    expect(SERVER_PROBE_SCRIPT).not.toContain('nvm')
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
    // T0753: a second `--version` run (missing-library check) sits inside the same found block.
    const versionLines = lines.map((l, i) => [l, i] as const).filter(([l]) => l.includes('"$bat_path" --version'))
    expect(versionLines).toHaveLength(2)
    expect(lines[versionLine - 1].trim()).toBe('if [ "$bat_state" = found ]; then')
    const foundEnd = lines.findIndex((l, i) => i > versionLine && l === '  fi')
    for (const [, i] of versionLines) expect(i).toBeLessThan(foundEnd)
    expect(LOGIN_PROBE_SCRIPT).toContain('case "$bat_path" in /mnt/[a-z]/*) bat_state=interop ;; esac')
    // T0555: the nvm node override re-applies the interop rule (once in bat_locate, once here).
    expect(LOGIN_PROBE_SCRIPT.split('case "$bat_path" in /mnt/[a-z]/*) bat_state=interop ;; esac')).toHaveLength(3)
  })

  // T0753 (BUG-186): stderr of `--version` never reaches the output; only a sed-extracted file name does.
  it('version failure: only the exit code and a loader-reported library file name are printed', () => {
    const lines = scriptLines(LOGIN_PROBE_SCRIPT)
    const stderrLines = lines.filter(l => l.includes('2>&1') && l.includes('"$bat_path"'))
    expect(stderrLines).toHaveLength(1)
    const [line] = stderrLines
    expect(line).toContain('bat_emit "tool.$bat_name.missing_lib" "$(bat_run 5 "$bat_path" --version 2>&1 >/dev/null </dev/null | sed -n ')
    expect(line).toContain("-e 's/^.*error while loading shared libraries: \\([A-Za-z0-9._+-]*\\): .*$/\\1/p'")
    expect(line).toContain("-e 's/^Error loading shared library \\([A-Za-z0-9._+-]*\\): .*$/\\1/p'")
    expect(line.trim().endsWith('| head -n1)" ;;')).toBe(true)
    // No second run after a timeout kill.
    expect(LOGIN_PROBE_SCRIPT).toContain('        124|137|143) ;;')
    // The first run keeps stderr discarded, as before.
    expect(LOGIN_PROBE_SCRIPT).toContain('bat_vout=$(bat_run 5 "$bat_path" --version 2>/dev/null </dev/null; printf \'\\n__bat_rc=%s\' "$?")')
  })

  it('server probe (T0753): git / gh also scan the locations the server resolvers scan; other tools stay PATH-only', () => {
    expect(SERVER_PROBE_SCRIPT).toContain('bat_srv_dirs="/usr/bin /usr/local/bin"')
    expect(SERVER_PROBE_SCRIPT).toContain('if [ "$(uname -s 2>/dev/null)" = Darwin ]; then bat_srv_dirs="$bat_srv_dirs /opt/homebrew/bin"; fi')
    expect(SERVER_PROBE_SCRIPT).toContain('    *:git|*:gh)')
    expect(SERVER_PROBE_SCRIPT).toContain('      for bat_dir in $bat_srv_dirs "$HOME/.local/bin"; do')
    expect(SERVER_PROBE_SCRIPT.split('bat_state=found')).toHaveLength(3) // bat_locate + the git / gh scan
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

// T0555: the login probe's nvm step under a real /bin/sh, with a fake $HOME/.nvm.
describe.skipIf(process.platform === 'win32' || !fs.existsSync('/bin/sh'))('login probe nvm step under a real /bin/sh', () => {
  function runLoginProbe(home: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('/bin/sh', ['-c', LOGIN_PROBE_SCRIPT], { env: { PATH: '/usr/bin:/bin', HOME: home }, timeout: 20000 }, (err, stdout) => {
        if (err && !stdout) reject(err)
        else resolve(String(stdout))
      })
    })
  }

  function fakeNvmHome(nvmSh: string): string {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 't0555-nvm-'))
    const bin = path.join(home, '.nvm', 'versions', 'node', 'v24.0.0', 'bin')
    fs.mkdirSync(bin, { recursive: true })
    fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\necho v24.0.0\n', { mode: 0o755 })
    fs.writeFileSync(path.join(home, '.nvm', 'nvm.sh'), nvmSh)
    return home
  }

  it('nvm present: node taken from $NVM_DIR/versions/node, nvm version reported', async () => {
    const home = fakeNvmHome('nvm() { echo 0.40.8; }\nPATH="$NVM_DIR/versions/node/v24.0.0/bin:$PATH"; export PATH\n')
    try {
      const node = tool(parseRemoteToolsReport(await runLoginProbe(home)), 'node')
      expect(node).toMatchObject({ status: 'ok', version: '24.0.0', nvm: { version: '0.40.8' }, nvmManaged: true })
      expect(node.path).toBe(path.join(home, '.nvm/versions/node/v24.0.0/bin/node'))
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })

  it('a broken nvm.sh does not end the probe', async () => {
    const home = fakeNvmHome('if then fi (((\n')
    try {
      const report = parseRemoteToolsReport(await runLoginProbe(home))
      expect(report).not.toBeNull()
      expect(tool(report, 'node').nvm).toEqual({})
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })
})

// T0753 (BUG-186): a found binary that cannot run, under a real /bin/sh.
describe.skipIf(process.platform === 'win32' || !fs.existsSync('/bin/sh'))('login probe version failures under a real /bin/sh', () => {
  function runLogin(dir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('/bin/sh', ['-c', LOGIN_PROBE_SCRIPT], { env: { PATH: dir + ':/usr/bin:/bin', HOME: dir }, timeout: 20000 }, (err, stdout) => {
        if (err && !stdout) reject(err)
        else resolve(String(stdout))
      })
    })
  }

  it('glibc / musl loader errors → missing library; other stderr is never printed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0753-probe-'))
    try {
      fs.writeFileSync(path.join(dir, 'uv'), '#!/bin/sh\necho "$0: error while loading shared libraries: libatomic.so.1: cannot open shared object file: No such file or directory" >&2\nexit 127\n', { mode: 0o755 })
      fs.writeFileSync(path.join(dir, 'rg'), '#!/bin/sh\necho "Error loading shared library libstdc++.so.6: No such file or directory (needed by $0)" >&2\nexit 127\n', { mode: 0o755 })
      fs.writeFileSync(path.join(dir, 'codex'), '#!/bin/sh\necho "do-not-print-me" >&2\nexit 3\n', { mode: 0o755 })
      const stdout = await runLogin(dir)
      expect(stdout).not.toContain('do-not-print-me')
      const report = parseRemoteToolsReport(stdout)
      expect(tool(report, 'uv')).toMatchObject({ status: 'error', versionError: { exitCode: 127, missingLibrary: 'libatomic.so.1' } })
      expect(tool(report, 'rg')).toMatchObject({ status: 'error', versionError: { exitCode: 127, missingLibrary: 'libstdc++.so.6' } })
      expect(tool(report, 'codex')).toMatchObject({ status: 'error', versionError: { exitCode: 3 } })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('a working tool keeps its version and gets no versionError', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0753-probe-'))
    try {
      fs.writeFileSync(path.join(dir, 'uv'), '#!/bin/sh\necho "uv 0.12.23 (x86_64-unknown-linux-gnu)"\necho "line two"\necho warn >&2\n', { mode: 0o755 })
      const uv = tool(parseRemoteToolsReport(await runLogin(dir)), 'uv')
      expect(uv).toMatchObject({ status: 'ok', version: '0.12.23' })
      expect(uv.versionError).toBeUndefined()
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe.skipIf(process.platform === 'win32' || !fs.existsSync('/bin/sh'))('server probe git / gh scan under a real /bin/sh', () => {
  it('git / gh in $HOME/.local/bin are visible to the server view even off PATH; uv there is not', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 't0753-srv-'))
    try {
      fs.mkdirSync(path.join(home, '.local', 'bin'), { recursive: true })
      for (const name of ['git', 'gh', 'uv']) fs.writeFileSync(path.join(home, '.local', 'bin', name), '#!/bin/sh\n', { mode: 0o755 })
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile('/bin/sh', ['-c', SERVER_PROBE_SCRIPT], { env: { PATH: '/nonexistent', HOME: home }, timeout: 5000 }, (err, out) => (err && !out ? reject(err) : resolve(String(out))))
      })
      const r = parseRemoteToolsReport([PROBE_BEGIN_MARKER, PROBE_END_MARKER].join('\n'), stdout)
      expect(tool(r, 'git').serverVisible).toBe(true)
      expect(tool(r, 'gh').serverVisible).toBe(true)
      expect(tool(r, 'uv').serverVisible).toBe(false)
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })
})

function tool(report: ReturnType<typeof parseRemoteToolsReport>, id: string) {
  const t = report?.tools.find(x => x.id === id)
  if (!t) throw new Error('no tool ' + id)
  return t
}
