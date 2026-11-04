/**
 * PLAN-064 / T0827: the Linux missing-font hint in the renderer — shown only for a `missing` result the
 * interface needs, once (claimHint), English first then the interface language, [X] / Esc / close,
 * "don't show again" persisted; nothing for unknown / not-linux / ok / a disabled (detached / remote)
 * window. Plus locales and App.tsx source guards.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { LinuxFontHint } from '../LinuxFontHint'
import { settingsStore } from '../../stores/settings-store'
import type { LinuxFontCheck } from '../../lib/linux-font-hint'

type Locale = Record<string, Record<string, string>>
const LOCALES: Array<[string, Locale]> = [['en', en as unknown as Locale], ['zh-TW', zhTW as unknown as Locale], ['zh-CN', zhCN as unknown as Locale]]
const KEYS = ['title', 'cjk', 'emoji', 'install', 'restart', 'details', 'copy', 'copied', 'dontShowAgain', 'close']

const MISSING_BOTH: LinuxFontCheck = { state: 'missing', cjk: true, emoji: true, cjkFamilies: 0, emojiFamilies: 0 }

let originalApi: unknown
let changed: ((r: LinuxFontCheck) => void) | null
let claimHint: ReturnType<typeof vi.fn>
let openExternal: ReturnType<typeof vi.fn>
let save: ReturnType<typeof vi.fn>

function installApi(initial: LinuxFontCheck, opts: { granted?: boolean } = {}) {
  changed = null
  claimHint = vi.fn(async () => opts.granted ?? true)
  openExternal = vi.fn(async () => 'opened')
  save = vi.fn(async () => true)
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fontCheck: {
      get: vi.fn(async () => initial),
      claimHint,
      onChanged: (cb: (r: LinuxFontCheck) => void) => { changed = cb; return () => { changed = null } },
    },
    shell: { openExternal },
    settings: { save, load: vi.fn(async () => null) },
    debug: { log: vi.fn() },
  }
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
}

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
  installApi({ state: 'unknown', reason: 'pending' })
  settingsStore.setLinuxFontHintDismissed(false)
})

afterEach(async () => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = originalApi
  await i18n.changeLanguage('en')
})

describe('locales', () => {
  it.each(LOCALES)('%s has every T0827 string', (_lng, locale) => {
    for (const key of KEYS) expect(locale.linuxFontHint[key], key).toBeTruthy()
  })

  it('each language has its own text', () => {
    expect(new Set(LOCALES.map(([, l]) => l.linuxFontHint.cjk)).size).toBe(3)
  })
})

describe('LinuxFontHint', () => {
  it('zh-TW + missing both: English first, then Chinese, both packages, claims once', async () => {
    await i18n.changeLanguage('zh-TW')
    installApi(MISSING_BOTH)
    render(<LinuxFontHint enabled />)
    await flush()
    const dialog = screen.getByRole('dialog')
    expect(dialog.dataset.cjk).toBe('true')
    expect(dialog.dataset.emoji).toBe('true')
    const blocks = dialog.querySelectorAll('.linux-font-hint-text')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].getAttribute('lang')).toBe('en')
    expect(blocks[0].textContent).toContain(en.linuxFontHint.cjk)
    expect(blocks[1].textContent).toContain(zhTW.linuxFontHint.cjk)
    expect(dialog.querySelector('.linux-font-hint-command')!.textContent).toBe('sudo apt update && sudo apt install -y fonts-noto-cjk fonts-noto-color-emoji')
    expect(screen.getByText(`${en.linuxFontHint.dontShowAgain} / ${zhTW.linuxFontHint.dontShowAgain}`)).toBeTruthy()
    expect(claimHint).toHaveBeenCalledTimes(1)
  })

  it('en + missing CJK only → nothing (the English interface reads fine)', async () => {
    installApi({ state: 'missing', cjk: true, emoji: false, cjkFamilies: 0, emojiFamilies: 1 })
    render(<LinuxFontHint enabled />)
    await flush()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(claimHint).not.toHaveBeenCalled()
  })

  it('en + missing emoji → English only, emoji package only', async () => {
    installApi(MISSING_BOTH)
    render(<LinuxFontHint enabled />)
    await flush()
    const dialog = screen.getByRole('dialog')
    expect(dialog.dataset.cjk).toBe('false')
    expect(dialog.querySelectorAll('.linux-font-hint-text')).toHaveLength(1)
    expect(dialog.querySelector('.linux-font-hint-command')!.textContent).toBe('sudo apt update && sudo apt install -y fonts-noto-color-emoji')
  })

  it.each([
    ['pending → later unknown(timeout)', { state: 'unknown', reason: 'pending' }],
    ['not-linux', { state: 'unknown', reason: 'not-linux' }],
    ['no-fc-list', { state: 'unknown', reason: 'no-fc-list' }],
    ['ok', { state: 'ok', cjkFamilies: 3, emojiFamilies: 1 }],
  ] as Array<[string, LinuxFontCheck]>)('%s → no hint, no claim', async (_name, result) => {
    await i18n.changeLanguage('zh-TW')
    installApi(result)
    render(<LinuxFontHint enabled />)
    await flush()
    act(() => changed?.({ state: 'unknown', reason: 'timeout' }))
    await flush()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(claimHint).not.toHaveBeenCalled()
  })

  it('the pushed result (pending → missing) shows it', async () => {
    await i18n.changeLanguage('zh-CN')
    installApi({ state: 'unknown', reason: 'pending' })
    render(<LinuxFontHint enabled />)
    await flush()
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => changed?.(MISSING_BOTH))
    await flush()
    expect(screen.getByRole('dialog').querySelectorAll('.linux-font-hint-text')[1].textContent).toContain(zhCN.linuxFontHint.cjk)
  })

  it('disabled (detached / remote window) → never asks main', async () => {
    await i18n.changeLanguage('zh-TW')
    installApi(MISSING_BOTH)
    const api = (window as unknown as { electronAPI: { fontCheck: { get: ReturnType<typeof vi.fn> } } }).electronAPI
    render(<LinuxFontHint enabled={false} />)
    await flush()
    expect(api.fontCheck.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('another window already claimed it → not shown here', async () => {
    await i18n.changeLanguage('zh-TW')
    installApi(MISSING_BOTH, { granted: false })
    render(<LinuxFontHint enabled />)
    await flush()
    expect(claimHint).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('already dismissed → nothing', async () => {
    await i18n.changeLanguage('zh-TW')
    installApi(MISSING_BOTH)
    settingsStore.setLinuxFontHintDismissed(true)
    render(<LinuxFontHint enabled />)
    await flush()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('[X], Esc and Close close it without persisting; Details opens the site', async () => {
    for (const how of ['x', 'esc', 'close'] as const) {
      await i18n.changeLanguage('zh-TW')
      installApi(MISSING_BOTH)
      const { unmount } = render(<LinuxFontHint enabled />)
      await flush()
      if (how === 'x') fireEvent.click(screen.getByRole('dialog').querySelector('.linux-font-hint-x')!)
      if (how === 'esc') fireEvent.keyDown(document, { key: 'Escape' })
      if (how === 'close') fireEvent.click(screen.getByRole('dialog').querySelector('[data-action="close"]')!)
      expect(screen.queryByRole('dialog'), how).toBeNull()
      expect(settingsStore.getSettings().linuxFontHintDismissed).toBe(false)
      unmount()
    }
    installApi(MISSING_BOTH)
    render(<LinuxFontHint enabled />)
    await flush()
    fireEvent.click(screen.getByRole('dialog').querySelector('[data-action="details"]')!)
    expect(openExternal).toHaveBeenCalledWith('https://gowerlin.github.io/better-agent-terminal/install#linux-fonts')
  })

  it('"don\'t show again" persists linuxFontHintDismissed', async () => {
    await i18n.changeLanguage('zh-TW')
    installApi(MISSING_BOTH)
    render(<LinuxFontHint enabled />)
    await flush()
    fireEvent.click(screen.getByRole('dialog').querySelector('[data-action="dont-show-again"]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(settingsStore.getSettings().linuxFontHintDismissed).toBe(true)
    expect(save).toHaveBeenCalled()
    expect(JSON.parse(save.mock.calls.at(-1)![0] as string).linuxFontHintDismissed).toBe(true)
  })
})

describe('App.tsx source guard', () => {
  it('renders the hint only for the local main window', () => {
    const app = readFileSync(join(__dirname, '..', '..', 'App.tsx'), 'utf8')
    expect(app).toContain('<LinuxFontHint enabled={profileReady && !detachedWorkspaceId && !windowBoundToRemote && !isRemoteConnected} />')
    expect(app).toContain("if (active?.type === 'remote') setWindowBoundToRemote(true)")
  })
})
