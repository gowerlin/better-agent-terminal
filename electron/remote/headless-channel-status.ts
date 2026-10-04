/**
 * PLAN-036 / D129 (T0388): headless coverage ledger for PROXIED_CHANNELS.
 *
 * Every channel in `PROXIED_CHANNELS` (protocol.ts) must be in exactly one of:
 *   1. registered on headless bat-server (`hasHandler` after createHeadlessServer)
 *   2. `HEADLESS_UNSUPPORTED` — not implemented on headless yet, tagged with the
 *      PLAN-036 phase that is expected to bring it online
 *   3. `ALWAYS_LOCAL_CHANNELS` — never proxied, the client answers locally
 *
 * Enforced by `electron/remote/__tests__/headless-parity.test.ts`:
 *   - adding a channel to PROXIED_CHANNELS without classifying it here → red
 *   - bringing a channel online on headless without deleting its line here → red
 *   - leaving a line here for a channel that no longer exists → red
 *
 * Work orders that bring a channel online: delete its line from
 * HEADLESS_UNSUPPORTED in the same commit.
 *
 * Must stay free of `electron` imports — headless code may import this.
 */
import { PROXIED_CHANNELS } from './protocol'

/** PLAN-036 phases (T0386 回報區 §1 / §7, PLAN-036 缺口表). */
export type HeadlessPhase = 'P0' | 'P1' | 'P2' | 'P3'

/**
 * Channels that never proxy, even from a remote-profile window.
 *
 * Single source: `electron/main.ts` (bindProxiedHandlersToIpc) imports this
 * set (T0390). The parity test fails if main.ts grows its own copy again.
 */
export const ALWAYS_LOCAL_CHANNELS: ReadonlySet<string> = new Set([
  'workspace:save', 'workspace:load',
  // T0401: renderer message-overflow cache in the user's own userData (T0386 §1 B).
  'claude:archive-messages', 'claude:load-archived', 'claude:clear-archive',
])

/**
 * Proxied channels headless bat-server does not answer yet. A remote-profile
 * window calling one of these gets `No handler for channel: <channel>`.
 *
 * Initial content (T0388): every proxied channel headless lacked at the time,
 * phased per T0386. Notes on lines mark T0386's reclassification proposals
 * (always-local / remote-unsupported) — those are decided by their own work
 * orders, not here.
 */
export const HEADLESS_UNSUPPORTED: Readonly<Record<string, HeadlessPhase>> = Object.freeze({
  // ── P0: terminal — online since T0390 (electron/handlers/pty.ts); pty:get-buffer since T0403 ──

  // ── P1: Agent — claude:* online since T0401 (electron/handlers/claude.ts); archive → ALWAYS_LOCAL ──
  // Remote-unsupported for good: the server bundle has no codex (T0386 §1 C).
  'claude:set-codex-sandbox-mode': 'P1',
  'claude:set-codex-approval-policy': 'P1',

  // ── P2: repo / filesystem (T0386 H / I) ──
  'worktree:create': 'P2',
  'worktree:remove': 'P2',
  'worktree:status': 'P2',
  'worktree:merge': 'P2',
  'worktree:rehydrate': 'P2',
  'github:check-cli': 'P2',
  'github:pr-list': 'P2',
  'github:issue-list': 'P2',
  'github:pr-view': 'P2',
  'github:issue-view': 'P2',
  'github:pr-comment': 'P2',
  'github:issue-comment': 'P2',
  'git:branch': 'P2',
  'git:log': 'P2',
  'git:diff': 'P2',
  'git:diff-files': 'P2',
  'git:status': 'P2',
  'git:get-github-url': 'P2',
  'git:getRoot': 'P2',
  'git-scaffold:healthCheck': 'P2',
  'git-scaffold:getRepoInfo': 'P2',
  'git-scaffold:listCommits': 'P2',
  'fs:readdir': 'P2',
  'fs:readFile': 'P2',
  'fs:stat': 'P2',
  'fs:search': 'P2',
  'fs:watch': 'P2',
  'fs:unwatch': 'P2',
  'fs:reset-watch': 'P2',
  'image:read-as-data-url': 'P2',

  // ── P3: secondary (T0386 J / K) ──
  'settings:get-logging-info': 'P3', // T0386 §1 B: always-local candidate
  'settings:cleanup-logs': 'P3', // T0386 §1 B: always-local candidate
  'snippet:getAll': 'P3', // snippet:* — T0386 §1 B: always-local candidate
  'snippet:getById': 'P3',
  'snippet:create': 'P3',
  'snippet:update': 'P3',
  'snippet:delete': 'P3',
  'snippet:toggleFavorite': 'P3',
  'snippet:search': 'P3',
  'snippet:getCategories': 'P3',
  'snippet:getFavorites': 'P3',
  'snippet:getByWorkspace': 'P3',
  'terminal:create-with-command': 'P3',
  'terminal:create-agent-command': 'P3',
  'terminal:notify': 'P3',
  'terminal:keypress': 'P3', // T0386 §1 C: renderer-DOM only → remote-unsupported
})

