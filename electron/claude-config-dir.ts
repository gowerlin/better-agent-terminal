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
 * Do not inline `path.join(home, '.claude')` for any of these. The plugins directory is
 * `resolveClaudePluginsDir` below (BUG-191), not `<config dir>/plugins` joined by hand.
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

export type ClaudePluginsPathApi = Pick<typeof path, 'join' | 'resolve' | 'isAbsolute'>

/**
 * BUG-191 / T0760: Claude's plugins directory — `installed_plugins.json`, `known_marketplaces.json`
 * and the plugin contents `cache/<marketplace>/<plugin>/<version>` (CLI 2.1.316 measured, T0760).
 *
 * Rule: `CLAUDE_CODE_PLUGIN_CACHE_DIR` when it holds something other than blanks (trimmed) — the
 * whole plugins directory moves there, not only `cache/` — else `<resolveClaudeConfigDir>/plugins`.
 * Like the CLI: `~` / `~/…` is under `homeDir`, a relative value is against the claude's cwd (`cwd`;
 * without one the value is returned as is). `settings.json` (`enabledPlugins`) stays in the config dir.
 * Unset, empty or blank gives exactly the pre-T0760 path.
 *
 * 🔴 The single implementation, env as for `resolveClaudeConfigDir` (the env of the claude it reads
 * for): `findClaudeCtPlugins` (electron/ct-install-detect.ts; the skill scans and the ct-config
 * default layer go through it) and the Claude panel's plugins list (`panelClaudePluginsDir`,
 * electron/claude-agent-manager.ts). Do not join `<config>/plugins` by hand.
 *
 * Not covered (known difference): the CLI's Cowork mode (`CLAUDE_CODE_USE_COWORK_PLUGINS`) uses
 * `<config>/cowork_plugins` and `<config>/cowork_settings.json`; BAT keeps `plugins`.
 */
export function resolveClaudePluginsDir(
  env: ClaudeConfigEnv,
  homeDir: string = os.homedir(),
  cwd?: string,
  pathApi: ClaudePluginsPathApi = path,
): string {
  const value = env.CLAUDE_CODE_PLUGIN_CACHE_DIR?.trim()
  if (!value) return pathApi.join(resolveClaudeConfigDir(env, homeDir, pathApi.join), 'plugins')
  if (value === '~') return homeDir
  if (/^~[\\/]/.test(value)) return pathApi.join(homeDir, value.slice(2))
  if (cwd && !pathApi.isAbsolute(value)) return pathApi.resolve(cwd, value)
  return value
}
