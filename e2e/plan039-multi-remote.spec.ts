// PLAN-039 — several remote profiles connected at once (T0466).
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT. Two isolated instances (`e2e/fixtures/electron-isolation.ts`,
// T0399) act as each other's remote servers:
//
//   instance A (the client under test)
//     profile P → A's own RemoteServer   (127.0.0.1:<A port>, loopback)
//     profile Q → B's RemoteServer       (127.0.0.1:<B port>)
//   instance B: only serves Q (and the filler profiles that point at it)
//
// Two separate servers are what makes routing observable: two profiles pointed
// at one loopback server would take the same-target path and could not show
// that `pty:create` from a P window lands on A and from a Q window on B (T0459).
//
// M1  P and Q windows are both connected, each to its own server
// M2  pty:create from each window lands on that window's server only; B's PTY
//     output reaches Q's window and not P's
// M3  a 9th remote profile is refused (`remote-limit`, native dialog stubbed);
//     the 8 existing connections are untouched
// M4  closing P's only window releases P's connection after the 15 s idle
//     grace (not before), Q is unaffected, and the freed slot admits the
//     profile refused in M3
//
// The grace period (IDLE_GRACE_MS = 15 s) and the cap (8) are registry
// constants with no injection point, so M4 really waits ~15 s.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  MAIN_BUNDLE,
  TERMINAL_SERVER_SCRIPT,
  closeIsolated,
  launchIsolated,
  testLogger,
  type IsolatedInstance as Instance,
} from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('plan039-multi-remote')

const REMOTE_PROFILE_CAP = 8
const IDLE_GRACE_MS = 15_000

interface ServerInfo { port: number; token: string; fingerprint: string }

interface RemoteWindow { profileId: string; windowId: string; page: Page }

async function serverInfo(inst: Instance): Promise<ServerInfo> {
  const conn = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.tunnel.getConnection())
  if (!conn || 'error' in conn) throw new Error(`tunnel.getConnection failed: ${JSON.stringify(conn)}`)
  const status = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.remote.serverStatus())
  expect(status.running).toBe(true)
  expect(status.port).toBe(inst.remotePort)
  return { port: inst.remotePort, token: conn.token, fingerprint: conn.fingerprint }
}

/** Number of RemoteClients currently connected to the instance's RemoteServer. */
async function serverClientCount(inst: Instance): Promise<number> {
  const status = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.remote.serverStatus())
  return (status.clients as unknown[]).length
}

async function createRemoteProfile(owner: Instance, name: string, target: ServerInfo): Promise<string> {
  return owner.win.evaluate(async ({ profileName, port, token, fingerprint }) => {
    const created = await (window as AnyApi).electronAPI.profile.create(profileName, {
      type: 'remote', remoteHost: '127.0.0.1', remotePort: port, remoteToken: token, remoteFingerprint: fingerprint,
    })
    return created.id as string
  }, { profileName: name, ...target })
}

async function openNewInstance(owner: Instance, profileId: string): Promise<{ alreadyOpen: boolean; windowIds?: string[]; error?: string }> {
  return owner.win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profileId)
}

function pageForWindowId(owner: Instance, windowId: string): Page | undefined {
  const needle = `windowId=${encodeURIComponent(windowId)}`
  return owner.app.windows().find(p => p.url().includes(needle))
}

async function clientStatus(page: Page): Promise<{ connected: boolean; info: { host: string; port: number; fingerprint: string } | null }> {
  return page.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())
}

/** Opens the profile's window(s) through the ProfilePanel IPC and waits until the first one is connected. */
async function openRemoteWindow(owner: Instance, profileId: string): Promise<RemoteWindow> {
  const opened = await openNewInstance(owner, profileId)
  log(`openNewInstance(${profileId}) → ${JSON.stringify(opened)}`)
  expect(opened.error).toBeUndefined()
  expect(opened.windowIds?.length ?? 0).toBeGreaterThan(0)
  const windowId = opened.windowIds![0]
  let page: Page | undefined
  await expect.poll(() => (page = pageForWindowId(owner, windowId)) !== undefined, {
    timeout: 30_000, message: `window ${windowId} never appeared`,
  }).toBe(true)
  await page!.waitForLoadState('domcontentloaded')
  await expect.poll(async () => (await clientStatus(page!)).connected, {
    timeout: 30_000, message: `window of profile ${profileId} never reported a live remote connection`,
  }).toBe(true)
  return { profileId, windowId, page: page! }
}

