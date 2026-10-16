/**
 * T0562 / D147: the title of a tab that declared itself a Tower (`bat-terminal.mjs --set-role
 * tower` → main `terminal:role-changed`), and whether a tab's title is still one BAT gave it.
 *
 *   - Tower title: `<agent> · Tower` (e.g. `Claude CLI · Tower`, like T0553's
 *     `Claude CLI · Worker · T0551`). `<agent>`: the tab's agent preset, then the agent the PTY
 *     was created with, then the caller's `--agent` hint — each as the renderer preset's name,
 *     else the registry name main sent; none → `Terminal` (`Terminal · Tower`).
 *   - The user's name wins: the Tower title replaces only a title BAT generated
 *     (`isDefaultTerminalTitle`) or an earlier Tower title (recomputed, e.g. another agent).
 *
 * Titles BAT generates (each recognized by `isDefaultTerminalTitle`):
 *   - `workspaceStore.addTerminal`: the agent preset's name, or `New Terminal`
 *   - `workspaceStore.switchTerminalApiVersion`: `Claude Agent V1` / `Claude Agent V2` (preset names)
 *   - `WorkspaceView.handleAddAgent`: a custom CLI's registry name (`workspaceStore.setAutoTitle`)
 *   - `useRemoteToolInstall`: the remote tool install tab's title (`setAutoTitle`)
 *   - `externalTerminalTitle` (T0553, helper-created tabs): agent name / registry name / known CLI
 *     name, the command's file name or agent id (kept as the tab's `autoTitle`), `Terminal`,
 *     `<agent> · Worker · <workorder>`
 *   - the pre-T0553 helper title `Remote: <word>` / `Remote Terminal` (`legacyExternalCommand`)
 *   - a restored tab without a title: `Terminal`
 */
import { AGENT_PRESETS, getAgentPreset } from '../types/agent-presets'
import { EXTERNAL_TERMINAL_FALLBACK_TITLE, WORKER_ROLE_LABEL, legacyExternalCommand } from './external-terminal-title'

export const TOWER_ROLE_LABEL = 'Tower'
/** `workspaceStore.addTerminal` without an agent preset. */
export const NEW_TERMINAL_TITLE = 'New Terminal'
const SEPARATOR = ' · '

/** `terminal:role-changed` payload (electron/terminal-role.ts `TerminalRoleChange`). */
export interface TerminalRoleChangeInfo {
  id: string
  role: 'tower'
  /** The agent preset the PTY was created with. */
  ptyAgent?: string
  /** That agent's registry name (custom CLIs). */
  ptyAgentName?: string
  /** The caller's `--agent` hint (a registry id). */
  agent?: string
  agentName?: string
}

export interface TowerTitleInput {
  /** The tab's own agent preset (renderer). */
  agentPreset?: string
  ptyAgent?: string
  ptyAgentName?: string
  agent?: string
  agentName?: string
}

function presetLabel(id: string | undefined, registryName: string | undefined): string {
  if (!id || id === 'none') return ''
  return getAgentPreset(id)?.name || registryName?.trim() || ''
}

/** The agent name a Tower title shows (see the file comment for the order). */
export function towerAgentLabel(input: TowerTitleInput): string {
  return presetLabel(input.agentPreset, input.agentPreset === input.ptyAgent ? input.ptyAgentName : undefined)
    || presetLabel(input.ptyAgent, input.ptyAgentName)
    || presetLabel(input.agent, input.agentName)
    || EXTERNAL_TERMINAL_FALLBACK_TITLE
}

export function towerTerminalTitle(input: TowerTitleInput): string {
  return [towerAgentLabel(input), TOWER_ROLE_LABEL].join(SEPARATOR)
}

/** A Tower title (`<agent> · Tower`), which a later `--set-role tower` may recompute. */
export function isTowerTitle(title: string): boolean {
  return title.endsWith(`${SEPARATOR}${TOWER_ROLE_LABEL}`) && title.length > SEPARATOR.length + TOWER_ROLE_LABEL.length
}

// `<agent> · Worker · <workorder>` (externalTerminalTitle); work order grammar as `--workorder`.
const WORKER_TITLE = new RegExp(`^.+${SEPARATOR}${WORKER_ROLE_LABEL}${SEPARATOR}(?:[A-Z]{2,4}-)?T\\d+$`)

export interface DefaultTitleContext {
  /** The title BAT generated for this tab when the rules below cannot recognize it (`TerminalInstance.autoTitle`). */
  autoTitle?: string
  /** Agent registry names main sent with the event (custom CLIs are not renderer presets). */
  agentNames?: readonly (string | undefined)[]
}

/**
 * Whether `title` is a title BAT gave the tab (see the file comment) rather than one the user
 * typed. A Tower title counts too, so it can be recomputed.
 */
export function isDefaultTerminalTitle(title: string | undefined, ctx: DefaultTitleContext = {}): boolean {
  const value = (title ?? '').trim()
  if (!value) return true
  if (value === NEW_TERMINAL_TITLE || value === EXTERNAL_TERMINAL_FALLBACK_TITLE) return true
  if (AGENT_PRESETS.some(p => p.name === value)) return true
  if (ctx.autoTitle && ctx.autoTitle === title) return true
  if (ctx.agentNames?.some(name => !!name && name.trim() === value)) return true
  if (legacyExternalCommand(title) !== null) return true
  if (WORKER_TITLE.test(value)) return true
  return isTowerTitle(value)
}
