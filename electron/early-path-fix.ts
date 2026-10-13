// T0485: PATH fix for GUI-launched apps on macOS, moved out of main.ts.
//
// When launched via .dmg / Applications, macOS gives a minimal PATH that doesn't
// include Homebrew (/opt/homebrew/bin), NVM, etc. We source the user's login shell
// to get the real PATH. Linux and Windows are left untouched.
//
// app-paths-bootstrap calls applyGuiLaunchPathFix() from its body, which runs before
// every other module body of the main bundle. Written in main.ts, the fix ran after
// all of them (rollup places imported module bodies ahead of main.ts's own body).
// Keep the imports to child_process / fs — see app-paths-bootstrap-order.test.ts.
import { execFileSync } from 'child_process'
import * as fs from 'fs'

export interface GuiLaunchPathDeps {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  execFileSync: (file: string, args: string[], options: { timeout: number; encoding: 'utf8'; windowsHide: boolean }) => string
  readdirSync: (dir: string) => string[]
}

export interface GuiLaunchPathResult {
  path: string
  source: 'login-shell' | 'fallback'
}

/** Returns the PATH to use, or null to leave PATH as it is. */
export function resolveGuiLaunchPath(deps: GuiLaunchPathDeps): GuiLaunchPathResult | null {
  if (deps.platform !== 'darwin') return null
  const { env } = deps
  try {
    const shell = env.SHELL || '/bin/zsh'
    // fish stores PATH as a list; use string join to get colon-separated output
    const isFish = shell.endsWith('/fish') || shell === 'fish'
    const cmd = isFish ? 'string join : $PATH' : 'echo $PATH'
    const rawPath = deps.execFileSync(shell, ['-l', '-c', cmd], {
      timeout: 3000,
      encoding: 'utf8',
      windowsHide: true,
    }).trim()
    return rawPath ? { path: rawPath, source: 'login-shell' } : null
  } catch {
    // Fallback: prepend the most common node locations
    const extraPaths = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      `${env.HOME}/.volta/bin`,
    ]
    // Resolve nvm: find the latest installed version's bin directory.
    // NOTE: This intentionally duplicates the semver sort from node-resolver.ts:
    // importing node-resolver here would pull it into the bootstrap's import graph.
    try {
      const nvmDir = `${env.HOME}/.nvm/versions/node`
      const versions = deps.readdirSync(nvmDir).filter((v: string) => v.startsWith('v'))
      if (versions.length > 0) {
        versions.sort((a: string, b: string) => {
          const pa = a.replace(/^v/, '').split('.').map(Number)
          const pb = b.replace(/^v/, '').split('.').map(Number)
          for (let i = 0; i < 3; i++) { const d = (pa[i]||0) - (pb[i]||0); if (d !== 0) return d; }
          return 0
        })
        extraPaths.push(`${nvmDir}/${versions[versions.length - 1]}/bin`)
      }
    } catch { /* nvm not installed */ }
    return { path: `${extraPaths.join(':')}:${env.PATH || ''}`, source: 'fallback' }
  }
}

/** Applies the fix to process.env.PATH; returns where the new PATH came from, or null. */
export function applyGuiLaunchPathFix(): GuiLaunchPathResult['source'] | null {
  const result = resolveGuiLaunchPath({
    platform: process.platform,
    env: process.env,
    execFileSync: (file, args, options) => execFileSync(file, args, options),
    readdirSync: (dir) => fs.readdirSync(dir),
  })
  if (!result) return null
  process.env.PATH = result.path
  return result.source
}
