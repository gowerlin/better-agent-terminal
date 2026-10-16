/**
 * T0567: Esc closes a Dialog through the shared `ModalOverlay` / `modal-stack` mechanism.
 *  - Esc = the dialog's [X], or cancel for a confirmation (never confirm)
 *  - only the topmost dialog reacts; a nested dialog closes before its parent
 *  - a menu / autocomplete inside the dialog that handled Esc keeps it; IME composition is ignored
 *  - a dialog without `onEscape` (RecoveryPrompt, the setup wizards) blocks Esc: nothing below it
 *    reacts. With a wizard open over Profiles, Esc closes neither (the wizard is not unmounted,
 *    so its runner is not cancelled / rolled back); once the wizard is closed, Esc closes Profiles
 *  - source guard: dialogs get Esc only through `onEscape`, not their own keydown listeners
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { useEffect, useState } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { AboutPanel } from '../AboutPanel'
import { AppNotificationDialog } from '../AppNotificationDialog'
import { ClaudeAgentPanel } from '../ClaudeAgentPanel'
import { CloseConfirmDialog } from '../CloseConfirmDialog'
import { ModalOverlay } from '../common/ModalOverlay'
import { topModal } from '../common/modal-stack'
import { ProfilePanel } from '../ProfilePanel'
import { RecoveryPrompt } from '../RecoveryPrompt'
import { SettingsPanel } from '../SettingsPanel'
import { WorkspaceEnvDialog } from '../WorkspaceEnvDialog'

// The real wizard shell starts a runner on mount and cancels (= rolls back) it on unmount.
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

/** Permissive electronAPI stand-in (same shape as prompt-client-path-hint.test.tsx). */
function permissiveApi(overrides: Record<string, Record<string, unknown>>): unknown {
  const leaf = (name: string) => vi.fn((..._args: unknown[]) => (name.startsWith('on') ? () => {} : Promise.resolve(undefined)))
  const namespace = (ns: string) => {
    const cache: Record<string, unknown> = { ...(overrides[ns] ?? {}) }
    return new Proxy(cache, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined
        if (!(prop in target)) target[prop] = leaf(prop)
        return target[prop]
      },
    })
  }
  const namespaces: Record<string, unknown> = {}
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

let originalApi: unknown

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
  if (!('fonts' in document)) {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve(), check: () => false } })
  }
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  originalApi = (window as unknown as { electronAPI?: unknown }).electronAPI
  wizardLifecycle.mounted = 0
  wizardLifecycle.unmounted = 0
  const now = Date.now()
  const api = permissiveApi({
    debug: { log: vi.fn(), isDebugMode: false },
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
        profiles: [
          { id: 'default', name: 'Default', type: 'local', createdAt: now, updatedAt: now },
          { id: 'other', name: 'Other', type: 'local', createdAt: now, updatedAt: now },
        ],
        activeProfileIds: ['default'],
      })),
    },
    app: { getWindowProfile: vi.fn(async () => 'default') },
    claude: { getStatuslineExtras: vi.fn(async () => ({})) },
  }) as Record<string, unknown>
  api.platform = 'win32'
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
})

afterEach(() => {
  cleanup()
  ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalApi
})

/** A real key press lands on the focused element (here: body) and bubbles up. */
function pressEsc(target: Element = document.activeElement ?? document.body, init: KeyboardEventInit = {}) {
  return fireEvent.keyDown(target, { key: 'Escape', ...init })
}

