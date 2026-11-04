/**
 * T0841 (PLAN-043 W4, P-5): WslEnvApplier.applyNetworkingMirrored —
 * `.wslconfig` `[wsl2] networkingMode=mirrored`, `wsl --shutdown`, wait for the
 * keep-alive holder, verify with `wslinfo`. child_process and the file system
 * are injected: nothing here runs `wsl --shutdown` or touches a real .wslconfig
 * (T0841: `--shutdown` is never run by tests).
 */
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { SHUTDOWN_TIMEOUT_MS, WslEnvApplier, type WslConfigFileOps } from '../wsl-env-apply'
import { WSL_POLICY_KEY } from '../wsl-facts'

type Call = { file: string; args: string[]; options: Record<string, unknown> }

const CONFIG = 'C:\\Users\\alice\\.wslconfig'
const BACKUP = `${CONFIG}.bat-backup-20261104-123005`

function utf16(text: string): Buffer {
  return Buffer.from(`\ufeff${text}`, 'utf16le')
}

function wslList(state: 'Running' | 'Stopped'): Buffer {
  return utf16(['  NAME      STATE           VERSION', `* Test      ${state}         2`].join('\r\n'))
}

interface Fake {
  /** reg.exe query output; null = key absent (exit 1); 'error' = exit 5. */
  policy: string | null | 'error'
  /** .wslconfig bytes; null = missing. */
  config: Buffer | null
  /** `wslinfo --networking-mode` after the shutdown. */
  modeAfterShutdown?: string
  /** `wsl -l -v` reports Running only from this poll on (1-based). */
  runningFromPoll?: number
  failShutdown?: boolean
  failRename?: boolean
  /** Writes "succeed" but the file keeps its old content. */
  dropWrites?: boolean
  /** Abort this controller when the shutdown is called. */
  abortOnShutdown?: AbortController
}

function harness(state: Fake, platform: NodeJS.Platform = 'win32') {
  const calls: Call[] = []
  const files = new Map<string, Buffer>()
  if (state.config) files.set(CONFIG, state.config)
  const fileLog: string[] = []
  let polls = 0
  let shutdown = false
  const execFile = (file: string, args: string[], options: Record<string, unknown>, cb: (e: Error | null, out: Buffer, err: Buffer) => void) => {
    calls.push({ file, args, options })
    const ok = (out: Buffer | string = '') => queueMicrotask(() => cb(null, Buffer.isBuffer(out) ? out : Buffer.from(out), Buffer.alloc(0)))
    const fail = (message: string, code: number) => queueMicrotask(() => cb(Object.assign(new Error(message), { code }), Buffer.alloc(0), Buffer.from(message)))
    const signal = options.signal as AbortSignal | undefined
    if (signal?.aborted) {
      queueMicrotask(() => cb(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }), Buffer.alloc(0), Buffer.alloc(0)))
      return
    }
    if (file.toLowerCase().endsWith('reg.exe')) {
      if (state.policy === null) return fail('ERROR: The system was unable to find the specified registry key or value.', 1)
      if (state.policy === 'error') return fail('ERROR: Access is denied.', 5)
      return ok(state.policy)
    }
    if (args[0] === '--shutdown') {
      state.abortOnShutdown?.abort()
      if (state.failShutdown) return fail('shutdown failed', 1)
      shutdown = true
      return ok()
    }
    if (args[0] === '-l') {
      polls += 1
      const running = shutdown && polls >= (state.runningFromPoll ?? 1)
      return ok(wslList(running ? 'Running' : 'Stopped'))
    }
    if (args.includes('wslinfo')) return ok(`${shutdown ? (state.modeAfterShutdown ?? 'mirrored') : 'nat'}\n`)
    fail(`unexpected ${file} ${args.join(' ')}`, 1)
  }
  const enoent = () => Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
  const ops: WslConfigFileOps = {
    async readFile(p) {
      fileLog.push(`read ${p}`)
      const value = files.get(p)
      if (!value) throw enoent()
      return value
    },
    async writeFile(p, data) {
      fileLog.push(`write ${p}`)
      if (!state.dropWrites) files.set(p, data)
    },
    async copyFile(src, dest) {
      fileLog.push(`copy ${src} -> ${dest}`)
      if (files.has(dest)) throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' })
      const value = files.get(src)
      if (!value) throw enoent()
      files.set(dest, value)
    },
    async rename(from, to) {
      fileLog.push(`rename ${from} -> ${to}`)
      if (state.failRename) throw Object.assign(new Error('EPERM'), { code: 'EPERM' })
      const value = files.get(from)
      if (value) files.set(to, value)
      files.delete(from)
    },
    async unlink(p) {
      fileLog.push(`unlink ${p}`)
      files.delete(p)
    },
  }
  const logs: string[] = []
  const applier = new WslEnvApplier({
    execFile,
    files: ops,
    wslConfigPath: () => CONFIG,
    platform,
    systemRoot: () => 'C:\\Windows',
    now: () => new Date(2026, 10, 4, 12, 30, 5),
    sleep: async () => undefined,
    log: (m) => logs.push(m),
  })
  return { applier, calls, files, fileLog, logs }
}

