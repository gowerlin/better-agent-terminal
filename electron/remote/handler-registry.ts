export interface HandlerContext {
  windowId: string | null
  /**
   * T0406: id of the remote connection an invoke frame arrived on (RemoteServer);
   * null for local IPC. Lets a handler keep per-connection state (workspace:sync-roots).
   */
  connectionId?: string | null
  /**
   * PLAN-047 M1 / T0582: the helper capability the invoke came in with (RemoteServer helper
   * connection) — the caller's identity for handlers that answer by it (electron/terminal-query-handlers.ts).
   * Absent for local IPC and server-token clients.
   */
  helper?: HandlerHelperIdentity
}

/** T0582: a helper connection's capability binding as handlers see it (a copy). */
export interface HandlerHelperIdentity {
  terminalId: string
  role: 'tower' | 'worker'
  towerId?: string
}

type Handler = (ctx: HandlerContext, ...args: unknown[]) => Promise<unknown> | unknown

const handlers = new Map<string, Handler>()

/**
 * `A` lets a handler declare the argument types it expects. IPC / remote frames are not
 * validated against them at runtime; each handler is responsible for its own narrowing.
 */
export function registerHandler<A extends unknown[]>(
  channel: string,
  handler: (ctx: HandlerContext, ...args: A) => Promise<unknown> | unknown,
): void {
  handlers.set(channel, handler as Handler)
}

export function invokeHandler(
  channel: string,
  args: unknown[],
  windowId?: string | null,
  connectionId?: string | null,
  helper?: HandlerHelperIdentity,
): Promise<unknown> {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler for channel: ${channel}`)
  const ctx: HandlerContext = { windowId: windowId ?? null }
  if (connectionId) ctx.connectionId = connectionId
  if (helper) ctx.helper = { ...helper }
  return Promise.resolve(handler(ctx, ...args))
}

export function hasHandler(channel: string): boolean {
  return handlers.has(channel)
}
