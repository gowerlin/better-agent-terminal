// @vitest-environment node
/**
 * BUG-119 / T0480: snippetDb must not read userData at import time (that is what
 * made Chromium cache the legacy directory). The path is resolved on first use.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ userData: '', getPathCalls: 0 }))

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      state.getPathCalls++
      if (name !== 'userData') throw new Error(`unexpected getPath(${name})`)
      return state.userData
    },
  },
}))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

describe('snippetDb lazy userData', () => {
  beforeEach(() => {
    vi.resetModules()
    state.getPathCalls = 0
    state.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0480-snippets-'))
  })

  afterEach(() => {
    fs.rmSync(state.userData, { recursive: true, force: true })
  })

  it('does not call getPath on import', async () => {
    await import('../snippet-db')
    expect(state.getPathCalls).toBe(0)
  })

  it('reads the userData resolved at first use (after bootstrap set it)', async () => {
    const { snippetDb } = await import('../snippet-db')
    fs.writeFileSync(path.join(state.userData, 'snippets.json'), JSON.stringify({
      snippets: [{ id: 3, title: 't', content: 'c', format: 'plaintext', isFavorite: false, createdAt: 1, updatedAt: 1 }],
      nextId: 4,
    }))
    const all = snippetDb.getAll()
    expect(all.map(s => s.title)).toEqual(['t'])
    // Old snippets without `action` are backfilled and saved, as before.
    expect(all[0].action).toBe('terminal')
    expect(state.getPathCalls).toBe(1)

    const created = snippetDb.create({ title: 'n', content: 'x' })
    expect(created.id).toBe(4)
    snippetDb.getByWorkspace(undefined)
    expect(state.getPathCalls).toBe(1)
    const saved = JSON.parse(fs.readFileSync(path.join(state.userData, 'snippets.json'), 'utf-8'))
    expect(saved.snippets.map((s: { title: string }) => s.title)).toEqual(['t', 'n'])
    expect(saved.nextId).toBe(5)
  })

  it('every public read path loads the file first', async () => {
    fs.writeFileSync(path.join(state.userData, 'snippets.json'), JSON.stringify({
      snippets: [{ id: 1, title: 'fav', content: 'c', format: 'plaintext', action: 'terminal', category: 'k', isFavorite: true, createdAt: 1, updatedAt: 1 }],
      nextId: 2,
    }))
    const probes: Array<(db: typeof import('../snippet-db')['snippetDb']) => unknown> = [
      db => db.getById(1)?.title,
      db => db.getFavorites().length,
      db => db.getByCategory('k').length,
      db => db.search('fav').length,
      db => db.getCategories(),
      db => db.getByWorkspace('ws').length,
    ]
    const expected = ['fav', 1, 1, 1, ['k'], 1]
    for (let i = 0; i < probes.length; i++) {
      vi.resetModules()
      const { snippetDb } = await import('../snippet-db')
      expect(probes[i](snippetDb)).toEqual(expected[i])
    }
  })
})
