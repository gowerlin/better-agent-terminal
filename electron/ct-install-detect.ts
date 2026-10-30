/**
 * T0710: how Control Tower is installed on the host that launches the agent — a zip (manual)
 * install of the skills, the `ct` plugin (`ct@<marketplace>`, CT 5.14.0+), or both.
 *
 * The single implementation of:
 *   - the Codex skill name a dispatch sends (`resolveCodexSkillName`): `$ct-exec` for a manual
 *     install, `$ct:ct-exec` when only the plugin is there (Codex names plugin skills
 *     `<plugin>:<skill>` and a `$ct-exec` mention of a plugin-only install injects nothing,
 *     silently);
 *   - where the `ct` plugin lives (`ctPluginTowerConfigCandidates` for the ct-config default
 *     layer, `claudeCtPluginSkillDirs` for the skill panel / `*` completion);
 *   - T0711: each agent's installs (`detectCtInstalls`) for the overview's dual-install notice.
 *
 * Callers: helper dispatch (`createAgentPromptCommandBuilder`), the panel's one-click dispatch
 * (`terminal:control-tower-prompt`), `ct:read-config-sources` (electron/handlers/ct-config.ts)
 * and the claude skill scans (electron/handlers/claude.ts). 🔴 Do not inline these path rules
 * in a consumer.
 *
 * Read-only, never throws: anything that cannot be read or understood falls back to the
 * pre-T0710 behaviour (`$<skill>`, no plugin location). Nothing here logs file contents.
 *
 * 🔴 No `electron` import here (headless-electron-free guard). No TOML / semver dependency
 * (a new runtime dependency is a Tower decision and touches the `build.files` allowlist).
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import type { CtAgentInstalls, CtInstalls } from '../src/types/ct-config-sources'

/** The CT plugin's fixed name (CT `version-governance.md` § plugin 安裝／升級); the marketplace is not fixed. */
export const CT_PLUGIN_NAME = 'ct'

