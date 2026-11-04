/**
 * PLAN-038 U1 (T0832): `upload:begin` / `upload:chunk` / `upload:finish` / `upload:abort`,
 * registered by Electron main (the host of a local window and of remote clients) and by the
 * headless bat-server, on the same `UploadStaging` contract (electron/upload-staging.ts).
 *
 *   upload:begin(sessionKey, name, size)      → { ok, uploadId, chunkBytes }
 *   upload:chunk(uploadId, offset, base64)    → { ok, received }
 *   upload:finish(uploadId, sha256)           → { ok, serverPath, size }
 *   upload:abort(uploadId)                    → { ok, aborted }
 *   any failure                               → { ok: false, code, message }
 *
 * Only a client window (server token / local IPC) may call them: none is in
 * HELPER_CHANNEL_ROLES, and a helper capability that gets here anyway is refused (FORBIDDEN).
 * `serverPath` is a host path that goes into the prompt as is (SERVER_PATH_RESULT_CHANNELS,
 * never `toClient`). Contract: T0832 回報區〈介面契約〉; docs/agent-guide/remote-file-upload.md.
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import type { UploadFailure, UploadStaging } from '../upload-staging'
import type { HandlerContext, HandlerRegistrar } from './types'

export const UPLOAD_CHANNELS = ['upload:begin', 'upload:chunk', 'upload:finish', 'upload:abort'] as const

export interface UploadHandlerDeps {
  getStaging: () => UploadStaging | null
}

const FORBIDDEN: UploadFailure = { ok: false, code: 'FORBIDDEN', message: 'upload channels are for client windows only' }
const UNAVAILABLE: UploadFailure = { ok: false, code: 'IO_ERROR', message: 'upload staging is not ready on this host' }

export function registerUploadHandlers(register: HandlerRegistrar, deps: UploadHandlerDeps): void {
  const guard = <T>(ctx: HandlerContext, run: (staging: UploadStaging) => Promise<T>): Promise<T | UploadFailure> => {
    if (ctx.helper) return Promise.resolve(FORBIDDEN)
    const staging = deps.getStaging()
    if (!staging) return Promise.resolve(UNAVAILABLE)
    return run(staging)
  }
  register('upload:begin', (ctx, sessionKey: unknown, name: unknown, size: unknown) =>
    guard(ctx, staging => staging.begin(sessionKey, name, size)))
  register('upload:chunk', (ctx, uploadId: unknown, offset: unknown, data: unknown) =>
    guard(ctx, staging => staging.chunk(uploadId, offset, data)))
  register('upload:finish', (ctx, uploadId: unknown, sha256: unknown) =>
    guard(ctx, staging => staging.finish(uploadId, sha256)))
  register('upload:abort', (ctx, uploadId: unknown) =>
    guard(ctx, staging => staging.abort(uploadId)))
}
