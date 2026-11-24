/**
 * PLAN-068 W6 / T0909 (T0909 Q-1, Tower answer A): which Claude Agent panels of this window are panel
 * Towers, and telling the host (`tower-cards:set-panel-tower`, proxied: Electron main or the window's
 * bat-server). The decision is `panelTowerTerminalIds` (src/lib/inbox-model.ts); this store only keeps
 * the window's last decision and sends what changed.
 *
 * - First sight of a panel: its value is sent once (true or false), so a host that kept an older
 *   decision (a reloaded window) is set right; afterwards only changes are sent.
 * - Reconnect (`remote:client-status-changed` from not connected to connected): every known value is
 *   sent again (a restarted bat-server forgot them).
 * - A failed send (an older host without the channel, disconnected) is logged once per id and
 *   retried on the next change or reconnect.
 * - A panel that left the window (closed tab) is forgotten here; the host clears it when the panel
 *   session is disposed (W3).
 *
 * Memory only; logs carry ids and booleans only.
 */
import { useSyncExternalStore } from 'react'

type Listener = () => void

const decided = new Map<string, boolean>()
const listeners = new Set<Listener>()
let version = 0

function notify(): void {
  version++
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      /* a broken subscriber must not stop the others */
    }
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Whether this window decided tab `id` is a panel Tower. */
export function isPanelTowerHere(id: string): boolean {
  return decided.get(id) === true
}

/** React: re-renders when any decision changes. */
export function usePanelTowerVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}

/** Tests. */
export function resetPanelTowerStore(): void {
  decided.clear()
  notify()
}

export interface PanelTowerSyncDeps {
  /** `window.electronAPI.towerCards.setPanelTower`. */
  setPanelTower(terminalId: string, tower: boolean): Promise<unknown>
  log?(message: string): void
}

export interface PanelTowerSync {
  /**
   * The window's Claude panels now and whether each is a panel Tower (every Claude panel of the
   * window, true or false). Sends first sights and changes; forgets panels no longer listed.
   */
  apply(desired: ReadonlyMap<string, boolean>): void
  /** Sends every known value again (`force`, e.g. after a reconnect). */
  resendAll(): void
  /** Feed `remote:client-status-changed`. */
  onStatus(status: { connected: boolean }): void
}

export function createPanelTowerSync(deps: PanelTowerSyncDeps): PanelTowerSync {
  const failedLogged = new Set<string>()
  let lastConnected: boolean | null = null

  const send = (id: string, tower: boolean): void => {
    let pending: Promise<unknown>
    try {
      pending = Promise.resolve(deps.setPanelTower(id, tower))
    } catch (error) {
      pending = Promise.reject(error)
    }
    pending.then(
      () => {
        failedLogged.delete(id)
        deps.log?.(`[tower-cards] panel Tower id=${id} → ${tower}`)
      },
      (error: unknown) => {
        if (failedLogged.has(id)) return
        failedLogged.add(id)
        deps.log?.(`[tower-cards] panel Tower id=${id} → ${tower} not sent (${(error instanceof Error ? error.message : String(error)).slice(0, 160)})`)
      },
    )
  }

  const sync: PanelTowerSync = {
    apply(desired) {
      let changed = false
      for (const id of [...decided.keys()]) {
        if (!desired.has(id)) {
          decided.delete(id)
          failedLogged.delete(id)
          changed = true
        }
      }
      for (const [id, tower] of desired) {
        if (decided.get(id) === tower) continue
        decided.set(id, tower)
        changed = true
        send(id, tower)
      }
      if (changed) notify()
    },
    resendAll() {
      for (const [id, tower] of decided) send(id, tower)
    },
    onStatus(status) {
      const was = lastConnected
      lastConnected = status.connected === true
      if (lastConnected && was === false) sync.resendAll()
    },
  }
  return sync
}
