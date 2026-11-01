/**
 * T0718 / D123 Phase 2: agent presets BAT no longer ships, and what saved data that names
 * them becomes.
 *
 * `claude-code-v2` ("Claude Agent V2") ran on the SDK's V2 session API, which
 * `@anthropic-ai/claude-agent-sdk` 0.3 removed. D123 retired the preset instead of rewriting it
 * as a `query()` wrapper; everything that still names it — a tab's `agentPreset`, a workspace or
 * Settings `defaultAgent`, an `agentCustomArgs` key (workspace and Settings), a helper
 * `--agent` — now means `claude-code` ("Claude Agent"), so nothing errors and no tab is lost.
 *
 * T0722 / D194: with one SDK panel left, `claude-code` / `claude-code-worktree` dropped the "V1"
 * from their names ("Claude Agent V1" → "Claude Agent"). The old default titles are retired
 * titles too (`RETIRED_AGENT_PRESET_TITLES`): a saved tab still showing one gets the current
 * name, whatever its preset, and `isDefaultTerminalTitle` keeps recognizing them.
 *
 * Single place for that mapping. Pure: no electron / DOM imports (renderer, main and headless
 * bat-server share it). Every function returns its input unchanged (same reference) when there
 * is nothing to migrate, so callers can tell "changed" with `!==`.
 *
 * `agentCustomArgs` rule: when the replacement preset already has its own entry, that entry
 * wins and the retired preset's entry is dropped; otherwise the retired entry moves to the
 * replacement key. "Its own entry" follows each layer's lookup rule in `agent-launch-settings`:
 *   - workspace layer: the key is there with a string value — an empty string included
 *     (an empty override means "no custom args in this workspace", D142)
 *   - Settings layer: a non-empty string (Settings never stores an empty entry; an empty one
 *     is ignored by the lookup anyway)
 */

/** Retired preset id → the preset that replaces it. */
export const RETIRED_AGENT_PRESETS: Readonly<Record<string, string>> = Object.freeze({
  'claude-code-v2': 'claude-code',
})

/**
 * Default tab titles BAT no longer generates → the title BAT generates today: the retired
 * preset's name (T0718) and the names before T0722 dropped "V1". Only these exact
 * BAT-generated titles move; a title the user typed is kept.
 */
export const RETIRED_AGENT_PRESET_TITLES: Readonly<Record<string, string>> = Object.freeze({
  'Claude Agent V2': 'Claude Agent',
  'Claude Agent V1': 'Claude Agent',
  'Claude Agent V1 (Worktree)': 'Claude Agent (Worktree)',
})

/** True when `title` is a default title BAT no longer generates (T0718 / T0722). */
export function isRetiredPresetTitle(title: unknown): boolean {
  return typeof title === 'string' && Object.prototype.hasOwnProperty.call(RETIRED_AGENT_PRESET_TITLES, title)
}

export type AgentCustomArgsLayer = 'workspace' | 'settings'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** True when `id` is a preset BAT no longer ships. */
export function isRetiredAgentPreset(id: unknown): boolean {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(RETIRED_AGENT_PRESETS, id)
}

/** The preset a saved id means today: the replacement of a retired id, anything else as is. */
export function migrateAgentPresetId<T>(id: T): T | string {
  return isRetiredAgentPreset(id) ? RETIRED_AGENT_PRESETS[id as unknown as string] : id
}

function hasOwnArgs(record: Record<string, unknown>, key: string, layer: AgentCustomArgsLayer): boolean {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return false
  const value = record[key]
  if (typeof value !== 'string') return false
  return layer === 'workspace' ? true : value.trim().length > 0
}

/**
 * An `agentCustomArgs` record without retired keys (see the module comment for which entry
 * wins). Non-record values come back unchanged; so does a record without retired keys.
 */
export function migrateAgentCustomArgs<T>(record: T, layer: AgentCustomArgsLayer): T {
  if (!isRecord(record)) return record
  const retired = Object.keys(record).filter(isRetiredAgentPreset)
  if (retired.length === 0) return record
  const next: Record<string, unknown> = { ...record }
  for (const key of retired) {
    const replacement = RETIRED_AGENT_PRESETS[key]
    const value = next[key]
    delete next[key]
    if (!hasOwnArgs(next, replacement, layer) && hasOwnArgs({ [key]: value }, key, layer)) {
      next[replacement] = value
    }
  }
  return next as T
}

/** A saved tab title: a retired preset's default title becomes the replacement's. */
export function migrateRetiredPresetTitle<T>(title: T): T | string {
  return isRetiredPresetTitle(title) ? RETIRED_AGENT_PRESET_TITLES[title as unknown as string] : title
}

interface SavedAgentFields {
  defaultAgent?: unknown
  agentCustomArgs?: unknown
}

function migrateAgentFields<T extends SavedAgentFields>(saved: T, layer: AgentCustomArgsLayer): T {
  if (!isRecord(saved)) return saved
  const defaultAgent = migrateAgentPresetId(saved.defaultAgent)
  const agentCustomArgs = migrateAgentCustomArgs(saved.agentCustomArgs, layer)
  if (defaultAgent === saved.defaultAgent && agentCustomArgs === saved.agentCustomArgs) return saved
  const next: T = { ...saved }
  if (defaultAgent !== saved.defaultAgent) next.defaultAgent = defaultAgent
  if (agentCustomArgs !== saved.agentCustomArgs) next.agentCustomArgs = agentCustomArgs
  return next
}

/** A saved workspace (window-registry entry): `defaultAgent` and its `agentCustomArgs` overrides. */
export function migrateWorkspaceAgentFields<T extends SavedAgentFields>(workspace: T): T {
  return migrateAgentFields(workspace, 'workspace')
}

/** Saved Settings (Electron `<userData>/settings.json` or headless `<dataDir>/settings.json`). */
export function migrateSettingsAgentFields<T extends SavedAgentFields>(settings: T): T {
  return migrateAgentFields(settings, 'settings')
}

interface SavedTerminalFields {
  agentPreset?: unknown
  title?: unknown
  autoTitle?: unknown
}

/**
 * A saved tab: a retired `agentPreset` becomes its replacement (T0718), and a retired default
 * title in `title` / `autoTitle` becomes the current one (T0718 / T0722; any preset, since the
 * title alone says BAT generated it). Every other field — a typed title, `sdkSessionId`,
 * `model` — is kept. Nothing to migrate → the same reference.
 */
export function migrateTerminalAgentPreset<T extends SavedTerminalFields>(terminal: T): T {
  if (!isRecord(terminal)) return terminal
  const agentPreset = migrateAgentPresetId(terminal.agentPreset)
  const title = migrateRetiredPresetTitle(terminal.title)
  const autoTitle = migrateRetiredPresetTitle(terminal.autoTitle)
  if (agentPreset === terminal.agentPreset && title === terminal.title && autoTitle === terminal.autoTitle) return terminal
  const next: T = { ...terminal }
  if (agentPreset !== terminal.agentPreset) next.agentPreset = agentPreset
  if (title !== terminal.title) next.title = title
  if (autoTitle !== terminal.autoTitle) next.autoTitle = autoTitle
  return next
}