/** `ct@<marketplace>`: the plugin id in Codex `config.toml` and Claude `installed_plugins.json`. */
const CT_PLUGIN_ID_PATTERN = /^ct@([^@"'\s\]]+)$/

const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/

/** Codex `config.toml` and Claude `installed_plugins.json` / `settings.json` larger than this are not read. */
export const MAX_CT_DETECT_FILE_BYTES = 1024 * 1024

export type EnvLike = Record<string, string | undefined>

export interface CtInstallHost {
  /** Home directory of the host that runs the agent. */
  homeDir: string
  /** The env the agent gets (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_PLUGIN_CACHE_DIR`). */
  env: EnvLike
}

// ── Codex skill name (3-1) ──

export type CodexSkillNameReason =
  | 'manual'
  | 'plugin'
  | 'fallback-invalid-skill'
  | 'fallback-no-config'
  | 'fallback-read-error'
  | 'fallback-too-large'
  | 'fallback-parse-error'
  | 'fallback-no-plugin'
  | 'fallback-plugin-disabled'
  | 'fallback-no-enabled-line'
  /** The host could not judge (no resolver on this host, an older bat-server, the call failed). */
  | 'fallback-unsupported'
  | 'fallback-error'

export interface CodexSkillNameDecision {
  /** Skill name without the `$`: `ct-exec` or `ct:ct-exec`. */
  name: string
  reason: CodexSkillNameReason
  /** `plugin`: the marketplace of the enabled `ct@<marketplace>` table. */
  marketplace?: string
}

/** `CODEX_HOME` of the agent's env, else `<home>/.codex` (Codex's own default). */
export function codexHomeDir(host: CtInstallHost): string {
  const value = host.env.CODEX_HOME?.trim()
  return value ? value : path.join(host.homeDir, '.codex')
}

/**
 * The name `$<name>` a Codex agent on this host needs for a CT skill (T0710 3-1, order fixed by
 * the handover § 3-1):
 *   1. `<CODEX_HOME>/skills/<skill>/SKILL.md` or `<home>/.agents/skills/<skill>/SKILL.md` → `<skill>`
 *      (manual install; with both installs Codex uses this one too)
 *   2. `<CODEX_HOME>/config.toml` has `[plugins."ct@<any>"]` with `enabled = true` → `ct:<skill>`
 *   3. anything else (no config, unreadable, unparsable, no `enabled` line) → `<skill>`
 */
export async function resolveCodexSkillName(skill: string, host: CtInstallHost): Promise<CodexSkillNameDecision> {
  if (!SKILL_NAME_PATTERN.test(skill)) return { name: skill, reason: 'fallback-invalid-skill' }
  try {
    const codexHome = codexHomeDir(host)
    const manual = [
      path.join(codexHome, 'skills', skill, 'SKILL.md'),
      path.join(host.homeDir, '.agents', 'skills', skill, 'SKILL.md'),
    ]
    for (const file of manual) {
      if (await isFile(file)) return { name: skill, reason: 'manual' }
    }
    const config = await readSmallText(path.join(codexHome, 'config.toml'))
    if (!config.ok) {
      const reason = config.code === 'missing' ? 'fallback-no-config' : config.code === 'too-large' ? 'fallback-too-large' : 'fallback-read-error'
      return { name: skill, reason }
    }
    const plugin = findCodexCtPlugin(config.text)
    switch (plugin.status) {
      case 'enabled': return { name: `${CT_PLUGIN_NAME}:${skill}`, reason: 'plugin', marketplace: plugin.marketplace }
      case 'disabled': return { name: skill, reason: 'fallback-plugin-disabled' }
      case 'no-enabled-line': return { name: skill, reason: 'fallback-no-enabled-line' }
      case 'parse-error': return { name: skill, reason: 'fallback-parse-error' }
      case 'absent': return { name: skill, reason: 'fallback-no-plugin' }
    }
  } catch {
    return { name: skill, reason: 'fallback-error' }
  }
}

/**
 * The resolver a host hands to its dispatch paths. `customEnv` is the env the new tab is created
 * with (helper `customEnv`, the panel's global + workspace env vars): its `CODEX_HOME` wins over
 * the host's, the same way `PtyManager.buildPtyEnv` layers them. An empty `CODEX_HOME` there is
 * an unset one (Codex then uses `<home>/.codex`).
 */
export function createCodexSkillNameResolver(host: CtInstallHost): (skill: string, customEnv?: Record<string, string>) => Promise<CodexSkillNameDecision> {
  return (skill, customEnv) => {
    const env = customEnv && Object.prototype.hasOwnProperty.call(customEnv, 'CODEX_HOME')
      ? { ...host.env, CODEX_HOME: customEnv.CODEX_HOME }
      : host.env
    return resolveCodexSkillName(skill, { homeDir: host.homeDir, env })
  }
}

export type CodexCtPluginState =
  | { status: 'enabled'; marketplace: string }
  | { status: 'disabled' }
  | { status: 'no-enabled-line' }
  | { status: 'absent' }
  | { status: 'parse-error' }

/**
 * Finds `[plugins."ct@<marketplace>"]` tables in Codex `config.toml` text and their
 * `enabled = true|false`. Only that header form and that key are understood; everything else is
 * ignored (other tables, dotted keys, inline tables → `absent`). Lines inside multi-line strings
 * are skipped. Any table enabled → `enabled`; a `ct@…` table twice, or an `enabled` that is not
 * a bare boolean → `parse-error`.
 */
export function findCodexCtPlugin(text: string): CodexCtPluginState {
  const tables = new Map<string, boolean | null>()
  let current: string | null = null
  let multiline: '"""' | "'''" | null = null
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (multiline) {
      if (countOccurrences(rawLine, multiline) % 2 === 1) multiline = null
      continue
    }
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    if (line.startsWith('[')) {
      const header = line.match(/^\[\s*plugins\s*\.\s*(?:"([^"\\]*)"|'([^']*)')\s*\]\s*(?:#.*)?$/)
      const id = header ? (header[1] ?? header[2]) : null
      const marketplace = id ? id.match(CT_PLUGIN_ID_PATTERN)?.[1] : undefined
      if (marketplace) {
        if (tables.has(marketplace)) return { status: 'parse-error' }
        tables.set(marketplace, null)
        current = marketplace
      } else {
        current = null
      }
      continue
    }
    for (const quote of ['"""', "'''"] as const) {
      if (countOccurrences(rawLine, quote) % 2 === 1) multiline = quote
    }
    if (current === null) continue
    const enabled = line.match(/^enabled\s*=\s*(.*?)\s*(?:#.*)?$/)
    if (!enabled) continue
    if (enabled[1] === 'true') tables.set(current, true)
    else if (enabled[1] === 'false') tables.set(current, false)
    else return { status: 'parse-error' }
  }
  if (tables.size === 0) return { status: 'absent' }
  for (const [marketplace, enabled] of tables) {
    if (enabled === true) return { status: 'enabled', marketplace }
  }
  return [...tables.values()].some(enabled => enabled === false) ? { status: 'disabled' } : { status: 'no-enabled-line' }
}

function countOccurrences(text: string, needle: string): number {
  let count = 0
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) count++
  return count
}

// ── CT plugin locations (3-2 / 3-3) ──

export interface CtPluginInstall {
  agent: 'claude' | 'codex'
  /** `ct@<marketplace>` */
  id: string
  version: string
  /** The plugin root (its `skills/` holds the CT skills). */
  root: string
}

/**
 * Orders plugin versions: dotted numeric releases (`5.14.0`) by number, a pre-release
 * (`5.14.0-pre.1`) below its release, build metadata (`+…`) ignored; anything that is not a
 * version sorts below every version, then by text. Returns < 0 when `a` is older.
 */
export function compareCtPluginVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) {
    if (pa) return 1
    if (pb) return -1
    return a < b ? -1 : a > b ? 1 : 0
  }
  const length = Math.max(pa.release.length, pb.release.length)
  for (let i = 0; i < length; i++) {
    const diff = (pa.release[i] ?? 0) - (pb.release[i] ?? 0)
    if (diff !== 0) return diff
  }
  if (pa.pre === null || pb.pre === null) {
    if (pa.pre === pb.pre) return 0
    return pa.pre === null ? 1 : -1
  }
  const ia = pa.pre.split('.')
  const ib = pb.pre.split('.')
  for (let i = 0; i < Math.max(ia.length, ib.length); i++) {
    if (ia[i] === undefined) return -1
    if (ib[i] === undefined) return 1
    const na = /^\d+$/.test(ia[i]) ? Number(ia[i]) : null
    const nb = /^\d+$/.test(ib[i]) ? Number(ib[i]) : null
    if (na !== null && nb !== null) {
      if (na !== nb) return na - nb
    } else if (na !== null || nb !== null) {
      return na !== null ? -1 : 1
    } else if (ia[i] !== ib[i]) {
      return ia[i] < ib[i] ? -1 : 1
    }
  }
  return 0
}

function parseVersion(version: string): { release: number[]; pre: string | null } | null {
  const match = version.trim().replace(/^v/i, '').match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)
  if (!match) return null
  return { release: match[1].split('.').map(Number), pre: match[2] ?? null }
}

