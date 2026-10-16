/**
 * T0563: Dialogs no longer close on a click outside them (on the backdrop). They close only
 * through [X] / confirm / cancel, plus Esc (T0567, see dialog-escape.test.tsx). Menus, dropdowns and
 * small popovers still close on an outside click.
 *  - representative dialogs: Settings, Profiles, Workspace Settings, a confirm dialog, the app
 *    notification (which gained an [X]), and the setup wizard (backdrop click must not unmount
 *    the wizard: unmount cancels its runner and rolls back completed steps)
 *  - a menu (AddMenu) still closes on an outside mousedown
 *  - source guard: dialog backdrops go through `ModalOverlay`, which takes no click handler
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { createRef, useEffect } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import zhTW from '../../locales/zh-TW.json'
import zhCN from '../../locales/zh-CN.json'
import { AboutPanel } from '../AboutPanel'
import { AppNotificationDialog } from '../AppNotificationDialog'
import { CloseConfirmDialog } from '../CloseConfirmDialog'
import { AddMenu } from '../common/AddMenu'
import { ModalOverlay } from '../common/ModalOverlay'
import { ProfilePanel } from '../ProfilePanel'
import { SettingsPanel } from '../SettingsPanel'
import { WorkspaceEnvDialog } from '../WorkspaceEnvDialog'

// The real wizard shell starts a runner on mount and cancels (= rolls back) it on unmount.
// The stub records mounts / unmounts so the test can see whether a backdrop click tore it down.
const wizardLifecycle = vi.hoisted(() => ({ mounted: 0, unmounted: 0 }))
vi.mock('../setup-wizard/SetupWizardShell', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../setup-wizard/SetupWizardShell')>()
  function SetupWizardShell() {
    useEffect(() => {
      wizardLifecycle.mounted++
      return () => { wizardLifecycle.unmounted++ }
    }, [])
    return <div data-testid="wizard-shell-stub" />
  }
  return { ...actual, SetupWizardShell }
})

let originalApi: unknown

beforeAll(async () => {
  await i18n.changeLanguage('en')
  // jsdom has no CSS Font Loading API; SettingsPanel awaits `document.fonts.ready` on mount.
  if (!('fonts' in document)) {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve(), check: () => false } })
  }
})

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
  wizardLifecycle.mounted = 0
  wizardLifecycle.unmounted = 0
  const now = Date.now()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    platform: 'win32',
    debug: { log: vi.fn() },
    settings: { save: vi.fn(async () => true), getLoggingInfo: vi.fn(async () => null), cleanupLogs: vi.fn() },
    agent: { listCustomClis: vi.fn(async () => []) },
    remote: {
      serverStatus: vi.fn(async () => ({ running: false, port: null, clients: [] })),
      clientStatus: vi.fn(async () => ({ connected: false, info: null })),
      listProfiles: vi.fn(async () => ({ profiles: [], activeProfileIds: [] })),
      profileConnectionStates: vi.fn(async () => []),
      onProfileConnectionsChanged: vi.fn(() => () => {}),
    },
    profile: {
      listLocal: vi.fn(async () => ({
        profiles: [{ id: 'default', name: 'Default', type: 'local', createdAt: now, updatedAt: now }],
        activeProfileIds: ['default'],
      })),
    },
    app: { getWindowProfile: vi.fn(async () => 'default') },
    remoteTools: { detect: vi.fn(), detectHere: vi.fn() },
    shell: { openExternal: vi.fn() },
  }
})

afterEach(() => {
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
})

function backdrop(className: string): HTMLElement {
  const all = document.querySelectorAll<HTMLElement>(`.${className}`)
  const el = all[all.length - 1]
  if (!el) throw new Error(`no .${className}`)
  return el
}

/** A "click outside": the full mouse sequence on the backdrop itself. */
function clickBackdrop(el: HTMLElement) {
  fireEvent.mouseDown(el)
  fireEvent.mouseUp(el)
  fireEvent.click(el)
}

