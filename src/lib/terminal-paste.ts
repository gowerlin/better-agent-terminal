/**
 * T0522 (BUG-128): macOS clipboard paste into a terminal.
 *
 * Command+V used to fall through to xterm's DOM `paste` handler, which reads only
 * `text/plain`. A Finder copy carries its items as file URLs, and the paste event exposes
 * them as Files without text, so nothing was typed; Ctrl+V (read through
 * `navigator.clipboard.readText()`) typed the bare file name Finder also puts on the clipboard.
 * On macOS both shortcuts now ask main for the copied items' paths first
 * (`clipboard:read-file-paths`) and type them like a file drop (T0439: shell-quoted,
 * space-separated, host form in a remote window); with no file items they paste the text as
 * before. Windows / Linux keep their own paths in TerminalPanel unchanged.
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

export type TerminalClipboardContent =
  | { kind: 'paths'; paths: string[] }
  | { kind: 'text'; text: string }

export interface TerminalClipboardReaders {
  readFilePaths: () => Promise<string[]>
  readText: () => Promise<string>
}

const defaultReaders: TerminalClipboardReaders = {
  readFilePaths: () => window.electronAPI.clipboard.readFilePaths(),
  readText: () => navigator.clipboard.readText(),
}

/**
 * What a macOS paste should insert: the copied items' paths when the clipboard holds files /
 * folders, otherwise its text. A failing path read degrades to the text paste.
 */
export async function readMacTerminalClipboard(
  readers: TerminalClipboardReaders = defaultReaders,
  log: (...args: unknown[]) => void = () => {},
): Promise<TerminalClipboardContent> {
  try {
    const paths = await readers.readFilePaths()
    if (Array.isArray(paths) && paths.length > 0) return { kind: 'paths', paths }
  } catch (err) {
    log('[terminal-paste] clipboard:read-file-paths failed, pasting text', err)
  }
  return { kind: 'text', text: await readers.readText() }
}
