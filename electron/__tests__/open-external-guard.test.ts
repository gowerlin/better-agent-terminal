// @vitest-environment node
/**
 * T0460 / BUG-105: shell:open-external opens local file: paths with shell.openPath,
 * which runs .bat / .exe / .sh files. Executable files now need a main-side confirm.
 */
import { describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  buildExecutableConfirmDialog,
  EXECUTABLE_CONFIRM_CANCEL_INDEX,
  EXECUTABLE_CONFIRM_OPEN_INDEX,
  fileUrlToLocalPath,
  getExecutableConfirmStrings,
  handleOpenExternal,
  isExecutablePath,
  type OpenExternalDeps,
} from '../open-external-guard'

describe('isExecutablePath', () => {
  it.each([
    '.bat', '.cmd', '.com', '.exe', '.msi', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
    '.hta', '.scr', '.pif', '.cpl', '.reg', '.lnk', '.url',
  ])('flags Windows %s (any case)', (ext) => {
    expect(isExecutablePath(`C:\\tmp\\x${ext}`, 'win32')).toBe(true)
    expect(isExecutablePath(`C:\\tmp\\x${ext.toUpperCase()}`, 'win32')).toBe(true)
  })

  it.each(['.app', '.command', '.pkg', '.dmg', '.terminal'])('flags macOS %s (any case)', (ext) => {
    expect(isExecutablePath(`/Users/me/x${ext}`, 'darwin')).toBe(true)
    expect(isExecutablePath(`/Users/me/X${ext.toUpperCase()}`, 'darwin')).toBe(true)
  })

  it.each(['.sh', '.run', '.AppImage', '.desktop'])('flags Linux / generic %s (any case)', (ext) => {
    expect(isExecutablePath(`/home/me/x${ext}`, 'linux')).toBe(true)
    expect(isExecutablePath(`/home/me/x${ext.toLowerCase()}`, 'linux')).toBe(true)
    expect(isExecutablePath(`/home/me/x${ext.toUpperCase()}`, 'linux')).toBe(true)
  })

  it('uses the same list on every platform', () => {
    expect(isExecutablePath('/home/me/x.bat', 'linux')).toBe(true)
    expect(isExecutablePath('C:\\tmp\\x.sh', 'win32')).toBe(true)
  })

  it.each(['x.txt', 'x.md', 'x.png', 'x.pdf', 'x.json', 'x.bat.txt', 'bat', 'x.exe.md'])('does not flag %s', (name) => {
    expect(isExecutablePath(`C:\\tmp\\${name}`, 'win32')).toBe(false)
    expect(isExecutablePath(`/home/me/${name}`, 'linux')).toBe(false)
  })

  it('does not flag a file without an extension when nothing is known about it', () => {
    expect(isExecutablePath('/home/me/Makefile', 'linux')).toBe(false)
    expect(isExecutablePath('/home/me/Makefile', 'linux', null)).toBe(false)
    expect(isExecutablePath('C:\\tmp\\README', 'win32')).toBe(false)
  })

  it('flags an extensionless POSIX file with an execute bit', () => {
    expect(isExecutablePath('/home/me/run-me', 'linux', { isFile: true, mode: 0o100755 })).toBe(true)
    expect(isExecutablePath('/home/me/run-me', 'darwin', { isFile: true, mode: 0o100744 })).toBe(true)
  })

  it('does not flag an extensionless POSIX file without an execute bit, or a directory', () => {
    expect(isExecutablePath('/home/me/notes', 'linux', { isFile: true, mode: 0o100644 })).toBe(false)
    expect(isExecutablePath('/home/me/src', 'linux', { isFile: false, mode: 0o040755 })).toBe(false)
  })

  it('ignores mode bits on Windows', () => {
    expect(isExecutablePath('C:\\tmp\\README', 'win32', { isFile: true, mode: 0o100777 })).toBe(false)
  })

  it('ignores mode bits when the file has a (non-executable) extension', () => {
    expect(isExecutablePath('/home/me/x.txt', 'linux', { isFile: true, mode: 0o100755 })).toBe(false)
  })

  it('sees through Windows trailing dots / spaces and alternate data streams', () => {
    expect(isExecutablePath('C:\\tmp\\x.bat.', 'win32')).toBe(true)
    expect(isExecutablePath('C:\\tmp\\x.bat. . ', 'win32')).toBe(true)
    expect(isExecutablePath('C:\\tmp\\x.bat::$DATA', 'win32')).toBe(true)
    expect(isExecutablePath('C:/tmp/x.exe', 'win32')).toBe(true)
  })
})

