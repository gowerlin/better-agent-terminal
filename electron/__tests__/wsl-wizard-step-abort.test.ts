/**
 * T0830 (PLAN-043): the setup wizard's step abort reaches the WSL child processes in main.
 *
 * wsl-systemd startService({ signal }):
 *   - every `wsl.exe` call gets execFile's `signal`; without a signal no call carries one
 *   - an abort during the poll returns `wsl-service-start-aborted` at once, no journal read
 *   - an already-aborted signal runs nothing; an abort that kills a call (execFile rejects) → aborted
 * wsl-detect installBundle({ signal }):
 *   - the script's `$0` is a per-install marker (`bat-wizard-install-<12 hex>`), argv otherwise identical;
 *     without a signal `$0` stays `sh` (pre-T0830 argv)
 *   - an abort runs INSTALL_STOP_SCRIPT with the `[b]at-…` pattern (kills only the script's `tar`) and
 *     does not kill the install's own wsl.exe; the install then exits through its own cleanup → aborted
 *   - an install that still finishes after the abort reports ok + previous (the wizard rolls it back)
 *   - the stop pattern never matches its own text; the stop script never kills anything but `tar`
 */
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BUNDLE_INSTALL_ABORTED_ERROR,
  INSTALL_STOP_SCRIPT,
  installBundle,
  installScriptMarker,
  installStopPattern,
  resetExecFileImplForTests as resetDetectExec,
  setExecFileImplForTests as setDetectExec,
} from '../wsl-detect'
import {
  START_SERVICE_ABORTED_ERROR,
  resetExecFileImplForTests as resetSystemdExec,
  setExecFileImplForTests as setSystemdExec,
  startService,
} from '../wsl-systemd'
import { BUNDLE_PREVIOUS_MARKER, buildWslBundleInstallScript } from '../server-bundle-install-script'

type Callback = (error: Error | null, stdout: Buffer, stderr: Buffer) => void
interface ExecCall { file: string; args: string[]; options: Record<string, unknown>; callback: Callback }

afterEach(() => {
  resetDetectExec()
  resetSystemdExec()
})

const SERVICE = 'bat-server.service'
const SHOW = `systemctl --user show ${SERVICE} -p ActiveState -p SubState -p NRestarts`
const FAST = { dataDir: '/home/demo/.local/share/bat-server', stableMs: 10_000, pollMs: 5, timeoutMs: 10_000 }

/** systemctl / date replies right away; `show` says activating (so the poll keeps going). */
function systemdExec(): ExecCall[] {
  const calls: ExecCall[] = []
  setSystemdExec((file: string, args: string[], options: Record<string, unknown>, callback: Callback) => {
    calls.push({ file, args, options, callback })
    const line = args.slice(3).join(' ')
    const signal = options.signal as AbortSignal | undefined
    if (signal?.aborted) {
      callback(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }), Buffer.alloc(0), Buffer.alloc(0))
      return undefined
    }
    if (line === SHOW) callback(null, Buffer.from('NRestarts=0\nActiveState=activating\nSubState=start\n'), Buffer.alloc(0))
    else if (line === 'date +%s') callback(null, Buffer.from('1790000000\n'), Buffer.alloc(0))
    else callback(null, Buffer.alloc(0), Buffer.alloc(0))
    return undefined
  })
  return calls
}

