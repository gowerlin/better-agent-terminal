/**
 * T0439 (BUG-105): files dropped on a terminal → quoted paths typed at the prompt, the way
 * VS Code / Windows Terminal do it. Paths go through `remote:resolve-client-paths`
 * ('local-file', T0437) first, so a remote window inserts the host form and drops what the
 * host cannot read; a local window inserts its own paths unchanged. Only text is inserted —
 * never `\r`.
 */
import { settingsStore } from '../stores/settings-store'
import { detectShellFamily, quoteArgForShell, type ShellFamily } from '../utils/shell-quote'
import {
  resolveAttachmentPaths,
  resolveAttachmentsForSend,
  type AttachmentPathResolution,
  type AttachmentSendOptions,
  type AttachmentSendResolution,
  type SendAttachment,
} from './client-paths'

// PLAN-038 U4 (T0835): a dropped file the host cannot read (SSH, Docker outside the mounts,
// another WSL distro) is uploaded to the host first (`resolveAttachmentsForSend` → T0833
// `uploadToRemoteHost`, session key = the tab's PTY id, T0832 契約 C-5) and its host path is typed
// instead, with the same quoting. A reachable path (local window, same distro, `/mnt/c`, inside a
// mount) is typed exactly as before; an upload that fails falls back to the T0437 toast.

/** The shell path each terminal was spawned with (as passed to `pty:create` / `pty:restart`). */
const terminalShells = new Map<string, string>()

export function rememberTerminalShell(terminalId: string, shell: string | undefined): void {
  if (shell) terminalShells.set(terminalId, shell)
}

/** The configured shell path — a server path in a remote window (settings are proxied). */
export async function getShellFromSettings(): Promise<string | undefined> {
  const settings = settingsStore.getSettings()
  if (settings.shell === 'custom' && settings.customShellPath) {
    return settings.customShellPath
  }
  return window.electronAPI.settings.getShellPath(settings.shell)
}

/**
 * Shell family of a terminal. A terminal this renderer did not spawn (created externally,
 * surviving a reload) falls back to the configured shell.
 */
export async function terminalShellFamily(terminalId: string): Promise<ShellFamily> {
  let shell = terminalShells.get(terminalId)
  if (!shell) {
    try {
      shell = await getShellFromSettings()
    } catch {
      shell = undefined
    }
  }
  return detectShellFamily(shell ?? '')
}

/** Space-separated, shell-quoted paths; no trailing newline. */
export function buildTerminalDropText(paths: readonly string[], shell: ShellFamily): string {
  return paths.map(p => quoteArgForShell(p, shell)).join(' ')
}

export interface TerminalDropInsertion {
  /** What to type at the prompt ('' when nothing is reachable). */
  text: string
  /** Client paths the host cannot read; they are not inserted. */
  rejected: string[]
}

export async function buildTerminalDropInsertion(
  paths: readonly string[],
  shell: ShellFamily,
  resolve: (paths: readonly string[]) => Promise<AttachmentPathResolution> = resolveAttachmentPaths,
): Promise<TerminalDropInsertion> {
  const { serverPaths, rejected } = await resolve(paths)
  return { text: buildTerminalDropText(serverPaths, shell), rejected }
}

export interface TerminalUploadInsertion {
  /** What to type at the prompt ('' when nothing is reachable or uploaded, or on cancel). */
  text: string
  /** The attachment resolution (refusals, upload failures, cancel) for the toast. */
  resolution: AttachmentSendResolution
}

export type TerminalUploadOptions = Pick<AttachmentSendOptions, 'signal' | 'onUploadStart' | 'onUploadProgress' | 'upload'> & {
  /** Test seam; defaults to `resolveAttachmentsForSend`. */
  resolve?: typeof resolveAttachmentsForSend
}

/**
 * T0835: dropped files → the text to type. Reachable ones keep their host path, unreachable ones
 * with a reason are uploaded (session key `terminalId`), the rest are refused; nothing is typed
 * when the user cancels the upload. Paths are quoted for `shell` and keep the drop order. Never throws.
 */
export async function buildTerminalUploadInsertion(
  files: readonly SendAttachment[],
  shell: ShellFamily,
  terminalId: string,
  options: TerminalUploadOptions = {},
): Promise<TerminalUploadInsertion> {
  const { resolve = resolveAttachmentsForSend, ...sendOptions } = options
  const resolution = await resolve(files, { ...sendOptions, sessionKey: terminalId })
  if (resolution.cancelled) return { text: '', resolution }
  return { text: buildTerminalDropText(resolution.serverPaths, shell), resolution }
}

export function dataTransferHasFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  return !!dataTransfer && Array.from(dataTransfer.types ?? []).includes('Files')
}

/** Local paths of the dropped files (Electron `webUtils.getPathForFile`, T0435); '' entries skipped. */
export function droppedFilePaths(dataTransfer: DataTransfer): string[] {
  return droppedFiles(dataTransfer).map(f => f.path)
}

/**
 * T0835: the dropped files with their local path and the `File` itself (an upload reads the
 * `File`, never the path, T0436); entries without a path are skipped, as in `droppedFilePaths`.
 */
export function droppedFiles(dataTransfer: DataTransfer): SendAttachment[] {
  const files: SendAttachment[] = []
  for (const file of Array.from(dataTransfer.files ?? [])) {
    const path = window.electronAPI.shell.getPathForFile(file)
    if (path) files.push({ path, name: file.name || path.split(/[\\/]/).pop() || path, file })
  }
  return files
}
