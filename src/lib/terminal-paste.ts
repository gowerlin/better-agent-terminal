/**
 * Clipboard paste into a terminal tab (Ctrl+V on every platform, Command+V and the context
 * menu's Paste).
 *
 * T0522 (BUG-128): Command+V used to fall through to xterm's DOM `paste` handler, which reads
 * only `text/plain`. A Finder copy carries its items as file URLs, and the paste event exposes
 * them as Files without text, so nothing was typed; Ctrl+V (read through
 * `navigator.clipboard.readText()`) typed the bare file name Finder also puts on the clipboard.
 * Copied items are now typed as paths like a file drop (T0439: shell-quoted, space-separated,
 * host form in a remote window). main reads them (`clipboard:read-file-paths`, macOS only).
 *
 * T0524 (BUG-130): an image on the clipboard sends the claude CLI's image-paste key so the CLI
 * reads the system clipboard itself — Alt+V (`ESC v`) on Windows, Ctrl+V (`^V`) on macOS /
 * Linux (claude CLI 2.1.296: `windows`/`wsl` bind `alt+v`, the rest `ctrl+v`). macOS used to
 * paste text for both shortcuts, so the CLI never got its key; Windows detected the image with
 * the renderer's Async Clipboard API and fell back to a text paste, without a log line, whenever
 * `navigator.clipboard.read()` threw. The image check now asks main first
 * (`clipboard:read-image-data-url`, T0436) and logs every fallback.
 *
 * T0893 (BUG-216): main answers from the clipboard's MIME types (`clipboard:has-image`) instead of
 * fetching the image (a 36–51 MB clipboard PNG used to block main's event loop ~1–3 s just to be
 * refused). Errors are logged as `name: message` (`describePasteError`); when the text read fails
 * too, the tab shows a notice (`TerminalClipboardReadError` → `terminal.clipboardReadFailed`).
 *
 * Priority: copied files → paths (a Finder copy of an image file also carries the file icon as
 * an image, which must not win), then image → key, then text.
 *
 * PLAN-038 U4 (T0835): in an SSH or Docker window the CLI runs on the remote host and reads
 * *that* host's clipboard (no X / Wayland there), and the key is chosen by this machine's
 * platform, so the key always fails. There an image is uploaded instead: main reads this
 * machine's clipboard PNG (T0833 `clipboard-image` source), uploads it to the window's host
 * (session key = the tab's PTY id) and its host path is typed, quoted, like a drop. Every other
 * window — local, WSL (whose CLI reads the Windows clipboard, T0828 §6), a legacy remote profile
 * without `targetOS` — keeps the key (`terminalImagePasteMode`). Text and copied files are unchanged.
 */

import { uploadToRemoteHost, type RemoteUploadItemResult, type RemoteUploadOptions } from './remote-upload'

export type ElectronPlatform = 'win32' | 'darwin' | 'linux'

export interface PasteKeyEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** Plain Command+V on macOS (Command+Shift/Option/Control+V are left alone). */
export function isMacCommandPaste(event: PasteKeyEvent, platform: ElectronPlatform | undefined): boolean {
  return platform === 'darwin'
    && event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
    && event.key.toLowerCase() === 'v'
}

/** Key the claude CLI binds to `chat:imagePaste`: Alt+V on Windows, Ctrl+V elsewhere. */
export function imagePasteKey(platform: ElectronPlatform | undefined): string {
  return platform === 'win32' ? '\x1bv' : '\x16'
}

/** T0835: what a clipboard image does in this window: the CLI's paste key, or upload + type the path. */
export type TerminalImagePasteMode = 'key' | 'upload'

/** Profile `targetOS` values whose CLI cannot read this machine's clipboard (T0828 §6). */
const UPLOAD_IMAGE_TARGETS: ReadonlySet<string> = new Set(['ssh-linux', 'ssh-darwin', 'docker-linux'])

/** T0835: SSH / Docker remote profile → upload; anything else (local, WSL, legacy remote, unknown) → key. */
export function imagePasteModeFor(profile: { type?: string; targetOS?: string } | null | undefined): TerminalImagePasteMode {
  return profile?.type === 'remote' && !!profile.targetOS && UPLOAD_IMAGE_TARGETS.has(profile.targetOS) ? 'upload' : 'key'
}

let imagePasteModeCache: TerminalImagePasteMode | null = null

/**
 * T0835: the image-paste mode of this window, from its profile binding (`app:get-window-profile`;
 * a detached workspace window reports its parent's, T0446) and the LOCAL profile list, so it does
 * not depend on the connection. The binding does not change while the window is open: the first
 * answer is cached. Any failure → `key` (the behavior before T0835), not cached.
 */
export async function terminalImagePasteMode(log: Log = () => {}): Promise<TerminalImagePasteMode> {
  if (imagePasteModeCache) return imagePasteModeCache
  try {
    const profileId = await window.electronAPI.app.getWindowProfile()
    if (!profileId) return (imagePasteModeCache = 'key')
    const { profiles } = await window.electronAPI.profile.listLocal()
    return (imagePasteModeCache = imagePasteModeFor(profiles.find(p => p.id === profileId)))
  } catch (err) {
    log('[terminal-paste] window profile lookup failed, keeping the image-paste key', err instanceof Error ? err.message : String(err))
    return 'key'
  }
}

