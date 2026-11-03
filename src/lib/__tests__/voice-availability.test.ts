/**
 * T0802 / D247: whisper availability — load error text → reason code, probe run → three states,
 * log line, and the unavailable text (mic tooltip / recording refusal / Settings).
 */
import { describe, expect, it } from 'vitest'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import {
  aptInstallCommand,
  classifyWhisperLoadError,
  isVoiceUnavailable,
  parseVoiceProbeOutput,
  sanitizeVoiceDetail,
  VOICE_AVAILABILITY_PENDING,
  VOICE_DETAIL_MAX_CHARS,
  VOICE_PROBE_MARKER,
  voiceAvailabilityFromProbe,
  voiceAvailabilityLogLine,
  voiceUnavailableFromLocateError,
  voiceUnavailableLines,
  type VoiceAvailability,
} from '../voice-availability'

// T0800 / BUG-203 messages (Ubuntu 22.04 glibc 2.35; a 24.04 without libgomp1)
const GLIBC_MSG = "/lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.38' not found (required by /tmp/.mount_BetterXYZ/resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/linux-x64/libwhisper.so.1)"
const GLIBC_MULTI_MSG = `${GLIBC_MSG}\n/lib/x86_64-linux-gnu/libc.so.6: version \`GLIBC_2.36' not found (required by x.so)`
const LIBGOMP_MSG = 'libgomp.so.1: cannot open shared object file: No such file or directory'
const MAC_MSG = "dlopen(/Applications/BAT.app/x/whisper.node, 0x0001): Library not loaded: @rpath/libomp.dylib\n  Referenced from: <x>/whisper.node"
const WIN_MSG = 'The specified module could not be found.\r\n\\\\?\\C:\\Program Files\\BetterAgentTerminal\\resources\\app.asar.unpacked\\node_modules\\@kutalia\\whisper-node-addon\\dist\\win32-x64\\whisper.node'

const probeLine = (o: unknown) => `noise\n${VOICE_PROBE_MARKER}${JSON.stringify(o)}\n`

/** i18next-like `t` over a locale object (`{{x}}` interpolation). */
function tFor(locale: unknown) {
  return (key: string, opts?: Record<string, unknown>): string => {
    let v: unknown = locale
    for (const part of key.split('.')) v = (v as Record<string, unknown> | undefined)?.[part]
    if (typeof v !== 'string') throw new Error(`missing locale key ${key}`)
    return v.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(opts?.[k] ?? `{{${k}}}`))
  }
}

describe('classifyWhisperLoadError', () => {
  it('GLIBC_x.y not found → glibc-too-old with the newest required version', () => {
    expect(classifyWhisperLoadError(GLIBC_MSG)).toEqual({ code: 'glibc-too-old', libraries: [], requiredGlibc: '2.38' })
    expect(classifyWhisperLoadError(GLIBC_MULTI_MSG).requiredGlibc).toBe('2.38')
  })

  it('cannot open shared object file → missing-library (soname)', () => {
    expect(classifyWhisperLoadError(LIBGOMP_MSG)).toEqual({ code: 'missing-library', libraries: ['libgomp.so.1'] })
  })

  it('merges the probe\'s own dlopen results, without duplicates, in report order', () => {
    expect(classifyWhisperLoadError(LIBGOMP_MSG, ['libgomp.so.1', 'libvulkan.so.1']).libraries)
      .toEqual(['libgomp.so.1', 'libvulkan.so.1'])
    // glibc wins as the code; libraries are still listed (both hints are shown)
    expect(classifyWhisperLoadError(GLIBC_MSG, ['libvulkan.so.1'])).toEqual({ code: 'glibc-too-old', libraries: ['libvulkan.so.1'], requiredGlibc: '2.38' })
  })

  it('macOS Library not loaded → missing-library (dylib name)', () => {
    expect(classifyWhisperLoadError(MAC_MSG)).toEqual({ code: 'missing-library', libraries: ['libomp.dylib'] })
  })

  it('Windows (no DLL name) and anything else → load-failed', () => {
    expect(classifyWhisperLoadError(WIN_MSG).code).toBe('load-failed')
    expect(classifyWhisperLoadError('x does not export a whisper() function').code).toBe('load-failed')
    expect(classifyWhisperLoadError('').code).toBe('load-failed')
  })
})

describe('parseVoiceProbeOutput', () => {
  it('reads the last marker line and ignores other output', () => {
    expect(parseVoiceProbeOutput(probeLine({ ok: true, message: '', missing: [] }))).toEqual({ ok: true, message: '', missing: [] })
    expect(parseVoiceProbeOutput(`${probeLine({ ok: false })}\r\n`)).toEqual({ ok: false, message: '', missing: [] })
  })

  it('no marker / bad JSON / no ok field → null', () => {
    expect(parseVoiceProbeOutput('whisper_init: something\n')).toBeNull()
    expect(parseVoiceProbeOutput(`${VOICE_PROBE_MARKER}{oops`)).toBeNull()
    expect(parseVoiceProbeOutput(`${VOICE_PROBE_MARKER}{"message":"x"}`)).toBeNull()
  })

  it('drops non-string entries of missing', () => {
    expect(parseVoiceProbeOutput(probeLine({ ok: false, message: 'm', missing: ['libgomp.so.1', 3, null] }))?.missing).toEqual(['libgomp.so.1'])
  })
})

