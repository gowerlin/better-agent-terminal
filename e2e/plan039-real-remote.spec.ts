// PLAN-039 — real-remote acceptance, unattended (T0467). OPT-IN: skipped unless
// BAT_E2E_REAL_REMOTE=1 and the environment from
// `node e2e/real-remote/plan039-real-remote-env.mjs up` exists (Windows host only).
//
// Automates docs/remote-dev-overview.md "Manual acceptance (real WSL + SSH)" 1-6
// against the source build (`npx vite build`), without any Claude Agent session:
//
//   isolated BAT instance (the client under test)
//     profile W  wsl-linux → the bat-server already running in WSL (localhost:9877) —
//                connect + use only; the PTYs this spec creates there are killed
//     profile S  ssh-linux → `ssh -N -L` into container bat-t0467-sshd (WSL Docker) →
//                that container's own bat-server (hostname bat-t0467-s)
//
// R1  (steps 1-2) both windows connected, each to its own server, no "not connected" notice
// R2  (step 3)    a terminal in each window runs on its own server (`uname -n` + a shell-
//                 computed marker) and its output never reaches the other window
// R3  (step 4)    Tower → Worker round trip ending with `bat-notify --submit`, per window:
//                 toast + notify/keypress events + pre-fill + Enter land only in that window
// R4  (step 5)    close S: idle-release log lines in order (~10 s / ~15 s); W keeps working
// R5  (step 6)    reopen S, close W: same, roles swapped
//
// Differences from the manual steps (T0467 memory_overrides: no Claude tokens):
//   - step 3 has no Agent session;
//   - step 4's Worker is not dispatched through `bat-terminal.mjs` (that launches an agent).
//     The window creates the Worker PTY itself with `customEnv.BAT_TOWER_TERMINAL_ID` = the
//     Tower tab — the same worker capability the server issues to a dispatched Worker — and
//     the Worker shell runs `bat-notify.mjs --submit` directly. The pre-filled text is a
//     shell command, so its computed output in the Tower tab proves the Enter.
//   - S's ssh is Git for Windows' ssh.exe with an isolated HOME (PATH prepended), so
//     `StrictHostKeyChecking=accept-new` writes known_hosts there and not to the user's
//     ~/.ssh. An installed BAT uses System32 OpenSSH.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  MAIN_BUNDLE,
  REPO_ROOT,
  TERMINAL_SERVER_SCRIPT,
  closeIsolated,
  launchIsolated,
  run,
  testLogger,
  type IsolatedInstance as Instance,
} from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('plan039-real-remote')

const ENABLED = process.env.BAT_E2E_REAL_REMOTE === '1'
const CONFIG_PATH = process.env.BAT_E2E_REAL_REMOTE_CONFIG || path.join(os.tmpdir(), 'bat-t0467', 'connection.json')
const IDLE_GRACE_MS = 15_000

interface RealRemoteConfig {
  distro: string
  sshBinDir: string
  sshHome: string
  w: { host: string; port: number; token: string; fingerprint: string; hostname: string }
  s: { sshHost: string; sshPort: number; sshUser: string; sshKeyPath: string; serverPort: number; token: string; fingerprint: string; hostname: string; container: string }
}

interface RemoteWindow { key: 'W' | 'S'; profileId: string; windowId: string; page: Page; hostname: string }

function loadConfig(): RealRemoteConfig | null {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as RealRemoteConfig
  } catch {
    return null
  }
}

