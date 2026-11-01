/**
 * T0758 / BUG-189: on Windows the first codex on PATH is often an npm shim (`codex.cmd` / `.ps1`, from
 * `npm i -g @openai/codex`, or `node_modules\.bin` when BAT runs from `npx`). It cannot run without a
 * shell, so before T0758 the version probe stopped there (`version-unknown`): a codex tab with BAT MCP
 * off got no `--no-daemon` (BUG-159), a dispatched codex Worker no OSC state (T0621).
 *
 * Now the shim is read (never run): it must start `…\@openai\codex\bin\codex.js`, and the native
 * `codex.exe` codex.js would spawn is found the way codex.js finds it, then probed with `execFile`.
 * The shim texts below are the real ones npm 11 wrote for @openai/codex 0.166.0 (T0758 查證: global
 * `npm i -g --prefix`, and the repo's own `node_modules\.bin`); the pnpm line is @zkochan/cmd-shim's form.
 *
 * Covers: resolveNpmCodexShim (layouts, arch, realpath, failures), resolveDispatchCodexBinary (PATH
 * order, custom CLI), the shared reader behind both consumers (createCodexNoDaemonSupportCheck for a
 * tab, createCodexOscVersionCheck for a dispatch), caching on the native exe, macOS / Linux unchanged,
 * and the default fs deps on a real directory (Windows only).
 */
import { describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  createCodexNoDaemonSupportCheck,
  createCodexOscVersionCheck,
  resolveDispatchCodexBinary,
  resolveNpmCodexShim,
  type ExecFileLike,
} from '../codex-osc-version'

/** npm 11 cmd-shim, `npm i -g` (shim next to node_modules). */
const NPM_GLOBAL_CMD = [
  '@ECHO off', 'GOTO start', ':find_dp0', 'SET dp0=%~dp0', 'EXIT /b', ':start', 'SETLOCAL', 'CALL :find_dp0', '',
  'IF EXIST "%dp0%\\node.exe" (', '  SET "_prog=%dp0%\\node.exe"', ') ELSE (', '  SET "_prog=node"', ')', '',
  'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*',
].join('\r\n')
/** The same shim in a project's node_modules\.bin. */
const NPM_LOCAL_CMD = NPM_GLOBAL_CMD.replace('%dp0%\\node_modules\\@openai', '%dp0%\\..\\@openai')
/** npm 11 ps1 shim (global). */
const NPM_GLOBAL_PS1 = [
  '#!/usr/bin/env pwsh', '$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent', '',
  'if (Test-Path "$basedir/node$exe") {',
  '    & "$basedir/node$exe"  "$basedir/node_modules/@openai/codex/bin/codex.js" $args',
  '} else {', '    & "node$exe"  "$basedir/node_modules/@openai/codex/bin/codex.js" $args', '}',
].join('\n')
/** @zkochan/cmd-shim (pnpm) form. */
const PNPM_CMD = '@SETLOCAL\r\n@IF EXIST "%~dp0\\node.exe" (\r\n  "%~dp0\\node.exe"  "%~dp0\\global\\5\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n)'

const X64 = 'x86_64-pc-windows-msvc'
const ARM64 = 'aarch64-pc-windows-msvc'
const exeIn = (pkgDir: string, triple = X64) => `${pkgDir}\\vendor\\${triple}\\bin\\codex.exe`

/** An in-memory Windows disk: path → text ('' for a binary). Case-insensitive like NTFS. */
function disk(files: Record<string, string>) {
  const map = new Map(Object.entries(files).map(([k, v]) => [k.toLowerCase(), v]))
  return {
    isFile: (p: string) => map.has(p.toLowerCase()),
    readFile: (p: string) => map.get(p.toLowerCase()) ?? null,
  }
}

