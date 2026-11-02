/**
 * T0522 / BUG-128: absolute paths of the files / folders a macOS Finder copy put on the
 * clipboard, so Command+V in a terminal can type them the way a file drop does (T0439).
 *
 * Finder writes the items as file URLs. The DOM `paste` event Chromium builds from that
 * clipboard carries them as Files, not as `text/plain`, so xterm's own paste handler (which
 * only reads `text/plain`) inserts nothing. The renderer therefore asks main, which reads the
 * pasteboard directly.
 *
 * T0784 (Electron 44+): main's `clipboard` is the W3C-style API (`read()` → `ClipboardItem[]`,
 * Promise-based); `read(format)` for a raw pasteboard type is gone. Formats, in order:
 *
 * - `text/uri-list`: Electron maps it to the OS "copied files" format (`NSFilenamesPboardType`
 *   on macOS), one `file://` URI per line — every selected item.
 * - `electron application/osclipboard;format="NSFilenamesPboardType"`: XML property list with
 *   every item's POSIX path, in case Electron surfaces the raw type instead of the mapping.
 * - `electron application/osclipboard;format="public.file-url"`: one `file://` URL (the first
 *   item) — fallback when neither list is present. File reference URLs (`file:///.file/id=…`)
 *   cannot be resolved without AppKit and are skipped.
 *
 * The real macOS type names are only observable on a Mac, so every read logs the MIME types
 * `read()` returned (names only, never paths or contents) under `[clipboard] read-file-paths`.
 *
 * Backs the local-only `clipboard:read-file-paths` channel (plain `ipcMain.handle`, not
 * PROXIED_CHANNELS / the handler registry). It takes no argument and returns only paths, so
 * the renderer cannot read arbitrary clipboard formats through it. Other platforms return [].
 *
 * No `electron` import: main passes in `clipboard`.
 */
import { fileURLToPath } from 'url'
import { logger } from './logger'

/** The part of an Electron `ClipboardItem` (W3C shape) used here. */
export interface ClipboardItemLike {
  readonly types: readonly string[]
  getType(type: string): Promise<unknown>
}

/** The part of Electron's `clipboard` (Electron 44+) used here. */
export interface ClipboardItemReader {
  read(): Promise<readonly ClipboardItemLike[]>
}

/** Electron's custom MIME type for a raw platform clipboard format. */
export function osClipboardFormat(name: string): string {
  return `electron application/osclipboard;format="${name}"`
}

export const URI_LIST_TYPE = 'text/uri-list'
export const NS_FILENAMES_TYPE = osClipboardFormat('NSFilenamesPboardType')
export const PUBLIC_FILE_URL_TYPE = osClipboardFormat('public.file-url')

/** Every type `read()` returned, deduplicated, in order (for the format log). */
export function clipboardItemTypes(items: readonly ClipboardItemLike[]): string[] {
  return [...new Set(items.flatMap(item => item.types))]
}

/**
 * Text payload of the first item carrying `type`; '' when none does or it cannot be read.
 * `getType` resolves to a `Blob` for every type used here.
 */
export async function readClipboardText(items: readonly ClipboardItemLike[], type: string): Promise<string> {
  const item = items.find(i => i.types.includes(type))
  if (!item) return ''
  try {
    const payload = await item.getType(type)
    if (typeof payload === 'string') return payload
    if (payload && typeof (payload as Blob).text === 'function') return await (payload as Blob).text()
  } catch {
    // Rejects when the type vanished between read() and getType(): same as absent.
  }
  return ''
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeXmlText(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10))
    return XML_ENTITIES[entity] ?? match
  })
}

function isAbsolutePosixPath(p: string): boolean {
  return p.startsWith('/') && !p.includes('\0')
}

/** POSIX paths in an `NSFilenamesPboardType` XML plist; [] for anything else (incl. binary plists). */
export function parseFilenamesPlist(plist: string): string[] {
  const text = plist.replace(/\0+$/, '')
  if (!text.includes('<plist')) return []
  const paths: string[] = []
  for (const m of text.matchAll(/<string>([\s\S]*?)<\/string>/g)) {
    const p = decodeXmlText(m[1])
    if (isAbsolutePosixPath(p)) paths.push(p)
  }
  return paths
}

/** POSIX path of a `public.file-url` value; null for non-file / reference URLs. */
export function filePathFromFileUrl(url: string): string | null {
  const text = url.replace(/\0+$/, '').trim()
  if (!text.startsWith('file://')) return null
  if (/^file:\/\/(localhost)?\/\.file\/id=/i.test(text)) return null
  try {
    const p = fileURLToPath(text, { windows: false })
    return isAbsolutePosixPath(p) ? p : null
  } catch {
    return null
  }
}

/** POSIX paths in an RFC 2483 `text/uri-list` (comment lines and non-file URIs skipped). */
export function parseUriList(list: string): string[] {
  const paths: string[] = []
  for (const line of list.replace(/\0+$/, '').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const p = filePathFromFileUrl(line)
    if (p) paths.push(p)
  }
  return paths
}

/** `clipboard:read-file-paths`: file / folder paths on the clipboard (macOS only). */
export async function readClipboardFilePaths(clipboard: ClipboardItemReader, platform: NodeJS.Platform): Promise<string[]> {
  if (platform !== 'darwin') return []
  const items = await clipboard.read()
  const types = clipboardItemTypes(items)
  let source = 'none'
  let paths: string[] = parseUriList(await readClipboardText(items, URI_LIST_TYPE))
  if (paths.length > 0) source = 'uri-list'
  else {
    paths = parseFilenamesPlist(await readClipboardText(items, NS_FILENAMES_TYPE))
    if (paths.length > 0) source = 'NSFilenamesPboardType'
    else {
      const single = filePathFromFileUrl(await readClipboardText(items, PUBLIC_FILE_URL_TYPE))
      paths = single ? [single] : []
      if (single) source = 'public.file-url'
    }
  }
  logger.debug(`[clipboard] read-file-paths types=${JSON.stringify(types)} source=${source} count=${paths.length}`)
  return paths
}
