/**
 * T0553: thumbnails of helper-created tabs.
 *   - a Worker whose title is the default (`<agent> · Worker · T####`): no work order badge until
 *     it reported, then `✓` only; tooltip as in T0538 (on the title while there is no badge)
 *   - a Worker the user renamed: the T0538 badge (`T####` / `✓ T####`)
 *   - `data-workorder` on the thumbnail of every Worker; a remote server's tab has a badge
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { ThumbnailBar } from '../ThumbnailBar'
import type { TerminalInstance } from '../../types'

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { onOutput: vi.fn(() => () => {}) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn(() => () => {}) },
    agent: { getDefinition: vi.fn(async () => null) },
  }
})

const term = (id: string, title: string, extra: Partial<TerminalInstance> = {}): TerminalInstance => ({
  id, workspaceId: 'ws', type: 'terminal', title, cwd: '/tmp/ws', scrollbackBuffer: [], ...extra,
})
const report = { message: 'T0551 完成', reportedAt: 1 }

function renderBar(terminals: TerminalInstance[]) {
  render(<ThumbnailBar terminals={terminals} focusedTerminalId={null} onFocus={() => {}} showAddButton={true} />)
}

const thumbnailOf = (title: string) => screen.getByText(title).closest('.thumbnail') as HTMLElement

describe('Worker tab title (T0553)', () => {
  test('default title: no badge before the report; ✓ only after it; data-workorder on the thumbnail', () => {
    renderBar([
      term('tower', 'Tower'),
      term('w1', 'Claude CLI · Worker · T0551', { towerTerminalId: 'tower', workorder: 'T0551' }),
      term('w2', 'Codex CLI · Worker · T0552', { towerTerminalId: 'tower', workorder: 'T0552', workerReport: report }),
    ])
    const pending = thumbnailOf('Claude CLI · Worker · T0551')
    expect(pending.getAttribute('data-workorder')).toBe('T0551')
    expect(pending.querySelector('.worker-badge')).toBeNull()
    // the T0538 tooltip moves to the title while there is no badge
    expect(screen.getByText('Claude CLI · Worker · T0551').getAttribute('title')).toBe(
      [en.workerTabs.badgeTooltip.replace('{{workorder}}', 'T0551').replace('{{tower}}', 'Tower'), en.workerTabs.notReportedTooltip].join('\n'),
    )

    const reported = thumbnailOf('Codex CLI · Worker · T0552')
    const badge = reported.querySelector('.worker-badge.reported') as HTMLElement
    expect(badge.textContent).toBe('✓')
    expect(badge.getAttribute('title')).toBe(
      [en.workerTabs.badgeTooltip.replace('{{workorder}}', 'T0552').replace('{{tower}}', 'Tower'), en.workerTabs.reportedTooltip.replace('{{message}}', report.message)].join('\n'),
    )
    expect(thumbnailOf('Tower').getAttribute('data-workorder')).toBeNull()
  })

  test('a Worker the user renamed keeps the T0538 badge with its work order', () => {
    renderBar([
      term('w1', 'login fix', { towerTerminalId: 'tower', workorder: 'T0551' }),
      term('w2', 'docs', { towerTerminalId: 'tower', workorder: 'T0552', workerReport: report }),
    ])
    expect(thumbnailOf('login fix').querySelector('.worker-badge')?.textContent).toBe('T0551')
    expect(thumbnailOf('docs').querySelector('.worker-badge.reported')?.textContent).toBe('✓ T0552')
  })

  test('a remote server\'s tab has the remote badge; a local one does not', () => {
    renderBar([
      term('r', 'Claude CLI · Worker · T0551', { towerTerminalId: 'tower', workorder: 'T0551', remoteOrigin: true }),
      term('l', 'node'),
    ])
    const remoteBadge = thumbnailOf('Claude CLI · Worker · T0551').querySelector('.remote-origin-badge') as HTMLElement
    expect(remoteBadge.textContent).toBe(en.profiles.remote)
    expect(remoteBadge.getAttribute('title')).toBe(en.workerTabs.remoteOriginTooltip)
    expect(thumbnailOf('node').querySelector('.remote-origin-badge')).toBeNull()
  })
})
