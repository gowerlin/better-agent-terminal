export interface HandlerContext {
  windowId: string | null
  /**
   * T0406: id of the remote connection an invoke frame arrived on (RemoteServer);
   * null for local IPC. Lets a handler keep per-connection state (workspace:sync-roots).
   */
  connectionId?: string | null
}

type Handler = (ctx: HandlerContext, ...args: unknown[]) => Promise<unknown> | unknown

const handlers = new Map<string, Handler>()

export function registerHandler(channel: string, handler: Handler): void {
  handlers.set(channel, handler)
}

export function invokeHandler(channel: string, args: unknown[], windowId?: string | null, connectionId?: string | null): Promise<unknown> {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler for channel: ${channel}`)
  const ctx: HandlerContext = { windowId: windowId ?? null }
  if (connectionId) ctx.connectionId = connectionId
  return Promise.resolve(handler(ctx, ...args))
}

export function hasHandler(channel: string): boolean {
  return handlers.has(channel)
}
