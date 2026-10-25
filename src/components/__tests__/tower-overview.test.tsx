/**
 * T0701 (D184): the Control Tower panel「總覽」— tower state summary / fallback, open work orders,
 * *config layers with sources, the sprint block only when sprint-status.yaml exists, the R4
 * pending count, and R5: the overview follows file changes without pressing refresh.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import type { CtConfigSources } from '../../types/ct-config-sources'
import { ControlTowerPanel } from '../ControlTowerPanel'

const WS = '/ws'
const CT = `${WS}/_ct-workorders`
const ov = en.controlTower.overview

const workOrder = (id: string, status: string) =>
  `---\nschema_version: 1\nschema_kind: workorder\nid: ${id}\ntitle: "${id} title"\nstatus: ${status}\n---\n\n# ${id}\n`

const SUMMARY = `---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-10-25T19:17:48+0800"
session: "S92"
next_ids:
  workorder: T0702
  decision: D185
todo:
  - todo-1
  - todo-2
  - todo-3
  - todo-4
  - todo-5
  - todo-6
---
# Tower State
`

const DEFAULTS_MD = `### 可用選項

| 選項 | 有效值 | 預設 | 說明 |
|---|---|---|---|
| \`auto-session\` | \`on\` / \`ask\` | \`ask\` | auto session |
| \`verbose\` | \`on\` / \`off\` | \`on\` | verbose |
| \`archive_days\` | \`0\` - \`365\` | \`7\` | archive |
`

function setup(files: Record<string, string>, sources: () => Promise<CtConfigSources>) {
  const disk = new Map(Object.entries(files))
  let changed: ((path: string) => void) | null = null
  const fs = {
    readdir: vi.fn(async (dir: string) => {
      if (dir !== CT) throw new Error(`ENOENT ${dir}`)
      return [...disk.keys()]
        .filter(p => p.startsWith(`${CT}/`) && !p.slice(CT.length + 1).includes('/'))
        .map(p => ({ name: p.slice(CT.length + 1), path: p, isDirectory: false }))
    }),
    readFile: vi.fn(async (p: string) => (disk.has(p) ? { content: disk.get(p) } : { error: 'Failed to read file' })),
    stat: vi.fn(async (p: string) => (disk.has(p) ? { mtimeMs: new Date(2026, 9, 25, 8, 30).getTime(), size: 1 } : null)),
    watch: vi.fn(async () => true),
    unwatch: vi.fn(async () => true),
    resetWatch: vi.fn(async () => true),
    onChanged: vi.fn((cb: (path: string) => void) => {
      changed = cb
      return () => { if (changed === cb) changed = null }
    }),
  }
  const readSources = vi.fn(sources)
  const log = vi.fn()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = { fs, ctConfig: { readSources }, debug: { log } }
  render(<ControlTowerPanel isVisible={true} workspaceFolderPath={WS} />)
  return {
    disk,
    readSources,
    log,
    /** Simulate the `_ct-workorders/` watcher firing. */
    async touch() {
      await act(async () => { changed?.(CT) })
      await flush()
    },
  }
}

async function flush() {
  for (let i = 0; i < 6; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  }
}

async function openOverview() {
  await flush()
  fireEvent.click(screen.getByText(en.controlTower.tab.sprint))
  await flush()
}

const sourcesWith = (global: string | null, defaults: string | null): CtConfigSources => ({
  homeDir: '/home/u',
  global: global == null
    ? { status: 'missing', tried: ['/home/u/.claude/control-tower-data/config.yaml'] }
    : { status: 'found', path: '/home/u/.claude/control-tower-data/config.yaml', content: global },
  defaults: defaults == null
    ? { status: 'missing', tried: ['/home/u/.claude/skills/control-tower/references/tower-config.md'] }
    : { status: 'found', path: '/home/u/.claude/skills/control-tower/references/tower-config.md', content: defaults },
})

