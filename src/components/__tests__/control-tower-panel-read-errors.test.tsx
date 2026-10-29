/**
 * T0708 (BUG-172): `fs:readFile` refuses files over 512 KiB (`{ error: 'File too large', size }`).
 * The bugs / backlog / decisions tabs must say so instead of showing an empty list, an unreadable
 * work order must stay in the list, and a project without those files keeps the empty lists.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { ControlTowerPanel, formatCtReadError, readCtFile } from '../ControlTowerPanel'

const WS = '/ws'
const CT = `${WS}/_ct-workorders`
const TOO_LARGE = { error: 'File too large', size: 600 * 1024 }

const workOrderContent = (id: string) =>
  `---\nschema_version: 1\nschema_kind: workorder\nid: ${id}\ntitle: "${id} title"\nstatus: PENDING\n---\n\n# ${id}\n`

type ReadResult = { content?: string; error?: string; size?: number }

/**
 * `files`: what `fs:readFile` answers per path (a string = content). Anything listed exists for
 * `fs:stat`; anything else is missing (`Failed to read file`, stat null), as in electron/handlers/fs.ts.
 */
function setup(files: Record<string, string | ReadResult>) {
  const fs = {
    readdir: vi.fn(async (dir: string) => {
      const prefix = `${dir}/`
      const names = Object.keys(files).filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      if (dir !== CT && names.length === 0) return []
      return names.map(p => ({ name: p.slice(prefix.length), path: p, isDirectory: false }))
    }),
    readFile: vi.fn(async (path: string): Promise<ReadResult> => {
      const f = files[path]
      if (f === undefined) return { error: 'Failed to read file' }
      return typeof f === 'string' ? { content: f } : f
    }),
    stat: vi.fn(async (path: string) => (path in files ? { mtimeMs: 0, size: 1 } : null)),
    watch: vi.fn(async () => true),
    unwatch: vi.fn(async () => true),
    resetWatch: vi.fn(async () => true),
    onChanged: vi.fn(() => () => {}),
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    fs,
    debug: { log: vi.fn() },
    ctConfig: { readSources: vi.fn(async () => ({ global: { status: 'missing' }, defaults: { status: 'missing' } })) },
  }
  render(<ControlTowerPanel isVisible={true} workspaceFolderPath={WS} />)
  return fs
}

async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  }
}

const tooLarge = (file: string) => i18n.t('controlTower.readError.tooLarge', { file, kb: 600 })
const readErrorTexts = () => Array.from(document.querySelectorAll('.ct-read-error')).map(el => el.textContent)

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('readCtFile', () => {
  it('tells loaded, missing, too large and unreadable apart', async () => {
    setup({
      [`${CT}/a.md`]: 'x',
      [`${CT}/big.md`]: TOO_LARGE,
      [`${CT}/denied.md`]: { error: 'Failed to read file' },
    })
    expect(await readCtFile(`${CT}/a.md`, 'a.md')).toEqual({ kind: 'loaded', content: 'x' })
    expect(await readCtFile(`${CT}/none.md`, 'none.md')).toEqual({ kind: 'missing' })
    expect(await readCtFile(`${CT}/big.md`, 'big.md')).toEqual({
      kind: 'error', error: { file: 'big.md', error: 'File too large', size: 600 * 1024 },
    })
    expect(await readCtFile(`${CT}/denied.md`, 'denied.md')).toEqual({
      kind: 'error', error: { file: 'denied.md', error: 'Failed to read file' },
    })
  })

  it('formats both error kinds with the file name (and KB for File too large)', () => {
    const t = i18n.t.bind(i18n)
    expect(formatCtReadError(t, { file: '_ct-workorders/_backlog.md', error: 'File too large', size: 700 * 1024 }))
      .toBe('Cannot read _ct-workorders/_backlog.md: file too large to display (700 KB, limit 512 KB)')
    expect(formatCtReadError(t, { file: '_ct-workorders/_backlog.md', error: 'Failed to read file' }))
      .toBe('Cannot read _ct-workorders/_backlog.md: Failed to read file')
  })
})

describe('ControlTowerPanel read errors (BUG-172)', () => {
  it('shows File too large on the bugs / backlog / decisions tabs and keeps the unreadable work order', async () => {
    setup({
      [`${CT}/T0001-ok.md`]: workOrderContent('T0001'),
      [`${CT}/T0002-big.md`]: TOO_LARGE,
      [`${CT}/_bug-tracker.md`]: TOO_LARGE,
      [`${CT}/_backlog.md`]: TOO_LARGE,
      [`${CT}/_decision-log.md`]: TOO_LARGE,
      [`${WS}/_bmad-output/planning-artifacts/epics.md`]: TOO_LARGE,
      [`${CT}/sprint-status.yaml`]: TOO_LARGE,
    })
    await flush()

    // Orders: the unreadable order is listed as "no status" with its read error, not dropped
    expect(screen.getByText('T0001 title')).toBeTruthy()
    const big = screen.getByText('T0002').closest('.ct-order-card')!
    expect(big.textContent).toContain(tooLarge('_ct-workorders/T0002-big.md'))
    expect(big.textContent).toContain('No status')
    expect(document.querySelector('.ct-total')?.textContent).toBe('2 total')

    expect(readErrorTexts()).toEqual(expect.arrayContaining([
      `⚠️ ${tooLarge('_ct-workorders/_bug-tracker.md')}`,
      `⚠️ ${tooLarge('_ct-workorders/_backlog.md')}`,
      `⚠️ ${tooLarge('_ct-workorders/_decision-log.md')}`,
      `⚠️ ${tooLarge('_bmad-output/planning-artifacts/epics.md')}`,
    ]))
    expect(screen.queryByText(en.controlTower.bugs.noBugs)).toBeNull()
    expect(screen.queryByText(en.controlTower.backlog.noEntries)).toBeNull()
    expect(screen.queryByText(en.controlTower.decisions.noDecisions)).toBeNull()
    expect(screen.queryByText(en.controlTower.epics.empty)).toBeNull()

    // Overview: the sprint block reports the unreadable sprint-status.yaml
    fireEvent.click(screen.getByText(en.controlTower.tab.sprint))
    await flush()
    expect(readErrorTexts()).toContain(`⚠️ ${tooLarge('_ct-workorders/sprint-status.yaml')}`)
  })

  it('reports other read errors of existing files too', async () => {
    setup({
      [`${CT}/T0001-ok.md`]: workOrderContent('T0001'),
      [`${CT}/_bug-tracker.md`]: { error: 'Failed to read file' },
    })
    await flush()
    expect(readErrorTexts()).toEqual([`⚠️ ${i18n.t('controlTower.readError.failed', { file: '_ct-workorders/_bug-tracker.md', error: 'Failed to read file' })}`])
    expect(screen.queryByText(en.controlTower.bugs.noBugs)).toBeNull()
  })

  it('keeps the empty lists without errors when the files do not exist', async () => {
    setup({ [`${CT}/T0001-ok.md`]: workOrderContent('T0001') })
    await flush()
    expect(screen.getByText('T0001 title')).toBeTruthy()
    expect(readErrorTexts()).toEqual([])
    expect(screen.getByText(en.controlTower.bugs.noBugs)).toBeTruthy()
    expect(screen.getByText(en.controlTower.backlog.noEntries)).toBeTruthy()
    expect(screen.getByText(en.controlTower.decisions.noDecisions)).toBeTruthy()
    expect(screen.getByText(en.controlTower.epics.empty)).toBeTruthy()
  })
})
