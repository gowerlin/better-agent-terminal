/**
 * BUG-178 / T0730: Claude's user config directory — where the claude CLI keeps its sessions
 * (`projects/<encoded cwd>/<id>.jsonl`), `plugins/installed_plugins.json`, `settings.json`, the
 * user's `skills/` / `commands/` and `cache/`.
 *
 * Rule: `CLAUDE_CONFIG_DIR` when it holds something other than blanks (trimmed), otherwise
 * `<home>/.claude`. Unset or empty gives exactly the pre-T0730 path.
 *
 * 🔴 The single implementation. Every consumer passes the env of the claude it reads for, not
 * blindly this process's env:
 *   - Claude panel (SDK): the spawn env, `panelClaudeConfigDir` (electron/claude-agent-manager.ts);
 *   - claude settings for a launch: the tab's env (`defaultClaudeSettingsFiles`, electron/bat-mcp-launch.ts);
 *   - proxied handlers (`claude:scan-skills`, `ct:read-config-sources`, …): the answering host's env;
 *   - CT install detection: `claudeConfigDir` (electron/ct-install-detect.ts).
 * Do not inline `path.join(home, '.claude')` for any of these.
 *
 * Not the Claude config dir (do not route through here): `<home>/.claude/local` (the old local
 * install of the claude binary), Control Tower's own `<home>/.claude/control-tower-data`, a
 * project's `<cwd>/.claude`.
 *
 * Known differences from the CLI (2.1.316 / SDK 0.3.316: `(CLAUDE_CONFIG_DIR ?? join(homedir(),
 * '.claude')).normalize('NFC')`): the CLI keeps an empty or blank value as is (a relative path) and
 * normalises to NFC; BAT falls back to `<home>/.claude` and does not normalise, so that a user
 * without the variable reads the same path as before. See docs/agent-guide/claude-agent-sdk-cli.md.
 *
 * 🔴 No `electron` import (headless-electron-free guard).
 */
import * as os from 'os'
import * as path from 'path'

export type ClaudeConfigEnv = Readonly<Record<string, string | undefined>>

export function resolveClaudeConfigDir(
  env: ClaudeConfigEnv,
  homeDir: string = os.homedir(),
  join: (...parts: string[]) => string = path.join,
): string {
  const value = env.CLAUDE_CONFIG_DIR?.trim()
  return value ? value : join(homeDir, '.claude')
}