describe('Dialogs do not close on a backdrop click (T0563)', () => {
  test('Settings: backdrop click keeps it open; [X] closes', async () => {
    const onClose = vi.fn()
    render(<SettingsPanel onClose={onClose} />)
    await screen.findByRole('heading', { name: en.settings.title })
    clickBackdrop(backdrop('settings-overlay'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('.settings-header .close-btn')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('Profiles: backdrop click keeps it open; [X] and Esc close', async () => {
    const onClose = vi.fn()
    render(<ProfilePanel onClose={onClose} onSwitchNewWindow={vi.fn()} />)
    await screen.findByRole('heading', { name: en.profiles.title })
    clickBackdrop(backdrop('settings-overlay'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('.settings-header .settings-close')!)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  test('Profiles delete confirmation: backdrop click neither cancels it nor closes Profiles', async () => {
    const onClose = vi.fn()
    const now = Date.now()
    const api = (window as unknown as { electronAPI: { profile: { listLocal: ReturnType<typeof vi.fn> } } }).electronAPI
    api.profile.listLocal.mockResolvedValue({
      profiles: [
        { id: 'default', name: 'Default', type: 'local', createdAt: now, updatedAt: now },
        { id: 'other', name: 'Other', type: 'local', createdAt: now, updatedAt: now },
      ],
      activeProfileIds: ['default'],
    })
    render(<ProfilePanel onClose={onClose} onSwitchNewWindow={vi.fn()} />)
    const deleteButtons = await screen.findAllByTestId('profile-card-delete')
    fireEvent.click(deleteButtons[deleteButtons.length - 1])
    await screen.findByRole('heading', { name: en.profiles.deleteProfile })
    clickBackdrop(backdrop('settings-overlay'))
    expect(screen.getByRole('heading', { name: en.profiles.deleteProfile })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }))
    expect(screen.queryByRole('heading', { name: en.profiles.deleteProfile })).not.toBeInTheDocument()
  })

  test('setup wizard: backdrop click does not unmount (cancel / roll back) it; [X] does', async () => {
    const onClose = vi.fn()
    render(<ProfilePanel onClose={onClose} onSwitchNewWindow={vi.fn()} />)
    await screen.findByRole('heading', { name: en.profiles.title })
    fireEvent.click(screen.getByRole('button', { name: en.profiles.addMore }))
    fireEvent.click(screen.getByText(en.profiles.addWslProfile))
    await screen.findByTestId('wizard-shell-stub')
    expect(wizardLifecycle.mounted).toBe(1)

    // The wizard backdrop and the Profiles backdrop underneath it.
    const overlays = document.querySelectorAll<HTMLElement>('.settings-overlay')
    clickBackdrop(overlays[overlays.length - 1])
    clickBackdrop(overlays[0])
    expect(screen.getByTestId('wizard-shell-stub')).toBeInTheDocument()
    expect(wizardLifecycle.unmounted).toBe(0)
    expect(onClose).not.toHaveBeenCalled()

    const closeButtons = document.querySelectorAll<HTMLElement>('.settings-header .settings-close')
    fireEvent.click(closeButtons[closeButtons.length - 1])
    expect(screen.queryByTestId('wizard-shell-stub')).not.toBeInTheDocument()
    expect(wizardLifecycle.unmounted).toBe(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  test('Workspace Settings: backdrop click keeps it open; [X] closes', () => {
    const onClose = vi.fn()
    render(
      <WorkspaceEnvDialog
        workspace={{ id: 'ws', name: 'WS', folderPath: '/ws', createdAt: 0 }}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
        onClose={onClose}
      />,
    )
    clickBackdrop(backdrop('dialog-overlay'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('.dialog-close-btn')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('close confirmation: backdrop click neither cancels nor confirms; the buttons still do', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<CloseConfirmDialog onConfirm={onConfirm} onCancel={onCancel} />)
    clickBackdrop(backdrop('dialog-overlay'))
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: en.common.close }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  test('About: backdrop click keeps it open; [X] closes', () => {
    const onClose = vi.fn()
    render(<AboutPanel onClose={onClose} />)
    clickBackdrop(backdrop('settings-overlay'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('.settings-header .close-btn')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('app notification gained an [X] (i18n aria-label); backdrop click keeps it open', () => {
    const onClose = vi.fn()
    render(<AppNotificationDialog message="Something happened" onClose={onClose} />)
    clickBackdrop(backdrop('app-notification-overlay'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en.common.close }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: en.common.ok }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(zhTW.common.close).toBeTruthy()
    expect(zhCN.common.close).toBeTruthy()
  })

  test('a drag that starts inside a dialog and ends on the backdrop does not close it', () => {
    const onClose = vi.fn()
    render(<AppNotificationDialog message="Select me" onClose={onClose} />)
    fireEvent.mouseDown(screen.getByText('Select me'))
    fireEvent.mouseUp(backdrop('app-notification-overlay'))
    fireEvent.click(backdrop('app-notification-overlay'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Menus still close on an outside click (T0563)', () => {
  test('AddMenu closes on a mousedown outside the menu and its anchor', async () => {
    const onClose = vi.fn()
    const anchorRef = createRef<HTMLButtonElement>()
    render(
      <div>
        <button ref={anchorRef}>anchor</button>
        <span data-testid="outside">outside</span>
        <AddMenu open anchorRef={anchorRef as React.RefObject<HTMLElement>} onClose={onClose} sections={[{ id: 's', items: [<span key="a">Item</span>] }]} />
      </div>,
    )
    fireEvent.mouseDown(screen.getByText('Item'))
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => { fireEvent.mouseDown(screen.getByTestId('outside')) })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})

// ---------------------------------------------------------------------------
// Source guard
// ---------------------------------------------------------------------------

const SRC = resolve(__dirname, '../..')

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      out.push(...tsxFiles(p))
    } else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) {
      out.push(p)
    }
  }
  return out
}

/** Backdrop classes of Dialogs / modals. Each must be rendered through `ModalOverlay`. */
const DIALOG_BACKDROP_CLASSES = [
  'settings-overlay',
  'dialog-overlay',
  'claude-plan-overlay',
  'snippet-edit-overlay',
  'app-notification-overlay',
  'recovery-prompt-overlay',
  'update-notification-overlay',
]

/**
 * Menus / popovers that keep their outside-click close. Anything else whose class names it a
 * backdrop / overlay and that closes on click is treated as a Dialog and fails the guard.
 */
const OUTSIDE_CLICK_ALLOWED = [
  'path-preview-overlay', // PathLinker file preview popover
  'context-menu-backdrop', // GitHubPanel context menu
]

/** JSX opening tags (`<Tag ...>`), tolerant of `=>` inside attribute expressions. */
function openingTags(src: string): string[] {
  const tags: string[] = []
  const re = /<([A-Za-z][\w.]*)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let depth = 0
    let i = m.index + m[0].length
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    tags.push(src.slice(m.index, i + 1))
  }
  return tags
}

describe('source guard (T0563)', () => {
  const files = tsxFiles(SRC)

  test('ModalOverlay takes no click handler', () => {
    const src = readFileSync(join(SRC, 'components/common/ModalOverlay.tsx'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/on(Click|MouseDown|MouseUp|PointerDown|PointerUp)\b/)
    // @ts-expect-error — ModalOverlay deliberately has no onClick prop
    expect(() => <ModalOverlay className="x" onClick={() => {}}>{null}</ModalOverlay>).not.toThrow()
  })

  test('dialog backdrops are rendered through ModalOverlay, never as a raw element', () => {
    const offenders: string[] = []
    for (const f of files) {
      if (f.endsWith(join('common', 'ModalOverlay.tsx'))) continue
      for (const tag of openingTags(readFileSync(f, 'utf8'))) {
        if (tag.startsWith('<ModalOverlay')) continue
        const cls = /className=["'{`]([^"'`}]*)/.exec(tag)?.[1] ?? ''
        if (DIALOG_BACKDROP_CLASSES.some(c => cls.split(/\s+/).includes(c))) offenders.push(`${relative(SRC, f)}: ${tag.slice(0, 80)}`)
      }
    }
    expect(offenders).toEqual([])
  })

  test('ModalOverlay is never given a click / mouse handler', () => {
    const offenders: string[] = []
    for (const f of files) {
      for (const tag of openingTags(readFileSync(f, 'utf8'))) {
        if (tag.startsWith('<ModalOverlay') && /\bon(Click|MouseDown|MouseUp|PointerDown|PointerUp)=/.test(tag)) {
          offenders.push(`${relative(SRC, f)}: ${tag.slice(0, 80)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  test('no other backdrop / overlay closes on click, except the listed menus and popovers', () => {
    const offenders: string[] = []
    for (const f of files) {
      for (const tag of openingTags(readFileSync(f, 'utf8'))) {
        const cls = /className=["'{`]([^"'`}]*)/.exec(tag)?.[1] ?? ''
        const names = cls.split(/\s+/).filter(n => /(overlay|backdrop)/.test(n))
        if (names.length === 0) continue
        if (!/\bon(Click|MouseDown|PointerDown)=/.test(tag)) continue
        if (names.every(n => OUTSIDE_CLICK_ALLOWED.includes(n))) continue
        offenders.push(`${relative(SRC, f)}: ${tag.slice(0, 80)}`)
      }
    }
    expect(offenders).toEqual([])
  })

  test('the guard sees the dialogs it is meant to cover', () => {
    const uses = files.filter(f => /<ModalOverlay\b/.test(readFileSync(f, 'utf8'))).map(f => relative(SRC, f).replace(/\\/g, '/'))
    for (const f of [
      'components/SettingsPanel.tsx',
      'components/ProfilePanel.tsx',
      'components/WorkspaceEnvDialog.tsx',
      'components/CloseConfirmDialog.tsx',
      'components/AboutPanel.tsx',
      'components/AppNotificationDialog.tsx',
      'components/SnippetPanel.tsx',
      'components/MainPanel.tsx',
      'components/WorkspaceView.tsx',
      'components/ClaudeAgentPanel.tsx',
      'components/CodexAgentPanel.tsx',
      'components/profiles/EditRemoteProfileModal.tsx',
      'components/remote-tools/InstallConfirmDialog.tsx',
    ]) expect(uses).toContain(f)
  })
})