describe('fileUrlToLocalPath', () => {
  it('keeps the existing file:/// conversion (drive letter, percent-decoding)', () => {
    expect(fileUrlToLocalPath('file:///C:/Users/me/my%20x.bat', 'win32')).toBe('C:/Users/me/my x.bat')
    expect(fileUrlToLocalPath('file:///home/me/x.sh', 'linux')).toBe('/home/me/x.sh')
  })

  it('accepts other spellings of a local file URL', () => {
    expect(fileUrlToLocalPath('FILE:///C:/x.bat', 'win32')).toBe('C:/x.bat')
    expect(fileUrlToLocalPath('file://localhost/C:/x.bat', 'win32')).toBe('C:/x.bat')
    expect(fileUrlToLocalPath('file:/home/me/x.sh', 'linux')).toBe('/home/me/x.sh')
  })

  it('maps a host to a UNC path on Windows and refuses it elsewhere', () => {
    expect(fileUrlToLocalPath('file://server/share/x.bat', 'win32')).toBe('\\\\server\\share\\x.bat')
    expect(fileUrlToLocalPath('file://server/share/x.sh', 'linux')).toBeNull()
  })

  it('returns null for something that is not a file URL', () => {
    expect(fileUrlToLocalPath('https://example.com/x.bat', 'win32')).toBeNull()
    expect(fileUrlToLocalPath('not a url', 'win32')).toBeNull()
  })
})

function fakeDeps(overrides: Partial<OpenExternalDeps> = {}) {
  const deps = {
    platform: 'win32' as NodeJS.Platform,
    openPath: vi.fn(async (_p: string) => ''),
    openExternal: vi.fn(async (_u: string) => {}),
    exists: vi.fn((_p: string) => true),
    stat: vi.fn((_p: string) => ({ isFile: true, mode: 0o100644 })),
    confirmExecutable: vi.fn(async (_p: string) => false),
    notifyNotFound: vi.fn((_p: string) => {}),
    logError: vi.fn((_m: string) => {}),
    ...overrides,
  }
  return deps
}

describe('handleOpenExternal', () => {
  it('asks before opening an executable, and does not open it on cancel', async () => {
    const deps = fakeDeps({ confirmExecutable: vi.fn(async () => false) })
    await expect(handleOpenExternal('file:///C:/tmp/x.bat', deps)).resolves.toBe('cancelled')
    expect(deps.confirmExecutable).toHaveBeenCalledWith('C:/tmp/x.bat')
    expect(deps.openPath).not.toHaveBeenCalled()
    expect(deps.openExternal).not.toHaveBeenCalled()
  })

  it('opens the executable once the user confirms', async () => {
    const deps = fakeDeps({ confirmExecutable: vi.fn(async () => true) })
    await expect(handleOpenExternal('file:///C:/tmp/x.EXE', deps)).resolves.toBe('opened')
    expect(deps.confirmExecutable).toHaveBeenCalledTimes(1)
    expect(deps.openPath).toHaveBeenCalledWith('C:/tmp/x.EXE')
  })

  it('opens a non-executable file directly, without a dialog', async () => {
    const deps = fakeDeps()
    await expect(handleOpenExternal('file:///C:/tmp/notes.txt', deps)).resolves.toBe('opened')
    expect(deps.confirmExecutable).not.toHaveBeenCalled()
    expect(deps.openPath).toHaveBeenCalledWith('C:/tmp/notes.txt')
  })

  it('asks for an extensionless POSIX file with an execute bit', async () => {
    const deps = fakeDeps({ platform: 'linux', stat: vi.fn(() => ({ isFile: true, mode: 0o100755 })) })
    await expect(handleOpenExternal('file:///home/me/run-me', deps)).resolves.toBe('cancelled')
    expect(deps.confirmExecutable).toHaveBeenCalledWith('/home/me/run-me')
    expect(deps.openPath).not.toHaveBeenCalled()
  })

  it('does not block an extensionless file whose mode cannot be read', async () => {
    const deps = fakeDeps({ platform: 'linux', stat: vi.fn(() => null) })
    await expect(handleOpenExternal('file:///home/me/run-me', deps)).resolves.toBe('opened')
    expect(deps.confirmExecutable).not.toHaveBeenCalled()
  })

  it('routes every spelling of a file URL through the file branch, never openExternal', async () => {
    for (const url of ['FILE:///C:/x.bat', 'file://localhost/C:/x.bat', 'file://server/share/x.bat', ' file:///C:/x.bat']) {
      const deps = fakeDeps()
      await expect(handleOpenExternal(url, deps)).resolves.toBe('cancelled')
      expect(deps.openExternal).not.toHaveBeenCalled()
      expect(deps.openPath).not.toHaveBeenCalled()
    }
  })

  it('refuses a file URL it cannot map to a local path, without openExternal', async () => {
    const deps = fakeDeps({ platform: 'linux' })
    await expect(handleOpenExternal('file://server/share/x.sh', deps)).resolves.toBe('invalid')
    expect(deps.openExternal).not.toHaveBeenCalled()
    expect(deps.openPath).not.toHaveBeenCalled()
    expect(deps.logError).toHaveBeenCalledTimes(1)
  })

  it('reports a missing file without a confirm dialog', async () => {
    const deps = fakeDeps({ exists: vi.fn(() => false) })
    await expect(handleOpenExternal('file:///C:/tmp/gone.bat', deps)).resolves.toBe('not-found')
    expect(deps.notifyNotFound).toHaveBeenCalledWith('C:/tmp/gone.bat')
    expect(deps.confirmExecutable).not.toHaveBeenCalled()
    expect(deps.openPath).not.toHaveBeenCalled()
  })

  it('logs and reports an openPath failure', async () => {
    const deps = fakeDeps({ openPath: vi.fn(async () => 'no app') })
    await expect(handleOpenExternal('file:///C:/tmp/notes.txt', deps)).resolves.toBe('failed')
    expect(deps.logError).toHaveBeenCalledTimes(1)
  })

  it.each(['https://example.com/x.bat', 'http://127.0.0.1:8080/', 'mailto:a@b.c'])('sends %s to openExternal unchanged', async (url) => {
    const deps = fakeDeps()
    await expect(handleOpenExternal(url, deps)).resolves.toBe('opened')
    expect(deps.openExternal).toHaveBeenCalledWith(url)
    expect(deps.openPath).not.toHaveBeenCalled()
    expect(deps.confirmExecutable).not.toHaveBeenCalled()
  })
})

