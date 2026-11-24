/**
 * PLAN-068 W6 / T0909: the window's panel Tower decisions and what reaches the host
 * (`tower-cards:set-panel-tower`), plus `decidePanelTowers` over the window's workspaces.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPanelTowerSync, isPanelTowerHere, resetPanelTowerStore } from '../panel-tower-store'
import { decidePanelTowers } from '../../components/inbox/PanelTowerSync'

afterEach(() => resetPanelTowerStore())

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('createPanelTowerSync', () => {
  it('first sight sends the value (true or false); then only changes', async () => {
    const setPanelTower = vi.fn(async () => ({ ok: true, changed: 1 }))
    const sync = createPanelTowerSync({ setPanelTower })
    sync.apply(new Map([['a', true], ['b', false]]))
    expect(setPanelTower.mock.calls).toEqual([['a', true], ['b', false]])
    expect(isPanelTowerHere('a')).toBe(true)
    expect(isPanelTowerHere('b')).toBe(false)
    sync.apply(new Map([['a', true], ['b', false]]))
    expect(setPanelTower).toHaveBeenCalledTimes(2)
    sync.apply(new Map([['a', false], ['b', false]]))
    expect(setPanelTower.mock.calls[2]).toEqual(['a', false])
    expect(isPanelTowerHere('a')).toBe(false)
  })

  it('a panel no longer listed is forgotten (sent again on its next sight)', () => {
    const setPanelTower = vi.fn(async () => ({ ok: true, changed: 1 }))
    const sync = createPanelTowerSync({ setPanelTower })
    sync.apply(new Map([['a', true]]))
    sync.apply(new Map())
    expect(isPanelTowerHere('a')).toBe(false)
    sync.apply(new Map([['a', true]]))
    expect(setPanelTower).toHaveBeenCalledTimes(2)
  })

  it('reconnect sends every known value again; a local window never does', () => {
    const setPanelTower = vi.fn(async () => ({ ok: true, changed: 1 }))
    const sync = createPanelTowerSync({ setPanelTower })
    sync.apply(new Map([['a', true], ['b', false]]))
    sync.onStatus({ connected: true }) // first status: not a reconnect
    expect(setPanelTower).toHaveBeenCalledTimes(2)
    sync.onStatus({ connected: false })
    sync.onStatus({ connected: true })
    expect(setPanelTower.mock.calls.slice(2)).toEqual([['a', true], ['b', false]])
  })

  it('a failed send (older host) is logged once per id, ids and booleans only', async () => {
    const log = vi.fn()
    const setPanelTower = vi.fn(async () => { throw new Error('No handler for channel') })
    const sync = createPanelTowerSync({ setPanelTower, log })
    sync.apply(new Map([['a', true]]))
    await flush()
    sync.resendAll()
    await flush()
    const failures = log.mock.calls.map(c => String(c[0])).filter(m => m.includes('not sent'))
    expect(failures).toEqual(['[tower-cards] panel Tower id=a → true not sent (No handler for channel)'])
  })
})

describe('decidePanelTowers', () => {
  const state = {
    workspaces: [
      { id: 'w1', folderPath: '/w1' },
      { id: 'w2', folderPath: '/w2' },
      { id: 'w3', folderPath: '/w3' },
    ],
    terminals: [
      { id: 'p1', workspaceId: 'w1', agentPreset: 'claude-code' },
      { id: 'cli1', workspaceId: 'w1', agentPreset: 'claude-cli' },
      { id: 'p2', workspaceId: 'w2', agentPreset: 'claude-code' },
      { id: 'tw2', workspaceId: 'w2', agentPreset: 'claude-cli' },
      { id: 'p3', workspaceId: 'w3', agentPreset: 'claude-code' },
    ],
  } as unknown as Parameters<typeof decidePanelTowers>[0]

  it('state 2 + no declared Tower → true; a declared Tower or another window → false / skipped', () => {
    const desired = decidePanelTowers(state, (id) => id !== 'w3', {
      stateContract: () => 2,
      isDeclaredTower: (id) => id === 'tw2',
    })
    expect([...desired]).toEqual([['p1', true], ['p2', false]])
  })

  it('an unread / v1 state file → false', () => {
    const desired = decidePanelTowers(state, () => true, { stateContract: (folder) => (folder === '/w1' ? null : 1), isDeclaredTower: () => false })
    expect([...desired]).toEqual([['p1', false], ['p2', false], ['p3', false]])
  })
})