function newestFirst(installs: CtPluginInstall[]): CtPluginInstall[] {
  return [...installs].sort((a, b) => compareCtPluginVersions(b.version, a.version))
}

/** `CLAUDE_CONFIG_DIR`, else `<home>/.claude`. */
export function claudeConfigDir(host: CtInstallHost): string {
  const value = host.env.CLAUDE_CONFIG_DIR?.trim()
  return value ? value : path.join(host.homeDir, '.claude')
}

/**
 * Claude's installed `ct@*` plugins, newest first, from `<CLAUDE_CONFIG_DIR>/plugins/installed_plugins.json`
 * (v2: `plugins: { "ct@mkt": [{ scope, installPath, version, projectPath? }] }`; a single object
 * per id is accepted too). Kept: `user` / `managed` scope (or none), and `project` / `local` only
 * when `projectPath` is `cwd`. Skipped: an id the user settings disable (`enabledPlugins[id] === false`).
 * `installPath` missing → `<CLAUDE_CODE_PLUGIN_CACHE_DIR | <config>/plugins>/cache/<mkt>/ct/<version>`.
 */
export async function findClaudeCtPlugins(host: CtInstallHost, cwd?: string): Promise<CtPluginInstall[]> {
  const configDir = claudeConfigDir(host)
  const installed = await readSmallJson(path.join(configDir, 'plugins', 'installed_plugins.json'))
  const plugins = installed && typeof installed === 'object' ? (installed as { plugins?: unknown }).plugins : undefined
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) return []
  const settings = await readSmallJson(path.join(configDir, 'settings.json'))
  const enabledPlugins = settings && typeof settings === 'object' ? (settings as { enabledPlugins?: unknown }).enabledPlugins : undefined
  const cacheRoot = host.env.CLAUDE_CODE_PLUGIN_CACHE_DIR?.trim() || path.join(configDir, 'plugins')

  const found: CtPluginInstall[] = []
  for (const [id, value] of Object.entries(plugins as Record<string, unknown>)) {
    const marketplace = id.match(CT_PLUGIN_ID_PATTERN)?.[1]
    if (!marketplace) continue
    if (enabledPlugins && typeof enabledPlugins === 'object' && (enabledPlugins as Record<string, unknown>)[id] === false) continue
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (!entry || typeof entry !== 'object') continue
      const record = entry as { scope?: unknown; installPath?: unknown; version?: unknown; projectPath?: unknown }
      const scope = typeof record.scope === 'string' ? record.scope : 'user'
      if (scope === 'project' || scope === 'local') {
        if (!cwd || typeof record.projectPath !== 'string' || !samePath(record.projectPath, cwd)) continue
      } else if (scope !== 'user' && scope !== 'managed') {
        continue
      }
      const version = typeof record.version === 'string' ? record.version : ''
      const root = typeof record.installPath === 'string' && record.installPath
        ? record.installPath
        : version ? path.join(cacheRoot, 'cache', marketplace, CT_PLUGIN_NAME, version) : ''
      if (!root) continue
      found.push({ agent: 'claude', id, version: version || path.basename(root), root })
    }
  }
  return newestFirst(found)
}