const shutdownCalls = (calls: Call[]) => calls.filter((c) => c.args[0] === '--shutdown')
const POLICY_HEADER = `\r\n${WSL_POLICY_KEY}\r\n`

describe('applyNetworkingMirrored: policy and user settings are respected (T0841)', () => {
  it.each([
    ['AllowNetworkingModeUserSetting=0', `${POLICY_HEADER}    AllowNetworkingModeUserSetting    REG_DWORD    0x0\r\n`],
    ['DefaultNetworkingMode set', `${POLICY_HEADER}    DefaultNetworkingMode    REG_DWORD    0x1\r\n`],
  ])('%s → wsl-network-mode-policy: nothing read, written or shut down', async (_name, policy) => {
    const h = harness({ policy, config: Buffer.from('[wsl2]\nmemory=4GB\n') })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-network-mode-policy', changes: [], terminated: false })
    expect(h.fileLog).toEqual([])
    expect(shutdownCalls(h.calls)).toHaveLength(0)
  })

  it('policy key unreadable → no change (cannot tell whether a policy wins)', async () => {
    const h = harness({ policy: 'error', config: null })
    expect(await h.applier.applyNetworkingMirrored('Test')).toMatchObject({ ok: false, errorCode: 'wsl-network-mode-policy' })
    expect(shutdownCalls(h.calls)).toHaveLength(0)
  })

  it('policy key without networking values → allowed; reg.exe from System32 with array argv', async () => {
    const h = harness({ policy: `${POLICY_HEADER}    AllowWSL    REG_DWORD    0x1\r\n`, config: null })
    expect(await h.applier.applyNetworkingMirrored('Test')).toMatchObject({ ok: true })
    const reg = h.calls.find((c) => c.file.toLowerCase().endsWith('reg.exe'))!
    expect(reg.file).toBe('C:\\Windows\\System32\\reg.exe')
    expect(reg.args).toEqual(['query', WSL_POLICY_KEY])
  })

  it.each(['nat', 'NAT', 'none', 'consomme', 'bogus'])('declared networkingMode=%s → wsl-network-mode-declared, file untouched', async (mode) => {
    const original = Buffer.from(`[wsl2]\nnetworkingMode=${mode}\n`)
    const h = harness({ policy: null, config: original })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-network-mode-declared', changes: [], terminated: false })
    expect(h.fileLog).toEqual([`read ${CONFIG}`])
    expect(h.files.get(CONFIG)).toEqual(original)
    expect(shutdownCalls(h.calls)).toHaveLength(0)
  })

  it('unparsable .wslconfig → not written (would make it worse), no shutdown', async () => {
    const h = harness({ policy: null, config: Buffer.from('[wsl2\nmemory=4GB\n') })
    expect(await h.applier.applyNetworkingMirrored('Test')).toMatchObject({ ok: false, errorCode: 'wsl-wslconfig-write-failed', changes: [] })
    expect(h.fileLog).toEqual([`read ${CONFIG}`])
    expect(shutdownCalls(h.calls)).toHaveLength(0)
  })
})

