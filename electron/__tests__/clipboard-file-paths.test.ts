// @vitest-environment node
/**
 * T0522 / BUG-128: `clipboard:read-file-paths` — Finder-copied items as POSIX paths (macOS).
 * Renderer side: src/__tests__/terminal-paste-shortcuts.test.tsx.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, test, vi } from 'vitest'
import { filePathFromFileUrl, parseFilenamesPlist, readClipboardFilePaths } from '../clipboard-file-paths'
import { ALWAYS_LOCAL_CHANNELS } from '../remote/headless-channel-status'
import { PATH_ARG_SCHEMA } from '../remote/path-aware-channels'
import { PROXIED_CHANNELS } from '../remote/protocol'

const plist = (paths: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
${paths.map(p => `\t<string>${p}</string>`).join('\n')}
</array>
</plist>
`

function fakeClipboard(formats: Record<string, string>) {
  return { read: vi.fn((format: string) => formats[format] ?? '') }
}

describe('parseFilenamesPlist', () => {
  test('every item, in order, with XML entities decoded', () => {
    expect(parseFilenamesPlist(plist([
      '/Users/tester/Desktop/My Report.pdf',
      "/Users/tester/it&apos;s here/a &amp; b.txt",
      '/Users/tester/文件/截圖 1.png',
      '/Volumes/Data/folder',
    ]))).toEqual([
      '/Users/tester/Desktop/My Report.pdf',
      "/Users/tester/it's here/a & b.txt",
      '/Users/tester/文件/截圖 1.png',
      '/Volumes/Data/folder',
    ])
  })

  test('numeric entities and a trailing NUL', () => {
    expect(parseFilenamesPlist(`${plist(['/tmp/a&#38;b&#x27;c'])}\0`)).toEqual(["/tmp/a&b'c"])
  })

  test('empty, non-plist, binary plist and relative entries → []', () => {
    expect(parseFilenamesPlist('')).toEqual([])
    expect(parseFilenamesPlist('report.pdf')).toEqual([])
    expect(parseFilenamesPlist('bplist00Ô\u0001\u0002')).toEqual([])
    expect(parseFilenamesPlist(plist(['relative/path', '']))).toEqual([])
  })
})

describe('filePathFromFileUrl', () => {
  test('percent-decoded POSIX path', () => {
    expect(filePathFromFileUrl('file:///Users/tester/My%20Report.pdf')).toBe('/Users/tester/My Report.pdf')
    expect(filePathFromFileUrl('file:///Users/tester/%E6%96%87%E4%BB%B6/')).toBe('/Users/tester/文件/')
    expect(filePathFromFileUrl('file://localhost/tmp/a.txt\0')).toBe('/tmp/a.txt')
  })

  test('file reference URLs, other schemes and junk → null', () => {
    expect(filePathFromFileUrl('file:///.file/id=6571367.12345')).toBeNull()
    expect(filePathFromFileUrl('https://example.com/a.txt')).toBeNull()
    expect(filePathFromFileUrl('')).toBeNull()
    expect(filePathFromFileUrl('report.pdf')).toBeNull()
  })
})

describe('readClipboardFilePaths', () => {
  test('macOS: NSFilenamesPboardType list wins (multi-select)', () => {
    const clipboard = fakeClipboard({
      NSFilenamesPboardType: plist(['/Users/tester/a.txt', '/Users/tester/b c.txt']),
      'public.file-url': 'file:///Users/tester/a.txt',
    })
    expect(readClipboardFilePaths(clipboard, 'darwin')).toEqual(['/Users/tester/a.txt', '/Users/tester/b c.txt'])
  })

  test('macOS: falls back to public.file-url when the list is absent', () => {
    const clipboard = fakeClipboard({ 'public.file-url': 'file:///Users/tester/My%20Folder' })
    expect(readClipboardFilePaths(clipboard, 'darwin')).toEqual(['/Users/tester/My Folder'])
    expect(clipboard.read).toHaveBeenCalledWith('NSFilenamesPboardType')
  })

  test('macOS: text-only clipboard → []', () => {
    expect(readClipboardFilePaths(fakeClipboard({ 'public.utf8-plain-text': 'hello' }), 'darwin')).toEqual([])
  })

  test('Windows / Linux: [] without touching the clipboard', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const clipboard = fakeClipboard({ NSFilenamesPboardType: plist(['/x']) })
      expect(readClipboardFilePaths(clipboard, platform)).toEqual([])
      expect(clipboard.read).not.toHaveBeenCalled()
    }
  })
})

describe('wiring: local-only, no renderer arguments', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8')
  const CHANNEL = 'clipboard:read-file-paths'

  test('main registers it with ipcMain.handle inside registerLocalHandlers, taking no arguments', () => {
    const main = read('main.ts')
    const start = main.indexOf('function registerLocalHandlers()')
    expect(start).toBeGreaterThan(-1)
    const body = main.slice(start, main.indexOf('\n}\n', start))
    expect(body).toContain("ipcMain.handle('clipboard:read-file-paths', () => readClipboardFilePaths(clipboard, process.platform))")
  })

  test('preload invokes it without arguments', () => {
    expect(read('preload.ts')).toContain("readFilePaths: () => ipcRenderer.invoke('clipboard:read-file-paths') as Promise<string[]>,")
  })

  test('not proxied: absent from PROXIED_CHANNELS / ALWAYS_LOCAL_CHANNELS / path tables', () => {
    expect(PROXIED_CHANNELS.has(CHANNEL)).toBe(false)
    expect(ALWAYS_LOCAL_CHANNELS.has(CHANNEL)).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(PATH_ARG_SCHEMA, CHANNEL)).toBe(false)
  })
})