const NOT_CONNECTED_TEXTS = ['en', 'zh-TW', 'zh-CN'].map(lang =>
  (JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${lang}.json`), 'utf8')) as { app: { remoteNotConnected: string } }).app.remoteNotConnected)

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

async function openRemoteWindow(owner: Instance, key: 'W' | 'S', profileId: string, hostname: string): Promise<RemoteWindow> {
  const startedAt = Date.now()
  const opened = await openNewInstance(owner, profileId)
  log(`${key}: openNewInstance(${profileId}) → ${JSON.stringify(opened)}`)
  expect(opened.error).toBeUndefined()
  expect(opened.windowIds?.length ?? 0).toBeGreaterThan(0)
  const windowId = opened.windowIds![0]
  let page: Page | undefined
  await expect.poll(() => (page = pageForWindowId(owner, windowId)) !== undefined, {
    timeout: 30_000, message: `window ${windowId} never appeared`,
  }).toBe(true)
  await page!.waitForLoadState('domcontentloaded')
  await expect.poll(async () => (await clientStatus(page!)).connected, {
    timeout: 45_000, message: `${key} window never reported a live remote connection`,
  }).toBe(true)
  log(`${key}: window ${windowId} connected in ${Date.now() - startedAt} ms`)
  await installEventCapture(page!)
  return { key, profileId, windowId, page: page!, hostname }
}

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

function readMainLog(inst: Instance): string {
  const dir = path.join(inst.userData, 'Logs')
  try {
    return fs.readdirSync(dir).filter(f => f.startsWith('debug-') && f.endsWith('.log'))
      .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  } catch {
    return ''
  }
}

function logLineWith(inst: Instance, needle: string): string | undefined {
  return readMainLog(inst).split(/\r?\n/).find(l => l.includes(needle))
}

/** PTY output, terminal:notified and terminal:keypress events as this window's renderer receives them. */
async function installEventCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as AnyApi
    if (w.__e2eCapture) return
    w.__e2eCapture = { out: {} as Record<string, string>, notified: [] as unknown[], keypress: [] as unknown[] }
    w.electronAPI.pty.onOutput((id: string, data: string) => { w.__e2eCapture.out[id] = (w.__e2eCapture.out[id] ?? '') + data })
    w.electronAPI.pty.onTerminalNotified((info: unknown) => { w.__e2eCapture.notified.push(info) })
    w.electronAPI.pty.onTerminalKeypress((info: unknown) => { w.__e2eCapture.keypress.push(info) })
  })
}

async function outputOf(page: Page, ptyId: string): Promise<string> {
  return page.evaluate((id) => ((window as AnyApi).__e2eCapture?.out?.[id] ?? '') as string, ptyId)
}

async function eventsOf(page: Page): Promise<{ notified: Array<{ targetId: string; message: string; source?: string }>; keypress: Array<{ targetId: string; key: string }> }> {
  return page.evaluate(() => {
    const c = (window as AnyApi).__e2eCapture
    return { notified: c?.notified ?? [], keypress: c?.keypress ?? [] }
  })
}

async function toastTexts(page: Page): Promise<string[]> {
  return page.locator('.bat-notify-toast').allTextContents()
}

async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText)
}

async function createPty(page: Page, ptyId: string, customEnv?: Record<string, string>): Promise<unknown> {
  return page.evaluate(async ({ id, env }) =>
    (window as AnyApi).electronAPI.pty.create({ id, cwd: '/tmp', type: 'terminal', ...(env ? { customEnv: env } : {}) }), { id: ptyId, env: customEnv })
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

/** Command whose output only the shell can produce: `T0467-<tag>-<uname -n>-<a+b>`. */
function hostMarkerCommand(tag: string, a: number, b: number): string {
  return `echo "T0467-${tag}-$(uname -n)-$((${a}+${b}))"\n`
}

async function screenshot(rw: RemoteWindow, name: string): Promise<string> {
  const file = test.info().outputPath(`${name}-${rw.key}.png`)
  await rw.page.screenshot({ path: file })
  return file
}

/** Local `ssh.exe` processes whose command line targets the container's sshd (the S tunnel). */
async function sshTunnelProcesses(cfg: RealRemoteConfig): Promise<string[]> {
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Where-Object { $_.CommandLine -like '*${cfg.s.sshUser}@${cfg.s.sshHost}*' } | ForEach-Object { "$($_.ProcessId) $($_.ExecutablePath)" }`,
  ], 20_000).catch(() => '')
  return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
}

