/**
 * PLAN-068 W4 / T0906: the right sidebar「待辦」(Inbox) tab — pure decisions, no IO, no React.
 *
 *   - version gate (T0902 §6′): a Tower tab's declaration (`--set-role tower --bat-contract`, W0) ×
 *     the project's `_tower-state.md` `bat_contract` → match / P-1 / P-2 / P-3 (`inboxVerdict`)
 *   - a Tower known only by its state file (Claude panel Tower, no declared tab):
 *     `stateFileContractStatus` — also for W3 / W5
 *   - the sections, their fixed order and default folding
 *   - the BAT data shown today elsewhere: pending-verify BUGs, counts, CT `todo`, tabs waiting for you
 *
 * 🔴 All of it is gated (D328 R9′, Tower answer T0906 Q-2): when the selected Tower does not match,
 * the tab shows only the Tower picker and the hint, and its title shows `!`. Then the Control Tower
 * overview keeps showing `todo` itself (R6 applies only on a match).
 *
 * No `electron` / DOM import here.
 */
import { BAT_CONTRACT_VERSION } from './tower-contract'
import { workOrderPhase } from './ct-tower-overview'
import { compareWaitingTabs, waitingForUser, type AttentionHookReason, type TerminalAttentionEvent } from './terminal-attention'
import type { BugEntry } from '../types/bug-tracker'
import type { BacklogEntry } from '../types/backlog'
import type { WorkOrderStatus } from '../types/control-tower'

// ─── Version gate (§6′) ────────────────────────────────────────────────────

/** A contract judged on one side only: `match`, older / missing (`ct-outdated`), newer (`bat-outdated`). */
export type StateFileContractStatus = 'match' | 'ct-outdated' | 'bat-outdated'

/**
 * The state of a Tower known only by its `_tower-state.md` (`bat_contract`; null = missing / v1): a
 * Claude panel Tower (no helper token, no `--set-role`), or a workspace without a declared Tower tab.
 */
export function stateFileContractStatus(batContract: number | null | undefined): StateFileContractStatus {
  if (typeof batContract !== 'number' || !Number.isFinite(batContract) || batContract < BAT_CONTRACT_VERSION) return 'ct-outdated'
  return batContract === BAT_CONTRACT_VERSION ? 'match' : 'bat-outdated'
}

// ─── Panel Tower (W6 / T0909 Q-1 A; W5 uses the same definition) ───────────

/** Claude Agent panel presets (the SDK panel; a codex panel is never a panel Tower). */
export const CLAUDE_PANEL_PRESETS: readonly string[] = ['claude-code', 'claude-code-worktree']

/**
 * T0909 Q-1 (Tower answer A): whether a workspace's Claude Agent panels are panel Towers — its
 * `_tower-state.md` `bat_contract` is `BAT_CONTRACT_VERSION` (`stateFileContractStatus` = match) **and**
 * it has no declared Tower tab (`--set-role tower`, any contract). A missing / unreadable / unread
 * state file (`stateContract` null / undefined) is not a match → false.
 */
export function workspaceHasPanelTowers(stateContract: number | null | undefined, declaredTowerCount: number): boolean {
  return declaredTowerCount === 0 && stateFileContractStatus(stateContract) === 'match'
}

/**
 * The panel Towers of one workspace (T0909 Q-1 A): every Claude Agent panel tab of it
 * (`CLAUDE_PANEL_PRESETS`) when `workspaceHasPanelTowers`, else none. Tab order.
 * The window calls `setPanelTower(id, true)` for these and `false` for its other Claude panels.
 */
export function panelTowerTerminalIds(
  terminals: readonly { id: string; agentPreset?: string | null }[],
  stateContract: number | null | undefined,
  declaredTowerCount: number,
): string[] {
  if (!workspaceHasPanelTowers(stateContract, declaredTowerCount)) return []
  return terminals.filter(t => typeof t.agentPreset === 'string' && CLAUDE_PANEL_PRESETS.includes(t.agentPreset)).map(t => t.id)
}

/** A declared Tower tab of the workspace (an entry of the tower-contract store). */
export interface InboxTower {
  id: string
  title: string
  /** What the tab declared with `--bat-contract` (null = nothing). */
  towerContract: number | null
}

