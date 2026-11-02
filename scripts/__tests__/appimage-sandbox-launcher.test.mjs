// T0799 / BUG-202: the Linux AppImage sandbox launcher (scripts/appimage-sandbox-launcher.cjs).
//
// Static checks run everywhere. The run-time cases execute the generated script with /bin/sh against a fake
// Electron binary, fixture /proc/sys files and a fake `unshare` (the generator's test-only `procSys` /
// `unshare` options); they need a POSIX system and are skipped on Windows.

import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const {
  LAUNCHER_MARKER, REAL_BINARY_SUFFIX, SANDBOX_FALLBACK_ENV, SANDBOX_FALLBACK_STDERR_LINE,
  afterPackAppImageLauncher, installAppImageLauncher, isLauncherFile, isLinuxAppImageBuild, launcherScript,
} = require('../appimage-sandbox-launcher.cjs')
const { afterPack } = require('../version-manifest.cjs')

const EXE = 'BetterAgentTerminal'
const dirs = []
function tmp(prefix = 't0799-') {
  const d = mkdtempSync(path.join(os.tmpdir(), prefix))
  dirs.push(d)
  return d
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

describe('launcherScript (static)', () => {
  const script = launcherScript(EXE)

  it('is a /bin/sh script with the marker on its second line, exec-ing <exe>.bin', () => {
    const lines = script.split('\n')
    expect(lines[0]).toBe('#!/bin/sh')
    expect(lines[1]).toBe(LAUNCHER_MARKER)
    expect(script).toContain(`bin="$dir/${EXE}${REAL_BINARY_SUFFIX}"`)
    expect(script).toContain('exec "$bin" --no-sandbox "$@"')
    expect(script).toContain('exec "$bin" "$@"')
    expect(script).toContain('set -u')
    expect(script).not.toContain('eval')
  })

  it('prints the fixed stderr line and sets the marker only on the --no-sandbox path', () => {
    expect(SANDBOX_FALLBACK_STDERR_LINE).toBe('[sandbox] userns restricted and chrome-sandbox not setuid root: starting with --no-sandbox (BUG-202)')
    expect(script.split(SANDBOX_FALLBACK_STDERR_LINE).length).toBe(2)
    expect(script.indexOf(`export ${SANDBOX_FALLBACK_ENV}`)).toBeLessThan(script.indexOf('exec "$bin" --no-sandbox "$@"'))
  })

  it('uses the real /proc/sys and unshare unless the tests override them', () => {
    expect(script).toContain("proc_sys='/proc/sys'")
    expect(script).toContain("unshare_cmd='unshare'")
  })

  it('refuses an executable name that is not a plain file name', () => {
    for (const bad of ['a b', 'x;y', '../x', '$X', '']) expect(() => launcherScript(bad)).toThrow(/unsafe executable name/)
  })

  it('marker env name matches electron/linux-sandbox-fallback.ts', () => {
    const ts = readFileSync(path.join(here, '..', '..', 'electron', 'linux-sandbox-fallback.ts'), 'utf8')
    expect(ts).toContain(`export const APPIMAGE_SANDBOX_FALLBACK_ENV = '${SANDBOX_FALLBACK_ENV}'`)
  })
})

describe('isLinuxAppImageBuild / installAppImageLauncher / afterPack', () => {
  it('only a Linux build with an AppImage target', () => {
    expect(isLinuxAppImageBuild({ electronPlatformName: 'linux', targets: [{ name: 'appImage' }] })).toBe(true)
    expect(isLinuxAppImageBuild({ electronPlatformName: 'linux', targets: [{ name: 'deb' }] })).toBe(false)
    expect(isLinuxAppImageBuild({ electronPlatformName: 'linux', targets: [] })).toBe(false)
    expect(isLinuxAppImageBuild({ electronPlatformName: 'win32', targets: [{ name: 'appImage' }] })).toBe(false)
    expect(isLinuxAppImageBuild({ electronPlatformName: 'darwin', targets: [{ name: 'dmg' }] })).toBe(false)
    expect(isLinuxAppImageBuild(undefined)).toBe(false)
  })

  it('renames the binary to .bin and writes the launcher (0755); a second run keeps the binary', () => {
    const d = tmp()
    writeFileSync(path.join(d, EXE), 'ELF-BYTES')
    const r = installAppImageLauncher(d, EXE)
    expect(readFileSync(r.real, 'utf8')).toBe('ELF-BYTES')
    expect(isLauncherFile(r.launcher)).toBe(true)
    if (process.platform !== 'win32') expect(statSync(r.launcher).mode & 0o777).toBe(0o755)
    installAppImageLauncher(d, EXE)
    expect(readFileSync(r.real, 'utf8')).toBe('ELF-BYTES')
    expect(isLauncherFile(r.launcher)).toBe(true)
  })

  it('fails when the binary is missing, or when a launcher exists without its .bin', () => {
    const d = tmp()
    expect(() => installAppImageLauncher(d, EXE)).toThrow(/does not exist/)
    writeFileSync(path.join(d, EXE), launcherScript(EXE))
    expect(() => installAppImageLauncher(d, EXE)).toThrow(/\.bin is missing/)
  })

  it('afterPack installs it for linux + AppImage and leaves win / mac untouched', async () => {
    for (const [platform, targets, installed] of [['linux', [{ name: 'appImage' }], true], ['win32', [{ name: 'nsis' }], false], ['darwin', [{ name: 'dmg' }], false]]) {
      const d = tmp()
      mkdirSync(path.join(d, 'resources'))
      writeFileSync(path.join(d, EXE), 'ELF-BYTES')
      const packager = { appInfo: { name: 'better-agent-terminal', version: '0.7.4-pre.1' }, getResourcesDir: (o) => path.join(o, 'resources'), executableName: EXE }
      await afterPack({ appOutDir: d, packager, electronPlatformName: platform, targets })
      expect(existsSync(path.join(d, EXE + REAL_BINARY_SUFFIX))).toBe(installed)
      expect(isLauncherFile(path.join(d, EXE))).toBe(installed)
      expect(existsSync(path.join(d, 'resources', 'package.json'))).toBe(true)
    }
    expect(afterPackAppImageLauncher({ electronPlatformName: 'win32', targets: [] })).toBeNull()
  })
})

const posix = process.platform !== 'win32' && existsSync('/bin/sh')

// Fake Electron binary: Node-mode probe prints the fixture AppArmor label; GUI mode prints what it got.
const FAKE_BIN = `#!/bin/sh
d=$(dirname -- "$0")
if [ "\${ELECTRON_RUN_AS_NODE:-}" = 1 ] && [ "\${1:-}" = -e ]; then
  [ -f "$d/label" ] && cat "$d/label"
  exit 0
fi
printf 'NODE=%s\\n' "\${ELECTRON_RUN_AS_NODE:-}"
printf 'MARKER=%s\\n' "\${BAT_APPIMAGE_SANDBOX_FALLBACK:-}"
if [ $# -gt 0 ]; then printf '%s\\0' "$@" > "$d/argv"; else : > "$d/argv"; fi
if [ -n "\${FAKE_READ_STDIN:-}" ]; then printf 'STDIN<%s>\\n' "$(cat)"; fi
exit "\${FAKE_EXIT:-0}"
`

/**
 * One fake AppImage directory: launcher + fake .bin + chrome-sandbox, fixture proc/sys, fake unshare.
 * `apparmor` / `usernsClone` / `maxNs`: file content, or null = file absent. `unshare`: 'ok' | 'fail' | 'missing'.
 */
function fakeApp({ apparmor = null, usernsClone = null, maxNs = null, unshare = 'ok', label = null, sandbox = 'plain', dirName = 'app' } = {}) {
  const root = tmp()
  const dir = path.join(root, dirName)
  mkdirSync(dir)
  const sys = path.join(root, 'sys')
  mkdirSync(path.join(sys, 'kernel'), { recursive: true })
  mkdirSync(path.join(sys, 'user'), { recursive: true })
  if (apparmor !== null) writeFileSync(path.join(sys, 'kernel', 'apparmor_restrict_unprivileged_userns'), `${apparmor}\n`)
  if (usernsClone !== null) writeFileSync(path.join(sys, 'kernel', 'unprivileged_userns_clone'), `${usernsClone}\n`)
  if (maxNs !== null) writeFileSync(path.join(sys, 'user', 'max_user_namespaces'), `${maxNs}\n`)
  const unshareBin = path.join(root, unshare === 'missing' ? 'no-such-unshare' : 'fake-unshare')
  if (unshare !== 'missing') {
    writeFileSync(unshareBin, `#!/bin/sh\n[ "$1 $2 $3" = "--user --map-root-user true" ] || exit 99\nexit ${unshare === 'ok' ? 0 : 1}\n`)
    chmodSync(unshareBin, 0o755)
  }
  const launcher = path.join(dir, EXE)
  writeFileSync(launcher, launcherScript(EXE, { procSys: sys, unshare: unshareBin }))
  chmodSync(launcher, 0o755)
  writeFileSync(path.join(dir, EXE + REAL_BINARY_SUFFIX), FAKE_BIN)
  chmodSync(path.join(dir, EXE + REAL_BINARY_SUFFIX), 0o755)
  if (label !== null) writeFileSync(path.join(dir, 'label'), label)
  if (sandbox === 'plain') {
    writeFileSync(path.join(dir, 'chrome-sandbox'), '')
    // setuid but owned by the test user, like an AppImage mount (as root: no setuid bit, still not Chromium's 4755 root)
    chmodSync(path.join(dir, 'chrome-sandbox'), process.getuid?.() === 0 ? 0o755 : 0o4755)
  } else if (sandbox === 'root-setuid') {
    symlinkSync(SETUID_ROOT_FILE, path.join(dir, 'chrome-sandbox'))
  }
  return { root, dir, launcher }
}

const SETUID_ROOT_FILE = ['/usr/bin/passwd', '/usr/bin/su', '/bin/su', '/usr/bin/sudo'].find((f) => {
  try {
    const st = statSync(f)
    return st.uid === 0 && (st.mode & 0o4000) !== 0 && (st.mode & 0o001) !== 0
  } catch { return false }
})

/** Runs `app.launcher` (or `via`, e.g. a symlink); the fake binary writes its argv NUL-separated to `<dir>/argv`. */
function run(app, args = [], { env = {}, input, via } = {}) {
  const base = { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' }
  const argvFile = path.join(app.dir, 'argv')
  rmSync(argvFile, { force: true })
  const r = spawnSync(via ?? app.launcher, args, { env: { ...base, ...env }, input, encoding: 'utf8', timeout: 20_000 })
  const lines = (r.stdout ?? '').split('\n').filter(Boolean)
  const raw = existsSync(argvFile) ? readFileSync(argvFile, 'utf8') : null
  return {
    status: r.status,
    stderr: r.stderr ?? '',
    node: lines.find((l) => l.startsWith('NODE='))?.slice(5),
    marker: lines.find((l) => l.startsWith('MARKER='))?.slice(7),
    args: raw === null ? null : raw === '' ? [] : raw.split('\0').slice(0, -1),
    stdin: lines.find((l) => l.startsWith('STDIN<'))?.slice(6, -1),
  }
}

function expectAdded(r, userArgs = []) {
  expect(r.status).toBe(0)
  expect(r.args).toEqual(['--no-sandbox', ...userArgs])
  expect(r.marker).toBe('1')
  expect(r.stderr).toBe(`${SANDBOX_FALLBACK_STDERR_LINE}\n`)
}

function expectUnchanged(r, userArgs = []) {
  expect(r.status).toBe(0)
  expect(r.args).toEqual(userArgs)
  expect(r.marker).toBe('')
  expect(r.stderr).toBe('')
}

describe.skipIf(!posix)('launcher at run time (POSIX sh)', () => {
  it('Ubuntu 24.04 default: AppArmor restricts userns, no profile, chrome-sandbox not root → adds --no-sandbox', () => {
    expectAdded(run(fakeApp({ apparmor: 1, label: 'unconfined', unshare: 'fail' }), ['--runtime=x']), ['--runtime=x'])
  })

  it('AppArmor restricts userns and the probe cannot read a label → adds --no-sandbox', () => {
    expectAdded(run(fakeApp({ apparmor: 1, label: null })))
  })

  it('AppArmor restricts userns but the binary runs under a profile → unchanged (even when unshare itself fails)', () => {
    expectUnchanged(run(fakeApp({ apparmor: 1, label: 'bat-appimage (unconfined)', unshare: 'fail' }), ['a']), ['a'])
  })

  it('Ubuntu 22.04: not restricted, unshare works → unchanged', () => {
    expectUnchanged(run(fakeApp({ apparmor: 0, unshare: 'ok' }), ['x']), ['x'])
    expectUnchanged(run(fakeApp({ apparmor: null, unshare: 'ok' })))
  })

  it('no AppArmor restriction but unshare fails (e.g. a container seccomp profile) → adds --no-sandbox', () => {
    expectAdded(run(fakeApp({ apparmor: 0, unshare: 'fail' })))
  })

  it('no unshare: falls back to unprivileged_userns_clone / max_user_namespaces', () => {
    expectAdded(run(fakeApp({ unshare: 'missing', usernsClone: 0 })))
    expectAdded(run(fakeApp({ unshare: 'missing', maxNs: 0 })))
    expectUnchanged(run(fakeApp({ unshare: 'missing', usernsClone: 1, maxNs: 63000 })))
    expectUnchanged(run(fakeApp({ unshare: 'missing' })))
  })

  it('--no-sandbox already given (the .desktop entry) → not added again, no stderr line', () => {
    expectUnchanged(run(fakeApp({ apparmor: 1, label: 'unconfined' }), ['--no-sandbox', '%U']), ['--no-sandbox', '%U'])
    expectUnchanged(run(fakeApp({ apparmor: 1, label: 'unconfined' }), ['a', '--no-sandbox']), ['a', '--no-sandbox'])
  })

  it.skipIf(!SETUID_ROOT_FILE)('chrome-sandbox root-owned setuid (e.g. extracted and chown root / chmod 4755) → unchanged', () => {
    expectUnchanged(run(fakeApp({ apparmor: 1, label: 'unconfined', sandbox: 'root-setuid' })))
  })

  it('chrome-sandbox missing counts as not setuid root', () => {
    expectAdded(run(fakeApp({ apparmor: 1, label: 'unconfined', sandbox: 'none' })))
  })

  it('ELECTRON_RUN_AS_NODE non-empty → exec unchanged (Node mode), even when restricted', () => {
    const r = run(fakeApp({ apparmor: 1, label: 'unconfined' }), ['-e', 'x'], { env: { ELECTRON_RUN_AS_NODE: '1' } })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    // the fake prints the probe label in Node mode with -e; any other args reach it unchanged
    const r2 = run(fakeApp({ apparmor: 1, label: 'unconfined' }), ['script.js', 'a b'], { env: { ELECTRON_RUN_AS_NODE: '1' } })
    expect(r2.node).toBe('1')
    expect(r2.args).toEqual(['script.js', 'a b'])
    expect(r2.marker).toBe('')
  })

  it('a marker inherited from the caller is cleared when the launcher does not add the switch', () => {
    const r = run(fakeApp({ apparmor: 0, unshare: 'ok' }), [], { env: { [SANDBOX_FALLBACK_ENV]: '1' } })
    expect(r.marker).toBe('')
  })

  it('forwards every argument byte for byte, stdin, and the exit code', () => {
    const tricky = ['a b', '', '$HOME', '*', "it's", '"dq"', 'x\ny', '--flag=1 2', '-', '\\back', '`id`', '%U']
    for (const opts of [{ apparmor: 1, label: 'unconfined' }, { apparmor: 0, unshare: 'ok' }]) {
      const r = run(fakeApp(opts), tricky, { env: { FAKE_EXIT: '7', FAKE_READ_STDIN: '1' }, input: 'from stdin' })
      expect(r.status).toBe(7)
      expect(r.stdin).toBe('from stdin')
      expect(r.args).toEqual((opts.apparmor === 1 ? ['--no-sandbox'] : []).concat(tricky))
    }
  })

  it('works from a directory with spaces and through a symlink to the launcher', () => {
    const app = fakeApp({ apparmor: 1, label: 'unconfined', dirName: 'My Apps (x)' })
    expectAdded(run(app, ['q r']), ['q r'])
    const link = path.join(app.root, 'link-to-launcher')
    symlinkSync(app.launcher, link)
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expectAdded(run(app, ['q'], { via: link }), ['q'])
  })

  it('passes sh -n / bash -n / dash -n, and shellcheck when installed', () => {
    const { launcher } = fakeApp()
    for (const sh of ['sh', 'bash', 'dash']) {
      const which = spawnSync('sh', ['-c', `command -v ${sh}`], { encoding: 'utf8' })
      if (which.status !== 0) continue
      const r = spawnSync(sh, ['-n', launcher], { encoding: 'utf8' })
      expect(r.status, `${sh} -n: ${r.stderr}`).toBe(0)
    }
    const sc = spawnSync('sh', ['-c', 'command -v shellcheck'], { encoding: 'utf8' })
    if (sc.status === 0) {
      const prod = path.join(tmp(), EXE)
      writeFileSync(prod, launcherScript(EXE))
      const r = spawnSync('shellcheck', ['-s', 'sh', prod], { encoding: 'utf8' })
      expect(r.status, `shellcheck:\n${r.stdout}${r.stderr}`).toBe(0)
    }
  })
})
