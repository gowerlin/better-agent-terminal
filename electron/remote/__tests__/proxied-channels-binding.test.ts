/**
 * T0392 (BUG-095): `claude:abort-session` was registered via registerHandler()
 * but missing from PROXIED_CHANNELS. bindProxiedHandlersToIpc() (main.ts) only
 * binds ipcMain.handle for PROXIED_CHANNELS, so every renderer abort rejected
 * with "No handler registered".
 *
 * Static guard: every literal `registerHandler('<channel>'` in electron/ must
 * be in PROXIED_CHANNELS, or carry its own ipcMain.handle, or be listed in
 * REGISTRY_ONLY_CHANNELS with a reason.
 */
import * as fs from 'fs'
import * as path from 'path'
import { describe, expect, it } from 'vitest'
import { PROXIED_CHANNELS } from '../protocol'

/**
 * Channels intentionally reachable only through the handler registry (remote
 * server invoke frames), never from the local renderer. Each entry needs a reason.
 */
const REGISTRY_ONLY_CHANNELS: ReadonlyMap<string, string> = new Map([])

const ELECTRON_DIR = path.resolve(__dirname, '..', '..')

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      out.push(...listSourceFiles(full))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

// Whole-file match (not per line): calls such as `ipcMain.handle(\n  'server-bundle:download',`
// span lines.
function scan(pattern: RegExp, dir = ELECTRON_DIR, found = new Map<string, string[]>()): Map<string, string[]> {
  for (const file of listSourceFiles(dir)) {
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length
      const where = `${path.relative(ELECTRON_DIR, file).replace(/\\/g, '/')}:${line}`
      found.set(match[1], [...(found.get(match[1]) ?? []), where])
    }
  }
  return found
}

// Shared handler modules (electron/handlers/*.ts, PLAN-036) register through the
// `register` parameter they are handed (= registerHandler on both hosts).
const registered = scan(
  /(?<![\w.])register\(\s*['"`]([^'"`$]+)['"`]/g,
  path.join(ELECTRON_DIR, 'handlers'),
  scan(/registerHandler\(\s*['"`]([^'"`$]+)['"`]/g),
)
const directIpc = scan(/ipcMain\.handle(?:Once)?\(\s*['"`]([^'"`$]+)['"`]/g)

describe('registerHandler channels are bound to IPC (BUG-095 guard)', () => {
  it('scanner finds the registered channels (guards against regex rot)', () => {
    expect(registered.size).toBeGreaterThan(50)
    expect(registered.has('claude:send-message')).toBe(true)
    expect(registered.has('git-scaffold:healthCheck')).toBe(true)
    expect(registered.has('terminal:create-with-command')).toBe(true)
  })

  it('claude:abort-session is proxied (bound to ipcMain.handle)', () => {
    expect(registered.has('claude:abort-session')).toBe(true)
    expect(PROXIED_CHANNELS.has('claude:abort-session')).toBe(true)
  })

  it('every registered channel is in PROXIED_CHANNELS, has ipcMain.handle, or is REGISTRY_ONLY', () => {
    const orphans = [...registered]
      .filter(([channel]) =>
        !PROXIED_CHANNELS.has(channel) && !directIpc.has(channel) && !REGISTRY_ONLY_CHANNELS.has(channel))
      .map(([channel, where]) => `${channel} (${where.join(', ')})`)
    expect(orphans).toEqual([])
  })

  it('REGISTRY_ONLY_CHANNELS entries are real, unbound, and justified', () => {
    for (const [channel, reason] of REGISTRY_ONLY_CHANNELS) {
      expect(registered.has(channel), channel).toBe(true)
      expect(PROXIED_CHANNELS.has(channel), channel).toBe(false)
      expect(reason.trim().length, channel).toBeGreaterThan(0)
    }
  })

  it('every preload ipcRenderer.invoke channel has an IPC binding', () => {
    const preload = fs.readFileSync(path.join(ELECTRON_DIR, 'preload.ts'), 'utf8')
    const invoked = new Set([...preload.matchAll(/ipcRenderer\.invoke\(\s*['"`]([^'"`$]+)['"`]/g)].map(m => m[1]))
    expect(invoked.size).toBeGreaterThan(50)
    const unbound = [...invoked].filter(channel => !PROXIED_CHANNELS.has(channel) && !directIpc.has(channel))
    expect(unbound).toEqual([])
  })
})
