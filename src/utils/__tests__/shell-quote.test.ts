import { describe, expect, it } from 'vitest'

import { detectShellFamily, quoteArgForShell, quoteCommandPath, type ShellFamily } from '../shell-quote'

describe('detectShellFamily', () => {
  it.each([
    ['/bin/bash', 'posix'],
    ['/bin/zsh', 'posix'],
    ['/bin/sh', 'posix'],
    ['/bin/dash', 'posix'],
    ['/bin/ash', 'posix'],
    ['C:\\Program Files\\Git\\git-bash.exe', 'posix'],
    ['C:\\Program Files\\Git\\bin\\bash.exe', 'posix'],
    ['pwsh', 'pwsh'],
    ['C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'pwsh'],
    ['powershell', 'pwsh'],
    ['C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 'pwsh'],
    ['cmd', 'cmd'],
    ['C:\\Windows\\System32\\cmd.exe', 'cmd'],
    ['fish', 'posix'],
    ['', 'posix'],
  ] satisfies Array<[string, ShellFamily]>)('detects %s as %s', (shellPath, expected) => {
    expect(detectShellFamily(shellPath)).toBe(expected)
  })
})

describe('quoteCommandPath', () => {
  it.each([
    ['posix', '/usr/local/bin/claude', "'/usr/local/bin/claude'"],
    ['posix', '/Applications/Claude Code/bin/claude', "'/Applications/Claude Code/bin/claude'"],
    ['posix', '/opt/BAT (dev)/claude', "'/opt/BAT (dev)/claude'"],
    ['posix', '/tmp/$USER/claude', "'/tmp/$USER/claude'"],
    ['posix', "/tmp/user's/claude", "'/tmp/user'\\''s/claude'"],
    ['posix', 'C:\\Users\\tester\\claude.exe', "'C:\\Users\\tester\\claude.exe'"],
    ['pwsh', 'C:\\Users\\tester\\claude.exe', "& 'C:\\Users\\tester\\claude.exe'"],
    ['pwsh', 'C:\\Program Files\\Claude\\claude.exe', "& 'C:\\Program Files\\Claude\\claude.exe'"],
    ['pwsh', 'C:\\Tools\\BAT (dev)\\claude.exe', "& 'C:\\Tools\\BAT (dev)\\claude.exe'"],
    ['pwsh', 'C:\\Users\\$USER\\claude.exe', "& 'C:\\Users\\$USER\\claude.exe'"],
    ['pwsh', "C:\\Users\\O'Brien\\claude.exe", "& 'C:\\Users\\O''Brien\\claude.exe'"],
    ['pwsh', '/usr/local/bin/claude', "& '/usr/local/bin/claude'"],
    ['cmd', 'C:\\Users\\tester\\claude.exe', '"C:\\Users\\tester\\claude.exe"'],
    ['cmd', 'C:\\Program Files\\Claude\\claude.exe', '"C:\\Program Files\\Claude\\claude.exe"'],
    ['cmd', 'C:\\Tools\\BAT (dev)\\claude.exe', '"C:\\Tools\\BAT (dev)\\claude.exe"'],
    ['cmd', 'C:\\Users\\$USER\\claude.exe', '"C:\\Users\\$USER\\claude.exe"'],
    ['cmd', "C:\\Users\\O'Brien\\claude.exe", '"C:\\Users\\O\'Brien\\claude.exe"'],
    ['cmd', '/usr/local/bin/claude', '"/usr/local/bin/claude"'],
  ] satisfies Array<[ShellFamily, string, string]>)('quotes %s path %s', (shell, path, expected) => {
    expect(quoteCommandPath(path, shell)).toBe(expected)
  })
})

describe('quoteArgForShell', () => {
  it.each([
    ['posix', '/ct-exec T0056', "'/ct-exec T0056'"],
    ['posix', 'say "hi"', `'say "hi"'`],
    ['posix', '$ct-exec T0056', "'$ct-exec T0056'"],
    ['posix', "it's me", "'it'\\''s me'"],
    ['posix', 'say `whoami`', "'say `whoami`'"],
    ['posix', 'ct-exec', 'ct-exec'],
    ['pwsh', '/ct-exec T0056', "'/ct-exec T0056'"],
    ['pwsh', '$ct-exec T0056', "'$ct-exec T0056'"],
    ['pwsh', "it's me", "'it''s me'"],
    ['cmd', '/ct-exec T0056', '"/ct-exec T0056"'],
    ['cmd', 'say "hi"', '"say ""hi"""'],
    ['cmd', '100% done', '"100%% done"'],
    ['cmd', "it's me", '"it\'s me"'],
    ['cmd', 'ct-exec', 'ct-exec'],
  ] satisfies Array<[ShellFamily, string, string]>)('quotes %s arg %s', (shell, arg, expected) => {
    expect(quoteArgForShell(arg, shell)).toBe(expected)
  })
})
