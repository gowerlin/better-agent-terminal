// @vitest-environment node
/**
 * PLAN-038 U1 (T0832): `upload:*` on a real headless bat-server (T0388 harness: in-process server,
 * wss client, real frame protocol) — the path a remote-profile window takes.
 *
 *   - a client (server token) stages a multi-chunk file under <dataDir>/uploads/<session>/…,
 *     serverPath comes back in server form; POSIX 0700 / 0600
 *   - `claude:dispose-session` removes the session's uploads
 *   - an unauthenticated socket and a helper capability (tower / worker PTY token) are refused,
 *     nothing is staged
 *   - logs never carry the file name
 *   - T0835: a terminal tab's uploads (session key = PTY id) go with `pty:kill`, not with a ⏻ restart
 */
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { TLSSocket } from 'tls'
import WebSocket from 'ws'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { logger } from '../../logger'
import { HelperCapabilityRegistry } from '../helper-capability'
import { PTY_UPLOAD_DISPOSE_GRACE_MS } from '../headless-entry'
import { UPLOAD_LIMITS } from '../../upload-staging'
import { connectHeadlessClient, startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex')
const posix = process.platform !== 'win32'

const logLines: string[] = []
const captureLogger = {
  log: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) },
  warn: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) },
  error: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) },
}

let registry: HelperCapabilityRegistry
let harness: HeadlessHarness

beforeAll(async () => {
  // upload-staging logs through the shared logger (not the server's injected one)
  vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logLines.push(args.map(String).join(' ')) })
  vi.spyOn(logger, 'warn').mockImplementation((...args: unknown[]) => { logLines.push(args.map(String).join(' ')) })
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry, logger: captureLogger })
})

afterAll(async () => {
  await harness?.dispose()
  vi.restoreAllMocks()
})

async function stage(session: string, name: string, data: Buffer): Promise<string> {
  const begin = await harness.invoke('upload:begin', session, name, data.length) as { ok: boolean; uploadId: string; chunkBytes: number }
  expect(begin).toMatchObject({ ok: true, chunkBytes: UPLOAD_LIMITS.chunkBytes })
  for (let offset = 0; offset < data.length; offset += begin.chunkBytes) {
    const part = data.subarray(offset, offset + begin.chunkBytes)
    expect(await harness.invoke('upload:chunk', begin.uploadId, offset, part.toString('base64')))
      .toEqual({ ok: true, received: offset + part.length })
  }
  const finish = await harness.invoke('upload:finish', begin.uploadId, sha(data)) as { ok: boolean; serverPath: string; size: number }
  expect(finish).toMatchObject({ ok: true, size: data.length })
  return finish.serverPath
}

