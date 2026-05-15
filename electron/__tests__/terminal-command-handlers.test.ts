import { describe, expect, it } from 'vitest'

import { registerTerminalCommandHandlers, type BuiltAgentCommand } from '../terminal-command-handlers'
import type { ShellFamily } from '../../src/utils/shell-quote'

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

function makeCommand(): BuiltAgentCommand {
  return {
    command: 'claude "$ct-exec T0356"',
    agentId: 'claude-cli',
    prompt: '$ct-exec T0356',
    prefixNormalized: false,
  }
}

describe('registerTerminalCommandHandlers', () => {
  it.each([
    ['C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'pwsh'],
    ['C:\\Windows\\System32\\cmd.exe', 'cmd'],
    ['C:\\Program Files\\Git\\bin\\bash.exe', 'posix'],
  ] satisfies Array<[string, ShellFamily]>)('passes %s shell family into agent command builder', async (shell, expectedFamily) => {
    const handlers = new Map<string, Handler>()
    let observedShellFamily: ShellFamily | undefined

    registerTerminalCommandHandlers({
      registerHandler(channel, handler) {
        handlers.set(channel, handler)
      },
      async invokeHandler(channel, args, windowId) {
        const handler = handlers.get(channel)
        if (!handler) throw new Error(`No handler for channel: ${channel}`)
        return handler({ windowId: windowId ?? null }, ...args)
      },
      getPtyManager() {
        return {
          isAlive: () => false,
          create: () => true,
          write: () => undefined,
        }
      },
      getAllWindows: () => [],
      readPersistedSettingsSync: () => null,
      buildAgentPromptCommand: async (opts) => {
        observedShellFamily = opts.shellFamily
        return makeCommand()
      },
      pickWhitelistedEnv: () => ({}),
      mirrorToBatScripts: () => undefined,
      logger: {
        log: () => undefined,
        warn: () => undefined,
      },
      setTimeout: (callback: () => void) => {
        callback()
        return 0
      },
    })

    const handler = handlers.get('terminal:create-agent-command')
    if (!handler) throw new Error('terminal:create-agent-command was not registered')

    await handler({ windowId: 'test' }, {
      id: 'agent-1',
      cwd: 'D:\\repo',
      shell,
      skill: 'ct-exec',
      workorder: 'T0356',
      agent: 'claude-cli',
    })

    expect(observedShellFamily).toBe(expectedFamily)
  })
})
