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
 * No `electron` import: main passes in the clipboard image and the dialog's paths.
 *
 * T0784 (Electron 44+): `clipboard.readImage()` is gone. `readClipboardPng` takes the
 * `image/png` payload from `clipboard.read()`; main decodes it with `nativeImage` and hands
 * the result to `clipboardImageToDataUrl` unchanged. On Windows Electron also exposes a
 * bitmap-only clipboard (CF_BITMAP / CF_DIB, e.g. a screenshot) as `image/png` (measured in T0784).
 *
 * T0893 / BUG-216: the terminal's "is there an image?" check uses `hasClipboardImage`
 * (`clipboard:has-image`, MIME types only) instead of fetching the whole image, and
 * `clipboard:read-image-data-url` refuses a huge clipboard PNG before copying / decoding it
 * (`CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES`).
 *
 * T0895: the remote upload's `clipboard-image` source (electron/upload-client.ts) refuses early too,
 * at its own threshold (1.25 × the 50 MiB upload cap); the refusal is a `ClipboardImageTooLargeError`.
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import { clipboardItemTypes, type ClipboardItemReader } from './clipboard-file-paths'
import { logger } from './logger'
import { MAX_IMAGE_SIZE } from './path-guard'

export const CLIPBOARD_IMAGE_TYPE = 'image/png'

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

/**
 * T0893 / BUG-216: `clipboard:read-image-data-url` refuses a clipboard PNG larger than this BEFORE
 * reading its bytes into a Buffer, decoding and re-encoding it (T0893 measured a 36 MB PNG on
 * Windows: 790–965 ms with the event loop blocked ~770 ms and Peak WS 65 → 356 MiB, against
 * 124–299 ms / 249 MiB when refused on `Blob.size`).
 *
 * The 10 MiB cap (`MAX_IMAGE_SIZE`) is checked on the RE-ENCODED PNG (`clipboardImageToDataUrl`),
 * which can differ from the clipboard's own bytes (T0892: 50,913,361 on the clipboard vs 48,563,050
 * re-encoded; a Windows bitmap clipboard measured 0.08% apart). Refusing early at 2 × the cap keeps
 * every result near the 10 MiB boundary unchanged: 10–20 MiB on the clipboard is still decoded,
 * re-encoded and compared with 10 MiB exactly as before (Tower answer T0893 Q-2).
 */
export const CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES = 2 * MAX_IMAGE_SIZE

export interface ReadClipboardPngOptions {
  /**
   * Throw `ClipboardImageTooLargeError` (`Image too large (<n> > MAX_IMAGE_SIZE bytes)`) when the
   * clipboard PNG is larger than this, before its bytes are copied out. Omitted (clipboard:saveImage)
   * → no early refusal. upload-client passes its own threshold (T0895, `CLIPBOARD_UPLOAD_EARLY_REFUSE_BYTES`).
   */
  refuseAboveBytes?: number
}

function imageTooLarge(size: number): Error {
  return new Error(`Image too large (${size} > ${MAX_IMAGE_SIZE} bytes)`)
}

/**
 * T0895: what `readClipboardPng` throws when `refuseAboveBytes` refuses the image. Same message as
 * before (`Image too large (<n> > MAX_IMAGE_SIZE bytes)`, the panel shows it unchanged); the class and
 * `size` (the clipboard's own PNG byte count) let upload-client map it to `TOO_LARGE` without matching text.
 */
export class ClipboardImageTooLargeError extends Error {
  readonly size: number
  constructor(size: number) {
    super(imageTooLarge(size).message)
    this.name = 'ClipboardImageTooLargeError'
    this.size = size
  }
}

/**
 * PNG bytes of the clipboard image (first item carrying `image/png`); null when there is none.
 * Logs the MIME types `read()` returned (names only) under `[clipboard] read-image`.
 * `options.refuseAboveBytes` (T0893): see `ReadClipboardPngOptions`.
 */
export async function readClipboardPng(clipboard: ClipboardItemReader, options: ReadClipboardPngOptions = {}): Promise<Buffer | null> {
  const items = await clipboard.read()
  let png: Buffer | null = null
  let refusedSize: number | null = null
  const item = items.find(i => i.types.includes(CLIPBOARD_IMAGE_TYPE))
  if (item) {
    try {
      const payload = await item.getType(CLIPBOARD_IMAGE_TYPE)
      if (payload && typeof (payload as Blob).arrayBuffer === 'function') {
        const size = (payload as Blob).size
        if (options.refuseAboveBytes !== undefined && typeof size === 'number' && size > options.refuseAboveBytes) {
          refusedSize = size
        } else {
          png = Buffer.from(await (payload as Blob).arrayBuffer())
        }
      }
    } catch {
      // Rejects when the type vanished between read() and getType(): same as no image.
    }
  }
  const pngLog = refusedSize !== null ? `refused size=${refusedSize}` : png ? png.length : 'none'
  logger.debug(`[clipboard] read-image types=${JSON.stringify(clipboardItemTypes(items))} png=${pngLog}`)
  if (refusedSize !== null) throw new ClipboardImageTooLargeError(refusedSize)
  return png && png.length > 0 ? png : null
}

/**
 * T0893 / BUG-216 (`clipboard:has-image`): whether the clipboard offers `image/png`, from the MIME
 * types `read()` lists — the image itself is never fetched (`getType` is what copies the bytes into
 * main, and on a Windows bitmap clipboard also encodes them; `read()` alone measured < 1 ms with no
 * memory growth for a 36 MB image). The same type `readClipboardPng` reads. Logs type names only.
 */
export async function hasClipboardImage(clipboard: ClipboardItemReader): Promise<boolean> {
  const items = await clipboard.read()
  const hasImage = items.some(i => i.types.includes(CLIPBOARD_IMAGE_TYPE))
  logger.debug(`[clipboard] has-image types=${JSON.stringify(clipboardItemTypes(items))} image=${hasImage ? 'yes' : 'no'}`)
  return hasImage
}

/** `clipboard:read-image-data-url`: null when the clipboard holds no image. */
export function clipboardImageToDataUrl(image: ClipboardImageLike): string | null {
  if (image.isEmpty()) return null
  const png = image.toPNG()
  if (png.length > MAX_IMAGE_SIZE) throw imageTooLarge(png.length)
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
