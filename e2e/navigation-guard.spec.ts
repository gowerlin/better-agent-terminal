// T0458 (BUG-105) — every BrowserWindow with the preload keeps external pages out.
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT, through the shared isolation fixture (T0399).
//
// A local HTTP server stands in for "some website"; `shell.openExternal` is
// stubbed in the main process so nothing reaches a real browser. For the main
// window and a detached workspace window: `window.open`, a `target="_blank"`
// click and `location.href =` to that site must go to openExternal (http(s)),
// never load in an Electron window (the server sees no request, no new window,
// the window URL is unchanged); a file: URL is dropped without openExternal.

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0458-nav-guard')

const WS_ALPHA = 'e2e-t0458-ws-alpha'
const WS_BETA = 'e2e-t0458-ws-beta'
const NAME_BETA = 'T0458-Beta'
const FILE_URL = 'file:///C:/Windows/System32/drivers/etc/hosts'

interface SiteServer {
  url: string
  hits: string[]
  close: () => Promise<void>
}

async function startSite(): Promise<SiteServer> {
  const hits: string[] = []
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? '')
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<!doctype html><title>T0458 external</title><body>T0458 external page</body>')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  return {
    url: `http://127.0.0.1:${port}`,
    hits,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  }
}

/** Replaces shell.openExternal in the main process with a recorder. */
async function stubOpenExternal(app: ElectronApplication): Promise<void> {
  const replaced = await app.evaluate(({ shell }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any
    g.__t0458Opened = []
    const stub = async (url: string) => { g.__t0458Opened.push(url) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(shell as any).openExternal = stub
    return shell.openExternal === stub
  })
  expect(replaced).toBe(true)
}

async function openedExternally(app: ElectronApplication): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return app.evaluate(() => [...((globalThis as any).__t0458Opened as string[])])
}

interface Observation {
  newWindows: { url: string; hasElectronApi: boolean | string }[]
  urlBefore: string
  urlAfter: string
  hits: number
  opened: string[]
}

/** Runs `action` in `page`, then reports new Electron windows, URL drift, site hits and openExternal calls. */
async function observe(app: ElectronApplication, page: Page, site: SiteServer, action: () => Promise<unknown>): Promise<Observation> {
  const pagesBefore = new Set(app.windows())
  const openedBefore = (await openedExternally(app)).length
  const hitsBefore = site.hits.length
  const urlBefore = page.url()
  await action().catch(() => { /* a navigation that tears the context down may reject */ })
  await page.waitForTimeout(2_000)
  const newWindows: Observation['newWindows'] = []
  for (const p of app.windows()) {
    if (pagesBefore.has(p)) continue
    await p.waitForLoadState('domcontentloaded').catch(() => {})
    const hasElectronApi = await p.evaluate(() => typeof (window as AnyApi).electronAPI !== 'undefined')
      .catch((err: Error) => `evaluate failed: ${err.message.split('\n')[0]}`)
    newWindows.push({ url: p.url(), hasElectronApi })
  }
  return {
    newWindows,
    urlBefore,
    urlAfter: page.url(),
    hits: site.hits.length - hitsBefore,
    opened: (await openedExternally(app)).slice(openedBefore),
  }
}

/** The four probes every preload window must pass. */
async function probeWindow(app: ElectronApplication, page: Page, site: SiteServer, label: string): Promise<void> {
  const openUrl = `${site.url}/${label}-window-open`
  const byOpen = await observe(app, page, site, () => page.evaluate((u) => { window.open(u) }, openUrl))
  log(`${label} window.open http: ${JSON.stringify(byOpen)}`)

  const blankUrl = `${site.url}/${label}-target-blank`
  const byClick = await observe(app, page, site, async () => {
    await page.evaluate((u) => {
      const a = document.createElement('a')
      a.id = 't0458-link'
      a.href = u
      a.target = '_blank'
      a.textContent = 'T0458 link'
      a.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;background:#fff'
      document.body.appendChild(a)
    }, blankUrl)
    await page.click('#t0458-link')
    await page.evaluate(() => document.getElementById('t0458-link')?.remove())
  })
  log(`${label} target=_blank click: ${JSON.stringify(byClick)}`)

  const byFile = await observe(app, page, site, () => page.evaluate((u) => { window.open(u) }, FILE_URL))
  log(`${label} window.open file: ${JSON.stringify(byFile)}`)

  // Last: before the fix this navigates the window away from the app.
  const navUrl = `${site.url}/${label}-navigate`
  const byNav = await observe(app, page, site, () => page.evaluate((u) => { window.location.href = u }, navUrl))
  const apiAfterNav = await page.evaluate(() => typeof (window as AnyApi).electronAPI !== 'undefined').catch(() => 'evaluate failed')
  log(`${label} location.href http: ${JSON.stringify(byNav)} electronAPI-in-window=${apiAfterNav}`)

  for (const [obs, url] of [[byOpen, openUrl], [byClick, blankUrl], [byNav, navUrl]] as const) {
    expect(obs.newWindows, `${label}: no Electron window for ${url}`).toEqual([])
    expect(obs.hits, `${label}: ${url} never loads inside Electron`).toBe(0)
    expect(obs.urlAfter, `${label}: window stays on the app page`).toBe(obs.urlBefore)
    expect(obs.opened, `${label}: ${url} goes to the system browser`).toEqual([url])
  }
  expect(byFile.newWindows, `${label}: no Electron window for file:`).toEqual([])
  expect(byFile.opened, `${label}: file: never reaches openExternal`).toEqual([])
  expect(byFile.urlAfter).toBe(byFile.urlBefore)
}

test('main and detached windows send external links to the browser and never load them', async () => {
  test.setTimeout(120_000)
  let inst: IsolatedInstance | undefined
  let site: SiteServer | undefined
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 't0458-'))
  try {
    site = await startSite()
    inst = await launchIsolated('t0458-nav-guard', log)
    const { app, win } = inst
    await stubOpenExternal(app)

    await expect.poll(async () => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      return raw !== null
    }, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_ALPHA, name: 'T0458-Alpha', folderPath: folder, createdAt: Date.now() },
        { id: WS_BETA, name: NAME_BETA, folderPath: folder, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_ALPHA,
      activeGroup: null,
      terminals: [],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-item', { hasText: NAME_BETA })).toBeVisible({ timeout: 30_000 })

    const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_BETA)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    expect(detached.url()).toContain(`detached=${WS_BETA}`)
    expect(await detached.evaluate(() => typeof (window as AnyApi).electronAPI)).toBe('object')
    log(`detached window up: ${detached.url()}`)

    // Main first: its guards predate T0458 and must stay unchanged.
    await probeWindow(app, win, site, 'main')
    await probeWindow(app, detached, site, 'detached')
  } finally {
    await closeIsolated(inst, log)
    await site?.close()
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
