/**
 * T0701 (D184): `ct:read-config-sources`, registered by both Electron main and the headless
 * bat-server (see ./types.ts). Reads the Control Tower config layers that live in the home
 * directory of the host that answers the call:
 *   - local window → this machine
 *   - remote-profile window → proxied to its bat-server → the remote user's home
 *     (a bat-server without this handler answers `No handler for channel`; the panel then says
 *     the layers cannot be read and never substitutes this machine's files)
 *
 * Read-only, fixed paths under `homeDir` only: the call takes no argument, so it cannot be
 * pointed anywhere else. Nothing is written, nothing is logged beyond read failures.
 *
 * T0710 (3-2): when no manual install has `tower-config.md`, the default layer reads the CT
 * plugin's copy (Claude `ct@*` plugin, then Codex, newest version first; the path shows
 * `plugins/cache/<marketplace>/ct/<version>`). The locations are `ctPluginTowerConfigCandidates`
 * (electron/ct-install-detect.ts), from this host's `CLAUDE_CONFIG_DIR` / `CLAUDE_CODE_PLUGIN_CACHE_DIR`
 * / `CODEX_HOME`.
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '../logger'
import { codexHomeDir, ctPluginTowerConfigCandidates, type CtInstallHost, type EnvLike } from '../ct-install-detect'
import type { CtConfigSourceFile, CtConfigSources } from '../../src/types/ct-config-sources'
import type { HandlerRegistrar } from './types'

export const CT_CONFIG_SOURCES_CHANNEL = 'ct:read-config-sources'

/** Same cap as `fs:readFile`. */
const MAX_CT_CONFIG_FILE_BYTES = 512 * 1024

/**
 * Lookup order per layer (CT `tower-config.md` § 三層設定架構: the new global path wins).
 * Defaults: the manual installs only; T0710 adds `<CODEX_HOME>/skills/…` when `CODEX_HOME` is set
 * elsewhere, and `readCtConfigSources` appends the plugin copies after these.
 */
export function ctConfigCandidates(homeDir: string, env: EnvLike = {}): { global: string[]; defaults: string[] } {
  const manualCodex = path.join(homeDir, '.codex', 'skills', 'control-tower', 'references', 'tower-config.md')
  const envCodex = path.join(codexHomeDir({ homeDir, env }), 'skills', 'control-tower', 'references', 'tower-config.md')
  return {
    global: [
      path.join(homeDir, '.claude', 'control-tower-data', 'config.yaml'),
      path.join(homeDir, '.claude', 'control-tower-config.yaml'),
    ],
    defaults: [
      path.join(homeDir, '.claude', 'skills', 'control-tower', 'references', 'tower-config.md'),
      manualCodex,
      ...(envCodex !== manualCodex ? [envCodex] : []),
    ],
  }
}

/** The first candidate that exists. A missing file moves on; any other failure stops there. */
export async function readFirstExisting(candidates: readonly string[]): Promise<CtConfigSourceFile> {
  for (const candidate of candidates) {
    let size: number
    try {
      size = (await fs.stat(candidate)).size
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') continue
      return readError(candidate, err)
    }
    if (size > MAX_CT_CONFIG_FILE_BYTES) return { status: 'error', path: candidate, error: 'File too large' }
    try {
      return { status: 'found', path: candidate, content: await fs.readFile(candidate, 'utf-8') }
    } catch (err) {
      return readError(candidate, err)
    }
  }
  return { status: 'missing', tried: [...candidates] }
}

function readError(candidate: string, err: unknown): CtConfigSourceFile {
  const error = err instanceof Error ? err.message : String(err)
  logger.warn(`[ct-config] read failed: ${candidate}: ${error}`)
  return { status: 'error', path: candidate, error }
}

/**
 * `env` = the answering host's env (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_PLUGIN_CACHE_DIR`);
 * empty (tests) = the defaults under `homeDir`.
 */
export async function readCtConfigSources(homeDir: string, env: EnvLike = {}): Promise<CtConfigSources> {
  const candidates = ctConfigCandidates(homeDir, env)
  const host: CtInstallHost = { homeDir, env }
  const [global, defaults] = await Promise.all([
    readFirstExisting(candidates.global),
    readDefaults(candidates.defaults, host),
  ])
  return { homeDir, global, defaults }
}

/** T0710 (3-2): a manual install wins (it is what runs); only when none exists, the plugin copies. */
async function readDefaults(manual: string[], host: CtInstallHost): Promise<CtConfigSourceFile> {
  const fromManual = await readFirstExisting(manual)
  if (fromManual.status !== 'missing') return fromManual
  const plugin = await ctPluginTowerConfigCandidates(host)
  if (plugin.length === 0) return fromManual
  const fromPlugin = await readFirstExisting(plugin)
  return fromPlugin.status === 'missing' ? fromManual : fromPlugin
}

export function registerCtConfigHandlers(register: HandlerRegistrar, deps: { homeDir: string; env?: EnvLike }): void {
  register(CT_CONFIG_SOURCES_CHANNEL, () => readCtConfigSources(deps.homeDir, deps.env ?? process.env))
}
