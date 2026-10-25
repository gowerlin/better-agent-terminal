// T0701 (D184): what `ct:read-config-sources` answers — the two Control Tower config layers
// that live outside the workspace, read from the home directory of the host the window is bound to
// (local window → this machine; remote-profile window → its bat-server). The project layer
// (`_ct-workorders/_tower-config.yaml`) goes through the normal `fs:readFile` sandbox instead.
// Shared by electron/handlers/ct-config.ts and the renderer; no runtime code here.

export type CtConfigSourceFile =
  /** First candidate that exists; `content` is the raw file text. */
  | { status: 'found'; path: string; content: string }
  /** No candidate exists; `tried` lists them in lookup order. */
  | { status: 'missing'; tried: string[] }
  /** A candidate exists but could not be read (too large, permission, …). */
  | { status: 'error'; path: string; error: string }

export interface CtConfigSources {
  /** Home directory of the answering host (display only). */
  homeDir: string
  /** Layer 2: `~/.claude/control-tower-data/config.yaml`, then the legacy `~/.claude/control-tower-config.yaml`. */
  global: CtConfigSourceFile
  /** Layer 1: the installed Control Tower skill's `references/tower-config.md` (`~/.claude`, then `~/.codex`). */
  defaults: CtConfigSourceFile
}