/**
 * What the tab shows (§6′ table; `source` says which signal decided):
 * - `match`        — everything on
 * - `ct-outdated`  — P-1: the Tower declared nothing / an older contract (`tab`), or no declared Tower
 *                    and the state file is v1 (`state`)
 * - `bat-outdated` — P-2: the Tower (`tab`) or the state file (`state`, also under a v2 Tower) is newer
 * - `state-behind` — P-3: the Tower declared v2, the state file is still v1
 */
export type InboxVerdict =
  | { kind: 'match'; source: 'tab' | 'state' }
  | { kind: 'ct-outdated'; source: 'tab' | 'state' }
  | { kind: 'bat-outdated'; source: 'tab' | 'state'; requested: number }
  | { kind: 'state-behind' }

/** T0902 §6′「每個塔台分頁的判定」; `tower` null = the workspace has no declared Tower tab. */
export function inboxVerdict(tower: Pick<InboxTower, 'towerContract'> | null, stateContract: number | null | undefined): InboxVerdict {
  const state = stateFileContractStatus(stateContract)
  if (!tower) {
    if (state === 'match') return { kind: 'match', source: 'state' }
    if (state === 'bat-outdated') return { kind: 'bat-outdated', source: 'state', requested: stateContract as number }
    return { kind: 'ct-outdated', source: 'state' }
  }
  const declared = tower.towerContract
  if (typeof declared !== 'number' || !Number.isFinite(declared) || declared < BAT_CONTRACT_VERSION) return { kind: 'ct-outdated', source: 'tab' }
  if (declared > BAT_CONTRACT_VERSION) return { kind: 'bat-outdated', source: 'tab', requested: declared }
  if (state === 'match') return { kind: 'match', source: 'tab' }
  if (state === 'bat-outdated') return { kind: 'bat-outdated', source: 'state', requested: stateContract as number }
  return { kind: 'state-behind' }
}

/** The Tower the tab shows: the selected one while it is still declared, else the first. */
export function pickInboxTower<T extends { id: string }>(towers: readonly T[], selectedId: string | null | undefined): T | null {
  if (towers.length === 0) return null
  return towers.find(tower => tower.id === selectedId) ?? towers[0]
}

/**
 * Whether the tab has anything to judge: a declared Tower tab, or a `_ct-workorders/` folder
 * (`hasCtDir` null = still loading). A workspace with neither shows "no Control Tower here" and
 * no `!` on the title — it is not a version mismatch.
 */
export function inboxApplies(hasTower: boolean, hasCtDir: boolean | null): boolean {
  return hasTower || hasCtDir === true
}

/** The picker appears only with more than one declared Tower in the workspace (§1). */
export function showsTowerPicker(towers: readonly unknown[]): boolean {
  return towers.length > 1
}

/** i18n key and values of the hint of a non-matching verdict; null on a match. */
export function inboxGateHint(verdict: InboxVerdict): { key: string; values: Record<string, number> } | null {
  switch (verdict.kind) {
    case 'match':
      return null
    case 'ct-outdated':
      return verdict.source === 'tab'
        ? { key: 'towerContract.ctOutdated', values: { supported: BAT_CONTRACT_VERSION } }
        : { key: 'inbox.gate.stateV1', values: { supported: BAT_CONTRACT_VERSION } }
    case 'bat-outdated':
      return { key: 'towerContract.batOutdated', values: { supported: BAT_CONTRACT_VERSION, requested: verdict.requested } }
    case 'state-behind':
      return { key: 'inbox.gate.stateBehind', values: { supported: BAT_CONTRACT_VERSION } }
  }
}

/** Short code of the hint (P-1 / P-2 / P-3), shown and used as a test hook. */
export function inboxGateCode(verdict: InboxVerdict): 'P-1' | 'P-2' | 'P-3' | null {
  switch (verdict.kind) {
    case 'ct-outdated': return 'P-1'
    case 'bat-outdated': return 'P-2'
    case 'state-behind': return 'P-3'
    default: return null
  }
}

// ─── Sections (§1) ──────────────────────────────────────────────────────────

/** Fixed order: from "blocks the flow, needs you" to "reference". */
export const INBOX_SECTIONS = ['decide', 'act', 'remind', 'workers', 'messages', 'todo', 'counts'] as const
export type InboxSectionId = typeof INBOX_SECTIONS[number]

