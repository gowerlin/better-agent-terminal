/**
 * PLAN-068 W4 / T0906: loads the CT files the「待辦」(Inbox) tab needs for one workspace folder into
 * `inbox-store` — `_tower-state.md`, `_bug-tracker.md`, `_backlog.md` and the status of every work order.
 * Rendered once per window for the workspace the window shows (App: the active workspace; a detached
 * window: its own), so the title badge is right before the tab is ever opened.
 *
 * Same pipeline as the Control Tower panel (T0701 / D184, §5): `fs:readdir` / `fs:readFile` / `fs:stat`
 * (proxied to the window's host for a remote workspace) and a `_ct-workorders/` watch shared through
 * `acquireDirWatch`. 🔴 Read-only; no new channel; nothing is logged about file content.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { workspaceStore } from '../../stores/workspace-store'
import { getTowerContract, useTowerContractVersion } from '../../stores/tower-contract-store'
import { acquireDirWatch } from '../../stores/ct-dir-watch'
import { setInboxFiles, setInboxStateOnly, type InboxFiles, type InboxStateLoad } from '../../stores/inbox-store'
import { effectiveUserInbox, parseTowerConfigYaml, parseTowerState, parseTowerStateInbox, towerStateBatContract, workOrderPhase } from '../../lib/ct-tower-overview'
import { parseBugTracker } from '../../types/bug-tracker'
import { parseBacklog } from '../../types/backlog'
import { isWorkOrderFile, parseWorkOrder, type WorkOrderStatus } from '../../types/control-tower'

type Read = { kind: 'loaded'; content: string } | { kind: 'missing' } | { kind: 'error'; error: string }

/** `fs:readFile`, telling a missing file from an unreadable one with `fs:stat` (as `readCtFile`). */
async function readOptional(path: string): Promise<Read> {
  let result: { content?: string | null; error?: string }
  try {
    result = await window.electronAPI.fs.readFile(path)
  } catch (err) {
    result = { error: err instanceof Error ? err.message : 'Failed to read file' }
  }
  if (result.content != null) return { kind: 'loaded', content: result.content }
  if (result.error === 'File too large') return { kind: 'error', error: result.error }
  const stat = await window.electronAPI.fs.stat(path).catch(() => null)
  return stat ? { kind: 'error', error: result.error ?? 'Failed to read file' } : { kind: 'missing' }
}

/**
 * T0908: the global layer's `user_inbox` per folder's host (`ct:read-config-sources`, proxied; a
 * remote window gets its bat-server's). Read once per data source mount and on ↻, not on every
 * `_ct-workorders/` change. Memory only.
 */
const globalConfigCache = new Map<string, ReadonlyMap<string, string> | null>()

async function globalConfigLayer(folder: string, reload: boolean): Promise<ReadonlyMap<string, string> | null> {
  if (!reload && globalConfigCache.has(folder)) return globalConfigCache.get(folder) ?? null
  let layer: ReadonlyMap<string, string> | null = null
  try {
    const sources = await window.electronAPI.ctConfig?.readSources?.()
    if (sources?.global?.status === 'found') layer = parseTowerConfigYaml(sources.global.content).values
  } catch { /* an older bat-server: the default */ }
  globalConfigCache.set(folder, layer)
  return layer
}

/** One full read of the folder's CT files. Never throws. `reloadGlobal`: read the global config layer again. */
export async function loadInboxFiles(folder: string, opts: { reloadGlobal?: boolean } = {}): Promise<InboxFiles> {
  const ctDir = `${folder}/_ct-workorders`
  let entries: Array<{ name: string; path: string; isDirectory: boolean }>
  try {
    entries = await window.electronAPI.fs.readdir(ctDir)
  } catch {
    return { hasCtDir: false, state: null, bugs: [], plans: [], orderStatuses: [], readErrors: [] }
  }
  if (!Array.isArray(entries)) entries = []
  const readErrors: string[] = []

  const [stateRead, bugRead, backlogRead, configRead, globalLayer] = await Promise.all([
    readOptional(`${ctDir}/_tower-state.md`),
    readOptional(`${ctDir}/_bug-tracker.md`),
    readOptional(`${ctDir}/_backlog.md`),
    readOptional(`${ctDir}/_tower-config.yaml`),
    globalConfigLayer(folder, opts.reloadGlobal === true),
  ])
  const projectLayer = configRead.kind === 'loaded' ? parseTowerConfigYaml(configRead.content).values : null
  let state: InboxStateLoad
  let lists: InboxFiles['lists'] = null
  if (stateRead.kind === 'loaded') {
    state = { status: 'loaded', parsed: parseTowerState(stateRead.content) }
    lists = parseTowerStateInbox(stateRead.content)
  }
  else if (stateRead.kind === 'error') state = { status: 'error', error: stateRead.error }
  else state = { status: 'missing' }
  if (bugRead.kind === 'error') readErrors.push('_bug-tracker.md')
  if (backlogRead.kind === 'error') readErrors.push('_backlog.md')

  // Status of each work order, deduplicated by id like the panel (a status-less report never hides it)
  const byId = new Map<string, WorkOrderStatus>()
  const waiting = new Map<string, string>()
  for (const file of entries) {
    if (file.isDirectory || !isWorkOrderFile(file.name)) continue
    const read = await readOptional(file.path)
    if (read.kind === 'error') { readErrors.push(file.name); continue }
    if (read.kind !== 'loaded') continue
    const order = parseWorkOrder(file.name, read.content)
    const known = byId.get(order.id)
    if (known === undefined || (known === 'UNKNOWN' && order.status !== 'UNKNOWN')) byId.set(order.id, order.status)
    // T0908: an open work order paused on a decision (`waiting_user`)
    if (order.waitingUser && workOrderPhase(order.status) !== 'closed') waiting.set(order.id, order.waitingUser)
  }

  return {
    hasCtDir: true,
    state,
    bugs: bugRead.kind === 'loaded' ? parseBugTracker(bugRead.content) : [],
    plans: backlogRead.kind === 'loaded' ? parseBacklog(backlogRead.content) : [],
    orderStatuses: [...byId.values()],
    readErrors,
    lists,
    waitingOrders: [...waiting].map(([orderId, userId]) => ({ orderId, userId })),
    userInbox: effectiveUserInbox(projectLayer, globalLayer),
  }
}