/** Closes a BrowserWindow the way the user's close button does (main-process `close` → registry handler). */
async function closeWindow(owner: Instance, windowId: string): Promise<void> {
  const closed = await owner.app.evaluate(({ BrowserWindow }, id) => {
    const needle = `windowId=${encodeURIComponent(id)}`
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes(needle))
    if (!win) return false
    win.close()
    return true
  }, windowId)
  expect(closed).toBe(true)
}

/** Concatenated main-process log of the instance (`<userData>/Logs/debug-*.log`). */
function readMainLog(inst: Instance): string {
  const dir = path.join(inst.userData, 'Logs')
  try {
    return fs.readdirSync(dir).filter(f => f.startsWith('debug-') && f.endsWith('.log'))
      .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  } catch {
    return ''
  }
}

const isWin = process.platform === 'win32'
const shell = isWin ? 'cmd.exe' : '/bin/sh'
// The sum is computed by the shell, so the echoed command line cannot satisfy the check.
const marker = (a: number, b: number) => (isWin ? `set /a ${a}+${b}\r` : `echo $((${a}+${b}))\n`)

async function capturePtyOutput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as AnyApi
    if (w.__e2eOut) return
    w.__e2eOut = {} as Record<string, string>
    w.electronAPI.pty.onOutput((id: string, data: string) => { w.__e2eOut[id] = (w.__e2eOut[id] ?? '') + data })
  })
}

async function outputOf(page: Page, ptyId: string): Promise<string> {
  return page.evaluate((id) => ((window as AnyApi).__e2eOut?.[id] ?? '') as string, ptyId)
}

async function createPty(page: Page, ptyId: string): Promise<unknown> {
  return page.evaluate(async ({ id, cwd, sh }) =>
    (window as AnyApi).electronAPI.pty.create({ id, cwd, type: 'terminal', shell: sh }), { id: ptyId, cwd: os.homedir(), sh: shell })
}

async function writePty(page: Page, ptyId: string, data: string): Promise<void> {
  await page.evaluate(({ id, d }) => (window as AnyApi).electronAPI.pty.write(id, d), { id: ptyId, d: data })
}

async function ptyCwd(page: Page, ptyId: string): Promise<string | null> {
  return page.evaluate(async (id) => (window as AnyApi).electronAPI.pty.getCwd(id), ptyId)
}

async function killPty(page: Page, ptyId: string): Promise<void> {
  await page.evaluate(async (id) => (window as AnyApi).electronAPI.pty.kill(id), ptyId).catch(() => { /* already gone */ })
}

