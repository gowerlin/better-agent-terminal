import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { shutdownSshProcess } from '../electron/remote/ssh-process-lifecycle'

// T0299 / BUG-063 — every test mocks ChildProcess; no real ssh spawned.

interface FakeProc extends EventEmitter {
  exitCode: number | null
  signalCode: NodeJS.Signals | null
  pid: number
  killCalls: Array<NodeJS.Signals | number | undefined>
  exitOnKill?: { signal: NodeJS.Signals; delayMs: number }
  kill(sig?: NodeJS.Signals | number): boolean
}

function makeFakeProc(): FakeProc {
  const ee = new EventEmitter() as FakeProc
  ee.exitCode = null
  ee.signalCode = null
  ee.pid = 12345
  ee.killCalls = []
  ee.kill = (sig?: NodeJS.Signals | number) => {
    ee.killCalls.push(sig)
    if (ee.exitOnKill && sig === ee.exitOnKill.signal && ee.exitCode === null) {
      const sigName = ee.exitOnKill.signal
      setTimeout(() => {
        if (ee.exitCode === null) {
          ee.exitCode = sigName === 'SIGKILL' ? 137 : 143
          ee.signalCode = sigName
          ee.emit('exit', ee.exitCode, sigName)
        }
      }, ee.exitOnKill.delayMs)
    }
    return true
  }
  return ee
}

const cap = () => { const m: string[] = []; return { logger: { warn: (s: string) => m.push(s) }, m } }

test('test1: SIGTERM exit within grace → method=sigterm', async () => {
  const p = makeFakeProc(); p.exitOnKill = { signal: 'SIGTERM', delayMs: 5 }
  assert.deepEqual(await shutdownSshProcess(p as unknown as ChildProcess, { gracePeriodMs: 100, timeoutMs: 500 }), { exited: true, method: 'sigterm' })
  assert.deepEqual(p.killCalls, ['SIGTERM'])
})

test('test2: ignores SIGTERM, exits on SIGKILL → method=sigkill + warn', async () => {
  const p = makeFakeProc(); p.exitOnKill = { signal: 'SIGKILL', delayMs: 5 }
  const c = cap()
  assert.deepEqual(await shutdownSshProcess(p as unknown as ChildProcess, { gracePeriodMs: 30, timeoutMs: 200, logger: c.logger }), { exited: true, method: 'sigkill' })
  assert.deepEqual(p.killCalls, ['SIGTERM', 'SIGKILL'])
  assert.ok(c.m.some((s) => s.includes('escalating to SIGKILL') && s.includes('pid=12345')))
})

test('test3: ignores SIGKILL too → method=timeout, exited=false', async () => {
  const p = makeFakeProc(); const c = cap()
  assert.deepEqual(await shutdownSshProcess(p as unknown as ChildProcess, { gracePeriodMs: 20, timeoutMs: 60, logger: c.logger }), { exited: false, method: 'timeout' })
  assert.deepEqual(p.killCalls, ['SIGTERM', 'SIGKILL']); assert.equal(c.m.length, 2)
})

test('test4: already exited (exitCode set) → no kill, immediate sigterm', async () => {
  const proc = makeFakeProc()
  proc.exitCode = 0
  const r = await shutdownSshProcess(proc as unknown as ChildProcess)
  assert.deepEqual(r, { exited: true, method: 'sigterm' })
  assert.deepEqual(proc.killCalls, [])
})

test('test5: custom grace+timeout honoured (elapsed ~total)', async () => {
  const proc = makeFakeProc()
  const t0 = Date.now()
  const r = await shutdownSshProcess(proc as unknown as ChildProcess, { gracePeriodMs: 25, timeoutMs: 75 })
  const dt = Date.now() - t0
  assert.equal(r.method, 'timeout')
  assert.ok(dt >= 60 && dt < 500, `elapsed ${dt}ms outside expected window`)
})

test('test6: kill() throw is swallowed (ESRCH race)', async () => {
  const proc = makeFakeProc()
  proc.kill = () => { proc.killCalls.push('SIGTERM'); throw new Error('ESRCH') }
  const r = await shutdownSshProcess(proc as unknown as ChildProcess, { gracePeriodMs: 5, timeoutMs: 20 })
  assert.deepEqual(r, { exited: false, method: 'timeout' })
})