describe('startService with an abort signal (T0830)', () => {
  it('without a signal no wsl.exe call carries one (pre-T0830 options)', async () => {
    const calls = systemdExec()
    const result = await startService('Ubuntu-24.04', SERVICE, { ...FAST, timeoutMs: 30 })
    expect(result.ok).toBe(false)
    expect(calls.length).toBeGreaterThan(3)
    for (const call of calls) expect('signal' in call.options).toBe(false)
  })

  it('an abort during the poll returns wsl-service-start-aborted without reading the journal', async () => {
    const calls = systemdExec()
    const controller = new AbortController()
    const pending = startService('Ubuntu-24.04', SERVICE, { ...FAST, signal: controller.signal })
    await new Promise((resolve) => setTimeout(resolve, 30))
    controller.abort()
    const result = await pending
    expect(result).toEqual({ ok: false, error: START_SERVICE_ABORTED_ERROR, errorCode: 'wsl-service-start-aborted' })
    expect(calls.every((c) => c.options.signal === controller.signal)).toBe(true)
    expect(calls.some((c) => c.args.includes('journalctl'))).toBe(false)
  })

  it('an already-aborted signal runs nothing', async () => {
    const calls = systemdExec()
    const controller = new AbortController()
    controller.abort()
    expect((await startService('Ubuntu-24.04', SERVICE, { ...FAST, signal: controller.signal })).ok).toBe(false)
    expect(calls).toEqual([])
  })

  it('a call killed by the abort (execFile rejects) is reported as aborted, not as a start failure', async () => {
    const controller = new AbortController()
    setSystemdExec((_file: string, args: string[], options: Record<string, unknown>, callback: Callback) => {
      if (args.includes('daemon-reload')) {
        // hangs until the abort kills it
        ;(options.signal as AbortSignal).addEventListener('abort', () =>
          callback(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }), Buffer.alloc(0), Buffer.alloc(0)))
        return undefined
      }
      callback(new Error(`unexpected ${args.join(' ')}`), Buffer.alloc(0), Buffer.alloc(0))
      return undefined
    })
    const pending = startService('Ubuntu-24.04', SERVICE, { ...FAST, signal: controller.signal })
    controller.abort()
    expect(await pending).toMatchObject({ ok: false, errorCode: 'wsl-service-start-aborted' })
  })
})

const ROOT = '/home/me/.local/bat-server'
const TARBALL = 'C:\\Users\\me\\bundles\\bat-server.tar.gz'
const TARBALL_WSL = '/mnt/c/Users/me/bundles/bat-server.tar.gz'

/** The install call stays pending until settleInstall(); stop calls answer `stop`. */
function detectExec(stop: string = 'killed'): { calls: ExecCall[]; settleInstall: (error: Error | null, stdout?: string) => void } {
  const calls: ExecCall[] = []
  let install: ExecCall | null = null
  setDetectExec((file: string, args: string[], options: Record<string, unknown>, callback: Callback) => {
    const call = { file, args, options, callback }
    calls.push(call)
    if (args.includes(INSTALL_STOP_SCRIPT)) {
      callback(null, Buffer.from(`BAT_INSTALL_STOP=${stop}\n`), Buffer.alloc(0))
    } else {
      install = call
    }
    return undefined
  })
  return {
    calls,
    settleInstall: (error, stdout = '') => install?.callback(error, Buffer.from(stdout), Buffer.from(error ? 'server bundle install: extract failed\n' : '')),
  }
}