/** Test-only: forget the cached mode. */
export function resetTerminalImagePasteModeCache(): void {
  imagePasteModeCache = null
}

/**
 * T0835: uploads this machine's clipboard image to the window's host (session key = the tab's
 * PTY id). Never throws; the result carries `serverPath` or the failure code.
 */
export async function uploadClipboardImage(
  terminalId: string,
  options: Pick<RemoteUploadOptions, 'signal' | 'onProgress' | 'api'> & { upload?: typeof uploadToRemoteHost } = {},
): Promise<{ cancelled: boolean; item: RemoteUploadItemResult }> {
  const { upload = uploadToRemoteHost, ...uploadOptions } = options
  try {
    const outcome = await upload(terminalId, [{ kind: 'clipboard-image' }], uploadOptions)
    const item = outcome.items[0]
    if (!item || (item.ok && (typeof item.serverPath !== 'string' || !item.serverPath))) {
      return { cancelled: outcome.cancelled, item: { ok: false, code: 'TRANSPORT', message: 'no host path in the result' } }
    }
    return { cancelled: outcome.cancelled, item }
  } catch (err) {
    return { cancelled: false, item: { ok: false, code: 'TRANSPORT', message: err instanceof Error ? err.message : String(err) } }
  }
}

export type TerminalClipboardContent =
  | { kind: 'paths'; paths: string[] }
  | { kind: 'image' }
  | { kind: 'text'; text: string }

export interface TerminalClipboardReaders {
  readFilePaths: () => Promise<string[]>
  hasImage: () => Promise<boolean>
  readText: () => Promise<string>
}

type Log = (...args: unknown[]) => void

/**
 * T0893 / BUG-216: a paste error as `name: message` for the log. Passed as-is, a DOMException (what
 * the Async Clipboard API rejects with) is serialized as `{}`. Only the error's own name and message —
 * never clipboard contents, paths or image data.
 */
export function describePasteError(err: unknown): string {
  if (err && typeof err === 'object') {
    const { name, message } = err as { name?: unknown; message?: unknown }
    const n = typeof name === 'string' && name ? name : 'Error'
    return typeof message === 'string' && message ? `${n}: ${message}` : n
  }
  return String(err)
}

/**
 * T0893 / BUG-216: the clipboard could not be read at all (the text read, the last step, failed), so
 * the paste did nothing. The terminal shows `terminal.clipboardReadFailed` for it.
 */
export class TerminalClipboardReadError extends Error {
  constructor(cause: unknown) {
    super(`clipboard text read failed (${describePasteError(cause)})`)
    this.name = 'TerminalClipboardReadError'
  }
}

export function isTerminalClipboardReadError(err: unknown): err is TerminalClipboardReadError {
  return err instanceof TerminalClipboardReadError
}

/**
 * Whether this machine's clipboard holds an image. main decides from the clipboard's MIME types
 * (`clipboard:has-image`, T0893: the image is not read — it used to be fetched, decoded and
 * re-encoded through `clipboard:read-image-data-url` just for this yes / no); should that call fail
 * the renderer's Async Clipboard types are the fallback.
 */
async function clipboardHasImage(log: Log): Promise<boolean> {
  try {
    return (await window.electronAPI.clipboard.hasImage()) === true
  } catch (err) {
    log('[terminal-paste] clipboard:has-image failed, checking navigator.clipboard.read()', describePasteError(err))
  }
  const items = await navigator.clipboard.read()
  return items.some(item => item.types.some(type => type.startsWith('image/')))
}

function defaultReaders(log: Log): TerminalClipboardReaders {
  return {
    readFilePaths: () => window.electronAPI.clipboard.readFilePaths(),
    hasImage: () => clipboardHasImage(log),
    readText: () => navigator.clipboard.readText(),
  }
}

/**
 * What a terminal paste should do: type the copied items' paths, send the image-paste key, or
 * paste the text. A failing path / image check is logged and degrades to the next step; a failing
 * text read (nothing left to fall back to) rejects with `TerminalClipboardReadError` (T0893).
 */
export async function readTerminalClipboard(
  readers?: TerminalClipboardReaders,
  log: Log = () => {},
): Promise<TerminalClipboardContent> {
  const r = readers ?? defaultReaders(log)
  try {
    const paths = await r.readFilePaths()
    if (Array.isArray(paths) && paths.length > 0) return { kind: 'paths', paths }
  } catch (err) {
    log('[terminal-paste] clipboard:read-file-paths failed, checking for an image', describePasteError(err))
  }
  try {
    if (await r.hasImage()) return { kind: 'image' }
  } catch (err) {
    log('[terminal-paste] clipboard image check failed, pasting text', describePasteError(err))
  }
  let text: string
  try {
    text = await r.readText()
  } catch (err) {
    throw new TerminalClipboardReadError(err)
  }
  return { kind: 'text', text }
}
