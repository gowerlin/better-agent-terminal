// T0710: what `terminal:control-tower-prompt` takes and answers — the CT skill prompt of the
// panel's one-click dispatch (src/utils/control-tower-launch.ts), decided and quoted by the host
// that will run the tab (local window → this machine; remote-profile window → its bat-server).
// Shared by electron/terminal-command-handlers.ts and the renderer; no runtime code here.

export interface ControlTowerPromptRequest {
  /** Agent preset / id of the tab (`codex-cli`, `codex-agent`, `claude-cli`, …). */
  agent: string
  /** `ct-exec` or `ct-done`. */
  skill: string
  workorder: string
  /** The env the tab will be created with (its `CODEX_HOME` wins over the host's). */
  customEnv?: Record<string, string>
}

/** `name` without the `$`; `reason` = `manual` / `plugin` / `fallback-<why>` (electron/ct-install-detect.ts). */
export interface ControlTowerSkillName {
  name: string
  reason: string
  marketplace?: string
}

export type ControlTowerPromptResult =
  | {
    ok: true
    /** e.g. `$ct:ct-exec T0710` (codex) or `/ct-exec T0710` (claude). */
    prompt: string
    /** `prompt` quoted for the shell `terminal:create-with-command` starts when given no `shell`. */
    quotedPrompt: string
    shellFamily: 'posix' | 'pwsh' | 'cmd'
    /** Codex only. */
    skillName?: ControlTowerSkillName
  }
  | { ok: false; error: string }
