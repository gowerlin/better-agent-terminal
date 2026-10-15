/**
 * T0553: the default title of a tab a helper created (`terminal:created-externally` →
 * `workspaceStore.addExternalTerminal`).
 *
 *   - Worker (Tower ownership: `towerTerminalId` + `workorder`): `<agent> · Worker · <workorder>`,
 *     e.g. `Claude CLI · Worker · T0551`
 *   - otherwise: `<agent>`, or the command's file name (no path, no quotes), or `Terminal`
 *
 * `<agent>` is the agent preset's name (the one Settings lists), then the name main's agent
 * registry sent (custom CLIs), then a known CLI recognized from the command's file name.
 *
 * Before T0553 the title was `Remote: <first word of the command>` for every such tab — local
 * ones too, and for agent commands the full quoted path of the CLI. `legacyExternalCommand`
 * recognizes that title, so a restored tab gets the new one (a title the user typed is kept).
 */
import { getAgentPreset } from '../types/agent-presets'

export const WORKER_ROLE_LABEL = 'Worker'
export const EXTERNAL_TERMINAL_FALLBACK_TITLE = 'Terminal'
const SEPARATOR = ' · '

/** Windows executable suffixes dropped from a command's file name (`claude.exe` → `claude`). */
const EXECUTABLE_SUFFIX = /\.(exe|cmd|bat|com|ps1)$/i

/** A CLI's file name → its terminal-driven agent preset. */
const KNOWN_AGENT_COMMANDS: Record<string, string> = {
  claude: 'claude-cli',
  codex: 'codex-cli',
  gemini: 'gemini-cli',
  copilot: 'copilot-cli',
}

/** The first word of a shell command line, unquoted (`& '<path>'` from pwsh included). */
function firstWord(command: string): { word: string; rest: string } {
  let s = command.trim()
  if (s.startsWith('& ')) s = s.slice(2).trimStart()
  const quote = s[0]
  if (quote === '"' || quote === "'") {
    const end = s.indexOf(quote, 1)
    if (end > 0) return { word: s.slice(1, end), rest: s.slice(end + 1) }
    return { word: s.slice(1), rest: '' }
  }
  const match = /^(\S*)(.*)$/s.exec(s)
  return { word: match?.[1] ?? '', rest: match?.[2] ?? '' }
}

/** The command's file name: no path, no quotes, no Windows executable suffix (`node`, `claude`). */
export function commandFileName(command?: string): string {
  if (!command) return ''
  const { word } = firstWord(command)
  const base = word.split(/[\\/]/).pop() ?? ''
  return base.replace(EXECUTABLE_SUFFIX, '')
}

/** The terminal-driven agent preset a command launches, when its file name is a known CLI. */
export function agentFromCommand(command?: string): string | undefined {
  if (!command) return undefined
  const name = commandFileName(command).toLowerCase()
  if (name === 'gh' && /^\s+copilot(\s|$)/.test(firstWord(command).rest)) return 'copilot-cli'
  return KNOWN_AGENT_COMMANDS[name]
}

export interface ExternalTerminalTitleInput {
  /** Agent preset id main resolved (`terminal:create-agent-command`). */
  agent?: string
  /** That agent's name in main's registry (custom CLIs are not renderer presets). */
  agentName?: string
  command?: string
  towerTerminalId?: string
  workorder?: string
}

/** The agent name a title shows, or '' when the tab runs no recognizable agent. */
function agentLabel(input: ExternalTerminalTitleInput): string {
  const explicit = input.agent && input.agent !== 'none' ? getAgentPreset(input.agent)?.name : undefined
  if (explicit) return explicit
  if (input.agentName?.trim()) return input.agentName.trim()
  const fromCommand = agentFromCommand(input.command)
  return fromCommand ? (getAgentPreset(fromCommand)?.name ?? '') : ''
}

export function externalTerminalTitle(input: ExternalTerminalTitleInput): string {
  const name = agentLabel(input)
    || commandFileName(input.command)
    || (input.agent && input.agent !== 'none' ? input.agent : '')
    || EXTERNAL_TERMINAL_FALLBACK_TITLE
  if (input.towerTerminalId && input.workorder) return [name, WORKER_ROLE_LABEL, input.workorder].join(SEPARATOR)
  return name
}

/**
 * The command a pre-T0553 default title kept (`Remote: <first word>` → that word,
 * `Remote Terminal` → ''), or null when `title` is not such a title (a user's name, a new title).
 * The old title cut the command at the first space: a quoted path with a space (`'C:\Program`)
 * or pwsh's `&` is no file name, so those give '' as well.
 */
export function legacyExternalCommand(title: string | undefined): string | null {
  if (title === 'Remote Terminal') return ''
  const match = /^Remote: (.+)$/s.exec(title ?? '')
  if (!match) return null
  const word = match[1]
  if (word === '&') return ''
  const quote = word[0]
  if ((quote === '"' || quote === "'") && word.indexOf(quote, 1) < 0) return ''
  return word
}

/**
 * Whether the thumbnail's work order badge is needed: a Worker tab whose title does not show its
 * work order (a name the user gave it). The default title already ends with it.
 */
export function titleShowsWorkorder(title: string, workorder: string): boolean {
  return title.includes(workorder)
}