export function isHeadlessUnsupported(channel: string): boolean {
  return Object.prototype.hasOwnProperty.call(HEADLESS_UNSUPPORTED, channel)
}

export function countHeadlessUnsupportedByPhase(): Record<HeadlessPhase, number> {
  const counts: Record<HeadlessPhase, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const phase of Object.values(HEADLESS_UNSUPPORTED)) counts[phase] += 1
  return counts
}

export interface HeadlessParityInput {
  proxiedChannels: Iterable<string>
  hasHandler: (channel: string) => boolean
  unsupported?: Readonly<Record<string, HeadlessPhase>>
  alwaysLocal?: ReadonlySet<string>
}

export interface HeadlessParityViolation {
  channel: string
  problem:
    | 'unclassified' // proxied, not registered, not listed anywhere
    | 'registered-but-listed-unsupported' // online on headless; delete it from HEADLESS_UNSUPPORTED
    | 'listed-twice' // in both HEADLESS_UNSUPPORTED and ALWAYS_LOCAL_CHANNELS
    | 'stale-unsupported' // listed, but no longer a proxied channel
    | 'stale-always-local' // listed, but no longer a proxied channel
}

/** Pure check behind the parity test; returns [] when the ledger is consistent. */
export function checkHeadlessParity(input: HeadlessParityInput): HeadlessParityViolation[] {
  const unsupported = input.unsupported ?? HEADLESS_UNSUPPORTED
  const alwaysLocal = input.alwaysLocal ?? ALWAYS_LOCAL_CHANNELS
  const proxied = new Set(input.proxiedChannels)
  const listedUnsupported = (channel: string) => Object.prototype.hasOwnProperty.call(unsupported, channel)
  const violations: HeadlessParityViolation[] = []

  for (const channel of proxied) {
    const local = alwaysLocal.has(channel)
    const listed = listedUnsupported(channel)
    if (local && listed) {
      violations.push({ channel, problem: 'listed-twice' })
    } else if (listed && input.hasHandler(channel)) {
      violations.push({ channel, problem: 'registered-but-listed-unsupported' })
    } else if (!local && !listed && !input.hasHandler(channel)) {
      violations.push({ channel, problem: 'unclassified' })
    }
  }
  for (const channel of Object.keys(unsupported)) {
    if (!proxied.has(channel)) violations.push({ channel, problem: 'stale-unsupported' })
  }
  for (const channel of alwaysLocal) {
    if (!proxied.has(channel)) violations.push({ channel, problem: 'stale-always-local' })
  }
  return violations
}

/** Convenience for callers that want the live PROXIED_CHANNELS. */
export function checkLiveHeadlessParity(hasHandler: (channel: string) => boolean): HeadlessParityViolation[] {
  return checkHeadlessParity({ proxiedChannels: PROXIED_CHANNELS, hasHandler })
}
