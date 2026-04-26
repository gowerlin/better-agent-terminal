import test from 'node:test'
import assert from 'node:assert/strict'
import { winToWsl, wslToWin } from '../src/utils/wsl-path'

const DISTRO = 'Ubuntu'

const winToWslCases = [
  ['basic drive', 'C:\\foo\\bar', '/mnt/c/foo/bar'],
  ['lowercase drive', 'c:\\foo\\bar', '/mnt/c/foo/bar'],
  ['path with spaces', 'C:\\Program Files\\BAT', '/mnt/c/Program Files/BAT'],
  ['chinese path', 'C:\\使用者\\專案\\檔案.txt', '/mnt/c/使用者/專案/檔案.txt'],
  ['unc wsl legacy', '\\\\wsl$\\Ubuntu\\home\\user\\repo', '/home/user/repo'],
  ['unc wsl localhost', '\\\\wsl.localhost\\Ubuntu\\home\\user\\repo', '/home/user/repo'],
  ['distro case insensitive', '\\\\wsl.localhost\\uBuNtU\\home\\user\\repo', '/home/user/repo'],
  ['long path prefix', '\\\\?\\C:\\very\\long\\path', '/mnt/c/very/long/path'],
  ['unknown path passthrough', '\\\\server\\share\\file.txt', '\\\\server\\share\\file.txt'],
] as const

const wslToWinCases = [
  ['basic mount path', '/mnt/c/foo/bar', 'C:\\foo\\bar'],
  ['root mount path', '/mnt/c/', 'C:\\'],
  ['reverse to distro path', '/home/user/repo', '\\\\wsl.localhost\\Ubuntu\\home\\user\\repo'],
  ['path with spaces', '/mnt/c/Program Files/BAT', 'C:\\Program Files\\BAT'],
  ['chinese path', '/mnt/d/使用者/專案', 'D:\\使用者\\專案'],
  ['unknown path passthrough', 'C:\\already\\windows', 'C:\\already\\windows'],
] as const

for (const [name, input, expected] of winToWslCases) {
  test(`winToWsl: ${name}`, () => {
    assert.equal(winToWsl(input, DISTRO), expected)
  })
}

for (const [name, input, expected] of wslToWinCases) {
  test(`wslToWin: ${name}`, () => {
    assert.equal(wslToWin(input, DISTRO), expected)
  })
}

for (const [name, input] of [
  ['drive round-trip uppercase', 'C:\\Users\\Gower\\repo'],
  ['drive round-trip lowercase input normalizes', 'c:\\Users\\Gower\\repo'],
  ['spaces round-trip', 'C:\\Program Files\\BAT\\repo'],
  ['chinese round-trip', 'D:\\使用者\\專案\\檔案.txt'],
  ['unc legacy round-trip becomes localhost', '\\\\wsl$\\Ubuntu\\home\\user\\repo'],
  ['unc localhost round-trip', '\\\\wsl.localhost\\Ubuntu\\home\\user\\repo'],
] as const) {
  test(`round-trip: ${name}`, () => {
    const serverPath = winToWsl(input, DISTRO)
    const clientPath = wslToWin(serverPath, DISTRO)
    if (WIN_DRIVE_LIKE.test(input.replace('\\\\?\\', ''))) {
      const normalizedInput = input.replace('\\\\?\\', '').replace(/^[a-z]:/, (drive) => drive.toUpperCase())
      assert.equal(clientPath, normalizedInput)
      return
    }

    const expected = input.startsWith('\\\\wsl$\\')
      ? input.replace('\\\\wsl$\\Ubuntu', '\\\\wsl.localhost\\Ubuntu')
      : input
    assert.equal(clientPath, expected)
  })
}

const WIN_DRIVE_LIKE = /^[A-Za-z]:/