test.describe('PLAN-039 — real WSL + SSH remote profiles at once (T0467, opt-in)', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(240_000)

  const cfg = loadConfig()
  let a: Instance | undefined
  let wWin: RemoteWindow
  let sWin: RemoteWindow
  let wProfileId = ''
  let sProfileId = ''
  const stamp = Date.now()
  // PTYs created on a server, by window key; W's are on the user's WSL server and always killed.
  const created: Array<{ key: 'W' | 'S'; id: string }> = []
  const towers: Record<'W' | 'S', string> = { W: '', S: '' }
  let notifyRound = 0

  const ready = () => ENABLED && cfg !== null && fs.existsSync(MAIN_BUNDLE) && fs.existsSync(TERMINAL_SERVER_SCRIPT)
  const winOf = (key: 'W' | 'S') => (key === 'W' ? wWin : sWin)

  /** Seeds a workspace (folder /tmp) with one terminal tab — the Tower — and reloads the window. */
  async function seedTower(rw: RemoteWindow): Promise<string> {
    const wsId = `e2e-t0467-ws-${rw.key.toLowerCase()}-${Date.now()}`
    const towerId = `e2e-t0467-tower-${rw.key.toLowerCase()}-${Date.now()}`
    const seed = {
      workspaces: [{ id: wsId, name: `T0467-${rw.key}`, folderPath: '/tmp', createdAt: Date.now() }],
      activeWorkspaceId: wsId,
      activeGroup: null,
      terminals: [{ id: towerId, workspaceId: wsId, type: 'terminal', title: `T0467 Tower ${rw.key}` }],
      activeTerminalId: towerId,
    }
    expect(await rw.page.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await rw.page.reload()
    await rw.page.waitForLoadState('domcontentloaded')
    await expect.poll(async () => (await clientStatus(rw.page)).connected, { timeout: 30_000 }).toBe(true)
    await installEventCapture(rw.page)
    // The Tower tab's TerminalPanel creates its PTY on the window's server.
    await expect.poll(() => ptyCwd(rw.page, towerId), { timeout: 30_000, message: `${rw.key} Tower PTY never appeared on its server` }).not.toBeNull()
    await expect(rw.page.locator('.xterm-helper-textarea').first()).toBeAttached({ timeout: 30_000 })
    created.push({ key: rw.key, id: towerId })
    towers[rw.key] = towerId
    log(`${rw.key}: workspace ${wsId} seeded, Tower tab ${towerId} running on its server (cwd ${await ptyCwd(rw.page, towerId)})`)
    return towerId
  }

  /** One `bat-notify --submit` round trip from a Worker PTY of `rw` to its Tower; `other` must see none of it. */
  async function notifyRoundTrip(rw: RemoteWindow, other: RemoteWindow | null): Promise<void> {
    notifyRound += 1
    const tag = `${rw.key}${notifyRound}`
    const towerId = towers[rw.key]
    const workerId = `e2e-t0467-worker-${tag.toLowerCase()}-${stamp}`
    const otherBefore = other ? await eventsOf(other.page) : null
    const t0 = Date.now()
    expect(await createPty(rw.page, workerId, { BAT_TOWER_TERMINAL_ID: towerId })).toEqual({ ok: true, created: true })
    created.push({ key: rw.key, id: workerId })
    const prefill = `echo T0467-SUBMIT-${tag}-$((40+2))`
    await writePty(rw.page, workerId,
      `"\${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --source T0467-${tag} --target "$BAT_TOWER_TERMINAL_ID" --submit '${prefill}'; echo "NOTIFY-EXIT-$?-$((1+1))"\n`)
    await expect.poll(() => outputOf(rw.page, workerId), { timeout: 30_000, message: `${tag}: bat-notify never finished` }).toMatch(/NOTIFY-EXIT-\d+-2/)
    const workerOut = await outputOf(rw.page, workerId)
    const exit = /NOTIFY-EXIT-(\d+)-2/.exec(workerOut)?.[1]
    if (exit !== '0') log(`${tag}: worker output:\n${workerOut.slice(-1500)}`)
    expect(exit, `${tag}: bat-notify --submit exit code`).toBe('0')

    // Pre-fill + synthesized Enter: the Tower shell ran the pre-filled command.
    await expect.poll(() => outputOf(rw.page, towerId), { timeout: 20_000, message: `${tag}: Tower never executed the pre-filled text` }).toContain(`T0467-SUBMIT-${tag}-42`)
    const events = await eventsOf(rw.page)
    const notified = events.notified.filter(n => n.targetId === towerId && n.message.includes(`T0467-SUBMIT-${tag}`))
    const keypress = events.keypress.filter(k => k.targetId === towerId)
    expect(notified.length).toBe(1)
    expect(keypress.length).toBeGreaterThan(0)
    await expect.poll(() => toastTexts(rw.page), { timeout: 5_000 }).toEqual(expect.arrayContaining([expect.stringContaining(`T0467-${tag}`)]))
    const badges = await rw.page.locator('.notification-badge').count()
    log(`${tag}: bat-notify exit 0; ${rw.key} window got terminal:notified ×${notified.length}, terminal:keypress ×${keypress.length}, toast "${(await toastTexts(rw.page)).find(t => t.includes(`T0467-${tag}`))}", .notification-badge ×${badges}; Tower printed T0467-SUBMIT-${tag}-42 (${Date.now() - t0} ms)`)

    if (other && otherBefore) {
      const otherAfter = await eventsOf(other.page)
      const leakedNotify = otherAfter.notified.slice(otherBefore.notified.length).filter(n => n.targetId === towerId || n.message.includes(`T0467-SUBMIT-${tag}`))
      const leakedKeys = otherAfter.keypress.slice(otherBefore.keypress.length).filter(k => k.targetId === towerId)
      expect(leakedNotify).toEqual([])
      expect(leakedKeys).toEqual([])
      expect((await toastTexts(other.page)).filter(t => t.includes(`T0467-${tag}`))).toEqual([])
      expect(await outputOf(other.page, towerId)).toBe('')
      expect(await outputOf(other.page, workerId)).toBe('')
      log(`${tag}: ${other.key} window saw no notify / keypress / toast / Tower or Worker output of ${rw.key}`)
    }
  }

  async function terminalWorks(rw: RemoteWindow, tag: string, a1: number, b1: number): Promise<string> {
    const id = `e2e-t0467-term-${tag.toLowerCase()}-${stamp}`
    expect(await createPty(rw.page, id)).toEqual({ ok: true, created: true })
    created.push({ key: rw.key, id })
    await writePty(rw.page, id, hostMarkerCommand(tag, a1, b1))
    const expected = `T0467-${tag}-${rw.hostname}-${a1 + b1}`
    await expect.poll(() => outputOf(rw.page, id), { timeout: 20_000, message: `${rw.key} terminal never answered ${expected}` }).toContain(expected)
    return id
  }

  async function killCreated(key: 'W' | 'S', page: Page): Promise<number> {
    let n = 0
    for (const p of created.filter(c => c.key === key)) {
      await killPty(page, p.id)
      n++
    }
    for (let i = created.length - 1; i >= 0; i--) if (created[i].key === key) created.splice(i, 1)
    return n
  }

  /** Close `closing`'s only window; check the idle-release log lines and that `staying` keeps working meanwhile. */
  async function closeAndRelease(closing: RemoteWindow, staying: RemoteWindow, step: string): Promise<void> {
    const closedAt = Date.now()
    await closeWindow(a!, closing.windowId)
    await expect.poll(() => closing.page.isClosed(), { timeout: 15_000, message: `${closing.key} window did not close` }).toBe(true)
    const noWindow = `profile ${closing.profileId} has no window left — releasing its connection in ${IDLE_GRACE_MS / 1000}s`
    const released = `released the connection of profile ${closing.profileId} (idle: no window left)`
    await expect.poll(() => logLineWith(a!, noWindow) !== undefined, { timeout: 10_000, message: `${step}: "${noWindow}" not logged within 10 s` }).toBe(true)
    const noWindowAfter = Date.now() - closedAt
    log(`${step}: ${noWindowAfter} ms after closing ${closing.key}: ${logLineWith(a!, noWindow)}`)

    // Inside the grace the other profile is untouched: terminal + notify round trip.
    expect((await clientStatus(staying.page)).connected).toBe(true)
    await terminalWorks(staying, `${step}-${staying.key}`, 3000, closing.key === 'S' ? 5 : 6)
    await notifyRoundTrip(staying, null)
    expect(logLineWith(a!, released), `${step}: released before the grace ended`).toBeUndefined()
    log(`${step}: ${Date.now() - closedAt} ms after closing ${closing.key}: ${staying.key} terminal + bat-notify --submit OK, ${closing.key} not released yet`)

    // "stays connected throughout": sample the other window until the release is logged.
    let samples = 0
    while (logLineWith(a!, released) === undefined) {
      expect(Date.now() - closedAt, `${step}: "${released}" not logged`).toBeLessThan(IDLE_GRACE_MS + 10_000)
      expect((await clientStatus(staying.page)).connected, `${step}: ${staying.key} lost its connection during ${closing.key}'s grace`).toBe(true)
      samples++
      await new Promise(r => setTimeout(r, 500))
    }
    const releasedAfter = Date.now() - closedAt
    log(`${step}: ${staying.key} connected in all ${samples} samples (every 500 ms) until ${closing.key} was released`)
    log(`${step}: ${releasedAfter} ms after closing ${closing.key}: ${logLineWith(a!, released)}`)
    expect(releasedAfter).toBeGreaterThanOrEqual(IDLE_GRACE_MS - 1_000)
    const text = readMainLog(a!)
    expect(text.indexOf(noWindow)).toBeLessThan(text.indexOf(released))

    // After the release the other profile still works.
    expect((await clientStatus(staying.page)).connected).toBe(true)
    await terminalWorks(staying, `${step}-${staying.key}-after`, 5000, closing.key === 'S' ? 7 : 8)
    log(`${step}: ${staying.key} still connected and answering after ${closing.key} was released`)
  }

  test.beforeAll(async () => {
    test.setTimeout(180_000)
    if (!ready()) return
    a = await launchIsolated('plan039-real', log, {
      env: { PATH: `${cfg!.sshBinDir};${process.env.PATH ?? process.env.Path ?? ''}`, HOME: cfg!.sshHome },
    })
    // Any unexpected remote failure opens a native message box; record it instead of blocking.
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
    // W's PTYs live on the user's WSL server: never leave them behind.
    for (const key of ['W', 'S'] as const) {
      const rw = key === 'W' ? wWin : sWin
      if (rw && !rw.page.isClosed()) log(`afterAll: killed ${await killCreated(key, rw.page)} ${key} PTY(s)`)
    }
    if (created.some(c => c.key === 'W')) log(`afterAll: W PTYs not killed (window gone): ${created.filter(c => c.key === 'W').map(c => c.id).join(', ')}`)
    if (a) {
      const boxes = await a.app.evaluate(() => (globalThis as AnyApi).__e2eMessageBoxes).catch(() => [])
      log(`native dialogs during the run (stubbed): ${JSON.stringify(boxes)}`)
    }
    await closeIsolated(a, log)
  })

  test.beforeEach(() => {
    test.skip(!ENABLED, 'opt-in: set BAT_E2E_REAL_REMOTE=1 after `node e2e/real-remote/plan039-real-remote-env.mjs up`')
    test.skip(cfg === null, `no ${CONFIG_PATH} — run \`node e2e/real-remote/plan039-real-remote-env.mjs up\` first`)
    test.skip(!fs.existsSync(MAIN_BUNDLE) || !fs.existsSync(TERMINAL_SERVER_SCRIPT), 'dist-electron/ missing — run `npx vite build` first')
  })

  test('R1 (steps 1-2) W and S windows are both connected, each to its own server', async () => {
    const c = cfg!
    wProfileId = await a!.win.evaluate(async ({ w, distro }) => {
      const api = (window as AnyApi).electronAPI
      const created = await api.profile.create('T0467 W (WSL)', { type: 'remote', remoteHost: w.host, remotePort: w.port, remoteToken: w.token, remoteFingerprint: w.fingerprint })
      await api.profile.update(created.id, { targetOS: 'wsl-linux', wslDistro: distro })
      return created.id as string
    }, { w: c.w, distro: c.distro })
    sProfileId = await a!.win.evaluate(async ({ s }) => {
      const api = (window as AnyApi).electronAPI
      const created = await api.profile.create('T0467 S (SSH)', { type: 'remote', remoteHost: 'localhost', remotePort: s.serverPort, remoteToken: s.token, remoteFingerprint: s.fingerprint })
      await api.profile.update(created.id, { targetOS: 'ssh-linux', sshHost: s.sshHost, sshUser: s.sshUser, sshPort: s.sshPort, sshKeyPath: s.sshKeyPath, useSshTunnel: true })
      return created.id as string
    }, { s: c.s })
    log(`profiles: W=${wProfileId} (wsl-linux ${c.distro} → localhost:${c.w.port}), S=${sProfileId} (ssh-linux ${c.s.sshUser}@${c.s.sshHost}:${c.s.sshPort} → localhost:${c.s.serverPort})`)

    wWin = await openRemoteWindow(a!, 'W', wProfileId, c.w.hostname)
    sWin = await openRemoteWindow(a!, 'S', sProfileId, c.s.hostname)

    const wStatus = await clientStatus(wWin.page)
    const sStatus = await clientStatus(sWin.page)
    log(`W clientStatus=${JSON.stringify(wStatus)}`)
    log(`S clientStatus=${JSON.stringify(sStatus)}`)
    expect(wStatus.connected).toBe(true)
    expect(sStatus.connected).toBe(true)
    expect(wStatus.info?.port).toBe(c.w.port)
    expect(wStatus.info?.fingerprint).toBe(c.w.fingerprint)
    // S goes through `ssh -L <dynamic local port>:localhost:<serverPort>`.
    expect(sStatus.info?.host).toBe('127.0.0.1')
    expect(sStatus.info?.port).not.toBe(c.s.serverPort)
    expect(sStatus.info?.fingerprint).toBe(c.s.fingerprint)
    const tunnels = await sshTunnelProcesses(c)
    log(`S tunnel ssh process(es): ${tunnels.join(' | ') || 'none found'}`)
    expect(tunnels.length).toBe(1)
    expect(tunnels[0].toLowerCase()).toContain(c.sshBinDir.toLowerCase())
    // Re-check after both are up: opening S must not have taken W's connection (pre-PLAN-039 behaviour).
    expect((await clientStatus(wWin.page)).connected).toBe(true)
    expect((await clientStatus(a!.win)).connected).toBe(false)

    await new Promise(r => setTimeout(r, 2_000))
    for (const rw of [wWin, sWin]) {
      const text = await bodyText(rw.page)
      expect(NOT_CONNECTED_TEXTS.some(t => text.includes(t)), `${rw.key} window shows the "not connected" notice`).toBe(false)
      log(`${rw.key}: no "not connected" notice; screenshot ${await screenshot(rw, 'r1-connected')}`)
    }
  })

  test('R2 (step 3) a terminal in each window runs on its own server only', async () => {
    const wTerm = await terminalWorks(wWin, 'R2-W', 1200, 34)
    const sTerm = await terminalWorks(sWin, 'R2-S', 4300, 21)
    // Each server holds only its own window's PTY.
    expect(await ptyCwd(wWin.page, sTerm)).toBeNull()
    expect(await ptyCwd(sWin.page, wTerm)).toBeNull()
    // Remote PTY output reaches only the windows of the profile whose connection received it.
    expect(await outputOf(wWin.page, sTerm)).toBe('')
    expect(await outputOf(sWin.page, wTerm)).toBe('')
    log(`R2: W PTY printed T0467-R2-W-${wWin.hostname}-1234 in W only; S PTY printed T0467-R2-S-${sWin.hostname}-4321 in S only; each server reports no PTY of the other window`)
  })

  test('R3 (step 4) Tower → Worker bat-notify --submit lands only in the dispatching window', async () => {
    await seedTower(wWin)
    await seedTower(sWin)
    await notifyRoundTrip(wWin, sWin)
    await notifyRoundTrip(sWin, wWin)
    for (const rw of [wWin, sWin]) log(`${rw.key}: screenshot ${await screenshot(rw, 'r3-notified')}`)
  })

  test('R4 (step 5) closing S releases it after the grace; W keeps working', async () => {
    const before = await sshTunnelProcesses(cfg!)
    await closeAndRelease(sWin, wWin, 'R4')
    await expect.poll(() => sshTunnelProcesses(cfg!), { timeout: 10_000, message: 'S tunnel ssh still running after the release' }).toEqual([])
    log(`R4: S tunnel ssh before close: ${before.join(' | ')}; after release: none`)
    for (let i = created.length - 1; i >= 0; i--) if (created[i].key === 'S') created.splice(i, 1) // container PTYs, removed with it
  })

  test('R5 (step 6) roles swapped: reopen S, close W; S keeps working', async () => {
    sWin = await openRemoteWindow(a!, 'S', sProfileId, cfg!.s.hostname)
    expect((await clientStatus(wWin.page)).connected).toBe(true)
    await seedTower(sWin)
    await notifyRoundTrip(sWin, wWin)
    // W's PTYs are on the user's WSL server — kill them before closing its window.
    log(`R5: killed ${await killCreated('W', wWin.page)} W PTY(s) before closing the W window`)
    await closeAndRelease(wWin, sWin, 'R5')
    log(`R5: screenshot ${await screenshot(sWin, 'r5-after-w-released')}`)
  })
})
