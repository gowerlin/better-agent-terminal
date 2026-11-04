import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  decodeIniBuffer,
  encodeIniText,
  formatIniBackupStamp,
  getIniValue,
  iniBackupPath,
  setIniValue,
} from '../ini-line-editor'

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`)
  return result as Extract<T, { ok: true }>
}

describe('T0838 ini-line-editor', () => {
  describe('setIniValue() — replace in place', () => {
    it('changes only the value of the target line (LF)', () => {
      const text = '# my distro\n[boot]\nsystemd=false\ncommand = echo hi\n\n[user]\ndefault=gower\n'
      const result = ok(setIniValue(text, 'boot', 'systemd', 'true'))
      expect(result).toMatchObject({ changed: true, action: 'replaced', line: 3, ignoredDuplicateLines: [] })
      expect(result.text).toBe('# my distro\n[boot]\nsystemd=true\ncommand = echo hi\n\n[user]\ndefault=gower\n')
    })

    it('keeps CRLF line endings and a file without a final newline', () => {
      const text = '[wsl2]\r\nmemory=8GB\r\nnetworkingMode=nat'
      const result = ok(setIniValue(text, 'wsl2', 'networkingMode', 'mirrored'))
      expect(result.text).toBe('[wsl2]\r\nmemory=8GB\r\nnetworkingMode=mirrored')
    })

    it('keeps indentation, spacing around =, trailing spaces and a trailing # comment', () => {
      const text = '[boot]\n  systemd = false   # set by hand\n'
      expect(ok(setIniValue(text, 'boot', 'systemd', 'true')).text).toBe('[boot]\n  systemd = true   # set by hand\n')
    })

    it('keeps quotes when the old value was quoted, and a # inside quotes is not a comment', () => {
      expect(ok(setIniValue('[wsl2]\nnetworkingMode="nat"\n', 'wsl2', 'networkingMode', 'mirrored')).text).toBe(
        '[wsl2]\nnetworkingMode="mirrored"\n',
      )
      const text = '[boot]\ncommand="echo #1" # note\n'
      expect(ok(getIniValue(text, 'boot', 'command')).value).toBe('echo #1')
      expect(ok(setIniValue(text, 'boot', 'command', 'date')).text).toBe('[boot]\ncommand="date" # note\n')
    })

    it('matches section and key case-insensitively (WSL strcasecmp) and keeps the file spelling', () => {
      const text = '[WSL2]\nNetworkingMode=NAT\n'
      const result = ok(setIniValue(text, 'wsl2', 'networkingMode', 'mirrored'))
      expect(result.text).toBe('[WSL2]\nNetworkingMode=mirrored\n')
    })

    it('reports unchanged when the value is already set (case-sensitive compare), text identical', () => {
      const text = '[boot]\r\nsystemd=true\r\n'
      expect(setIniValue(text, 'boot', 'systemd', 'true')).toEqual({
        ok: true,
        text,
        changed: false,
        action: 'unchanged',
        line: 2,
        ignoredDuplicateLines: [],
      })
      expect(ok(setIniValue('[boot]\nsystemd=True\n', 'boot', 'systemd', 'true')).changed).toBe(true)
    })

    it('leaves comments (# and ;), blank lines, unknown keys and order untouched', () => {
      const text = [
        '; old style comment',
        '[wsl2]',
        '# networkingMode=mirrored',
        'kernelCommandLine = quiet',
        'someFutureKey=1',
        '',
        '[experimental]',
        'autoMemoryReclaim=gradual',
        'networkingMode=nat',
        '[wsl2]',
        '',
      ].join('\n')
      const result = ok(setIniValue(text, 'experimental', 'networkingMode', 'mirrored'))
      expect(result.text).toBe(text.replace('autoMemoryReclaim=gradual\nnetworkingMode=nat', 'autoMemoryReclaim=gradual\nnetworkingMode=mirrored'))
    })
  })

  describe('setIniValue() — duplicates (WSL: first occurrence wins)', () => {
    it('changes the first occurrence only and reports later ones', () => {
      const text = '[boot]\nsystemd=false\nsystemd=true\n'
      const result = ok(setIniValue(text, 'boot', 'systemd', 'true'))
      expect(result.text).toBe('[boot]\nsystemd=true\nsystemd=true\n')
      expect(result.ignoredDuplicateLines).toEqual([3])
    })

    it('counts repeated section blocks as the same section', () => {
      const text = '[boot]\nsystemd=false\n[user]\ndefault=root\n[Boot]\nSystemd=false\n'
      const result = ok(setIniValue(text, 'boot', 'systemd', 'true'))
      expect(result.text).toBe('[boot]\nsystemd=true\n[user]\ndefault=root\n[Boot]\nSystemd=false\n')
      expect(result.ignoredDuplicateLines).toEqual([6])
      expect(ok(getIniValue(text, 'boot', 'systemd'))).toEqual({ ok: true, value: 'false', line: 2 })
    })

    it('reports duplicates even when the first value is already right', () => {
      const result = ok(setIniValue('[boot]\nsystemd=true\nsystemd=false\n', 'boot', 'systemd', 'true'))
      expect(result).toMatchObject({ changed: false, action: 'unchanged', ignoredDuplicateLines: [3] })
    })
  })

  describe('setIniValue() — adding', () => {
    it('adds a missing key after the last key of the section (before trailing comments / next header)', () => {
      const text = '[boot]\nsystemd=false\n\n# user settings\n[user]\ndefault=gower\n'
      const result = ok(setIniValue(text, 'user', 'default', 'gower'))
      expect(result.changed).toBe(false)
      const added = ok(setIniValue(text, 'boot', 'command', 'date'))
      expect(added).toMatchObject({ action: 'added-key', line: 3 })
      expect(added.text).toBe('[boot]\nsystemd=false\ncommand=date\n\n# user settings\n[user]\ndefault=gower\n')
    })

    it('adds right after the header when the section has no keys, copying CRLF', () => {
      const text = '[boot]\r\n# nothing yet\r\n[user]\r\ndefault=gower\r\n'
      expect(ok(setIniValue(text, 'boot', 'systemd', 'true')).text).toBe(
        '[boot]\r\nsystemd=true\r\n# nothing yet\r\n[user]\r\ndefault=gower\r\n',
      )
    })

    it('copies the indentation of the previous key', () => {
      expect(ok(setIniValue('[wsl2]\n    memory=8GB\n', 'wsl2', 'swap', '0')).text).toBe('[wsl2]\n    memory=8GB\n    swap=0\n')
    })

    it('adds to the first block of a repeated section', () => {
      const text = '[wsl2]\nmemory=8GB\n[general]\ninstanceIdleTimeout=60000\n[wsl2]\nswap=0\n'
      expect(ok(setIniValue(text, 'wsl2', 'networkingMode', 'mirrored')).text).toBe(
        '[wsl2]\nmemory=8GB\nnetworkingMode=mirrored\n[general]\ninstanceIdleTimeout=60000\n[wsl2]\nswap=0\n',
      )
    })

    it('adds a key at the end of a file whose last line has no newline', () => {
      expect(ok(setIniValue('[boot]\nsystemd=false', 'boot', 'command', 'date')).text).toBe('[boot]\nsystemd=false\ncommand=date')
    })

    it('appends a missing section at the end of the file, separated by a blank line', () => {
      const result = ok(setIniValue('[wsl2]\r\nmemory=8GB\r\n', 'boot', 'systemd', 'true'))
      expect(result).toMatchObject({ action: 'added-section', line: 5 })
      expect(result.text).toBe('[wsl2]\r\nmemory=8GB\r\n\r\n[boot]\r\nsystemd=true\r\n')
      expect(ok(setIniValue('[wsl2]\nmemory=8GB\n\n', 'boot', 'systemd', 'true')).text).toBe(
        '[wsl2]\nmemory=8GB\n\n[boot]\nsystemd=true\n',
      )
      expect(ok(setIniValue('[wsl2]\nmemory=8GB', 'boot', 'systemd', 'true')).text).toBe(
        '[wsl2]\nmemory=8GB\n\n[boot]\nsystemd=true',
      )
    })

    it('creates the content of an empty file', () => {
      expect(ok(setIniValue('', 'boot', 'systemd', 'true')).text).toBe('[boot]\nsystemd=true\n')
      expect(ok(setIniValue('\uFEFF', 'boot', 'systemd', 'true')).text).toBe('\uFEFF[boot]\nsystemd=true\n')
    })

    it('keeps a leading BOM character in the text', () => {
      expect(ok(setIniValue('\uFEFF[boot]\nsystemd=false\n', 'boot', 'systemd', 'true')).text).toBe('\uFEFF[boot]\nsystemd=true\n')
    })
  })

  describe('setIniValue() — failures (caller must not write)', () => {
    it('rejects invalid names and values', () => {
      expect(setIniValue('', 'wsl 2', 'x', '1')).toMatchObject({ ok: false, reason: 'invalid-section' })
      expect(setIniValue('', 'boot', 'sys-temd', '1')).toMatchObject({ ok: false, reason: 'invalid-key' })
      for (const value of ['', ' true', 'true ', 'a#b', 'a"b', 'a\\b', 'a\nb', 'a\rb', 'a\0b']) {
        expect(setIniValue('', 'boot', 'systemd', value)).toMatchObject({ ok: false, reason: 'invalid-value' })
      }
      expect(ok(setIniValue('', 'automount', 'options', 'metadata,umask=22')).text).toBe('[automount]\noptions=metadata,umask=22\n')
    })

    it('rejects a file with a line it cannot classify, naming the line', () => {
      expect(setIniValue('[boot\nsystemd=false\n', 'boot', 'systemd', 'true')).toMatchObject({ ok: false, reason: 'unparsable-line', line: 1 })
      expect(setIniValue('[boot]\nsystemd\n', 'boot', 'systemd', 'true')).toMatchObject({ ok: false, reason: 'unparsable-line', line: 2 })
      expect(setIniValue('[boot]\n=true\n', 'boot', 'systemd', 'true')).toMatchObject({ ok: false, reason: 'unparsable-line', line: 2 })
      expect(setIniValue('[bo-ot]\n', 'boot', 'systemd', 'true')).toMatchObject({ ok: false, reason: 'unparsable-line', line: 1 })
    })

    it('rejects an unclosed quote on the target line', () => {
      expect(setIniValue('[boot]\nsystemd="false\n', 'boot', 'systemd', 'true')).toMatchObject({ ok: false, reason: 'unparsable-line', line: 2 })
      // An unclosed quote on another line does not block (WSL ignores that line).
      expect(ok(setIniValue('[boot]\ncommand="x\nsystemd=false\n', 'boot', 'systemd', 'true')).text).toBe('[boot]\ncommand="x\nsystemd=true\n')
    })

    it('rejects a \\ line continuation anywhere (it could swallow the next header)', () => {
      expect(setIniValue('[boot]\ncommand=echo \\\n[user]\ndefault=root\n', 'user', 'default', 'gower')).toMatchObject({
        ok: false,
        reason: 'line-continuation',
        line: 2,
      })
    })

    it('does not change the input on failure', () => {
      const result = setIniValue('[boot\n', 'boot', 'systemd', 'true')
      expect(result.ok).toBe(false)
      expect('text' in result).toBe(false)
    })
  })

  describe('getIniValue()', () => {
    it('returns null for a missing key and the first value otherwise', () => {
      expect(getIniValue('[boot]\n', 'boot', 'systemd')).toEqual({ ok: true, value: null, line: null })
      expect(getIniValue('[boot]\n  systemd = true # yes\n', 'BOOT', 'SYSTEMD')).toEqual({ ok: true, value: 'true', line: 2 })
      expect(getIniValue('[boot]\nsystemd=\n', 'boot', 'systemd')).toEqual({ ok: true, value: '', line: 2 })
    })
  })

  describe('decodeIniBuffer() / encodeIniText()', () => {
    const text = '[wsl2]\r\nnetworkingMode=nat # 中文註解\r\n'

    it.each([
      ['utf8', Buffer.from(text, 'utf8')],
      ['utf8-bom', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')])],
      ['utf16le-bom', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])],
      ['utf16le', Buffer.from(text, 'utf16le')],
    ] as const)('detects %s, decodes without BOM and encodes back byte for byte', (encoding, bytes) => {
      const decoded = ok(decodeIniBuffer(bytes))
      expect(decoded).toEqual({ ok: true, text, encoding })
      expect(encodeIniText(decoded.text, decoded.encoding).equals(bytes)).toBe(true)
    })

    it('detects UTF-16 BE with BOM and round-trips', () => {
      const le = Buffer.from(text, 'utf16le')
      const be = Buffer.alloc(le.length)
      for (let i = 0; i < le.length; i += 2) {
        be[i] = le[i + 1]
        be[i + 1] = le[i]
      }
      const bytes = Buffer.concat([Buffer.from([0xfe, 0xff]), be])
      const decoded = ok(decodeIniBuffer(bytes))
      expect(decoded).toEqual({ ok: true, text, encoding: 'utf16be-bom' })
      expect(encodeIniText(decoded.text, decoded.encoding).equals(bytes)).toBe(true)
    })

    it('edits a UTF-16 LE .wslconfig end to end, keeping the encoding', () => {
      const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
      const decoded = ok(decodeIniBuffer(bytes))
      const edited = ok(setIniValue(decoded.text, 'wsl2', 'networkingMode', 'mirrored'))
      const out = encodeIniText(edited.text, decoded.encoding)
      expect(out.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))).toBe(true)
      expect(out.subarray(2).toString('utf16le')).toBe('[wsl2]\r\nnetworkingMode=mirrored # 中文註解\r\n')
    })

    it('treats an empty buffer as UTF-8 and never adds a BOM the file did not have', () => {
      expect(decodeIniBuffer(Buffer.alloc(0))).toEqual({ ok: true, text: '', encoding: 'utf8' })
      expect(encodeIniText('\uFEFFa=1', 'utf8').toString('utf8')).toBe('a=1')
    })

    it('fails on invalid UTF-8 and odd-length UTF-16', () => {
      expect(decodeIniBuffer(Buffer.from([0x61, 0xff, 0x62]))).toMatchObject({ ok: false, reason: 'invalid-encoding' })
      expect(decodeIniBuffer(Buffer.from([0xff, 0xfe, 0x61]))).toMatchObject({ ok: false, reason: 'invalid-encoding' })
    })
  })

  describe('backup file name', () => {
    it('formats YYYYMMDD-HHMMSS from the caller time (local fields)', () => {
      expect(formatIniBackupStamp(new Date(2026, 10, 4, 9, 5, 7))).toBe('20261104-090507')
      expect(() => formatIniBackupStamp(new Date(Number.NaN))).toThrow(/Invalid backup time/)
    })

    it('appends .bat-backup-<stamp> to Windows and Linux paths', () => {
      const at = new Date(2026, 0, 2, 23, 59, 58)
      expect(iniBackupPath('C:\\Users\\me\\.wslconfig', at)).toBe('C:\\Users\\me\\.wslconfig.bat-backup-20260102-235958')
      expect(iniBackupPath('/etc/wsl.conf', '20261104-092112')).toBe('/etc/wsl.conf.bat-backup-20261104-092112')
    })

    it('rejects bad stamps and non-file paths', () => {
      expect(() => iniBackupPath('/etc/wsl.conf', '2026-11-04')).toThrow(/YYYYMMDD-HHMMSS/)
      expect(() => iniBackupPath('', '20261104-092112')).toThrow()
      expect(() => iniBackupPath('/etc/', '20261104-092112')).toThrow()
      expect(() => iniBackupPath('/etc/wsl.conf\n', '20261104-092112')).toThrow()
    })
  })

  it('stays a pure module: no electron, fs, child_process or clock', () => {
    const source = readFileSync(path.join(__dirname, '..', 'ini-line-editor.ts'), 'utf8')
    expect(source).not.toMatch(/^import /m)
    expect(source).not.toMatch(/require\(/)
    expect(source).not.toMatch(/Date\.now\(|new Date\(\)/)
  })
})
