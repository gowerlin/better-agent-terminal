// @vitest-environment node
/**
 * T0457 / BUG-105: will-navigate and setWindowOpenHandler only hand http(s)
 * URLs to shell.openExternal. file: / javascript: / data: / unknown schemes are
 * blocked, so navigating to a local .bat / .exe never reaches ShellExecute.
 */
import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'url'
import { decideNavigation, decideWindowOpen, isAppUrl, isExternalBrowserUrl, urlSchemeForLog } from '../navigation-guard'

const BS = '\\'
// Packaged Windows build: `file://${path.join(...)}` keeps backslashes.
const WIN_APP_URL = `file://C:${BS}Program Files${BS}BetterAgentTerminal${BS}resources${BS}app.asar${BS}dist${BS}index.html`
const POSIX_APP_URL = 'file:///Applications/BetterAgentTerminal.app/Contents/Resources/app.asar/dist/index.html'
const DEV_APP_URL = 'http://localhost:5173/'

describe('isExternalBrowserUrl', () => {
  it.each([
    'http://example.com/',
    'https://github.com/gowerlin/better-agent-terminal/releases',
    'HTTPS://Example.com/x',
  ])('allows %s', (url) => {
    expect(isExternalBrowserUrl(url)).toBe(true)
  })

  it.each([
    'file:///C:/x.bat',
    'FILE:///C:/x.bat',
    'File:///C:/Windows/System32/cmd.exe',
    `file:${BS}${BS}server${BS}share${BS}x.bat`,
    'file://server/share/x.exe',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'mailto:someone@example.com',
    'ms-msdt:/id PCWDiagnostic',
    'search-ms:query=x',
    'vbscript:msgbox(1)',
    'C:\\x.bat',
    '',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isExternalBrowserUrl(url)).toBe(false)
  })
})

describe('isAppUrl', () => {
  it('matches the packaged Windows app URL written with backslashes', () => {
    expect(isAppUrl('file:///C:/Program%20Files/BetterAgentTerminal/resources/app.asar/dist/index.html?windowId=abc', WIN_APP_URL)).toBe(true)
  })

  it('ignores drive-letter / path case and the hash on Windows-style file URLs', () => {
    expect(isAppUrl('FILE:///c:/program files/betteragentterminal/resources/app.asar/dist/INDEX.html#/x', WIN_APP_URL)).toBe(true)
  })

  it('matches the POSIX app URL with a query', () => {
    expect(isAppUrl(`${POSIX_APP_URL}?detached=w1`, POSIX_APP_URL)).toBe(true)
  })

  it('matches the pathToFileURL form main.ts now builds', () => {
    const appUrl = pathToFileURL(`C:${BS}x y${BS}dist${BS}index.html`).href
    expect(isAppUrl(`${appUrl}?windowId=1`, appUrl)).toBe(true)
    expect(isAppUrl(`file://C:${BS}x y${BS}dist${BS}index.html?windowId=1`, 'file:///C:/x%20y/dist/index.html')).toBe(true)
  })

  it('does not match a different local file', () => {
    expect(isAppUrl('file:///C:/x.bat', WIN_APP_URL)).toBe(false)
    expect(isAppUrl('file:///C:/Program%20Files/BetterAgentTerminal/resources/app.asar/dist/index.html.bat', WIN_APP_URL)).toBe(false)
    expect(isAppUrl(`file:${BS}${BS}server${BS}share${BS}index.html`, WIN_APP_URL)).toBe(false)
  })

  it('matches the dev server origin and any path under it', () => {
    expect(isAppUrl('http://localhost:5173/?windowId=1', DEV_APP_URL)).toBe(true)
    expect(isAppUrl('http://localhost:5173/src/main.tsx', DEV_APP_URL)).toBe(true)
  })

  it('does not match another origin or a different scheme in dev', () => {
    expect(isAppUrl('http://localhost:5174/', DEV_APP_URL)).toBe(false)
    expect(isAppUrl('https://localhost:5173/', DEV_APP_URL)).toBe(false)
    expect(isAppUrl('http://localhost:5173.evil.com/', DEV_APP_URL)).toBe(false)
    expect(isAppUrl('file:///C:/x.bat', DEV_APP_URL)).toBe(false)
  })

  it('is false for unparseable input', () => {
    expect(isAppUrl('not a url', WIN_APP_URL)).toBe(false)
    expect(isAppUrl('file:///C:/x', '')).toBe(false)
  })
})

describe('decideNavigation', () => {
  it('lets the app navigate to itself', () => {
    expect(decideNavigation('file:///C:/Program%20Files/BetterAgentTerminal/resources/app.asar/dist/index.html?windowId=1', WIN_APP_URL)).toBe('allow')
    expect(decideNavigation('http://localhost:5173/?windowId=1', DEV_APP_URL)).toBe('allow')
  })

  it('sends http(s) links to the external browser', () => {
    expect(decideNavigation('https://github.com/', WIN_APP_URL)).toBe('open-external')
    expect(decideNavigation('http://example.com/', DEV_APP_URL)).toBe('open-external')
  })

  it.each([
    'file:///C:/x.bat',
    'FILE:///C:/x.bat',
    `file:${BS}${BS}server${BS}share`,
    'javascript:alert(1)',
    'data:text/html,hi',
    'ms-msdt:/id x',
  ])('blocks %s', (url) => {
    expect(decideNavigation(url, WIN_APP_URL)).toBe('block')
    expect(decideNavigation(url, DEV_APP_URL)).toBe('block')
  })
})

describe('decideWindowOpen', () => {
  it('opens http(s) externally', () => {
    expect(decideWindowOpen('https://www.docker.com/products/docker-desktop/')).toBe('open-external')
  })

  it.each(['file:///C:/x.bat', 'FILE:///C:/x.exe', `file:${BS}${BS}server${BS}share`, 'javascript:alert(1)', 'data:text/html,hi', 'about:blank'])('blocks %s', (url) => {
    expect(decideWindowOpen(url)).toBe('block')
  })
})

describe('urlSchemeForLog', () => {
  it('reports only the scheme, never the path', () => {
    expect(urlSchemeForLog('file:///C:/Users/me/secret.bat')).toBe('file:')
    expect(urlSchemeForLog('JavaScript:alert(1)')).toBe('javascript:')
    expect(urlSchemeForLog('not a url')).toBe('(unparseable)')
  })
})