describe('voiceAvailabilityFromProbe', () => {
  it('ok → available(probe)', () => {
    expect(voiceAvailabilityFromProbe({ stdout: probeLine({ ok: true, message: '', missing: [] }), exitCode: 0 }, 'linux'))
      .toEqual({ state: 'available', source: 'probe' })
  })

  it('load failure → unavailable with code, libraries, glibc, sanitized detail', () => {
    const a = voiceAvailabilityFromProbe({ stdout: probeLine({ ok: false, message: GLIBC_MSG, missing: [] }), exitCode: 0 }, 'linux')
    expect(a).toMatchObject({ state: 'unavailable', code: 'glibc-too-old', platform: 'linux', requiredGlibc: '2.38', libraries: [] })
    const b = voiceAvailabilityFromProbe({ stdout: probeLine({ ok: false, message: LIBGOMP_MSG, missing: ['libgomp.so.1', 'libvulkan.so.1'] }) }, 'linux')
    expect(b).toMatchObject({ state: 'unavailable', code: 'missing-library', libraries: ['libgomp.so.1', 'libvulkan.so.1'] })
  })

  it('a result line wins over a crash after it', () => {
    expect(voiceAvailabilityFromProbe({ stdout: probeLine({ ok: true, message: '', missing: [] }), signal: 'SIGSEGV', exitCode: null }, 'linux').state).toBe('available')
  })

  it('🔴 check failures are unknown, never unavailable', () => {
    expect(voiceAvailabilityFromProbe({ stdout: '', timedOut: true, signal: 'SIGTERM', exitCode: null }, 'linux')).toEqual({ state: 'unknown', reason: 'timeout' })
    expect(voiceAvailabilityFromProbe({ stdout: '', signal: 'SIGSEGV', exitCode: null }, 'linux')).toEqual({ state: 'unknown', reason: 'crashed', detail: 'signal SIGSEGV' })
    expect(voiceAvailabilityFromProbe({ stdout: '', exitCode: 3 }, 'win32')).toEqual({ state: 'unknown', reason: 'crashed', detail: 'exit code 3' })
    expect(voiceAvailabilityFromProbe({ stdout: '', spawnError: 'spawn x ENOENT' }, 'darwin')).toEqual({ state: 'unknown', reason: 'spawn-failed', detail: 'spawn x ENOENT' })
    expect(voiceAvailabilityFromProbe({ stdout: 'garbage', exitCode: 0 }, 'linux')).toEqual({ state: 'unknown', reason: 'no-result' })
  })
})

describe('sanitizeVoiceDetail', () => {
  it('replaces the home directory (both slash styles) and collapses whitespace', () => {
    expect(sanitizeVoiceDetail('Cannot find /home/tester/x.node\n  at y', '/home/tester')).toBe('Cannot find ~/x.node at y')
    expect(sanitizeVoiceDetail('C:\\Users\\demo\\a and C:/Users/demo/b', 'C:\\Users\\demo')).toBe('~\\a and ~/b')
  })

  it('cuts to VOICE_DETAIL_MAX_CHARS', () => {
    const s = sanitizeVoiceDetail('x'.repeat(1000))
    expect(s.length).toBe(VOICE_DETAIL_MAX_CHARS)
    expect(s.endsWith('…')).toBe(true)
  })

  it('locate errors are unavailable(load-failed)', () => {
    expect(voiceUnavailableFromLocateError('no whisper.node for linux-arm64 (tried: /home/tester/a)', 'linux', '/home/tester'))
      .toEqual({ state: 'unavailable', code: 'load-failed', platform: 'linux', libraries: [], detail: 'no whisper.node for linux-arm64 (tried: ~/a)' })
  })
})

describe('voiceAvailabilityLogLine', () => {
  it('one line per state', () => {
    expect(voiceAvailabilityLogLine({ state: 'available', source: 'probe' }, 812)).toBe('[voice] availability: available in 812 ms (probe)')
    expect(voiceAvailabilityLogLine({ state: 'unknown', reason: 'timeout' }, 15001)).toBe('[voice] availability: unknown(timeout) in 15001 ms')
    expect(voiceAvailabilityLogLine({ state: 'unavailable', code: 'glibc-too-old', platform: 'linux', libraries: [], requiredGlibc: '2.38', detail: 'd' }, 40))
      .toBe('[voice] availability: unavailable(glibc-too-old) in 40 ms glibc>=2.38: d')
    expect(voiceAvailabilityLogLine({ state: 'unavailable', code: 'missing-library', platform: 'linux', libraries: ['libgomp.so.1', 'libvulkan.so.1'], detail: 'd' }, 5))
      .toBe('[voice] availability: unavailable(missing-library) in 5 ms libraries=libgomp.so.1,libvulkan.so.1: d')
  })
})

