// T0513 (BUG-123): profiles ("配置") dialog status light of remote cards. A headless
// bat-server (WSL / SSH / Docker) answers `profile:list` with an empty stub, and the light
// used to be decided by that answer — so a remote card stayed red with its window open.
//
// Runs against the source build (`npx vite build`) in ONE isolated instance (no WSL, no
// docker, no ssh is touched): its own RemoteServer is the "remote" target (loopback, as
// PLAN-039's P → A). Cards:
//
//   Docker (connected)   docker-linux → own server, window opened         → 🟢 connected
//   Docker (idle)        docker-linux → own server, no window              → ⚪ idle (reachable)
//   WSL (unreachable)    wsl-linux    → closed port, no window             → 🔴 failed + reason
//   SSH (not open)       ssh-linux, no window (never probed: tunnel only)  → ⚪ idle (not checked)
//
// Then the dialog stays open while the connected profile's window closes: after the 15 s
// idle release (IDLE_GRACE_MS) its light turns idle without reopening the dialog.
// Screenshots go to BAT_E2E_T0513_EVIDENCE_DIR (default <tmp>/bat-t0513/evidence).
//
//   npx vite build
//   npx playwright test e2e/t0513-profile-status-light.spec.ts

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, freePort, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

const log = testLogger('t0513')
const EVIDENCE_DIR = process.env.BAT_E2E_T0513_EVIDENCE_DIR || path.join(os.tmpdir(), 'bat-t0513', 'evidence')
const IDLE_GRACE_MS = 15_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file })
  log(`screenshot ${file}`)
  return file
}

function card(win: Page, profileId: string) {
  return win.locator(`[data-testid="profile-card"][data-profile-id="${profileId}"]`)
}

function light(win: Page, profileId: string) {
  return card(win, profileId).locator('[data-testid="profile-card-status"]')
}

let inst: IsolatedInstance | undefined

test.afterEach(async () => {
  if (inst) await closeIsolated(inst, log)
  inst = undefined
})

test('T0513 remote card light: connected green, idle not red, failure red with reason, live update', async () => {
  test.setTimeout(180_000)
  inst = await launchIsolated('t0513-status', log)
  const { app, win } = inst
  await expect(win.locator('.sidebar-footer-buttons .settings-btn').first()).toBeVisible({ timeout: 30_000 })

  const conn = await win.evaluate(async () => (window as AnyApi).electronAPI.tunnel.getConnection())
  if (!conn || 'error' in conn) throw new Error(`tunnel.getConnection failed: ${JSON.stringify(conn)}`)
  const closedPort = await freePort()
  const ids = await win.evaluate(async ({ port, token, fingerprint, closedPort }) => {
    const api = (window as AnyApi).electronAPI
    const make = async (name: string, opts: Record<string, unknown>, update: Record<string, unknown>) => {
      const created = await api.profile.create(name, { type: 'remote', remoteHost: '127.0.0.1', ...opts })
      await api.profile.update(created.id, update)
      return created.id as string
    }
    const own = { remotePort: port, remoteToken: token, remoteFingerprint: fingerprint }
    return {
      connected: await make('Docker (connected)', own, { targetOS: 'docker-linux', dockerContainer: 'e2e-fake' }),
      idle: await make('Docker (idle)', { ...own, remoteProfileId: 'no-such-profile' }, { targetOS: 'docker-linux', dockerContainer: 'e2e-fake-2' }),
      // no wslDistro: the WSL keep-alive sync skips it, no wsl.exe is spawned
      unreachable: await make('WSL (unreachable)', { remotePort: closedPort, remoteToken: 'x', remoteFingerprint: 'AA:BB' }, { targetOS: 'wsl-linux' }),
      ssh: await make('SSH (not open)', { remotePort: 9, remoteToken: 'x', remoteFingerprint: 'CC:DD' }, { targetOS: 'ssh-linux', sshHost: 'build-box', sshUser: '' }),
    }
  }, { port: inst.remotePort, token: conn.token, fingerprint: conn.fingerprint, closedPort })
  log(`profiles ${JSON.stringify(ids)}`)

  // Open the connected profile's window (ProfilePanel's "open" path) and wait for its live connection.
  const opened = await win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), ids.connected)
  log(`openNewInstance → ${JSON.stringify(opened)}`)
  expect(opened.error).toBeUndefined()
  const windowId = opened.windowIds[0] as string
  let remotePage: Page | undefined
  await expect.poll(() => (remotePage = app.windows().find(p => p.url().includes(`windowId=${encodeURIComponent(windowId)}`))) !== undefined, { timeout: 30_000 }).toBe(true)
  await expect.poll(async () => (await remotePage!.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())).connected, { timeout: 30_000 }).toBe(true)

  await win.bringToFront()
  await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
  await expect(card(win, ids.connected)).toBeVisible({ timeout: 15_000 })

  await expect(light(win, ids.connected)).toHaveAttribute('data-status', 'connected', { timeout: 15_000 })
  await expect(light(win, ids.idle)).toHaveAttribute('data-status', 'idle', { timeout: 15_000 })
  await expect(light(win, ids.unreachable)).toHaveAttribute('data-status', 'disconnected', { timeout: 15_000 })
  await expect(light(win, ids.ssh)).toHaveAttribute('data-status', 'idle')
  const titles = {
    connected: await light(win, ids.connected).getAttribute('title'),
    idle: await light(win, ids.idle).getAttribute('title'),
    unreachable: await light(win, ids.unreachable).getAttribute('title'),
    ssh: await light(win, ids.ssh).getAttribute('title'),
  }
  log(`titles ${JSON.stringify(titles)}`)
  // Translated tooltips (whichever language the fresh instance picked).
  expect(titles.connected).toMatch(/已連線|已连接|Connected/)
  expect(titles.idle).toMatch(/伺服器可連線|服务器可连接|server reachable/)
  expect(titles.unreachable).toMatch(/^(連線失敗|连接失败|Connection failed)/)
  expect(titles.ssh).toMatch(/未檢查伺服器|未检查服务器|server not checked/)
  await win.locator('.profile-list').scrollIntoViewIfNeeded()
  await shot(win, 'after-dialog-connected')
  await light(win, ids.unreachable).hover()
  await shot(win, 'after-unreachable-tooltip-hover')

  // Live update: close the connected profile's window with the dialog still open.
  await app.evaluate(({ BrowserWindow }, id) => {
    const w = BrowserWindow.getAllWindows().find(b => b.webContents.getURL().includes(`windowId=${encodeURIComponent(id)}`))
    w?.close()
  }, windowId)
  const closedAt = Date.now()
  await expect(light(win, ids.connected)).toHaveAttribute('data-status', 'idle', { timeout: IDLE_GRACE_MS + 20_000 })
  const elapsed = Date.now() - closedAt
  log(`connected → idle after ${elapsed} ms (idle grace ${IDLE_GRACE_MS} ms)`)
  expect(elapsed).toBeGreaterThanOrEqual(IDLE_GRACE_MS - 1_000)
  await shot(win, 'after-dialog-released')
})
