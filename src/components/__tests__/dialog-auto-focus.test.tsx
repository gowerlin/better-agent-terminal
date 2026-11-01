/**
 * T0776 (BUG-194): a dialog that opens by itself while a terminal's xterm has the keyboard focus.
 * xterm handles Esc on its own textarea (writes ESC to the PTY, `preventDefault` +
 * `stopPropagation`), so before T0776 the first Esc never reached `modal-stack` and the dialog
 * stayed open. `ModalOverlay` now:
 *  - focuses its backdrop when the focus is outside the dialog on mount → Esc closes it, the
 *    xterm stand-in never sees the key
 *  - leaves an `autoFocus` child's focus alone
 *  - gives the focus back to the element it took it from on close (still in the document, and
 *    only when the focus is still in the dialog or nowhere)
 * Real components: InterruptedAgentsDialog, AppNotificationDialog, RecoveryPrompt (no `onEscape`:
 * Esc does nothing, but it does not reach the background terminal either).
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { useState } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import { AppNotificationDialog } from '../AppNotificationDialog'
import { ModalOverlay } from '../common/ModalOverlay'
import { InterruptedAgentsDialog, type InterruptedAgentRow } from '../InterruptedAgentsDialog'
import { RecoveryPrompt } from '../RecoveryPrompt'

const SRC = resolve(__dirname, '..', '..')

/** A stand-in for xterm's helper textarea: takes Esc like xterm does (it would write ESC to the PTY). */
let xterm: HTMLTextAreaElement
let ptyKeys: string[]

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  ptyKeys = []
  xterm = document.createElement('textarea')
  xterm.className = 'xterm-helper-textarea'
  xterm.addEventListener('keydown', (e) => {
    ptyKeys.push(e.key)
    e.preventDefault()
    e.stopPropagation()
  })
  document.body.appendChild(xterm)
  xterm.focus()
})

afterEach(() => {
  cleanup()
  xterm.remove()
})

/** What a real key press does: keydown on whatever has the focus. */
function pressEsc() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
}

const overlay = () => document.querySelector('[data-modal-overlay]') as HTMLElement

describe('ModalOverlay focus (T0776)', () => {
  test('opened while the xterm has the focus: the focus moves into the dialog, the first Esc closes it, the PTY gets nothing', () => {
    expect(document.activeElement).toBe(xterm)
    function Host() {
      const [open, setOpen] = useState(true)
      return open ? <ModalOverlay className="dialog-overlay" onEscape={() => setOpen(false)}><div className="dialog">hi</div></ModalOverlay> : null
    }
    render(<Host />)
    expect(overlay().contains(document.activeElement)).toBe(true)
    pressEsc()
    expect(document.querySelector('[data-modal-overlay]')).toBeNull()
    expect(ptyKeys).toEqual([])
    // closed → the focus is back on the terminal, typing goes on there
    expect(document.activeElement).toBe(xterm)
  })

  test('the backdrop is focusable by script only and draws no focus ring', () => {
    render(<ModalOverlay className="dialog-overlay" onEscape={() => {}}><div /></ModalOverlay>)
    expect(overlay().getAttribute('tabindex')).toBe('-1')
    expect(overlay().style.outline).toBe('none')
  })

  test('a dialog whose autoFocus child has the focus keeps it, and on close the focus still goes back to the xterm', () => {
    function Host() {
      const [open, setOpen] = useState(true)
      return open
        ? <ModalOverlay className="dialog-overlay" onEscape={() => setOpen(false)}><input data-testid="name" autoFocus /></ModalOverlay>
        : null
    }
    render(<Host />)
    expect(document.activeElement).toBe(screen.getByTestId('name'))
    pressEsc()
    expect(document.querySelector('[data-modal-overlay]')).toBeNull()
    expect(document.activeElement).toBe(xterm)
    expect(ptyKeys).toEqual([])
  })

  test('a dialog that focuses its own element after mounting (useEffect) is not overridden', () => {
    function Dialog() {
      return (
        <ModalOverlay className="dialog-overlay" onEscape={() => {}}>
          <input data-testid="later" ref={(el) => { if (el) queueMicrotask(() => el.focus()) }} />
        </ModalOverlay>
      )
    }
    render(<Dialog />)
    return Promise.resolve().then(() => {
      expect(document.activeElement).toBe(screen.getByTestId('later'))
    })
  })

  test('on close the focus does not go back when the dialog moved it elsewhere itself', () => {
    const other = document.createElement('input')
    document.body.appendChild(other)
    function Host() {
      const [open, setOpen] = useState(true)
      return open
        ? <ModalOverlay className="dialog-overlay" onEscape={() => { other.focus(); setOpen(false) }}><div /></ModalOverlay>
        : null
    }
    render(<Host />)
    pressEsc()
    expect(document.activeElement).toBe(other)
    other.remove()
  })

  test('the element it came from is gone → the focus is not forced anywhere', () => {
    function Host() {
      const [open, setOpen] = useState(true)
      return open ? <ModalOverlay className="dialog-overlay" onEscape={() => setOpen(false)}><div /></ModalOverlay> : null
    }
    render(<Host />)
    xterm.remove()
    expect(() => pressEsc()).not.toThrow()
    expect(document.querySelector('[data-modal-overlay]')).toBeNull()
    expect(document.activeElement).not.toBe(xterm)
  })

  test('a second dialog opening by itself over the first: Esc closes the top one, focus goes back to the first, the next Esc closes it, then the xterm', () => {
    let openB: (v: boolean) => void = () => {}
    function Host() {
      const [a, setA] = useState(true)
      const [b, setB] = useState(false)
      openB = setB
      return (
        <>
          {a && <ModalOverlay className="dialog-overlay a" onEscape={() => setA(false)}><button data-testid="a-btn">A</button></ModalOverlay>}
          {b && <ModalOverlay className="dialog-overlay b" onEscape={() => setB(false)}><div>B</div></ModalOverlay>}
        </>
      )
    }
    render(<Host />)
    const a = document.querySelector('.dialog-overlay.a') as HTMLElement
    expect(document.activeElement).toBe(a)
    act(() => openB(true))
    const b = document.querySelector('.dialog-overlay.b') as HTMLElement
    expect(document.activeElement).toBe(b)
    pressEsc()
    expect(document.querySelector('.dialog-overlay.b')).toBeNull()
    expect(document.activeElement).toBe(a)
    pressEsc()
    expect(document.querySelector('.dialog-overlay.a')).toBeNull()
    expect(document.activeElement).toBe(xterm)
    expect(ptyKeys).toEqual([])
  })

  test('the dialog underneath closing first does not pull the focus out of the top one', () => {
    let closeA: () => void = () => {}
    function Host() {
      const [a, setA] = useState(true)
      closeA = () => setA(false)
      return (
        <>
          {a && <ModalOverlay className="dialog-overlay a" onEscape={() => setA(false)}><div /></ModalOverlay>}
          <ModalOverlay className="dialog-overlay b" onEscape={() => {}}><div /></ModalOverlay>
        </>
      )
    }
    render(<Host />)
    const b = document.querySelector('.dialog-overlay.b') as HTMLElement
    expect(document.activeElement).toBe(b)
    act(() => closeA())
    expect(document.activeElement).toBe(b)
  })
})

