/**
 * T0437 (BUG-105): client-side paths that BAT itself produced (attachment `@` prefixes) →
 * the form the window's host can read. Main answers `remote:resolve-client-paths`
 * (ALWAYS_LOCAL) with the window's PathTranslator; reachability is decided by rules only,
 * nothing is probed on the remote host (electron/remote/path-translator.ts
 * `resolveClientPaths`). A local window resolves every path to itself.
 *
 * Text the user typed or pasted is never rewritten (T0421).
 */

import {
  REMOTE_UPLOAD_LIMITS,
  uploadToRemoteHost,
  type RemoteUploadErrorCode,
  type RemoteUploadOutcome,
  type RemoteUploadSource,
} from './remote-upload'

export const CLIENT_PATH_PURPOSES = ['local-file', 'workspace-entry'] as const

/**
 * - `local-file`: a file on this machine (drag & drop, attach dialog). Under SSH it is
 *   never on the remote host (T0421 Q1).
 * - `workspace-entry`: the client form of a server file (came back through `toClient`),
 *   so `toServer` maps it back (T0438 "copy remote path").
 */
export type ClientPathPurpose = typeof CLIENT_PATH_PURPOSES[number]

export type ClientPathUnreachableReason =
  | 'invalid-path' // not a non-empty string
  | 'no-translator' // the window's profile has no usable translator (fail-closed)
  | 'ssh-local-file' // SSH host: a local file is never on the remote host
  | 'outside-wsl-distro' // another distro's UNC, a network share, ...
  | 'outside-docker-mounts' // not inside any bind mount of the container

export interface ResolvedClientPath {
  input: string
  serverPath: string | null
  reachable: boolean
  reason?: ClientPathUnreachableReason
}

export interface AttachmentPathResolution {
  /** Server-form paths, in input order. */
  serverPaths: string[]
  /** Client paths the host cannot read; they are not sent. */
  rejected: string[]
}

/** Pairs each input with its answer; anything without a reachable answer is rejected (fail-closed). */
export function splitResolvedPaths(paths: readonly string[], results: unknown): AttachmentPathResolution {
  const answers = Array.isArray(results) ? results as Array<Partial<ResolvedClientPath> | null | undefined> : []
  const serverPaths: string[] = []
  const rejected: string[] = []
  paths.forEach((input, i) => {
    const answer = answers[i]
    if (answer && answer.input === input && answer.reachable === true && typeof answer.serverPath === 'string' && answer.serverPath) {
      serverPaths.push(answer.serverPath)
    } else {
      rejected.push(input)
    }
  })
  return { serverPaths, rejected }
}

/** Attachment paths (local files) of the Claude / Codex panels → what the agent's host can open. */
export async function resolveAttachmentPaths(paths: readonly string[]): Promise<AttachmentPathResolution> {
  if (paths.length === 0) return { serverPaths: [], rejected: [] }
  let results: unknown
  try {
    results = await window.electronAPI.remote.resolveClientPaths([...paths], 'local-file')
  } catch (err) {
    window.electronAPI.debug?.log?.('[attachments] remote:resolve-client-paths failed:', err instanceof Error ? err.message : String(err))
    results = null
  }
  return splitResolvedPaths(paths, results)
}

/** File names for the "not on the remote host" notice. */
export function attachmentDisplayNames(paths: readonly string[]): string {
  return paths.map(p => p.split(/[\\/]/).pop() || p).join(', ')
}

/**
 * T0438: a workspace path as shown in this window (client form, e.g. a file tree entry) →
 * the path on the window's host. null when main gives no reachable answer (fail-closed).
 */
export async function resolveRemotePath(path: string): Promise<string | null> {
  if (!path) return null
  let results: unknown
  try {
    results = await window.electronAPI.remote.resolveClientPaths([path], 'workspace-entry')
  } catch (err) {
    window.electronAPI.debug?.log?.('[copy-remote-path] remote:resolve-client-paths failed:', err instanceof Error ? err.message : String(err))
    return null
  }
  return splitResolvedPaths([path], results).serverPaths[0] ?? null
}

/** T0438 "Copy Remote Path": copies the host form of `path`; false when it cannot be resolved. */
export async function copyRemotePath(path: string): Promise<boolean> {
  const serverPath = await resolveRemotePath(path)
  if (!serverPath) {
    window.electronAPI.debug?.log?.('[copy-remote-path] no host path for', path)
    return false
  }
  await navigator.clipboard.writeText(serverPath)
  return true
}