describe('applyNetworkingMirrored: write, backup, shutdown, verify (T0841)', () => {
  it('existing file → backup (system time), only that line added, temp + rename, read back, shutdown, Running, mirrored', async () => {
    const original = '# my settings\r\n[wsl2]\r\nmemory=4GB\r\n\r\n[general]\r\ninstanceIdleTimeout=60000\r\n'
    const h = harness({ policy: null, config: Buffer.from(original), runningFromPoll: 3 })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toEqual({
      ok: true,
      outcome: 'applied',
      changes: [{ item: 'network-mirrored', kind: 'file', path: CONFIG, backupPath: BACKUP }],
      terminated: true,
    })
    expect(h.files.get(BACKUP)!.toString('utf8')).toBe(original)
    const written = h.files.get(CONFIG)!.toString('utf8')
    expect(written).toBe('# my settings\r\n[wsl2]\r\nmemory=4GB\r\nnetworkingMode=mirrored\r\n\r\n[general]\r\ninstanceIdleTimeout=60000\r\n')
    expect(h.fileLog).toEqual([
      `read ${CONFIG}`,
      `copy ${CONFIG} -> ${BACKUP}`,
      `write ${CONFIG}.bat-tmp`,
      `rename ${CONFIG}.bat-tmp -> ${CONFIG}`,
      `read ${CONFIG}`,
    ])
    // Order: policy → file → shutdown → wait for Running (3 polls) → wslinfo.
    const wsl = h.calls.filter((c) => c.file === 'wsl').map((c) => c.args.join(' '))
    expect(wsl).toEqual(['--shutdown', '-l -v', '-l -v', '-l -v', '-d Test -- wslinfo --networking-mode'])
  })

  it('UTF-16 LE BOM file keeps its encoding', async () => {
    const h = harness({ policy: null, config: utf16('[wsl2]\r\nswap=0\r\n') })
    await h.applier.applyNetworkingMirrored('Test')
    const written = h.files.get(CONFIG)!
    expect(written.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xfe]))
    expect(written.subarray(2).toString('utf16le')).toBe('[wsl2]\r\nswap=0\r\nnetworkingMode=mirrored\r\n')
  })

  it('no .wslconfig → created with [wsl2] networkingMode=mirrored, no backup', async () => {
    const h = harness({ policy: null, config: null })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toMatchObject({ ok: true, outcome: 'applied', changes: [{ path: CONFIG, backupPath: null }] })
    expect(h.files.get(CONFIG)!.toString('utf8')).toBe('[wsl2]\nnetworkingMode=mirrored\n')
    expect(h.fileLog.some((l) => l.startsWith('copy'))).toBe(false)
  })

  it('already networkingMode=mirrored (not applied yet) → no write, shutdown still runs → already', async () => {
    const original = Buffer.from('[wsl2]\nnetworkingMode=Mirrored\n')
    const h = harness({ policy: null, config: original })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toEqual({ ok: true, outcome: 'already', changes: [], terminated: true })
    expect(h.fileLog).toEqual([`read ${CONFIG}`])
    expect(shutdownCalls(h.calls)).toHaveLength(1)
  })

  it('write that does not stick → read-back check fails, no shutdown', async () => {
    const h = harness({ policy: null, config: Buffer.from('[wsl2]\nmemory=4GB\n'), dropWrites: true })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-wslconfig-write-failed', terminated: false })
    expect(shutdownCalls(h.calls)).toHaveLength(0)
  })

  it('rename fails → temp file removed, original untouched, backup kept, no shutdown', async () => {
    const original = Buffer.from('[wsl2]\nmemory=4GB\n')
    const h = harness({ policy: null, config: original, failRename: true })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-wslconfig-write-failed', changes: [] })
    expect(h.files.get(CONFIG)).toEqual(original)
    expect(h.files.has(`${CONFIG}.bat-tmp`)).toBe(false)
    expect(h.files.has(BACKUP)).toBe(true)
    expect(shutdownCalls(h.calls)).toHaveLength(0)
  })

  it('a backup with the same name already exists → never overwritten (write fails)', async () => {
    const h = harness({ policy: null, config: Buffer.from('[wsl2]\nmemory=4GB\n') })
    h.files.set(BACKUP, Buffer.from('older backup'))
    expect(await h.applier.applyNetworkingMirrored('Test')).toMatchObject({ ok: false, errorCode: 'wsl-wslconfig-write-failed' })
    expect(h.files.get(BACKUP)!.toString()).toBe('older backup')
  })

  it('shutdown fails → wsl-shutdown-failed, the file change is still reported', async () => {
    const h = harness({ policy: null, config: null, failShutdown: true })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-shutdown-failed', terminated: false })
    expect(result.changes).toHaveLength(1)
  })

  it('still NAT after the shutdown (e.g. Windows without Mirrored) → wsl-network-mode-not-applied', async () => {
    const h = harness({ policy: null, config: null, modeAfterShutdown: 'nat' })
    const result = await h.applier.applyNetworkingMirrored('Test')
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-network-mode-not-applied', terminated: true })
    expect(result.changes).toHaveLength(1)
  })

  it('distro never reported Running → still verifies with wslinfo (it starts the distro)', async () => {
    const h = harness({ policy: null, config: null, runningFromPoll: 999 })
    expect(await h.applier.applyNetworkingMirrored('Test')).toMatchObject({ ok: true })
    expect(h.calls.filter((c) => c.args[0] === '-l')).toHaveLength(20)
  })

  it('wsl --shutdown gets no signal and a timeout; abort before the shutdown stops everything', async () => {
    const h = harness({ policy: null, config: null })
    await h.applier.applyNetworkingMirrored('Test', { signal: new AbortController().signal })
    const call = shutdownCalls(h.calls)[0]
    expect(call.options.signal).toBeUndefined()
    expect(call.options.timeout).toBe(SHUTDOWN_TIMEOUT_MS)

    const aborted = new AbortController()
    aborted.abort()
    const h2 = harness({ policy: null, config: null })
    const result = await h2.applier.applyNetworkingMirrored('Test', { signal: aborted.signal })
    expect(result).toMatchObject({ ok: false, aborted: true, terminated: false })
    expect(h2.calls).toHaveLength(0)
  })

  it('abort during the shutdown → the wait afterwards ends at once (aborted, shutdown reported)', async () => {
    const controller = new AbortController()
    const h = harness({ policy: null, config: null, abortOnShutdown: controller })
    const result = await h.applier.applyNetworkingMirrored('Test', { signal: controller.signal })
    expect(result).toMatchObject({ ok: false, aborted: true, terminated: true })
    expect(h.calls.filter((c) => c.args.includes('wslinfo'))).toHaveLength(0)
  })

  it('logs item / outcome / counts only, never .wslconfig contents', async () => {
    const h = harness({ policy: null, config: Buffer.from('[wsl2]\nmemory=SECRET123\n') })
    await h.applier.applyNetworkingMirrored('Test')
    expect(h.logs).toHaveLength(1)
    expect(h.logs[0]).toMatch(/^\[wsl-env-apply\] network-mirrored -> applied changes=1 shutdown=true ms=\d+$/)
    expect(h.logs.join('\n')).not.toContain('SECRET123')
  })
})