describe('dialogs that open by themselves (T0776 inventory)', () => {
  const agentRow: InterruptedAgentRow = {
    agent: { terminalId: 't1', agent: 'claude-cli', claudeSessionId: null, claudeSessionName: null, launchedBy: 'tab', cwd: '/w', at: 1 },
    title: 'Claude CLI',
    workspaceId: 'ws-1',
    workspaceName: 'Alpha',
  }

  test('InterruptedAgentsDialog (Terminal Server recovery): the first Esc closes it, the PTY gets nothing, focus back on the xterm', () => {
    const onClose = vi.fn()
    function Host() {
      const [open, setOpen] = useState(true)
      return open
        ? <InterruptedAgentsDialog rows={[agentRow]} busy={new Set()} message={null} onResume={vi.fn()} onResumeAll={vi.fn()} onDismiss={vi.fn()} onClose={() => { onClose(); setOpen(false) }} />
        : null
    }
    render(<Host />)
    expect(overlay().contains(document.activeElement)).toBe(true)
    pressEsc()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.interrupted-agents-dialog')).toBeNull()
    expect(ptyKeys).toEqual([])
    expect(document.activeElement).toBe(xterm)
  })

  test('AppNotificationDialog (IPC / async notices): the first Esc closes it, the PTY gets nothing', () => {
    function Host() {
      const [message, setMessage] = useState<string | null>('Remote connection failed')
      return message ? <AppNotificationDialog message={message} onClose={() => setMessage(null)} /> : null
    }
    render(<Host />)
    expect(overlay().contains(document.activeElement)).toBe(true)
    pressEsc()
    expect(document.querySelector('.app-notification')).toBeNull()
    expect(ptyKeys).toEqual([])
    expect(document.activeElement).toBe(xterm)
  })

  test('RecoveryPrompt (no onEscape): Esc does nothing, and it does not reach the background terminal', () => {
    render(<RecoveryPrompt ptyCount={2} onRecover={vi.fn()} onFreshStart={vi.fn()} />)
    expect(overlay().contains(document.activeElement)).toBe(true)
    pressEsc()
    expect(document.querySelector('.recovery-prompt-dialog')).not.toBeNull()
    expect(ptyKeys).toEqual([])
  })
})

describe('source guard (T0776)', () => {
  test('ModalOverlay is the one place: it takes the focus on mount and gives it back on close', () => {
    const overlaySrc = readFileSync(join(SRC, 'components/common/ModalOverlay.tsx'), 'utf8')
    expect(overlaySrc).toMatch(/takeDialogFocus\(/)
    expect(overlaySrc).toMatch(/restoreDialogFocus\(/)
    expect(overlaySrc).toMatch(/tabIndex=\{-1\}/)
    const stack = readFileSync(join(SRC, 'components/common/modal-stack.ts'), 'utf8')
    // T0567's listener is unchanged: bubble phase on document, no capture
    expect(stack).toMatch(/document\.addEventListener\('keydown', onKeyDown\)/)
    expect(stack).not.toMatch(/addEventListener\('keydown', onKeyDown, (true|\{)/)
  })
})
