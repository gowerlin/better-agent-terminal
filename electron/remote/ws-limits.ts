// T0842 (BUG-211): the WebSocket frame size limit shared by RemoteServer and RemoteClient.
//
// The server's `WebSocketServer({ maxPayload })` closes the whole connection with 1009 when one
// message is larger than this (it applies before auth, so it is not raised; T0837 direction C).
// RemoteClient checks every frame against the same constant before `ws.send` and rejects the call
// locally instead, so one oversized invoke (for example several images in one
// `claude:send-message`) no longer drops the connection and every other in-flight invoke of the
// profile. Older bat-servers use the same 32 MiB, so no auth-time negotiation is needed.
//
// No electron import: shared by the desktop main process and the headless server bundle.

/** The largest WebSocket message (bytes) the RemoteServer accepts; RemoteClient sends nothing larger. */
export const WS_MAX_PAYLOAD_BYTES = 32 * 1024 * 1024

/** Error code at the start of the message RemoteClient rejects an oversized frame with. */
export const FRAME_TOO_LARGE = 'FRAME_TOO_LARGE'

/**
 * The error message for a frame of `bytes` bytes on `channel`. Format (parsed by the renderer,
 * `src/lib/remote-image-budget.ts`): `FRAME_TOO_LARGE: <channel> frame is <bytes> bytes; the remote
 * connection accepts at most <limit> bytes`.
 */
export function frameTooLargeMessage(channel: string, bytes: number, limit = WS_MAX_PAYLOAD_BYTES): string {
  return `${FRAME_TOO_LARGE}: ${channel} frame is ${bytes} bytes; the remote connection accepts at most ${limit} bytes`
}

/**
 * `JSON.stringify(frame)` when its UTF-8 size fits `limit`; otherwise an Error carrying
 * `frameTooLargeMessage` (and `code` / `bytes` / `limit` for in-process callers).
 */
export function encodeFrameWithinLimit(
  frame: { channel?: string; type: string },
  limit = WS_MAX_PAYLOAD_BYTES,
): { ok: true; data: string; bytes: number } | { ok: false; error: Error & { code: string; bytes: number; limit: number } } {
  const data = JSON.stringify(frame)
  const bytes = Buffer.byteLength(data, 'utf8')
  if (bytes <= limit) return { ok: true, data, bytes }
  const error = Object.assign(new Error(frameTooLargeMessage(frame.channel ?? frame.type, bytes, limit)), {
    code: FRAME_TOO_LARGE,
    bytes,
    limit,
  })
  return { ok: false, error }
}
