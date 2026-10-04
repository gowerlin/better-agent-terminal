// @vitest-environment node
/**
 * T0458 / BUG-105: every BrowserWindow that loads the preload gets the T0457
 * guards. An external page loaded into such a window would see window.electronAPI,
 * so window.open is always denied and will-navigate only stays on the app page.
 */
import { describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { installNavigationGuards, type GuardableWindow } from '../navigation-guard'

const APP_URL = 'file:///C:/Program%20Files/BetterAgentTerminal/resources/app.asar/dist/index.html'

function fakeWindow() {
  let openHandler: ((details: { url: string }) => { action: 'deny' }) | undefined
  let navigateListener: ((event: { preventDefault(): void }, url: string) => void) | undefined
  const win: GuardableWindow = {
    webContents: {
      setWindowOpenHandler: (handler) => { openHandler = handler },
      on: (event, listener) => {
        if (event === 'will-navigate') navigateListener = listener
      },
    },
  }
  const openExternal = vi.fn()
  const warn = vi.fn()
  installNavigationGuards(win, { appUrl: APP_URL, openExternal, warn })
  const windowOpen = (url: string) => openHandler!({ url })
  const navigate = (url: string) => {
    const event = { preventDefault: vi.fn() }
    navigateListener!(event, url)
    return event.preventDefault.mock.calls.length > 0
  }
  return { windowOpen, navigate, openExternal, warn, installed: () => !!openHandler && !!navigateListener }
}

describe('installNavigationGuards', () => {
  it('installs both a window-open handler and a will-navigate listener', () => {
    expect(fakeWindow().installed()).toBe(true)
  })

  it('denies window.open and sends http(s) to the browser', () => {
    const w = fakeWindow()
    expect(w.windowOpen('https://example.com/docs')).toEqual({ action: 'deny' })
    expect(w.openExternal).toHaveBeenCalledWith('https://example.com/docs')
    expect(w.warn).not.toHaveBeenCalled()
  })

  it.each(['file:///C:/x.bat', 'javascript:alert(1)', 'data:text/html,hi', 'about:blank'])('denies window.open of %s without openExternal', (url) => {
    const w = fakeWindow()
    expect(w.windowOpen(url)).toEqual({ action: 'deny' })
    expect(w.openExternal).not.toHaveBeenCalled()
    expect(w.warn).toHaveBeenCalledTimes(1)
    expect(w.warn.mock.calls[0][0]).not.toContain('x.bat')
  })

  it('lets the app page (any query, e.g. ?detached=) navigate', () => {
    const w = fakeWindow()
    expect(w.navigate(`${APP_URL}?detached=ws-1`)).toBe(false)
    expect(w.navigate(`${APP_URL}?windowId=win-1#x`)).toBe(false)
    expect(w.openExternal).not.toHaveBeenCalled()
  })

  it('keeps http(s) navigation out of the window and opens it in the browser', () => {
    const w = fakeWindow()
    expect(w.navigate('http://127.0.0.1:8080/page')).toBe(true)
    expect(w.openExternal).toHaveBeenCalledWith('http://127.0.0.1:8080/page')
  })

  it.each(['file:///C:/Windows/System32/drivers/etc/hosts', 'file:///C:/x.bat', 'data:text/html,hi'])('blocks navigation to %s without openExternal', (url) => {
    const w = fakeWindow()
    expect(w.navigate(url)).toBe(true)
    expect(w.openExternal).not.toHaveBeenCalled()
    expect(w.warn).toHaveBeenCalledTimes(1)
  })
})

// Classification guard (L140): a new BrowserWindow that forgets the guard turns this red.
describe('every BrowserWindow in electron/ is guarded', () => {
  const electronDir = path.resolve(__dirname, '..')
  const sources = fs.readdirSync(electronDir, { recursive: true, encoding: 'utf8' })
    .filter(f => f.endsWith('.ts') && !f.includes('__tests__') && !f.endsWith('.d.ts'))
    .map(f => ({ file: f, text: fs.readFileSync(path.join(electronDir, f), 'utf8') }))
    .filter(s => s.text.includes('new BrowserWindow('))

  it('finds the known windows', () => {
    expect(sources.map(s => s.file.replace(/\\/g, '/'))).toContain('main.ts')
  })

  it.each(sources.map(s => [s.file, s.text] as const))('%s guards each new BrowserWindow', (_file, text) => {
    const creations = Array.from(text.matchAll(/new BrowserWindow\(/g)).length
    const named = Array.from(text.matchAll(/const (\w+) = new BrowserWindow\(/g), m => m[1])
    expect(named, 'assign every new BrowserWindow to a const so its guard can be checked').toHaveLength(creations)
    for (const name of named) {
      expect(text.includes(`guardWindowNavigation(${name})`), `${name} needs guardWindowNavigation(${name})`).toBe(true)
    }
  })
})