/** `npm i -g` layout under `prefix`: platform package nested in @openai/codex/node_modules. */
function globalInstall(prefix: string, shims: Record<string, string> = { 'codex.cmd': NPM_GLOBAL_CMD, 'codex.ps1': NPM_GLOBAL_PS1 }) {
  const pkg = `${prefix}\\node_modules\\@openai\\codex`
  const platformPkg = `${pkg}\\node_modules\\@openai\\codex-win32-x64`
  return {
    exe: exeIn(platformPkg),
    files: {
      ...Object.fromEntries(Object.entries(shims).map(([n, t]) => [`${prefix}\\${n}`, t])),
      [`${pkg}\\bin\\codex.js`]: '#!/usr/bin/env node',
      [`${platformPkg}\\package.json`]: '{}',
      [exeIn(platformPkg)]: '',
    } as Record<string, string>,
  }
}

const NPM = 'C:\\Users\\demo\\AppData\\Roaming\\npm'

describe('resolveNpmCodexShim (T0758)', () => {
  it('npm i -g: the cmd shim → codex.js → the nested platform package codex.exe', () => {
    const g = globalInstall(NPM)
    expect(resolveNpmCodexShim(`${NPM}\\codex.cmd`, { ...disk(g.files), arch: 'x64' })).toEqual({ path: g.exe })
  })

  it('a project node_modules\\.bin shim (`..\\@openai`) → the hoisted platform package', () => {
    const nm = 'D:\\proj\\node_modules'
    const platformPkg = `${nm}\\@openai\\codex-win32-x64`
    const d = disk({
      [`${nm}\\.bin\\codex.cmd`]: NPM_LOCAL_CMD,
      [`${nm}\\@openai\\codex\\bin\\codex.js`]: '',
      [`${platformPkg}\\package.json`]: '{}',
      [exeIn(platformPkg)]: '',
    })
    expect(resolveNpmCodexShim(`${nm}\\.bin\\codex.cmd`, { ...d, arch: 'x64' })).toEqual({ path: exeIn(platformPkg) })
  })

  it('the ps1 shim and the pnpm cmd-shim form are read too', () => {
    const g = globalInstall(NPM, { 'codex.ps1': NPM_GLOBAL_PS1 })
    expect(resolveNpmCodexShim(`${NPM}\\codex.ps1`, { ...disk(g.files), arch: 'x64' })).toEqual({ path: g.exe })
    const pn = 'C:\\Users\\demo\\AppData\\Local\\pnpm'
    const pkg = `${pn}\\global\\5\\node_modules\\@openai\\codex`
    const platformPkg = `${pn}\\global\\5\\node_modules\\@openai\\codex-win32-x64`
    const d = disk({ [`${pn}\\codex.cmd`]: PNPM_CMD, [`${pkg}\\bin\\codex.js`]: '', [`${platformPkg}\\package.json`]: '{}', [exeIn(platformPkg)]: '' })
    expect(resolveNpmCodexShim(`${pn}\\codex.cmd`, { ...d, arch: 'x64' })).toEqual({ path: exeIn(platformPkg) })
  })

  it('pnpm: resolution starts from the real package path (its siblings live in the .pnpm store)', () => {
    const pn = 'C:\\Users\\demo\\AppData\\Local\\pnpm'
    const link = `${pn}\\global\\5\\node_modules\\@openai\\codex`
    const store = `${pn}\\global\\5\\node_modules\\.pnpm\\@openai+codex@0.166.0\\node_modules`
    const platformPkg = `${store}\\@openai\\codex-win32-x64`
    const d = disk({ [`${pn}\\codex.cmd`]: PNPM_CMD, [`${link}\\bin\\codex.js`]: '', [`${platformPkg}\\package.json`]: '{}', [exeIn(platformPkg)]: '' })
    const realpath = (p: string) => (p.toLowerCase() === link.toLowerCase() ? `${store}\\@openai\\codex` : p)
    expect(resolveNpmCodexShim(`${pn}\\codex.cmd`, { ...d, realpath, arch: 'x64' })).toEqual({ path: exeIn(platformPkg) })
    expect(resolveNpmCodexShim(`${pn}\\codex.cmd`, { ...d, arch: 'x64' })).toEqual({ reason: 'npm shim: native codex.exe not found' })
    // a throwing realpath keeps the lexical path
    expect(resolveNpmCodexShim(`${pn}\\codex.cmd`, { ...d, realpath: () => { throw new Error('EPERM') }, arch: 'x64' }))
      .toEqual({ reason: 'npm shim: native codex.exe not found' })
  })

  it('arch: the process arch package first, the other one next; the package vendor/ fallback', () => {
    const pkg = `${NPM}\\node_modules\\@openai\\codex`
    const arm = `${pkg}\\node_modules\\@openai\\codex-win32-arm64`
    const x64 = `${pkg}\\node_modules\\@openai\\codex-win32-x64`
    const both = disk({
      [`${NPM}\\codex.cmd`]: NPM_GLOBAL_CMD, [`${pkg}\\bin\\codex.js`]: '',
      [`${arm}\\package.json`]: '{}', [exeIn(arm, ARM64)]: '', [`${x64}\\package.json`]: '{}', [exeIn(x64)]: '',
    })
    expect(resolveNpmCodexShim(`${NPM}\\codex.cmd`, { ...both, arch: 'arm64' })).toEqual({ path: exeIn(arm, ARM64) })
    expect(resolveNpmCodexShim(`${NPM}\\codex.cmd`, { ...both, arch: 'x64' })).toEqual({ path: exeIn(x64) })
    const armOnly = disk({ [`${NPM}\\codex.cmd`]: NPM_GLOBAL_CMD, [`${pkg}\\bin\\codex.js`]: '', [`${arm}\\package.json`]: '{}', [exeIn(arm, ARM64)]: '' })
    expect(resolveNpmCodexShim(`${NPM}\\codex.cmd`, { ...armOnly, arch: 'x64' })).toEqual({ path: exeIn(arm, ARM64) })
    const vendored = disk({ [`${NPM}\\codex.cmd`]: NPM_GLOBAL_CMD, [`${pkg}\\bin\\codex.js`]: '', [exeIn(pkg)]: '' })
    expect(resolveNpmCodexShim(`${NPM}\\codex.cmd`, { ...vendored, arch: 'x64' })).toEqual({ path: exeIn(pkg) })
  })

  it('cannot be followed → a reason, never a path', () => {
    const g = globalInstall(NPM)
    const shim = `${NPM}\\codex.cmd`
    expect(resolveNpmCodexShim(shim, { isFile: () => true })).toEqual({ reason: 'cannot read the shim' })
    expect(resolveNpmCodexShim(shim, { ...disk({ [shim]: '@echo off\r\nnode "%~dp0\\x.mjs" %*' }) })).toEqual({ reason: 'not an npm shim' })
    expect(resolveNpmCodexShim(shim, { ...disk({ [shim]: NPM_GLOBAL_CMD.replace('@openai\\codex\\bin', '@acme\\codex\\bin') }) }))
      .toEqual({ reason: 'npm shim of another package' })
    expect(resolveNpmCodexShim(shim, { ...disk({ [shim]: NPM_GLOBAL_CMD }) })).toEqual({ reason: 'npm shim target missing' })
    // the platform package is there but its binary is not (codex.js would throw "Missing optional dependency")
    const noExe = { ...g.files }
    delete noExe[g.exe]
    expect(resolveNpmCodexShim(shim, { ...disk(noExe), arch: 'x64' })).toEqual({ reason: `npm shim: ${g.exe} missing` })
    const noPkg = Object.fromEntries(Object.entries(g.files).filter(([k]) => !k.includes('codex-win32')))
    expect(resolveNpmCodexShim(shim, { ...disk(noPkg), arch: 'x64' })).toEqual({ reason: 'npm shim: native codex.exe not found' })
  })
})

