/**
 * T0439 (BUG-105): files dropped on a terminal → quoted paths typed at the prompt, the way
 * VS Code / Windows Terminal do it. Paths go through `remote:resolve-client-paths`
 * ('local-file', T0437) first, so a remote window inserts the host form and drops what the
 * host cannot read; a local window inserts its own paths unchanged. Only text is inserted —
 * never `\r`.
 */
import { settingsStore } from '../stores/settings-store'
import { detectShellFamily, quoteArgForShell, type ShellFamily } from '../utils/shell-quote'
import { resolveAttachmentPaths, type AttachmentPathResolution } from './client-paths'

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

export function dataTransferHasFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  return !!dataTransfer && Array.from(dataTransfer.types ?? []).includes('Files')
}

/** Local paths of the dropped files (Electron `webUtils.getPathForFile`, T0435); '' entries skipped. */
export function droppedFilePaths(dataTransfer: DataTransfer): string[] {
  const paths: string[] = []
  for (const file of Array.from(dataTransfer.files ?? [])) {
    const path = window.electronAPI.shell.getPathForFile(file)
    if (path) paths.push(path)
  }
  return paths
}