describe('Esc closes the dialog (T0567)', () => {
  test('Settings: Esc = [X]', async () => {
    const onClose = vi.fn()
    render(<SettingsPanel onClose={onClose} />)
    await screen.findByRole('heading', { name: en.settings.title })
    pressEsc()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('Workspace Settings: Esc = [X]', () => {
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
    pressEsc()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('confirmation dialog: Esc = cancel, never confirm', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const onConfirmAndClean = vi.fn()
    render(<CloseConfirmDialog onConfirm={onConfirm} onCancel={onCancel} isWorktree onConfirmAndClean={onConfirmAndClean} />)
    pressEsc()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onConfirmAndClean).not.toHaveBeenCalled()
  })

  test('About and the app notification: Esc = [X]', () => {
    const onAbout = vi.fn()
    const { unmount } = render(<AboutPanel onClose={onAbout} />)
    pressEsc()
    expect(onAbout).toHaveBeenCalledTimes(1)
    unmount()

    const onNotice = vi.fn()
    render(<AppNotificationDialog message="hi" onClose={onNotice} />)
    pressEsc()
    expect(onNotice).toHaveBeenCalledTimes(1)
  })

  test('Claude panel modal (Prompt History): Esc closes it through the shared mechanism', async () => {
    // isActive=false: the panel's own window shortcut handler is not registered, so only
    // ModalOverlay can close the modal.
    const { container } = render(<ClaudeAgentPanel sessionId="t0567-claude" cwd="C:\\repo" isActive={false} />)
    const link = await waitFor(() => {
      const el = container.querySelector<HTMLElement>(`[title="${en.claude.viewPromptHistory}"]`)
      expect(el).not.toBeNull()
      return el!
    })
    await act(async () => { fireEvent.click(link) })
    expect(container.querySelector('.claude-prompt-history-modal')).not.toBeNull()
    await act(async () => { pressEsc(document.body) })
    expect(container.querySelector('.claude-prompt-history-modal')).toBeNull()
  })

  test('a dialog that takes Esc stops it from reaching window shortcuts underneath', () => {
    const windowEsc = vi.fn()
    window.addEventListener('keydown', windowEsc)
    try {
      const onClose = vi.fn()
      render(<AboutPanel onClose={onClose} />)
      pressEsc()
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(windowEsc).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', windowEsc)
    }
  })

  test('without any dialog, Esc is left alone', () => {
    const windowEsc = vi.fn()
    window.addEventListener('keydown', windowEsc)
    try {
      expect(topModal()).toBeUndefined()
      pressEsc(document.body)
      expect(windowEsc).toHaveBeenCalledTimes(1)
      expect(windowEsc.mock.calls[0][0].defaultPrevented).toBe(false)
    } finally {
      window.removeEventListener('keydown', windowEsc)
    }
  })
})

describe('only the topmost dialog reacts (T0567)', () => {
  test('Profiles → delete confirmation: Esc cancels the confirmation, then closes Profiles', async () => {
    const onClose = vi.fn()
    render(<ProfilePanel onClose={onClose} onSwitchNewWindow={vi.fn()} />)
    const deleteButtons = await screen.findAllByTestId('profile-card-delete')
    fireEvent.click(deleteButtons[deleteButtons.length - 1])
    await screen.findByRole('heading', { name: en.profiles.deleteProfile })

    pressEsc()
    expect(screen.queryByRole('heading', { name: en.profiles.deleteProfile })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    pressEsc()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('nested dialogs mounted together: the inner one is on top', () => {
    const outer = vi.fn()
    const inner = vi.fn()
    render(
      <ModalOverlay className="dialog-overlay" onEscape={outer}>
        <ModalOverlay className="dialog-overlay" onEscape={inner}>
          <span>inner</span>
        </ModalOverlay>
      </ModalOverlay>,
    )
    pressEsc()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })

  test('sibling dialogs: the one opened later is on top', () => {
    const first = vi.fn()
    const second = vi.fn()
    function Two() {
      const [open, setOpen] = useState(false)
      useEffect(() => { setOpen(true) }, [])
      return (
        <>
          {open && <ModalOverlay className="dialog-overlay" onEscape={second}><span>second</span></ModalOverlay>}
          <ModalOverlay className="dialog-overlay" onEscape={first}><span>first</span></ModalOverlay>
        </>
      )
    }
    render(<Two />)
    pressEsc()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  test('a dialog that is not shown (hidden agent panel) is skipped', () => {
    const visible = vi.fn()
    const hidden = vi.fn()
    render(
      <>
        <ModalOverlay className="dialog-overlay" onEscape={visible}><span>visible</span></ModalOverlay>
        <div data-hidden-panel="">
          <ModalOverlay className="dialog-overlay" onEscape={hidden}><span>hidden</span></ModalOverlay>
        </div>
      </>,
    )
    const proto = HTMLElement.prototype as HTMLElement & { checkVisibility?: () => boolean }
    const original = proto.checkVisibility
    proto.checkVisibility = function (this: HTMLElement) { return !this.closest('[data-hidden-panel]') }
    try {
      pressEsc()
      expect(visible).toHaveBeenCalledTimes(1)
      expect(hidden).not.toHaveBeenCalled()
    } finally {
      if (original) proto.checkVisibility = original
      else Reflect.deleteProperty(proto, 'checkVisibility')
    }
  })
})

describe('Esc that something else already handled (T0567)', () => {
  /** A dialog with an input whose slash menu handles Esc (preventDefault), like PromptBox. */
  function DialogWithSlashMenu({ onClose, stop }: { onClose: () => void; stop?: boolean }) {
    const [menu, setMenu] = useState(true)
    return (
      <ModalOverlay className="dialog-overlay" onEscape={onClose}>
        <input
          aria-label="prompt"
          onKeyDown={e => {
            if (menu && e.key === 'Escape') {
              if (stop) e.stopPropagation()
              else e.preventDefault()
              setMenu(false)
            }
          }}
        />
        {menu && <ul data-testid="slash-menu"><li>/help</li></ul>}
      </ModalOverlay>
    )
  }

  test.each([
    ['preventDefault', false],
    ['stopPropagation', true],
  ])('a slash menu in the dialog takes Esc (%s): only the menu closes', (_how, stop) => {
    const onClose = vi.fn()
    render(<DialogWithSlashMenu onClose={onClose} stop={stop} />)
    const input = screen.getByLabelText('prompt')
    input.focus()
    pressEsc(input)
    expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    pressEsc(input)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('Esc during IME composition does not close the dialog', () => {
    const onClose = vi.fn()
    render(<AboutPanel onClose={onClose} />)
    pressEsc(document.body, { isComposing: true })
    pressEsc(document.body, { keyCode: 229 })
    expect(onClose).not.toHaveBeenCalled()
    pressEsc(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('dialogs without Esc (T0567)', () => {
  test('RecoveryPrompt: Esc picks neither option and keeps it open', () => {
    const onRecover = vi.fn()
    const onFreshStart = vi.fn()
    render(<RecoveryPrompt ptyCount={2} onRecover={onRecover} onFreshStart={onFreshStart} />)
    pressEsc()
    expect(onRecover).not.toHaveBeenCalled()
    expect(onFreshStart).not.toHaveBeenCalled()
    expect(document.querySelector('.recovery-prompt-overlay')).not.toBeNull()
  })

  test('RecoveryPrompt over Settings: Esc does not reach Settings either', async () => {
    const onClose = vi.fn()
    render(
      <>
        <SettingsPanel onClose={onClose} />
        <RecoveryPrompt ptyCount={1} onRecover={vi.fn()} onFreshStart={vi.fn()} />
      </>,
    )
    await screen.findByRole('heading', { name: en.settings.title })
    pressEsc()
    expect(onClose).not.toHaveBeenCalled()
  })

  test('setup wizard open: Esc closes neither the wizard nor Profiles; after [X] Esc closes Profiles', async () => {
    const onClose = vi.fn()
    render(<ProfilePanel onClose={onClose} onSwitchNewWindow={vi.fn()} />)
    await screen.findByRole('heading', { name: en.profiles.title })
    fireEvent.click(screen.getByRole('button', { name: en.profiles.addMore }))
    fireEvent.click(screen.getByText(en.profiles.addWslProfile))
    await screen.findByTestId('wizard-shell-stub')
    expect(wizardLifecycle.mounted).toBe(1)

    pressEsc()
    pressEsc(document.body)
    expect(screen.getByTestId('wizard-shell-stub')).toBeInTheDocument()
    expect(wizardLifecycle.unmounted).toBe(0)
    expect(onClose).not.toHaveBeenCalled()

    const closeButtons = document.querySelectorAll<HTMLElement>('.settings-header .settings-close')
    fireEvent.click(closeButtons[closeButtons.length - 1])
    expect(screen.queryByTestId('wizard-shell-stub')).not.toBeInTheDocument()
    expect(wizardLifecycle.unmounted).toBe(1)
    expect(onClose).not.toHaveBeenCalled()

    pressEsc()
    expect(onClose).toHaveBeenCalledTimes(1)
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

/** JSX `<ModalOverlay ...>` opening tags, tolerant of `=>` inside attribute expressions. */
function modalOverlayTags(src: string): string[] {
  const tags: string[] = []
  const re = /<ModalOverlay\b/g
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

const rel = (f: string) => relative(SRC, f).replace(/\\/g, '/')

/** Dialogs that deliberately have no Esc (T0567 spec), with how many such overlays each file has. */
const NO_ESCAPE_DIALOGS: Record<string, number> = {
  'components/RecoveryPrompt.tsx': 1, // must-decide prompt (T0563 issue 1)
  'components/ProfilePanel.tsx': 3, // WSL / Docker / SSH setup wizards: Esc must not cancel / roll back
}

/**
 * Files that render a dialog and also own a window shortcut handler that predates T0567 (agent
 * panels: zoom, Ctrl+P, Esc = interrupt / close file picker ...). Exactly one keydown listener each.
 */
const PANEL_SHORTCUT_FILES = ['components/ClaudeAgentPanel.tsx', 'components/CodexAgentPanel.tsx']

describe('source guard (T0567)', () => {
  const files = tsxFiles(SRC)
  const dialogFiles = files.filter(f => /<ModalOverlay\b/.test(readFileSync(f, 'utf8')))

  test('every dialog declares onEscape, except the listed ones without Esc', () => {
    const missing: Record<string, number> = {}
    for (const f of dialogFiles) {
      const n = modalOverlayTags(readFileSync(f, 'utf8')).filter(tag => !/\bonEscape=/.test(tag)).length
      if (n > 0) missing[rel(f)] = n
    }
    expect(missing).toEqual(NO_ESCAPE_DIALOGS)
  })

  test('dialogs do not add their own keydown listener to close on Esc', () => {
    const offenders: string[] = []
    for (const f of dialogFiles) {
      const src = readFileSync(f, 'utf8')
      const listeners = (src.match(/addEventListener\(\s*['"]keydown['"]/g) ?? []).length
      const allowed = PANEL_SHORTCUT_FILES.includes(rel(f)) ? 1 : 0
      if (listeners !== allowed) offenders.push(`${rel(f)}: ${listeners} keydown listener(s), expected ${allowed}`)
    }
    expect(offenders).toEqual([])
  })

  test('the Esc listener lives in modal-stack only; ModalOverlay registers through it', () => {
    const stack = readFileSync(join(SRC, 'components/common/modal-stack.ts'), 'utf8')
    expect(stack).toMatch(/document\.addEventListener\('keydown', onKeyDown\)/)
    expect(stack).toMatch(/isComposing/)
    expect(stack).toMatch(/defaultPrevented/)
    const overlay = readFileSync(join(SRC, 'components/common/ModalOverlay.tsx'), 'utf8')
    expect(overlay).toMatch(/registerModal\(/)
    expect(overlay).not.toMatch(/addEventListener/)
  })

  test('the guard sees the dialogs it is meant to cover', () => {
    const covered = dialogFiles.map(rel)
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
      'components/UpdateNotification.tsx',
      'components/RecoveryPrompt.tsx',
      'components/profiles/EditRemoteProfileModal.tsx',
      'components/remote-tools/InstallConfirmDialog.tsx',
    ]) expect(covered).toContain(f)
  })
})