describe('resolveDispatchCodexBinary with npm shims (T0758)', () => {
  const win = { platform: 'win32' as const, arch: 'x64' }

  it('the first codex on PATH is an npm shim → its codex.exe, via the shim (cmd read first)', () => {
    const g = globalInstall(NPM)
    expect(resolveDispatchCodexBinary('codex', { ...win, env: { Path: `C:\\Windows;${NPM};C:\\Codex` }, ...disk({ ...g.files, 'C:\\Codex\\codex.exe': '' }) }))
      .toEqual({ path: g.exe, via: `${NPM}\\codex.cmd` })
    // a broken cmd shim does not stop the ps1 next to it
    const files = { ...g.files, [`${NPM}\\codex.cmd`]: 'garbage' }
    expect(resolveDispatchCodexBinary('codex -c x=1', { ...win, env: { PATH: NPM }, ...disk(files) }))
      .toEqual({ path: g.exe, via: `${NPM}\\codex.ps1` })
  })

  it('codex.exe in the same directory still wins; a later directory is never used past an unfollowable shim', () => {
    const g = globalInstall(NPM)
    expect(resolveDispatchCodexBinary('codex', { ...win, env: { PATH: NPM }, ...disk({ ...g.files, [`${NPM}\\codex.exe`]: '' }) }))
      .toEqual({ path: `${NPM}\\codex.exe` })
    expect(resolveDispatchCodexBinary('codex', { ...win, env: { PATH: `C:\\other;C:\\Codex` }, ...disk({ 'C:\\other\\codex.cmd': '@echo hi', 'C:\\Codex\\codex.exe': '' }) }))
      .toEqual({ reason: 'first codex on PATH is C:\\other\\codex.cmd (not an npm shim)' })
  })

  it('a custom CLI that is an npm shim is followed the same way; other non-.exe stay unknown', () => {
    const g = globalInstall(NPM)
    expect(resolveDispatchCodexBinary(`${NPM}\\codex.cmd --x`, { ...win, env: {}, ...disk(g.files) })).toEqual({ path: g.exe, via: `${NPM}\\codex.cmd` })
    expect(resolveDispatchCodexBinary('C:\\tools\\codex.cmd', { ...win, env: {}, ...disk({ 'C:\\tools\\codex.cmd': '@echo hi' }) }))
      .toEqual({ reason: 'custom CLI C:\\tools\\codex.cmd (not an npm shim)' })
    expect(resolveDispatchCodexBinary('C:\\tools\\codex.vbs', { ...win, env: {}, isFile: () => true })).toEqual({ reason: 'custom CLI is not an .exe' })
  })

  it('macOS / Linux: unchanged, never reads a file', () => {
    const readFile = vi.fn(() => NPM_GLOBAL_CMD)
    expect(resolveDispatchCodexBinary('codex', { platform: 'linux', env: { PATH: '/usr/local/bin' }, isFile: p => p === '/usr/local/bin/codex', readFile }))
      .toEqual({ path: '/usr/local/bin/codex' })
    expect(resolveDispatchCodexBinary('codex', { platform: 'darwin', env: { PATH: '/opt/homebrew/bin' }, isFile: () => false, readFile }))
      .toEqual({ reason: 'codex not on PATH' })
    expect(readFile).not.toHaveBeenCalled()
  })
})

