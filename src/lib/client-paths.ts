/**
 * T0437 (BUG-105): client-side paths that BAT itself produced (attachment `@` prefixes) →
 * the form the window's host can read. Main answers `remote:resolve-client-paths`
 * (ALWAYS_LOCAL) with the window's PathTranslator; reachability is decided by rules only,
 * nothing is probed on the remote host (electron/remote/path-translator.ts
 * `resolveClientPaths`). A local window resolves every path to itself.
 *
 * Text the user typed or pasted is never rewritten (T0421).
 */

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
