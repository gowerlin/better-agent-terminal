/**
 * T0385 (BUG-094): built-in handlers every headless bat-server registers.
 *
 * A remote-profile window proxies PROXIED_CHANNELS to the server it is bound
 * to (electron/main.ts bindProxiedHandlersToIpc). The Electron host registers
 * those handlers in main.ts; headless bat-server had none, so opening a WSL /
 * SSH profile died on the very first call (`profile:load-snapshot`).
 *
 * Profile model: headless has no profile store. Window/workspace layout is
 * owned by the client (workspace:save / workspace:load are ALWAYS_LOCAL in
 * main.ts), so the server answers profile queries with "nothing stored":
 * `profile:load-snapshot` → `null`, which the client treats as "open one
 * empty window for this profile". The requested profile id
 * (`remoteProfileId || 'default'`) is accepted and ignored.
 *
 * Must stay free of `electron` imports — this runs under plain node.
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import type { HandlerContext } from './handler-registry'

export interface HeadlessHandlerRegistration {
  channel: string
  handler: (ctx: HandlerContext, ...args: unknown[]) => Promise<unknown> | unknown
}

export interface HeadlessDefaultHandlerOptions {
  /** bat-server data dir; per-server state (settings.json) lives here. */
  dataDir: string
}

export function createHeadlessDefaultHandlers(opts: HeadlessDefaultHandlerOptions): HeadlessHandlerRegistration[] {
  const settingsPath = path.join(opts.dataDir, 'settings.json')

  return [
    // ── Profile (no profile store on headless) ──
    { channel: 'profile:load-snapshot', handler: () => null },
    { channel: 'profile:load', handler: () => null },
    { channel: 'profile:list', handler: () => ({ profiles: [], activeProfileIds: [] }) },
    { channel: 'profile:get-active-ids', handler: () => [] },
    { channel: 'profile:activate', handler: () => undefined },
    { channel: 'profile:deactivate', handler: () => undefined },

    // ── Settings (same contract as main.ts: raw JSON string or null) ──
    {
      channel: 'settings:load',
      handler: async () => {
        try { return await fs.readFile(settingsPath, 'utf-8') } catch { return null }
      },
    },
    {
      channel: 'settings:save',
      handler: async (_ctx, data: unknown) => {
        if (typeof data !== 'string') throw new Error('settings:save expects a JSON string')
        JSON.parse(data) // reject garbage instead of persisting it
        await fs.mkdir(opts.dataDir, { recursive: true })
        await fs.writeFile(settingsPath, data, 'utf-8')
        return true
      },
    },
  ]
}