describe('the shared reader: tab (--no-daemon) and dispatch (OSC) both follow the shim (T0758)', () => {
  function setup(stdout: string) {
    const g = globalInstall(NPM)
    const calls: Array<{ file: string; args: string[]; options: unknown }> = []
    const lines: string[] = []
    const mtime = { value: 1 }
    const execFile: ExecFileLike = (file, args, options, callback) => {
      calls.push({ file, args, options })
      callback(null, stdout, '')
      return undefined
    }
    const deps = {
      platform: 'win32' as const, arch: 'x64', env: { Path: NPM }, ...disk(g.files),
      mtimeMs: (p: string) => (p === g.exe ? mtime.value : 99), execFile, logger: { log: (m: string) => lines.push(m) },
    }
    return { g, calls, lines, mtime, deps }
  }

  it('createCodexNoDaemonSupportCheck: npm codex 0.166.0 → inject; the native exe runs via execFile, no shell', async () => {
    const { g, calls, lines, deps } = setup('codex-cli 0.166.0\n')
    expect(await createCodexNoDaemonSupportCheck(deps)()).toEqual({ inject: true, version: '0.166.0' })
    expect(calls).toEqual([{ file: g.exe, args: ['--version'], options: { timeout: 5_000, windowsHide: true, encoding: 'utf8' } }])
    expect(lines).toEqual([`[codex-version] path=${g.exe} version=0.166.0 (probed) via=${NPM}\\codex.cmd`])
  })

  it('createCodexOscVersionCheck: the dispatched `codex …` → true; cached by the native exe path + mtime', async () => {
    const { calls, lines, mtime, deps } = setup('codex-cli 0.166.0\n')
    const run = createCodexOscVersionCheck(deps)
    expect(await run('codex -c check_for_update_on_startup=false')).toBe(true)
    expect(await run('codex')).toBe(true)
    expect(calls).toHaveLength(1)
    expect(lines[1]).toMatch(/version=0\.166\.0 \(cached\) via=/)
    mtime.value = 2 // npm i -g upgraded codex.exe in place
    expect(await run('codex')).toBe(true)
    expect(calls).toHaveLength(2)
  })

  it('an old npm codex → codex-too-old / no OSC; an unfollowable shim → version-unknown without running anything', async () => {
    const old = setup('codex-cli 0.150.0\n')
    expect(await createCodexNoDaemonSupportCheck(old.deps)()).toEqual({ inject: false, reason: 'codex-too-old', version: '0.150.0' })
    expect(await createCodexOscVersionCheck(old.deps)('codex')).toBe(false)
    const broken = setup('codex-cli 0.166.0\n')
    const execFile = vi.fn()
    const lines: string[] = []
    const deps = { ...broken.deps, ...disk({ [`${NPM}\\codex.cmd`]: '@echo hi' }), execFile, logger: { log: (m: string) => lines.push(m) } }
    expect(await createCodexNoDaemonSupportCheck(deps)()).toEqual({ inject: false, reason: 'version-unknown' })
    expect(execFile).not.toHaveBeenCalled()
    expect(lines).toEqual([`[codex-version] path=- version=unknown (first codex on PATH is ${NPM}\\codex.cmd (not an npm shim))`])
  })
})