describe('executable confirm dialog', () => {
  it('defaults to Cancel and maps Esc to Cancel', () => {
    const opts = buildExecutableConfirmDialog('C:\\tmp\\x.bat', 'win32', 'en')
    expect(opts.defaultId).toBe(EXECUTABLE_CONFIRM_CANCEL_INDEX)
    expect(opts.cancelId).toBe(EXECUTABLE_CONFIRM_CANCEL_INDEX)
    expect(opts.buttons[EXECUTABLE_CONFIRM_CANCEL_INDEX]).toBe('Cancel')
    expect(opts.buttons[EXECUTABLE_CONFIRM_OPEN_INDEX]).toBe('Open')
    expect(opts.type).toBe('warning')
  })

  it('names the file in the message and the full path in the detail', () => {
    const opts = buildExecutableConfirmDialog('C:/tmp/sub/x.bat', 'win32', 'zh-TW')
    expect(opts.message).toContain('x.bat')
    expect(opts.message).not.toContain('C:/tmp')
    expect(opts.detail).toContain('C:/tmp/sub/x.bat')
    expect(opts.buttons).toEqual(['取消', '開啟'])
  })

  it.each([
    ['en', 'en.json'],
    ['zh-TW', 'zh-TW.json'],
    ['zh-CN', 'zh-CN.json'],
  ])('main-side strings for %s match src/locales/%s', (lang, file) => {
    const locale = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/locales', file), 'utf8'))
    expect(getExecutableConfirmStrings(lang)).toEqual(locale.openExecutableConfirm)
  })

  it('falls back to English for an unknown or missing language', () => {
    expect(getExecutableConfirmStrings(undefined).open).toBe('Open')
    expect(getExecutableConfirmStrings('ja').open).toBe('Open')
  })
})

// Wiring guard: the IPC handler must go through handleOpenExternal (decision in main).
describe('main.ts wiring', () => {
  const mainSource = fs.readFileSync(path.resolve(__dirname, '../main.ts'), 'utf8')

  it('shell:open-external delegates to handleOpenExternal', () => {
    const handler = mainSource.slice(mainSource.indexOf("ipcMain.handle('shell:open-external'"))
    expect(handler.length).toBeGreaterThan(0)
    expect(handler.slice(0, 400)).toContain('handleOpenExternal(')
  })
})
