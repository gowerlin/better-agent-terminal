/**
 * T0863 / BUG-212 (D287): UpdateNotification shows main's results only — the startup result (claimed,
 * one window per start) and Help › Check for Updates… results (newer / up to date / failed) — opens that
 * release's page, closes with [X] / OK / Esc; the strings in three languages; App.tsx / Settings wiring.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { releasePageToOpen, UpdateNotification, type UpdateCheckOutcome, type UpdateCheckResult } from '../UpdateNotification'

type Locale = Record<string, Record<string, string>>
const LOCALES: Array<[string, Locale]> = [['en', en as unknown as Locale], ['zh-TW', zhTW as unknown as Locale], ['zh-CN', zhCN as unknown as Locale]]
const PAGE = 'https://github.com/gowerlin/better-agent-terminal/releases/tag/'

const UPDATE: UpdateCheckResult = {
  hasUpdate: true,
  currentVersion: '0.7.4-pre.8',
  includePrerelease: true,
  latestRelease: { version: '0.7.4-pre.9', tagName: 'v0.7.4-pre.9', htmlUrl: `${PAGE}v0.7.4-pre.9`, body: '- fix', publishedAt: '', prerelease: true },
}

const original = window.electronAPI
let manual: ((outcome: UpdateCheckOutcome) => void) | null
let api: { claimStartupResult: ReturnType<typeof vi.fn>; onManualResult: ReturnType<typeof vi.fn> }
let openExternal: ReturnType<typeof vi.fn>

function install(startup: UpdateCheckResult | null) {
  manual = null
  openExternal = vi.fn()
  api = {
    claimStartupResult: vi.fn().mockResolvedValue(startup),
    onManualResult: vi.fn((cb: (outcome: UpdateCheckOutcome) => void) => { manual = cb; return () => { manual = null } }),
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = { platform: 'linux', update: api, shell: { openExternal } }
}

async function flush() {
  await act(async () => { await Promise.resolve() })
}

function sendManual(outcome: UpdateCheckOutcome) {
  act(() => { manual?.(outcome) })
}

beforeEach(() => install(null))
afterEach(async () => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = original
  await i18n.changeLanguage('en')
})

describe('startup result', () => {
  it('a claimed newer version → the update dialog; View on GitHub opens that release', async () => {
    install(UPDATE)
    render(<UpdateNotification />)
    await flush()
    expect(api.claimStartupResult).toHaveBeenCalledTimes(1)
    expect(screen.getByText(i18n.t('update.newVersionAvailable'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('update.newVersion', { version: 'v0.7.4-pre.9' }))).toBeInTheDocument()
    fireEvent.click(screen.getByText(i18n.t('update.viewOnGithub')))
    expect(openExternal).toHaveBeenCalledWith(`${PAGE}v0.7.4-pre.9`)
  })

  it('null (another window got it, off, up to date) → nothing', async () => {
    const { container } = render(<UpdateNotification />)
    await flush()
    expect(container).toBeEmptyDOMElement()
  })

  it('claimStartup={false} (detached window) does not claim, but still listens for Help results', async () => {
    install(UPDATE)
    render(<UpdateNotification claimStartup={false} />)
    await flush()
    expect(api.claimStartupResult).not.toHaveBeenCalled()
    expect(screen.queryByText(i18n.t('update.newVersionAvailable'))).toBeNull()
    expect(api.onManualResult).toHaveBeenCalledTimes(1)
  })

  it('an older main without the API → nothing, no throw', async () => {
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { platform: 'linux', update: {}, shell: { openExternal } }
    const { container } = render(<UpdateNotification />)
    await flush()
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Help › Check for Updates… results', () => {
  it('newer → the update dialog (even after the startup one was closed)', async () => {
    install(UPDATE)
    render(<UpdateNotification />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.close') }))
    expect(screen.queryByText(i18n.t('update.newVersionAvailable'))).toBeNull()
    sendManual({ status: 'update', result: UPDATE })
    expect(screen.getByText(i18n.t('update.newVersionAvailable'))).toBeInTheDocument()
  })

  it('up to date → a small dialog with the version; OK closes it', async () => {
    render(<UpdateNotification />)
    await flush()
    sendManual({ status: 'latest', result: { hasUpdate: false, currentVersion: '0.7.4-pre.9', includePrerelease: true, latestRelease: null } })
    expect(screen.getByText(i18n.t('update.upToDateTitle'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('update.upToDate', { version: '0.7.4-pre.9' }))).toBeInTheDocument()
    expect(screen.getByText('You have the latest version, v0.7.4-pre.9.')).toBeInTheDocument()
    fireEvent.click(screen.getByText(i18n.t('common.ok')))
    expect(screen.queryByText(i18n.t('update.upToDateTitle'))).toBeNull()
  })

  it('failed → a small dialog with the reason; [X] closes it', async () => {
    render(<UpdateNotification />)
    await flush()
    sendManual({ status: 'error', currentVersion: '0.7.4-pre.9', reason: 'GitHub HTTP 403' })
    expect(screen.getByText(i18n.t('update.checkFailedTitle'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('update.checkFailed', { reason: 'GitHub HTTP 403' }))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.close') }))
    expect(screen.queryByText(i18n.t('update.checkFailedTitle'))).toBeNull()
  })

  it('Esc closes the small dialog and the update dialog (ModalOverlay onEscape)', async () => {
    render(<UpdateNotification />)
    await flush()
    sendManual({ status: 'error', currentVersion: '0.7.4', reason: 'timed out after 10 s' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(i18n.t('update.checkFailedTitle'))).toBeNull()
    sendManual({ status: 'update', result: UPDATE })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(i18n.t('update.newVersionAvailable'))).toBeNull()
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = render(<UpdateNotification />)
    await flush()
    expect(manual).not.toBeNull()
    unmount()
    expect(manual).toBeNull()
  })
})

describe('releasePageToOpen', () => {
  it("that release's page; anything else is rebuilt from the tag", () => {
    expect(releasePageToOpen(UPDATE.latestRelease!)).toBe(`${PAGE}v0.7.4-pre.9`)
    expect(releasePageToOpen({ ...UPDATE.latestRelease!, htmlUrl: 'https://evil.invalid/' })).toBe(`${PAGE}v0.7.4-pre.9`)
  })
})

describe('locales', () => {
  it.each(LOCALES)('%s has every T0863 string', (_lng, locale) => {
    for (const key of ['upToDateTitle', 'upToDate', 'checkFailedTitle', 'checkFailed']) expect(locale.update[key], key).toBeTruthy()
    expect(locale.update.upToDate).toContain('{{version}}')
    expect(locale.update.checkFailed).toContain('{{reason}}')
    for (const key of ['includePrereleaseUpdates', 'includePrereleaseUpdatesHint', 'checkForUpdatesHint']) expect(locale.settings[key], key).toBeTruthy()
    expect(locale.settings.includePrereleaseUpdates).toContain('pre / beta / rc')
    // only once at startup now (D287): the hint no longer says "periodically"
    expect(locale.settings.checkForUpdatesHint).not.toMatch(/periodically|定期/i)
  })

  it('each language has its own text', () => {
    for (const key of ['checkFailedTitle', 'checkFailed']) { // upToDate reads the same in zh-TW and zh-CN
      expect(new Set(LOCALES.map(([, l]) => l.update[key])).size).toBe(3)
    }
  })
})

describe('wiring (source guards)', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8')

  it('App.tsx mounts it in the main window (claims) and the detached window (does not claim)', () => {
    const app = src('App.tsx')
    expect(app).toContain("import { UpdateNotification } from './components/UpdateNotification'")
    expect(app.match(/<UpdateNotification \/>/g)).toHaveLength(1)
    expect(app.match(/<UpdateNotification claimStartup=\{false\} \/>/g)).toHaveLength(1)
  })

  it('Settings: "include pre-releases" next to checkForUpdates, on unless explicitly false (default on)', () => {
    const panel = src('components/SettingsPanel.tsx')
    expect(panel).toContain('checked={settings.includePrereleaseUpdates !== false}')
    expect(panel).toContain('settingsStore.setIncludePrereleaseUpdates(e.target.checked)')
    expect(panel.indexOf("t('settings.includePrereleaseUpdates')")).toBeGreaterThan(panel.indexOf("t('settings.checkForUpdates')"))
    expect(src('stores/settings-store.ts')).toMatch(/includePrereleaseUpdates: true,/)
  })
})
