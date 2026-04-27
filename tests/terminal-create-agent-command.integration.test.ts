import * as assert from 'assert'

import { registerTerminalCommandHandlers } from '../electron/terminal-command-handlers'

type Handler = (ctx: { windowId: string | null }, ...args: unknown[]) => Promise<unknown> | unknown

const handlers = new Map<string, Handler>()
const createdShells: Array<string | undefined> = []
const logs: string[] = []

function basename(shellPath: string | undefined): string {
  if (!shellPath) return 'pty-default'
  return shellPath.replace(/\\/g, '/').split('/').pop() || shellPath
}

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
      create(options) {
        createdShells.push(options.shell)
        return true
      },
      write: () => undefined,
    }
  },
  getAllWindows: () => [],
  readPersistedSettingsSync: () => ({ shell: 'git-bash' }),
  buildAgentPromptCommand: async () => ({
    command: 'codex "$ct-exec T0344"',
    agentId: 'codex-cli',
    prompt: '$ct-exec T0344',
    prefixNormalized: false,
  }),
  pickWhitelistedEnv: () => ({}),
  mirrorToBatScripts: () => undefined,
  logger: {
    log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
    warn: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
  },
  platform: 'win32',
  env: { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
  existsSync: (candidate) => candidate === 'C:\\Program Files\\Git\\bin\\bash.exe',
  setTimeout: (callback: () => void) => {
    callback()
    return 0 as unknown as NodeJS.Timeout
  },
})

async function invokeCreateAgentCommand(id: string) {
  const handler = handlers.get('terminal:create-agent-command')
  if (!handler) throw new Error('terminal:create-agent-command was not registered')
  return handler({ windowId: 'test-window' }, {
    id,
    cwd: 'D:\\repo',
    skill: 'ct-exec',
    workorder: 'T0344',
    agent: 'codex-agent',
  })
}

async function main() {
  for (let index = 0; index < 3; index++) {
    const result = await invokeCreateAgentCommand(`agent-${index}`)
    assert.strictEqual(result, true)
  }

  assert.deepStrictEqual(createdShells.map(basename), ['bash.exe', 'bash.exe', 'bash.exe'])
  assert.strictEqual(logs.some((line) => line.includes('basename=bash.exe') && line.includes('persistedShell=git-bash')), true)
  assert.strictEqual(logs.some((line) => line.includes('C:\\Program Files\\Git\\bin\\bash.exe')), false)

  console.log('  ✅ terminal:create-agent-command resolves git-bash consistently across 3 invokes')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