// ---------------------------------------------------------------------------------------------
// PLAN-038 U3 (T0834): panel attachments the window's host cannot read are uploaded to it when
// the message is sent (`uploadToRemoteHost`, T0833) and go out as `@<serverPath>`. Only an answer
// with a `reason` (unreachable) is uploaded; a reachable answer (local window, WSL same distro,
// `/mnt/c`, inside a Docker mount) is sent exactly as before. Any upload failure, a limit or an
// old bat-server → the T0437 refusal with a toast (D272). docs/agent-guide/remote-file-upload.md
// 「面板接線（T0834）」.
// ---------------------------------------------------------------------------------------------

/**
 * A panel file attachment. `file`: the dropped / pasted File (the renderer uploads it in chunks);
 * without it the path came from `dialog:select-attachments` and main reads it (T0833 `path` source).
 */
export interface SendAttachment {
  path: string
  name: string
  file?: Blob
}

export interface AttachmentUploadFailure {
  path: string
  name: string
  code: RemoteUploadErrorCode
}

export interface AttachmentSendResolution {
  /** Host-form paths that go out as `@…`, in attachment order. */
  serverPaths: string[]
  /**
   * One per `serverPaths` entry: an uploaded file shows its own name; the others keep the T0437
   * note (last `/` segment of the host path), so a send without uploads displays as before.
   */
  displayNames: string[]
  /** Not uploadable (no answer, `invalid-path`): the T0437 refusal. */
  rejected: string[]
  /** Uploads that failed: refused as well, with the reason. */
  uploadFailed: AttachmentUploadFailure[]
  /** Number of attachments that were uploaded. */
  uploaded: number
  /** The user cancelled the upload: nothing may be sent. */
  cancelled: boolean
}

export interface AttachmentSendOptions {
  /** The panel's sessionId (T0832 契約 C-5). */
  sessionKey: string
  signal?: AbortSignal
  /** Called once, before the first byte, with the paths that will be uploaded. */
  onUploadStart?: (paths: string[]) => void
  /** Fraction (0–1) of one attachment the host has confirmed. */
  onUploadProgress?: (path: string, fraction: number) => void
  /** Test seam; defaults to `uploadToRemoteHost`. */
  upload?: typeof uploadToRemoteHost
}

/** True when an unreachable answer is worth an upload (there is a file to read). */
export function isUploadableReason(reason: ClientPathUnreachableReason | undefined): boolean {
  return reason !== undefined && reason !== 'invalid-path'
}

export type AttachmentAnswerKind =
  | { kind: 'reachable'; serverPath: string }
  | { kind: 'upload' }
  | { kind: 'rejected' }

/** Same pairing as `splitResolvedPaths` (fail-closed), keeping the unreachable ones that have a reason. */
export function classifyResolvedPaths(paths: readonly string[], results: unknown): AttachmentAnswerKind[] {
  const answers = Array.isArray(results) ? results as Array<Partial<ResolvedClientPath> | null | undefined> : []
  return paths.map((input, i): AttachmentAnswerKind => {
    const answer = answers[i]
    if (!answer || answer.input !== input) return { kind: 'rejected' }
    if (answer.reachable === true) {
      return typeof answer.serverPath === 'string' && answer.serverPath
        ? { kind: 'reachable', serverPath: answer.serverPath }
        : { kind: 'rejected' }
    }
    return isUploadableReason(answer.reason) ? { kind: 'upload' } : { kind: 'rejected' }
  })
}

/**
 * Resolves the panel's file attachments for one send: reachable ones keep their host path,
 * unreachable ones with a reason are uploaded (all in one `uploadToRemoteHost` call, one after
 * another), the rest are refused. Never throws.
 */