/** [effective, source] of a config row. */
function configRow(key: string): [string, string] {
  const row = [...document.querySelectorAll('.ct-overview-config-row')]
    .find(r => r.querySelector('.ct-overview-config-key')?.textContent === key)
  if (!row) throw new Error(`no config row ${key}`)
  return [row.querySelector('.ct-overview-config-value')!.textContent!, row.querySelector('.ct-overview-source')!.textContent!]
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('TowerOverview — tower state (R1)', () => {
  it('summary: last updated, session, next ids, first 5 to-dos, open orders', async () => {
    setup({
      [`${CT}/_tower-state.md`]: SUMMARY,
      [`${CT}/T0001-x.md`]: workOrder('T0001', 'IN_PROGRESS'),
      [`${CT}/T0002-x.md`]: workOrder('T0002', 'DONE'),
      [`${CT}/T0003-x.md`]: workOrder('T0003', 'PENDING'),
      [`${CT}/T0004-x.md`]: workOrder('T0004', 'TODO'),
      [`${CT}/T0005-report.md`]: '# T0005 report\n\nno status here\n',
    }, async () => sourcesWith(null, null))
    await openOverview()

    expect(screen.getByText('2026-10-25T19:17:48+0800')).toBeTruthy()
    expect(screen.getByText('S92')).toBeTruthy()
    expect(document.querySelector('.ct-overview-chips')!.textContent).toBe('workorder T0702decision D185')
    const todos = [...document.querySelectorAll('.ct-overview-todo li')].map(li => li.textContent)
    expect(todos).toEqual(['todo-1', 'todo-2', 'todo-3', 'todo-4', 'todo-5'])
    expect(screen.getByText('1 more in the file')).toBeTruthy()

    const listed = [...document.querySelectorAll('.ct-overview-order .ct-order-id')].map(el => el.textContent)
    expect(listed.sort()).toEqual(['T0001', 'T0003', 'T0004']) // DONE and the status-less report are not listed
    expect(screen.queryByText(/sprint-status\.yaml/)).toBeNull()
  })

  it('no summary: last-updated line from the body and the open-the-file hint', async () => {
    setup({ [`${CT}/_tower-state.md`]: '# Tower State\n\n> 最後更新:2026-10-25 09:17 (UTC+8) — S92\n' }, async () => sourcesWith(null, null))
    await openOverview()
    expect(screen.getByText('2026-10-25 09:17 (UTC+8) — S92')).toBeTruthy()
    expect(screen.getByText(ov.noSummary)).toBeTruthy()
    expect(document.querySelector('.ct-overview-chips')).toBeNull()
  })

  it('no summary and no last-updated line: file modified time, labelled', async () => {
    setup({ [`${CT}/_tower-state.md`]: '# Tower State\n' }, async () => sourcesWith(null, null))
    await openOverview()
    expect(screen.getByText(`2026-10-25 08:30 ${ov.fileMtime}`)).toBeTruthy()
  })

  it('broken summary YAML: treated as no summary and logged', async () => {
    const { log } = setup(
      { [`${CT}/_tower-state.md`]: '---\nschema_kind: tower-state\nsummary_version: [1\n---\n最後更新：X\n' },
      async () => sourcesWith(null, null),
    )
    await openOverview()
    expect(screen.getByText('X')).toBeTruthy()
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[ct-overview\] _tower-state\.md summary ignored: YAML parse error/))
  })

  it('no _tower-state.md', async () => {
    setup({ [`${CT}/T0001-x.md`]: workOrder('T0001', 'DONE') }, async () => sourcesWith(null, null))
    await openOverview()
    expect(screen.getByText(ov.noTowerState)).toBeTruthy()
    expect(screen.getByText(ov.noOpenOrders)).toBeTruthy()
  })
})

describe('summary badges (R4)', () => {
  it('a status-less file is "no status", not pending', async () => {
    setup({
      [`${CT}/T0001-x.md`]: workOrder('T0001', 'PENDING'),
      [`${CT}/T0022-research-report.md`]: '# T0022 研究報告\n',
      [`${CT}/T0099-audit-report.md`]: '# T0099\n',
    }, async () => sourcesWith(null, null))
    await flush()
    // the panel's summary bar is the first `.ct-summary` (Bugs / Backlog have their own)
    const badges = [...document.querySelector('.ct-summary')!.querySelectorAll('.ct-badge')].map(b => b.textContent)
    expect(badges).toEqual(['1 pending', '2 no status', '3 total'])
  })

  it('a report sharing a work order ID does not hide the work order, whichever sorts first', async () => {
    setup({
      [`${CT}/T0177-report-fit-rules.md`]: '# T0177 report\n',
      [`${CT}/T0177-fit-rules.md`]: workOrder('T0177', 'DONE'),
      [`${CT}/T0189-course-plan.md`]: workOrder('T0189', 'DONE'),
      [`${CT}/T0189-report-course.md`]: '# T0189 report\n',
    }, async () => sourcesWith(null, null))
    await flush()
    const badges = [...document.querySelector('.ct-summary')!.querySelectorAll('.ct-badge')].map(b => b.textContent)
    expect(badges).toEqual(['2 done', '2 total'])
  })
})