describe('installBundle with an abort signal (T0830)', () => {
  it('uses a per-install `$0` marker; argv otherwise as before', async () => {
    const { calls, settleInstall } = detectExec()
    const controller = new AbortController()
    const pending = installBundle('Ubuntu-24.04', TARBALL, ROOT, { keepPrevious: true, signal: controller.signal })
    await Promise.resolve()
    settleInstall(null, `${BUNDLE_PREVIOUS_MARKER}none\n`)
    expect(await pending).toEqual({ ok: true, previous: 'none' })
    const args = calls[0].args
    expect(args.slice(0, 6)).toEqual(['-d', 'Ubuntu-24.04', '--exec', 'sh', '-c', buildWslBundleInstallScript()])
    expect(args[6]).toMatch(/^bat-wizard-install-[0-9a-f]{12}$/)
    expect(args.slice(7)).toEqual([ROOT, TARBALL_WSL, 'keep'])
    // the install's own wsl.exe is not tied to the signal (never cut off mid-swap)
    expect('signal' in calls[0].options).toBe(false)
  })

  it('without a signal `$0` stays `sh` (pre-T0830 argv)', async () => {
    const { calls, settleInstall } = detectExec()
    const pending = installBundle('Ubuntu-24.04', TARBALL, ROOT, { keepPrevious: true })
    await Promise.resolve()
    settleInstall(null)
    await pending
    expect(calls[0].args[6]).toBe('sh')
    expect(calls).toHaveLength(1)
  })

  it('an abort stops only the script\'s tar; the script exits through its cleanup → aborted', async () => {
    const { calls, settleInstall } = detectExec('killed')
    const controller = new AbortController()
    const stops: string[] = []
    const pending = installBundle('Ubuntu-24.04', TARBALL, ROOT, {
      keepPrevious: true,
      signal: controller.signal,
      onStop: (outcome) => stops.push(outcome),
    })
    await Promise.resolve()
    controller.abort()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toHaveLength(2)
    const marker = calls[0].args[6]
    expect(calls[1].args).toEqual(['-d', 'Ubuntu-24.04', '--exec', 'sh', '-c', INSTALL_STOP_SCRIPT, 'sh', installStopPattern(marker)])
    expect(stops).toEqual(['killed'])
    // tar was killed: the script printed "extract failed" and exited 1
    settleInstall(Object.assign(new Error('Command failed: wsl'), { code: 1 }))
    expect(await pending).toEqual({ ok: false, error: BUNDLE_INSTALL_ABORTED_ERROR, aborted: true })
  })

  it('an install that still finishes after the abort reports its result (the wizard rolls it back)', async () => {
    const { settleInstall } = detectExec('gone')
    const controller = new AbortController()
    const pending = installBundle('Ubuntu-24.04', TARBALL, ROOT, { keepPrevious: true, signal: controller.signal })
    await Promise.resolve()
    controller.abort()
    settleInstall(null, `${BUNDLE_PREVIOUS_MARKER}kept\n`)
    expect(await pending).toEqual({ ok: true, previous: 'kept' })
  })

  it('an already-aborted signal runs nothing', async () => {
    const { calls } = detectExec()
    const controller = new AbortController()
    controller.abort()
    expect(await installBundle('Ubuntu-24.04', TARBALL, ROOT, { signal: controller.signal }))
      .toEqual({ ok: false, error: BUNDLE_INSTALL_ABORTED_ERROR, aborted: true })
    expect(calls).toEqual([])
  })

  it('stop pattern: matches the marker, not its own text; marker accepts only 12 hex', () => {
    const marker = installScriptMarker('0123456789ab')
    const pattern = installStopPattern(marker)
    expect(pattern).toBe('[b]at-wizard-install-0123456789ab')
    const re = new RegExp(pattern)
    expect(re.test(`sh -c script ${marker} ${ROOT}`)).toBe(true)
    expect(re.test(`sh -c ${INSTALL_STOP_SCRIPT} sh ${pattern}`)).toBe(false)
    expect(() => installScriptMarker('xyz')).toThrow()
    expect(() => installScriptMarker('0123456789AB')).toThrow()
  })

  it('stop script kills only `tar` children of the matched script, never wsl / sh themselves', () => {
    const kills = INSTALL_STOP_SCRIPT.split('\n').filter((line) => /\b(kill|pkill)\b/.test(line))
    expect(kills).toHaveLength(1)
    expect(kills[0]).toContain('pkill -TERM -x -P "$p" tar')
  })
})

describe('main.ts wiring (T0830 source guard)', () => {
  const source = readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8')
  const handler = (channel: string): string => {
    const start = source.indexOf(`ipcMain.handle('${channel}'`)
    expect(start).toBeGreaterThan(0)
    return source.slice(start, source.indexOf('\n  ipcMain.handle(', start + 10))
  }

  it('registers wizard:abort-operation on the operation registry', () => {
    expect(source).toContain('const wizardOperations = new WizardOperationRegistry()')
    expect(handler('wizard:abort-operation')).toContain('wizardOperations.abort(operationId)')
  })

  it('install-bundle / start-service: no operation id → the pre-T0830 call, unchanged', () => {
    const install = handler('wsl:install-bundle')
    expect(install).toContain('wizardOperations.begin(options?.operationId)')
    expect(install).toContain('if (!operation.signal) return wslDetect.installBundle(distro, tarballPath, installPath, { keepPrevious: options?.keepPrevious === true })')
    expect(install).toContain('operation.end()')
    const start = handler('wsl-systemd:start-service')
    expect(start).toContain('if (!operation.signal) return wslSystemd.startService(distro, serviceName, { dataDir: options?.dataDir, timeoutMs: options?.timeoutMs })')
    expect(start).toContain('operation.end()')
  })

  it('distribute passes the signal only when the call carried an operation id', () => {
    const distribute = source.slice(source.indexOf("'server-bundle:distribute'"), source.indexOf("ipcMain.handle('server-bundle:import-local'"))
    expect(distribute).toContain('wizardOperations.begin(opts.operationId)')
    expect(distribute).toContain('...(operation.signal ? { signal: operation.signal } : {})')
    expect(distribute).toContain('operation.end()')
  })
})
