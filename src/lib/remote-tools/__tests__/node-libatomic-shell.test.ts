// @vitest-environment node
/**
 * T0756 (BUG-187): the libatomic prerequisite and the "no sudo" hint of the node recipe, run under a
 * real `sh` (Git Bash on Windows, the system one elsewhere; skipped when there is no `sh`) with fake
 * `ldconfig` / `sudo` / `apt-get` / `dnf` / `node` first on PATH. The nvm part of the command is
 * replaced by `true` (nvm-login-profile.test.ts covers the profile block; the real install was run in
 * a Docker `ubuntu:24.04` container, T0756 report).
 */
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildInstallPlan, buildUpdatePlan, isInstallPlan, type InstallPlan, type RecipeEnv } from '../recipes'

/** Git Bash (MSYS) sees `C:\x\y` as `/c/x/y`. */
function shPath(p: string): string {
  if (process.platform !== 'win32') return p
  return p.replace(/^([A-Za-z]):/, (_m, drive: string) => `/${drive.toLowerCase()}`).replace(/\\/g, '/')
}

function has(tool: string): boolean {
  const probe = spawnSync('sh', ['-c', `command -v ${tool} >/dev/null 2>&1 && echo ok`], { encoding: 'utf8', windowsHide: true })
  return probe.status === 0 && probe.stdout.trim() === 'ok'
}

const shAvailable = has('sh') && has('grep')

const linux = (pkgManager: RecipeEnv['pkgManager'], privilege: RecipeEnv['privilege']): RecipeEnv => ({ osFamily: 'linux', pkgManager, privilege, musl: false })

function plan(kind: 'install' | 'update', env: RecipeEnv): InstallPlan {
  const result = kind === 'install' ? buildInstallPlan('node', env) : buildUpdatePlan('node', env)
  if (!isInstallPlan(result)) throw new Error('expected a plan')
  return result
}

/** The nvm part (T0555 / T0556) as built for macOS, which T0756 leaves unchanged. */
function nvmPart(kind: 'install' | 'update'): string {
  return plan(kind, { osFamily: 'darwin', pkgManager: 'brew', privilege: 'passwordless', musl: false }).command
}

/** The Linux command with the nvm part swapped for `true`; throws when it is not in there exactly once. */
function withoutNvm(kind: 'install' | 'update', env: RecipeEnv): string {
  const command = plan(kind, env).command
  const nvm = nvmPart(kind)
  expect(command.split(nvm)).toHaveLength(2)
  return command.replace(nvm, 'true')
}

const LDCONFIG_HAS = '\t1 libs found in cache `/etc/ld.so.cache\'\n\tlibatomic.so.1 (libc6,x86-64) => /usr/lib/x86_64-linux-gnu/libatomic.so.1\n'
const LDCONFIG_LACKS = '\t1 libs found in cache `/etc/ld.so.cache\'\n\tlibc.so.6 (libc6,x86-64, OS ABI: Linux 3.2.0) => /usr/lib/x86_64-linux-gnu/libc.so.6\n'

