/**
 * T0522 / BUG-128: absolute paths of the files / folders a macOS Finder copy put on the
 * clipboard, so Command+V in a terminal can type them the way a file drop does (T0439).
 *
 * Finder writes the items as file URLs. The DOM `paste` event Chromium builds from that
 * clipboard carries them as Files, not as `text/plain`, so xterm's own paste handler (which
 * only reads `text/plain`) inserts nothing. The renderer therefore asks main, which reads the
 * pasteboard directly:
 *
 * - `NSFilenamesPboardType`: XML property list with every item's POSIX path. Deprecated by
 *   AppKit but still served for Finder copies through pasteboard type translation.
 * - `public.file-url`: one `file://` URL (the first item) — fallback when the list is absent.
 *   File reference URLs (`file:///.file/id=…`) cannot be resolved without AppKit and are skipped.
 *
 * Backs the local-only `clipboard:read-file-paths` channel (plain `ipcMain.handle`, not
 * PROXIED_CHANNELS / the handler registry). It takes no argument and returns only paths, so
 * the renderer cannot read arbitrary clipboard formats through it. Other platforms return [].
 *
 * No `electron` import: main passes in `clipboard`.
 */
import { fileURLToPath } from 'url'

/** The part of Electron's `clipboard` used here. */
export interface ClipboardFormatReader {
  read(format: string): string
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

/** `clipboard:read-file-paths`: file / folder paths on the clipboard (macOS only). */
export function readClipboardFilePaths(clipboard: ClipboardFormatReader, platform: NodeJS.Platform): string[] {
  if (platform !== 'darwin') return []
  const fromList = parseFilenamesPlist(clipboard.read('NSFilenamesPboardType'))
  if (fromList.length > 0) return fromList
  const single = filePathFromFileUrl(clipboard.read('public.file-url'))
  return single ? [single] : []
}
