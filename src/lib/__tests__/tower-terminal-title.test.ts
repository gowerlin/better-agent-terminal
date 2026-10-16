/**
 * T0562 / D147: the Tower tab title (`<agent> · Tower`) and which titles BAT generated
 * (`isDefaultTerminalTitle`) — every default title BAT gives a tab, the user's names, Tower titles.
 */
import { describe, expect, it } from 'vitest'
import { AGENT_PRESETS } from '../../types/agent-presets'
import { externalTerminalTitle } from '../external-terminal-title'
import { NEW_TERMINAL_TITLE, isDefaultTerminalTitle, isTowerTitle, towerAgentLabel, towerTerminalTitle } from '../tower-terminal-title'

describe('towerTerminalTitle (T0562)', () => {
  it('<agent> · Tower from the tab agent preset', () => {
    expect(towerTerminalTitle({ agentPreset: 'claude-cli' })).toBe('Claude CLI · Tower')
    expect(towerTerminalTitle({ agentPreset: 'codex-cli' })).toBe('Codex CLI · Tower')
    expect(towerTerminalTitle({ agentPreset: 'gemini-cli' })).toBe('Gemini CLI · Tower')
  })

  it('the tab agent preset wins over the PTY agent and the --agent hint', () => {
    expect(towerTerminalTitle({ agentPreset: 'claude-cli', ptyAgent: 'codex-cli', agent: 'gemini-cli' })).toBe('Claude CLI · Tower')
  })

  it('no tab preset → the PTY agent, then the --agent hint', () => {
    expect(towerTerminalTitle({ ptyAgent: 'codex-cli', agent: 'claude-cli' })).toBe('Codex CLI · Tower')
    expect(towerTerminalTitle({ agent: 'claude-cli', agentName: 'Claude CLI' })).toBe('Claude CLI · Tower')
    expect(towerTerminalTitle({ agentPreset: 'none', agent: 'codex-cli' })).toBe('Codex CLI · Tower')
  })

  it('a custom CLI (not a renderer preset) → the registry name main sent', () => {
    expect(towerTerminalTitle({ agentPreset: 'my-cli', ptyAgent: 'my-cli', ptyAgentName: 'My CLI' })).toBe('My CLI · Tower')
    expect(towerTerminalTitle({ agent: 'my-cli', agentName: ' My CLI ' })).toBe('My CLI · Tower')
    // the tab's custom preset without a name falls through to the next source
    expect(towerAgentLabel({ agentPreset: 'my-cli', agent: 'claude-cli' })).toBe('Claude CLI')
  })

  it('no agent at all → Terminal · Tower', () => {
    expect(towerTerminalTitle({})).toBe('Terminal · Tower')
    expect(towerTerminalTitle({ agentPreset: 'none', ptyAgent: 'none' })).toBe('Terminal · Tower')
    expect(towerTerminalTitle({ agent: 'unknown-id' })).toBe('Terminal · Tower')
  })

  it('isTowerTitle', () => {
    expect(isTowerTitle('Claude CLI · Tower')).toBe(true)
    expect(isTowerTitle('Terminal · Tower')).toBe(true)
    expect(isTowerTitle(' · Tower')).toBe(false)
    expect(isTowerTitle('Tower')).toBe(false)
    expect(isTowerTitle('Claude CLI · Worker · T0551')).toBe(false)
  })
})

describe('isDefaultTerminalTitle (T0562) — every title BAT generates', () => {
  it('addTerminal without a preset: New Terminal; a restored tab without a title: Terminal; empty', () => {
    expect(isDefaultTerminalTitle(NEW_TERMINAL_TITLE)).toBe(true)
    expect(isDefaultTerminalTitle('Terminal')).toBe(true)
    expect(isDefaultTerminalTitle('')).toBe(true)
    expect(isDefaultTerminalTitle(undefined)).toBe(true)
  })

  it('addTerminal with a preset / switchTerminalApiVersion: every agent preset name', () => {
    for (const preset of AGENT_PRESETS) expect(isDefaultTerminalTitle(preset.name), preset.id).toBe(true)
    expect(isDefaultTerminalTitle('Claude Agent V1')).toBe(true)
    expect(isDefaultTerminalTitle('Claude Agent V2')).toBe(true)
  })

  it('a custom CLI name (registry, sent with the event) or the tab autoTitle (setAutoTitle / helper raw command)', () => {
    expect(isDefaultTerminalTitle('My CLI')).toBe(false)
    expect(isDefaultTerminalTitle('My CLI', { agentNames: ['My CLI'] })).toBe(true)
    expect(isDefaultTerminalTitle('My CLI', { agentNames: [undefined, 'My CLI'] })).toBe(true)
    expect(isDefaultTerminalTitle('node')).toBe(false)
    expect(isDefaultTerminalTitle('node', { autoTitle: 'node' })).toBe(true)
    expect(isDefaultTerminalTitle('Install Claude Code', { autoTitle: 'Install Claude Code' })).toBe(true)
  })

  it('externalTerminalTitle results (T0553)', () => {
    const cases = [
      { command: "'C:\\x\\claude.exe' '/ct-exec T0551'", agent: 'claude-cli', towerTerminalId: 't', workorder: 'T0551' },
      { command: 'node w.mjs', agent: 'e2e', agentName: 'E2E worker', towerTerminalId: 't', workorder: 'CP-T0113' },
      { command: 'claude "/ct-exec T0551"' },
      { command: 'gh copilot suggest' },
      {},
    ]
    for (const input of cases) {
      const title = externalTerminalTitle(input)
      expect(isDefaultTerminalTitle(title, { agentNames: [input.agentName] }), title).toBe(true)
    }
    // a command's file name / agent id is recognized through the tab's autoTitle
    const fileName = externalTerminalTitle({ command: '"C:\\Program Files\\nodejs\\node.exe" x.mjs' })
    expect(fileName).toBe('node')
    expect(isDefaultTerminalTitle(fileName, { autoTitle: fileName })).toBe(true)
  })

  it('Worker titles, any agent label', () => {
    expect(isDefaultTerminalTitle('Claude CLI · Worker · T0551')).toBe(true)
    expect(isDefaultTerminalTitle('Terminal · Worker · T0553')).toBe(true)
    expect(isDefaultTerminalTitle('node · Worker · CP-T0113')).toBe(true)
    expect(isDefaultTerminalTitle('Claude CLI · Worker · later')).toBe(false)
  })

  it('pre-T0553 helper titles', () => {
    expect(isDefaultTerminalTitle('Remote: claude')).toBe(true)
    expect(isDefaultTerminalTitle("Remote: 'C:\\Program")).toBe(true)
    expect(isDefaultTerminalTitle('Remote Terminal')).toBe(true)
  })

  it('a Tower title (recomputed by a later --set-role)', () => {
    expect(isDefaultTerminalTitle('Claude CLI · Tower')).toBe(true)
    expect(isDefaultTerminalTitle('Terminal · Tower')).toBe(true)
  })

  it('names the user typed are not BAT titles', () => {
    for (const title of ['塔台', 'my tower', 'Claude', 'Claude CLI 2', 'T0562', 'Tower', 'Remote:', 'Worker · T0551']) {
      expect(isDefaultTerminalTitle(title), title).toBe(false)
    }
    // autoTitle only matches the exact title it was generated as
    expect(isDefaultTerminalTitle('node 2', { autoTitle: 'node' })).toBe(false)
  })
})
