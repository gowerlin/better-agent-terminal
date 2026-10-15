/**
 * T0553: default titles of helper-created tabs (`externalTerminalTitle`) and the pre-T0553
 * `Remote: …` title they replace (`legacyExternalCommand`).
 */
import { describe, expect, it } from 'vitest'
import { agentFromCommand, commandFileName, externalTerminalTitle, legacyExternalCommand, titleShowsWorkorder } from '../external-terminal-title'

const worker = { towerTerminalId: 'tower-1', workorder: 'T0551' }

describe('externalTerminalTitle — Worker tabs', () => {
  it('claude: <agent> · Worker · <workorder>', () => {
    expect(externalTerminalTitle({ agent: 'claude-cli', command: "'C:\\Users\\me\\.local\\bin\\claude.exe' '/ct-exec T0551'", ...worker }))
      .toBe('Claude CLI · Worker · T0551')
  })

  it('codex (preset name as Settings lists it)', () => {
    expect(externalTerminalTitle({ agent: 'codex-cli', command: "codex '$ct-exec T0551'", ...worker })).toBe('Codex CLI · Worker · T0551')
  })

  it('the preset name wins over the registry name (copilot)', () => {
    expect(externalTerminalTitle({ agent: 'copilot-cli', agentName: 'GitHub Copilot CLI', command: 'copilot', ...worker })).toBe('GitHub Copilot · Worker · T0551')
  })

  it('an agent the renderer does not know: the registry name main sent (custom CLI)', () => {
    expect(externalTerminalTitle({ agent: 'my-cli', agentName: 'My CLI', command: 'node /x/agent.mjs', ...worker })).toBe('My CLI · Worker · T0551')
  })

  it('an unknown agent without a name: the command file name, then the agent id', () => {
    expect(externalTerminalTitle({ agent: 'my-cli', command: '"C:\\Tools\\my agent\\run.cmd" go', ...worker })).toBe('run · Worker · T0551')
    expect(externalTerminalTitle({ agent: 'my-cli', ...worker })).toBe('my-cli · Worker · T0551')
  })

  it('no agent id: a known CLI recognized from the command (pwsh call operator included)', () => {
    expect(externalTerminalTitle({ command: "& 'C:\\Program Files\\BetterAgentTerminal\\claude.exe' '/ct-exec T0551'", ...worker })).toBe('Claude CLI · Worker · T0551')
  })

  it('a workorder without a Tower is not a Worker', () => {
    expect(externalTerminalTitle({ agent: 'claude-cli', workorder: 'T0551' })).toBe('Claude CLI')
  })
})

describe('externalTerminalTitle — other helper-created tabs', () => {
  it('a known agent: its name, no "Remote:"', () => {
    expect(externalTerminalTitle({ command: 'claude "/ct-exec T0551"' })).toBe('Claude CLI')
    expect(externalTerminalTitle({ command: 'gemini' })).toBe('Gemini CLI')
    expect(externalTerminalTitle({ command: 'gh copilot suggest' })).toBe('GitHub Copilot')
  })

  it('another command: its file name without path, quotes or .exe', () => {
    expect(externalTerminalTitle({ command: 'node scripts/x.mjs --flag' })).toBe('node')
    expect(externalTerminalTitle({ command: "'/usr/local/bin/node' x.mjs" })).toBe('node')
    expect(externalTerminalTitle({ command: '"C:\\Program Files\\nodejs\\node.exe" x.mjs' })).toBe('node')
    expect(externalTerminalTitle({ command: 'gh pr list' })).toBe('gh')
  })

  it('no command: Terminal', () => {
    expect(externalTerminalTitle({})).toBe('Terminal')
    expect(externalTerminalTitle({ command: '   ' })).toBe('Terminal')
  })

  it('agent "none" is no agent', () => {
    expect(externalTerminalTitle({ agent: 'none', command: 'node x' })).toBe('node')
  })
})

describe('helpers', () => {
  it('commandFileName / agentFromCommand', () => {
    expect(commandFileName("'C:\\Users\\me\\.local\\bin\\claude.exe'")).toBe('claude')
    expect(commandFileName(undefined)).toBe('')
    expect(agentFromCommand('CODEX.EXE resume')).toBe('codex-cli')
    expect(agentFromCommand('node x')).toBeUndefined()
  })

  it('legacyExternalCommand: the old default titles only', () => {
    expect(legacyExternalCommand("Remote: 'C:\\Users\\me\\.local\\bin\\claude.exe'")).toBe("'C:\\Users\\me\\.local\\bin\\claude.exe'")
    expect(legacyExternalCommand('Remote: node')).toBe('node')
    expect(legacyExternalCommand('Remote Terminal')).toBe('')
    // the old title cut the command at the first space
    expect(legacyExternalCommand("Remote: 'C:\\Program")).toBe('')
    expect(legacyExternalCommand('Remote: &')).toBe('')
    expect(legacyExternalCommand('My worker')).toBeNull()
    expect(legacyExternalCommand('Claude CLI · Worker · T0551')).toBeNull()
    expect(legacyExternalCommand(undefined)).toBeNull()
  })

  it('titleShowsWorkorder', () => {
    expect(titleShowsWorkorder('Claude CLI · Worker · T0551', 'T0551')).toBe(true)
    expect(titleShowsWorkorder('fix login', 'T0551')).toBe(false)
  })
})
