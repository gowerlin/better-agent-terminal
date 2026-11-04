/**
 * T0840 (PLAN-043 W3): WslEnvApplier — the WSL environment fixes the setup
 * wizard applies after the user consented (P-1 WSL 2 conversion, P-2 systemd).
 * child_process is injected; nothing here touches a real WSL.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import { describe, expect, it } from 'vitest'
import {
  READ_WSL_CONF_SCRIPT,
  SET_VERSION_TIMEOUT_MS,
  WRITE_WSL_CONF_SCRIPT,
  WslEnvApplier,
} from '../wsl-env-apply'

type Call = { file: string; args: string[]; options: Record<string, unknown> }

function utf16(text: string): Buffer {
  return Buffer.from(`﻿${text}`, 'utf16le')
}

function wslList(rows: Array<{ name: string; state?: string; version: 1 | 2 }>): Buffer {
  const lines = ['  NAME      STATE           VERSION', ...rows.map((r, i) => `${i === 0 ? '*' : ' '} ${r.name}    ${r.state ?? 'Stopped'}         ${r.version}`)]
  return utf16(lines.join('\r\n'))
}

interface FakeWsl {
  version: 1 | 2
  pid1: string
  conf: Buffer | null
  /** pid1 after a terminate. */
  pid1AfterTerminate?: string
  failTerminate?: boolean
  failSetVersion?: boolean
  versionAfterSetVersion?: 1 | 2
  /** Ignore writes (simulates a write that "succeeds" but changes nothing). */
  dropWrites?: boolean
}

function harness(state: FakeWsl, opts: { onExec?: (call: Call) => void } = {}) {
  const calls: Call[] = []
  const writes: Array<{ args: string[]; stdin: Buffer; options: Record<string, unknown> }> = []
  const execFile = (file: string, args: string[], options: Record<string, unknown>, cb: (e: Error | null, out: Buffer, err: Buffer) => void) => {
    const call = { file, args, options }
    calls.push(call)
    opts.onExec?.(call)
    const ok = (out: Buffer | string = '') => queueMicrotask(() => cb(null, Buffer.isBuffer(out) ? out : Buffer.from(out), Buffer.alloc(0)))
    const fail = (message: string) => queueMicrotask(() => cb(Object.assign(new Error(message), { code: 1 }), Buffer.alloc(0), Buffer.from(message)))
    const signal = options.signal as AbortSignal | undefined
    if (signal?.aborted) {
      queueMicrotask(() => cb(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }), Buffer.alloc(0), Buffer.alloc(0)))
      return
    }
    if (args[0] === '-l') return ok(wslList([{ name: 'Test', version: state.version }]))
    if (args[0] === '--set-version') {
      state.version = state.versionAfterSetVersion ?? 2
      return state.failSetVersion ? fail('conversion error') : ok()
    }
    if (args[0] === '--terminate') {
      if (state.failTerminate) return fail('terminate failed')
      if (state.pid1AfterTerminate) state.pid1 = state.pid1AfterTerminate
      return ok()
    }
    if (args.includes('/proc/1/comm')) return ok(`${state.pid1}\n`)
    if (args.includes(READ_WSL_CONF_SCRIPT)) {
      return ok(state.conf === null ? 'BAT_WSLCONF=absent\n' : Buffer.concat([Buffer.from('BAT_WSLCONF=present\n'), state.conf]))
    }
    if (args.includes('cp')) return ok()
    fail(`unexpected ${args.join(' ')}`)
  }
  const spawn = (_file: string, args: readonly string[], options: Record<string, unknown>) => {
    const child = new EventEmitter() as EventEmitter & { stdin: EventEmitter & { end: (b: Buffer) => void }; stderr: EventEmitter }
    child.stderr = new EventEmitter()
    const stdin = new EventEmitter() as EventEmitter & { end: (b: Buffer) => void }
    stdin.end = (buffer: Buffer) => {
      writes.push({ args: [...args], stdin: buffer, options })
      if (!state.dropWrites) state.conf = buffer
      queueMicrotask(() => child.emit('close', 0))
    }
    child.stdin = stdin
    return child as never
  }
  const logs: string[] = []
  const applier = new WslEnvApplier({
    execFile,
    spawn: spawn as never,
    now: () => new Date(2026, 10, 4, 12, 30, 5),
    sleep: async () => undefined,
    log: (m) => logs.push(m),
  })
  return { applier, calls, writes, logs, state }
}

const has = (calls: Call[], flag: string) => calls.some((c) => c.args.includes(flag))

