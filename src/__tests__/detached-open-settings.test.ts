/**
 * T0530 (BUG-133): App.tsx wiring for "open settings" in a detached workspace window.
 * Main-side behaviour: electron/__tests__/detached-open-settings.test.ts; end to end:
 * e2e/t0530-detached-open-settings.spec.ts.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import en from '../locales/en.json'
import zhCN from '../locales/zh-CN.json'
import zhTW from '../locales/zh-TW.json'

describe('detached window "open settings" (T0530 source guard)', () => {
  const src = readFileSync(resolve(__dirname, '../App.tsx'), 'utf-8')
  const detached = src.slice(src.indexOf('if (detachedWorkspaceId) {'), src.indexOf('// Filter out detached workspaces'))

  test('the detached branch routes onOpenSettings to the parent window, not to a local no-op', () => {
    expect(detached.length).toBeGreaterThan(0)
    expect(detached).toMatch(/onOpenSettings=\{handleDetachedOpenSettings\}/)
    expect(detached).not.toMatch(/setShowSettings\(true\)/)
    // Settings are global and saved whole by every renderer: no second editor in a detached window.
    expect(detached).not.toMatch(/<SettingsPanel/)
    // A failure is shown in the detached window itself.
    expect(detached).toMatch(/\{appNotification && \(/)
  })

  test('the handler asks main and reports a failure', () => {
    const at = src.indexOf('const handleDetachedOpenSettings = useCallback(')
    expect(at).toBeGreaterThan(-1)
    // Hooks run before the detached early return.
    expect(at).toBeLessThan(src.indexOf('if (detachedWorkspaceId) {'))
    const fn = src.slice(at, src.indexOf('}, [t])', at))
    expect(fn).toMatch(/window\.electronAPI\.workspace\.openSettingsInParent\(\)/)
    expect(fn).toMatch(/if \(!result\.ok\) \{[\s\S]*?setAppNotification\(t\('app\.openSettingsNoMainWindow'\)\)/)
    expect(fn).toMatch(/\.catch\(/)
  })

  test('main windows open Settings when main asks', () => {
    const at = src.indexOf('window.electronAPI.workspace.onOpenSettingsRequested(')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(src.indexOf('if (detachedWorkspaceId) {'))
    const effect = src.slice(src.lastIndexOf('useEffect(() => {', at), src.indexOf('}, [detachedWorkspaceId])', at))
    expect(effect).toMatch(/if \(detachedWorkspaceId\) return/)
    expect(effect).toMatch(/return window\.electronAPI\.workspace\.onOpenSettingsRequested\(\(\) => setShowSettings\(true\)\)/)
  })

  test('the failure message exists in all three locales', () => {
    for (const locale of [en, zhCN, zhTW]) {
      expect((locale as { app: Record<string, string> }).app.openSettingsNoMainWindow).toBeTruthy()
    }
  })
})
