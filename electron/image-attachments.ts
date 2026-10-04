/**
 * T0436 / BUG-108: Claude / Codex panel image attachments are read on THIS machine and
 * handed to the renderer as data URLs. They never go through the proxied
 * `image:read-as-data-url`: that channel is sandboxed to workspace roots (so a pasted image
 * in `os.tmpdir()` or a picture outside the workspace is `Path access denied`) and, in a
 * remote-profile window, reads the server's filesystem instead of the client's.
 *
 * Backs two local-only IPC channels (`registerLocalHandlers` in main.ts, plain
 * `ipcMain.handle` — not PROXIED_CHANNELS, not the handler registry, so neither a
 * remote-profile window nor a RemoteServer client can reach them). Neither takes a path
 * from the caller: the clipboard is read in main, and the files come from main's own open
 * dialog. File-tree / PathLinker previews keep using `image:read-as-data-url` (they show
 * workspace files, which live on the server in a remote window).
 *
 * No `electron` import: main passes in `clipboard.readImage()` and the dialog's paths.
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from './logger'
import { MAX_IMAGE_SIZE } from './path-guard'

/** Same set the panels used to split dialog picks into images vs. files. */
export const ATTACHMENT_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'])

// Same mapping (and image/png fallback) as `image:read-as-data-url` (electron/handlers/fs.ts).
const MIME_BY_EXT: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }

export interface AttachmentImage {
  /** Absolute client path, used as the attachment's identity in the panel. */
  path: string
  dataUrl: string
}

export interface AttachmentSelection {
  /** Non-image picks, attached by path. */
  files: string[]
  /** Image picks, already read into data URLs. */
  images: AttachmentImage[]
}

/** The part of Electron's `NativeImage` used here. */
export interface ClipboardImageLike {
  isEmpty(): boolean
  toPNG(): Buffer
}

/** `clipboard:read-image-data-url`: null when the clipboard holds no image. */
export function clipboardImageToDataUrl(image: ClipboardImageLike): string | null {
  if (image.isEmpty()) return null
  const png = image.toPNG()
  if (png.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large (${png.length} > ${MAX_IMAGE_SIZE} bytes)`)
  }
  return `data:image/png;base64,${png.toString('base64')}`
}

export function isAttachmentImagePath(filePath: string): boolean {
  return ATTACHMENT_IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

/**
 * `dialog:select-attachments`: split the paths main's open dialog returned into files and
 * images, reading the images locally. An unreadable or oversized image is logged and left
 * out (the panels used to drop it the same way when `image:read-as-data-url` threw).
 */
export async function readSelectedAttachments(filePaths: readonly string[]): Promise<AttachmentSelection> {
  const selection: AttachmentSelection = { files: [], images: [] }
  for (const filePath of filePaths) {
    if (!isAttachmentImagePath(filePath)) {
      selection.files.push(filePath)
      continue
    }
    try {
      const stat = await fs.stat(filePath)
      if (stat.size > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large (${stat.size} > ${MAX_IMAGE_SIZE} bytes)`)
      }
      const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'image/png'
      const data = await fs.readFile(filePath)
      selection.images.push({ path: filePath, dataUrl: `data:${mime};base64,${data.toString('base64')}` })
    } catch (err) {
      logger.warn('[dialog:select-attachments] skipped image:', filePath, err instanceof Error ? err.message : String(err))
    }
  }
  return selection
}