/** Folded until the user opens them (§1: CT `todo` is folded by default). */
export const INBOX_SECTIONS_FOLDED_BY_DEFAULT: ReadonlySet<InboxSectionId> = new Set<InboxSectionId>(['todo'])

/** localStorage key of the folded sections (a per-viewer preference). */
export const INBOX_FOLDED_STORAGE_KEY = 'bat-inbox-folded-sections'

/** Folded state per section from the stored JSON; anything unreadable → the defaults. */
export function parseFoldedSections(raw: string | null | undefined): Record<InboxSectionId, boolean> {
  const folded = Object.fromEntries(INBOX_SECTIONS.map(id => [id, INBOX_SECTIONS_FOLDED_BY_DEFAULT.has(id)])) as Record<InboxSectionId, boolean>
  if (!raw) return folded
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return folded
    for (const id of INBOX_SECTIONS) {
      const value = (parsed as Record<string, unknown>)[id]
      if (typeof value === 'boolean') folded[id] = value
    }
  } catch { /* the defaults */ }
  return folded
}

// ─── BAT data ───────────────────────────────────────────────────────────────

/** BUGs waiting for acceptance (`_bug-tracker.md` ✅ 已修復 / 🧪 驗收中), file order, archived ones left out. */
export function pendingVerifyBugs(bugs: readonly BugEntry[]): BugEntry[] {
  return bugs.filter(bug => !bug.isArchived && (bug.status === 'FIXED' || bug.status === 'VERIFY'))
}

export interface InboxCounts {
  /** BUG `OPEN` / `FIXING` */
  openBugs: number
  /** PLAN `IN_PROGRESS` */
  plansInProgress: number
  /** Work orders not in a final state (`workOrderPhase` = open) */
  openOrders: number
}

export function inboxCounts(bugs: readonly BugEntry[], plans: readonly BacklogEntry[], orderStatuses: readonly WorkOrderStatus[]): InboxCounts {
  return {
    openBugs: bugs.filter(bug => !bug.isArchived && (bug.status === 'OPEN' || bug.status === 'FIXING')).length,
    plansInProgress: plans.filter(plan => !plan.isArchived && plan.status === 'IN_PROGRESS').length,
    openOrders: orderStatuses.filter(status => workOrderPhase(status) === 'open').length,
  }
}

/** A `todo` item longer than this is folded to its first `TODO_FOLD_CHARS` characters. */
export const TODO_FOLD_CHARS = 160

export function foldTodo(text: string): { short: string; folded: boolean } {
  const firstLine = text.split(/\r?\n/)[0]
  if (firstLine.length <= TODO_FOLD_CHARS && firstLine.length === text.length) return { short: text, folded: false }
  return { short: `${firstLine.slice(0, TODO_FOLD_CHARS)}…`, folded: true }
}

/**
 * One tab of the workspace that waits for you (§3「Worker 等你」: the existing stores only):
 * ⚠️ waits for the user (`waitingForUser`), 📨 holds notifications (T0788), ⏸ interrupted (T0766).
 * `?` / `✓` / `↻` are the Tower's business and are not listed.
 */
export type WorkerWaitItem =
  | { kind: 'waiting'; terminalId: string; title: string; reason: AttentionHookReason; since: number | null }
  | { kind: 'held'; terminalId: string; title: string; count: number; since: number | null }
  | { kind: 'interrupted'; terminalId: string; title: string; agent: string; at: number }

export interface WorkerWaitDeps {
  getAttention: (id: string) => TerminalAttentionEvent | null | undefined
  /** Held notifications of the tab: how many, and the oldest `heldAt`. */
  getHeld: (id: string) => { count: number; since: number | null }
  getInterrupted: (id: string) => { agent: string; at: number } | null
}

/** ⚠️ first (longest waiting first), then 📨, then ⏸; tab order within each kind. */
export function workerWaitItems(terminals: readonly { id: string; title: string }[], deps: WorkerWaitDeps): WorkerWaitItem[] {
  const waiting: Extract<WorkerWaitItem, { kind: 'waiting' }>[] = []
  const held: WorkerWaitItem[] = []
  const interrupted: WorkerWaitItem[] = []
  for (const tab of terminals) {
    const state = waitingForUser(deps.getAttention(tab.id))
    if (state) waiting.push({ kind: 'waiting', terminalId: tab.id, title: tab.title, ...state })
    const hold = deps.getHeld(tab.id)
    if (hold.count > 0) held.push({ kind: 'held', terminalId: tab.id, title: tab.title, count: hold.count, since: hold.since })
    const agent = deps.getInterrupted(tab.id)
    if (agent) interrupted.push({ kind: 'interrupted', terminalId: tab.id, title: tab.title, agent: agent.agent, at: agent.at })
  }
  waiting.sort(compareWaitingTabs)
  return [...waiting, ...held, ...interrupted]
}