describe('TowerOverview — *config (R2)', () => {
  it('union of the three layers with effective value and source', async () => {
    setup({
      [`${CT}/_tower-config.yaml`]: 'auto-session: on\nmethodology: bmad\n',
    }, async () => sourcesWith('control-tower:\n  verbose: off\n  auto-session: ask\n', DEFAULTS_MD))
    await openOverview()
    expect(configRow('auto-session')).toEqual(['on', 'project'])
    expect(configRow('verbose')).toEqual(['off', 'global'])
    expect(configRow('archive_days')).toEqual(['7', 'default'])
    expect(configRow('methodology')).toEqual(['bmad', 'project'])
    expect(screen.getByText(ov.noSessionLayer)).toBeTruthy()

    // overridden lower-layer values on request
    expect(document.querySelector('.ct-overview-config-overridden')).toBeNull()
    fireEvent.click(screen.getByLabelText(ov.showOverridden))
    const overridden = [...document.querySelectorAll('.ct-overview-config-overridden')].map(e => e.textContent)
    expect(overridden).toContain('global: ask · default: ask')
  })

  it('no installed CT and no global file', async () => {
    setup({ [`${CT}/_tower-config.yaml`]: 'verbose: on\n' }, async () => sourcesWith(null, null))
    await openOverview()
    expect(screen.getByText(ov.noInstalledCt)).toBeTruthy()
    expect(screen.getAllByText(ov.layerMissing)).toHaveLength(1) // global
    expect(configRow('verbose')).toEqual(['on', 'project'])
  })

  it('remote bat-server without the channel: says so, never reads this machine instead', async () => {
    setup({ [`${CT}/_tower-config.yaml`]: 'verbose: on\n' }, async () => {
      throw new Error("Error invoking remote method 'ct:read-config-sources': Error: No handler for channel: ct:read-config-sources")
    })
    await openOverview()
    expect(screen.getAllByText(ov.remoteUnsupported)).toHaveLength(2)
    expect(configRow('verbose')).toEqual(['on', 'project'])
  })
})

describe('R3 / R5: sprint block and live updates', () => {
  it('sprint block only when sprint-status.yaml exists', async () => {
    setup({
      [`${CT}/sprint-status.yaml`]: 'sprint:\n  name: S1\nmilestones:\n  - name: M1\n    status: done\n',
    }, async () => sourcesWith(null, null))
    await openOverview()
    expect(screen.queryByText(/未找到 sprint-status\.yaml/)).toBeNull()
    expect(screen.getByText('📊 Sprint')).toBeTruthy()
    expect(screen.getByText('M1')).toBeTruthy()
  })

  it('no sprint-status.yaml: no sprint block and no empty state', async () => {
    setup({ [`${CT}/_tower-state.md`]: SUMMARY }, async () => sourcesWith(null, null))
    await openOverview()
    expect(screen.queryByText('📊 Sprint')).toBeNull()
    expect(screen.queryByText(/sprint-status\.yaml/)).toBeNull()
  })

  it('a change in _ct-workorders/ updates the overview without pressing refresh', async () => {
    const env = setup({
      [`${CT}/_tower-state.md`]: SUMMARY,
      [`${CT}/_tower-config.yaml`]: 'verbose: on\n',
    }, async () => sourcesWith(null, DEFAULTS_MD))
    await openOverview()
    expect(configRow('verbose')).toEqual(['on', 'project'])

    env.disk.set(`${CT}/_tower-config.yaml`, 'verbose: off\n')
    env.disk.set(`${CT}/_tower-state.md`, SUMMARY.replace('todo-1', 'todo-changed'))
    env.disk.set(`${CT}/T0007-x.md`, workOrder('T0007', 'IN_PROGRESS'))
    await env.touch()
    expect(configRow('verbose')).toEqual(['off', 'project'])
    expect(screen.getByText('todo-changed')).toBeTruthy()
    expect(within(document.querySelector('.ct-overview') as HTMLElement).getByText('T0007 title')).toBeTruthy()

    env.disk.delete(`${CT}/_tower-config.yaml`)
    await env.touch()
    expect(configRow('verbose')).toEqual(['on', 'default'])
  })

  it('global / default layers are re-read when the overview becomes visible and on refresh', async () => {
    let global = 'verbose: off\n'
    const env = setup({}, async () => sourcesWith(global, DEFAULTS_MD))
    await flush()
    expect(env.readSources).not.toHaveBeenCalled() // orders tab first
    await openOverview()
    expect(env.readSources).toHaveBeenCalledTimes(1)
    expect(configRow('verbose')).toEqual(['off', 'global'])

    global = 'verbose: on\n'
    fireEvent.click(screen.getByTitle(en.controlTower.refresh))
    await flush()
    expect(configRow('verbose')).toEqual(['on', 'global'])

    fireEvent.click(screen.getByText(en.controlTower.tab.orders))
    await flush()
    fireEvent.click(screen.getByText(en.controlTower.tab.sprint))
    await flush()
    expect(env.readSources).toHaveBeenCalledTimes(3)
  })
})