describe.runIf(process.platform === 'win32')('default fs deps on a real npm layout (Windows)', () => {
  it('reads the shim from disk and finds the nested codex.exe', async () => {
    const prefix = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0758-'))
    try {
      const g = globalInstall(prefix)
      for (const [file, text] of Object.entries(g.files)) {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, text)
      }
      const calls: string[] = []
      const execFile: ExecFileLike = (file, _args, _options, callback) => {
        calls.push(file)
        callback(null, 'codex-cli 0.166.0', '')
        return undefined
      }
      const run = createCodexNoDaemonSupportCheck({ platform: 'win32', arch: 'x64', env: { Path: prefix }, execFile })
      expect(await run()).toEqual({ inject: true, version: '0.166.0' })
      expect(calls.map(c => c.toLowerCase())).toEqual([g.exe.toLowerCase()])
      // an oversized "shim" is not read
      fs.writeFileSync(path.join(prefix, 'codex.cmd'), `${NPM_GLOBAL_CMD}\r\nrem ${'x'.repeat(70 * 1024)}`)
      fs.rmSync(path.join(prefix, 'codex.ps1'))
      calls.length = 0
      expect(await createCodexNoDaemonSupportCheck({ platform: 'win32', arch: 'x64', env: { Path: prefix }, execFile })()).toEqual({ inject: false, reason: 'version-unknown' })
      expect(calls).toEqual([])
    } finally {
      fs.rmSync(prefix, { recursive: true, force: true })
    }
  })
})
