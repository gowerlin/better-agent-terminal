/**
 * T0402: Claude panel "not logged in" guide — display condition, the typed login
 * command (shell-safe path quoting) and that it is never submitted.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildClaudeLoginCommand,
  getClaudeAuthStatus,
  openClaudeLoginTerminal,
  resetClaudeAuthStatusCache,
  shouldShowClaudeLoginGuide,
  type OpenClaudeLoginTerminalDeps,
} from '../claude-login-guide'

describe('shouldShowClaudeLoginGuide', () => {
  it('shows only on a definite loggedIn:false', () => {
    expect(shouldShowClaudeLoginGuide({ loggedIn: false, authMethod: 'none' })).toBe(true)
    expect(shouldShowClaudeLoginGuide({ loggedIn: true, email: 'a@example.com' })).toBe(false)
    expect(shouldShowClaudeLoginGuide(null)).toBe(false)
    expect(shouldShowClaudeLoginGuide(undefined)).toBe(false)
  })
})

describe('buildClaudeLoginCommand', () => {
  it('quotes a path with spaces for each shell family', () => {
    expect(buildClaudeLoginCommand('/opt/my tools/claude', 'posix')).toBe(`'/opt/my tools/claude' auth login`)
    expect(buildClaudeLoginCommand(`/opt/it's/claude`, 'posix')).toBe(`'/opt/it'\\''s/claude' auth login`)
    expect(buildClaudeLoginCommand('C:\\Program Files\\BAT\\claude.exe', 'pwsh')).toBe(`& 'C:\\Program Files\\BAT\\claude.exe' auth login`)
    expect(buildClaudeLoginCommand('C:\\Program Files\\BAT\\claude.exe', 'cmd')).toBe(`"C:\\Program Files\\BAT\\claude.exe" auth login`)
  })

  it('falls back to `claude` when no runtime path is known', () => {
    expect(buildClaudeLoginCommand('', 'posix')).toBe('claude auth login')
  })
})

function makeDeps(over: Partial<OpenClaudeLoginTerminalDeps> = {}) {
  const writes: Array<[string, string]> = []
  const created: Array<{ id: string; shell: string | undefined }> = []
  const deps: OpenClaudeLoginTerminalDeps = {
    addTerminal: () => 'term-1',
    getShell: async () => '/bin/bash',
    getCliPath: async () => '/home/u/.bat-server/node_modules/@anthropic-ai/claude-code/bin/my claude',
    createShell: async (id, shell, launch) => { created.push({ id, shell }); launch() },
    write: (id, data) => { writes.push([id, data]) },
    schedule: fn => fn(),
    ...over,
  }
  return { deps, writes, created }
}

describe('openClaudeLoginTerminal', () => {
  it('opens a new shell tab and types the quoted login command without Enter', async () => {
    const { deps, writes, created } = makeDeps()
    const result = await openClaudeLoginTerminal(deps)
    const expected = `'/home/u/.bat-server/node_modules/@anthropic-ai/claude-code/bin/my claude' auth login`
    expect(result).toEqual({ terminalId: 'term-1', command: expected })
    expect(created).toEqual([{ id: 'term-1', shell: '/bin/bash' }])
    expect(writes).toEqual([['term-1', expected]])
    expect(writes[0][1]).not.toMatch(/[\r\n]/)
  })

  it('quotes for the configured shell (pwsh)', async () => {
    const { deps, writes } = makeDeps({
      getShell: async () => 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      getCliPath: async () => 'C:\\Program Files\\BetterAgentTerminal\\resources\\claude.exe',
    })
    await openClaudeLoginTerminal(deps)
    expect(writes).toEqual([['term-1', `& 'C:\\Program Files\\BetterAgentTerminal\\resources\\claude.exe' auth login`]])
  })

  it('does not type into a shell that was not freshly spawned', async () => {
    const { deps, writes } = makeDeps({ createShell: async () => {} })
    await openClaudeLoginTerminal(deps)
    expect(writes).toEqual([])
  })
})

describe('getClaudeAuthStatus', () => {
  afterEach(() => resetClaudeAuthStatusCache())

  it('shares one fetch within the TTL; force refetches', async () => {
    const fetch = vi.fn(async () => ({ loggedIn: false }))
    await getClaudeAuthStatus(fetch, { now: 1_000 })
    await getClaudeAuthStatus(fetch, { now: 2_000 })
    expect(fetch).toHaveBeenCalledTimes(1)
    await getClaudeAuthStatus(fetch, { now: 2_000, force: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    await getClaudeAuthStatus(fetch, { now: 60_000 })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('a rejected fetch reads as null (cannot tell)', async () => {
    await expect(getClaudeAuthStatus(async () => { throw new Error('remote down') }, { force: true })).resolves.toBeNull()
  })
})