describe('WslEnvApplier enable-systemd (T0840 P-2)', () => {
  it('already PID 1 → already: no read, no write, no terminate', async () => {
    const h = harness({ version: 2, pid1: 'systemd', conf: Buffer.from('[boot]\nsystemd=true\n') })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(result).toEqual({ ok: true, outcome: 'already', changes: [], terminated: false })
    expect(h.writes).toHaveLength(0)
    expect(has(h.calls, '--terminate')).toBe(false)
    expect(has(h.calls, READ_WSL_CONF_SCRIPT)).toBe(false)
  })

  it('systemd=false → backup, write over stdin (only that line), terminate, verify PID 1', async () => {
    const original = '# keep me\n[boot]\nsystemd=false\n\n[user]\ndefault=alice\n'
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from(original), pid1AfterTerminate: 'systemd' })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(result).toEqual({
      ok: true,
      outcome: 'applied',
      terminated: true,
      changes: [{ item: 'enable-systemd', kind: 'file', path: '/etc/wsl.conf', backupPath: '/etc/wsl.conf.bat-backup-20261104-123005' }],
    })
    const backup = h.calls.find((c) => c.args.includes('cp'))!
    expect(backup.args).toEqual(['-d', 'Test', '-u', 'root', '--exec', 'cp', '-p', '--', '/etc/wsl.conf', '/etc/wsl.conf.bat-backup-20261104-123005'])
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0].stdin.toString('utf8')).toBe('# keep me\n[boot]\nsystemd=true\n\n[user]\ndefault=alice\n')
    // Contents go over stdin only.
    expect(h.writes[0].args).toEqual(['-d', 'Test', '-u', 'root', '--exec', 'sh', '-c', WRITE_WSL_CONF_SCRIPT, 'sh'])
    for (const call of h.calls) expect(call.args.join(' ')).not.toContain('default=alice')
    // Backup happens before the write, terminate after it, verification last.
    const order = h.calls.map((c) => (c.args.includes('cp') ? 'cp' : c.args[0] === '--terminate' ? 'terminate' : c.args.includes('/proc/1/comm') ? 'pid1' : c.args[0]))
    expect(order.indexOf('cp')).toBeLessThan(order.indexOf('terminate'))
    expect(order.lastIndexOf('pid1')).toBeGreaterThan(order.indexOf('terminate'))
    // Log: item / outcome / counts only.
    expect(h.logs).toEqual([expect.stringMatching(/^\[wsl-env-apply\] enable-systemd -> applied changes=1 terminated=true ms=\d+$/)])
  })

  it('keeps the file encoding (UTF-16 LE with BOM) and CRLF', async () => {
    const original = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('[boot]\r\nsystemd=false\r\n', 'utf16le')])
    const h = harness({ version: 2, pid1: 'init', conf: original, pid1AfterTerminate: 'systemd' })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(result.ok).toBe(true)
    expect(h.writes[0].stdin).toEqual(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('[boot]\r\nsystemd=true\r\n', 'utf16le')]))
  })

  it('no /etc/wsl.conf → creates it without a backup', async () => {
    const h = harness({ version: 2, pid1: 'init', conf: null, pid1AfterTerminate: 'systemd' })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(result.ok && result.changes).toEqual([{ item: 'enable-systemd', kind: 'file', path: '/etc/wsl.conf', backupPath: null }])
    expect(has(h.calls, 'cp')).toBe(false)
    expect(h.writes[0].stdin.toString('utf8')).toBe('[boot]\nsystemd=true\n')
  })

  it('declared but not running → no write, only terminate + verify', async () => {
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from('[boot]\nsystemd=true\n'), pid1AfterTerminate: 'systemd' })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(result).toEqual({ ok: true, outcome: 'applied', changes: [], terminated: true })
    expect(h.writes).toHaveLength(0)
  })

  it('a file the editor cannot parse is never written', async () => {
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from('[boot\nsystemd=false\n') })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errorCode).toBe('wsl-systemd-enable-failed')
    expect(h.writes).toHaveLength(0)
    expect(has(h.calls, '--terminate')).toBe(false)
  })

  it('verifies the write by reading it back (exit code is not trusted)', async () => {
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from('[boot]\nsystemd=false\n'), dropWrites: true })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(!result.ok && result.errorCode).toBe('wsl-systemd-enable-failed')
    expect(has(h.calls, '--terminate')).toBe(false)
  })

  it('systemd still not PID 1 after terminate → failed, changes kept', async () => {
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from('[boot]\nsystemd=false\n') })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('wsl-systemd-enable-failed')
    expect(result.terminated).toBe(true)
    expect(result.changes).toHaveLength(1)
  })

  it('terminate failure → wsl-terminate-failed', async () => {
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from('[boot]\nsystemd=false\n'), failTerminate: true })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(!result.ok && result.errorCode).toBe('wsl-terminate-failed')
  })

  it('WSL 1: declares systemd but does not terminate (it starts after the conversion)', async () => {
    const h = harness({ version: 1, pid1: 'init', conf: null })
    const result = await h.applier.apply('Test', 'enable-systemd')
    expect(result).toMatchObject({ ok: true, outcome: 'applied', terminated: false })
    expect(has(h.calls, '--terminate')).toBe(false)
    expect(has(h.calls, '/proc/1/comm')).toBe(false)
  })

  it('aborted before anything → aborted, nothing written', async () => {
    const controller = new AbortController()
    controller.abort()
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from('[boot]\nsystemd=false\n') })
    const result = await h.applier.apply('Test', 'enable-systemd', { signal: controller.signal })
    expect(result).toMatchObject({ ok: false, aborted: true, changes: [] })
    expect(h.calls).toHaveLength(0)
  })

  it('aborted after the write → aborted, the write is reported, no terminate', async () => {
    const controller = new AbortController()
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from('[boot]\nsystemd=false\n') }, {
      onExec: (call) => {
        // The read-back after the write: abort right there.
        if (call.args.includes(READ_WSL_CONF_SCRIPT) && h.writes.length === 1) controller.abort()
      },
    })
    const result = await h.applier.apply('Test', 'enable-systemd', { signal: controller.signal })
    expect(result).toMatchObject({ ok: false, aborted: true })
    expect(result.changes).toHaveLength(1)
    expect(has(h.calls, '--terminate')).toBe(false)
  })

  it('passes the abort signal and a timeout to every child', async () => {
    const controller = new AbortController()
    const h = harness({ version: 2, pid1: 'init', conf: Buffer.from('[boot]\nsystemd=false\n'), pid1AfterTerminate: 'systemd' })
    await h.applier.apply('Test', 'enable-systemd', { signal: controller.signal })
    for (const call of h.calls) {
      expect(call.options.signal).toBe(controller.signal)
      expect(call.options.timeout).toBeGreaterThan(0)
    }
    expect(h.writes[0].options.signal).toBe(controller.signal)
  })
})

