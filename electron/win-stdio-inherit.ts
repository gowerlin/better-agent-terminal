/**
 * BUG-213 / T0866 (D291): start the Terminal Server without the handles BAT's main process inherited from its caller.
 *
 * Windows libuv starts children with CreateProcessW(bInheritHandles = TRUE): every inheritable handle of the parent
 * reaches the child. Node makes the inherited standard / CRT handles non-inheritable at startup
 * (uv_disable_stdio_inheritance); Electron 45's main process does not (T0865 measured). A Terminal Server started
 * from BAT (holder `spawn` or `fork`) therefore holds the caller's pipes (Playwright: 4), and when BAT exits and the
 * server is kept (upgrade, Recovery「保留」) the caller never gets `close`.
 *
 * Rules (🔴, docs/agent-guide/pty-holder.md「stdio 繼承」):
 *   - win32 only: on macOS / Linux `run(start)` is `start()` — the addon is never looked up or loaded, nothing is
 *     logged;
 *   - only around the Terminal Server start (electron/main.ts forkTerminalServer: the holder `spawn` and the `fork`),
 *     synchronously: disable → start → restore in `finally`. Only the handles the addon reports as changed (they were
 *     inheritable) are made inheritable again, so BAT's other children (git, claude, codex, direct PTY, helpers)
 *     inherit exactly what they did before;
 *   - fail open: no addon file, load failure, bad exports, a throwing or malformed `disable()` → start as before and
 *     log one line with a reason code. Handle values are never logged, only counts.
 *
 * The addon is native/win-stdio-inherit (N-API, kernel32 only), built by `npm run build:native-win`
 * (scripts/build-native-win.mjs) and packaged by the afterPack hook at `<resources>/native/` (scripts/win-stdio-inherit.cjs,
 * same names as below; electron/__tests__/win-stdio-inherit.test.ts checks the parity).
 * Pure: no electron import; file access and dlopen through deps (tests replace them).
 */
import * as fs from 'fs'
import * as path from 'path'

export const WIN_STDIO_INHERIT_ADDON_FILE = 'bat_win_stdio_inherit.node'
/** Source directory of the addon (binding.gyp), relative to the app root in development. */
export const WIN_STDIO_INHERIT_SOURCE_DIR = 'native/win-stdio-inherit'
/** node-gyp's output directory, relative to the source directory. */
export const WIN_STDIO_INHERIT_BUILD_SUBDIR = 'build/Release'
/** `<resources>/<this>/<file>` in a Windows package. */
export const WIN_STDIO_INHERIT_RESOURCES_DIR = 'native'

/** What the addon exports (native/win-stdio-inherit/src/win_stdio_inherit.c). */
export interface WinStdioInheritAddon {
  /** Makes the inherited standard / CRT handles non-inheritable; returns the ones it changed. */
  disable: () => unknown
  /** Makes the given handles inheritable again; returns how many. */
  restore: (handles: bigint[]) => unknown
}

export type WinStdioInheritUnavailable = 'not-found' | 'load-failed' | 'bad-exports'

export type WinStdioInheritLoad =
  | { addon: WinStdioInheritAddon; file: string }
  | { addon: null; reason: WinStdioInheritUnavailable }

export interface WinStdioInheritLocation {
  isPackaged: boolean
  /** `process.resourcesPath` */
  resourcesPath: string
  /** `app.getAppPath()`: the repo root under `npm run dev` */
  appPath: string
}

/** Where the addon is looked for: the package's `<resources>/native/`, or node-gyp's output in development. */
export function winStdioInheritAddonCandidates(location: WinStdioInheritLocation): string[] {
  if (location.isPackaged) return [path.join(location.resourcesPath, WIN_STDIO_INHERIT_RESOURCES_DIR, WIN_STDIO_INHERIT_ADDON_FILE)]
  return [path.join(location.appPath, ...WIN_STDIO_INHERIT_SOURCE_DIR.split('/'), ...WIN_STDIO_INHERIT_BUILD_SUBDIR.split('/'), WIN_STDIO_INHERIT_ADDON_FILE)]
}