/**
 * The number on the tab title: things that need your hands. W4 counts Worker waits and BUGs to
 * accept; W5 (T0908) adds the CT lists (待你決定 / 待你執行 / 到期提醒). Turn cards never count (§1).
 */
export function inboxActionCount(parts: { workerItems: number; pendingBugs: number; awaiting?: number; actions?: number; reminders?: number }): number {
  return parts.workerItems + parts.pendingBugs + (parts.awaiting ?? 0) + (parts.actions ?? 0) + (parts.reminders ?? 0)
}

// ─── W5 / T0908: panel Towers, answer targets, recently closed ─────────────

/** Where an answer line can go: a contract-2 Tower tab (PTY) or a panel Tower (Claude Agent panel). */
export interface InboxAnswerTarget {
  kind: 'tab' | 'panel'
  id: string
  title: string
}

/**
 * The answer targets of a workspace (§2.4, T0908 addenda #1 / #2): with declared Tower tabs, only
 * those that declared contract 2 (never a panel); without any, the panel Towers (`panels` = the
 * workspace's tabs filtered by `CLAUDE_PANEL_PRESETS`; `workspaceHasPanelTowers`, T0909). `auto` = the one target
 * when there is exactly one (sent directly); otherwise the user picks (none → nothing to send to).
 */
export function inboxAnswerTargets(
  towers: readonly InboxTower[],
  panels: readonly { id: string; title: string }[],
  stateBatContract: number | null | undefined,
): { targets: InboxAnswerTarget[]; auto: InboxAnswerTarget | null } {
  const targets: InboxAnswerTarget[] = towers.length > 0
    ? towers.filter(tower => tower.towerContract === BAT_CONTRACT_VERSION).map(tower => ({ kind: 'tab' as const, id: tower.id, title: tower.title }))
    : workspaceHasPanelTowers(stateBatContract, 0) ? panels.map(panel => ({ kind: 'panel' as const, id: panel.id, title: panel.title })) : []
  return { targets, auto: targets.length === 1 ? targets[0] : null }
}

/** One item that left `awaiting_user` / `user_actions` (§2.1「最近已結」; memory only). */
export interface RecentlyClosed {
  id: string
  /** Its last `summary` / `title`. */
  text: string
  closedAt: number
}

export const RECENTLY_CLOSED_MAX = 10

/**
 * The recently closed list after a reload: items of `before` missing from `after` go first (newest
 * first), at most `RECENTLY_CLOSED_MAX`. An id that comes back is taken off. Returns `prev` itself
 * when nothing changed.
 */
export function nextRecentlyClosed(
  prev: readonly RecentlyClosed[],
  before: { awaiting: readonly { id: string; summary: string }[]; actions: readonly { id: string; title: string }[] },
  after: { awaiting: readonly { id: string }[]; actions: readonly { id: string }[] },
  now: number,
): RecentlyClosed[] {
  const open = new Set([...after.awaiting.map(item => item.id), ...after.actions.map(item => item.id)])
  const gone: RecentlyClosed[] = [
    ...before.awaiting.filter(item => !open.has(item.id)).map(item => ({ id: item.id, text: item.summary, closedAt: now })),
    ...before.actions.filter(item => !open.has(item.id)).map(item => ({ id: item.id, text: item.title, closedAt: now })),
  ]
  const kept = prev.filter(item => !open.has(item.id) && !gone.some(g => g.id === item.id))
  if (gone.length === 0 && kept.length === prev.length) return prev as RecentlyClosed[]
  return [...gone, ...kept].slice(0, RECENTLY_CLOSED_MAX)
}

/** Text after the tab name: `!` when the selected Tower does not match, the count when > 0, else none. */
export function inboxTabBadge(verdict: InboxVerdict, count: number): string | null {
  if (verdict.kind !== 'match') return '!'
  return count > 0 ? String(count) : null
}
