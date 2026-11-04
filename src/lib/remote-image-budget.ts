// T0842 (BUG-211) — image attachments of a remote window, and what to do when a remote send fails.
//
// A remote window sends every attached image as a base64 data URL inside ONE `claude:send-message`
// WebSocket frame. The bat-server accepts at most 32 MiB per frame (`WS_MAX_PAYLOAD_BYTES`,
// `electron/remote/ws-limits.ts`); RemoteClient rejects a larger frame locally with
// `FRAME_TOO_LARGE` (the connection stays up). The panels check the images before sending so the
// user is told up front and keeps the draft, and recover the draft when a remote send fails anyway.
//
// Local windows are never checked: their images do not cross the WebSocket. Pure functions only
// (no React, no electron); the Claude and Codex panels just wire them in.

const MiB = 1024 * 1024

/**
 * Most image bytes (decoded, summed) a remote window sends in one message: 20 MiB.
 *
 * base64 makes 20 MiB of image 26.67 MiB of data URL; the 32 MiB frame then still has ~5.3 MiB
 * for the prompt, the `@path` file prefix, path translation and JSON escaping (a CJK character is
 * 3 bytes in UTF-8, a control character up to 6 bytes escaped). The measured hard edge is ~24 MiB
 * of image with a short prompt (T0837), so 20 MiB leaves room for long prompts. Two images at the
 * panel's 10 MiB per-image cap still fit; three large ones do not.
 */
export const REMOTE_IMAGE_BUDGET_BYTES = 20 * MiB

/** Decoded size of a data URL's payload (base64 → bytes; a non-base64 data URL → its text length). */
export function dataUrlDecodedBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  const header = dataUrl.slice(0, comma)
  const payloadLength = dataUrl.length - comma - 1
  if (!/;base64$/i.test(header)) return payloadLength
  let padding = 0
  if (dataUrl.endsWith('==')) padding = 2
  else if (dataUrl.endsWith('=')) padding = 1
  return Math.max(0, Math.floor(payloadLength * 3 / 4) - padding)
}

export function totalImageBytes(dataUrls: readonly string[]): number {
  return dataUrls.reduce((sum, url) => sum + dataUrlDecodedBytes(url), 0)
}

export interface RemoteImageBudgetExceeded {
  totalBytes: number
  limitBytes: number
}

/**
 * null when the images may be sent (always for a local window, or within the budget); otherwise
 * their total and the budget, for the notice.
 */
export function checkRemoteImageBudget(
  dataUrls: readonly string[],
  isRemoteWindow: boolean,
  limitBytes = REMOTE_IMAGE_BUDGET_BYTES,
): RemoteImageBudgetExceeded | null {
  if (!isRemoteWindow || dataUrls.length === 0) return null
  const totalBytes = totalImageBytes(dataUrls)
  return totalBytes > limitBytes ? { totalBytes, limitBytes } : null
}

/** `12.3` (MiB, one decimal). */
export function formatMiB(bytes: number): string {
  return (bytes / MiB).toFixed(1)
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/** The notice shown instead of sending (`claude.remoteImagesTooLarge`). */
export function remoteImageBudgetMessage(exceeded: RemoteImageBudgetExceeded, t: Translate): string {
  return t('claude.remoteImagesTooLarge', { size: formatMiB(exceeded.totalBytes), limit: formatMiB(exceeded.limitBytes) })
}

const FRAME_TOO_LARGE_RE = /FRAME_TOO_LARGE\b[^\d]*?frame is (\d+) bytes[^\d]*?(\d+) bytes/

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : String(err)
}

/** Over Electron IPC the error arrives as `Error invoking remote method '<channel>': Error: <message>`. */
function stripIpcWrapper(message: string): string {
  return message.replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '')
}

export type RemoteSendFailure =
  | { kind: 'frame-too-large'; frameBytes: number | null; limitBytes: number | null }
  | { kind: 'failed'; reason: string }

/** What went wrong with a remote send (`FRAME_TOO_LARGE`, or anything else: connection closed, timeout, …). */
export function classifyRemoteSendFailure(err: unknown): RemoteSendFailure {
  const message = errorText(err)
  if (message.includes('FRAME_TOO_LARGE')) {
    const m = message.match(FRAME_TOO_LARGE_RE)
    return { kind: 'frame-too-large', frameBytes: m ? Number(m[1]) : null, limitBytes: m ? Number(m[2]) : null }
  }
  return { kind: 'failed', reason: stripIpcWrapper(message).slice(0, 200) }
}

/** The system message after a remote send failed; the draft has been put back by then. */
export function remoteSendFailureMessage(err: unknown, t: Translate): string {
  const failure = classifyRemoteSendFailure(err)
  if (failure.kind === 'frame-too-large') {
    return failure.frameBytes !== null && failure.limitBytes !== null
      ? t('claude.remoteSendTooLarge', { size: formatMiB(failure.frameBytes), limit: formatMiB(failure.limitBytes) })
      : t('claude.remoteSendTooLargeNoSize')
  }
  return t('claude.remoteSendFailed', { reason: failure.reason })
}

/**
 * The text to put back into the input after a failed send: the sent draft, followed by whatever
 * the user has typed since (nothing is dropped).
 */
export function restoredInputText(sentDraft: string, current: string): string {
  if (!current.trim()) return sentDraft
  if (!sentDraft.trim()) return current
  return `${sentDraft}\n${current}`
}

/**
 * Attachments to put back after a failed send: the sent ones first, then any attached since that
 * are not already among them (by `path`), at most `max`.
 */
export function restoredAttachments<T extends { path: string }>(sent: readonly T[], current: readonly T[], max: number): T[] {
  const out: T[] = []
  for (const item of [...sent, ...current]) {
    if (out.length >= max) break
    if (!out.some(o => o.path === item.path)) out.push(item)
  }
  return out
}
