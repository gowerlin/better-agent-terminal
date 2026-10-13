// @vitest-environment node
/**
 * T0485: the macOS GUI-launch PATH fix, moved from main.ts into early-path-fix.ts
 * (called by app-paths-bootstrap). Same rules as before: darwin only — login shell
 * PATH, otherwise prepend common node locations + the newest nvm version; Linux and
 * Windows are left alone.
 */
import { describe, expect, it, vi } from 'vitest'
import { resolveGuiLaunchPath, type GuiLaunchPathDeps } from '../early-path-fix'

function deps(overrides: Partial<GuiLaunchPathDeps> = {}): GuiLaunchPathDeps & {
  execFileSync: ReturnType<typeof vi.fn>
  readdirSync: ReturnType<typeof vi.fn>
} {
  return {
    platform: 'darwin',
    env: { SHELL: '/bin/zsh', HOME: '/Users/u', PATH: '/usr/bin:/bin' },
    execFileSync: vi.fn(() => '/opt/homebrew/bin:/usr/bin:/bin\n'),
    readdirSync: vi.fn(() => []),
    ...overrides,
  } as never
}

describe('resolveGuiLaunchPath — darwin', () => {
  it('uses the login shell PATH', () => {
    const d = deps()
    expect(resolveGuiLaunchPath(d)).toEqual({ path: '/opt/homebrew/bin:/usr/bin:/bin', source: 'login-shell' })
    expect(d.execFileSync).toHaveBeenCalledWith('/bin/zsh', ['-l', '-c', 'echo $PATH'], { timeout: 3000, encoding: 'utf8', windowsHide: true })
  })

  it('defaults to /bin/zsh and uses `string join` for fish', () => {
    const noShell = deps({ env: { HOME: '/Users/u' } })
    resolveGuiLaunchPath(noShell)
    expect(noShell.execFileSync.mock.calls[0][0]).toBe('/bin/zsh')

    const fish = deps({ env: { SHELL: '/opt/homebrew/bin/fish', HOME: '/Users/u' } })
    resolveGuiLaunchPath(fish)
    expect(fish.execFileSync.mock.calls[0][1]).toEqual(['-l', '-c', 'string join : $PATH'])
  })

  it('empty login shell output leaves PATH unchanged (no fallback)', () => {
    expect(resolveGuiLaunchPath(deps({ execFileSync: vi.fn(() => '  \n') }))).toBeNull()
  })

  it('login shell failure prepends homebrew / usr-local / volta and the newest nvm version', () => {
    const d = deps({
      execFileSync: vi.fn(() => { throw new Error('timeout') }),
      readdirSync: vi.fn(() => ['v18.20.1', 'v20.9.0', 'v20.10.0', 'system', 'v9.11.2']),
    })
    expect(resolveGuiLaunchPath(d)).toEqual({
      path: '/opt/homebrew/bin:/usr/local/bin:/Users/u/.volta/bin:/Users/u/.nvm/versions/node/v20.10.0/bin:/usr/bin:/bin',
      source: 'fallback',
    })
    expect(d.readdirSync).toHaveBeenCalledWith('/Users/u/.nvm/versions/node')
  })

  it('fallback without nvm and without an inherited PATH', () => {
    const d = deps({
      env: { HOME: '/Users/u' },
      execFileSync: vi.fn(() => { throw new Error('ENOENT') }),
      readdirSync: vi.fn(() => { throw new Error('ENOENT') }),
    })
    expect(resolveGuiLaunchPath(d)).toEqual({ path: '/opt/homebrew/bin:/usr/local/bin:/Users/u/.volta/bin:', source: 'fallback' })
  })
})

describe('resolveGuiLaunchPath — other platforms are a no-op', () => {
  it.each(['linux', 'win32'] as const)('%s: no shell is spawned and PATH stays', (platform) => {
    const d = deps({ platform })
    expect(resolveGuiLaunchPath(d)).toBeNull()
    expect(d.execFileSync).not.toHaveBeenCalled()
    expect(d.readdirSync).not.toHaveBeenCalled()
  })
})
