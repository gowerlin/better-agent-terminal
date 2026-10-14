/**
 * T0523 / BUG-129: which workspace a helper-dispatched terminal belongs to.
 *
 * A Tower dispatches with `bat-terminal.mjs --notify-id "$BAT_TERMINAL_ID" --workspace
 * "$BAT_WORKSPACE_ID"`. Both values come from the Tower shell's environment, which BAT sets
 * once when the PTY is spawned. When that environment does not describe the tab the Tower
 * runs in any more (a `pty:restart` / Terminal Server recovery dropped it, or the agent CLI
 * restored the environment of an earlier session), the Worker tab used to land in whatever
 * workspace `--workspace` named, and `--agent default` resolved against that workspace too.
 *
 * The persisted window registry knows which workspace each tab belongs to (a tab never moves
 * between workspaces; every creation path saves it). So the Tower terminal (`--notify-id`)
 * decides when the registry knows it, and `--workspace` is the fallback:
 *   - Tower terminal found → its workspace (logged when `--workspace` named another one)
 *   - otherwise `--workspace` as given (the renderer falls back to the active workspace when
 *     the id is unknown, T0137 / T0361)
 *   - neither → the active workspace, decided by the renderer (T0137 / BUG-031)
 *
 * BUG-132 (T0526 #11): when the agent CLI restored another tab's environment, `--notify-id` and
 * `--workspace` are both wrong and the Tower terminal rule lands the Worker in that other tab's
 * workspace. `checkDispatchCwd` compares the dispatch cwd with the landing workspace's
 * `folderPath` so the handler can warn (and refuse in yolo when the cwd belongs to another
 * workspace). cwd stays a check only, never the landing rule (T0137 / BUG-031).
 *
 * 🔴 No `electron` import here: called from the shared terminal command handlers.
 */

export type DispatchWorkspaceSource = 'tower-terminal' | 'requested' | 'active'

export interface DispatchWorkspaceResolution {
  /** Workspace to land in; undefined = the window's active workspace (renderer decides). */
  workspaceId?: string
  /** Its name when the registry has it (alias first). */
  workspaceName?: string
  /** The registry has this workspace (a window of this BAT holds it). */
  known: boolean
  source: DispatchWorkspaceSource
  /** `--workspace` as sent by the helper. */
  requestedWorkspaceId?: string
  /** `--notify-id` (the Tower terminal). */
  towerTerminalId?: string
  /** `--workspace` named a workspace other than the Tower terminal's. */
  mismatch: boolean
  /** BUG-132: the dispatch cwd against the landing workspace's folderPath (Electron only). */
  cwdCheck?: DispatchCwdCheck
}

export interface DispatchWorkspaceRequest {
  towerTerminalId?: string
  requestedWorkspaceId?: string
  /** BUG-132: the helper's `--cwd` (or its `process.cwd()`). */
  cwd?: string
}

/**
 * BUG-132: where the dispatch cwd is relative to the landing workspace.
 *   - `inside`: under the landing workspace's folderPath
 *   - `outside`: under no workspace's folderPath (cross-project dispatch, allowed)
 *   - `other-workspace`: under another workspace's folderPath (`cwdWorkspace`, the deepest)
 *   - `skipped`: nothing to compare (`reason`)
 */
export type DispatchCwdStatus = 'inside' | 'outside' | 'other-workspace' | 'skipped'

export interface DispatchCwdWorkspace {
  id: string
  name?: string
  folderPath: string
}