export async function resolveAttachmentsForSend(
  files: readonly SendAttachment[],
  options: AttachmentSendOptions,
): Promise<AttachmentSendResolution> {
  const resolution: AttachmentSendResolution = { serverPaths: [], displayNames: [], rejected: [], uploadFailed: [], uploaded: 0, cancelled: false }
  if (files.length === 0) return resolution
  const paths = files.map(f => f.path)
  let results: unknown
  try {
    results = await window.electronAPI.remote.resolveClientPaths([...paths], 'local-file')
  } catch (err) {
    window.electronAPI.debug?.log?.('[attachments] remote:resolve-client-paths failed:', err instanceof Error ? err.message : String(err))
    results = null
  }
  const kinds = classifyResolvedPaths(paths, results)

  const uploadIndexes = kinds.flatMap((k, i) => (k.kind === 'upload' ? [i] : []))
  const uploadedPaths = new Map<number, string>()
  const failed = new Map<number, RemoteUploadErrorCode>()
  if (uploadIndexes.length > 0) {
    options.onUploadStart?.(uploadIndexes.map(i => files[i].path))
    const sources: RemoteUploadSource[] = uploadIndexes.map((i): RemoteUploadSource => {
      const f = files[i]
      return f.file ? { kind: 'file', file: f.file, name: f.name } : { kind: 'path', path: f.path }
    })
    let outcome: RemoteUploadOutcome
    try {
      outcome = await (options.upload ?? uploadToRemoteHost)(options.sessionKey, sources, {
        signal: options.signal,
        onProgress: p => {
          const index = uploadIndexes[p.index]
          if (index === undefined) return
          options.onUploadProgress?.(files[index].path, p.size > 0 ? Math.min(1, p.received / p.size) : 1)
        },
      })
    } catch (err) {
      // uploadToRemoteHost does not throw; a broken API object might.
      const message = err instanceof Error ? err.message : String(err)
      outcome = { ok: false, cancelled: false, items: sources.map(() => ({ ok: false as const, code: 'TRANSPORT' as const, message })) }
    }
    uploadIndexes.forEach((fileIndex, k) => {
      const item = outcome.items[k]
      if (item && item.ok && item.serverPath) uploadedPaths.set(fileIndex, item.serverPath)
      else failed.set(fileIndex, item && !item.ok ? item.code : 'TRANSPORT')
    })
    const cancelled = outcome.cancelled || !!options.signal?.aborted
    const codes = [...new Set(failed.values())]
    // No file names or paths in the log (T0832 日誌規則).
    window.electronAPI.debug?.log?.(`[attachments] upload: files=${uploadIndexes.length} ok=${uploadedPaths.size} failed=${failed.size}${cancelled ? ' cancelled' : ''}${codes.length > 0 ? ` codes=${codes.join(',')}` : ''}`)
    if (cancelled) return { ...resolution, cancelled: true }
  }

  kinds.forEach((k, i) => {
    const f = files[i]
    if (k.kind === 'reachable') {
      resolution.serverPaths.push(k.serverPath)
      resolution.displayNames.push(k.serverPath.split('/').pop() ?? k.serverPath)
      return
    }
    if (k.kind === 'rejected') {
      resolution.rejected.push(f.path)
      return
    }
    const serverPath = uploadedPaths.get(i)
    if (serverPath) {
      resolution.serverPaths.push(serverPath)
      resolution.displayNames.push(f.name)
      resolution.uploaded++
    } else {
      resolution.uploadFailed.push({ path: f.path, name: f.name, code: failed.get(i) ?? 'TRANSPORT' })
    }
  })
  return resolution
}

/** i18n key + params of an upload failure reason (`claude.uploadError.*`). */
export function uploadFailureReason(code: RemoteUploadErrorCode): { key: string; params?: Record<string, string | number> } {
  const mib = (bytes: number) => Math.round(bytes / (1024 * 1024))
  switch (code) {
    case 'TOO_LARGE': return { key: 'claude.uploadError.tooLarge', params: { limit: mib(REMOTE_UPLOAD_LIMITS.maxFileBytes) } }
    case 'SEND_TOO_LARGE': return { key: 'claude.uploadError.sendTooLarge', params: { limit: mib(REMOTE_UPLOAD_LIMITS.maxSendBytes) } }
    case 'TOO_MANY_FILES': return { key: 'claude.uploadError.tooManyFiles', params: { count: REMOTE_UPLOAD_LIMITS.maxSendFiles } }
    case 'QUOTA':
    case 'TOO_MANY': return { key: 'claude.uploadError.quota' }
    case 'NO_SPACE': return { key: 'claude.uploadError.noSpace' }
    case 'SERVER_TOO_OLD': return { key: 'claude.uploadError.serverTooOld' }
    case 'NOT_CONNECTED':
    case 'TRANSPORT': return { key: 'claude.uploadError.connection' }
    case 'SOURCE_ERROR':
    case 'NOT_SELECTED': return { key: 'claude.uploadError.source' }
    default: return { key: 'claude.uploadError.other', params: { code } }
  }
}

type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * The refusal toast of one send: the T0437 sentence for every attachment that is not sent, then
 * (when an upload was tried) the reasons, grouped by reason. null when nothing was refused.
 */
export function attachmentRefusalText(resolution: Pick<AttachmentSendResolution, 'rejected' | 'uploadFailed'>, t: Translate): string | null {
  const names = [
    ...resolution.rejected.map(p => attachmentDisplayNames([p])),
    ...resolution.uploadFailed.map(f => f.name),
  ]
  if (names.length === 0) return null
  let text = t('claude.attachmentNotOnRemoteHost', { files: names.join(', ') })
  if (resolution.uploadFailed.length > 0) {
    const groups = new Map<string, string[]>()
    for (const f of resolution.uploadFailed) {
      const reason = uploadFailureReason(f.code)
      const reasonText = t(reason.key, reason.params)
      groups.set(reasonText, [...(groups.get(reasonText) ?? []), f.name])
    }
    const details = [...groups].map(([reason, groupNames]) => `${groupNames.join(', ')} (${reason})`).join('; ')
    text += ' ' + t('claude.attachmentUploadFailed', { details })
  }
  return text
}
