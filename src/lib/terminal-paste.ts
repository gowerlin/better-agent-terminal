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
 * Priority: copied files → paths (a Finder copy of an image file also carries the file icon as
 * an image, which must not win), then image → key, then text.
 */

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
 * Whether this machine's clipboard holds an image. main decides (`readImage()` is not empty);
 * should that call fail (IPC error, image over the attachment size cap) the renderer's Async
 * Clipboard types are the fallback.
 */
async function clipboardHasImage(log: Log): Promise<boolean> {
  try {
    return (await window.electronAPI.clipboard.readImageDataUrl()) !== null
  } catch (err) {
    log('[terminal-paste] clipboard:read-image-data-url failed, checking navigator.clipboard.read()', err)
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
 * paste the text. A failing path / image check is logged and degrades to the next step.
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
    log('[terminal-paste] clipboard:read-file-paths failed, checking for an image', err)
  }
  try {
    if (await r.hasImage()) return { kind: 'image' }
  } catch (err) {
    log('[terminal-paste] clipboard image check failed, pasting text', err)
  }
  return { kind: 'text', text: await r.readText() }
}