describe('applyNetworkingMirrored input checks and source guard (T0841)', () => {
  it('rejects a distro outside the whitelist and non-Windows hosts before anything runs', async () => {
    const bad = harness({ policy: null, config: null })
    expect(await bad.applier.applyNetworkingMirrored('Bad;name')).toMatchObject({ ok: false, errorCode: 'wsl-env-apply-invalid' })
    expect(bad.calls).toHaveLength(0)
    const linux = harness({ policy: null, config: null }, 'linux')
    expect(await linux.applier.applyNetworkingMirrored('Test')).toMatchObject({ ok: false, errorCode: 'wsl-env-apply-invalid' })
    expect(linux.calls).toHaveLength(0)
    expect(linux.fileLog).toHaveLength(0)
  })

  it('apply() still refuses the P-5 id (it has its own IPC)', async () => {
    const h = harness({ policy: null, config: null })
    expect(await h.applier.apply('Test', 'network-mirrored')).toMatchObject({ ok: false, errorCode: 'wsl-env-apply-invalid' })
    expect(h.calls).toHaveLength(0)
  })

  it('main.ts pins the keep-alive before applying; the handler is the only caller', () => {
    const main = readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8')
    const handler = main.slice(main.indexOf("ipcMain.handle('wsl:apply-network-mirrored'"))
    expect(handler.indexOf('wslKeepAlive.pin(distro)')).toBeGreaterThan(0)
    expect(handler.indexOf('wslKeepAlive.pin(distro)')).toBeLessThan(handler.indexOf('applyNetworkingMirrored('))
    expect(main.match(/applyNetworkingMirrored\(/g)).toHaveLength(1)
  })

  it('module: no electron import, no userData, .wslconfig path resolved when used', () => {
    const source = readFileSync(path.join(__dirname, '..', 'wsl-env-apply.ts'), 'utf8')
    expect(source).not.toMatch(/from 'electron'/)
    expect(source).not.toMatch(/getPath\(/)
    expect(source).toMatch(/wslConfigPath = deps\.wslConfigPath \?\? defaultWslConfigPath\b/)
  })
})
