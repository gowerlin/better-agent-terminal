/**
 * BUG-231 / T0951: the agent launch command the renderer types into a new shell.
 *
 * A new / restored / restarted (⏻) / resumed agent tab gets its launch command 500 ms after
 * `pty:create` / `pty:restart` — while the tab already has the keyboard focus. What the user typed
 * in between reached the shell first and the command was appended to it (BUG-231, the BUG-151
 * situation without a helper). The fix is the host's: a create / restart with
 * `holdInputUntilLaunch: true` makes PtyManager hold the input of the new shell
 * (`holdInputForLaunch`, the same hold as the helper dispatch's `holdInputForDispatch`), and
 * `pty:launch-command` writes the command, then the held input (`writeLaunchCommand`).
 *
 * Here only the wiring: every renderer launch write goes through `sendLaunchCommand`; a path that
 * asked for the hold and then types nothing calls `releaseLaunchHold` (the input is written as it
 * is). A host before T0951 rejects `pty:launch-command` (`No handler`) and ignored the flag (no hold),
 * so the command falls back to the plain `pty:write` of before.
 */

/** The wait between a new shell and its launch command (unchanged since before T0951). */
export const LAUNCH_COMMAND_DELAY_MS = 500

export interface LaunchCommandApi {
  write: (id: string, data: string) => Promise<unknown>
  launchCommand?: (id: string, command: string | null) => Promise<unknown>
}

function ptyApi(): LaunchCommandApi {
  return window.electronAPI.pty
}

/** Writes `data` (the command with its `\r`) now: after the held input's hold, else a plain write. */
export async function writeLaunchCommandNow(id: string, data: string, api: LaunchCommandApi = ptyApi()): Promise<void> {
  if (api.launchCommand) {
    try {
      await api.launchCommand(id, data)
      return
    } catch {
      // A host before T0951 (`No handler for channel: pty:launch-command`): it held nothing either.
    }
  }
  await api.write(id, data)
}

/**
 * The launch command `data` (with its `\r`) of tab `id`, `LAUNCH_COMMAND_DELAY_MS` from now — the
 * `setTimeout(() => pty.write(id, data), 500)` of before, through the host's input hold.
 */
export function sendLaunchCommand(id: string, data: string, api?: LaunchCommandApi): void {
  setTimeout(() => {
    void writeLaunchCommandNow(id, data, api ?? ptyApi()).catch(() => undefined)
  }, LAUNCH_COMMAND_DELAY_MS)
}

/** The shell was created / restarted with `holdInputUntilLaunch` but gets no command: release the input now. */
export function releaseLaunchHold(id: string, api: LaunchCommandApi = ptyApi()): void {
  if (!api.launchCommand) return
  void api.launchCommand(id, null).catch(() => undefined) // a host before T0951 held nothing
}
