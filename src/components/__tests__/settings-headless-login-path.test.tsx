/**
 * PLAN-057 / T0755: Settings → Advanced "BAT server PATH" (`headlessLoginShellPath`).
 *  - shown only in a remote window whose host is Linux / macOS (`targetOS` wsl-linux / docker-linux /
 *    ssh-linux / ssh-darwin), next to BAT MCP; a local window never shows it
 *  - on unless the setting is false; unchecking saves `headlessLoginShellPath: false`
 *  - three locales have the strings
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { settingsStore } from '../../stores/settings-store'
import { SettingsPanel } from '../SettingsPanel'

/** Permissive electronAPI stand-in (same shape as dialog-escape.test.tsx). */
function permissiveApi(overrides: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const leaf = (name: string) => vi.fn((..._args: unknown[]) => (name.startsWith('on') ? () => {} : Promise.resolve(undefined)))
  const namespace = (ns: string) => {
    const cache: Record<string, unknown> = { ...(overrides[ns] ?? {}) }
    return new Proxy(cache, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined
        if (!(prop in target)) target[prop] = leaf(prop)
        return target[prop]
      },
    })
  }
  const namespaces: Record<string, unknown> = {}
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

let originalApi: unknown
let save: ReturnType<typeof vi.fn>

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
  if (!('fonts' in document)) {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve(), check: () => false } })
  }
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
  save = vi.fn(async () => true)
  const api = permissiveApi({
    debug: { log: vi.fn(), isDebugMode: false },
    settings: { save, getLoggingInfo: vi.fn(async () => null), cleanupLogs: vi.fn() },
    agent: { listCustomClis: vi.fn(async () => []) },
    remote: {
      serverStatus: vi.fn(async () => ({ running: false, port: null, clients: [] })),
      clientStatus: vi.fn(async () => ({ connected: false, info: null })),
      listProfiles: vi.fn(async () => ({ profiles: [], activeProfileIds: [] })),
      profileConnectionStates: vi.fn(async () => []),
      onProfileConnectionsChanged: vi.fn(() => () => {}),
    },
    app: { getWindowProfile: vi.fn(async () => 'default') },
    claude: { getStatuslineExtras: vi.fn(async () => ({})) },
  })
  api.platform = 'win32'
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
})

afterEach(() => {
  cleanup()
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
})

async function openAdvanced(targetOS?: string | null): Promise<void> {
  render(<SettingsPanel onClose={vi.fn()} targetOS={targetOS} />)
  await screen.findByRole('heading', { name: en.settings.title })
  fireEvent.click(screen.getByRole('tab', { name: en.settings.tab.advanced }))
  await screen.findByRole('heading', { name: en.settings.batMcpTitle })
}

describe('Settings: BAT server PATH (T0755)', () => {
  test.each(['wsl-linux', 'docker-linux', 'ssh-linux', 'ssh-darwin'])('remote %s window shows it, checked by default', async (targetOS) => {
    await openAdvanced(targetOS)
    expect(screen.getByRole('heading', { name: en.settings.headlessLoginShellPathTitle })).toBeTruthy()
    const box = screen.getByRole('checkbox', { name: en.settings.headlessLoginShellPath }) as HTMLInputElement
    expect(box.checked).toBe(settingsStore.getSettings().headlessLoginShellPath !== false)
  })

  test.each([undefined, null, 'unknown-os'])('targetOS %s (local window) does not show it', async (targetOS) => {
    await openAdvanced(targetOS)
    expect(screen.queryByRole('heading', { name: en.settings.headlessLoginShellPathTitle })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: en.settings.headlessLoginShellPath })).toBeNull()
  })

  test('unchecking saves headlessLoginShellPath: false; checking saves true', async () => {
    settingsStore.setHeadlessLoginShellPath(true)
    save.mockClear()
    await openAdvanced('wsl-linux')
    const box = screen.getByRole('checkbox', { name: en.settings.headlessLoginShellPath }) as HTMLInputElement
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    expect(settingsStore.getSettings().headlessLoginShellPath).toBe(false)
    expect(box.checked).toBe(false)
    const saved = JSON.parse(String(save.mock.calls.at(-1)?.[0]))
    expect(saved.headlessLoginShellPath).toBe(false)
    fireEvent.click(box)
    expect(settingsStore.getSettings().headlessLoginShellPath).toBe(true)
  })

  test('three locales have the strings', () => {
    for (const locale of [en, zhTW, zhCN]) {
      const s = locale.settings as unknown as Record<string, unknown>
      for (const key of ['headlessLoginShellPathTitle', 'headlessLoginShellPath', 'headlessLoginShellPathHint']) {
        expect(typeof s[key]).toBe('string')
        expect((s[key] as string).length).toBeGreaterThan(0)
      }
    }
  })
})