test.describe('PLAN-039 — multiple remote profiles at once (T0466)', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(240_000)

  let a: Instance | undefined
  let b: Instance | undefined
  let serverA: ServerInfo
  let serverB: ServerInfo
  let p: RemoteWindow
  let q: RemoteWindow
  let refusedProfileId = ''
  const ptyIds: Array<{ page: Page; id: string }> = []

  test.beforeAll(async () => {
    test.setTimeout(180_000)
    if (!fs.existsSync(MAIN_BUNDLE) || !fs.existsSync(TERMINAL_SERVER_SCRIPT)) return
    a = await launchIsolated('plan039-a', log)
    b = await launchIsolated('plan039-b', log)
    serverA = await serverInfo(a)
    serverB = await serverInfo(b)
    log(`server A 127.0.0.1:${serverA.port} fp=${serverA.fingerprint.slice(0, 16)}… / server B 127.0.0.1:${serverB.port} fp=${serverB.fingerprint.slice(0, 16)}…`)
    expect(serverA.fingerprint).not.toBe(serverB.fingerprint)

    // The 9th-profile refusal and any unexpected remote failure open a native
    // message box in A; record it instead of blocking the run.
    await a.app.evaluate(({ dialog }) => {
      const g = globalThis as AnyApi
      g.__e2eMessageBoxes = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dialog as any).showMessageBox = async (...args: any[]) => {
        const opts = args.length > 1 ? args[1] : args[0]
        g.__e2eMessageBoxes.push({ title: opts?.title ?? '', message: opts?.message ?? '', detail: opts?.detail ?? '' })
        return { response: 0, checkboxChecked: false }
      }
    })
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    for (const { page, id } of ptyIds) {
      if (!page.isClosed()) await killPty(page, id)
    }
    await closeIsolated(a, log)
    await closeIsolated(b, log)
  })

  test.beforeEach(() => {
    test.skip(!fs.existsSync(MAIN_BUNDLE) || !fs.existsSync(TERMINAL_SERVER_SCRIPT),
      'dist-electron/ missing — run `npx vite build` first')
  })

  test('M1 P (→ A itself) and Q (→ B) windows are both connected, each to its own server', async () => {
    const pId = await createRemoteProfile(a!, 'E2E P → A', serverA)
    const qId = await createRemoteProfile(a!, 'E2E Q → B', serverB)
    p = await openRemoteWindow(a!, pId)
    q = await openRemoteWindow(a!, qId)

    const pStatus = await clientStatus(p.page)
    const qStatus = await clientStatus(q.page)
    log(`P window clientStatus=${JSON.stringify(pStatus)}`)
    log(`Q window clientStatus=${JSON.stringify(qStatus)}`)
    // Before PLAN-039 the second profile took the single slot and the first went
    // `connected: false` (other-profile); both must stay live now.
    expect(pStatus.connected).toBe(true)
    expect(qStatus.connected).toBe(true)
    expect(pStatus.info?.port).toBe(serverA.port)
    expect(qStatus.info?.port).toBe(serverB.port)
    expect(pStatus.info?.fingerprint).toBe(serverA.fingerprint)
    expect(qStatus.info?.fingerprint).toBe(serverB.fingerprint)

    // One RemoteClient per profile on each server (the renderer's remote:connect reuses
    // the client openNewInstance verified — no second handshake).
    expect(await serverClientCount(a!)).toBe(1)
    expect(await serverClientCount(b!)).toBe(1)
    // A's own (local) window is not bound to any remote profile.
    expect((await clientStatus(a!.win)).connected).toBe(false)
  })

  test('M2 pty:create from each window lands on that window\'s server only', async () => {
    const stamp = Date.now()
    const onP = `e2e-plan039-p-${stamp}`
    const onQ = `e2e-plan039-q-${stamp}`
    await capturePtyOutput(p.page)
    await capturePtyOutput(q.page)

    expect(await createPty(p.page, onP)).toEqual({ ok: true, created: true })
    ptyIds.push({ page: p.page, id: onP })
    expect(await createPty(q.page, onQ)).toEqual({ ok: true, created: true })
    ptyIds.push({ page: q.page, id: onQ })

    // Ask each server's own (local) window which PTYs its PtyManager holds.
    const where = {
      pOnA: await ptyCwd(a!.win, onP), pOnB: await ptyCwd(b!.win, onP),
      qOnA: await ptyCwd(a!.win, onQ), qOnB: await ptyCwd(b!.win, onQ),
    }
    log(`PTY placement (getCwd on each server's local window): ${JSON.stringify(where)}`)
    expect(where.pOnA).not.toBeNull()
    expect(where.pOnB).toBeNull()
    expect(where.qOnB).not.toBeNull()
    expect(where.qOnA).toBeNull()

    // Output comes back to the window that owns the connection.
    await writePty(p.page, onP, marker(1200, 34))
    await writePty(q.page, onQ, marker(4300, 21))
    await expect.poll(() => outputOf(p.page, onP), { timeout: 20_000, message: 'P window never saw its PTY output' }).toContain('1234')
    await expect.poll(() => outputOf(q.page, onQ), { timeout: 20_000, message: 'Q window never saw its PTY output' }).toContain('4321')
    // Remote events are per profile: B's PTY output reaches Q's window only (Q's client
    // sends to getWindowsForProfile(Q)), never P's.
    expect(await outputOf(p.page, onQ)).toBe('')
    // The reverse is not checkable in this topology: P loops back to A itself, so P's PTY
    // is one of A's local PTYs, and A's local PtyManager broadcasts to every A window
    // (createWindowBroadcastEmit(getAllWindows); renderers filter by terminal id) —
    // Q's window sees it through that local broadcast, not through Q's client.
    log(`P PTY answered 1234 in the P window; Q PTY answered 4321 in the Q window and not in P's; Q window got A's local broadcast of P's PTY: ${(await outputOf(q.page, onP)).includes('1234')}`)
  })

  test('M3 a 9th remote profile is refused and the 8 live connections are untouched', async () => {
    // P (→ A) and Q (→ B) hold 2 of the 8 slots; fill the rest, alternating servers.
    const fillers: RemoteWindow[] = []
    for (let i = 1; i <= REMOTE_PROFILE_CAP - 2; i++) {
      const target = i % 2 === 1 ? serverA : serverB
      const id = await createRemoteProfile(a!, `E2E filler ${i} → ${target === serverA ? 'A' : 'B'}`, target)
      fillers.push(await openRemoteWindow(a!, id))
    }
    const countsBefore = { a: await serverClientCount(a!), b: await serverClientCount(b!) }
    log(`with ${REMOTE_PROFILE_CAP} remote profiles open: server clients A=${countsBefore.a} B=${countsBefore.b}`)
    expect(countsBefore).toEqual({ a: 4, b: 4 })

    refusedProfileId = await createRemoteProfile(a!, 'E2E ninth → A', serverA)
    const windowsBefore = a!.app.windows().length
    const refused = await openNewInstance(a!, refusedProfileId)
    log(`9th profile openNewInstance → ${JSON.stringify(refused)}`)
    expect(refused).toEqual({ alreadyOpen: false, windowIds: [], error: 'remote-limit' })

    const boxes = await a!.app.evaluate(() => (globalThis as AnyApi).__e2eMessageBoxes as Array<{ title: string; message: string; detail: string }>)
    log(`native dialog(s) (stubbed): ${JSON.stringify(boxes)}`)
    expect(boxes.length).toBe(1)
    expect(`${boxes[0].message}\n${boxes[0].detail}`).toContain(String(REMOTE_PROFILE_CAP))

    // No 9th window, no 9th connection, nobody evicted.
    await new Promise(r => setTimeout(r, 2_000))
    expect(a!.app.windows().length).toBe(windowsBefore)
    expect({ a: await serverClientCount(a!), b: await serverClientCount(b!) }).toEqual(countsBefore)
    for (const w of [p, q, ...fillers]) expect((await clientStatus(w.page)).connected).toBe(true)
    expect(readMainLog(a!)).toContain(`remote connect refused for profile ${refusedProfileId}`)
  })

  test('M4 closing P releases it after the 15 s grace; Q is unaffected; the freed slot is reused', async () => {
    const countsBefore = { a: await serverClientCount(a!), b: await serverClientCount(b!) }
    const closedAt = Date.now()
    await closeWindow(a!, p.windowId)
    await expect.poll(() => p.page.isClosed(), { timeout: 15_000, message: 'P window did not close' }).toBe(true)
    await expect.poll(() => readMainLog(a!), { timeout: 10_000 })
      .toContain(`profile ${p.profileId} has no window left — releasing its connection in ${IDLE_GRACE_MS / 1000}s`)

    // Inside the grace period the connection is still there.
    await new Promise(r => setTimeout(r, Math.max(0, closedAt + 10_000 - Date.now())))
    const duringGrace = { a: await serverClientCount(a!), b: await serverClientCount(b!) }
    log(`${Date.now() - closedAt} ms after closing P: server clients A=${duringGrace.a} B=${duringGrace.b}`)
    expect(duringGrace).toEqual(countsBefore)

    // After the grace it is gone from server A; B (Q's server) keeps all of its clients.
    await expect.poll(() => serverClientCount(a!), { timeout: 20_000, intervals: [250] }).toBe(countsBefore.a - 1)
    const releasedAfter = Date.now() - closedAt
    log(`P's connection left server A ${releasedAfter} ms after its window was closed`)
    expect(releasedAfter).toBeGreaterThanOrEqual(IDLE_GRACE_MS - 1_000)
    expect(readMainLog(a!)).toContain(`released the connection of profile ${p.profileId} (idle: no window left)`)
    expect(await serverClientCount(b!)).toBe(countsBefore.b)

    // Q still works end to end.
    expect((await clientStatus(q.page)).connected).toBe(true)
    const onQ = `e2e-plan039-q2-${Date.now()}`
    expect(await createPty(q.page, onQ)).toEqual({ ok: true, created: true })
    ptyIds.push({ page: q.page, id: onQ })
    expect(await ptyCwd(b!.win, onQ)).not.toBeNull()
    await writePty(q.page, onQ, marker(7000, 7))
    await expect.poll(() => outputOf(q.page, onQ), { timeout: 20_000, message: 'Q stopped answering after P was released' }).toContain('7007')
    log('Q still connected and its PTY answered 7007 after P was released')

    // The slot P held is free again: the profile refused in M3 is admitted now.
    const ninth = await openRemoteWindow(a!, refusedProfileId)
    expect((await clientStatus(ninth.page)).info?.port).toBe(serverA.port)
    expect(await serverClientCount(a!)).toBe(countsBefore.a)
    log('the profile refused at the cap connected once P had been released')
  })
})
