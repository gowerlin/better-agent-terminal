/**
 * PLAN-047 M1 / T0584: renderer side of the `bat` MCP injection (src/lib/bat-mcp-launch.ts).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withBatMcpLaunchArgs } from '../bat-mcp-launch'

type Api = { agent?: { batMcpLaunchArgs?: (...a: unknown[]) => Promise<string> }; debug?: { log: (...a: unknown[]) => void } }
const w = window as unknown as { electronAPI?: Api }
const original = w.electronAPI

afterEach(() => {
  w.electronAPI = original
})

function mockApi(impl: (...a: unknown[]) => Promise<string>) {
  const batMcpLaunchArgs = vi.fn(impl)
  const log = vi.fn()
  w.electronAPI = { agent: { batMcpLaunchArgs }, debug: { log } }
  return { batMcpLaunchArgs, log }
}

describe('withBatMcpLaunchArgs', () => {
  it('claude / codex: asks with the shell family and puts the args after the base command', async () => {
    const { batMcpLaunchArgs } = mockApi(async () => "'--mcp-config=C:\\u\\bat-mcp\\claude.json'")
    expect(await withBatMcpLaunchArgs("& 'C:\\claude.exe'", 'claude-cli', 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', '--x'))
      .toBe("& 'C:\\claude.exe' '--mcp-config=C:\\u\\bat-mcp\\claude.json'")
    expect(batMcpLaunchArgs).toHaveBeenCalledWith('claude-cli', 'pwsh', '--x')
    await withBatMcpLaunchArgs('codex', 'codex-cli', '/bin/bash', undefined)
    expect(batMcpLaunchArgs).toHaveBeenLastCalledWith('codex-cli', 'posix', undefined)
    await withBatMcpLaunchArgs('x', 'claude-cli-worktree', undefined, '')
    expect(batMcpLaunchArgs).toHaveBeenLastCalledWith('claude-cli-worktree', 'posix', '')
  })

  it('"" (off / not applicable) leaves the command unchanged', async () => {
    mockApi(async () => '')
    expect(await withBatMcpLaunchArgs('codex --yolo', 'codex-cli', 'cmd.exe', '')).toBe('codex --yolo')
  })

  it('other agents never ask', async () => {
    const { batMcpLaunchArgs } = mockApi(async () => 'SHOULD-NOT-APPEAR')
    for (const agent of ['gemini-cli', 'claude-code', 'none', undefined]) {
      expect(await withBatMcpLaunchArgs('cmd', agent, 'bash', '')).toBe('cmd')
    }
    expect(batMcpLaunchArgs).not.toHaveBeenCalled()
  })

  it('an older server (no handler) or a missing API leaves the command unchanged', async () => {
    const { log } = mockApi(async () => { throw new Error('No handler for channel: agent:bat-mcp-launch-args') })
    expect(await withBatMcpLaunchArgs('codex', 'codex-cli', 'bash', '')).toBe('codex')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[bat-mcp] agent=codex-cli: launch args unavailable'))
    w.electronAPI = { agent: {} }
    expect(await withBatMcpLaunchArgs('codex', 'codex-cli', 'bash', '')).toBe('codex')
  })
})