describe('unavailable text', () => {
  const t = tFor(zhTW)
  const linuxMissing: Extract<VoiceAvailability, { state: 'unavailable' }> = {
    state: 'unavailable', code: 'missing-library', platform: 'linux', libraries: ['libgomp.so.1', 'libvulkan.so.1'], detail: LIBGOMP_MSG,
  }

  it('only unavailable blocks', () => {
    expect(isVoiceUnavailable(linuxMissing)).toBe(true)
    expect(isVoiceUnavailable({ state: 'available', source: 'load' })).toBe(false)
    expect(isVoiceUnavailable(VOICE_AVAILABILITY_PENDING)).toBe(false)
    expect(isVoiceUnavailable({ state: 'unknown', reason: 'crashed' })).toBe(false)
    expect(isVoiceUnavailable(null)).toBe(false)
  })

  it('apt command lists the packages of the libraries actually missing', () => {
    expect(aptInstallCommand(['libgomp.so.1', 'libvulkan.so.1'])).toBe('sudo apt install libgomp1 libvulkan1')
    expect(aptInstallCommand(['libvulkan.so.1'])).toBe('sudo apt install libvulkan1')
    expect(aptInstallCommand(['libfoo.so.3'])).toBeNull()
  })

  it('Linux missing library: reason + apt command (Debian / Ubuntu note)', () => {
    const lines = voiceUnavailableLines(linuxMissing, t)
    expect(lines[0]).toBe('這台電腦無法使用語音輸入')
    expect(lines[1]).toBe('缺少系統函式庫：libgomp.so.1, libvulkan.so.1')
    expect(lines[2]).toContain('sudo apt install libgomp1 libvulkan1')
    expect(lines[2]).toContain('Debian / Ubuntu')
  })

  it('Linux unknown library: install-the-package line instead of apt', () => {
    const lines = voiceUnavailableLines({ ...linuxMissing, libraries: ['libfoo.so.3'] }, t)
    expect(lines.join('\n')).not.toContain('apt')
    expect(lines[2]).toContain('libfoo.so.3')
  })

  it('glibc too old: needs glibc 2.38 (Ubuntu 24.04)', () => {
    const lines = voiceUnavailableLines({ state: 'unavailable', code: 'glibc-too-old', platform: 'linux', libraries: [], requiredGlibc: '2.38', detail: GLIBC_MSG }, t)
    expect(lines).toEqual(['這台電腦無法使用語音輸入', '系統的 glibc 太舊：語音模組需要 glibc 2.38 以上', '需要 glibc 2.38 以上的系統（例 Ubuntu 24.04）'])
  })

  it('other: the error summary', () => {
    const lines = voiceUnavailableLines({ state: 'unavailable', code: 'load-failed', platform: 'win32', libraries: [], detail: 'The specified module could not be found.' }, tFor(en))
    expect(lines[1]).toBe('The voice recognition module (whisper) cannot be loaded: The specified module could not be found.')
  })

  it('macOS missing library: no apt command', () => {
    const lines = voiceUnavailableLines({ state: 'unavailable', code: 'missing-library', platform: 'darwin', libraries: ['libomp.dylib'], detail: MAC_MSG }, tFor(en))
    expect(lines.join('\n')).not.toContain('apt')
    expect(lines[2]).toContain('libomp.dylib')
  })

  it('every locale has the same voiceAvailability keys and renders every case', () => {
    const keys = (o: unknown, p = ''): string[] => Object.entries(o as Record<string, unknown>)
      .flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort()
    const enKeys = keys((en as Record<string, unknown>).voiceAvailability)
    expect(keys((zhTW as Record<string, unknown>).voiceAvailability)).toEqual(enKeys)
    expect(keys((zhCN as Record<string, unknown>).voiceAvailability)).toEqual(enKeys)
    for (const locale of [en, zhTW, zhCN]) {
      const tl = tFor(locale)
      for (const code of ['missing-library', 'glibc-too-old', 'load-failed'] as const) {
        expect(() => voiceUnavailableLines({ state: 'unavailable', code, platform: 'linux', libraries: ['libgomp.so.1', 'libx.so.1'], requiredGlibc: '2.38', detail: 'd' }, tl)).not.toThrow()
      }
      for (const k of ['label', 'available', 'unavailable', 'pending', 'unknown', 'unknownHint', 'recheck', 'checking']) {
        expect(() => tl(`voiceAvailability.settings.${k}`)).not.toThrow()
      }
    }
  })
})
