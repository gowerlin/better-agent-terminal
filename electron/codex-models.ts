// BUG-083 / T0370 — read the model list the Codex CLI keeps in `$CODEX_HOME/models_cache.json`.
//
// The cache is owned by the Codex CLI: BAT only reads it. Any failure (missing file, bad JSON,
// unexpected shape, no visible models) returns `undefined` so the caller falls back to the
// built-in list and the Codex panel never errors because of it.

import { promises as fs } from 'fs'
import os from 'os'
import * as pathModule from 'path'

export interface CodexModelInfo {
  value: string
  displayName: string
  description: string
  /** Raw `supported_reasoning_levels[].effort` values, in cache order. */
  efforts?: string[]
  defaultEffort?: string
}

export const CODEX_MODELS_CACHE_FILE = 'models_cache.json'

// The Codex model picker lists `visibility: "list"` entries; `"hide"` marks internal models
// (e.g. `codex-auto-review`). Entries without the field are kept.
function isVisible(visibility: unknown): boolean {
  return visibility === undefined || visibility === 'list'
}

function parseEfforts(levels: unknown): string[] | undefined {
  if (!Array.isArray(levels)) return undefined
  const efforts: string[] = []
  for (const level of levels) {
    const effort = typeof level === 'string' ? level : (level as { effort?: unknown } | null)?.effort
    if (typeof effort === 'string' && effort && !efforts.includes(effort)) efforts.push(effort)
  }
  return efforts.length > 0 ? efforts : undefined
}

export function parseCodexModelsCache(json: unknown): CodexModelInfo[] | undefined {
  if (!json || typeof json !== 'object') return undefined
  const models = (json as { models?: unknown }).models
  if (!Array.isArray(models)) return undefined

  const parsed: Array<CodexModelInfo & { priority: number }> = []
  for (const raw of models) {
    if (!raw || typeof raw !== 'object') continue
    const m = raw as Record<string, unknown>
    const slug = typeof m.slug === 'string' ? m.slug.trim() : ''
    if (!slug || !isVisible(m.visibility)) continue
    if (parsed.some(p => p.value === slug)) continue

    const info: CodexModelInfo & { priority: number } = {
      value: slug,
      displayName: typeof m.display_name === 'string' && m.display_name.trim() ? m.display_name : slug,
      description: typeof m.description === 'string' ? m.description : '',
      // Lower priority sorts first in the Codex picker; entries without one go last.
      priority: typeof m.priority === 'number' && Number.isFinite(m.priority) ? m.priority : Number.POSITIVE_INFINITY,
    }
    const efforts = parseEfforts(m.supported_reasoning_levels)
    if (efforts) info.efforts = efforts
    if (typeof m.default_reasoning_level === 'string' && m.default_reasoning_level) {
      info.defaultEffort = m.default_reasoning_level
    }
    parsed.push(info)
  }

  if (parsed.length === 0) return undefined
  // Array.prototype.sort is stable, so equal priorities keep cache order.
  parsed.sort((a, b) => a.priority - b.priority)
  return parsed.map(({ priority: _priority, ...info }) => info)
}

export function getCodexHome(): string {
  const fromEnv = process.env.CODEX_HOME?.trim()
  return fromEnv || pathModule.join(os.homedir(), '.codex')
}

export async function loadCodexModels(codexHome: string = getCodexHome()): Promise<CodexModelInfo[] | undefined> {
  try {
    const text = await fs.readFile(pathModule.join(codexHome, CODEX_MODELS_CACHE_FILE), 'utf8')
    return parseCodexModelsCache(JSON.parse(text))
  } catch {
    return undefined
  }
}
