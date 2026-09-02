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
  describe('safe-character fast path', () => {
    // T0362 AC-4: this character set must stay byte-identical to the private
    // POSIX-only helper it replaced (electron/main.ts shellQuoteForTerminalCommand),
    // so existing Control Tower dispatch prompts keep the exact same wire format.
    it.each([
      ['posix', '/ct-exec'],
      ['pwsh', '/ct-exec'],
      ['cmd', '/ct-exec'],
      ['posix', 'ct-done'],
      ['pwsh', 'T0362'],
      ['cmd', 'a.b_c-d/e=f:g@h'],
    ] satisfies Array<[ShellFamily, string]>)('passes %s arg %s through unquoted', (shell, arg) => {
      expect(quoteArgForShell(arg, shell)).toBe(arg)
    })

    it.each([
      ['posix', '/ct-exec T0362'],
      ['pwsh', '$ct-exec'],
      ['cmd', 'a%b'],
    ] satisfies Array<[ShellFamily, string]>)('does not fast-path %s arg %s', (shell, arg) => {
      expect(quoteArgForShell(arg, shell)).not.toBe(arg)
    })
  })

  describe('posix', () => {
    it.each([
      ['/ct-exec T0362', "'/ct-exec T0362'"],
      ['$ct-exec T0362', "'$ct-exec T0362'"],
      // POSIX single quotes cannot contain a quote; close, escape, reopen.
      ["it's me", "'it'\\''s me'"],
      ['say "hi"', '\'say "hi"\''],
      ['100% done', "'100% done'"],
      ['a & b | c ^ d', "'a & b | c ^ d'"],
      ['C:\\path\\', "'C:\\path\\'"],
    ] satisfies Array<[string, string]>)('quotes %s', (arg, expected) => {
      expect(quoteArgForShell(arg, 'posix')).toBe(expected)
    })
  })

  describe('pwsh', () => {
    it.each([
      ['/ct-exec T0362', "'/ct-exec T0362'"],
      ['$ct-exec T0362', "'$ct-exec T0362'"],
      // PowerShell escapes a single quote by doubling it, not with a backslash.
      ["it's me", "'it''s me'"],
      ["it's O'Brien's", "'it''s O''Brien''s'"],
      ['say "hi"', '\'say "hi"\''],
      ['100% done', "'100% done'"],
      ['a & b | c ^ d', "'a & b | c ^ d'"],
      // Backslashes are literal inside PowerShell single quotes.
      ['C:\\path\\', "'C:\\path\\'"],
    ] satisfies Array<[string, string]>)('quotes %s', (arg, expected) => {
      expect(quoteArgForShell(arg, 'pwsh')).toBe(expected)
    })
  })

  describe('cmd', () => {
    it.each([
      ['/ct-exec T0362', '"/ct-exec T0362"'],
      ['$ct-exec T0362', '"$ct-exec T0362"'],
      ["it's me", '"it\'s me"'],
      ['a b', '"a b"'],
      // T0362 B-2: a quote is escaped as \" (CommandLineToArgvW), never as "".
      ['say "hi"', '"say \\"hi\\""'],
      // One backslash before a quote -> doubled to two, plus one more to escape
      // the quote = three backslashes.
      ['a\\"b', '"a\\\\\\"b"'],
      // Two backslashes before a quote -> doubled to four, plus one = five.
      ['a\\\\"b', '"a\\\\\\\\\\"b"'],
      // A trailing backslash run is doubled so it cannot escape the closing quote.
      ['C:\\path\\', '"C:\\path\\\\"'],
      ['C:\\path\\\\', '"C:\\path\\\\\\\\"'],
      // Backslashes not adjacent to a quote are emitted verbatim.
      ['C:\\path\\file.txt', '"C:\\path\\file.txt"'],
      // T0362 B-1: % is passed through verbatim — %% folds only in batch files,
      // so doubling it would corrupt ordinary prose.
      ['100% done', '"100% done"'],
      ['%USERPROFILE% is set', '"%USERPROFILE% is set"'],
      // The surrounding double quotes already protect cmd metacharacters.
      ['a & b | c ^ d', '"a & b | c ^ d"'],
      ['a<b>c', '"a<b>c"'],
    ] satisfies Array<[string, string]>)('quotes %s', (arg, expected) => {
      expect(quoteArgForShell(arg, 'cmd')).toBe(expected)
    })

    it('never doubles a percent sign', () => {
      expect(quoteArgForShell('50% + 50% = 100%', 'cmd')).not.toContain('%%')
    })
  })
})
