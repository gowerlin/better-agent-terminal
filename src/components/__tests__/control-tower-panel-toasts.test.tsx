/**
 * T0521 (BUG-127): the right-sidebar Control Tower panel is one instance whose
 * `workspaceFolderPath` changes on workspace switch. Switching must never raise
 * "new work order" / "completed" toasts for orders that already exist, and a late
 * load from the previous workspace must not reach the new one.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import type { WorkOrder, WorkOrderStatus } from '../../types/control-tower'
import { ControlTowerPanel, diffWorkOrders, MAX_VISIBLE_CT_TOASTS } from '../ControlTowerPanel'

const NEW = `📋 ${en.controlTower.toast.newOrder}`
const completed = (id: string) => `✅ ${id} ${en.controlTower.toast.completed}`

type Orders = Record<string, WorkOrderStatus>

const workOrderContent = (id: string, status: WorkOrderStatus) =>
  `---\nschema_version: 1\nschema_kind: workorder\nid: ${id}\ntitle: "${id} title"\nstatus: ${status}\n---\n\n# ${id}\n`

/** In-memory `_ct-workorders/` per workspace; readdir of a workspace can be held back. */
function createFs(initial: Record<string, Orders>) {
  const dirs = new Map(Object.entries(initial).map(([ws, orders]) => [`${ws}/_ct-workorders`, { ...orders }]))
  const held = new Map<string, Array<() => void>>()
  const holding = new Set<string>()
  let changed: ((path: string) => void) | null = null

  const fs = {
    readdir: vi.fn(async (path: string) => {
      const orders = dirs.get(path)
      if (!orders) throw new Error(`ENOENT ${path}`)
      // Snapshot now, deliver later when held: models a slow read of the old workspace
      const entries = Object.keys(orders).map(id => ({ name: `${id}-x.md`, path: `${path}/${id}-x.md`, isDirectory: false }))
      if (holding.has(path)) {
        await new Promise<void>(resolve => held.set(path, [...(held.get(path) ?? []), resolve]))
      }
      return entries
    }),
    readFile: vi.fn(async (path: string) => {
      const m = /^(.*)\/(T\d+)-x\.md$/.exec(path)
      const status = m ? dirs.get(m[1])?.[m[2]] : undefined
      return { content: m && status ? workOrderContent(m[2], status) : null }
    }),
    stat: vi.fn(async () => null),
    watch: vi.fn(async () => true),
    unwatch: vi.fn(async () => true),
    resetWatch: vi.fn(async () => true),
    onChanged: vi.fn((cb: (path: string) => void) => {
      changed = cb
      return () => { if (changed === cb) changed = null }
    }),
  }

  return {
    fs,
    set(ws: string, id: string, status: WorkOrderStatus) {
      dirs.get(`${ws}/_ct-workorders`)![id] = status
    },
    hold(ws: string) { holding.add(`${ws}/_ct-workorders`) },
    release(ws: string) {
      const path = `${ws}/_ct-workorders`
      holding.delete(path)
      for (const resolve of held.get(path) ?? []) resolve()
      held.delete(path)
    },
    /** Simulate the watcher firing for a workspace's `_ct-workorders/`. */
    async touch(ws: string) {
      await act(async () => { changed?.(`${ws}/_ct-workorders`) })
      await flush()
    },
  }
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  }
}

function setup(initial: Record<string, Orders>, workspace: string) {
  const store = createFs(initial)
  ;(window as unknown as { electronAPI: unknown }).electronAPI = { fs: store.fs }
  const view = render(<ControlTowerPanel isVisible={true} workspaceFolderPath={workspace} />)
  const switchTo = async (ws: string) => {
    view.rerender(<ControlTowerPanel isVisible={true} workspaceFolderPath={ws} />)
    await flush()
  }
  return { store, view, switchTo }
}

const toastTexts = () => Array.from(document.querySelectorAll('.ct-toast-text')).map(el => el.textContent)

const A: Orders = { T0001: 'PENDING', T0002: 'DONE' }
const B: Orders = Object.fromEntries(
  ['T0001', 'T0002', 'T0003', 'T0004', 'T0005', 'T0006', 'T0007', 'T0008', 'T0009'].map(id => [id, id === 'T0008' ? 'IN_PROGRESS' : 'DONE']),
) as Orders

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('diffWorkOrders', () => {
  const wo = (id: string, status: WorkOrderStatus) => ({ id, status }) as WorkOrder

  it('first load and loads for another dir only set the baseline', () => {
    const first = diffWorkOrders(null, '/a/_ct-workorders', [wo('T0001', 'PENDING')])
    expect(first.notices).toEqual([])
    const other = diffWorkOrders(first.baseline, '/b/_ct-workorders', [wo('T0001', 'DONE'), wo('T0002', 'PENDING')])
    expect(other.notices).toEqual([])
    expect(other.baseline.ctDir).toBe('/b/_ct-workorders')
  })

  it('reports new orders and status changes within the same dir', () => {
    const { baseline } = diffWorkOrders(null, '/a/_ct-workorders', [wo('T0001', 'PENDING'), wo('T0002', 'PENDING')])
    const { notices } = diffWorkOrders(baseline, '/a/_ct-workorders', [
      wo('T0001', 'DONE'), wo('T0002', 'IN_PROGRESS'), wo('T0003', 'PENDING'),
    ])
    expect(notices).toEqual([
      { kind: 'completed', id: 'T0001', status: 'DONE' },
      { kind: 'started', id: 'T0002', status: 'IN_PROGRESS' },
      { kind: 'new', id: 'T0003' },
    ])
  })

  it('an empty workspace still has a baseline, so its first new order is reported', () => {
    const { baseline } = diffWorkOrders(null, '/a/_ct-workorders', [])
    expect(diffWorkOrders(baseline, '/a/_ct-workorders', [wo('T0001', 'PENDING')]).notices).toEqual([{ kind: 'new', id: 'T0001' }])
  })
})

