/**
 * T0403 (PLAN-036): renderer side of "was this PTY already running?".
 *
 * - `pty:create` answers `{ ok, created }`; servers before T0403 answer a bare boolean
 *   (`normalizePtyCreateResult` reads that as "created" — the pre-T0403 behaviour).
 * - `created: false` (renderer reload, BAT reopened against a surviving remote / Terminal
 *   Server PTY): do not type the agent launch command again, and replay the output the
 *   view missed from `pty:get-buffer` into the terminal view once it is mounted.
 *
 * The view may mount before or after `pty:create` resolves (TerminalPanel's mount effect
 * usually runs first), so replay requests go through a small id → sink registry.
 */
import type { CreatePtyOptions, PtyCreateResult, PtyReplayBuffer } from '../types'

export function normalizePtyCreateResult(raw: unknown): PtyCreateResult {
  if (raw && typeof raw === 'object' && typeof (raw as { created?: unknown }).created === 'boolean') {
    const r = raw as { ok?: unknown; created: boolean }
    return { ok: r.ok !== false, created: r.created }
  }
  // Pre-T0403 server: `true` / `false` / undefined. Always "created", as before.
  return { ok: raw !== false && raw != null, created: true }
}

/** Agent launch command after pty:create — only into a freshly spawned shell. */
export function shouldSendLaunchCommand(result: PtyCreateResult): boolean {
  return result.created
}

type ReplaySink = () => void
const pendingReplays = new Set<string>()
const replaySinks = new Map<string, ReplaySink>()

/** Ask the terminal view of `id` to replay; held until the view registers if not mounted yet. */
export function requestPtyReplay(id: string): void {
  const sink = replaySinks.get(id)
  if (sink) sink()
  else pendingReplays.add(id)
}

/** Terminal view hook-up; a replay requested before mount runs right away. Returns unregister. */
export function registerPtyReplaySink(id: string, sink: ReplaySink): () => void {
  replaySinks.set(id, sink)
  if (pendingReplays.delete(id)) sink()
  return () => {
    if (replaySinks.get(id) === sink) replaySinks.delete(id)
  }
}

/** Test helper. */
export function resetPtyReplayRegistry(): void {
  pendingReplays.clear()
  replaySinks.clear()
}

type PtyCreateApi = { create: (options: CreatePtyOptions) => Promise<PtyCreateResult | boolean> }

/** `pty.create`, normalized; asks for a replay when the PTY was already running. */
export async function createPtyWithReplay(
  options: CreatePtyOptions,
  api: PtyCreateApi = window.electronAPI.pty,
): Promise<PtyCreateResult> {
  let result: PtyCreateResult
  try {
    result = normalizePtyCreateResult(await api.create(options))
  } catch {
    // Callers used to fire-and-forget create; keep their launch behaviour on failure.
    result = { ok: false, created: true }
  }
  if (result.ok && !result.created) requestPtyReplay(options.id)
  return result
}

/**
 * Agent-preset restore: create (or re-attach to) the PTY, then run `launch` (types the agent
 * command) only when a shell was actually spawned — never into a surviving agent.
 */
export async function createPtyThenLaunch(
  options: CreatePtyOptions,
  launch: () => void,
  api?: PtyCreateApi,
): Promise<PtyCreateResult> {
  const result = await createPtyWithReplay(options, api)
  if (shouldSendLaunchCommand(result)) launch()
  return result
}

/**
 * Live chunks that arrived while `pty:get-buffer` was in flight and are NOT already the
 * tail of `buffer`. The host appends to the replay buffer in the same tick it broadcasts a
 * chunk, so the queued chunks that were broadcast before the buffer was read form exactly
 * the end of `buffer`; drop the longest such prefix of `queued`, keep the rest.
 * Content-based, so it holds even when a broadcast overtakes the invoke reply.
 */
export function dropReplayedChunks(buffer: string, queued: readonly string[]): string[] {
  let acc = ''
  let covered = 0
  for (let i = 0; i < queued.length; i++) {
    acc += queued[i]
    if (acc.length > buffer.length) break
    if (buffer.endsWith(acc)) covered = i + 1
  }
  return queued.slice(covered)
}

export interface ReplayView {
  write(data: string): void
  /** Clear what was written so far (the replay buffer already contains it). */
  reset(): void
}

/**
 * Sits between `pty:output` and one terminal view. While a replay is in flight, live
 * chunks are queued; then the buffer is written (after a reset if live output already
 * reached the view — the buffer is a superset of it) followed by the queued chunks the
 * buffer does not cover.
 */
export class PtyOutputReplayer {
  private queue: string[] | null = null
  private wroteLive = false
  private disposed = false

  constructor(
    private readonly id: string,
    private readonly view: ReplayView,
    private readonly getBuffer: (id: string) => Promise<PtyReplayBuffer | null>,
  ) {}

  /** A live `pty:output` chunk for this terminal. */
  push(data: string): void {
    if (this.queue) {
      this.queue.push(data)
      return
    }
    this.wroteLive = true
    this.view.write(data)
  }

  /** Resolves with the number of replayed chars (0 = nothing replayed). */
  async replay(): Promise<number> {
    if (this.queue || this.disposed) return 0
    this.queue = []
    let buffer: PtyReplayBuffer | null = null
    try {
      buffer = await this.getBuffer(this.id)
    } catch {
      // Remote server before T0403: `No handler for channel: pty:get-buffer` — no replay.
    }
    const queued = this.queue
    this.queue = null
    if (this.disposed) return 0
    const data = buffer && typeof buffer.data === 'string' ? buffer.data : ''
    if (data) {
      if (this.wroteLive) this.view.reset()
      this.view.write(data)
      this.wroteLive = true
    }
    for (const chunk of dropReplayedChunks(data, queued)) this.push(chunk)
    return data.length
  }

  dispose(): void {
    this.disposed = true
    this.queue = null
  }
}