describe('WslEnvApplier wsl2-convert (T0840 P-1)', () => {
  it('already WSL 2 → already, no --set-version', async () => {
    const h = harness({ version: 2, pid1: 'systemd', conf: null })
    expect(await h.applier.apply('Test', 'wsl2-convert')).toEqual({ ok: true, outcome: 'already', changes: [], terminated: false })
    expect(has(h.calls, '--set-version')).toBe(false)
  })

  it('WSL 1 → --set-version <d> 2 without the abort signal, long timeout, verified by wsl -l -v', async () => {
    const controller = new AbortController()
    const h = harness({ version: 1, pid1: 'init', conf: null })
    const result = await h.applier.apply('Test', 'wsl2-convert', { signal: controller.signal })
    expect(result).toEqual({ ok: true, outcome: 'applied', changes: [{ item: 'wsl2-convert', kind: 'wsl-version' }], terminated: true })
    const setVersion = h.calls.find((c) => c.args[0] === '--set-version')!
    expect(setVersion.args).toEqual(['--set-version', 'Test', '2'])
    expect(setVersion.options.signal).toBeUndefined()
    expect(setVersion.options.timeout).toBe(SET_VERSION_TIMEOUT_MS)
  })

  it('non-zero exit but the distro is WSL 2 afterwards → applied (state wins)', async () => {
    const h = harness({ version: 1, pid1: 'init', conf: null, failSetVersion: true })
    const result = await h.applier.apply('Test', 'wsl2-convert')
    expect(result).toMatchObject({ ok: true, outcome: 'applied' })
  })

  it('still WSL 1 afterwards → wsl-set-version-failed', async () => {
    const h = harness({ version: 1, pid1: 'init', conf: null, versionAfterSetVersion: 1, failSetVersion: true })
    const result = await h.applier.apply('Test', 'wsl2-convert')
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-set-version-failed', changes: [] })
  })

  it('aborted while converting → the conversion is reported as done and aborted', async () => {
    const controller = new AbortController()
    const h = harness({ version: 1, pid1: 'init', conf: null }, {
      onExec: (call) => { if (call.args[0] === '--set-version') controller.abort() },
    })
    const result = await h.applier.apply('Test', 'wsl2-convert', { signal: controller.signal })
    expect(result).toMatchObject({ ok: false, aborted: true, changes: [{ item: 'wsl2-convert', kind: 'wsl-version' }] })
  })
})

describe('WslEnvApplier input checks and source guards (T0840)', () => {
  it('rejects a distro outside the whitelist and unknown items before spawning', async () => {
    const h = harness({ version: 2, pid1: 'init', conf: null })
    expect(await h.applier.apply('Bad;name', 'enable-systemd')).toMatchObject({ ok: false, errorCode: 'wsl-env-apply-invalid' })
    expect(await h.applier.apply('Test', 'enable-linger')).toMatchObject({ ok: false, errorCode: 'wsl-env-apply-invalid' })
    expect(h.calls).toHaveLength(0)
  })

  it('module: no electron import, no shell-spawning exec API, no userData', () => {
    const source = readFileSync(path.join(__dirname, '..', 'wsl-env-apply.ts'), 'utf8')
    expect(source).not.toMatch(/from 'electron'/)
    expect(source).not.toMatch(/\bexecSync\b|\bspawnSync\b|childProcess\.exec\(|shell:\s*true/)
    expect(source).not.toMatch(/getPath\(/)
  })
})