describe('upload:* over a real headless server (T0832)', () => {
  it('stages a multi-chunk file under <dataDir>/uploads; serverPath is a server path', async () => {
    const data = Buffer.alloc(UPLOAD_LIMITS.chunkBytes * 2 + 1234)
    for (let i = 0; i < data.length; i++) data[i] = i % 251
    const serverPath = await stage('t0832-sess-a', 'C:\\Users\\demo\\secret-name.bin', data)
    const uploadsRoot = path.join(harness.dataDir, 'uploads')
    expect(path.dirname(path.dirname(path.dirname(serverPath)))).toBe(uploadsRoot)
    expect(path.basename(serverPath)).toBe('secret-name.bin')
    expect(fs.readFileSync(serverPath).equals(data)).toBe(true)
    if (posix) {
      expect(fs.statSync(path.dirname(serverPath)).mode & 0o777).toBe(0o700)
      expect(fs.statSync(serverPath).mode & 0o777).toBe(0o600)
    }
    expect(logLines.some(line => line.includes('[upload] finish') && line.includes('result=ok'))).toBe(true)
    expect(logLines.join('\n')).not.toContain('secret-name')
  })

  it('errors come back as results, not invoke errors', async () => {
    expect(await harness.invoke('upload:begin', '../escape', 'a', 1)).toMatchObject({ ok: false, code: 'BAD_ARGS' })
    expect(await harness.invoke('upload:begin', 'sess', 'a', UPLOAD_LIMITS.maxFileBytes + 1)).toMatchObject({ ok: false, code: 'TOO_LARGE' })
    expect(await harness.invoke('upload:chunk', 'ffffffffffffffff', 0, 'AAAA')).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    const begin = await harness.invoke('upload:begin', 't0832-sess-b', 'x.txt', 3) as { uploadId: string }
    expect(await harness.invoke('upload:chunk', begin.uploadId, 1, Buffer.from('bc').toString('base64'))).toMatchObject({ ok: false, code: 'BAD_OFFSET' })
    expect(await harness.invoke('upload:abort', begin.uploadId)).toEqual({ ok: true, aborted: true })
  })

  it('claude:dispose-session removes the session uploads', async () => {
    const serverPath = await stage('t0832-sess-dispose', 'a.txt', Buffer.from('dispose me'))
    expect(fs.existsSync(serverPath)).toBe(true)
    await harness.invoke('claude:dispose-session', 't0832-sess-dispose')
    const sessionDir = path.join(harness.dataDir, 'uploads', 't0832-sess-dispose')
    await expect.poll(() => fs.existsSync(sessionDir), { timeout: 3000 }).toBe(false)
  })

  it('an unauthenticated socket is refused', async () => {
    const ws = new WebSocket(`wss://127.0.0.1:${harness.port}`, { rejectUnauthorized: false })
    try {
      await new Promise<void>((resolve, reject) => {
        ws.once('upgrade', res => {
          if ((res.socket as TLSSocket).getPeerCertificate().fingerprint256 !== harness.fingerprint) reject(new Error('fingerprint'))
        })
        ws.once('open', () => resolve())
        ws.once('error', reject)
      })
      const answer = await new Promise<{ type: string; error?: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no answer')), 5000)
        ws.once('message', raw => { clearTimeout(timer); resolve(JSON.parse(raw.toString())) })
        ws.send(JSON.stringify({ type: 'invoke', id: 'u1', channel: 'upload:begin', args: ['t0832-unauth', 'a.txt', 1] }))
      })
      expect(answer).toMatchObject({ type: 'invoke-error', error: 'Not authenticated' })
    } finally {
      ws.terminate()
    }
    expect(fs.existsSync(path.join(harness.dataDir, 'uploads', 't0832-unauth'))).toBe(false)
  })

  it.each(['tower', 'worker'] as const)('a %s helper capability (PTY token) is refused', async role => {
    const towerId = `t0832-tower-${process.pid}`
    const token = role === 'tower'
      ? registry.issue(`${towerId}-${role}`)
      : registry.issue(`t0832-worker-${process.pid}`, { towerId })
    const helper = await connectHeadlessClient({ port: harness.port, token, fingerprint: harness.fingerprint })
    try {
      for (const [channel, args] of [
        ['upload:begin', ['t0832-helper', 'a.txt', 1]],
        ['upload:chunk', ['ffffffffffffffff', 0, 'AAAA']],
        ['upload:finish', ['ffffffffffffffff', '0'.repeat(64)]],
        ['upload:abort', ['ffffffffffffffff']],
      ] as const) {
        await expect(helper.invoke(channel, ...args)).rejects.toThrow(/^Forbidden: channel-not-allowed$/)
      }
    } finally {
      await helper.close()
    }
    expect(fs.existsSync(path.join(harness.dataDir, 'uploads', 't0832-helper'))).toBe(false)
  })
})

describe('terminal tab uploads follow the PTY (T0835, 契約 C-8 ②)', () => {
  const SHELL = process.platform === 'win32'
    ? (process.env.ComSpec || 'C:\Windows\System32\cmd.exe')
    : (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh')
  const CWD = os.tmpdir()

  it('pty:kill removes the PTY id session after the grace; a ⏻ pty:restart keeps it', { timeout: 60_000 }, async () => {
    const killed = `t0835-kill-${process.pid}`
    const restarted = `t0835-restart-${process.pid}`
    for (const id of [killed, restarted]) {
      expect(await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', shell: SHELL })).toEqual({ ok: true, created: true })
    }
    const killedPath = await stage(killed, 'a.png', Buffer.from('png of the killed tab'))
    const restartedPath = await stage(restarted, 'b.png', Buffer.from('png of the restarted tab'))

    expect(await harness.invoke('pty:kill', killed)).toBe(true)
    expect(await harness.invoke('pty:restart', restarted, CWD, SHELL)).toBe(true)
    // still there inside the grace (a renderer's kill → create relaunch has the time to come back)
    expect(fs.existsSync(killedPath)).toBe(true)

    await expect.poll(() => fs.existsSync(path.join(harness.dataDir, 'uploads', killed)), {
      timeout: PTY_UPLOAD_DISPOSE_GRACE_MS + 10_000,
      interval: 200,
    }).toBe(false)
    expect(fs.existsSync(restartedPath)).toBe(true)
    expect(await harness.invoke('pty:kill', restarted)).toBe(true)
  })
})
