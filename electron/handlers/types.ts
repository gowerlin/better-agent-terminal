/**
 * PLAN-036 / D129 (T0388): shared handler-module contract.
 *
 * Every proxied domain (pty / claude / git / fs / terminal) will be a module
 * exporting `registerXxxHandlers(register, deps)`. Electron main and the
 * headless bat-server call the SAME module, each with its own `register`
 * (both are `registerHandler` from `electron/remote/handler-registry`) and its
 * own `HostDeps` — so the two hosts cannot drift into separate
 * implementations.
 *
 * 🔴 Nothing under `electron/handlers/` may import `electron` (directly or
 * transitively). Headless runs under plain node, and in the server bundle
 * `electron` is external with no package behind it, so a top-level import
 * throws MODULE_NOT_FOUND at startup. Enforced by
 * `electron/remote/__tests__/headless-electron-free.test.ts`.
 *
 * Field set follows T0386 回報區 §3. Fields are declared ahead of the work
 * orders that fill them (T0389 / T0390 / P1-P3); optional ones are optional
 * because a host may legitimately have no such capability (headless has no
 * desktop notifications and no app menu).
 */
import type { HandlerContext } from '../remote/handler-registry'

export type { HandlerContext }

/**
 * A handler as written in a domain module. `args` are whatever the renderer
 * passed over IPC / the remote frame; each handler narrows its own.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SharedHandler = (ctx: HandlerContext, ...args: any[]) => Promise<unknown> | unknown

/** `registerHandler` from `electron/remote/handler-registry` satisfies this. */
export type HandlerRegistrar = (channel: string, handler: SharedHandler) => void

/** Event sink. Electron: webContents.send + broadcastHub; headless: broadcastHub only. */
export type HostEmit = (channel: string, ...args: unknown[]) => void

export interface HostNotification {
  title: string
  body: string
  /** Window that should be focused when the notification is clicked, if any. */
  windowId?: string | null
  /** No sound (settings `notifySound === false`). */
  silent?: boolean
}

export interface HostNotifier {
  notify(notification: HostNotification): void
  /**
   * Whether a host window currently has focus — callers honouring
   * `notifyOnlyBackground` skip notifying when true. Absent ⇒ never focused.
   */
  hasFocusedWindow?(): boolean
}

export interface HostPathGuard {
  /** Same contract as `isPathAllowed` in `electron/path-guard.ts`. */
  isPathAllowed(requestedPath: string): boolean
}

export interface HostDeps {
  emit: HostEmit
  /** Per-host state dir. Electron: `app.getPath('userData')`; headless: bat-server `dataDir`. */
  dataDir: string
  /** Electron: `app.getPath('home')`; headless: `os.homedir()` of the server user. */
  homeDir: string
  /** Directory holding `bat-notify.mjs` / `bat-terminal.mjs`. Absent on headless (T0386 §4). */
  helperDir?: string
  /** Parsed `<dataDir>/settings.json`; `{}` when missing or unreadable. */
  getSettings(): Record<string, unknown>
  /** Desktop notifications. Absent on headless. */
  notifier?: HostNotifier
  /** Host side effects after `settings:save` (Electron: buildMenu + logger.setConfig). */
  onSettingsSaved?: (settingsJson: string) => void
  /** fs sandbox. Absent ⇒ the fs module must fail closed (T0386 §4, Q2). */
  pathGuard?: HostPathGuard
}

/** Releases what a module created at registration (T0390: headless PtyManager). */
export type HandlerModuleDisposer = () => void

/**
 * Signature every `electron/handlers/<domain>.ts` module exports. A module that
 * owns resources (processes, timers) returns a disposer; headless calls it on
 * `stop()`.
 */
export type HandlerModule = (register: HandlerRegistrar, deps: HostDeps) => void | HandlerModuleDisposer