/** Codex's cached `ct` plugins, newest first: `<CODEX_HOME>/plugins/cache/<mkt>/ct/<version>`. */
export async function findCodexCtPlugins(host: CtInstallHost): Promise<CtPluginInstall[]> {
  const cache = path.join(codexHomeDir(host), 'plugins', 'cache')
  const found: CtPluginInstall[] = []
  for (const marketplace of await listDirs(cache)) {
    const pluginDir = path.join(cache, marketplace, CT_PLUGIN_NAME)
    for (const version of await listDirs(pluginDir)) {
      found.push({ agent: 'codex', id: `${CT_PLUGIN_NAME}@${marketplace}`, version, root: path.join(pluginDir, version) })
    }
  }
  return newestFirst(found)
}

/** `skills/control-tower/references/tower-config.md` of a plugin root. */
export function pluginTowerConfigPath(root: string): string {
  return path.join(root, 'skills', 'control-tower', 'references', 'tower-config.md')
}

/**
 * T0710 3-2: where the ct-config default layer looks after the manual installs — the Claude
 * plugin, then the Codex plugin, each newest version first, only versions that have the file.
 */
export async function ctPluginTowerConfigCandidates(host: CtInstallHost): Promise<string[]> {
  const installs = [...await findClaudeCtPlugins(host), ...await findCodexCtPlugins(host)]
  const candidates: string[] = []
  for (const install of installs) {
    const file = pluginTowerConfigPath(install.root)
    if (await isFile(file)) candidates.push(file)
  }
  return candidates
}

/** T0710 3-3: the `skills/` directories of Claude's `ct@*` plugins (newest first) — only `ct@*`, no other plugin. */
export async function claudeCtPluginSkillDirs(host: CtInstallHost, cwd?: string): Promise<{ dir: string; scope: 'project' | 'global' }[]> {
  const installs = await findClaudeCtPlugins(host, cwd)
  return installs.map(install => ({ dir: path.join(install.root, 'skills'), scope: 'global' as const }))
}

// ── Both installs at once (T0711) ──

/** `<!-- control-tower-version: x.y.z -->` / `<!-- ct-exec-version: x.y.z -->` in a manual install's SKILL.md. */
const MANUAL_VERSION_PATTERN = /<!--\s*(?:control-tower|ct-exec)-version:\s*([^\s>]+)\s*-->/

const NO_INSTALLS: CtAgentInstalls = { manual: null, plugin: null }

