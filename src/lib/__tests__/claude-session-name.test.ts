/**
 * PLAN-050 / T0641 (C-1): `claudeSessionName` — the claude `--name` BAT gives a claude-cli tab.
 *   - three roles: Worker `<ws> · Worker · <T####>`, Tower `<ws> · Tower`, tab `<ws> · <short id>`
 *   - `<ws>` cleaning: control characters, white space, leading `/`, `"` → `'`, ≤ 60 characters
 *   - the whole name ≤ 200 characters, cut in `<ws>` (the role / `T####` always stay)
 *   - empty `<ws>` → `BAT`; invalid work order id / no terminal id → null
 *   - `normalizeClaudeSessionName` (a name that came over IPC)
 */
import { describe, expect, it } from 'vitest'
import {
  CLAUDE_SESSION_NAME_MAX,
  claudeSessionName,
  claudeSessionShortId,
  cleanSessionWorkspaceName,
  normalizeClaudeSessionName,
} from '../claude-session-name'
import { WORKORDER_ID_PATTERN } from '../../types/control-tower'

describe('claudeSessionName', () => {
  it('three roles', () => {
    expect(claudeSessionName({ role: 'worker', workspaceName: 'better-agent-terminal', workorder: 'T0641' })).toBe('better-agent-terminal · Worker · T0641')
    expect(claudeSessionName({ role: 'tower', workspaceName: 'better-agent-terminal' })).toBe('better-agent-terminal · Tower')
    expect(claudeSessionName({ role: 'tab', workspaceName: 'better-agent-terminal', terminalId: '251BBD8F-d725-28c2' })).toBe('better-agent-terminal · 251bbd')
    expect(claudeSessionName({ role: 'tab', workspaceName: '測試工作區（中文）', terminalId: 'd64be77a-fa33-4391-b92c-70069ddfd207' })).toBe('測試工作區（中文） · d64be7')
  })

  it('work order ids with a prefix (WORKORDER_ID_PATTERN); anything else → null', () => {
    for (const id of ['CT-T021', 'CP-T1148', 'KEEN-T001', 'T1']) {
      expect(claudeSessionName({ role: 'worker', workspaceName: 'ws', workorder: id })).toBe(`ws · Worker · ${id}`)
      expect(WORKORDER_ID_PATTERN.test(id)).toBe(true)
    }
    expect(claudeSessionName({ role: 'worker', workspaceName: 'ws', workorder: ' T0641 ' })).toBe('ws · Worker · T0641')
    for (const id of ['', 't0641', 'T', 'ABCDE-T1', 'T0641-x', 'T0641 && x']) {
      expect(claudeSessionName({ role: 'worker', workspaceName: 'ws', workorder: id }), id).toBeNull()
      expect(WORKORDER_ID_PATTERN.test(id), id).toBe(false)
    }
  })

  it('the short id: without "-", first 6, lower case; none → null', () => {
    expect(claudeSessionShortId('AB-CD-EF-12')).toBe('abcdef')
    expect(claudeSessionShortId('abc')).toBe('abc')
    expect(claudeSessionName({ role: 'tab', workspaceName: 'ws', terminalId: 'abc' })).toBe('ws · abc')
    expect(claudeSessionName({ role: 'tab', workspaceName: 'ws', terminalId: '' })).toBeNull()
    expect(claudeSessionName({ role: 'tab', workspaceName: 'ws', terminalId: '---' })).toBeNull()
  })

  it('cleaning: control characters removed, white space collapsed, leading / removed, " → \'', () => {
    expect(cleanSessionWorkspaceName('  my\u0007 \t ws\u0085\u001b[31m  ')).toBe('my ws[31m')
    expect(cleanSessionWorkspaceName('a　 b')).toBe('a b')
    expect(cleanSessionWorkspaceName('//repo')).toBe('repo')
    expect(cleanSessionWorkspaceName('/ /repo')).toBe('/repo')
    expect(cleanSessionWorkspaceName('My "Best" WS')).toBe("My 'Best' WS")
    expect(cleanSessionWorkspaceName('.claude')).toBe('.claude')
    expect(claudeSessionName({ role: 'tower', workspaceName: '/T0640 x' })).toBe('T0640 x · Tower')
  })

  it('empty / missing <ws> → BAT', () => {
    for (const ws of [undefined, null, '', '   ', '\u0000\u0001', '///']) {
      expect(claudeSessionName({ role: 'worker', workspaceName: ws, workorder: 'T0641' }), String(ws)).toBe('BAT · Worker · T0641')
    }
    expect(claudeSessionName({ role: 'tower', workspaceName: 42 as unknown as string })).toBe('BAT · Tower')
  })

  it('<ws> at most 60 characters (code points, trailing space trimmed)', () => {
    expect(cleanSessionWorkspaceName('x'.repeat(80))).toBe('x'.repeat(60))
    expect(cleanSessionWorkspaceName(`${'x'.repeat(59)} y`)).toBe('x'.repeat(59))
    expect(Array.from(cleanSessionWorkspaceName('中'.repeat(70)))).toHaveLength(60)
    expect(Array.from(cleanSessionWorkspaceName('😀'.repeat(70)))).toHaveLength(60)
    expect(claudeSessionName({ role: 'worker', workspaceName: 'w'.repeat(100), workorder: 'T0641' })).toBe(`${'w'.repeat(60)} · Worker · T0641`)
  })

  it('the whole name at most 200: cut in <ws>, T#### / Tower kept; impossible → null', () => {
    const long = `T${'1'.repeat(170)}`
    const name = claudeSessionName({ role: 'worker', workspaceName: 'w'.repeat(60), workorder: long })!
    expect(name.length).toBe(CLAUDE_SESSION_NAME_MAX)
    expect(name.endsWith(` · Worker · ${long}`)).toBe(true)
    expect(name.startsWith('w'.repeat(200 - ` · Worker · ${long}`.length))).toBe(true)
    // a surrogate pair is never split
    const emoji = claudeSessionName({ role: 'worker', workspaceName: '😀'.repeat(60), workorder: long })!
    expect(emoji.length).toBeLessThanOrEqual(CLAUDE_SESSION_NAME_MAX)
    expect(emoji).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
    expect(claudeSessionName({ role: 'worker', workspaceName: 'ws', workorder: `T${'1'.repeat(200)}` })).toBeNull()
  })
})

describe('normalizeClaudeSessionName', () => {
  it('a name over IPC: cleaned again, ≤ 200, empty / not a string → null', () => {
    expect(normalizeClaudeSessionName('ws · Worker · T0641')).toBe('ws · Worker · T0641')
    expect(normalizeClaudeSessionName('  a\nb  ')).toBe('ab')
    expect(normalizeClaudeSessionName('/x')).toBe('x')
    expect(normalizeClaudeSessionName('say "hi"')).toBe("say 'hi'")
    expect(normalizeClaudeSessionName('y'.repeat(300))).toBe('y'.repeat(200))
    for (const value of ['', '  ', '\u0000', 42, null, undefined, {}]) expect(normalizeClaudeSessionName(value)).toBeNull()
    // what claudeSessionName returns is already normal
    const name = claudeSessionName({ role: 'tab', workspaceName: ' 測試\t工作區 ', terminalId: 'abcdef12' })!
    expect(normalizeClaudeSessionName(name)).toBe(name)
  })
})
