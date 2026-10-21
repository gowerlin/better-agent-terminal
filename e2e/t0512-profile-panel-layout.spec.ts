// T0512 (BUG-122): profiles ("配置") dialog layout. An expanded remote card used to put its
// header in a left column and the remote tools panel in a right column (`.profile-card`
// inherited `.profile-item`'s row flex), leaving the left half empty; the dialog was capped
// at 520px.
//
// Runs against the source build (`npx vite build`) in an isolated instance. Remote tools
// detection is answered by a main-process stub (`remote:detect-tools`), so no remote host is
// needed. Screenshots go to BAT_E2E_T0512_EVIDENCE_DIR (default <tmp>/bat-t0512/evidence),
// prefixed with BAT_E2E_T0512_LABEL (default `run`) so before / after runs can sit side by side.
//
//   npx vite build
//   npx playwright test e2e/t0512-profile-panel-layout.spec.ts

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

const log = testLogger('t0512')
const EVIDENCE_DIR = process.env.BAT_E2E_T0512_EVIDENCE_DIR || path.join(os.tmpdir(), 'bat-t0512', 'evidence')
const LABEL = process.env.BAT_E2E_T0512_LABEL || 'run'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const TOOL_IDS = ['claude', 'git', 'gh', 'codex', 'curl', 'bash', 'rg', 'uv', 'python3', 'node']

