// T0799 / BUG-202: the debug-log side of the Linux AppImage sandbox launcher.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { APPIMAGE_SANDBOX_FALLBACK_ENV, takeLinuxSandboxStart } from '../linux-sandbox-fallback'

describe('takeLinuxSandboxStart', () => {
  it('launcher marker + --no-sandbox switch → auto-disabled, marker removed from env', () => {
    const env: Record<string, string | undefined> = { [APPIMAGE_SANDBOX_FALLBACK_ENV]: '1', APPIMAGE: '/home/u/BAT.AppImage', OTHER: 'x' }
    const info = takeLinuxSandboxStart('linux', env, true)
    expect(info?.state).toBe('auto-disabled')
    expect(info?.line).toContain('[sandbox] Chromium sandbox auto-disabled by the AppImage launcher (BUG-202 fallback)')
    expect(info?.line).toContain('appimage=yes')
    expect(APPIMAGE_SANDBOX_FALLBACK_ENV in env).toBe(false)
    expect(env.OTHER).toBe('x')
  })

  it('--no-sandbox without the marker (the .desktop entry, a user) → disabled-by-argument', () => {
    const env: Record<string, string | undefined> = {}
    expect(takeLinuxSandboxStart('linux', env, true)?.state).toBe('disabled-by-argument')
  })

  it('no switch, no marker → sandbox-on', () => {
    const info = takeLinuxSandboxStart('linux', {}, false)
    expect(info?.state).toBe('sandbox-on')
    expect(info?.line).toContain('appimage=no')
  })

  it('marker without the switch → marker-without-switch; any marker value other than 1 counts as absent', () => {
    expect(takeLinuxSandboxStart('linux', { [APPIMAGE_SANDBOX_FALLBACK_ENV]: '1' }, false)?.state).toBe('marker-without-switch')
    expect(takeLinuxSandboxStart('linux', { [APPIMAGE_SANDBOX_FALLBACK_ENV]: 'yes' }, true)?.state).toBe('disabled-by-argument')
  })

  it('off Linux: no line, but the marker is still removed', () => {
    for (const platform of ['win32', 'darwin']) {
      const env: Record<string, string | undefined> = { [APPIMAGE_SANDBOX_FALLBACK_ENV]: '1' }
      expect(takeLinuxSandboxStart(platform, env, true)).toBeNull()
      expect(APPIMAGE_SANDBOX_FALLBACK_ENV in env).toBe(false)
    }
  })

  it('never puts an environment value into the line', () => {
    const env = { [APPIMAGE_SANDBOX_FALLBACK_ENV]: '1', APPIMAGE: '/secret/path/x.AppImage', BAT_REMOTE_TOKEN: 'batcap.secret' }
    const line = takeLinuxSandboxStart('linux', env, true)?.line ?? ''
    expect(line).not.toContain('/secret/path')
    expect(line).not.toContain('batcap')
  })

  it('main.ts calls it right after the Skia decision, before any window or PTY', () => {
    const main = readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8')
    const call = main.indexOf("takeLinuxSandboxStart(process.platform, process.env, app.commandLine.hasSwitch('no-sandbox'))")
    expect(call).toBeGreaterThan(main.indexOf('logger.log(formatSkiaGraphiteDecision('))
    expect(call).toBeLessThan(main.indexOf('new BrowserWindow('))
  })
})