export interface WinStdioInheritLoadDeps {
  exists: (file: string) => boolean
  /** Loads a `.node` file and returns its exports (default: `process.dlopen`). */
  dlopen: (file: string) => unknown
}

export const defaultWinStdioInheritLoadDeps: WinStdioInheritLoadDeps = {
  exists: (file) => {
    try {
      return fs.statSync(file).isFile()
    } catch {
      return false
    }
  },
  dlopen: (file) => {
    const mod = { exports: {} as unknown }
    process.dlopen(mod, file)
    return mod.exports
  },
}

/** Loads the first existing candidate. Never throws. */
export function loadWinStdioInheritAddon(candidates: readonly string[], deps: WinStdioInheritLoadDeps = defaultWinStdioInheritLoadDeps): WinStdioInheritLoad {
  const file = candidates.find((c) => {
    try {
      return deps.exists(c)
    } catch {
      return false
    }
  })
  if (!file) return { addon: null, reason: 'not-found' }
  let exports: unknown
  try {
    exports = deps.dlopen(file)
  } catch {
    return { addon: null, reason: 'load-failed' }
  }
  const e = exports as Partial<WinStdioInheritAddon> | null
  if (!e || typeof e.disable !== 'function' || typeof e.restore !== 'function') return { addon: null, reason: 'bad-exports' }
  return { addon: { disable: e.disable, restore: e.restore }, file }
}

function isHandleList(value: unknown): value is bigint[] {
  return Array.isArray(value) && value.every((h) => typeof h === 'bigint')
}

export interface WinStdioInheritGuardOptions {
  platform: NodeJS.Platform
  /** Called once, on the first win32 `run`. */
  candidates: () => string[]
  log: (line: string) => void
  load?: (candidates: readonly string[]) => WinStdioInheritLoad
}

export interface WinStdioInheritGuard {
  /** Runs `start` (a synchronous spawn / fork) with the inherited stdio handles made non-inheritable around it. */
  run: <T>(start: () => T) => T
}

const TAG = '[stdio-inherit]'

export function createWinStdioInheritGuard(options: WinStdioInheritGuardOptions): WinStdioInheritGuard {
  let loaded: WinStdioInheritLoad | null = null
  const load = options.load ?? ((c: readonly string[]) => loadWinStdioInheritAddon(c))
  return {
    run<T>(start: () => T): T {
      // 🔴 macOS / Linux: exactly the start, nothing looked up, nothing logged
      if (options.platform !== 'win32') return start()
      if (!loaded) {
        try {
          loaded = load(options.candidates())
        } catch {
          loaded = { addon: null, reason: 'load-failed' }
        }
      }
      const addon = loaded.addon
      if (!addon) {
        options.log(`${TAG} addon unavailable (${loaded.reason}): Terminal Server started with the inherited handles as before (BUG-213)`)
        return start()
      }
      let saved: bigint[] | null = null
      try {
        const result = addon.disable()
        if (isHandleList(result)) saved = result
        else options.log(`${TAG} disable returned an unexpected result (bad-result): Terminal Server started as before (BUG-213)`)
      } catch {
        options.log(`${TAG} disable failed (disable-failed): Terminal Server started as before (BUG-213)`)
      }
      try {
        return start()
      } finally {
        if (saved) {
          let restored: unknown
          try {
            restored = addon.restore(saved)
          } catch {
            restored = null
          }
          if (typeof restored === 'number') {
            options.log(`${TAG} Terminal Server started without ${saved.length} inherited handle(s); ${restored} restored`)
          } else {
            options.log(`${TAG} restore failed (restore-failed) for ${saved.length} handle(s)`)
          }
        }
      }
    },
  }
}
