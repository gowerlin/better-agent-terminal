// BUG-083 / T0370 — models_cache.json parsing and loading.
//
// The fixture mirrors the shape of a Codex 0.159.2 `~/.codex/models_cache.json` (fields BAT does
// not read, e.g. `model_messages`, are trimmed).

import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import * as path from 'path'

import { parseCodexModelsCache, loadCodexModels, getCodexHome, CODEX_MODELS_CACHE_FILE } from '../codex-models'

const levels = (...efforts: string[]) => efforts.map(effort => ({ effort, description: `${effort} desc` }))

const CACHE = {
  fetched_at: '2026-10-04T08:05:48.401393700Z',
  client_version: '0.159.2',
  models: [
    { slug: 'gpt-6-luna', display_name: 'GPT-6-Luna', description: 'Fast and affordable model for easier tasks.', default_reasoning_level: 'medium', supported_reasoning_levels: levels('low', 'medium', 'high', 'xhigh', 'max'), visibility: 'list', supported_in_api: true, priority: 4 },
    { slug: 'gpt-reserve', display_name: 'GPT-Reserve', description: 'Fast and affordable agentic coding model.', default_reasoning_level: 'medium', supported_reasoning_levels: levels('low', 'medium', 'high', 'xhigh', 'max'), visibility: 'hide', supported_in_api: true, priority: 4 },
    { slug: 'gpt-5.6-terra', display_name: 'GPT-5.6-Terra', description: 'Older balanced model for straightforward work.', default_reasoning_level: 'medium', supported_reasoning_levels: levels('low', 'medium', 'high', 'xhigh', 'max', 'ultra'), visibility: 'list', supported_in_api: true, priority: 8 },
    { slug: 'gpt-5.6-luna', display_name: 'GPT-5.6-Luna', description: 'Older fast and efficient model.', default_reasoning_level: 'medium', supported_reasoning_levels: levels('low', 'medium', 'high', 'xhigh', 'max'), visibility: 'list', supported_in_api: true, priority: 9 },
    { slug: 'gpt-5.5', display_name: 'GPT-5.5', description: 'Legacy coding model.', default_reasoning_level: 'medium', supported_reasoning_levels: levels('low', 'medium', 'high', 'xhigh'), visibility: 'list', supported_in_api: true, priority: 13 },
    { slug: 'codex-auto-review', display_name: 'Codex Auto Review', description: 'Automatic approval review model for Codex.', default_reasoning_level: 'medium', supported_reasoning_levels: levels('low', 'medium', 'high', 'xhigh', 'max'), visibility: 'hide', supported_in_api: true, priority: 43 },
  ],
}

describe('parseCodexModelsCache', () => {
  it('maps a valid cache to visible models in priority order', () => {
    expect(parseCodexModelsCache(CACHE)).toEqual([
      { value: 'gpt-6-luna', displayName: 'GPT-6-Luna', description: 'Fast and affordable model for easier tasks.', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'medium' },
      { value: 'gpt-5.6-terra', displayName: 'GPT-5.6-Terra', description: 'Older balanced model for straightforward work.', efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultEffort: 'medium' },
      { value: 'gpt-5.6-luna', displayName: 'GPT-5.6-Luna', description: 'Older fast and efficient model.', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'medium' },
      { value: 'gpt-5.5', displayName: 'GPT-5.5', description: 'Legacy coding model.', efforts: ['low', 'medium', 'high', 'xhigh'], defaultEffort: 'medium' },
    ])
  })

  it('filters visibility "hide" entries', () => {
    const slugs = parseCodexModelsCache(CACHE)?.map(m => m.value)
    expect(slugs).not.toContain('gpt-reserve')
    expect(slugs).not.toContain('codex-auto-review')
  })

  it('keeps entries without visibility, sorts missing priority last, keeps cache order on ties', () => {
    const result = parseCodexModelsCache({
      models: [
        { slug: 'no-priority' },
        { slug: 'b', priority: 2 },
        { slug: 'a', priority: 1 },
        { slug: 'b2', priority: 2 },
      ],
    })
    expect(result?.map(m => m.value)).toEqual(['a', 'b', 'b2', 'no-priority'])
    expect(result?.[3]).toEqual({ value: 'no-priority', displayName: 'no-priority', description: '' })
  })

  it('skips malformed entries and duplicate slugs', () => {
    const result = parseCodexModelsCache({
      models: [null, 'gpt-x', { slug: '' }, { display_name: 'No slug' }, { slug: 'ok', priority: 1 }, { slug: 'ok', priority: 0 }],
    })
    expect(result?.map(m => m.value)).toEqual(['ok'])
  })

  it('accepts plain-string reasoning levels and drops junk ones', () => {
    const result = parseCodexModelsCache({ models: [{ slug: 'm', supported_reasoning_levels: ['low', { effort: 'max' }, 42, { effort: '' }, 'low'] }] })
    expect(result?.[0].efforts).toEqual(['low', 'max'])
  })

  it('returns undefined for a malformed cache', () => {
    expect(parseCodexModelsCache(undefined)).toBeUndefined()
    expect(parseCodexModelsCache(null)).toBeUndefined()
    expect(parseCodexModelsCache('models')).toBeUndefined()
    expect(parseCodexModelsCache([])).toBeUndefined()
    expect(parseCodexModelsCache({})).toBeUndefined()
    expect(parseCodexModelsCache({ models: {} })).toBeUndefined()
  })

  it('returns undefined when no visible model remains', () => {
    expect(parseCodexModelsCache({ models: [] })).toBeUndefined()
    expect(parseCodexModelsCache({ models: [{ slug: 'x', visibility: 'hide' }] })).toBeUndefined()
  })
})

describe('loadCodexModels', () => {
  const tempDirs: string[] = []
  const makeHome = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bat-codex-models-'))
    tempDirs.push(dir)
    return dir
  }

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
  })

  it('reads models_cache.json from the given CODEX_HOME', async () => {
    const home = await makeHome()
    await fs.writeFile(path.join(home, CODEX_MODELS_CACHE_FILE), JSON.stringify(CACHE), 'utf8')
    expect((await loadCodexModels(home))?.map(m => m.value)).toEqual(['gpt-6-luna', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5'])
  })

  it('returns undefined when the file does not exist', async () => {
    expect(await loadCodexModels(await makeHome())).toBeUndefined()
  })

  it('returns undefined for invalid JSON', async () => {
    const home = await makeHome()
    await fs.writeFile(path.join(home, CODEX_MODELS_CACHE_FILE), '{ not json', 'utf8')
    expect(await loadCodexModels(home)).toBeUndefined()
  })

  it('returns undefined when the JSON has the wrong shape', async () => {
    const home = await makeHome()
    await fs.writeFile(path.join(home, CODEX_MODELS_CACHE_FILE), JSON.stringify({ models: 'nope' }), 'utf8')
    expect(await loadCodexModels(home)).toBeUndefined()
  })
})

describe('getCodexHome', () => {
  const original = process.env.CODEX_HOME

  afterEach(() => {
    if (original === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = original
  })

  it('uses CODEX_HOME when set', () => {
    process.env.CODEX_HOME = path.join('custom', 'codex-home')
    expect(getCodexHome()).toBe(path.join('custom', 'codex-home'))
  })

  it('falls back to ~/.codex when CODEX_HOME is unset or blank', () => {
    delete process.env.CODEX_HOME
    expect(getCodexHome()).toBe(path.join(os.homedir(), '.codex'))
    process.env.CODEX_HOME = '   '
    expect(getCodexHome()).toBe(path.join(os.homedir(), '.codex'))
  })
})
