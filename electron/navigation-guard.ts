/**
 * T0457 / BUG-105: decide what a BrowserWindow does with a navigation or a
 * window.open request. Only http(s) ever reaches shell.openExternal — on Windows
 * openExternal goes through ShellExecute, so a file: URL to a .bat / .exe would run it.
 */

export type NavigationDecision = 'allow' | 'open-external' | 'block'
export type WindowOpenDecision = 'open-external' | 'block'

const EXTERNAL_BROWSER_PROTOCOLS = new Set(['http:', 'https:'])

function parseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function decodedPath(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

/** True only for http: / https: URLs (scheme compared after URL parsing, so case-insensitive). */
export function isExternalBrowserUrl(url: string): boolean {
  const parsed = parseUrl(url)
  return parsed !== null && EXTERNAL_BROWSER_PROTOCOLS.has(parsed.protocol)
}

/**
 * True when `url` is the app's own page. `appUrl` is the dev server URL or the
 * packaged index.html as a file: URL — including the Windows `file://C:\...`
 * backslash form, which URL parsing normalizes. Query and hash are ignored.
 * file: paths compare case-insensitively (Windows drive letters / paths).
 */
export function isAppUrl(url: string, appUrl: string): boolean {
  const target = parseUrl(url)
  const app = parseUrl(appUrl)
  if (!target || !app || target.protocol !== app.protocol) return false
  if (app.protocol === 'file:') {
    return target.host.toLowerCase() === app.host.toLowerCase()
      && decodedPath(target.pathname).toLowerCase() === decodedPath(app.pathname).toLowerCase()
  }
  return target.origin !== 'null'
    && target.origin === app.origin
    && target.pathname.startsWith(app.pathname)
}

/** will-navigate: stay on the app page, send http(s) to the browser, drop everything else. */
export function decideNavigation(url: string, appUrl: string): NavigationDecision {
  if (isAppUrl(url, appUrl)) return 'allow'
  return isExternalBrowserUrl(url) ? 'open-external' : 'block'
}

/** setWindowOpenHandler: the window itself is always denied; only http(s) goes to the browser. */
export function decideWindowOpen(url: string): WindowOpenDecision {
  return isExternalBrowserUrl(url) ? 'open-external' : 'block'
}

/** The scheme alone, for logging a blocked URL without its (possibly local) path. */
export function urlSchemeForLog(url: string): string {
  return parseUrl(url)?.protocol ?? '(unparseable)'
}

/** Minimal window surface installNavigationGuards needs (structurally matches BrowserWindow). */
export interface GuardableWindow {
  webContents: {
    setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' }): void
    on(event: 'will-navigate', listener: (event: { preventDefault(): void }, url: string) => void): unknown
  }
}

export interface NavigationGuardOptions {
  appUrl: string
  openExternal: (url: string) => void
  warn: (message: string) => void
}

/**
 * T0458: wire both guards onto a window. Every window that loads the preload
 * needs them — an external page loaded there would see window.electronAPI.
 * window.open is always denied (no child windows at all); only http(s) goes to
 * the browser, and the window itself only navigates within the app page.
 */
export function installNavigationGuards(win: GuardableWindow, { appUrl, openExternal, warn }: NavigationGuardOptions): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (decideWindowOpen(url) === 'open-external') openExternal(url)
    else warn(`[window-open] blocked ${urlSchemeForLog(url)} URL`)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const decision = decideNavigation(url, appUrl)
    if (decision === 'allow') return
    event.preventDefault()
    if (decision === 'open-external') openExternal(url)
    else warn(`[will-navigate] blocked ${urlSchemeForLog(url)} URL`)
  })
}
