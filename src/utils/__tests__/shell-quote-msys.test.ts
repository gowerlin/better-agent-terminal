/**
 * T0946 / BUG-228: Git Bash (MSYS) rewrites a native program's argument that starts with `/`
 * (`/control-tower` → `C:/Program Files/Git/control-tower`). `msysArgConvExclusionPrefix`
 * (src/utils/shell-quote.ts) gives the assignment in front of one command that keeps that argument.
 *
 * - detection from the shell path only: Windows Git Bash / MSYS2 / Cygwin paths yes; pwsh, cmd,
 *   POSIX paths (macOS / Linux / remote), WSL launchers, bare names no
 * - the prefix shape, escaping, `;`
 * - a real Git Bash on Windows (skipped elsewhere / without Git): without the prefix the argument is
 *   rewritten, with it the argument arrives unchanged and the other arguments are still converted
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { isWindowsMsysShell, msysArgConvExclusionPrefix, quoteArgForShell, quoteCommandPath } from '../shell-quote'

const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'
const PREFIX = 'MSYS2_ARG_CONV_EXCL="/control-tower${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"'

describe('isWindowsMsysShell (T0946)', () => {
  it.each([
    GIT_BASH,
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'C:\\Users\\demo\\AppData\\Local\\Programs\\Git\\bin\\bash.exe',
    'C:/Program Files/Git/usr/bin/bash.exe',
    '"C:\\Program Files\\Git\\bin\\bash.exe"',
    'C:\\msys64\\usr\\bin\\bash.exe',
    'C:\\msys64\\usr\\bin\\zsh.exe',
    'C:\\cygwin64\\bin\\sh.exe',
    'D:\\tools\\Git\\bin\\BASH.EXE',
    '\\\\server\\share\\Git\\bin\\bash.exe',
  ])('Windows POSIX shell → true: %s', (shell) => {
    expect(isWindowsMsysShell(shell)).toBe(true)
  })

  it.each([
    undefined, null, '',
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'powershell.exe',
    'cmd.exe',
    'C:\\Windows\\System32\\cmd.exe',
    'C:\\Windows\\System32\\bash.exe',
    'C:\\WINDOWS\\Sysnative\\bash.exe',
    'C:\\Users\\demo\\AppData\\Local\\Microsoft\\WindowsApps\\bash.exe',
    'C:\\Windows\\System32\\wsl.exe',
    'wsl.exe',
    'bash.exe',
    'bash',
    '/bin/bash',
    '/bin/zsh',
    '/usr/local/bin/bash',
    '/opt/homebrew/bin/bash',
    '/bin/sh',
  ])('not an MSYS shell → false: %s', (shell) => {
    expect(isWindowsMsysShell(shell)).toBe(false)
  })
})

describe('msysArgConvExclusionPrefix (T0946)', () => {
  it('Git Bash + an argument starting with `/` → the one-command assignment, keeping an existing value', () => {
    expect(msysArgConvExclusionPrefix('/control-tower', GIT_BASH)).toBe(PREFIX)
    expect(msysArgConvExclusionPrefix('/ct-exec T0946', GIT_BASH)).toBe('MSYS2_ARG_CONV_EXCL="/ct-exec T0946${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"')
  })

  it('characters special inside bash double quotes are escaped; `;` (list separator) ends the entry', () => {
    expect(msysArgConvExclusionPrefix('/a"b$c`d\\e', GIT_BASH)).toBe('MSYS2_ARG_CONV_EXCL="/a\\"b\\$c\\`d\\\\e${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"')
    expect(msysArgConvExclusionPrefix('/a;b', GIT_BASH)).toBe('MSYS2_ARG_CONV_EXCL="/a${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"')
  })

  it('no prefix for an argument that does not start with `/`, or any other shell', () => {
    expect(msysArgConvExclusionPrefix('$ct-exec T0946', GIT_BASH)).toBeNull()
    expect(msysArgConvExclusionPrefix('control-tower', GIT_BASH)).toBeNull()
    for (const shell of ['C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'cmd.exe', '/bin/bash', '/bin/zsh', 'C:\\Windows\\System32\\wsl.exe', 'C:\\Windows\\System32\\bash.exe', undefined]) {
      expect(msysArgConvExclusionPrefix('/control-tower', shell)).toBeNull()
    }
  })
})

// A real Git Bash: what the native program (node) receives.
const realGitBash = process.platform === 'win32' && fs.existsSync(GIT_BASH)

describe.skipIf(!realGitBash)('real Git Bash on Windows (T0946)', () => {
  let dir = ''
  let script = ''

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0946-'))
    script = path.join(dir, 'argv.js')
    fs.writeFileSync(script, 'console.log(JSON.stringify({ argv: process.argv.slice(2), excl: process.env.MSYS2_ARG_CONV_EXCL ?? null }))\n')
  })
  afterAll(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  /** Runs `command` in a non-login Git Bash without the conversion switches of this environment. */
  function runRaw(command: string, extraEnv: Record<string, string> = {}): string {
    const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv }
    if (!('MSYS_NO_PATHCONV' in extraEnv)) delete env.MSYS_NO_PATHCONV
    if (!('MSYS2_ARG_CONV_EXCL' in extraEnv)) delete env.MSYS2_ARG_CONV_EXCL
    return execFileSync(GIT_BASH, ['-c', command], { env, encoding: 'utf8', timeout: 30_000 })
  }

  function run(command: string, extraEnv: Record<string, string> = {}): { argv: string[]; excl: string | null } {
    return JSON.parse(runRaw(command, extraEnv).trim().split('\n').pop()!)
  }

  function launch(arg: string, withPrefix: boolean): string {
    const parts = [quoteCommandPath(process.execPath, 'posix'), quoteArgForShell(script, 'posix'), '/tmp', quoteArgForShell(arg, 'posix')]
    const prefix = withPrefix ? msysArgConvExclusionPrefix(arg, GIT_BASH) : null
    return [...(prefix ? [prefix] : []), ...parts].join(' ')
  }

  it('without the prefix Git Bash rewrites /control-tower and /ct-exec T#### (the BUG-228 root cause)', () => {
    expect(run(launch('/control-tower', false)).argv[1]).not.toBe('/control-tower')
    expect(run(launch('/control-tower', false)).argv[1]).toMatch(/^[A-Za-z]:\/.*\/control-tower$/)
    expect(run(launch('/ct-exec T0946', false)).argv[1]).toMatch(/^[A-Za-z]:\/.*\/ct-exec T0946$/)
  })

  it('with the prefix the argument arrives unchanged; the other arguments are still converted', () => {
    const got = run(launch('/control-tower', true))
    expect(got.argv[1]).toBe('/control-tower')
    expect(got.argv[0]).toMatch(/^[A-Za-z]:\//) // `/tmp` still converted
    expect(run(launch('/ct-exec T0946', true)).argv[1]).toBe('/ct-exec T0946')
  })

  it('an existing MSYS2_ARG_CONV_EXCL is kept for the program; the shell variable is not changed afterwards', () => {
    const got = run(launch('/control-tower', true), { MSYS2_ARG_CONV_EXCL: '--keep=' })
    expect(got.argv[1]).toBe('/control-tower')
    expect(got.excl).toBe('/control-tower;--keep=')
    expect(runRaw(`${launch('/control-tower', true)} >/dev/null; printf '%s' "\${MSYS2_ARG_CONV_EXCL-unset}"`)).toBe('unset')
    expect(runRaw(`${launch('/control-tower', true)} >/dev/null; printf '%s' "\${MSYS2_ARG_CONV_EXCL-unset}"`, { MSYS2_ARG_CONV_EXCL: '--keep=' })).toBe('--keep=')
  })

  it('with MSYS_NO_PATHCONV=1 already set (helper-dispatched Worker tabs) the argument is unchanged with or without the prefix', () => {
    expect(run(launch('/control-tower', true), { MSYS_NO_PATHCONV: '1' }).argv[1]).toBe('/control-tower')
    expect(run(launch('/ct-exec T0946', false), { MSYS_NO_PATHCONV: '1' }).argv[1]).toBe('/ct-exec T0946')
  })
})