describe('ControlTowerPanel toasts across workspace switches (BUG-127)', () => {
  it('notifies new orders and status changes within one workspace', async () => {
    const { store } = setup({ '/wsA': A }, '/wsA')
    await flush()
    expect(screen.getByText('T0001 title')).toBeTruthy()
    expect(toastTexts()).toEqual([])

    store.set('/wsA', 'T0003', 'PENDING')
    await store.touch('/wsA')
    expect(toastTexts()).toEqual([`${NEW}: T0003`])

    store.set('/wsA', 'T0001', 'DONE')
    await store.touch('/wsA')
    expect(toastTexts()).toContain(completed('T0001'))
  })

  it('switching workspaces back and forth never raises toasts', async () => {
    const { store, switchTo } = setup({ '/wsA': A, '/wsB': B }, '/wsA')
    await flush()

    for (let i = 0; i < 3; i++) {
      await switchTo('/wsB')
      expect(screen.getByText('T0009 title')).toBeTruthy()
      expect(toastTexts()).toEqual([])
      await switchTo('/wsA')
      expect(screen.queryByText('T0009 title')).toBeNull()
      expect(toastTexts()).toEqual([])
    }

    // A change made while A was not shown is absorbed silently on return, and not replayed later
    await switchTo('/wsB')
    store.set('/wsA', 'T0001', 'DONE')
    await switchTo('/wsA')
    expect(toastTexts()).toEqual([])
    await switchTo('/wsB')
    await switchTo('/wsA')
    expect(toastTexts()).toEqual([])

    // Live updates in the workspace now shown still notify
    store.set('/wsA', 'T0004', 'PENDING')
    await store.touch('/wsA')
    expect(toastTexts()).toEqual([`${NEW}: T0004`])
  })

  it('clears the previous workspace toasts on switch', async () => {
    const { store, switchTo } = setup({ '/wsA': A, '/wsB': B }, '/wsA')
    await flush()
    store.set('/wsA', 'T0003', 'PENDING')
    await store.touch('/wsA')
    expect(toastTexts()).toHaveLength(1)

    await switchTo('/wsB')
    expect(toastTexts()).toEqual([])
  })

  it('a late load of the previous workspace neither shows its orders nor corrupts the baseline', async () => {
    const C: Orders = { T0101: 'PENDING', T0102: 'DONE' }
    const { store, switchTo } = setup({ '/wsA': A, '/wsC': C }, '/wsA')
    await flush()

    // A reload of A is still reading when the user switches to C
    store.hold('/wsA')
    store.set('/wsA', 'T0003', 'PENDING')
    await store.touch('/wsA')
    await switchTo('/wsC')
    expect(screen.getByText('T0101 title')).toBeTruthy()

    store.release('/wsA')
    await flush()
    expect(screen.queryByText('T0001 title')).toBeNull()
    expect(screen.getByText('T0101 title')).toBeTruthy()
    expect(toastTexts()).toEqual([])

    // C's baseline survived: a real change in C is still reported
    store.set('/wsC', 'T0101', 'DONE')
    await store.touch('/wsC')
    expect(toastTexts()).toEqual([completed('T0101')])
  })

  it('merges a burst of new orders and caps the toast stack', async () => {
    const { store } = setup({ '/wsA': A }, '/wsA')
    await flush()

    for (const id of ['T0010', 'T0011', 'T0012', 'T0013', 'T0014']) store.set('/wsA', id, 'PENDING')
    await store.touch('/wsA')
    expect(toastTexts()).toEqual([`${NEW}: T0014, T0013, T0012 +2`])

    // One at a time: each is its own toast, but no more than the cap stay on screen
    for (let n = 20; n < 28; n++) {
      store.set('/wsA', `T00${n}`, 'PENDING')
      await store.touch('/wsA')
    }
    expect(toastTexts()).toHaveLength(MAX_VISIBLE_CT_TOASTS)
    expect(toastTexts().at(-1)).toBe(`${NEW}: T0027`)
  })
})
