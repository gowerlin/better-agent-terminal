/**
 * T0436 / BUG-108: Claude / Codex panel image attachments are read on the client.
 * A dropped image is read from the DOM `File` the renderer already holds, so it never goes
 * through the proxied `image:read-as-data-url` (workspace-sandboxed, and in a remote window
 * it reads the server's filesystem). Paste / dialog picks get their data URL from main
 * (`clipboard.readImageDataUrl` / `dialog.selectAttachments`).
 */

/** Same cap as `MAX_IMAGE_SIZE` in electron/path-guard.ts. */
export const MAX_ATTACHMENT_IMAGE_BYTES = 10 * 1024 * 1024

export function readFileAsDataUrl(file: File): Promise<string> {
  if (file.size > MAX_ATTACHMENT_IMAGE_BYTES) {
    return Promise.reject(new Error(`Image too large (${file.size} > ${MAX_ATTACHMENT_IMAGE_BYTES} bytes)`))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

/**
 * Attachment identity for a dropped image: its disk path when it has one, otherwise a
 * stable key from the File itself (e.g. an image dragged out of a web page).
 */
export function droppedImageKey(file: File, diskPath: string): string {
  return diskPath || `dropped:${file.name}:${file.size}:${file.lastModified}`
}