/**
 * T0711 (T0710 3-4): Claude's and Codex's CT installs on this host, each looked at in full
 * (no short-circuit), so the overview can tell when one agent has both a zip install and the
 * plugin — `/ct-exec` / `$ct-exec` then runs the zip one.
 *   - manual: Claude `<CLAUDE_CONFIG_DIR>/skills`, Codex `<CODEX_HOME>/skills` then
 *     `<home>/.agents/skills` (the 3-1 order); a directory counts when it has `ct-exec/SKILL.md` or
 *     `control-tower/SKILL.md`; version from `control-tower/SKILL.md`, else `ct-exec/SKILL.md`.
 *   - plugin: Claude `findClaudeCtPlugins` (user / managed scope, not disabled), newest;
 *     Codex an enabled `[plugins."ct@<mkt>"]` in `config.toml`, version from its cache directory.
 * An unreadable version is `null`, not an error; any failure leaves that agent without installs.
 */
export async function detectCtInstalls(host: CtInstallHost): Promise<CtInstalls> {
  const [claude, codex] = await Promise.all([
    detectClaudeInstalls(host).catch(() => NO_INSTALLS),
    detectCodexInstalls(host).catch(() => NO_INSTALLS),
  ])
  return { claude, codex }
}

async function detectClaudeInstalls(host: CtInstallHost): Promise<CtAgentInstalls> {
  const manual = await findManualInstall([path.join(claudeConfigDir(host), 'skills')])
  const newest = (await findClaudeCtPlugins(host))[0]
  const plugin = newest
    ? { version: versionOrNull(newest.version), marketplace: newest.id.slice(CT_PLUGIN_NAME.length + 1) }
    : null
  return { manual, plugin }
}

async function detectCodexInstalls(host: CtInstallHost): Promise<CtAgentInstalls> {
  const codexHome = codexHomeDir(host)
  const manual = await findManualInstall([path.join(codexHome, 'skills'), path.join(host.homeDir, '.agents', 'skills')])
  let plugin: CtAgentInstalls['plugin'] = null
  const config = await readSmallText(path.join(codexHome, 'config.toml'))
  const state = config.ok ? findCodexCtPlugin(config.text) : null
  if (state?.status === 'enabled') {
    const id = `${CT_PLUGIN_NAME}@${state.marketplace}`
    const cached = (await findCodexCtPlugins(host)).find(install => install.id === id)
    plugin = { version: cached ? versionOrNull(cached.version) : null, marketplace: state.marketplace }
  }
  return { manual, plugin }
}

async function findManualInstall(skillDirs: string[]): Promise<CtAgentInstalls['manual']> {
  for (const dir of skillDirs) {
    const files = [path.join(dir, 'control-tower', 'SKILL.md'), path.join(dir, 'ct-exec', 'SKILL.md')]
    let found = false
    for (const file of files) {
      if (!await isFile(file)) continue
      found = true
      const read = await readSmallText(file)
      const version = read.ok ? read.text.match(MANUAL_VERSION_PATTERN)?.[1] : undefined
      if (version && versionOrNull(version)) return { version: versionOrNull(version) }
    }
    if (found) return { version: null }
  }
  return null
}

/** A plugin cache directory name or a SKILL.md marker that is not a version → `null`. */
function versionOrNull(version: string): string | null {
  return parseVersion(version) ? version.trim().replace(/^v/i, '') : null
}

// ── fs helpers (never throw) ──

async function isFile(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile()
  } catch {
    return false
  }
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  } catch {
    return []
  }
}

type SmallText = { ok: true; text: string } | { ok: false; code: 'missing' | 'too-large' | 'error' }

async function readSmallText(file: string): Promise<SmallText> {
  try {
    const stat = await fs.stat(file)
    if (!stat.isFile()) return { ok: false, code: 'error' }
    if (stat.size > MAX_CT_DETECT_FILE_BYTES) return { ok: false, code: 'too-large' }
    return { ok: true, text: await fs.readFile(file, 'utf-8') }
  } catch (err) {
    return { ok: false, code: (err as NodeJS.ErrnoException)?.code === 'ENOENT' ? 'missing' : 'error' }
  }
}

async function readSmallJson(file: string): Promise<unknown> {
  const read = await readSmallText(file)
  if (!read.ok) return null
  try {
    return JSON.parse(read.text.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

function samePath(a: string, b: string): boolean {
  const norm = (p: string) => {
    const resolved = path.resolve(p).replace(/[\\/]+$/, '')
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return norm(a) === norm(b)
}