// T0794 / BUG-200: each test runs the recipe under a real sh with fake ldconfig / sudo / apt-get /
// dnf / node scripts (each one a process; the first test runs it twice, install and update). Alone the
// slowest test takes 0.6 s; with two `test:unit` running at once on 24 cores up to 5.4 s, over the
// default 5 s in 2 of 6 runs. 30 s, the same as the T0786 / T0793 real-subprocess tests.
describe.skipIf(!shAvailable)('node recipe libatomic steps under a real sh (T0756)', { timeout: 30_000 }, () => {
  let dir: string
  let bin: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0756-'))
    bin = path.join(dir, 'bin')
    fs.mkdirSync(bin)
    const fake = (name: string, body: string) => {
      fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`)
      fs.chmodSync(path.join(bin, name), 0o755)
    }
    // ldconfig -p prints the cache file the test wrote.
    fake('ldconfig', 'cat "$FAKE_DIR/ldcache" 2>/dev/null; exit 0')
    fake('sudo', 'echo "sudo $*" >> "$FAKE_DIR/calls.log"; exec "$@"')
    fake('apt-get', 'echo "apt-get $*" >> "$FAKE_DIR/calls.log"; exit "${FAKE_PM_RC:-0}"')
    fake('dnf', 'echo "dnf $*" >> "$FAKE_DIR/calls.log"; exit "${FAKE_PM_RC:-0}"')
    fake('node', 'echo "node $*" >> "$FAKE_DIR/calls.log"; if [ "${FAKE_NODE_RC:-0}" = 0 ]; then echo v26.13.0; else echo "node: error while loading shared libraries: libatomic.so.1: cannot open shared object file: No such file or directory" >&2; fi; exit "${FAKE_NODE_RC:-0}"')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function run(command: string, opts: { ldcache: string; nodeRc?: number; pmRc?: number }) {
    fs.writeFileSync(path.join(dir, 'ldcache'), opts.ldcache)
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      FAKE_BIN: shPath(bin),
      FAKE_DIR: shPath(dir),
      FAKE_NODE_RC: String(opts.nodeRc ?? 0),
      FAKE_PM_RC: String(opts.pmRc ?? 0),
    }
    // PATH is prepended inside sh: Git Bash converts the Windows PATH only when it starts.
    const result = spawnSync('sh', ['-c', `PATH="$FAKE_BIN:$PATH"; export PATH; ${command}`], { encoding: 'utf8', windowsHide: true, env, cwd: dir })
    const log = path.join(dir, 'calls.log')
    const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls }
  }

  it('the library is there: no package manager runs, the command ends with node --version (exit 0)', () => {
    for (const kind of ['install', 'update'] as const) {
      const r = run(withoutNvm(kind, linux('apt', 'passwordless')), { ldcache: LDCONFIG_HAS })
      expect(r.status).toBe(0)
      expect(r.calls).toEqual(['node --version'])
      fs.rmSync(path.join(dir, 'calls.log'), { force: true })
    }
  })

  it('apt + sudo, library missing: sudo apt-get update + install libatomic1, then the rest', () => {
    const r = run(withoutNvm('install', linux('apt', 'password-required')), { ldcache: LDCONFIG_LACKS })
    expect(r.status).toBe(0)
    expect(r.calls).toEqual([
      'sudo apt-get update',
      'apt-get update',
      'sudo apt-get install -y libatomic1',
      'apt-get install -y libatomic1',
      'node --version',
    ])
  })

  it('apt as root (Docker), library missing: apt-get without sudo', () => {
    const r = run(withoutNvm('install', linux('apt', 'root')), { ldcache: LDCONFIG_LACKS })
    expect(r.status).toBe(0)
    expect(r.calls).toEqual(['apt-get update', 'apt-get install -y libatomic1', 'node --version'])
  })

  it('dnf + sudo, library missing: sudo dnf install -y libatomic', () => {
    const r = run(withoutNvm('update', linux('dnf', 'passwordless')), { ldcache: LDCONFIG_LACKS })
    expect(r.status).toBe(0)
    expect(r.calls).toEqual(['sudo dnf install -y libatomic', 'dnf install -y libatomic', 'node --version'])
  })

  it('the package manager fails: the run stops there with its exit code (nvm never starts)', () => {
    const r = run(withoutNvm('install', linux('apt', 'root')), { ldcache: LDCONFIG_LACKS, pmRc: 100 })
    expect(r.status).toBe(100)
    expect(r.calls).toEqual(['apt-get update'])
  })

  it('node cannot start after the install: the run fails with the loader exit code (127)', () => {
    const r = run(withoutNvm('install', linux('apt', 'root')), { ldcache: LDCONFIG_HAS, nodeRc: 127 })
    expect(r.status).toBe(127)
    expect(r.calls).toEqual(['node --version'])
  })

  it('no sudo, library missing, node fails: the hint names the library and the root command, exit code kept', () => {
    const r = run(withoutNvm('install', linux('apt', 'sudo-missing')), { ldcache: LDCONFIG_LACKS, nodeRc: 127 })
    expect(r.status).toBe(127)
    expect(r.calls).toEqual(['node --version'])
    expect(r.stdout).toContain('BetterAgentTerminal: Node.js cannot start because libatomic.so.1 is missing, and this account cannot install system packages. Ask an administrator to run as root: apt-get update && apt-get install -y libatomic1')
  })

  it('no sudo, node runs: exit 0 and no hint', () => {
    const r = run(withoutNvm('update', linux('apt', 'sudo-missing')), { ldcache: LDCONFIG_LACKS })
    expect(r.status).toBe(0)
    expect(r.stdout).not.toContain('BetterAgentTerminal')
  })

  it('no sudo, library present, node fails for another reason: exit code kept, no libatomic hint', () => {
    const r = run(withoutNvm('install', linux('dnf', 'sudo-missing')), { ldcache: LDCONFIG_HAS, nodeRc: 1 })
    expect(r.status).toBe(1)
    expect(r.stdout).not.toContain('BetterAgentTerminal')
  })

  it('no mapped package manager, library missing, node fails: the generic hint', () => {
    const r = run(withoutNvm('install', linux('none', 'root')), { ldcache: LDCONFIG_LACKS, nodeRc: 127 })
    expect(r.status).toBe(127)
    expect(r.stdout).toContain('Install it with the distribution package manager (package libatomic1 or libatomic), then run node --version')
  })
})