export interface DispatchCwdCheck {
  status: DispatchCwdStatus
  reason?: 'no-cwd' | 'cwd-not-absolute' | 'landing-unknown' | 'no-folder-path'
  cwd?: string
  /** The landing workspace's folderPath as stored. */
  folderPath?: string
  cwdWorkspace?: DispatchCwdWorkspace
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Registry entries as far as this module reads them (`WindowEntry` matches structurally). */
export interface DispatchRegistryEntry {
  workspaces?: unknown[]
  terminals?: unknown[]
}

interface RegistryWorkspace {
  id: string
  /** alias first */
  name?: string
  folderPath?: string
}

function listWorkspaces(entries: DispatchRegistryEntry[]): RegistryWorkspace[] {
  const out: RegistryWorkspace[] = []
  for (const entry of entries) {
    for (const raw of Array.isArray(entry.workspaces) ? entry.workspaces : []) {
      const ws = asRecord(raw)
      const id = nonEmpty(ws?.id)
      if (!ws || !id) continue
      const name = nonEmpty(ws.alias) ?? nonEmpty(ws.name)
      const folderPath = nonEmpty(ws.folderPath)
      out.push({ id, ...(name ? { name } : {}), ...(folderPath ? { folderPath } : {}) })
    }
  }
  return out
}

function findWorkspaceRecord(entries: DispatchRegistryEntry[], workspaceId: string): RegistryWorkspace | undefined {
  return listWorkspaces(entries).find(ws => ws.id === workspaceId)
}

function findWorkspace(entries: DispatchRegistryEntry[], workspaceId: string): { known: boolean; workspaceName?: string } {
  const ws = findWorkspaceRecord(entries, workspaceId)
  if (!ws) return { known: false }
  return ws.name ? { known: true, workspaceName: ws.name } : { known: true }
}

function findTerminalWorkspace(entries: DispatchRegistryEntry[], terminalId: string): string | undefined {
  for (const entry of entries) {
    for (const raw of Array.isArray(entry.terminals) ? entry.terminals : []) {
      const terminal = asRecord(raw)
      if (terminal?.id === terminalId) return nonEmpty(terminal.workspaceId)
    }
  }
  return undefined
}

export function resolveDispatchWorkspaceFromEntries(
  entries: DispatchRegistryEntry[],
  request: DispatchWorkspaceRequest,
): DispatchWorkspaceResolution {
  const towerTerminalId = nonEmpty(request.towerTerminalId)
  const requestedWorkspaceId = nonEmpty(request.requestedWorkspaceId)
  const towerWorkspaceId = towerTerminalId ? findTerminalWorkspace(entries, towerTerminalId) : undefined

  if (towerWorkspaceId) {
    return {
      workspaceId: towerWorkspaceId,
      ...findWorkspace(entries, towerWorkspaceId),
      source: 'tower-terminal',
      requestedWorkspaceId,
      towerTerminalId,
      mismatch: Boolean(requestedWorkspaceId) && requestedWorkspaceId !== towerWorkspaceId,
    }
  }
  if (requestedWorkspaceId) {
    return {
      workspaceId: requestedWorkspaceId,
      ...findWorkspace(entries, requestedWorkspaceId),
      source: 'requested',
      requestedWorkspaceId,
      towerTerminalId,
      mismatch: false,
    }
  }
  return { source: 'active', known: false, towerTerminalId, mismatch: false }
}

/** The resolution without a registry (headless bat-server): `--workspace` as given. */
export function passThroughDispatchWorkspace(request: DispatchWorkspaceRequest): DispatchWorkspaceResolution {
  return resolveDispatchWorkspaceFromEntries([], request)
}

// ── BUG-132: dispatch cwd vs. the landing workspace's folderPath ──

/**
 * Comparable form of an absolute path, or null when it is not absolute: `/` separators, no
 * duplicate / trailing separators, `.` / `..` resolved; lower case on win32 and darwin (NTFS
 * and default APFS are case-insensitive, Linux file systems are not). win32 also takes the Git
 * Bash form `/d/repo` → `d:/repo`.
 */
export function normalizeDispatchPath(value: string, platform: NodeJS.Platform = process.platform): string | null {
  let s = value.trim()
  if (!s) return null
  const windows = platform === 'win32'
  if (windows) {
    s = s.replace(/\\/g, '/')
    const msys = /^\/([A-Za-z])(\/.*)?$/.exec(s)
    if (msys) s = `${msys[1]}:${msys[2] ?? '/'}`
  }
  const unc = windows && s.startsWith('//')
  let root: string
  let rest: string
  if (unc) {
    root = '//'
    rest = s.slice(2)
  } else if (windows && /^[A-Za-z]:\//.test(s)) {
    root = s.slice(0, 3)
    rest = s.slice(3)
  } else if (windows && /^[A-Za-z]:$/.test(s)) {
    root = `${s}/`
    rest = ''
  } else if (s.startsWith('/')) {
    root = '/'
    rest = s.slice(1)
  } else {
    return null
  }
  const parts: string[] = []
  for (const part of rest.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  if (unc && parts.length < 2) return null
  const joined = root + parts.join('/')
  return windows || platform === 'darwin' ? joined.toLowerCase() : joined
}

/** `child` is `parent` or below it (both from `normalizeDispatchPath`). */
export function isDispatchPathInside(child: string, parent: string): boolean {
  if (child === parent) return true
  return child.startsWith(parent.endsWith('/') ? parent : `${parent}/`)
}

export interface DispatchCwdCheckOptions {
  platform?: NodeJS.Platform
  /**
   * Resolves symlinks (Electron: `fs.promises.realpath` with a timeout). The path as given and
   * its real path are both compared, so a folderPath through a symlink (macOS `/tmp`, cloud
   * drive folders) still matches the physical cwd `process.cwd()` reports. Failure / null →
   * the path as given only.
   */
  realpath?: (path: string) => Promise<string | null>
}

async function comparablePaths(value: string, opts: DispatchCwdCheckOptions): Promise<string[]> {
  const platform = opts.platform ?? process.platform
  const given = normalizeDispatchPath(value, platform)
  if (!given) return []
  let real: string | null = null
  if (opts.realpath) {
    try {
      const resolved = await opts.realpath(value)
      real = resolved ? normalizeDispatchPath(resolved, platform) : null
    } catch {
      real = null
    }
  }
  return real && real !== given ? [given, real] : [given]
}

/** Length of the longest folder form that holds one of the cwd forms, or -1. */
function deepestMatch(cwd: string[], folder: string[]): number {
  let best = -1
  for (const f of folder) {
    if (cwd.some(c => isDispatchPathInside(c, f))) best = Math.max(best, f.length)
  }
  return best
}

/**
 * BUG-132: is the dispatch cwd under the landing workspace's folderPath, and if not, which
 * other workspace (deepest folderPath) holds it. Skipped when there is no cwd, it is not
 * absolute, the landing workspace is not in the registry (active workspace / unknown id) or
 * has no folderPath.
 */
export async function checkDispatchCwd(
  entries: DispatchRegistryEntry[],
  resolution: Pick<DispatchWorkspaceResolution, 'workspaceId' | 'known'>,
  cwd: string | undefined,
  opts: DispatchCwdCheckOptions = {},
): Promise<DispatchCwdCheck> {
  if (!cwd) return { status: 'skipped', reason: 'no-cwd' }
  const landing = resolution.workspaceId && resolution.known ? findWorkspaceRecord(entries, resolution.workspaceId) : null
  if (!landing) return { status: 'skipped', reason: 'landing-unknown', cwd }
  if (!landing.folderPath) return { status: 'skipped', reason: 'no-folder-path', cwd }
  const folderPath = landing.folderPath
  const cwdPaths = await comparablePaths(cwd, opts)
  if (cwdPaths.length === 0) return { status: 'skipped', reason: 'cwd-not-absolute', cwd, folderPath }
  if (deepestMatch(cwdPaths, await comparablePaths(folderPath, opts)) >= 0) return { status: 'inside', cwd, folderPath }

  const seen = new Set<string>([landing.id])
  const others: Array<{ id: string; name?: string; folderPath: string }> = []
  for (const ws of listWorkspaces(entries)) {
    if (!ws.folderPath || seen.has(ws.id)) continue
    seen.add(ws.id)
    others.push({ ...ws, folderPath: ws.folderPath })
  }
  const depths = await Promise.all(others.map(async ws => deepestMatch(cwdPaths, await comparablePaths(ws.folderPath, opts))))
  let bestIndex = -1
  depths.forEach((depth, i) => {
    if (depth >= 0 && (bestIndex < 0 || depth > depths[bestIndex])) bestIndex = i
  })
  if (bestIndex < 0) return { status: 'outside', cwd, folderPath }
  const ws = others[bestIndex]
  return {
    status: 'other-workspace',
    cwd,
    folderPath,
    cwdWorkspace: { id: ws.id, ...(ws.name ? { name: ws.name } : {}), folderPath: ws.folderPath },
  }
}
