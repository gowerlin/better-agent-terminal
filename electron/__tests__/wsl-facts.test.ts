/**
 * T0839 (PLAN-043 W2): detectWslFacts — read-only fact collection. execFile is
 * injected through wsl-detect's setExecFileImplForTests; no real wsl.exe / reg.exe.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetExecFileImplForTests, setExecFileImplForTests } from '../wsl-detect'
import {
  DISTRO_PROBE_SCRIPT,
  WSL_FACTS_BUDGET_MS,
  WSL_POLICY_KEY,
  detectWslFacts,
  distroConfFactsFromBuffer,
  parseDistroProbeOutput,
  parseRegQueryValues,
  parseWindowsBuild,
  parseWslVersionOutput,
  summarizeWslFacts,
  wslConfigFactsFromBuffer,
} from '../wsl-facts'

type Reply =
  | { ok: true; stdout?: string | Buffer }
  | { ok: false; code: number | string; stdout?: string | Buffer; killed?: boolean }

interface Call {
  file: string
  args: string[]
  options: Record<string, unknown>
}

function utf16(text: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
}

function installExec(route: (file: string, args: string[]) => Reply): Call[] {
  const calls: Call[] = []
  setExecFileImplForTests((file: string, args: string[], options: Record<string, unknown>, callback: (...cbArgs: unknown[]) => void) => {
    calls.push({ file, args, options })
    const reply = route(file, args)
    const stdout = reply.stdout === undefined ? Buffer.alloc(0) : Buffer.isBuffer(reply.stdout) ? reply.stdout : Buffer.from(reply.stdout)
    if (reply.ok) callback(null, stdout, Buffer.alloc(0))
    else callback(Object.assign(new Error(`Command failed: ${file}`), { code: reply.code, killed: reply.killed ?? false }), stdout, Buffer.alloc(0))
    return undefined
  })
  return calls
}

const VERSION_OUT = utf16('WSL 版本: 2.7.14.0\r\n核心版本: 6.18.33.2-2\r\nWindows 版本: 10.0.28000.3365\r\n')
const LIST_OUT = utf16('  NAME            STATE           VERSION\r\n* Ubuntu-24.04    Running         2\r\n  Legacy          Stopped         1\r\n')
const PROBE_OK = 'BAT_UID=1000\nBAT_USER=demo\nBAT_PID1=systemd\nBAT_LINGER=yes\nBAT_WSLCONF=present\nBAT_WSLCONF_BEGIN\n[boot]\nsystemd=true\n[user]\ndefault=demo\n'

const REG = 'C:\\Windows\\System32\\reg.exe'

function healthyRoute(overrides: Partial<Record<'version' | 'list' | 'status' | 'reg' | 'probe', Reply>> = {}) {
  return (file: string, args: string[]): Reply => {
    if (file === REG) return overrides.reg ?? { ok: false, code: 1 }
    const k = args.join(' ')
    if (k === '--version') return overrides.version ?? { ok: true, stdout: VERSION_OUT }
    if (k === '-l -v') return overrides.list ?? { ok: true, stdout: LIST_OUT }
    if (k === '--status') return overrides.status ?? { ok: true }
    if (args[2] === '--exec') return overrides.probe ?? { ok: true, stdout: PROBE_OK }
    return { ok: false, code: 99 }
  }
}

let dir: string
const opts = () => ({ platform: 'win32' as const, release: '10.0.28000', systemRoot: 'C:\\Windows', wslConfigPath: path.join(dir, '.wslconfig') })

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 't0839-facts-'))
})
afterEach(() => {
  resetExecFileImplForTests()
  rmSync(dir, { recursive: true, force: true })
})

describe('parsers', () => {
  it('parseWindowsBuild reads 10.0.<build> on win32 only', () => {
    expect(parseWindowsBuild('10.0.28000', 'win32')).toBe(28000)
    expect(parseWindowsBuild('10.0', 'win32')).toBeNull()
    expect(parseWindowsBuild('6.8.0', 'linux')).toBeNull()
  })

  it('parseWslVersionOutput takes the first line version whatever the label language', () => {
    expect(parseWslVersionOutput(VERSION_OUT)).toBe('2.7.14.0')
    expect(parseWslVersionOutput(utf16('WSL version: 2.0.4.0\r\nKernel version: 5.15\r\n'))).toBe('2.0.4.0')
    expect(parseWslVersionOutput(Buffer.from('garbage\n'))).toBeNull()
    expect(parseWslVersionOutput(Buffer.alloc(0))).toBeNull()
  })

  it('parseRegQueryValues reads REG_DWORD / REG_SZ and skips subkeys and headers', () => {
    const text = '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\WSL\r\n    AllowWSL    REG_DWORD    0x0\r\n    DefaultNetworkingMode    REG_DWORD    0x3\r\n    Note    REG_SZ    hello world\r\n\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\WSL\\WSLContainerRegistryAllowlist\r\n'
    expect(parseRegQueryValues(text)).toEqual({ AllowWSL: 0, DefaultNetworkingMode: 3, Note: 'hello world' })
  })

  it('wslConfigFactsFromBuffer uses the T0838 decoder (UTF-16 LE BOM) and WSL rules', () => {
    expect(wslConfigFactsFromBuffer(utf16('[wsl2]\r\nnetworkingMode=Mirrored\r\nnetworkingMode=nat\r\n[general]\r\ninstanceIdleTimeout=-1\r\n'))).toEqual({
      status: 'ok', encoding: 'utf16le-bom', networkingMode: 'mirrored', instanceIdleTimeout: '-1',
    })
    expect(wslConfigFactsFromBuffer(Buffer.from('[wsl2]\nmemory=8GB\n'))).toMatchObject({ status: 'ok', networkingMode: null, instanceIdleTimeout: null })
    expect(wslConfigFactsFromBuffer(Buffer.from('[wsl2\nnetworkingMode=nat\n'))).toMatchObject({ status: 'unparsable', networkingMode: null })
    expect(wslConfigFactsFromBuffer(Buffer.from([0xc3, 0x28]))).toMatchObject({ status: 'invalid-encoding' })
  })

  it('distroConfFactsFromBuffer reads [boot] systemd and [user] default', () => {
    expect(distroConfFactsFromBuffer(Buffer.from('[boot]\nsystemd=true\n[user]\ndefault=demo\n'))).toEqual({ status: 'ok', bootSystemd: 'true', userDefault: 'demo' })
    expect(distroConfFactsFromBuffer(Buffer.from('systemd\n'))).toMatchObject({ status: 'unparsable' })
  })

  it('parseDistroProbeOutput: markers before BEGIN only; wsl.conf bytes after it', () => {
    const parsed = parseDistroProbeOutput(Buffer.from(PROBE_OK))
    expect(parsed).toEqual({
      user: 'demo', uid: 1000, pid1: 'systemd', systemdRunning: true, linger: true,
      wslConf: { status: 'ok', bootSystemd: 'true', userDefault: 'demo' },
    })
    // A BAT_* line inside wsl.conf is never read as a marker.
    const tricky = parseDistroProbeOutput(Buffer.from('BAT_UID=0\nBAT_USER=root\nBAT_PID1=init\nBAT_LINGER=no\nBAT_WSLCONF=present\nBAT_WSLCONF_BEGIN\n# BAT_UID=1000\n'))
    expect(tricky).toMatchObject({ uid: 0, user: 'root', pid1: 'init', systemdRunning: false, linger: false, wslConf: { status: 'ok', bootSystemd: null } })
    expect(parseDistroProbeOutput(Buffer.from('BAT_UID=1000\nBAT_WSLCONF=absent\n')).wslConf.status).toBe('missing')
    expect(parseDistroProbeOutput(Buffer.from('BAT_UID=1000\nBAT_WSLCONF=unreadable\n')).wslConf.status).toBe('unreadable')
  })

  it('the probe script is fixed text (no interpolation slots)', () => {
    expect(DISTRO_PROBE_SCRIPT).not.toMatch(/\$\{|\$1|\$@/)
  })
})

describe('detectWslFacts()', () => {
  it('collects every fact on a healthy machine with fixed argv and a timeout on every call', async () => {
    writeFileSync(path.join(dir, '.wslconfig'), '[wsl2]\nnetworkingMode=mirrored\n')
    const calls = installExec(healthyRoute())

    const facts = await detectWslFacts(opts())

    expect(facts).toMatchObject({
      v: 1, platform: 'win32', windowsBuild: 28000, wslInstalled: true,
      version: { available: true, wsl: '2.7.14.0' },
      defaultDistro: 'Ubuntu-24.04', running: ['Ubuntu-24.04'],
      policy: { status: 'absent', allowWsl: null },
      wslConfig: { status: 'ok', networkingMode: 'mirrored' },
      selected: { name: 'Ubuntu-24.04', version: 2, state: 'Running', probe: 'ok', uid: 1000, systemdRunning: true, linger: true },
      timedOut: false,
    })
    expect(facts.distros).toHaveLength(2)
    expect(calls.map((c) => [c.file, ...c.args.slice(0, 4)])).toEqual(expect.arrayContaining([
      ['wsl', '--version'],
      ['wsl', '-l', '-v'],
      [REG, 'query', WSL_POLICY_KEY],
      ['wsl', '-d', 'Ubuntu-24.04', '--exec', 'sh'],
    ]))
    const probeCall = calls.find((c) => c.args[2] === '--exec')!
    expect(probeCall.args).toEqual(['-d', 'Ubuntu-24.04', '--exec', 'sh', '-c', DISTRO_PROBE_SCRIPT, 'sh'])
    for (const call of calls) {
      expect(call.options.timeout).toBeGreaterThan(0)
      expect(call.options.timeout).toBeLessThanOrEqual(WSL_FACTS_BUDGET_MS)
    }
    // --status is not needed when --version already answered.
    expect(calls.some((c) => c.args[0] === '--status')).toBe(false)
  })

  it('🔴 never runs a state-changing wsl command', async () => {
    const calls = installExec(healthyRoute())
    await detectWslFacts(opts())
    const forbidden = ['--shutdown', '--terminate', '-t', '--set-version', '--set-default', '--install', '--update', '--unregister', '--manage', '--import', '-u']
    for (const call of calls) {
      for (const flag of forbidden) expect(call.args).not.toContain(flag)
    }
  })

  it('inspects the requested distro, case-insensitively matched against the list', async () => {
    installExec(healthyRoute({ probe: { ok: true, stdout: 'BAT_UID=0\nBAT_USER=root\nBAT_PID1=init\nBAT_LINGER=no\nBAT_WSLCONF=absent\n' } }))
    const facts = await detectWslFacts({ ...opts(), distro: 'legacy' })
    expect(facts.selected).toMatchObject({ name: 'legacy', version: 1, state: 'Stopped', probe: 'ok', uid: 0, systemdRunning: false, wslConf: { status: 'missing' } })
  })

  it('a distro not in the list is reported but never probed', async () => {
    const calls = installExec(healthyRoute())
    const facts = await detectWslFacts({ ...opts(), distro: 'Missing' })
    expect(facts.selected).toMatchObject({ name: 'Missing', version: null, probe: 'skipped' })
    expect(calls.some((c) => c.args[2] === '--exec')).toBe(false)
  })

  it('rejects an invalid distro name before spawning anything', async () => {
    const calls = installExec(healthyRoute())
    await expect(detectWslFacts({ ...opts(), distro: 'bad;name' })).rejects.toThrow(/Invalid WSL distro name/)
    expect(calls).toHaveLength(0)
  })

  it('WSL installed without distros: no selected distro', async () => {
    installExec(healthyRoute({ list: { ok: false, code: 4294967295 } }))
    const facts = await detectWslFacts(opts())
    expect(facts).toMatchObject({ wslInstalled: true, distros: [], defaultDistro: null, selected: null })
  })

  it('inbox / old WSL: --version fails, --status decides installed', async () => {
    const calls = installExec(healthyRoute({ version: { ok: false, code: 1 }, list: { ok: false, code: 1 }, status: { ok: true } }))
    const facts = await detectWslFacts(opts())
    expect(facts).toMatchObject({ wslInstalled: true, version: { available: false, wsl: null } })
    expect(calls.some((c) => c.args[0] === '--status')).toBe(true)
  })

  it('WSL missing (wsl.exe ENOENT): not installed, no --status, no probe', async () => {
    const calls = installExec(healthyRoute({ version: { ok: false, code: 'ENOENT' }, list: { ok: false, code: 'ENOENT' } }))
    const facts = await detectWslFacts(opts())
    expect(facts).toMatchObject({ wslInstalled: false, selected: null })
    expect(calls.some((c) => c.args[0] === '--status')).toBe(false)
  })

  it('reads WSL policy values', async () => {
    installExec(healthyRoute({ reg: { ok: true, stdout: '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\WSL\r\n    AllowWSL    REG_DWORD    0x0\r\n    AllowNetworkingModeUserSetting    REG_DWORD    0x0\r\n    DefaultNetworkingMode    REG_DWORD    0x1\r\n' } }))
    const facts = await detectWslFacts(opts())
    expect(facts.policy).toMatchObject({ status: 'present', allowWsl: false, allowNetworkingModeUserSetting: false, defaultNetworkingMode: 1, allowWsl1: null })
  })

  it('reg.exe failing for another reason is unknown, not absent', async () => {
    installExec(healthyRoute({ reg: { ok: false, code: 'ENOENT' } }))
    expect((await detectWslFacts(opts())).policy.status).toBe('unknown')
  })

  it('.wslconfig missing vs present', async () => {
    installExec(healthyRoute())
    expect((await detectWslFacts(opts())).wslConfig.status).toBe('missing')
  })

  it('in-distro probe failure is reported as failed', async () => {
    installExec(healthyRoute({ probe: { ok: false, code: 1 } }))
    expect((await detectWslFacts(opts())).selected).toMatchObject({ probe: 'failed', uid: null, version: 2 })
  })

  it('stays inside one 15 s budget: later probes are skipped and timedOut is set', async () => {
    let clock = 0
    installExec((file, args) => {
      // Each call "takes" 8 s of the budget.
      clock += 8_000
      return healthyRoute()(file, args)
    })
    const facts = await detectWslFacts({ ...opts(), now: () => clock })
    expect(facts.timedOut).toBe(true)
    expect(facts.selected?.probe).toBe('skipped')
  })

  it('a probe killed by its timeout marks the run timedOut', async () => {
    installExec(healthyRoute({ probe: { ok: false, code: null as unknown as number, killed: true } }))
    const facts = await detectWslFacts(opts())
    expect(facts.timedOut).toBe(true)
    expect(facts.selected?.probe).toBe('failed')
  })

  it('off Windows: nothing is spawned', async () => {
    const calls = installExec(healthyRoute())
    const facts = await detectWslFacts({ ...opts(), platform: 'linux', release: '6.8.0' })
    expect(facts).toMatchObject({ platform: 'linux', wslInstalled: false, windowsBuild: null, policy: { status: 'unknown' } })
    expect(calls).toHaveLength(0)
  })

  it('summarizeWslFacts carries no user name', async () => {
    installExec(healthyRoute())
    const line = summarizeWslFacts(await detectWslFacts(opts()))
    expect(line).toContain('installed=true')
    expect(line).not.toContain('demo')
  })
})

describe('source guards', () => {
  const source = readFileSync(path.join(__dirname, '..', 'wsl-facts.ts'), 'utf8')
  it('no shell-spawning API and no electron import', () => {
    expect(source).not.toMatch(/from 'electron'/)
    // All spawning goes through wsl-detect's execFileBuffered (injectable in tests).
    expect(source).not.toMatch(/\bexecSync\b|\bspawnSync\b|from 'child_process'|require\('child_process'\)/)
    expect(source).not.toMatch(/app\.getPath/)
  })
})