/** Keeps `inbox-store`'s copy of `folder` current: a load on mount and on each `_ct-workorders/` change. */
export function InboxDataSource({ folder }: { folder: string | null | undefined }) {
  useEffect(() => {
    if (!folder || !window.electronAPI?.fs) return
    const ctDir = `${folder}/_ct-workorders`
    let disposed = false
    let seq = 0
    let first = true
    const load = () => {
      const mine = ++seq
      const reloadGlobal = first
      first = false
      void loadInboxFiles(folder, { reloadGlobal }).then(next => {
        if (!disposed && mine === seq) setInboxFiles(folder, next)
      })
    }
    load()
    const release = acquireDirWatch(ctDir)
    const unsubscribe = window.electronAPI.fs.onChanged?.((changed: string) => {
      if (changed === ctDir) load()
    })
    return () => {
      disposed = true
      unsubscribe?.()
      release()
    }
  }, [folder])
  return null
}

/**
 * PLAN-068 W5 / T0908: keeps only `_tower-state.md` (its `bat_contract` and lists) of a workspace
 * that no window shows with `InboxDataSource` — the workspace list's `⏸N`. Mounted by App for the
 * other workspaces that have a declared Tower tab. Same pipeline (`fs:readFile`, the shared
 * `_ct-workorders/` watch); never throws; clears its copy on unmount.
 */
export function InboxStateSource({ folder }: { folder: string | null | undefined }) {
  useEffect(() => {
    if (!folder || !window.electronAPI?.fs) return
    const ctDir = `${folder}/_ct-workorders`
    let disposed = false
    let seq = 0
    const load = () => {
      const mine = ++seq
      void readOptional(`${ctDir}/_tower-state.md`).then(read => {
        if (disposed || mine !== seq) return
        if (read.kind !== 'loaded') {
          setInboxStateOnly(folder, { batContract: null, lists: null })
          return
        }
        setInboxStateOnly(folder, {
          batContract: towerStateBatContract(parseTowerState(read.content)),
          lists: parseTowerStateInbox(read.content),
        })
      })
    }
    load()
    const release = acquireDirWatch(ctDir)
    const unsubscribe = window.electronAPI.fs.onChanged?.((changed: string) => {
      if (changed === ctDir) load()
    })
    return () => {
      disposed = true
      unsubscribe?.()
      release()
      setInboxStateOnly(folder, null)
    }
  }, [folder])
  return null
}

const subscribeWorkspaces = (listener: () => void) => workspaceStore.subscribe(listener)
const workspaceState = () => workspaceStore.getState()

/**
 * T0908: one `InboxStateSource` per other workspace (not `activeFolder`, not in `excludeIds`: detached
 * ones report their own) that has a declared contract-2 Tower tab — so their rows can show `⏸N`
 * without reading every work order of every workspace.
 */
export function InboxStateSources({ activeFolder, excludeIds }: { activeFolder: string | null; excludeIds?: ReadonlySet<string> }) {
  const state = useSyncExternalStore(subscribeWorkspaces, workspaceState, workspaceState)
  useTowerContractVersion()
  const folders = new Set<string>()
  for (const terminal of state.terminals) {
    if (getTowerContract(terminal.id)?.status !== 'match') continue
    if (excludeIds?.has(terminal.workspaceId)) continue
    const folder = state.workspaces.find(ws => ws.id === terminal.workspaceId && !ws.archived)?.folderPath
    if (folder && folder !== activeFolder) folders.add(folder)
  }
  return <>{[...folders].map(folder => <InboxStateSource key={folder} folder={folder} />)}</>
}