/** Shaped after the user's WSL host in the BUG-122 screenshot. */
const DETECT_RESULT = {
  ok: true,
  report: {
    schemaVersion: 1,
    env: {
      osFamily: 'linux', osId: 'ubuntu', osVersion: '24.04', arch: 'x86_64', musl: false, pkgManager: 'apt',
      privilege: 'passwordless', isWsl: true, hasTimeout: true,
      authEnv: { ANTHROPIC_API_KEY: false, CLAUDE_CODE_OAUTH_TOKEN: false, OPENAI_API_KEY: false },
    },
    tools: TOOL_IDS.map((id) => {
      if (id === 'claude') return { id, status: 'ok', version: '2.1.286', login: 'loggedOut', path: '/home/demo/.local/bin/claude', serverVisible: false }
      if (id === 'codex' || id === 'uv') return { id, status: 'missing', login: 'n/a', serverVisible: false }
      return { id, status: 'ok', version: id === 'git' ? '2.43.0' : '1.0.0', login: id === 'gh' ? 'loggedIn' : 'n/a', path: `/usr/bin/${id}`, serverVisible: true }
    }),
    serverViewAvailable: true,
    warnings: [],
  },
}

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${LABEL}-${name}.png`)
  await page.screenshot({ path: file })
  log(`screenshot ${file}`)
  return file
}

async function stubDetect(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }, result) => {
    ipcMain.removeHandler('remote:detect-tools')
    ipcMain.handle('remote:detect-tools', async () => result)
  }, DETECT_RESULT)
}

async function setWindowSize(app: ElectronApplication, win: Page, width: number, height: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, size) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.unmaximize()
    w.setContentSize(size.width, size.height)
  }, { width, height })
  await expect.poll(() => win.evaluate(() => window.innerWidth), { timeout: 5_000 }).toBe(width)
}

async function seedProfiles(win: Page): Promise<string[]> {
  return win.evaluate(async () => {
    const api = (window as AnyApi).electronAPI
    const ids: string[] = []
    const wsl = await api.profile.create('WSL Ubuntu', { type: 'remote', remoteHost: '127.0.0.1', remotePort: 49321, remoteToken: 't0512', remoteFingerprint: 'AA:BB' })
    await api.profile.update(wsl.id, { targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04' })
    ids.push(wsl.id)
    const ssh = await api.profile.create('SSH build box', { type: 'remote', remoteHost: '127.0.0.1', remotePort: 49322, remoteToken: 't0512', remoteFingerprint: 'CC:DD' })
    await api.profile.update(ssh.id, { targetOS: 'ssh-linux', sshHost: 'build-box', sshUser: '' })
    ids.push(ssh.id)
    return ids
  })
}

async function openProfiles(win: Page): Promise<void> {
  await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
  await expect(win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
}

async function expandCard(win: Page, name: string): Promise<void> {
  const card = win.locator('.profile-card', { hasText: name })
  if (await card.locator('.profile-card-body').count() === 0) await card.locator('.profile-card-toggle').click()
  await expect(card.locator('[data-testid="remote-tool-claude"]')).toBeVisible({ timeout: 15_000 })
}

interface Layout {
  windowWidth: number
  panelWidth: number
  docOverflowX: number
  bodyOverflowX: number
  cards: Array<{ name: string; width: number; headerTop: number; headerBottom: number; headerLeft: number; body?: { left: number; top: number; width: number }; toggleRowGap: number }>
  toolColumns: number
}

async function measure(win: Page): Promise<Layout> {
  return win.evaluate(() => {
    const panel = document.querySelector('.settings-panel.profile-panel, .settings-overlay .settings-panel') as HTMLElement
    const body = panel.querySelector('.settings-body') as HTMLElement
    const cards = Array.from(panel.querySelectorAll('.profile-card')).map((el) => {
      const card = el.getBoundingClientRect()
      const header = el.querySelector('.profile-card-header')!.getBoundingClientRect()
      const toggle = el.querySelector('.profile-card-toggle')!.getBoundingClientRect()
      const info = el.querySelector('.profile-card-info')!.getBoundingClientRect()
      const cardBody = el.querySelector('.profile-card-body')?.getBoundingClientRect()
      return {
        name: (el.querySelector('.profile-card-name')?.textContent ?? '').trim(),
        width: card.width,
        headerTop: header.top,
        headerBottom: header.bottom,
        headerLeft: header.left,
        body: cardBody ? { left: cardBody.left, top: cardBody.top, width: cardBody.width } : undefined,
        // Toggle and name share one row: their vertical centres are close.
        toggleRowGap: Math.abs((toggle.top + toggle.bottom) / 2 - (info.top + info.bottom) / 2),
      }
    })
    const firstRow = panel.querySelector('.remote-tools-list .remote-tools-row')
    const rowTop = firstRow?.getBoundingClientRect().top
    const toolColumns = rowTop === undefined ? 0 : Array.from(firstRow!.parentElement!.children).filter((r) => Math.abs(r.getBoundingClientRect().top - rowTop) < 2).length
    return {
      windowWidth: window.innerWidth,
      panelWidth: panel.getBoundingClientRect().width,
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflowX: body.scrollWidth - body.clientWidth,
      cards,
      toolColumns,
    }
  })
}

let inst: IsolatedInstance | undefined

test.afterEach(async () => {
  if (inst) await closeIsolated(inst, log)
  inst = undefined
})

test('T0512 profiles dialog: expanded remote card spans the card width, dialog widened, no horizontal scroll', async () => {
  test.setTimeout(120_000)
  inst = await launchIsolated('t0512-layout', log)
  const { app, win } = inst
  await expect(win.locator('.sidebar-footer-buttons .settings-btn').first()).toBeVisible({ timeout: 30_000 })
  await stubDetect(app)
  await seedProfiles(win)

  const results: Record<string, Layout> = {}
  for (const [size, width, height] of [['wide', 1600, 1000], ['narrow', 800, 900]] as const) {
    await setWindowSize(app, win, width, height)
    if (await win.locator('.profile-card').count() === 0) await openProfiles(win)
    await expandCard(win, 'WSL Ubuntu')
    await shot(win, `${size}-wsl-expanded`)
    await expandCard(win, 'SSH build box')
    await win.locator('.profile-card', { hasText: 'SSH build box' }).scrollIntoViewIfNeeded()
    await shot(win, `${size}-two-remote-expanded`)
    await win.locator('.profile-card').first().scrollIntoViewIfNeeded()
    await shot(win, `${size}-local-card`)
    results[size] = await measure(win)
    log(`${size} layout ${JSON.stringify(results[size])}`)
  }

  for (const [size, layout] of Object.entries(results)) {
    expect(layout.docOverflowX, `${size}: page horizontal scroll`).toBeLessThanOrEqual(0)
    expect(layout.bodyOverflowX, `${size}: dialog horizontal scroll`).toBeLessThanOrEqual(0)
    for (const card of layout.cards) {
      expect(card.toggleRowGap, `${size} ${card.name}: toggle and name on one row`).toBeLessThan(4)
      if (!card.body) continue
      // Body below the header, left-aligned with it, using (almost) the whole card width.
      expect(card.body.top, `${size} ${card.name}: body below header`).toBeGreaterThanOrEqual(card.headerBottom - 1)
      expect(Math.abs(card.body.left - card.headerLeft), `${size} ${card.name}: body left-aligned`).toBeLessThan(2)
      expect(card.body.width, `${size} ${card.name}: body width`).toBeGreaterThan(card.width - 40)
    }
  }
  // Wider than the old 520px cap on a wide window; bounded by the window on a narrow one.
  expect(results.wide.panelWidth).toBeGreaterThan(1000)
  expect(results.narrow.panelWidth).toBeLessThanOrEqual(results.narrow.windowWidth * 0.9 + 1)
  expect(results.wide.toolColumns).toBeGreaterThanOrEqual(2)
})

// The setup wizard completion block hosts the same RemoteToolsEntry (host='wizard'); T0512 must not
// change it. Every WSL wizard channel is stubbed in main (no WSL touched). The distro name has a
// space so the real profile:create / profile:update keep-alive sync skips it (no wsl.exe spawn).
const WIZARD_STUBS: Record<string, unknown> = {
  'wsl:list': { distros: [{ name: 'E2E Fake', version: 2, state: 'Running' }], default: 'E2E Fake' },
  'wsl:systemd-enabled': true,
  'wsl:resolve-home': '/home/e2e',
  'server-bundle:distribute': { ok: true, tarballPath: 'C:\fake\bat-server.tgz', sha256: '00', sizeBytes: 1, source: 'cache', arch: 'linux-x64' },
  'wsl:install-bundle': { ok: true },
  'wsl:detect-network-mode': { actual: 'mirrored', declared: 'mirrored', mirroredSupported: true },
  'wsl:pick-server-port': { ok: true, port: 49555 },
  'wsl-systemd:write-unit': { ok: true },
  'wsl:keep-alive': { ok: true },
  'wsl-systemd:enable-linger': { ok: true },
  'wsl-systemd:start-service': { ok: true, token: 'e2e-token' },
  'wsl:fetch-fingerprint': { ok: true, fingerprint: 'AA:BB:CC' },
  'remote:test-connection': { ok: true, metadata: null },
  'wsl:uninstall-bundle': { ok: true },
  'wsl-systemd:remove-unit': { ok: true },
  'wsl:release-keep-alive': { ok: true },
}

test('T0512 setup wizard completion block (host=wizard) — evidence that it is unchanged', async () => {
  test.skip(process.platform !== 'win32', 'WSL wizard preflight requires win32')
  test.setTimeout(120_000)
  inst = await launchIsolated('t0512-wizard', log)
  const { app, win } = inst
  await expect(win.locator('.sidebar-footer-buttons .settings-btn').first()).toBeVisible({ timeout: 30_000 })
  await stubDetect(app)
  await app.evaluate(({ ipcMain }, stubs) => {
    for (const [channel, value] of Object.entries(stubs)) {
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, async () => value)
    }
  }, WIZARD_STUBS)

  const sizes = [['wide', 1600, 1000], ['narrow', 800, 900]] as const
  for (const [size, width, height] of sizes) {
    await setWindowSize(app, win, width, height)
    await openProfiles(win)
    await win.locator('button.profile-action-btn', { hasText: /更多|More/ }).click()
    await win.locator('.thumbnail-add-menu-item', { hasText: /WSL/ }).click()
    const tools = win.locator('.bat-wizard-remote-tools [data-testid="remote-tools-entry-wizard"]')
    await expect(tools.locator('[data-testid="remote-tool-claude"]')).toBeVisible({ timeout: 30_000 })
    await tools.scrollIntoViewIfNeeded()
    await shot(win, `${size}-wizard-complete`)
    const layout = await tools.evaluate((el) => {
      const list = el.querySelector('.remote-tools-list')!
      const rows = Array.from(list.children)
      const top = rows[0].getBoundingClientRect().top
      return {
        width: el.getBoundingClientRect().width,
        listDisplay: getComputedStyle(list).display,
        columns: rows.filter((r) => Math.abs(r.getBoundingClientRect().top - top) < 2).length,
      }
    })
    log(`${size} wizard tools ${JSON.stringify(layout)}`)
    // Shared single-column list in the wizard (the profile-host grid must not leak here).
    expect(layout.listDisplay).toBe('flex')
    expect(layout.columns).toBe(1)
    // Close the wizard overlay, then the profiles dialog, before the next size.
    await win.locator('.settings-panel .settings-close').last().click()
    await expect(win.locator('.bat-wizard-shell')).toHaveCount(0, { timeout: 15_000 })
    await win.locator('.settings-panel .settings-close').first().click()
    await expect(win.locator('.profile-card')).toHaveCount(0, { timeout: 15_000 })
  }
})
