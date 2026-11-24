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
import { useEffect } from 'react'
import { acquireDirWatch } from '../../stores/ct-dir-watch'
import { setInboxFiles, type InboxFiles, type InboxStateLoad } from '../../stores/inbox-store'
import { parseTowerState } from '../../lib/ct-tower-overview'
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

/** One full read of the folder's CT files. Never throws. */
export async function loadInboxFiles(folder: string): Promise<InboxFiles> {
  const ctDir = `${folder}/_ct-workorders`
  let entries: Array<{ name: string; path: string; isDirectory: boolean }>
  try {
    entries = await window.electronAPI.fs.readdir(ctDir)
  } catch {
    return { hasCtDir: false, state: null, bugs: [], plans: [], orderStatuses: [], readErrors: [] }
  }
  if (!Array.isArray(entries)) entries = []
  const readErrors: string[] = []

  const [stateRead, bugRead, backlogRead] = await Promise.all([
    readOptional(`${ctDir}/_tower-state.md`),
    readOptional(`${ctDir}/_bug-tracker.md`),
    readOptional(`${ctDir}/_backlog.md`),
  ])
  let state: InboxStateLoad
  if (stateRead.kind === 'loaded') state = { status: 'loaded', parsed: parseTowerState(stateRead.content) }
  else if (stateRead.kind === 'error') state = { status: 'error', error: stateRead.error }
  else state = { status: 'missing' }
  if (bugRead.kind === 'error') readErrors.push('_bug-tracker.md')
  if (backlogRead.kind === 'error') readErrors.push('_backlog.md')

  // Status of each work order, deduplicated by id like the panel (a status-less report never hides it)
  const byId = new Map<string, WorkOrderStatus>()
  for (const file of entries) {
    if (file.isDirectory || !isWorkOrderFile(file.name)) continue
    const read = await readOptional(file.path)
    if (read.kind === 'error') { readErrors.push(file.name); continue }
    if (read.kind !== 'loaded') continue
    const order = parseWorkOrder(file.name, read.content)
    const known = byId.get(order.id)
    if (known === undefined || (known === 'UNKNOWN' && order.status !== 'UNKNOWN')) byId.set(order.id, order.status)
  }

  return {
    hasCtDir: true,
    state,
    bugs: bugRead.kind === 'loaded' ? parseBugTracker(bugRead.content) : [],
    plans: backlogRead.kind === 'loaded' ? parseBacklog(backlogRead.content) : [],
    orderStatuses: [...byId.values()],
    readErrors,
  }
}

/** Keeps `inbox-store`'s copy of `folder` current: a load on mount and on each `_ct-workorders/` change. */
export function InboxDataSource({ folder }: { folder: string | null | undefined }) {
  useEffect(() => {
    if (!folder || !window.electronAPI?.fs) return
    const ctDir = `${folder}/_ct-workorders`
    let disposed = false
    let seq = 0
    const load = () => {
      const mine = ++seq
      void loadInboxFiles(folder).then(next => {
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
